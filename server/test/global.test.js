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

import { test, describe } from 'node:test';
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
  '__STOA_BUILD__',    // index.html'de atanıyor, sunucu değeri gömüyor (kart #201); yokluğu "ölçüt yok" — surum.test.js kilitliyor
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
  // Çapa yazılan ADRES, yazım yöntemi değil: #248'den beri hukuki sayfadan
  // gelinmediyse replaceState, gelindiyse pushState — ikisi tek satırda.
  const i = kaynak.indexOf('`/giris${window.location.search}`');
  assert.ok(i > 0, 'giriş adresini yazan satır bulunamadı');
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

// ── Cizelge dar ekranda gizlenir, ama VARLIGI gizlenmez (kart #195) ────────
//
// KARAR (17 Eylul 2026, kullanicinin mobil saha turundan): cizelge dar
// ekranda cizilmiyor, yerine sebebi yaziliyor. Kullanicinin ifadesi
// "cizelge kullanilmaz"di -- gorunum aciliyor ama hicbir bilgi vermiyordu.
//
// Bu testin korudugu UC sey ve her birinin ayri gerekcesi var:
//
// 1. Olcum `matchMedia` ile, yani JS tarafinda. CSS `display: none` cizelgeyi
//    gizler ama yine CIZER (yuzlerce kartin konumu hesaplanir, cope gider) ve
//    yerine aciklama konamaz -- kullanici bos alan gorur.
// 2. Esik SABIT BIR SAYI olarak degil, tek bir sabitten okunuyor. Iki yerde
//    ayri sayi, "dar ekran" tanimin iki cevabi olmasi demek.
// 3. Gorunum secicideki cizelge girisi DURUYOR. Gizlemek "boyle bir ozellik
//    yok" izlenimi verirdi; tiklayan kullanici ozelligin var oldugunu ve
//    nicin burada olmadigini ogreniyor. Bu, kararin kendisi kadar onemli ve
//    "temizlik" diye silinmesi en muhtemel parca.
test('çizelge dar ekranda gizleniyor ama görünüm seçicide duruyor (kart #195)', () => {
  const kaynak = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'views', 'board.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  // 1. Olcum JS tarafinda
  assert.match(
    kaynak, /matchMedia/,
    'Çizelgenin dar ekran ölçümü `matchMedia` ile yapılmıyor. CSS ile '
    + 'gizlemek çizelgeyi yine çizer ve yerine açıklama konamaz (kart #195).',
  );

  // 2. Esik tek bir sabitten
  const sabit = kaynak.match(/const CIZELGE_MIN_GENISLIK = (\d+)/);
  assert.ok(sabit, 'CIZELGE_MIN_GENISLIK sabiti bulunamadı — eşik elle yazılmış olabilir');
  const esik = Number(sabit[1]);
  assert.ok(
    esik >= 480 && esik <= 1024,
    `Eşik ${esik}px makul aralıkta değil (480-1024). Çok küçükse telefonda `
    + 'çizelge yine açılır, çok büyükse dizüstünde gereksiz gizlenir.',
  );

  // 2b. YON de sart (18 Eylul 2026, kullanici gercek cihazda: "yan ekran
  //     telefonda degisim olmuyor, ozellik kapali gibi"). #195'in notu ve
  //     ekrandaki mesaj "yatay cevirince acilir" diyordu; ama Galaxy S25 Edge
  //     YATAYDA da 768px altinda kaliyor, yani yalniz genislige bakan kural
  //     verdigi sozu tutamiyordu. Kusur DIKEY dar ekrandi.
  //
  //     Olcut sorgu sabitine VE kancanin onu kullandigina bagli: sabitte
  //     `orientation` olup kancanin baska bir sorgu kurmasi da kusuru geri
  //     getirir.
  const sorgu = kaynak.match(/const CIZELGE_GIZLI_SORGU = `([^`]*)`/);
  assert.ok(sorgu, 'CIZELGE_GIZLI_SORGU sabiti yok — sorgu elle kurulmuş olabilir');
  assert.match(sorgu[1], /orientation:\s*portrait/,
    'çizelge yalnızca genişliğe göre gizleniyor — yatay telefonda da kapalı kalır');
  assert.match(sorgu[1], /CIZELGE_MIN_GENISLIK/,
    'sorgu eşik sabitini okumuyor; dar ekranın iki ayrı tanımı olur');
  assert.match(kaynak, /function useDarEkran\(sorgu = CIZELGE_GIZLI_SORGU\)/,
    'kanca yön şartlı sorguyu kullanmıyor');

  // 3. Gorunum secicisinde cizelge girisi hala var
  assert.match(
    kaynak, /id: 'timeline'/,
    'Görünüm seçicisinden çizelge girişi kaldırılmış. Karar onu BIRAKMAKTI: '
    + 'gizlemek "böyle bir özellik yok" izlenimi verir (kart #195).',
  );

  // 4. Dar ekranda TimelineView yerine bir not geliyor; kosul gercekten
  //    dallaniyor mu? `darEkran` okunmadan yazilmis bir dal, kusurun sessizce
  //    geri gelmesi demek.
  const i = kaynak.indexOf("subView === 'timeline'");
  assert.ok(i > 0, 'çizelge dalı bulunamadı');
  const dal = kaynak.slice(i, i + 900);
  assert.match(dal, /darEkran/, 'çizelge dalı dar ekran ölçümünü okumuyor');
  assert.match(
    dal, /board_timeline_wide_only/,
    'Dar ekranda gösterilecek açıklama metni yok; kullanıcı yine boş bir '
    + 'alan görür.',
  );
});

// ── Komut paletinin yaydigi her eylemin bir karsiligi olmali ──────────────
//
// Bu dosyanin konusuyla ayni sinif: ORADA "okunan ama hic atanmayan" deger,
// BURADA "yayilan ama hic karsilanmayan" eylem. Ikisinin de belirtisi ayni --
// sessizlik. Karsiligi olmayan bir palet satiri tiklaniyor, palet kapaniyor,
// hicbir sey olmuyor; ne hata, ne istisna.
//
// KUSUR (17 Eylul 2026, "#193 ile arama" isi sirasinda gorulda): palet
// GOREVLERI HIC ARAMIYORDU -- yalnizca komutlar ve notlar. Oysa yer tutucu
// metni "Komut, GOREV veya sayfa ara..." diyordu. Vaat edilen yapilmiyordu ve
// arama "calisiyor" gorunuyordu, yalnizca sonuc vermiyordu.
//
// Bu yuzden test IKI yonu birden olcuyor: yer tutucu gorev vaat ediyorsa
// palet gorev ARAMALI, ve paletin urettigi her eylem app.jsx'te
// KARSILANMALI.
describe('Komut paleti — vaat, arama ve eylem karşılığı', () => {
  const palet = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'palette.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );
  const app = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'app.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );
  const veri = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'data.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  test('yer tutucu görev vaat ediyorsa palet görev arıyor', () => {
    // Olcut metnin kendisi degil VAADI: iki dilde de "görev"/"task" geciyorsa
    // aramanin gorev kaynagina bakmasi gerekiyor.
    const vaat = /palette_ph:'[^']*(görev|task)/i.test(veri);
    const ariyor = /__APP_TASKS__/.test(palet);
    assert.ok(
      !vaat || ariyor,
      'Arama kutusunun yer tutucusu görev aramayı VAAT EDİYOR ama palet '
      + 'görev kaynağına (`window.__APP_TASKS__`) hiç bakmıyor. Kullanıcı '
      + 'arıyor, sonuç çıkmıyor, hata da yok — sessiz kusur.',
    );
  });

  test('# ile numara araması var ve yalnızca kart döndürüyor', () => {
    assert.match(
      palet, /\^#/,
      "Palette `#` ile başlayan sorgu için bir dal yok; kart numarasıyla "
      + 'arama çalışmaz (kullanıcı isteği, 17 Eylül).',
    );
    // ID kipi komut/not gostermemeli: "#193" yazan komut aramiyor.
    // Dalin ERKEN DONMESI bunun mekanizmasi; return yoksa sonuclar
    // komutlarla karisir.
    const i = palet.indexOf('^#');
    const dal = palet.slice(i, i + 2200);
    assert.match(
      dal, /return sonuclar;/,
      'ID kipi erken dönmüyor; kart sonuçları komut ve notlarla karışır.',
    );
  });

  /** Kaynaktan `action: 'x'` ve `action: 'x' + y` biçimlerini toplar. */
  const eylemler = (src) => {
    const out = new Set();
    for (const m of src.matchAll(/action:\s*'([a-z:]+)'/g)) out.add(m[1]);
    // `action: 'open:task:' + t.id` gibi birlestirmeler -> onek olarak
    for (const m of src.matchAll(/action:\s*'([a-z:]+:)'\s*\+/g)) out.add(m[1]);
    return out;
  };


  test('paletin ve komut listesinin her eylemi karşılanıyor', () => {
    const tum = new Set([...eylemler(palet), ...eylemler(veri)]);
    assert.ok(tum.size >= 10, `yalnızca ${tum.size} eylem bulundu; tarama deseni bozulmuş olabilir`);

    // Karşılaştırma DÜZ METİNLE yapılıyor, düzenli ifadeyle değil. Eylem
    // adları yalnızca küçük harf ve iki nokta taşıyor, yani kaçışa gerek
    // yok — ve kaçışlı yazım bu oturumda ÜÇ kez ters tepti (şablon
    // dizesinde sınır sandığım kaçış backspace çıktı, iki kez de yazma
    // katmanı ters bölüyü yuttu). Kaçışa güvenmeyen yazımda o tuzağın
    // hiçbir biçimi yok.
    const karsilanmayan = [];
    for (const e of tum) {
      const tam = app.includes("action === '" + e + "'");
      const onek = app.includes("action.startsWith('" + e);
      // `goto:board` gibi olanlar genel `startsWith('goto:')` dalına düşüyor.
      const kok = e.includes(':') ? e.slice(0, e.indexOf(':') + 1) : null;
      const genel = kok ? app.includes("action.startsWith('" + kok + "')") : false;
      if (!tam && !onek && !genel) karsilanmayan.push(e);
    }

    assert.deepEqual(
      karsilanmayan, [],
      'Bu eylemler palette ya da komut listesinde üretiliyor ama handleCmd '
      + 'onları karşılamıyor. Kullanıcı tıklıyor, palet kapanıyor, hiçbir '
      + 'şey olmuyor — ne hata ne istisna. Karşılanmayanlar: '
      + karsilanmayan.join(', '),
    );
  });
});

