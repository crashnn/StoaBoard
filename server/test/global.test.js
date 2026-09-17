// İstemci global testi — okunan ama hiç atanmayan `window.*` var mı?
//
// Neden var: 1 Eylül 2026'da bekleme lobisi `window.io` okuyordu. O global
// yalnızca Vite öncesi CDN kurulumunda vardı; modül importuna geçildikten
// sonra hep undefined kaldı. Kod `if (!window.io) return;` diyerek sessizce
// çıkıyordu, yani davet kodunu giren kullanıcıya onay hiç ulaşmıyordu ve lobi
// sonsuza kadar bekliyordu. Canlı bir müşteri toplantısında ortaya çıktı.
//
// Aynı taramayı elle yaptığımızda iki kusur daha çıktı:
//   window.showToast        — bütün bildirimler sessizce yutuluyordu
//   window._parseServerDate — sohbette saat ve gün ayracı bozuluyordu
//
// Üçü de aynı kök sebep: Vite geçişinde globaller modül export'una döndü,
// çağrı yerleri güncellenmedi, ve `?.` ile erken `return` hatayı yuttu.
//
// Bu test o sınıfı kapatır: deneyimle bulunan bir kusuru, bir daha
// deneyim gerektirmeyecek bir kurala çevirir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yorumsuzKaynak } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', '..', 'client', 'src');

/**
 * Atanması beklenmeyen globaller.
 *   - Tarayıcının kendi API'leri
 *   - Üçüncü taraf betiklerin sağladıkları (Google Sign-In)
 *   - Sunucunun sayfaya gömdüğü, yokluğu tolere edilen değerler
 * Buraya ekleme yaparken sebebini yaz.
 */
const BEKLENEN_DISARIDAN = new Set([
  // tarayıcı
  'location', 'navigator', 'document', 'history', 'localStorage', 'sessionStorage',
  'innerWidth', 'innerHeight', 'scrollX', 'scrollY', 'pageYOffset', 'visualViewport',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'CustomEvent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'getComputedStyle', 'matchMedia', 'scrollTo', 'open', 'print', 'focus',
  'alert', 'confirm', 'prompt', 'crypto', 'Notification', 'top', 'self', 'parent',
  'AudioContext', 'webkitAudioContext', 'URL', 'Blob', 'FormData', 'fetch',
  'getSelection',     // blok düzenleyici imleç konumu (drawer.jsx, 15 Eylül); tarayıcı yerleşiği
  // üçüncü taraf
  'google',            // Google Sign-In betiği (index.html)
  // sunucudan gömülen, opsiyonel
  '__TWEAKS__',        // yoksa {} varsayılıyor — bilinçli
]);

function kaynakDosyalari(dir) {
  const out = [];
  for (const ad of fs.readdirSync(dir)) {
    const tam = path.join(dir, ad);
    const st = fs.statSync(tam);
    if (st.isDirectory()) out.push(...kaynakDosyalari(tam));
    else if (/\.(jsx?|tsx?)$/.test(ad)) out.push(tam);
  }
  return out;
}

