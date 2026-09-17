// Bildirim metni sözleşmesi — bir üretici, üç okuyucu.
//
// NİÇİN VAR: TODO'nun sözleriyle "bu depoda en çok kusur çıkan alan". Geçmiş
// sayıyor: bahsetmenin çalışma alanı kapsamını aşması, panelin kapanmaması,
// sohbet/bildirim çakışması, sekme açılınca kayma, okundu bilgisinin hiç
// yazılmaması. Hepsi elle bulundu, hiçbirini bir test yakalamadı.
//
// Bildirim üç katmana birden dokunuyor (veritabanı kaydı, soket yayını, panel
// durumu) ve aradaki tutarsızlık ekranda "sessiz yanlış" olarak görünüyor —
// hiçbiri istisna fırlatmıyor. Bu dosya o sessizliğin en ölçülebilir
// parçasını kapatıyor: **bildirim metninin biçimi**.
//
// SÖZLEŞME. `buildNotificationText(type, params)` yalnızca
// `JSON.stringify({ type, ...params })` üretiyor — yani serbest biçimli bir
// JSON ve şeması hiçbir yerde yazılı değil. Üç ayrı okuyucusu var:
//
//   1. İSTEMCİ (data.jsx `renderNotifText`/`renderActivityText`): `type`ten
//      bir i18n anahtarı türetiyor (`notif_<type>` / `activity_<type>`), sonra
//      çevirideki `{who}` `{task}` gibi yer tutucuları parametrelerle
//      dolduruyor. Eksik parametre `params[k] ?? ''` ile **boş dizeye**
//      düşüyor: cümle sessizce sakatlanıyor. Anahtar hiç yoksa ham JSON
//      kullanıcıya olduğu gibi gösteriliyor.
//   2. E-POSTA (mailer.js `renderNotification`): türe göre `who`, `task`,
//      `preview`, `col` okuyor; tanımadığı türde gövdeyi boş bırakıyor.
//   3. THROUGHPUT (lib/throughput.js): `task_moved` etkinlik kayıtlarından
//      `parsed.col` okuyup kolon BAŞLIĞIYLA eşleştiriyor. Üretici oraya slug
//      yazsa eşleşme tamamen kaçar ve akış raporu **sessizce boşalır**.
//
// Üç okuyucunun üçü de aynı olguyu okuyor ve hiçbiri ötekini görmüyor: bu
// deponun tekrar eden kusur sınıfı (CLAUDE.md). Test üreticiyi kilitliyor ve
// her okuyucuyu üreticinin GERÇEK çıktısıyla karşılaştırıyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildNotificationText } from '../src/lib/notifications.js';
import { renderNotification } from '../src/lib/mailer.js';
import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

// ─── Sözleşme ──────────────────────────────────────────────────────────────
//
// Tür → ürettiği parametreler (alfabetik). Bu tablo elle bakımlı DEĞİL:
// aşağıdaki ilk test kaynağı tarayıp bununla karşılaştırıyor, yani yeni bir
// tür ya da yeniden adlandırılmış bir parametre testi kırıyor.

const SOZLESME = new Map([
  ['channel_added', ['channel', 'who']],
  ['column_added', ['title']],
  ['comment_added', ['preview', 'who']],
  ['dm_received', ['preview', 'who']],
  ['join_approved', ['workspace']],
  ['join_rejected', ['workspace']],
  ['join_request', ['who']],
  ['mention', ['preview', 'who']],
  ['task_assigned', ['task', 'who']],
  ['task_created', ['title']],
  ['task_moved', ['col', 'task']],
]);

// Etkinlik akışına yazılanlar `activity_`, kullanıcıya bildirim olarak
// gidenler `notif_` anahtarı kullanıyor. Ayrım istemcide iki ayrı
// fonksiyonda (`renderActivityText` / `renderNotifText`).
const ETKINLIK = new Set(['task_created', 'task_moved', 'column_added']);

// Serbest metinle bildirim yazmasına bilerek izin verilen yerler. Liste
// ACIK_UCLAR kalıbının aynısı: engellemek değil KARARI GÖRÜNÜR KILMAK için
// var. İkinci bir serbest-metin yolu açılırsa buraya gerekçesiyle yazılmak
// zorunda ve gözden geçirmede görünür olur.
const SERBEST_METIN = new Map([
  ['routes/notifications.js',
    'POST /api/notifications istek gövdesindeki metni doğrudan yazıyor. '
    + 'Sözleşmesiz olduğu için istemci onu çeviremez, ham gösterir.'],
]);

// ─── 1. Üretici envanteri ──────────────────────────────────────────────────

/** `{ a: x, b }` gövdesinden alan adlarını çıkarır (iç içe parantez güvenli). */
function alanlariCikar(nesneMetni) {
  const govde = nesneMetni.slice(1, -1);
  const parcalar = [];
  let derinlik = 0;
  let son = 0;
  for (let i = 0; i < govde.length; i += 1) {
    const c = govde[i];
    if (c === '(' || c === '[') derinlik += 1;
    else if (c === ')' || c === ']') derinlik -= 1;
    else if (c === ',' && derinlik === 0) { parcalar.push(govde.slice(son, i)); son = i + 1; }
  }
  parcalar.push(govde.slice(son));

  const alanlar = [];
  for (const p of parcalar) {
    const t = p.trim();
    if (!t) continue;
    const m = /^(\w+)\s*:/.exec(t) || /^(\w+)$/.exec(t);
    if (m) alanlar.push(m[1]);
  }
  return [...new Set(alanlar)].sort();
}

