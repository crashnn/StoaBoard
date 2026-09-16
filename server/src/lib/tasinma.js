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
