# Devir notu — makineler arası

Bu proje iki makinede sürdürülüyor ve oturumlar birbirini görmüyor. Bu dosya,
projeyi yeni devralan oturuma "şu an gerçekte ne doğru" demek için var.
Belgelerde birbiriyle çelişen ifadeler bulursan **bu dosyaya ve `git log`a**
güven, düzyazıya değil.

**Son güncelleme:** 18 Eylül 2026 mesai sonu, **ofis makinesinde** (5432
kapalı). En taze bölüm **0-AG** (öğleden sonra eki dahil).

> **Bugün iki oturum aynı depoda paralel çalıştı** (ev + ofis) ve çakışmadı.
> Nasıl yürüdüğü 0-AD'de; kanal panodaki **kart #196**.

> **Ofis makinesinde *yerel* çalışılacaksa 5432 kapalıdır:** `npm run mcp:tara`
> ve `npm run prisma:push` orada koşmaz. Ev makinesine uzaktan bağlanılırsa
> komutlar ev makinesinde çalışır ve o kısıt geçerli olmaz — ofis ağı yalnızca
> ekranı taşır.

---

## 0-AG. 18 Eylül öğlen — ofis turu: kart geçişi, kanal geçmişi kesimi, tek bildirim üreticisi

**Ofis makinesi, 5432 kapalı.** Ev oturumu 0-AF'yi 08:49'da yazdıktan sonra
altı commit daha attı ve `56b5285`i push ettikten SONRA kotaya takıldı
(13:20'de yeniliyor). Mahsur iş yoktu; **0-AF'nin "kaldığı yer" listesi o altı
commit'i görmüyor**, güncel hâli aşağıda. Testler **768 → 796**, üç commit.

### 0-AF'den sonra, ev oturumu (08:49–10:19)

| Commit | İş |
|---|---|
| `b580127` | #240'ın kalan yolu: mobil tam sayfa sohbette DM listesine ulaşılamıyordu (sol sütun gizli, geri düğmesi çıkarıyordu). Mobilde iki panel: liste ↔ konuşma. Ölü CSS kuralı silindi |
| `479a8e4` | #195 çizelge yatay telefonda kapalıydı: ölçüt genişlik değil "dar VE dikey" |
| `c6704f7` | #195 tarihsiz blok çizelgeyi sıfıra sıkıştırıyordu (69 kart); en fazla 30dvh + kısa ekranda görünüm dikey kayıyor. Dürüst not: yatay telefonda "kullanılabilir", rahat değil |
| `8d23490` | #202 dashboard denetimi: uydurma veri YOK ama tamamlanma tanımı raporlardan ayrışıyordu (hareket günlüğü vs `completed_at`); tek tanım `client/src/sayim.js` |
| `56b5285` | **#228 görünüm başına adres.** Türkçe yollar, `/pano/kart/193`; geri tuşu kartı kapatır, siteden atmaz. `client/src/rota.js` saf, 15 test, 9/9 mutasyon |

### Bu turda kapananlar (ofis)

**`9670bf5` — #246 çekmecede kartlar arası geçiş.** Kullanıcı Backlog
kartlarına yorum yazarken istedi: "ileri geri, çekmecedeki kart değişecek,
tüm kolonların kendi içinde". Başlıkta `‹ 3/28 ›`, klavyede düz ← / →
(kullanıcı "seçili değilse bir yer" dedi; bir alan düzenlenirken ok tuşu
imleci taşır, karta dokunmaz). Kural saf: `client/src/komsu.js` — aynı kolon,
aynı proje, `tasks` dizisinin sırası (Kanban da aynı diziyi aynı sırayla
çiziyor). Kolon sonunda durur. **Yorum taslağı karta bağlı** — A'da yazıp
B'ye geçince taslak A'da bekler. **Adres geçişte değiştiriliyor** (#228 ile
uyum): on kart gezip X'e basınca geri tuşu panoya döner, bir önceki karta
değil. 11 test, 12/12 mutasyon. **Kullanıcı canlıda denedi: "Geçiş yapıyor."**

**`9bf8b58` — #119 kanal geçmişi kesimi.** Kart 15 Eylül'den beri karar
bekliyordu; kullanıcı yorumla verdi: **katılım anından itibaren** (e-posta
örneği). **Şema değişmedi** — `channel_members.joined_at` zaten var ve her
kanal üyeliği açık satırla kuruluyor. Tek boşluk: üye katılmadan ÖNCE açılmış
herkese açık kanal (onay yalnızca "genel"e ekliyordu). İki katman: yedek
ölçüt onaylanmış katılım isteğinin zamanı; onay artık BÜTÜN herkese açık
kanallara satır yazıyor. Kaynak yoksa (kurucu) kesim yok — kararın kendisi.
DM'de kesim yok. **Beş okuma yolunun beşi** kesime bağlı: mesaj listesi,
sabitlenmişler (tek + tümü), medya (tek + tümü), kanal listesindeki son mesaj
önizlemesi. İstemcide sessiz not: "Geçmiş, kanala katıldığın tarihten
itibaren görünüyor: 12 Eylül 2026".

**Yol üstünde güvenlik kusuru:** `GET /chat/pinned?scope=all` ve kanalsız
`GET /chat/media` kanal üyeliğine HİÇ bakmıyordu — özel kanalın sabitlenmiş
mesajları ve dosyaları alandaki herkese listeleniyordu. Tek kanal yollarında
kapı vardı, çok kanallı yollarda yoktu. Aynı commit'te kapandı;
`okunabilirKanalKosullari(user)` yalnızca erişilebilir kanallardan kuruyor.
13 test, 13/13 mutasyon.

Push'tan önce ölçülen risk: `joined_at` değerleri Flask döneminden mi?
Evet — aynı Neon veritabanı, şema introspect edilmiş (sütun adları birebir,
`@db.Timestamp(6)`), yani katılım anları gerçek, taşınma tarihi değil.

**`a042bb5` — #200 soket yolu bildirimi createAndPush'tan.** `sockets/chat.js`
DM ve bahsetme bildirimini doğrudan `prisma.notification.create` ile yazıp
elle emit ediyordu; e-posta yalnızca `createAndPush`ta. REST'ten gelen
bahsetme posta üretiyordu, soketten gelen üretmiyordu. **#193'ün `read:
false` düzeltmesi de soket yolunu kapsamıyordu** — soket bildirimleri NULL
doğmaya devam ediyordu. İki yolun alan kümesi de eşitlendi. Tuzak:
`chat_channel` sütunu `VarChar(20)`, slug 80'e kadar — gerçek slug yazmak
uzun adlı kanalda mesaj göndermeyi kırardı; alan istemcide okunmuyor, tür
işareti olarak kaldı. 4 test, 5/5 mutasyon.

### Ortam tuzağı: Python mutasyon betiği cp1252'de sessizce ölüyor

Mutasyon betikleri Python'da yazılıyor ve Windows konsolu cp1252. İlk
"YAKALANDI ... kalktı" satırındaki **ı** harfi `UnicodeEncodeError` verdi;
betik iki kez öldü, çıktı tamponda kaldığı için "bitti mi?" sorusuna cevap
yoktu. Dosyalar `finally` ile geri geldi (zarar yok). Çözüm:
`PYTHONIOENCODING=utf-8 python -u betik.py`. Bir de bu makinede tek test
dosyası koşusu ~27 sn (node açılışı yavaş): 12 mutasyon ≈ 6 dk, arka planda
koş, `until grep SONUC` ile bekle.

Kaçış tuzağı bu turda **iki kez daha** ısırdı (Python yazma katmanı ters
bölü-tırnak ve ters bölü-w kaçışlarını yuttu, test dosyası sözdizimi hatasıyla
açılmadı — bu cümlenin kendisi de ilk yazımda aynı tuzağa düştü). Düzeltme Edit
aracıyla doğrudan yapıldı. CLAUDE.md'nin "kaynak tarayan test yazarken
kaçıştan kaçın" notu geçerli: karşılaştırmayı düz metinle yap.

### Öğleden sonra eki (13:00–16:20) — iki oturum, kanal üstünden

Testler **796 → 848**. Ev oturumu 13:20'de döndü; kullanıcı **"AI İletişim
Kanalı - Köprü"** kanalını açtı ve kural koydu: **karta atanarak iş al,
ikiniz de atanmışsanız durup bölüşün; her mesajda karşı tarafı @ ile an,
gören hemen "ALINDI (msg id)" yazsın; ortak işi tek oturum yapsın.** Uzun
kayıt #196'da, kısa koordinasyon kanalda. 16:12'de ev oturumu beklemeye
alındı, işler ofiste.

**Ofis (bu oturum):**

| Commit | İş |
|---|---|
| `c6b8f0e` | **#201 açık sekme dağıtımı fark ediyor.** `X-Stoa-Build` her yanıtta; ölçüt SAYFAYA gömülü (`__STOA_BUILD__`, ilk API çağrısı dağıtımdan sonra düşerse ölçüt yeni/kod eski olurdu); index.html `no-cache`, tek `sendIndex`; kalıcı "yeni sürüm, yenile" bildirimi, kendiliğinden yenileme yok. Canlıda doğrulandı: `x-stoa-build` başlığı ve gömülü kimlik eşleşiyor. Tuzak: `replace('__STOA_BUILD__')` özellik adını buluyordu — tırnaklı belirteç |
| `d4a4a37` | G turu bulgusu: `GET /chat/messages` `asc + take` ile EN ESKİ N'i seçiyordu; istemci limit vermediği için 100+ mesajlı kanal yeniden yüklemede yenileri hiç göstermezdi. `desc + take + reverse` |
| `099588f` | **#153 lint 45+9 → 0+4**, `no-unused-vars` iki tarafta HATA (mutasyonla doğrulandı). Kalan 4 exhaustive-deps bilerek uyarı, gerekçe eslint.config.js'te |
| `5b62bd6` | #218 kök `package-lock.json` (94 bayt, boş) silindi; sonraki dağıtım yeşil indi |
| `a6eebaf` | #210 özel vurgu rengi koyu temada açılıyor: JS `--accent-custom` yazar, `--accent` CSS'te türetilir, koyu temada `max(l, 0.68)` |
| `0aaa584` | #154 çekmece kolonları kartın KENDİ projesinden (`GET /tasks/:id` → `columns`); DATA.COLUMNS yalnızca yedek |
| `3cfa5ec` | #215 `err_doc_checklist_retired` mesajı sunucuda `reqLang` ile iki dilde — uyumsuzluk reddi tanımı gereği eski pakete gider |
| `819606b` | #119 eki: kesim notu yalnızca gerçekten gizlenen mesaj varsa (`history_hidden`, kanalın ilk mesajı < kesim). Mutasyon bir kaçak buldu: COALESCE dosya genelinde aranıyordu, GROUP BY kopyası aklıyordu |
| `674c12f` | #250 kanal slug'ı (ev oturumundan devralındı): noktalı İ → i, ardışık tire tek. `tr-TR` BİLEREK yok ("AI" → "aı"). Mevcut slug'lara dokunulmadı (kullanıcı kararı) |
| `cee3596` | **#245 aramada öneri.** Kullanıcı kararı: hareket kaydından türet, şema yok. Üç bölüm (son dokundukların / üzerindeki işler / hareketli 48 saat), kart yalnızca ilk uyduğu bölümde, bitmiş/çöpteki hiç girmez, NULL `is_done` bitmemiş. Uç `GET /workspaces/me/tasks/oneriler` (meTasksRouter, notes.js — api.js'e girilmedi, ev oradaydı). Saf kural `lib/oneri.js` |

Kapanan/temizlenen kartlar: #234 (G turu koşuldu), #216 (ölçüldü, kusur
değil: Prisma 5.22 çalışma zamanında `Json?` alana düz `null`ü kabul
ediyor — MCP `create_task` bunu her gün yapıyor), #211 ve #125 (bayat,
zaten yapılmıştı). #188'e durum notu (başlangıç varsayılanı `d064ff8` ile
geldi, kalan soru karar).

**Ev oturumu (aynı aralık):** `15e12e8` #202 ölü throughput hesabı silindi ·
`7577a24` `stoa.view` tek okuyucu, hukuki sayfadan `'auth'` kalktı (yeni
kilit `test/gezinme.test.js`: her `setView` hedefi çizilen bir görünüme
varmalı) · `2f15346` #248 misafir kart adresiyle gelince girişten sonra o
karta dönüş · `5c67ac9` #249 genel dışı kanalda "genel kanala yaz"
demiyor · `8d46987` **#204 ikinci aşama**: aktif alan okurken yazılmıyor,
`currentWorkspaceId` yalnızca `lib/workspace.js` içinde okunur
(guvenlik.test.js kilitliyor). H turu (#247) A–C yapıldı, 16 kart
Tamamlandı'ya; D (#201 sürüm uyarısı — bir sonraki dağıtımda) ve madde 18
(#254) bekliyor.

### Kaldığı yer

- **Ev oturumu BEKLEMEDE** (16:12), hiçbir karta atalı değil. Kanal
  protokolü yukarıda; dönerse önce kanalı ve #196'yı okusun.
- **Canlı doğrulama bekleyenler** (hepsi kartlarında adım adım yazılı):
  #228 geri tuşu (cihazda denenmedi), #195 çizelge (`c6704f7` sonrası),
  #240 mobil DM listesi, #238/#241/#242/#243, #119 (iki hesap gerekir), #200
  (e-posta), #246 (kullanıcı "geçiş yapıyor" dedi, altı adımın tamamı değil).
- G turu koşuldu, #234 kapandı; bulgusu `d4a4a37`.
- **Kullanıcı kararı bekleyenler:** #117 proje bazlı üyelik (çöp kutusu notu
  kartta), #131 blok düzenleyici (alt görev 130: Notion'da hangi bloklar),
  #199 veri onarımı (canlıda ölçüm gerekiyor, 5432), #198/#237 şema (elle
  SQL), #197 DNS, #203 GitHub faturalandırma.
- **Ofis makinesinde alınabilir işler:** #124 uç testleri, #213 MCP
  pürüzleri, #208 roller iki dilli. #117/#118 çift atanmış — karar gelene
  kadar atama kaldırılsın önerisi kanalda cevap bekliyor.
- İncelemede'de **20'den fazla kart** birikti; süpürme turu bekliyor.
- Ev oturumu 13:20'de dönerse: **#196'nın son yorumunu oku** — dosya listesi
  orada. DEVIR 0-AF'ye dokunulmadı; bayatlığı bu bölüm kapatıyor.

---

## 0-AF. 17 Eylül gecesi – 18 Eylül sabahı — gerçek cihaz turu, on commit

**Ev makinesi, kullanıcı telefonundan canlı test ediyor.** Testler
**670 → 736**. On commit `main`e gitti, hepsi canlıda. Bu turun tamamı
kullanıcının gerçek cihazda bulduğu kusurlardan doğdu.

### Kapananlar

| Commit | İş |
|---|---|
| `6ff93d4` | Yorumdaki @bahsetme kimseye ulaşmıyordu (#235'in bir parçası) |
| `bfe5839` | Kart açıklaması tek paragrafa çöküyordu (#241) |
| `a13fc0e` | Zildeki nokta ters mantıktaydı (#242) |
| `5bdc969` | Denetim kaydında yazılar üst üste biniyordu (#243) |
| `4ddc2f3` | **Pano gerçek zamanlı oldu** (#235) |
| `d064ff8` | Kolon bildirimi (sessiz) + başlangıç tarihi varsayılanı |
| `783300a` | Kaplama katmanı ErrorBoundary'ye alındı (#244) |
| `960aa55` | Sarkan kart numaraları düzeltildi |
| `a28b644` | Mobilde sürükle-kapat (#238) |
| `2d2ba93` | **DM'ye geçince sohbet paneli çöküyordu** (#240) |

### En önemli iki bulgu

**1. Pano hiç gerçek zamanlı değildi** (#235). `routes/projects.js` ve
`routes/tasks.js` TEK BİR soket olayı yayınlamıyordu, istemci de hiçbir pano
olayı dinlemiyordu. Ürünün iddiası "gerçek zamanlı proje yönetimi"ydi ama
gerçek zamanlı olan tek şey sohbetti.

Kartta ofis oturumunun bıraktığı hipotez (`io` geçirilmiyor) ÖLÇÜLDÜ ve
YANLIŞ çıktı: `io` her çağrı yerinde geçiyor, soket `user_<id>` odasına
katılıyor. Kullanıcının cümlesi teşhisin kendisiydi: "kolon, comment F5 istiyor
**görünmek** için" — eksik olan bildirim değil, NESNENİN KENDİSİYDİ.

Yeni: `server/src/lib/board.js`, on bir yayın noktası, beş istemci dinleyicisi.
**#117 (proje bazlı üyelik) geldiğinde `ws_` odası daraltılmalı** — dosyanın
başında borç senedi olarak yazılı.

**2. Bir panelin hatası bütün uygulamayı götürüyordu** (#244). `TaskDrawer`,
`ChatPanel`, `NotifPanel`, `AddTaskModal`, `CommandPalette` — beşi de
`ErrorBoundary` DIŞINDA render ediliyordu. `ErrorBoundary`nin kendi açıklaması
bu kusuru birebir tarif ediyordu; ders 2 Eylül'de GÖRÜNÜMLER için öğrenilmiş,
kaplama katmanı atlanmıştı.

Aynı commit **hata metnini ekrana** yazdı. Bu, bir sonraki kusuru bir dakikada
kapattı: kullanıcı raporları telefondan geliyor ve orada konsol açılamıyor.

### #240 — kendi kusurum, kendi testimin kaçırdığı

`chat.jsx:1807/1809` `taslaklar.current.set(...)` çağırıyordu. Taslak deposu
17 Eylül'de (`354bd0c`) ref'ten MODÜL KAPSAMINA taşınmıştı; bildirim
çevrilmiş, iki çağrı yeri `.current` ile kalmıştı.

Etki yalnızca sohbet HEDEFİ değiştiğinde çalışıyor — kanaldan DM'ye, DM'den
kanala. Yani **DM tamamen kırıktı**, yalnızca bahsetme yolu değil. Kullanıcı
ikisini ayrı ayrı bildirdi, ikisi de aynı satırmış.

Testim depoyu BİLDİRİMİNDEN kilitliyordu, kullanım yerlerine hiç bakmıyordu.
Yeni ölçüt: `taslaklar.current` kaynakta hiç geçmemeli.

**Ders, CLAUDE.md'ye eklenmeye değer:** bir şeyin TÜRÜNÜ değiştirdiysen
bildirimini değil KULLANIMLARINI ölç.

### Testin kendisi bu turda ALTI kez yanlış ölçtü

Hepsini mutasyon buldu, hiçbirini test koşusu. Sayısı kayda değer çünkü
CLAUDE.md'ye 17 Eylül'de eklenen "ölçüt koruduğu satıra bağlanmalı" kuralı
tam bu ailenin kuralı ve yazıldıktan sonra bile altı kez düşüldü:

1. `\r\n` dönüşümü — alt satırdaki `\r` dönüşümü onu örtüyordu
2. iç içe parantez — `[^)]*` `req.app.get('io')`u geçemiyor
3. kolon bildirimi — sözleşme testi haklı olarak susuyordu, koruyan test yoktu
4. aynı blokta iki üretici — `logActivity` bildirimi akladı
5. `indexOf` ilk eşleşme — panellerin görünüm içindeki kopyaları ölçülüyordu
6. alt dize eşleşmesi — `/\.drawer-grab/` `.drawer-grab-XX`i de eşliyordu

**Devralan için:** mutasyon turunu atlama. Bu turda yazılan testlerin üçte
biri ilk hâlinde yanlış şeyi ölçüyordu.

### Kaldığı yer

- **#240 KISMEN AÇIK.** Kullanıcı 18 Eylül sabahı, `2d2ba93` sonrası ölçtü:
  - ✅ sağ üst sohbet düğmesinden DM
  - ✅ kart yorumundaki bahsetme çipinden DM  *(bu düzeldi)*
  - ✅ soldan açılır menüden üyeye basarak DM
  - ❌ **tam sayfa sohbette genel kanaldan DM'ye geçmek — HÂLÂ KIRIK**

  Ayrım önemli: çalışan üç yolun üçü de panele `openChat()` ile DIŞARIDAN
  hedef veriyor. Kırık yol hedefi BİLEŞENİN İÇİNDEN değiştiriyor. Ayrıca
  `<ChatPanel>` yalnızca `view !== 'chat'` iken render ediliyor; tam sayfa
  sohbet AYRI bir render yolu.

  **Ölçülmedi, tahmin yazılmıyor.** İki olasılık: (a) tam sayfa kipte ayrı bir
  kusur var, (b) kullanıcı dağıtım inmeden denedi (push ~05:50 UTC). Devralan
  önce (b)'yi elesin — hard refresh sonrası tekrar denensin. Hata metni artık
  görünür (#244), ekrandaki teknik satırı istemek en hızlı yol. Çökme mi yoksa
  sessizce hiçbir şey olmaması mı, o bile bilinmiyor.
- **#238 sürükle-kapat** doğrulama bekliyor (tutamak çubuğu görünüyor mu,
  eşik altında yaylanıyor mu).
- **#241, #242, #243** gerçek cihaz doğrulaması bekliyor.
- **#235** kartın son maddesi kapandı ama pano gerçek zamanlılığı iki hesapla
  sınanmadı.
- **F ve G turları** hâlâ koşulmadı (#234). G, MCP köprüsü — yeni sohbet ister.
- **#228** mobil geri tuşu, üç karar bekliyor. **#239** app yönü (öneri: PWA,
  ön koşulu #228).
- Şema kartları **#237, #198, #191** ve **#199** veri onarımı — canlı veri
  yazımı, önce DENEME çıktısı + kullanıcı onayı.
- **#197** DNS — Railway kullanıcının değil.
- İncelemede kolonunda **20'ye yakın kart** birikti; çoğu fiilen kapalı ama
  Tamamlandı'ya taşınmadı. Bir süpürme turu panoyu dürüst tutar.

---

## 0-AE. 17 Eylül akşamı — uçtan uca tur (A–E) ve mobilde kaybolan üst çubuk

**Ev makinesi.** Kullanıcı günün ~23 commit'ini tarayıcıda harf harf turlarla
(A–G) denedi ve bulguları anlık bildirdi. Testler **666 → 670**.

### Kapanan: mobilde üst çubuk kayboluyordu ve çıkınca geri gelmiyordu (#233)

Bu, 0-AC'de ofis oturumunun **teşhis edemeden** bıraktığı karttı. Orada üç
bariz sebep doğru biçimde ölçülüp elenmişti (panel kaplaması, Topbar'ın render
edilmemesi, hamburger'in gizliliği) ve c) maddesine bir **hipotez** yazılmıştı:
`100vh` + `body{overflow:hidden}`. Hipotez doğru çıktı ama **eksikti**.

Kartı çözen şey kullanıcının ikinci cümlesiydi. Önce "sohbete gidince direkt
textinputtan başlatıyor, bu da topbarın kaymasına sebep oluyor" dedi; sonra
ekledi: **"diğer ekranlarda da bugda kalıyor."** O cümle kusurun şeklini
değiştirdi — bu bir *sohbet* kusuru değil. Sohbet yalnızca tetikleyici; hasar
uygulama genelinde ve sayfa yenilenene kadar kalıcı.

Kusur iki parçalıydı ve **her parça tek başına zararsız görünüyordu**:

1. `.app { height: 100vh }`. Mobil Chrome'da `100vh`, adres çubuğu
   **gizliyken**ki yüksekliktir. Çubuk görünürken kabuk ekrandan uzundur, yani
   belge kaydırılabilir hâle gelir. Tek başına kimse fark etmez: kaydıracak bir
   şey olmadığı sürece kaymaz.
2. Sohbet açılınca metin kutusu **kendiliğinden** odaklanıyordu (`chat.jsx`,
   "Focus input" etkisi, dokunmatik ayrımı yok). Odaklanma ekran klavyesini
   açıyor; tarayıcı odaklanan alanı göstermek için belgeyi kaydırıyor ve üst
   çubuk yukarıdan çıkıyor.

Klavye kapanınca kaydırma **geri alınmıyor**, `body`de `overflow: hidden`
olduğu için kullanıcı da geri kaydıramıyor. Kalıcılık buradan geliyor.

**Kartın asıl bilmecesi de böylece çözüldü:** kusur masaüstü DevTools
responsive kipinde neden görünmüyordu? Çünkü emülasyonda adres çubuğu da ekran
klavyesi de yok; `100vh` görünen alana eşit ve hiçbir şey kaymıyor. Kusur
ancak iki koşul **birlikte** varken doğuyor. Devralan için genel ders:
*"emülasyonda üremiyor" bir açıklama değil, bir ipucu* — emülasyonun
taklit etmediği şeyi sor.

**Düzeltme.** `.app` ve `.drawer` artık `height: 100vh; height: 100dvh;`
ikilisini taşıyor. İkili depoda **zaten yerleşikti** — `auth-page` ve
`chat-panel` kullanıyordu, gerekçesi de `styles.css`te yazılıydı (#192 turunda
eklenmişti). Üst çubuğu **tutan** en dış kabuk onu almayı kaçırmıştı. Yine
"aynı olgunun birden çok okuyucusu, biri eksik" ailesi; bu ay dördüncü kez.

Açılış odaklaması artık `pointer: coarse` ile sınırlı. Ölçüt ekran
**genişliği** değil: aranan şey "ekran klavyesi açılır mı", "pencere dar mı"
değil. Dar bir masaüstü penceresinde fiziksel klavye var ve oraya odaklamak
hâlâ doğru davranış. Kullanıcı **eyleminden sonraki** odaklamalar (yanıtla,
emoji, gönder) bilerek duruyor — orada klavyenin açılması istenen sonuç.

Commit `f07e0d4`, canlıya indi. **Gerçek cihazda doğrulama bekliyor**
(telefonda önce hard refresh gerekebilir).

### Yeni test dosyası: `server/test/mobil.test.js`

Dört test. Ölçüt kasten "hangi seçici" değil **kural**: yarın eklenecek yeni
bir tam yükseklikli kabuk da aynı kapıdan geçsin. Karta ad yazan bir test bir
sonraki kabuğu korumazdı.

CSS yorumlarını boşaltan okuyucu `yardimcilar.js`ten **alınmadı** ve gerekçesi
testin içinde yazılı: oradaki okuyucu JavaScript'e göre yazılmış ve `//`yi
satır yorumu sayıyor. CSS'te `//` yorum değil — `url(https://...)` içinde
geçiyor ve o satırın geri kalanı sessizce silinirdi. Bu, CLAUDE.md'nin "tek
okuyucuda birleş" kuralının **bilinçli** istisnası; birleşmek burada yanlış
cevap verirdi.

### CLAUDE.md'ye yazılan kural (iki oturum anlaşmıştı, ofis bana bıraktı)

*"Kaynak tarayan test, KORUDUĞU SATIRA bağlanmalı."* Dosya genelinde arayan ya
da sayan bir ölçüt komşusundan ödünç alır. Bugün aynı sınıfa **dört kez**
düşüldü ve dördünü de mutasyon buldu; listesi CLAUDE.md'de.

Kuralla birlikte mutasyon turuna yeni bir adım girdi: **aklama denemesi** —
ölçütün aradığı metni dosyada bırak ama korumadığı bir yere taşı; test yine
kırılmalı. `mobil.test.js` bu denemeyi geçti.

### Kaldığı yer

- **F ve G turları koşulmadı.** F mobil, G ise MCP köprüsü (yeni sohbet ister).
  Kart #234.
