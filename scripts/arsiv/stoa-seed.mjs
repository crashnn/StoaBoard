#!/usr/bin/env node
/**
 * StoaBoard — demo içerik doldurucu
 *
 * Bu dosya REPO DIŞINDADIR ve deploy edilmez. Senin bilgisayarında çalışır,
 * canlı siteye tarayıcının attığı isteklerin aynısını atar.
 *
 * Kullanım:
 *   node stoa-seed.mjs            → sadece PLAN gösterir, hiçbir şey yazmaz
 *   node stoa-seed.mjs --go       → gerçekten oluşturur
 *
 * Hesap bilgileri: aşağıdaki ACCOUNTS bloğunu doldur ya da ortam değişkeni ver:
 *   STOA_A_EMAIL / STOA_A_PASS / STOA_B_EMAIL / STOA_B_PASS
 */

const BASE = process.env.STOA_URL || 'https://www.stoaboard.com';
const PROJECT_NAME = process.env.STOA_PROJECT || 'Tasarım Projesi';
const CHANNEL = process.env.STOA_CHANNEL || 'general';
const WRITE = process.argv.includes('--go');

const ACCOUNTS = {
  a: {
    email: process.env.STOA_A_EMAIL || 'BURAYA_1_HESAP_EPOSTA',
    pass: process.env.STOA_A_PASS || 'BURAYA_1_HESAP_SIFRE',
  },
  b: {
    email: process.env.STOA_B_EMAIL || 'BURAYA_2_HESAP_EPOSTA',
    pass: process.env.STOA_B_PASS || 'BURAYA_2_HESAP_SIFRE',
  },
};

// ── tarih yardımcıları (bugüne göre, script ne zaman çalışırsa çalışsın taze) ──
const day = 86400000;
const iso = (offset) => new Date(Date.now() + offset * day).toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// İÇERİK — bir tasarım stüdyosunun "Meridyen" adlı fintech müşterisi için işi
// ─────────────────────────────────────────────────────────────────────────────

