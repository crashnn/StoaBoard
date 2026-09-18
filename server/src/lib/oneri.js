// Arama önerileri — saf kural (kart #245).
//
// İSTEK (18 Eylül 2026, kullanıcı): "aramalarda öneri sunulması, sık değişen,
// bakılan, açılan kartlar ... 'en son şunlara baktınız' gibi, ama daha iyi
// versiyon." Palet boşken hiçbir şey önermiyordu.
//
// KARAR (kullanıcı, 18 Eylül): hareket kaydından TÜRET, şema değişikliği yok.
// Yani "son dokundukların" = taşıdığın, yorum yazdığın, açtığın kartlar;
// salt düzenleme (başlık/açıklama) hiçbir yerde kullanıcı+kart olarak kayıtlı
// değil, listeye girmiyor. Cihazlar arası aynı liste — veri sunucuda.
//
// ÜÇ BÖLÜM, her kart yalnızca İLK uyduğu bölümde (tekrar gürültü):
//   1. dokunulan  — kişisel, en yeni önce
//   2. atanmis    — sana atanmış açık kartlar, son hareketi yeni olan önce
//   3. hareketli  — alanda son 48 saatte hareket gören kartlar (herkes)
// Bitmiş ve çöpteki kartlar hiçbir bölüme girmez: dün bitirdiğin kartı en
// üste koymak "son baktıkların"ın zayıf hâli — kartın kendi tarifi.

export const ONERI_SINIRI = 5;
export const HAREKETLI_PENCERE_MS = 48 * 60 * 60 * 1000;

/**
 * @param {object} g
 * @param {Array<{taskId:number, at:Date|string|null}>} g.dokunulan kullanıcının hareketleri (taşıma, yorum, açış)
 * @param {Array<number>} g.atanmis kullanıcıya atanmış kart kimlikleri
 * @param {Array<{taskId:number, at:Date|string|null}>} g.hareketli alandaki bütün hareketler
 * @param {Map<number, object>} g.kartlar görülebilir, açık, silinmemiş kartlar (id → kart)
 * @param {Date} [g.simdi]
 * @param {number} [g.sinir]
 * @returns {{ dokunulan: object[], atanmis: object[], hareketli: object[] }}
 */
export function oneriKur({ dokunulan = [], atanmis = [], hareketli = [], kartlar, simdi = new Date(), sinir = ONERI_SINIRI }) {
  const zaman = (v) => (v ? new Date(v).getTime() : 0);

  // Kart başına EN YENİ hareket; sıralama buna göre.
  const sonHareket = (liste) => {
    const m = new Map();
    for (const h of liste) {
      const id = Number(h.taskId);
      if (!kartlar.has(id)) continue; // bitmiş, çöpte ya da görünmez: hiç girmez
      const t = zaman(h.at);
      if (!m.has(id) || m.get(id) < t) m.set(id, t);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  };

  const verilen = new Set();
  const al = (ids) => {
    const out = [];
    for (const id of ids) {
      if (verilen.has(id) || out.length >= sinir) continue;
      verilen.add(id);
      out.push(kartlar.get(id));
    }
    return out;
  };

  const dokunulanSira = sonHareket(dokunulan);
  const hareketSira = sonHareket(hareketli);
  const hareketZaman = new Map();
  for (const h of hareketli) {
    const id = Number(h.taskId);
    const t = zaman(h.at);
    if (!hareketZaman.has(id) || hareketZaman.get(id) < t) hareketZaman.set(id, t);
  }

  // Atanmışlar: son hareketi olan önce, hiç hareketi olmayan sonda (açılış sırası).
  const atanmisSira = [...new Set(atanmis.map(Number))]
    .filter((id) => kartlar.has(id))
    .sort((a, b) => (hareketZaman.get(b) || 0) - (hareketZaman.get(a) || 0));

  const esik = simdi.getTime() - HAREKETLI_PENCERE_MS;
  const hareketliSira = hareketSira.filter((id) => hareketZaman.get(id) >= esik);

  return {
    dokunulan: al(dokunulanSira),
    atanmis: al(atanmisSira),
    hareketli: al(hareketliSira),
  };
}
