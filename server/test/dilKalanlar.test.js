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

// Türkçe harfsiz Türkçe metin (#255 aile, #268): bu dosyada ayrı bir tarayıcı
// vardı; dil.test.js'in meşru kalıplarını (yedek, sözlük bloğu, kardeş alan)
// bilmediği için genişletilince gürültü çıkardı. Ölçüt artık dil.test.js'teki
// tek tarayıcıda: TURKCE, harfin yanında Türkçe sözcükleri de sayıyor.

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
