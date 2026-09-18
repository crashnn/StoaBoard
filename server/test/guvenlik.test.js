// Güvenlik regresyon testleri.
//
// Buradaki her test, gerçekten yaşanmış bir kusuru kilitliyor. Yeni bir test
// eklerken hangi kusuru koruduğunu yaz — testin değeri, koruduğu şeyin
// hatırlanmasında.
//
// Bilerek veritabanı gerektirmiyor: yetkilendirme ve çıktı üretimi saf
// modüllere ayrıldı, böylece testler her ortamda saniyeler içinde koşuyor.
//
//   çalıştır:  npm.cmd test        (Windows PowerShell)
//              npm test            (Git Bash / macOS / Linux)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, toCsv, csvBuffer, CSV_BOM } from '../src/lib/csv.js';
import { _bearerToken } from '../src/lib/mcpAuth.js';
import {
  ALL_PERMISSIONS,
  memberPermissions,
  hasPermission,
  hasAnyPermission,
} from '../src/lib/permissions.js';
import { renderNotification } from '../src/lib/mailer.js';
import { parseMcpTokens, lookupSlug, MIN_TOKEN_LENGTH, anahtarOzetSatiri, hashToken } from '../src/lib/mcpToken.js';
import { atananlariDenetle, atamaSluglari } from '../src/lib/assignees.js';
import { bahsedilenleriCoz, adKatla } from '../src/lib/mentions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CSV formül enjeksiyonu ────────────────────────────────────────────────
//
// Kusur (1 Eylül 2026, yüksek): rapor CSV'lerindeki görev başlıkları ve kişi
// adları kullanıcı girdisiydi. Excel '=' '+' '-' '@' ile başlayan hücreyi
// formül sayıp çalıştırıyor; tırnaklamak engellemiyor. Bir üye kart başlığını
// =HYPERLINK(...) yapıp raporu açan yöneticinin makinesinde veri sızdırabilirdi.

describe('csvCell — formül enjeksiyonu koruması', () => {
  for (const payload of [
    '=1+1',
    '=HYPERLINK("http://saldirgan.tld","tikla")',
    '+1+1',
    '-1+1',
    '@SUM(1+1)',
    '\tzararlı',
    '\rzararlı',
  ]) {
    test(`tehlikeli önek metne sabitlenir: ${JSON.stringify(payload)}`, () => {
      const out = csvCell(payload);
      const govde = out.startsWith('"') ? out.slice(1, -1) : out;
      assert.ok(govde.startsWith("'"), `beklenen tek tırnak öneki, gelen: ${out}`);
    });
  }

  test('zararsız metne dokunulmaz', () => {
    assert.equal(csvCell('Tasarım Projesi'), 'Tasarım Projesi');
    assert.equal(csvCell('Ali Veli'), 'Ali Veli');
  });

  test('sayılar bozulmaz — negatif değer metne dönmemeli', () => {
    assert.equal(csvCell(-5), '-5');
    assert.equal(csvCell(0), '0');
    assert.equal(csvCell(90), '90');
    assert.equal(csvCell(1.5), '1.5');
  });

  test('boş ve tanımsız değerler boş hücre olur', () => {
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(undefined), '');
    assert.equal(csvCell(''), '');
  });
});

describe('csvCell — ayraç kaçışı', () => {
  test('noktalı virgül içeren değer tırnaklanır', () => {
    assert.equal(csvCell('a;b'), '"a;b"');
  });

  test('tırnak ikilenir', () => {
    assert.equal(csvCell('o "dedi"'), '"o ""dedi"""');
  });

  test('satır sonu tırnak içine alınır', () => {
    assert.equal(csvCell('bir\niki'), '"bir\niki"');
  });

  test('enjeksiyon ve ayraç birlikte gelirse ikisi de uygulanır', () => {
    // Hem formül öneki hem ayraç: önce metne sabitlenir, sonra tırnaklanır.
    assert.equal(csvCell('=a;b'), `"'=a;b"`);
  });
});

describe('toCsv', () => {
  test('BOM ile başlar — Excel Türkçe karakterleri doğru okusun', () => {
    const out = toCsv(['Başlık'], [['değer']]);
    assert.ok(out.startsWith(CSV_BOM), 'BOM eksik');
  });

  // 15 Eylül 2026: biçim UTF-8 + `sep=;` + noktalı virgülden UTF-16LE + sekmeye
  // geçti. Excel `sep=` satırını görünce UTF-8 BOM'u yok sayıp dosyayı ANSI
  // okuyordu (Türkçe karakterler bozuk); `sep=` olmadan ise ayraç Windows bölge
  // ayarına bağlıydı (TR `;`, ABD `,`). UTF-16LE'yi Excel her bölgede aynı
  // açıyor. Bu test eski `sep=` satırının geri gelmesini engelliyor.
  test('sekmeyle ayrılır, sep= yönergesi YOK — Excel BOM ile sep= birlikteyken BOM\'u yok sayıyor', () => {
    const out = toCsv(['a', 'b'], [['1', '2']]);
    assert.equal(out, `${CSV_BOM}a\tb\r\n1\t2`);
    assert.ok(!/sep=/.test(out), 'sep= yönergesi geri gelmiş');
  });

  test('csvBuffer UTF-16LE: ilk iki bayt FF FE, gövde iki baytlı, Türkçe karakter korunur', () => {
    const buf = csvBuffer(['Başlık'], [['taşındı']]);
    assert.equal(buf[0], 0xff);
    assert.equal(buf[1], 0xfe);
    const metin = buf.toString('utf16le');
    assert.equal(metin, `${CSV_BOM}Başlık\r\ntaşındı`);
    // UTF-8 diye okunsaydı bozulurdu — mojibake'nin kendisi test ediliyor
    assert.ok(!buf.toString('utf8').includes('taşındı'));
  });

  test('sekme içeren hücre tırnaklanır — ayraç artık sekme', () => {
    assert.equal(csvCell('a\tb'), '"a\tb"');
  });

  test('başlık satırı da korumadan geçer', () => {
    const out = toCsv(['=kotu'], []);
    assert.ok(out.includes("'=kotu"));
  });
});

// ─── Yetkilendirme ─────────────────────────────────────────────────────────
//
// Kapalı başarısızlık kuralı: üye yoksa ya da izin bilinmiyorsa daima red.

describe('hasPermission', () => {
  const uye = (perms) => ({ role: 'member', workspaceRole: { permissions: perms } });

  test('üye yoksa daima false — kapalı başarısızlık', () => {
    assert.equal(hasPermission(null, 'manage_tasks'), false);
    assert.equal(hasPermission(undefined, 'manage_tasks'), false);
  });

  test('sahip her izne sahiptir', () => {
    const sahip = { role: 'owner' };
    for (const p of ALL_PERMISSIONS) {
      assert.equal(hasPermission(sahip, p), true, `sahip ${p} iznini alamadı`);
    }
  });

  test('izni olan geçer, olmayan geçemez', () => {
    const m = uye(['manage_tasks']);
    assert.equal(hasPermission(m, 'manage_tasks'), true);
    assert.equal(hasPermission(m, 'manage_members'), false);
    assert.equal(hasPermission(m, 'view_reports'), false);
  });

  test('rolü olmayan üyenin hiçbir izni yoktur', () => {
    assert.equal(hasPermission({ role: 'member' }, 'manage_tasks'), false);
  });

  test('izin listesi bozuk gelirse red — dizi değilse yok sayılır', () => {
    assert.equal(hasPermission(uye(null), 'manage_tasks'), false);
    assert.equal(hasPermission(uye('manage_tasks'), 'manage_tasks'), false);
    assert.equal(hasPermission(uye({}), 'manage_tasks'), false);
  });

  test('bilinmeyen izin adı geçmez', () => {
    assert.equal(hasPermission(uye(['manage_tasks']), 'her_seyi_yap'), false);
  });

  test('hasAnyPermission en az biri yeterli', () => {
    const m = uye(['manage_labels']);
    assert.equal(hasAnyPermission(m, ['manage_projects', 'manage_labels']), true);
    assert.equal(hasAnyPermission(m, ['manage_projects', 'manage_members']), false);
    assert.equal(hasAnyPermission(null, ['manage_labels']), false);
  });
});

describe('memberPermissions', () => {
  // Kusur (1 Eylül 2026): sahip için sabit üç izinlik eski bir liste
  // dönüyordu. hasPermission sahibi kısa devre yaptığı için fark edilmiyordu,
  // ama bu fonksiyonu doğrudan çağıran yerler (lib/notes.js) sahibi yanlışlıkla
  // yetkisiz sayabilirdi.
  test('sahip için tüm izinler döner', () => {
    const p = memberPermissions({ role: 'owner' });
    for (const perm of ALL_PERMISSIONS) {
      assert.ok(p.includes(perm), `sahip listesinde ${perm} eksik`);
    }
  });

  test('üye yoksa boş liste', () => {
    assert.deepEqual(memberPermissions(null), []);
  });
});

// ─── İzin listesi eşleşmesi ────────────────────────────────────────────────
//
// Kusur (1 Eylül 2026): arayüz 'invite_members' iznini sunuyordu ama sunucu
// onu hiçbir yerde kontrol etmiyordu — yönetici verdiğini sandığı yetkiyi
// vermemiş oluyordu. Ters yönde 'manage_workspace' sunucuda uygulanıyor ama
// arayüzde listelenmediği için kimseye verilemiyordu.

describe('izin listesi — sunucu ile arayüz aynı olmalı', () => {
  test('settings.jsx içindeki liste ALL_PERMISSIONS ile birebir eşleşir', () => {
    const settingsPath = path.resolve(
      __dirname, '..', '..', 'client', 'src', 'views', 'settings.jsx',
    );
    const src = yorumsuzDosya(settingsPath);

    const blok = src.slice(
      src.indexOf('const PERM_LABELS_KEYS = {'),
      src.indexOf('const ALL_PERMS'),
    );
    assert.ok(blok.length > 0, 'settings.jsx içinde PERM_LABELS_KEYS bulunamadı');

    const arayuz = [...blok.matchAll(/^\s{2}([a-z_]+)\s*:/gm)].map((m) => m[1]);

    const eksikArayuzde = ALL_PERMISSIONS.filter((p) => !arayuz.includes(p));
    const fazlaArayuzde = arayuz.filter((p) => !ALL_PERMISSIONS.includes(p));

    assert.deepEqual(
      eksikArayuzde, [],
      'Sunucuda tanımlı ama arayüzde yok — bu izin hiçbir role verilemez',
    );
    assert.deepEqual(
      fazlaArayuzde, [],
      'Arayüzde var ama sunucuda yok — yönetici verdiğini sandığı yetkiyi vermez',
    );
  });
});

// ─── Bildirim gövdesi ──────────────────────────────────────────────────────

describe('renderNotification', () => {
  test('bahsetme bildirimindeki HTML etiketleri temizlenir', () => {
    const r = renderNotification('<strong>Ali</strong> seni bahsetti: <img src=x>');
    assert.equal(r.type, 'mention');
    assert.ok(!r.body.includes('<'), `etiket kalmış: ${r.body}`);
    assert.ok(r.body.includes('Ali'));
  });

  test('bilinen tür okunabilir gövdeye çevrilir', () => {
    const r = renderNotification(
      JSON.stringify({ type: 'task_assigned', task: 'Rapor', who: 'Ayşe' }),
    );
    assert.equal(r.type, 'task_assigned');
    assert.ok(r.body.includes('Rapor'));
    assert.ok(r.body.includes('Ayşe'));
  });

  test('bozuk girdi çökmez', () => {
    assert.doesNotThrow(() => renderNotification(''));
    assert.doesNotThrow(() => renderNotification(null));
    assert.doesNotThrow(() => renderNotification('{bozuk json'));
  });
});

// ─── Toplu kalıcı silme yetki kapısı ────────────────────────────────────────
//
// Kusur (2 Eylül 2026): `DELETE /workspaces/me/trash` yalnızca üyelik kontrol
// ediyordu, hiçbir izin istemiyordu. Oysa tekil `DELETE /tasks/:id/permanent`
// `manage_tasks` istiyor. Yani işlemin geri dönüşsüz, çalışma alanını tümüyle
// kapsayan toplu hâli, tekil hâlinden daha az korunuyordu: sıradan (ya da ele
// geçirilmiş) bir üye herkesin çöp kutusunu kalıcı silebiliyordu.
//
// Veritabanı gerektirmeden, uç işleyicisinin kaynağında yetki kapısının
// bulunduğunu doğruluyoruz — kapı kaldırılırsa bu test düşer.

