// Seed data for StoaBoard

const MEMBERS = [
  { id: 'aliz',  name: 'Aliz Kaya',    role: 'Founder · PM',       initials: 'AK', color: 'oklch(58% 0.13 25)' },
  { id: 'baris', name: 'Barış Demir',  role: 'Eng Lead',           initials: 'BD', color: 'oklch(55% 0.11 230)' },
  { id: 'ceren', name: 'Ceren Yılmaz', role: 'Design',             initials: 'CY', color: 'oklch(55% 0.10 150)' },
  { id: 'deniz', name: 'Deniz Aydın',  role: 'Backend',            initials: 'DA', color: 'oklch(55% 0.14 340)' },
  { id: 'emre',  name: 'Emre Koç',     role: 'Growth',             initials: 'EK', color: 'oklch(60% 0.12 70)'  },
  { id: 'fatma', name: 'Fatma Şen',    role: 'QA',                 initials: 'FŞ', color: 'oklch(50% 0.05 250)' },
];

const LABELS = {
  design:    { en: 'Design',    tr: 'Tasarım',    tone: 'accent' },
  engineering:{ en: 'Eng',      tr: 'Teknik',     tone: 'blue'   },
  backend:   { en: 'Backend',   tr: 'Backend',    tone: 'blue'   },
  frontend:  { en: 'Frontend',  tr: 'Frontend',   tone: 'accent' },
  research:  { en: 'Research',  tr: 'Araştırma',  tone: 'green'  },
  growth:    { en: 'Growth',    tr: 'Büyüme',     tone: 'amber'  },
  urgent:    { en: 'Urgent',    tr: 'Acil',       tone: 'rose'   },
  bug:       { en: 'Bug',       tr: 'Hata',       tone: 'rose'   },
  content:   { en: 'Content',   tr: 'İçerik',     tone: 'green'  },
  infra:     { en: 'Infra',     tr: 'Altyapı',    tone: 'blue'   },
};

const COLUMNS = [
  { id: 'backlog',  title: 'Backlog',       title_tr: 'Bekleyen',      color: 'oklch(55% 0.02 250)' },
  { id: 'todo',     title: 'To Do',         title_tr: 'Yapılacak',     color: 'oklch(55% 0.09 230)' },
  { id: 'doing',    title: 'In Progress',   title_tr: 'Devam Ediyor',  color: 'oklch(65% 0.11 70)'  },
  { id: 'review',   title: 'In Review',     title_tr: 'İncelemede',    color: 'oklch(58% 0.13 10)'  },
  { id: 'done',     title: 'Done',          title_tr: 'Tamamlandı',    color: 'oklch(55% 0.09 150)' },
];

