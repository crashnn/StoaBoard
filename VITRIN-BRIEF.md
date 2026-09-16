# Vitrin sayfası — Claude Design için brief

16 Eylül 2026. Bugün stoaboard.com'a gelen misafir doğrudan giriş ekranına
düşüyor. Todoist gibi araçlar önce ürünü anlatıyor, giriş ve kayıt üst
çubukta duruyor. Bu sayfa o vitrin. Şablonu Claude Design yapar; çıktı düz
HTML + CSS olur, Express `/` yolunda misafire servis eder (giriş yapmış
kullanıcı sayfayı hiç görmez, doğrudan pano).

## Claude Design'a verilecek metin

> StoaBoard için tek sayfalık bir vitrin (landing) tasarla. Ürün: takımlar
> için gerçek zamanlı proje panosu; kartlar, kolonlar, raporlar ve yapay
> zekâ ile konuşarak yönetme. Duruş: sade, dürüst, kurumsal ama sıcak;
> Jira'nın ağırlığı yok. Yazı dili Türkçe; İngilizce sürümü sonra aynı
> şablondan çıkacak, metin kutuları buna göre esnek olsun.
>
> Bölümler, yukarıdan aşağı:
> 1. Üst çubuk: logo (StoaBoard, "Stoa" koyu "Board" açık), sağda "Giriş"
>    ve dolgulu "Ücretsiz başla".
> 2. Kahraman: bir başlık, bir alt cümle, iki düğme, sağda ürünün gerçek
>    ekran görüntüsü için yer (16:10, tarayıcı çerçevesi olmadan, hafif
>    gölge). Başlık önerisi: "Panonu sür, yapay zekâya söyle." Alt cümle:
>    "Kartlar, raporlar ve konuşarak yönetim; hepsi tek yerde, hepsi sade."
> 3. Sayı bandı: üç gerçek sayı (çalışma alanı, kart, tamamlanan iş);
>    değerler sayfa açılınca API'den gelecek, yer tutucu bırak.
> 4. Üç kutu, üç iddia: (a) "Yapay zekâ ile konuş" — panoyu sohbetle sür,
>    her işlem kayıtlı; (b) "Kim ne kadar çalıştı" — kişi, dönem ve akış
>    raporları, Excel ve PDF; (c) "Güvenli ve izlenebilir" — her dışa aktarma
>    ve her yapay zekâ yazması denetim kaydında.
> 5. "Bilerek yapmadıklarımız": kısa bir liste (iş akışı motoru, sorgu dili,
>    story point, özel alanlar). Ton: gurur değil, tercih.
> 6. Kapanış: "Ücretsiz başla" tekrar, altında GitHub ve LinkedIn simgeleri,
>    dil seçici (TR/EN), telif satırı.
>
> Yapılmayacaklar: sahte kullanıcı yorumu, basın alıntısı, yıldız puanı,
> uydurma sayı. Görsel: fotoğraf ve illüstrasyon yok, gerçek ekran görüntüsü
> ve tipografi taşısın. Renk: koyu lacivert vurgu, kırık beyaz zemin; koyu
> tema için de değişkenler tanımla. Mobilde tek sütun.

## Bizim tarafta yapılacaklar (şablon gelince)

- `static/vitrin/index.html` + `vitrin.css`; Express `/` için: oturum yoksa
  bu dosya, varsa SPA. Tek yeni yol, `requireAuth` taşımaz; `yetki.test.js`
  `ACIK_UCLAR` listesine gerekçesiyle yazılır.
- Sayı bandı `GET /api/public/stats`ten (zaten var, 10 dk önbellek).
- TR/EN: iki HTML mi, tek HTML + küçük JS mi karar; dil testi
  `client/src/views` tarıyor, statik sayfa için `auth.jsx`teki gibi ayrı
  bir denklik testi gerekir.
- Ekran görüntüsü: demo panosundan, adlar anonim. Kullanıcı alır.
- Kayıt bugünkü gibi kalıyor; planlar gelince düğme metni değişir.

## Ön koşul: yapay zekâ anahtarı kendi kendine alınabilmeli

Sayfa "yapay zekâ ile konuş" diyorsa, kayıt olan kişi bunu deneyebilmeli.
Bugün anahtar Railway ortam değişkeni (`STOA_MCP_TOKENS`), her kişi için
dağıtım gerekiyor. Panoda kart: "Kişinin kendi MCP anahtarını alabilmesi"
(Devam Ediyor, 18 Eylül). Tasarım TODO'da.
