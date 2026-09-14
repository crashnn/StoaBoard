# İkinci toplantı — konuşma planı, demo senaryosu, davet

**Hedef tarih:** staj bitiş haftası, 15-19 Eylül 2026.
**Amaç sırası:** ne yapıldı → nasıl çalışıldı → karar soruları → devir.

Bu dosya sunum sayfasının ikizi değil. Sayfa **karşı tarafın gördüğü** şey;
bu dosya **elde tutulan** şey: hangi dakikada ne söyleneceği, demo nasıl
kurulacağı ve oda darsa neyin kesileceği.

---

## 1 · Dakika dakika akış (50 dk)

| Dk | Sayfada | Ekranda ne var | Anahtar cümle |
|---|---|---|---|
| 0-3 | **Çerçeve** | Başlık + sayı bandı | "Üç şey anlatacağım: ne eklendi, nasıl çalıştım, ve sizden ne istiyorum. Üçüncüsü en kısası ama en önemlisi." |
| 3-6 | **Faz şeridi** | Üçlü şerit | "Toplantı, sonra üç gün, sonra bir ara, sonra MCP. Sıra bu — önce sizin dedikleriniz." |
| 6-12 | **Öncesi/sonrası tablosu** | Ana tablo | "Sol sütun 1 Eylül'de elimizde olan, sağ sütun bugün. On iki satır." |
| 12-16 | **Toplantı notu → karşılığı** | İkinci tablo | "Şimdi tek tek sizin notlarınız. Yarım kalan ikisini de söyleyeceğim." |
| 16-19 | **MCP** | Sürüm merdiveni + araç ızgarası | "Beş günde on sürüm. Yirmi araç: onu okuyor, onu yazıyor." |
| 19-29 | **CANLI DEMO** | Bölünmüş ekran: StoaBoard + Claude | Aşağıdaki senaryo |
| 29-33 | **Güvenlik + testler** | Kusur tablosu | "İki turda on üç kusur, hiçbiri kullanıcıdan gelmedi. 1 Eylül'de hiç testimiz yoktu, bugün 485 var." |
| 33-41 | **Yöntem (Bölüm 2)** | Kural merdiveni + mutasyon kutusu | "Asıl anlatmak istediğim kısım bu." |
| 41-52 | **Kararlar (Bölüm 3)** | Karar kartları | "Altı soru var, cevapları sizde. Ben kod tarafını hazırlayabilirim, kararı veremem." |
| 52-58 | **Devir (Bölüm 4)** | Devir tablosu | "Ben gidince ne kırılır sorusunun dürüst cevabı." |

*Sayfadaki bölüm başlıklarında yazan süreler demoyu içermiyor; demo Bölüm 1'in
içinden 10 dakika alıyor.*

**Akışın omurgası şu cümle:** *toplantı → üç günde karşılığı → ara → MCP.*
Sayfadaki faz şeridi bunu gösteriyor; anlatırken de aynı sırayı koru. MCP'yi
öne alırsan "geri bildirimleri dinlemedi, kendi istediğini yaptı" gibi okunur —
oysa sıra tam tersi.

### Oda darsa — 25 dakikalık kesim

Kesilecekler, bu sırayla:

1. **Yöntem bölümü 10 dk → 3 dk.** Kural merdiveni atlanır, yalnızca mutasyon
   hikâyesi anlatılır: *"on bir mutasyonun üçü testin kendisinin yanlış
   olduğunu gösterdi."* Tek cümlelik hâli bile etkisini koruyor.
2. **Demo 10 dk → 5 dk.** Yalnızca okuma + tek yazma. Denetim kaydı gösterimi
   atlanır.
3. **Güvenlik tablosu okunmaz, gösterilir.** "Beş satır, hepsi kapandı."

**Kesilmeyecek iki şey:**

- **Birinci tur tablosu.** Odadakilerin kendi söyledikleri o tabloda. Kısaltmak
  gerekirse satır satır okunmaz, "yedi notun beşi kapandı, ikisi yarım — yarım
  olanların sebebini söyleyeyim" denir. Ama atlanmaz.
- **Karar soruları.** Toplantının sebebi o. Süre daralırsa kararlara ayrılan
  12 dakika korunur, gerisi kısalır.