const TASKS = [
  // ── Teslim ──
  { col: 'Teslim', title: 'Marka keşif atölyesi ve moodboard',
    desc: 'Müşteriyle yarım günlük atölye. Üç yön belirlendi: "güvenilir", "sakin", "hızlı". Moodboard onaylandı.',
    labels: ['UX', 'Onaylı'], who: 'a', start: iso(-24), due: iso(-19), priority: 'mid',
    subtasks: [['Atölye ajandası', 1], ['Katılımcı davetleri', 1], ['Moodboard sunumu', 1]] },

  { col: 'Teslim', title: 'Rakip analizi ve konumlandırma raporu',
    desc: 'Sekiz rakip uygulama incelendi. Ana boşluk: hiçbiri harcama kategorilerini onboarding sırasında sormuyor.',
    labels: ['UX', 'Onaylı'], who: 'b', start: iso(-22), due: iso(-16), priority: 'mid',
    subtasks: [['8 uygulama ekran kaydı', 1], ['Özellik matrisi', 1], ['Sunum', 1]] },

  { col: 'Teslim', title: 'Logo ana yönü — 3 alternatif',
    desc: 'B yönü seçildi. Yatay ve dikey kilit versiyonları teslim edildi.',
    labels: ['Onaylı'], who: 'a', start: iso(-18), due: iso(-11), priority: 'high',
    subtasks: [['Eskizler', 1], ['Dijital 3 alternatif', 1], ['Kilit versiyonlar', 1], ['Kaynak dosya teslimi', 1]],
    comments: [['b', 'B yönü müşteride tartışmasız kazandı. Dikey kilidi favicon için de kullanacağız.'],
               ['a', 'Kaynak dosyaları paylaşılan klasöre attım, .ai ve .svg birlikte.']] },

  // ── Revizyon ──
  { col: 'Revizyon', title: 'Renk paleti — erişilebilirlik kontrolü (AA)',
    desc: 'Birincil mavi, beyaz üstünde 3.9:1 çıkıyor — AA için 4.5 gerekiyor. Tonu koyulaştırıp yeniden ölçülecek.',
    labels: ['UI', 'Revizyon'], who: 'b', start: iso(-6), due: iso(2), priority: 'high',
    subtasks: [['Tüm çiftleri ölç', 1], ['Birincil tonu koyult', 0], ['Karanlık temada tekrar ölç', 0]],
    comments: [['b', 'Birincil mavi AA\'yı geçmiyor. %8 koyultmayı deniyorum, marka hissi bozulmuyor.'],
               ['a', 'Koyult gitsin. Sadece butonlarda değil, bağlantı metinlerinde de kontrol eder misin?'],
               ['b', 'Ediyorum. Bağlantılarda alt çizgi de ekleyeceğim, sadece renge güvenmeyelim.']] },

  { col: 'Revizyon', title: 'Onboarding akışı — 2. tur müşteri notları',
    desc: 'Müşteri adım sayısını 6\'dan 4\'e indirmek istiyor. Kimlik doğrulama adımı birleştirilecek.',
    labels: ['UX', 'Revizyon'], who: 'a', start: iso(-4), due: iso(3), priority: 'high',
    subtasks: [['Adımları yeniden grupla', 1], ['Kimlik + telefon birleştir', 0], ['Akışı yeniden çiz', 0]] },

  // ── Tasarım ──
  { col: 'Tasarım', title: 'Ana ekran (Dashboard) yüksek çözünürlüklü tasarım',
    desc: 'Bakiye kartı, son işlemler, hızlı aksiyonlar. Hem açık hem karanlık tema.',
    labels: ['UI'], who: 'a', start: iso(-3), due: iso(5), priority: 'high',
    subtasks: [['Bakiye kartı', 1], ['Son işlemler listesi', 1], ['Hızlı aksiyon satırı', 0], ['Karanlık tema varyantı', 0]],
    comments: [['a', 'Bakiye kartında tutarı 32pt yaptım, küçük ekranlarda taşmıyor. Bir bakar mısın?']] },

  { col: 'Tasarım', title: 'Kart detay ve harcama grafiği',
    desc: 'Aylık harcama kırılımı. Kategori renkleri paletle uyumlu olmalı, ayrı bir renk seti kurmayalım.',
    labels: ['UI'], who: 'b', start: iso(-2), due: iso(6), priority: 'mid',
    subtasks: [['Grafik tipi kararı', 1], ['Kategori renkleri', 0], ['Boş durum', 0]] },

  { col: 'Tasarım', title: 'Tipografi ölçeği ve metin stilleri',
    desc: '1.25 oranlı ölçek. Başlık, gövde, etiket ve sayısal stiller — sayılarda tabular rakam.',
    labels: ['UI'], who: 'b', start: iso(-1), due: iso(7), priority: 'mid',
    subtasks: [['Ölçeği kur', 1], ['Metin stillerini isimlendir', 0]] },

  { col: 'Tasarım', title: 'İkon seti — 24px hat ikonlar',
    desc: '32 ikon. 1.5px hat kalınlığı, 24px kutu, köşeler 2px yuvarlatma.',
    labels: ['UI'], who: 'a', start: iso(0), due: iso(9), priority: 'low',
    subtasks: [['Gezinme ikonları (8)', 1], ['İşlem ikonları (12)', 0], ['Durum ikonları (12)', 0]] },

  // ── Taslak ──
  { col: 'Taslak', title: 'Para transferi akışı — wireframe',
    desc: 'Kişi seç → tutar → onay → sonuç. Tekrar eden alıcılar için kısayol düşünülecek.',
    labels: ['UX'], who: 'b', start: iso(1), due: iso(10), priority: 'mid',
    subtasks: [['Akış diyagramı', 1], ['4 ekran wireframe', 0]] },

  { col: 'Taslak', title: 'Bildirim merkezi — düşük çözünürlüklü taslak',
    desc: 'Üç tip: işlem, güvenlik, kampanya. Güvenlik bildirimleri her zaman en üstte kalmalı.',
    labels: ['UX'], who: 'a', start: iso(2), due: iso(12), priority: 'low' },

  { col: 'Taslak', title: 'Boş durum illüstrasyonları',
    desc: 'Altı ekran için boş durum. Çizgisel, tek renk, marka mavisiyle.',
    labels: ['UI'], who: 'b', start: iso(3), due: iso(14), priority: 'low',
    subtasks: [['Stil denemesi', 1], ['6 illüstrasyon', 0]] },

  // ── Brief ──
  { col: 'Brief', title: 'Kart başvuru akışı — brief bekleniyor',
    desc: 'Müşteriden yasal metinler ve zorunlu alan listesi gelecek. Gelmeden başlamıyoruz.',
    labels: ['UX'], who: 'a', due: iso(16), priority: 'mid' },

  { col: 'Brief', title: 'Karanlık tema — kapsam ve süre tahmini',
    desc: 'Tüm ekranlar mı, yoksa ilk sürümde sadece ana akışlar mı? Tahmin çıkarılacak.',
    labels: ['UI'], who: 'b', due: iso(18), priority: 'mid' },

  { col: 'Brief', title: 'Erişilebilirlik denetimi — teklif',
    desc: 'Harici denetim mi, biz mi yapalım? Maliyet ve süre karşılaştırması istendi.',
    labels: ['UX'], who: 'a', due: iso(21), priority: 'low' },

  { col: 'Brief', title: 'Pazarlama sayfası — hero bölümü',
    desc: 'Uygulama mağazası yönlendirmesi için tek sayfa. İçerik metni müşteriden gelecek.',
    labels: ['UI'], who: 'b', due: iso(24), priority: 'low' },
];

