// Mobil düzen — gerçek cihazda kaybolan üst çubuk (#233).
//
// KUSUR (17 Eylül 2026, Samsung Galaxy S25 Edge / Chrome): kullanıcı sohbete
// girince üst çubuk erişilemez hâle geliyor ve SOHBETTEN ÇIKINCA DA öyle
// kalıyor — her ekranda. Kullanıcının kendi ifadesi: "sohbete gidince direkt
// textinputtan başlatıyor, bu da topbarın kaymasına sebep oluyor" ve
// "diğer ekranlarda da bugda kalıyor".
//
// Kusur iki parçalı ve ikisi ayrı ayrı zararsız görünüyor:
//
//   1. `.app` yüksekliği `100vh` idi. Mobil Chrome'da `100vh`, adres çubuğu
//      GİZLİYKEN'ki yüksekliktir; çubuk görünürken kabuk ekrandan uzundur ve
//      belge kaydırılabilir hâle gelir.
//   2. Sohbet açılınca metin kutusu KENDİLİĞİNDEN odaklanıyordu. Odaklanma
//      ekran klavyesini açıyor, tarayıcı odaklanan alanı göstermek için
//      belgeyi kaydırıyor ve üst çubuk yukarıdan çıkıyor.
//
// Klavye kapanınca kaydırma geri alınmıyor, `body`de `overflow: hidden`
// olduğu için kullanıcı da geri kaydıramıyor. Kalıcılık buradan geliyor.
//
// NİÇİN EMÜLASYON GÖSTERMEDİ: kart #233'ün asıl bilmecesi buydu — masaüstü
// DevTools responsive kipinde üst çubuk vardı. Emülasyonda adres çubuğu ve
// ekran klavyesi yok; `100vh` görünen alana eşit ve hiçbir şey kaymıyor.
// Yani kusur ancak iki koşul BİRLİKTE varken doğuyor.
//
// `100vh; 100dvh` ikilisi bu depoda zaten yerleşikti (`auth-page`,
// `chat-panel`) ve gerekçesi styles.css'te yazılıydı. En dış kabuk onu almayı
// kaçırmıştı: yine "aynı olgunun birden çok okuyucusu, biri eksik" ailesi.
// Bu test o okuyucuları saymayı bırakıp KURALI kilitliyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CSS_YOL = path.join(KOK, 'client', 'src', 'styles.css');
const CHAT_YOL = path.join(KOK, 'client', 'src', 'chat.jsx');

/**
 * CSS yorumlarını boşluğa çevirir; uzunluk ve satır sınırları korunur.
 *
 * `yardimcilar.js`teki `yorumsuzKaynak` BİLEREK kullanılmıyor: o okuyucu
 * JavaScript'e göre yazılmış ve `//`yi satır yorumu sayıyor. CSS'te `//`
 * yorum değil — `url(https://...)` içinde geçiyor ve o satırın geri kalanı
 * sessizce silinirdi. CSS'in tek yorum biçimi var, o yüzden okuyucu da küçük.
 */