describe('çöp kutusu boşaltma — toplu kalıcı silme yetki ister', () => {
  // Satır sonundan bağımsız olsun diye CRLF → LF normalize edilir.
  const wsSrc = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'workspaces.js'));

  // DELETE /me/trash işleyicisini izole et: tanımından bir sonraki uca kadar.
  function trashDeleteHandler(src) {
    const marker = "workspacesRouter.delete(\n  '/me/trash'";
    const start = src.indexOf(marker);
    assert.ok(start !== -1, "DELETE /me/trash işleyicisi bulunamadı");
    const rest = src.slice(start + marker.length);
    const end = rest.indexOf('workspacesRouter.');
    return end === -1 ? rest : rest.slice(0, end);
  }

  test('silmeden önce manage_tasks izni kontrol ediliyor', () => {
    const handler = trashDeleteHandler(wsSrc);
    assert.ok(
      /hasPermission\(\s*member\s*,\s*'manage_tasks'\s*\)/.test(handler),
      'toplu kalıcı silme manage_tasks kapısı olmadan çalışıyor — regresyon',
    );
    // Kapı, silme çağrısından ÖNCE gelmeli (erken 403).
    const izinIdx = handler.search(/hasPermission\(\s*member\s*,\s*'manage_tasks'/);
    const silmeIdx = handler.indexOf('deleteMany');
    assert.ok(
      izinIdx !== -1 && (silmeIdx === -1 || izinIdx < silmeIdx),
      'yetki kontrolü silme işleminden sonra geliyor — kapalı başarısızlık ihlali',
    );
  });

  test('toplu kalıcı silme denetim kaydına yazılıyor', () => {
    const handler = trashDeleteHandler(wsSrc);
    assert.ok(
      /AUDIT\.WORKSPACE_TRASH_EMPTIED/.test(handler),
      'geri dönüşsüz toplu silme denetim kaydı bırakmıyor',
    );
  });
});

// ─── Denetim kaydı kapsamı — hassas yönetim eylemleri ───────────────────────
//
// GUVENLIK.md §5 açık madde: denetim kaydı yalnızca dışa aktarmayı yazıyordu.
// Üye çıkarma ve rol değişikliği — ele geçirilmiş bir yönetici hesabının
// yayılma araçları — de yazılmalı (Okta/Lapsus$ dersi). Eylem adları
// lib/audit.js içinde zaten tanımlıydı; bu test bunların uca bağlandığını
// kilitliyor.

describe('denetim kaydı — yönetim eylemleri bağlı', () => {
  // Satır sonundan bağımsız olsun diye CRLF → LF normalize edilir.
  const wsSrc = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'workspaces.js'));

  for (const action of ['MEMBER_REMOVED', 'MEMBER_ROLE_CHANGED', 'WORKSPACE_TRASH_EMPTIED', 'INVITE_CODE_VIEWED']) {
    test(`${action} denetim kaydına yazılıyor`, () => {
      assert.ok(
        wsSrc.includes(`AUDIT.${action}`),
        `${action} hiçbir uca bağlanmamış — denetim kaydı kapsamı eksik`,
      );
    });
  }
});

// ─── Davet kodu görüntüleme ─────────────────────────────────────────────────
//
// Kusur (2 Eylül'den kalan, 16 Eylül 2026'da kapandı): davet kodu önyükleme
// yanıtında geliyordu, yani her sayfa açılışında sessizce alınıyor ve kimin
// ne zaman gördüğü yazılamıyordu. Kod artık yalnızca kendi ucundan çekiliyor
// ve o uç denetim kaydına yazıyor. Bu test iki şeyi kilitliyor: önyükleme
// kodun kendisini bir daha taşımasın, uç kaydı yazsın.

describe('davet kodu — önyüklemede yok, görüntüleme kayıtlı', () => {
  const apiSrc = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'api.js'));
  const wsSrc2 = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'workspaces.js'));

  test('önyükleme yanıtı invite_code değerini taşımıyor', () => {
    assert.ok(!/invite_code\s*=\s*ws\.inviteCode/.test(apiSrc), 'önyükleme kodun kendisini döndürüyor');
    assert.ok(/has_invite_code\s*=\s*Boolean\(ws\.inviteCode\)/.test(apiSrc), 'önyükleme kodun varlığını bile söylemiyor');
  });

  test("GET /me/invite-code var, requireAuth taşıyor ve INVITE_CODE_VIEWED yazıyor", () => {
    const i = wsSrc2.indexOf("'/me/invite-code'");
    assert.ok(i >= 0, 'uç yok');
    // İlk (GET) kayıt: kayıt başlığından handler sonuna kadar olan pencere.
    const pencere = wsSrc2.slice(i, i + 1400);
    assert.ok(/requireAuth/.test(pencere), 'requireAuth yok');
    assert.ok(/AUDIT\.INVITE_CODE_VIEWED/.test(pencere), 'görüntüleme denetim kaydına yazılmıyor');
    assert.ok(/invite_members/.test(pencere), 'izin kapısı önyüklemedekiyle aynı değil');
  });
});

// ─── Bahsetme bildirimi kapsamı ─────────────────────────────────────────────
//
// Kusur (2 Eylül 2026): chat_message'daki @mention bildirimleri bahsedilen
// kişiyi platform genelinde arıyor, hiçbir çalışma alanı/kanal üyeliği kontrol
// etmiyordu. Bir üye @slug yazarak rastgele birine mesaj önizlemesi (80 karakter)
// sızdırabiliyordu — özel kanalda kanal içeriği, DM'de üçüncü kişiye DM içeriği.
// person-report oracle'ıyla aynı sınıf. Karar mentionAllowed'a çıkarıldı.