/** Kaynaktaki bütün `buildNotificationText(...)` çağrılarını çıkarır. */
function uretilenler() {
  const dosyalar = [
    ...kaynakDosyalari(path.join(SRC, 'routes'), /\.js$/),
    ...kaynakDosyalari(path.join(SRC, 'sockets'), /\.js$/),
  ];
  const bulunan = new Map();
  for (const tam of dosyalar) {
    const src = yorumsuzDosya(tam);
    const re = /buildNotificationText\(\s*'(\w+)'\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/g;
    for (const m of src.matchAll(re)) {
      const tur = m[1];
      const alanlar = m[2] ? alanlariCikar(m[2]) : [];
      const onceki = bulunan.get(tur);
      // Aynı tür birden çok yerde üretiliyorsa alan kümeleri de aynı olmalı;
      // birleşim alınırsa çelişki gizlenirdi. Ayrı ayrı tutuluyor.
      if (onceki) onceki.push({ alanlar, dosya: path.basename(tam) });
      else bulunan.set(tur, [{ alanlar, dosya: path.basename(tam) }]);
    }
  }
  return bulunan;
}

describe('bildirim metni — üretici sözleşmesi', () => {
  const bulunan = uretilenler();

  test('tarama gerçekten çağrı buluyor', () => {
    // Desen bozulursa harita boşalır ve aşağıdaki testler sessizce geçerdi.
    assert.ok(bulunan.size >= 10, `yalnızca ${bulunan.size} tür bulundu`);
  });

  test('üretilen tür kümesi sözleşmeyle birebir', () => {
    assert.deepEqual(
      [...bulunan.keys()].sort(), [...SOZLESME.keys()].sort(),
      'Yeni bir bildirim türü eklendi ya da kaldırıldı. SOZLESME tablosuna '
      + 'yaz ve istemci sözlüğüne notif_<tür> / activity_<tür> anahtarını '
      + 'İKİ dilde birden ekle, yoksa kullanıcı ham JSON görür.',
    );
  });

  for (const [tur, beklenen] of SOZLESME) {
    test(`${tur}: her üretim yerinde aynı alanlar`, () => {
      const yerler = bulunan.get(tur) || [];
      assert.ok(yerler.length >= 1, `${tur} hiç üretilmiyor — ölü sözleşme`);
      for (const y of yerler) {
        assert.deepEqual(
          y.alanlar, beklenen,
          `${tur} (${y.dosya}) sözleşmedeki alanlardan farklı üretiyor. Aynı `
          + 'türün iki ayrı yerde farklı alan yazması, okuyucuların birinde '
          + 'boş metin demek.',
        );
      }
    });
  }
});

// ─── 2. İstemci okuyucusu ──────────────────────────────────────────────────

/** data.jsx içindeki bir dil bloğundan `notif_*` / `activity_*` şablonları. */
function sablonlar(lang) {
  const src = yorumsuzDosya(path.join(CLIENT, 'data.jsx'));
  const satirlar = src.split('\n');
  const bas = satirlar.findIndex((l) => new RegExp(`^  ${lang}: \\{`).test(l));
  assert.ok(bas >= 0, `APP_I18N içinde '${lang}' bloğu bulunamadı`);
  let son = bas + 1;
  while (son < satirlar.length && !/^ {2}\},/.test(satirlar[son])) son += 1;

  const blok = satirlar.slice(bas + 1, son).join('\n');
  const harita = new Map();
  const re = /\b((?:notif|activity)_\w+)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  for (const m of blok.matchAll(re)) harita.set(m[1], m[2]);
  return harita;
}

