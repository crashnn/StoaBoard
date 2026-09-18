#!/usr/bin/env node
/**
 * StoaBoard — geliştirme günlüğü (devlog) panosu
 *
 * Bu dosya REPO DIŞINDADIR ve deploy edilmez.
 *
 * Ne yapar: "StoaBoard Geliştirme" adında ayrı bir proje açar ve bu oturumda
 * gerçekten yapılan işleri kart olarak yazar. Kartları kolonlar arasında
 * ilerletir (geçiş kaydı üretir) ve süre kaydı girer (emek verisi üretir).
 *
 * Neden: raporların dolu görünmesi için gerçek veri gerekir ve veri takvim
 * zamanı ister. Buradaki kartlar uydurma değil — yapılan işin kendisi.
 *
 * ÖNKOŞUL: veritabanı şeması güncellenmiş olmalı (task_transitions, work_logs,
 * tasks.completed_at). Aksi halde süre kaydı 404/500 döner.
 *
 * Kullanım:
 *   node stoa-devlog.mjs               → sadece PLAN gösterir, hiçbir şey yazmaz
 *   node stoa-devlog.mjs --go          → gerçekten oluşturur
 *   node stoa-devlog.mjs --go --reset  → aynı isimli proje varsa yine de ekler
 *
 * Hesap: STOA_A_EMAIL / STOA_A_PASS (ikinci hesap varsa STOA_B_* ile hareket
 * iki kişiye dağıtılır, rapor tek kişilik görünmez).
 */

const BASE = process.env.STOA_URL || 'https://www.stoaboard.com';
const PROJECT_NAME = process.env.STOA_DEVLOG_PROJECT || 'StoaBoard Geliştirme';
const WRITE = process.argv.includes('--go');

const ACC = {
  a: { email: process.env.STOA_A_EMAIL || '', pass: process.env.STOA_A_PASS || '' },
  b: { email: process.env.STOA_B_EMAIL || '', pass: process.env.STOA_B_PASS || '' },
};

