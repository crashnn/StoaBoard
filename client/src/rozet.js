// Zil rozetinin saf çekirdeği — "son bakıştan beri gelen okunmamış".
//
// NİÇİN AYRI DOSYA: `bildirimMetni.js` ile aynı gerekçe. React'e ve `window`a
// bağlı değil; `server/test/bildirim.test.js` gerçek fonksiyonu içe aktarıp
// davranışı çalıştırıyor.
//
// KUSUR (bildirildi 10 Eylül 2026, karar 15 Eylül): rozet "okunmamış sayısı"
// olarak tanımlıydı ama paneli açan/kapatan beş yol onu yalnızca yerel React
// durumunda sıfırlıyordu (`setNotifCount(0)`); sunucudaki `read` alanına
// hiç dokunulmuyordu. Sonraki girişte açılış `unread` sayısını okuyor ve
// günler önce bakılmış bildirim rozeti yeniden dolduruyordu. Sessiz
// tutarsızlık: ekran "sıfır" diyor, kayıt "okunmadı" diyor.
//
// KARAR (TODO'daki (c) seçeneği, Outlook benzetmesiyle): rozet artık
// **okunmamış sayısı değil**, "son bakıştan beri gelen okunmamış" sayısıdır.
// Okundu işaretini kullanıcı verir — bildirime tıklayarak (zaten sunucuya
// yazıyor) ya da "hepsini okundu işaretle" ile. "Son bakış" anı sunucuya değil
// tarayıcıya yazılır: şema değişmez, "Okunmamış" sekmesi anlamını korur.
// Bedeli açık: başka cihazda rozet ilk kez tam sayıyla gelir. Kabul edildi;
// aksi bir sütun ve elle şema göçü isterdi (CLAUDE.md, tuzaklar).

/** Bir kullanıcı için tarayıcıdaki "son bakış" anahtarı. Kullanıcıya göre
 *  ayrılıyor: aynı tarayıcıda iki hesap birbirinin rozetini sıfırlamasın
 *  (15 Eylül'de demo hazırlığında iki hesap aynı Chrome'daydı). */
export function sonBakisAnahtari(kullaniciSlug) {
  return `stoa.notifSonBakis.${kullaniciSlug || 'anon'}`;
}

/**
 * Rozette gösterilecek sayı: okunmamış VE son bakıştan sonra gelen bildirimler.
 *
 * `sonBakis` epoch milisaniye; 0 ya da geçersizse hiç bakılmamış demektir ve
 * sayı okunmamışların tamamıdır — eski davranışla aynı, yani ilk girişte
 * hiçbir şey kaybolmaz.
 *
 * Zamanı olmayan ya da çözülemeyen bildirim **yeni sayılır**. Yokluk hâli
 * sessizce atlanmıyor: emin olunamayan bildirimi göstermek, gizlemekten
 * ucuz (CLAUDE.md, sessiz başarısızlık).
 */
export function yeniOkunmamisSayisi(bildirimler, sonBakis) {
  const esik = Number(sonBakis) > 0 ? Number(sonBakis) : 0;
  let n = 0;
  for (const b of bildirimler || []) {
    if (!b || !b.unread) continue;
    const t = Date.parse(b.time || '');
    if (Number.isNaN(t) || t > esik) n += 1;
  }
  return n;
}

/**
 * Tarayıcıdaki son bakış anını okur. `storage` dışarıdan verilir
 * (`localStorage`); erişim fırlatırsa ya da değer bozuksa 0 döner — yani
 * "hiç bakılmamış", rozet tam sayıyla gelir. Gizli pencere ve engellenmiş
 * depolama bu yola düşer; yanlış tarafta (gizleyerek) değil, gürültülü
 * tarafta (göstererek) hata yapıyor.
 */
export function sonBakisOku(storage, kullaniciSlug) {
  try {
    const v = Number(storage?.getItem?.(sonBakisAnahtari(kullaniciSlug)));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** Son bakış anını yazar; depolama fırlatırsa sessizce geçer — rozet zaten
 *  yerelde sıfırlandı, bir sonraki girişte en kötü ihtimalle tam sayı gelir. */
export function sonBakisYaz(storage, kullaniciSlug, simdi = Date.now()) {
  try {
    storage?.setItem?.(sonBakisAnahtari(kullaniciSlug), String(simdi));
  } catch {
    /* depolama yok — yukarıdaki gerekçe */
  }
}
