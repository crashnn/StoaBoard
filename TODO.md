# StoaBoard — To-Do

Canlı: [stoaboard.com](https://www.stoaboard.com) · Railway + Neon PostgreSQL,
`main`e push ile otomatik dağıtım.

---

> **Toplantı geri bildirimlerinin karşılığı** — hangi not için ne yapıldı, ne
> yapılmadı ve neden: [TOPLANTI-KARSILIGI.md](TOPLANTI-KARSILIGI.md).
> Güvenlik çalışma biçimi ve her özelliğin geçmesi gereken elek:
> [GUVENLIK.md](GUVENLIK.md).

---

## ✅ Güvenlik turu — 1 Eylül 2026

Raporlama turunun hemen ardından, dal üzerinde yapılan güvenlik denetimi ve
sonuçları. Çalışma biçimi ve tehdit modeli artık [GUVENLIK.md](GUVENLIK.md)
içinde — **her yeni özellik oradaki on soruluk elekten geçmeli.**

**Denetimden çıkan ve kapatılan bulgular**
- **CSV formül enjeksiyonu (yüksek).** Rapor CSV'lerindeki görev başlıkları ve
  kişi adları kullanıcı girdisi. Excel `=` `+` `-` `@` ile başlayan hücreyi
  formül sayıp çalıştırıyor; tırnaklamak engellemiyor. Bir üye kart başlığını
  `=HYPERLINK(...)` yapıp **raporu açan yöneticinin makinesinde** veri
  sızdırabilirdi. Saldırı verinin kendisini değil, veriyi açan kişiyi hedefliyor.
- **Kullanıcı varlığı oracle'ı (düşük).** `/api/reports/person?user=<slug>`
  çözümlemesi tüm platformda ve yetki kontrolünden **önce** yapılıyordu:
  olmayan slug 404, olan 403. Arama artık çalışma alanı üyeleriyle sınırlı.
- **İç hata mesajı sızıntısı.** Hata yakalayıcı her `err.message`ı olduğu gibi
  döndürüyordu; Prisma bağlantı hataları sorgu adını ve veritabanı sunucusunun
  adresini taşıyor ve bu **kayıt/giriş ekranından, kimlik doğrulaması olmadan**
  görülebiliyordu.

**Denetim kaydı (`audit_logs`)**
- Kim, ne zaman, hangi raporu, hangi aralıkla, kaç satır dışa aktardı — IP ve
  tarayıcı bilgisiyle. İçeriden sızıntıya karşı pratikte işe yarayan kontrol
  engelleme değil izlenebilirlik: veriyi görmesi meşru olan biri onu kopyalamayı
  zaten başarır, ama kaydın tutulduğunu bilmek caydırır.
- Rapor ekranında **Denetim kaydı** sekmesi. Yalnızca `manage_workspace` —
  denetim kaydının kendisi de hassas bir yüzey.
- Kayda asla veri içeriği yazılmıyor, yalnızca bağlam.
- Geçiş ve süre kayıtlarıyla aynı gerekçeyle ilişkisiz: sildiğin kullanıcıyla
  birlikte kaybolan denetim kaydı, denetim kaydı değildir.

**Denetlenip temiz bulunanlar**
- Çalışma alanları arası IDOR yok — `?project=` çalışma alanıyla AND'leniyor,
  yabancı proje kimliği boş küme veriyor.
- `userToDict` e-posta döndürmüyor; genel/özel serileştirici ayrımı sağlam.
- Direkt mesajlar çalışma alanı ortaklığıyla, özel kanallar üyelikle korunuyor.
- CSRF `SameSite=lax` ile kapalı; ham SQL yok.

---

## ✅ Raporlama turu — 1 Eylül 2026

Netaş toplantısındaki geri bildirimler üzerine. Toplantının üç ayrı notu
("6 ayda bir raporlama", "log girişi / work log developer", "Furkan hangi
task'larda çalışmış") tek bir talebe işaret ediyordu: **kişi bazlı, geriye
dönük, süre içeren raporlama.**

**Veritabanı — kayıt bugünden birikmeye başlıyor**
- **Görev geçiş kaydı** (`task_transitions`). Kart her taşındığında bir satır:
  görev, önceki/yeni kolon, kim, ne zaman. Kartın ilk yerleşimi de geçiş sayılır.
  **İlişki (FK) bilerek kurulmadı** — görev, proje veya kullanıcı silinse de
  satır yaşamalı; çöp kutusu 30 günde kalıcı sildiği için aksi hâlde altı aylık
  rapor delik çıkardı. Görev başlığı, kişi adı ve kolon başlıkları o anki
  hâliyle kopyalanıyor.
- **Süre kaydı** (`work_logs`). Kişinin göreve harcadığı emek, manuel giriş.
  Aynı gerekçeyle ilişkisiz ve denormalize.
- **`tasks.completed_at`.** Yoktu; "bu iş ne kadar sürede tamamlandı" sorusu bu
  yüzden hiçbir şekilde cevaplanamıyordu. Bitiş kolonuna girişte yazılıyor,
  çıkışta siliniyor; iki bitiş kolonu arasında gezinirken ilk zaman korunuyor.

> Geçiş süresi ile harcanan emek **ayrı şeylerdir**: bir iş üç haftada bitmiş
> ama altı saat emek almış olabilir. İlki tıkanıklığı, ikincisi maliyeti
> gösterir. Jira'nın da ayrı tuttuğu ayrım bu.

**Raporlar**
- **Kişi raporu** — kim, hangi işte, ne kadar süre. Başkasının raporu için üye
  yönetimi izni gerekiyor; kişi kendi raporunu her zaman görüyor.
- **Dönem raporu** — ne açıldı, ne bitti, ne bekliyor; kolon hareketleri.
- **Akış raporu** — ortalama/ortanca tamamlanma süresi, kolonlarda bekleme,
  en uzun süren işler.
- Aralık ön ayarları: bu ay / son 3 ay / **son 6 ay** / bu yıl.
- **CSV** (noktalı virgül + BOM — Türkçe Excel doğru açsın diye) ve
  **yazdırma sayfası**. PDF kütüphanesi bilinçli olarak eklenmedi: tarayıcının
  "PDF olarak kaydet"i aynı işi görüyor, maliyeti onda biri.

**E-posta bildirimi**
- SMTP altyapısı kuruluydu ama yalnızca şifre sıfırlamada kullanılıyordu. Atama
  ve bahsetme bildirimleri postaya bağlandı.
- **Varsayılan kapalı.** `NOTIFY_EMAIL=1` verilmeden tek posta gitmez — SMTP
  zaten tanımlı olduğu için aksi hâlde ilk dağıtımda herkese posta giderdi.
  `NOTIFY_EMAIL_TYPES` ile tür seçilebiliyor, kullanıcı bazında kapatılabiliyor.

**Kolon geçiş kuralı**
- Toplantıda gösterilen Jira ekranındaki "Open → yalnızca In Review" kısıtının
  karşılığı. Kolona izin verilen sonraki kolonlar tanımlanabiliyor; boş
  bırakılırsa kısıt yok, mevcut panolar aynen çalışıyor. Sunucu tarafı hazır,
  **arayüz henüz yok.**

**Yol üstünde bulunan hata**
- **Yeni projelerde bitiş kolonu işaretlenmiyordu.** Varsayılan kolonlar
  oluşturulurken "Tamamlandı" kolonuna `is_done` konmuyordu; bu yüzden yeni
  projelerde tamamlanan sayacı, ilerlemenin %100'e çekilmesi ve tamamlanma
  zamanı hiç çalışmıyordu. Düzeltildi (yalnızca yeni projeleri etkiler).

> ⚠️ **Veritabanı adımı bekliyor.** Şema dosyası güncel ama canlı veritabanına
> gönderilmedi. `prisma db push` üretim verisine dokunuyor; yedek alındıktan
> sonra çalıştırılmalı. Eklenenlerin hepsi katkı niteliğinde (iki yeni tablo,
> üç yeni sütun), veri kaybı beklenmiyor.

---

## ✅ Bu turda kapatılanlar

Canlı sistem üzerinde yapılan inceleme sonucu bulunan ve düzeltilen hatalar.

### Veri bütünlüğü
- **Not gövdesi hiç yüklenmiyordu.** Liste ucu notları `includeBody: false` ile
  döndürüyor, gövde yalnızca `GET /api/notes/:id`den geliyor — ama istemci o
  çağrıyı hiç yapmıyordu. Not boş açılıyor, kullanıcı bir şey yazıp alandan
  çıkınca boş gövde kaydedilip **içerik siliniyordu.** Açılışta gövde çekiliyor,
  yüklenmeden kaydetme yapılmıyor, gövde sonradan gelince editöre aktarılıyor.
- **İlerleme yüzdesi bayat kalıyordu.** Hesap yalnızca `PATCH /api/subtasks/:id`
  içinde yapılıyordu; alt görev eklenince, silinince ve kart "tamamlandı"
  kolonundan çıkarılınca güncellenmiyordu. Ortak `recalcTaskProgress()`
  yardımcısı eklendi, üç çağrı yerine bağlandı.

### Ana sayfa
- **Haftalık ilerleme grafiği hiçbir zaman çalışmıyordu.** Sunucu kolonu
  `{ id: <slug>, db_id, ... }` olarak gönderiyor — `slug` alanı yok. Ana sayfa
  19 yerde `c.slug` okuyordu; sonuç `undefined` olunca her günün toplamı sıfır
  çıkıyor ve "veri olmayan günleri gizle" filtresi grafiği tamamen boşaltıyordu.
  Aylık görünüm ve "bu hafta tamamlanan" göstergesi de aynı sebeple ölüydü.

### Arayüz
- **Sol panel kaydırılamıyordu** — proje/DM birikince alt kısım kırpılıyor ve
  ulaşılamıyordu. Orta blok `.sidebar-scroll` içine alındı; çubuk gizli, tekerlek
  ve dokunmatik ile geziniyor.
- **Bildirim paneli ikinci tıklamada kapanmıyordu** — panelin `mousedown` dışarı
  tıklama kapanışı ile butonun `click` toggle'ı birbirini iptal ediyordu. Zil
  butonu `data-notif-toggle` ile istisna tutuldu.
- **Çöp Kutusu sola yapışıyordu** — `max-width` var ama ortalama yok. Diğer
  görünümler gibi alanı dolduruyor.

### Mobil
- **Sohbet dar bir sütuna sıkışıyordu.** Izgara `:has()` kurallarıyla tanımlı
  (0,2,0); mobil kural sade `.chat-fp-grid` (0,1,0). Medya sorgusu özgüllük
  eklemediği için mobil kural hiç uygulanmıyordu — panel `display:none` olsa bile
  sütunu yer kaplamaya devam ediyordu. **760–1100px arası da aynı sebeple
  bozuktu.** Her iki kırılımda `:has()` varyantları yazıldı.
- **Pano araç çubuğu taşıyordu** — Liste/Kanban/Tablo/Çizelge sekmeleri ekran
  dışında kalıp erişilemiyordu. 768px altında yatay kaydırma eklendi.
- **Ayarların 13 sekmesinin devamı belli olmuyordu** — çubuk gizlendi, sağ kenara
  soluma ipucu kondu.

### Temizlik
- Vite'a geçmeden önceki CDN tabanlı ön yüz kaldırıldı: `static/src/`,
  `static/styles.css`, `server/views/index.html` — **~26.000 satır ölü kod.**
  Artık servis edilmiyordu, `static/dist` kullanılıyor.
- README güncel mimariye çekildi (client/ + Vite, iki paketli kurulum,
  gerçek Railway build komutu, `VITE_GOOGLE_CLIENT_ID`).

---

## 🔜 Sıradakiler

### Öncelikli
- [ ] **Otomatik test yok.** En büyük teknik açık. Başlanacak yer belli: izin
      katmanı (`hasPermission`) ve soket olaylarının yetki kontrolleri — en
      riskli ve en çok değişen kod orası.
- [ ] **Dosya depolama ölçeklenmiyor.** Yüklenen dosyalar veritabanında `bytea`
      olarak duruyor. S3/R2'ye taşınmalı; kod tarafında yerelleştirilmiş bir
      değişiklik (`lib/uploads.js` + `routes/attachments.js`).
- [ ] **Veritabanı göçleri sürümsüz.** `prisma db push --accept-data-loss`
      kullanılıyor — hızlı ama geçmiş tutmuyor ve veri kaybı riski taşıyor.
      Gerçek kullanıcı verisi büyümeden düzenli migration dosyalarına geçilmeli.

### Bilinen kusurlar
- [ ] Topbar'daki sohbet butonu bazı ekranlarda tepki vermiyor (yeniden
      üretilemedi — adım tarifi gerekiyor).
- [ ] Alt görevi olmayan bir kart "tamamlandı" kolonundan çıkarılınca ilerleme
      %100 kalıyor. Alt görev yoksa hesaplanacak bir kaynak da yok; bilinçli
      olarak dokunulmadı.
- [ ] Paket boyutu 787 KB (gzip 220 KB), kod bölme yapılmadı. İlk açılışı
      yavaşlatıyor.
- [ ] `chat.jsx` ve `data.jsx` beklenenden kalın; bölünmeleri gerekiyor.
- [ ] Almanca, İspanyolca ve Rusça yalnızca gezinme ve ayarlar düzeyinde
      (43'er anahtar); eksikler Türkçe'ye düşüyor. TR/EN tam (~940 anahtar).

### Tasarım kararı bekleyenler
- [ ] **Süreyi kim girer?** Geliştirici mi, yönetici mi; girilmezse ne olur?
      Şu an herkes yalnızca kendi süresini giriyor, zorunluluk yok. Kurumsalda
      gerçekten tartışmalı bir konu — **ikinci toplantıda masaya konacak soru
      bu.** Karar verilmeden hatırlatma/zorunluluk mekanizması yazılmamalı.
- [ ] **Kolon geçiş kuralı arayüzü.** Sunucu tarafı hazır. Kural kolonun
      ayarlarından mı, yoksa proje düzeyinde bir akış ekranından mı
      tanımlanacak? İkincisi Jira'nın karmaşıklığına doğru bir adım — dikkat.
- [ ] **Sohbet kapsamı.** Şu an kanallar çalışma alanı geneli. Seçenekler:
      (A) böyle kalsın, (B) her projeye özel sohbet, (C) kanallar genel kalsın
      ama istenirse bir projeye bağlanabilsin. **Öneri: C** — B küçük takımlarda
      ıssız kanallar üretiyor, A ise proje–konuşma bağını hiç kurmuyor.
