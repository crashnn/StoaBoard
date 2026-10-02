# Canlı duman testi

Tarayıcıda koşan küçük bir ölçüt kümesi. **`npm test`in yerine geçmez** —
onun göremediğini görür.

```bash
cd server && npm run duman                      # canlıya karşı
STOA_URL=http://localhost:5000 npm run duman    # yerel sunucuya karşı
```

Çıkış kodu: `0` geçti · `1` kaldı · `2` **atlandı ya da geçersiz**.
Üçüncüsü `mcp:tara` ile aynı sözleşme: atlanan kontrol geçmiş sayılmaz.

---

## Önce tarayıcı

Koşum kendi tarayıcısını **açmaz**: ölçütler giriş yapılmış bir oturum
gerektiriyor. Zaten açık olan bir Chromium'a CDP ile bağlanıyor.

```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir="<profil yolu>" https://www.stoaboard.com/pano
```

Başka bir port kullanıyorsan `CDP_URL=http://localhost:9223`.

Playwright **bağımlılık olarak eklenmedi**: depoya girmesi `npm install`a
tarayıcı indirmesi ekler ve pre-push kancasının ortamını ağırlaştırır. Çalışma
anında çözülüyor; bulunamazsa koşum **atlandı (2)** diyerek çıkıyor, sessizce
geçmiyor.

```bash
npx playwright@latest install chromium
PLAYWRIGHT_YOLU=<playwright paketinin yolu> npm run duman   # özel kurulum
```

---

## Niçin var

1–2 Ekim 2026'daki doğrulama turunda bulunan **iki kusuru hiçbir birim testi
göremezdi**:

- **#330** — kapalı "Yeni görev" penceresi açılışta odağı çalıyordu; dokuz
  klavye kısayolu ve sohbet jesti bu yüzden ölüydü.
- **#267** — jest doğduğu günden beri çalışmıyordu.

İkisi de yalnızca gerçek tarayıcıda, gerçek olay akışında görünüyor. O gün
**1067 test ve temiz derleme ikisini de geçirmişti.** 15 Eylül'de lint için
öğrenilen dersin aynısı: eksik olan kural değil, kuralı gören katmandı.

---

## Dört kural — hepsinin bedeli ödendi

1. **Veri yazmaz.** Kart, proje, kanal açmaz. Bir duman testinin yan etkisi
   olmamalı. Dil ölçütü yalnızca `localStorage`a dokunuyor ve koşu sonunda
   eski değeri geri yazıyor.
2. **Sayfa yüklemesini kısar.** `/api/auth/me` her yüklemede çağrılıyor ve
   limitli (kart #328). Koşum üç yükleme yapıyor ve sayıyı çıktıya basıyor —
   artarsa görünür olsun.
3. **Tarayıcıyı açmaz ve kapatmaz.** `browser.close()` CDP kipinde
   **kullanıcının tarayıcısını gerçekten kapatıyor**; bir kez öyle kapandı.
4. **Geçersizliği geçmiş saymaz.** Olumsuz ölçüt ("Türkçe ad görünmüyor")
   yüzey hiç çizilmediyse de sağlanır. Her ölçüt önce "ölçtüğüm şey gerçekten
   ekranda mı" kapısından geçiyor.

---

## Bugünkü ölçütler

| Ölçüt | Koruduğu |
|---|---|
| Taze açılışta odak bir yazı alanında değil | #330 |
| Kapalı pencerenin alanı programlı odağı da alamıyor | #330 (`inert`) |
| Panoda `g,d` dashboard görünümüne geçiriyor | #330, kısayolun vaadi |
| Kısayol tuşları gizli kutuya yazılmadı | #330 |
| Pano kolon adları arayüz dilini izliyor | #288 |

Üçüncü ve dördüncü **olumlu** ölçüt, bilerek: ilk ikisi "odak çalınmıyor"
diyor, onlar "kısayol gerçekten çalışıyor" diyor. Olumsuz ölçüt, mekanizma
ölüyken bedava geçer — #267'de tam bu oldu.

---

## Bilerek dışarıda

- **Giriş ekranı dili (#255) ve oturumsuz hukuki sayfa (#254).** Oturumu
  OLMAYAN bir tarayıcı gerekiyor; bu koşum giriş yapılmış olana bağlanıyor.
  Eklenecekse ayrı bir profil ve ayrı bir port gerekir.
- **Etkinlik akışında kolon adının dili (#331).** Kart taşımak gerekiyor,
  yani veri yazmak — kural 1.
- **Kurulum isteyen ölçütler** (#245, #263, #265, #268 ailesi). Canlıya kart,
  proje ve kanal yazıp sonra temizlik istiyorlar.

Bunların tamamı deponun **yanındaki** daha büyük koşumda duruyor:
`Desktop/Temizlik/stoa-canli-test` (kendi `OKU.md`si içinde kurulum, tuzaklar
ve ölçüt yazarken düşülen beş hata). Oradakiler ürün kodu değil, bir tur
kaydı; buraya yalnızca yan etkisi olmayanlar alındı.

---

## Kancaya ve CI'a bağlamak

**Henüz bağlı değil, bilerek.** Bugün koruyan şey `pre-push` kancası ve o
zaten testleri + derlemeyi koşuyor; üstüne tarayıcı açan bir adım her push'u
yavaşlatır, üstelik tarayıcının açık olmasını gerektirir.

Sıra: **#203** (GitHub faturalandırma kilidi) açılsın → CI gerçek kapıya
dönsün (**#212**) → duman testi oraya bağlansın. O zaman tarayıcıyı CI
sağlayacağı için CDP kuralı da düşer.
