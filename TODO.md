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
- **Kişi raporu** — kim, hangi işte, ne kadar süre. Başkasının raporu için
  `view_reports` izni gerekiyor; kişi kendi raporunu her zaman görüyor.
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
  bırakılırsa kısıt yok, mevcut panolar aynen çalışıyor. **Kolon menüsünden
  yönetiliyor**; engellenen taşımada kullanıcı sebebi görüyor.

**Yol üstünde bulunan hata**
- **Yeni projelerde bitiş kolonu işaretlenmiyordu.** Varsayılan kolonlar
  oluşturulurken "Tamamlandı" kolonuna `is_done` konmuyordu; bu yüzden yeni
  projelerde tamamlanan sayacı, ilerlemenin %100'e çekilmesi ve tamamlanma
  zamanı hiç çalışmıyordu. Düzeltildi (yalnızca yeni projeleri etkiler).

> ✅ **Veritabanı adımı tamamlandı (2 Eylül).** Şema production'a uygulandı —
> Neon SQL Editor üzerinden, **üç yeni tablo** (`task_transitions`, `work_logs`,
> `audit_logs`) ve **üç yeni sütun** (`tasks.completed_at`,
> `board_columns.allowed_next`, `users.email_notifications`) yerinde ve
> doğrulandı. Hepsi katkı niteliğindeydi, veri kaybı olmadı.
>
> Bunun için açılan Neon `raporlama-test` dalı **artık atıl** — silinebilir.
> [RAPORLAMA-TESTI.md](RAPORLAMA-TESTI.md) tarihsel kayıt olarak duruyor;
> yeniden kurulum talimatı değil.
>
> Bundan sonraki şema değişikliklerinde `db push`'un deploy zincirinden
> çıkarıldığını unutma — şema artık **bilinçli ve elle** gönderiliyor
> (gerekçe: [CLAUDE.md](CLAUDE.md), tuzaklar bölümü).

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

### Hemen yapılabilir — depo dışı, 5 dakikalık işler
- [ ] **CI'ı gerçek kapıya çevir.** `.github/workflows/ci.yml` eklendi ama
      şu an yalnızca alarm: kırmızı CI push'u engellemiyor. GitHub'da
      `Settings → Branches → Add rule → main` → **Require status checks to
      pass before merging** açılıp `sunucu testleri` ve `ön yüz derlemesi`
      seçilmeli. Bu yapılmadan zorlama merdiveninde 4.5 basamakta kalıyoruz.
- [ ] **`dil-ve-ci` dalını main'e al.** 5 commit. PR açmak CI'ın main'e
      girmeden önce doğrulamasını sağlar — dalın kurulma sebebi bu.
- [ ] **`raporlama` dalını sil** (yerelde ve uzakta). `main`'in tamamen
      içinde, tek fazla commit'i yok; artık ölü ağırlık ve kafa karıştırıyor.

