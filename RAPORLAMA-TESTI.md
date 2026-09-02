# `raporlama` dalı — kurulum ve test talimatı

Bu dosya, dalı **başka bir bilgisayarda** ayağa kaldırıp test etmek için yazıldı.
Sıfırdan bir makinede sırayla uygulanabilir.

> **Claude Code'a not:** Bu dal **`main`e birleştirildi** (58b1a6d, 2 Eylül
> 2026) ve şema production'a uygulandı. Yani bu dosya artık bir dalı ayağa
> kaldırma talimatı değil, **raporlama özelliklerinin kurulum ve test
> talimatı** — adımlar `main` üzerinde aynen geçerli. Geliştirmede
> `npm run dev` kullan.
>
> 2 Eylül 2026'dan önce `npm start` ve `postinstall` kendi başına
> `prisma db push --accept-data-loss` tetikliyordu; o çağrılar kaldırıldı.
> Eski bir kopyayla çalışıyorsan bu uyarı hâlâ geçerlidir.

---

## Bu dalda ne var

Netaş toplantısındaki geri bildirimler üzerine yazılan raporlama altyapısı:

- **Görev geçiş kaydı** (`task_transitions`) — kart her taşındığında bir satır.
  Görev silinse de yaşasın diye ilişki (FK) bilerek kurulmadı, alanlar
  denormalize edildi.
- **Süre kaydı** (`work_logs`) — kişinin göreve harcadığı emek, manuel giriş.
- **`tasks.completed_at`** — "bu iş ne kadar sürede bitti" sorusu bu alan
  olmadan cevaplanamıyordu.
- **Üç rapor** — kişi, dönem, akış. CSV ve yazdırma çıktısı.
- **E-posta bildirimi** — varsayılan KAPALI (`NOTIFY_EMAIL=1` ile açılır).
- **Kolon geçiş kuralı** — `board_columns.allowed_next`. Kolon menüsünden
  yönetiliyor; kural tanımlanmayan kolonlarda kısıt yok.
- **Denetim kaydı** (`audit_logs`) — rapor dışa aktarımları kaydediliyor,
  Raporlar ekranında ayrı sekme (yalnızca çalışma alanı yöneticisi).
- **Güvenlik düzeltmeleri** — CSV formül enjeksiyonu, iç hata mesajı sızıntısı,
  kullanıcı varlığı oracle'ı, sohbette hayalet kanallar, hayalet/eksik izinler,
  parola değişince oturumların düşmemesi.

Ayrıntılı gerekçeler `TODO.md` içindeki "Raporlama turu" ve "Güvenlik turu"
bölümlerinde; çalışma biçimi ve tehdit modeli `GUVENLIK.md` içinde.

---

## 1 · Kodu al

Dal `main`e birleştirildi; ayrı bir dala geçmeye gerek yok.

```bash
git clone https://github.com/crashnn/StoaBoard.git
cd StoaBoard
```

Repo zaten varsa:

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
```

> **Mevcut bir kopyada `git pull` kullanma.** Bu depoda `origin`in **fetch**
> adresi `MrAtalay/StoaBoard-eray` (fork) ve o fork 27 Mayıs 2026'da donmuş;
> asıl iş `crashnn/StoaBoard`, yani `upstream`de. `git pull` hatasız çalışır
> ama bayat depoya bakar ve hiçbir şey getirmez — 3 Eylül'de "main'i çektim,
> bir şey gelmedi" tıkanmasının sebebi buydu. Karşılaştırmayı da `origin/main`e
> değil `upstream/main`e karşı yap.

Doğrula: `git log --oneline` çıktısında **`58b1a6d`** (raporlama birleştirmesi)
görünmeli.

## 2 · Veritabanı: Neon'da test dalı

Neon konsolu → `stoaboard` projesi → **Branches**.
`raporlama-test` dalı zaten var (parent: `production`). Yoksa yeniden oluştur:
parent olarak `production` seç.

**Connection string**ini kopyala. Üretim dalını (`production`) **kullanma**.

## 3 · `server/.env` oluştur

Bu dosya `.gitignore`da, repo ile gelmez — elle yazılmalı.

```env
DATABASE_URL="<Neon raporlama-test dalinin connection string'i>"
SECRET_KEY=en-az-32-karakterlik-rastgele-bir-dizi
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:5000,http://localhost:5173
SESSION_COOKIE_SECURE=false
```

`CORS_ORIGINS`e `:5173` mutlaka eklenmeli — istemci geliştirme sunucusu orada.

> Neon adresinin sonunda `?sslmode=require&channel_binding=require` olmalı.

## 4 · Bağımlılıklar

```bash
cd server
npm install