---

## 2 · Canlı demo senaryosu

### Önce hazırlık — toplantıdan en az bir gün önce

- [ ] **Panoyu temizle.** Bugün canlıda çalışma alanları `asdasd`, `ghghhg`,
      `sadsada` adını taşıyor ve pano Mayıs'tan beri güncel değil. Demo için
      gerçekçi adlar ve 8-10 gerçekçi kart gerekiyor. *Bu, toplantının en
      büyük tek riski: teknik hiçbir şey kırılmasa bile ekrandaki `asdasd`,
      "bunu kimse kullanmıyor" mesajını sunumdan daha yüksek sesle verir.*
- [ ] **Yeni sohbet aç.** MCP istemcisi araç listesini bağlantı başında bir
      kez çekiyor; sunucu "liste değişti" diyemiyor. Eski sohbet 0.6.0'ın
      araçlarını görmez. 11 Eylül'de yaşandı.
- [ ] **`whoami` ile doğrula.** Yanıttaki `server.version` **0.6.0** demeli.
      Demiyorsa istemci eski sohbete bağlı.
- [ ] **Bildirimi aç, sesi kıs.** Canlı güncellemeyi göstereceksin ama
      toplantı odasında bildirim sesi istemezsin.
- [ ] **Yedek kaydı al.** Aşağıdaki akışın ekran kaydını önceden çek. Ağ
      çökerse kayıt oynatılır; demo yapılamadı diye bölüm atlanmaz.

### Akış — ekranı ikiye böl, solda StoaBoard panosu, sağda Claude

**1. Okuma — "sistem neyi görüyor"** *(2 dk)*

> Claude'a: **"StoaBoard'da hangi işler gecikmiş, kim üzerinde?"**

Beklenen: `list_tasks` / `search_tasks` çalışır, geciken kartlar kişi adıyla
listelenir. Söylenecek: *"Bu veri panodan geliyor, Claude'un hafızasından
değil. Yanlış alandaki kaydı da döndüremez — 0.3.1'de tam bunu kapattık."*

**2. Yazma — "ve değiştirebiliyor"** *(3 dk)*

> Claude'a: **"Şu kartı [Ad] Bey'e ata, bitiş tarihini cumaya çek ve altına
> 'toplantıda konuşuldu' diye not düş."**

*Odadaki birinin adını kullanacaksan hitabı koru — "Furkan Bey'e ata", "Furkan'a
ata" değil. Demoda geçen isim gerçek bir kişiyse cümle ekranda kalıcı bir kayıt
bırakıyor; hitap oradaki en ucuz nezaket.*

Beklenen: `update_task` + `add_comment`. **Sol taraftaki panoya bak** — kart
canlı güncelleniyor, sayfa yenilenmiyor (Socket.IO). Söylenecek: *"Üç ayrı
araç çağrısı, tek cümle."*

**3. Kapı — "ama her şeyi yapamıyor"** *(2 dk)*

> Claude'a: **"Bu kartı [alanın üyesi olmayan biri]'ne ata."**

Beklenen: **reddedilir.** Söylenecek: *"Bu kapı geçen hafta yoktu. MCP ayrı
bir arka kapı olsaydı bunu fark etmezdik — aynı izin kapısından geçtiği için
uygulamanın kuralı MCP'ye de uygulanıyor."*

**4. İz — "ve yaptığı şey kayıtlı"** *(2 dk)*

Panoda kartın yorumunu ve denetim kaydını göster. Söylenecek: *"Kurumsalda
sorulacak soru 'yapay zekâ ne yaptı' değil, 'kim yaptı ve geri alabilir
miyim' olur. Cevap: kayıtlı."*

**5. Testler — "nasıl emin oluyoruz"** *(1 dk)*

Terminalde `cd server && npm test`. 485 test, ~22 saniye, veritabanı yok.
Söylenecek: *"Bu ofis ağında da koşuyor, veritabanına erişim gerektirmiyor."*

### Demo kırılırsa

- **Claude araçları görmüyor** → yeni sohbet. En sık sebep bu.
- **401 / yetki hatası** → Railway'deki anahtar ortam değişkeni. Canlıda
  düzeltilemez; yedek kayda geç.
