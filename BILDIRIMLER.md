# Bildirimler — mevcut durum ve tasarım soruları

**Tetikleyen olay:** 1 Eylül 2026 toplantısında bir mesaj gönderildi, karşı
tarafta **hiçbir toast çıkmadı**; yalnızca üst çubuktaki zil rozetinde +1
göründü. Aynısı ters yönde de yaşandı.

Kurumsal tarafta bildirim kaçırmamak kritik. Bu dosya mevcut durumu haritalıyor
ve **karar bekleyen tasarım sorularını** listeliyor.

---

## 1 · Toplantıda ne oldu — iki ayrı sebep

**Sebep A: kırık kod.** `app.jsx` sohbet mesajı geldiğinde şunu yapıyordu:

```js
if (sender && window.showToast) { window.showToast(...); }
```

`window.showToast` **hiçbir yerde atanmıyordu** — Vite geçişinde fonksiyon
modül export'una döndü, çağrı yeri global okumaya devam etti. Koşul hep yanlış,
toast hiç çıkmıyordu. Zil rozeti ayrı bir sayaç olduğu için o çalışmaya devam
ediyordu. 1 Eylül'de düzeltildi ve bu sınıf `server/test/global.test.js` ile
kapatıldı.

**Sebep B: tasarım boşluğu — kısmen kapatıldı.** Sunucudan gelen `notification`
olayının yaptığı iş şu kadar:

```js
setNotifCount(c => c + 1);   // rozet
_playDing();                 // ses
// toast yok
```

Yani **görev atama, bahsetme ve yorum bildirimleri hiçbir zaman toast
üretmiyordu.** Toast üreten tek yol `chat_message` olayıydı.

1 Eylül'de bu olaya da toast bağlandı. Hangi olayın ekranı keseceği hâlâ açık
bir soru (aşağıda S1); şimdilik **kişiye doğrudan yöneltilenler** kesiyor:
görev atama, bahsetme, yorum, katılma isteği, kanala ekleme. Bilgi amaçlı
olanlar (kolon eklendi) yalnızca zilde kalıyor. DM ve katılma onayı bilerek
dışarıda — onlar kendi soket olaylarından zaten toast üretiyor, iki kez
görünmesin diye.

---

## 2 · Mevcut durum haritası

