// Ana Sayfa "Takım hareketleri" — canlı gelen kaydı listeye katma (#259).
//
// Liste önyüklemeden geliyor (sunucu son 10 kaydı veriyor, api.js) ve artık
// `activity_new` olayıyla büyüyor. Sınır sunucununkiyle aynı: canlı eklemeyle
// uzayan liste F5'ten sonra kısalırsa kullanıcı "kayıt kayboldu" sanır.

export const ETKINLIK_AZAMI = 10;

/**
 * Yeni kaydı başa ekler. Aynı kimlik zaten listedeyse (yeniden bağlanma,
 * önyüklemeyle yarış) liste aynen döner — iki kez görünmesin.
 * Kimliği olmayan kayıt eklenmez: tekilleştirilemez, yinelenebilir.
 */
export function etkinligeEkle(liste, yeni, azami = ETKINLIK_AZAMI) {
  const eski = Array.isArray(liste) ? liste : [];
  if (!yeni || yeni.id == null) return eski;
  if (eski.some((a) => String(a.id) === String(yeni.id))) return eski;
  return [yeni, ...eski].slice(0, azami);
}