- **#235** kolon/yorum bildirimleri canlı gelmiyor. Ofis oturumunun hipotezi
  *ölçülmedi*: `io` `createAndPush`e geçirilmiyor olabilir. Devralan önce
  ölçsün, hipoteze güvenmesin.
- **#236** bildirim sesi kalitesi.
- **#228** mobil yönlendirme/geçmiş — kullanıcıdan **üç karar** bekliyor.
- **#237 — şema kartı AÇILDI** (ofis oturumu istemişti): `notifications.read`
  sütunu NULL kabul ediyor.
  `UPDATE notifications SET read = false WHERE read IS NULL;` → `SET DEFAULT
  false;` → `SET NOT NULL;`. Bugünkü `37955c8` belirtiyi kapattı, sütun hâlâ
  açık.
- Kullanıcı kararı bekleyenler: #204 ikinci aşama (`is_current`), #191 + #198
  (şema), #199 veri onarımı, #195 çizelge, #209 profil unvanı.

---

## 0-AD. 17 Eylül öğleden sonra — ev makinesi turu, MCP 0.7.0, iki oturum deneyi

**Bu tur ev makinesinde; ofis makinesi aynı anda 0-AC'yi sürdürüyordu.**
Testler **585 → 639**. Beş commit `main`e push edildi.

> **0-AC'nin "kaldığı yer" 1. maddesi KAPANDI:** beklettirilen üç commit
> (`5813c81`, `b521439`, `3834fe3`) ve sonraki ikisi push edildi, dağıtım
> indi. 2–5. maddeler hâlâ açık. `design/` klasörü hâlâ git dışında.

### Beş commit

