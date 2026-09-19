// Görünüm ↔ adres eşlemesi — saf, test edilebilir (kart #228).
//
// ── Kusur ─────────────────────────────────────────────────────────────────
//
// Giriş yapmış kullanıcı için BÜTÜN görünümler `/` adresinde duruyordu; görünüm
// yalnızca localStorage'a yazılıyordu. Görünüm değiştirmek hiç geçmiş kaydı
// üretmediği için telefonun geri tuşu sitedeki bir önceki ekrana değil,
// SİTEDEN ÖNCEKİ sayfaya gidiyordu. Kullanıcının ifadesi (18 Eylül 2026):
// "ana sayfadan tümünü gör dedim listeye attı ... telefonun geri tuşu ile geri
// dönmek istedim ancak takıldı, çok atınca da Google ekranına attı."
//
// Mobilde geri HAREKETİ birincil gezinme aracı; her kullanımda siteden çıkmak
// masaüstündekinden çok daha yıkıcı.
//
// ── Kararlar (kullanıcı, 18 Eylül 2026) ───────────────────────────────────
//
//   1. Yol adları TÜRKÇE — mevcut /giris ve hukuki sayfalarla tutarlı.
//   2. Kart çekmecesi adres alıyor: /pano/kart/193. Geri tuşu önce kartı
//      kapatır, sonra önceki ekrana döner; bağlantı paylaşılabilir.
//   3. Proje ve sohbet kanalı adreste YOK (şimdilik) — bugünkü gibi hatırlanır.

/** Görünüm adı (koddaki) → adres. Tek kaynak: iki yönlü çeviri buradan. */
export const GORUNUM_YOLLARI = Object.freeze({
  dashboard: '/ana-sayfa',
  board: '/pano',
  chat: '/sohbet',
  notes: '/notlar',
  reports: '/raporlar',
  calendar: '/takvim',
  settings: '/ayarlar',
  trash: '/cop',
  notifications: '/bildirimler',
});

/** Kendi dalıyla yönetilen, oturumdan bağımsız sayfalar. */
export const HUKUKI_YOLLAR = new Set(['/gizlilik-sartlari', '/hizmet-sartlari']);

const KART_DESENI = /^\/pano\/kart\/(\d+)$/;

/** Sondaki eğik çizgiyi atar; boş kalırsa kök. */
function normalle(yol) {
  return String(yol || '/').replace(/\/+$/, '') || '/';
}

/**
 * Durumdan adres. Kart açıksa kart adresi, değilse görünümün adresi.
 * Tanınmayan görünüm panoya düşüyor — sessizce boş bir adres üretmek yerine
 * her zaman geçerli bir yere işaret etsin.
 */
export function durumdanYol(gorunum, kartId = null) {
  if (kartId !== null && kartId !== undefined && /^\d+$/.test(String(kartId))) {
    return `/pano/kart/${kartId}`;
  }
  return GORUNUM_YOLLARI[gorunum] || GORUNUM_YOLLARI.board;
}

/**
 * Adresten durum. Tanınmayan adres `null` — çağıran taraf "giriş noktası"
 * sayıp durumu kendi hafızasından kuruyor.
 */
export function yoldanDurum(yol) {
  const p = normalle(yol);
  const kart = KART_DESENI.exec(p);
  if (kart) return { gorunum: 'board', kart: kart[1] };
  for (const [gorunum, y] of Object.entries(GORUNUM_YOLLARI)) {
    if (y === p) return { gorunum, kart: null };
  }
  return null;
}

/**
 * Giriş noktası mı? Kök, giriş ekranı ve tanınmayan adresler. Bunlardan
 * uygulamaya geçerken adres DEĞİŞTİRİLİR (replaceState), eklenmez: aksi hâlde
 * geri tuşu kullanıcıyı bir kez daha `/`ye ya da giriş ekranına götürür —
 * tam da düzeltilmek istenen "takılma".
 *
 * Hukuki sayfalar giriş noktası DEĞİL: uygulamadan oraya gidip geri dönmek
 * gerçek bir gezinme, geçmişte kalmalı.
 */
export function girisNoktasiMi(yol) {
  const p = normalle(yol);
  if (p === '/' || p === '/giris') return true;
  return !yoldanDurum(p) && !HUKUKI_YOLLAR.has(p);
}

// ── Hatırlanan görünüm: `stoa.view`in TEK okuyucusu ────────────────────────
//
// KUSUR (18 Eylül 2026): kayıtlı görünüm üç yerde okunuyordu — başlangıç
// durumu, geri tuşu (popstate) ve hukuki sayfanın kapat düğmesi. Eski `list`
// kaydını panoya çeviren göçü yalnızca ilki yapıyordu; diğer ikisi ham değeri
// `setView`e veriyordu. Var olmayan bir görünüm hiçbir dalı çizmez: ekran
// boş kalır. Dashboard'daki "Tümünü gör" (onView('list')) aynı sınıftı.
//
// Daha kötüsü: oturumsuz kullanıcı hukuki sayfayı kapatınca görünüm 'auth'
// yapılıyordu. Böyle bir görünüm yok — giriş ekranını `authed` bayrağı açar.
// Kullanıcı giriş yapınca (`handleSignIn` sayfayı yenilemiyor) içerik alanı
// BOŞ kalıyor, adres efekti de 'auth'u diske yazdığı için her yenilemede
// yine boş açılıyordu.
//
// Karar: kayıtlı değer ancak GERÇEK bir görünümse kabul edilir, değilse pano.
// Hukuki sayfalar da hatırlanmaz — kapatınca oraya geri dönülmez.

