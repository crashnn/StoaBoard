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
      doc: t.doc ?? null,
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
export function paketDosyaAdi(workspaceSlug, now = new Date()) {
  const guvenli = String(workspaceSlug || 'stoaboard').replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'stoaboard';
  return `stoaboard_${guvenli}_${gun(now)}.json`;
}
