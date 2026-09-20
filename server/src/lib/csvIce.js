// Genel CSV → StoaBoard taşınma paketi (saf). Kart #152'nin üçüncü adımı.
//
// Trello'nun aksine CSV'nin biçimi yok: Excel'den, Notion'dan, Asana'dan,
// elle yazılmış bir tablodan gelebilir; ayraç virgül, noktalı virgül ya da
// sekme; başlıklar herhangi bir dilde. O yüzden iş iki aşamalı:
//
//   1. ÖNİZLEME — dosya ayrıştırılır, başlıklar ve ilk satırlar döner, hangi
//      sütunun ne olduğu TAHMİN edilir (başlık adından). Kullanıcı eşlemeyi
//      görür ve düzeltir. "Hangi durum değeri bitti demek" sorusu da burada;
//      Trello'daki kuralın aynısı: sistem tahmin etmez, kullanıcı seçer.
//   2. İÇE AKTARMA — aynı dosya, onaylanmış eşlemeyle pakete çevrilir;
//      sonrası kendi paketimizle aynı doğrulama ve yazma yolu.
//
// Bu dosya SAF ve Trello dönüştürücüsüyle aynı sözleşmeyi tutar: kırpma
// sayılır, bilinmeyen değer sessizce yutulmaz (rapor), çıkan paket
// paketiDogrula'dan olduğu gibi geçer.

import { slugify } from './user.js';
import { kolonSlug } from './slug.js';
import { TASINMA_BICIM, TASINMA_SURUM, ICE_SINIR } from './tasinma.js';

/** Paketin kabul ettiği hedef alanlar; title zorunlu, gerisi isteğe bağlı. */
export const CSV_HEDEFLER = ['title', 'description', 'column', 'priority', 'assignees', 'labels', 'due', 'start'];

const AYRACLAR = [',', ';', '\t'];

// ─── Ayrıştırma (RFC 4180 + gevşeklikler) ───────────────────────────────────

/**
 * Ayracı ilk satırdan sayarak seçer: tırnak dışındaki en sık ayraç. Excel
 * Türkçe yerel ayarda noktalı virgül yazar; bizim dışa aktarımımız sekme.
 */
export function ayracTahmini(ilkSatir) {
  let enIyi = ',';
  let enCok = -1;
  for (const a of AYRACLAR) {
    let sayi = 0;
    let tirnak = false;
    for (const ch of ilkSatir) {
      if (ch === '"') tirnak = !tirnak;
      else if (ch === a && !tirnak) sayi += 1;
    }
    if (sayi > enCok) { enCok = sayi; enIyi = a; }
  }
  return enIyi;
}

/**
 * Metni satırlara/hücrelere ayırır. BOM düşer; tırnak içinde ayraç ve satır
 * sonu korunur; "" → ". Boş satırlar atlanır. İlk satır başlık.
 *
 * @returns {{ delimiter, headers: string[], rows: string[][] }}
 */