const NOTES = [
  { who: 'a', title: 'Meridyen — Proje Brief\'i', body:
`# Meridyen — Mobil Bankacılık Uygulaması

**Müşteri:** Meridyen Finans
**Kapsam:** Marka tazeleme + mobil uygulama arayüz tasarımı
**Süre:** 10 hafta

## Hedef
Genç profesyoneller için "sakin" bir bankacılık deneyimi. Rakiplerin hepsi
bildirim ve kampanya bombardımanı yapıyor; bizim ayrıştığımız yer burası olacak.

## Kapsam içi
- Marka kimliği tazeleme (logo, renk, tipografi)
- 24 ekran mobil uygulama tasarımı
- Tasarım sistemi ve bileşen kütüphanesi
- Açık ve karanlık tema

## Kapsam dışı
- Geliştirme
- Pazarlama kampanyası görselleri
- Web uygulaması

## Kilometre taşları
| Aşama | Tarih |
|---|---|
| Keşif ve marka yönü | Tamamlandı |
| Tasarım sistemi | Devam ediyor |
| Ekran tasarımları | Devam ediyor |
| Teslim | 10. hafta |` },

  { who: 'b', title: 'Müşteri Toplantısı — Notlar', body:
`## Katılımcılar
Meridyen tarafı: ürün müdürü, pazarlama müdürü. Bizden: ikimiz.

## Kararlar
- **Logo B yönü onaylandı.** Başka alternatif istenmedi.
- Onboarding **6 adımdan 4 adıma** inecek. Kimlik doğrulama ile telefon
  doğrulama tek adımda birleştirilecek.
- Karanlık tema **ilk sürümde** olacak, sonraya bırakılmayacak.

## Açık konular
- Kart başvurusu için yasal metinler bizde yok, müşteri gönderecek.
- Erişilebilirlik denetimini kim yapacak? Teklif hazırlanacak.

## Bizim aksiyonlar
1. Renk paletini AA seviyesine çek
2. Onboarding akışını yeniden çiz
3. Karanlık tema için süre tahmini çıkar` },

  { who: 'a', title: 'Tasarım Sistemi — Karar Kaydı', body:
`Aldığımız kararları burada tutuyoruz ki üç hafta sonra "niye böyle yapmıştık"
tartışması çıkmasın.

## Renk
Renkleri sabit hex yerine **ton bazlı** tanımlıyoruz. Marka mavisi tek bir
değişkenden türüyor; koyu ve yumuşak varyantlar ondan hesaplanıyor.
Sebep: karanlık tema için ikinci bir palet kurmak zorunda kalmıyoruz.

## Tipografi
1.25 oranlı ölçek. Sayısal alanlarda **tabular rakam** zorunlu — bakiye ve
işlem tutarları alt alta hizalanmalı.

## Boşluk
4px tabanlı. 4 / 8 / 12 / 16 / 24 / 32 / 48. Ara değer kullanmıyoruz.

## Köşe yuvarlatma
Kartlar 12px, butonlar 8px, girdi alanları 8px. İkonlarda 2px.

## Tartışmalı, karara bağlanmadı
- Gölge kullanacak mıyız? Şimdilik sadece kenarlık ile ayırıyoruz.
- Animasyon süresi: 150ms mi 200ms mi?` },

  { who: 'b', title: 'Revizyon Turu 2 — Geri Bildirimler', body:
`Müşteriden gelen maddeler ve durumları.

**1. Bakiye çok küçük görünüyor**
Çözüldü — 32pt'ye çıkarıldı, küçük ekranlarda test edildi.

**2. Mavi biraz soluk**
Zaten erişilebilirlik için koyultuyorduk, iki iş birleşti.

**3. Onboarding uzun**
6 → 4 adım. Devam ediyor.

**4. Harcama grafiğinde kategoriler ayırt edilmiyor**
Kategori renkleri paletten türetiliyor, ton farkı yeterli değil.
Renge ek olarak **desen veya ikon** eklemeyi öneriyorum — renk körlüğü
için de doğru olur.

**5. "Hızlı aksiyonlar" ismini sevmediler**
Alternatif isim bekleniyor. Benim önerim: "Kısayollar".` },
];

