/**
 * Gerçek zamanlı bağlantının durumu — saf çekirdek.
 *
 * NİÇİN VAR: istemcinin tamamında TEK BİR `disconnect` işleyicisi yoktu.
 * Soket `app.jsx`te kuruluyor, sonra yalnızca BAŞKALARININ varlığı
 * (`user_online` / `user_offline`) dinleniyordu. Dizüstü uyandığında, wifi
 * değiştiğinde ya da sunucu yeniden başladığında pano bayat kalıyor ve bunu
 * söyleyen hiçbir şey yok: kartlar duruyor, sohbet sessizleşiyor, kullanıcı
 * "kimse bir şey yapmıyor" sanıyor.
 *
 * Bu deponun adını koyduğu düşmanın tam örneği — sessiz başarısızlık. Koşulun
 * yokluk hâli ya reddetmeli ya GÜRÜLTÜ ÇIKARMALI; burada çıkarmıyordu.
 *
 * İKİ KARAR davranışı belirliyor:
 *
 * 1. ŞERİT, TOAST DEĞİL. Toast kayboluyor, koşul kaybolmuyor. Bağlantı
 *    yoksa bunu söyleyen şey ekranda DURMAK zorunda, yoksa kullanıcı iki
 *    saniye sonra yine bilmiyor.
 *
 * 2. KISA KESİNTİ ŞERİT AÇMIYOR. Socket.IO 300 ms'de geri dönüyor ve her
 *    blipte şerit çakmak, şeridi gürültüye çeviren şey olurdu — sonra kimse
 *    bakmaz. `GECIKME_MS` sonra hâlâ kopuksa gösteriliyor.
 *
 * Geri dönüşte VERİ DE TAZELENİYOR: şeridi kaldırmak yetmez, kopukken
 * kaçırılan olaylar geri gelmiyor. "Bağlantı var" deyip bayat pano
 * göstermek, hiç söylememekten daha kötü — kullanıcı artık güveniyor.
 */

/** Şeridi açmadan önce beklenen süre. Kısa blip kullanıcıyı ilgilendirmiyor. */
export const GECIKME_MS = 2500;

/**
 * Soket olaylarından ekran durumuna.
 *
 * `bagli`   — her şey yerinde, şerit yok.
 * `kopuk`   — bağlantı yok ve gecikme geçti; şerit görünüyor.
 * `donuyor` — yeniden bağlanma denemesi sürüyor; şerit "bağlanıyor" diyor.
 *
 * Ayrı bir `donuyor` durumu var çünkü "bağlantı yok" ile "bağlanmaya
 * çalışıyorum" kullanıcı için farklı iki cümle: ilki ona bir şey yapması
 * gerektiğini düşündürür, ikincisi beklemesini söyler.
 */
export function baglantiDurumu({ bagli, deniyor, gecikmeGecti }) {
  if (bagli) return 'bagli';
  if (!gecikmeGecti) return 'bagli';   // kısa blip: henüz söylenmiyor
  return deniyor ? 'donuyor' : 'kopuk';
}

/**
 * Şeridin metni — `ceviri(anahtar, yedek)` dışarıdan geliyor ki bu modül
 * saf kalsın ve sözlüğe bağlanmasın.
 */
export function baglantiMetni(durum, ceviri) {
  const t = (k, fb) => (typeof ceviri === 'function' ? ceviri(k, fb) : fb);
  if (durum === 'kopuk') {
    return t('conn_lost', 'Bağlantı koptu — canlı güncellemeler durdu');
  }
  if (durum === 'donuyor') {
    return t('conn_retry', 'Yeniden bağlanılıyor…');
  }
  return null;
}

/**
 * Geri dönüşte veri tazelenmeli mi?
 *
 * ÖLÇÜT GÖRÜNEN DURUM DEĞİL, GERÇEKTEN KOPMUŞ OLMAK. İlk yazışımda bunu
 * şeridin durumuna bağlamıştım ve yanlıştı: şerit `GECIKME_MS` beklediği
 * için 300 ms'lik bir kesinti ekranda hiç görünmüyor, ama o 300 ms içinde
 * sunucunun gönderdiği olaylar GERÇEKTEN kayboluyor. Şeridi geciktirmek bir
 * arayüz kararı, tazelemeyi geciktirmek ise veri kaybı.
 *
 * `koptu`, `disconnect` olayında kuruluyor ve tazeleme bittiğinde
 * düşürülüyor — yani ölçüt "ekranda ne yazdı" değil, "ne oldu".
 *
 * İlk bağlanmada `koptu` false: açılışta önyükleme zaten yapılmış durumda ve
 * her `connect`te tazelemek ikinci bir önyükleme demek olurdu.
 */
export function tazelenmeliMi({ koptu }) {
  return koptu === true;
}
