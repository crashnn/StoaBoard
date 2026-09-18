#!/usr/bin/env node
/**
 * StoaBoard — hareket canlandırıcı
 *
 * Kartları bir kolon ileri taşıyarak "task_moved" aktivite kaydı üretir.
 * Ana sayfadaki "Bu hafta ilerleme" grafiği ve "Takım hareketleri" akışı
 * SADECE taşımaları sayıyor — seed ile oluşturulan kartlar oraya düşmez.
 *
 * Sunumdan hemen önce çalıştır: zaman damgaları taze olur.
 *
 *   node stoa-activity.mjs           → sadece plan
 *   node stoa-activity.mjs --go      → taşımaları yap
 *   node stoa-activity.mjs --go --n=12   → kaç kart taşınacağı (varsayılan 10)
 */

const BASE = process.env.STOA_URL || 'https://www.stoaboard.com';
const WRITE = process.argv.includes('--go');
const N = Number((process.argv.find((a) => a.startsWith('--n=')) || '--n=10').slice(4)) || 10;

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

async function main() {
  log('');
  log('\x1b[1mStoaBoard — hareket canlandırıcı\x1b[0m');
  log(`  hedef : ${BASE}`);
  log(`  mod   : ${WRITE ? '\x1b[31mTAŞI (--go)\x1b[0m' : '\x1b[36msadece plan\x1b[0m'}`);
  log('');

  if (!ACC.a.email || !ACC.b.email) {
    log('  STOA_A_EMAIL / STOA_A_PASS / STOA_B_EMAIL / STOA_B_PASS ver.');
    process.exit(1);
  }

  const A = new S(), B = new S();
  await A.login(ACC.a.email, ACC.a.pass);
  await B.login(ACC.b.email, ACC.b.pass);
  const sess = [A, B];

  const projects = await A.get('/api/projects');
  const plan = [];

  for (const p of projects) {
    const cols = await A.get(`/api/projects/${p.id}/columns`);
    const tasks = await A.get(`/api/projects/${p.id}/tasks`);
    // Her projeden, "tamamlandı" olmayan kolonlardaki kartları bir ileri taşı.
    for (const t of tasks) {
      const i = cols.findIndex((c) => c.id === t.col);
      if (i < 0 || i >= cols.length - 1) continue;      // son kolondaysa atla
      if (cols[i].is_done) continue;
      plan.push({ projectId: p.id, project: p.name, id: t.id, title: t.title,
                  from: cols[i].title_tr || cols[i].title,
                  to: cols[i + 1].title_tr || cols[i + 1].title,
                  toSlug: cols[i + 1].id });
    }
  }

  // Projelere dağılsın diye karıştır, sonra N tanesini al
  for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }
  const picked = plan.slice(0, N);

  log(`\x1b[1mPlan\x1b[0m  (${picked.length} taşıma)`);
  for (const m of picked) log(`  \x1b[2m·\x1b[0m [${m.project}] ${m.title}  ${m.from} → ${m.to}`);

  if (!WRITE) {
    log('');
    log('\x1b[36mKuru çalıştırma — hiçbir kart taşınmadı.\x1b[0m');
    log('Taşımak için:  \x1b[1mnode stoa-activity.mjs --go\x1b[0m');
    log('');
    return;
  }

  log('');
  log('\x1b[1mTaşınıyor\x1b[0m');
  let i = 0;
  for (const m of picked) {
    await sess[i % 2].patch(`/api/tasks/${m.id}`, { col: m.toSlug });   // sırayla iki hesap
    ok(`${m.title}  →  ${m.to}`);
    i++;
  }

  log('');
  log('\x1b[1m\x1b[32mBitti.\x1b[0m ' + picked.length + ' kart taşındı.');
  log('  Ana sayfadaki grafik ve "Takım hareketleri" artık dolu olmalı.');
  log('');
}

main().catch((e) => { log(''); console.error('\x1b[31mHATA:\x1b[0m ' + e.message); log(''); process.exit(1); });