/** Kayıtlı değer → { gorunum, altGorunum }. Saf. */
export function hatirlananGorunum(kayit) {
  // Eski sürümlerde liste ayrı bir görünümdü; artık panonun alt görünümü.
  if (kayit === 'list') return { gorunum: 'board', altGorunum: 'list' };
  // `in` değil `hasOwn`: 'toString' gibi bir kayıt prototipten geçmesin.
  if (typeof kayit === 'string' && Object.hasOwn(GORUNUM_YOLLARI, kayit)) {
    return { gorunum: kayit, altGorunum: null };
  }
  return { gorunum: 'board', altGorunum: null };
}

/**
 * Depodan okuyup görünüm adı döner; eski `list` kaydında alt görünümü de
 * yazar. Uygulamada `stoa.view` başka hiçbir yerde okunmamalı
 * (server/test/gezinme.test.js kilitliyor).
 */
export function hatirlananGorunumuOku(depo = globalThis.localStorage) {
  const { gorunum, altGorunum } = hatirlananGorunum(depo.getItem('stoa.view'));
  if (altGorunum) depo.setItem('stoa.boardSubView', altGorunum);
  return gorunum;
}

// ── Girişten sonra dönülecek adres (kart #248, #228 devamı) ────────────────
//
// KUSUR: oturumu kapalı biri paylaşılan bir kart bağlantısıyla
// (/pano/kart/193) gelince adres /giris yapılıyordu; giriş yapınca ilk yükleme
// etkisi adreste kart GÖREMİYOR, bekleyen kartı siliyordu. Kullanıcı
// hatırlanan ekrana düşüyor, paylaşılan bağlantının amacı boşa gidiyordu.
//
// Hedef bellekte değil `sessionStorage`da: giriş ekranında dil değiştirmek
// sayfayı yeniliyor (views/auth.jsx switchLang, #192) ve bellekteki her şey
// o anda kayboluyor. `localStorage` değil, çünkü hedef bu SEKMEYE ait —
// sekme kapanınca ölmeli, yarın başka bir girişte beklenmedik bir kart
// açılmamalı.
//
// Hedef yalnızca AÇILIŞTA yazılıyor, çıkışta değil: A çıkış yapınca ekrandaki
// kartın adresi B'nin girişine taşınmasın. Okunurken yine doğrulanıyor —
// depo kullanıcı denetiminde, tanınmayan bir yol hedef sayılmaz.

const GIRIS_SONRASI = 'stoa.girisSonrasi';

/** Açılış adresi uygulama içiyse hedef olarak yazar; değilse dokunmaz. */
export function girisSonrasiKaydet(yol, depo = globalThis.sessionStorage) {
  const p = normalle(yol);
  if (yoldanDurum(p)) depo.setItem(GIRIS_SONRASI, p);
}

/** Bekleyen hedef (silmeden). Tanınmayan değer `null`. */
export function girisSonrasiOku(depo = globalThis.sessionStorage) {
  const deger = depo.getItem(GIRIS_SONRASI);
  return deger && yoldanDurum(deger) ? normalle(deger) : null;
}

/** Hedef tek kullanımlık: oturum açılınca siliniyor. */
export function girisSonrasiSil(depo = globalThis.sessionStorage) {
  depo.removeItem(GIRIS_SONRASI);
}

/**
 * Durumun kurulacağı yol. Adres kendisi bir yer söylüyorsa (uygulama içi ya
 * da hukuki) o kazanır; söylemiyorsa (/giris, kök, tanınmayan) bekleyen hedef.
 */
export function baslangicYolu(adres, bekleyen) {
  const p = normalle(adres);
  if (yoldanDurum(p) || HUKUKI_YOLLAR.has(p)) return p;
  return bekleyen && yoldanDurum(bekleyen) ? normalle(bekleyen) : p;
}

