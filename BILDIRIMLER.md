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

**Sebep B: tasarım boşluğu — bu hâlâ açık.** Sunucudan gelen `notification`
olayının yaptığı iş şu kadar:

```js
setNotifCount(c => c + 1);   // rozet
_playDing();                 // ses
// toast yok
```

Yani **görev atama, bahsetme ve yorum bildirimleri hiçbir zaman toast
üretmiyor.** Toast üreten tek yol `chat_message` olayı. Sebep A düzeltildi ama
B duruyor: sohbet dışındaki hiçbir şey ekranda görünmüyor.

---

## 2 · Mevcut durum haritası

| Olay | Zil rozeti | Ses | Toast | E-posta |
|---|:--:|:--:|:--:|:--:|
| Görev atandı | ✅ | ✅ | ❌ | ◑ |
| Bahsedildi (mention) | ✅ | ✅ | ❌ | ◑ |
| Göreve yorum yapıldı | ✅ | ✅ | ❌ | ❌ |
| Direkt mesaj | ✅ | ✅ | ✅ | ❌ |
| Kanal mesajı | ✅ | ✅ | ✅ | ❌ |
| Kanala eklendin | ✅ | ✅ | ❌ | ❌ |
| Katılma isteği geldi | ✅ | ✅ | ❌ | ❌ |
| Katılma isteği onaylandı | ✅ | ✅ | ✅ | ❌ |
| Katılma isteği reddedildi | ✅ | ✅ | ✅ | ❌ |
| Kolon eklendi | ✅ | ✅ | ❌ | ❌ |

◑ = e-posta altyapısı bağlı ama **varsayılan kapalı** (`NOTIFY_EMAIL=1`).

`task_created` ve `task_moved` bildirim değil, **etkinlik kaydı** — kimseye
gönderilmiyor, ana ekrandaki akışta görünüyor.

**Kullanıcı tercihleri** (Ayarlar → Bildirimler) yalnızca sohbeti kapsıyor:
`notifyMessages`, `notifyToasts`, `notifyDMs`, `soundEnabled`. Görev
bildirimleri için tercih yok — çünkü zaten toast üretmiyorlar.

---

## 3 · Boşluklar

1. **En önemli bildirim en sessiz olan.** Kurumsalda "sana görev atandı"
   mesajdan daha kritik. Şu an ekranda hiçbir şey görünmüyor; kullanıcı zili
   fark etmezse haberi olmuyor.
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

**S1 · Hangi olay ekranı kesmeli?**
Her bildirim toast olursa toast değersizleşir. Öneri: *sana doğrudan
yöneltilenler* keser (atama, bahsetme, DM, sana yorum), *bilgi amaçlılar*
kesmez (kolon eklendi, kanala eklendin). Ama bu bir varsayım — kullanıcıya
sorulmalı.

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

## 5 · Önerilen sıra

Kararlar alınmadan büyük iş yapılmamalı. Ama şu ikisi karar beklemez:

1. **`notification` olayına toast bağla** — S1'in cevabı beklenirken en azından
   atama ve bahsetme ekranda görünsün. Mevcut tercih anahtarları genişletilir.
2. **Bildirim tercihlerini görev tarafına da aç** — bugün yalnızca sohbeti
   kapsıyor.

Sonrası S1–S5'in cevabına bağlı.
