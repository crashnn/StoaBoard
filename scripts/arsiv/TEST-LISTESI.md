# Raporlama turu — evde test listesi

`raporlama` dalındaki değişiklikleri yerel olarak denemek için. Sırayla git,
her adımın beklenen çıktısı yazılı.

**Neden burada değil de evde:** BDH Netaş ağı dışarıya PostgreSQL (5432)
trafiğini kapatıyor. TCP el sıkışması tamamlanıyor ama ilk veri paketine cevap
gelmiyor — araya giren şeffaf bir güvenlik duvarı var. Kodda, Neon'da veya
bağlantı adresinde sorun yok; ev ağında çalışacak.

---

## 0 · Durum (bırakıldığı hâl)

| | |
|---|---|
| Dal | `raporlama` · commit `d495d93` |
| `main` | `7df31e2` — **hiç dokunulmadı** |
| Neon dalı | `raporlama-test` (parent: `production`) |
| `server/.env` | `DATABASE_URL` dal adresine ayarlı, CORS'a `:5173` eklendi |
| Sunucu bağımlılıkları | kurulu (`--ignore-scripts` ile), Prisma istemcisi üretildi |
| Şema | **canlıya gönderilmedi** — 1. adım bu |

Railway yalnızca `main`e push'ta dağıtım yapıyor. `raporlama` dalı hiçbir yere
dağıtılmaz, canlı site etkilenmez.

---

## 1 · Bağlantıyı doğrula

```bash
cd StoaBoard/server
node -e "const p=require('pg');require('dotenv').config();const c=new p.Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('select 1')).then(()=>{console.log('BAGLANDI');return c.end()}).catch(e=>console.log('HATA:',e.message))"
```

**Beklenen:** `BAGLANDI`
`ECONNRESET` veya zaman aşımı alırsan hâlâ 5432'yi engelleyen bir ağdasın.

## 2 · Şemayı Neon dalına gönder

```bash
cd StoaBoard/server
./node_modules/.bin/prisma db push --skip-generate
```

**Beklenen:** iki yeni tablo (`task_transitions`, `work_logs`) ve üç yeni sütun
(`tasks.completed_at`, `board_columns.allowed_next`, `users.email_notifications`).

> `--accept-data-loss` **kullanma.** Değişikliklerin hepsi katkı niteliğinde;
> komut veri kaybı isterse durması gerekir. Dururса bana söyle, bakalım.

## 3 · Sunucuyu kaldır

```bash
cd StoaBoard/server
npm run dev
```

**Beklenen:** `:5000` dinleniyor.

> ⚠️ `npm start` **kullanma** — `start` betiği kendi başına `prisma db push`
> çalıştırıyor. `dev` çalıştırmıyor.

## 4 · İstemciyi kaldır (ikinci terminal)

```bash
cd StoaBoard/client
npm run dev
```

Tarayıcıda **http://localhost:5173** — `:5000` değil. Vite `/api` ve soketi
sunucuya yönlendiriyor.

---

## 5 · Test senaryoları

### 5.1 Geçiş kaydı (en kritik)
- [ ] Bir kartı başka kolona sürükle.
- [ ] Aynı kartı geri al, sonra tekrar ilerlet.
- [ ] **Doğrula:** her taşıma `task_transitions`a satır yazmalı.
      Kontrol: `select * from task_transitions order by id desc limit 10;`
- [ ] Yeni bir kart aç → ilk yerleşimi de geçiş sayılmalı (`from_title` boş).

### 5.2 Tamamlanma zamanı
- [ ] Kartı "Tamamlandı" kolonuna taşı → `tasks.completed_at` dolmalı, ilerleme %100.
- [ ] Aynı kartı geri çıkar → `completed_at` **null olmalı**.
- [ ] Tekrar tamamla → yeni zaman yazılmalı.

### 5.3 Süre kaydı
- [ ] Kartı aç, çekmecede **"Süre ekle"**.
- [ ] Şu biçimleri tek tek dene: `90` · `1:30` · `1s 30d`
- [ ] Saçma bir şey yaz (`abc`) → anlaşılır hata vermeli, çökmemeli.
- [ ] İleri tarih seç → reddetmeli.
- [ ] Kendi kaydının yanında **silme** düğmesi çıkmalı; başkasınınkinde çıkmamalı.

### 5.4 Raporlar
- [ ] Sol panelde **Raporlar** sekmesi görünüyor mu?
- [ ] **Kişi raporu** — süre girdiğin kişi ve görev listede mi?
- [ ] **Dönem raporu** — açılan/tamamlanan sayıları ve kolon hareketleri doğru mu?
- [ ] **Akış raporu** — tamamlanma süresi ve kolon bekleme tablosu doluyor mu?
- [ ] Aralık düğmeleri: bu ay · son 3 ay · **son 6 ay** · bu yıl
- [ ] **CSV indir** → Excel'de aç. **Türkçe karakterler doğru mu, sütunlar ayrık mı?**
      (Noktalı virgül + BOM ile üretiliyor; bozuk çıkarsa bana söyle.)
- [ ] **Yazdır** → önizlemede sol panel ve üst çubuk gizli, sadece rapor görünmeli.

### 5.5 Kolon geçiş kuralı
Arayüzü henüz yok, veritabanından tanımlanıyor:

```sql
-- "Yapılacak" kolonundan yalnızca "Devam Ediyor"a geçilebilsin
update board_columns set allowed_next = '["doing"]'
where project_id = <PROJE_ID> and slug = 'todo';
```

- [ ] Kartı `todo`dan `doing`e taşı → **çalışmalı**.
- [ ] Kartı `todo`dan `done`a taşı → **engellenmeli**, açıklayıcı hata dönmeli.
- [ ] Kuralı geri kaldır (`allowed_next = null`) → serbest kalmalı.

### 5.6 E-posta bildirimi (isteğe bağlı)
Varsayılan kapalı. Denemek istersen `server/.env`e ekle:

```env
NOTIFY_EMAIL=1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

- [ ] SMTP vermeden `NOTIFY_EMAIL=1` yap → posta **konsola** yazılmalı, çökmemeli.
- [ ] Birine görev ata → bildirim postası gitmeli.
- [ ] `NOTIFY_EMAIL` olmadan → **hiç posta gitmemeli.**

---

## 6 · Devlog panosu (raporları doldurmak için)

Şema gönderildikten sonra:

```bash
cd Stoaboard-Toplantı
set STOA_URL=http://localhost:5000
set STOA_A_EMAIL=...
set STOA_A_PASS=...

node stoa-devlog.mjs           # önce kuru çalıştır — hiçbir şey yazmaz
node stoa-devlog.mjs --go      # gerçekten yaz
```

"StoaBoard Geliştirme" projesi açılır, bu turda yapılan işler kart olarak
yazılır, kolonlar arasında ilerletilir ve süre kaydı girilir. Kartlar uydurma
değil — yapılan işin kendisi.

---

## 7 · Geri dönmek

```bash
git checkout main          # eski hâl, hiçbir değişiklik yok
git checkout raporlama     # geri gel
```

Neon tarafında `raporlama-test` dalını silmek yeterli; `production` etkilenmedi.

---

## Bilinen eksikler

- Kolon geçiş kuralının **arayüzü yok** — şimdilik SQL ile.
- Süre girişinde **hatırlatma/zorunluluk yok.** Bilinçli: "süreyi kim girer,
  girilmezse ne olur" ikinci toplantıya götürülecek açık soru.
- Otomatik test hâlâ yok; bu liste elle test.
- Paket 801 KB (gzip 224) — kod bölme hâlâ yapılmadı.
