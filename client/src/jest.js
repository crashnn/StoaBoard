// Dokunmatik jestler — tek kaynak (kartlar #238, #265, #267).
//
// #238 kart çekmecesine "yukarıdan aşağı çek → kapat" jestini getirdi ve
// mantık drawer.jsx içinde duruyordu. #267 aynı jesti sohbet paneline, #265
// çekmeceye yatay "kaydır → komşu karta geç" jestini istedi. Üç yerde üç
// kopya, aynı olgunun üç okuyucusu olurdu: eşik biri değişince öbürleri
// ayrışır, "neden kart kapanıyor da sohbet kapanmıyor" sorusu doğar. Karar
// mantığı burada ve SAF (DOM yok, test ediliyor); dokunma işleyicileri de
// burada üretiliyor, bileşenler yalnızca bağlıyor.
//
// ── Ortak kararlar ──────────────────────────────────────────────────────
//
// ÖLÇÜT `pointer: coarse`, ekran genişliği değil (#233, #238): aranan şey
// "dokunmatik mi", "pencere dar mı" değil. Dar bir masaüstü penceresinde
// fareyle sürüklemek jest değildir.
//
// İKİ EŞİK, çünkü iki farklı hareket de aynı anlama geliyor: yavaş ama uzun
// sürükleme ve kısa ama hızlı fiske. Tek eşik ikisinden birini yanlış
// yorumlar. Eşiğin altında hiçbir şey olmuyor; satır içi stil temizlendiği
// için öğe CSS geçişiyle yerine yaylanıyor.
//
// YÖN KİLİDİ: ilk YON_ESIGI_PX piksel hareketin yönünü belirler ve jest o
// yöne kilitlenir. Dikey jest (kapat) ile yatay jest (komşu kart) aynı
// öğede yaşayabiliyor; kilit olmadan eğik bir parmak ikisini birden
// tetiklerdi, dikey kaydırmayla (okuma) da çakışırdı.

/** İlk bu kadar piksel yönü belirler; altında yön yok. */
export const YON_ESIGI_PX = 10;
/** Tarayıcının kenar jesti (Android geri) ekran kenarından başlar; bu payın
 *  içinde başlayan dokunuş bizim değil. */
export const KENAR_PAYI_PX = 20;
/** Uzun sürükleme eşiği: görünür boyutun bu oranı. */
export const UZUN_ORANI = 0.25;
/** Fiske: px/ms hız eşiği ve altındaki mesafede fiske sayılmaz. */
export const FISKE_HIZ = 0.6;
export const FISKE_MIN_PX = 60;
/** Kolon sonunda komşu yokken parmağı izleme oranı — uçta direnç göstergesi. */
export const DIRENC = 0.3;

/**
 * Hareketin yönü. İlk YON_ESIGI_PX altında `null` (henüz karar yok).
 * @returns {'yatay'|'dikey'|null}
 */
export function yonKilidi(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < YON_ESIGI_PX) return null;
  return ax > ay ? 'yatay' : 'dikey';
}

/**
 * Bırakınca "geçti mi": uzun sürükleme YA DA hızlı fiske.
 * @param {{mesafe:number, sure:number, boyut:number}} p mesafe px, süre ms,
 *   boyut görünür alanın ilgili eksendeki uzunluğu
 */
export function esikGecildi({ mesafe, sure, boyut }) {
  const uzun = mesafe > boyut * UZUN_ORANI;
  const fiske = mesafe / Math.max(1, sure) > FISKE_HIZ && mesafe > FISKE_MIN_PX;
  return uzun || fiske;
}

/**
 * Yatay kaydırmanın anlamı. Sola kaydırmak (dx < 0) SONRAKİ kart — galeri
 * alışkanlığı: içerik parmağın gittiği yöne akar, sıradaki sağdan gelir.
 * Yönde komşu yoksa `null`: kolon sonunda durur (#246 kararı).
 * @returns {'onceki'|'sonraki'|null}
 */
export function gecisKarari({ dx, sure, genislik, onceki, sonraki }) {
  const yon = dx < 0 ? 'sonraki' : 'onceki';
  if (yon === 'sonraki' && !sonraki) return null;
  if (yon === 'onceki' && !onceki) return null;
  return esikGecildi({ mesafe: Math.abs(dx), sure, boyut: genislik }) ? yon : null;
}

/** Ekran kenarından başlayan dokunuş tarayıcının; bizim değil. */
export function kenardanMi(x, genislik, pay = KENAR_PAYI_PX) {
  return x < pay || x > genislik - pay;
}

/**
 * Parmağı izlerken kaydırılacak mesafe: yönde komşu varsa birebir, yoksa
 * dirençli (uçta "burası son" hissi).
 */
export function izlemeMesafesi(dx, { onceki, sonraki }) {
  const var_ = dx < 0 ? sonraki : onceki;
  return var_ ? dx : dx * DIRENC;
}

// ── DOM'a bağlı kısım ─────────────────────────────────────────────────────

export function dokunmatikMi() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;
}

