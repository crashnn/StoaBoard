// Trello panosu → StoaBoard taşınma paketi (saf).
//
// Kart #152'nin ikinci adımı (ilk adım kendi JSON'umuz). Trello'nun pano
// dışa aktarımı herkese açık ve belgeli: Menü → Daha fazla → Yazdır ve dışa
// aktar → JSON (ya da panonun adresine ".json" ekleyerek). Dosya tek pano:
// listeler, kartlar, etiketler, üyeler, kontrol listeleri ve son eylemler.
//
// Bu dosya Trello'yu DOĞRUDAN veritabanına yazmaz. Onu bizim paket
// biçimimize çevirir; sonrası paketiDogrula + POST /import'un var olan
// yazma yolu. Gerekçe: iki yazma yolu iki kör nokta demek. Trello'ya özgü
// her şey (kimlikler, arşiv, renk adları, ObjectId'den tarih) burada bitiyor,
// rotanın Trello diye bir şeyden haberi yok.
//
// KARARLAR (kart #152'deki iki kural burada uygulanıyor):
// - "Bitti" listesini İÇE AKTARAN SEÇER; sistem tahmin etmez. Bu fonksiyon
//   done_list'i parametre alır, adından ("Done", "Tamamlandı") ÇIKARMAZ.
//   Raporlar bitiş kolonuna dayanıyor; yanlış tahmin altı aylık raporu
//   bozar, doğru soru bir kere sorulur.
// - Eşleşmeyen kişi sessizce atanmaz: Trello üyesi adından slug türetilir
//   ("Ayşe Kaya" → ayse-kaya), eşleme alan üyeleri arasında rotada yapılır;
//   eşleşmeyen kartın altına not düşer. Trello kullanıcı adı (username)
//   bizim slug'la ilgisiz, yalnızca yedek.
//
// ARŞİV TAŞINMAZ. Trello'da closed=true kart ya da liste arşivdedir; bizim
// çöp kutumuz nasıl dosyaya girmiyorsa arşiv de girmiyor. Atlanan sayılır
// ve raporda döner — sessiz değil.
//
// TARİHLER: Trello kartın açılış anını ayrı alan olarak vermez; kimliği
// MongoDB ObjectId'dir ve ilk 8 onaltılık hanesi Unix saniyesidir. Oradan
// okunuyor (belgeli, kararlı). Bitiş kolonundaki kartın tamamlanma anı için
// Trello'da alan yok; dateLastActivity kullanılıyor — bitiş listesindeki
// kartın son hareketi çoğunlukla oraya taşınmasıdır. Bu bir yaklaşıklık,
// rapor okuyan bilsin diye burada yazılı.

import { slugify } from './user.js';
import { kolonSlug } from './slug.js';
import { TASINMA_BICIM, TASINMA_SURUM, ICE_SINIR } from './tasinma.js';

/** Trello renk adı → bizim etiket tonu. "_dark"/"_light" ekleri düşer. */
const RENK_TONU = {
  green: 'green', yellow: 'amber', orange: 'orange', red: 'rose', purple: 'purple',
  blue: 'blue', sky: 'cyan', lime: 'teal', pink: 'pink', black: null,
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Dizeyi sınıra kırp; kırpıldıysa sayaç artar. Sessiz kırpma yok. */
function kirp(v, en, sayac, alan) {
  const s = v == null ? '' : String(v);
  if (s.length <= en) return s;
  sayac[alan] = (sayac[alan] || 0) + 1;
  return s.slice(0, en);
}

const gun = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const an = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** ObjectId'nin ilk 8 hanesi Unix saniyesi; değilse null. */
export function objectIdZamani(id) {
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) return null;
  const sn = parseInt(id.slice(0, 8), 16);
  if (!Number.isFinite(sn) || sn <= 0) return null;
  return new Date(sn * 1000).toISOString();
}

/**
 * Dosya Trello pano dışa aktarımına benziyor mu? Kesin bir imza yok
 * (format alanı taşımıyor); listeler + kartlar dizisi ve kartlarda idList
 * yeterli ayırt edici. Bizim paketimiz `format` taşıdığı için karışmaz.
 */
export function trelloMu(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (obj.format) return false;
  if (!Array.isArray(obj.lists) || !Array.isArray(obj.cards)) return false;
  return obj.cards.length === 0 || obj.cards.some((c) => c && typeof c === 'object' && 'idList' in c);
}

/**
 * Listelerin adı ve kimliği — "hangisi bitiş kolonu" sorusunu sormak için.
 * Arşivdekiler dahil değil (taşınmayan liste seçilemez).
 */
export function trelloListeleri(board) {
  if (!trelloMu(board)) return [];
  return board.lists
    .filter((l) => l && typeof l === 'object' && l.closed !== true && typeof l.id === 'string')
    .slice()
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
    .map((l) => ({ id: l.id, name: String(l.name ?? '').trim() || l.id }));
}