**17 Eylül 2026 itibarıyla** (S1 karara bağlandı, kart #121):

| Olay | Zil rozeti | Ses | Toast | E-posta |
|---|:--:|:--:|:--:|:--:|
| **Görev atandı** | ✅ | ✅ | ✅ | ◑ |
| **Bahsedildi (mention)** | ✅ | ✅ | ✅ | ◑ |
| Göreve yorum yapıldı | ✅ | ❌ | ❌ | ❌ |
| Kanala eklendin | ✅ | ❌ | ❌ | ❌ |
| Katılma isteği geldi | ✅ | ❌ | ❌ | ❌ |
| Katılma isteği onaylandı | ✅ | ❌ | ✅* | ❌ |
| Katılma isteği reddedildi | ✅ | ❌ | ✅* | ❌ |
| Kolon eklendi | ✅ | ❌ | ❌ | ❌ |
| Direkt mesaj | ✅ | ✅ | ✅ | ❌ |
| Kanal mesajı | ✅ | ✅ | ✅ | ❌ |

\* Katılma onayı ve reddi **kendi soket olaylarından** toast üretiyor
(`join_request_approved` / `join_request_rejected`, `app.jsx`), bildirim
yolundan bağımsız. Kullanıcının kendi başlattığı bir işlemin cevabı olduğu
için bilerek bırakıldı — beklenen bir yanıt, sürpriz bir kesme değil.

**Sohbet (DM ve kanal mesajı) bu kararın DIŞINDA.** Kendi işleyicisi ve kendi
tercihleri var (`notifyMessages`, `notifyDMs`, `notifyGroupChat`) ve anlamı
farklı: bir DM "biri şu an seninle konuşuyor" demek, kesmesi doğru.

**Yol üstünde bulunan kusur:** kolon eklendiğinde ekranda hiçbir şey
görünmüyor ama **ding geliyordu**. Sebep, kesme kararının iki okuyucusu
olması ve birinin kuralı hiç uygulamamasıydı: toast `EKRANI_KESENLER`
kümesinden geçiyordu, ses ise **kapısızdı** — her bildirim ses çıkarıyordu.
Kullanıcı sesin nereden geldiğini bulamıyordu. İkisi artık tek kümeden
besleniyor ve `bildirim.test.js` bunu kilitliyor.

◑ = e-posta altyapısı bağlı ama **varsayılan kapalı** (`NOTIFY_EMAIL=1`).

`task_created` ve `task_moved` bildirim değil, **etkinlik kaydı** — kimseye
gönderilmiyor, ana ekrandaki akışta görünüyor.

**Kullanıcı tercihleri** (Ayarlar → Bildirimler): sohbet tarafında
`notifyMessages`, `notifyToasts`, `notifyDMs`, `notifyGroupChat`; ses için
`soundEnabled`. 1 Eylül'de **İş Bildirimleri** grubu ve `notifyTasks` anahtarı
eklendi — görev/bahsetme/yorum bildirimleri buradan kapatılabiliyor.
Rahatsız Etme (dnd) modu hepsini susturuyor.

---

## 3 · Boşluklar

1. ~~**En önemli bildirim en sessiz olan.**~~ *1 Eylül'de kapatıldı — görev
   bildirimleri artık ekranda görünüyor.* ~~Hangi olayın keseceği hâlâ S1'e
   bağlı.~~ *17 Eylül'de S1 kararlandı: atama ve bahsetme keser (kart #121).*
2. **Tarayıcı bildirimi yok.** Sekme arka plandayken hiçbir şey görünmüyor.
   Kurumsalda insanlar gün boyu başka sekmede; uygulama açık ama görünmüyorsa
   bildirim kaçıyor.
3. **Okundu bilgisi tek yönlü.** Zil sayacı görüntülenince sıfırlanıyor ama
   bildirim bazında "okundu/okunmadı" ayrımı zayıf.
4. **E-posta dar.** Yalnızca atama ve bahsetme, o da varsayılan kapalı.
   Yaklaşan/geçmiş teslim tarihi için hiçbir şey yok.
5. **Teslim tarihi bildirimi hiç yok.** "Yarın teslim" ya da "gecikti" uyarısı
   yok. Kurumsal raporlamanın yanında en çok istenecek şey bu.
6. **Toplu işlerde gürültü riski.** On kart birden atanırsa on ayrı bildirim
   ve on ding. Gruplama yok.
7. **Kalıcılık belirsiz.** Bildirimler ne kadar süre saklanıyor, temizleniyor
   mu — tanımlı bir politika yok.

---

## 4 · Karar bekleyen tasarım soruları

Bunlar kod sorusu değil, **ürün kararı**. İkinci toplantıda masaya
konabilecek nitelikte:

**S1 · Hangi olay ekranı kesmeli?** — **KARARLANDI (17 Eylül 2026, kart #121)**

**Atama ve bahsetme keser; geri kalan her şey sessiz birikir** (panelde durur,
zilde sayılır, ekranı kesmez). Sohbet bu kararın dışında (yukarı bakın).

Gerekçe: kesme hakkı "senden bir şey bekleniyor" diyen bildirime ait. Atama ve
bahsetme bu ikisi; ötekiler "bir şey oldu" diyor ve beklemeye tahammül eder.

Buradaki eski öneri **daha geniştir** ve bilerek daraltıldı: "sana yorum" da
kesenler arasındaydı. Yorum çoğu zaman bir tartışmanın devamı; on yorumlu bir
kartta on kesme, toast'ı değersizleştirir. Panelde duruyor, kaybolmuyor.

E-posta da aynı sınırı izliyor (`NOTIFY_EMAIL_TYPES` varsayılanı
`task_assigned,mention`). Postalanan şey kesen şeyle aynı olmalı; aksi hâlde
e-posta kutusu gürültüye boğulur ve hepsi birden okunmaz olur.

**Gözden geçirilmeye değer tek madde — `join_request`.** Karar onu sessiz
bıraktı ama o, ötekilerden farklı olarak **başka birini bekletiyor**: alana
katılmak isteyen kişi, sahip fark edene kadar kapıda kalıyor. Bir yorumu
kaçırmak kimseyi bekletmez, bunu kaçırmak bekletir. Kararı olduğu gibi
uyguladık; yeniden açılırsa ilk aday bu satır.

**S2 · Bildirim kanalı kullanıcı tercihine mi bırakılsın?**
Olay × kanal (ekran / ses / e-posta / tarayıcı) matrisi kullanıcıya açılırsa
esnek olur ama ayarlar ekranı şişer. Alternatif: üç hazır profil —
*sessiz / dengeli / her şey*.

**S3 · E-posta ne zaman gitmeli?**
Anında mı, yoksa "uygulamada 15 dakikadır görülmediyse" mi? İkincisi kurumsalda
standart davranış ve gürültüyü ciddi azaltıyor, ama gecikme yaratıyor.

**S4 · Teslim tarihi uyarısı kimin işi?**
Atanan kişiye mi, yöneticiye mi, ikisine de mi? Ne zaman — bir gün önce,
teslim günü, geciktiğinde? Bu, süre kaydı tartışmasıyla aynı aileden bir soru.

**S5 · Tarayıcı bildirimi istenir mi?**
İzin istemek rahatsız edici olabilir; kurumsal cihazlarda politika ile kapalı
olabilir. Kullanıcıya sorulmadan açılmamalı.

---

## 5 · Durum

**Yapıldı (1 Eylül, karar gerektirmeyenler)**
- `notification` olayına toast bağlandı; görev atama, bahsetme ve yorum artık
  ekranda görünüyor.
- Ayarlara **İş Bildirimleri** grubu eklendi (`notifyTasks`).

**Bekliyor — S1–S5 cevaplanmadan yapılmamalı**
- Tarayıcı bildirimi (S5)
- Teslim tarihi uyarıları (S4)
- E-posta kapsamı ve zamanlaması (S3)
- Olay × kanal tercih matrisi ya da hazır profiller (S2)
- Toplu işlerde gruplama — on kart birden atanırsa on toast çıkar

> Toast listesindeki seçim (`EKRANI_KESENLER`, `app.jsx`) bir **başlangıç
> varsayımı**, karar değil. S1 cevaplandığında oradan güncellenmeli.

---

## Zil rozeti: "son bakıştan beri gelen" (15 Eylül 2026)

**Kusur:** paneli açan/kapatan beş yol rozeti yalnızca yerel React durumunda
sıfırlıyordu (`setNotifCount(0)`); sunucudaki `read` alanına hiç dokunulmuyordu.
Sonraki girişte açılış `unread` sayısını okuyor, günler önce bakılmış bildirim
rozeti yeniden dolduruyordu. Sunucu uçları (`read-all`, `:id/read`) doğruydu,
sorun hiç çağrılmamalarıydı.

**Karar (c), Outlook benzetmesiyle:** posta gelir, önemsizse açmazsın; önemliyse
tıklarsın, seni ilgili yere götürür ve okundu olur. Rozet artık okunmamış
sayısı değil, **son bakıştan beri gelen okunmamış** sayısıdır. Okundu işaretini
kullanıcı verir: bildirime tıklamak zaten sunucuya yazıyordu, "hepsini okundu
işaretle" duruyor. "Son bakış" anı tarayıcıda (`localStorage`,
`stoa.notifSonBakis.<slug>`); kullanıcıya göre ayrı, çünkü demo hazırlığında
iki hesap aynı Chrome'daydı.

**Niçin sunucuda değil:** bir sütun ve elle şema göçü isterdi (CLAUDE.md,
tuzaklar). Bedeli: başka cihazda rozet ilk kez tam sayıyla gelir; kabul edildi.
Depolama yoksa ya da fırlatıyorsa (gizli pencere) okuma 0 döner, yani rozet tam
sayı gösterir: yokluk hâli gizleyerek değil göstererek hata yapıyor.

**Yerleri:** saf çekirdek `client/src/rozet.js`; `app.jsx`'te beş sıfırlama
noktası tek `rozetBakildi()` yardımcısına bağlandı; test `bildirim.test.js`
son bloğu (mutasyonla doğrulandı: eşik yok sayılınca 2 test kırılıyor).