import { mentionAllowed } from '../src/lib/channels.js';
import { yorumsuzKaynak, yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';
import { htmlKacir, htmlCoz, sablonDoldur, bildirimMetni, etkinlikMetni } from '../../client/src/bildirimMetni.js';

describe('mentionAllowed — bahsetme bildirimi görünürlük kapısı', () => {
  test('DM: yalnızca karşı tarafa gider', () => {
    assert.equal(mentionAllowed({ isDm: true, mentionedIsReceiver: true }), true);
    assert.equal(mentionAllowed({ isDm: true, mentionedIsReceiver: false }), false);
  });

  test('DM: üçüncü kişi çalışma alanını paylaşsa bile alamaz', () => {
    // DM içeriği yalnızca iki taraf arasında; @üçüncü_kişi bildirim üretmemeli.
    assert.equal(
      mentionAllowed({ isDm: true, mentionedIsReceiver: false, sharesWorkspace: true }),
      false,
    );
  });

  test('genel/açık kanal: çalışma alanı üyeliği yeter', () => {
    assert.equal(mentionAllowed({ sharesWorkspace: true, isPrivateChannel: false }), true);
  });

  test('çalışma alanını paylaşmayan hiçbir kanalda alamaz', () => {
    assert.equal(mentionAllowed({ sharesWorkspace: false, isPrivateChannel: false }), false);
    assert.equal(mentionAllowed({ sharesWorkspace: false, isPrivateChannel: true, hasChannelRole: true }), false);
  });

  test('özel kanal: çalışma alanı üyeliği yetmez, kanal üyeliği de şart', () => {
    assert.equal(
      mentionAllowed({ sharesWorkspace: true, isPrivateChannel: true, hasChannelRole: false }),
      false,
    );
    assert.equal(
      mentionAllowed({ sharesWorkspace: true, isPrivateChannel: true, hasChannelRole: true }),
      true,
    );
  });

  test('boş çağrı — kapalı başarısızlık (varsayılan red)', () => {
    assert.equal(mentionAllowed(), false);
    assert.equal(mentionAllowed({}), false);
  });
});

// ─── MCP anahtarlarının çözümlenmesi ───────────────────────────────────────
//
// Korunan kusur sınıfı: "yapılandırılmamışsa serbest bırak". Bu depodaki üç
// kusurun kök sebebi sessiz atlamaydı (`if (!window.io) return`,
// `window.showToast?.()`, `if (satır && !yetki)`); MCP ucunda aynı refleks,
// anahtar tanımlanmadığında panoyu internete açmak anlamına gelirdi.
//
// İkinci koruduğu şey: kimliği belirsiz bırakan yapılandırma. Aynı anahtarın
// iki kişiye verilmesi "muhtemelen ilki kastedilmiştir" diye yorumlanmaz —
// denetim kaydında yanlış isim, yanlış kişiye giden bildirim demek olurdu.

describe('parseMcpTokens — yapılandırma çözümlemesi', () => {
  const GECERLI = 'a'.repeat(MIN_TOKEN_LENGTH);
  const GECERLI2 = 'b'.repeat(MIN_TOKEN_LENGTH);

  test('tanımsız/boş değer: harita boş — özellik kapalı, açık değil', () => {
    for (const ham of [undefined, null, '', '   ', '\n']) {
      const { tokens } = parseMcpTokens(ham);
      assert.equal(tokens.size, 0);
      assert.equal(lookupSlug(tokens, GECERLI), null);
    }
  });

  test('geçerli çift çözümleniyor, yanlış anahtar reddediliyor', () => {
    const { tokens, warnings } = parseMcpTokens(`eray:${GECERLI}`);
    assert.deepEqual(warnings, []);
    assert.equal(lookupSlug(tokens, GECERLI), 'eray');
    assert.equal(lookupSlug(tokens, GECERLI2), null);
    assert.equal(lookupSlug(tokens, ''), null);
    assert.equal(lookupSlug(tokens, undefined), null);
  });

  test('ham anahtar bellekte tutulmuyor — harita yalnızca özet taşıyor', () => {
    const { tokens } = parseMcpTokens(`eray:${GECERLI}`);
    assert.equal([...tokens.keys()].includes(GECERLI), false);
    assert.match([...tokens.keys()][0], /^[0-9a-f]{64}$/);
  });

  test('kısa anahtar atılıyor ve gürültü çıkarıyor', () => {
    const kisa = 'a'.repeat(MIN_TOKEN_LENGTH - 1);
    const { tokens, warnings } = parseMcpTokens(`eray:${kisa}`);
    assert.equal(tokens.size, 0);
    assert.equal(warnings.length, 1);
    assert.equal(lookupSlug(tokens, kisa), null);
  });

  test('aynı anahtar iki kişide: ikisi de düşüyor', () => {
    const { tokens, warnings } = parseMcpTokens(`eray:${GECERLI},ahmet:${GECERLI}`);
    assert.equal(lookupSlug(tokens, GECERLI), null);
    assert.equal(tokens.size, 0);
    assert.equal(warnings.length, 1);
  });

  test('bozuk girdi diğerlerini götürmüyor', () => {
    const { tokens, warnings } = parseMcpTokens(
      `bozuk-satir,eray:${GECERLI},:${GECERLI2},ahmet:${GECERLI2}`,
    );
    assert.equal(lookupSlug(tokens, GECERLI), 'eray');
    assert.equal(lookupSlug(tokens, GECERLI2), 'ahmet');
    assert.equal(warnings.length, 2);
  });

  test('satır sonu da ayraç — çok satırlı ortam değişkeni çalışıyor', () => {
    const { tokens } = parseMcpTokens(`eray:${GECERLI}\nahmet:${GECERLI2}`);
    assert.equal(lookupSlug(tokens, GECERLI), 'eray');
    assert.equal(lookupSlug(tokens, GECERLI2), 'ahmet');
  });

  test('slug küçük harfe indiriliyor — kullanıcı slug\'ları küçük harf', () => {
    const { tokens } = parseMcpTokens(`ERAY:${GECERLI}`);
    assert.equal(lookupSlug(tokens, GECERLI), 'eray');
  });
});

// ─── Açılışta yüklenen anahtarların izi ────────────────────────────────────
//
// Korunan kusur (11 Eylül 2026): canlıya karşı tarama 401 aldı, sebep bir saat
// dağıtımda arandı — tarama eski anahtarı gönderiyordu ve ne betik ne sunucu
// hangi anahtarın elde olduğunu söylüyordu. Açılış satırı artık slug ve özet
// öneki basıyor. İki şart kilitli: anahtarın kendisi satıra ASLA düşmez, ve
// anahtar yokken satır "yok" der (null) — sessiz kalmaz.

describe('anahtarOzetSatiri — açılış izi, anahtarı sızdırmadan', () => {
  const HAM = 'k'.repeat(MIN_TOKEN_LENGTH) + 'gizli-kuyruk';

  test('slug ve özetin ilk 8 hanesi basılıyor', () => {
    const { tokens } = parseMcpTokens(`eray-atalay:${HAM}`);
    assert.equal(anahtarOzetSatiri(tokens), `1 anahtar: eray-atalay (${hashToken(HAM).slice(0, 8)})`);
  });

  test('ham anahtarın hiçbir parçası satırda yok', () => {
    const { tokens } = parseMcpTokens(`eray:${HAM},ahmet:${'z'.repeat(40)}`);
    const satir = anahtarOzetSatiri(tokens);
    assert.ok(!satir.includes(HAM) && !satir.includes('gizli') && !satir.includes('kkkk'),
      `satır anahtar sızdırıyor: ${satir}`);
    assert.ok(!satir.includes('zzzz'));
    assert.match(satir, /^2 anahtar: /);
  });

  test('anahtar yoksa null — çağıran uyarıya çevirmek zorunda', () => {
    assert.equal(anahtarOzetSatiri(parseMcpTokens('').tokens), null);
    assert.equal(anahtarOzetSatiri(null), null);
  });

  test('config açılışta satırı basıyor, yokluğu da uyarıyla söylüyor', () => {
    // Çağıran tarafın sözleşmesi: satır varsa basılır, null ise uyarı. Uyarı
    // kalkarsa değişken tanımsızken uç yine hiçbir şey demeden 401 döner.
    const kaynak = yorumsuzDosya(path.join(__dirname, '..', 'src', 'config.js'));
    const i = kaynak.indexOf('anahtarOzetSatiri(mcpTokens.tokens)');
    assert.ok(i > 0, 'config.js yüklenen anahtarları basmıyor');
    const blok = kaynak.slice(i, i + 400);
    assert.match(blok, /if\s*\(\s*satir\s*\)\s*console\.log\(/, 'yüklenen anahtar satırı basılmıyor');
    assert.match(blok, /else\s+console\.warn\(/, 'anahtar yokken uyarı yok — kapalı başarısızlık sessiz kalır');
  });
});

// ─── Sessiz yutulan hata — statik kilit ────────────────────────────────────
//
// Korunan kusur (9 Eylül 2026): sunucudaki on iki soket yayını
// `try { ... } catch {}` içindeydi. Ödünleşme doğruydu — gerçek zamanlı bir
// olayın gönderilememesi kullanıcının işlemini başarısız kılmamalı — ama
// uygulanışı yanlıştı: hata hiçbir yere yazılmıyordu. Yayın tamamen çalışmaz
// hâle gelse (io kurulmamış, payload serileştirilemiyor, oda adı bozuk)
// kayıtlarda tek satır iz kalmazdı. Belirti "gerçek zamanlı bazen çalışmıyor"
// olurdu; bu depoda bir toplantıyı yakan sınıf tam olarak bu.
//
// Kural CLAUDE.md'de zaten yazılıydı: koşulun yokluk hâli ya reddetmeli ya
// gürültü çıkarmalı. Yazılı olması yetmedi — dil kuralında olduğu gibi.
// O yüzden kural belgeden teste taşındı (merdivende bir basamak yukarı).
//
// Sınır bilinçli: yorumsuz `catch {}` yasak, açıklamalı olan serbest. Yorum
// yazmak kararı görünür kılıyor ve gözden geçirmede tartışılabilir hâle
// getiriyor; asıl tehlikeli olan hiç düşünülmeden bırakılmış boş bloktur.

describe('sessiz yutulan hata — sunucuda çıplak boş catch yok', () => {
  const SRC = path.resolve(__dirname, '..', 'src');

  function jsDosyalari(dizin) {
    const out = [];
    for (const ad of fs.readdirSync(dizin)) {
      const tam = path.join(dizin, ad);
      if (fs.statSync(tam).isDirectory()) out.push(...jsDosyalari(tam));
      else if (ad.endsWith('.js')) out.push(tam);
    }
    return out;
  }

  test('hiçbir sunucu dosyasında yorumsuz catch {} yok', () => {
    const bulgular = [];
    for (const tam of jsDosyalari(SRC)) {
      const ham = fs.readFileSync(tam, 'utf8').replace(/\r\n/g, '\n');
      const temizSatirlar = yorumsuzKaynak(ham).split('\n');
      ham.split('\n').forEach((satir, i) => {
        const kirpik = satir.trim();
        // İki kaynağa birden bakılıyor, çünkü yorumun burada İKİ ayrı rolü var:
        //   - Yorumun İÇİNDEKİ `catch {}` bulgu değildir (emit.js kusuru
        //     anlatırken kalıbı yazıyor). Boşaltılmış satırda `catch` kalmaz.
        //   - Bloğun İÇİNDEKİ yorum ise ihlali aklar: açıklamalı boş catch
        //     bilerek serbest. Bu ayrım yalnızca HAM satırda görülebilir;
        //     boşaltılmış satırda `catch { /* sebep */ }` gerçek bir boş
        //     catch'e dönüşür ve meşru kod bulgu sayılırdı.
        if (!temizSatirlar[i].includes('catch')) return;
        if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(satir)) {
          bulgular.push(`${path.relative(SRC, tam)}:${i + 1}  ${kirpik}`);
        }
      });
    }
    assert.deepEqual(
      bulgular, [],
      'Boş catch bloğu hatayı sessizce yutuyor. Ya hatayı yükselt, ya '
      + 'console.warn ile gürültü çıkar (soket yayınları için lib/emit.js\'teki '
      + 'emitSafely), ya da blok içine NEDEN yutulduğunu yazan bir yorum koy.',
    );
  });
});

// ─── MCP anahtarının başlıktan çıkarılması ──────────────────────────────────
//
// 10 Eylül 2026'da ikinci bir başlık tanıtıldı. Sebep: Claude'un tarayıcı
// içindeki bağlayıcı ekranı asıl kimliği OAuth ile kuruyor ve ek başlıklar
// için kapalı bir ad listesi sunuyor; `Authorization` o listede yok,
// `x-auth-token` var. StoaBoard'da OAuth sunucusu olmadığı için bağlayıcı
// "couldn't register" ile düşüyordu.
//
// Bir kimlik kapısını genişletmek, gevşetmenin en kolay yoludur. Bu testler
// kapının hangi durumda AÇILMAYACAĞINI kilitliyor: yokluk hâli her dalda
// null dönmeli, "başlık varsa geç" gibi bir kısayol oluşmamalı.
describe('MCP anahtarı — başlık ayrıştırma', () => {
  const istek = (basliklar) => ({
    get: (ad) => basliklar[ad.toLowerCase()] ?? undefined,
  });

  test('Authorization: Bearer <anahtar> okunur', () => {
    assert.equal(_bearerToken(istek({ authorization: 'Bearer abc123' })), 'abc123');
  });

  test('Bearer öneki büyük/küçük harfe duyarsız', () => {
    assert.equal(_bearerToken(istek({ authorization: 'bearer abc123' })), 'abc123');
  });

  test('X-Auth-Token ham değerle okunur', () => {
    assert.equal(_bearerToken(istek({ 'x-auth-token': 'abc123' })), 'abc123');
  });

  test('X-Auth-Token içinde Bearer öneki hoş görülür', () => {
    assert.equal(_bearerToken(istek({ 'x-auth-token': 'Bearer abc123' })), 'abc123');
  });

  test('Authorization varsa X-Auth-Token\'a düşülmez', () => {
    const t = _bearerToken(istek({ authorization: 'Bearer birinci', 'x-auth-token': 'ikinci' }));
    assert.equal(t, 'birinci', 'iki başlık da varsa asıl biçim kazanmalı');
  });

  // Yokluk hâlleri — hepsi null dönmeli. Bir tanesi bile boş dize ya da
  // undefined dönerse lookupSlug'a çöp gider; orada da uzunluk kapısı var ama
  // iki kapının aynı anda doğru olmasına güvenmek yerine burada kesiliyor.
  for (const [ad, basliklar] of [
    ['hiç başlık yok', {}],
    ['Authorization boş', { authorization: '' }],
    ['Authorization yalnızca "Bearer"', { authorization: 'Bearer' }],
    ['Authorization şeması yanlış', { authorization: 'Basic abc123' }],
    ['Authorization anahtarsız boşluk', { authorization: 'Bearer    ' }],
    ['X-Auth-Token boş', { 'x-auth-token': '' }],
    ['X-Auth-Token yalnızca boşluk', { 'x-auth-token': '   ' }],
    ['X-Auth-Token yalnızca "Bearer"', { 'x-auth-token': 'Bearer' }],
  ]) {
    test(`reddedilir: ${ad}`, () => {
      assert.equal(
        _bearerToken(istek(basliklar)), null,
        `"${ad}" durumunda anahtar çıkarılmamalı — yokluk hâli sessizce `
        + 'geçerli sayılmamalı.',
      );
    });
  }

  test('Authorization içindeki fazladan sözcük anahtar sayılmaz', () => {
    // "Bearer abc def" -> tek bir anahtar değil; kabul edilirse hangi parçanın
    // sır olduğu belirsizleşir.
    assert.equal(_bearerToken(istek({ authorization: 'Bearer abc def' })), null);
  });
});

// ─── Görev ataması alan üyeliği ister ──────────────────────────────────────
//
// Kusur (11 Eylül 2026): görev oluşturma ve atama değişikliği atanacak kişiyi
// yalnızca slug'ıyla arıyordu; alan üyeliğine bakılmıyordu. `manage_tasks`
// izni olan bir üye platformdaki herhangi bir kullanıcıyı atayabiliyor ve ona
// görev başlığını taşıyan bildirim gidiyordu — başka bir şirketin kullanıcısına
// bildirim atmak ve başlığı sızdırmak mümkündü. MCP yazma araçları bu kapı
// kapanmadan açılamazdı. Kural ve iki istisnası lib/assignees.js'in başında.

describe('atananlariDenetle — görev ataması alan üyeliği ister', () => {
  const eray = { id: 1, slug: 'eray' };
  const umut = { id: 2, slug: 'umut' };
  const yabanci = { id: 9, slug: 'baska-sirket' };
  const kullanicilar = [eray, umut, yabanci];
  const uyeIdleri = new Set([1, 2]);

  test('alan üyesi yeni atanan geçer', () => {
    const r = atananlariDenetle({ istenen: ['umut'], kullanicilar, uyeIdleri });
    assert.deepEqual(r, { gecerli: [umut], reddedilen: [] });
  });

  test('üye olmayan yeni atanan reddedilir — kusurun kendisi', () => {
    const r = atananlariDenetle({ istenen: ['eray', 'baska-sirket'], kullanicilar, uyeIdleri });
    assert.deepEqual(r.reddedilen, ['baska-sirket']);
    assert.deepEqual(r.gecerli, [eray]);
  });

  test('platformda olmayan slug da aynı dalda reddedilir — var/yok kahini yok', () => {
    const yok = atananlariDenetle({ istenen: ['hayalet'], kullanicilar, uyeIdleri });
    const uyeDegil = atananlariDenetle({ istenen: ['baska-sirket'], kullanicilar, uyeIdleri });
    assert.deepEqual(yok, { gecerli: [], reddedilen: ['hayalet'] });
    assert.deepEqual(uyeDegil, { gecerli: [], reddedilen: ['baska-sirket'] });
  });

  test('kartta zaten atanmış kişi korunur, alandan çıkarılmış olsa bile', () => {
    // f789c37: çıkarılan kişinin adı kartlarda kalır. Arayüz atama listesinin
    // tamamını geri gönderdiği için bu kişi reddedilseydi kart düzenlenemezdi.
    const r = atananlariDenetle({
      istenen: ['eray', 'baska-sirket'], kullanicilar, uyeIdleri, mevcutIdler: new Set([9]),
    });
    assert.deepEqual(r, { gecerli: [eray, yabanci], reddedilen: [] });
  });

  test('aynı slug iki kez gelirse tek atanır', () => {
    const r = atananlariDenetle({ istenen: ['umut', 'umut'], kullanicilar, uyeIdleri });
    assert.deepEqual(r.gecerli, [umut]);
  });

  test('üye kümesi boşsa hiçbir yeni atanan geçmez — kapalı başarısızlık', () => {
    const r = atananlariDenetle({ istenen: ['umut'], kullanicilar, uyeIdleri: new Set() });
    assert.deepEqual(r.reddedilen, ['umut']);
  });
});

describe('atamaSluglari — girdi biçimi', () => {
  test('dizi olmayan girdi atama sayılmaz — metin harf harf dolaşılmaz', () => {
    assert.deepEqual(atamaSluglari('eray'), []);
    assert.deepEqual(atamaSluglari(undefined), []);
    assert.deepEqual(atamaSluglari({ 0: 'eray' }), []);
  });

  test('tekrarlar elenir, değerler metne çevrilir', () => {
    assert.deepEqual(atamaSluglari(['eray', 'eray', 5]), ['eray', '5']);
  });
});

// İki uç da kapıdan geçmeli. Veritabanı olmadan uç kaynağında doğrulanıyor;
// yorumlar önce siliniyor, çünkü kuralı anlatan yorum ihlali örtebiliyor
// (CLAUDE.md, 11 Eylül). Bu testler mutasyonla sınandı.

describe('görev atama uçları — üyelik kapısından geçiyor', () => {
  const src = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'tasks.js'));

  function isleyici(baslangic) {
    const i = src.indexOf(baslangic);
    assert.ok(i !== -1, `işleyici bulunamadı: ${JSON.stringify(baslangic)}`);
    const kalan = src.slice(i + baslangic.length);
    const son = kalan.search(/\n(projectTasksRouter|tasksRouter|subtasksRouter|commentsRouter)\./);
    return son === -1 ? kalan : kalan.slice(0, son);
  }

  for (const [ad, baslangic] of [
    ['POST /projects/:projectId/tasks', "projectTasksRouter.post(\n  '/',"],
    ['PATCH /tasks/:taskId', "tasksRouter.patch(\n  '/:taskId',"],
  ]) {
    test(`${ad}: atananlar işlemden önce denetleniyor, reddedilen erken dönüyor`, () => {
      const h = isleyici(baslangic);
      const coz = h.indexOf('atamalariCoz(');
      const red = h.search(/if\s*\(\s*atama\.reddedilen\.length\s*\)\s*return\s+atamaReddi\(/);
      const islem = h.indexOf('$transaction');
      assert.ok(coz !== -1, 'uç atananları denetlemeden yazıyor — regresyon');
      assert.ok(red !== -1, 'reddedilen atanan için erken dönüş yok — sessiz geçiş');
      assert.ok(islem !== -1 && coz < islem && red < islem,
        'denetim işlemden sonra geliyor — kart yarım yazılabilir');
    });
  }

  test('tasks.js slug ile kullanıcı çözmüyor — kapıyı atlayan ikinci yol yok', () => {
    assert.ok(
      !/user\.findUnique\(\s*\{\s*where:\s*\{\s*slug/.test(src),
      'slug → kullanıcı çözümü kapının dışında; atama bu yoldan üyelik denetimsiz yazılabilir',
    );
  });
});

// ─── OAuth keşif uçları — yokluk 404 ile söyleniyor ────────────────────────
//
// Kusur (12 Eylül 2026): `/.well-known/oauth-authorization-server` ve
// kardeşleri SPA yedeğine düşüp 200 + HTML döndürüyordu. Claude'un bağlayıcı
// ekranı bunu "OAuth var" diye okudu (ekranda "Detected"), "Sign in now"u
// seçti ve kayıt "couldn't register" ile düştü — bağlayıcı kurulamaz hâle
// geldi. StoaBoard'da OAuth sunucusu yok; kimlik x-auth-token başlığıyla
// kuruluyor. Yokluk sessiz kalmamalı.
//
// Veritabanı gerektirmeden kaynakta doğrulanıyor; yorumlar önce siliniyor.

describe('OAuth keşif uçları — SPA yedeğine düşmüyor', () => {
  const src = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'app.js'));

  const KESIF = "app.use('/.well-known'";
  const YEDEK = 'app.use((req, res) => {';

  test('/.well-known SPA yedeğinden ÖNCE ele alınıyor', () => {
    const kesif = src.indexOf(KESIF);
    const yedek = src.indexOf(YEDEK);
    assert.ok(kesif !== -1, '/.well-known ele alınmıyor — SPA yedeği 200 + HTML döndürür');
    assert.ok(yedek !== -1, 'SPA yedeği bulunamadı — tarama deseni bozulmuş olabilir');
    assert.ok(kesif < yedek, '/.well-known SPA yedeğinden sonra geliyor, yani hiç çalışmıyor');
  });

  test('404 dönüyor', () => {
    const blok = src.slice(src.indexOf(KESIF), src.indexOf(YEDEK));
    assert.ok(/status\(404\)/.test(blok), '/.well-known 404 dışında bir şey dönüyor');
  });
});

// ─── Kart yorumundaki @bahsetme yalnızca alan üyelerine gider ──────────────
//
// Kusur (12 Eylül 2026): `POST /tasks/:id/comments` bahsedilen kişiyi
// `user.findFirst({ name: { startsWith, insensitive } })` ile BÜTÜN platformda
// arıyordu ve ilk eşleşene bildirim gönderiyordu. "@Ali" yazan bir üye, başka
// bir şirketteki adı Ali ile başlayan birine yorumun ilk 80 karakterini
// sızdırabiliyordu. Sohbetteki bahsetme 2 Eylül'de `mentionAllowed` ile
// kapatılmıştı; kart yorumu o turun dışında kalmıştı.

describe('bahsedilenleriCoz — bahsetme alan üyeleriyle sınırlı', () => {
  const efe = { id: 1, name: 'Efe Kapan' };
  const eray = { id: 2, name: 'Eray Atalay' };
  const ilker = { id: 3, name: 'İlker Demir' };
  const uyeler = [efe, eray, ilker];

  test('alan üyesi tek eşleşmede bildirim alıyor', () => {
    const r = bahsedilenleriCoz(['Eray'], uyeler);
    assert.deepEqual(r.eslesen, [eray]);
    assert.deepEqual(r.belirsiz, []);
    assert.deepEqual(r.bulunamayan, []);
  });

  test('üye olmayan hiçbir koşulda eşleşmiyor — kusurun kendisi', () => {
    // Platformda "Ali Veli" olsa bile bu alanın üyesi değilse havuza girmiyor.
    const r = bahsedilenleriCoz(['Ali'], uyeler);
    assert.deepEqual(r.eslesen, []);
    assert.deepEqual(r.bulunamayan, ['Ali']);
  });

  test('boş üye listesi: kimseye bildirim yok — kapalı başarısızlık', () => {
    const r = bahsedilenleriCoz(['Eray'], []);
    assert.deepEqual(r.eslesen, []);
    assert.deepEqual(r.bulunamayan, ['Eray']);
  });

  test('belirsiz önek kimseye gitmiyor, adaylar bildiriliyor', () => {
    const ikinciEfe = { id: 4, name: 'Efe Yıldız' };
    const r = bahsedilenleriCoz(['Efe'], [...uyeler, ikinciEfe]);
    assert.deepEqual(r.eslesen, []);
    assert.equal(r.belirsiz.length, 1);
    assert.deepEqual(r.belirsiz[0].adaylar.sort(), ['Efe Kapan', 'Efe Yıldız']);
  });

  test('belirsizlikte tam ad yazılmışsa o kişi seçiliyor', () => {
    const efeY = { id: 4, name: 'Efe' };
    const r = bahsedilenleriCoz(['Efe'], [efe, efeY]);
    assert.deepEqual(r.eslesen, [efeY]);
    assert.deepEqual(r.belirsiz, []);
  });

  test('Türkçe harf katlaması: @ilker İlker ile eşleşiyor', () => {
    assert.deepEqual(bahsedilenleriCoz(['ilker'], uyeler).eslesen, [ilker]);
    assert.deepEqual(bahsedilenleriCoz(['İLKER'], uyeler).eslesen, [ilker]);
  });

  test('aynı kişi iki kez bahsedilse bir kez bildirim alıyor', () => {
    const r = bahsedilenleriCoz(['Eray', 'eray'], uyeler);
    assert.deepEqual(r.eslesen, [eray]);
  });

  test('farklı önekler aynı kişiye çıkıyorsa yine tek bildirim', () => {
    // Ad tekrarı elemesi bunu göremiyor: "Eray" ile "Era" iki ayrı anahtar
    // ama aynı kişiye çıkıyor. Kimlik elemesini koruyan tek test bu; ilk
    // hâlinde yoktu ve mutasyon (kimlik elemesini sil) KAÇMIŞTI.
    const r = bahsedilenleriCoz(['Eray', 'Era'], uyeler);
    assert.deepEqual(r.eslesen, [eray]);
  });

  // ── SLUG (kart #235) ────────────────────────────────────────────────────
  //
  // KUSUR: "bahsetme"nin DÖRT okuyucusu vardı ve dördü farklı şey anlıyordu.
  // Sohbet slug'a bakıyor, kart yorumu ad önekine; yorumdaki seçici de
  // yalnızca İLK ADI yazıyordu. Kullanıcının alanında iki "Eray Atalay - N"
  // hesabı var, yani `@Eray` ikisine birden uyuyor, belirsiz sayılıyor ve
  // KİMSEYE bildirim gitmiyordu. Sohbetten @ çalışıp yorumdan @ çalışmaması
  // bundandı.

  const erayBir = { id: 5, name: 'Eray Atalay - 1', slug: 'eray-atalay' };
  const erayIki = { id: 6, name: 'Eray Atalay - 2', slug: 'eray-atalay-3' };

  test('slug birebir eşleşiyor — ad öneki belirsizken bile', () => {
    // Kullanıcının GERÇEK durumu. Ad öneki iki kişiye uyuyor; slug tek kişiye.
    const ikili = [erayBir, erayIki];
    assert.deepEqual(bahsedilenleriCoz(['eray-atalay'], ikili).eslesen, [erayBir]);
    assert.deepEqual(bahsedilenleriCoz(['eray-atalay-3'], ikili).eslesen, [erayIki]);
  });

  test('slug varken ad önekinin belirsizliği DEVREYE GİRMİYOR', () => {
    // Slug benzersiz olduğu için belirsizlik doğuramaz; bu, slug dalının ad
    // dalından ÖNCE çalıştığını kilitliyor. Sıra ters çevrilirse bu test kırılır.
    const r = bahsedilenleriCoz(['eray-atalay'], [erayBir, erayIki]);
    assert.deepEqual(r.belirsiz, []);
    assert.deepEqual(r.bulunamayan, []);
  });

  test('ad öneki KALDIRILMADI — eski yorumlar çalışmaya devam ediyor', () => {
    // Depoda bugüne kadar yazılmış yorumlarda `@Eray` var. Değişiklik yalnızca
    // genişletiyor; daralttığı an eski yorumların bahsetmeleri ölürdü.
    assert.deepEqual(bahsedilenleriCoz(['Eray'], uyeler).eslesen, [eray]);
  });

  test('slug ile ad aynı kişiye çıkarsa tek bildirim', () => {
    const r = bahsedilenleriCoz(['eray-atalay', 'Eray'], [erayBir]);
    assert.deepEqual(r.eslesen, [erayBir]);
  });

  test('slug taşımayan üye listesi eski davranışta kalıyor', () => {
    // `slug` alanı seçilmemiş bir çağrı (başka bir yüzey) patlamamalı.
    const r = bahsedilenleriCoz(['Eray'], [{ id: 9, name: 'Eray Atalay' }]);
    assert.equal(r.eslesen.length, 1);
  });
});

// Kaynak kilidi: çözücü doğru olsa da çağıran taraf slug'ı OKUMUYORSA kusur
// aynen durur. Üç okuyucunun üçü de ayrı ayrı kilitleniyor — ölçüt dosya
// genelinde değil, koruduğu bloğa bağlı (CLAUDE.md).
describe('bahsetme — slug zinciri uçtan uca bağlı (#235)', () => {
  const tasksSrc = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'tasks.js'));
  const drawerSrc = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'client', 'src', 'drawer.jsx'), 'utf8',
  ).replace(/\r\n/g, '\n');

  test('sunucu deseni tireyi kabul ediyor — yoksa slug "eray"da kesilir', () => {
    const m = tasksSrc.match(/const MENTION_RE = ([^;]+);/);
    assert.ok(m, 'tasks.js içinde MENTION_RE bulunamadı');
    assert.ok(/-\]/.test(m[1]) || /\\-/.test(m[1]),
      `desen tire taşımıyor (${m[1].trim()}) — "@eray-atalay" "eray" diye kesilir ve `
      + 'yine belirsiz ad önekine düşer');
  });

  test('üye sorgusu slug alanını okuyor', () => {
    // Çözücüye slug'sız satır giderse slug dalı hiç çalışmaz ve kusur sessizce
    // geri gelir: hiçbir şey hata vermez, yalnızca bildirim gitmez.
    const bas = tasksSrc.indexOf('const mentions = ');
    assert.notEqual(bas, -1, 'yorum ucundaki bahsetme bloğu bulunamadı');
    const blok = tasksSrc.slice(bas, tasksSrc.indexOf('const comment = ', bas));
    assert.ok(/slug:\s*true/.test(blok),
      'bahsetme bloğundaki üye sorgusu slug seçmiyor — çözücü slug dalını kullanamaz');
  });

  test('seçici ilk adı değil benzersiz kimliği yazıyor', () => {
    const bas = drawerSrc.indexOf('const insertMention');
    assert.notEqual(bas, -1, 'insertMention bulunamadı');
    const blok = drawerSrc.slice(bas, drawerSrc.indexOf('};', bas));
    assert.ok(/'@' \+ member\.id/.test(blok),
      'seçici hâlâ ad yazıyor — aynı ilk ada sahip iki üye varken bildirim kimseye gitmez');
    assert.ok(!/member\.name\.split\(' '\)\[0\]/.test(blok),
      'ilk ad hesabı hâlâ duruyor; seçici onu yazıyor olabilir');
  });
});

