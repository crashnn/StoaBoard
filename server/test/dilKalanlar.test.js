// İngilizce arayüzde Türkçe kalan metinler — kart #208 ve #255.
//
// Ortak aile: dil taraması (dil.test.js) bir metni ancak Türkçe HARF
// taşıyorsa Türkçe sayıyor. "sen@example.com", "Dosya" gibi ASCII Türkçe
// metinler ve kodda hiç durmayan metinler (Google'ın çizdiği düğme, veritabanı
// tohumu) taramanın dışında kalıyordu.
//
// #208: üç varsayılan rol yalnızca Türkçe tohumlanıyor (Yönetici / Düzenleyici
//       / Görüntüleyici). Şema değişmedi: tohum adıyla DOKUNULMAMIŞ roller
//       gösterilirken çevriliyor (client/src/rolAdi.js).
// #255: giriş ekranında Google düğmesi tarayıcının dilinde ("Google ile devam
//       edin"), e-posta yer tutucusu sabit "sen@example.com".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rolAdi, VARSAYILAN_ROLLER } from '../../client/src/rolAdi.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');
const ISTEMCI = path.join(KOK, 'client', 'src');
const oku = (...p) => yorumsuzDosya(path.join(...p));

describe('varsayılan rol adları gösterilirken çevriliyor (#208)', () => {
  const en = { role_default_admin: 'Admin', role_default_editor: 'Editor', role_default_viewer: 'Viewer' };
  // Gerçek window.t gibi: bulamadığı anahtarın KENDİSİNİ döndürür (app.jsx).
  // İlk sürümde undefined döndürüyordu ve `in` mutantı yaşadı — prototipten
  // gelen fonksiyon, gerçek t'de ekrana "rol adı" diye basılırdı.
  const ceviri = (k) => en[k] || k;

  test('tohum adı çevriliyor, kullanıcının verdiği ad aynen kalıyor', () => {
    assert.equal(rolAdi('Yönetici', ceviri), 'Admin');
    assert.equal(rolAdi('Düzenleyici', ceviri), 'Editor');
    assert.equal(rolAdi('Görüntüleyici', ceviri), 'Viewer');
    assert.equal(rolAdi('Geliştirici', ceviri), 'Geliştirici', 'kullanıcının rol adı çevrildi');
    assert.equal(rolAdi('toString', ceviri), 'toString', 'prototipten eşleşme');
    assert.equal(rolAdi('Yönetici', () => undefined), 'Yönetici', 'çeviri yoksa ad kayboldu');
    assert.equal(typeof rolAdi('constructor', ceviri), 'string', 'prototip adı fonksiyona çözüldü');
    assert.equal(rolAdi(undefined, ceviri), undefined);
  });

  test('sunucunun tohumladığı adlar tabloyla birebir aynı', () => {
    // Tohum değişir de tablo değişmezse çeviri sessizce durur.
    const ws = oku(KOK, 'server', 'src', 'routes', 'workspaces.js');
    const tohum = [...ws.matchAll(/^\s*\['([^']+)', 'oklch\([^)]*\)', \[/gm)].map((m) => m[1]).sort();
    assert.ok(tohum.length >= 3, `tohum rolleri okunamadı (${tohum.length})`);
    assert.deepEqual(tohum, Object.keys(VARSAYILAN_ROLLER).sort());
  });

  test('çeviri anahtarları iki dilde de var', () => {
    const data = oku(ISTEMCI, 'data.jsx');
    for (const anahtar of Object.values(VARSAYILAN_ROLLER)) {
      assert.equal((data.match(new RegExp(`\\b${anahtar}:'`, 'g')) || []).length, 2, `${anahtar} tr+en değil`);
    }
  });

  test('rol adı gösterilen her yer çeviriden geçiyor', () => {
    const chat = oku(ISTEMCI, 'chat.jsx');
    assert.match(chat, /\{rolAdi\(m\.role_name \|\| m\.role, window\.t\)\}/, 'sohbet üye listesi çevirmiyor');
    const ayar = oku(ISTEMCI, 'views', 'settings.jsx');
    assert.match(ayar, /<span style=\{\{ flex: 1 \}\}>\{rolAdi\(r\.name, window\.t\)\}<\/span>/, 'rol seçici çevirmiyor');
    assert.match(ayar, /<span className="rol-item-name">\{rolAdi\(r\.name, window\.t\)\}<\/span>/, 'rol listesi çevirmiyor');
    assert.match(ayar, /\(rolAdi\(m\.role_name, window\.t\) \|\|/, 'üye listesi çevirmiyor');
    assert.doesNotMatch(ayar, />\{r\.name\}</, 'rol adı çevrilmeden basılan bir yer kaldı');
  });
});

describe('Türkçe harfsiz Türkçe metin çeviriden geçiyor (#255 aile)', () => {
  // dil.test.js metni ancak Türkçe HARF taşıyorsa görüyor. Aile taramasında
  // (18 Eylül) çıkanlar: title="Kapat" (5 yer), "Yeni Kanal", "Dosya ekle",
  // "Kaydet (Ctrl+S)", "Temizle", sekme adları "Genel/Direkt", 'Kanal
  // silinemedi', gizli <h1>Ayarlar, ve #210'da 'Dosya'. Sözcük listesi bu
  // taramanın sözcükleri; öznitelik değerinde ve JSX metninde yasak — anahtar +
  // yedek biçimi ({window.t?.('k') || 'Kapat'}) zaten bu kalıplara uymuyor.
  const SOZCUK = ['Dosya', 'Kapat', 'Kaydet', 'Sil', 'Ara', 'Gonder', 'Evet', 'Tamam', 'Geri', 'Yeni',
    'Ekle', 'Kanal', 'Mesaj', 'Yorum', 'Etiket', 'Tarih', 'Proje', 'Liste', 'Tablo', 'Takvim', 'Notlar',
    'Ayarlar', 'Profil', 'Genel', 'Direkt', 'Devam', 'Kart', 'Bildirim', 'Sohbet', 'Pano', 'Temizle',
    'Yenile', 'Kopyala', 'Taslak', 'Gizle', 'Goster'];
  const S = SOZCUK.join('|');
  const OZNITELIK = new RegExp(`\\b(?:title|placeholder|aria-label)="([^"]*\\b(?:${S})\\b[^"]*)"`, 'g');
  const JSX_METIN = new RegExp(`>\\s*([^<>{}]*\\b(?:${S})\\b[^<>{}]*?)\\s*<`, 'g');
  const MUAF = new Set(['legal.jsx']); // hukuki metin — dil kuralından bilinçli muaf (CLAUDE.md)

  test('tarama kör değil', () => {
    assert.ok(OZNITELIK.test('<button title="Kapat">'));
    OZNITELIK.lastIndex = 0;
    assert.ok(JSX_METIN.test('<div>Yeni Kanal</div>'));
    JSX_METIN.lastIndex = 0;
  });

  test('istemcide çevrilmemiş Türkçe öznitelik ya da JSX metni yok', async () => {
    const { kaynakDosyalari } = await import('./yardimcilar.js');
    const bulgular = [];
    for (const d of kaynakDosyalari(ISTEMCI, /\.jsx$/)) {
      const ad = path.basename(d);
      if (MUAF.has(ad)) continue;
      const src = yorumsuzDosya(d);
      for (const re of [OZNITELIK, JSX_METIN]) {
        for (const m of src.matchAll(re)) {
          bulgular.push(`${path.relative(ISTEMCI, d)}:${src.slice(0, m.index).split('\n').length}  ${m[1].trim().slice(0, 50)}`);
        }
      }
    }
    assert.deepEqual(bulgular, [], `çevrilmemiş Türkçe metin:\n${bulgular.join('\n')}`);
  });
});

describe('giriş ekranı sayfanın dilinde (#255)', () => {
  const auth = oku(ISTEMCI, 'views', 'auth.jsx');

  test('Google düğmesi sayfanın dilini alıyor', () => {
    const i = auth.indexOf('renderButton(');
    const govde = auth.slice(i, auth.indexOf('});', i));
    assert.match(govde, /locale: lang,/, 'Google düğmesi tarayıcının dilinde çiziliyor');
  });

  test('e-posta yer tutucusu sözlükten, beş dilde', () => {
    assert.doesNotMatch(auth, /placeholder="sen@example\.com"/, 'sabit Türkçe yer tutucu duruyor');
    assert.equal((auth.match(/placeholder=\{t\('ph_email'\)\}/g) || []).length, 2, 'iki e-posta alanı da sözlükten okumuyor');
    const degerler = [...auth.matchAll(/ph_email: '([^']+)'/g)].map((m) => m[1]);
    assert.equal(degerler.length, 5, `ph_email ${degerler.length} dilde — tr/en/de/es/ru bekleniyor`);
    assert.equal(new Set(degerler).size, 5, 'bir dil ötekinin metnini kopyalamış');
  });
});
