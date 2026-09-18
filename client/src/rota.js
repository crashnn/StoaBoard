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
