# Toplantı geri bildirimlerinin karşılığı

**Kaynak:** BDH Netaş StoaBoard tanıtım toplantısı, 1 Eylül 2026.
**Tur:** `raporlama` dalı — 13 commit, 34 dosya, +3.428 satır.

Bu dosya ikinci toplantı için yazıldı: her geri bildirimin karşısında **ne
yapıldı**, **ne yapılmadı** ve **neden**. Yapılmayanlar da burada — "yetişmedi"
diye değil, "kapsam dışı bıraktım, sebebi şu" diye.

---

## Özet tablo

| Toplantı notu | Durum |
|---|---|
| Raporlama 6 ayda bir | ✅ Yapıldı · dönem dondurma hariç |
| Log girişi, manuel giriş, work log developer | ✅ Yapıldı |
| Furkan hangi task'larda çalışmış, kim ne yaptı | ✅ Yapıldı |
| Development workflow oluşturma | ✅ Yapıldı · Jira'nın motoru değil, bilinçli |
| Teknik tarafta sistem açıkları | ✅ Turun en büyük parçası oldu |
| SAP kullanımı, mail | ◑ Mail yapıldı · SAP kapsam dışı |
| Jira daha kompleks | — Ürün kararı, kod değil |

---

## 1 · "Raporlama 6 ayda bir" · "Kim ne kadar süre harcadı" · "Furkan hangi task'larda çalışmış"

Üç ayrı not, tek talep: **kişi bazlı, geriye dönük, süre içeren raporlama.**
Turun çıkış noktası buydu.

**Yapılan**

- **Üç rapor.** Kişi (kim, hangi işte, ne kadar süre) · Dönem (ne açıldı, ne
  bitti, ne bekliyor) · Akış (işler kaç günde bitiyor, nerede bekliyor).
- **Aralık ön ayarları:** bu ay · son 3 ay · **son 6 ay** · bu yıl. İstenen
  altı aylık dönem doğrudan karşılanıyor.
- **CSV çıktısı** — yöneticiler veriyi kendi kesip biçiyor.
- **Yazdırma sayfası** — tarayıcı PDF'e çeviriyor.

**Bunun için önce veri altyapısı kuruldu**

Rapor geriye dönüktür; veri, rapor istenmeden önce var olmak zorundadır ve
geçmiş geri doldurulamaz. Üç şey eklendi:

- `task_transitions` — kart her taşındığında bir satır: görev, önceki/yeni
  kolon, kim, ne zaman. Kartın ilk yerleşimi de geçiş sayılıyor.
- `work_logs` — kişinin göreve harcadığı emek, manuel giriş.
- `tasks.completed_at` — **yoktu.** "Bu iş ne kadar sürede tamamlandı" sorusu
  bu alan olmadan hiçbir şekilde cevaplanamıyordu.

> **Anlatırken vurgulanacak ayrım:** geçiş süresi ile harcanan emek ayrı
> şeylerdir. Bir iş **üç haftada** bitmiş ama **altı saat** emek almış olabilir;
> ilki süreç tıkanıklığını, ikincisi maliyeti gösterir. Jira'nın da ayrı
> tuttuğu ayrım bu.

**Tasarım kararı:** bu üç tabloda **yabancı anahtar bilerek kurulmadı** ve
alanlar denormalize edildi. Çöp kutusu 30 günde kalıcı sildiği için, kayıtlar
göreve bağlı olsaydı altı aylık rapor delik çıkardı.

**Yapılmayan:** *dönem dondurma.* Kapanmış bir dönemin raporu şu an her
seferinde yeniden hesaplanıyor. Aradaki düzeltmeler yüzünden aynı dönemin
sayıları altı ay sonra değişebilir; yönetime iki kez farklı rakam gitmesi
raporlamaya olan güveni bitirir. Sıradaki turda.

---

## 2 · "Log girişi, manuel giriş, work log developer"

**Yapılan.** Görev çekmecesinde süre girişi. `90` · `1:30` · `1s 30d`
biçimlerini kabul ediyor. Kişi kendi süresini giriyor; başkasının kaydını
yalnızca görev yönetme izni olan silebiliyor. İleri tarihe ve 24 saatten uzun
tek kayda izin yok.