cd ../client
npm install
```

`--ignore-scripts` artık gerekmiyor: `postinstall` yalnızca `prisma generate`
çalıştırıyor, şema göndermiyor. Şemayı bir sonraki adımda bilerek göndereceğiz.

> **Windows / PowerShell:** `npm` komutu `npm.ps1`e çözümlenip
> *"running scripts is disabled on this system"* hatası verebilir.
> Çözüm: **`npm` yerine `npm.cmd` yaz** (`npm.cmd install`, `npm.cmd run dev`).
> Git Bash kullanıyorsan düz `npm` çalışır.

## 5 · Şemayı gönder

```bash
cd server
npx prisma db push --skip-generate
```

Beklenen: üç yeni tablo (`task_transitions`, `work_logs`, `audit_logs`), üç yeni
sütun (`tasks.completed_at`, `board_columns.allowed_next`,
`users.email_notifications`).

> **`--accept-data-loss` ekleme.** Değişikliklerin hepsi katkı niteliğinde;
> komut veri kaybı isterse durması gerekir.

Bağlanamazsa (`P1001`, `ECONNRESET`, zaman aşımı): bulunduğun ağ 5432'yi
engelliyor olabilir. Kurumsal ağlarda yaygın; ev ağında veya mobil bağlantıda
sorun çıkmaz.

**5432 kapalıysa şemayı yine de gönderebilirsin.** DDL'i çevrimdışı üret, Neon'un
tarayıcı içi SQL Editor'üne yapıştır — o HTTPS üzerinden çalışır:

```bash
cd server
npx prisma migrate diff   --from-schema-datamodel <main'in schema.prisma kopyası>   --to-schema-datamodel prisma/schema.prisma --script
```

`migrate diff` veritabanına bağlanmaz, iki şema dosyasını karşılaştırır.

## 6 · Çalıştır

İki ayrı terminal:

```bash
cd server && npm run dev     # :5000
cd client && npm run dev     # :5173
```

Tarayıcıda **http://localhost:5173** — `:5000` değil.
Vite `/api` ve soketi sunucuya yönlendiriyor.

---

## 7 · Otomatik testler (veritabanı gerekmez)

Elle teste geçmeden önce bunu çalıştır — saniyeler sürer ve bir şey bozulduysa
hemen söyler:

```bash
cd server
npm test          # Windows PowerShell'de: npm.cmd test
```

Beklenen: **130 test, hepsi geçer.** Kapatılan güvenlik kusurlarının regresyon
korumaları burada.

---

## 8 · Elle test senaryoları

### Geçiş kaydı (en kritik)
- [ ] Kartı başka kolona sürükle, geri al, tekrar ilerlet.
- [ ] Her taşıma satır yazmalı:
      `select * from task_transitions order by id desc limit 10;`
- [ ] Yeni kart aç → ilk yerleşim de geçiş sayılmalı (`from_title` boş).

### Tamamlanma zamanı
- [ ] "Tamamlandı" kolonuna taşı → `completed_at` dolmalı, ilerleme %100.
- [ ] Geri çıkar → `completed_at` **null** olmalı.
- [ ] Tekrar tamamla → yeni zaman yazılmalı.

### Süre kaydı
- [ ] Kartı aç → çekmecede **"Süre ekle"**.
- [ ] Biçimleri dene: `90` · `1:30` · `1s 30d`
- [ ] Geçersiz girdi (`abc`) → anlaşılır hata, çökme yok.
- [ ] İleri tarih → reddetmeli.
- [ ] Silme düğmesi yalnızca kendi kaydında görünmeli.

### Raporlar
- [ ] Sol panelde **Raporlar** sekmesi.
- [ ] Kişi / Dönem / Akış üçü de veri göstermeli.
- [ ] Aralık: bu ay · son 3 ay · **son 6 ay** · bu yıl
- [ ] **CSV indir** → Excel'de aç: Türkçe karakterler ve sütun ayrımı doğru mu?
- [ ] **Yazdır** → önizlemede sol panel ve üst çubuk gizli, sadece rapor.

### Denetim kaydı
- [ ] **Denetim kaydı** sekmesi yalnızca çalışma alanı yöneticisine görünmeli.
      Yetkisiz bir hesapla giriş yap → sekme **hiç çıkmamalı**.
- [ ] Yetkisiz hesapla doğrudan dene:
      `/api/reports/audit?workspace=<id>` → **403** dönmeli (arayüzde gizlemek
      yetmez, asıl kontrol sunucuda).
- [ ] Bir rapor CSV'si indir → Denetim sekmesinde satır belirmeli: kim, ne
      zaman, hangi rapor, hangi aralık, kaç satır, hangi IP.
- [ ] Kaydın içinde **verinin kendisi olmamalı** — sadece bağlam.

### Oturum hijyeni (güvenlik testi)
İki tarayıcı gerekiyor — biri normal, biri gizli pencere.

- [ ] Aynı hesapla **iki tarayıcıdan** giriş yap.
- [ ] Birinci tarayıcıda Ayarlar → parolayı değiştir (en az 8 karakter).
- [ ] **İkinci tarayıcıyı yenile → oturum düşmüş olmalı**, giriş ekranı gelmeli.
- [ ] Birinci tarayıcı **açık kalmalı** — kendi oturumun korunuyor.
- [ ] Parola sıfırlama akışını dene → o durumda **bütün** oturumlar düşmeli.
- [ ] Profilden 7 karakterlik parola koymayı dene → reddedilmeli.

### CSV formül enjeksiyonu (regresyon testi)
- [ ] Bir kartın başlığını `=1+1` yap, o karta süre gir, kişi raporunu CSV
      indir ve **Excel'de aç**.
- [ ] Hücre formül olarak **çalışmamalı**, düz metin görünmeli.

### Kolon geçiş kuralı (artık arayüzü var)
- [ ] Kolon menüsü → **Geçiş kuralı** → hedef kolonları seç.
- [ ] İzin verilmeyen bir kolona sürükle → engellenmeli **ve sebebi yazan bir
      bildirim çıkmalı**, kart eski yerine dönmeli.
- [ ] "Kuralı kaldır" → serbest kalmalı.

### Aynısını SQL ile doğrulamak istersen
```sql
update board_columns set allowed_next = '["doing"]'
where project_id = <PROJE_ID> and slug = 'todo';
```
- [ ] `todo` → `doing` çalışmalı.
- [ ] `todo` → `done` engellenmeli, açıklayıcı hata dönmeli.
- [ ] `allowed_next = null` → serbest kalmalı.

### E-posta (isteğe bağlı)
- [ ] `NOTIFY_EMAIL` yokken → **hiç posta gitmemeli.**
- [ ] `NOTIFY_EMAIL=1`, SMTP yok → posta konsola yazılmalı, çökme yok.

---

## 9 · Raporları doldurmak (isteğe bağlı)

`stoa-devlog.mjs` betiği repo dışında, toplantı klasöründe duruyor — bu dalla
gelmez, ayrıca kopyalanmalı. Bu turda yapılan işleri kart olarak yazıp
kolonlar arasında ilerletiyor ve süre kaydı giriyor.

```bash
node stoa-devlog.mjs           # kuru çalıştırma, hiçbir şey yazmaz
node stoa-devlog.mjs --go      # gerçekten yaz
```

`STOA_URL`, `STOA_A_EMAIL`, `STOA_A_PASS` ortam değişkenleri gerekiyor.

---

## 10 · Geri dönmek

```bash
git checkout main
```

`main` bu turdan hiç etkilenmedi. Neon tarafında `raporlama-test` dalını silmek
yeterli; `production` etkilenmedi.

---

## Bilinen eksikler

- Süre girişinde hatırlatma/zorunluluk yok. Bilinçli: *"süreyi kim girer,
  girilmezse ne olur"* ikinci toplantıya götürülecek açık soru.
- Otomatik test yok; bu liste elle test.
- Paket 801 KB (gzip 224) — kod bölme yapılmadı.
