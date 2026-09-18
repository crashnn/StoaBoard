// Çekmecede kartlar arası geçiş — aynı kolonda önceki / sonraki kart (kart #246).
//
// İSTEK (18 Eylül 2026, kullanıcı, Backlog kartlarına yorum yazarken):
// "Kartlar arasında ileri, geri geçişleri olabilir ... çekmecedeki kart
// değişecek. Tüm kolonların kendi içinde olmalı, kart geçişi."
//
// Bir kolonu baştan sona okumak için her kartta çekmeceyi kapatıp panoda
// sonrakine basmak gerekiyordu. Bu modül "sonraki hangisi" sorusunu tek yerden
// cevaplıyor; çekmece de tam sayfa kart da buradan okuyor.
//
// SIRA PANONUN SIRASI: Kanban kolonu kartları `tasks` dizisindeki sırayla
// çiziyor (`views/board.jsx`, Column → `tasks.map`), burada da aynı dizi aynı
// sırayla süzülüyor. Ayrı bir sıralama yok — olsaydı çekmecedeki "sonraki"
// ile panodaki "alttaki" ayrışırdı.
//
// KOLON SINIRI KARARDIR: kolonun sonunda durur, öteki kolona atlamaz.
// Kullanıcı "tüm kolonların kendi içinde" dedi; Backlog'u okurken sessizce
// Yapılacak'a geçmek kullanıcıyı nerede olduğu konusunda yanıltırdı.

/**
 * Açık kartın aynı kolondaki komşularını döner.
 *
 * @param {Array<{id:any, col:string, project_id?:any}>} kartlar panodaki sırayla
 * @param {{id:any, col:string, project_id?:any}|null} kart açık kart
 * @returns {{ onceki: object|null, sonraki: object|null, sira: number, toplam: number }}
 *   `sira` 1 tabanlı; kart listede bulunamazsa 0 ve komşular null.
 */
export function komsuKartlar(kartlar, kart) {
  const bos = { onceki: null, sonraki: null, sira: 0, toplam: 0 };
  if (!kart || !Array.isArray(kartlar)) return bos;

  // Kimlikler sunucudan bazen sayı bazen dize geliyor (soket yayını ile ilk
  // yükleme farklı); eşitlik dize üzerinden, yoksa kart kendi listesinde
  // bulunamaz ve düğmeler sebepsiz yere kapalı kalır.
  const ayniProje = (t) => kart.project_id == null || t.project_id == null
    || String(t.project_id) === String(kart.project_id);
  const kolon = kartlar.filter(t => t.col === kart.col && ayniProje(t));

  const i = kolon.findIndex(t => String(t.id) === String(kart.id));
  if (i === -1) return bos;

  return {
    onceki: i > 0 ? kolon[i - 1] : null,
    sonraki: i < kolon.length - 1 ? kolon[i + 1] : null,
    sira: i + 1,
    toplam: kolon.length,
  };
}