/**
 * Bu öğeden başlayan yatay jest DEVRE DIŞI mı? Metin kutusu (imleç
 * taşınır), düzenlenebilir alan, yatay kayan içerik (kod bloğu, tablo — kendi
 * kaydırması var) ve seçili metin (seçimi genişletme jesti) yatay jest değil.
 */
export function yatayJestDisi(el) {
  if (typeof document !== 'undefined') {
    const sel = document.getSelection?.();
    if (sel && !sel.isCollapsed && String(sel).length > 0) return true;
  }
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const tag = n.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable) return true;
    if (n.scrollWidth > n.clientWidth + 1) {
      const ov = typeof getComputedStyle === 'function' ? getComputedStyle(n).overflowX : '';
      if (ov === 'auto' || ov === 'scroll') return true;
    }
  }
  return false;
}

/** Sayfada odak bir yazma alanındaysa (klavye açık) dikey jest kapalı. */
export function yaziliyorMu() {
  const ae = typeof document !== 'undefined' ? document.activeElement : null;
  return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
}

/**
 * Dikey "aşağı çek → kapat" jesti (#238, #267). Başlık/tutamak bölgesine
 * bağlanır; gövdeye değil (uzun içerikte okuma ile çakışır — #238 kararı).
 *
 * @param {{ panel: () => HTMLElement|null, kapat: () => void, etkin?: () => boolean }} p
 *   `panel` kaydırılacak öğe (ref okuyucu), `etkin` ek koşul (örn. yazılmıyor).
 */
export function dikeyCekJesti({ panel, kapat, etkin = () => true }) {
  let j = null;
  const temizle = () => {
    const el = panel();
    if (el) { el.style.transition = ''; el.style.transform = ''; }
  };
  return {
    onTouchStart(e) {
      if (!dokunmatikMi() || e.touches?.length !== 1 || !etkin()) return;
      const t = e.touches[0];
      j = { x0: t.clientX, y0: t.clientY, t0: Date.now(), y: 0, yon: null };
    },
    onTouchMove(e) {
      const el = panel();
      if (!j || !el || e.touches?.length !== 1) return;
      const t = e.touches[0];
      if (!j.yon) j.yon = yonKilidi(t.clientX - j.x0, t.clientY - j.y0);
      if (j.yon !== 'dikey') return;
      // Yalnızca AŞAĞI; yukarı çekiş 0'da durur, bir şey "bozulmasın".
      j.y = Math.max(0, t.clientY - j.y0);
      // Doğrudan DOM: kare başına durum güncellemesi uzun içeriği 60 kez/sn
      // yeniden çizdirirdi.
      el.style.transition = 'none';
      el.style.transform = `translateY(${j.y}px)`;
    },
    onTouchEnd() {
      const jj = j;
      j = null;
      temizle();
      if (!jj || jj.yon !== 'dikey') return;
      const gecti = esikGecildi({
        mesafe: jj.y,
        sure: Date.now() - jj.t0,
        boyut: window.innerHeight || 800,
      });
      if (gecti) kapat();
    },
    onTouchCancel() { j = null; temizle(); },
  };
}

/**
 * Yatay "kaydır → komşu kart" jesti (#265). Panelin tamamına bağlanır; yön
 * kilidi dikey okumayı ve dikey kapatma jestini ayırır.
 *
 * @param {{ panel: () => HTMLElement|null, komsu: () => {onceki:boolean, sonraki:boolean},
 *   gec: (yon:'onceki'|'sonraki') => void }} p
 */
export function yatayKaydirJesti({ panel, komsu, gec }) {
  let j = null;
  const temizle = () => {
    const el = panel();
    if (el) { el.style.transition = ''; el.style.transform = ''; }
  };
  return {
    onTouchStart(e) {
      if (!dokunmatikMi() || e.touches?.length !== 1) return;
      const t = e.touches[0];
      if (kenardanMi(t.clientX, window.innerWidth || 0)) return;
      if (yatayJestDisi(e.target)) return;
      j = { x0: t.clientX, y0: t.clientY, t0: Date.now(), dx: 0, yon: null };
    },
    onTouchMove(e) {
      const el = panel();
      if (!j || !el || e.touches?.length !== 1) return;
      const t = e.touches[0];
      if (!j.yon) j.yon = yonKilidi(t.clientX - j.x0, t.clientY - j.y0);
      if (j.yon !== 'yatay') return;
      j.dx = t.clientX - j.x0;
      el.style.transition = 'none';
      el.style.transform = `translateX(${izlemeMesafesi(j.dx, komsu())}px)`;
    },
    onTouchEnd() {
      const jj = j;
      j = null;
      temizle();
      if (!jj || jj.yon !== 'yatay') return;
      const karar = gecisKarari({
        dx: jj.dx,
        sure: Date.now() - jj.t0,
        genislik: window.innerWidth || 400,
        ...komsu(),
      });
      if (karar) gec(karar);
    },
    onTouchCancel() { j = null; temizle(); },
  };
}
