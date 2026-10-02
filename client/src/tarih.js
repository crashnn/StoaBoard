// Yerel takvim günü — TEK OKUYUCU.
//
// NİÇİN VAR: "bugün" bu uygulamada iki ayrı biçimde doğabiliyordu ve ikisi
// aynı gün değil. `new Date().toISOString().slice(0, 10)` UTC gününü verir;
// Türkiye UTC+3 olduğu için yerel saat 00:00-03:00 arasında UTC hâlâ DÜNDÜR.
// Yani sabahın köründe kart açan biri başlangıcı bir gün geride görürdü.
//
// İstemcinin geri kalanı zaten yerel düşünüyor: takvim hücrelerinin tarih
// metni `getFullYear/getMonth/getDate` ile kuruluyor (`calendar.jsx`) ve
// gecikme ölçütü yerel gece yarısıyla karşılaştırıyor (`data.jsx`,
// `setHours(0,0,0,0)`). Bu dosya o biçimi tek yerde tutuyor.
//
// Sunucunun varsayılanı (`lib/projects.js` → `bugununTarihi`) UTC gece
// yarısıdır ve öyle kalmalı: depolanan tarihler UTC gece yarısı ve
// `parseDate` ile gidiş-dönüş birebir eşleşiyor (`tarih.test.js`). İkisi
// çelişmiyor, çünkü sunucudaki varsayılan yalnızca istemci BOŞ gönderdiğinde
// devreye giriyor — kullanıcının gördüğü gün her zaman buradan geliyor.
export function yerelGunAnahtari(d) {
  const y = d.getFullYear();
  const a = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${a}-${g}`;
}

// Bugünün yerel takvim günü, `YYYY-MM-DD`. Tarih alanlarının ve takvimin
// kullandığı biçimin aynısı.
export function bugunYerel() {
  return yerelGunAnahtari(new Date());
}

/**
 * Bugünden `gun` gün sonrasının yerel takvim günü. Hızlı tarih seçimi
 * (Yarın, Haftaya) buradan geliyor.
 *
 * NİÇİN `setDate`, NİÇİN `Date.now() + gun * 86400000` DEĞİL: ikincisi
 * 24 saat ekler, bir GÜN değil. Yaz saati uygulanan bir bölgede saatin
 * ileri/geri alındığı gece 23 ya da 25 saat sürüyor; "yarın" o gece ya
 * bugüne ya öbür güne düşerdi. Türkiye 2016'dan beri sabit UTC+3, yani
 * bugün fark üretmiyor — ama bu dosyanın var olma sebebi tam olarak
 * "tarih hesabı sessizce bir gün kayıyor" sınıfı. Kayma ihtimalini
 * kapatmak, kaymadığını varsaymaktan ucuz.
 *
 * `taban` yalnızca TEST için: üretimde hep "şimdi". Enjekte edilebilir
 * olmasının sebebi, yukarıdaki yaz saati gerekçesinin ÖLÇÜLEBİLİR olması.
 * Taban enjekte edilmeden, saat farkı olmayan bir makinede iki hesap aynı
 * sonucu veriyor ve ölçüt iki uygulamayı ayırt edemiyor — mutasyon turu bunu
 * gösterdi (2 Ekim 2026).
 *
 * @param {number} gun Kaç gün sonrası (0 = bugün).
 * @param {Date} [taban] Başlangıç anı; verilmezse şimdi.
 * @returns {string} `YYYY-MM-DD`
 */
export function gunSonra(gun, taban) {
  const d = taban instanceof Date ? new Date(taban.getTime()) : new Date();
  d.setDate(d.getDate() + (Number.isFinite(gun) ? gun : 0));
  return yerelGunAnahtari(d);
}
