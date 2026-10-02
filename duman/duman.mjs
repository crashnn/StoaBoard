// Canlı duman testi — tarayıcıda koşan küçük ölçüt kümesi (kart #333).
//
// NİÇİN VAR: 1–2 Ekim 2026'daki doğrulama turunda bulunan iki kusuru
// (#330 gizli pencerenin odağı çalması, #267 jestin ölü olması) HİÇBİR birim
// testi göremezdi. İkisi de yalnızca gerçek tarayıcıda, gerçek olay akışında
// görünüyor: 1067 test ve temiz derleme ikisini de geçirmişti. 15 Eylül'de
// lint için öğrenilen dersin aynısı — "testin göremediğini gören bir katman".
//
// ÇALIŞTIRMA
//
//   cd server && npm run duman          (canlıya karşı)
//   STOA_URL=http://localhost:5000 npm run duman
//
// Önce tarayıcıyı CDP ile açmış olman gerekiyor (açıklaması OKU.md'de).
//
// ÇIKIŞ KODU: 0 geçti · 1 kaldı · 2 ATLANDI/GEÇERSİZ. Üçüncüsü `mcp:tara`
// ile aynı sözleşme: atlanan kontrol geçmiş sayılmaz.
//
// ━━ BU KOŞUMUN DÖRT KURALI, hepsi bedeli ödenmiş ━━
//
// 1. VERİ YAZMAZ. Kart, proje, kanal açmaz; açtığını temizlemek zorunda
//    kalmaz. Bir duman testinin yan etkisi olmamalı. Dil ölçütü yalnızca
//    localStorage'a dokunuyor ve koşu sonunda eski değeri geri yazıyor.
//
// 2. SAYFA YÜKLEMESİNİ KISAR. `/api/auth/me` her yüklemede çağrılıyor ve
//    15 dakikada 300 istekle sınırlı (kart #328). Bu koşum üç yükleme
//    yapıyor ve sayıyı aşağıda basıyor; artarsa görünür olsun.
//
// 3. TARAYICIYI AÇMAZ VE KAPATMAZ. `browser.close()` CDP kipinde
//    KULLANICININ tarayıcısını gerçekten kapatıyor — bir kez öyle kapandı.
//    Oturum gerektiği için kendi tarayıcısını da açmıyor; zaten açık olana
//    bağlanıyor.
//
// 4. GEÇERSİZLİĞİ GEÇMİŞ SAYMAZ. Olumsuz ölçüt ("Türkçe ad görünmüyor")
//    yüzey hiç çizilmediyse de sağlanır. Her ölçüt önce "ölçtüğüm şey
//    gerçekten ekranda mı" sorusunu geçiyor; geçmezse sonuç GEÇERSİZ.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const BASE = (process.env.STOA_URL || 'https://www.stoaboard.com').replace(/\/$/, '');
const CDP = process.env.CDP_URL || 'http://localhost:9222';

const yaz = (...p) => fs.writeSync(1, p.join(' ') + '\n');
const bitir = (kod) => process.exit(kod);

// ── Playwright: BAĞIMLILIK OLARAK EKLENMEDİ ────────────────────────────────
//
// Depoya devDependency olarak girmesi `npm install`a tarayıcı indirmesi
// ekler ve pre-push kancasının ortamını ağırlaştırır. Kart #333 "önce elle
// koşulan bir komut" diyor; o yüzden çalışma anında çözülüyor ve yoksa
// ATLANDI (2) ile çıkılıyor — sessizce geçmek yok.
const require = createRequire(import.meta.url);
let chromium = null;
for (const yol of [process.env.PLAYWRIGHT_YOLU, 'playwright', 'playwright-core'].filter(Boolean)) {
  try {
    ({ chromium } = require(yol));
    break;
  } catch (_) { /* sıradakini dene */ }
}
if (!chromium) {
  yaz('ATLANDI: playwright bulunamadı.');
  yaz('  npx playwright@latest install chromium   (ya da)');
  yaz('  PLAYWRIGHT_YOLU=<playwright paketinin yolu> npm run duman');
  bitir(2);
}

const sonuc = [];
const olc = (ad, durum, not) => sonuc.push({ ad, durum, not });
let yukleme = 0;

let browser;
try {
  browser = await chromium.connectOverCDP(CDP);
} catch (_) {
  yaz(`ATLANDI: ${CDP} adresine bağlanılamadı — tarayıcı CDP ile açık değil.`);
  yaz('  Kurulum: duman/OKU.md');
  bitir(2);
}