function yorumsuzCss(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += ' '.repeat(Math.min(2, src.length - i));
      i += 2;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const CSS = yorumsuzCss(fs.readFileSync(CSS_YOL, 'utf8').replace(/\r\n/g, '\n'));

/** Verilen konumu içeren kuralın seçicisini döndürür — hata mesajı için. */
function seciciAra(src, konum) {
  const acilis = src.lastIndexOf('{', konum);
  if (acilis === -1) return '(bilinmeyen kural)';
  const oncekiSon = Math.max(src.lastIndexOf('}', acilis), src.lastIndexOf('{', acilis - 1));
  return src.slice(oncekiSon + 1, acilis).trim().replace(/\s+/g, ' ') || '(bilinmeyen kural)';
}

describe('mobil düzen', () => {
  test('tam görünüm yüksekliği `vh` ile bırakılmıyor — `dvh` eşlikçisi zorunlu', () => {
    // Ölçüt kasten "hangi seçici" değil KURAL: dosyaya yarın eklenecek yeni
    // bir tam yükseklikli kabuk da aynı kapıdan geçsin. Kartın üzerine ad
    // yazan bir test, bir sonraki kabuğu korumazdı.
    //
    // `calc(100vh - ...)` ve `translateY(100vh)` kapsam dışı: ikisi de tam
    // yükseklik DEĞİL — biri ondan çıkarma yapıyor, öteki bir animasyon
    // başlangıcı. Oradaki fark birkaç pikselle sınırlı kalır, ekranı
    // kaydırılabilir yapmaz.
    const eksik = [];
    const re = /height:\s*100vh/g;
    let m = re.exec(CSS);
    while (m !== null) {
      // Bildirimden sonraki kısa pencere: eşlikçi ya aynı satırda
      // (`height: 100vh; height: 100dvh;`) ya hemen bir sonraki satırda olur.
      const pencere = CSS.slice(m.index, m.index + 60);
      if (!/height:\s*100dvh/.test(pencere)) {
        const satir = CSS.slice(0, m.index).split('\n').length;
        eksik.push(`styles.css:${satir}  ${seciciAra(CSS, m.index)}`);
      }
      m = re.exec(CSS);
    }
    assert.deepEqual(eksik, [],
      `tam yükseklik \`100vh\` ile bırakılmış; mobilde kabuk ekrandan uzun olur ve `
      + `belge kaydırılabilir hâle gelir:\n  ${eksik.join('\n  ')}`);
  });

  test('`.app` kabuğu `dvh` taşıyor', () => {
    // Yukarıdaki kural testi genel; bu tek satır AYRICA kilitleniyor çünkü
    // kusurun taşıyıcısı buydu: üst çubuğu tutan en dış kabuk. Genel kural
    // ileride gevşetilirse bu test yine de bağırır.
    const bas = CSS.indexOf('\n.app {');
    assert.notEqual(bas, -1, '`.app` kuralı bulunamadı');
    const govde = CSS.slice(bas, CSS.indexOf('}', bas));
    assert.ok(/height:\s*100dvh/.test(govde),
      '`.app` `100dvh` taşımıyor — mobilde üst çubuk kaydırılıp erişilemez hâle gelir');
  });

  test('sohbet açılışında metin kutusu dokunmatik cihazda ODAKLANMIYOR', () => {
    // Ölçüt ETKİ BLOĞUNA bağlı, dosya geneline değil. Bu depoda aynı sınıfa
    // dört kez düşüldü: dosyada "bir yerde" aranan bir ölçüt, komşusundan
    // ödünç alıp korumadığı bir şeyi korumuş gibi görünüyor. `chat.jsx`
    // içinde başka bir `matchMedia` çağrısı belirirse bu test onu aklamamalı.
    const src = fs.readFileSync(CHAT_YOL, 'utf8').replace(/\r\n/g, '\n');
    const bas = src.indexOf('// ── Focus input');
    assert.notEqual(bas, -1, 'açılış odaklama etkisi bulunamadı');
    const son = src.indexOf('}, [open, dmWith, tab]);', bas);
    assert.notEqual(son, -1, 'odaklama etkisinin bağımlılık listesi bulunamadı');
    const blok = src.slice(bas, son);

    assert.ok(/pointer:\s*coarse/.test(blok),
      'açılış odaklaması dokunmatik cihazda da çalışıyor — ekran klavyesi açılır, '
      + 'görünen alan küçülür ve üst çubuk erişilemez hâle gelir (#233)');
    assert.ok(/!\s*dokunmatik/.test(blok),
      'dokunmatik ölçüsü hesaplanıyor ama odaklama koşuluna bağlanmamış');
  });

  test('kullanıcı eyleminden sonraki odaklamalar KORUNUYOR', () => {
    // Ters yönlü kilit. Kusurun "kolay" çözümü bütün odaklamaları silmekti;
    // o, yanıtla/emoji sonrası klavyenin açılmamasına yol açar ve sohbeti
    // masaüstünde de hantallaştırır. Orada klavyenin açılması İSTENEN sonuç,
    // çünkü kullanıcı yazmak için dokundu.
    const src = fs.readFileSync(CHAT_YOL, 'utf8').replace(/\r\n/g, '\n');
    const sayi = (src.match(/inputRef\.current\?\.focus\(\)/g) || []).length;
    assert.ok(sayi >= 4,
      `kullanıcı eylemine bağlı odaklamalar da silinmiş (${sayi} kaldı) — `
      + 'yanıtla/emoji sonrası klavye açılmaz');
  });
});

// ─── Rapor tabloları: kart ızgarası onlara uymuyor ─────────────────────────
//
// KUSUR (17 Eylül 2026, kullanıcının gerçek cihaz turu): "denetim kaydında
// yazılar üst üste gelmiş." Olay başlığı ve zaman damgası çakışıyordu.
//
// SEBEP: mobilde `.list-table tr` iki sütunlu bir ızgaraya dönüşüyor ve ilk
// hücrenin ONAY KUTUSU olduğunu varsayıp ona 18px'lik bir sütun veriyor
// (`grid-row: 1 / span 2; grid-column: 1`). Pano liste görünümünde bu doğru.
// Rapor tablolarında ise ilk hücre VERİ: denetim kaydında zaman damgası, kişi
// raporunda ad. 18px'lik yuvaya sıkışıp taşıyor ve başlık hücresinin üstüne
// biniyordu.
//
// Aynı sınıfın (`list-table`) iki farklı sütun anlamı vardı ve kural yalnızca
// birini tanıyordu — bu deponun tanıdık sınıfı: aynı olgunun birden çok
// okuyucusu, biri görülmemiş.
//
// Düzeltme rapor satırlarını düz bir esnek sütun yapıyor: sütun sayısı ve
// sırası ne olursa olsun çakışma imkânsız. Izgara varsayımı kalmadığı için
// yarın eklenecek altıncı bir rapor tablosu da bozulmaz.
describe('rapor tabloları — mobilde çakışmıyor (#243)', () => {
  const JSX = fs.readFileSync(
    path.join(KOK, 'client', 'src', 'views', 'reports.jsx'), 'utf8',
  ).replace(/\r\n/g, '\n');

  test('HER rapor tablosu muafiyet sınıfını taşıyor', () => {
    // Ölçüt "en az bir tane" DEĞİL, "hiç eksik yok": tek bir tablonun sınıfı
    // unutulsa o tablo sessizce çakışır ve kimse fark etmez. Yarın eklenecek
    // yeni bir rapor tablosu da bu testi kırar, yani kural kendini hatırlatır.
    const cipsiz = (JSX.match(/className="list-table"/g) || []).length;
    assert.equal(cipsiz, 0,
      `${cipsiz} rapor tablosu \`rep-table\` sınıfı taşımıyor — mobilde ilk `
      + 'hücre 18px onay kutusu yuvasına sıkışır ve başlıkla çakışır');
    const cipli = (JSX.match(/className="list-table rep-table"/g) || []).length;
    assert.ok(cipli >= 5, `beklenen rapor tablosu sayısı düşmüş (${cipli})`);
  });

  test('muafiyet kuralı ızgarayı gerçekten bozuyor', () => {
    // Sınıfı eklemek tek başına yetmez: CSS tarafı ızgarayı iptal etmiyorsa
    // hücreler yine aynı yuvaya düşer. İki yarı da ayrı ayrı ölçülüyor.
    const css = fs.readFileSync(CSS_YOL, 'utf8');
    const bas = css.indexOf('.list-table.rep-table tr');
    assert.notEqual(bas, -1, 'rapor tablosu muafiyet kuralı yok');
    const blok = css.slice(bas, css.indexOf('}', bas));
    assert.ok(/display:\s*(flex|block)/.test(blok),
      'rapor satırı hâlâ ızgara — hücreler aynı yuvaya düşüp çakışır');
    assert.ok(!/display:\s*grid/.test(blok),
      'rapor satırına yeniden ızgara verilmiş');
  });

  test('hücreler ızgara yerleşiminden de kurtarılmış', () => {
    // `tr` ızgara olmaktan çıksa bile hücrelerdeki `grid-column`/`grid-row`
    // bildirimleri miras kalırsa düzen yine şaşar. Kusurun taşıyıcısı
    // hücrelerdeki bu iki bildirimdi.
    const css = fs.readFileSync(CSS_YOL, 'utf8');
    const bas = css.indexOf('.list-table.rep-table td {');
    assert.notEqual(bas, -1, 'rapor hücresi kuralı yok');
    const blok = css.slice(bas, css.indexOf('}', bas));
    assert.ok(/grid-column:\s*auto/.test(blok) && /grid-row:\s*auto/.test(blok),
      'hücreler ızgara yerleşimini bırakmıyor');
  });
});

// ─── Sürükle-kapat: kartı yukarıdan aşağı çekerek kapat (#238) ─────────────
//
// İSTEK (17 Eylül 2026, kullanıcı): "kart açık iken kartı yukarıdan aşağı
// çekince kartı küçültsün panoya atsın, sanırsam sadece mobilde işe yarar."
//
// NİÇİN: mobilde kart tam ekran açılıyor ve kapatmanın tek yolu sağ üstteki X
// — başparmağın en zor ulaştığı köşe. Süs değil, erişilebilirlik işi. #233
// (üst çubuğa ulaşılamıyordu) ve #228 (geri tuşu siteden atıyor) ile aynı
// aile: "bu ekrandan nasıl çıkarım".
//
// Bu testler jestin VARLIĞINI ve kritik kısıtlarını kilitliyor. Sürüklemenin
// kendisi (parmak hareketi → piksel) tarayıcı olayı gerektiriyor ve burada
// ölçülemiyor; ölçülebilen her kısıt ayrı ayrı bağlanıyor.
describe('sürükle-kapat — mobilde kartı aşağı çekerek kapatma (#238)', () => {
  const DRAWER = fs.readFileSync(
    path.join(KOK, 'client', 'src', 'drawer.jsx'), 'utf8',
  ).replace(/\r\n/g, '\n');

  const jestBloku = () => {
    const bas = DRAWER.indexOf('const jestBitir');
    assert.notEqual(bas, -1, 'jest bitiş işleyicisi bulunamadı');
    return DRAWER.slice(bas, DRAWER.indexOf('\n  };', bas));
  };

  test('jest dokunmatik cihazla sınırlı', () => {
    // Ölçüt `pointer: coarse`, ekran GENİŞLİĞİ değil — #233'te aynı karar
    // verildi. Dar bir masaüstü penceresinde fareyle aşağı sürüklemek kapatma
    // jesti değildir ve kaydırmayla çakışır.
    const bas = DRAWER.indexOf('const dokunmatikMi');
    assert.notEqual(bas, -1, 'dokunmatik ölçüsü yok');
    const blok = DRAWER.slice(bas, DRAWER.indexOf('\n  );', bas));
    assert.match(blok, /pointer:\s*coarse/,
      'jest masaüstünde de kurulur — fare sürüklemesi kartı kapatır');

    const basla = DRAWER.slice(DRAWER.indexOf('const jestBasla'), DRAWER.indexOf('const jestSurukle'));
    assert.match(basla, /!dokunmatikMi\(\)/,
      'ölçü hesaplanıyor ama jestin kurulmasına bağlanmamış');
  });

  test('İKİ eşik var — uzun sürükleme VE hızlı fiske', () => {
    // Tek eşik ikisinden birini yanlış yorumlar: yavaş ama uzun sürükleme de,
    // kısa ama hızlı fiske de "kapat" demektir. Yalnızca mesafeye bakmak
    // fiskeyi görmez; yalnızca hıza bakmak dikkatli sürüklemeyi görmez.
    const blok = jestBloku();
    assert.match(blok, /innerHeight/,
      'eşik ekran yüksekliğine göre değil — küçük ve büyük telefonda farklı davranır');
    assert.match(blok, /j\.y \/ sure/,
      'hız hesaplanmıyor; hızlı fiske kapatmaz');
    assert.match(blok, /uzun \|\| fiske/,
      'iki eşik birleştirilmemiş');
  });

  test('eşik altında kapanmıyor — geri yaylanıyor', () => {
    // Ters yönlü kilit. Eşiksiz bir jest, kartı okumak için parmağını gezdiren
    // kullanıcının altından kartı çeker.
    const blok = jestBloku();
    assert.match(blok, /if \(uzun \|\| fiske\) onClose\(\)/,
      'kapatma koşulsuz çağrılıyor olabilir — her dokunuş kartı kapatır');
  });

  test('X düğmesi KALIYOR — jest onun yerine geçmiyor', () => {
    // Görünmez bir jest olmayan bir jesttir ve klavyeyle gezen kullanıcının da
    // bir yolu olmalı. Jest ekleniyor, alternatif kaldırılmıyor.
    assert.match(DRAWER, /title=\{window\.t\('drawer_close'\)\}/,
      'kapatma düğmesi kaldırılmış — dokunmatik olmayan kullanıcının çıkışı yok');
  });

  test('tutamak var ve yalnızca dokunmatikte görünüyor', () => {
    assert.match(DRAWER, /className="drawer-grab"/, 'tutamak çubuğu yok');
    const css = fs.readFileSync(CSS_YOL, 'utf8');

    // Varsayım AÇIKÇA ölçülüyor: aşağıdaki `indexOf` ilk bloğu buluyor ve
    // bugün tek blok var. İkinci bir `pointer: coarse` bloğu eklenirse ölçüt
    // sessizce YANLIŞ yeri ölçmeye başlar — bugün tam bu tuzağa iki kez
    // düşüldü (cokme.test.js ve burada).
    const kacBlok = (css.match(/@media \(pointer: coarse\)/g) || []).length;
    assert.equal(kacBlok, 1,
      `${kacBlok} adet "pointer: coarse" bloğu var; aşağıdaki ölçüt yalnızca `
      + 'ilkine bakıyor ve artık yanlış bloğu ölçüyor olabilir');

    const bas = css.indexOf('@media (pointer: coarse)');
    const blok = css.slice(bas, css.indexOf('\n}\n', bas));
    // Seçici SINIRIYLA aranıyor. `/\.drawer-grab/` alt dize olarak
    // `.drawer-grab-XX`i de eşliyordu ve aklama mutasyonu tam oradan kaçtı:
    // seçiciyi yeniden adlandırmak testi kırmıyordu.
    assert.match(blok, /\.drawer-grab\s*\{/,
      'tutamak dokunmatik kuralına bağlı değil — masaüstünde de görünür ve '
      + 'işaret ettiği jest orada yok');

    // Varsayılan GİZLİ olmalı: medya kuralı onu açıyor, tersi değil.
    assert.match(css, /\.drawer-grab \{ display: none; \}/,
      'tutamak varsayılan olarak gizli değil');
  });

  test('tarayıcının kendi "sayfayı yenile" jesti kesiliyor', () => {
    // Chrome Android'de en üstten aşağı çekmek sayfayı yeniler. Bu kural
    // olmadan kullanıcı kartı kapatmaya çalışırken sayfa yenilenir ve yazdığı
    // yorum gider — jestin kendisinden daha pahalı bir kusur.
    const css = fs.readFileSync(CSS_YOL, 'utf8');
    const bas = css.indexOf('.drawer-body {');
    assert.notEqual(bas, -1, '.drawer-body kuralı yok');
    const blok = css.slice(bas, css.indexOf('}', bas));
    assert.match(blok, /overscroll-behavior-y:\s*contain/,
      'kaydırma zinciri kesilmiyor — jest sayfayı yeniler');
  });
});

// ─── Tam sayfa sohbet, dar ekran: liste ↔ konuşma (#240) ───────────────────
//
// KUSUR (18 Eylül 2026, kullanıcı gerçek cihazda): "yandan açılır menüden
// sohbete geçip genele gidiyoruz ancak genelden DM'ye geçemiyoruz."
//
// Çökme DEĞİLDİ, eksik bir yoldu. 760px altında sol sütun (kanallar + DM'ler)
// `display: none` idi ve onu açan hiçbir durum yoktu. "genel"deki geri düğmesi
// ise sohbetten TAMAMEN çıkarıyordu (#233'te kaçış yolu olarak eklenmişti). DM'ye
// yalnızca sohbetin DIŞINDAN gidilebiliyordu — kullanıcının saydığı çalışan üç
// yol tam olarak bunlardı.
//
// Bir de ÖLÜ kural vardı: `.chat-fp-main-back` için bir geri düğmesi gösteriyordu
// ama o öğe JSX'te hiç yoktu. Biri bu sorunu daha önce çözmeye çalışmış,
// bağlanmamış — kuralın varlığı sorunun çözüldüğü izlenimini veriyordu.
//
// KURAL: konuşmadan geri → liste; liste satırı → konuşma; listenin üstünde
// sohbetten çıkış. Sohbetin içinden HER ZAMAN bir çıkış var, bir adım uzakta.
describe('tam sayfa sohbet — dar ekranda listeye ulaşılabiliyor (#240)', () => {
  const JSX = yorumsuzDosya(CHAT_YOL).replace(/\r\n/g, '\n');

  // Bir düğme bildiriminin gövdesi: sınıf adından bir sonraki `title=`e kadar.
  const dugmeler = (sinif) => {
    const yerler = [];
    let i = JSX.indexOf(sinif);
    while (i !== -1) {
      yerler.push(JSX.slice(i, JSX.indexOf('title=', i)));
      i = JSX.indexOf(sinif, i + 1);
    }
    return yerler;
  };

  test('dar ekranda liste açılabiliyor ve açıkken konuşma gizleniyor', () => {
    const bas = CSS.indexOf('@media (max-width: 760px)');
    assert.notEqual(bas, -1, '760px medya sorgusu bulunamadı');
    const blok = CSS.slice(bas, CSS.indexOf('\n}\n', bas));
    assert.match(blok, /\.chat-fp-grid\[data-mobil-liste="true"\] \.chat-fp-left\s*\{\s*display:\s*flex/,
      'liste dar ekranda hiçbir koşulda görünmüyor — DM\'ye tam sayfa sohbetin içinden ulaşılamaz');
    assert.match(blok, /\.chat-fp-grid\[data-mobil-liste="true"\] \.chat-fp-center\s*\{\s*display:\s*none/,
      'liste açıkken konuşma gizlenmiyor — tek sütuna ikisi sığmaz');
    assert.match(JSX, /className="chat-fp-grid" data-mobil-liste=\{mobilListe\}/,
      'ızgara liste durumunu taşımıyor; CSS kuralı hiçbir zaman eşleşmez');
  });

  test('konuşmadan geri LİSTEYE dönüyor, sohbetten çıkarmıyor', () => {
    // Çıkış düğmesi dışındaki her geri düğmesi. Ölçüt HER düğmeye bakıyor,
    // ilk eşleşmeye değil — bugün `indexOf` ilk eşleşme tuzağına iki kez düşüldü.
    const geriler = dugmeler('chat-fp-back-btn').filter((b) => !b.includes('chat-fp-exit-btn'));
    assert.ok(geriler.length >= 2, `yalnızca ${geriler.length} geri düğmesi bulundu (DM + kanal bekleniyor)`);
    for (const b of geriler) {
      assert.match(b, /setMobilListe\(true\)/,
        'bir geri düğmesi listeye dönmüyor — dar ekranda DM listesine ulaşılamaz');
      assert.doesNotMatch(b, /onClick=\{onClose\}/,
        'konuşmadaki geri düğmesi sohbetten çıkarıyor — liste atlanıyor');
    }
  });

  test('listede HER ZAMAN bir çıkış var — kaçış yolu kaybolmadı', () => {
    // #233'ün değişmezi: sohbetin içinden çıkış yolu olmalı. Geri düğmesi
    // artık listeye dönüyor; çıkış listenin üstüne taşındı. Ölçüt sol sütunun
    // İÇİNE bağlı: çıkış düğmesinin dosyada bir yerde olması yetmez.
    const bas = JSX.indexOf('<aside className="chat-fp-left">');
    assert.notEqual(bas, -1, 'sol sütun bulunamadı');
    const sol = JSX.slice(bas, JSX.indexOf('</aside>', bas));
    const cikis = sol.slice(sol.indexOf('chat-fp-exit-btn'), sol.indexOf('title=', sol.indexOf('chat-fp-exit-btn')));
    assert.ok(sol.includes('chat-fp-exit-btn'), 'listede çıkış düğmesi yok — kullanıcı sohbette sıkışır');
    assert.match(cikis, /onClick=\{onClose\}/, 'listedeki çıkış düğmesi sohbeti kapatmıyor');
  });

  test('liste satırları listeyi kapatıyor — kanal da DM de', () => {
    // İkisi ayrı ayrı: yalnızca biri kapatırsa öteki satıra dokunan kullanıcı
    // listede kalır ve seçtiği konuşmayı hiç görmez.
    assert.match(JSX, /setActiveChannel\(slug\); setMobilListe\(false\);/,
      'kanal satırı listeyi kapatmıyor');
    assert.match(JSX, /openDm\(m\.id\); setMobilListe\(false\);/,
      'DM satırı listeyi kapatmıyor');
  });

  test('ölü kural geri gelmedi', () => {
    // Var olmayan bir öğeyi hedefleyen kural, sorunun çözüldüğü izlenimini
    // veriyordu. Geri gelirse aynı yanılgı da geri gelir.
    assert.doesNotMatch(CSS, /chat-fp-main-back/,
      'JSX\'te karşılığı olmayan `.chat-fp-main-back` kuralı geri eklenmiş');
  });
});

// ─── Çizelge: tarihsiz blok çizelgeyi yemiyor (#195) ──────────────────────
//
// KUSUR (18 Eylül 2026, kullanıcı yatay telefonda): "çizelgeye kalan ekran
// çok dar, yukarı aşağı da yapamıyoruz, dinamik değil." `.tl-undated` çizelgeyle
// aynı sütunda, sınırsızdı: 69 tarihsiz kartla bütün alanı kaplıyor, çizelge
// (min-height: 0) sıfıra sıkışıyor, taşan kısım kaydırılamıyordu.
describe('çizelge — tarihsiz blok sınırlı, kısa ekranda görünüm kayıyor (#195)', () => {
  const kural = (secici, bas = 0) => {
    const i = CSS.indexOf(secici, bas);
    assert.notEqual(i, -1, `${secici} bulunamadı`);
    return CSS.slice(i, CSS.indexOf('}', i));
  };

  test('tarihsiz blok sınırlı ve kendi içinde kayıyor', () => {
    const b = kural('.tl-undated {');
    assert.match(b, /max-height:\s*30dvh/, 'tarihsiz blok sınırsız — çizelgeyi sıfıra sıkıştırır');
    assert.match(b, /overflow-y:\s*auto/, 'tarihsiz blok kaymıyor — taşan kartlara ulaşılamaz');
    assert.match(b, /flex-shrink:\s*0/, 'blok esnemeye açık; sınırı anlamsızlaşır');
  });

  test('kısa ekranda görünümün tamamı dikey kayıyor, çizelge yer alıyor', () => {
    const bas = CSS.indexOf('@media (max-height: 500px)');
    assert.notEqual(bas, -1, 'kısa ekran sorgusu yok — yatay telefonda çizelge dar şeritte kalır');
    const blok = CSS.slice(bas, CSS.indexOf('\n}\n', bas));
    assert.match(blok, /\.timeline-view\s*\{\s*overflow-y:\s*auto/, 'görünüm kısa ekranda kaymıyor');
    assert.match(blok, /\.timeline-grid\s*\{[^}]*height:\s*75dvh/, 'çizelgeye kısa ekranda yer ayrılmıyor');
  });
});
