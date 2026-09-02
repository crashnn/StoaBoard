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

| Olay | Zil rozeti | Ses | Toast | E-posta |
|---|:--:|:--:|:--:|:--:|
| Görev atandı | ✅ | ✅ | ✅ | ◑ |
| Bahsedildi (mention) | ✅ | ✅ | ✅ | ◑ |
| Göreve yorum yapıldı | ✅ | ✅ | ✅ | ❌ |
| Direkt mesaj | ✅ | ✅ | ✅ | ❌ |
| Kanal mesajı | ✅ | ✅ | ✅ | ❌ |
| Kanala eklendin | ✅ | ✅ | ✅ | ❌ |
| Katılma isteği geldi | ✅ | ✅ | ✅ | ❌ |
| Katılma isteği onaylandı | ✅ | ✅ | ✅ | ❌ |
| Katılma isteği reddedildi | ✅ | ✅ | ✅ | ❌ |
| Kolon eklendi | ✅ | ✅ | ❌ | ❌ |

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
   bildirimleri artık ekranda görünüyor.* Hangi olayın keseceği hâlâ S1'e bağlı.
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
