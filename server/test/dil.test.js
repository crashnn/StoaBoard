// Dil kapsamı — her yeni özellik Türkçe ve İngilizce ile birlikte gelmeli.
//
// Kusur (3 Eylül 2026): Raporlar ve süre kaydı ekranları tamamen hardcode
// Türkçe yazılmıştı. Dil İngilizce seçilince gezinme İngilizce oluyor ama
// ekran gövdesi Türkçe kalıyordu. Kimse fark etmedi çünkü hiçbir şey
// bozulmuyordu — sadece yanlış dilde duruyordu.
//
// Bu, GUVENLIK.md'deki "sessiz başarısızlık" ailesinden: kontrol yok, hata
// yok, yalnızca sessizce yanlış sonuç. O yüzden belgeye kural yazmak yetmez,
// testle kilitlenmesi gerekir.
//
// İki şeyi koruyoruz:
//   1. tr ve en sözlükleri birebir aynı anahtar kümesine sahip olmalı.
//      Eksik anahtar sessizce Türkçe'ye düşer (window.t'nin fallback'i), yani
//      İngilizce arayüzde Türkçe metin çıkar.
//   2. Görünüm dosyalarında JSX metni olarak çıplak Türkçe kalmamalı.
//      Çeviri yedekleri T('anahtar', 'Türkçe') içinde yaşar; etiket arasında
//      doğrudan yazılmış Türkçe, çevrilmemiş metin demektir.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

const dataSrc = fs.readFileSync(path.join(CLIENT, 'data.jsx'), 'utf8');

/** APP_I18N içindeki bir dil bloğunun anahtarlarını çıkarır. */
function sozlukAnahtarlari(lang) {
  const satirlar = dataSrc.split('\n');
  const bas = satirlar.findIndex((l) => new RegExp(`^  ${lang}: \\{`).test(l));
  assert.ok(bas >= 0, `APP_I18N içinde '${lang}' bloğu bulunamadı`);
  // Blok, girintisi iki boşluk olan ilk '},' satırında biter.
  let son = bas + 1;
  while (son < satirlar.length && !/^ {2}\},/.test(satirlar[son])) son += 1;
  // Satır satır işliyoruz, çünkü iki tuzak var:
  //   1. Yorum satırlarında Türkçe kesme işareti geçiyor ("3 Eylül'e"). Tek
  //      tırnak, string sökücüyü yanıltıp araya giren gerçek anahtarları yutar.
  //      Bu yüzden yorum satırları önce tamamen atılıyor.
  //   2. Bir satırda birden fazla anahtar olabiliyor (`a:'x', b:'y',`) ve
  //      değerlerin içinde iki nokta geçebiliyor; değerler silinmezse ya ikinci
  //      anahtar kaçar ya da metnin içinden hayalet anahtar üretilir.
  const anahtarlar = new Set();
  // bas+1: blok başlığının kendisi ("tr: {") anahtar sayılmasın.
  for (const satir of satirlar.slice(bas + 1, son)) {
    if (satir.trim().startsWith('//')) continue;
    // Hem tek hem çift tırnak: içinde kesme işareti geçen Türkçe değerler
    // ("DM'ler her zaman gelir") çift tırnakla yazılmış. Yalnızca tek tırnağı
    // sökmek, değerin içindeki kesme işaretinin sahte string başlatıp sonraki
    // anahtarı yutmasına yol açıyordu.
    const temiz = satir.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
    for (const m of temiz.matchAll(/\b([a-z][a-z0-9_]*)\s*:/g)) anahtarlar.add(m[1]);
  }
  return anahtarlar;
}

describe('dil sözlüğü — tr ve en aynı anahtarları taşımalı', () => {
  test('en sözlüğünde eksik anahtar yok', () => {
    const tr = sozlukAnahtarlari('tr');
    const en = sozlukAnahtarlari('en');
    const eksik = [...tr].filter((k) => !en.has(k));
    assert.deepEqual(
      eksik, [],
      'Bu anahtarlar tr\'de var, en\'de yok. İngilizce arayüzde Türkçe metin görünür.',
    );
  });

  test('tr sözlüğünde eksik anahtar yok', () => {
    const tr = sozlukAnahtarlari('tr');
    const en = sozlukAnahtarlari('en');
    const eksik = [...en].filter((k) => !tr.has(k));
    assert.deepEqual(
      eksik, [],
      'Bu anahtarlar en\'de var, tr\'de yok. Türkçe arayüzde anahtarın kendisi görünür.',
    );
  });

  test('sözlük boş değil', () => {
    // Ayrıştırıcı bozulursa iki küme de boş çıkar ve üstteki iki test sessizce
    // geçerdi. Bu testin tek işi bunu engellemek.
    assert.ok(sozlukAnahtarlari('tr').size > 500, 'tr sözlüğü beklenenden küçük');
    assert.ok(sozlukAnahtarlari('en').size > 500, 'en sözlüğü beklenenden küçük');
  });
});

// ─── Çıplak Türkçe metin taraması ──────────────────────────────────────────

// Bilinçli istisnalar:
//   legal.jsx  — gizlilik ve hizmet şartları metni yalnızca Türkçe yayımlandı;
//                hukuki metnin çevirisi ürün kararı, çeviri boşluğu değil.
//   auth.jsx   — giriş ekranındaki dekoratif Stoa çizimi SVG <text> etiketleri
//                taşıyor ("Arşitrav", "KESİT A-A"); bunlar illüstrasyonun
//                parçası, arayüz metni değil.
//   data.jsx   — APP_I18N sözlüğünün kendisi; Türkçe olması zaten amaç.
const ISTISNA = new Set(['legal.jsx', 'auth.jsx', 'data.jsx']);