describe('adKatla — I/ı/İ/i aynı yere düşüyor', () => {
  test('dört i harfi de aynı', () => {
    const hedef = adKatla('ilker');
    for (const v of ['İlker', 'ILKER', 'ılker']) assert.equal(adKatla(v), hedef);
  });

  test('boş girdi patlamıyor', () => {
    assert.equal(adKatla(null), '');
    assert.equal(adKatla(undefined), '');
  });
});

// Uç gerçekten bu kapıdan geçiyor mu — kaynakta doğrulanıyor, yorumlar
// silinerek (CLAUDE.md: kuralı anlatan yorum ihlali örtebiliyor).

describe('yorum ucu — bahsetme kapısından geçiyor', () => {
  const src = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'tasks.js'));

  function yorumIsleyicisi() {
    const bas = "tasksRouter.post(\n  '/:taskId/comments',";
    const i = src.indexOf(bas);
    assert.ok(i !== -1, 'yorum ucu bulunamadı — tarama deseni bozulmuş olabilir');
    const kalan = src.slice(i + bas.length);
    const son = kalan.search(/\n(tasksRouter|commentsRouter|subtasksRouter|projectTasksRouter)\./);
    return son === -1 ? kalan : kalan.slice(0, son);
  }

  test('bahsedilenler alan üyeleriyle çözülüyor', () => {
    const h = yorumIsleyicisi();
    assert.ok(h.includes('bahsedilenleriCoz('), 'bahsetme kapısı yok — regresyon');
    assert.ok(/workspaceMember\.findMany/.test(h), 'üye havuzu alandan çekilmiyor');
  });

  test('platform geneli ad araması geri gelmedi', () => {
    const h = yorumIsleyicisi();
    assert.ok(
      !/user\.findFirst/.test(h),
      'yorum ucu yine bütün platformda kullanıcı arıyor — bahsetme sızıntısı geri geldi',
    );
  });
});

