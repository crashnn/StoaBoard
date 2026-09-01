# Güvenlik çalışma biçimi

Bu dosya bir "yapılacaklar" listesi değil, **her yeni özelliğin üstünden geçmesi
gereken elek.** Güvenlik ayrı bir sprint değil; her özelliğin bir parçası.

---

## 1 · Temel varsayım

> **Bir kullanıcı hesabı er geç kötüye kullanılacak** — ya sahibi sızdırmak
> isteyecek, ya hesabı ele geçirilecek. İkisi de aynı soruyu sorar:
> **bir hesabın patlama yarıçapı ne kadar?**

Bu yüzden "kullanıcıya güvenilir mi" diye sormuyoruz. Sorduğumuz üç şey:

1. Bu hesap **ne kadarına** erişebiliyor? (yarıçapı küçült)
2. Erişileni **dışarı çıkarabiliyor mu**, çıkarırsa **iz kalıyor mu**? (izle)
3. Yanlış giderse **ne kadar sürede fark ederiz**? (tespit)

Engelleme her zaman mümkün değil: veriyi meşru olarak görebilen biri onu
kopyalamayı da başarır. O yüzden üçüncü savunma hattı **izlenebilirlik**.

---

## 2 · Tehdit modeli — kime karşı

| Aktör | Ne yapabilir | Ana kontrolümüz |
|---|---|---|
| **İçerideki üye** | Meşru erişimini kötüye kullanır, toplu veri çeker | En az yetki + dışa aktarma kaydı |
| **Ele geçirilmiş hesap** | Üyenin yapabildiği her şey | Yarıçap küçültme + oturum hijyeni |
| **Dışarıdan saldırgan** | Kimlik doğrulamayı aşmaya, IDOR aramaya çalışır | Kapsam kontrolü, kapalı başarısızlık |
| **Meraklı üye** | Kendi yetkisinin sınırını yoklar | Sunucu tarafı kontrol (istemciye asla güvenme) |
| **Kaza** | Yanlış kişiye erişim verilir, veri yanlış yere gider | Varsayılanların dar olması |

---

## 3 · Yaşanmış krizlerden çıkardığımız dersler

Her satır gerçek bir olaydan, ve karşısında **bizim** karşılığımız var.

**Tek hesabın yarıçapı — Uber, 2022.**
Bir taşeronun kimlik bilgileri ele geçirildi, saldırgan çok sayıda doğrulama
isteği göndererek kullanıcıyı yıldırıp içeri girdi; içeride bulduğu erişimlerle
yatay olarak yayıldı.
→ *Bizde:* bir üyeyi kabul ettiğinde o kişi **çalışma alanındaki bütün
projeleri, bütün kartları ve `general` kanalının katılmadan önceki tüm
geçmişini** görüyor. Yarıçap bugün geniş. **Proje bazlı üyelik** bu yüzden yol
haritasında.

**Yönetim araçları taçtır — Okta/Lapsus$, 2022.**
Üçüncü taraf bir destek çalışanının makinesi ele geçirildi; o hesabın müşteri
yönetim araçlarına erişimi vardı.
→ *Bizde:* denetim kaydı, davet kodu, rol yönetimi ve üye çıkarma en hassas
yüzey. Denetim kaydı bu yüzden `manage_workspace` ile kapalı — herkese açık
olsaydı kimin ne yaptığı sıradan bir üyeye açılırdı.

**Geliştirici makinesi üretim yüzeyidir — LastPass, 2022.**
Bir mühendisin ev bilgisayarı ele geçirildi, oradan üretim yedeklerine giden
anahtarlara ulaşıldı.
→ *Bizde:* üretim `DATABASE_URL` **hiçbir geliştirici makinesinde durmuyor**,
yalnızca Railway ortam değişkenlerinde. Yerel test için Neon'da ayrı bir dal
kullanılıyor. Bu kazara doğru yapılmıştı; artık bilinçli bir kural.

**Servisin kendi yetkisi de fazla olabilir — Capital One, 2019.**
Bir uygulama açığı, arkasındaki fazla yetkili kimlik sayesinde toplu veri
sızıntısına dönüştü.
→ *Bizde:* uygulamanın veritabanı kullanıcısı tek ve tam yetkili. Kısa vadede
değişmiyor ama not edildi: açığın ciddiyetini belirleyen şey çoğu zaman açığın
kendisi değil, arkasındaki yetkidir.

**Fark etme süresi — birçok büyük ihlalde ortak.**
Saldırganların aylarca fark edilmediği olaylarda asıl kayıp, girişin kendisi
değil **fark edilmeden geçen süre** oldu.
→ *Bizde:* denetim kaydı bu yüzden var. Engellemiyor, **görünür kılıyor.**

**Dosya biçiminin kendisi silah olabilir — CSV formül enjeksiyonu.**
Bilinen bir sınıf: Excel, `=` `+` `-` `@` ile başlayan hücreyi formül sayıp
çalıştırır. Saldırgan veriyi değil, **veriyi açan kişiyi** hedefler.
→ *Bizde:* 1 Eylül 2026'da bulundu ve kapatıldı. Rapor CSV'lerindeki görev
başlıkları ve kişi adları kullanıcı girdisiydi, raporu açan da yönetici.

---