// ── Pano arama cubugu da numarayla suzmeli (kart #226) ────────────────────
//
// KUSUR: kullanici kart numarasini ONCE pano arama cubuguna yazdi, komut
// paletine degil. Ozellik palettteydi (#224) ve dogru calisiyordu ama kimse
// orada aramadi. Yerlesim sinyali: insan kart ararken KARTLARIN DURDUGU
// ekranin arama kutusuna bakiyor.
//
// Daha kotusu YANLIS BIR OLUMLU uretiyordu: "#193" baslik metni olarak
// eslesiyor ve basliginda "#193" gecen bir kart geldigi icin arama
// CALISIYOR SANILIYORDU. Kimlik aramasi degil metin aramasi yapiyordu --
// yani kusur, dogru cevap verdigi icin gizleniyordu.
//
// KAPSAM FARKI BILINCLI ve test onu da koruyor: palet GLOBAL (baska
// projedeki karti sunucudan ceker), pano cubugu AKTIF GORUNUMU suzer.
// Ikisini ayni yapmak yanlis olurdu; kolonlar projeye ait.
describe('Pano arama çubuğu — numarayla süzme (kart #226)', () => {
  const board = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'views', 'board.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  test('numara kipinde başlığa değil kimliğe bakıyor', () => {
    assert.match(
      board, /idHam/,
      'Pano arama çubuğunda kimlik kipi yok; "#193" yazan kullanıcı başlık '
      + 'metni araması yapar ve yanlış olumlu alır (kart #226).',
    );
    // Suzgec kimlik kipinde basligi ATLAMALI. `else if` bunun mekanizmasi:
    // ikisi ayni dalda kalirsa metin eslesmesi yine devreye girer ve yanlis
    // olumlu geri doner.
    assert.match(
      board, /\} else if \(q && !t\.title/,
      'Kimlik kipi başlık eşleşmesini ATLAMIYOR. İkisi aynı dalda kalırsa '
      + '"#193" yine başlıkta aranır ve kusur (yanlış olumlu) geri gelir.',
    );
  });

  test('bulunamayınca sessiz boş liste bırakmıyor', () => {
    assert.match(
      board, /board_id_not_here/,
      'Numara bu projede bulunamadığında kullanıcıya bir şey söylenmiyor. '
      + 'Sessiz boş liste, "kart yok" ile "kart başka projede" arasındaki '
      + 'farkı gizler ve kullanıcı özelliği bozuk sanır.',
    );
  });

  test('yer tutucu metni numarayı keşfedilebilir kılıyor', () => {
    const veri = yorumsuzKaynak(
      fs.readFileSync(path.join(SRC, 'data.jsx'), 'utf8').replace(/\r\n/g, '\n'),
    );
    // Kesfedilebilirlik kendi basina bir TODO maddesi (#156): ozellik var ama
    // gorunmuyorsa yok sayilir. Kullanicinin bu karti acmasinin sebebi de bu.
    //
    // IKI SOZLUK AYRI AYRI olculuyor. Ilk yazim dosya genelinde ariyordu ve
    // mutasyon turu onu dusurdu: Turkce ipucunu silmek testi KIRMIYORDU,
    // cunku Ingilizce satir deseni karsiliyordu. Yani Turkce kullanici
    // ozelligi kesfedemez hale gelir ve test yesil kalirdi -- olcut,
    // olcmek istedigi seyden bagimsiz bir esleseye bakiyordu.
    // Bugun bu sinifa dorduncu dusus (kart #226).
    const yerTutucular = [...veri.matchAll(/board_search_placeholder:'([^']*)'/g)]
      .map((m) => m[1]);
    assert.equal(
      yerTutucular.length, 2,
      `board_search_placeholder ${yerTutucular.length} yerde bulundu; iki `
      + 'sözlükte birer tane bekleniyor (tr ve en).',
    );
    const ipucusuz = yerTutucular.filter((v) => !v.includes('#'));
    assert.deepEqual(
      ipucusuz, [],
      'Bu yer tutucular numara ipucunu taşımıyor: ' + JSON.stringify(ipucusuz)
      + '. Özellik var ama o dildeki kullanıcı için keşfedilemez kalır '
      + '(kart #156 ile aynı aile).',
    );
  });
});