// ─── Bildirim metni — saklı XSS ─────────────────────────────────────────────
//
// KUSUR (12 Eylül 2026): bildirim ve etkinlik metinleri istemcide
// `dangerouslySetInnerHTML` ile basılıyor (`notifications.jsx:270`,
// `views/dashboard.jsx:340`) ve şablon değerleri KAÇIŞSIZ yerleştiriliyordu:
//
//     tpl.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '')
//
// Değerlerin hepsi kullanıcı girdisi. `preview` doğrudan sohbet mesajından
// geliyor, `title` kart başlığından. Yani bir DM'e ya da kart başlığına
// yazılan `<img src=x onerror=…>` alıcının tarayıcısında çalışıyordu.
// `POST /api/notifications` ucu serbest metin kabul ettiği ve çevrilemeyen
// gövde HAM basıldığı için saldırgan hedefi de seçebiliyordu.
//
// Kaçış istemciye, HTML'in üretildiği yere konuldu (`client/src/bildirimMetni.js`).
// Sunucuda temizlemek yanlış olurdu: metin depoda duruyor ve başka tüketicileri
// var — e-posta kendi düz-metin temizliğini zaten yapıyor.
//
// GUVENLIK.md §4/10: kapatılan her kusur için buraya bir regresyon testi.

describe('bildirim metni — değerler kaçışlanıyor (saklı XSS)', () => {
  const ZARARLI = '<img src=x onerror=alert(1)>';

  test('şablon değeri kaçışlanıyor, şablonun kendi etiketi korunuyor', () => {
    const cikti = sablonDoldur('<strong>{who}</strong>: {preview}', {
      who: 'Eray', preview: ZARARLI,
    });
    assert.ok(!cikti.includes('<img'), `ham etiket geçti: ${cikti}`);
    assert.ok(cikti.includes('&lt;img'), 'değer kaçışlanmamış');
    assert.ok(cikti.includes('<strong>Eray</strong>'), 'şablonun kendi etiketi bozulmuş');
  });

  test('DM önizlemesi: sohbet mesajı betik taşıyamaz', () => {
    // Gerçek akış: chat.js `preview: text.slice(0, 80)` yazıyor.
    const ceviri = (k) => (k === 'notif_dm_received'
      ? '<strong>{who}</strong> sana mesaj gönderdi: {preview}' : null);
    const cikti = bildirimMetni(
      JSON.stringify({ type: 'dm_received', who: 'Eray', preview: ZARARLI }), ceviri,
    );
    // Ölçüt `onerror=` dizgisinin yokluğu DEĞİL: o dizgi kaçışlanmış metinde
    // de düz metin olarak duruyor ve zararsızdır — `<` etkisizleştikten sonra
    // etiket hiç oluşamaz. Doğru ölçüt açılı parantezin kaçışlanmış olması.
    assert.ok(!/<img/i.test(cikti), `ham etiket geçti: ${cikti}`);
    assert.ok(cikti.includes('&lt;img'), `değer kaçışlanmamış: ${cikti}`);
  });

  test('etkinlik akışı: kart başlığı betik taşıyamaz', () => {
    // Gerçek akış: tasks.js `buildNotificationText('task_created', { title })`.
    const ceviri = (k) => (k === 'activity_task_created' ? 'yeni kart: <em>{title}</em>' : null);
    const cikti = etkinlikMetni(
      JSON.stringify({ type: 'task_created', title: ZARARLI }), ceviri,
    );
    // Ölçüt `onerror=` dizgisinin yokluğu DEĞİL: o dizgi kaçışlanmış metinde
    // de düz metin olarak duruyor ve zararsızdır — `<` etkisizleştikten sonra
    // etiket hiç oluşamaz. Doğru ölçüt açılı parantezin kaçışlanmış olması.
    assert.ok(!/<img/i.test(cikti), `ham etiket geçti: ${cikti}`);
    assert.ok(cikti.includes('&lt;img'), `değer kaçışlanmamış: ${cikti}`);
  });

  test('çevrilemeyen gövde de kaçışlanıyor — serbest metin ucunun düştüğü dal', () => {
    const cikti = bildirimMetni('<script>alert(1)</script>', () => null);
    assert.ok(!/<script/.test(cikti), `ham HTML geçti: ${cikti}`);
    assert.ok(cikti.includes('&lt;script&gt;'), 'kaçış uygulanmamış');
  });

  test('sözlükte karşılığı olmayan tür de ham basılmıyor', () => {
    const cikti = bildirimMetni(JSON.stringify({ type: 'bilinmeyen', x: ZARARLI }), () => null);
    assert.ok(!/<img/.test(cikti), `ham HTML geçti: ${cikti}`);
  });

  test('tırnak ve & karakterleri de kaçışlanıyor — öznitelik bağlamı', () => {
    assert.equal(htmlKacir('"&\''), '&quot;&amp;&#39;');
  });

  test('htmlCoz düz metne geri çeviriyor — toast varlık kodu göstermez', () => {
    assert.equal(htmlCoz(htmlKacir('a<b>&c')), 'a<b>&c');
  });

  test('boş ve tanımsız girdi çökmüyor', () => {
    assert.doesNotThrow(() => bildirimMetni(null, () => null));
    assert.doesNotThrow(() => etkinlikMetni(undefined, () => null));
    assert.equal(htmlKacir(null), '');
  });
});

// Kaçış tek yerde yapılıyor; bu tarama onu KALICI kılıyor. Yeni bir
// `dangerouslySetInnerHTML` eklenirse ya kaçışlı bir üreticiden beslenmeli ya
// da buraya gerekçesiyle yazılmalı. Aksi hâlde aynı kusur başka bir ekranda
// sessizce geri döner.
describe('dangerouslySetInnerHTML — her sink kaçıştan geçiyor', () => {
  const ISTISNA = new Map([
    ['views/legal.jsx', 'sabit <style> blokları — kullanıcı girdisi taşımıyor'],
  ]);
  const GUVENLI = /__html:\s*(renderNotifText|renderActivityText)\(/;

  test('kullanıcı girdisi basan her sink kaçışlı üreticiden besleniyor', () => {
    const kok = path.resolve(__dirname, '..', '..', 'client', 'src');
    const bulgular = [];
    for (const tam of kaynakDosyalari(kok, /\.jsx?$/)) {
      const goreli = path.relative(kok, tam).split(path.sep).join('/');
      const src = yorumsuzDosya(tam);
      src.split('\n').forEach((satir, i) => {
        if (!satir.includes('dangerouslySetInnerHTML')) return;
        if (ISTISNA.has(goreli)) return;
        if (GUVENLI.test(satir)) return;
        bulgular.push(`${goreli}:${i + 1}  ${satir.trim().slice(0, 70)}`);
      });
    }
    assert.deepEqual(
      bulgular, [],
      'Bu satır HTML enjeksiyonu açıyor. Değeri kaçışlayan bir üreticiden '
      + 'besle (bildirimMetni.js) ya da gerçekten sabit içerikse bu testteki '
      + 'ISTISNA listesine gerekçesiyle yaz.',
    );
  });

  test('tarama gerçekten sink buluyor', () => {
    // Desen bozulursa üstteki test boş kümeyle sessizce geçerdi.
    const kok = path.resolve(__dirname, '..', '..', 'client', 'src');
    let sayi = 0;
    for (const tam of kaynakDosyalari(kok, /\.jsx?$/)) {
      sayi += (yorumsuzDosya(tam).match(/dangerouslySetInnerHTML/g) || []).length;
    }
    assert.ok(sayi >= 3, `beklenenden az sink bulundu: ${sayi}`);
  });
});

// ─── Bildirim ucu — başkasına yazmak üyelik ister ───────────────────────────
//
// KUSUR (12 Eylül 2026): `POST /api/notifications` hedef kullanıcı için
// yalnızca "böyle biri var mı" diye bakıyordu. Kimliği doğrulanmış herhangi
// biri, hiç tanımadığı birine serbest metinle bildirim gönderebiliyordu —
// kimlik avı ve taciz yüzeyi. Metnin HTML olarak basılması ayrı bir kusurdu
// ve 0-P'de kapandı; bu madde "kime yazabilirim" sorusuydu.
//
// İkinci kusur aynı yerdeydi: olmayan kullanıcı 404, var olan kullanıcı 201
// alıyordu. Yani uç bir **kullanıcı-var-mı kahini**ydi (GUVENLIK.md §4, 8.
// soru). Artık ikisi de aynı 403'ü alıyor.
//
// Veritabanı gerektirmeden uç kaynağında doğrulanıyor; yorumlar boşaltılarak
// okunuyor, çünkü kuralı anlatan yorum ihlali örtebiliyor.

describe('bildirim ucu — başkasına yazmak üyelik kapısından geçiyor', () => {
  const src = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'notifications.js'));

  function postIsleyicisi() {
    const bas = "notificationsRouter.post(\n  '/',";
    const i = src.indexOf(bas);
    assert.ok(i !== -1, 'POST /api/notifications bulunamadı — tarama deseni bozulmuş olabilir');
    const kalan = src.slice(i + bas.length);
    const son = kalan.search(/\nnotificationsRouter\./);
    return son === -1 ? kalan : kalan.slice(0, son);
  }

  test('üyelik kapısı var ve yazmadan ÖNCE geliyor', () => {
    const h = postIsleyicisi();
    const kapi = h.indexOf('usersShareWorkspace(');
    const yazma = h.indexOf('createAndPush(');
    assert.ok(kapi !== -1,
      'üyelik kapısı yok — kimliği doğrulanmış herkes herkese bildirim yazabilir');
    assert.ok(yazma !== -1, 'yazma çağrısı bulunamadı — tarama deseni bozulmuş olabilir');
    assert.ok(kapi < yazma,
      'kapı yazma çağrısından sonra geliyor — bildirim yine de yazılır (kapalı başarısızlık ihlali)');
  });

  test('kullanıcı var/yok kahini geri gelmedi', () => {
    const h = postIsleyicisi();
    assert.ok(
      !/err_user_not_found/.test(h),
      'uç yine "kullanıcı bulunamadı" diyor: üye olmayanla olmayan kullanıcı '
      + 'ayırt edilebilir hâle geldi, yani uç bir kullanıcı-var-mı kahni.',
    );
    assert.ok(
      !/prisma\.user\.findUnique/.test(h),
      'uç hedef kullanıcıyı doğrudan arıyor — kapı yerine varlık kontrolü geri gelmiş olabilir',
    );
  });

  test('reddetme kapalı başarısızlık — geçersiz kimlik de reddediliyor', () => {
    const h = postIsleyicisi();
    // `Number.isInteger` olmadan metin bir kimlik Prisma'ya düşer ve 500
    // üretirdi; kapı önce tipi süzüyor.
    assert.ok(/Number\.isInteger\(/.test(h), 'hedef kimliğin tipi doğrulanmıyor');
    assert.ok(/403/.test(h), 'reddetme 403 ile yapılmıyor');
  });
});

