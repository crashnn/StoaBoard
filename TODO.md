# StoaBoard — To-Do

Canlı: [stoaboard.com](https://www.stoaboard.com) · Railway + Neon PostgreSQL,
`main`e push ile otomatik dağıtım.

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
- [ ] **Sohbet kapsamı.** Şu an kanallar çalışma alanı geneli. Seçenekler:
      (A) böyle kalsın, (B) her projeye özel sohbet, (C) kanallar genel kalsın
      ama istenirse bir projeye bağlanabilsin. **Öneri: C** — B küçük takımlarda
      ıssız kanallar üretiyor, A ise proje–konuşma bağını hiç kurmuyor.