## 4 · Her yeni özellik için elek

Yeni bir uç, ayar ya da ekran eklendiğinde **bu on soru cevaplanmadan
birleştirilmez.** Cevaplar commit mesajına ya da PR açıklamasına yazılır.

1. **Kim çağırabilir?** Kimlik doğrulaması var mı, `requireAuth` bağlı mı?
2. **Neyin üstünde çalışabilir?** Çalışma alanı / proje / kendi kaydı kapsamı
   nasıl daraltılıyor? Sadece "giriş yapmış olmak" yeterli olmamalı.
3. **IDOR denendi mi?** Başkasının id'si verilirse ne oluyor? Kimliği
   tahmin edilebilir mi?
4. **Başarısızlık kapalı mı?** Kayıt/üyelik bulunamazsa **reddediyor** mu,
   yoksa kontrolü atlayıp devam mı ediyor? (`if (row && !yetki)` kalıbı
   tehlikelidir: satır yoksa kontrol hiç çalışmaz.)
5. **Yanıtta ne var?** Serileştirici fazladan alan döndürüyor mu — e-posta,
   iç kimlik, başka kullanıcının verisi? Genel ve özel serileştirici ayrımı
   korunuyor mu?
6. **Girdi nereden geliyor?** Tip, aralık, uzunluk doğrulanıyor mu? Dizi
   beklenen yere nesne gelirse ne olur?
7. **Veri dışarı çıkıyor mu?** Dışa aktarma, indirme, e-posta, dış servis —
   varsa **denetim kaydına yazılıyor mu**? Hedef biçim (Excel, HTML) kendi
   saldırı yüzeyini getiriyor mu?
8. **Hata mesajı ne söylüyor?** İç ayrıntı, sunucu adresi, sorgu adı sızıyor
   mu? Var/yok farkı bir oracle oluşturuyor mu? (404 ile 403 arasındaki fark
   bilgi verir.)
9. **Silme davranışı ne?** Kayıt silinince denetim ve rapor verisi de gidiyor
   mu? Gitmemeli — bu yüzden geçiş, süre ve denetim kayıtları ilişkisiz.
10. **Nasıl test edilir?** En az bir olumsuz senaryo yazılı olmalı: *yetkisiz
    kişi bunu denerse ne görür?*

---

## 5 · Mevcut durum

**Yapıldı**
- Genel/özel kullanıcı serileştirici ayrımı — e-posta yalnızca kişinin kendi
  profilinde
- Direkt mesajlar çalışma alanı ortaklığı ile korunuyor; özel kanallar üyelik
  kontrolünden geçiyor
- Rapor uçlarında çalışma alanı kapsamı; yabancı proje kimliği boş küme veriyor
- İç hata mesajları istemciye kapatıldı *(1 Eylül)*
- CSV formül enjeksiyonu kapatıldı *(1 Eylül)*
- Kullanıcı varlığı oracle'ı kapatıldı *(1 Eylül)*
- Dışa aktarma denetim kaydı *(1 Eylül)*
- Oturumlar PostgreSQL'de; `HttpOnly`, `SameSite=lax`, üretimde `Secure`
- `/api/auth` için hız sınırı

**Açık — öncelik sırasıyla**
1. **Proje bazlı üyelik.** En büyük yarıçap küçültme. Bugün bir üye çalışma
   alanındaki her şeyi görüyor.
2. **Varsayılan rolün izinleri.** Yeni üye hangi rolle düşüyor, o rol ne
   yapabiliyor? Denetlenmedi.
3. **Oturum hijyeni.** Üye çıkarıldığında ve parola değiştiğinde açık oturumlar
   gerçekten düşüyor mu? Denetlenmedi.
4. **`chat.js` kapalı-başarısızlık kusuru.** Kanal satırı yoksa üyelik kontrolü
   atlanıyor görünüyor (`if (chRow && !yetki)`). Doğrulanmalı.
5. **Kanal geçmişi kesimi.** Yeni üye katılmadan önceki mesajları görüyor.
6. **Denetim kaydının kapsamı.** Şu an yalnızca dışa aktarma. Üye ekleme/
   çıkarma, rol değişikliği, davet kodu görüntüleme de yazılmalı — eylem
   adları `lib/audit.js` içinde hazır bekliyor.
7. **Otomatik test yok.** Yukarıdaki maddelerin hiçbiri regresyona karşı
   korunmuyor. İlk testler izin katmanına yazılmalı.

---

## 6 · Bilinen ödünleşmeler

Bilerek yapılmış, tartışmaya açık seçimler:

- **Denetim kaydı isteği bekletmiyor.** Yazımı başarısız olursa kullanıcının
  işlemi bozulmuyor, sadece sunucu günlüğüne uyarı düşüyor. Bedeli: veritabanı
  sorunlarında kayıt kaybı olabilir. Kritik hâle gelirse yazma senkron yapılmalı.
- **Süre kayıtları çalışma alanı içinde herkese açık.** Takım şeffaflığı için
  bilinçli. "Süreyi kim görebilir" sorusu açık bir tasarım kararı.
- **Geçiş, süre ve denetim kayıtlarında yabancı anahtar yok.** Kayıtlar silinen
  veriden sağ çıksın diye. Bedeli: veritabanı düzeyinde bütünlük garantisi yok.