const ctx = browser.contexts()[0];
if (!ctx) { yaz('ATLANDI: tarayıcı bağlamı yok.'); bitir(2); }

const kok = new URL(BASE).origin;
const page = ctx.pages().find((p) => !p.isClosed() && p.url().startsWith(kok)) || await ctx.newPage();

async function ac(yol) {
  yukleme += 1;
  await page.goto(BASE + yol, { timeout: 45000 });
  await page.waitForFunction(() => window.SOCKET?.connected === true, null, { timeout: 45000 });
  await page.waitForTimeout(2000);
}

const dilDurumu = () => page.evaluate(() => ({
  lang: localStorage.getItem('stoa.lang'),
  tweaks: localStorage.getItem('stoa.tweaks'),
}));

// Dilin İKİ anahtarı var: `app.jsx` arayüz için `tweaks.locale || stoa.lang`
// okuyor, `data.jsx` (kolonAdi) yalnızca `stoa.lang`. Ayarlar düğmesi ikisini
// BİRLİKTE yazıyor; yalnızca birini yazan bir test, arayüzü İngilizce ama
// kolon adlarını Türkçe gösteren SAHTE bir karışım ölçer.
async function dilAyarla(dil) {
  await page.evaluate((d) => {
    localStorage.setItem('stoa.lang', d);
    const t = JSON.parse(localStorage.getItem('stoa.tweaks') || '{}');
    t.locale = d;
    localStorage.setItem('stoa.tweaks', JSON.stringify(t));
  }, dil);
}

const once = await dilDurumu();