/**
 * Trello panosunu pakete çevirir.
 *
 * @param {object} board  Trello pano JSON'u (olduğu gibi ya da istemcide
 *                        kırpılmış: lists, cards, labels, members,
 *                        checklists, actions yeter)
 * @param {object} p
 * @param {string|null} p.doneListId  bitiş listesinin Trello kimliği; null =
 *                        bitiş kolonu yok. undefined KABUL EDİLMEZ — seçim
 *                        bilinçli olmalı.
 * @param {Date}   [p.now]
 * @returns {{ok:true, paket, rapor} | {ok:false, sebep}}
 */
export function trelloPaketi(board, { doneListId, now = new Date() } = {}) {
  if (!trelloMu(board)) return { ok: false, sebep: 'Trello pano dosyası değil (lists ve cards bekleniyor)' };
  if (doneListId === undefined) return { ok: false, sebep: 'bitiş listesi seçilmedi (done_list gerekli; "yok" için null)' };

  const kirpilan = {};
  const rapor = {
    lists: 0, archived_lists: 0, cards: 0, archived_cards: 0, orphan_cards: 0,
    labels: 0, members: 0, checklist_items: 0, comments: 0, truncated: kirpilan,
  };

  // ── Listeler → kolonlar ───────────────────────────────────────────────
  const listeler = (board.lists || []).filter((l) => l && typeof l === 'object' && typeof l.id === 'string');
  const acikListeler = listeler.filter((l) => l.closed !== true).slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  rapor.archived_lists = listeler.length - acikListeler.length;
  rapor.lists = acikListeler.length;
  if (doneListId !== null && !acikListeler.some((l) => l.id === doneListId)) {
    return { ok: false, sebep: 'bitiş listesi panoda yok ya da arşivde' };
  }

  const kolonSluglari = new Set();
  const kolonSlugu = new Map(); // list id → slug
  const columns = acikListeler.map((l, i) => {
    const ad = kirp(String(l.name ?? '').trim() || `Liste ${i + 1}`, ICE_SINIR.name, kirpilan, 'list_names');
    const slug = kolonSlug(ad, kolonSluglari);
    kolonSluglari.add(slug);
    kolonSlugu.set(l.id, slug);
    return { slug, title: ad, title_tr: null, color: null, position: i, is_done: l.id === doneListId, allowed_next: null };
  });

  // ── Etiketler ─────────────────────────────────────────────────────────
  // Trello'da adı boş, yalnızca renkten ibaret etiket olur; adı renk olur.
  // Aynı ada iki etiket (farklı renk) olabilir; slug -2 ile ayrılır.
  const etiketSluglari = new Set();
  const etiketSlugu = new Map(); // label id → slug
  const labels = [];
  for (const l of board.labels || []) {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string') continue;
    const renk = String(l.color || '').toLowerCase().replace(/_(light|dark)$/, '');
    const ad = kirp(String(l.name ?? '').trim() || renk || 'label', ICE_SINIR.name, kirpilan, 'label_names');
    let slug = slugify(ad).slice(0, ICE_SINIR.slug - 4).replace(/-+$/, '') || 'label';
    if (etiketSluglari.has(slug)) { let n = 2; while (etiketSluglari.has(`${slug}-${n}`)) n += 1; slug = `${slug}-${n}`; }
    etiketSluglari.add(slug);
    etiketSlugu.set(l.id, slug);
    labels.push({ slug, name_en: ad, name_tr: ad, color_tone: RENK_TONU[renk] ?? null });
  }
  rapor.labels = labels.length;

  // ── Üyeler ────────────────────────────────────────────────────────────
  const uyeSlugu = new Map(); // member id → slug
  const members = [];
  for (const m of board.members || []) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string') continue;
    const ad = String(m.fullName ?? '').trim();
    const slug = ad ? slugify(ad) : (typeof m.username === 'string' && m.username ? slugify(m.username) : null);
    if (!slug) continue;
    uyeSlugu.set(m.id, slug);
    members.push({ slug, name: ad || m.username || slug, role: null, role_title: null, trello_username: m.username ?? null });
  }
  rapor.members = members.length;

  // ── Kontrol listeleri → alt görevler ──────────────────────────────────
  // Kartta birden fazla kontrol listesi varsa madde başına liste adı öne
  // gelir ("Test: birim"); tek listede ad gereksiz gürültü.
  const kartinListeleri = new Map(); // card id → checklists[]
  for (const cl of board.checklists || []) {
    if (!cl || typeof cl !== 'object' || typeof cl.idCard !== 'string') continue;
    if (!kartinListeleri.has(cl.idCard)) kartinListeleri.set(cl.idCard, []);
    kartinListeleri.get(cl.idCard).push(cl);
  }

  // ── Yorumlar: actions içinden commentCard ─────────────────────────────
  // Trello dışa aktarımı eylemleri en yeniden eskiye ve sınırlı (1000) verir;
  // çok eski yorumlar dosyada olmayabilir. Bu dosyanın sınırı, bizim değil.
  const kartinYorumlari = new Map(); // card id → comments[]
  for (const a of board.actions || []) {
    if (!a || typeof a !== 'object' || a.type !== 'commentCard') continue;
    const kartId = a.data?.card?.id;
    const metin = a.data?.text;
    if (typeof kartId !== 'string' || typeof metin !== 'string' || !metin.trim()) continue;
    if (!kartinYorumlari.has(kartId)) kartinYorumlari.set(kartId, []);
    const kim = a.memberCreator;
    const yazar = kim?.id && uyeSlugu.has(kim.id)
      ? uyeSlugu.get(kim.id)
      : (kim?.fullName ? slugify(kim.fullName) : (kim?.username ? slugify(kim.username) : null));
    kartinYorumlari.get(kartId).push({ author: yazar, text: kirp(metin, ICE_SINIR.comment, kirpilan, 'comments'), created_at: an(a.date) });
  }

  // ── Kartlar ───────────────────────────────────────────────────────────
  const tasks = [];
  const kartlar = (board.cards || []).filter((c) => c && typeof c === 'object');
  for (const c of kartlar) {
    if (c.closed === true) { rapor.archived_cards += 1; continue; }
    const kolon = typeof c.idList === 'string' ? kolonSlugu.get(c.idList) : undefined;
    if (!kolon) {
      // Listesi arşivde ya da yok: kart görünür değil, taşınmaz. Trello
      // liste arşivlenince kartlar closed=false kalır; sayısı ayrı verilir.
      rapor.orphan_cards += 1;
      continue;
    }
    const bitisKolonu = c.idList === doneListId;

    const kartEtiketleri = [];
    const idler = Array.isArray(c.idLabels) && c.idLabels.length
      ? c.idLabels
      : (Array.isArray(c.labels) ? c.labels.map((l) => l?.id) : []);
    for (const id of idler) {
      const s = etiketSlugu.get(id);
      if (s && !kartEtiketleri.includes(s)) kartEtiketleri.push(s);
    }

    const atananlar = [];
    for (const id of Array.isArray(c.idMembers) ? c.idMembers : []) {
      const s = uyeSlugu.get(id);
      if (s && !atananlar.includes(s)) atananlar.push(s);
    }

    const listeler = (kartinListeleri.get(c.id) || []).slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    let altlar = [];
    for (const cl of listeler) {
      const onek = listeler.length > 1 && String(cl.name ?? '').trim() ? `${String(cl.name).trim()}: ` : '';
      const maddeler = (Array.isArray(cl.checkItems) ? cl.checkItems : [])
        .filter((it) => it && typeof it === 'object' && String(it.name ?? '').trim())
        .slice()
        .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
      for (const it of maddeler) {
        altlar.push({ title: kirp(onek + String(it.name).trim(), ICE_SINIR.title, kirpilan, 'subtask_titles'), done: it.state === 'complete', position: altlar.length });
      }
    }
    if (altlar.length > ICE_SINIR.subtasks) { kirpilan.subtask_lists = (kirpilan.subtask_lists || 0) + 1; altlar = altlar.slice(0, ICE_SINIR.subtasks); }
    rapor.checklist_items += altlar.length;

    let yorumlar = (kartinYorumlari.get(c.id) || []).slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    if (yorumlar.length > ICE_SINIR.comments) { kirpilan.comment_lists = (kirpilan.comment_lists || 0) + 1; yorumlar = yorumlar.slice(-ICE_SINIR.comments); }
    rapor.comments += yorumlar.length;

    const acilis = objectIdZamani(c.id) || an(c.dateLastActivity) || an(now);
    tasks.push({
      title: kirp(String(c.name ?? '').trim() || '(başlıksız)', ICE_SINIR.title, kirpilan, 'titles'),
      description: kirp(c.desc ?? '', ICE_SINIR.description, kirpilan, 'descriptions'),
      doc: null,
      priority: 'mid',
      column: kolon,
      labels: kartEtiketleri,
      assignees: atananlar,
      due: gun(c.due),
      start: gun(c.start),
      assignee_dates: null,
      created_by: null,
      created_at: acilis,
      completed_at: bitisKolonu ? (an(c.dateLastActivity) || acilis) : null,
      position: typeof c.pos === 'number' ? c.pos : tasks.length,
      subtasks: altlar,
      comments: yorumlar,
    });
  }
  rapor.cards = tasks.length;

  const panoAdi = kirp(String(board.name ?? '').trim() || 'Trello', ICE_SINIR.name, kirpilan, 'board_name');
  const paket = {
    format: TASINMA_BICIM,
    version: TASINMA_SURUM,
    exported_at: an(now),
    exported_by: null,
    source: 'trello',
    workspace: { name: panoAdi, slug: null },
    members,
    projects: [{ name: panoAdi, color: null, icon: null, columns, labels, tasks }],
    not_included: ['attachments', 'archived_cards', 'archived_lists', 'stickers', 'custom_fields', 'power_ups'],
  };
  return { ok: true, paket, rapor };
}
