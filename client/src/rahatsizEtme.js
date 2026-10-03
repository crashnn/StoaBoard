/**
 * Rahatsız etme penceresi — saf çekirdek.
 *
 * NİÇİN VAR: ayarlarda "Otomatik DND penceresi" diye bir anahtar ve iki saat
 * kutusu vardı ("Her gün belirli saat aralığında bildirimleri sustur",
 * varsayılan 19:00–08:00). Üçü de `stoa.tweaks`e yazılıyor ve **hiçbiri
 * okunmuyordu**: bildirim kapısı `window.__MY_STATUS__ === 'dnd'` bakıyor,
 * o da kullanıcının DURUM SEÇİCİSİNDEN geliyor — bu ayardan değil. Yani iki
 * ayrı "rahatsız etme" kavramı vardı ve ayarlardaki olan tamamen atıl.
 *
 * Kullanıcı gece 19:00–08:00 kurmuş, sabaha kadar ding yiyor ve ayarın
 * açık olduğunu görüyor. 3 Ekim'de kısayollarda kapatılan sınıfın aynısı:
 * sessizce hiçbir şey yapmayan bir ayar, olmayan bir ayardan kötüdür.
 *
 * PENCERE GECE YARISINI SARABİLİR ve varsayılan tam öyle (19:00–08:00).
 * Sarma, bu işin bütün zorluğu: düz bir `bas <= simdi && simdi < bit`
 * karşılaştırması varsayılan ayarda HİÇ susturmazdı ve kusur "düzeltilmiş"
 * görünürdü.
 *
 * SUSTURULAN ŞEY YALNIZCA KESME. Bildirim panelde ve zilde duruyor; DND
 * "bana bunu şimdi göstermeyin" demek, "bunu bana hiç söylemeyin" demek
 * değil. Aksi hâlde sabah kalkan kullanıcı gece olanları hiç görmezdi.
 */

/** 'HH:MM' → gün içindeki dakika. Bozuk girdide null. */
export function dakikayaCevir(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const s = Number(m[1]);
  const d = Number(m[2]);
  if (s > 23 || d > 59) return null;
  return s * 60 + d;
}

/**
 * `simdiDk` penceresin içinde mi?
 *
 * EŞİT BAŞLANGIÇ VE BİTİŞ = BOŞ PENCERE, 24 saat değil. Aynı saati iki kutuya
 * yazan kullanıcı büyük olasılıkla yanlış kurmuştur; "hiç susturma" yanlış
 * kurulumun ucuz sonucu, "bir gün boyunca sustur" ise pahalı olanı — bu
 * depoda şüphede kalınca bildirim göstermek tercih ediliyor.
 *
 * Başlangıç DAHİL, bitiş HARİÇ: 19:00–08:00 penceresinde 08:00'de bildirim
 * geliyor. Aksi hâlde iki ucu da dahil eden bir pencere komşusuyla çakışırdı.
 */
export function penceredeMi(simdiDk, basDk, bitDk) {
  if (simdiDk === null || basDk === null || bitDk === null) return false;
  if (basDk === bitDk) return false;
  if (basDk < bitDk) return simdiDk >= basDk && simdiDk < bitDk;
  // Gece yarısını saran pencere: 19:00–08:00 → [19:00, 24:00) ∪ [00:00, 08:00)
  return simdiDk >= basDk || simdiDk < bitDk;
}

/**
 * Bildirim şu an susturulmalı mı?
 *
 * BOZUK SAATTE SUSTURMUYOR. `dndEnabled` açık ama saatler okunamıyorsa
 * (bayat biçim, elle yazılmış değer) bildirim GÖSTERİLİYOR. Ters karar —
 * şüphede susturmak — kullanıcının bildirimlerini sessizce yutardı ve
 * sebebi hiçbir yerde görünmezdi.
 *
 * @param {{dndEnabled?: boolean, dndStart?: string, dndEnd?: string}} tercih
 * @param {Date} simdi
 */
export function susturulmaliMi(tercih, simdi) {
  const t = tercih || {};
  if (!t.dndEnabled) return false;
  const bas = dakikayaCevir(t.dndStart ?? '19:00');
  const bit = dakikayaCevir(t.dndEnd ?? '08:00');
  if (bas === null || bit === null) return false;
  const d = simdi instanceof Date && !Number.isNaN(simdi.getTime()) ? simdi : null;
  if (!d) return false;
  return penceredeMi(d.getHours() * 60 + d.getMinutes(), bas, bit);
}
