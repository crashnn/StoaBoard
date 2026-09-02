# StoaBoard — Claude Code için yönlendirme

Takımlar için gerçek zamanlı proje yönetim uygulaması. Node.js + Express +
Prisma + PostgreSQL (Neon) arka uç, React 18 + Vite ön yüz, Socket.IO ile
gerçek zamanlı sohbet ve bildirimler. **Canlı:** stoaboard.com (Railway).

---

## Önce bunları oku

Hangi işe girersen gir, ilgili belgeyi açmadan başlama:

| Belge | Ne zaman |
|---|---|
| [TODO.md](TODO.md) | Her zaman. Ne kapatıldı, ne bekliyor, **gerekçeleriyle** |
| [GUVENLIK.md](GUVENLIK.md) | **Yeni bir uç, ayar veya ekran eklerken zorunlu** |
| [BILDIRIMLER.md](BILDIRIMLER.md) | Bildirimlere dokunurken |
| [TOPLANTI-KARSILIGI.md](TOPLANTI-KARSILIGI.md) | Ürün yönü / kapsam sorusu geldiğinde |
| [RAPORLAMA-TESTI.md](RAPORLAMA-TESTI.md) | `raporlama` dalını ayağa kaldırıp test ederken |

---

## Şu anki durum (1 Eylül 2026)

Aktif dal **`raporlama`** — `main`e birleştirilmedi, dağıtılmadı.

İçinde: raporlama altyapısı (görev geçiş kaydı, süre kaydı, üç rapor,
CSV/yazdırma), kolon geçiş kuralı, e-posta bildirimi, denetim kaydı, sekiz
güvenlik düzeltmesi ve 55 otomatik test.

**Bekleyen ilk adım: şema hiçbir veritabanına gönderilmedi.** Üç yeni tablo
(`task_transitions`, `work_logs`, `audit_logs`) ve üç yeni sütun var. Adım adım:
[RAPORLAMA-TESTI.md](RAPORLAMA-TESTI.md).

---

## Bilinmesi gereken tuzaklar

**Şema deploy'da kendiliğinden gitmiyor — artık.** 2 Eylül 2026'ya kadar
`postinstall`, `npm start` ve Railway build komutu `prisma db push
--accept-data-loss` çalıştırıyordu. Her deploy şemayı `DATABASE_URL`in
gösterdiği yere itiyor, üstelik şemada olmayan tabloyu sormadan düşürebiliyordu:
koda geri dönmek, veritabanında istenmeyen bir `DROP` anlamına geliyordu.
Üç çağrı da kaldırıldı. `npm install` ve `npm start` artık güvenli,
`--ignore-scripts` gerekmiyor.

**Şema değişikliğini bilerek uygularsın.** İki yol:

```bash
npm run prisma:push          # --accept-data-loss yok; yıkıcı değişikliği reddeder

# ya da DDL'i çevrimdışı üret, Neon SQL Editor'den çalıştır:
npx prisma migrate diff --from-schema-datamodel <eski>.prisma   --to-schema-datamodel prisma/schema.prisma --script
```

İkincisi kurumsal ağda tek seçenek: 5432 kapalıyken bile tarayıcı içi SQL
Editor HTTPS üzerinden çalışır. `migrate diff` veritabanına bağlanmaz.

**Windows PowerShell'de `npm` değil `npm.cmd`.** `npm` → `npm.ps1`e çözümlenip
execution policy'ye takılıyor. Git Bash'te düz `npm` çalışır.

**`server/.env` repoda yok** ve olmamalı. Üretim bağlantısı yalnızca Railway
ortam değişkenlerinde; hiçbir geliştirici makinesinde durmuyor. Yerel test için
Neon'da ayrı bir dal kullanılıyor.

**Veritabanına bağlanamıyorsan** (`P1001`, `ECONNRESET`, zaman aşımı) muhtemelen
ağ 5432'yi engelliyor — kurumsal ağlarda yaygın. "Can't reach database server" =
ağ sorunu; "kullanıcı bulunamadı" = bağlantı iyi, mesele veride. Neon'un
tarayıcı içi SQL Editor'ü HTTPS üzerinden çalıştığı için o ağlarda bile açılır.

---

## Çalışma biçimi

**Testleri çalıştır.** Değişiklikten sonra `cd server && npm test` — 55 test,
veritabanı gerektirmez, birkaç saniye sürer.

```bash
cd server && npm test        # PowerShell'de: npm.cmd test
cd client && npm run build   # ön yüz derlemesi
```

**Güvenlik eleği zorunlu.** Yeni bir uç, ayar veya ekran eklerken
[GUVENLIK.md](GUVENLIK.md) bölüm 4'teki on soru cevaplanmadan iş bitmiş sayılmaz.
Cevaplar commit mesajına yazılır.

**Kapatılan her kusur için regresyon testi.** `server/test/guvenlik.test.js`
içine, koruduğu kusuru anlatan bir yorumla birlikte.

**Sessiz başarısızlıktan kaçın.** Bu depoda üç kusurun kök sebebi buydu:
`if (!window.io) return`, `window.showToast?.()`, `if (satır && !yetki)`.
Koşulun **yokluk hâli** ya reddetmeli ya gürültü çıkarmalı — sessizce atlamamalı.

**Yorumlar Türkçe ve gerekçe anlatır.** "Ne yaptığını" değil "neden böyle
olduğunu" yazar. Commit mesajları da aynı: uzun, gerekçeli, kararın sebebini
kaydeden. Mevcut kalıba uy.

**Raporlama tabloları bilerek ilişkisiz.** `task_transitions`, `work_logs` ve
`audit_logs` yabancı anahtar kullanmaz ve denormalize alanlar taşır: görev,
proje veya kullanıcı silinse de kayıt yaşamalı. Çöp kutusu 30 günde kalıcı
sildiği için aksi hâlde altı aylık rapor delik çıkardı. **Bu tablolara ilişki
ekleme.**

---

## Kapsam dışı — bilinçli kararlar

Bunlar eksik değil, **seçim**. Önermeden önce
[TOPLANTI-KARSILIGI.md](TOPLANTI-KARSILIGI.md) oku:

Jira'nın iş akışı motoru (doğrulayıcılar, otomatik eylemler, ekran şemaları) ·
JQL · sprint ve hız (velocity) · story point · özel alanlar · kayıt tipleri
(Hikâye/Hata/Epik) · SAP entegrasyonu.

Ortak gerekçe: bunlar Jira'yı ağır yapan katman. StoaBoard'un iddiası sadelik.

---

## Sıradaki işler

Öncelik sırasıyla — ayrıntı `GUVENLIK.md` ve `TODO.md` içinde:

1. **Proje bazlı üyelik.** Bugün bir üye çalışma alanındaki her şeyi görüyor;
   okuma izni diye bir kavram yok. En büyük açık.
2. **Dönem dondurma.** Kapanmış dönemin raporu mühürlensin, yeniden
   hesaplanmasın.
3. **Kanal geçmişi kesimi.** Yeni üye katılmadan önceki mesajları görüyor.
4. **Denetim kaydının kapsamı.** Üye ekleme/çıkarma ve rol değişikliği de
   yazılsın — eylem adları `server/src/lib/audit.js` içinde hazır.
5. **Uç testleri.** Saf mantık test ediliyor, yetkilendirme akışları hâlâ elle.

Karar bekleyen tasarım soruları (kod değil, ürün kararı): süreyi kim girer ·
hangi bildirim ekranı kesmeli · sohbet kapsamı. Bunlar cevaplanmadan ilgili
işlere girme.
