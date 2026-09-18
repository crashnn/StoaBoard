// Varsayılan rol adlarının görüntülenmesi (kart #208) — saf.
//
// KUSUR: alan kurulurken üç varsayılan rol yalnızca Türkçe adla yazılıyor
// (server/src/routes/workspaces.js: Yönetici / Düzenleyici / Görüntüleyici)
// ve WorkspaceRole'ün tek bir `name` alanı var. İngilizce arayüzde alan açan
// kullanıcı Türkçe rol adları görüyordu. Kolonlar iki dilli tohumlanıyor
// (title + titleTr) — aynı sorun, iki farklı çözüm.
//
// KARAR: şema değişmiyor (kart name + name_tr öneriyordu). Rol adı kullanıcı
// verisi: yeniden adlandırılabiliyor. Yalnızca TOHUMLANAN adla DOKUNULMAMIŞ
// roller gösterilirken sözlükten çevriliyor; kullanıcının verdiği ya da
// değiştirdiği ad olduğu gibi kalıyor. Canlı veriye dokunulmuyor, şema
// göçü yok.
//
// Tohum adları değişirse bu tablo da değişmeli — rolAdi.test (server/test)
// iki listeyi karşılaştırıyor.

export const VARSAYILAN_ROLLER = Object.freeze({
  'Yönetici': 'role_default_admin',
  'Düzenleyici': 'role_default_editor',
  'Görüntüleyici': 'role_default_viewer',
});

/** Rol adını görüntülemek için: varsayılan tohum adıysa çevir, değilse aynen. */
export function rolAdi(ad, ceviri) {
  const anahtar = Object.hasOwn(VARSAYILAN_ROLLER, ad) ? VARSAYILAN_ROLLER[ad] : null;
  if (!anahtar) return ad;
  return ceviri?.(anahtar) || ad;
}