**Bilinçli olarak yapılmayan:** otomatik sayaç. Sekmenin ne kadar açık kaldığını
ölçer, çalışılan süreyi değil. Kurumsal raporlamada istenen veri **beyan edilmiş
emek**.

**İkinci toplantıya götürülecek açık soru:** *süreyi kim girer — geliştirici mi,
yönetici mi; girilmezse ne olur?* Şu an zorunluluk ve hatırlatma yok, çünkü bu
gerçekten tartışmalı bir konu ve masadakilerin deneyimi bizimkinden fazla.

---

## 3 · "Development workflow oluşturma" (+ gösterilen Jira ekranı)

Toplantıda `KU New Workflow` ekranı gösterildi. Asıl mesaj durum sayısı değil,
sol üstteki satırdı: **"Current status: Open · This work item can be moved to:
In Review."**

**Yapılan.** Kolon geçiş kuralı. Her kolon için "buradan hangi kolonlara
gidilebilir" tanımlanıyor; kolon menüsünden yönetiliyor. İzin verilmeyen bir
taşımada kart geri dönüyor ve kullanıcı sebebi görüyor.

Kural tanımlanmayan kolonlarda kısıt yok — **mevcut panoların davranışı
değişmiyor.**

**Bilinçli olarak yapılmayan:** Jira'nın iş akışı motorunun geri kalanı —
doğrulayıcılar, otomatik eylemler (post-function), ekran şemaları, koşullar.
Gerekçe: bunlar Jira'yı ağır yapan katman. Peşine düşmek hem yıllar alır hem
StoaBoard'un tek gerçek üstünlüğü olan sadeliği bitirir.

> Not: o 12 durumlu şema StoaBoard'da **bugün de kurulabiliyordu** — kolon
> açmak yeterliydi. Eksik olan tek şey geçiş kısıtıydı ve eklenen o.

---

## 4 · "Teknik tarafta sistem açıkları"

Turun en çok mesai alan parçası bu oldu. Aranmadan bir açık bulunduysa,
arayınca daha fazlası çıkar diye düşünüldü — çıktı.

**Kapatılan kusurlar**

| Kusur | Etkisi |
|---|---|
| **CSV formül enjeksiyonu** | Bir üye kart başlığını `=HYPERLINK(...)` yapıp **raporu açan yöneticinin makinesinde** veri sızdırabilirdi. Saldırı veriyi değil, veriyi açan kişiyi hedefliyor. |
| **İç hata mesajı sızıntısı** | Veritabanı sunucusunun adresi ve sorgu adı, **kayıt ekranından, giriş yapmadan** görülebiliyordu. |
| **Hayalet kanallar** | Kanal satırı bulunamayınca üyelik kontrolü tamamen atlanıyordu; kanal listesinde görünmeyen, üyeliği ve moderasyonu olmayan yazışma alanı açılabiliyordu. Dört yerde. |
| **Hayalet izin** | Arayüz "Üye davet et" iznini sunuyor ama sunucu kontrol etmiyordu — yönetici verdiğini sandığı yetkiyi vermiyordu. |
| **Eksik izin** | `manage_workspace` sunucuda uygulanıyor ama arayüzde listelenmediği için hiçbir role verilemiyordu. |
| **Oturumlar parolayla düşmüyordu** | Hesabı ele geçirilen kullanıcı parolasını değiştirse bile **saldırganın oturumu yaşamaya devam ediyordu.** |
| **Kullanıcı varlığı oracle'ı** | Yanıt farkı, platformdaki tüm hesaplar için "bu kullanıcı var mı" bilgisi veriyordu. |
| **Parola alt sınırı tutarsız** | Profil ekranı 6, kayıt/sıfırlama 8 istiyordu; zayıf parola profilden konularak kural dolaşılabiliyordu. |

**Kurulan yapı — asıl anlatılacak şey bu**

- **`GUVENLIK.md`** — çalışma biçimi belgesi. Tehdit modeli, yaşanmış güvenlik
  krizlerinden çıkarılıp StoaBoard'un kendi yüzeyine bağlanmış dersler ve
  **her yeni özelliğin geçmesi gereken on soruluk elek.** Güvenlik ayrı bir
  sprint değil, her özelliğin parçası.
