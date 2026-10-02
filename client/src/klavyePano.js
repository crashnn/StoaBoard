// Panoda klavyeyle gezinmenin SAF çekirdeği.
//
// NİÇİN VAR: pano 2 Ekim 2026'ya kadar yalnızca fareyle kullanılabiliyordu.
// Ölçüldü: kartlar `tabIndex: -1`, `role` yok — yani sekme tuşuyla bir karta
// ulaşmak, klavyeyle açmak ya da taşımak mümkün değildi. Uygulama ise
// klaviye kısayollarını komut paletinde kullanıcıya GÖSTERİYOR (G D, G B, N).
// Gezinme vaat edilip işin kendisi — kartlar — dışarıda kalmıştı. Ekran
// okuyucu için de aynı kapı kapalıydı.
//
// NİÇİN DURUM TUTMUYOR: "seçili kart" diye ayrı bir durum yok; seçili kart,
// TARAYICININ ODAĞINDAKİ karttır. Bu bilinçli — bu depoda tekrarlanan ders
// "aynı olgunun iki okuyucusu ayrışır" (DEVIR 0-AJ, #330 ailesi). İkinci bir
// seçim durumu tutmak, odakla ayrışabilen ikinci bir gerçek üretirdi.
//
// Buradaki iki fonksiyon saf; DOM işi `views/board.jsx` içindeki kartta.

/**
 * Komşu kolonun kimliği. Kenarda `null` döner.
 *
 * SARMA YOK, bilinçli: "Tamamlandı"dan sağa basınca "Backlog"a geçmek,
 * Shift ile taşırken bitmiş bir kartı sessizce en başa atmak demekti.
 * Kenarda durmak, kullanıcının yanlışlıkla yapabileceği en kötü şeyi
 * hiç mümkün kılmıyor.
 *
 * @param {Array<{id:string}>} kolonlar Panodaki kolonlar, soldan sağa.
 * @param {string} mevcutId
 * @param {number} yon -1 sol, +1 sağ.
 * @returns {string|null}
 */
export function komsuKolonId(kolonlar, mevcutId, yon) {
  const liste = Array.isArray(kolonlar) ? kolonlar : [];
  const i = liste.findIndex((c) => c && c.id === mevcutId);
  if (i === -1) return null;
  const hedef = i + (yon < 0 ? -1 : 1);
  if (hedef < 0 || hedef >= liste.length) return null;
  return liste[hedef]?.id ?? null;
}

/**
 * Komşu kolonda odaklanacak kartın sırası.
 *
 * Hedef kolon daha kısaysa son karta düşer (boşluğa atlamak yerine), boşsa
 * `null` döner — çağıran o zaman odağı oynatmıyor. Odağı kaybetmek,
 * klavyeyle gezinmeyi ortasında bırakmak olurdu.
 *
 * @param {number} mevcutSira Bulunduğu kolondaki sırası (0 tabanlı).
 * @param {number} hedefSayi Hedef kolondaki kart sayısı.
 * @returns {number|null}
 */
export function hedefKartSirasi(mevcutSira, hedefSayi) {
  if (!Number.isFinite(hedefSayi) || hedefSayi <= 0) return null;
  const s = Number.isFinite(mevcutSira) && mevcutSira > 0 ? mevcutSira : 0;
  return Math.min(s, hedefSayi - 1);
}
