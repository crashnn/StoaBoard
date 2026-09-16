// Taşınma: çalışma alanını tek dosyaya çıkarma (ve ileride geri alma).
//
// İkinci toplantının (16 Eylül 2026) tek somut isteği. Trello ya da Jira'dan
// gelen biri panosunu buraya taşıyabilmeli, buradan çıkmak isteyen de alanını
// alıp gidebilmeli. MCP ile kart kart yazmak mümkün ama bir ürün özelliği
// değil, hüner: yüz kartlık pano yüz araç çağrısı. Taşınma tek dosya olmalı.
//
// Bu dosya SAF: veritabanına dokunmaz, yüklenmiş satırları alır ve dışa
// aktarılacak nesneyi üretir. Rota (routes/tasinma.js) yalnızca yükler ve
// çağırır. Saf olduğu için test veritabanı istemiyor ve "dosyada ne var,
// ne yok" sorusu doğrudan test edilebiliyor.
//
// BİÇİM KURALLARI (sürüm 1):
// - İç kimlik (id) YOK. Kart, kolon, etiket ve kişi slug ya da adla anılır;
//   başka sunucuya alınınca kimlikler zaten anlamsız.
// - E-posta YOK. GUVENLIK.md §5: e-posta yalnızca kişinin kendi profilinde.
//   Dışa aktarma yöneticiye açık olsa da dosya elden ele dolaşır; içe
//   aktarmada eşleme slug ve adla yapılır, e-posta gerekmez.
// - Çöp kutusundaki kartlar YOK. Silinmiş olan taşınmaz.
// - Ekler YOK (boyut; ayrı iş). Süre kayıtları ve geçiş kayıtları YOK:
//   raporlama verisi denormalize ve kart kimliğine bağlı, içe aktarmada
//   yeniden kurulamaz; bu dosya panoyu taşır, geçmişi değil. Belgelenmiş.
// - Tarihler ISO 8601 (UTC). Gün alanları YYYY-MM-DD.

import { docDenetle } from './doc.js';
import { docKontrolListesiVarMi } from './checklist.js';

export const TASINMA_BICIM = 'stoaboard-workspace';
export const TASINMA_SURUM = 1;

const gun = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const an = (d) => (d ? new Date(d).toISOString() : null);

/**
 * Çalışma alanı paketi.
 *
 * @param {object} p
 * @param {object} p.workspace  { name, slug }
 * @param {object} p.exportedBy { slug }
 * @param {Array}  p.members    WorkspaceMember + user ({ user: {slug,name}, roleTitle, workspaceRole: {name} })
 * @param {Array}  p.projects   Project + columns + labels
 * @param {Array}  p.tasks      Task + subtasks + comments(+user) + assignees(+user) + labelLinks(+label) + column + creator
 * @param {Date}   [p.now]
 */
