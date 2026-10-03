/**
 * Haftanın ilk günü — saf çekirdek.
 *
 * NİÇİN VAR: ayarlarda "Haftanın ilk günü" diye üç seçenekli bir ayar vardı
 * (Pazartesi / Pazar / Cumartesi), seçileni gösteriyordu ve **hiçbir şey
 * yapmıyordu**. `weekStart` `stoa.tweaks`e yazılıyor ve takvim onu hiç
 * okumuyordu: Pazartesi dört yerde gömülüydü (`(getDay() + 6) % 7`) ve gün
 * adları tablosu da Pazartesi'den başlıyordu.
 *
 * `setTweak` ile yazılan ama okunmayan dört alandan biri; ötekiler
 * `dndEnabled`/`dndStart`/`dndEnd` (`rahatsizEtme.js`) ve `dateFormat`.
 * Sınıf aynı: sessizce hiçbir şey yapmayan bir ayar.
 *
 * HESAP VE ÇİZİM BİRLİKTE DÖNMEK ZORUNDA. Yalnızca hesabı döndürmek
 * takvimi sessizce yanlış yapardı: 1 Ekim Pazar olarak hesaplanır ama
 * başlıkta "Pzt" yazardı, yani her kart bir gün kaymış görünürdü. Bu
 * yüzden gün adlarının sırası da buradan geliyor.
 */

/** Ayar değerinden JavaScript `getDay()` karşılığı. */
const BASLANGIC = { mon: 1, sun: 0, sat: 6 };

/** Ayarda sunulan üç seçenek — ayarlar ekranı da buradan beslenebilir. */
export const HAFTA_BASLANGICLARI = ['mon', 'sun', 'sat'];

/**
 * Tanınmayan değer PAZARTESİ'ye düşüyor.
 *
 * `grupla()` ve alt görünüm adında olduğu gibi: bayat ya da elle yazılmış
 * bir değer sessizce boş/bozuk bir takvim üretmemeli. Pazartesi hem bu
 * uygulamanın hem de ISO 8601'in varsayılanı.
 */
export function haftaBasi(weekStart) {
  return Object.prototype.hasOwnProperty.call(BASLANGIC, weekStart)
    ? BASLANGIC[weekStart]
    : BASLANGIC.mon;
}

/**
 * Tarih, haftanın kaçıncı günü? (0 = haftanın ilk günü)
 *
 * Takvim ızgarasında ilk satırın kaç boş hücreyle başladığını ve bir günün
 * hangi kolona düştüğünü bu belirliyor.
 */
export function gunOfseti(tarih, weekStart) {
  const g = tarih instanceof Date && !Number.isNaN(tarih.getTime()) ? tarih.getDay() : 0;
  return (g - haftaBasi(weekStart) + 7) % 7;
}

/**
 * Gün adlarını ayara göre döndürür.
 *
 * Girdi PAZARTESİ'den başlayan yedi ad (sözlükteki `cal_days_short` öyle).
 * Pazar seçiliyse "Paz" başa geliyor, Cumartesi seçiliyse "Cmt".
 */
export function gunAdlariSirali(adlar, weekStart) {
  const liste = Array.isArray(adlar) ? adlar : [];
  if (liste.length !== 7) return liste;      // bozuk sözlük: olduğu gibi
  const b = haftaBasi(weekStart);
  // Ad listesinde Pazartesi 0. sırada, yani `getDay()` g'nin dizini (g+6)%7.
  return Array.from({ length: 7 }, (_, i) => liste[((b + i) + 6) % 7]);
}

/** Verilen tarihin içinde bulunduğu haftanın ilk günü. Yeni `Date` döner. */
export function haftaninBasi(tarih, weekStart) {
  const d = new Date(tarih);
  d.setDate(d.getDate() - gunOfseti(tarih, weekStart));
  return d;
}