- **Denetim kaydı** (`audit_logs`) — kim, ne zaman, hangi raporu, hangi
  aralıkla, kaç satır dışa aktardı. İçeriden sızıntıya karşı pratikte işe
  yarayan kontrol engelleme değil izlenebilirliktir.
- **54 otomatik test** — bugün kapatılan her kusur kilitlendi. Veritabanı
  gerektirmiyor, saniyeler içinde koşuyor. Aralarında, arayüzdeki izin listesi
  ile sunucunun uyguladığı listeyi birebir karşılaştıran bir test de var:
  "hayalet izin" sınıfı hata bir daha sessizce giremez.

**Denetlenip temiz bulunanlar:** çalışma alanları arası veri sızıntısı (IDOR)
yok · e-posta genel serileştiricide dönmüyor · direkt mesajlar ve özel kanallar
korunuyor · CSRF `SameSite=lax` ile kapalı · ham SQL yok · sıfırlama kodu
kriptografik rastgele · hayalet kanal kusuru geçmişte **istismar edilmemiş**
(üretim veritabanında kayıt yok).

---

## 5 · "SAP kullanımı, mail"

**Mail — yapıldı.** Atama ve bahsetme bildirimleri e-postaya bağlandı. SMTP
altyapısı zaten kuruluydu ama yalnızca şifre sıfırlamada kullanılıyordu.
Kurumsalda insanlar gün boyu Outlook'ta yaşıyor; uygulamaya girmedikleri sürece
bildirimi görmüyorlar.

Varsayılan **kapalı** (`NOTIFY_EMAIL=1` ile açılıyor). Gerçek insanlara posta
gönderen bir özellik sessizce açılmamalı.

**SAP — bilinçli olarak kapsam dışı.** Bu bir entegrasyon meselesi değil, giriş
bileti meselesi: gerçek bir kurum ve gerçek bir teknik şartname çıkmadan
yapılacak iş değil.

---

## 6 · "Uygulamalar ile farkı nedir, Jira daha kompleks"

Bu bir yapılacak iş değil, **konumlandırma teyidi** — ve lehimize. Karşı taraf
Jira'nın karmaşık olduğunu kendisi söyledi.

Kullanılacak cümle: **"Jira'nın çözdüğü problemi çözmüyoruz; onun ağır geldiği
yerde duruyoruz."**

Doğru rakip kümesi Jira değil, Trello / Asana / Notion. Kıyas Jira üzerinden
kurulursa StoaBoard hep eksik görünür; o küme üzerinden kurulursa **içinde
sohbet ve notlar olması** öne çıkar (Jira'da bunların karşılığı Slack ve
Confluence — ayrı ürünler, ayrı lisanslar).

---

## Bilinçli olarak yapılmayanlar

Bunlar "yetişmedi" değil, **seçim**:

- **Jira'nın iş akışı motoru** — doğrulayıcılar, otomatik eylemler, ekran şemaları
- **JQL / gelişmiş sorgu dili**
- **Sprint, hız (velocity), story point** — tahmin alanı bilinçli olarak yok
- **Özel alanlar (custom fields)** — alanlar şemada sabit
- **Kayıt tipleri** (Hikâye/Hata/Epik) — tek tip kart
- **SAP entegrasyonu**

Hepsinin ortak gerekçesi: Jira'yı ağır yapan katman bunlar. StoaBoard'un iddiası
sadelik; bu listeyi kovalamak iddiayı bitirir.

---

## Sıradaki tur

Öncelik sırasıyla — ayrıntıları `GUVENLIK.md` ve `TODO.md` içinde:

1. **Proje bazlı üyelik.** Bugün bir üye çalışma alanındaki **her şeyi** görüyor;
   okuma izni diye bir kavram yok. Kurumsal tarafın soracağı ilk soru bu.
2. **Dönem dondurma.** Kapanmış dönemin raporu mühürlensin.
3. **Kanal geçmişi kesimi.** Yeni üye katılmadan önceki mesajları görüyor.
4. **Denetim kaydının kapsamı.** Üye ekleme/çıkarma ve rol değişikliği de
   yazılsın — eylem adları hazır bekliyor.
5. **Uç testleri.** Saf mantık test ediliyor; yetkilendirme akışları hâlâ elle.
