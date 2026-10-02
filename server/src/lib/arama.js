// Arama sonucunun okunabilir kesiti — saf.
//
// NİÇİN VAR: arama artık açıklama içinde de eşleşiyor (2 Ekim 2026 taraması,
// madde A). Eşleşme açıklamanın ortasındaysa kullanıcıya başlığı göstermek
// yetmiyor — "bu kart niye çıktı?" sorusu cevapsız kalıyor. Kesit, eşleşmenin
// GEÇTİĞİ yeri gösteriyor.
//
// Harf katlama `lib/mcpShape.js` → `katla` ile aynı olmak zorunda, yoksa
// eşleşmeyi bulan kural ile kesiti bulan kural ayrışır: kart listede çıkar
// ama kesit boş gelir. Bu yüzden katlama oradan içe aktarılıyor, burada
// yeniden yazılmıyor.
import { katla } from './mcpShape.js';

const PENCERE = 70;

/**
 * Açıklamada sorgunun geçtiği yerden kısa bir kesit.
 *
 * Eşleşme yoksa (başlıkta eşleşmiş olabilir) açıklamanın başından kesiyor;
 * boş açıklamada `null` dönüyor ve çağıran satırı hiç çizmiyor.
 *
 * @param {string} metin Kartın açıklaması.
 * @param {string} sorgu
 * @returns {string|null}
 */
export function aramaKesiti(metin, sorgu) {
  const ham = String(metin ?? '').replace(/\s+/g, ' ').trim();
  if (!ham) return null;

  const i = katla(ham).indexOf(katla(sorgu).trim());
  if (i === -1) return kirp(ham, 0);

  // Eşleşmeyi ortalamaya çalış: öncesinden biraz bağlam bırak.
  const bas = Math.max(0, i - Math.floor(PENCERE / 3));
  return (bas > 0 ? '…' : '') + kirp(ham.slice(bas), 0);
}

function kirp(metin, bas) {
  const parca = metin.slice(bas, bas + PENCERE);
  if (metin.length <= bas + PENCERE) return parca;
  // Kelimenin ortasından kesme — mcpShape'teki kırpmayla aynı tercih.
  const son = parca.lastIndexOf(' ');
  return (son > PENCERE / 2 ? parca.slice(0, son) : parca) + '…';
}