class S {
  constructor() { this.jar = new Map(); this.me = null; }
  get cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(m, p, b) {
    const r = await fetch(BASE + p, {
      method: m,
      headers: { 'content-type': 'application/json', ...(this.jar.size ? { cookie: this.cookie } : {}) },
      body: b === undefined ? undefined : JSON.stringify(b),
    });
    for (const c of r.headers.getSetCookie?.() || []) {
      const [n, ...v] = c.split(';')[0].split('=');
      if (n && v.length) this.jar.set(n.trim(), v.join('='));
    }
    const t = await r.text(); let d;
    try { d = t ? JSON.parse(t) : null; } catch { d = t; }
    if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${(d && d.error) || ''}`);
    return d;
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  patch(p, b) { return this.req('PATCH', p, b); }
  async login(e, pw) { const r = await this.post('/api/auth/login', { email: e, password: pw }); this.me = r.user; return r.user; }
}

const log = (...a) => console.log(...a);
const ok = (s) => log('  \x1b[32m✓\x1b[0m ' + s);
const dim = (s) => log('  \x1b[2m' + s + '\x1b[0m');

/**
 * Bu oturumda yapılan iş.
 *
 * to:      kartın duracağı kolon (yol boyunca ara kolonlardan geçirilir)
 * minutes: girilecek emek süresi
 * sub:     alt görevler — ilerleme yüzdesi için
 */
const WORK = [
  {
    title: 'Görev geçiş kaydı tablosu',
    desc: 'Kart bir kolondan diğerine geçtiğinde satır yazılır. Raporlamanın temeli. İlişki (FK) bilerek kurulmadı: görev silinse de kayıt yaşamalı, aksi halde çöp kutusu 30 günde raporu delik bırakır.',
    to: 'done', minutes: 95, priority: 'high',
    sub: ['Şema modeli', 'Taşıma ucuna bağlama', 'Kart açılışını da geçiş say'],
  },
  {
    title: 'Görevlere tamamlanma zamanı alanı',
    desc: '"Bu iş ne kadar sürede tamamlandı" sorusu cevaplanamıyordu, çünkü tamamlanma anı hiçbir yerde tutulmuyordu. Bitiş kolonuna girişte yazılır, çıkışta silinir.',
    to: 'done', minutes: 30, priority: 'high',
    sub: ['Alan eklendi', 'Giriş/çıkış mantığı'],
  },
  {
    title: 'Süre kaydı (work log)',
    desc: 'Kişi göreve harcadığı emeği manuel girer. "90", "1:30", "1s 30d" biçimleri kabul edilir. Geçiş süresiyle karıştırılmamalı: iş üç haftada bitmiş ama altı saat emek almış olabilir.',
    to: 'done', minutes: 120, priority: 'high',
    sub: ['Şema modeli', 'API uçları', 'Çekmece arayüzü', 'Süre biçimi ayrıştırma'],
  },
  {
    title: 'Üç rapor: kişi, dönem, akış',
    desc: 'Kim ne kadar süre harcadı; dönemde ne açıldı ne bitti; işler kaç günde bitiyor ve nerede bekliyor. Toplantıda istenen "6 aylık rapor" bu üçünün aralık seçimiyle karşılanıyor.',
    to: 'review', minutes: 150, priority: 'high',
    sub: ['Sorgu katmanı', 'API uçları', 'Rapor ekranı', 'Aralık ön ayarları'],
  },
  {
    title: 'CSV çıktısı ve yazdırma sayfası',
    desc: 'PDF kütüphanesi bilinçli olarak eklenmedi: yazdırma sayfasını tarayıcı zaten PDF yapıyor. CSV noktalı virgülle ve BOM ile üretiliyor, Türkçe Excel doğru açsın diye.',
    to: 'review', minutes: 55,
    sub: ['CSV üretimi', 'Yazdırma stilleri'],
  },
  {
    title: 'E-posta bildirimi',
    desc: 'SMTP altyapısı zaten kuruluydu ama yalnızca şifre sıfırlamada kullanılıyordu. Atama ve bahsetme bildirimleri postaya bağlandı. Varsayılan KAPALI: NOTIFY_EMAIL=1 verilmeden posta gitmez.',
    to: 'doing', minutes: 45,
    sub: ['Gövde çevirisi', 'Bildirim akışına bağlama', 'Kullanıcı tercihi alanı'],
  },
  {
    title: 'Kolon geçiş kuralı',
    desc: 'Jira ekranındaki "Open → yalnızca In Review" kısıtının karşılığı. Kolona izin verilen sonraki kolonlar tanımlanabiliyor; boş bırakılırsa kısıt yok, mevcut panolar aynen çalışıyor.',
    to: 'doing', minutes: 40,
    sub: ['Şema alanı', 'Sunucu tarafı kontrol'],
  },
  {
    title: 'Yeni projede bitiş kolonu işaretlenmiyordu',
    desc: 'Varsayılan kolonlar oluşturulurken "Tamamlandı" kolonuna bitiş işareti konmuyordu. Bu yüzden yeni projelerde tamamlanan sayacı, ilerlemenin %100 olması ve raporlardaki tamamlanma hiç çalışmıyordu.',
    to: 'done', minutes: 20, priority: 'high',
    sub: ['Hata bulundu', 'Düzeltildi'],
  },
  {
    title: 'Kolon geçiş kuralı arayüzü',
    desc: 'Kuralın panodan tanımlanabilmesi. Sunucu tarafı hazır, arayüz bekliyor.',
    to: 'todo', minutes: 0,
  },
  {
    title: 'Otomatik testler — izin katmanı',
    desc: 'En büyük teknik açık. Başlanacak yer belli: izin kontrolleri ve soket yetkilendirmesi.',
    to: 'backlog', minutes: 0, priority: 'high',
  },
];

// Kartın hedefe giderken geçeceği yol — her adım bir geçiş kaydı üretir.
const PATH = ['backlog', 'todo', 'doing', 'review', 'done'];

async function main() {
  log('');
  log('\x1b[1mStoaBoard — geliştirme günlüğü\x1b[0m');
  log(`  Sunucu : ${BASE}`);
  log(`  Proje  : ${PROJECT_NAME}`);
  log(`  Mod    : ${WRITE ? '\x1b[33mYAZMA (--go)\x1b[0m' : '\x1b[36mPLAN (yazma yok)\x1b[0m'}`);
  log('');

  if (!ACC.a.email || !ACC.a.pass) {
    log('\x1b[31mHesap bilgisi yok.\x1b[0m STOA_A_EMAIL ve STOA_A_PASS ortam değişkenlerini ver.');
    process.exit(1);
  }

  if (!WRITE) {
    log('  Oluşturulacak kartlar:');
    for (const w of WORK) {
      const steps = PATH.slice(0, PATH.indexOf(w.to) + 1);
      dim(`${w.title}`);
      dim(`   yol: ${steps.join(' → ')}  ·  emek: ${w.minutes} dk  ·  alt görev: ${(w.sub || []).length}`);
    }
    log('');
    log(`  Toplam ${WORK.length} kart, ${WORK.reduce((s, w) => s + w.minutes, 0)} dakika emek.`);
    log('  Gerçekten yazmak için: \x1b[1mnode stoa-devlog.mjs --go\x1b[0m');
    log('');
    return;
  }

  const A = new S();
  await A.login(ACC.a.email, ACC.a.pass);
  ok(`giriş: ${A.me?.name || ACC.a.email}`);

  let B = null;
  if (ACC.b.email && ACC.b.pass) {
    try {
      B = new S();
      await B.login(ACC.b.email, ACC.b.pass);
      ok(`giriş: ${B.me?.name || ACC.b.email}`);
    } catch { B = null; dim('ikinci hesaba girilemedi, tek hesapla devam'); }
  }
  const sessions = B ? [A, B] : [A];

  // Proje: varsa kullan, yoksa oluştur
  const projects = await A.get('/api/projects');
  let project = (projects || []).find((p) => p.name === PROJECT_NAME);
  if (!project) {
    project = await A.post('/api/projects', { name: PROJECT_NAME, icon: 'code' });
    ok(`proje oluşturuldu: ${PROJECT_NAME}`);
  } else {
    ok(`mevcut proje kullanılıyor: ${PROJECT_NAME} (#${project.id})`);
  }

  const cols = await A.get(`/api/projects/${project.id}/columns`);
  const bySlug = new Map((cols || []).map((c) => [c.slug, c]));
  const missing = PATH.filter((s) => !bySlug.has(s));
  if (missing.length) {
    log(`\x1b[31mKolonlar eksik:\x1b[0m ${missing.join(', ')} — beklenen varsayılan kolonlar yok.`);
    process.exit(1);
  }

  let made = 0, moves = 0, logged = 0, skipped = 0;

  for (const [i, w] of WORK.entries()) {
    const sess = sessions[i % sessions.length];

    // Kart backlog'da doğar, sonra yol boyunca ilerletilir.
    const task = await sess.post(`/api/projects/${project.id}/tasks`, {
      title: w.title,
      desc: w.desc,
      col: 'backlog',
      priority: w.priority || 'mid',
    });
    made++;

    for (const t of w.sub || []) {
      await sess.post(`/api/tasks/${task.id}/subtasks`, { title: t });
    }

    // Yol: backlog'dan hedefe kadar tek tek. Her adım bir geçiş kaydı.
    const steps = PATH.slice(1, PATH.indexOf(w.to) + 1);
    for (const slug of steps) {
      await sess.patch(`/api/tasks/${task.id}`, { col: slug });
      moves++;
    }

    // Tamamlanan kartların alt görevleri de işaretlensin — ilerleme %100 olsun.
    if (w.to === 'done' && (w.sub || []).length) {
      const detail = await sess.get(`/api/tasks/${task.id}`);
      for (const s of detail.subtasks_detail || []) {
        await sess.patch(`/api/subtasks/${s.id}`, { done: true });
      }
    }

    // Emek kaydı. Şema güncellenmemişse burada patlar, o yüzden yumuşak geç.
    if (w.minutes > 0) {
      try {
        await sess.post(`/api/tasks/${task.id}/worklogs`, {
          minutes: w.minutes,
          note: 'Geliştirme oturumu',
        });
        logged++;
      } catch (e) {
        skipped++;
        if (skipped === 1) {
          dim(`süre kaydı yazılamadı (${e.message}) — şema güncellenmiş mi?`);
        }
      }
    }

    ok(`${w.title}  ·  ${steps.length} geçiş${w.minutes ? `  ·  ${w.minutes} dk` : ''}`);
  }

  log('');
  log(`  \x1b[1m${made}\x1b[0m kart, \x1b[1m${moves}\x1b[0m geçiş, \x1b[1m${logged}\x1b[0m süre kaydı yazıldı.`);
  if (skipped) log(`  \x1b[33m${skipped}\x1b[0m süre kaydı atlandı — veritabanı şeması güncel mi?`);
  log('  Raporlar ekranından "Bu ay" aralığıyla kontrol edebilirsin.');
  log('');
}

main().catch((e) => {
  console.error('\x1b[31mHata:\x1b[0m', e.message);
  process.exit(1);
});