// ── Kenar cubugundan gezinen her oge mobil menuyu kapatmali ──────────────
//
// KUSUR (17 Eylul 2026, kullanicinin mobil turu): menu her ogede sola
// kapaniyordu ama Bildirimler'de kapanmiyordu -- gidiyorsun ama menu
// ustunde duruyor.
//
// SEBEP IKI AYRI YOL: ogelerin cogu `onView`den geciyor ve o hem gorunumu
// degistirip hem menuyu kapatiyor. Bildirimler ise kendi geri cagrisini
// (`onOpenNotifs`) kullaniyordu ve o yalnizca gorunumu degistiriyordu.
// Ayni olgunun iki okuyucusu, biri eksik.
//
// NICIN YAMA DEGIL YAPI: `onOpenNotifs`e bir satir eklemek kusuru kapatirdi
// ama yarin eklenecek on birinci oge yine unutabilirdi. Kapatma tek gecide
// alindi (NavItem), yani atlamak icin bilerek ugrasmak gerekiyor.
//
// Bu test o gecidi kilitliyor: NavItem kapatmayi KENDISI yapmali ve her
// kullanim yerine gecirilmeli.
describe('Kenar çubuğu — mobil menü her gezinmede kapanıyor', () => {
  const shell = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'shell.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  test('NavItem kapatmayı kendisi yapıyor', () => {
    const i = shell.indexOf('function NavItem(');
    assert.ok(i > 0, 'NavItem bileşeni bulunamadı');
    const govde = shell.slice(i, shell.indexOf('\n}', i));
    assert.match(
      govde, /onMobileClose/,
      'NavItem mobil menüyü kapatmıyor. Kapatmayı çağrı yerlerine bırakmak '
      + 'bu kusuru üretti: on öğeden dokuzu kapatıyordu, biri unutulmuştu.',
    );
    // Kapatma onClick'ten SONRA gelmeli ama asil olcut IKISININ DE
    // cagrilmasi; yalnizca birini cagiran bir govde ya gezinmez ya kapanmaz.
    assert.match(govde, /onClick\?\.\(\)/, 'NavItem onClick çağırmıyor');
    assert.match(govde, /onMobileClose\?\.\(\)/, 'NavItem onMobileClose çağırmıyor');
  });

  test('her NavItem kullanımına prop geçiriliyor', () => {
    // Bir tanesini atlamak, o ogede kusurun aynen geri gelmesi demek --
    // ve bu tam olarak bugunku kusurun bicimi.
    const kullanim = (shell.match(/<NavItem\s/g) || []).length;
    const gecirilen = (shell.match(/<NavItem onMobileClose=\{onMobileClose\}/g) || []).length;
    assert.ok(kullanim > 0, 'shell.jsx içinde NavItem kullanımı bulunamadı');
    assert.equal(
      gecirilen, kullanim,
      `${kullanim} NavItem var ama ${gecirilen} tanesine onMobileClose `
      + 'geçiliyor. Eksik olanda mobil menü açık kalır.',
    );
  });
});