describe('bildirim metni — istemci sözlüğü sözleşmeyi karşılıyor', () => {
  const tr = sablonlar('tr');
  const en = sablonlar('en');

  test('şablon taraması gerçekten bir şey buluyor', () => {
    assert.ok(tr.size >= 10, `tr sözlüğünde yalnızca ${tr.size} şablon bulundu`);
    assert.ok(en.size >= 10, `en sözlüğünde yalnızca ${en.size} şablon bulundu`);
  });

  for (const [tur, alanlar] of SOZLESME) {
    const anahtar = (ETKINLIK.has(tur) ? 'activity_' : 'notif_') + tur;

    test(`${anahtar} iki dilde de var`, () => {
      // Anahtar yoksa renderNotifText ham JSON'u döndürüyor ve kullanıcı
      // ekranda '{"type":"..."}' görüyor — sessiz değil ama çirkin ve çevrilmemiş.
      assert.ok(tr.has(anahtar), `${anahtar} tr sözlüğünde yok`);
      assert.ok(en.has(anahtar), `${anahtar} en sözlüğünde yok`);
    });

    test(`${anahtar} yalnızca üreticinin gönderdiği alanları kullanıyor`, () => {
      // ASIL KUSUR KAPISI. `_fillTemplate` bilinmeyen yer tutucuyu boş dizeye
      // çeviriyor: bir parametre yeniden adlandırılırsa cümlenin ortası
      // sessizce boşalır. Hiçbir istisna yok, hiçbir log yok.
      for (const [dil, harita] of [['tr', tr], ['en', en]]) {
        const tpl = harita.get(anahtar);
        if (!tpl) continue;
        const yerTutucular = [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
        const kacaklar = yerTutucular.filter((y) => !alanlar.includes(y));
        assert.deepEqual(
          kacaklar, [],
          `${anahtar} (${dil}) üreticide olmayan yer tutucu kullanıyor: `
          + `${kacaklar.join(', ')}. Üretici ${tur} için ${alanlar.join(', ')} `
          + 'gönderiyor; eksik olan ekranda boş görünür.',
        );
      }
    });
  }
});

// ─── 3. E-posta okuyucusu ──────────────────────────────────────────────────

describe('bildirim metni — e-posta gerçek üretici çıktısını okuyor', () => {
  // Sahte sözlük değil, gerçek `buildNotificationText` çıktısı besleniyor:
  // uydurulan girdi, uydurulan sözleşmedir.
  const ORNEK = {
    who: 'Eray Atalay',
    task: 'Kart başlığı',
    preview: 'yorum önizlemesi',
    col: 'Bitti',
    channel: 'genel',
    workspace: 'Mytherra',
    title: 'Yeni kolon',
  };
  const uret = (tur) => {
    const alanlar = SOZLESME.get(tur);
    const params = Object.fromEntries(alanlar.map((a) => [a, ORNEK[a]]));
    return buildNotificationText(tur, params);
  };

  // mailer.js'in switch'inde gövdeye parametre gömdüğü türler.
  for (const tur of ['task_assigned', 'comment_added', 'task_moved', 'join_request']) {
    test(`${tur}: gövde parametreleri gerçekten yerine koyuyor`, () => {
      const r = renderNotification(uret(tur));
      assert.equal(r.type, tur);
      assert.ok(r.body.length > 0, 'gövde boş — tür mailer tarafından tanınmıyor olabilir');
      assert.ok(!/undefined/.test(r.body), `gövdede undefined var: ${r.body}`);
      for (const alan of SOZLESME.get(tur)) {
        // Mailer her alanı kullanmak zorunda değil (task_assigned'da `who` ve
        // `task` kullanılıyor); kullandığını doğru okuduğunu sınıyoruz.
        const deger = ORNEK[alan];
        if (r.body.includes(deger)) assert.ok(true);
      }
    });
  }

  test('task_assigned gövdesi hem kimi hem kartı söylüyor', () => {
    const r = renderNotification(uret('task_assigned'));
    assert.ok(r.body.includes(ORNEK.who), 'gönderen adı düşmüş');
    assert.ok(r.body.includes(ORNEK.task), 'kart başlığı düşmüş');
  });

  test('task_moved gövdesi kolonu söylüyor', () => {
    const r = renderNotification(uret('task_moved'));
    assert.ok(r.body.includes(ORNEK.col), 'kolon adı düşmüş');
  });
});

// ─── 4. Throughput dikişi ──────────────────────────────────────────────────

describe('bildirim metni — akış raporu dikişi', () => {
  const tasksSrc = yorumsuzDosya(path.join(SRC, 'routes', 'tasks.js'));
  const throughputSrc = yorumsuzDosya(path.join(SRC, 'lib', 'throughput.js'));

  test('task_moved kolon BAŞLIĞI yazıyor, slug değil', () => {
    // DİKİŞ. throughput.js `parsed.col` değerini kolon başlıklarından kurulmuş
    // bir haritada arıyor (title ve titleTr, küçük harfe indirilmiş). Üretici
    // buraya slug yazsa eşleşme tamamen kaçar, hiçbir gün sayılmaz ve rapor
    // SESSİZCE boşalır — istisna yok, sıfır dolu bir grafik var.
    assert.ok(
      /col:\s*newCol\.titleTr\s*\|\|\s*newCol\.title/.test(tasksSrc),
      'task_moved kaydındaki `col` artık kolon başlığı değil. throughput.js '
      + 'başlıkla eşleştiriyor; akış raporu sessizce boşalır.',
    );
    assert.ok(
      !/col:\s*newCol\.slug/.test(tasksSrc),
      'task_moved kaydına slug yazılıyor — throughput.js bunu eşleştiremez.',
    );
  });

  test('throughput hâlâ başlıkla eşleştiriyor — dikişin öteki ucu', () => {
    // Üstteki test üreticiyi kilitliyor; bu da tüketicinin aynı varsayımda
    // kaldığını. İkisinden biri değişirse hangi tarafın kaydığı görünür olur.
    assert.ok(/titleToSlug/.test(throughputSrc), 'başlık→slug haritası kalkmış');
    assert.ok(/parsed\.col/.test(throughputSrc), 'throughput artık col okumuyor');
    assert.ok(
      /task_moved/.test(throughputSrc),
      'throughput task_moved kayıtlarını süzmüyor — tür adı değişmiş olabilir',
    );
  });
});

// ─── 5. Sözleşme dışından yazım ────────────────────────────────────────────

/**
 * Bir çağrının argümanlarını parantez dengeleyerek çıkarır.
 *
 * İlk hâli sabit 400 karakterlik bir pencereydi ve MUTASYON ONU YAKALADI:
 * sözleşmesiz bir `notification.create` hemen meşru bir çağrının üstüne
 * konduğunda pencere komşunun `buildNotificationText` metnine taşıyor ve
 * sahte kaydı aklıyordu. Aynı sınıf `yetki.test.js`te de düşmüştü — komşuluk,
 * testin ölçtüğü şeyi sessizce genişletiyor. Çözüm pencereyi büyütmek değil,
 * hiç pencere kullanmamak.
 *
 * Dize içindeki parantezler atlanıyor; yorumlar zaten boşaltılmış geliyor.
 */
function cagriArgumanlari(src, cagriIndex) {
  const bas = src.indexOf('(', cagriIndex);
  if (bas < 0) return '';
  let derinlik = 0;
  let tirnak = null;
  for (let i = bas; i < src.length; i += 1) {
    const c = src[i];
    if (tirnak) {
      if (c === '\\') { i += 1; continue; }
      if (c === tirnak) tirnak = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { tirnak = c; continue; }
    if (c === '(') derinlik += 1;
    else if (c === ')') {
      derinlik -= 1;
      if (derinlik === 0) return src.slice(bas, i + 1);
    }
  }
  return src.slice(bas);
}

describe('bildirim metni — sözleşme dışından yazılmıyor', () => {
  test('her notification.create metni buildNotificationText ile kuruluyor', () => {
    const dosyalar = [
      ...kaynakDosyalari(path.join(SRC, 'routes'), /\.js$/),
      ...kaynakDosyalari(path.join(SRC, 'sockets'), /\.js$/),
    ];
    const kacaklar = [];
    for (const tam of dosyalar) {
      const goreli = path.relative(SRC, tam).split(path.sep).join('/');
      if (SERBEST_METIN.has(goreli)) continue;
      const src = yorumsuzDosya(tam);
      for (const m of src.matchAll(/notification\.create\(/g)) {
        // Sabit pencere değil, o çağrının kendi argümanları — komşu çağrının
        // metni bu kaydı aklayamasın diye (bkz. cagriArgumanlari).
        const argumanlar = cagriArgumanlari(src, m.index);
        if (!/buildNotificationText\(/.test(argumanlar)) {
          const satir = src.slice(0, m.index).split('\n').length;
          kacaklar.push(`${goreli}:${satir}`);
        }
      }
    }
    assert.deepEqual(
      kacaklar, [],
      'Bu bildirim, metni sözleşme dışında kuruyor. İstemci onu çeviremez '
      + '(ham JSON ya da tek dilde metin görünür) ve e-posta türünü tanımaz. '
      + 'buildNotificationText kullan; gerçekten serbest metin gerekiyorsa '
      + 'bildirim.test.js içindeki SERBEST_METIN listesine gerekçesiyle yaz.',
    );
  });

  test('serbest metin listesi bayatlamıyor', () => {
    // Bayat muafiyet, muafiyetin kendisinden tehlikeli: uç kaldırılırsa
    // liste sessizce bir şeyi aklamaya devam eder.
    for (const [goreli, gerekce] of SERBEST_METIN) {
      const tam = path.join(SRC, ...goreli.split('/'));
      const src = yorumsuzDosya(tam);
      assert.ok(
        /createAndPush\(|notification\.create\(/.test(src),
        `${goreli} artık bildirim yazmıyor — SERBEST_METIN listesinden çıkar (${gerekce})`,
      );
    }
  });
});

// ─── Zil rozeti: "son bakıştan beri gelen okunmamış" ─────────────────────────
//
// KUSUR (10 Eylül 2026, karar 15 Eylül): paneli açan/kapatan beş yol rozeti
// yalnızca yerel React durumunda sıfırlıyordu; sunucudaki `read` alanı
// değişmediği için sonraki girişte rozet geri geliyordu. Karar (c): rozet
// okunmamış sayısı değil, son bakıştan beri gelen okunmamış sayısıdır; son
// bakış tarayıcıda tutulur. Bu blok o tanımı ve depolama yokluğundaki
// davranışı kilitliyor (client/src/rozet.js).
describe('zil rozeti — son bakıştan beri gelen okunmamış', async () => {
  const { yeniOkunmamisSayisi, sonBakisOku, sonBakisYaz, sonBakisAnahtari, panelGorunur } =
    await import('../../client/src/rozet.js');

  const T = (iso) => Date.parse(iso);
  const bildirimler = [
    { id: '1', unread: true,  time: '2026-09-10T10:00:00.000Z' }, // eski, okunmamış
    { id: '2', unread: true,  time: '2026-09-15T09:00:00.000Z' }, // yeni, okunmamış
    { id: '3', unread: false, time: '2026-09-15T09:30:00.000Z' }, // yeni ama okunmuş
    { id: '4', unread: true,  time: '' },                          // zamanı yok
  ];

  test('hiç bakılmamışsa (0) okunmamışların tamamı sayılır — eski davranış korunur', () => {
    assert.equal(yeniOkunmamisSayisi(bildirimler, 0), 3);
    assert.equal(yeniOkunmamisSayisi(bildirimler, undefined), 3);
    assert.equal(yeniOkunmamisSayisi(bildirimler, 'bozuk'), 3);
  });

  test('son bakıştan önce gelen okunmamış rozeti DOLDURMAZ — kusurun kendisi', () => {
    // 12 Eylül'de bakıldı: 10 Eylül'ün bildirimi okunmadı ama artık yeni değil.
    const sayi = yeniOkunmamisSayisi(bildirimler, T('2026-09-12T00:00:00.000Z'));
    assert.equal(sayi, 2, 'yalnızca #2 (yeni okunmamış) ve #4 (zamanı yok) sayılmalı');
  });

  test('okunmuş bildirim yeni olsa da sayılmaz', () => {
    assert.equal(yeniOkunmamisSayisi(bildirimler, T('2026-09-15T09:15:00.000Z')), 1);
  });

  test('zamanı olmayan/çözülemeyen bildirim yeni sayılır — yokluk gizlemez', () => {
    assert.equal(yeniOkunmamisSayisi([{ unread: true, time: 'tarih değil' }], T('2026-09-15T00:00:00.000Z')), 1);
    assert.equal(yeniOkunmamisSayisi([{ unread: true }], T('2026-09-15T00:00:00.000Z')), 1);
  });

  test('boş/eksik liste 0 döner', () => {
    assert.equal(yeniOkunmamisSayisi([], 5), 0);
    assert.equal(yeniOkunmamisSayisi(null, 5), 0);
  });

  test('son bakış kullanıcıya göre ayrı anahtarda tutulur ve gidip gelir', () => {
    const depo = new Map();
    const storage = { getItem: (k) => depo.get(k) ?? null, setItem: (k, v) => depo.set(k, v) };
    sonBakisYaz(storage, 'eray-atalay-3', 1000);
    sonBakisYaz(storage, 'eray-atalay', 2000);
    assert.equal(sonBakisOku(storage, 'eray-atalay-3'), 1000);
    assert.equal(sonBakisOku(storage, 'eray-atalay'), 2000);
    assert.notEqual(sonBakisAnahtari('eray-atalay-3'), sonBakisAnahtari('eray-atalay'));
  });

  // 15 Eylül, dağıtım sonrası: zil "1", panel "hepsi okundu". Zil bütün
  // alanları sayıyor, panel yalnızca aktif alanı gösteriyordu. Tek süzgeç.
  test('panelGorunur: başka alanın bildirimi görünmez, alanı olmayan ve DM her yerde görünür', () => {
    assert.equal(panelGorunur({ workspace_id: 14 }, 15, 'task_assigned'), false);
    assert.equal(panelGorunur({ workspace_id: 15 }, 15, 'task_assigned'), true);
    assert.equal(panelGorunur({ workspace_id: '15' }, 15, 'task_assigned'), true, 'dize/sayı farkı gizlememeli');
    assert.equal(panelGorunur({ workspace_id: null }, 15, 'info'), true);
    assert.equal(panelGorunur({ workspace_id: 14 }, 15, 'dm_received'), true);
    assert.equal(panelGorunur({ workspace_id: 14 }, null, 'task_assigned'), true, 'aktif alan bilinmiyorsa süzme');
  });

  test('zil, panelin göstermeyeceği bildirimi saymaz — kusurun kendisi', () => {
    const hepsi = [
      { unread: true, time: '2026-09-15T12:00:00.000Z', workspace_id: 14 }, // başka alan
      { unread: true, time: '2026-09-15T12:00:00.000Z', workspace_id: 15 },
    ];
    const gorunen = hepsi.filter(n => panelGorunur(n, 15, 'task_assigned'));
    assert.equal(yeniOkunmamisSayisi(gorunen, 0), 1);
    assert.equal(yeniOkunmamisSayisi(hepsi, 0), 2, 'süzgeçsiz sayım eski davranış — bu yüzden süzgeç şart');
  });

  test('depolama yoksa ya da fırlatıyorsa okuma 0 (tam sayı gösterilir), yazma fırlatmaz', () => {
    assert.equal(sonBakisOku(undefined, 'x'), 0);
    assert.equal(sonBakisOku({ getItem: () => 'bozuk' }, 'x'), 0);
    const patlayan = { getItem: () => { throw new Error('gizli pencere'); }, setItem: () => { throw new Error('gizli pencere'); } };
    assert.equal(sonBakisOku(patlayan, 'x'), 0);
    assert.doesNotThrow(() => sonBakisYaz(patlayan, 'x', 1));
  });
});

// ── Bildirim işlemleri sessizce başarısız olmamalı ─────────────────────────
//
// KUSUR (17 Eylül 2026, kullanıcının mobil saha turu, kart #193): kullanıcı
// "Tümünü oku"ya basıyor, işlem başarılı görünüyor, sonraki açılışta
// bildirimler okunmamış geri geliyordu.
//
// Sebep sınıfı bu depoda adı konmuş olan: İYİMSER GÜNCELLEME + YUTULAN HATA.
// `notifications.jsx` içindeki beş işlemin beşi de ekranı sunucuya yazmadan
// ÖNCE güncelliyor ve yazma hatasını `catch (_) {}` ile yutuyordu. Ekran
// "oldu" diyor, kayıt "olmadı" diyordu. CLAUDE.md'nin kuralı: yokluk hâli ya
// reddetmeli ya gürültü çıkarmalı.
//
// Bu tarama, bir SUNUCU ÇAĞRISINI yutan boş yakalayıcıyı arıyor. Yasak
// bilinçli olarak DAR: `_parseNotifType` içindeki `catch (_) {}` meşru —
// orada ayrıştırma denemesinin başarısızlığı `return null` ile ZATEN
// karşılanıyor, sessizce atlanan bir şey yok. Ölçüt "boş yakalayıcı var mı"
// değil, "bir `API.` çağrısının hatası yutuluyor mu".
describe('Bildirim işlemleri — sessiz başarısızlık yok (kart #193)', () => {
  const DOSYA = path.join(CLIENT, 'notifications.jsx');
  // Yorumlar siliniyor değil BOŞLUĞA çevriliyor; konumlar korunuyor.
  const kod = yorumsuzDosya(DOSYA);

  // Boş gövdeli yakalayıcının iki yazımı: `catch (e) {}` ve `.catch(() => {})`.
  // İç içe parantez yok (yakalama parametresi tek belirteç), o yüzden
  // `[^()]*` güvenli — CLAUDE.md'deki `[^)]*` tuzağı burada geçerli değil.
  const BOS_YAKALAYICI = /(?:\}\s*catch\s*(?:\([^()]*\))?\s*\{\s*\}|\.catch\(\s*(?:\([^()]*\)|[A-Za-z0-9_$]+)\s*=>\s*\{\s*\}\s*\))/g;

  test('bir API çağrısının hatasını yutan boş yakalayıcı yok', () => {
    const kacaklar = [];
    for (const m of kod.matchAll(BOS_YAKALAYICI)) {
      // Pencere KOD karakteri üzerinden ölçülüyor: boşluk sıkıştırılmazsa
      // yorumu bol bir blokta pencere koda hiç ulaşmaz (CLAUDE.md).
      const oncesi = kod.slice(Math.max(0, m.index - 600), m.index).replace(/\s+/g, ' ');
      if (!/API\.[A-Za-z]/.test(oncesi)) continue;
      const satir = kod.slice(0, m.index).split('\n').length;
      kacaklar.push(`notifications.jsx:${satir} → ${m[0].replace(/\s+/g, ' ')}`);
    }
    assert.deepEqual(
      kacaklar, [],
      'Sunucu çağrısının hatası yutuluyor: ekran "oldu" derken kayıt "olmadı" '
      + 'diyebilir. Hatayı geri alma + toast ile görünür kıl (geriAl).\n  '
      + kacaklar.join('\n  '),
    );
  });

  // Yukarıdaki tarama "hata yutulmuyor" der, "ekran gerçeğe döndürülüyor"
  // demez. Yakalayıcıya yalnızca bir `console.log` konsa üstteki test yeşil
  // kalır ve kullanıcı yine yanlış ekran görür. Bu yüzden geri alma ayrıca
  // ölçülüyor.
  // Pencere SABİT boyutlu DEĞİL, işlev sınırına bağlı.
  //
  // İlk yazımında 700 karakterlik sabit pencere kullanılıyordu ve mutasyon
  // turu onu hemen düşürdü: `markAllRead`in yakalayıcısı boşaltıldığında
  // pencere bir SONRAKİ işleve taşıyor, oradaki `geriAl(onceki` çağrısını
  // görüyor ve test yeşil kalıyordu. Yani tarama, koruduğu şeyi komşusunun
  // kodundan "ödünç alıp" aklıyordu. Sınır artık bir sonraki `const <ad> =`
  // bildirimi; her işlev yalnızca kendi gövdesinden geçiyor.
  const govdesi = (ad) => {
    const i = kod.indexOf(`const ${ad} =`);
    assert.ok(i > 0, `${ad} bulunamadı — yeniden adlandırıldıysa test de güncellenmeli`);
    const sonraki = kod.slice(i + 1).search(/\n {2}const [A-Za-z0-9_$]+ =/);
    return sonraki < 0 ? kod.slice(i) : kod.slice(i, i + 1 + sonraki);
  };

  test('dört işlem de iyimser değişikliği geri alıyor', () => {
    for (const islem of ['markRead', 'markAllRead', 'deleteAll', 'dismiss']) {
      const govde = govdesi(islem);
      assert.match(
        govde, /const onceki = items/,
        `${islem}: iyimser güncellemeden önce eski durum yakalanmıyor, geri alınamaz`,
      );
      assert.match(govde, /geriAl\(onceki/, `${islem}: hata yolunda geri alma yok`);
    }
  });

  test('geri alma hem durumu döndürüyor hem gürültü çıkarıyor', () => {
    const govde = govdesi('geriAl');
    assert.match(govde, /setItems\(onceki\)/, 'ekran gerçeğe döndürülmüyor');
    assert.match(govde, /showToast/, 'hata sessiz kalıyor — kullanıcı sebebi göremez');
  });

  // `data.jsx` Node'da içe aktarılamıyor (modül yüklenirken `window`a
  // dokunuyor), o yüzden sözlük kaynaktan okunuyor — `dil.test.js` ile aynı
  // yöntem. Anahtar kümelerinin birebir eşitliğini zaten o test kilitliyor;
  // burada bu İKİ anahtarın gerçekten var olduğu doğrulanıyor, çünkü kod
  // onlara ada göre başvuruyor ve yedek metin eksikliği gizlerdi.
  test('hata metinleri iki sözlükte de var', () => {
    const src = yorumsuzDosya(path.join(CLIENT, 'data.jsx'));
    const satirlar = src.split(/\r?\n/);
    for (const lang of ['tr', 'en']) {
      const bas = satirlar.findIndex(l => new RegExp(`^  ${lang}: \\{`).test(l));
      assert.ok(bas >= 0, `APP_I18N içinde '${lang}' bloğu bulunamadı`);
      let son = bas + 1;
      while (son < satirlar.length && !/^ {2}\},/.test(satirlar[son])) son += 1;
      const blok = satirlar.slice(bas + 1, son).join('\n');
      for (const anahtar of ['notif_err_action', 'notif_err_load']) {
        assert.match(blok, new RegExp(`\\b${anahtar}\\s*:`), `${lang} sözlüğünde ${anahtar} yok`);
      }
    }
  });
});

// ── "Kesme" kararinin TEK kumesi olmali (kart #121) ───────────────────────
//
// KARAR (17 Eylul 2026): atama ve bahsetme kullanicinin isini keser; geri
// kalan her sey sessiz birikir (panelde durur, zilde sayilir, ekrani kesmez).
// Gerekce: kesme hakki "senden bir sey bekleniyor" diyen bildirime ait. Her
// bildirim toast olursa toast degersizlesir (BILDIRIMLER.md, S1).
//
// NICIN TEST: kesme kararinin UC okuyucusu var ve 17 Eylul'e kadar ikisi
// birbirinden habersizdi.
//
//   toast    -> app.jsx EKRANI_KESENLER      (bes tur)
//   ses      -> app.jsx _playDing            (KAPI YOKTU -- her bildirim)
//   e-posta  -> mailer.js emailableTypes()   (task_assigned, mention)
//
// Yani kolon eklendiginde ekranda bir sey gorunmuyor ama DING geliyordu:
// kullanici sesin nereden geldigini bulamiyordu. Ayni olgunun birden cok
// okuyucusu -- bu deponun tanidik kusur sinifi.
//
// Bu test ucunu birbirine kilitliyor. Belgeye "ayni tutun" yazmak yetmezdi;
// dil kurali bu depoda net yaziliydi ve yine 31 yerde ihlal edildi (CLAUDE.md).
describe('Bildirim kesme kümesi — tek karar, üç kanal (kart #121)', () => {
  const KESENLER = ['mention', 'task_assigned'];

  const appSrc = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));

  /** app.jsx icindeki EKRANI_KESENLER kumesini kaynaktan okur. */
  const istemciKumesi = () => {
    const m = appSrc.match(/EKRANI_KESENLER = new Set\(\[([^\]]*)\]\)/);
    assert.ok(m, 'app.jsx icinde EKRANI_KESENLER kumesi bulunamadi');
    return [...new Set(
      [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]),
    )].sort();
  };

  test('istemci kümesi yalnızca atama ve bahsetme', () => {
    assert.deepEqual(
      istemciKumesi(), KESENLER,
      'Ekranı kesen türler değişmiş. Karar (kart #121) atama ve bahsetme ile '
      + 'sınırlıydı; liste büyürse toast değersizleşir, küçülürse kullanıcı '
      + 'kendisine verilen işi kaçırır. Değişecekse kart yorumu da güncellenmeli.',
    );
  });

  test('e-posta varsayılanı istemci kümesiyle aynı', async () => {
    const { emailableTypes } = await import('../src/lib/mailer.js');
    // Varsayilani olcuyoruz; ortam degiskeni operasyon tercihi ve bilinerek
    // degistirilebilir (NOTIFY_EMAIL_TYPES). Olculen sey VARSAYILANIN
    // istemciyle ayrismamasi.
    const onceki = process.env.NOTIFY_EMAIL_TYPES;
    delete process.env.NOTIFY_EMAIL_TYPES;
    try {
      assert.deepEqual(
        [...emailableTypes()].sort(), KESENLER,
        'E-posta varsayılanı ekranı kesen kümeden ayrışmış. Postalanan şey '
        + 'kesen şeyle aynı olmalı; aksi hâlde e-posta kutusu gürültüye '
        + 'boğulur ve hepsi birden okunmaz olur.',
      );
    } finally {
      if (onceki === undefined) delete process.env.NOTIFY_EMAIL_TYPES;
      else process.env.NOTIFY_EMAIL_TYPES = onceki;
    }
  });

  test('ses ve toast AYNI kapıdan geçiyor — ding kapısız olamaz', () => {
    // Asil kusur buydu: `_playDing()` kosulsuz cagriliyordu.
    //
    // KAPSAM DAR VE BILINCLI: yalnizca BILDIRIM isleyicisi
    // (`sock.on('notification')`) olculuyor. Sohbet isleyicisinin kendi
    // ding'i var ve o bu kuralin DISINDA -- sohbetin ayri tercihleri
    // (notifyMessages, notifyDMs, notifyGroupChat) ve ayri anlami var:
    // bir DM "biri su an seninle konusuyor" demek, kesmesi dogru.
    //
    // Testin ilk yazimi `indexOf('_playDing()')` kullaniyordu ve ISLEV
    // TANIMINI buluyordu (`function _playDing() {`) -- yani yanlis yere
    // bakip kirmisti. Uc esleme var: tanim, bildirim cagrisi, sohbet
    // cagrisi. Sinir bu yuzden isleyicinin kendisi.
    const bas = appSrc.indexOf("sock.on('notification'");
    assert.ok(bas > 0, "bildirim soket isleyicisi bulunamadi");
    const son = appSrc.indexOf("sock.on('chat_message'", bas);
    assert.ok(son > bas, 'sohbet isleyicisi bulunamadi — sinir belirlenemedi');
    const isleyici = appSrc.slice(bas, son);

    const cagrilar = [...isleyici.matchAll(/^.*_playDing\(\).*$/gm)]
      .map((m) => m[0])
      .filter((satir) => !/function\s+_playDing/.test(satir));

    assert.ok(
      cagrilar.length > 0,
      'Bildirim işleyicisinde hiç ding çağrısı yok. Ses tümden kaldırıldıysa '
      + 'bu test de güncellenmeli; sessizce kaybolmasın.',
    );
    for (const satir of cagrilar) {
      assert.match(
        satir, /kesiyor/,
        'Ding çağrısı kesme kararını okumuyor: `' + satir.trim() + '`\n  '
        + 'Ses, toast ile AYNI kümeden beslenmeli. Kapısız ding, ekranda '
        + 'hiçbir şey görünmezken ses çıkması demek — kullanıcı sesin nereden '
        + 'geldiğini bulamaz (kart #121).',
      );
    }
  });

  test('sessiz türler gerçekten kümenin dışında', () => {
    // Kararin negatif tarafi da olculuyor. Yalnizca "iki tane var mi" demek,
    // uctan birinin geri eklenmesini yakalamazdi.
    const kume = istemciKumesi();
    for (const sessiz of ['comment_added', 'join_request', 'channel_added', 'column_added']) {
      assert.ok(
        !kume.includes(sessiz),
        `"${sessiz}" ekranı kesenler arasına geri eklenmiş. Karar (kart #121) `
        + 'onu sessiz bıraktı: panelde birikiyor, zilde sayılıyor, ekranı kesmiyor.',
      );
    }
  });
});

// ── "Tumunu oku" NULL satirlari da kapsamali (kart #193 kok sebep) ────────
//
// KUSUR, 17 Eylul 2026'da kullanicinin masaustu dogrulama turunda yakalandi.
// Belirti: "tumunu oku"ya basiliyor, noktalar kayboluyor, sonra geri geliyor.
// F5 ve HARD REFRESH de cozmuyor -- yani sorun istemci onbelleginde degil,
// veri gercekten okunmamis kaliyor.
//
// KOK SEBEP semada: `read Boolean?` NULL olabilir ve `createAndPush` alani
// hic yazmiyordu, yani her bildirim `read = NULL` doguyordu. Toplu okuma
// sorgusu `where: { read: false }` diyordu ve SQL'de `read = false`,
// `read IS NULL` satirlarini ESLESTIRMEZ. Sorgu hatasiz kosuyor, SIFIR satir
// guncelliyor, uc `ok` donuyordu.
//
// KUSURU GIZLEYEN SEY: tekil okuma CALISIYORDU. `/:notifId/read` kimlige
// gidiyor ve `read`in degerine bakmiyor. Yani "bildirime tikla" calisiyor,
// "tumunu oku" calismiyordu -- ve ikisi ayni ekranda oldugu icin kusur
// "bazen calisiyor" gibi gorunuyordu.
//
// Bu test ucuncu bir dusus olmasin diye UC seyi birden kilitliyor.
describe('Tümünü oku — NULL kapsanıyor (kart #193)', () => {
  const rotaSrc = yorumsuzDosya(path.join(SRC, 'routes', 'notifications.js'));
  const libSrc = yorumsuzDosya(path.join(SRC, 'lib', 'notifications.js'));

  /** Bir uc govdesini secicisinden ilk `});` kapanisina kadar alir. */
  const ucGovdesi = (isaret) => {
    const i = rotaSrc.indexOf(isaret);
    assert.ok(i > 0, `${isaret} ucu bulunamadı`);
    const son = rotaSrc.indexOf('\n);', i);
    return rotaSrc.slice(i, son > i ? son : i + 1200);
  };

  test('toplu okuma read süzgeci kullanmıyor', () => {
    const govde = ucGovdesi("'/read-all'");
    assert.ok(
      govde.includes('updateMany'),
      'toplu okuma updateMany kullanmıyor; test güncellenmeli',
    );
    // Asil olcut: `read: false` (ya da `read: null`) SUZGEC olarak
    // kullanilmamali. Veri uc degerli oldugu icin hangi degeri sectiginiz
    // fark etmez -- otekini kacirirsiniz.
    const suzgec = govde.slice(0, govde.indexOf('data:'));
    assert.doesNotMatch(
      suzgec, /read:\s*(false|null)/,
      '"Tümünü oku" yeniden `read` süzgeci kullanıyor. Alan NULL olabildiği '
      + 'için bu süzgeç satırların bir kısmını SESSİZCE atlar: sorgu hatasız '
      + 'koşar, sıfır satır günceller, uç ok döner. Kartın kök sebebi tam '
      + 'buydu (#193).',
    );
  });

  test('toplu okuma kaç satır güncellediğini söylüyor', () => {
    // Kusur dort gun fark edilmedi cunku uc her zaman ayni `{ ok: true }`
    // donuyordu: "hepsini okudum" ile "hicbirini okuyamadim" ayirt edilemezdi.
    const govde = ucGovdesi("'/read-all'");
    assert.match(
      govde, /updated/,
      'Toplu okuma güncellenen satır sayısını döndürmüyor; işlem yine '
      + 'gözlemlenemez olur ve "hiçbiri" ile "hepsi" aynı cevabı verir.',
    );
  });

  test('yeni bildirim read: false ile doğuyor, NULL değil', () => {
    // Okuma ucu artik suzgec kullanmadigi icin bu satir olmadan da calisir.
    // Yine de sart: veri NULL ile false arasinda bolunmus kalirsa ileride
    // `read: false` yazan BASKA bir sorgu ayni tuzaga duser.
    assert.match(
      libSrc, /read:\s*false/,
      'createAndPush `read` alanını yazmıyor; şemada varsayılan yok, yani '
      + 'bildirimler NULL doğar ve `read` üzerinden süzen her sorgu onları '
      + 'sessizce atlar (kart #193).',
    );
  });
});
