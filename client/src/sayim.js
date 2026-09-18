// Dashboard sayaçları — saf, test edilebilir.
//
// ── Kusur (18 Eylül 2026, kart #202 denetimi) ──────────────────────────────
//
// Dashboard'daki "bu hafta +N tamamlandı" sayısı RAPORLARDAN FARKLI bir
// "tamamlandı" tanımı kullanıyordu. Raporlar tamamlanmayı `completedAt`tan
// sayıyor (`lib/reporting.js`): kart bitiş kolonuna girince yazılır, çıkınca
// silinir, doğrudan bitişte açılan kartta da yazılır. Dashboard ise hareket
// günlüğündeki "task_moved → bitiş kolonunun BAŞLIĞI" kayıtlarını sayıyordu
// (`lib/throughput.js` üzerinden). İki tanım şu durumlarda ayrışıyordu:
//
//   - bitir → geri aç → yeniden bitir: dashboard 2 sayar, rapor 1
//   - bitişe at → geri al: dashboard "tamamlandı" der, rapor demez
//   - doğrudan bitiş kolonunda açılan kart: dashboard hiç saymaz
//   - çöpe atılan kart: günlük kaydı kalır, dashboard sayar
//   - kolon yeniden adlandırılınca: başlık eşleşmez, geçmiş sessizce düşer
//
// Uydurma değildi — ama aynı olgunun ikinci, ayrışan okuyucusuydu. Bu deponun
// tekrar eden kusur sınıfı. Artık tek tanım var: `completed_at`.
//
// Bu modül `dashboard.jsx`ten ayrı çünkü kural saf (girdi kart listesi, çıktı
// sayı) ve sunucu testleri onu doğrudan içe aktarabiliyor — `rozet.js`,
// `belge.js` ile aynı kalıp.

const GUN_MS = 24 * 60 * 60 * 1000;

/**
 * Son `gun` gün içinde tamamlanmış ve HÂLÂ bitiş kolonunda duran kart sayısı.
 *
 * "Hâlâ bitiş kolonunda" şartı `completed_at` ile zaten örtüşüyor (sunucu
 * kart bitişten çıkınca alanı siliyor); yine de iki şart birlikte aranıyor ki
 * eski bir sekmede bayat kalmış bir alan yanlış sayı üretmesin.
 *
 * Pencere KAYAN son `gun` gün, takvim haftası değil — ekrandaki etiket de
 * bunu söylüyor ("son 7 günde"). Önceki etiket "bu hafta" diyordu ve pencere
 * zaten kayan 7 gündü; söz verilen ile hesaplanan ayrışıyordu.
 *
 * @param {Array<{col: string, completed_at?: string|null}>} kartlar
 * @param {Set<string>} bitisKolonlari  bitiş işaretli kolonların slug'ları
 * @param {number} simdiMs  şu an (ms) — dışarıdan veriliyor ki test sabitleyebilsin
 * @param {number} [gun=7]
 * @returns {number}
 */
export function sonGunlerdeTamamlanan(kartlar, bitisKolonlari, simdiMs, gun = 7) {
  const esik = simdiMs - gun * GUN_MS;
  let n = 0;
  for (const k of kartlar || []) {
    if (!k || !bitisKolonlari?.has(k.col)) continue;
    // Boş/eksik completed_at ayrıca kontrol edilmiyor: Date.parse(null|undefined|'')
    // NaN verir ve aşağıdaki isFinite onu eliyor. Ayrı bir şart, hiçbir testin
    // savunamayacağı bir satır olurdu — mutasyon turu onu eşdeğer mutant olarak
    // gösterdi (kaldırmak davranışı değiştirmiyordu).
    const t = Date.parse(k.completed_at);
    // Gelecek tarihli (saat farkı, bozuk veri) kayıt da sayılmıyor: "son 7
    // günde tamamlandı" demek geçmişte olmuş demek.
    if (Number.isFinite(t) && t >= esik && t <= simdiMs) n += 1;
  }
  return n;
}
