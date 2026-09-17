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
