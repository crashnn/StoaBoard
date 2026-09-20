// Dönem karşılaştırması — saf (kart #146, "önceki dönemle karşılaştırma").
//
// Dönem raporu tek başına sayı verir: "9 iş tamamlandı". Yönetici "geçen
// döneme göre?" diye sorar. Önceki dönem = aynı uzunlukta, hemen öncesindeki
// aralık. Seçilen aralık 1-16 Eylül ise önceki 16-31 Ağustos; seçilen 30
// günse önceki 30 gün. Takvim ayı hizalaması YOK: kullanıcı bir ayı tam
// seçtiyse zaten ay uzunluğu çıkıyor, seçmediyse ay uydurmak yanıltır.
//
// Yüzde farkı bölünen sıfırsa tanımsız: 0 → 5 "sonsuz artış" değil, "yeni".
// Bunu istemci "—" ya da "önceki dönemde yok" diye gösterir; sayı uydurmaz.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Seçilen aralığın hemen önündeki, aynı uzunlukta aralık. */
export function oncekiAralik(from, to) {
  const uzunluk = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - uzunluk - 1), to: new Date(from.getTime() - 1) };
}

/** Aralığın gün sayısı (uçlar dahil, tam güne yuvarlanır). */
export function aralikGunu(from, to) {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * İki dönemin sayılarını yan yana koyar.
 *
 * @param {object} simdi   { created, completed, moves, total_minutes }
 * @param {object} onceki  aynı alanlar
 * @returns {{ [alan]: { now, previous, diff, pct } }}
 *   pct: yüzde değişim (tam sayı), önceki sıfırsa null
 */
export function donemFarki(simdi, onceki) {
  const alanlar = ['created', 'completed', 'moves', 'total_minutes'];
  const out = {};
  for (const a of alanlar) {
    const n = Number(simdi?.[a] ?? 0);
    const p = Number(onceki?.[a] ?? 0);
    out[a] = { now: n, previous: p, diff: n - p, pct: p === 0 ? null : Math.round(((n - p) / p) * 100) };
  }
  return out;
}

/**
 * Yönetici özetinin HAM MALZEMESİ: cümle istemcide sözlükten kurulur (dil
 * kuralı), burada yalnızca hangi kalıbın uygun olduğu seçilir. Kalıplar:
 *   'quiet'    — dönemde hiçbir şey olmamış (açılan, biten, hareket yok)
 *   'first'    — önceki dönem boş, karşılaştırma yok
 *   'up'/'down'/'flat' — tamamlanan işin önceki döneme göre yönü
 * `tone` raporun tek cümlesini seçmek için; sayılar ayrıca alanlarda.
 */
export function ozetKalibi(simdi, fark) {
  const bosMu = !simdi.created && !simdi.completed && !simdi.moves;
  if (bosMu) return 'quiet';
  const f = fark.completed;
  if (f.previous === 0 && fark.created.previous === 0 && fark.moves.previous === 0) return 'first';
  if (f.diff > 0) return 'up';
  if (f.diff < 0) return 'down';
  return 'flat';
}