const TURKCE = /[çğıöşüÇĞİÖŞÜ]/;

function jsxDosyalari(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return jsxDosyalari(p);
    return e.isFile() && e.name.endsWith('.jsx') ? [p] : [];
  });
}

describe('görünüm dosyaları — çıplak Türkçe metin kalmamalı', () => {
  test('JSX etiketleri arasında çevrilmemiş Türkçe yok', () => {
    const bulgular = [];
    for (const dosya of jsxDosyalari(CLIENT)) {
      const ad = path.basename(dosya);
      if (ISTISNA.has(ad)) continue;
      const satirlar = fs.readFileSync(dosya, 'utf8').split('\n');
      satirlar.forEach((satir, i) => {
        const kirpik = satir.trim();
        if (kirpik.startsWith('//') || kirpik.startsWith('*') || kirpik.startsWith('/*')) return;
        // >metin< — süslü parantez ve etiket içermeyen, yani doğrudan yazılmış
        // metin. T('anahtar', 'yedek') biçimindeki yedekler {} içinde olduğu
        // için buraya düşmez.
        for (const m of satir.matchAll(/>([^<>{}]+)</g)) {
          if (TURKCE.test(m[1])) bulgular.push(`${ad}:${i + 1}  ${kirpik.slice(0, 90)}`);
        }
      });
    }
    assert.deepEqual(
      bulgular, [],
      'Çevrilmemiş Türkçe metin. T(\'anahtar\', \'Türkçe\') kullan ve anahtarı '
      + 'data.jsx içindeki hem tr hem en sözlüğüne ekle.',
    );
  });

  // Kullanıcının gördüğü metin yalnızca etiketler arasında olmuyor: title,
  // placeholder ve aria-label da okunuyor — sonuncusunu ekran okuyucu
  // kullananlar duyuyor. Bunlar JSX metni taramasına düşmediği için ayrı.
  test('title/placeholder/aria-label içinde çevrilmemiş Türkçe yok', () => {
    const bulgular = [];
    const attrRe = /\b(title|placeholder|aria-label|ariaLabel)=["']([^"']*)["']/g;
    for (const dosya of jsxDosyalari(CLIENT)) {
      const ad = path.basename(dosya);
      if (ISTISNA.has(ad)) continue;
      const satirlar = fs.readFileSync(dosya, 'utf8').split('\n');
      satirlar.forEach((satir, i) => {
        const kirpik = satir.trim();
        if (kirpik.startsWith('//') || kirpik.startsWith('*')) return;
        for (const m of satir.matchAll(attrRe)) {
          if (TURKCE.test(m[2])) bulgular.push(`${ad}:${i + 1}  ${m[1]}="${m[2]}"`);
        }
      });
    }
    assert.deepEqual(
      bulgular, [],
      'Öznitelik metni çevrilmemiş. Değeri {window.t?.(\'anahtar\') || \'Türkçe\'} '
      + 'biçimine çevir ve anahtarı iki sözlüğe de ekle.',
    );
  });
});

// ─── Sunucu hata mesajları ─────────────────────────────────────────────────
//
// Sunucudan dönen hata metni de kullanıcıya gösteriliyor; Raporlar ekranındaki
// "Başka kullanıcının raporunu görme yetkiniz yok" İngilizce arayüzde Türkçe
// çıkıyordu (3 Eylül). Sözleşme: { error: 'kod', message: 'Türkçe' }. İstemci
// kodu çevirir, sözlükte yoksa message'a düşer.
//
// KAPSAM: şimdilik yalnızca reports.js. Diğer route dosyalarında (~158 mesaj)
// aynı sınıf duruyor ve henüz koda çevrilmedi; oraları da düzeltince bu testin
// DOSYALAR listesi genişletilmeli.
const HATA_DOSYALARI = ['reports.js'];

describe('sunucu hata mesajları — koda bağlı ve çevrili olmalı', () => {
  test('error alanı düz Türkçe metin değil, kod taşıyor', () => {
    const bulgular = [];
    for (const ad of HATA_DOSYALARI) {
      const src = fs.readFileSync(
        path.resolve(__dirname, '..', 'src', 'routes', ad), 'utf8',
      );
      for (const m of src.matchAll(/\berror:\s*'([^']+)'/g)) {
        if (TURKCE.test(m[1]) || /\s/.test(m[1])) bulgular.push(`${ad}  error: '${m[1]}'`);
      }
    }
    assert.deepEqual(
      bulgular, [],
      'Hata metni doğrudan error alanına yazılmış. { error: \'err_kod\', '
      + 'message: \'Türkçe\' } biçimine çevir.',
    );
  });

  test('her hata kodunun iki sözlükte de karşılığı var', () => {
    const tr = sozlukAnahtarlari('tr');
    const en = sozlukAnahtarlari('en');
    const eksik = [];
    for (const ad of HATA_DOSYALARI) {
      const src = fs.readFileSync(
        path.resolve(__dirname, '..', 'src', 'routes', ad), 'utf8',
      );
      for (const m of src.matchAll(/\berror:\s*'(err_[a-z0-9_]+)'/g)) {
        if (!tr.has(m[1])) eksik.push(`${m[1]} (tr)`);
        if (!en.has(m[1])) eksik.push(`${m[1]} (en)`);
      }
    }
    assert.deepEqual(
      eksik, [],
      'Sunucu bu kodu döndürüyor ama sözlükte karşılığı yok; kullanıcı ham kodu '
      + 'ya da sunucunun Türkçe metnini görür.',
    );
  });
});