**`77bac42` — kart gövdesindeki bölüm başlıkları açıklamaya sızıyordu (#199).**
`docDuzMetin` h1/h2/h3'ü de birleştiriyordu. Sebep kartta tahmin edilenden
netti: çekmece kartı açarken gövdeye KENDİ ürettiği başlığı koyuyor
(`drawer.jsx`, `{ kind:"h2", text:"Açıklama", _i18n:"drawer_description" }`),
yani "Açıklama" kullanıcının yazdığı değil arayüzün yapısal etiketi. Sonuç:
#19'un açıklaması "Açıklama ttakcviöm Alt görevler" oldu ve her düzenleme
yeniden üretiyordu — **veriyi BİRİKEREK bozan** bir kusur.

Kural bilerek **yapısal**, veriye bağlı değil: `_i18n` işaretine bakıp yalnızca
çekmecenin ürettiklerini elemek daha akıllı görünüyordu ama o alan istemci
denetiminde ve kullanıcının elle yazdığı başlık da yapıdır. Bir test tam olarak
o alternatifi yasaklıyor.

**İLERİYE DÖNÜK, GEÇMİŞİ ONARMIYOR.** Bozulmuş açıklamalar kendiliğinden
düzelmez. Onarım güvenli (`doc` sağlam, `desc` ondan türetilebilir) ama üretim
veri göçü: önce **kaç kayıt etkilenmiş ölçülmeli**. Ev makinesinin
`DATABASE_URL`i Neon'un ayrı dalına bakıyor, buradan sayılamaz.

**`f135a19` — sohbet taslağı alanlar arası taşınıyordu (#221).** Mesaj
kutusundaki metin hedeften bağımsız tek bir durumdu; alan değişince A için
yazılan taslak B'nin kanalında duruyordu ve Enter içeriği yanlış alana
gönderirdi. Kullanıcı bulguyu "sorun olmayabilir" diye bildirdi; **tam da
@bahsetme sızıntı testi sırasında ilk denemede düştü.**

Taslak artık **(alan + hedef)** çifti başına bellekte. Anahtarın alan kimliği
taşıması şart: "genel" her alanda var, yalnızca kanal adına göre saklamak
kusuru daha sinsi biçimde geri getirirdi. Yanıt ve eklenmiş dosya da hedefe
bağlı, ikisi de devrediliyor. **Bellekte, diskte değil** — `localStorage`
sohbet metnini ortak makinede başkasının ekranına düşürebilirdi; sayfa
yenilenince taslak gider, bilinçli ödün.

**`3e0f45f` — MCP yazma araçları REST ucundan geçer, doğrudan yazmaz (#222).**
Kart #155 doğrulanırken çıktı. O kart BAYAT çıktı: 16 Eylül'de `72a114d`
"bitiş kolonunda doğan kartın completedAt'i" kusurunu ARAYÜZ yolu için
düzeltmiş ve **MCP kendiliğinden düzelmiş**, çünkü `create_task` kendi kartını
yazmıyor — `callSelf` ile REST ucunu çağırıyor. Tek yol tasarımının karşılığı.

Ama bu miras **korunmuyordu**. Hiçbir test doğrudan yazmayı yasaklamıyordu.
Biri kolaylık için bir Prisma yazması eklerse izin kapıları, `completedAt`,
geçiş kaydı, bildirimler ve **`@bahsetme` kapsam kapısı** atlanırdı.
Sonuncusu kritik: `add_comment` o yoldan geçiyor.

**`265b0fc` — aktif alan çözümü tek kaynakta ve deterministik (#204).**
DEVIR 0-V doğru saymış: üç kopya vardı (`lib/workspace.js`, `routes/api.js`,
`sockets/chat.js`). İkisi silindi, ikisi de mevcut yardımcıya bağlandı —
yeni soyutlama gerekmedi, kopyalar birebir aynıydı. Net **−47 satır**.

**İkinci kusur ilkinin altında saklıydı:** üç kopyada da `findFirst` SIRASIZ
çağrılıyordu ve Postgres sırasız sorguda satır sırasını garanti etmez —
"ilk üyelik" tanımsız bir seçimdi. Görünmemesinin sebebi kayda değer:
sonucun sütuna yazılıp sabitlenmesi kusuru örtüyordu. **Kusuru gizleyen şey,
kartın şikâyet ettiği "okurken yazma" davranışının ta kendisiydi.**

**Kart AÇIK.** Asıl talep (yazmayı tümden kaldırmak) yapılmadı: sıralama
olmadan güvenli değildi, artık güvenli ama bir karar istiyor — sütun boş
kalırsa `api.js`teki `is_current = wm.workspaceId === user.currentWorkspaceId`
karşılaştırması **hiçbir alanı aktif göstermez**.

**`a67ecad` — MCP 0.7.0: sohbet araçları (#223).** `list_channels`,
`list_messages`, `send_message`. Üç araç, çünkü ikisi yetmiyordu: kanal
listesi olmadan model hangi kanalların var olduğunu bilemez.

**DM'ler bilerek yüzeyde yok** ve bu çalışma zamanında değil **girdi
şemasında** sınırlı: araçlar `to`/`with` parametresi almıyor, yani DM yolu
yazılabilir değil. Unutulan bir kontrolle açılacak türden bir kapı değil.

**Sürüm 0.7.0, 0.8.0 değil.** Kart #205 (`add_attachment`) 0.7.0'ı "aday"
diye tutuyordu ama o sürüm çıkmadı. **Sürüm rezerve edilmez, sırayla verilir.**

### Ders: bir MCP sürümünü yazan oturum onu KULLANAMAZ

MCP-SURUMLER.md'nin başında "araç yüzeyi değişen her sürümden sonra yeni
sohbet aç" yazıyor. Bugün o kuralın açıkça söylenmeyen sonucu ısırdı:
**yeni yüzeyi ancak dağıtımdan SONRA açılan bir oturum görür.** Sürümü yazan
oturum göremez, çünkü araç listesini bağlantı başında çekmiştir.

Ölçüldü, varsayılmadı: dağıtım indikten sonra `whoami` **0.7.0 ve 23 araç**
diyor, ama her iki oturum da kendi listesinden üçünü **yükleyemedi**
("No matching deferred tools found"). Yani sohbet köprüsü yazıldığı gün
**iki yönde de kapalı** kaldı.

Ev oturumu önce "sen yeni sohbet açarsan görürsün, tek yönlü olur" dedi;
ofis oturumu bunu **ölçerek** düzeltti — o da aynı durumdaydı. Koşullu ifade
doğru, pratik sonuç yanlıştı.

### İki oturum paralel çalıştı — ne işe yaradı

Kanal: panodaki **kart #196** ("📮 Oturumlar arası koordinasyon"). Yorumlar
iki oturumun da okuyabildiği tek yer. **Depoya değil panoya kurulması
bilinçliydi:** iki oturumun da yazacağı dosyalar TODO.md ve DEVIR.md; kanal
oraya kurulsaydı tam da çakışılacak yerde buluşulurdu.

**İş sahiplenme protokolü (çalıştı):** karta girmeden önce
`list_tasks(col:"doing")` oku, boşsa `add_assignees` + `move_task("doing")`,
bitince `review`. `add_assignees` **birleşiyor** (tam liste değil), yani aynı
anda sahiplenme sessiz kayıp değil **görünür çift atama** üretir.

**MCP yazma çakışması — bilinmesi gerekenler:** yorumlar ve
`add_labels`/`add_assignees` güvenli (birleşiyorlar). `update_task` ile `desc`
**yerine koyuyor** ve sürüm kontrolü yok: aynı kartın açıklamasını iki oturum
düzenlerse biri sessizce kaybolur. `move_task` son yazana teslim.

**Dosya bölüşümü kendiliğinden yürüdü:** ofis istemcide (`app.jsx`,
`notifications.jsx`, `styles.css`, `palette.jsx`, `static/vitrin/*`), ev
sunucuda (`lib/*`, `routes/*`, `sockets/*`). On commit rebase edildi, **tek
çakışma çıkmadı** ve birleşim birlikte doğrulandı (639 test).

**Aktif alan tuzağı ısırdı:** kullanıcı test için alan değiştirince MCP'nin
aktif alanı da değişti ve pano yazmaları 409 yedi. Güvenli başarısızlık —
yanlış panoya yazmadı. Kural: **yazmadan önce `list_projects` ile hangi
alanda olduğunu doğrula.** Kök sebep #204'te.

### Canlı doğrulama — bu turda yapılanlar

0-AB'nin iki güvenlik düzeltmesi **kullanıcıyla canlıda doğrulandı**:
- Yükleme sınırı: 15 MB reddedildi, 9 MB geçti, ekranda "File exceeds the
  10 MB limit". Üç şeyi birden kanıtladı — 413 dönüyor (500 değil), istemci
  kodu çeviriden geçiriyor, **`en` sözlüğü de doğru** (arayüz İngilizceydi).
- `@bahsetme` kapısı iki yönde de doğru: alan üyesine bildirim **gitti**,
  alan dışındakine **gitmedi**. Negatif test doğru yapıldı — kullanıcı açılır
  listenin önerisini beklemedi, metni **elle yazıp gönderdi**. Eski kodda
  sızıntı tam o yoldan oluyordu. "Arayüz önermiyor" ile "sunucu reddediyor"
  aynı şey değildir.

**İlk denemede mesaj görünmemişti; sebep eski sekmeydi.** Kart #201 ("açık
sekme dağıtımı fark etmiyor") artık teorik değil, **iki canlı kanıtı var**.

### Kaldığı yer / yeniden başlayınca

1. `git fetch && git status`. `main` push edilmiş, dağıtım indi
   (`whoami` → 0.7.0). **Kart #196'nın yorumlarını oku** — öteki oturumun
   son durumu orada.
2. **0-AC'nin 2–5. maddeleri hâlâ açık** (mobil/masaüstü canlı doğrulama,
   #187 avatar ve demo alanı kararları, vitrindeki LinkedIn yer tutucusu).
3. **0-Z'nin listesi beş turdur devrediyor:** içe aktarma canlıda denenmedi,
   notlar iki hesapla doğrulanmadı. Her tur "sıradaki" deniyor ve her tur
   başka iş araya giriyor.
4. **Kullanıcı kararı bekleyen üç şey:** #204 ikinci aşaması (`is_current`),
   #191 (`uploaded_files.uploader_id`) ve #198 (`board_columns.is_done`
   NOT NULL) — son ikisi **şema**, elle uygulanır.
5. **#199'un veri onarımı:** önce canlıda kaç kaydın `desc` alanı `doc`tan
   türetilenden farklı, ölçülmeli.
6. Sohbet köprüsü (#223) **denenmedi**: dağıtımdan sonra açılan yeni bir
   oturum gerekiyor. Bugünkü iki oturum da göremiyor.

---

## 0-AC. 17 Eylül öğleden sonra — mobil üçlü, kart numarası, dört karar, vitrin

**İki makine aynı anda çalıştı:** bu tur ofis makinesinde (5432 kapalı,
`mcp:tara` ve `prisma:push` koşmaz), kullanıcı paralel olarak ev makinesinde.
Çakışma olmadı ama pano tur boyunca altımızda değişti — aşağıda.

Testler **577 → 585**. Dört commit `main`e push edildi, Railway dağıttı.

### Mobil üçlü (0-AB'nin saha turundan) — üçü de kapandı

**`dd44764` — bildirim işlemleri sessizce başarısız oluyordu (#193).**
`notifications.jsx`teki beş işlemin beşi de ekranı sunucuya yazmadan ÖNCE
güncelliyor ve hatayı `catch (_) {}` ile yutuyordu. Ekran "oldu", kayıt
"olmadı" diyordu. Sunucu tarafı doğruydu.

**Kartın kanıtı kısmen yanlış okumaydı ve bunu bilmek önemli:** "Tümü 10 =
Okunmamış 10" bir kusur belirtisi DEĞİL — sekme sayıları 15 Eylül'den beri
yalnızca okunmamışı sayıyor. İlk kayıtta nokta olmaması da tutarlı. Rozetin
ayrı kaynaktan beslendiği doğru ama bilinçli (`rozet.js`). Yani kartın üç
"ölçülebilen" bulgusundan üçü de açıklanabilir davranıştı; asıl kusur başka
yerdeydi.

**Kök sebep KANITLANMADI:** mobildeki olay yeniden üretilemedi. Düzeltme
kusuru kapatmıyor, **teşhis edilebilir** kılıyor — geri alma + toast. Bir
dahaki denemede ya çalışacak ya sebebini söyleyecek.

**`02177dc` — sohbet perdesi paneli karartıyordu (#194).** Perde panelin kendi
`::before`'uydu (`position:fixed; inset:0; z-index:-1`). Panel açıkken
`transform` taşıyor ve transform İKİ şey birden yapar: yığılma bağlamı açar
(negatif z-index dışarı çıkamaz) ve sabit konumlu torunlar için kapsayıcı blok
olur (`inset:0` ekranı değil PANELİ kaplar). Kural amacının tam tersini
yapıyordu. Perde `body`ye taşındı (z-index 74, panel 75).

**`0992aa4` — giriş ekranında dil değiştirince vitrine düşme (#192).** İki
doğru parça, aradaki yanlış varsayım. `app.jsx`teki adres etkisi
`view === 'auth'` dalı taşıyordu ama **`setView('auth')` hiçbir yerde
çağrılmıyor** — giriş ekranını `authed` açıyor. Ölü dal yüzünden adres `/giris`
iken sessizce `/` yapılıyordu; `switchLang`in `location.reload()` çağrısı da o
adresi yüklüyordu. Oturum yokken `/` vitrin demek. `window.io` ile aynı kök
sebep: okunan ama hiç atanmayan değer.

Yol üstünde ikinci bir kusur kapandı: önyükleme sürerken `authed` false olduğu
için giriş YAPMIŞ kullanıcı da bir an `/giris`e itiliyordu ve geri tuşu onu
giriş ekranına atıyordu. `loading` kapısı eklendi.

**Üçü de canlıda İÇERİKTEN doğrulandı** (paketten `notif_err_action` ve
`body:has(.chat-panel` arandı, `view==="auth"` yokluğu ölçüldü).
**Kullanıcının mobil doğrulaması HENÜZ YAPILMADI** — kartlar bu yüzden
Tamamlandı'da değil İncelemede, adım adım test talimatı yorumlarında.

> **Paket hash'i dağıtım doğrulaması için GÜVENİLMEZ.** Canlı JS paketi
> yerelde derlenenden farklı hash ve farklı boyut taşıyor (739 KB / 507 KB);
> Railway parça bölmeyi farklı uyguluyor. Hash bekleyen bir yoklama boşuna
> bekler. Ölçüt paketin İÇİNDE bir dizi aramaktır.

### `338c2d5` — kart numarası gösterme anahtarı (kullanıcı önerisi)

Ayarlar → Görünüm → Geliştirici → "Kart numaralarını göster", varsayılan
kapalı. Açıkken numara kartta (`card-meta`) ve çekmecenin kırıntı satırında.

İki karar kayda değer:

- **Anahtar Tweaks paneline KONMADI, Ayarlar'a kondu.** Tweaks paneli
  (`tweaks.jsx`) daha doğal görünüyor ama **ulaşılamıyor**: `tweaksAvailable`
  bir üst çerçeveden gelen `postMessage` ile açılıyor (`__activate_edit_mode`),
  gömülü bir editör ortamından kalma. Oraya konsa özellik yazılmış ama
  erişilemez olurdu.
- **`tweaks` çekmeceye PROP olarak geçiyor, `window.__TWEAKS__` değil.** O
  global sunucunun gömdüğü BAŞLANGIÇ TOHUMU; canlı değer React durumunda ve
  `setTweak` yalnızca onu güncelliyor. Global'den okunsaydı anahtar açıldığında
  çekmece eski değeri gösterirdi: ayar "açık", ekran "kapalı". Testle kilitli.

### Dört ürün kararı (kod değil, karar)

- **#120 süreyi kim girer → bugünkü hâl kalıyor, bilinçli seçim olarak.**
  Kişi kendi süresini girer, onay katmanı yok. Onay akışı Jira'yı ağır yapan
  katmanın ta kendisi. **Ödün:** beyan edilen emek denetlenmiyor; ekip
  büyüdüğünde yeniden açılacak madde bu. **Kapandı.**
- **#122 sohbetin kapsamı → #117'ye bağlandı.** Görünürlük modeli yokken
  "proje kanalı"nı kimin göreceğinin cevabı yok. **Kapandı** (bağımsız açık
  madde olmaktan çıktı). #119 da aynı sebeple #117'yi bekliyor.
- **#121 bildirim kesme → atama + bahsetme keser, gerisi sessiz birikir.**
  Teslim tarihi bilerek dışarıda: her sabah bir dalga kesme üretir, en hızlı
  "bildirimleri kapatma" sebebi budur. E-posta da aynı sınırı izler.
  **Kod işi kaldı** (Yapılacak'ta); kesme kararı TEK yerden verilmeli.
- **#195 mobil çizelge → dar ekranda gizle + "geniş ekranda" notu.**
  Sadeleştirme işi kırık olmaktan çıkarmaz, kırıklığı uğraşılmış hâle getirir.
  **Kod işi kaldı.** Açık soru: eşik 768 mi, tablet için 900 mü.

### Pano tur boyunca değişti: TODO.md panoya taşındı

Kullanıcı ev makinesinde TODO.md'yi panoya boşalttı — **26 → 51 açık kart**
(#204 ve sonrası). **Bu yeni iş DEĞİL:** hepsi TODO'da zaten bilinçli
ertelenmiş maddeler, gerekçeleri kartların içinde. Çoğu `backlog` + `low`.
Sayıya bakıp panik yapma; bugünkü gerçek yük değişmedi.

**Sonuç olarak TODO.md artık tek kaynak değil.** Bir madde ararken panoya da
bak; ikisi ayrışmışsa panoya güven.

### Mutasyon turları ÜÇ KEZ testin kendi kör noktasını buldu

0-AB'de iki kez olmuştu, bu turda üç kez. Sayı artık tesadüf sayılamaz.

1. **Sabit pencere komşu işleve taştı.** "Geri alma var mı" taraması 700
   karakterlik pencereyle bakıyordu; `markAllRead`in yakalayıcısı boşaltılınca
   pencere BİR SONRAKİ işleve taşıyor, oradaki `geriAl(onceki` çağrısını
   görüyor ve test yeşil kalıyordu. Tarama, koruması gereken şeyi komşusunun
   kodundan **ödünç alıp aklıyordu**. Sınır artık bir sonraki `const <ad> =`.
2. **Ters bölü + b, şablon dizesinde SINIR değil BACKSPACE karakteridir.**
   Bağımlılık listesi o kaçışla aranıyordu ve desen hiçbir şeye eşleşmiyordu.
   Liste artık ayrıştırılıp küme olarak karşılaştırılıyor — kaçışa güvenen
   yazım yok.
3. **Global sayım, ölçtüğü şeyden bağımsızdı.** `tweaks={tweaks}` dosyanın
   TAMAMINDA sayılıyordu ve 7 çıkıyordu (SettingsView, TweaksPanel de aynı
   prop'u alıyor). İki `TaskDrawer` çağrısından biri tweakssiz olsa bile test
   yeşil kalabilirdi. Sayım artık her çağrının kendi bloğu içinde.

**Ve bir kez de CSS'te yorum tuzağı düştü:** `kontrast.test.js`e yazılan perde
taraması ilk koşusunda YANLIŞ ALARM verdi, çünkü `styles.css`teki kusuru
ANLATAN yorum yasaklı metnin kendisini içeriyordu (`.chat-panel`,
`position: fixed`). 11 Eylül'deki tuzağın CSS'teki kardeşi. **Kaynak tarayan
test yazıyorsan, dil ne olursa olsun yorumları önce boşluğa çevir.**

### Öğle molası eki — kullanıcı yokken yapılanlar (dört commit)

Kullanıcı yemek molasına çıktı, "gidebildiğin kadar git" dedi ve **push'u
bekletti**. Elde kalan iki karara bağlanmış iş ile vitrinin kod tarafı
yapıldı. Testler **588 → 618**.

> **PUSH EDİLMEDİ.** `5813c81`, `b521439`, `3834fe3` yerelde duruyor.
> `920b0fc` ve öncesi push edilmiş. Kullanıcı ev makinesinde paralel
> çalışıyordu; çakışmayı önlemek için sekiz kart (120, 121, 122, 187, 192,
> 193, 194, 195) ve `design/` klasörü bu oturuma ayrıldı.

**`5813c81` — çizelge dar ekranda gizleniyor (#195).** Karar sabah verilmişti;
bu tur uyguladı. Açık soru (eşik) **gerekçeyle cevaplandı: 768px**, çünkü bu
depoda telefon kırılımı olarak zaten üç yerde kullanılıyor — yeni bir eşik
"dar ekran" tanımının iki cevabı olması demekti. Tek sabitte
(`CIZELGE_MIN_GENISLIK`). Ölçüm `matchMedia` ile, CSS ile **değil**: CSS
gizler ama yine **çizer** ve yerine açıklama konamaz. Medya sorgusu `change`
dinliyor, yani telefon yatay çevrilince çizelge kendiliğinden açılıyor.
Görünüm seçicisindeki giriş **duruyor** — gizlemek "böyle bir özellik yok"
izlenimi verirdi.

**`b521439` — bildirim kesme kuralı (#121).** Atama ve bahsetme keser, gerisi
sessiz birikir. `BILDIRIMLER.md`nin S1 sorusu kapandı, durum haritası
yenilendi.

**Yol üstünde asıl kusur çıktı ve kartın uyardığı sınıfın ta kendisiydi:**
kesme kararının üç okuyucusu vardı ve biri kuralı **hiç uygulamıyordu** —
toast `EKRANI_KESENLER`den geçiyordu, **ses kapısızdı**. Kolon eklendiğinde
ekranda hiçbir şey görünmüyor ama **ding geliyordu**; kullanıcı sesin nereden
geldiğini bulamıyordu. Ses ve toast artık tek kümeden besleniyor.

*Kapsam varsayımı, kayda geçsin:* **sohbet bu kararın dışında bırakıldı.**
Karar "gerisi sessiz" diyordu ama sohbetin kendi işleyicisi, kendi tercihleri
ve farklı anlamı var — bir DM "biri şu an seninle konuşuyor" demek. Kullanıcı
sohbetten hiç söz etmedi. Aksi isteniyorsa tek satır.

*Gözden geçirilmeye değer:* `join_request` sessiz kaldı ama o ötekilerden
farklı olarak **başka birini bekletiyor**. Bir yorumu kaçırmak kimseyi
bekletmez, bunu kaçırmak bekletir. Karar olduğu gibi uygulandı; yeniden
açılırsa ilk aday bu satır (karta ve belgeye yazıldı).

**`3834fe3` — vitrin tasarımdan koda geçti (#187, alt görev 168 + 169).**
Yer tutucu sayfa gerçek sayfayla değişti; ilerleme 1/6 → 3/6.

**Dil kararı — brief'in sorduğu soruya cevap: TEK dosya, iki dil.** Türkçe
işaretlemede, İngilizcesi aynı elemanın `data-en`inde. Gerekçe deponun kendi
dersi: iki kopya ayrışır, tek kaynak ayrışamaz. Türkçe'nin işaretlemede
durması ayrıca **dil sıçramasını** önlüyor ve JS kapalıysa sayfa Türkçe
çalışıyor. Dil anahtarı `stoa.lang` — **uygulamanın kendi anahtarı**; ayrı bir
anahtar, dili vitrinde seçip giriş ekranında Türkçe bulmak demekti.

Yeni test dosyası **`server/test/vitrin.test.js`** (25 test). Ayrı dosya,
çünkü `dil.test.js` `client/src/views`i tarıyor; vitrin statik ve kendi
mekanizmasını taşıyor (`auth.jsx`in AUTH_I18N'i için verilen kararın aynısı).
Üç ayrışma riskini kilitliyor: dil denkliği, sunucu sözleşmesi, **token
eşliği** (on beş değişken `styles.css` ile birebir — `vitrin.css` uygulamanın
CSS'ini içe aktarmıyor, misafire 210 KB indirmemek için, ve o ödün iki yerde
iki değer demek).

**Vitrinde iki yer bilerek yer tutucu, ikisi de açıkça işaretli:** ürün
görseli (alt görev 167) ve **LinkedIn adresi** (`#linkedin-adresi-eklenecek`
— GitHub gerçek, bu değil, **yayına almadan doldurulmalı**).

### Claude Design turu ve öğrendiği ders

Vitrin tasarımı `design` becerisiyle çizildi (artifact:
`claude.ai/artifact/VMQ5F13oKwQnLhwFeVumVK`, çalışma dosyaları `design/`,
**git'e girmedi**). Kendi taslağım incelettirildi ve **on bir gerçek kusur**
çıktı. En ağırı kayda değer:

**Koyu temada vurgu rengini sabit `#1a4a70` yazmıştım.** `styles.css:282` koyu
temada `--accent-navy`yi `oklch(70% 0.10 240)` yapıyor; sabit lacivert koyu
zeminde ~1.6:1 kontrast veriyor. Yani deponun kendi yorumunun (`:171-178`)
"10 Eylül'de düzeltildi" dediği kusuru yeniden kurmuşum. Vitrin CSS'inde
üçüncü kez kurulmasın diye **testle kilitlendi**.

İncelemenin **iki bulgusu reddedildi**, doğrulanarak: "15 saniye uydurma sayı"
değil (`auth.jsx:82` ve `:224`, ürünün mevcut iddiası), ve
`hint-placeholder-val` `sc-for`un değil `sc-if`in özniteliği.

### Bu turda mutasyon ÜÇ kez daha testin kendi kör noktasını buldu

0-AC'nin ilk yarısında üç kez olmuştu; toplam altı. Artık bu bir kural:
**mutasyon turu koşulmadan yazılmış kaynak taraması, ortalama olarak yanlış
bir şeyi koruyor.**

1. **`_playDing` taraması işlev TANIMINI buluyordu** (`function _playDing() {`).
   Üç eşleşme var — tanım, bildirim çağrısı, sohbet çağrısı — ve sohbet
   çağrısı kuralın dışında olmalı. Sınır artık soket işleyicisinin kendisi.
2. **Vitrin sözleşme testi "bir yerde var mı" diye bakıyordu.** Üç kayıt
   düğmesinden **ikisini** bozmak testi kırmıyordu, çünkü kalan biri deseni
   karşılıyordu. Ölçüt artık bütün düğmelerin doğru yola gitmesi.
3. **Mutasyonun kendisi kısmi uygulandı** (`replace(..., 1)`) ve "test
   yakalamadı" gibi göründü. Ders taramadan değil turdan: *mutasyon gerçekten
   uygulandı mı* diye bakmadan "yakalamadı" sonucuna varma.

### Kaldığı yer / yeniden başlayınca

1. `git fetch && git status`. **ÜÇ COMMIT PUSH BEKLİYOR** (`5813c81`,
   `b521439`, `3834fe3`) — kullanıcı bilerek beklettirdi. Ayrıca `design/`
   klasörü git'e hiç girmedi (Claude Design çalışma dosyaları).
2. **Canlı doğrulama listesi, öncelikli.** Push + dağıtım sonrası:
   - **Mobilde:** (a) "Tümünü oku" — çalışmazsa artık kırmızı toast çıkıyor,
     o metin kök sebebi verir; (b) sohbet paneli — panel net, ARKASI kararmış
     olmalı; (c) `/giris`te dil değiştir — giriş ekranında kalmalı;
     (d) Çizelge sekmesi — açıklama gelmeli, boş ızgara değil; telefonu yatay
     çevir, çizelge açılmalı.
   - **Masaüstünde:** tarayıcıyı tam ekran YAPMADAN `/giris` ve
     `/giris?kayit=1` — başlık tam görünmeli (eskiden üstten kesiliyordu).
   - **Bildirim:** karta kendini ata → toast + ding. Kolon ekle → panelde
     görünsün ama **ses çıkmasın** (eski davranışta çıkıyordu).
   - **Vitrin:** oturumu kapat, `/` → yeni sayfa gelmeli; `?lang=en` →
     İngilizce; sayı bandı gerçek sayıları göstermeli (tire kalırsa uç
     cevap vermiyor).
3. **0-Z'nin canlı doğrulama listesi HÂLÂ açık** ve dört turdur devrediyor:
   içe aktarma canlıda denenmedi, notlar iki hesapla doğrulanmadı.
4. **Kullanıcıdan iki karar bekleniyor** (#187):
   - **Avatar çelişkisi:** kartın açıklaması "harf avatarı, YZ yüzü yok"
     diyor, alt görev 171 "YZ portresi üret" diyor. Biri güncellenmeli.
     Ajan fotoğrafik görüntü üretemiyor; monogram/harf avatarı SVG olarak
     yapılabilir, portre kullanıcıdan gelmeli.
   - **Demo alanı (167):** projeyi arayüzden kullanıcı açmalı, MCP'de
     `manage_projects` izni araçsız. Açılırsa kartları MCP yazabilir.
5. **Vitrinde LinkedIn adresi yer tutucu** (`#linkedin-adresi-eklenecek`).
   Yayına almadan doldurulmalı; GitHub adresi gerçek, bu değil.

---

## 0-AB. 17 Eylül — iki güvenlik kapısı, mobil saha turu

Kullanıcı yolda; ev makinesine uzaktan bağlı çalışıldı. Testler **565 → 577**.
Beş commit `main`e push edildi (Railway dağıttı).

### Sohbete dosya yükleme kapısı (`eecc25e`)

TODO'daki açık maddeydi. `POST /api/chat/upload` yalnızca `requireAuth`
taşıyordu: dosya hiçbir kanala/alana bağlı değildi, türü sorulmuyordu, tekrar
sınırı yoktu. Kart eki ucu **aynı** depoya yazıyor ve tür soruyordu.

Kapı **kopyalanmadı**, ortak yardımcıya çıkarıldı: `resolveChatTarget`
(`lib/channels.js`). Mesaj gönderme ucundaki kapı zaten doğruydu; ikinci bir
kopya yazmak yerine tek yere alındı ve iki uç da oradan geçiyor.

**Yol üstünde üç kusur daha çıktı:**

1. **Boyut sınırı yalandı.** multer 10 MB'da kesiyordu; route'lardaki `50 MB`
   (sohbet) ve `20 MB` (kart eki) kontrolleri **erişilemez koddu**. Kullanıcıya
   söylenen sınır gerçek sınır değildi. Sayı tek yere alındı
   (`UPLOAD_MAX_BYTES`), mesaj ondan türetiliyor. Sözlükteki metinler de
   düzeltildi; `err_chat_file_too_large` (16 Eylül'de eklenmişti) artık
   üretilmiyor ve sözlükten çıktı.
2. **Sınır aşımı 500 dönüyordu.** `MulterError` hiçbir yerde yakalanmıyordu;
   kullanıcı "dosya çok büyük" yerine "Şu an bağlanılamıyor" görüyordu —
   düzeltilebilir bir kullanıcı hatası, sunucu arızası gibi raporlanıyordu.
   `uploadErrorHandler` artık 413 üretiyor.
3. **İstemci ham `fetch` kullandığı için** `apiFetch`'in çeviri katmanı devrede
   değildi; toast ham kodu gösteriyordu.

**İnce tuzak, testle kilitli:** multer `req.body`'yi akışta **dosyaya kadar**
gördüğü metin alanlarından doldurur. İstemci `to`/`channel` alanlarını dosyadan
ÖNCE ekliyor. Yanlış sırada kapı **sessizce** etkisizleşir (her istek
`general` sayılır) — bu yüzden sıra bir biçim tercihi değil, kapının ön koşulu.

### `@bahsetme` kapsam kapısı (`82251b4`) — daha ağırı

Yükleme işi sırasında bulundu. Bahsetme bildirimi mesajın 80 karakterlik
önizlemesini taşıyor. `routes/chat.js` POST `/messages` içindeki döngü
`prisma.user.findUnique({ where: { slug } })` diyordu ve **hiçbir kapsam**
sormuyordu: özel kanaldaki bir mesaj `@slug` ile platformdaki herhangi birine
sızdırılabiliyordu.

**Kök sebep kapı değil, kapının tek yolda durmasıydı.** `mentionAllowed`
12 Eylül'de yazıldı, test edildi ve yalnızca `sockets/chat.js`e takıldı.
İstemcinin kullandığı yol REST — yani **kapısız olan yol, canlıda etkin olan
yoldu.** DEVIR 0-J'de kart yorumunda kapatılan kusurun kardeşi.

Bu yüzden düzeltme kapıyı kopyalamakla kalmadı: dört test **iki yolu birlikte**
kilitliyor. Sıra da ölçülüyor (kapı yazmadan önce) ve kapıya **sabit değer**
beslenmediği ayrıca doğrulanıyor — `sharesWorkspace: true` beslenirse kapı
yerinde durur ama hiçbir şeyi reddetmez, ilk üç test yeşil kalırdı.

Yol üstünde: `resolveChatTarget` artık kanal kaydını da döndürüyor
(`channelRow`). Aynı satır **üç kez** sorgulanıyordu — kapıda, bahsetmede,
yayında. Şimdi bir kez.

### Mutasyon turları iki kez testin kendi kör noktasını buldu

Yükleme turunda 6/6, bahsetme turunda 4/4 mutasyon yakalandı. **İkisinde de
tur, testin kendi zayıflığını gösterdi:**

- Sıra kontrolü `lastIndexOf` ile bakıyordu; başa eklenen fazladan bir `file`
  alanını görmüyordu (son `file` hâlâ sonda kalıyor).
- Kapı hiç yokken `indexOf` −1 döndüğü için `−1 < yazma` doğru çıkıyor ve sıra
  testi sessizce geçiyordu.

CLAUDE.md'nin kuralı bir kez daha karşılığını verdi: *kaynak tarayan test,
koruduğu satır kasten bozulup kırıldığı görülmeden bitmiş sayılmaz.*

### Mobil saha turu (kullanıcı, canlıda, Android/Chrome)

Dört bulgu, hiçbiri koda girmedi; panoda kart açıldı (#192–#195):

- **Dil değiştirince vitrine atıyor.** `/giris`te dili değiştirince kullanıcı
  vitrine düşüyor; dönünce dil değişmiş oluyor. Şüphe: yeniden yükleme + `/`
  yönlendirmesi, dönüşte hedef korunmuyor.
- **"Tümünü oku" sonrası bildirimler okunmamış kalıyor.** İşlem başarılı
  görünüyor. "Tümü 10" = "Okunmamış 10" iken listedeki ilk kayıtta nokta yok.
  Sessiz başarısızlık şüphesi; sayaç ayrı kaynaktan besleniyor olabilir.
- **Sohbet paneli karartılmış.** Perde panelin üstüne boyanıyor gibi; dar
  ekranda z-index / yığılma bağlamı.
- **Çizelge dar ekranda kullanılamaz.** Ürün kararı bekliyor: mobilde gizle mi,
  sadeleştirilmiş kip mi.

### Panoya yazıldı (Netaş alanı, `Ana Proje`, MCP ile)

`#189` ve `#190` İncelemede + ayrıntılı yorum; `#191` (bayt kotası, şema),
`#192`–`#195` (mobil). **Uyarı:** MCP'nin aktif alanı tarayıcı oturumuyla
ortaktır — kullanıcı mobilde gezerken alan kendiliğinden değişti (15 → 1 → 15).
Panoya yazmadan önce `list_projects` ile hangi alanda olduğunu **doğrula**.

### Kaldığı yer / yeniden başlayınca

1. `git fetch && git status`. `main` push edilmiş durumda, çalışma ağacı temiz.
2. **0-Z'nin canlı doğrulama listesi hâlâ açık** ve önceliği yüksek: içe
   aktarma canlıda denenmedi, notlar iki hesapla doğrulanmadı.
3. **Bu turun canlı doğrulaması:** (a) sohbete dosya yükle — kanal ve DM'de
   çalışmalı; üye olmadığın özel kanala yüklenememeli. (b) 10 MB üstü dosya
   413 ve doğru mesaj vermeli, 500 değil. (c) Özel kanalda alan dışından
   birini `@` ile an — bildirim **gitmemeli**.
4. Sırada: mobil bulgular (#192–#195) ve vitrin demo alanı (0-Z akşam eki).

---

## 0-AA. 16 Eylül akşamı — davet kodu denetimi, yazan uçlarda kapı taraması, iki dil kusuru

0-Z yazıldıktan **sonra** gelen dört commit. Devir notu bunları görmeden
kapandığı için 17 Eylül sabahı geriye dönük yazıldı; sıra `git log` sırasıdır.

- **Davet kodu denetim kaydına** (`ba1fd2d`). 2 Eylül turundan kalan tek
  parça. Kod önyükleme yanıtında geliyordu: her sayfa açılışında sessizce
  alınıyor, kimin ne zaman gördüğü yazılamıyordu. Davet kodu alana giriş
  biletidir; kimin gördüğü üye çıkarma kadar önemli. Önyükleme artık yalnızca
  `has_invite_code` diyor, kod `GET /workspaces/me/invite-code` ile çekiliyor
  ve çağrı `AUDIT.INVITE_CODE_VIEWED` yazıyor (yenileme de, `via: regen`).
  Kayda kodun kendisi yazılmıyor. İki tarama testi, mutasyonla doğrulandı.
- **Yazan her uçta izin kapısı taraması** (`7dd888e`). "Uç testleri" kartının
  veritabanı gerektirmeyen ara adımı. `requireAuth` "kim olduğunu biliyorum"
  der, "hakkı var mı" demez; 15 Eylül'ün atama açığı tam bu sınıftı. Tarama
  POST/PATCH/PUT/DELETE gövdelerinde izin, üyelik, sahiplik ya da kendi-kaydı
  kapısı arıyor. **Kapının DOĞRU izni istediğini ölçmüyor** — o hâlâ akış
  testinin işi ve hâlâ yok (TODO 5. madde).
- **Çift/ters tırnaklı `error` alanları** (`c0f3ada`). Kapı taraması yazılırken
  görüldü: üç `error` alanı düz Türkçe taşıyordu, `dil.test.js` yalnızca tek
  tırnağı aradığı için hepsi kaçmıştı. Kaynak tarayan test kör noktası sınıfı,
  11 Eylül'deki yorum tuzağının kardeşi. Tarama artık `'` `"` `` ` `` üçünü de
  görüyor.
- **Sözlükte tekrar anahtar** (`6038008`). Bir öncekinin yan hasarı:
  `err_file_too_large` iki farklı sınır için iki kez yazıldı, JavaScript
  sonrakini sessizce üstüne yazdı. Derleme yalnızca **uyardı**, testler geçti,
  kanca durdurmadı; kullanıcı 20 MB sınırında "50 MB" mesajı görecekti.
  Kusuru derleme çıktısındaki uyarıyı fark eden kullanıcı buldu. İki sınır iki
  kod oldu; `dil.test.js`e "her sözlükte her anahtar bir kez" testi eklendi.
  Ders CLAUDE.md'nin merdiveni: uyarı kapı değildir.

**`9bcd09d` (kişisel MCP anahtarları) bu dördün üstünde ve HEAD.** Kendi devir
bölümü **0-V2**'de duruyor — tarihi 13 Eylül ama 16 Eylül'de 62 commit'in
üstüne rebase edildiği için `git log` sırasında en üstte görünüyor. Bölüm
numarasıyla commit sırası burada ayrışıyor; şaşırma.

### Durum (17 Eylül sabahı, ev makinesi)

`main` ve `origin/main` eşit, çalışma ağacı temiz, HEAD `9bcd09d`.
**565 test geçiyor**, 106 suite, ~6 sn. Test koşusundaki `[db] warmup failed`
beklenen: uygulama modülü yüklenirken bağlantı deniyor, ölçüt alttaki
`pass`/`fail`.

### Kaldığı yer / yeniden başlayınca

1. `git fetch && git status`. **0-Z'nin canlı doğrulama listesi hâlâ açık** ve
   önceliği bundan yüksek: içe aktarma canlıda denenmedi, notlar iki hesapla
   doğrulanmadı, Raporlar'da dışa/içe aktarma satırları görülmedi.
2. Sohbete dosya yükleme kusuru **kapandı** ve push edildi — ayrıntı 0-AB.
3. Vitrin demo alanı ve ekran görüntüsü (0-Z akşam eki) canlıya yazıyor,
   kullanıcı onayı bekliyor. Apex DNS kod işi değil, Railway paneli.

---

## 0-Z. 16 Eylül akşamüstü — toplantı sonrası tur: lint, notlar, taşınma

Toplantıdan sonra aynı gün. Testler **500 → 534**, hepsi geçiyor.

- **Lint** (`774ade4`): dört kural istemcide, iki sunucuda; kancada ve CI'da
  testlerin önünde. Mutasyonla doğrulandı: 15 Eylül'ün iki canlı hatası
  yakalanıyor. 55 uyarı bilerek duruyor (TODO, `TR_X` tabloları tuzağı).
- **Notlar** (`abb9d92`): son yazan ötekinin değişikliğini görmüyordu ve
  alandan çıkınca ESKİ metnini kaydedip ötekini siliyordu. Uygulanan gövde
  ayrı izleniyor (`appliedRef`); çakışmada şerit, sessiz ezme yok. Önizlemede
  tek Enter = yeni satır. **Canlıda iki hesapla doğrulanmadı henüz.**
- **completedAt** (`72a114d`): bitiş kolonuna doğrudan açılan kart artık
  o an tamamlanmış; `yeniKartTamamlanma`, dört test. Panoda İncelemede.
- **Taşınma** (`b95be6c`, `5ce776f`, `d4547d4`): toplantının tek somut
  isteği. Dışa aktar JSON/CSV/Markdown, tek paketten; içe aktar kendi JSON
  (doğrulamalı, tek transaction, yeni proje açar, üye eşleme). Kullanıcı üç
  dışa aktarımı canlıda indirdi ve baktı; gerçek dosya doğrulamadan geçti.
  **İçe aktarma canlıda henüz denenmedi.** Kalan: Trello JSON, genel CSV,
  ekler. Pano kartı 2/5.
- MCP'den pano güncellendi: bugün 7 kart kapandı, 5 açıldı; MCP ile
  bitiş kolonuna açılan kartların `completed_at` boşluğu böyle bulundu.

### Akşam eki: vitrin

İkinci dış göz (bir abi) siteyi beğendi; "free todo" araması Todoist'i
gösterince fark edildi: misafir bizde doğrudan giriş ekranına düşüyor.
Karar: vitrin sayfası, şablon Claude Design'dan (kullanıcı Opus 5 Max aldı,
brief ve ekran görüntüleriyle verdi), biz düz HTML/CSS alırız. Brief
[VITRIN-BRIEF.md](VITRIN-BRIEF.md). **Tesisat yapıldı** (`6c9b60a`): `/`
oturum varsa pano yoksa vitrin, `?join=` giriş ekranına, giriş ekranı
`/giris`, kayıt `/giris?kayit=1`, sayı bandı `/api/public/stats`; yer
tutucu sayfa `static/vitrin/`. Yerelde sahte veritabanıyla denendi.

**Ekran görüntüsü meselesi:** Claude Design gerçek panoyu vitrine koydu;
kart başlıkları yol haritası ve güvenlik işleri, gerçek ad ve fotoğraf.
Kullanılmayacak. **Yarın:** jenerik demo alanı ("Atlas Yazılım" gibi) ve
proje arayüzden açılır, kartları MCP yazar (14 kart, beş kolon, atamalı);
iki hesap geçici olarak "Ayşe Kaya" / "Mehmet Can", harf avatarı (yapay
zekâ yüzü bilerek yok). Görüntü alınır, adlar geri çevrilir. Panoda kart
"Vitrin sayfası", 1/5.

Bu sabah bulunan `stoaboard.com` (www'siz) apex sorunu Railway + DNS
panelinde çözülecek; kod değil (TODO).

### Kaldığı yer / yeniden başlayınca

1. `git fetch && git status`; ofis makinesinde push bekleyen commit
   olabilir (16 Eylül akşamı).
2. Deploy sonrası canlıda: (a) içe aktarma — indirilen JSON'u aynı alana
   yükle, "(2)" ekli üç proje ve 40 kart gelmeli, denetim kaydı satırı;
   bozuk dosya "proje 1 › kart N" deyip hiçbir şey açmamalı. (b) notlar iki
   hesapla: A yazar B görür, B yazar A görür, A yazarken B kaydederse A'da
   şerit. (c) Raporlarda "Çalışma alanı dışa aktarıldı / içe aktarıldı".
3. Sıradaki iş: vitrin için demo alanı ve ekran görüntüsü (yukarıda), sonra
   Claude Design şablonunu yerine koymak; ardından anahtar (a) ya da Trello
   JSON. Hepsi panoda.

Kullanıcı hakkında hafızaya yazıldı: StoaBoard kendi projesi, kurucusu,
staj bitince de sürüyor; belgelerde "devir/ayrılma" iması kurulmaz.

---

## 0-Y. 16 Eylül öğleden sonra — toplantı yapıldı

24 dakika, iki katılımcı. Ürün beğenildi, iletişim açık kaldı (LinkedIn).
Sunum karıştı, demoda konu dağıldı; sonuç yine de beklenen çıktıydı.
Kayda değer tek öneri **görevleri dışa/içe aktarma** (başka platformdan
taşınma); TODO'nun başında yeni bölüm, güvenlik eleği cevaplarıyla.
Öteki öneriler var olan özelliklerdi: keşfedilebilirlik notu aynı bölümde.

Sabahki sunum turunda üç şey değişti ve hepsi commit'te: sayılar
yenilendi ve sayfa sıkıştırıldı (`9e5b0bd`), dil sadeleşti ve em dash
kalktı (`7a0eeb2`), "Devir" bölümü "Sürdürülebilirlik" oldu (`e8726c7`).
Sonuncusunun gerekçesi önemli: proje kullanıcının kendi projesi, kurucusu
o, staj bitince de sürüyor; "gidince ne kırılır" çerçevesi olmayan bir
ayrılığı ilan ediyordu. Bu bilgi hafızaya da yazıldı.

**Toplantı sonrası ilk iş, yapıldı:** lint. ESLint 10, dört kural istemcide
(`no-undef` ve `rules-of-hooks` hata; `no-unused-vars` ve `exhaustive-deps`
uyarı), iki kural sunucuda. Mutasyonla doğrulandı: 15 Eylül'ün iki canlı
hatası da yakalanıyor. Kancada ve CI'da testlerin önünde. İlk tarama
0 hata / 55 uyarı; uyarı temizliği ayrı TODO maddesi (kör silme dil testi
kalıbındaki tabloları kırar).

---

## 0-X. 16 Eylül sabahı — rapor işi kapandı, bağlayıcı kuruldu

**Son güncelleme bu bölüm.** Oturum yeniden başlatılacağı için not bırakıldı;
aşağıdaki "yeniden başlatınca" listesi ilk okunacak yer.

### Yapılanlar (commit `5900a02`)

- **Rapordaki satıra tıklayınca kart açılıyor.** 15 Eylül'ün açık kusuru:
  kişi raporu bütün projeleri birleştirdiğinden satırdaki kart çoğu zaman
  aktif projede değildi ve tıklama **sessizce** hiçbir şey yapmıyordu.
  Raporun kendi açma kopyası ile bildirimlerinki tek fonksiyonda birleşti:
  `openTaskById(taskId, returnView)` (`app.jsx`). Rapordan açılan kart
  kapanınca rapora dönüyor.
- **TODO'daki plandan sapıldı, gerekçesi önemli.** Orada "proje değiştirmek
  şart değil" yazıyordu. Değil, ama tehlikeli: kolonlar projeye ait ve
  çekmece `DATA.COLUMNS`u aktif projeden okuyor — proje değiştirmeden açılan
  kartın "taşı" menüsü **başka projenin** kolonlarını sunar, seçilirse kart
  yanlış kolona yazılır. Bu yüzden proje değiştiriliyor. Asıl çözüm (kolon
  listesini görev ayrıntısıyla taşımak) TODO'ya ayrı madde olarak yazıldı.
- **İki sessiz başarısızlık daha kapandı:** boş gövdeli görev yanıtı ve
  `switchProject`in yalnızca `console.error` yazan catch'i; ikisi de toast.
- **Kurumsal şablon biçimi — dörtlü tamam:** künyede kaynak satırı, her
  tablonun altında hesaplama dipnotu (`ReportFoot`), kişi raporunda dört sayı
  kutusu, baskı tipografisi (`@media print`: serif başlık, küçük büyük harf
  etiket ve sütun adı, gri dipnot). On yeni dil anahtarı, tr ve en.
- **500 test geçiyor, ön yüz derlemesi temiz.** Depo `main` üzerinde,
  `5900a02` henüz **push edilmedi** (kanca push'ta testleri yeniden koşar).

### Bağlayıcı bu makinede kuruldu — yeniden başlatma gerekiyor

Claude Code oturumuna StoaBoard MCP sunucusu eklendi:

- Nereye: `~/.claude.json` → `projects["c:/…/StoaBoard"].mcpServers.stoaboard`
  (**local kapsam** — depoya girmiyor, `.mcp.json` oluşturulmadı).
- Ne: `type: http`, `url: https://www.stoaboard.com/mcp`,
  `headers: { "x-auth-token": <anahtar> }`.
- Anahtar `server/.env`'deki `STOA_MCP_TOKENS` çiftinin **iki nokta sonrası**
  kısmı; slug `eray-atalay-3`, anahtar izi `9BG0yJx_`. Ekrana basılmadı.
- Canlı uç curl ile doğrulandı: `initialize` → **HTTP 200**,
  `serverInfo.name: stoaboard`, `version: 0.6.0`.
- Yedek: yazmadan önce `~/.claude.json` kopyası oturum scratchpad'ine alındı.

### Yeniden başlatınca, sırayla

1. `/mcp` → `stoaboard` listede görünmeli. Hemen görünmezse bir iki dakika
   bekle (15 Eylül'de de öyle olmuştu).
2. `whoami` çağırt: aktif alan ve `available_tools` gelmeli (MCP 0.6.0).
3. `git push` (kanca testleri ve derlemeyi yeniden koşar) — `5900a02` bekliyor.
4. **Sunumu sıkıştırma** — kullanıcının istediği, henüz başlanmadı. Kaynak
   `TOPLANTI-2-SUNUM.html`, artifact URL'i TOPLANTI-2-PLAN.md'nin başında,
   güncellenirken aynı URL'e yayımlanır (önce `read`, sonra publish).
5. Sunum sayılarını yenile (0-W'nin sabah listesindeki 2. madde, hâlâ açık).
   Bugünkü değerler: **toplam commit 208**, 1 Eylül'den beri **145**,
   **500 test**, MCP **0.6.0**, **20 araç**.
6. Toplantı **13:30–14:30**. Demo öncesi kontrol listesi 0-W'nin sonunda:
   tarayıcıda F5, dil Türkçe, bildirim sesi kısık, Eray-2'de bildirim paneli
   açılmasın.

### Açık kalanlar (değişmedi)

Kullanıcıda: süre girişi 3-4 karta, üçüncü hesap, yedek ekran kaydı, tool
permissions kararı, `rapor-ornek.pdf`i ilgili karta ekleme. Kodda: bildirim
`userId` süzgeci tarama testi, MCP `add_attachment`, kolon bazlı darboğaz
tablosu, Notion-lite faz 2, **lint kurulumu** (toplantı sonrası ilk iş).

---

## 0-W. 15 Eylül — toplantı öncesi gün: hesap geçişi, demo panosu, 20 düzeltme

Sabah Claude Code yeni hesaba geçti (eski hesabın haftalık limiti bitti);
bağlayıcı yeniden kuruldu, Railway'deki MCP slug'ı `eray-atalay-3`e alındı
(ayrıntı HESAP-GECISI.md). Gün boyu kullanıcı canlıda denedi, ben düzelttim;
her bulgu bir commit. Testler 485 → **500**, hepsi geçiyor.

### Demo düzeni

- Alan **"StoaBoard Toplantı - BDH Netaş"** (id 15), iki proje: **Ana Proje**
  (ileri backlog: altı karar kartı, gecikmiş iki gerçek iş, hazırlık kartı)
  ve **"1 Eylül → 16 Eylül"** (13 retrospektif kart, hepsi Tamamlandı, gerçek
  kapanış tarihleriyle). Hepsini MCP yazdı; denetim kaydında görünüyor.
- Üyeler: `eray-atalay-3` (owner, MCP anahtarı buna bağlı) ve `eray-atalay`
  (eski hesap, Düzenleyici). Reddetme adımı için üye olmayan **üçüncü hesap**
  gerekli — kullanıcıda.
- MCP dört demo adımı canlıda doğrulandı (okuma, atama+yorum, red, iz). Bir
  kez 502 (proxy–sunucu arası geçici), plana "kırılırsa" maddesi.
- Sunum sayfası yeni hesaptan yayımlandı, kaynağı depoda
  (`TOPLANTI-2-SUNUM.html`); sayılar sabah yenilenecek.

### Kapananlar (commit sırasıyla)

- Bildirim rozeti "son bakıştan beri gelen" (karar (c), Outlook); zil ve panel
  aynı kümeyi sayıyor (`panelGorunur`); satırda kimin yaptığı; sekme sayıları
  yalnızca okunmamış.
- Raporlar: PDF'te tablo tablo (768px mobil kuralı yazdırmada tetikleniyordu),
  scrollbar basılmıyor, CSV **UTF-16LE + sekme** (`sep=` Excel'e BOM'u yok
  saydırıyordu), "Açık/Open" etiketi, proje sütunu + proje süzgeci.
- Çekmece: kendi yorumunu silme, karttan "Yeni not", açıklama yerinde
  düzenleme (kutu/düğme yok), boş bölümler katlanır, özellikler iki sütun,
  "Açıklama" küçük etiket, açılır menüler düğmenin altına (fixed'ten
  absolute'a), **blok düzenleyici faz 1** (`/` menüsü, altı tür, `lib/doc.js`
  sunucu denetimi).
- Ayarlar: projeyi yeniden adlandırma; alan değişince görünüm yenileniyor.
- Pano: kolonlar tam boy, ince kaydırma çubuğu; yeni kartın alt görevleri
  hemen görünüyor.
- Giriş ekranı: uydurma sayılar gitti, gerçek toplamlar
  (`GET /api/public/stats`, herkese açık, üç sayı, 10 dk önbellek).
- Kanca: her koşusunu `.git/pre-push.log`a yazıyor (VS Code Sync'ten de).

### Bugün benden çıkan iki canlı hata — ders

İkisi de derleme ve 500 testten geçti, canlıda patladı: kanca sırası
(erken dönüşten sonra `useRef`, `9843983`) ve tanımsız değişken (alt
bileşende `project`, `5af4e75`). İkisini de yalnızca lint yakalardı
(`react-hooks/rules-of-hooks`, `no-undef`). **Lint kurulumu toplantı
sonrası ilk iş** — TODO "hemen yapılabilir", dört kural, kancaya bağlanır.

### Açık kalanlar

- Kullanıcıda: süre girişi 3-4 karta, üçüncü hesap, yedek ekran kaydı, tool
  permissions kararı, `rapor-ornek.pdf`i ilgili karta ekleme.
- Kodda: bildirim `userId` süzgecini kilitleyen tarama testi; MCP
  `add_attachment` (0.7.0 adayı); rapor çıktısı kurumsal şablon biçimi ve
  kolon bazlı darboğaz tablosu (kullanıcının Claude Design şablonundan;
  ev işi); Notion-lite faz 2 (liste düzenleme, satır içi biçim) — kapsamı
  toplantıdaki "hangi blokları kullanıyorsunuz" cevabı belirler.

### Yarın sabah, sırayla

1. `git fetch && git status` (ev makinesinden gelen varsa).
2. Sunum sayfası: commit/satır sayılarını git'ten al, `TOPLANTI-2-SUNUM.html`
   ve artifact'ı yenile (URL sabit: HESAP-GECISI.md'de).
3. claude.ai'de **yeni sohbet**, `whoami` → 0.6.0.
4. Tarayıcıda F5, dil Türkçe, bildirim sesi kısık, Eray-2'de bildirim paneli
   açılmasın (Mayıs mesajları görünür).
---

## 0-V2. 13 Eylül, gece — kişinin kendi MCP anahtarı

TODO'daki "MCP anahtarı kendi kendine alınabilmeli" maddesinin (a) basamağı.
Sebep ölçek: bugüne kadar yeni birine Claude erişimi vermek, Railway'de ortam
değişkenini düzenleyip yeniden dağıtmak demekti — yani her yeni kişi, Railway
erişimi olan tek kişiden geçiyordu. Ekip büyüdükçe dayanılmaz.

### Ne yapıldı

- **`mcp_tokens` tablosu.** Ham anahtar saklanmıyor; SHA-256 özeti, listede
  tanımak için `stoa_` + dört karakterlik önek, oluşturma / son kullanım /
  iptal tarihleri. Silme yok, iptal var.
- **Uçlar** (`routes/mcpTokens.js`, `requireAuth`): liste, oluştur, iptal. Her
  sorgu `userId: user.id` ile sınırlı; başkasının anahtar kimliği olmayanla
  aynı 404. Oluşturma saatte on, kişi başına beş etkin anahtar. Ham anahtar
  yalnızca oluşturma yanıtında, `Cache-Control: no-store` ile.
- **Kimlik kapısı** önce ortam değişkenine, sonra veritabanına bakıyor. İptal
  edilmiş anahtar olmayanla aynı 401; denetim satırı sahibine bağlanıyor.
  Son kullanım en fazla beş dakikada bir yazılıyor.
- **Parola sıfırlanınca ve profilden değişince bütün anahtarlar iptal.**
  Oturumlarla aynı ders: hesabı ele geçiren birinin ürettiği anahtar, parola
  değişince yaşarsa parola değiştirmek işe yaramaz.
- **Denetim:** `mcp.token_created`, `mcp.token_revoked` (Raporlar'da iki dilli
  etiketle); ayrıntıda kimlik ve önek, anahtar da özet de yok.
- **Arayüz:** bağlantı adresi (kopyala), gerçek kurulum adımları (0-I: No
  sign-in + `x-auth-token`, "Connect"e basma), anahtar bir kez gösteriliyor,
  liste, iki adımlı iptal. TR + EN.

### GUVENLIK.md eleği

1. Kim? `requireAuth`; yetki testi yeni uçları kendiliğinden gördü.
2. Neyin üstünde? Yalnızca kişinin kendi anahtarları; anahtar da kişinin
   izinlerinden fazlasını yapamıyor, o yüzden ayrı izin istemiyor.
3. IDOR? İptal tek sorguda aitlik + varlık; başkasının kimliği = olmayan.
4. Kapalı mı? `kayittanKullanici`: satır yok / iptal / kullanıcı yok → red.
5. Yanıtta ne? `mcpTokenToDict` özeti taşımıyor — sözleşme testinde kilitli.
6. Girdi? Etiket kırpılıyor, kontrol karakteri atılıyor, 80 karakter.
7. Dışarı çıkıyor mu? Ham anahtar tek yanıtta; denetim kaydına düşmüyor.
8. Hata? İptal edilmiş / olmayan anahtar ayırt edilemiyor (401 aynı).
9. Silme? Kullanıcı silinince anahtarlar da gidiyor (CASCADE) — kimliği
   olmayan anahtarın yaşaması için sebep yok. Denetim satırları kalıyor.
10. Test? `anahtar.test.js` (21 test). **On dört mutasyonun on dördü
    yakalandı:** kapsamı kaldırmak (liste ve iptal ayrı ayrı), denetime ham
    anahtar yazmak, `no-store`u kaldırmak, veritabanı aramasını kapatmak,
    geçerlilik kapısını atlamak, iptal edilmişi yeniden yazmak, iki parola
    yolunda iptali kaldırmak, iptal edilmiş anahtara kimlik vermek, etiket
    temizliğini kaldırmak, özeti serileştirmek, yanlış değerden özet almak,
    tekil iptalde önce sahipsiz arama.

**Ödün:** ortam değişkenindeki anahtarlar parola akışının dışında kalıyor —
onlar Railway'de yönetiliyor.

### Yol üstünde: araç kaçışları çözüyor

Etiket temizleyen düzenli ifade `[\u0000-\u001f\u007f]` diye yazıldı ama dosyaya
**ham kontrol karakterleri** olarak düştü; `grep` dosyayı ikili sandı. Düzenleme
aracı parametredeki `\u` kaçışlarını yazmadan önce çözüyor. Aynı tuzak aynı
gece DEVIR.md'deki bu paragrafa da düştü. İki kez düşünce kural teste taşındı:
**`test/kaynak.test.js`** sunucu ve istemci kaynağında, şemada ve kökteki
belgelerde ham kontrol karakteri arıyor. Üçüncü vaka testin kendi başlık
yorumuna düştü ve test onu **ilk koşusunda** yakaladı — aranmış bir mutasyon
değil, gerçek bir vaka. Test tarafında kontrol karakterleri artık
`String.fromCharCode` ile üretiliyor.

### Canlıya çıkış — sıra önemli

1. **Tablo önce** (`prisma migrate diff`, canlıya karşı salt okuma: fark
   yalnızca `mcp_tokens` + iki indeks + yabancı anahtar). Tersi olursa geçersiz
   anahtarla gelen MCP istekleri 401 yerine 500 alır — veritabanı araması tablo
   yokken patlar.
2. Push, dağıtım (`serverInfo.version` 0.6.1).
3. Canlı tarama; Eray Ayarlar'dan bir anahtar üretip Claude'da dener;
   veritabanında `last_used_at` dolmalı.

---

## 0-V. 13 Eylül, akşam — MCP 0.6.0: kuyruğun karar gerektirmeyen kısmı

"MCP bitti mi?" sorusunun cevabı: planlanan üç adım (okuma, alan kapısı,
yazma) bitti. Kalan kuyruk üçe ayrıldı ve karar gerektirmeyenler bu turda
kapandı.

### Yapılanlar

- **`whoami` → `server.available_tools`.** TODO'da "öneri, karar bekliyor"
  duruyordu; ucuz ve bayat sohbeti görünür kıldığı için yapıldı. SDK'nın
  belgelenmemiş kaydından okunuyor — gerçek `McpServer` üzerinde testli,
  taramada `tools/list` ile karşılaştırılıyor.
- **Yetim atananlar: `assignees_not_members`.** Üç kart döndüren okuma
  aracında. Üye listesi okunamazsa kökte `assignees_membership_unknown`.
- **`created_at`** ortak serileştiriciden; ön yüz de alıyor.
- **Anahtar izi.** Sunucu açılışta `[mcp] 1 anahtar: eray-atalay (e9fe29b9)`
  basıyor, anahtar yoksa uyarıyor; tarama başlığında aynı önek. 11 Eylül'deki
  bir saatlik yanlış iz (0-F) artık tek bakışta görünür.

### Bilerek yapılmayan: `currentMember` okurken yazıyor

Ölçüldü ve madde yazıldığından geniş çıktı: okurken onaran kod üç kopya
(`lib/workspace.js`, `routes/api.js`, `sockets/chat.js`) ve sütunu doğrudan
okuyan üç yer daha var. Yalnızca MCP'nin `aktifAlan`ını yazmasız yapmak sahte
güvence olurdu — okuma araçları API'ye gidiyor, oradaki kopya aynı yazmayı
yapıyor. Asıl çözüm ve aciliyetin düşük olma gerekçesi TODO'da.

### Doğrulama

**485 test** (473 → 485: 12 yeni). **Mutasyon on bir yönde koşuldu ve ilk
turda üç sorun çıkardı:**

- İki mutasyon **kaçtı**: yapısal test `assignees_membership_unknown` ve
  `available_tools` adlarını dosyada düz metin olarak arıyordu. Ama bu adlar
  aracın açıklama dizesinde de geçiyor; kod silinse bile açıklama testi
  geçiriyordu. Yorum tuzağının dize biçimi. Desenler kod biçimine
  (`anahtar: değer`) daraltıldı, ikisi de yakalandı.
- Bir mutasyon **yanlış yeri vurdu**: aynı satır `lookupSlug`ta da var ve
  çapa önce oraya düştü. "Yakalandı" görünüyordu ama başka işlev için; çapa
  düzeltilip yeniden koşuldu.
- Açılış uyarısını hiçbir test korumuyordu; yapısal test eklendi.

Son durum: **on bir mutasyonun on biri, doğru yerde yakalanıyor.**

**Yerel tarama (yerel sunucu, canlı veritabanı): 79 geçti, 0 kaldı, 1 atlandı.**
İki yeni kontrolün ikisi de gerçek veriyle koştu: `efe-kapan-1` #5 ve #6'da
işaretli, `get_task` aynı işareti taşıyor; `whoami`nin araç listesi
`tools/list` ile birebir.

Ortam notu: taramadan sonra `npm start` kabuğu durduruldu ama Windows'ta
`node src/index.js` süreci 5000 portunu tutmaya devam etti; süreç kimliği ve
komut satırı doğrulanıp elle kapatıldı.

### MCP'de kalanlar

1. **Kişinin kendi MCP anahtarını alabilmesi** — asıl büyük iş. Bugün her yeni
   kişi için Railway'de ortam değişkeni elle düzenleniyor; Eray ayrıldıktan
   sonra bu, Railway erişimi olan tek kişiye bağımlılık demek. Şema (anahtar
   tablosu, özetle saklama, iptal) ve GUVENLIK.md eleği gerekiyor.
2. **Sayfalama** — en büyük liste 17 kart; veri büyüyünce.
3. **`updated_at`** — şema değişikliği, doldurma kararı bekliyor.
4. **`my_open_tasks`** — iki hafta gerçek kullanımdan sonra.
5. **Etiket korunmasının canlı denemesi** — `ghghhg`e iki etiket tanımlanınca.

---

## 0-U. 13 Eylül, öğleden sonra — alt görevin tek kaynağı, ilerlemenin tek kuralı

0-T'de bulunan iki kaynak aynı gün kapandı. Karar ve gerekçe `lib/checklist.js`
dosyasının başında; burada yalnızca ne yapıldığı ve nasıl doğrulandığı.

### Ne değişti

- **Çekmece** yapılacaklar listesini `subtasks_detail`'den okuyor, alt görev
  uçlarına yazıyor (ekle / işaretle / yeniden adlandır / sil) ve kartı
  sunucudan tazeliyor. `doc`taki `checklist` blokları çizilmiyor.
- **Sunucu** liste taşıyan `doc`'u `err_doc_checklist_retired` ile REDDEDİYOR;
  serileştirici `doc`a liste bloğu üretmiyor. İkinci kaynağın doğum yeri
  buydu: serileştiricinin ürettiği blok, açıklama düzenlenince `doc` olarak
  geri saklanıyordu.
- **İlerleme tek üreticide** (`ilerlemeHesapla`): bitmiş kolon 100, değilse
  alt görev oranı, alt görev yoksa 0. `recalcTaskProgress` her zaman yazıyor
  ve kolon taşımasından sonra da çağrılıyor; PATCH gövdedeki `progress`'i
  okumuyor; pano liste görünümü yüzdeyi kendisi hesaplamayı bıraktı.
- MCP **0.5.2**: üç açıklama kurala göre; `get_task`in `doc`u liste taşımıyor.

### Göç — canlıda uygulandı

`scripts/altgorev-gocu.js`, önce DENEME kipinde gösterilip Eray'ın onayıyla:

- **8 kart birleşti.** 10 yeni alt görev satırı (#11 dört, #42 ve #109 ikişer,
  #13 ve #40 birer), 1 işaret düzeltmesi (#19: tablo "yapılmadı" → "yapıldı",
  çünkü `doc` saklıyken kullanıcının gördüğü oydu), #4 ve #18'de yalnızca
  `doc` temizliği. Hiçbir satır silinmedi.
- **19 kartın ilerlemesi kurala geldi.** 6 kart 100 → 0 (#1, #9, #12, #14
  alt görevsiz ve bitmemiş kolonda; #13 tek alt görevi işaretsiz; #114 çöpte);
  13 kart bitmiş kolonda 0 → 100 (çoğu 10 Eylül'deki `is_done` düzeltmesinden
  önce taşınmış, ilerlemesi hiç yazılmamış kartlar).
- Toplam 26 kart, kart başına bir işlem. **Yedek:** ev makinesinde
  `%TEMP%\altgorev-gocu-yedek-2026-09-13T13-47-28-278Z.json` (her kartın eski
  `doc`, `progress` ve alt görev satırları). Geçici dizinde duruyor, yani
  işletim sistemi temizleyebilir; kalıcı saklanacaksa taşınmalı.
- Hemen ardından ikinci DENEME: "yapılacak bir şey yok". Liste taşıyan `doc`
  8 → 0, alt görevli kart 41 → 44.

**Sıra bilerek göç → dağıtım → ikinci koşu.** Tersi veri kaybı riski
taşıyordu: yeni çekmece `doc`'u listesiz kaydeder, göç o kartı henüz
taşımadıysa liste kaybolurdu. Göç önce koşunca aradaki birkaç dakikalık
pencerenin tek riski eski arayüzün `doc`a yeniden liste yazması; ikinci koşu
onu yakalar.

### Testler ve mutasyon

`test/altgorev.test.js`: 25 test, 448 → 473. Vakalar gerçek kartlardan.
Tarama katmanı ikinci kaynağın ve ikinci üreticinin geri dönüşünü kilitliyor.
**On bir mutasyonun on biri yakalandı.** Yol boyunca üç düzeltme:
bir mutasyonun çapası tutmadı (kaçmış sayılmadı, yeniden koşuldu); "uçlar
ilerlemeyi elle yazmıyor" taraması eski kodun tam kullandığı kısaltmalı
`{ progress }` biçimini görmüyordu; dil testi istemcideki `'Alt görevler'`
eşleştirme sabitini çevrilmemiş metin saydı — başlık temizliği sunucunun işi
olduğu için istemciden kaldırıldı.

### Dağıtımdan sonra

`4382b1a` iki depoya da gitti (kanca iki kez yeşil). Canlı tarama
`initialize → stoaboard 0.5.2`, 77 geçti / 0 kaldı / 1 atlandı. Göçün
dağıtım sonrası ikinci DENEME koşusu: "yapılacak bir şey yok". MCP'den okundu:
#11 `subtasks` "3/4", ilerleme 75, `doc` listesiz; #19 "1/1" yapıldı,
ilerleme 100, `doc` listesiz — 0-T'deki üç hikâye tek hikâye.

Yan gözlem (göçten bağımsız, TODO'da): #19'un `desc` alanı "Açıklama
ttakcviöm Alt görevler". `PATCH` doc → açıklama senkronu başlık metinlerini de
açıklamaya katıyor.

### Tarayıcı denemesi — önce eski sekme, sonra yeni kod

Yerel `server/.env` canlı veritabanını gösterdiği için arayüz buradan
denenmedi; Eray canlıda denedi (deneme kartı #115, "Ana Proje").

**İlk tur, dağıtımdan önce açılmış sekmeyle:** ekle, işaretle, yeniden
adlandır, sil — dördü de `err_doc_checklist_retired` aldı. Beklenen buydu:
eski çekmece listeyi hâlâ `doc`a yazıyordu. Veritabanından doğrulandı,
reddedilen yol **hiçbir şey yazmadı** (#115'in `doc`u listesiz). Canlı paket
de ayrıca indirilip tarandı: `index-CHnGTU9h.js` yeni kodu taşıyor
(`renameSubtask` var, `kind:"checklist"` yok) — sorun sitede değil sekmedeydi.

**F5'ten sonra dört işlem de uyarısız geçti.**

Bu tur ret-yerine-ayıklama kararını sahada doğruladı. Sunucu sessizce
ayıklasaydı dört işlem de "başarılı" görünecek, eklenen maddeler hata
vermeden kaybolacaktı. Ret mesajı "sayfayı yenileyin" dedi, kullanıcı yeniledi,
düzeldi.

### Yoldan çıkan üç ders (TODO'da)

1. **Eski sekmede yeni hata kodu çevrilemiyor.** Uyarı İngilizce arayüzde
   Türkçe çıktı: eski paketin sözlüğünde `err_doc_checklist_retired` yok,
   `apiFetch` sunucunun Türkçe `message`ına düştü. Eski sekmeye gitmesi
   beklenen hatalarda mesaj sunucuda `reqLang(req)` ile kurulmalı — o başlığı
   eski paket de gönderiyor.
2. **Açık sekme dağıtımı fark etmiyor.** SPA sayfayı yeniden yüklemediği için
   dağıtımdan önce açılan sekme saatlerce eski kodla çalışabiliyor. Bu kez ret
   mesajı kurtardı; bir sonraki uyumsuz değişiklikte kurtarmayabilir.
3. **`index.html` `Cache-Control` başlığı taşımıyor** (yalnızca zayıf ETag).
   Bugün F5 yetti, ama önbellek davranışı tarayıcının tahminine kalmış.

Yan gözlem: #115'in açıklaması "Açıklama ASDASDAS" — doc → açıklama
senkronundaki başlık kusuru (TODO) yeni kartlarda da oluşuyor, yalnızca eski
veride değil.

---

## 0-T. 13 Eylül, öğlen — 0.5.0 canlı doğrulaması ve 0.5.1

Önce dağıtımın indiği kanıtlandı (canlı tarama `initialize → stoaboard
0.5.0`, 77 geçti / 0 kaldı / 2 atlandı), sonra Cowork'e yeni sohbette 38
adımlık bir deneme verildi. Bütün yazmalar deneme kartı #114'e; başka kartlara
yalnızca okuma.

### Geçenler

Alt görev ekle / işaretle / yeniden adlandır / sil, ilerleme 0 → 50 → 100;
aitlik kapısı **gerçek** bir yabancı alt görev kimliğiyle (#19'un 10
numarası, değer değişmeyecek biçimde çağrıldı) → `err_mcp_subtask_not_found`
ve #19 dokunulmamış; çöpe at → listeden düştü, ghghhg `open` 1 → 0; ikinci
silme `already_trashed` ve **`deleted_at` birebir aynı** (30 günlük sayaç
tazelenmiyor); geri al → yorum, atanan, tarih, kolon yerinde; alan 1 → 4 →
409 → 1.

**Denetim kaydı veritabanından okundu:** on bir gerçek yazma için on bir
`mcp.*` satırı. İşlem yapmayan çağrılar (`already_trashed`, `already_active`,
`switched=false`) ve reddedilenler **hiç satır bırakmadı**; alt görev metni
hiçbir satırda yok.

**Denenemeyen:** "etiket eklemek öbürünü silmiyor" iddiası — ghghhg'de hiç
etiket tanımlı değil. Bir sonraki denemede önce iki etiket tanımlanmalı.

### 0.5.1 — iki yüzey kusuru

1. **Açıklamalar çelişiyordu.** `list_workspaces` "Alanı DEĞİŞTİREMEZSİN",
   `create_task` ve 409 mesajı "tarayıcıda değiştirmesini iste" diyordu;
   araç 0.5.0'da gelmişti. Cowork çelişkiyi raporladı. Test: çalışma alanını
   değiştirmekten söz eden her metin `set_active_workspace`'i anmalı.
   Testin ilk hâli yanlış pozitif verdi — `update_task`'in "görevin
   **alanlarını** değiştirir" cümlesi (alan = field); desen tekil biçimlere
   daraltıldı.
2. **Geçiş yanıtı eski alanı gösteriyordu** (`workspace` = `previous`).
   `aktifAlan(user)` istek başında yüklenen nesneyi okuyordu. Kullanıcı satırı
   geçişten sonra yeniden okunuyor. Tarama bunu göremezdi: bu aracın yalnızca
   reddetme yolunu koşuyor, çünkü başarı yolu tarayıcıdaki alanı değiştiriyor.

Mutasyon dört yönde koşuldu (üç metin ayrı ayrı eski hâline, bağlam bayat
nesneye), **dördü de yakalandı.** 446 → 448 test.

### Taramanın sessiz atlaması

#114 bitmemiş hâlde çöpe atıldıktan sonra tarama yeniden koşuldu ve "çöpte
bitmemiş kart yok" deyip kontrolü **yine atladı.** Sebep veri değil sorgu:
86 kolonun 53'ünde `is_done` NULL, sorgu `NOT isDone = true` idi ve SQL'de
`NOT (NULL = true)` satırı eler. Veritabanında ölçüldü: çöpte 1 kart, eski
sorgu 0, düzeltilmiş sorgu 1. Ürün kodu kolonu olumlu eşleştirdiği için
etkilenmiyor. Sütunun kendisi TODO'da (`NOT NULL DEFAULT false`).

### Asıl bulgu: alt görevin iki kaynağı

Cowork #19'da `subtasks_detail` ile `doc.checklist`'in çeliştiğini fark etti.
Kök sebep MCP'den eski: çekmecedeki "Yapılacaklar" listeyi `task.doc`'a yazıp
ilerlemeyi kendisi hesaplıyor; kart açma penceresi ve MCP `subtasks`
tablosuna yazıyor. Ölçüm ve karar TODO'da. 0.5.0 bu yüzden **saklı `doc`'lu
kartta** görünmez alt görev yazabiliyor — #114'te sorun çıkmamasının tek
sebebi `doc`'unun hiç saklanmamış olması.

Ara kapı (MCP'nin o kartlarda reddetmesi) **bilerek yazılmadı**: asıl onarım
hemen ardından geliyor ve bir sonraki commit'te silinecek bir kapı, kapattığı
riskten (bugün yalnızca Eray'ın Cowork'ü yazıyor) pahalı.

### Deneme sonrası durum

#114 çöpte, bitmemiş, alt görevsiz ve **ilerlemesi %100** — son alt görev
silinince ilerleme donuyor (TODO, karar verildi). Aktif alan StoaBoard (1).
`efe-kapan-1` hâlâ #5 ve #6'da atanan (TODO'daki yetim slug maddesi canlı
veriyle doğrulandı).

---

## 0-S. 13 Eylül, gece — MCP 0.5.0: yazma araçları tamamlandı

"MCP'yi bitirelim" denince kapsam TODO'daki `[~]` maddesiydi: 3. adımın eksik
dört parçası — **silme, etiket, alt görev, alan değiştirme**. Hepsi kapandı.
Yirmi araç, onu yazıyor.

Ayrıntılı sürüm notu **MCP-SURUMLER.md 0.5.0**'da; burada yalnızca kararlar ve
doğrulama.

### Üç karar

**Silme çöpe taşımadır.** API'de `/permanent` ucu var ama MCP yüzeyine
çıkmadı: modele geri dönüşü olmayan bir yetki vermek yanlış olurdu. Karşılığı
`restore_task` ile birlikte geldi, yani silme yetkisinin geri dönüşü var.
Kural teste bağlı: hiçbir araç `/permanent` çağıramaz.

**Etiket tam liste değil, ekle/çıkar.** API `labels` alanını alınca hepsini
silip yeniden kuruyor; tam liste isteyen bir araç "bir etiket ekle" niyetini
öbür etiketleri silmeye çevirirdi — 0.4.0'da atananlar için çözülen kusurun
aynısı, aynı yardımcıyla (`atamaListesi`) çözüldü. Bilinmeyen slug da sessizce
yutulmuyor.

**`set_active_workspace` bilinçli bir istisna.** Aktif alan tarayıcı
oturumuyla ortak, yani bu araç kullanıcının ekranını da değiştiriyor. Mevcut
bir yapısal test onu haklı olarak reddetti ("her yazma aracı alan kapısından
geçer"); muafiyet `ALAN_KAPISIZ` listesine gerekçesiyle yazıldı — `ACIK_UCLAR`
kalıbı. Muafiyet **yalnızca** alan kapısı için; denetim kaydı ve salt-okuma
şartları ayrı bir testle bu araca da uygulanıyor.

### Testin kendisi de düzeltildi

Yazdığım üç yeni kapıyı (alt görev aitliği, etiket doğrulaması, kalıcı silme
yasağı) başlangıçta **hiçbir test korumuyordu** — yalnızca kodun içinde
duruyorlardı. Mutasyon bunu gösterdi, üçü de yapısal teste bağlandı. Bu tur
mutasyonun onay üretmediği, eksik bulduğu bir tur oldu.

### Doğrulama

441 → **446 test** (iki muafiyet testi, üç yeni kapı). **Yedi mutasyonun
yedisi de yakalandı**: alan kapısını kaldırmak, denetim kaydını düşürmek,
yazan aracı salt okuma işaretlemek, alt görev aitliğini kaldırmak, etiket
doğrulamasını kaldırmak, kalıcı silme ucunu çağırmak, ve muafiyet listesinden
aracı çıkarmak (üç test birden düştü — liste süs değil).

**Yerel tarama 0.5.0'a karşı: 77 geçti, 0 kaldı, 2 atlandı.** Yedi yeni
reddetme yolu doğru hata kodunu döndürdü, `restore_task`'ın no-op dalı
doğrulandı, ve iki güvenlik ağı tuttu: **17 → 17 kart, 8 → 8 alt görev** —
tarama hiçbir şey yazmadı. Atlanan ikisi veriye bağlı ve 0.5.0'dan önce de
atlanıyordu.

Taramadaki `YAZMA_ARACLARI` beklentisi de güncellendi (dört → on). Liste
bilerek elle tutuluyor: kaynaktan türetilseydi doğruladığı şeyi referans alır
ve kontrol boşalırdı.

### Sıradaki

1. **Dağıtım indikten sonra Cowork'te yeni sohbet** — araç listesi değişti,
   bayat sohbet yeni altı aracı görmez. `serverInfo.version` 0.5.0 diyorsa
   dağıtım inmiştir.
2. Deneme kartı #114 hâlâ `ghghhg` projesinde.
3. Kalan MCP maddeleri: `whoami`'ye `available_tools`, sayfalama, anahtar
   sayfası, yetim atanan slug'ları.

---

## 0-R. 12 Eylül, gece — `add_comment` başarı yolu canlıda doğrulandı

0.4.1 on iki gün önce çıkmıştı ama **başarı yolu hiç denenmemişti**: yazma
araçlarının reddetme dalları taranmıştı, gerçek bir yorum MCP üzerinden
yazılmamıştı. Bu akşam yazıldı.

Cowork'te (yeni sohbet — araç listesi değiştiği için bayat sohbet yeni aracı
görmez) `ghghhg` projesindeki (id 7) #114 kartına yorum eklendi: **yorum #25**,
yazar `eray-atalay`, 23:54 TR. `get_task` ile okundu: yorum sayısı 0 → 1,
`comments_list` içinde metin birebir duruyor. Yani yazma ve okuma tarafı
tutarlı.

### Cowork'ün söylemediği kısım: denetim kaydı

Asıl merak edilen buydu ve raporda yoktu, o yüzden veritabanına salt okuma
sorgusuyla bakıldı:

```
mcp.comment_added   user=Eray Atalay (#2)
                    detail={"task_id":"114","comment_id":"25"}
```

**Yorum metni hiçbir denetim satırında geçmiyor.** 0-K'da tasarlanan kural —
"denetim kaydı kim-ne-yaptı tablosudur, içerik deposu değil" — kaynakta değil
**canlıda** doğrulandı. Kaynağı zaten testler koruyordu; burada sorulan şey
üretimdeki satırın ne taşıdığıydı.

Bütün `mcp.*` izi de tutarlı okunuyor ve #114'ün hikâyesini eksiksiz
anlatıyor: `task_created` → `task_moved` (todo→doing) → `task_updated`
(title) → `comment_added`. Yanında sabahki bağlayıcı uğraşından kalan dört
`mcp.auth_failed` satırı duruyor (`anahtar sunulmadı`, `bilinmeyen anahtar`) —
başarısız kimlik denemesi de iz bırakıyor, amaç da buydu.

On dört araç, dördü yazıyor; **dördünün de başarı yolu artık canlıda
görüldü.**

### Hâlâ denenmeyen: bahsetmenin pozitif dalı

Deneme yorumunda `@` yoktu. Yani `bahsedilenleriCoz` ve üye havuzu sorgusu
canlı yolda çalışmadı; 0-J'de kapatılan kapsam kusurunun **reddetme** tarafı
testlerle kilitli ama **kabul** tarafı yalnızca birim testleriyle biliniyor.
Bilerek bırakılıyor: gerçek bir üyeyi etiketlemek ona gerçek bildirim
göndermek demek.

### İki belge ifadesi düzeltildi

DEVIR'in kendi kuralı "çelişki görürsen buna güven" olduğu için, yazıldığında
doğru olup artık yanlış olan iki ifade yerinde güncellendi: 0-K'daki "başarı
yolu denenmedi" ve 0-J'deki "canlı yol denenmedi". Kayıtlar silinmedi, üstüne
tarihli güncelleme düşüldü.

### Sıradaki

1. Deneme kartı #114 hâlâ `ghghhg` projesinde; silinmesi Eray'ın onayına bağlı.
2. Soket yolunun e-posta göndermemesi (TODO) — karar bekliyor.
3. Bildirim ucunun gerçekten gerekli olup olmadığı (istemcide çağrılmıyor).

---

## 0-Q. 12 Eylül, gece yarısı — bildirim ucu üyelik kapısından geçiyor

0-P'de metnin **nasıl** basıldığı kapandı (kaçış). Açık kalan soru **kime**
yazılabildiğiydi: `POST /api/notifications` hedef kullanıcı için yalnızca
"böyle biri var mı" diye bakıyordu. Yani kimliği doğrulanmış herhangi biri,
hiç tanımadığı birine serbest metinle bildirim gönderebiliyordu — kimlik avı
ve taciz yüzeyi. XSS kapandığı için zararsız değil, sadece daha az ağır.

Artık hedef, gönderenin **aktif çalışma alanının üyesi** olmak zorunda.

### Düzeltirken ikinci bir kusur çıktı: kullanıcı-var-mı kahini

Uç, olmayan kullanıcı için 404, var olan için 201 dönüyordu. Yani kimlik
numarası denenerek "bu kimlikte kullanıcı var mı" sorusu cevaplanabiliyordu.
GUVENLIK.md §4'ün 8. sorusu tam bunu yasaklıyor: *"Var/yok farkı bir oracle
oluşturuyor mu?"* Artık ikisi de **aynı 403'ü** alıyor; ayrım dışarıdan
görünmüyor.

### Yeni soyutlama yazılmadı

Üyelik kuralının zaten tek bir okuyucusu vardı — `usersShareWorkspace`
(`lib/workspace.js`), soket bahsetme kapısının da kullandığı fonksiyon. İkinci
bir okuyucu yazmak bu deponun tekrar eden kusuru olurdu; mevcut olan
çağrıldı. Reddetme kodu da yeni değil: `err_not_workspace_member` iki sözlükte
de zaten kayıtlıydı, yani `dil.test.js` tarafında hiçbir şey kıpırdamadı.

Bir de tip süzgeci eklendi: `user_id` metin gelirse eskiden doğrudan Prisma'ya
düşüp 500 üretirdi. `Number.isInteger` önce süzüyor ve geçersiz kimlik de
**aynı 403'e** düşüyor — kapalı başarısızlık.

### Uç zaten ölüydü, yine de silinmedi

`API.createNotification` istemcide tanımlı ama **hiçbir yerden çağrılmıyor**.
Silmek en temiz çözüm olurdu; ama bir ucu kaldırmak ürün kararıdır ve dışarıda
bir tüketicisi olup olmadığını buradan göremiyorum. Kapı kondu, silme sorusu
TODO'da açık bırakıldı.

### Doğrulama

438 → **441 test**. Dört mutasyonun **dördü de yakalandı**: kapıyı tamamen
kaldırmak (2 test düştü), `usersShareWorkspace` çağrısını düşürmek (1),
var/yok kahinini geri getirmek (1), tip süzgecini kaldırmak (1). Test
veritabanı istemiyor: uç kaynağında, yorumlar boşaltılarak doğrulanıyor —
`guvenlik.test.js`teki yerleşik kalıp.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet) — makine başı iş.
2. Deneme kartı #114 `ghghhg` projesinde duruyor.
3. Soket yolunun e-posta göndermemesi (TODO) ve bu ucun gerçekten gerekli
   olup olmadığı.

---

## 0-P. 12 Eylül, gece yarısı — bildirim metninde saklı XSS kapandı

Aranmıyordu; bir önceki turun (0-O) sözleşme testini yazarken çıktı. Bildirim
metninin okuyucularını haritalarken zincir kendini gösterdi.

### Zincir

1. `notifications.jsx:270` ve `views/dashboard.jsx:340` bildirim/etkinlik
   metnini **`dangerouslySetInnerHTML`** ile basıyor.
2. `data.jsx`teki `_fillTemplate` şablon değerlerini **kaçışsız**
   yerleştiriyordu: `tpl.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '')`.
3. Şablonlar HTML taşıyor (`<strong>{who}</strong>`) ve değerlerin **hepsi
   kullanıcı girdisi**: `preview` doğrudan sohbet mesajından
   (`text.slice(0, 80)`), `title` kart başlığından, `who` kullanıcı adından.
4. Çevrilemeyen gövde (`return raw`) hiç dokunulmadan HTML olarak basılıyordu.

Yani **sıradan bir DM'e ya da kart başlığına** yazılan
`<img src=x onerror=…>` alıcının tarayıcısında çalışıyordu — saklı XSS.
`POST /api/notifications` serbest metin kabul ettiği ve hedef kullanıcıyı
gövdeden aldığı için saldırgan kurbanı da seçebiliyordu. İstemcide hiçbir
kaçış/sanitize yardımcısı yoktu ve depoda XSS'le ilgili tek bir test de yoktu.

### Düzeltme nerede olmalı

Sunucuda temizlemek yanlış olurdu: metin depoda duruyor ve başka tüketicileri
var — e-posta kendi düz-metin temizliğini zaten yapıyor (`mailer.js`). Tehlike
**HTML olarak yorumlandığı yerde** doğuyor, düzeltme de orada.

Saf çekirdek `client/src/bildirimMetni.js` dosyasına çıkarıldı: `htmlKacir`,
`htmlCoz`, `sablonDoldur`, `bildirimMetni`, `etkinlikMetni`. React'e ve
`window`a bağlı olmadığı için `guvenlik.test.js` **gerçek fonksiyonu içe
aktarıp** sınıyor — kaynak taramasıyla değil. `data.jsx` artık yalnızca
`window.t`yi enjekte eden ince bir sarmalayıcı.

Kural: şablonun kendi etiketleri bizim ve sabit; **içeri giren her değer
kaçışlanır.** Toast düz metin gösterdiği için orada kaçış geri çözülüyor
(`htmlCoz`), yoksa kullanıcı `&lt;img&gt;` gibi varlık kodları görürdü.

### Kalıcı kapı

Tek seferlik düzeltme yetmez: aynı kusur başka bir ekranda sessizce geri
döner. `client/src` altındaki **her** `dangerouslySetInnerHTML` taranıyor ve
ya kaçışlı bir üreticiden beslenmeli ya da gerekçesiyle istisna listesinde
olmalı (`legal.jsx`in sabit `<style>` blokları). Yeni bir sink eklenirse test
kırılıyor — mutasyonla doğrulandı.

### Kendi testim de yanlıştı

İlk koşuda iki test düştü ve sebep kod değil **benim ölçütümdü**: çıktıda
`onerror=` dizgisinin yokluğunu aramıştım. O dizgi kaçışlanmış metinde de düz
metin olarak duruyor ve zararsız — `<` etkisizleştikten sonra etiket hiç
oluşamaz. Fazla katı bir iddia da kusurdur: birini olmayan bir hatanın peşine
düşürürdü. Doğru ölçüt açılı parantezin kaçışlanmış olması.

### Doğrulama

428 → **438 test**. Beş mutasyonun **beşi de yakalandı**: şablon kaçışını
kaldırmak (3 test düştü), ham gövdeyi yine doğrudan basmak (2), `htmlKacir`ın
`<` karakterini bırakması (5), kaçışsız yeni bir sink eklemek (1), etkinlik
metnini ham basmak (1). İstemci derlemesi de temiz.

### Bilerek yapılmayan, TODO'ya yazılan iki iş

1. **Soket yolu e-posta göndermiyor** — `sockets/chat.js` `createAndPush`ı
   atlıyor, dolayısıyla `dispatchEmail` o yoldan hiç çalışmıyor.
2. **`POST /api/notifications` üyelik kontrolü yapmıyor** — metin artık
   kaçışlı olduğu için XSS değil, ama istenmeyen bildirim hâlâ mümkün.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet) — makine başı iş.
2. Deneme kartı #114 `ghghhg` projesinde duruyor.
3. Yukarıdaki iki madde.

---

## 0-O. 12 Eylül, gece — bildirim metni sözleşmesi teste bağlandı

TODO'nun kendi sözleriyle "bu depoda en çok kusur çıkan alan". Altı kusur
geçmişte elle bulundu, hiçbirini bir test yakalamadı. Bu tur o alanın **en
ölçülebilir** parçasını kapattı: bildirim metninin biçimi.

### Bir üretici, üç okuyucu

`buildNotificationText(type, params)` yalnızca `JSON.stringify({type, ...params})`
üretiyor — serbest biçimli bir JSON, şeması hiçbir yerde yazılı değil. Üç ayrı
okuyucusu var ve hiçbiri ötekini görmüyor:

1. **İstemci** (`data.jsx`): `type`ten i18n anahtarı türetiyor
   (`notif_<tür>` / `activity_<tür>`), sonra çevirideki `{who}` `{task}` gibi
   yer tutucuları parametrelerle dolduruyor.
2. **E-posta** (`mailer.js`): türe göre `who`, `task`, `preview`, `col` okuyor.
3. **Akış raporu** (`throughput.js`): `task_moved` kayıtlarından `parsed.col`
   okuyup kolon **başlığıyla** eşleştiriyor.

Sessiz yanlışın mekanizması burada: `_fillTemplate` bilinmeyen yer tutucuyu
`params[k] ?? ''` ile **boş dizeye** çeviriyor. Bir parametre yeniden
adlandırılırsa cümlenin ortası sessizce boşalır — istisna yok, log yok. Anahtar
hiç yoksa kullanıcı ham JSON görüyor. `throughput` tarafında ise üretici `col`a
slug yazsa eşleşme tamamen kaçar ve rapor **sıfır dolu bir grafiğe** döner.

On bir tür, beş route dosyası ve soket işleyicisi taranarak envantere alındı;
tablo elle bakımlı değil, kaynaktan denetleniyor. Her tür için: iki dilde
anahtar var mı, şablondaki her yer tutucu üreticide gerçekten üretiliyor mu,
e-posta gövdesi gerçek üretici çıktısıyla doluyor mu.

### Mutasyon somut bir hata buldu — onay değil

İlk koşuda 46 testin 46'sı geçti ve altı mutasyonun **beşi** yakalandı.
Altıncısı kaçtı: sözleşme dışından yazılmış bir `notification.create`, hemen
ardından gelen meşru çağrının `buildNotificationText` metnini görüp aklandı.
Sebep benim yazdığım sabit **400 karakterlik pencereydi**.

Bu, `yetki.test.js`te de düşmüş olan sınıfın aynısı — DEVIR'deki ifadeyle
"pencere sonraki kaydın içine taşıyor ve korumasız bir uç, komşusunun ara
yazılımını görüp aklanıyordu". **Komşuluk, testin ölçtüğü şeyi sessizce
genişletiyor.** Üçüncü kez aynı tuzak.

Düzeltme pencereyi büyütmek değil, **hiç pencere kullanmamak**: çağrının kendi
argümanları parantez dengelenerek çıkarılıyor (dize içindeki parantezler
atlanarak). Sonra altı mutasyonun altısı da yakalandı.

### Bilerek değiştirilmeyen iki bulgu

Test yazarken çıktılar, ikisi de davranış değişikliği gerektiriyor ve karar
senin:

1. **Soket yolu `createAndPush`i atlıyor.** `sockets/chat.js` bildirimi
   doğrudan `prisma.notification.create` ile yazıyor — metin sözleşmesine
   uyuyor (iyi), ama e-posta gönderimi o yoldan hiç çalışmıyor. Yani HTTP
   sohbet ucundan gelen bir bahsetme e-posta üretirken soketten gelen
   üretmiyor. Asimetri sessiz.
2. **`POST /api/notifications` gövdeden gelen metni doğrudan yazıyor** ve
   hedef kullanıcı için yalnızca "var mı" kontrolü yapıyor — üyelik ya da
   alan kontrolü yok. Kimliği doğrulanmış herhangi biri, herhangi bir
   kullanıcıya istediği metinle bildirim gönderebiliyor. Test bunu
   `SERBEST_METIN` muafiyet listesine gerekçesiyle yazarak **görünür** kıldı
   (`ACIK_UCLAR` kalıbı); ikinci bir serbest-metin yolu listeye yazılmadan
   eklenemiyor.

**Kapsam dışı bırakılan:** okundu durumu. TODO maddesi onu da istiyor ama
"bildirim okundu bilgisi sunucuya hiç yazılmıyor" ayrı bir **açık kusur**
maddesi; saf fonksiyona indirmek üretim davranışını değiştirmek demek. Madde
bu yüzden `[~]` (kısmi) işaretlendi.

### Doğrulama

382 → **428 test**, hepsi geçiyor. Altı mutasyon, altısı da yakalandı
(pencere düzeltmesinden sonra): üretici parametresini yeniden adlandırmak,
sözlükte karşılığı olmayan yeni tür eklemek, `task_moved`a slug yazmak,
istemci sözlüğünden bir anahtarı silmek, şablona üretilmeyen bir yer tutucu
koymak, ve sözleşme dışından serbest metinle bildirim yazmak.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet) — makine başı iş.
2. Deneme kartı #114 `ghghhg` projesinde duruyor.
3. Yukarıdaki iki bulgu karar bekliyor (soket e-posta asimetrisi, serbest
   metin ucunun üyelik kontrolü).

---

## 0-N. 12 Eylül, akşam — yetki taramasının kapsamı kaynaktan türetiliyor

TODO'nun küçük maddesi: "`yetki.test.js` yalnızca `routes/` ve `sockets/`
tarıyor." Küçük görünüyordu; bakınca **fiilî** bir kör nokta çıktı.

`app.js:189`'da gerçek bir uç var — `app.get('/', ...)`. Taramanın deseni
`(\w*[Rr]outer)\.(get|post|…)` olduğu için `app.get(` yapısal olarak
görünmüyordu. Yani "her uç kimlik doğrulamasından geçer" testi, bir ucu hiç
görmeden yeşil kalıyordu. O uç bugün meşru biçimde açık (SPA kökü — giriş
yapmamış kullanıcı da giriş ekranını almalı), ama karar hiçbir yerde görünür
değildi. Artık `ACIK_UCLAR`da gerekçesiyle duruyor.

### Asıl kusur listenin kendisiydi

Kapsam elle bakımlıydı: iki dizin adı testin içinde sabit. Yeni bir dizine uç
eklense ya da bir router taşınsa tarama onu görmez ve üstteki testler
**sessizce** geçerdi — koruma kalktığı hâlde yeşil kalırlardı. Deponun tekrar
eden kusuru: **doğrulayanın kapsamı, doğruladığı şeyden bağımsız
daralabiliyor.**

Kapsam artık kaynaktan türetiliyor. `app.js` neyi mount ediyorsa tarama onu
görmek zorunda; liste bayatlayamaz, çünkü liste yok. Dört kapı:

1. `app.js`'te router taşıyan her import `./routes/` altından gelmeli.
2. `index.js`'te soket işleyicisi taşıyan her import `./sockets/` altından.
3. Mount edilen her `routes/` dosyasında tarama **en az bir uç** bulmalı —
   router adlandırması desene uymazsa o dosyanın tamamı denetimsiz kalırdı.
4. `app.js` de taranıyor; oradaki uçlar `ACIK_UCLAR`a gerekçesiyle yazılmak
   zorunda.

`app.get('io')` tuzağı ayrıca eleniyor: Express'te `app.get` hem uç tanımı
hem **ayar okuması**. Uç yolları `/` ile başlıyor; başlamayan eşleşme hayalet
uç sayılmıyor.

### Doğrulama

378 → **382 test**, hepsi geçiyor. Beş mutasyon denendi, **beşi de
yakalandı**: `routes/` dışından router mount etmek, `sockets/` dışından soket
işleyicisi kaydetmek, `app.js GET /` girdisini `ACIK_UCLAR`dan çıkarmak,
`app.js`e korumasız yeni bir uç eklemek, ve mount edilen bir dosyada router
adını desene uymaz hâle getirmek. Son ikisi taramanın `app.js`'i gerçekten
gördüğünü kanıtlıyor.

**Kapanmayan sınıf aynı yerde duruyor:** bir ucun kapsamlamasının *doğru*
olup olmadığı hâlâ test edilmiyor (TODO'daki "Uç testleri" maddesi). O iş
supertest benzeri bir koşum + oturum/veritabanı taklidi istiyor; statik
tarama denenmiş ve 70 mutasyon ucunun 46'sı yanlış pozitif çıktığı için
bilinçli olarak bırakılmıştı. Bu tur o kararı değiştirmiyor.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet) — makine başı iş.
2. Deneme kartı #114 `ghghhg` projesinde duruyor.
3. Bildirimler test altına alınmalı — TODO'nun en değerli açık maddesi
   ("bu depoda en çok kusur çıkan alan").

---

## 0-M. 12 Eylül, öğleden sonra — serileştirici sözleşmeleri teste bağlandı

TODO'nun üçüncü maddesi kapandı, ama **istenenden farklı bir biçimde** —
çünkü istenen hâli yetmiyordu.

Madde şöyleydi: "her `*ToDict` fonksiyonunun ürettiği alan kümesini teste
sabitle". Gerekçe doğruydu; aynı kusur iki gün üst üste, iki ayrı yerde
çıkmıştı: `columnToDict` kolonun slug'ını `id` adıyla veriyor, tüketici
`.slug` diye arayıp `undefined` alıyordu (9 Eylül MCP araçları, 10 Eylül
`weeklyDone` hep sıfır). Ama önerilen çözüm o iki kusurun **hiçbirini
yakalamazdı**: `columnToDict` hep böyle yazıyordu, üretici hiç değişmedi.
Alan kümesini dondurmak yalnızca "yeniden adlandırıldı / eklendi / silindi"
sınıfını yakalar; buradaki kusur sözleşmenin **iki tarafı arasında** ve
üretici tarafı kusursuz görünüyor.

### Asıl dikiş nerede

`routes/mcp.js` bitiş kolonu kümesini şöyle kuruyor:

```js
new Set(kolonlar.filter((c) => c.is_done).map((c) => c.id))
```

`mcpShape.js` ise şöyle soruyor:

```js
bitisKolonlari.has(gorev.col)
```

Biri `columnToDict().id`, öteki `taskToDict().col`. Bugün örtüşüyorlar
**çünkü ikisi de kolonun slug'ı**. Biri "düzeltilip" `id` sayısal yapılsa
küme sayılarla dolar, `has(slug)` hep `false` döner ve **her kart açık
görünür** — tek bir test kırılmadan. `weeklyDone` hep sıfır kusuru bu dikişin
öbür ucuydu.

Testler bunu göremiyordu, çünkü `mcp.test.js` tüketiciyi **elle yazılmış**
sözlüklerle besliyor: testin uydurduğu girdide `slug` vardı, üretici onu hiç
yazmıyordu. **Uydurulan girdi, uydurulan sözleşmedir.**

### Ne yazıldı

`test/sozlesme.test.js` — 33 test, üç katman:

1. **Üretici şekil kilidi.** On sekiz serileştiricinin alan kümesi sabit.
   Tablo elle bakımlı değil: `src/lib` taranıyor (yorumlar boşaltılarak) ve
   tabloda karşılığı olmayan yeni bir serileştirici testi kırıyor — liste
   bayatlayamıyor.
2. **Dikiş.** Tüketiciler (`gorevOzeti`, `gorevDetayi`, `acikMi`, `uyeOzeti`,
   `notOzeti`) artık **gerçek üretici çıktısıyla** besleniyor. Sahte Prisma
   kaydı taklit ediliyor, serileştirici çıktısı değil.
3. **Kimlik anlamları.** `id` bu depoda üç ayrı şey demek ve karışması gerçek
   kusur üretti: slug taşıyanlar (`columnToDict`, `userToDict`,
   `channelToDict`), metne çevrilmiş sayı (`projectToDict`, `taskToDict`,
   `notificationToDict`, `auditToDict`), ham sayı (`noteToDict`,
   `subtaskToDict`, `commentToDict`). Üçü de kilitli.

Yan kazanç: `mcp.test.js`teki "`updated_ago` düşürülüyor" testi **boş
geçebilir** durumdaydı — üretici o alanı yazmayı bıraksa test hiçbir şey
ölçmeden geçmeye devam ederdi. Artık alanın üreticide varlığı ayrıca
doğrulanıyor.

### Doğrulama

345 → **378 test**, hepsi geçiyor. Yedi mutasyon denendi, **yedisi de
yakalandı**: `columnToDict` id'sini sayısal yapmak (5 test düştü),
`userToDict` id'sini sayısallaştırmak (2), `taskToDict.col`u kolon kimliğine
çevirmek (3), `noteToDict`ten `updated_ago` silmek (2), `projectToDict`
id'sini metne çevirmemek (1), `taskToDict`e alan eklemek (2), tabloya
yazılmamış yeni bir serileştirici eklemek (1). İlk üçü tarihsel kusurun ta
kendisi.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet) — hâlâ açık, makine başı iş.
2. Deneme kartı #114 `ghghhg` projesinde duruyor.
3. TODO'da kalanlar: MCP'de silme/etiket/alt görev, `updated_at` şema kararı,
   sayfalama, anahtar sayfası.

---

## 0-L. 12 Eylül, öğle — kaynağı tarayan testler tek bir yorum tarayıcısında birleşti

Yeni özellik yok; bu tur bir **doğrulama borcu** kapattı. TODO'daki madde
"`dil.test.js` ve `yetki.test.js` tarayıcıları yorumları silmiyor" diyordu.
Bakınca sorun daha genişti: "yorum nedir" sorusunun depoda **üç ayrı cevabı**
vardı ve üçü de farklı şeyi kaçırıyordu.

1. `satir.trim().startsWith('//')` — beş yerde. Satır ortasında başlayan
   yorumu ve blok yorumunun içini görmüyor.
2. `.replace(/\/\*...\*\//g, '')` + satır silme — beş yerde. Yorum satırlarını
   **sildiği** için satır numaralarını kaydırıyor; `dosya:satır` bildiren bir
   taramada kullanılamaz.
3. `dil.test.js` içindeki karakter tarayıcısı — doğru yaklaşım, ama tek
   dosyada hapis ve iki kör noktası var.

Bu, CLAUDE.md'de adı konmuş kusur sınıfının ta kendisi: **aynı olgunun birden
çok okuyucusu**. Tarayıcı `test/yardimcilar.js` içine çıkarıldı, on iki çağrı
yeri (beş test dosyası) ona bağlandı. `kontrast.test.js` bilerek dışarıda:
CSS tarıyor ve JS biçimli bir tarayıcının stil sayfasında işi yok.

### Ölçüldü, varsayılmadı — ölçüm üç kör nokta buldu

Tarayıcı taşınmadan önce gerçek kaynak kümesine karşı koşuldu. Mevcut hâli
`server/src` içinde **7**, `client/src` içinde **9** yorum satırını
boşaltamıyordu. Yani dil taraması bugün de kör bir tarayıcıyla çalışıyordu;
yalnızca henüz yanlış bir sonuca yol açmamıştı. Üç sebep:

- **Tırnak taşıyan düzenli ifade.** `csv.js`teki `/[";\n\r]/` ve
  `notes.js`teki ters tırnaklı sınıf, tarayıcıya sahte bir dize açtırıyor;
  o noktadan sonraki yorumlar hiç boşalmıyordu.
- **JSX metnindeki Türkçe kesme işareti.** `Claude'un`, `Chat'e` — aynı sahte
  dize. Çözüm dilin kendi kuralı: tek/çift tırnaklı dize ham satır sonu
  taşıyamaz, taşıyor görünüyorsa o tırnak dize açmıyordur.
- **Şablon dizesi içindeki `${...}`.** `data.jsx:222`deki yorum, şablonun
  tamamı opak sanıldığı için hiç görülmüyordu.

Üçü de tarayıcıya öğretildi; iki ağaçta da sayı **sıfır**. Ölçüm bir kerelik
kalmasın diye `yardimcilar.test.js` bunu her koşuda yeniden yapıyor: bütün
sunucu ve istemci kaynaklarını tarıyor, boşalmamış tek bir yorum satırı
bırakmıyor. Yeni yazılan bir kaynak tarayıcıyı kör ederse test kırılır —
kural belgede değil, doğrulayanda.

### Bir davranış değişikliği, bir yerde ödendi

Yorumlar artık silinmiyor, **boşluğa çevriliyor**; uzunluk ve satır
değişmezleri korunuyor, böylece `m.index` ve `dosya:satır` hesapları geçerli
kalıyor. Bedeli sabit boyutlu pencerelerde çıktı: `mcp.test.js`teki 400
karakterlik pencere, `projects.js`te sayım ile `deletedAt: null` arasındaki
yedi satırlık yorum yüzünden koda ulaşamaz oldu ve test **düştü**. Ölçüt
zaten "sonraki 400 karakter KOD"du; artık öyle yazılıyor (boşluk
sıkıştırılarak) ve yorum hacminden bağımsız. Taranan bütün sabit pencereler
denetlendi — sessizce zayıflamış başka yer yok.

### `catch {}` kuralı iki kaynağa birden bakıyor

Boş catch taramasında yorumun **iki ayrı rolü** var ve naif bir geçiş birini
bozardı. Yorumun İÇİNDEKİ `catch {}` bulgu değildir (emit.js kusuru
anlatırken kalıbı yazıyor); ama bloğun İÇİNDEKİ yorum ihlali **aklar** —
açıklamalı boş catch bilerek serbest. Boşaltılmış satırda
`catch { /* sebep */ }` gerçek bir boş catch'e dönüşür ve meşru kod bulgu
sayılırdı. Bu yüzden kural iki kaynağa bakıyor: **ham** satır "boş mu"
sorusuna, **boşaltılmış** satır "gerçek kod mu" sorusuna cevap veriyor.

### Doğrulama

Test sayısı 333 → **345**; on iki yeni testin hepsi tarayıcının kendisi için.
Mutasyon **iki yönlü** koşuldu: beş tarayıcının her birine aynı ihlal önce
kod, sonra `//`, sonra `/* */` biçiminde enjekte edildi — 15 denemenin 15'i
beklendiği gibi (kod düştü, yorum geçti). Tek yönlü deneme yanıltırdı:
hiçbir şey görmeyen bir tarayıcı da "yorumu görmedi" testini geçer. On
altıncı deneme, meşru `catch { /* sebep */ }`ın hâlâ serbest olduğunu
doğruluyor.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet) — hâlâ açık.
2. Deneme kartı #114 `ghghhg` projesinde duruyor.
3. TODO'da kalanlar: MCP'de silme/etiket/alt görev, `updated_at` şema kararı,
   sayfalama, anahtar sayfası.

---

## 0-K. 12 Eylül, sabah — MCP 0.4.1: `add_comment`

Dördüncü yazma aracı. 0.4.0'da bilinçli olarak dışarıda bırakılmıştı, çünkü
kart yorumundaki `@bahsetme` alıcıyı bütün platformda arıyordu; o kapandı
(0-J) ve araç onun üstüne geldi. On dört araç, dördü yazıyor.

**Yeni kural yok — miras alınan üç kapı:** aktif alan (`workspace_id`
zorunlu, uyuşmazlıkta 409), görev aktif alanda mı (`aktifGorev`; değilse
olmayanla aynı 404), API'nin kendi kapıları. Denetim kaydı
`mcp.comment_added`, ayrıntıda yalnızca görev ve yorum kimliği —
**yorum metni yazılmıyor.**

**Açıklamada iki uyarı var, ikisi de modelin yanlış yapabileceği şeyler
için:** `@ad` yalnızca alan üyesine ve ad tek bir üyeye uyuyorsa bildirim
gönderir; araç **tekrarlanabilir değildir** (`idempotentHint: false`), aynı
çağrı iki kez yapılırsa iki yorum oluşur.

### Doğrulamanın asıl kazancı: yeni test yazılmadı

`add_comment` için **tek bir yeni test yazılmadı** ve yine de dört mutasyonun
dördü yakalandı: alan kapısını kaldır, görev kapısını kaldır, denetim kaydını
sil, aracı salt okuma diye işaretle. Sebep, 0.4.0'da kuralın belgeye değil
**doğrulayana** yazılmış olması: taramalar "her yazma aracı" diye konuşuyor,
yeni araç kendiliğinden kapsama giriyor. Test sayısı 333'te sabit kaldı.

Yerel tarama 0.4.1'e karşı **66 geçti, 0 kaldı, 2 atlandı** — iki yeni
reddetme denemesiyle (yanlış alan 409, olmayan görev 404).

**Denenmeyen:** başarı yolu. Gerçek bir yorum MCP üzerinden yazılmadı; bunu
Cowork'te, yeni bir sohbette denemek gerekiyor (araç listesi değişti).
Bahsetmenin pozitif dalı da denenmedi — gerçek bir üyeyi etiketlemek ona
gerçek bildirim göndermek demek.

> **Güncelleme (12 Eylül gecesi — 0-R):** başarı yolu denendi ve geçti. #114
> kartına MCP üzerinden yorum yazıldı (yorum #25) ve denetim kaydının
> kimlik-yalnızca olduğu canlıda doğrulandı. Bahsetmenin pozitif dalı **hâlâ
> denenmedi**: deneme metninde `@` yoktu.

### Sıradaki

1. Cowork'te `add_comment` denemesi (yeni sohbet).
2. Deneme kartı #114 hâlâ `ghghhg` projesinde duruyor.
3. TODO'da kalanlar: MCP'de silme/etiket/alt görev, `updated_at` şema kararı,
   sayfalama, anahtar sayfası.

---

## 0-J. 12 Eylül, sabah — kart yorumundaki `@bahsetme` kapsamı daraldı

**Kusur:** `POST /tasks/:id/comments` bahsedilen kişiyi
`user.findFirst({ name: { startsWith, insensitive } })` ile **bütün
platformda** arıyor ve ilk eşleşene bildirim gönderiyordu. "@Ali" yazan bir
üye, başka bir şirketteki adı Ali ile başlayan birine yorumun ilk 80
karakterini sızdırabiliyordu. Atama açığıyla (0-G) aynı sınıf: kapsamı
daraltmayan arama. Sohbetteki bahsetme 2 Eylül'de `mentionAllowed` ile
kapatılmıştı, kart yorumu o turun dışında kalmış.

**Kural:** bahsedilen kişi **kartın alanının üyeleri** arasında aranıyor.
Arama anlamı korundu (ad öneki, büyük/küçük harf ayrımsız, Türkçe i/ı
katlamalı); yalnızca havuz daraldı. Karar saf ve veritabanısız:
`lib/mentions.js`.

**Belirsizlik sessizce çözülmüyor.** "@Efe" iki üyeye uyuyorsa kimseye
bildirim gitmiyor — yanlış kişiye göndermek hiç göndermemekten kötü. Ama
sessiz de kalmıyor: çözülemeyen ve belirsiz kalan adlar sunucu günlüğüne
`console.warn` ile yazılıyor (yorum metni değil, yalnızca ad). Yorumun kendisi
her durumda kaydediliyor; bahsetme çözülemedi diye kullanıcının yazdığını
reddetmek orantısız olurdu.

**Yanıt sözleşmesine dokunulmadı.** Bahsetme bilgisini yanıta eklemek ilk
tasarımdı, sonra vazgeçildi: `drawer.jsx` yanıtı doğrudan `comments_list`in
içine koyuyor, yani fazladan alanlar kart yorumu nesnesine sızardı.

**Bildirim metni bilerek JSON'a çevrilmedi.** `renderNotification`ın
switch'inde `mention` diye bir dal **yok**; `type: 'mention'` yalnızca JSON
olmayan düz metin dalından üretiliyor. `buildNotificationText('mention', …)`
yazsaydık `default`a düşer ve **gövdesi boş** bildirim çıkardı. Elle kurulan
metin kaldı, sebebi koda yazıldı.

### Doğrulama — ve kaçan mutasyon

12 yeni test, toplam **333**. Altı mutasyon denendi: platform geneli aramayı
geri getir, kapıyı yoruma al, üye havuzunu bütün kullanıcılardan çek,
belirsizlikte ilk adayı seç, harf katlamasını kaldır, kimlik elemesini sil.

**Altıncısı ilk turda KAÇTI** ve dersi kayda değer: "aynı kişi iki kez
bahsedilse bir kez bildirim alır" testi `['Eray', 'eray']` kullanıyordu ve
bunu zaten **ad** elemesi yakalıyordu; kimlik elemesi hiç çalışmıyordu. Yani
test, koruduğunu sandığı satırı korumuyordu. Farklı öneklerin aynı kişiye
çıktığı durum (`['Eray', 'Era']`) eklendi; şimdi altısı da yakalanıyor.
**Mutasyon yine testin kendisini yalanladı** — 11 Eylül'deki üç tarama
testiyle aynı hikâye.

**Denenmeyen:** canlı yol. Yeni kodda bir Prisma sorgusu var ve testler onu
göremiyor; bugün iki kez yalnızca çalışma anında görünen alan adı hatasına
takıldık (`createdAt`, `fromCol`). Gerçek bir yorum yazmadan bu doğrulanmıyor.

> **Güncelleme (12 Eylül gecesi — 0-R):** canlı yol denendi. MCP üzerinden
> yazılan gerçek bir yorum uçtan uca geçti ve çalışma anında alan adı hatası
> çıkmadı. Bahsetme dalı yine de kapsam dışı kaldı: deneme metninde `@` yoktu,
> yani üye havuzu sorgusu canlıda hiç çalışmadı.

### Sıradaki

1. Canlı yol denemesi: deneme kartı #114'e bir yorum, sonra silinmesi.
2. MCP `add_comment` aracı — kapı kapandığına göre artık açılabilir.

---

## 0-I. 12 Eylül, sabah — 0.4.0 canlıda doğrulandı, OAuth keşif ucu kapandı

**Canlı tarama:** `initialize → stoaboard 0.4.0`, on üç araç, üçü yazma.
**64 geçti, 0 kaldı, 2 atlandı** — yerel koşuyla birebir. Yazma araçlarının
dokuz reddetme yolu canlıda da doğru çalıştı; kart sayısı 16 → 16.

### Cowork uçtan uca — ilk gerçek yazma

`ghghhg` projesinde kart **#114**: `create_task` → "Yapılacak", `move_task` →
"Devam Ediyor" (`moved: true`), `update_task` → başlık. İki kapı da doğru
sebeple reddetti:

- `efe-kapan-1` ataması → 400 `err_assignee_not_member`, `invalid_assignees`
  ile. Model sessizce geçmedi ve **`efe-kapan`'ı kendiliğinden atamadı**,
  sordu.
- Mytherra'ya (workspace_id 13) kart açma denemesi → 409
  `err_mcp_workspace_mismatch`, yanıtta aktif alan.

**Veritabanından doğrulandı — denetim kaydını ilk kez gördük:** üç satır,
`mcp.task_created {task_id: 114, project_id: 7}`, `mcp.task_moved {from:
todo, to: doing}`, `mcp.task_updated {fields: [title]}`. Hepsi alan 1, IP
kayıtlı ve **içerik yok** (başlık, açıklama yazılmıyor — `audit.js`in kuralı).
Reddedilen deneme hiç satır bırakmadı: yalnızca başarılı yazma kaydediliyor.
Geçiş defterinde iki satır: `yok → Yapılacak`, `Yapılacak → Devam Ediyor`.

**`efe-kapan-1` netleşti:** alanın gerçek üyesi `efe-kapan`; `-1` ikinci bir
hesap ve kartlara atanmış. TODO'daki `uniqueSlug` teşhisi doğruydu.

### Bağlayıcı kurulumu — ve tek yönlü kapı

Bağlayıcı "needs_reconnect" gösterdi, disconnect edildi ve **geri
bağlanamadı**: "Couldn't register with StoaBoard's sign-in service". Sebep
ekrandaki **Authentication** bölümü: "Sign in now (Detected)" seçiliydi ve o
seçenek OAuth akışını şart koşuyor — StoaBoard'da OAuth sunucusu yok.

**Doğru kurulum:** Add custom connector → adres
`https://www.stoaboard.com/mcp` → **Authentication: No sign-in** → Request
headers: `x-auth-token` = anahtar (slug öneki olmadan) → **Add**. "Connect"
düğmesine basılmaz. Ardından her sohbette **+ → Connectors**'tan açılır; araç
listesi bağlantı başında çekildiği için araç yüzeyi değiştiyse yeni sohbet
gerekir.

**Tuzak:** başlıkla kimlik kurulmuş bir bağlayıcıda "disconnect" tek yönlü
kapı. Geri bağlanma OAuth'a gidiyor ve kimlik ayarları sonradan
düzenlenemiyor; tek yol kaldırıp yeniden eklemek.

### Kusur: `/.well-known/*` 200 + HTML döndürüyordu

"Detected" ibaresinin kökü bizdeydi. `/api` ile başlamayan her adres SPA
yedeğine düşüyor, yani `/.well-known/oauth-authorization-server` **200 ve
`index.html`** dönüyordu; istemci bunu "OAuth keşif ucu var" diye okudu.
Yokluk sessizce bir HTML sayfasına dönüşüyordu.

**Düzeltme:** `app.js`te SPA yedeğinden **önce** `/.well-known` için 404.
Yerel denemede dört keşif adresi de 404 + JSON, normal SPA adresleri hâlâ
200 + HTML. İki tarama testi (kapı yedekten önce mi, 404 mü) **dört
mutasyonla** sınandı — kapıyı kaldır, yedekten sonraya taşı, yoruma al, 404
yerine 200 döndür — dördü de yakalandı.

### Sıradaki iş

1. Kart yorumundaki `@bahsetme` sızıntısı (TODO, en öncelikli), ardından
   `add_comment`.
2. Deneme kartı #114 `ghghhg` projesinde duruyor; silinebilir.

---

## 0-H. 11 Eylül, gece — MCP 0.4.0: ilk yazma araçları

**Ortam:** ev makinesi. 319 test (304'tü), ön yüz derleniyor. Ürün kararı
kullanıcının: yazma araçları anahtar sayfasından önce açıldı (üç kişilik
ekip, anahtarlar Railway'de) — 0-D'nin "karar verilmeden 4. dilime
girilmemeli" notu böylece kapandı.

### Yüzey

Üç araç, toplam on üç: `create_task`, `update_task`, `move_task`. Hepsi üç
kapıdan geçiyor, sırayla:

1. **Alan kapısı** (`yazmaKapisi`): `workspace_id` zorunlu ve aktif alanla
   karşılaştırılıyor; uyuşmazlıkta 409 `err_mcp_workspace_mismatch`, yanıtta
   aktif alan. TODO'nun "sorunu görünür değil imkânsız kılar" dediği fikir.
2. **Kayıt kapısı**: proje `aktifProje`, görev `aktifGorev` — başka alandaki
   kayıt hiç yokmuş gibi 404.
3. **API'nin kendi kapıları** olduğu gibi geçiyor: `manage_tasks` (403),
   atananın alan üyeliği (0-G), kolon geçiş kuralı (409, `allowed_next`).

Her başarılı yazma denetim kaydına düşüyor: `mcp.task_created` / `_updated` /
`_moved`; ayrıntıda yalnızca kimlikler, alan adları ve atanan slug'ları.
Raporlar ekranı bunları "Kart açıldı — MCP" gibi etiketliyor.

### Tasarım kararları — ve gerekçeleri

- **Atananlar tam liste değil, `add_assignees` / `remove_assignees`.** API
  listeyi baştan yazıyor; "Umut'u da ekle" diyen model tek kişilik liste
  gönderip öbür atananları sessizce silebilirdi. Aynı kişi iki listede birden
  gelirse tahmin yürütülmüyor, 400 `err_mcp_assignee_conflict`.
- **Kolon slug'ı önceden doğrulanıyor.** API bilinmeyen kolonu sessizce yok
  sayıyordu: oluşturmada kartı ilk kolona açıyor, taşımada hiçbir şey yapmadan
  200 dönüyordu — model kartı taşıdığını sanırdı. Artık 400
  `err_mcp_column_not_found` + `valid_columns`.
- **`move_task` kart zaten oradaysa yazmıyor** (`moved: false`).
- **Denetim kaydına içerik yazılmıyor** — başlık, açıklama değil; kimlikler.
  `audit.js`'in başındaki kural.

### Bilinçli olarak dışarıda: yorum ekleme — ve bulunan açık

Yorum ucunu okurken **aynı sınıftan ikinci bir sızıntı** çıktı: kart
yorumundaki `@isim` bahsetmesi alıcıyı `user.findFirst({ where: { name:
{ startsWith } } })` ile **bütün platformda** arıyor. "@Ali" yazmak, başka bir
şirketteki adı Ali ile başlayan birine yorumun ilk 80 karakterini bildirim
olarak gönderebilir. **Canlıda, normal arayüzden.** 2 Eylül'de sohbetteki
bahsetme bu yüzden düzeltilmişti (`mentionAllowed`); kart yorumu kapsam
dışında kalmış. `add_comment` bu kapanmadan açılmıyor — TODO'da, en öncelikli
açık iş.

### Doğrulama

- **15 yeni test.** Saf: `alanUyusuyor`, `atamaListesi`. Yapısal: her yazma
  aracında alan kapısı var ve yazmadan önce geliyor, görev kapısı var,
  denetim kaydı var, yazan araç salt okuma diye işaretlenmiyor.
- **Dokuz mutasyonun dokuzu yakalandı**: kapıyı kaldır, yazmadan sonraya
  taşı, yoruma al; denetim kaydını, görev ve proje kapısını kaldır; salt
  okuma diye işaretle; iki saf fonksiyonu boz.
- **Tarama:** yazma araçlarını yalnızca reddedildikleri yollardan çağıran bir
  bölüm eklendi — dokuz deneme; her riskli denemeye güvenlik ağı olarak
  olmayan bir atanan konuyor, kart sayısı önce ve sonra ölçülüyor. Yerel
  0.4.0'a karşı **64 geçti, 0 kaldı, 2 atlandı** (atlananlar aynı iki veri
  boşluğu).
- **Başarı yolu — gerçekten kart açmak — henüz denenmedi.** Tarama bilerek
  yazmıyor ve yerel sunucu da production'a bağlı. İlk gerçek yazma
  dağıtımdan sonra Cowork'te, kullanıcının kendi panosunda.

### Dağıtımdan sonra

1. `MCP_URL=https://www.stoaboard.com/mcp npm run mcp:tara` →
   `initialize → stoaboard 0.4.0`; 64/0/2 beklenir.
2. **Yeni** Cowork sohbeti (araç listesi değişti): kendi panonda bir kart aç,
   bir kolona taşı, başlığını değiştir, birini ekle. Raporlar ekranındaki
   denetim kaydında üç "— MCP" satırı görünmeli.
3. Sonra: yorum bahsetme sızıntısı, ardından `add_comment`.

---

## 0-G. 11 Eylül, gece — atama üyelik açığı kapandı

**Ortam:** ev makinesi. 304 test (293'tü), ön yüz derleniyor.

**Kusur:** görev oluşturma ve atama değişikliği atanacak kişiyi yalnızca
slug'ıyla arıyordu; `manage_tasks` izni olan bir üye platformdaki herhangi
bir kullanıcıyı atayabiliyor, ona görev başlığını taşıyan bildirim
gidiyordu. MCP yazma araçlarının önündeki kapı buydu.

**Kural:** yeni eklenen atanan alan üyesi değilse 400
(`err_assignee_not_member`), işlem başlamadan — sessiz atlama yok. İki
istisna, ikisi de bilinçli:

- **Kartta zaten atanmış kişi korunur**, alandan çıkarılmış olsa bile.
  Arayüz atama listesinin tamamını geri gönderiyor (`drawer.jsx`); kaba bir
  kural o kartları düzenlenemez yapardı. `f789c37`'nin ürün kararıyla aynı
  yönde.
- **Platformda olmayan slug da aynı 400'ü alır.** Eskiden sessizce
  atlanıyordu; "üye değil" 400 / "yok" 201 bir kullanıcı yoklama kahini
  olurdu.

Karar saf `lib/assignees.js`te (`atananlariDenetle`), sorgular
`tasks.js`teki `atamalariCoz`ta — toplu ve işlemin dışında. Kart kopyalama
atananları bugünkü üyelere süzüyor; yoksa çıkarılmış birinin atandığı kartı
kopyalamak 400 alırdı.

**Doğrulama:**
- 11 yeni test. İki ucun da kapıdan geçtiğini yorumları silerek tarayan
  testler **beş mutasyonla** sınandı, beşi de yakalandı: iki uçta erken
  dönüşü kaldırmak, dönüşü yoruma almak (yorum tuzağı), kararı gevşetmek,
  kapıyı atlayan ikinci bir slug yolu eklemek.
- **Uçtan uca, veri yazmadan** (geçici yerel sunucu + `callSelf`): üye
  olmayanla ve olmayan slug'la kart açma aynı 400'ü aldı, kart sayısı
  değişmedi. Kart #6'ya (`efe-kapan-1` + `eray-atalay`) hayalet slug eklemek
  400 aldı ve reddedilenler listesinde **yalnızca hayalet** vardı — korunma
  kuralı çalışan kodda, hiçbir şey yazmadan kanıtlandı.

**Mevcut yetimler yerinde:** `efe-kapan-1` gibi zaten atanmış üye
olmayanlara dokunulmadı; yeni yetim artık yalnızca üye çıkarmayla doğabilir.

**Sıradaki iş:** MCP yazma araçları (0.4.0) — zorunlu `workspace_id` +
uyuşmazlıkta 409, her yazma denetim kaydına.

---

## 0-F. 11 Eylül, gece — 0.3.1 doğrulandı ve birleşti, tarama betiği depoda

**Ortam:** ev makinesi, 5432 açık. Yerel sunucu production Neon'a bağlı,
`/mcp` doğrudan çağrıldı.

### Yapılan: "Eve devir"in ilk dört adımı ve birleştirme

`mcp-031` alındı, `STOA_MCP_TOKENS` yerinde, 293 test yeşil. 0-E'nin kontrol
listesinin tamamı tuttu: `serverInfo.version` 0.3.1, alan dışı kayıt
olmayanla birebir aynı 404, `workspace.id` metin, owner'da tam izin listesi,
kartlarda `project_name`, `desc` kelime sınırında "…", sıkışık JSON. Alan
dışı kapı `list_columns {project_id: 21}` yerine Dershane'nin proje #6 /
görev #113'ü ile sınandı — aynı senaryo (sahibi olunan öbür alan); betik
kaydı veritabanından kendisi seçiyor.

**Tarama betiği artık depoda:** `npm run mcp:tara`
(`server/scripts/mcp-tara.js`). Çalışan sunucu ve veritabanı istediği için
`npm test`in dışında. `MCP_URL` ile canlıya karşı da koşar; beklenen sürümü
kaynaktaki `MCP_VERSION`dan okur. İlk koşu: **53 geçti, 0 kaldı, 2 atlandı.**

Kontrollerin ağırlığı "aynı olgu, iki okuyucu" sınıfında — 9-11 Eylül'deki
dört kusurun dördü bu sınıftandı. `list_projects`in `open`ı `list_tasks`in
uzunluğuyla, `list_members`in yükü kartların kendisiyle, listedeki kırpılmış
açıklama `get_task`in tam metniyle, `include_done` toplamı veritabanıyla
kıyaslanıyor.

**Atlanan geçmiş sayılmaz.** Veri yokluğundan koşamayan kontrol "atlandı"
yazılıyor ve çıkış kodu 2 oluyor (0 hepsi geçti, 1 kalan var). Bugünkü iki
atlama veri boşluğu: öbür alanlarda hiç not yok (not kapısı alan dışı
sınanamıyor) ve aktif alanın çöpünde kart yok (aşağıda).

### Mutasyon: betik kırmızıya dönebiliyor mu

0.3.1'in kapattığı kusurlar tek tek kaynağa geri kondu, ayrı portta sunucu
açıldı, tarama koştu, kaynak geri yazıldı:

| Mutasyon | Kalan kontrol |
|---|---|
| `aktifProje` kapısı kaldırıldı | 3 |
| `get_task` alan kapısı kaldırıldı | 1 |
| `sonuc()` girintili, kimlik çevirisi yok | 8 |
| üye izni rol satırından (0.3.0 owner kusuru) | 1 |

**Yakalanamayan:** açık sayımdan `deletedAt: null`ı çıkarmak. Çöpte bitmemiş
kart yokken sayı iki durumda da aynı çıkıyor — bu veriyle görünmez. Betik
bunu "atlandı" diye söylüyor; kaynak düzeyinde `mcp.test.js` kilitli.

Mutasyon betiğin **kendi** kusurunu da buldu: `whoami` kimliği sayıya
gerileyince aktif alan "başka alan" sanıldı ve kendi notuyla denendi.
Karşılaştırma iki taraftan metne çekildi. Ders yine aynı: tarama yazdıysan
kırılabildiğini görmeden bitmiş sayma.

### Ortam notu: kök alan adı HTTPS vermiyor — sebep yalnızca ofis vekili değil

0-D "kurumsal vekil stoaboard.com'u kesiyor" diyordu. **Evde de aynı
belirti:** `curl https://stoaboard.com` → exit 35 ("Connection was reset"),
`example.com` 200. Ölçülenler:

- `stoaboard.com` A kaydı `85.159.66.93` — 1.1.1.1 ve 8.8.8.8 de aynısını
  veriyor, yani İSS'nin DNS'i değil. O sunucu nginx: düz HTTP'de
  `302 Location: /` dönüyor, HTTPS el sıkışmasını sıfırlıyor.
- `www.stoaboard.com` Railway'e CNAME (`53vg2j8t.up.railway.app`), HTTPS'te
  200.

**Komut satırından canlıya `www` üzerinden gidilir.** Kök adresin HTTPS'i
her yerden mi kırık yoksa yalnızca buradan mı, bu makineden ayırt edilemedi
— TODO'da.

### Canlı taraması — yapıldı, yeşil

Push'tan ve Railway dağıtımından sonra, canlı anahtarla `www` üzerinden:
**53 geçti, 0 kaldı, 2 atlandı** — yerel koşuyla birebir. `initialize →
stoaboard 0.3.1`: dağıtım indi. `list_members` sayımlı çağrı canlıda 1,0 sn
(yerelde 2,5 sn).

```bash
cd server
MCP_URL=https://www.stoaboard.com/mcp npm run mcp:tara
# server/.env'deki anahtar canlıda yoksa başına MCP_TOKEN=<canlı anahtar> ekle
```

Bu makinede `server/.env` artık canlı anahtarı taşıyor (aynı gece Railway'dekiyle
eşitlendi), yani canlıya karşı `MCP_URL` yetiyor. Başka bir makinede ya da
anahtar döndürüldüğünde `server/.env`'deki anahtar canlıda olmayabilir — o zaman
`MCP_TOKEN` ile ver.

### İki `.env` tuzağı — bir saatlik yanlış iz

Canlıya karşı ilk koşular 401 aldı ve sebep bir saat boyunca yanlış yerde
arandı: dağıtım inmedi mi, değişken paylaşılan mı, uygulanmamış mı — Railway'de
redeploy bile yapıldı. Dağıtım günlüğü sağlıklıydı, `[mcp] anahtar atlandı`
yoktu.

**Asıl sebep yereldi.** Canlı anahtar deponun **kökündeki** `.env`'e
yazılmıştı; tarama ise `server/.env`'deki eski yerel anahtarı gönderiyordu.
`config.js` önce `server/.env`'i yüklüyor, kök `.env` yalnızca yedek ve dotenv
var olan değişkeni ezmiyor — aynı ad ikisinde de varsa kökteki **sessizce**
yok sayılıyor. Bu makinede ikisi de var ve aynı 14 değişken adını taşıyor;
eşitlemeden sonra yalnızca `CORS_ORIGINS` farklı. Kök `.env`'i silmek tuzağı
kökten kapatır — karar kullanıcının. Tuzak CLAUDE.md'ye yazıldı.

**Ders:** 401 alınca önce *gönderilen* anahtarın nereden geldiğine bak, sonra
sunucuya. Betik bugün bunu söylemiyor — yalnızca slug basıyor. Anahtar özetinin
ilk hanelerini hem betiğin hem sunucunun açılışta basması, bu soruyu tek bakışta
cevaplardı (TODO).

### Yol üstünde

- **`efe-kapan-1`** StoaBoard kartlarında atanan olarak duruyor ve alan üyesi
  değil — betik bunu bilgi satırı olarak basıyor. TODO'daki iki maddeye bağlı
  (atama üyelik açığı, yetim slug'lar).
- **`list_members` yük sayımı:** 3 projede sayımlı 2,5 sn, sayımsız 0,7 sn.
  Proje başına iki yerel istek, sırayla; pano büyüdükçe doğrusal uzar.
- **"Salt okuma" iz bırakıyor:** her araç çağrısı `mintSession` ile kısa
  ömürlü bir oturum satırı yazıyor, kapı denemeleri denetim kaydına düşüyor.
  Veriye dokunmuyor; betiğin başında yazılı.

### Sıradaki iş

1. **Cowork son onayı** — yeni sohbette, aynı liste. Canlı taraması yapıldı.
2. **Atama üyelik açığı** (TODO) — 0-E'nin önerisi: 0.3.1 canlıya çıktıktan
   sonraki ilk iş. Küçük, güvenlik, testiyle.
3. Taramanın iki kör noktası veriyle kapanır (TODO) — ama bu production'a
   kayıt koymak demek, karar kullanıcının.

---

## 0-E. 11 Eylül, akşam — 0.3.1: gerçek istemci bulguları

**Ortam:** ofis, 5432 kapalı. Doğrulamayı Claude istemcisi (Cowork) yaptı.

### Önce iki deneme tuzağı

**Araç listesi bayat kalıyor.** 0.3.0 dağıtıldıktan sonra açık kalan sohbet
yedi araç görmeye devam etti, yeni sohbet on gördü. İstemci `tools/list`i
bağlantı başında bir kez çekiyor; sunucu durum tutmadığı ve `listChanged`
bildirmediği için haber veremiyor. Çağrılar canlı, yalnızca liste bayat.
**Kural: araç yüzeyi değişen her dağıtımdan sonra yeni sohbet.** Ayrıntı
`MCP-SURUMLER.md`nin başında.

**İlk deneme yine boş alanda koştu** — Mytherra, 1 proje, 0 açık iş. 9 Eylül
0-A'nın birebir tekrarı. İkinci deneme tarayıcıda StoaBoard'a geçildikten
sonra yapıldı. `whoami`'deki alan adına bakmadan hiçbir tarama sonucuna
güvenme.

### Düzeltilenler

- **P0 — başka alandaki kayıt.** Kök neden ve düzeltme TODO'da. Özü: API
  "üye misin", MCP "aktif alanda mı" diye sormalı. Tek kapı `aktifProje`,
  alan dışı ile yok olan aynı 404.
- **Owner izinleri boş dönüyordu** (`list_members`). `memberToDict` izni rol
  satırından, `whoami` `memberPermissions`ten okuyordu. Artık ikisi aynı
  fonksiyon. **Aynı olgu, iki okuyucu — bu sınıfın dördüncü örneği** (9 Eylül
  kolon slug'ı, 10 Eylül `weeklyDone`, 11 Eylül açık görev sayımı, bu).
- **Kimlik tipi — 0.3.0'daki iddiam eksikti.** 0-D "kimlikler metne
  sabitlendi" diyordu; `workspace.id` sayı kalmıştı çünkü Prisma'dan
  geliyordu. Artık kural `sonuc()` içinde, adla: `id` ya da `*_id` olan her
  sayı metne. Değişen alanların listesi `MCP-SURUMLER.md`de.
- **JSON sıkışık** — kullanıcı "Cowork çok usage harcıyor" dedi. Ölçüldü:
  15 kartlık yanıtta karakterlerin %29'u girintiydi.
- `desc` kelime sınırında, `project_name` her kartta, 404'lerde
  yönlendirme, açıklamalar (alan adı uyuşmazlığında dur, `preview`in
  kapsamı, isteğe bağlı alanların yokluğunun anlamı).

**Karar: kolon `title` İngilizce kalıyor.** `title_language` yalnızca araç
etiketlerini belirliyor; veriyi dile göre değiştirmek var olan bir alanın
anlamını değiştirmek olurdu ve dil sinyali (Accept-Language) hâlâ
doğrulanmadı. Açıklama hangi alanın hangi dil olduğunu söylüyor.

### Aktif alan küresel — nasıl çalışıyor, riskleri

Aktif alan `users.currentWorkspaceId`, kullanıcı başına tek. Tarayıcıdaki
geçiş onu yazıyor, her MCP çağrısı yeniden okuyor; yani tasarım gereği
küresel. Denemede gözlenen "owner → member" değişimi kullanıcının tarayıcıda
StoaBoard'a geçmesiydi (rol alan başına). Riskler:

1. **Sessiz bağlam kayması:** önceki alandan alınan kimlikler yeni alanda
   kullanılabiliyordu — P0 bunun belirtisiydi, 0.3.1 kapıyı kapattı.
2. **Tek çağrı içinde yarış:** bir araç aktif alanı birden fazla kez okuyor
   (proje listesi, bağlam damgası). Arada geçiş olursa yanıt bir alanın
   verisini öbürünün adıyla damgalayabilir. Pencere milisaniye, ama sıfır
   değil. Kesin çözüm alanı isteğin başında bir kez çözüp her çağrıya
   açıkça geçirmek — API bugün buna izin vermiyor.
3. **Yazma araçları:** kart hangi alan aktifse oraya açılır. 3. dilimin
   zorunlu `workspace_id` + 409 kapısı tam bunun için.
4. **Aynı kullanıcının iki istemcisi** (tarayıcı + Claude, ya da iki sohbet)
   aynı sütunu paylaşıyor.
5. **`currentMember` okurken yazabiliyor** — TODO'da.

### Raporlanan, dokunulmayan

- **Görev ataması alan üyeliğini kontrol etmiyor** — gerçek bir güvenlik
  açığı, kapsam gereği düzeltilmedi. Ayrıntı TODO'da; en öncelikli açık iş.
- **`efe-kapan-1`** — ikinci bir hesap; iki olası kaynağı TODO'da.
- **Bitmiş kolondaki 9 kartın 8'inde `completed_at` yok.** Tek yazan
  `tasks.js` ~344: kart PATCH ile `isDone` kolonuna TAŞINDIĞINDA (1 Eylül,
  `d495d93`'ten beri). Atlayan yollar: 1 Eylül öncesi taşımalar; `isDone`
  işareti 10 Eylül'e kadar olmayan şablon panoları; bir kolonu sonradan
  `is_done` yapmak (içindeki kartlara geri dönük yazmıyor); kolon silinince
  kartları taşıyan `updateMany` (ne damga ne ilerleme yazıyor); kartı
  doğrudan bitiş kolonunda açmak (`POST`, ilerleme 0, damga yok). 10 Eylül'de
  (0-B) bilinçli karar verildi: sahte tarih yazılmıyor.
- **`progress` türetilmiş değil, saklanan bir alan ve dört yazanı var:**
  oluşturma (0), bitiş kolonuna giriş (100 — alt görevleri ezer), alt görev
  değişikliği (alt görevlerden yeniden hesap, alt görev varsa), bitişten çıkış
  (100 ise yeniden hesap; alt görev yoksa dokunulmaz), bir de elle PATCH.
  Hangisinin kazandığı olayların sırasına bağlı. Kart 4 (`0/2`, 100): bitiş
  kolonuna girmiş, 100 alt görevleri ezmiş — bitişteyse tasarım bu; dışarı
  çıktıysa 31 Ağustos'tan (`020d203`) önce çıkmış. Kart 7 (bitişte, 0):
  bitişe 100 yazmayan bir yoldan girmiş — işaretsiz şablon panosu, doğrudan
  bitişte açılma ya da kolon silme taşıması.

### Test tuzağı iki kez daha düştü

0-D'deki ders ("tarama testi yorumu kod sanıyor") bu turda iki yeni biçimde
tekrarladı ve ikisini de mutasyon buldu:

1. **Blok yorumu olmayan bir ihlal uydurdu.** `yorumsuz()` yalnızca `//`
   siliyordu; `sonuc()`un JSDoc'undaki eski kodun alıntısı "girintili JSON
   kaldı" testini kırdı. Kod temizdi.
2. **Desen gerçekçi gerilemeyi kaçırdı.** `[^)]*` iç içe parantezi
   geçemiyordu; `JSON.stringify(kimlikleriMetinle(veri), null, 2)` yazılınca
   test geçti.

Üç mutasyon (kapıyı kaldır, girintiyi geri koy, not alan kontrolünü sil)
şimdi üçü de yakalanıyor. **Ders keskinleşti: kaynak tarayan test yazdıysan
mutasyonla sınamadan bitmiş sayma** — üç tarama testinden üçü de ilk hâlinde
bir yönden yanlıştı.

### Sayılar

**293 test** (269'du), hepsi geçiyor. Sürüm 0.3.1. Yeni belge
`MCP-SURUMLER.md` — sürüm geçmişi ve kırıcı değişiklikler.

### Neden eve geçildi

Ofiste doğrulama döngüsü kullanıcının üzerinden geçiyordu: yaz → push →
Railway → kullanıcı Cowork'e prompt verir → rapor geri taşınır. Her halka
dakikalar sürüyor ve istemci tarafında ciddi kota yiyordu. Evde 5432 açık:
yerel sunucu Neon'a bağlanıyor ve `/mcp` doğrudan çağrılabiliyor (9 Eylül
0-A'da 21/21 böyle yapıldı). Cowork yalnızca son onay olur.

**Sabahki "ev makinesi gerekmez" cevabı doğruluk için doğruydu, hız için
eksikti.** Gerekli değil; ama bu tür işte açık farkla daha hızlı.

### Eve devir — ilk yapılacaklar

1. `git fetch && git checkout mcp-031`. İki commit taşıyor: 0.3.1 kodu ve
   bu belge.
2. `server/.env`'de `STOA_MCP_TOKENS` var mı bak (0-A'da vardı). **Yerel
   `.env` production veritabanını gösteriyor** — MCP salt okuma olduğu için
   tarama güvenli, ama başka bir komut çalıştırmadan önce nereyi gösterdiğine
   bak.
3. Yerel sunucuyu aç, `/mcp`'yi doğrudan çağır. Kontrol listesi:
   - `initialize` → `serverInfo.version` **0.3.1**
   - aktif alan StoaBoard iken `list_columns {project_id: 21}` → **404**,
     `list_tasks {project_id: 99999}` ile **birebir aynı** gövde
   - `get_task` / `get_note` başka alandaki kimlikle → 404
   - `whoami` `workspace.id` **metin**
   - `list_members` owner'da tam izin listesi
   - `list_tasks` kartlarında `project_name`, `desc` kelime sınırında "…"
   - yanıtlar sıkışık JSON
4. **Tarama betiğini bu kez repoya koy.** 0-A'daki 21/21 betiği oturumluktu
   ve kayboldu; her tur yeniden yazılıyor. Veritabanı gerektirdiği için
   `npm test`in içine değil, ayrı bir komuta bağlanmalı (ör.
   `npm run mcp:tara`). Bir kez yazılırsa bundan sonraki her MCP değişikliği
   dakikalar içinde doğrulanır — asıl hız kazancı bu.
5. Yeşilse `main`e birleştir, push et (canlıya gider), **yeni sohbette**
   Cowork'e son onay: aynı liste.

### Sonra

1. **Atama üyelik açığı** (TODO) — küçük, güvenlik, testiyle birlikte.
   Öneri: 0.3.1 canlıya çıktıktan hemen sonra ilk iş.
2. `available_tools` önerisi, yazma araçları / anahtar sayfası kararı.

---

## 0-D. 11 Eylül — MCP okuma yüzeyi kapandı (0.3.0), ev makinesi gerekmedi

**Ortam:** ofis makinesi, 5432 kapalı. Kod, test ve derleme burada koştu.

### Önce ortam notu: ev makinesi bu iş için gerekmiyordu

DEVIR 0-C "2.5. adım **ev makinesinde** yapılmalı" diyordu. Gerekçesi
doğruydu (gerçek yanıtla beslenmeyen araç yalan söyler) ama sonucu yanlış:
şart *doğrulama*, *makine* değil. **Claude bağlayıcısı stoaboard.com'a senin
ağından değil Anthropic tarafından gidiyor** — 5432'nin kapalı olması o yolu
hiç ilgilendirmiyor. Ofisteki tek fark hız: yerel sunucu olmadığı için her
tur bir Railway dağıtımı bekliyor.

**Yeni kısıt, kayda geçsin:** bu makinedeki kabuktan `stoaboard.com`a TLS el
sıkışması düşüyor (`curl` exit 35, `-k` ile de; `example.com` 200 dönüyor,
DNS çözülüyor). Kurumsal vekil o alan adını kesiyor. Tarayıcı vekilin
sertifikasıyla geçtiği için açılıyor, `curl` geçemiyor. **Canlıyı komut
satırından yoklayamazsın**; doğrulama tarayıcıdan ya da bağlayıcıdan geçmek
zorunda.

### Yapılan: 2.5. adım + 1. dilim, tek turda

Yüzey yedi araçtan **ona** çıktı. Yeni olanlar `list_workspaces`,
`list_members` (isteğe bağlı açık iş sayımıyla) ve `search_tasks`.

Aynı turda 1. dilimin tamamı: bağlam her yanıta girdi, kimlik tipleri metne
sabitlendi, `col_is_done` geldi, `include_done` geldi, açıklamalar listede
kırpılıyor, `updated_ago` yüzeyden kalktı, `warning` belgelendi.

**Bir davranış değişikliği var, devralan bunu bilmeli:** `list_tasks`
süzgeçsiz çağrıldığında artık yalnızca **açık** kartları döndürüyor. Eskiden
her şeyi döndürüyordu ama kendi açıklaması "bütün açık görevler gelir"
diyordu — araç belgesiyle çelişiyordu. Tanım uydurulmadı, sunucunun kendi
tanımı alındı: açık = bitmiş işaretli kolonda olmayan kart, yani
`projectWithOpenCount`in `list_projects` için hesapladığı şeyin aynısı.

### Yol boyunca çıkan gerçek kusur

**Açık görev sayısı çöp kutusundaki kartları da sayıyordu.** İki yerde
(`projects.js`, `api.js`) bitiş kolonu eleniyor ama `deletedAt: null`
konmuyordu; oysa görev listesi silinmiş kartı hiç vermiyor. Kenar çubuğu 9
derken pano 6 kart gösterebiliyordu ve çöp 30 gün tuttuğu için fark
haftalarca yaşıyordu. **Üçüncü kez aynı sınıf:** kusur kodun içinde değil,
iki sözleşmenin arasında. İlk ikisi 9 ve 10 Eylül'deydi.

Bu kez fark edilme sebebi yeni: sayıyı **bir model okudu**. MCP aynı rakamı
yüzeye taşıdığı için tutarsızlık göze battı.

### Test — ve kırılabildiği kanıtlandı

**269 test** (211'di), hepsi geçiyor. Yeni dosya `mcp.test.js`; biçimlendirme
`lib/mcpShape.js`e taşındığı için hepsi saf, veritabanı istemiyor.

**Mutasyon denemesi bir testi yalanladı ve bu turun en iyi dersi bu.** Açık
görev sayımını koruyan tarama testi, `deletedAt: null` sorgudan
çıkarıldığında **geçti**. Sebep: pencere, kuralı ANLATAN yorumdaki aynı
metni kod sandı. Yani testi yazarken bıraktığım açıklama, testin koruduğu
kuralın ihlalini örtüyordu. Tarama artık yorumları siliyor; mutasyon
tekrarlandı, bu kez iki test birden kırıldı.

**Kaynağı tarayan her test bu tuzağı taşıyor.** `dil.test.js` ve
`yetki.test.js` de kaynak tarıyor — oralarda aynı kontrol yapılmadı, yapılmalı.

### Karar verilenler

**Başlık kullanıcı metnidir, açıklama değildir.** Araç başlıkları iki dilli
oldu (`ARAC_BASLIKLARI`), açıklamalar Türkçe kaldı; onları model okuyor ve
cevabı zaten kullanıcının dilinde veriyor.

**Dilin nereden okunacağı gerçek bir sınır.** MCP `initialize` dil alanı
taşımıyor. Elde `?lang=en` (adrese yazılır, kullanıcının açık beyanı) ve
`Accept-Language` (istemci gönderirse) var; yedek `tr`. Çözülen dil `whoami`
yanıtında görünüyor. **Bağlayıcının `Accept-Language` gönderip göndermediği
doğrulanmadı** — gerçek istemciyle bakılacak ilk şey bu.

**`allowed_next` kaldırılmadı.** Boş olması kusur değil, kimsenin kural
koymamış olması demek; kaldırılsaydı kural konduğu gün model onu hiç
görmezdi. Açıklamaya "boşsa kısıt yok, alanı yok sayma" yazıldı.

### Sıradaki iş

1. **Gerçek istemciyle doğrulama.** 0.3.0 dağıtıldıktan sonra on araç da
   çağrılmalı. `initialize` yanıtındaki `serverInfo.version` dağıtımın
   indiğinin tek kanıtı. Bakılacaklar: başlık dili, `list_members` yük
   sayımının hızı, `search_tasks` Türkçe harf katlama, `include_done`
   varsayılanının şaşırtıp şaşırtmadığı.
2. **Yazma araçları isteniyor ve bir kapısı var.** Bağlanan istemci
   "whoami bana `manage_tasks` diyor ama kullanacak araç yok" diye haklı
   olarak yakındı. TODO'nun kaydı net: kendi kendine anahtar üretme + OAuth
   **3. adımdan önce gelmeli**, çünkü jetonun kimi temsil ettiği ve nasıl
   iptal edildiği kart açan bir araçta çok daha kritik. Bugün anahtar
   Railway ortam değişkeninde: iptal etmek yeniden dağıtım demek.
   **Bu bir ürün kararı, teknik engel değil** — üç kişilik ekipte yazma
   araçlarını anahtar sayfasından önce açmak savunulabilir. Karar verilmeden
   4. dilime girilmemeli.
3. **`updatedAt` şema kararı** (2. dilim) — TODO'da üç seçenek yazılı.

---

## 0-C. 10 Eylül, öğleden sonra — MCP canlı bağlandı, görsel kusurlar ölçüldü

**Ortam:** ofis makinesi, 5432 kapalı. Uygulama yerelde çalışmıyor; her şey
canlıda test edildi. Neon SQL Editor HTTPS üzerinden çalıştı.

### MCP artık Claude'un içinde çalışıyor

Tarayıcı içindeki bağlayıcı ekranı **OAuth istiyor** ve StoaBoard'da
yetkilendirme sunucusu olmadığı için ilk deneme *"Couldn't register with
StoaBoard's sign-in service"* ile düştü. Ekran ek istek başlıklarına izin
veriyor ama başlık adı **kapalı bir listeden** seçiliyor; `Authorization` o
listede yok, `x-auth-token` var.

Bu yüzden MCP kimlik kapısı ikinci bir başlık kabul ediyor
(`f6c58a7`). Gevşeme değil: taşınan sır aynı sır, doğrulama yine tek yerde
(`lookupSlug`), `Authorization` varsa o kazanıyor. Kapının hangi durumda
**açılmayacağı** teste bağlandı — boş başlık, yalnızca `Bearer`, yanlış
şema, fazladan sözcük. Testi yazarken kendi kodumdaki bir kusur çıktı:
`X-Auth-Token: Bearer` (ardında anahtar yok) "Bearer" dizesini anahtar
sanıyordu; düzeltildi.

**Bağlandı ve uçtan uca denendi.** Yedi araç, gerçek panoyla. Sonuç: dünkü ve
bugünkü düzeltmelerin ikisi de tuttu — gecikme **6** (14 değil, `done`
kolonundaki kartlar artık sayılmıyor), kolon zinciri hatasız (dün
`expected number, received string` ile tamamen kırıktı), hata yolu tipli,
not gövdesi listede sızmıyor.

**Sürüm 0.2.3.** Yüzeyi değiştiren commit'te bump etmeyi bir kez atladım ve
sonra düzelttim; `serverInfo.version` dağıtımın indiğini anlamanın tek yolu.

**OAuth hâlâ yok ve ölçeklenme sorunu orada.** Bugün her yeni kişi için
Railway'deki `STOA_MCP_TOKENS` elle düzenleniyor + yeniden dağıtım
gerekiyor. Ortak "servis hesabı" fikri elendi ve gerekçesi TODO'da: aktif
çalışma alanı `users.currentWorkspaceId` sütununda, yani **kullanıcı başına
tek** — ortak hesapta iki kişi birbirinin panosunu sessizce değiştirir.

### Görsel kusurlar — göz kararıyla değil, hesapla

"Beyaz modda bazı yazılar sönük" diye bildirildi. Ölçüldüğünde sorun
tahminden genişti: **üç temanın üçünde de** iki mürekkep tonu metin için
okunamaz durumdaydı (`--ink-faint` 2.29:1, `--ink-dim` 1.68:1; AA 4.5:1
istiyor). `--ink-faint` 71 yerde metin rengiydi.

İlk düzeltme kontrastı düzeltirken **hiyerarşiyi bozdu** — faint, muted ile
eşitlendi, cream'de sıra tersine döndü. Bunu ancak ölçerek gördüm. Üç temaya
hesaplanmış, eşit aralıklı bir ölçek konuldu ve **testle kilitlendi**
(`kontrast.test.js`): test hangi tokenların metin olarak kullanıldığını
kendisi buluyor, sıralamayı da ayrıca doğruluyor.

**Vurgu renkleri:** örnek kareler elle yazılmış sabit değerlerdi ve her zaman
ışıklı tema değerini gösteriyordu; koyu tema seçenekleri bilinçli olarak
açtığı için kullanıcı `#1a4a70` seçip `≈#60a7d6` alıyordu. Üstelik liste
**iki dosyada** kopyalanmıştı. Tek kaynağa bağlandı (`--accent-<ad>`
değişkenleri) ve teste kilitlendi.

### Dashboard

**"Ay" görünümündeki veri uydurmaydı:** haftalık toplamı 0.9 / 1.2 / 0.8 / 1.0
ile çarpıp dört hafta imal ediyordu. Silindi. Yerine panonun gerçek dağılımı
geldi — yatay yığılmış çubuk, veri kartların kendisinden okunuyor.

**`weeklyDone` hep sıfırdı** ve muhtemelen hiç çalışmamıştı: `columnToDict`
slug'ı `id` adıyla veriyor, dashboard `.slug` okuyordu. Dünkü MCP kusurunun
tıpatıp aynısı — **kusur kodun içinde değil, iki sözleşmenin arasında.**
Aynı sınıf iki gün üst üste iki ayrı yerde çıktığı için serileştirici
şekillerinin teste sabitlenmesi TODO'ya yazıldı.

### Sayılar

Test **211** (sabah 154'tü), hepsi geçiyor. Yeni dosya `kontrast.test.js`.
Ön yüz derlemesi temiz. Üretimde elle yapılan tek şey: altı panoda `is_done`
işaretlendi; işaretsiz pano sayısı 0.

### Karar verilenler

Proje bazlı erişimin **ilk dilimi açıldı** (`f789c37`): projeye üyeyi yönetici
ve projeyi açan ekler · yönetici bütün projeleri görür · yeni üye hiçbir
proje görmez · çıkarılan kişinin adı kartlarda kalır. Kalan dört soru
sonraki dilimlere ait. Projesiz üye ekranının tasarım yönü de kayıtlı ve
`auth.jsx` incelemesinden çıkan beş uyarı içeriyor — en önemlisi, o ekran
**tam ekran devralma olmamalı** (kullanıcı içeride, uygulaması çalışıyor) ve
`.auth-visual` mobilde tamamen gizleniyor.

### Sıradaki iş — üç seçenek

1. **MCP 2.5. adım:** `list_members`, `search_tasks`, `list_workspaces`.
   Üçü de salt okuma, bildirim üretmiyorlar. **Ev makinesinde** yapılmalı;
   gerçek yanıtla beslenmeden yazılan araç yalan söylüyor (iki kez kanıtlandı).
2. **İlerleme kusuru:** geciken 6 kartın 5'i `progress: 100` taşırken
   `todo` kolonunda. Küçük iş, ofis makinesinde yapılabilir.
3. **Proje bazlı erişim:** kararlar verildi, şema ve `ProjectMember` sırada.
   En büyük iş; makine engeli yok, şema Neon SQL Editor'den geçebilir.

---

## 0-B. 10 Eylül — `completed_at` boşluğu kapandı, kök sebep bulundu

Dünkü tarama "pano bitti diyor, sistem gecikmiş diyor" boşluğunu bulmuştu.
Bugün kapatıldı — ama **teşhis yanlıştı ve sorun daha büyüktü.**

**Sorun geri doldurma eksikliği değil, yaşayan bir kusurdu.** Pano iki ayrı
yerde kuruluyor: `projects.js` işareti koyuyordu (`isDone: slug === 'done'`),
şablonla çalışma alanı açan yol `workspaces.js` ise `isDone`u **hiç
yazmıyordu**. Yani altı pano geri doldurulmadığı için değil, **o yoldan
doğdukları için** işaretsizdi — ve bugün yeni bir çalışma alanı açan herkes
aynı kusuru üretmeye devam ediyordu. Düzeltildi, testle kilitlendi.

İşaret şablon verisine **açıkça** kondu (`[slug, title, titleTr, color, pos,
isDone]`), ada göre tahmin edilmiyor: tasarım şablonunun bitiş kolonu
`delivery` ("Delivered"), `done` değil. `slug === 'done'` kuralı oraya
taşınsaydı o şablonu sessizce kaçırırdı.

**Kapsam dünkünün dört katıydı.** DEVIR "dört projenin üçünde işaret yok"
diyordu; veritabanının tamamına bakınca **18 proje / 11 çalışma alanı** çıktı.
Dünkü ölçüm eksikti çünkü MCP yalnızca aktif çalışma alanını görüyor — TODO'ya
"yapısal boşluk" diye yazılan madde, dünkü ölçümü fiilen yanlış göstermiş.
**MCP'nin gördüğüyle veritabanında olanı bir tutma.**

**39 karta sahte tarih yazılmadı — bilinçli.** Geçiş defteri sorgulandı:
8 kayıt, 2 Eylül 10:48'den 10 Eylül 08:25'e, bunların 2'si bitiş geçişi.
İlk kaydın damgası tek damgalı kartın (#4) damgasıyla saniyesine aynı, yani
defter sağlam. Ama 39 kartın hiçbirinin kaydı yok: hepsi defter açılmadan
önce taşınmış. **Dürüst bir geriye dönük tarih yok.** Bugünü yazmak raporda
"39 iş 10 Eylül'de bitti" diye sahte bir zirve üretirdi.

Onun yerine soru doğru yere soruldu: `completed_at` türetilmiş bir kopyadır
(kart bitiş kolonuna girince yazılıyor, çıkınca siliniyor — `tasks.js`),
**kolon ise gerçeğin kendisi**. MCP'nin gecikme ölçütü kolona bakacak şekilde
değiştirildi; kart bitiş kolonundaysa damgası olmasa da gecikmiş sayılmıyor.
Üretim verisine tek satır yazmadan sorun bitti.

**Kabul edilen sınır:** 3 Eylül öncesi işlerin bitiş tarihi bilinmiyor.
"Bu ay kaç iş bitti / ortalama kaç günde bitiyor" raporları o dönemi
kapsamayacak. Uydurmak bunu kapatmaz, gizler.

**İşaretsiz pano artık sessiz kalmıyor.** Ürün kararı: kolonu silmek/işareti
kaldırmak serbest kalsın, ama sistem sussun demesin. Silmeyi engellemek yeni
bir tuzak kurardı ve deliği de kapatmazdı — kolonu silmeden **işareti
kaldırmak** aynı sonucu veriyor. MCP `list_tasks` yanıtına `warning` alanı
ekleniyor. **Arayüz tarafındaki uyarı henüz yok, sıradaki iş.**

**Üretimde elle yapılanlar (SQL Editor, ofis ağında HTTPS ile):** altı panoda
`is_done` işaretlendi (kolon kimlikleri 10, 32, 49, 73, 77, 102). Doğrulandı:
işaretsiz pano sayısı 0.

**`UPDATE`e her zaman `RETURNING` ekle.** SQL Editor `UPDATE` için "no result"
yazıyor — satır döndürmediği için, hata olduğu için değil. Bu bugün gerçek bir
kayba yol açtı: yazma sorgusu çalıştı, "no result" hata sanıldı, geri alma
sorgusu çalıştırıldı ve değişiklik geri alındı. `returning` eklendiğinde sorgu
kendi kanıtını gösteriyor.

Test sayısı **160** (154'tü), hepsi geçiyor.

---

## 0-A. 9 Eylül, ikinci tur — 2. adımın uçtan uca taraması (ev makinesi)

Ofis makinesi 2. adımı yazıp "gerçek veriyle denenmedi" diye işaretlemişti.
Bu tur o boşluğu kapattı ve **boşluğun ardında gerçek bir kusur çıktı.**

**Ortam notu — kısıt sanıldığından dar:** ev ağında 5432 açık, `[db] warmup ok`.
Yerel sunucu + production Neon ile tam tur atılabiliyor; canlıya dağıtım
beklemeye gerek yok. Yerel `.env` **production veritabanını** gösteriyor, bu
yüzden tarama bilinçli olarak salt-okuma tutuldu.

**Sonuç: 21/21.** Protokol, kapı (anahtarsız/yanlış anahtar 401, GET 405), el
sıkışma (`stoaboard / 0.2.0`), hız sınırı (600), durum tutmayan kip, yedi
aracın listesi, `whoami`, `list_projects`, `list_columns`, `list_tasks` + üç
süzgeci, `get_task`, `list_notes` (gövde sızdırmıyor), `get_note` ve hata
yolları (404 → `isError`, yanlış tip ve olmayan araç reddi) doğrulandı.

**Doğru çalışma alanında koşmak şart:** ilk turda aktif alan "Mytherra: Veil of
The Ancient" idi (1 proje, 0 görev, 0 not) ve `get_task`/`get_note` başarı
yolunda hiç çalıştırılamadı. Tarayıcıdan "StoaBoard" alanına geçilince
(rol `member`, 7 izin — DEVIR'in 1. adım notundaki ölçümle birebir aynı)
3 proje, 15 görev ve 1 notla ikisi de doğrulandı. **MCP'yi denerken önce
`whoami` çağır ve alan adına bak** — boş alanda yeşil görünen bir tarama
hiçbir şey kanıtlamıyor.

**Bulunan ve kapatılan kusur — belgelenen yolun tamamı kırıktı.**
`projectToDict`/`taskToDict` kimliği **metin** döndürüyor (`id: String(p.id)`,
Python aslından gelen sözleşme), araç şemaları ise `z.number().int()`
istiyordu. `list_projects` `"21"` veriyor, aracın kendi açıklaması "diğer
araçların istediği project_id buradan alınır" diyor, `list_columns` o değeri
`-32602 expected number, received string` ile geri çeviriyordu. **Kimlik alan
dört aracın hiçbiri gerçek bir kimlikle çağrılamıyordu.** Şemalar `z.coerce`
ile metni de kabul edecek şekilde düzeltildi — düzeltme MCP katmanında, çünkü
`String(id)` sözleşmesini değiştirmek ön yüzü kırar.

İkinci, daha sessiz kusur: `list_columns` açıklaması "kolonun **slug**
değerini buradan al" diyordu ama yanıtta `slug` diye bir alan yok —
`columnToDict` slug'ı `id` adıyla veriyor (`id: c.slug`, sayısal satır kimliği
ise `db_id`). Model olmayan bir alanı arıyordu. Açıklama düzeltildi.

**Bu turun dersi 3 Eylül'ünkinin eşi:** o tur *bir testin* yalan söylediğini
göstermişti, bu tur *bir araç açıklamasının* yalan söylediğini gösterdi. İkisi
de yeşil görünüyordu. 154 birim testin hiçbiri bu kusuru göremezdi, çünkü hepsi
şemayı değil kodu ölçüyor — **kusur kodun içinde değil, iki sözleşmenin
arasındaydı.** Yeni bir araç eklerken onu bir kez de gerçek yanıtın çıktısıyla
besle; elle uydurduğun argümanla değil.

**Taramanın asıl kazancı bir kod kusuru değil, bir VERİ kusuru oldu.**
Gerçek veriye bakınca çıktı: `list_tasks(overdue: true)` proje 1'de **14 görev**
diyor, oysa panoda 9 kart `done` kolonunda duruyor. Sebep, `done` kolonundaki
9 karttan 8'inde `completed_at` olmaması — tek istisna #4, damgası
`2026-09-02T10:48`, yani kolonun `isDone` işaretinin konduğu gün. Ondan
öncekiler işaretsiz kolona taşındığı için `completedAt` hiç yazılmamış (#7'de
`progress` bile 0'da kalmış). Dört projenin üçünde bitiş kolonu hâlâ hiç
işaretli değil. Ayrıntı ve yapılacaklar TODO'da.

**Bunun önemi MCP'nin ne için var olduğuyla ilgili.** TODO "kazandıran cümle
'bugün bende ne var, ne gecikti'" diyor. O cümle bugün **yanlış** cevap
veriyor ve yanlışlığı görünmüyor: ölçüt (`due < bugün && !completed_at`) doğru,
araç doğru, besleyen veri eksik. DEVIR'in "bayat bilgiye güvenmek hiç bilgi
olmamasından kötüdür" cümlesi artık soyut bir risk değil, ölçülmüş bir durum —
ve yazma araçlarından önce kapatılması gereken şey bu.

**İkinci yapısal boşluk TODO'ya yazıldı:** MCP yalnızca **aktif** çalışma
alanını görüyor, alanları listeleyen ya da değiştiren araç yok. Aktif alan
`users.currentWorkspaceId` sütununda duruyor (`currentMember`) — yani
tarayıcıdan bir tıkla değişiyor ve MCP tarafında hiçbir uyarı çıkmıyor.
Taramanın ilk turu tam olarak buna kurban gitti.

**Tarayıcının açık olması gerekmiyor.** Aktif alan oturumda değil kullanıcı
satırında tutulduğu ve `selfApi` kendi kısa ömürlü oturumunu ürettiği için MCP
tarayıcıdan tamamen bağımsız çalışıyor. Tarayıcı yalnızca aktif alanı
*değiştirmenin* tek yolu — okumanın koşulu değil.

**Tarama betiği oturumluk, repoda değil.** Tekrarı için 0. bölümün sonundaki
curl merdiveni yeterli; kalıcı bir koşum istenirse `server/test/` altına
alınmalı (veritabanı istediği için birim testlerinden ayrı bir komutla).

---

## 0. 9 Eylül turu — MCP entegrasyonu, 1. adım

**Aşağıdaki 1. bölüm 3 Eylül'den kalma ve dal tablosu bayat** (`main` o gün
`df113c3`ti, bugün `0566ecf`). Bu bölüm onu geçersiz kılar.

**Yapılan.** Claude'un panoyu MCP üzerinden sürmesi için kimlik iskeleti ve
salt-okuma yüzeyi. Araçlar `whoami`, `list_projects`, `list_columns`,
`list_tasks`, `get_task`, `list_notes` ve `get_note`; henüz yazma aracı yok.
Planın tamamı ve gerekçeleri
[TODO.md](TODO.md) → "MCP entegrasyonu" bölümünde; 2. adım okuma araçları,
3. adım yazma araçları.

**Dokunulan dosyalar** — hepsi yeni ya da katkı niteliğinde, hiçbir mevcut
davranış değişmedi:

```
YENİ  server/src/lib/mcpToken.js     anahtar çözümlemesi (saf, testli)
YENİ  server/src/lib/mcpAuth.js      requireMcpToken ara yazılımı
YENİ  server/src/routes/mcp.js       POST /mcp + whoami aracı
      server/src/config.js           config.mcp.tokens
      server/src/app.js              /mcp mount + ayrı hız sınırı
      server/src/lib/audit.js        AUDIT.MCP_AUTH_FAILED
      server/test/yetki.test.js      tarayıcı sıkılaştırıldı + MCP kapısı
      server/test/guvenlik.test.js   8 regresyon testi
      server/test/dil.test.js        HATA_DOSYALARI += mcp.js
      client/src/data.jsx            4 err_mcp_* anahtarı (tr + en)
      server/.env.example            STOA_MCP_TOKENS belgesi
```

**Testler 143 → 153, hepsi geçiyor.** Ön yüz derlemesi temiz.

**Yolda bulunan ve kapatılan gerçek kusur:** `yetki.test.js`in uç tarayıcısı
ara yazılımı sabit 400 karakterlik bir pencerede arıyordu. Kayıtlar tek satıra
sığdığında pencere bir sonraki kaydın içine taşıyor ve **korumasız bir uç,
komşusunun `requireAuth`ını görüp aklanıyordu.** Mevcut route dosyalarında
kayıtlar çok satırlı olduğu için kusur hiç görünmemişti; MCP ucunun kapısını
doğrulamak için bilerek korumasız bir uç bırakıldığında test yeşil kaldı ve
böyle bulundu. Pencere artık bir sonraki kayıtta kesiliyor. Aynı sınıf dil
testinde de görülmüştü (`f3c5907`). **Bu tur bir testin yalan söylediğini
gösterdi — yeni bir kapı eklerken önce kapıyı kırmayı dene.**

### Uçtan uca deneme — YAPILDI, dördü de geçti (9 Eylül)

Canlıda doğrulandı. Ofis ağından koşulabildi: engellenen 5432 (Postgres),
HTTPS değil — veritabanına Railway kendi tarafından bağlanıyor. Yani bu tür
denemeler için ev makinesini beklemeye gerek yokmuş, ders bu.

| Adım | Sonuç |
|---|---|
| 1 · Anahtarsız çağrı | `401 err_mcp_token_invalid` — uç canlıda, kapı kapalı |
| — Hız sınırı | `ratelimit-limit: 600`, `policy 600;w=900` |
| 2 · El sıkışma | `serverInfo: stoaboard / 0.1.0` |
| 3 · `tools/list` | tek araç: `whoami` |
| 4 · `whoami` | Neon'dan gerçek veri: slug, ad, çalışma alanı, izinler |

**Tek arıza slug'dı ve tahmin edilmişti:** `STOA_MCP_TOKENS`e önce `eray`
yazılmıştı, doğrusu `eray-atalay`. Kod değişmedi, yalnızca ortam değişkeni.
Hata `err_mcp_user_unknown` olarak döndü — yani kapalı başarısızlık çalıştı ve
teşhis tek bakışta yapıldı. Gerçek slug'a bakmanın en hızlı yolu: giriş
yapmışken `https://www.stoaboard.com/api/auth/me` — dönen JSON'daki `id`
alanı slug'ın kendisi (`userToDict` onu `id` diye adlandırıyor).

**Not:** apex `stoaboard.com` ofis ağından bağlantı sıfırlanmasıyla düşüyor,
`www.stoaboard.com` çalışıyor. Denemeleri `www` üzerinden yap.

**Yolda görülen:** `eray-atalay` çalışma alanı 1'de `owner` değil `member` ve
dokuz izinden yedisine sahip — `view_reports` ile `manage_workspace` yok.
Bugün bir şeyi engellemiyor ama rapor okuyan bir MCP aracı eklendiğinde o uç
403 dönecek. Karar anı geldiğinde hatırla.

### Denemeyi tekrarlamak için

Bir sonraki turda uç hâlâ ayakta mı diye bakmak ya da yeni araç eklendikten
sonra aynı yoldan geçmek için. **Kod değişikliği dağıtılmadan bu komutlar eski
sürümü ölçer:** Railway depodan derliyor, ortam değişkenini eklemek tek başına
yetmiyor — sıra push → dağıtım → deneme.

```bash
TOKEN=<STOA_MCP_TOKENS içindeki anahtar>
H='-H Content-Type:application/json -H Accept:application/json,text/event-stream'

# 1) Uç var mı, kapı kapalı mı — anahtarsız
curl -i -X POST https://stoaboard.com/mcp $H   -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
#    beklenen: 401 + {"error":"err_mcp_token_invalid"}
#    HTML dönerse dağıtım kodu almamış (SPA yedeği devrede) — en net teşhis

# 2) El sıkışma — anahtarla, aynı gövde + -H "Authorization: Bearer $TOKEN"
#    beklenen: serverInfo → stoaboard / 0.1.0

# 3) {"jsonrpc":"2.0","id":2,"method":"tools/list"}
#    beklenen: tek araç, whoami

# 4) {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"whoami","arguments":{}}}
#    beklenen: slug, ad, çalışma alanı adı, izin listesi
#    err_mcp_user_unknown gelirse: STOA_MCP_TOKENS'teki slug users.slug ile
#    eşleşmiyor. Tek düzeltilecek yer orası.
```

1–3 kodun ayakta olduğunu, 4 kimliğin ve veritabanı yolunun gerçekten
çalıştığını kanıtlıyor. Dördü de geçerse 1. adım kapanır ve Claude istemcisine
bağlamaya geçilebilir.

---

## 1. Depo gerçekten nerede

```
main       = df113c3              3 Eylül gecesi, evdeki oturumdan
dil-ve-ci  = 4462c01              main'in 5 commit ÖNÜNDE  ← bu turun işi
raporlama                         tamamen main'in içinde — ölü ağırlık
```

**`dil-ve-ci` dalı bu oturumda açıldı ve 5 commit taşıyor.** Doğrudan `main`e
işlenmedi çünkü aynı turda CI kurulduğu için değerin tamamı Railway canlıya
dağıtmadan ÖNCE doğrulamaktan geliyor. Push ve birleştirme kullanıcıya
bırakıldı; sen devraldığında `git fetch` sonrası dalın uzağa gidip gitmediğine
ve `main`e birleşip birleşmediğine bak.

```
0af6df9  fix  - 58 dil kaçağı (31'i sözlüğe eklenmemiş anahtar)
be5e6e9  test - dil taramasının ölçütü değişti
fe1bc91  ci   - testler ve derleme her itmede
271bcd9  docs - belge çelişkileri + bu dosya + zorlama merdiveni
4462c01  test - yetkilendirmenin uygulanması kilitlendi
```

`raporlama` dalı hem yerelde hem uzakta duruyor ama `main`e göre tek bir fazla
commit'i yok (`git log origin/main..raporlama` boş). Silinebilir; bilinçli
olarak dokunulmadı, karar kullanıcının.

**İşe başlamadan `git fetch && git status` çalıştır.** Diğer makine gece
çalışmış olabilir; 3 Eylül'deki altı commit tam olarak böyle geldi.

**CI ilk kez push'ta çalışacak.** O ana kadar `.github/workflows/ci.yml`
yerelde doğrulandı ama gerçek runner'da hiç koşmadı. İlk koşuda kırılırsa en
olası sebep `npm ci` → `postinstall` → `prisma generate` adımıdır; sahte
`DATABASE_URL` tam da bunun için verildi, gerekçesi `fe1bc91`'de.

---

## 2. Kafa karıştıran dört çelişki — düzeltildi

Bu dosyanın yazılma sebebi. Belgeler koddan geride kalmıştı ve dördü de
okuyanı yanlış yöne sürüyordu. Hepsi 3 Eylül'de düzeltildi, ama nasıl
oluştuklarını bilmek işine yarar:

| Belge ne diyordu | Gerçek |
|---|---|
| "Otomatik test yok. En büyük teknik açık." | **137 test var**, hepsi geçiyor |
| "Şema hiçbir veritabanına gönderilmedi" | 2 Eylül'de **production'a uygulandı**, doğrulandı |
| "Kolon geçiş kuralı arayüzü: karar bekliyor" | 1 Eylül'de **yapıldı** (`9035c2a`), kolon menüsünde |
| "main HENÜZ PUSH EDİLMEMİŞ olabilir" | Push edildi; belge o cümleyle donmuştu |

Ortak sebep aynı: iş bittiğinde TODO'nun **iki ayrı yeri** güncellenmesi
gerekiyordu ve yalnızca biri güncellendi. Örneğin geçiş kuralı, "kapatılanlar"
bölümüne yazılmış ama "tasarım kararı bekleyenler" bölümünden silinmemişti.
Bir maddeyi kapatırken belgede o maddenin **başka nerede geçtiğini ara.**

---

## 3. Son turda ne yapıldı (3 Eylül gecesi)

Altı commit, tek konu: **İngilizce arayüzde Türkçe kalan metinler.**

- `6242a7c` — `session` tablosu şemaya tanıtıldı. Prisma değil
  `connect-pg-simple` oluşturuyor; şemada tanımlı olmadığı için `db push`
  her seferinde `DROP TABLE "session"` üretiyordu. **Bu modeli şemadan
  çıkarma**, tuzak aynen geri gelir.
- `d227159` — öksüz `list.jsx` silindi (154 satır, hiç render edilmiyordu).
- `32644b9` — Raporlar ve süre kaydı ekranları çevrildi.
- `2449240` + `df113c3` — sunucu hata mesajları. On route dosyasındaki
  **174 Türkçe metin 103 hata koduna** çevrildi.

Sunucu hata sözleşmesi artık şu: `{ error: 'err_kod', message: 'Türkçe' }`.
Çeviri **tek noktada**, `apiFetch` içinde: kodu sözlükten geçiriyor, karşılığı
yoksa `message`a, o da yoksa ham koda düşüyor. Bu yüzden yüzden fazla çağrı
noktasının hiçbirine dokunulmadı.

Dinamik mesajlar (içine kolon adı gömülenler) istemcide çevrilemiyor; onlarda
cümle sunucuda kuruluyor ve dil yeni `server/src/lib/lang.js` ile okunuyor —
indirme bağlantılarında `?lang`, diğer her istekte `X-Stoa-Lang` başlığı.

**Davet akışına bilerek dokunulmadı.** `invite_code_required` ve
`invalid_invite_code` `err_` öneki taşımıyor, çünkü `auth.jsx` bunları ham
hâliyle karşılaştırıyor. Bekleme lobisi daha önce canlıda kırıldığı için
elleşilmedi. Oraya girersen bu iki karşılaştırmayı da birlikte taşı.

---

## 4. Dil turu tamamlandı — `dil.test.js` artık gerçek bir kilit

3 Eylül'de testin kör noktası kapatıldı ve çıkan 58 kaçağın hepsi düzeltildi.
Önemli olan **neyin değiştiği**: ölçüt "metin nerede duruyor"dan **"metnin
çevirisi var mı"**ya çevrildi. Tarama artık dosyanın tamamını okuyor ve bir
Türkçe metni ancak çevirisini gösterebiliyorsa geçiriyor.

Turun en çarpıcı bulgusu: **58 kaçağın 31'i "kod doğru, anahtar yok"**du.
Ekranlar `tx('chat_perm_admins', 'Yöneticiler')` diye düzgün yazılmıştı ama o
anahtarlar sözlüğe hiç eklenmemişti — yani kural biliniyordu, uygulanıyordu ve
yine de sessizce başarısız oluyordu. Somut örnekler:

- `app_confirm` yoktu: **her onay kutusundaki "Onayla"** İngilizce arayüzde
  Türkçe çıkıyordu.
- Sekiz izin etiketinden sonradan eklenen ikisi (`view_reports`,
  `manage_workspace`) eksikti: rol ekranında altı satır İngilizce, iki satır
  Türkçe görünüyordu.
- `ErrorBoundary` 2 Eylül'de eklenmiş, üç anahtarı hiç yazılmamıştı.

Ders: belgeye kural yazmak yetmiyor, testin kuralı **doğrulayabiliyor** olması
gerekiyor. Anahtarın sözlükte gerçekten var olduğu kontrol edilmeseydi bu 31
kusurun hiçbiri görünmezdi.

Meşru kalıplar, muafiyetler ve gerekçeleri [CLAUDE.md](CLAUDE.md) dil
bölümünde. Muafiyet eklemen gerekirse **gerekçesini yaz** — listedeki her
istisnanın yanında niçin orada olduğu duruyor.

---

## 5. Bu turda eklenen iki kilit — CI ve yetki

**CI kapısı** (`.github/workflows/ci.yml`). 143 test vardı ama çalıştırmak
geliştiricinin hafızasına bağlıydı; unutulan bir `npm test`, bozuk kodun
main'e gidip Railway tarafından doğrudan canlıya dağıtılması demekti.

> **Bu dosya tek başına kapı DEĞİL, alarm.** Engelleyici olması için GitHub'da
> `Settings → Branches → main → Require status checks to pass before merging`
> açılmalı ve iki iş de (`sunucu testleri`, `ön yüz derlemesi`) seçilmeli.
> O ayar yapılmadan kırmızı CI yalnızca kırmızı bir tik olarak kalır.
> **Bu ayar henüz yapılmadı** — depo dışı bir işlem, kullanıcıya bırakıldı.

**Yetki kilidi** (`server/test/yetki.test.js`). Buradaki ayrım önemli ve
yanlış hatırlanmaya açık: `hasPermission`'ın KENDİSİ zaten test ediliyordu
(`guvenlik.test.js`). Eksik olan, kuralın UYGULANDIĞININ garantisiydi — yeni
bir uca `requireAuth` yazmayı unutmak hiçbir yerde yakalanmıyordu. İki
değişmez kilitlendi: her uç `requireAuth` taşır (113 uçtan 9'u gerekçeli açık
listede), ve soket kimliği yalnızca oturumdan okunur, olay gövdesinden asla.

**Kapsamlamanın DOĞRULUĞU hâlâ test edilmiyor** ve bu bilinçli. Statik tarama
denendi: 70 mutasyon ucunun 46'sını işaretledi, hepsi yanlış pozitifti —
kapsamlama tek biçimde yapılmıyor (kimi `userId: user.id` ile, kimi aktif
çalışma alanıyla, kimi `loadTaskWithAccess(permission:)` ile). Ayırt etmek
için isteğin gerçekten çalıştırılması gerekiyor. **"Yetki testi var" diye
güvenme** — neyin kapsanmadığı testin sonundaki notta ve TODO.md'de.

Bu turun yöntemsel dersi: **mutasyon testi.** Geçen bir test hiçbir şey
kanıtlamaz. `tasks.js`'ten `requireAuth` kasten kaldırıldı, test tam yerinden
kırıldı, dosya geri alındı. Yeni bir koruma testi yazdığında aynısını yap —
kırılamayan test, tören.

---

## 6. Değişmeyen tuzaklar

Ayrıntısı [CLAUDE.md](CLAUDE.md) içinde; buradakiler en çok ayağa dolaşanlar:

- **Şema deploy'da kendiliğinden gitmiyor.** `postinstall`, `npm start` ve
  Railway build komutundan `prisma db push --accept-data-loss` kaldırıldı.
  Şema artık bilinçli, elle gönderiliyor. `--accept-data-loss` yazma refleksine
  kapılma — o bayrak `session` tablosunu gerçekten siler ve **giriş yapmış
  herkes düşer.**
- **`npm test` çıktısındaki veritabanı hatası test hatası değil.**
  `[db] warmup failed` / "Can't reach database server" — modül yüklenirken
  bağlantı deneniyor, kurumsal ağda 5432 kapalı. Ölçüt en alttaki
  `pass` / `fail` satırları.
- **Windows PowerShell'de `npm` değil `npm.cmd`.** Git Bash'te düz `npm`.
- **`server/.env` repoda yok ve olmamalı.** Şu an yereldeki `.env` production
  veritabanını gösteriyor — yani `prisma db push` benzeri bir komut **canlıya**
  yazar. Şema komutu çalıştırmadan önce `DATABASE_URL`in nereyi gösterdiğine
  bak.

---

## 7. Sırada ne var

Öncelik sırası [TODO.md](TODO.md) ve [GUVENLIK.md](GUVENLIK.md) içinde; özeti:

1. **Proje bazlı üyelik** — bugün bir üye çalışma alanındaki her şeyi görüyor,
   okuma izni diye bir kavram yok. En büyük açık.
2. **Uç testleri** — `yetki.test.js` (3 Eylül) "kimlik doğrulaması unutuldu"
   sınıfını kapattı: her uç `requireAuth` taşıyor, soket kimliği yalnızca
   oturumdan okunuyor. Kapanmayan sınıf, kapsamlamanın *doğruluğu* — bunun
   için isteği gerçekten çalıştıran bir koşum gerekiyor. Gerekçe TODO.md'de.
3. **Dosya depolama** — yüklenenler veritabanında `bytea`, S3/R2'ye taşınmalı.
4. **Dönem dondurma**, **kanal geçmişi kesimi**.

**Karar bekleyen ürün soruları — bunlar cevaplanmadan ilgili koda girme:**
süreyi kim girer (ikinci toplantıya kalan soru) · hangi bildirim ekranı kesmeli
([BILDIRIMLER.md](BILDIRIMLER.md)) · sohbet kapsamı (öneri: kanallar genel
kalsın ama bir projeye bağlanabilsin).

---

## 8. Bu dosyayı güncel tut

Diğer makineye geçmeden önce buradaki 1. ve 3. bölümü güncelle — hangi
commit'tesin, ne yaptın, yarım bıraktığın ne var. Devrin kırıldığı yer tam
olarak burası.