const CHAT = [
  ['a', 'Günaydın. Bugün dashboard\'ın karanlık tema varyantına geçiyorum.'],
  ['b', 'Günaydın. Ben de renk paletini bitiriyorum, birincil maviyi koyulttum.'],
  ['b', 'AA\'yı geçti: beyaz üstünde 4.7:1. Karanlık temada da 5.1 çıkıyor.'],
  ['a', 'Çok iyi. Ben de o değeri dashboard\'a alayım, ikimiz ayrı maviyle çalışmayalım.'],
  ['b', 'Paylaşılan dosyayı güncelledim, oradan çek.'],
  ['a', 'Aldım. Bir şey soracağım — bakiye kartında gölge kullanalım mı?'],
  ['b', 'Bence hayır. Karar kaydına "sadece kenarlık" diye yazmıştık, tutarlı kalalım.'],
  ['a', 'Haklısın, kenarlıkla bırakıyorum.'],
  ['b', 'Müşteri "hızlı aksiyonlar" ismini beğenmedi bu arada. Alternatif istiyorlar.'],
  ['a', '"Kısayollar" nasıl? Kısa ve zaten herkesin bildiği bir kelime.'],
  ['b', 'Bana iyi geldi. Perşembe toplantısında önerelim.'],
  ['a', 'Tamam. Onboarding revizyonu ne durumda?'],
  ['b', 'Adımları yeniden grupladım, kimlik + telefon birleşti. Akışı çizmeye başlıyorum.'],
  ['a', 'Süper. Ben ikon setinin gezinme kısmını bitirdim, 8 ikon hazır.'],
  ['b', 'Perşembeye kadar ikisi de yetişir gibi görünüyor.'],
  ['a', 'Yetişir. Cuma teslime rahat gireriz.'],
];

// ─────────────────────────────────────────────────────────────────────────────
// HTTP katmanı — oturum çerezini elle taşıyoruz
// ─────────────────────────────────────────────────────────────────────────────

class Session {
  constructor(label) { this.label = label; this.jar = new Map(); this.me = null; }

