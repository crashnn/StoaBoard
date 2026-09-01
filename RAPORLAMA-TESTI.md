# `raporlama` dalı — kurulum ve test talimatı

Bu dosya, dalı **başka bir bilgisayarda** ayağa kaldırıp test etmek için yazıldı.
Sıfırdan bir makinede sırayla uygulanabilir.

> **Claude Code'a not:** Bu dal `main`e birleştirilmedi ve dağıtılmadı. Amaç
> yerel test. Aşağıdaki adımları uygularken **`npm start` çalıştırma** — o betik
> kendi başına `prisma db push` tetikliyor. `npm run dev` kullan.

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
- **Kolon geçiş kuralı** — `board_columns.allowed_next`. Sunucu tarafı hazır,
  arayüzü henüz yok.

Ayrıntılı gerekçeler `TODO.md` içindeki "Raporlama turu" bölümünde.

---

## 1 · Dalı al

```bash
git clone https://github.com/crashnn/StoaBoard.git
cd StoaBoard
git checkout raporlama
```

Repo zaten varsa:

```bash
git fetch origin
git checkout raporlama
git pull
```

Doğrula: `git log --oneline -1` → **`1 Eylül - Eray Atalay 3.3 feat - raporlama...`**

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
npm install --ignore-scripts
npx prisma generate

cd ../client
npm install
```

`--ignore-scripts` önemli: düz `npm install`, postinstall üzerinden
`prisma db push --accept-data-loss` çalıştırıp şemayı doğrudan
`DATABASE_URL`e gönderiyor. Şemayı bir sonraki adımda kontrollü göndereceğiz.

> **Windows / PowerShell:** `npm` komutu `npm.ps1`e çözümlenip
> *"running scripts is disabled on this system"* hatası verebilir.
> Çözüm: **`npm` yerine `npm.cmd` yaz** (`npm.cmd install`, `npm.cmd run dev`).
> Git Bash kullanıyorsan düz `npm` çalışır.

## 5 · Şemayı gönder

```bash
cd server
npx prisma db push --skip-generate
```

Beklenen: iki yeni tablo (`task_transitions`, `work_logs`), üç yeni sütun
(`tasks.completed_at`, `board_columns.allowed_next`, `users.email_notifications`).

> **`--accept-data-loss` ekleme.** Değişikliklerin hepsi katkı niteliğinde;
> komut veri kaybı isterse durması gerekir.

Bağlanamazsa (`P1001`, `ECONNRESET`, zaman aşımı): bulunduğun ağ 5432'yi
engelliyor olabilir. Kurumsal ağlarda yaygın; ev ağında veya mobil bağlantıda
sorun çıkmaz.

## 6 · Çalıştır

İki ayrı terminal:

```bash
cd server && npm run dev     # :5000
cd client && npm run dev     # :5173
```

Tarayıcıda **http://localhost:5173** — `:5000` değil.
Vite `/api` ve soketi sunucuya yönlendiriyor.

---

## 7 · Test senaryoları

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

### Kolon geçiş kuralı (arayüzü yok, SQL ile)
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

## 8 · Raporları doldurmak (isteğe bağlı)

`stoa-devlog.mjs` betiği repo dışında, toplantı klasöründe duruyor — bu dalla
gelmez, ayrıca kopyalanmalı. Bu turda yapılan işleri kart olarak yazıp
kolonlar arasında ilerletiyor ve süre kaydı giriyor.

```bash
node stoa-devlog.mjs           # kuru çalıştırma, hiçbir şey yazmaz
node stoa-devlog.mjs --go      # gerçekten yaz
```

`STOA_URL`, `STOA_A_EMAIL`, `STOA_A_PASS` ortam değişkenleri gerekiyor.

---

## 9 · Geri dönmek

```bash
git checkout main
```

`main` bu turdan hiç etkilenmedi. Neon tarafında `raporlama-test` dalını silmek
yeterli; `production` etkilenmedi.

---

## Bilinen eksikler

- Kolon geçiş kuralının **arayüzü yok** — şimdilik SQL ile.
- Süre girişinde hatırlatma/zorunluluk yok. Bilinçli: *"süreyi kim girer,
  girilmezse ne olur"* ikinci toplantıya götürülecek açık soru.
- Otomatik test yok; bu liste elle test.
- Paket 801 KB (gzip 224) — kod bölme yapılmadı.