try {
  // ═══ 1 · Taze açılışta odak (kart #330) ═════════════════════════════════
  await ac('/pano');
  const odak = await page.evaluate(() => {
    const ae = document.activeElement;
    return {
      etiket: ae?.tagName || null,
      ph: ae?.getAttribute?.('placeholder') || null,
      yaziAlani: !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable),
    };
  });
  olc('taze açılışta odak bir yazı alanında DEĞİL',
    odak.yaziAlani ? 'KALDI' : 'GEÇTİ',
    `odak ${odak.etiket}${odak.ph ? ` (placeholder: ${odak.ph})` : ''}`);

  // ═══ 2 · Kapalı pencere odağı REDDEDİYOR (kart #330) ════════════════════
  // Birincisi "odak çalınmıyor" diyor, bu "odak alınamaz" diyor — ayrı
  // şeyler. `autoFocus` kaldırılıp `inert` konmasaydı biri geçer, öteki
  // kalırdı.
  const kapali = await page.evaluate(() => {
    const ortu = document.querySelector('.modal-overlay');
    if (!ortu) return { yok: true };
    const alan = ortu.querySelector('input');
    if (!alan) return { alanYok: true };
    alan.focus();
    return {
      inert: ortu.hasAttribute('inert'),
      odakAlabildi: document.activeElement === alan,
      aktif: document.activeElement?.tagName || null,
    };
  });
  olc('kapalı pencerenin alanı PROGRAMLI odağı da alamıyor',
    kapali.yok || kapali.alanYok ? 'GEÇERSİZ'
      : (kapali.inert && !kapali.odakAlabildi ? 'GEÇTİ' : 'KALDI'),
    JSON.stringify(kapali));

  // ═══ 3 · G+tuş gezinmesi (kart #330) ════════════════════════════════════
  // OLUMLU ölçüt, bilerek: 1 ve 2 "odak çalınmıyor" diyor, bu "kısayol
  // gerçekten çalışıyor" diyor. Olumsuz ölçüt mekanizma ölüyken bedava
  // geçer — #267'de tam bu oldu.
  const oncekiYol = await page.evaluate(() => location.pathname);
  await page.evaluate(() => document.body.click());
  await page.keyboard.press('g');
  await page.waitForTimeout(120);
  await page.keyboard.press('d');
  await page.waitForTimeout(1500);
  const sonra = await page.evaluate(() => ({
    yol: location.pathname,
    yazilan: [...document.querySelectorAll('.modal-overlay input')].map((i) => i.value),
  }));
  olc('panoda g,d dashboard görünümüne geçiriyor',
    sonra.yol === '/ana-sayfa' ? 'GEÇTİ' : 'KALDI', `${oncekiYol} → ${sonra.yol}`);
  olc('kısayol tuşları gizli kutuya YAZILMADI',
    sonra.yazilan.every((v) => !v) ? 'GEÇTİ' : 'KALDI', JSON.stringify(sonra.yazilan));

  // ═══ 4 · Kart klavyeye açık ═════════════════════════════════════════════
  // Pano 2 Ekim'e kadar yalnızca fareyle kullanılabiliyordu: kartlar
  // `tabIndex: -1` ve rolsüzdü. Ekran okuyucu için de aynı kapı kapalıydı.
  // Veri yazmıyor: var olan bir karta odaklanıp bırakıyor.
  const kartOdak = await page.evaluate(() => {
    const k = document.querySelector('.card');
    if (!k) return { kartYok: true };
    k.focus();
    return {
      tabIndex: k.tabIndex,
      rol: k.getAttribute('role'),
      etiketVar: !!k.getAttribute('aria-label'),
      kimlikVar: !!k.getAttribute('data-task-id'),
      odakAlabildi: document.activeElement === k,
    };
  });
  if (kartOdak.kartYok) {
    // GEÇERSİZLİK KAPISI: boş panoda "kart odak alamıyor" diye bir şey
    // ölçülemez. Geçti demek, ölçülmemiş bir şeyi geçmiş saymak olurdu.
    olc('kart klavyeye açık (odak + rol + ad)', 'GEÇERSİZ',
      'panoda hiç kart yok — ölçüt bir şey ayırt etmiyor');
  } else {
    olc('kart klavyeye açık (odak + rol + ad)',
      kartOdak.odakAlabildi && kartOdak.tabIndex === 0 && kartOdak.rol === 'button'
        && kartOdak.etiketVar && kartOdak.kimlikVar ? 'GEÇTİ' : 'KALDI',
      JSON.stringify(kartOdak));
  }

  // ═══ 5 · Kolon adları arayüz dilini izliyor (kart #288) ═════════════════
  const TR = ['Yapılacak', 'Devam Ediyor', 'İncelemede'];
  const EN = ['To Do', 'In Progress', 'In Review'];
  const metin = () => page.evaluate(() => document.body.innerText || '');
  const bul = (m, l) => l.filter((a) => m.includes(a));

  await dilAyarla('tr');
  await ac('/pano');
  const trMetin = await metin();
  await dilAyarla('en');
  await ac('/pano');
  const enMetin = await metin();

  const trGoruldu = bul(trMetin, TR);
  const enGoruldu = bul(enMetin, EN);
  const enKalanTr = bul(enMetin, [...TR, 'Tamamlandı']);
  if (trGoruldu.length === 0) {
    // GEÇERSİZLİK KAPISI: Türkçe turda hiç kolon adı görünmediyse yüzey
    // okunamadı ve "İngilizcede Türkçe yok" hiçbir şey kanıtlamaz.
    olc('pano kolon adları arayüz dilini izliyor', 'GEÇERSİZ',
      'Türkçe turunda kolon adı hiç görünmedi — pano çizilmemiş olabilir');
  } else {
    olc('pano kolon adları arayüz dilini izliyor',
      enKalanTr.length === 0 && enGoruldu.length >= trGoruldu.length ? 'GEÇTİ' : 'KALDI',
      `TR: ${JSON.stringify(trGoruldu)} · EN'de kalan TR: ${JSON.stringify(enKalanTr)} · EN: ${JSON.stringify(enGoruldu)}`);
  }
} finally {
  // Dil ayarı kullanıcının kendi seçimi; koşum onu geri yazıyor.
  await page.evaluate((o) => {
    if (o.lang === null) localStorage.removeItem('stoa.lang');
    else localStorage.setItem('stoa.lang', o.lang);
    if (o.tweaks === null) localStorage.removeItem('stoa.tweaks');
    else localStorage.setItem('stoa.tweaks', o.tweaks);
  }, once).catch(() => {});
  // browser.close() YOK — kullanıcının tarayıcısını kapatır (kural 3).
}

yaz('\nStoaBoard duman testi — ' + BASE);
let kaldi = 0;
let gecersiz = 0;
for (const s of sonuc) {
  yaz(`${s.durum.padEnd(9)} ${s.ad}\n          ${s.not}`);
  if (s.durum === 'KALDI') kaldi += 1;
  if (s.durum === 'GEÇERSİZ') gecersiz += 1;
}
yaz(`\nsayfa yüklemesi: ${yukleme} (sınır: IP başına 15 dk / 300 — kart #328)`);
yaz(`${sonuc.length - kaldi - gecersiz} geçti, ${kaldi} kaldı, ${gecersiz} geçersiz`);
if (gecersiz) yaz('GEÇERSİZ ölçüm GEÇTİ sayılmaz.');
bitir(kaldi ? 1 : (gecersiz ? 2 : 0));
