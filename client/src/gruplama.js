// Liste görünümünde gruplama ölçütü — saf çekirdek.
//
// NİÇİN VAR (2 Ekim 2026 taraması, madde 2): liste görünümü ZATEN
// gruplanıyordu ama ölçüt sabitti — her zaman kolona göre. "Kim neye
// bakıyor" ya da "acil olanlar nerede" sorusu için kartları tek tek
// taramak gerekiyordu.
//
// Taramanın kendi notu bu konuda yarı yanlıştı ("gruplama yok"): grup
// vardı, SEÇİM yoktu. Kodu okumadan yazılan envanter maddesi böyle
// kayabiliyor; düzeltmesi karta işlendi.
//
// ━━ İKİ KARAR, ikisi de gruplamanın anlamını belirliyor ━━
//
// 1. BİR KART BİRDEN ÇOK GRUPTA GÖRÜNEBİLİR (etiket ve atanan için).
//    İki kişiye atanmış bir kart, "atanana göre" gruplamada İKİSİNİN DE
//    altında çıkıyor. Alternatif — yalnızca ilkine koymak — kullanıcının
//    açıkça sorduğu şeyi gizlerdi: "Ayşe'nin işleri" listesinde Ayşe'ye de
//    atanmış bir kart görünmüyorsa liste yalan söyler. Bedeli, grup
//    sayılarının toplamının kart sayısından büyük olabilmesi.
//
// 2. BOŞ GRUP YALNIZCA KOLONDA GÖSTERİLİYOR. Kolonlar panonun yapısıdır ve
//    boş kolona kart eklemek gerekir (grup başlığındaki "+" oradan çalışır).
//    Oysa hiç kartı olmayan bir üyeyi ya da etiketi listelemek yalnızca
//    gürültü üretir.

/** Önceliğin görünme sırası ve ekranda yazacak adı. */
const ONCELIK_SIRASI = [
  { anahtar: 'high', ceviriAnahtari: 'board_priority_high', yedek: 'Yüksek' },
  { anahtar: 'mid', ceviriAnahtari: 'board_priority_medium', yedek: 'Orta' },
  { anahtar: 'low', ceviriAnahtari: 'board_priority_low', yedek: 'Düşük' },
];

/**
 * Görevleri seçilen ölçüte göre gruplar.
 *
 * @param {Array} gorevler
 * @param {'col'|'assignee'|'priority'|'label'} olcut
 * @param {object} p
 * @param {Array} p.kolonlar  `DATA.COLUMNS` — sıra panodaki sıra.
 * @param {Array} p.uyeler    `DATA.MEMBERS`
 * @param {object} p.etiketler `DATA.LABELS` (slug → { tr, tone })
 * @param {(k: string, yedek: string) => string} p.ceviri
 * @param {(c: object) => string} p.kolonAdi Dile göre kolon adı.
 * @returns {Array<{anahtar: string, baslik: string, renk: ?string, kolonId: ?string, gorevler: Array}>}
 */
export function grupla(gorevler, olcut, p = {}) {
  const liste = Array.isArray(gorevler) ? gorevler : [];
  const { kolonlar = [], uyeler = [], etiketler = {}, ceviri, kolonAdi } = p;
  const t = (k, fb) => (typeof ceviri === 'function' ? ceviri(k, fb) : fb);

  if (olcut === 'priority') {
    return ONCELIK_SIRASI
      .map(({ anahtar, ceviriAnahtari, yedek }) => ({
        anahtar: `priority:${anahtar}`,
        baslik: t(ceviriAnahtari, yedek),
        renk: null,
        kolonId: null,
        // Önceliksiz kart "orta" sayılıyor: kartın kendisi de öyle
        // davranıyor (varsayılan `mid`), ayrı bir "önceliksiz" grubu
        // ekranda var olmayan bir ayrım uydururdu.
        gorevler: liste.filter((g) => (g.priority || 'mid') === anahtar),
      }))
      .filter((g) => g.gorevler.length > 0);
  }

  if (olcut === 'assignee') {
    const gruplar = uyeler
      .map((u) => ({
        anahtar: `assignee:${u.id}`,
        baslik: u.name || u.id,
        renk: u.color || null,
        kolonId: null,
        gorevler: liste.filter((g) => (g.assignees || []).includes(u.id)),
      }))
      .filter((g) => g.gorevler.length > 0);

    const atanmamis = liste.filter((g) => !(g.assignees || []).length);
    if (atanmamis.length) {
      gruplar.push({
        anahtar: 'assignee:yok',
        baslik: t('group_unassigned', 'Atanmamış'),
        renk: null,
        kolonId: null,
        gorevler: atanmamis,
      });
    }
    return gruplar;
  }

  if (olcut === 'label') {
    const gruplar = Object.entries(etiketler)
      .map(([slug, lab]) => ({
        anahtar: `label:${slug}`,
        baslik: lab?.tr || slug,
        renk: null,
        kolonId: null,
        gorevler: liste.filter((g) => (g.labels || []).includes(slug)),
      }))
      .filter((g) => g.gorevler.length > 0);

    const etiketsiz = liste.filter((g) => !(g.labels || []).length);
    if (etiketsiz.length) {
      gruplar.push({
        anahtar: 'label:yok',
        baslik: t('group_unlabeled', 'Etiketsiz'),
        renk: null,
        kolonId: null,
        gorevler: etiketsiz,
      });
    }
    return gruplar;
  }

  // Varsayılan: kolon. BOŞ KOLON DA GÖSTERİLİYOR — panonun yapısı ve
  // başlıktaki "+" oradan çalışıyor.
  return kolonlar.map((c) => ({
    anahtar: c.id,
    baslik: typeof kolonAdi === 'function' ? kolonAdi(c) : (c.title || c.id),
    renk: c.color || null,
    kolonId: c.id,
    gorevler: liste.filter((g) => g.col === c.id),
  }));
}

/** Seçicide gösterilecek ölçütler; sıra ekrandaki sıra. */
export const GRUP_OLCUTLERI = [
  { id: 'col', ceviriAnahtari: 'group_by_col', yedek: 'Kolon' },
  { id: 'assignee', ceviriAnahtari: 'group_by_assignee', yedek: 'Atanan' },
  { id: 'priority', ceviriAnahtari: 'group_by_priority', yedek: 'Öncelik' },
  { id: 'label', ceviriAnahtari: 'group_by_label', yedek: 'Etiket' },
];