// ── Tam ekran sohbetten cikis yolu olmali (kart #233) ────────────────────
//
// KUSUR, 17 Eylul 2026, kullanicinin GERCEK CIHAZ testinde (Samsung S25 Edge):
// sohbete girince cikamiyordu. Yenilemek, cerezleri temizlemek, yeniden giris
// yapmak -- hicbiri cozmedi, cunku sorun durum degildi: EKRANDA CIKIS DUGMESI
// YOKTU.
//
// DM dalinda geri dugmesi VARDI, kanal dalinda YOKTU. Masaustunde bu hic
// gorunmuyor cunku kenar cubugu ve ust cubuk cikisi sagliyor; gercek telefonda
// ikisi de erisilemiyor ve kullanici KALICI olarak sikisiyor.
//
// `onClose` prop'u app.jsx'ten zaten geciliyordu (dashboard'a doner) ama
// chat.jsx'te hic cagrilmiyordu -- yayilan ama hic karsilanmayan bir yetenek.
// Bugun ayni sinifin ucuncu vakasi (palet eylemleri, mobil menu, bu).
//
// KURAL: tam ekran bir gorunum, kendi icinde cikis tasimali. Kabuktan
// cikilabiliyor olmasi yetmez -- kabuk her cihazda erisilebilir degil.
describe('Tam ekran sohbet — çıkış yolu var (kart #233)', () => {
  const chat = yorumsuzKaynak(
    fs.readFileSync(path.join(SRC, 'chat.jsx'), 'utf8').replace(/\r\n/g, '\n'),
  );

  test('kanal başlığında onClose çağıran bir düğme var', () => {
    // `onClose` PROP OLARAK ALINIYOR ama cagrilmiyorsa yetenek oludur.
    assert.match(
      chat, /function ChatPanel\(\{[^}]*onClose/,
      'ChatPanel onClose prop\'unu almıyor; test güncellenmeli',
    );
    assert.match(
      chat, /onClick=\{onClose\}/,
      'Tam ekran sohbette `onClose` hiçbir düğmeye bağlı değil. Kullanıcı '
      + 'kanal görünümüne girdiğinde çıkamaz — gerçek telefonda kenar çubuğu '
      + 've üst çubuk erişilemediği için kalıcı sıkışma demek (kart #233).',
    );
  });

  test('çıkış yalnızca tam ekran kipte gösteriliyor', () => {
    // Panel kipinde cercevenin kendi kapatmasi var; ikinci bir dugme gurultu.
    //
    // ÇAPA `fullPage && onClose` KOŞULU, `onClick={onClose}` DEĞİL. Testin ilk
    // yazımı `indexOf('onClick={onClose}')` kullaniyordu ve LIGHTBOX'in kapatma
    // dugmesini buluyordu -- dosyada o once geliyor. Yani test, olcmek
    // istediginden bambaska bir yere bakip kiriliyordu.
    //
    // Bugun ayni sinifa BESINCI dusus (tweaks sayimi, palet eylemleri, vitrin
    // dugmeleri, yer tutucu sozlukleri, bu). Desen artik acik: bir kaynak
    // taramasi "ilk eslesme"ye degil, KORUDUGU YAPIYA baglanmali.
    const bas = chat.indexOf('fullPage && onClose');
    assert.ok(
      bas > 0,
      'Çıkış düğmesi tam ekran kipiyle koşullanmamış; panel kipinde ikinci '
      + 'bir kapatma düğmesi olarak görünür.',
    );
    // Kosul ile dugmenin AYNI blokta oldugu dogrulaniyor: kosulu yazip
    // dugmeyi baska yere koymak testi aldatirdi.
    const blok = chat.slice(bas, bas + 400);
    assert.match(
      blok, /onClick=\{onClose\}/,
      '`fullPage && onClose` koşulu var ama içinde onClose çağıran bir düğme '
      + 'yok; koşul boş bir daldan ibaret.',
    );
  });

  test('etiket iki sözlükte de var', () => {
    const veri = yorumsuzKaynak(
      fs.readFileSync(path.join(SRC, 'data.jsx'), 'utf8').replace(/\r\n/g, '\n'),
    );
    const bulunan = (veri.match(/chat_exit:/g) || []).length;
    assert.equal(
      bulunan, 2,
      `chat_exit ${bulunan} sözlükte bulundu; tr ve en olmak üzere iki tane `
      + 'bekleniyor. Tek sözlükte kalırsa öteki dilde Türkçe yedeğe düşer.',
    );
  });
});
