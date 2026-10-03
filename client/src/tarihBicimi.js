/**
 * Tarih biçimi — saf çekirdek.
 *
 * NİÇİN VAR: ayarlarda "Tarih formatı" diye üç seçenekli bir ayar vardı,
 * seçileni gösteriyordu ve **hiçbir şey yapmıyordu**. `dateFormat`
 * `stoa.tweaks`e yazılıyor ve hiçbir yerde okunmuyordu.
 *
 * `setTweak` ile yazılan ama okunmayan dört alandan üçüncüsü ve sonuncusu
 * (ötekiler `dndEnabled`/`dndStart`/`dndEnd` ve `weekStart`). Sınıf aynı:
 * sessizce hiçbir şey yapmayan bir ayar, olmayan bir ayardan kötüdür.
 *
 * VARSAYILAN DAVRANIŞ KORUNUYOR. `dmY` seçeneğinin ayardaki önizlemesi
 * "24 May 2026" — yani ay ADLI biçim, bugünkü `fmtDate` çıktısının
 * kendisi. O yüzden ayarı hayata geçirmek kimsenin ekranını
 * değiştirmiyor: ayarı hiç ellemeyen kullanıcı aynı "24 Mayıs"ı görmeye
 * devam ediyor. Numerik biçimler yalnızca onları SEÇENE geliyor.
 *
 * Bu bilinçli: üç seçeneğin ikisi numerik diye varsayılanı da numerik
 * yapmak, ayarı hiç açmamış herkesin kart tarihlerini "24.05.2026"ya
 * çevirirdi — istenmeyen bir görsel gerileme, ve kimsenin istemediği bir
 * değişiklik.
 */

/** Ayarda sunulan biçimler — ayarlar ekranı da buradan beslenebilir. */
export const TARIH_BICIMLERI = ['dmY', 'Ymd', 'mdY'];

const ikiHane = (n) => String(n).padStart(2, '0');

/**
 * Tanınmayan biçim `dmY`ye düşüyor.
 *
 * Bayat ya da elle yazılmış bir değer boş string ya da "undefined"
 * üretmemeli — kart tarihinin yerinde "undefined" yazması, ayarın hiç
 * işlememesinden daha kötü görünür.
 */
export function tarihBicimi(bicim) {
  return TARIH_BICIMLERI.includes(bicim) ? bicim : 'dmY';
}

/**
 * Tarihi ayara göre yazar.
 *
 * @param {Date} d
 * @param {string} bicim 'dmY' | 'Ymd' | 'mdY'
 * @param {{aylar?: string[], yilEkle?: boolean}} secenek
 *   `aylar` — ay adları (dile göre çağrı yerinden geliyor ki bu modül
 *   sözlüğe bağlanmasın). `yilEkle` yalnızca `dmY` için anlamlı: numerik
 *   biçimlerde yıl zaten var ve onu atlamak tarihi okunamaz yapardı
 *   ("05/24" hangi yıl?).
 */
export function tarihYaz(d, bicim, { aylar = null, yilEkle = false } = {}) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const b = tarihBicimi(bicim);
  const yil = d.getFullYear();
  const ay = d.getMonth() + 1;
  const gun = d.getDate();

  if (b === 'Ymd') return `${yil}-${ikiHane(ay)}-${ikiHane(gun)}`;
  if (b === 'mdY') return `${ikiHane(ay)}/${ikiHane(gun)}/${yil}`;

  // dmY — ay ADLI biçim, bugünkü davranış.
  const adi = Array.isArray(aylar) && aylar.length === 12 ? aylar[d.getMonth()] : String(ay);
  return yilEkle ? `${gun} ${adi} ${yil}` : `${gun} ${adi}`;
}

/**
 * Numerik biçimde YIL HER ZAMAN var mı?
 *
 * `fmtTimeAgo` eski kayıtlarda mutlak tarihe düşüyor ve aynı yıl içindeyse
 * yılı atlıyordu ("24 Mayıs"). Numerik biçimlerde yıl biçimin parçası, yani
 * o kısaltma uygulanamaz; çağrı yeri bunu sormak zorunda.
 */
export function yilBicimdeVarMi(bicim) {
  return tarihBicimi(bicim) !== 'dmY';
}
