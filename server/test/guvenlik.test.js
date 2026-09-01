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

import { csvCell, toCsv, CSV_BOM } from '../src/lib/csv.js';
import {
  ALL_PERMISSIONS,
  memberPermissions,
  hasPermission,
  hasAnyPermission,
} from '../src/lib/permissions.js';
import { renderNotification } from '../src/lib/mailer.js';

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

  test('satırlar CRLF ile ayrılır ve ayraç noktalı virgül', () => {
    const out = toCsv(['a', 'b'], [['1', '2']]);
    assert.equal(out, `${CSV_BOM}a;b\r\n1;2`);
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
    const src = fs.readFileSync(settingsPath, 'utf8');

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