### Öncelikli
- [ ] **Uç testleri — kapsamlamanın DOĞRULUĞU test edilmiyor.** 3 Eylül'de
      `yetki.test.js` eklendi ve iki değişmezi kilitledi: her uç `requireAuth`
      taşıyor (113 uçtan 9'u gerekçeli açık listede), ve hiçbir soket
      işleyicisi kimliği olay gövdesinden okumuyor. Bu, "kimlik doğrulaması
      unutuldu" sınıfını kapatıyor.
      **Kapanmayan sınıf:** bir ucun kapsamlamasının *doğru* olup olmadığı.
      Denendi ve bilinçli olarak vazgeçildi — statik tarama 70 mutasyon
      ucunun 46'sını işaretledi, hepsi yanlış pozitifti. Sebep kapsamlamanın
      tek biçimde yapılmaması: kimi uç `userId: user.id` ile, kimi aktif
      çalışma alanıyla, kimi `loadTaskWithAccess(permission:)` ile, kimi
      `requireWorkspacePermission` ile kapsanıyor. Dördü de doğru, hiçbiri
      aynı imzada. Ayırt etmek için isteğin gerçekten çalıştırılması gerek.
      **Gereken:** supertest benzeri bir koşum + sahte oturum + veritabanı
      taklidi. Asıl engel bu. Yazılınca ilk hedef: çalışma alanları arası
      IDOR, rol yükseltme, ve `view_reports` olmadan başkasının raporu.
- [ ] **`yetki.test.js` yalnızca `routes/` ve `sockets/` tarıyor.** Yeni bir
      dizine uç eklenirse tarama onu görmez. Uç kayıtları başka bir yere
      taşınırsa testteki `ROUTES`/`SOCKETS` yolları güncellenmeli.
- [ ] **Test kapsamı saf mantıkla sınırlı.** ~~Otomatik test yok.~~ 1–3 Eylül
      arasında sıfırdan **137 test** yazıldı (`server/test/`): güvenlik
      regresyonları, modül yükleme (smoke), raporlama saf mantığı ve dil
      sözlüğü/hata kodu kilidi. Hiçbiri veritabanı istemiyor.
      **Kalan açık:** uçların kendisi test edilmiyor. İzin katmanı
      (`hasPermission`) ve soket olaylarının yetki kontrolleri hâlâ elle
      doğrulanıyor — en riskli ve en çok değişen kod orası. Gerçek testi
      yazmak için istek düzeyinde (supertest benzeri) bir koşum gerekiyor;
      asıl engel oturum/veritabanı taklidi.
- [ ] **Dosya depolama ölçeklenmiyor.** Yüklenen dosyalar veritabanında `bytea`
      olarak duruyor. S3/R2'ye taşınmalı; kod tarafında yerelleştirilmiş bir
      değişiklik (`lib/uploads.js` + `routes/attachments.js`).
- [ ] **Veritabanı göçleri sürümsüz.** `prisma db push` kullanılıyor — hızlı
      ama migration geçmişi tutmuyor. 2 Eylül 2026'da `--accept-data-loss`
      deploy zincirinden çıkarıldı (`postinstall`, `npm start`, `railway.toml`),
      yani şema artık kendiliğinden gitmiyor ve sessiz `DROP` riski yok.
      3 Eylül'de `session` tablosu şemaya tanıtıldı (6242a7c): elle çalıştırılan
      `prisma db push` de artık onu düşürmeye çalışmıyor, yani
      `--accept-data-loss` yazma ihtiyacı hiç doğmuyor.
      Kalan eksik geçmiş: hangi şemanın ne zaman gittiği kayıtlı değil.
      Gerçek kullanıcı verisi büyümeden düzenli migration dosyalarına geçilmeli.

### Bilinen kusurlar
- [ ] Topbar'daki sohbet butonu bazı ekranlarda tepki vermiyor (yeniden
      üretilemedi — adım tarifi gerekiyor).
- [ ] Alt görevi olmayan bir kart "tamamlandı" kolonundan çıkarılınca ilerleme
      %100 kalıyor. Alt görev yoksa hesaplanacak bir kaynak da yok; bilinçli
      olarak dokunulmadı.
- [x] ~~Paket boyutu 787 KB, kod bölme yapılmadı.~~ **Yapıldı (2 Eylül).**
      Satıcı bölme (react-vendor 143 KB, realtime 42 KB ayrı, önbelleklenir) +
      altı açılış-dışı görünüm tembel yükleniyor (reports, notes, settings,
      calendar, dashboard, trash). İlk boya 806→~642 KB (ham), derleme uyarısı
      kalktı. ChatPanel/NotifPanel bilerek eager (ikişer render noktası).
- [ ] `chat.jsx` ve `data.jsx` beklenenden kalın; bölünmeleri gerekiyor.
- [x] ~~`client/src/views/list.jsx` öksüz.~~ **Silindi (3 Eylül).** Liste
      görünümü board alt-görünümüne taşınınca render edilmez olmuştu; app.jsx'teki
      ölü import 2 Eylül'de kaldırılmış, dosyanın kendisi kalmıştı. `ListView`
      adının depoda başka geçtiği yer yoktu, derleme silmeden sonra da temiz.
