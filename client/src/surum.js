// Açık sekme dağıtımı fark ediyor — saf kural (kart #201).
//
// 13 Eylül 2026: tek kaynak dağıtımından sonra açık bir sekme eski
// çekmeceyle çalıştı ve dört işlemin dördü reddedildi. O gün kurtaran
// sunucunun ret mesajıydı ("sayfayı yenileyin"), tasarım değil.
//
// Ölçüt SAYFANIN İÇİNE gömülü dağıtım kimliği (`window.__STOA_BUILD__`,
// sunucu index.html'i verirken yazıyor); her API yanıtı `X-Stoa-Build`
// taşıyor. Ölçütün API'den değil sayfadan gelmesi şart: ilk API çağrısı
// dağıtımdan SONRA düşerse ölçüt yeni, kod eski olurdu ve fark hiç görülmezdi.

export const YER_TUTUCU = '__STOA_BUILD__';

/** Sayfadaki gömülü değerden ölçüt. Yer tutucu (Vite geliştirme) ya da boş → null: karşılaştırma yok. */
export function surumOlcutu(gomulu) {
  return gomulu && gomulu !== YER_TUTUCU ? gomulu : null;
}

/** Sunucunun bildirdiği kimlik ölçütten farklı mı? Ölçüt ya da kimlik yoksa hayır — bilinmeyen, "yeni" değildir. */
export function yeniSurumVar(olcut, sunucuSurumu) {
  return Boolean(olcut && sunucuSurumu && sunucuSurumu !== olcut);
}
