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
