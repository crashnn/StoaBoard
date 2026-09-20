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
import { slugify } from './user.js';

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

/** Şemadaki sınır: labels.slug VarChar(60). */
export const ETIKET_SLUG_AZAMI = 60;

/**
 * Etiket adresi: addan, ASCII (istemcinin toSlug'ıyla aynı çeviri: ş→s,
 * ı→i…), projenin MEVCUT adresleriyle çakışmayan. Etiketin kimliği sayısal
 * id; kart bağları (task_labels) ona bağlı, adres yalnızca bir tutamaç. Ad
 * değişince adres de değişir (#290) — eskiden kalıyordu ve "feature" adresli
 * "Arka Uç" etiketi gibi tutarsızlıklar MCP'ye ve dışa aktarıma sızıyordu.
 */
export function etiketSlug(ad, mevcut = new Set()) {
  // slugify boş sonuçta 'user' döner (kullanıcı adresi için doğru yedek);
  // harf/rakam içermeyen bir etiket adı ("!!!") burada 'etiket' olsun.
  const ham = /[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(String(ad ?? '')) ? slugify(ad) : '';
  const taban = ham.slice(0, ETIKET_SLUG_AZAMI - 4).replace(/-+$/, '') || 'etiket';
  if (!mevcut.has(taban)) return taban;
  for (let n = 2; ; n++) {
    const aday = `${taban}-${n}`;
    if (!mevcut.has(aday)) return aday;
  }
}