// Helper for date chip (showing only month+day in TR short)
const TR_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
function fmtDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`;
}
function isOverdue(isoDate, statusId) {
  if (!isoDate || statusId === 'done') return false;
  const today = new Date('2026-04-21');
  const d = new Date(isoDate);
  return d < today;
}

const TASKS = [
  // BACKLOG
  { id: 't1', col: 'backlog', title: 'Mobil uygulama keşif görüşmeleri — 12 kullanıcı', desc: 'iOS/Android öncelik kararı için kullanıcı keşif turu. React Native vs Swift tartışması önce.',
    labels: ['research'], priority: 'mid',  assignees: ['aliz','ceren'], due: '2026-05-12', progress: 0, comments: 4, attachments: 2, subtasks: '0/6' },
  { id: 't2', col: 'backlog', title: 'Stripe → Paddle geçiş fizibilitesi', desc: 'AB/UK KDV ve vergi işlemlerini Paddle üzerinden otomatikleştirme.',
    labels: ['backend','growth'], priority: 'low', assignees: ['deniz','emre'], due: '2026-05-20', progress: 0, comments: 2, attachments: 0 },
  { id: 't3', col: 'backlog', title: 'Dark mode: contrast denetimi (WCAG AA)', desc: '',
    labels: ['design'], priority: 'low', assignees: ['ceren'], due: '2026-05-25', progress: 0, comments: 0 },

  // TODO
  { id: 't4', col: 'todo', title: 'Q2 OKR planı — takım hedefleri ve sahipleri', desc: 'Kuruluş hedefleri (kuzey yıldızı: haftalık aktif takım) kart başına eşlenecek.',
    labels: ['research'], priority: 'high', assignees: ['aliz','baris'], due: '2026-04-28', progress: 0, comments: 5, attachments: 1, subtasks: '2/8' },
  { id: 't5', col: 'todo', title: 'Yeni onboarding akışı — empty state + davet kartı', desc: '',
    labels: ['design','frontend'], priority: 'mid',  assignees: ['ceren','baris'], due: '2026-04-30', progress: 0, comments: 2 },
  { id: 't6', col: 'todo', title: '1. Hafta özeti — investor update draft', desc: 'Geçen hafta görevleri, metrik değişimleri, blokerler.',
    labels: ['urgent','content'], priority: 'high', assignees: ['aliz'], due: '2026-04-20', progress: 0, comments: 3 },
  { id: 't7', col: 'todo', title: 'Webhook retry mekanizması (exponential backoff)', desc: '',
    labels: ['backend','infra'], priority: 'mid', assignees: ['deniz'], due: '2026-05-04', progress: 0, comments: 1, attachments: 1 },

  // DOING
  { id: 't8', col: 'doing', title: 'Kanban sürükle-bırak — cross-column persist', desc: 'Drag state server sync ile optimistic update. Conflict resolution cursor tabanlı.',
    labels: ['frontend','engineering'], priority: 'high', assignees: ['baris','ceren'], due: '2026-04-25', progress: 62, comments: 7, attachments: 3, subtasks: '5/8' },
  { id: 't9', col: 'doing', title: 'API rate-limit: Redis token bucket', desc: '',
    labels: ['backend','infra'], priority: 'high', assignees: ['deniz'], due: '2026-04-23', progress: 40, comments: 2, attachments: 1 },
  { id: 't10', col: 'doing', title: 'Takım davet e-postası — copy ve görsel', desc: '',
    labels: ['design','content'], priority: 'mid',  assignees: ['ceren','emre'], due: '2026-04-26', progress: 75, comments: 4 },

  // REVIEW
  { id: 't11', col: 'review', title: 'Dosya yükleme — 20MB limit + S3 presigned URL', desc: '',
    labels: ['backend'], priority: 'mid',  assignees: ['deniz','fatma'], due: '2026-04-22', progress: 90, comments: 3, attachments: 2 },
  { id: 't12', col: 'review', title: 'Komut paleti (⌘K) — first pass', desc: 'Arama + aksiyon + navigasyon. Fuzzy match.',
    labels: ['frontend'], priority: 'mid', assignees: ['baris'], due: '2026-04-21', progress: 95, comments: 6, attachments: 1, subtasks: '7/7' },

  // DONE
  { id: 't13', col: 'done', title: 'Marka sistemi — logo, tipografi, renk skaları', desc: '',
    labels: ['design'], priority: 'low', assignees: ['ceren'], due: '2026-04-14', progress: 100, comments: 9, attachments: 4 },
  { id: 't14', col: 'done', title: 'Auth — Google + magic link', desc: '',
    labels: ['backend','engineering'], priority: 'mid',  assignees: ['deniz','baris'], due: '2026-04-17', progress: 100, comments: 3 },
  { id: 't15', col: 'done', title: 'Landing sayfası v1 yayında', desc: '',
    labels: ['frontend','growth'], priority: 'low',  assignees: ['emre','ceren'], due: '2026-04-10', progress: 100, comments: 2 },
];

// Full task detail for task t8 (rich doc)
const TASK_DETAIL_T8 = {
  id: 't8',
  doc: [
    { kind: 'h2', text: 'Problem' },
    { kind: 'p',  text: 'Takım kullanıcıları bir kartı sürükleyip bıraktığında, sayfa yenilemesinde pozisyon kayboluyor. Ayrıca iki kullanıcı aynı anda aynı kartı farklı kolonlara taşıdığında son yazan kazanıyor — bu sessiz veri kaybına yol açıyor.' },
    { kind: 'h2', text: 'Çözüm' },
    { kind: 'p',  text: 'Optimistic UI + server ack ile ilerliyoruz. Çakışmayı önlemek için kart pozisyonları cursor tabanlı (fractional index) olarak saklanıyor.' },
    { kind: 'checklist', items: [
      { done: true,  text: 'HTML5 drag API ile kart sürükleme' },
      { done: true,  text: 'Kolon hedef algılama ve vurgulama' },
      { done: true,  text: 'Optimistic reorder (local state)' },
      { done: true,  text: 'Sunucuya PATCH + rollback on error' },
      { done: true,  text: 'Fractional index üretimi (jitter\'lı)' },
      { done: false, text: 'Multi-user conflict testi (Playwright)' },
      { done: false, text: 'Keyboard reorder (a11y)' },
      { done: false, text: 'Touch desteği (mobil Safari)' },
    ]},
    { kind: 'h2', text: 'Teknik notlar' },
    { kind: 'pre', text: '// Fractional index oluşturma\nfunction midIndex(prev, next) {\n  if (!prev) return next / 2;\n  if (!next) return prev + 1;\n  return (prev + next) / 2;\n}' },
    { kind: 'p',  text: 'Not: 52+ takibindeki reorder\'dan sonra rebase gerekebilir. Arka planda cron ile normalize edeceğiz.' },
    { kind: 'h2', text: 'Açık sorular' },
    { kind: 'ul', items: [
      'Sürükleme sırasında kolay iptal? (Esc)',
      'Boş kolona bırakma görsel geri bildirimi nasıl olmalı?',
      'Büyük panolarda (500+ kart) performans benchmark\'ı var mı?',
    ]},
    { kind: 'quote', text: 'Bu özellik ürünün temeli — ilk kullanımda kart taşıma deneyimi, kullanıcının ürüne olan güvenini belirliyor.' },
  ],
  comments: [
    { author: 'ceren', time: '2 saat önce', text: 'Touch desteği için `Pointer Events`\'e geçmeyi öneririm — drag API\'den daha temiz.' },
    { author: 'baris', time: '1 saat önce', text: 'Katılıyorum, bugün akşama prototip çıkarırım. @aliz sende fractional index kütüphanesi önerisi var mı?' },
    { author: 'aliz',  time: '34 dk önce', text: '`fractional-indexing` paketi — hafif, battle-tested. Figma ve Linear kullanıyor.' },
  ],
};

// Notifications
const NOTIFICATIONS = [
  { id: 'n1', unread: true,  time: '2 dk önce', text: '<em>Ceren</em> sana bir görev atadı: <strong>Yeni onboarding akışı — empty state + davet kartı</strong>' },
  { id: 'n2', unread: true,  time: '15 dk önce', text: '<em>Barış</em> yorum yazdı: "Touch desteği için Pointer Events\'e geçmeyi öneririm..."' },
  { id: 'n3', unread: true,  time: '1 saat önce', text: '<strong>Q2 OKR planı</strong> kartı <em>İncelemede</em> kolonuna taşındı' },
  { id: 'n4', unread: false, time: '3 saat önce', text: '<em>Deniz</em> <strong>API rate-limit</strong> kartına 2 dosya ekledi' },
  { id: 'n5', unread: false, time: 'dün',        text: '<strong>Auth — Google + magic link</strong> kartı tamamlandı 🎉' },
  { id: 'n6', unread: false, time: '2 gün önce',  text: '<em>Aliz</em> seni <strong>Python Dersi</strong> çalışma alanına davet etti' },
];

// Activity feed for dashboard
const ACTIVITY = [
  { who: 'Barış', time: '5 dk önce', text: '<em>Kanban sürükle-bırak</em> kartında 2 alt görevi tamamladı' },
  { who: 'Ceren', time: '22 dk önce', text: '<em>Onboarding akışı</em> kartına Figma bağlantısı ekledi' },
  { who: 'Aliz',  time: '1 saat önce', text: 'yeni kart oluşturdu: <em>Q2 OKR planı — takım hedefleri</em>' },
  { who: 'Deniz', time: '2 saat önce', text: '<em>Dosya yükleme</em> kartını <strong>İncelemede</strong>\'ye taşıdı' },
  { who: 'Fatma', time: 'dün',         text: '<em>Webhook retry</em> kartında hata raporu bıraktı' },
  { who: 'Emre',  time: '2 gün önce',  text: 'yeni etiket oluşturdu: <em>Growth</em>' },
];

// Chart data — throughput by weekday (current week)
const THROUGHPUT = [
  { day: 'Pzt', done: 3, review: 2, progress: 2 },
  { day: 'Sal', done: 5, review: 1, progress: 3 },
  { day: 'Çar', done: 2, review: 3, progress: 2 },
  { day: 'Per', done: 6, review: 2, progress: 1 },
  { day: 'Cum', done: 4, review: 4, progress: 3 },
  { day: 'Cmt', done: 1, review: 0, progress: 1 },
  { day: 'Paz', done: 0, review: 0, progress: 0 },
];

// Projects in sidebar
const PROJECTS = [
  { id: 'stoa',    name: 'StoaBoard Web',   color: 'oklch(55% 0.13 25)',  open: 14 },
  { id: 'mobile',  name: 'Mobil Uygulama',  color: 'oklch(55% 0.11 230)', open: 7  },
  { id: 'landing', name: 'Marketing Site',  color: 'oklch(60% 0.12 70)',  open: 3  },
  { id: 'brand',   name: 'Marka & İçerik',  color: 'oklch(55% 0.09 150)', open: 5  },
];

// Palette commands
const COMMANDS = [
  { group: 'Navigasyon', items: [
    { label: 'Board\'a git',         icon: 'layoutBoard', action: 'goto:board',     shortcut: 'G B' },
    { label: 'Liste görünümü',       icon: 'list',        action: 'goto:list',      shortcut: 'G L' },
    { label: 'Takvim',               icon: 'calendar',    action: 'goto:calendar',  shortcut: 'G C' },
    { label: 'Dashboard',            icon: 'chart',       action: 'goto:dashboard', shortcut: 'G D' },
    { label: 'Ayarlar',              icon: 'settings',    action: 'goto:settings',  shortcut: 'G S' },
  ]},
  { group: 'Aksiyonlar', items: [
    { label: 'Yeni görev',           icon: 'plus',        action: 'new:task',       shortcut: 'N' },
    { label: 'Yeni kolon',           icon: 'plus',        action: 'new:column' },
    { label: 'Görev ara...',         icon: 'search',      action: 'search' },
    { label: 'Bildirimleri aç',      icon: 'bell',        action: 'open:notifs' },
  ]},
  { group: 'Görünüm', items: [
    { label: 'Temayı değiştir',      icon: 'sparkle',     action: 'toggle:theme' },
    { label: 'Kenar çubuğunu daralt',icon: 'sidebarIn',   action: 'toggle:sidebar' },
    { label: 'Tweaks paneli',        icon: 'settings',    action: 'toggle:tweaks' },
  ]},
  { group: 'Takım', items: [
    { label: 'Üye davet et',         icon: 'userPlus',    action: 'invite' },
    { label: 'Çıkış yap',            icon: 'logOut',      action: 'logout' },
  ]},
];

window.DATA = { MEMBERS, LABELS, COLUMNS, TASKS, TASK_DETAIL_T8, NOTIFICATIONS, ACTIVITY, THROUGHPUT, PROJECTS, COMMANDS, fmtDate, isOverdue, TR_MONTHS };