// ─── Sohbete dosya yükleme: kapı, tür ve hız sınırı ──────────────────────────
//
// KUSUR (16 Eylül 2026 bulundu, 17 Eylül kapandı): `POST /api/chat/upload`
// yalnızca `requireAuth` taşıyordu. Yüklenen dosya hiçbir kanala, DM'e ya da
// çalışma alanına bağlı değildi; tür sorulmuyordu ve tekrar sınırı yoktu.
// Dosya `uploaded_files` tablosuna bytes olarak yazıldığı için tek bir hesap
// depoyu doldurabiliyordu. Kart eki ucu aynı depoya yazıyor ve tür soruyordu:
// aynı kaynağa açılan iki kapıdan yalnızca biri denetliyordu.
//
// Kapı KOPYALANMADI, ortak bir yardımcıya (`resolveChatTarget`) çıkarıldı ve
// mesaj gönderme ucu da oradan geçiyor. Gerekçe CLAUDE.md'nin merdiveni:
// iki kopya ayrışabilir, tek kaynak ayrışamaz. Aşağıdaki son test tam da bu
// ayrışmayı imkânsız kılıyor.

import multer from 'multer';
import { uploadErrorHandler, UPLOAD_MAX_BYTES } from '../src/lib/uploads.js';

describe('sohbete dosya yükleme — kapı, tür, sınır', () => {
  const EKLER = path.resolve(__dirname, '..', 'src', 'routes', 'attachments.js');
  const SOHBET = path.resolve(__dirname, '..', 'src', 'routes', 'chat.js');

  /** `chatUploadRouter.post(` kaydının gövdesi — komşu kayda taşmadan. */
  function yuklemeIsleyicisi() {
    const src = yorumsuzDosya(EKLER);
    const bas = src.indexOf('chatUploadRouter.post(');
    assert.ok(bas !== -1, 'sohbet yükleme kaydı bulunamadı');
    // Kendi kaydını 'sonraki' sanmamak için aramaya kayıt adından SONRA başla:
    // `\w*[Rr]outer` deseni `chatUploadRouter`'ın kendisini de eşliyor.
    const ofset = bas + 'chatUploadRouter.post('.length;
    const sonraki = src.slice(ofset).search(/\w*[Rr]outer\.(get|post|patch|put|delete)\(/);
    return sonraki === -1 ? src.slice(bas) : src.slice(bas, ofset + sonraki);
  }

  test('yükleme bir kanala ya da DM\'e bağlı — kapı var', () => {
    const h = yuklemeIsleyicisi();
    assert.ok(
      /resolveChatTarget\(/.test(h),
      'sohbet yüklemesi hedef kapısından geçmiyor: dosya yine hiçbir kanala '
      + 'bağlı değil ve alanı olmayan biri de yükleyebilir.',
    );
    assert.ok(
      /hedef\.ok/.test(h) && /hedef\.status/.test(h),
      'kapının sonucu reddetmeye çevrilmiyor — kapı çağrılıp yok sayılmış olabilir',
    );
  });

  test('dosya türü denetleniyor (kart ekiyle aynı elek)', () => {
    const h = yuklemeIsleyicisi();
    assert.ok(
      /ALLOWED_MIME_PREFIXES/.test(h),
      'sohbet yüklemesi tür sormuyor; kart eki soruyor. Aynı depoya yazan iki '
      + 'kapıdan biri eleksiz kalmış olur.',
    );
  });

  test('hız sınırı var ve anahtarı kullanıcı (IP değil)', () => {
    const h = yuklemeIsleyicisi();
    assert.ok(/rateLimited\(/.test(h), 'sohbet yüklemesinde tekrar sınırı yok');
    assert.ok(
      /chat-upload:\$\{user\.id\}/.test(h),
      'hız sınırı kullanıcıya bağlı değil. IP anahtarı yanlış olurdu: aynı '
      + 'ofisten çalışan ekip tek IP\'den gelir ve birbirini sınırlar.',
    );
    assert.ok(/429/.test(h), 'sınır aşımı 429 ile bildirilmiyor');
  });

  test('erişilemez boyut kontrolü geri gelmedi', () => {
    const h = yuklemeIsleyicisi();
    // Gerçek sınır multer'da (UPLOAD_MAX_BYTES). Route gövdesindeki
    // `size > 50 MB` kontrolü ölü koddu ve kullanıcıya YANLIŞ sınır söylüyordu:
    // multer isteği zaten 10 MB'da kesiyordu.
    assert.ok(
      !/50 \* 1024 \* 1024/.test(h),
      'route gövdesinde erişilemez bir boyut kontrolü var — multer sınırı daha '
      + 'küçük olduğu için bu dal hiç çalışmaz ama kullanıcıya sınır diye söylenir',
    );
    assert.ok(
      !/err_chat_file_too_large/.test(h),
      'ölü sınır mesajı geri gelmiş; tek gerçek sınır UPLOAD_MAX_BYTES',
    );
  });

  test('multer reddi 413 üretiyor, 500 değil', () => {
    // KUSUR: multer sınırı aşan isteği MulterError ile reddediyor ve bu hata
    // hiçbir yerde yakalanmadığı için genel işleyiciye düşüyordu. Kullanıcı
    // "dosya çok büyük" yerine "Şu an bağlanılamıyor" görüyordu: düzeltilebilir
    // bir kullanıcı hatası, sunucu arızası gibi raporlanıyordu.
    const kayit = {};
    const res = {
      status(k) { kayit.kod = k; return this; },
      json(g) { kayit.govde = g; return this; },
    };
    const hata = new multer.MulterError('LIMIT_FILE_SIZE');
    let sonrakiCagrildi = false;
    uploadErrorHandler(hata, {}, res, () => { sonrakiCagrildi = true; });

    assert.equal(kayit.kod, 413);
    assert.equal(kayit.govde.error, 'err_file_too_large');
    assert.equal(sonrakiCagrildi, false, 'hata yutulmadı, genel işleyiciye düşüyor');

    // Mesajdaki sayı GERÇEK sınırdan türemeli; sabit yazılırsa ikisi ayrışır.
    const mb = Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024));
    assert.ok(
      kayit.govde.message.includes(String(mb)),
      `mesaj gerçek sınırı (${mb} MB) söylemiyor: "${kayit.govde.message}"`,
    );
  });

  test('multer dışı hata yutulmuyor', () => {
    // Kapalı başarısızlık kuralı: bu işleyici yalnızca kendi tanıdığı hatayı
    // çevirmeli, tanımadığını olduğu gibi geçirmeli.
    let gecen = null;
    uploadErrorHandler(new Error('alakasız'), {}, {
      status() { throw new Error('yanıt üretmemeliydi'); },
    }, (e) => { gecen = e; });
    assert.ok(gecen instanceof Error && gecen.message === 'alakasız');
  });

  test('istemci hedef alanlarını dosyadan ÖNCE gönderiyor', () => {
    // İNCE TUZAK: multer `req.body`'yi akışta dosyaya kadar gördüğü metin
    // alanlarından doldurur. `file` önce eklenirse `channel`/`to` sunucuya hiç
    // ulaşmaz ve kapı her isteği 'general'a yazılmış sayar — yani kapı sessizce
    // etkisizleşir. Sıra bir biçim tercihi değil, kapının ön koşulu.
    const src = yorumsuzDosya(
      path.resolve(__dirname, '..', '..', 'client', 'src', 'chat.jsx'),
    );
    const bas = src.indexOf("fetch('/api/chat/upload'");
    assert.ok(bas !== -1, 'istemcideki yükleme çağrısı bulunamadı');
    const pencere = src.slice(Math.max(0, bas - 1200), bas);

    // İLK dosya eklemesi ile SON hedef eklemesi karşılaştırılıyor. lastIndexOf
    // ile bakmak kör nokta üretiyordu: başa fazladan bir `file` eklendiğinde
    // son `file` hâlâ sonda kalıyor ve ihlal görünmüyordu (mutasyon buldu).
    // Doğru değişmez: hiçbir dosya eklemesi hedef alanlarından önce gelmemeli.
    const fileIdx = pencere.indexOf("fd.append('file'");
    const chIdx = pencere.lastIndexOf("fd.append('channel'");
    const toIdx = pencere.lastIndexOf("fd.append('to'");
    assert.ok(fileIdx !== -1, 'dosya alanı eklenmiyor');
    assert.ok(chIdx !== -1 && toIdx !== -1, 'kanal/DM hedefi gönderilmiyor — sunucudaki kapı hedefi göremez');
    assert.ok(
      chIdx < fileIdx && toIdx < fileIdx,
      'hedef alanları dosyadan SONRA ekleniyor; multer bunları okuyamaz ve kapı etkisizleşir',
    );
  });

  test('iki uç aynı kapıdan geçiyor (ayrışma imkânsız)', () => {
    // Kusurun kök sebebi kapının tek bir uçta durmasıydı. Kapı ortak bir
    // yardımcıya çıkarıldı; bu test ikisinin de oradan geçtiğini kilitliyor.
    // Biri kendi kopyasını yazmaya dönerse burada kırılır.
    const ekler = yorumsuzDosya(EKLER);
    const sohbet = yorumsuzDosya(SOHBET);
    assert.ok(/resolveChatTarget/.test(ekler), 'yükleme ucu ortak kapıyı kullanmıyor');
    assert.ok(/resolveChatTarget/.test(sohbet), 'mesaj ucu ortak kapıyı kullanmıyor');
    assert.ok(
      !/prisma\.channel\.findFirst[\s\S]{0,400}?err_channel_send_forbidden/.test(sohbet),
      'mesaj ucu kanal kapısını yeniden kendi içinde kurmuş — kopya ayrışır',
    );
  });
});

// ─── @bahsetme kapsam kapısı: HER İKİ yolda da ───────────────────────────────
//
// KUSUR (17 Eylül 2026): bahsetme bildirimi mesajın 80 karakterlik önizlemesini
// taşıyor, dolayısıyla yalnızca mesajı görme hakkı olan kişiye gitmeli. Bu kapı
// 12 Eylül'de `mentionAllowed` olarak yazıldı ve SOKET yoluna takıldı
// (`sockets/chat.js`) — ama REST yoluna (`routes/chat.js` POST /messages) hiç
// takılmadı. İstemcinin kullandığı yol REST'tir: yani kapısız olan yol, canlıda
// etkin olan yoldu. Özel kanaldaki bir mesaj, @slug yazılarak platformdaki
// herhangi birine sızdırılabiliyordu.
//
// Kök sebep kapının kendisi değil, TEK YOLDA durmasıydı. Bu yüzden test iki
// yolu birlikte kilitliyor: biri kapıyı kaybederse kırılır. Sırayı da ölçüyor —
// kapı yazmadan SONRA gelirse bildirim yine de gider (kapalı başarısızlık).

describe('@bahsetme — kapsam kapısı iki yolda da var', () => {
  const REST = path.resolve(__dirname, '..', 'src', 'routes', 'chat.js');
  const SOKET = path.resolve(__dirname, '..', 'src', 'sockets', 'chat.js');

  /** Bahsetme döngüsünden dosyanın sonuna kadar — kapı ve yazma burada. */
  function bahsetmeBlogu(dosya) {
    const src = yorumsuzDosya(dosya);
    const bas = src.indexOf('matchAll(MENTION_RE)');
    assert.ok(bas !== -1, `bahsetme döngüsü bulunamadı: ${path.basename(dosya)}`);
    return src.slice(bas);
  }

  test('REST yolu (istemcinin kullandığı yol) kapıdan geçiyor', () => {
    const blok = bahsetmeBlogu(REST);
    assert.ok(
      /mentionAllowed\(/.test(blok),
      'routes/chat.js bahsetme döngüsü kapsam sormuyor: bildirim önizlemesi '
      + 'alan dışındaki ya da özel kanala üye olmayan birine gidebilir.',
    );
  });

  test('soket yolu kapıdan geçiyor', () => {
    assert.ok(/mentionAllowed\(/.test(bahsetmeBlogu(SOKET)), 'sockets/chat.js kapıyı kaybetmiş');
  });

  test('kapı yazmadan ÖNCE geliyor — kapalı başarısızlık', () => {
    // Kapı yazma çağrısından sonra gelirse bildirim yine de yazılır; kapının
    // varlığı yetmez, sırası da değişmez olmalı.
    const rest = bahsetmeBlogu(REST);
    const restKapi = rest.indexOf('mentionAllowed(');
    const restYazma = rest.indexOf('createAndPush(');
    assert.ok(restKapi !== -1, 'REST: kapı yok (indexOf -1 sıra testini sessizce geçirirdi)');
    assert.ok(restYazma !== -1, 'REST yolunda bildirim yazma çağrısı bulunamadı');
    assert.ok(restKapi < restYazma, 'REST: kapı bildirim yazıldıktan sonra geliyor');

    const soket = bahsetmeBlogu(SOKET);
    const soketKapi = soket.indexOf('mentionAllowed(');
    // Soket yolu da artık createAndPush'tan yazıyor (kart #200, aşağıda).
    const soketYazma = soket.indexOf('createAndPush(');
    assert.ok(soketKapi !== -1, 'soket: kapı yok');
    assert.ok(soketYazma !== -1, 'soket yolunda bildirim yazma çağrısı bulunamadı');
    assert.ok(soketKapi < soketYazma, 'soket: kapı bildirim yazıldıktan sonra geliyor');
  });

  test('kapıya gerçek kapsam besleniyor, sabit değil', () => {
    // `sharesWorkspace: true` gibi sabit bir değer kapıyı sessizce açar ve
    // yukarıdaki üç test yine yeşil kalırdı.
    const blok = bahsetmeBlogu(REST);
    const cagri = blok.slice(blok.indexOf('mentionAllowed('), blok.indexOf('if (!canSee)'));
    assert.ok(
      /usersShareWorkspace\(/.test(cagri),
      'alan ortaklığı gerçekten sorulmuyor — kapıya sabit değer besleniyor olabilir',
    );
    assert.ok(
      /userChannelRole\(/.test(cagri),
      'özel kanal üyeliği gerçekten sorulmuyor',
    );
    assert.ok(
      !/sharesWorkspace:\s*true/.test(cagri) && !/hasChannelRole:\s*true/.test(cagri),
      'kapıya sabit true besleniyor: kapı var ama hiçbir şeyi reddetmez',
    );
  });
});

// ─── Sohbet taslağı hedefe bağlı ─────────────────────────────────────────────
//
// KUSUR (17 Eylül 2026, kart #221): mesaj kutusundaki metin hedeften BAĞIMSIZ
// tek bir durumdu. Alan değiştirince A alanı için yazılmış taslak B alanının
// kanalında duruyordu; Enter'a basmak içeriği yanlış alana gönderirdi. Kimse
// bir kuralı ihlal etmez — arayüz kullanıcıyı hataya davet ederdi. Alan
// kapsamı üstüne kurulmuş bir üründe kabul edilemez: sunucuda kapı kapı
// üyelik denetlerken (bugün ikisi kapandı) arayüz içeriği alanlar arası
// taşıyordu. Kusur, @bahsetme sızıntı testi sırasında ilk denemede düştü.

describe('sohbet taslağı — hedefe bağlı, alanlar arası taşınmaz', () => {
  const CHAT = path.resolve(__dirname, '..', '..', 'client', 'src', 'chat.jsx');

  /** Taslak etkisinin gövdesi — komşu etkiye taşmadan. */
  function taslakBlogu() {
    const src = yorumsuzDosya(CHAT);
    // Taslak etkisini ADIYLA bul. Once 'const taslaklar'dan sonraki ILK
    // useChatE alınıyordu; kullanıcı-temizleme etkisi eklenince o çapa yanlış
    // bloğu gösterdi ve iki test kırıldı. Ölçüt artık yalnızca taslak
    // etkisinde geçen çağrı.
    const bas = src.indexOf('taslakAnahtari(wsId, dmWith, activeChannel)');
    assert.ok(bas !== -1, 'taslak etkisi bulunamadı');
    // Sınır: bir sonraki etki. Ara bir useChatE aramak gerekmiyor, çünkü
    // çapa zaten etkinin İÇİNDE.
    const sonraki = src.indexOf('useChatE(', bas);
    return sonraki === -1 ? src.slice(bas) : src.slice(bas, sonraki);
  }

  test('anahtar ALAN ve KULLANICI kimliğini taşıyor', () => {
    // İNCE TUZAK: "genel" kanalı HER alanda var. Taslağı yalnızca kanal
    // slug'ına göre saklamak kusuru geri getirir, üstelik daha sinsi biçimde:
    // metin bu kez "aynı adlı kanal" olduğu için taşınır.
    //
    // KULLANICI da anahtarda olmak zorunda: depo modül kapsamında yaşıyor ve
    // çıkış sayfayı YENİLEMİYOR (app.jsx handleLogout yalnızca durumu
    // temizliyor). Kullanıcı taşımayan bir anahtarla, aynı tarayıcıda giriş
    // yapan bir sonraki kişi öncekinin sohbet taslaklarını görürdü.
    //
    // Anahtar ÜRETİCİSİ etkinin dışında tanımlı, o yüzden ayrı okunuyor.
    const src = yorumsuzDosya(CHAT);
    const bas = src.indexOf('const taslakAnahtari');
    assert.ok(bas !== -1, 'anahtar üreticisi bulunamadı');
    const blok = src.slice(bas, src.indexOf('};', bas) + 2);

    // MUTASYON BULDU: `ws${` VARLIĞINI ölçmek yetmiyordu. Alan kimliğini
    // yalnızca DM dalından düşürmek testi kırmıyordu, çünkü kanal dalında
    // hâlâ duruyordu. Bugün bu sınıfa üçüncü kez düştüm; ölçüt "en az bir
    // tane" değil "her dalda" olmalı.
    assert.equal((blok.match(/ws\$\{/g) || []).length, 2,
      'alan kimliği iki daldan birinde yok — o dalda taslak alanlar arası taşınır');
    assert.ok(/u\$\{/.test(blok),
      'anahtarda kullanıcı yok — çıkıştan sonra bir sonraki kişi taslakları görür');
    assert.ok(/CURRENT_USER/.test(blok),
      'kullanıcı kimliği gerçek oturumdan okunmuyor olabilir');
    assert.ok(/:dm:/.test(blok) && /:ch:/.test(blok),
      'DM ve kanal ayrı ad alanında değil — aynı slug ikisinde çakışabilir');
  });

  test('etki alan, DM ve kanal değişiminin üçünü de izliyor', () => {
    const blok = taslakBlogu();
    const deps = /\}\s*,\s*\[([^\]]*)\]\s*\)/.exec(blok);
    assert.ok(deps, 'etkinin bağımlılık dizisi okunamadı');
    for (const ad of ['wsId', 'dmWith', 'activeChannel']) {
      assert.ok(
        deps[1].includes(ad),
        `bağımlılıklarda ${ad} yok — o değişince taslak devredilmez ve taşınır`,
      );
    }
  });

  test('yanıt ve eklenmiş dosya da hedefe bağlı', () => {
    // Yalnızca metni düzeltmek yarım düzeltme olurdu: yanıt bağlamı ve
    // yüklenmiş dosya da hedefe aittir ve aynı yoldan taşınıyordu.
    const blok = taslakBlogu();
    assert.ok(/replyTo/.test(blok), 'yanıt durumu taslakla birlikte devredilmiyor');
    assert.ok(/pendingFile/.test(blok), 'eklenmiş dosya taslakla birlikte devredilmiyor');
    assert.ok(
      /setReplyTo\(/.test(blok) && /setPendingFile\(/.test(blok),
      'ikisi kaydediliyor ama geri yüklenmiyor olabilir',
    );
  });

  test('taslak deposu MODÜL kapsamında — panel kapanınca kaybolmuyor', () => {
    // KUSUR (kullanıcı, C turu 13. madde): depo `useChatRef` ile bileşen
    // içindeydi. Alan değiştirip geri dönmek çalışıyordu (panel ayakta
    // kalıyor) ama araya BAŞKA BİR GÖRÜNÜM girince (Notlar) panel unmount
    // oluyor ve taslaklar gidiyordu.
    //
    // Bu testi mutasyon turu yazdırdı: depoyu bileşen içine geri almak
    // hiçbir testi kırmıyordu, yani düzeltmeyi koruyan bir şey yoktu.
    const src = yorumsuzDosya(CHAT);
    assert.ok(/^const TASLAKLAR = new Map\(\);/m.test(src),
      'taslak deposu modül kapsamında değil — panel unmount olunca kaybolur');
    assert.ok(/const taslaklar = TASLAKLAR;/.test(src),
      'bileşen modül deposunu kullanmıyor');
    assert.ok(!/const taslaklar = useChatRef\(new Map/.test(src),
      'depo bileşen içine geri alınmış');

    // BU SATIRI CANLI BİR ÇÖKME YAZDIRDI (18 Eylül 2026, kullanıcı gerçek
    // cihazda). Yukarıdaki ölçütler depoyu BİLDİRİMİNDEN kilitliyordu ama
    // KULLANIM YERLERİNE hiç bakmıyordu. Depo `useChatRef(new Map())`ten
    // modül kapsamına taşınırken iki çağrı yeri `.current` ile kalmıştı:
    //
    //     taslaklar.current.set(...)   // <- Map değil, undefined
    //
    // Sonuç: sohbet HEDEFİ her değiştiğinde (DM'ye geçmek, kanaldan DM'ye
    // dönmek) `Cannot read properties of undefined (reading 'set')` fırlıyor
    // ve panel çöküyordu. Kullanıcı bunu "DM bozulmuş" diye bildirdi; o sırada
    // panel `ErrorBoundary` dışında olduğu için ekran tamamen beyazlıyordu
    // (#244 onu ayrıca kapattı).
    //
    // Ders: bir şeyin TÜRÜNÜ değiştirdiysen, bildirimini değil KULLANIMLARINI
    // ölç. Bildirim tek satır, kullanım her yerde — ve bu depoda tekrar eden
    // kusur sınıfının ta kendisi: aynı olgunun birden çok okuyucusu, biri
    // güncellenmemiş (CLAUDE.md).
    assert.ok(!/taslaklar\.current/.test(src),
      'taslak deposuna hâlâ ref gibi erişiliyor (`taslaklar.current`) — depo '
      + 'düz bir Map, `.current` undefined ve sohbet hedefi değişince panel çöker');
  });

  test('taslak diske yazılmıyor', () => {
    // Bilinçli ödün: sayfa yenilenince taslak gider. localStorage'a yazmak
    // sohbet metnini diske düşürür ve ortak makinede başkasının ekranına
    // gelebilir. Bu testin yorumu "localStorage" kelimesini İÇERİYOR —
    // tarama yorumları boşluğa çevirmeseydi burada yanlış alarm verirdi
    // (CLAUDE.md, 11 Eylül yorum tuzağı).
    const blok = taslakBlogu();
    assert.ok(
      !/localStorage|sessionStorage/.test(blok),
      'taslak tarayıcı deposuna yazılıyor — sohbet metni diske düşmemeli',
    );
  });
});

// ─── Aktif alan çözümü tek kaynakta ──────────────────────────────────────────
//
// KUSUR (kart #204, DEVIR 0-V; 17 Eylül 2026'da kapandı): "aktif alan sütunu
// boşsa ilk üyeliği seç ve sütuna yaz" mantığının ÜÇ KOPYASI vardı —
// `lib/workspace.js` (currentMember), `routes/api.js` (önyükleme) ve
// `sockets/chat.js`. Üçü de aynı işi yapıyordu, üçü de aynı iki kusuru
// taşıyordu ve birini düzeltmek ötekileri düzeltmiyordu.
//
// NİÇİN ÖNEMLİ: bu çözüm, yazmalarının HANGİ ALANA gideceğini belirliyor.
// Üç ayrı okuyucunun üç farklı cevaba varabilmesi, kapsam üstüne kurulmuş
// bir üründe kabul edilemez.
//
// İKİNCİ KUSUR, İLKİNİN ALTINDA SAKLIYDI: üç kopyada da `findFirst` SIRASIZ
// çağrılıyordu ve Postgres sırasız sorguda satır sırasını garanti etmez —
// "ilk üyelik" tanımsız bir seçimdi. Görünmemesinin sebebi kayda değer:
// sonucun sütuna yazılıp sabitlenmesi kusuru örtüyordu. Yani kusuru gizleyen
// şey, kartın şikâyet ettiği "okurken yazma" davranışının ta kendisiydi.

describe('aktif alan çözümü — tek kaynak, deterministik', () => {
  const SRC_DIZIN = path.resolve(__dirname, '..', 'src');
  // Bu iki imzayı BİRLİKTE taşıyan dosya, okurken onaran bir kopyadır:
  // "bu kullanıcının herhangi bir üyeliği" sorgusu + aktif alan sütununa yazma.
  const HERHANGI_UYELIK = /workspaceMember\.findFirst\s*\(\s*\{\s*where:\s*\{\s*userId/;
  const AKTIF_ALAN_YAZ = /currentWorkspaceId:/;
  const IZINLI = path.join('lib', 'workspace.js');

  function kopyalar() {
    return kaynakDosyalari(SRC_DIZIN, /\.js$/)
      .filter((yol) => {
        const src = yorumsuzDosya(yol);
        return HERHANGI_UYELIK.test(src) && AKTIF_ALAN_YAZ.test(src);
      })
      .map((yol) => path.relative(SRC_DIZIN, yol));
  }

  test('okurken onaran mantık yalnızca lib/workspace.js içinde', () => {
    assert.deepEqual(
      kopyalar(),
      [IZINLI],
      'Aktif alan çözümünün bir kopyası daha var. Üç kopya 17 Eylül 2026\'da '
      + 'teke indirildi; dördüncüsünü yazmak yerine currentMember ya da '
      + 'resolveWorkspaceId çağır.',
    );
  });

  test('tarama gerçekten o dosyayı buluyor (kör değil)', () => {
    // İlk test "hiçbir dosya eşleşmiyor" hâlinde de yeşil kalırdı ve hiçbir
    // şeyi korumazdı. Bu depoda üç tarama testi ilk hâlinde tam olarak
    // böyleydi.
    assert.ok(kopyalar().includes(IZINLI), 'tarama tek kaynağı bile göremiyor — desen bozuk');
  });

  test('geri düşüş deterministik — findFirst sırasız değil', () => {
    // Sıralama olmadan "ilk üyelik" tanımsızdır. Yazmayı kaldırmak isteyen
    // biri (kartın asıl talebi) önce buranın deterministik olduğundan emin
    // olmalı, yoksa aktif alan istekler arası oynar.
    const src = yorumsuzDosya(path.join(SRC_DIZIN, 'lib', 'workspace.js'));
    const bas = src.search(HERHANGI_UYELIK);
    assert.ok(bas !== -1, 'geri düşüş sorgusu bulunamadı');
    const kapanis = src.indexOf('});', bas);
    const sorgu = src.slice(bas, kapanis === -1 ? undefined : kapanis);
    assert.ok(
      /orderBy:/.test(sorgu),
      'üyelik geri düşüşü sırasız — Postgres satır sırasını garanti etmez, '
      + 'aktif alan istekler arası oynayabilir',
    );
  });
});

// ─── Üyelik reddi kâhin açmıyor ─────────────────────────────────────────────
//
// KUSUR (kart #227, 17 Eylül 2026): kimlikle kayıt arayan uçlar iki farklı
// cevap veriyordu — kayıt yoksa 404, kayıt VAR ama üyesi değilsen 403
// "Bu projeye erişiminiz yok". Bu bir VARLIK KÂHİNİ: kimlik deneyerek
// "bu kart var ama göremiyorum" ile "böyle bir kart yok" ayırt edilebiliyordu.
// Kimlikler sıralı olduğu için platformdaki kart sayısı ve açılma sırası
// dışarı sızıyordu — içerik değil, kardinalite.
//
// Depo aynı kâhini MCP yüzeyinde BİLEREK kapatmıştı (`erisimYoksaBulunamadi`);
// REST tarafı o kuralın dışında kalmıştı. Kullanıcı kart #224'ü (# ile kart
// numarası arama) denerken sordu ve ölçünce ALTI KOPYA çıktı: tasks.js (iki
// kez), attachments.js, notes.js, projects.js, reports.js.
//
// Altısını da tek bir yardımcıya çıkarmak daha iyi olurdu ama dönüş biçimleri
// farklı ({denied:true} / null / doğrudan return). Birleştirme yerine kural
// BURADA kilitlendi: kopyalar kalabilir, ayrışamaz.

describe('üyelik reddi var/yok kâhini açmıyor', () => {
  const ROUTES = path.resolve(__dirname, '..', 'src', 'routes');

  /**
   * KÂHİN TANIMI — kural dar olmak ZORUNDA, yoksa meşru kapıları suçlar.
   *
   * Kâhin ancak şu koşulda vardır: AYNI işlev hem 404 (kayıt yok) hem 403
   * (kayıt var, erişim yok) dönebiliyor ve ikisi de istekten gelen AYNI
   * kimliğe bakıyor. O zaman kimlik deneyerek varlık çıkarsanabilir.
   *
   * İLK YAZIMIM YANLIŞTI ve bu kayda değer: "hiçbir üyelik reddi 403
   * dönmesin" demiştim. Tarama on üç yer buldu ve ÇOĞU MEŞRUDU —
   * `!member || !hasPermission(...)` ve `member.role !== "owner"` birer
   * izin reddi: orada kullanıcı kaydın varlığını zaten biliyor, yalnızca
   * işlemi yapamıyor. Kural daraltılmasaydı test, düzeltilmesi YANLIŞ olan
   * kapıları bozmaya zorlardı.
   */
  function kahinler() {
    const out = [];
    for (const ad of fs.readdirSync(ROUTES).filter((x) => x.endsWith('.js'))) {
      const src = yorumsuzDosya(path.join(ROUTES, ad));
      for (const m of src.matchAll(/if\s*\(\s*!member\b/g)) {
        const sonraki = src.indexOf('if (', m.index + 4);
        const govde = src.slice(m.index, sonraki === -1 ? m.index + 400 : sonraki);
        if (!/status\(403\)/.test(govde)) continue;
        // İşlev başı: geriye doğru en yakın `async (` ya da `function `.
        const once = src.slice(0, m.index);
        const bas = Math.max(once.lastIndexOf('async ('), once.lastIndexOf('function '));
        const onceki = src.slice(bas === -1 ? 0 : bas, m.index);
        if (/status\(404\)[\s\S]{0,120}?_not_found/.test(onceki)) {
          out.push({ dosya: ad, govde: govde.replace(/\s+/g, ' ').slice(0, 110) });
        }
      }
    }
    return out;
  }

  test('kimlikle kayıt arayan hiçbir uç üyelik reddini 403 ile ayırt ettirmiyor', () => {
    assert.deepEqual(
      kahinler(), [],
      'Bu uçlar hem 404 (kayıt yok) hem 403 (kayıt var, erişim yok) dönüyor: '
      + 'kimlik deneyerek varlık çıkarsanabilir. Üyelik reddini, yukarıdaki '
      + '"bulunamadı" dalıyla AYNI 404 gövdesine çevir (MCP tarafındaki '
      + 'erisimYoksaBulunamadi ile aynı karar).',
    );
  });

  test('404 dönen her üyelik reddi bir _not_found kodu taşıyor', () => {
    // MUTASYON BULDU: ilk yazımda "dosyada EN AZ BİR red 404 dönüyor mu"
    // diye ölçüyordum. Bir redin gövdesini `err_no_access` yapmak testi
    // kırmıyordu, çünkü aynı dosyadaki BAŞKA bir red hâlâ 404+_not_found
    // dönüyordu ve sayaç doluyordu. Ölçüt, ölçmek istediği şeyden bağımsız
    // bir sayıya bakıyordu.
    //
    // Doğru kural: 404 ile reddeden her kapının GÖVDESİ de "bulunamadı"
    // olmalı. Farklı bir kod, kâhini durum kodundan değil gövdeden geri
    // açar — kullanıcı yine iki durumu ayırt eder.
    const suclu = [];
    for (const ad of fs.readdirSync(ROUTES).filter((x) => x.endsWith('.js'))) {
      const src = yorumsuzDosya(path.join(ROUTES, ad));
      for (const m of src.matchAll(/if\s*\(\s*!member\s*\)/g)) {
        const sonraki = src.indexOf('if (', m.index + 4);
        const govde = src.slice(m.index, sonraki === -1 ? m.index + 300 : sonraki);
        if (!/status\(404\)/.test(govde)) continue;
        if (!/_not_found/.test(govde)) suclu.push(`${ad}: ${govde.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    assert.deepEqual(suclu, [],
      '404 ile reddeden bir kapının gövdesi "bulunamadı" değil — kâhin gövdeden geri açılıyor');
  });

  test('süre kaydı izin reddi 403 KALMALI — tarama meşru kapıyı suçlamıyor', () => {
    // NEGATİF DURUM. `!member` reddi 404 olmalı ama `!hasPermission` reddi
    // 403 kalmalı: kullanıcı kaydın varlığını zaten görebiliyor, yalnızca
    // silemiyor. İkisini karıştıran bir kural meşru kapıyı bozmaya zorlardı.
    //
    // MUTASYON BULDU: ilk yazımda deseni DOSYA GENELİNDE arıyordum
    // (`hasPermission ... 403`). Süre kaydı kapısını 404 yapmak testi
    // kırmıyordu, çünkü reports.js içinde başka bir hasPermission+403 vardı.
    // Ölçüt artık o kapıya ADIYLA bağlı.
    const src = yorumsuzDosya(path.join(ROUTES, 'reports.js'));
    const i = src.indexOf('err_worklog_delete_forbidden');
    assert.ok(i !== -1, 'süre kaydı silme reddi kaybolmuş');
    const cevre = src.slice(Math.max(0, i - 200), i);
    assert.ok(/status\(403\)/.test(cevre), 'süre kaydı izin reddi artık 403 dönmüyor');
    assert.ok(/hasPermission\(/.test(cevre), 'red izin kontrolüne bağlı değil');
  });
});

// ─── Bildirim üreticisi TEK — soket yolu da createAndPush'tan geçiyor ────────
//
// KUSUR (kart #200, DEVIR 0-O): `sockets/chat.js` bildirimi doğrudan
// `prisma.notification.create` ile yazıp elle emit ediyordu; e-posta gönderimi
// (`dispatchEmail`) yalnızca `createAndPush` içinde. Yani REST'ten gelen bir
// bahsetme posta üretiyordu, soketten gelen üretmiyordu. Asimetri SESSİZDİ:
// kural görünmediği için kullanıcı bunu hata olarak bildiremezdi bile. Aynı
// sınıf: "aynı olgunun iki yolu, yollar aynı şeyi yapmıyor". `read: false`
// de (#193) yalnızca createAndPush'ta yazılıyordu — soket bildirimleri NULL
// doğmaya devam ediyordu.

describe('bildirim üreticisi tek — soket yolu da createAndPush (#200)', () => {
  const REST = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'chat.js'));
  const SOKET = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'sockets', 'chat.js'));

  test('soket yolunda doğrudan bildirim yazması ve elle emit YOK', () => {
    assert.doesNotMatch(SOKET, /prisma\.notification\.create\(/,
      'sockets/chat.js bildirimi doğrudan yazıyor — e-posta ve read:false o yoldan çıkmaz');
    assert.doesNotMatch(SOKET, /emit\(\s*'notification'/,
      'sockets/chat.js bildirimi elle yayınlıyor — createAndPush zaten yayınlıyor, çift bildirim');
    assert.doesNotMatch(SOKET, /notificationToDict/, 'elle yayın için serileştirici hâlâ içe aktarılıyor');
  });

  test('soketteki DM ve bahsetme bildirimleri createAndPush ile yazılıyor', () => {
    const dm = SOKET.slice(SOKET.indexOf('if (receiver) {'), SOKET.indexOf('matchAll(MENTION_RE)'));
    assert.match(dm, /await createAndPush\(io, \{/, 'DM bildirimi createAndPush üzerinden yazılmıyor');
    const bahsetme = SOKET.slice(SOKET.indexOf('matchAll(MENTION_RE)'));
    assert.match(bahsetme, /await createAndPush\(io, \{/, 'bahsetme bildirimi createAndPush üzerinden yazılmıyor');
  });

  test('iki yolun bahsetme bildirimi AYNI alanları taşıyor', () => {
    // Alan kümesi ayrışırsa asimetri başka biçimde geri gelir (bildirimden
    // mesaja gitmek tek yolda çalışır gibi).
    const alanlar = (src) => {
      const b = src.slice(src.indexOf('matchAll(MENTION_RE)'));
      const c = b.slice(b.indexOf('createAndPush(io, {'), b.indexOf('});', b.indexOf('createAndPush(io, {')));
      // Yalnızca en üst düzey alanlar: ilk alan satırının girintisindekiler.
      // buildNotificationText'in kendi argümanları (who, preview) bir düzey
      // içeride ve sayılmamalı — ilk yazımda sayıldı, test yanlış kırıldı.
      const ilk = /^(\s+)\w+:/m.exec(c);
      assert.ok(ilk, 'bildirim alanı bulunamadı');
      const desen = new RegExp(`^${ilk[1]}(\\w+)(?::|,)`, 'gm');
      return [...c.matchAll(desen)].map((m) => m[1]).sort();
    };
    const rest = alanlar(REST);
    const soket = alanlar(SOKET);
    assert.deepEqual(rest, soket, `REST ${rest} ≠ soket ${soket}`);
    for (const alan of ['userId', 'text', 'senderSlug', 'workspaceId', 'messageId']) {
      assert.ok(rest.includes(alan), `bahsetme bildiriminde ${alan} yok`);
    }
  });

  test('chatChannel bir tür işareti, slug değil — sütun VarChar(20)', () => {
    // Gerçek slug 80 karaktere kadar; yazılsaydı uzun adlı kanalda mesaj
    // göndermek Prisma hatasıyla düşerdi.
    for (const [ad, src] of [['REST', REST], ['soket', SOKET]]) {
      const b = src.slice(src.indexOf('matchAll(MENTION_RE)'));
      assert.match(b, /chatChannel: receiver \? 'dm' : 'general'/, `${ad}: chatChannel'a slug yazılıyor`);
    }
  });
});