test('okunan her window.* globali bir yerde atanmış olmalı', () => {
  const dosyalar = kaynakDosyalari(SRC);
  assert.ok(dosyalar.length > 0, 'istemci kaynak dosyası bulunamadı');

  const tumKaynak = dosyalar
    .map((f) => yorumsuzKaynak(fs.readFileSync(f, 'utf8')))
    .join('\n');

  const okunanlar = new Set(
    [...tumKaynak.matchAll(/window\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  );

  const atanmayanlar = [];
  for (const ad of okunanlar) {
    if (BEKLENEN_DISARIDAN.has(ad)) continue;
    const atamaVar = new RegExp(`window\\.${ad}\\s*=[^=]`).test(tumKaynak);
    if (!atamaVar) atanmayanlar.push(ad);
  }

  assert.deepEqual(
    atanmayanlar.sort(), [],
    'Bu globaller okunuyor ama hiçbir yerde atanmıyor. Ya modülden içe aktarın, ' +
    'ya window\'a bağlayın, ya da gerçekten dışarıdan geliyorsa ' +
    'BEKLENEN_DISARIDAN listesine sebebiyle ekleyin. Sessizce undefined kalan ' +
    'bir global, kodun o dalını hiç çalışmadan atlatır.',
  );
});

// ── Adres çubuğu, ekranı açan bayrağın kendisine bakmalı (kart #192) ───────
//
// Yukarıdaki taramanın kardeşi ve aynı kök sebep: OKUNAN AMA HİÇ ATANMAYAN
// bir değer. Orada `window.io`, burada `view === 'auth'`.
//
// KUSUR (17 Eylül 2026, mobil saha turu): giriş ekranında dili değiştiren
// kullanıcı vitrine düşüyordu. `app.jsx`teki adres etkisi `view === 'auth'`
// diye bir dal taşıyordu ama `setView('auth')` hiçbir yerde çağrılmıyor —
// giriş ekranını `authed` bayrağı açıyor. Dal ölü olduğu için giriş
// ekranındaki kullanıcı `else` dalına düşüyor ve adresi `/giris` iken
// sessizce `/` yapılıyordu.
//
// Tek başına görünmez: pushState sayfayı yeniden yüklemiyor. Ama
// `views/auth.jsx` dil değişiminde `location.reload()` çağırıyor ve o an
// yüklenen adres artık `/`. Oturum yokken `/` vitrini veriyor. İki ayrı doğru
// kod parçası, aradaki yanlış varsayım yüzünden kullanıcıyı akıştan atıyordu.
test('giriş ekranının adresi `authed` ile belirleniyor, ölü bir `view` değeriyle değil', () => {
  const kaynak = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'app.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  // 1. `'auth'` hâlâ hiçbir yere ATANMIYOR mu? Atanır hâle gelirse aşağıdaki
  //    yasak anlamsızlaşır ve bu test yanlış bir şeyi korumaya devam eder.
  const ataniyor = /setView\(\s*['"]auth['"]\s*\)/.test(kaynak);

  // 2. Atanmıyorsa, karşılaştırılıyor da olmamalı.
  const karsilastiriliyor = /view\s*===\s*['"]auth['"]/.test(kaynak);

  assert.ok(
    !karsilastiriliyor || ataniyor,
    "app.jsx `view === 'auth'` karşılaştırması yapıyor ama `setView('auth')` "
    + 'hiçbir yerde çağrılmıyor: dal ÖLÜ ve giriş ekranındaki kullanıcı yanlış '
    + "dala düşüyor. Ölçüt `authed` olmalı — ekranı açan bayrağın kendisi "
    + '(kart #192).',
  );

  // 3. Adres etkisi kimlik BİLİNMEDEN yazmamalı. Önyükleme sürerken `authed`
  //    false; o aralıkta adres yazılırsa giriş YAPMIŞ kullanıcı da bir an
  //    `/giris`e itilir ve geri tuşu onu giriş ekranına atar.
  const i = kaynak.indexOf("window.history.pushState({}, '', `/giris");
  assert.ok(i > 0, 'giriş adresini yazan pushState bulunamadı');
  const etkiBasi = kaynak.lastIndexOf('useEf(() => {', i);
  assert.ok(etkiBasi > 0, 'adres etkisinin başı bulunamadı');
  const etki = kaynak.slice(etkiBasi, i);
  assert.match(
    etki, /if \(loading\) return;/,
    'Adres etkisi `loading` kapısı taşımıyor: kimlik bilinmeden adres '
    + 'yazılıyor ve giriş yapmış kullanıcı bir an /giris\'e itiliyor.',
  );

  // 4. Bağımlılık listesi üç değeri de taşımalı; biri düşerse etki bayat bir
  //    değerle koşar ve kusur sessizce geri gelir.
  // Liste ayrıştırılıp KÜME olarak karşılaştırılıyor; düzenli ifade değil.
  // İlk yazımında `new RegExp('\\b' + ad + '\\b')` kullanılıyordu ve şablon
  // dizesindeki `\b` JavaScript'te SINIR değil BACKSPACE karakteridir — desen
  // hiçbir şeye eşleşmiyordu. Kaçışa güvenmeyen bu yazımda o tuzak yok.
  const son = kaynak.indexOf('}, [', i);
  const liste = kaynak.slice(son + 4, kaynak.indexOf(']', son));
  const bagimliliklar = new Set(liste.split(',').map(s => s.trim()));
  for (const ad of ['view', 'authed', 'loading']) {
    assert.ok(
      bagimliliklar.has(ad),
      `Adres etkisinin bağımlılık listesinde ${ad} yok (bulunan: ${[...bagimliliklar].join(', ')}). `
      + 'Biri düşerse etki bayat bir değerle koşar ve kusur sessizce geri gelir.',
    );
  }
});

// ── Canlı tercih, tohum global'inden okunmamalı ────────────────────────────
//
// Kart numarası özelliği (17 Eylül 2026) `tweaks.showCardIds`i çekmeceye PROP
// olarak taşıyor. Cazip kısayol `window.__TWEAKS__` okumaktı; çekmece zaten
// başka globaller okuyor (DATA.COLUMNS, window.t) ve bir prop zinciri
// eklemekten ucuz görünüyor.
//
// Ama `__TWEAKS__` ötekilerden farklı: o sunucunun sayfaya gömdüğü BAŞLANGIÇ
// TOHUMU. Canlı değer React durumunda ve `setTweak` yalnızca onu güncelliyor.
// Global'den okunsaydı kullanıcı anahtarı açtığında çekmece ESKİ değeri
// göstermeye devam ederdi: ayar "açık", ekran "kapalı". Sessiz tutarsızlık --
// istisna yok, hata yok, yalnızca yanlış ekran.
//
// Bu testin ölçtüğü şey bir stil tercihi değil: tohum ile canlı durumun
// karıştırılması, bu depoda `window.io` ve rozet sayacı kusurlarının aynı
// ailesinden.
test('çekmece tweaks değerini prop olarak alıyor, tohum global\'inden değil', () => {
  const drawer = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'drawer.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  assert.doesNotMatch(
    drawer, /window\.__TWEAKS__/,
    'drawer.jsx `window.__TWEAKS__` okuyor. O değer sunucunun gömdüğü BAŞLANGIÇ '
    + 'tohumu, canlı tercih değil: `setTweak` onu güncellemiyor. Okunursa ayar '
    + 'değiştiğinde çekmece eski değeri gösterir. `tweaks` prop olarak geçilmeli.',
  );

  // Prop gerçekten alınıyor mu? Yoksa yukarıdaki yasak, hiç kullanılmayan bir
  // özelliği "koruyor" olurdu.
  assert.match(
    drawer, /function TaskDrawer\([^)]*tweaks/,
    'TaskDrawer `tweaks` prop\'unu almıyor; kart numarası hiçbir zaman görünmez.',
  );

  // Her iki çağrı yeri de geçirmeli. Biri unutulursa özellik "bazen çalışan"
  // bir şeye dönüşür: çekmecede görünür, tam ekran kartta görünmez.
  const app = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'app.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );
  // Sayım her çağrının KENDİ bloğu içinde yapılıyor. İlk yazımında
  // `tweaks={tweaks}` dosyanın tamamında sayılıyordu ve 7 çıkıyordu: başka
  // bileşenler (SettingsView, TweaksPanel…) de aynı prop'u alıyor. Yani
  // ölçüt, ölçmek istediği şeyden bağımsız bir sayıya bakıyordu ve iki
  // çağrıdan biri tweaks'siz olsa bile yeşil kalabilirdi.
  const eksik = [];
  let ara = 0;
  for (;;) {
    const bas = app.indexOf('<TaskDrawer', ara);
    if (bas < 0) break;
    const son = app.indexOf('/>', bas);
    assert.ok(son > bas, 'TaskDrawer çağrısının sonu bulunamadı');
    const blok = app.slice(bas, son);
    if (!/tweaks=\{tweaks\}/.test(blok)) {
      eksik.push(`satır ${app.slice(0, bas).split('\n').length}`);
    }
    ara = son;
  }
  assert.ok(ara > 0, 'app.jsx içinde TaskDrawer çağrısı bulunamadı');
  assert.deepEqual(
    eksik, [],
    `Şu TaskDrawer çağrılarına tweaks geçilmiyor: ${eksik.join(', ')}. `
    + 'Eksik olan çağrıda kart numarası hiç görünmez — özellik "bazen çalışan" '
    + 'bir şeye döner.',
  );
});