- **Kart güncellenmiyor ama hata da yok** → sayfayı yenile (F5). 13 Eylül'de
  tarayıcı eski sekmede eski kodu tutuyordu.
- **Hiçbiri olmazsa** → yedek kaydı oynat ve şunu söyle: *"Canlı demo
  yapmamayı tercih ederdim ama kaydı aldım, çünkü bu sistemin kendi kuralı:
  sessiz başarısızlık yasak."* Dürüstlük burada demo kadar iş görür.

---

## 3 · Anlatırken dikkat

**Sayıyı gerekçesiyle söyle.** "485 test" tek başına bir övünme; "485 test ve
üçü geçen hafta testin kendisinin yanlış olduğunu buldu" bir yöntem anlatır.
Odadaki profesyoneller birinciyi her gün duyuyor.

**Yapılmayanları savunma, gerekçesini söyle.** SAP, sprint, story point, sesli
arama — hepsi bilinçli kapsam dışı. "Yetişmedi" denirse eksik görünür;
"Jira'yı ağır yapan katman bu, iddiamız sadelik" denirse konumlandırma olur.

**Jira kıyasına girme.** 1 Eylül'de karşı taraf Jira'nın karmaşık olduğunu
kendisi söyledi. Kullanılacak cümle: *"Jira'nın çözdüğü problemi çözmüyoruz;
onun ağır geldiği yerde duruyoruz."* Doğru rakip kümesi Trello / Asana /
Notion — o küme üzerinden konuşulursa içinde sohbet ve notlar olması öne çıkar.

**En zor cümleyi sen kur.** Kimse sormadan söyle: *"Pano Mayıs'tan beri
güncellenmemiş. Ürün iyi kurulmuş ama kimse kullanmıyor ve bunu kapatacak şey
yeni özellik değil."* Bu sen söylersen dürüstlük olur, onlar bulursa sunumun
altı boşalır.

**Devir bölümünde "yüksek risk" yazan iki satırı okumaktan çekinme.** Railway
erişimi ve MCP anahtarı. Bir şeyin sahipsiz kalacağını söylemek, sahipsiz
bırakmaktan iyidir.

---

## 4 · Toplantı isteği e-postası

**Konu:** StoaBoard — kapanış sunumu ve devir
*(alternatif, daha merak uyandıran: "StoaBoard'da iki haftada ne değişti —
30-45 dk ayırabilir misiniz?")*

---

Merhaba,

1 Eylül'deki StoaBoard tanıtımında aldığım geri bildirimlerin karşılığını
çıkardım ve bu hafta stajımın son haftası. Ayrılmadan önce 45 dakikalık bir
kapanış toplantısı yapabilir miyiz diye soracaktım.

Üç başlık düşünüyorum:

- **Ne değişti.** Toplantıdan bu yana 113 commit, iki turda. Önce sizin
  ilettiğiniz maddeleri kapattım: raporlama ve süre kaydı, iş akışı geçiş
  kuralı, e-posta bildirimi ve bir güvenlik turu. Sonra ayrı bir adım olarak
  panonun bir yapay zekâ istemcisi tarafından sürülebilmesini ekledim — kısa
  bir canlı demo göstermek isterim. Bu süreçte on üç güvenlik kusuru kapandı
  ve depoda hiç yokken 485 otomatik test oluştu.
- **Size sormam gereken altı karar.** Bunlar kod değil ürün kararları: proje
  bazlı erişim ayrımı, süre girişini kimin yapacağı, dönem kapanışının nasıl
  mühürleneceği gibi. Cevapları sizin deneyiminizde, bende değil.
- **Devir.** Ben ayrıldıktan sonra neyin sahipsiz kalacağını açıkça yazdım;
  özellikle üretim ortamı erişimi konuşulmalı.

Hazırladığım özet sayfayı önceden gönderiyorum, toplantıda üzerinden
geçebiliriz:

**[SUNUM LİNKİ]**

Hangi gün uygunsanız ona göre ayarlarım.

İyi çalışmalar,
Eray Atalay

---

*Sunum sayfası varsayılan olarak özeldir; göndermeden önce paylaşım
menüsünden erişime açılması gerekiyor.*