export function csvAyristir(metin) {
  let s = String(metin ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const ilkSatirSonu = s.search(/\r?\n/);
  const delimiter = ayracTahmini(ilkSatirSonu === -1 ? s : s.slice(0, ilkSatirSonu));

  const satirlar = [];
  let satir = [];
  let hucre = '';
  let tirnak = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (tirnak) {
      if (ch === '"') {
        if (s[i + 1] === '"') { hucre += '"'; i += 1; } else tirnak = false;
      } else hucre += ch;
      continue;
    }
    if (ch === '"') { tirnak = true; continue; }
    if (ch === delimiter) { satir.push(hucre); hucre = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { satir.push(hucre); satirlar.push(satir); satir = []; hucre = ''; continue; }
    hucre += ch;
  }
  if (hucre !== '' || satir.length) { satir.push(hucre); satirlar.push(satir); }

  const dolu = satirlar.filter((r) => r.some((h) => String(h).trim() !== ''));
  if (!dolu.length) return { delimiter, headers: [], rows: [] };
  const headers = dolu[0].map((h, i) => String(h).trim() || `sutun_${i + 1}`);
  const rows = dolu.slice(1).map((r) => {
    const out = r.map((h) => String(h).trim());
    while (out.length < headers.length) out.push('');
    return out.slice(0, headers.length);
  });
  return { delimiter, headers, rows };
}

// ─── Eşleme tahmini ─────────────────────────────────────────────────────────

// Başlık adları küçük harfe ve ASCII'ye indirgenip bakılıyor; sıra önemli:
// ilk eşleşen kazanır, bir başlık yalnızca bir hedefe gider.
const TAHMIN = [
  ['title', ['title', 'baslik', 'name', 'ad', 'gorev', 'task', 'summary', 'ozet', 'konu', 'subject', 'card', 'kart', 'issue']],
  ['description', ['description', 'aciklama', 'desc', 'details', 'detay', 'notes', 'not', 'body', 'icerik', 'content']],
  ['column', ['column', 'kolon', 'status', 'durum', 'list', 'liste', 'stage', 'asama', 'state', 'lane']],
  ['priority', ['priority', 'oncelik', 'importance', 'onem', 'severity']],
  ['assignees', ['assignees', 'assignee', 'atananlar', 'atanan', 'owner', 'sahip', 'sorumlu', 'assigned', 'members', 'uyeler', 'kisi', 'person']],
  ['labels', ['labels', 'label', 'etiketler', 'etiket', 'tags', 'tag', 'category', 'kategori', 'type', 'tur']],
  ['due', ['due', 'bitis', 'deadline', 'son tarih', 'due date', 'end', 'termin', 'hedef tarih']],
  ['start', ['start', 'baslangic', 'start date', 'began', 'created', 'olusturulma', 'acilis']],
];

const normal = (h) => slugify(String(h ?? '')).replace(/-/g, ' ');

/** { hedef: başlık dizini } — bulunamayan hedef yok. */
export function eslemeTahmini(headers) {
  const kullanilan = new Set();
  const out = {};
  const adlar = headers.map(normal);
  for (const [hedef, adaylar] of TAHMIN) {
    for (const aday of adaylar) {
      const i = adlar.findIndex((a, idx) => !kullanilan.has(idx) && (a === aday || a.startsWith(`${aday} `) || a.endsWith(` ${aday}`)));
      if (i >= 0) { out[hedef] = i; kullanilan.add(i); break; }
    }
  }
  return out;
}

/** Bir sütunun ayrık değerleri (en fazla `en`), ilk görülme sırasında. */
export function ayrikDegerler(rows, idx, en = 30) {
  const gorulen = [];
  for (const r of rows) {
    const v = String(r[idx] ?? '').trim();
    if (!v || gorulen.includes(v)) continue;
    gorulen.push(v);
    if (gorulen.length > en) return null; // çok fazla: bu bir durum sütunu değil
  }
  return gorulen;
}

/**
 * Önizleme: istemcinin eşleme formunu kurmak için gereken her şey.
 * `distinct` yalnızca 30 ve altı ayrık değeri olan sütunlar için — durum
 * sütunu adayları; "bitti" seçici onlardan kurulur.
 */
export function csvOnizleme(metin) {
  const { delimiter, headers, rows } = csvAyristir(metin);
  if (!headers.length) return { ok: false, sebep: 'dosyada başlık satırı yok' };
  if (rows.length > ICE_SINIR.tasks) return { ok: false, sebep: `en fazla ${ICE_SINIR.tasks} satır` };
  const distinct = {};
  headers.forEach((_, i) => { const d = ayrikDegerler(rows, i); if (d) distinct[i] = d; });
  return {
    ok: true,
    delimiter: delimiter === '\t' ? 'tab' : delimiter,
    headers,
    row_count: rows.length,
    sample: rows.slice(0, 5),
    guess: eslemeTahmini(headers),
    distinct,
  };
}

// ─── Değer çözümleyiciler ───────────────────────────────────────────────────

const ONCELIK = {
  high: 'high', yuksek: 'high', urgent: 'high', acil: 'high', critical: 'high', kritik: 'high', p1: 'high', '1': 'high', highest: 'high',
  low: 'low', dusuk: 'low', minor: 'low', p3: 'low', '3': 'low', lowest: 'low', p4: 'low', '4': 'low',
  mid: 'mid', medium: 'mid', orta: 'mid', normal: 'mid', p2: 'mid', '2': 'mid',
};
export function oncelikCoz(v) {
  const k = normal(v).replace(/\s+/g, '');
  return ONCELIK[k] ?? null;
}

/**
 * Tarih: ISO (2026-09-20, saatli de olur), 20.09.2026, 20/09/2026,
 * 20-09-2026. Eğik çizgili iki haneli biçimde GÜN ÖNCE (Türkçe yerel ayar;
 * 09/20/2026 gibi imkânsız gün → ay/gün olarak ikinci deneme).
 */
export function tarihCoz(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return gecerliGun(m[1], m[2], m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) return gecerliGun(m[3], m[2], m[1]) || gecerliGun(m[3], m[1], m[2]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function gecerliGun(y, a, g) {
  const ay = String(a).padStart(2, '0');
  const gun = String(g).padStart(2, '0');
  const iso = `${y}-${ay}-${gun}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/** "Ayşe Kaya, Mehmet Can" / "ayse;mehmet" → parçalar. */
const liste = (v) => String(v ?? '').split(/[,;|\n]/).map((x) => x.trim()).filter(Boolean);

// ─── Paket ──────────────────────────────────────────────────────────────────

function kirp(v, en, sayac, alan) {
  const s = v == null ? '' : String(v);
  if (s.length <= en) return s;
  sayac[alan] = (sayac[alan] || 0) + 1;
  return s.slice(0, en);
}

/**
 * @param {string} metin       CSV metni
 * @param {object} mapping     { hedef: başlık dizini } — title zorunlu
 * @param {object} p
 * @param {string|null} p.doneValue  durum sütununda "bitti" sayılacak değer;
 *                                   null = bitiş kolonu yok. Sütun eşlenmişse
 *                                   anahtar ZORUNLU (undefined reddedilir).
 * @param {string} [p.name]    proje adı (dosya adı)
 * @param {Date}   [p.now]
 */
export function csvPaketi(metin, mapping, { doneValue, name, now = new Date() } = {}) {
  const { headers, rows } = csvAyristir(metin);
  if (!headers.length) return { ok: false, sebep: 'dosyada başlık satırı yok' };
  if (!mapping || typeof mapping !== 'object') return { ok: false, sebep: 'eşleme yok' };
  const idx = {};
  for (const hedef of CSV_HEDEFLER) {
    const v = mapping[hedef];
    if (v === undefined || v === null || v === '') continue;
    if (!Number.isInteger(v) || v < 0 || v >= headers.length) return { ok: false, sebep: `eşleme geçersiz: ${hedef}` };
    if (Object.values(idx).includes(v)) return { ok: false, sebep: `aynı sütun iki hedefe eşlenmiş: ${headers[v]}` };
    idx[hedef] = v;
  }
  if (idx.title === undefined) return { ok: false, sebep: 'başlık sütunu eşlenmedi' };
  if (idx.column !== undefined && doneValue === undefined) return { ok: false, sebep: 'bitiş değeri seçilmedi (done_value gerekli; "yok" için null)' };
  if (rows.length > ICE_SINIR.tasks) return { ok: false, sebep: `en fazla ${ICE_SINIR.tasks} satır` };

  const kirpilan = {};
  const rapor = { rows: rows.length, cards: 0, skipped_empty_title: 0, unknown_priority: 0, unparsed_dates: 0, columns: 0, labels: 0, truncated: kirpilan };

  // Kolonlar: durum sütunundaki ayrık değerler, ilk görülme sırasında.
  // Sütun eşlenmemişse tek kolon; bitiş yok.
  const kolonSluglari = new Set();
  const kolonSlugu = new Map(); // değer → slug
  const columns = [];
  const kolonEkle = (deger, isDone) => {
    const ad = kirp(deger, ICE_SINIR.name, kirpilan, 'column_names');
    const slug = kolonSlug(ad, kolonSluglari);
    kolonSluglari.add(slug);
    kolonSlugu.set(deger, slug);
    columns.push({ slug, title: ad, title_tr: null, color: null, position: columns.length, is_done: isDone, allowed_next: null });
  };
  if (idx.column !== undefined) {
    for (const r of rows) {
      const v = String(r[idx.column] ?? '').trim();
      if (v && !kolonSlugu.has(v)) kolonEkle(v, doneValue !== null && v === doneValue);
    }
    if (doneValue !== null && !kolonSlugu.has(doneValue)) return { ok: false, sebep: 'bitiş değeri dosyada yok' };
  } else {
    kolonEkle('Yapılacak', false);
    columns[0].title = 'To Do';
    columns[0].title_tr = 'Yapılacak';
  }
  const varsayilanKolon = idx.column === undefined ? columns[0].slug : null;

  // Etiketler: dosyada geçtikçe.
  const etiketSluglari = new Set();
  const etiketSlugu = new Map();
  const labels = [];
  const etiket = (ad) => {
    if (etiketSlugu.has(ad)) return etiketSlugu.get(ad);
    let slug = slugify(ad).slice(0, ICE_SINIR.slug - 4).replace(/-+$/, '') || 'label';
    if (etiketSluglari.has(slug)) { let n = 2; while (etiketSluglari.has(`${slug}-${n}`)) n += 1; slug = `${slug}-${n}`; }
    if (labels.length >= ICE_SINIR.labels) return null;
    etiketSluglari.add(slug);
    etiketSlugu.set(ad, slug);
    const temiz = kirp(ad, ICE_SINIR.name, kirpilan, 'label_names');
    labels.push({ slug, name_en: temiz, name_tr: temiz, color_tone: null });
    return slug;
  };

  const tasks = [];
  for (const r of rows) {
    const baslik = String(r[idx.title] ?? '').trim();
    if (!baslik) { rapor.skipped_empty_title += 1; continue; }
    const kolonDeger = idx.column !== undefined ? String(r[idx.column] ?? '').trim() : '';
    let oncelik = 'mid';
    if (idx.priority !== undefined && String(r[idx.priority] ?? '').trim()) {
      const p = oncelikCoz(r[idx.priority]);
      if (p) oncelik = p; else rapor.unknown_priority += 1;
    }
    const tarih = (hedef) => {
      if (idx[hedef] === undefined) return null;
      const ham = String(r[idx[hedef]] ?? '').trim();
      if (!ham) return null;
      const t = tarihCoz(ham);
      if (!t) rapor.unparsed_dates += 1;
      return t;
    };
    const kartEtiketleri = [];
    if (idx.labels !== undefined) {
      for (const ad of liste(r[idx.labels])) { const s = etiket(ad); if (s && !kartEtiketleri.includes(s)) kartEtiketleri.push(s); }
    }
    const atananlar = idx.assignees !== undefined
      ? [...new Set(liste(r[idx.assignees]).map((ad) => slugify(ad)))]
      : [];
    tasks.push({
      title: kirp(baslik, ICE_SINIR.title, kirpilan, 'titles'),
      description: kirp(idx.description !== undefined ? r[idx.description] : '', ICE_SINIR.description, kirpilan, 'descriptions'),
      doc: null,
      priority: oncelik,
      column: kolonDeger ? kolonSlugu.get(kolonDeger) : varsayilanKolon,
      labels: kartEtiketleri,
      assignees: atananlar,
      due: tarih('due'),
      start: tarih('start'),
      assignee_dates: null,
      created_by: null,
      created_at: null,
      completed_at: null,
      position: tasks.length,
      subtasks: [],
      comments: [],
    });
  }
  rapor.cards = tasks.length;
  rapor.columns = columns.length;
  rapor.labels = labels.length;

  const projeAdi = kirp(String(name ?? '').trim() || 'CSV', ICE_SINIR.name, kirpilan, 'project_name');
  const paket = {
    format: TASINMA_BICIM,
    version: TASINMA_SURUM,
    exported_at: now.toISOString(),
    exported_by: null,
    source: 'csv',
    workspace: { name: projeAdi, slug: null },
    members: [],
    projects: [{ name: projeAdi, color: null, icon: null, columns, labels, tasks }],
    not_included: ['subtasks', 'comments', 'attachments'],
  };
  return { ok: true, paket, rapor };
}