- [ ] Almanca, İspanyolca ve Rusça yalnızca gezinme ve ayarlar düzeyinde
      (43'er anahtar); eksikler Türkçe'ye düşüyor. TR/EN tam: **1154'er
      anahtar**, 106'sı sunucu hata kodu.
      Dördüncü dil eklemek artık daha kolay ama otomatik değil: `dil.test.js`
      bilinçli olarak yalnızca tr/en denkliğini kilitliyor. Yeni dil gerçekten
      benimsenecekse testteki dil listesi genişletilmeli, yoksa eksik anahtar
      yine sessizce Türkçe'ye düşer.
- [x] ~~**`dil.test.js`'in kör noktası.**~~ **Kapatıldı (3 Eylül).** Ölçüt
      "metin nerede duruyor"dan "metnin çevirisi var mı"ya çevrildi; tarama
      artık dosyanın tamamını okuyor. Tur 58 kaçak buldu ve kapattı — bunların
      **31'i kodda çağrılıp sözlüğe hiç eklenmemiş anahtardı**, yani ekran
      doğru yazılmış ama İngilizce arayüzde Türkçe duruyordu. Ayrıntı:
      [CLAUDE.md](CLAUDE.md) dil bölümü.

### Tasarım kararı bekleyenler
- [ ] **Bildirimler baştan ele alınacak.** Toplantıda mesaj gönderildi, karşı
      tarafta toast çıkmadı. İki sebebi vardı: biri kırık koddu (düzeltildi),
      diğeri tasarım boşluğu ve **hâlâ açık** — görev atama, bahsetme ve yorum
      bildirimleri hiçbir zaman toast üretmiyor, yalnızca zil rozeti ve ses.
      Kurumsalda en kritik bildirim en sessiz olanı. Harita, boşluklar ve karar
      bekleyen beş soru: [BILDIRIMLER.md](BILDIRIMLER.md).
- [ ] **Süreyi kim girer?** Geliştirici mi, yönetici mi; girilmezse ne olur?
      Şu an herkes yalnızca kendi süresini giriyor, zorunluluk yok. Kurumsalda
      gerçekten tartışmalı bir konu — **ikinci toplantıda masaya konacak soru
      bu.** Karar verilmeden hatırlatma/zorunluluk mekanizması yazılmamalı.
- [x] ~~**Kolon geçiş kuralı arayüzü.** Kolon ayarından mı, proje düzeyinde akış
      ekranından mı?~~ **Karar verildi ve yapıldı (1 Eylül, 9035c2a).** Kural
      kolon menüsünden yönetiliyor (`views/board.jsx`); proje düzeyinde ayrı
      akış ekranı bilinçli olarak seçilmedi — o, Jira'nın karmaşıklığına doğru
      bir adımdı. Hiçbiri seçili değilse kısıt yok, mevcut panolar aynen
      çalışıyor; engellenen taşımada kullanıcı sebebi görüyor.
      **Kalan iş:** bu menünün metinleri çevrilmedi ("Geçiş kuralı", "kısıt
      yok", "Kuralı kaldır", yardım cümlesi hâlâ çıplak Türkçe) ve
      `dil.test.js` bunları göremiyor — kör noktası [CLAUDE.md](CLAUDE.md)
      dil bölümünde anlatıldı.
- [ ] **Sohbet kapsamı.** Şu an kanallar çalışma alanı geneli. Seçenekler:
      (A) böyle kalsın, (B) her projeye özel sohbet, (C) kanallar genel kalsın
      ama istenirse bir projeye bağlanabilsin. **Öneri: C** — B küçük takımlarda
      ıssız kanallar üretiyor, A ise proje–konuşma bağını hiç kurmuyor.
