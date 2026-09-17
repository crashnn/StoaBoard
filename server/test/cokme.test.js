// Çökme kuşatması — bir panelin hatası bütün uygulamayı götürmemeli.
//
// KUSUR (17 Eylül 2026, kullanıcı gerçek cihazda): kart yorumundaki bahsetmeye
// basınca DM açılacakken sayfa TAMAMEN beyazladı. Ne üst çubuk, ne kenar
// çubuğu, ne bir hata mesajı — hiçbir şey.
//
// `ErrorBoundary`nin kendi açıklaması bu kusuru zaten birebir tarif ediyordu:
// "bir boundary yoksa TÜM ağaç unmount olur — ekran komple siyah kalır."
// Ders 2 Eylül'de Raporlar'daki bir kapsam hatasıyla öğrenilmiş ve GÖRÜNÜM
// ALANI sarılmıştı. Ama çekmece, sohbet ve bildirim panelleri görünüm alanının
// DIŞINDA render ediliyor ve sarılmamıştı. Onlar da render ediyor, onlar da
// fırlatabiliyor.
//
// Yine bu deponun imza sınıfı: aynı ders iki yerde geçerliydi, biri uygulandı,
// öteki atlandı (CLAUDE.md).
//
// KURAL: üst düzeyde render edilen her kaplama paneli bir `ErrorBoundary`
// içinde olmalı. Ölçüt "dosyada boundary var mı" DEĞİL — o, komşusundan ödünç
// alan türden bir ölçüt olurdu. Aşağıdaki tarama JSX metnini yürüyüp her
// panelin konumundaki boundary DERİNLİĞİNİ hesaplıyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));

/**
 * Verilen konumda kaç `ErrorBoundary` açık olduğunu döndürür.
 *
 * Açılış ve kapanış etiketlerini konuma göre sıralayıp sayıyor. Yorumlar
 * `yorumsuzDosya` ile boşaltıldığı için, kuralı ANLATAN bir yorum kuralın
 * ihlalini örtemiyor — bu depoda bir kez tam olarak öyle olmuştu.
 */
function boundaryDerinligi(konum) {
  let derinlik = 0;
  const re = /<\/?ErrorBoundary/g;
  let m = re.exec(APP);
  while (m !== null && m.index < konum) {
    derinlik += m[0].startsWith('</') ? -1 : 1;
    m = re.exec(APP);
  }
  return derinlik;
}

// Üst düzeyde, görünüm alanının DIŞINDA render edilen paneller. Hepsi
// kullanıcının ekranını kaplıyor ve hepsi kendi verisiyle render ediyor.
const KAPLAMALAR = [
  ['<TaskDrawer', 'kart çekmecesi'],
  ['<ChatPanel', 'sohbet paneli'],
  ['<NotifPanel', 'bildirim paneli'],
  ['<AddTaskModal', 'yeni kart penceresi'],
  ['<CommandPalette', 'komut paleti'],
];

/** Bir etiketin BÜTÜN geçtiği yerleri döndürür. */
function tumKonumlar(etiket) {
  const yerler = [];
  let i = APP.indexOf(etiket);
  while (i !== -1) {
    yerler.push(i);
    i = APP.indexOf(etiket, i + 1);
  }
  return yerler;
}

describe('kaplama panelleri ErrorBoundary içinde (#244)', () => {
  for (const [etiket, ad] of KAPLAMALAR) {
    test(`${ad} sarılı — HER geçtiği yerde`, () => {
      // "İLK geçtiği yer" ölçütü BU TESTİN İLK HÂLİNDE VARDI ve mutasyon onu
      // düşürdü: `indexOf` ilk eşleşmeyi buluyor ve bu panellerin çoğunun
      // GÖRÜNÜM ALANI İÇİNDE de bir kopyası var (tam sayfa kart, tam sayfa
      // sohbet, bildirimler görünümü). O kopyalar zaten görünüm
      // sarmalayıcısının içinde, yani ölçüt hep yeşil dönüyor ve asıl
      // korunacak KAPLAMA kopyasına hiç bakmıyordu.
      //
      // Ölçütün komşusundan ödünç almasının bir başka biçimi: aynı ad, iki
      // ayrı yer, biri ötekini aklıyor (CLAUDE.md).
      const yerler = tumKonumlar(etiket);
      assert.ok(yerler.length >= 1, `${etiket} app.jsx içinde bulunamadı`);
      const sarisiz = yerler
        .filter((k) => boundaryDerinligi(k) < 1)
        .map((k) => APP.slice(0, k).split('\n').length);
      assert.deepEqual(
        sarisiz, [],
        `${ad} (${etiket}) şu satırlarda hiçbir ErrorBoundary içinde değil: `
        + `${sarisiz.join(', ')}. Orada fırlatılan bir hata bütün ağacı unmount `
        + 'eder: kullanıcı bomboş beyaz bir sayfa görür, kaçış yolu da kalmaz '
        + '(kenar çubuğu ve üst çubuk da gider).',
      );
    });
  }

  test('görünüm alanı sarılı kalmaya devam ediyor', () => {
    // Ters yönlü kilit: kaplamaları sararken görünüm alanının sarmalayıcısı
    // bozulmuş olabilir. 2 Eylül'de kapatılan kusur geri gelmesin.
    const konum = APP.indexOf('<BoardView');
    assert.notEqual(konum, -1, 'BoardView bulunamadı');
    assert.ok(boundaryDerinligi(konum) >= 1,
      'görünüm alanı artık sarılı değil — 2 Eylül kusuru geri geldi');
  });

  test('her kaplamanın KENDİ sarmalayıcısı var', () => {
    // Hepsini tek bir boundary'ye almak, birinin çökmesinde ötekileri de
    // götürürdü: sohbet hatası kart çekmecesini kapatır, kullanıcı ne olduğunu
    // anlamaz. Ayrı `key` ayrıca "yeniden dene"yi panel bazında çalıştırıyor.
    const acilis = (APP.match(/<ErrorBoundary/g) || []).length;
    assert.ok(acilis >= 6,
      `yalnızca ${acilis} ErrorBoundary var; kaplamalar tek bir sarmalayıcıya `
      + 'toplanmış olabilir');
  });
});

describe('hata metni kullanıcıya görünüyor', () => {
  const EB = yorumsuzDosya(path.join(CLIENT, 'error-boundary.jsx'));

  test('mesaj ekrana yazılıyor, yalnızca konsola değil', () => {
    // Kullanıcı raporlarının çoğu TELEFONDAN geliyor ve orada konsol açmak
    // pratikte imkânsız. "Beyaz ekran geldi, bozuk" ile "x is undefined"
    // arasındaki fark, bir kusurun bir saatte mi bir günde mi kapandığıdır.
    assert.match(EB, /this\.state\.error\?\.message/,
      'hata mesajı ekranda gösterilmiyor — teşhis yalnızca konsoldan mümkün');
    assert.match(EB, /error-boundary-detail/,
      'hata metni için bir kap yok');
  });

  test('konsola yazma da duruyor', () => {
    // İkisi ayrı okuyucu: ekran kullanıcı için, konsol geliştirici için.
    // Biri ötekinin yerine geçmiyor — konsolda yığın izi var, ekranda yok.
    assert.match(EB, /console\.error\('\[ErrorBoundary\]'/,
      'konsol kaydı kaldırılmış; yığın izi tamamen kayboldu');
  });
});