// ── Hatırlanan proje (kart #256) ───────────────────────────────────────────
//
// KUSUR: seçili proje HİÇBİR YERDE kalıcı değildi. İstemci önyüklemeyi
// projesiz çağırıyor, sunucu parametre yoksa ilk projeyi seçiyordu; F5,
// giriş ve alan değiştirme kullanıcıyı her seferinde "Ana Proje"ye atıyordu
// (18 Eylül 2026, kullanıcı: "fazladan üç harekete mal oldu"). #228'de
// "proje bugünkü gibi hatırlanır" yazılmıştı — ölçülmemiş bir varsayımdı.
//
// ALAN BAŞINA tutuluyor: iki alanın projeleri birbirini ezmesin, alan
// değiştirince o alanda en son bakılan proje açılsın. Tarayıcıda, sunucuda
// değil: şema gerektirmiyor; cihazlar arası istenirse ayrı karar.
//
// Önyükleme cevabından ÖNCE aktif alan bilinmiyor; o yüzden "son alan" da
// tutuluyor. Sunucu gelen proje kimliğini aktif alanla süzüyor (routes/api.js):
// başka alanın ya da silinmiş bir projenin kimliği ilk projeye düşer, kâhin
// açmaz. Burada doğrulama yalnızca biçim: sayı olmayan değer gönderilmez.

const SON_PROJE = 'stoa.sonProje'; // { "<alanId>": "<projeId>" }
const SON_ALAN = 'stoa.sonAlan';
const KIMLIK = /^\d+$/;

function projeHaritasi(depo) {
  try {
    const h = JSON.parse(depo.getItem(SON_PROJE) || '{}');
    return h && typeof h === 'object' && !Array.isArray(h) ? h : {};
  } catch {
    // Bozuk kayıt sessizce yok sayılmıyor, SİLİNİYOR: yoksa her açılışta
    // yeniden okunup yeniden atılırdı ve hiçbir proje hatırlanmazdı.
    depo.removeItem(SON_PROJE);
    return {};
  }
}

/** Önyükleme sonrası: bu alanda açık olan projeyi yaz. Tek yazan _applyBootstrap. */
export function projeyiHatirla(alanId, projeId, depo = globalThis.localStorage) {
  const a = String(alanId ?? ''), p = String(projeId ?? '');
  if (!KIMLIK.test(a) || !KIMLIK.test(p)) return;
  const h = projeHaritasi(depo);
  h[a] = p;
  depo.setItem(SON_PROJE, JSON.stringify(h));
  depo.setItem(SON_ALAN, a);
}

/**
 * Önyüklemeye gönderilecek proje. Alan biliniyorsa (alan değiştirme) onun
 * projesi, bilinmiyorsa (açılış, giriş) son kullanılan alanın projesi.
 * Yoksa `null` — sunucu ilk projeyi seçer.
 */
export function hatirlananProje(alanId = null, depo = globalThis.localStorage) {
  const a = String(alanId ?? depo.getItem(SON_ALAN) ?? '');
  if (!KIMLIK.test(a)) return null;
  const p = projeHaritasi(depo)[a];
  return typeof p === 'string' && KIMLIK.test(p) ? p : null;
}

// ── Son açık kanal — alan başına (kart #270, #256'nın aile üyesi) ──────────
//
// Sohbet panelinde açık kanal hiçbir yerde durmuyordu: yenilemede ve panel
// söküldüğünde (Notlar'a geçince panel unmount oluyor) genel'e dönülüyordu.
// Projeyle aynı kalıp: tarayıcıda, alan başına. Kanal listesi sunucudan
// geldiği için doğrulama burada: hatırlanan slug listede yoksa (kanal
// silinmiş, özel kanaldan çıkarılmış, başka alanın kanalı) genel'e düşer —
// bayat bir slug'la boş bir kanal açmak yerine.

const SON_KANAL = 'stoa.sonKanal'; // { "<alanId>": "<slug>" }
const KANAL_SLUG = /^[^\s]{1,80}$/;

function kanalHaritasi(depo) {
  try {
    const h = JSON.parse(depo.getItem(SON_KANAL) || '{}');
    return h && typeof h === 'object' && !Array.isArray(h) ? h : {};
  } catch {
    depo.removeItem(SON_KANAL);
    return {};
  }
}

/** Bu alanda açık kanalı yaz. */
export function kanaliHatirla(alanId, slug, depo = globalThis.localStorage) {
  const a = String(alanId ?? ''), s = String(slug ?? '');
  if (!KIMLIK.test(a) || !KANAL_SLUG.test(s)) return;
  const h = kanalHaritasi(depo);
  if (h[a] === s) return;
  h[a] = s;
  depo.setItem(SON_KANAL, JSON.stringify(h));
}

/**
 * Bu alanda açılacak kanal: hatırlanan slug, `kanallar` listesinde varsa;
 * yoksa 'general'. Liste boşsa da 'general' — doğrulanamayan slug açılmaz.
 */
export function hatirlananKanal(alanId, kanallar, depo = globalThis.localStorage) {
  const a = String(alanId ?? '');
  if (!KIMLIK.test(a)) return 'general';
  const s = kanalHaritasi(depo)[a];
  if (typeof s !== 'string' || !KANAL_SLUG.test(s)) return 'general';
  const var_ = Array.isArray(kanallar) && kanallar.some((k) => (k?.slug || k?.id) === s);
  return var_ ? s : 'general';
}
