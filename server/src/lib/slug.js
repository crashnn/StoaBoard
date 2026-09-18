// Kolon adresi (slug) — saf (kart #251 aile taraması, 18 Eylül 2026).
//
// Kolon oluşturma adresi `title.toLowerCase().replace(/\s+/g, '-')` ile
// üretiyordu. Üç ayrı kusur, aynı satırda:
//
//   1. "İ" — yerel ayarsız toLowerCase onu "i" + U+0307 (görünmez birleşik
//      nokta) yapıyor. "İncelemede" kolonunun adresi görünmez bir karakter
//      taşıyordu; MCP'de `col` parametresi olarak yazılamıyordu. Kanal
//      adresindeki kusurun (#250) aynısı — düzeltme de aynı fonksiyondan.
//   2. TEKİLLİK yok — şemada (projectId, slug) tekil değil. Aynı adla açılan
//      ikinci kolon aynı adresi alıyor; pano tekrarlayan adresleri elediği
//      için (board.jsx tekKolonlar) ikinci kolon veritabanında durup panoda
//      GÖRÜNMÜYORDU, kartları da hangi kolona ait olduğu belirsizdi.
//   3. UZUNLUK — sütun VarChar(60), adres kırpılmıyordu: 60 karakterden uzun
//      bir kolon adı veritabanı hatasına (500) düşüyordu.
//
// Yalnızca YENİ kolonlar etkilenir; mevcut adreslere dokunulmuyor (kartlar
// ve MCP onları taşıyor).

import { slugifyChannel } from './channels.js';

/** Şemadaki sınır: board_columns.slug VarChar(60). */
export const KOLON_SLUG_AZAMI = 60;

/**
 * Başlıktan, projenin MEVCUT adresleriyle çakışmayan bir adres. Ek (-2, -3…)
 * için yer ayrılıyor: kırpma ekten ÖNCE yapılır, sonuç asla sınırı aşmaz.
 */
export function kolonSlug(baslik, mevcut = new Set()) {
  const taban = slugifyChannel(baslik).slice(0, KOLON_SLUG_AZAMI - 4).replace(/-+$/, '') || 'kolon';
  if (!mevcut.has(taban)) return taban;
  for (let n = 2; ; n++) {
    const aday = `${taban}-${n}`;
    if (!mevcut.has(aday)) return aday;
  }
}