  get cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.jar.size ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    // Sunucu çerezi 'stoa_session' adıyla veriyor; yine de gelen her çerezi saklıyoruz.
    for (const c of res.headers.getSetCookie?.() || []) {
      const [name, ...rest] = c.split(';')[0].split('=');
      if (name && rest.length) this.jar.set(name.trim(), rest.join('='));
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || res.status;
      throw new Error(`${method} ${path} → ${res.status} ${msg}`);
    }
    return data;
  }

  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }

  async login(email, pass) {
    const r = await this.post('/api/auth/login', { email, password: pass });
    this.me = r.user;
    return r.user;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const log = (...a) => console.log(...a);
const ok = (s) => log('  \x1b[32m✓\x1b[0m ' + s);
const info = (s) => log('  \x1b[2m·\x1b[0m ' + s);
const warn = (s) => log('  \x1b[33m!\x1b[0m ' + s);

function pick(list, wanted, fields) {
  const norm = (s) => (s || '').toString().toLocaleLowerCase('tr');
  return list.find((x) => fields.some((f) => norm(x[f]) === norm(wanted)));
}

async function main() {
  log('');
  log('\x1b[1mStoaBoard demo doldurucu\x1b[0m');
  log(`  hedef : ${BASE}`);
  log(`  mod   : ${WRITE ? '\x1b[31mYAZMA (--go)\x1b[0m' : '\x1b[36msadece plan (kuru çalıştırma)\x1b[0m'}`);
  log('');

  for (const [k, v] of Object.entries(ACCOUNTS)) {
    if (v.email.startsWith('BURAYA')) {
      warn(`${k.toUpperCase()} hesabı doldurulmamış. Dosyanın başındaki ACCOUNTS bloğunu doldur`);
      warn('veya: STOA_A_EMAIL=... STOA_A_PASS=... STOA_B_EMAIL=... STOA_B_PASS=... node stoa-seed.mjs --go');
      process.exit(1);
    }
  }

  // ── giriş ──
  log('\x1b[1m1. Giriş\x1b[0m');
  const A = new Session('A'), B = new Session('B');
  const ua = await A.login(ACCOUNTS.a.email, ACCOUNTS.a.pass);
  ok(`A: ${ua.name}  (slug: ${ua.id})`);
  const ub = await B.login(ACCOUNTS.b.email, ACCOUNTS.b.pass);
  ok(`B: ${ub.name}  (slug: ${ub.id})`);
  const slugOf = { a: ua.id, b: ub.id };
  const sess = { a: A, b: B };

  // ── keşif ──
  log('');
  log('\x1b[1m2. Çalışma alanı\x1b[0m');
  const boot = await A.get('/api/bootstrap');
  if (boot.needs_workspace) throw new Error('A hesabının çalışma alanı yok.');
  ok(`Çalışma alanı: ${boot.workspace?.name}`);
  const memberSlugs = (boot.members || []).map((m) => m.id || m.slug);
  ok(`Üyeler: ${(boot.members || []).map((m) => m.name).join(', ')}`);
  if (!memberSlugs.includes(ub.id)) {
    warn(`B hesabı (${ub.id}) bu çalışma alanında görünmüyor!`);
    warn('Önce davet koduyla B hesabını odaya ekle, sonra tekrar çalıştır.');
    process.exit(1);
  }

  const projects = await A.get('/api/projects');
  const project = pick(projects, PROJECT_NAME, ['name', 'title']) || projects[0];
  if (!project) throw new Error('Hiç proje yok. Önce arayüzden bir proje aç.');
  ok(`Proje: ${project.name || project.title} (id ${project.id})`);

  const columns = await A.get(`/api/projects/${project.id}/columns`);
  ok(`Kolonlar: ${columns.map((c) => c.title_tr || c.title).join(' → ')}`);

  const labelMap = await A.get(`/api/projects/${project.id}/labels`);
  const labelList = Object.entries(labelMap).map(([slug, v]) => ({ slug, ...(v || {}) }));
  ok(`Etiketler: ${labelList.map((l) => `${l.tr || l.en} [${l.slug}]`).join(', ') || '(yok)'}`);

  // Kuru çalıştırmada da etiket eşleşmesini test et — sessizce düşen olmasın.
  const missing = [...new Set(TASKS.flatMap((t) => t.labels || []))]
    .filter((w) => !pick(labelList, w, ['slug', 'en', 'tr']));
  if (missing.length) warn(`Eşleşmeyen etiket: ${missing.join(', ')}`);

  const colSlug = (want) => {
    const c = pick(columns, want, ['id', 'title', 'title_tr']);
    if (!c) warn(`Kolon bulunamadı: "${want}" → ilk kolona düşecek`);
    return c ? c.id : columns[0]?.id;
  };
  // Etiket sözlüğü {slug: {en, tr, tone}} biçiminde geliyor — üçünden birine bakıyoruz.
  const labelSlug = (want) => {
    const l = pick(labelList, want, ['slug', 'en', 'tr']);
    if (!l) warn(`Etiket bulunamadı, atlanıyor: "${want}"`);
    return l ? l.slug : null;
  };

  // ── plan ──
  log('');
  log('\x1b[1m3. Plan\x1b[0m');
  info(`${TASKS.length} görev  ·  ${TASKS.reduce((n, t) => n + (t.subtasks?.length || 0), 0)} alt görev  ·  ${TASKS.reduce((n, t) => n + (t.comments?.length || 0), 0)} yorum`);
  info(`${NOTES.length} not  ·  ${CHAT.length} sohbet mesajı  (#${CHANNEL})`);

  if (!WRITE) {
    log('');
    log('\x1b[36mKuru çalıştırma bitti — hiçbir şey oluşturulmadı.\x1b[0m');
    log('Gerçekten oluşturmak için:  \x1b[1mnode stoa-seed.mjs --go\x1b[0m');
    log('');
    return;
  }

  // ── görevler ──
  log('');
  log('\x1b[1m4. Görevler\x1b[0m');
  let nTask = 0, nSub = 0, nCom = 0;
  for (const t of TASKS) {
    const s = sess[t.who];
    const payload = {
      title: t.title,
      desc: t.desc || '',
      col: colSlug(t.col),
      priority: t.priority || 'mid',
      assignees: [slugOf[t.who]],
      labels: (t.labels || []).map(labelSlug).filter(Boolean),
    };
    if (t.due) payload.due = t.due;
    if (t.start) payload.start = t.start;

    const created = await s.post(`/api/projects/${project.id}/tasks`, payload);
    const id = created.id ?? created.task?.id;
    nTask++;
    ok(`[${t.col}] ${t.title}`);

    // ÖNEMLİ: önce TÜM alt görevleri oluştur, işaretlemeyi sonra yap.
    // Sunucu ilerlemeyi her PATCH'te "o anki alt görev sayısına" göre hesaplıyor;
    // oluştur-işaretle-oluştur sırası %100 gibi yanlış bir ilerleme bırakıyor.
    const madeSubs = [];
    for (const [title, done] of t.subtasks || []) {
      const st = await s.post(`/api/tasks/${id}/subtasks`, { title });
      nSub++;
      madeSubs.push([st.id ?? st.subtask?.id, done]);
    }
    for (const [stId, done] of madeSubs) {
      if (done && stId) await s.req('PATCH', `/api/subtasks/${stId}`, { done: true });
    }
    for (const [who, text] of t.comments || []) {
      await sess[who].post(`/api/tasks/${id}/comments`, { text });
      nCom++;
    }
  }

  // ── notlar ──
  log('');
  log('\x1b[1m5. Notlar\x1b[0m');
  let nNote = 0;
  for (const n of NOTES) {
    await sess[n.who].post('/api/notes', {
      title: n.title,
      body: n.body,
      visibility: 'workspace',
    });
    nNote++;
    ok(n.title);
  }

  // ── sohbet ──
  log('');
  log('\x1b[1m6. Sohbet\x1b[0m');
  let nMsg = 0;
  for (const [who, text] of CHAT) {
    await sess[who].post('/api/chat/messages', { text, channel: CHANNEL });
    nMsg++;
  }
  ok(`${nMsg} mesaj gönderildi (#${CHANNEL})`);

  log('');
  log('\x1b[1m\x1b[32mBitti.\x1b[0m');
  log(`  ${nTask} görev · ${nSub} alt görev · ${nCom} yorum · ${nNote} not · ${nMsg} mesaj`);
  log(`  ${BASE} adresini aç ve bak.`);
  log('');
}

main().catch((e) => {
  log('');
  console.error('\x1b[31mHATA:\x1b[0m ' + e.message);
  log('');
  process.exit(1);
});