export function alanPaketi({ workspace, exportedBy, members, projects, tasks, now = new Date() }) {
  const kolonSlug = new Map(); // column id → slug
  const etiketSlug = new Map(); // label id → slug
  for (const p of projects) {
    for (const c of p.columns || []) kolonSlug.set(c.id, c.slug);
    for (const l of p.labels || []) etiketSlug.set(l.id, l.slug);
  }

  const kartlar = new Map(); // project id → tasks[]
  for (const t of tasks) {
    if (t.deletedAt) continue; // çöp taşınmaz
    if (!kartlar.has(t.projectId)) kartlar.set(t.projectId, []);
    kartlar.get(t.projectId).push({
      title: t.title,
      description: t.description || '',
      // Blok gövdesi dizi; eski bir kayıtta başka şekil kaldıysa dosyaya
      // girmesin (içe aktarma katı, gidiş-dönüş bozulmasın).
      doc: Array.isArray(t.doc) ? t.doc : null,
      priority: t.priority || 'mid',
      column: t.columnId != null ? (kolonSlug.get(t.columnId) ?? null) : null,
      labels: (t.labelLinks || []).map((ll) => ll.label?.slug).filter(Boolean),
      assignees: (t.assignees || []).map((a) => a.user?.slug).filter(Boolean),
      due: gun(t.dueDate),
      start: gun(t.startDate),
      assignee_dates: t.assigneeDates ?? null,
      created_by: t.creator?.slug ?? null,
      created_at: an(t.createdAt),
      completed_at: an(t.completedAt),
      position: t.position ?? null,
      subtasks: (t.subtasks || [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((s) => ({ title: s.title, done: s.done === true, position: s.position ?? null })),
      comments: (t.comments || [])
        .slice()
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
        .map((c) => ({ author: c.user?.slug ?? null, text: c.text, created_at: an(c.createdAt) })),
    });
  }

  return {
    format: TASINMA_BICIM,
    version: TASINMA_SURUM,
    exported_at: an(now),
    exported_by: exportedBy?.slug ?? null,
    workspace: { name: workspace.name, slug: workspace.slug },
    members: (members || []).map((m) => ({
      slug: m.user?.slug ?? null,
      name: m.user?.name ?? null,
      role: m.workspaceRole?.name ?? m.role ?? null,
      role_title: m.roleTitle ?? null,
    })),
    projects: projects.map((p) => ({
      name: p.name,
      color: p.color ?? null,
      icon: p.icon ?? null,
      columns: (p.columns || [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((c) => ({
          slug: c.slug,
          title: c.title,
          title_tr: c.titleTr ?? null,
          color: c.color ?? null,
          position: c.position ?? null,
          is_done: c.isDone === true,
          allowed_next: Array.isArray(c.allowedNext) ? c.allowedNext : null,
        })),
      labels: (p.labels || []).map((l) => ({
        slug: l.slug,
        name_en: l.nameEn,
        name_tr: l.nameTr ?? null,
        color_tone: l.colorTone ?? null,
      })),
      tasks: (kartlar.get(p.id) || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    })),
    // Bilerek dışarıda bırakılanlar, dosyayı okuyan bilsin diye: içe
    // aktarma bunları "kayıp" değil "kapsam dışı" saymalı.
    not_included: ['attachments', 'work_logs', 'transitions', 'notes', 'chat', 'trash'],
  };
}

/** Paketin özet sayıları; denetim kaydına ve yanıt başlığına gider. */
export function paketOzeti(paket) {
  let tasks = 0;
  let comments = 0;
  let subtasks = 0;
  for (const p of paket.projects) {
    tasks += p.tasks.length;
    for (const t of p.tasks) {
      comments += t.comments.length;
      subtasks += t.subtasks.length;
    }
  }
  return { projects: paket.projects.length, tasks, subtasks, comments, members: paket.members.length };
}

/**
 * Dosya adı: alan slug'ı + gün. Slug zaten [a-z0-9-] olduğu için başlığa
 * güvenle girer; yine de her ihtimale karşı süzülüyor (Content-Disposition
 * içine ham metin koymak başlık enjeksiyonu demek).
 */
export function paketDosyaAdi(workspaceSlug, now = new Date(), uzanti = 'json') {
  const guvenli = String(workspaceSlug || 'stoaboard').replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'stoaboard';
  const u = ['json', 'csv', 'md'].includes(uzanti) ? uzanti : 'json';
  return `stoaboard_${guvenli}_${gun(now)}.${u}`;
}

// ─── Öteki biçimler: aynı paketten türetilir ────────────────────────────────
//
// CSV ve Markdown JSON paketinden üretilir, veritabanından değil. Tek kaynak:
// bir alan JSON'a giriyorsa öbür ikisine de giriyor, birinde eksikse üçünde
// eksik. Üç ayrı sorgu üç ayrı kör nokta demek olurdu.
//
// CSV "bakmak" için: kart başına bir satır, Excel'de açılır; alt görev ve
// yorum sayı olarak. Markdown "okumak" için: Notion'un dışa aktarımına benzer
// bir belge. Taşınma için olan JSON; öbür ikisi geri alınamaz, bilerek.

const METIN = {
  tr: {
    project: 'Proje', column: 'Kolon', title: 'Başlık', priority: 'Öncelik', assignees: 'Atananlar',
    labels: 'Etiketler', start: 'Başlangıç', due: 'Bitiş', completed: 'Tamamlanma', description: 'Açıklama',
    subtasks: 'Alt görev', comments: 'Yorum', created_by: 'Oluşturan', created_at: 'Oluşturulma',
    exported: 'Dışa aktarıldı', by: 'aktaran', due_short: 'bitiş', not_included: 'Dosyada olmayanlar',
    empty_column: 'Bu kolonda kart yok.', empty_project: 'Bu projede kart yok.',
    pri: { high: 'yüksek', mid: 'orta', low: 'düşük' },
  },
  en: {
    project: 'Project', column: 'Column', title: 'Title', priority: 'Priority', assignees: 'Assignees',
    labels: 'Labels', start: 'Start', due: 'Due', completed: 'Completed', description: 'Description',
    subtasks: 'Subtasks', comments: 'Comments', created_by: 'Created by', created_at: 'Created at',
    exported: 'Exported', by: 'by', due_short: 'due', not_included: 'Not included',
    empty_column: 'No cards in this column.', empty_project: 'No cards in this project.',
    pri: { high: 'high', mid: 'medium', low: 'low' },
  },
};
const metin = (lang) => METIN[lang === 'en' ? 'en' : 'tr'];

/**
 * Kart başına bir satır. Başlıklar arayüz dilinde; hücre kaçışı ve formül
 * koruması lib/csv.js'te (csvCell), burada yalnızca değerler dizilir.
 */
export function paketCsv(paket, lang = 'tr') {
  const m = metin(lang);
  const headers = [
    m.project, m.column, m.title, m.priority, m.assignees, m.labels, m.start, m.due, m.completed,
    m.description, m.subtasks, m.comments, m.created_by, m.created_at,
  ];
  const rows = [];
  for (const p of paket.projects) {
    const kolonAdi = new Map(p.columns.map((c) => [c.slug, (lang === 'en' ? c.title : c.title_tr || c.title)]));
    for (const t of p.tasks) {
      const bitenAlt = t.subtasks.filter((s) => s.done).length;
      rows.push([
        p.name,
        t.column ? (kolonAdi.get(t.column) ?? t.column) : '',
        t.title,
        m.pri[t.priority] ?? t.priority,
        t.assignees.join(', '),
        t.labels.join(', '),
        t.start ?? '',
        t.due ?? '',
        t.completed_at ? t.completed_at.slice(0, 10) : '',
        t.description ?? '',
        t.subtasks.length ? `${bitenAlt}/${t.subtasks.length}` : '',
        t.comments.length,
        t.created_by ?? '',
        t.created_at ? t.created_at.slice(0, 10) : '',
      ]);
    }
  }
  return { headers, rows };
}

/**
 * Okunabilir belge: alan → proje → kolon → kart. Bitiş kolonundaki kart
 * işaretli kutuyla. Markdown'da özel anlamı olan karakterler kart başlığında
 * kaçışlanmıyor; bu bir belge, bir ayrıştırıcı girdisi değil, ve başlıkta
 * "*" görmek "\*" görmekten iyi.
 */
export function paketMarkdown(paket, lang = 'tr') {
  const m = metin(lang);
  const out = [];
  out.push(`# ${paket.workspace.name}`);
  out.push('');
  out.push(`_${m.exported}: ${paket.exported_at.slice(0, 10)} · StoaBoard${paket.exported_by ? ` · ${m.by} @${paket.exported_by}` : ''}_`);
  out.push('');
  for (const p of paket.projects) {
    out.push(`## ${p.name}`);
    out.push('');
    if (!p.tasks.length) { out.push(m.empty_project); out.push(''); continue; }
    const kolonlar = p.columns.length ? p.columns : [{ slug: null, title: '—', title_tr: '—', is_done: false }];
    for (const c of kolonlar) {
      const kartlar = p.tasks.filter((t) => t.column === c.slug);
      out.push(`### ${lang === 'en' ? c.title : c.title_tr || c.title} (${kartlar.length})`);
      out.push('');
      if (!kartlar.length) { out.push(m.empty_column); out.push(''); continue; }
      for (const t of kartlar) {
        const parcalar = [`**${t.title}**`];
        if (t.priority && t.priority !== 'mid') parcalar.push(m.pri[t.priority] ?? t.priority);
        if (t.assignees.length) parcalar.push(t.assignees.map((a) => `@${a}`).join(', '));
        if (t.labels.length) parcalar.push(t.labels.map((l) => `#${l}`).join(' '));
        if (t.due) parcalar.push(`${m.due_short} ${t.due}`);
        out.push(`- [${c.is_done ? 'x' : ' '}] ${parcalar.join(' · ')}`);
        if (t.description) {
          for (const satir of String(t.description).split(/\r?\n/)) out.push(`  ${satir}`);
        }
        for (const s of t.subtasks) out.push(`  - [${s.done ? 'x' : ' '}] ${s.title}`);
        for (const y of t.comments) {
          const kim = y.author ? `@${y.author}` : '?';
          const ne = y.created_at ? ` (${y.created_at.slice(0, 10)})` : '';
          out.push(`  > ${kim}${ne}: ${String(y.text).replace(/\r?\n/g, ' ')}`);
        }
      }
      out.push('');
    }
  }
  out.push('---');
  out.push(`_${m.not_included}: ${paket.not_included.join(', ')}_`);
  out.push('');
  return out.join('\n');
}

// ─── İçe aktarma: doğrulama (saf) ───────────────────────────────────────────
//
// Dosya dışarıdan geliyor: elden ele dolaşmış, elle düzenlenmiş, başka
// sürümden gelmiş olabilir. Rota hiçbir alanı doğrudan veritabanına yazmaz;
// önce bu denetimden geçer ve denetim İLK hatada durup nerede olduğunu
// söyler ("proje 2 › kart 14: başlık boş"). "Ya hepsi ya hiçbiri" kuralının
// ilk yarısı burada: bozuk dosya tek satır bile yazmadan reddedilir.
//
// Sınırlar, bir kişinin yanlışlıkla ya da kasten yükleyebileceği dosyanın
// veritabanını şişirmesine karşı. Gövde sınırı (10 MB) ayrıca app.js'te.

export const ICE_SINIR = {
  projects: 50,
  columns: 30,
  labels: 50,
  tasks: 5000,        // dosya toplamı
  subtasks: 100,      // kart başına
  comments: 200,      // kart başına
  title: 500,
  name: 100,
  description: 20000,
  comment: 5000,
  slug: 60,
};

const SLUG = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const GUN = /^\d{4}-\d{2}-\d{2}$/;
const ONCELIK = new Set(['high', 'mid', 'low']);

const dize = (v, en) => typeof v === 'string' && v.length <= en;
const gunMu = (v) => v === null || v === undefined || (typeof v === 'string' && GUN.test(v) && !Number.isNaN(Date.parse(v)));
const anMi = (v) => v === null || v === undefined || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));

/**
 * Dönüş: `{ ok: true, ozet }` ya da `{ ok: false, kod, yer, sebep }`.
 *  kod: 'format' | 'version' | 'shape' | 'limit'
 *  yer: insan için konum ("proje 2 › kart 14"), sebep: ne yanlış (Türkçe;
 *       çeviri rotada, kullanıcıya giden metin `message`).
 */
export function paketiDogrula(obj) {
  const hata = (kod, yer, sebep) => ({ ok: false, kod, yer, sebep });
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return hata('shape', 'dosya', 'JSON nesnesi değil');
  if (obj.format !== TASINMA_BICIM) return hata('format', 'dosya', `format "${TASINMA_BICIM}" olmalı`);
  if (obj.version !== TASINMA_SURUM) return hata('version', 'dosya', `sürüm ${TASINMA_SURUM} bekleniyor`);
  if (!Array.isArray(obj.projects)) return hata('shape', 'dosya', 'projects dizi olmalı');
  if (!obj.projects.length) return hata('shape', 'dosya', 'projects boş');
  if (obj.projects.length > ICE_SINIR.projects) return hata('limit', 'dosya', `en fazla ${ICE_SINIR.projects} proje`);

  let toplamKart = 0;
  const ozet = { projects: obj.projects.length, tasks: 0, subtasks: 0, comments: 0 };

  for (let pi = 0; pi < obj.projects.length; pi += 1) {
    const p = obj.projects[pi];
    const yerP = `proje ${pi + 1}`;
    if (!p || typeof p !== 'object') return hata('shape', yerP, 'nesne değil');
    if (!dize(p.name, ICE_SINIR.name) || !p.name.trim()) return hata('shape', yerP, 'ad boş ya da çok uzun');
    if (p.color != null && !dize(p.color, 100)) return hata('shape', yerP, 'renk geçersiz');
    if (p.icon != null && !dize(p.icon, 50)) return hata('shape', yerP, 'simge geçersiz');

    const kolonlar = p.columns ?? [];
    if (!Array.isArray(kolonlar)) return hata('shape', yerP, 'columns dizi olmalı');
    if (kolonlar.length > ICE_SINIR.columns) return hata('limit', yerP, `en fazla ${ICE_SINIR.columns} kolon`);
    const kolonSluglari = new Set();
    for (let ci = 0; ci < kolonlar.length; ci += 1) {
      const c = kolonlar[ci];
      const yerC = `${yerP} › kolon ${ci + 1}`;
      if (!c || typeof c !== 'object') return hata('shape', yerC, 'nesne değil');
      if (typeof c.slug !== 'string' || !SLUG.test(c.slug)) return hata('shape', yerC, 'slug geçersiz (a-z, 0-9, -, _)');
      if (kolonSluglari.has(c.slug)) return hata('shape', yerC, `slug tekrar: ${c.slug}`);
      kolonSluglari.add(c.slug);
      if (!dize(c.title, ICE_SINIR.name) || !c.title.trim()) return hata('shape', yerC, 'başlık boş ya da çok uzun');
      if (c.title_tr != null && !dize(c.title_tr, ICE_SINIR.name)) return hata('shape', yerC, 'title_tr geçersiz');
      if (c.color != null && !dize(c.color, 100)) return hata('shape', yerC, 'renk geçersiz');
      if (c.is_done != null && typeof c.is_done !== 'boolean') return hata('shape', yerC, 'is_done boolean olmalı');
      if (c.allowed_next != null) {
        if (!Array.isArray(c.allowed_next) || c.allowed_next.some((x) => typeof x !== 'string')) return hata('shape', yerC, 'allowed_next slug dizisi olmalı');
      }
    }
    for (const c of kolonlar) {
      for (const x of c.allowed_next || []) {
        if (!kolonSluglari.has(x)) return hata('shape', `${yerP} › kolon ${c.slug}`, `allowed_next bilinmeyen kolon: ${x}`);
      }
    }

    const etiketler = p.labels ?? [];
    if (!Array.isArray(etiketler)) return hata('shape', yerP, 'labels dizi olmalı');
    if (etiketler.length > ICE_SINIR.labels) return hata('limit', yerP, `en fazla ${ICE_SINIR.labels} etiket`);
    const etiketSluglari = new Set();
    for (let li = 0; li < etiketler.length; li += 1) {
      const l = etiketler[li];
      const yerL = `${yerP} › etiket ${li + 1}`;
      if (!l || typeof l !== 'object') return hata('shape', yerL, 'nesne değil');
      if (typeof l.slug !== 'string' || !SLUG.test(l.slug)) return hata('shape', yerL, 'slug geçersiz');
      if (etiketSluglari.has(l.slug)) return hata('shape', yerL, `slug tekrar: ${l.slug}`);
      etiketSluglari.add(l.slug);
      if (!dize(l.name_en, ICE_SINIR.name) || !l.name_en.trim()) return hata('shape', yerL, 'name_en boş ya da çok uzun');
      if (l.name_tr != null && !dize(l.name_tr, ICE_SINIR.name)) return hata('shape', yerL, 'name_tr geçersiz');
      if (l.color_tone != null && !dize(l.color_tone, 50)) return hata('shape', yerL, 'color_tone geçersiz');
    }

    const kartlar = p.tasks ?? [];
    if (!Array.isArray(kartlar)) return hata('shape', yerP, 'tasks dizi olmalı');
    toplamKart += kartlar.length;
    if (toplamKart > ICE_SINIR.tasks) return hata('limit', yerP, `dosya toplamı en fazla ${ICE_SINIR.tasks} kart`);
    for (let ti = 0; ti < kartlar.length; ti += 1) {
      const t = kartlar[ti];
      const yerT = `${yerP} › kart ${ti + 1}`;
      if (!t || typeof t !== 'object') return hata('shape', yerT, 'nesne değil');
      if (!dize(t.title, ICE_SINIR.title) || !t.title.trim()) return hata('shape', yerT, 'başlık boş ya da çok uzun');
      if (t.description != null && !dize(t.description, ICE_SINIR.description)) return hata('shape', yerT, 'açıklama çok uzun ya da dize değil');
      if (t.priority != null && !ONCELIK.has(t.priority)) return hata('shape', yerT, `öncelik high/mid/low olmalı: ${String(t.priority)}`);
      if (t.column != null && !kolonSluglari.has(t.column)) return hata('shape', yerT, `bilinmeyen kolon: ${String(t.column)}`);
      if (t.labels != null) {
        if (!Array.isArray(t.labels)) return hata('shape', yerT, 'labels dizi olmalı');
        for (const x of t.labels) if (!etiketSluglari.has(x)) return hata('shape', yerT, `bilinmeyen etiket: ${String(x)}`);
      }
      if (t.assignees != null && (!Array.isArray(t.assignees) || t.assignees.some((x) => typeof x !== 'string'))) return hata('shape', yerT, 'assignees slug dizisi olmalı');
      if (!gunMu(t.due)) return hata('shape', yerT, 'due YYYY-MM-DD olmalı');
      if (!gunMu(t.start)) return hata('shape', yerT, 'start YYYY-MM-DD olmalı');
      if (!anMi(t.created_at)) return hata('shape', yerT, 'created_at tarih değil');
      if (!anMi(t.completed_at)) return hata('shape', yerT, 'completed_at tarih değil');
      if (t.created_by != null && typeof t.created_by !== 'string') return hata('shape', yerT, 'created_by dize olmalı');
      if (t.position != null && typeof t.position !== 'number') return hata('shape', yerT, 'position sayı olmalı');
      if (t.doc !== undefined) {
        // Alt görevin tek kaynağı tablo (13 Eylül); doc içinde kontrol listesi
        // kabul edilmez, kart açma ucu da reddediyor. Önce bu: docDenetle
        // "bilinmeyen tür" der, bu mesaj nereye yazılacağını da söylüyor.
        if (docKontrolListesiVarMi(t.doc)) return hata('shape', yerT, 'doc içinde kontrol listesi olamaz; alt görevler subtasks alanında');
        const d = docDenetle(t.doc);
        if (!d.ok) return hata('shape', yerT, `doc: ${d.sebep}`);
      }
      const altlar = t.subtasks ?? [];
      if (!Array.isArray(altlar)) return hata('shape', yerT, 'subtasks dizi olmalı');
      if (altlar.length > ICE_SINIR.subtasks) return hata('limit', yerT, `en fazla ${ICE_SINIR.subtasks} alt görev`);
      for (let si = 0; si < altlar.length; si += 1) {
        const a = altlar[si];
        if (!a || typeof a !== 'object' || !dize(a.title, ICE_SINIR.title) || !a.title.trim()) return hata('shape', `${yerT} › alt görev ${si + 1}`, 'başlık boş ya da çok uzun');
        if (a.done != null && typeof a.done !== 'boolean') return hata('shape', `${yerT} › alt görev ${si + 1}`, 'done boolean olmalı');
      }
      const yorumlar = t.comments ?? [];
      if (!Array.isArray(yorumlar)) return hata('shape', yerT, 'comments dizi olmalı');
      if (yorumlar.length > ICE_SINIR.comments) return hata('limit', yerT, `en fazla ${ICE_SINIR.comments} yorum`);
      for (let yi = 0; yi < yorumlar.length; yi += 1) {
        const y = yorumlar[yi];
        if (!y || typeof y !== 'object' || !dize(y.text, ICE_SINIR.comment) || !y.text.trim()) return hata('shape', `${yerT} › yorum ${yi + 1}`, 'metin boş ya da çok uzun');
        if (y.author != null && typeof y.author !== 'string') return hata('shape', `${yerT} › yorum ${yi + 1}`, 'author dize olmalı');
        if (!anMi(y.created_at)) return hata('shape', `${yerT} › yorum ${yi + 1}`, 'created_at tarih değil');
      }
      ozet.tasks += 1;
      ozet.subtasks += altlar.length;
      ozet.comments += yorumlar.length;
    }
  }
  return { ok: true, ozet };
}

/**
 * Doğrulama hatasını kullanıcıya giden cümleye çevirir. Konum ve sebep
 * dosyanın içindeki ada bağlı olduğu için dinamik; iki dilde kalıp burada.
 */
export function dogrulamaMesaji(h, lang = 'tr') {
  const en = lang === 'en';
  const bas = {
    format: en ? 'This is not a StoaBoard export file' : 'Bu bir StoaBoard dışa aktarma dosyası değil',
    version: en ? 'Unsupported file version' : 'Desteklenmeyen dosya sürümü',
    limit: en ? 'File exceeds a limit' : 'Dosya bir sınırı aşıyor',
    shape: en ? 'File is malformed' : 'Dosya bozuk',
  }[h.kod] || (en ? 'File rejected' : 'Dosya reddedildi');
  return `${bas} (${h.yer}: ${h.sebep})`;
}

/**
 * Aynı adlı proje varsa "(2)", "(3)" ekler. İçe aktarma HER ZAMAN yeni proje
 * açar; var olana kart karıştırmak, yanlış dosya yüklendiğinde geri
 * alınamaz bir karmaşa demek. Yeni proje silinebilir, karışmış proje ayıklanamaz.
 */
export function benzersizProjeAdi(ad, mevcutAdlar) {
  const varOlan = new Set([...mevcutAdlar].map((x) => String(x).trim().toLowerCase()));
  const temiz = String(ad).trim();
  if (!varOlan.has(temiz.toLowerCase())) return temiz;
  for (let n = 2; n < 1000; n += 1) {
    const aday = `${temiz} (${n})`.slice(0, ICE_SINIR.name);
    if (!varOlan.has(aday.toLowerCase())) return aday;
  }
  return `${temiz} (${Date.now()})`.slice(0, ICE_SINIR.name);
}
