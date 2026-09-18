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
