#!/usr/bin/env node
/**
 * StoaBoard — genişletme paketi (stoa-seed.mjs'in üstüne EKLER)
 *
 * Yeni projeler, kanallar, DM, daha çok görev/not/mesaj oluşturur.
 * Aynı isimde proje/kanal varsa yeniden oluşturmaz — tekrar çalıştırmak güvenli.
 *
 *   node stoa-seed-more.mjs         → sadece plan
 *   node stoa-seed-more.mjs --go    → oluştur
 */

const BASE = process.env.STOA_URL || 'https://www.stoaboard.com';
const WRITE = process.argv.includes('--go');
const MAIN_PROJECT = process.env.STOA_PROJECT || 'Tasarım Projesi';

const ACCOUNTS = {
  a: { email: process.env.STOA_A_EMAIL || '', pass: process.env.STOA_A_PASS || '' },
  b: { email: process.env.STOA_B_EMAIL || '', pass: process.env.STOA_B_PASS || '' },
};

const day = 86400000;
const iso = (o) => new Date(Date.now() + o * day).toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// YENİ PROJELER — varsayılan kolonlar: backlog / todo / doing / review / done
// ─────────────────────────────────────────────────────────────────────────────

const PROJECTS = [
  {
    name: 'Kuzey Kahve — Marka Kimliği', icon: 'sparkles', color: 'oklch(58% 0.12 45)',
    labels: [
      ['logo', 'Logo', 'Logo', 'amber'],
      ['ambalaj', 'Packaging', 'Ambalaj', 'green'],
      ['basili', 'Print', 'Basılı', 'blue'],
      ['onayli', 'Approved', 'Onaylı', 'green'],
    ],
    tasks: [
      { col: 'done', title: 'Marka konumlandırma toplantısı', who: 'a', labels: ['onayli'],
        desc: 'Üçüncü nesil kahvecilik, mahalle odaklı. "Zanaat" vurgusu yapılmayacak — herkes yapıyor.',
        start: iso(-30), due: iso(-27), priority: 'mid',
        subtasks: [['Sorular listesi', 1], ['Toplantı', 1], ['Özet notu', 1]] },
      { col: 'done', title: 'İsim ve slogan çalışması', who: 'b', labels: ['onayli'],
        desc: '"Kuzey Kahve" onaylandı. Slogan: "Sabahın kendi hızı var."',
        start: iso(-27), due: iso(-22), priority: 'mid',
        subtasks: [['40 isim adayı', 1], ['Kısa liste', 1], ['Marka tescil ön kontrol', 1]],
        comments: [['a', 'Tescil ön kontrolde çakışma yok, ilerleyebiliriz.']] },
      { col: 'done', title: 'Logo — ilk tur eskizler', who: 'a', labels: ['logo', 'onayli'],
        desc: 'On iki eskiz. Pusula ve kahve çekirdeği birleşimi öne çıktı.',
        start: iso(-22), due: iso(-16), priority: 'high',
        subtasks: [['Eskizler', 1], ['Dijitalleştirme', 1], ['Sunum', 1]] },
      { col: 'review', title: 'Logo — son rötuşlar', who: 'b', labels: ['logo'],
        desc: 'Küçük boyutta pusula iğnesi kayboluyor. Hat kalınlığı artırıldı, onay bekliyor.',
        start: iso(-8), due: iso(1), priority: 'high',
        subtasks: [['16px testi', 1], ['Hat kalınlığı', 1], ['Müşteri onayı', 0]],
        comments: [['b', '16px\'te iğne tamamen kayboluyordu. Hattı 1.5\'ten 2\'ye çıkardım.'],
                   ['a', 'Şimdi okunuyor. Tabelada da bir kontrol edelim, orada tersi olabilir.']] },
      { col: 'review', title: 'Ambalaj — 250g paket', who: 'a', labels: ['ambalaj'],
        desc: 'Kraft üzeri tek renk baskı. Matbaadan numune geldi, renk biraz koyu çıkmış.',
        start: iso(-6), due: iso(2), priority: 'high',
        subtasks: [['Açınım hazırlığı', 1], ['Matbaa numunesi', 1], ['Renk düzeltme', 0]] },
      { col: 'doing', title: 'Ambalaj — 1kg ve filtre serisi', who: 'b', labels: ['ambalaj'],
        desc: '250g\'ın türevleri. Aynı sistem, farklı ölçüler.',
        start: iso(-3), due: iso(6), priority: 'mid',
        subtasks: [['1kg açınım', 1], ['Filtre kutusu', 0], ['Etiket varyantları', 0]] },
      { col: 'doing', title: 'Menü tasarımı — duvar ve masa', who: 'a', labels: ['basili'],
        desc: 'Duvar menüsü A0, masa menüsü A5. Fiyat değişince sadece rakam basılabilmeli.',
        start: iso(-2), due: iso(8), priority: 'mid',
        subtasks: [['Duvar menüsü', 1], ['Masa menüsü', 0]] },
      { col: 'doing', title: 'Kartvizit ve kaşe', who: 'b', labels: ['basili'],
        desc: 'Letterpress düşünülüyor, maliyet soruldu.',
        start: iso(-1), due: iso(9), priority: 'low' },
      { col: 'todo', title: 'Bardak ve peçete baskısı', who: 'a', labels: ['ambalaj'],
        desc: 'Üç boyut bardak. Tedarikçi minimum 5000 adet istiyor.',
        due: iso(12), priority: 'mid' },
      { col: 'todo', title: 'Tabela — dış cephe', who: 'b', labels: ['basili'],
        desc: 'Belediye izni gerekiyor, ölçüler ona göre. Işıklı mı değil mi karar verilmedi.',
        due: iso(15), priority: 'mid',
        subtasks: [['Ölçü alımı', 1], ['İzin başvurusu', 0]] },
      { col: 'todo', title: 'Sosyal medya şablonları', who: 'a', labels: ['basili'],
        desc: 'Dokuz şablon: ürün, duyuru, alıntı. Müşteri kendi doldurabilmeli.',
        due: iso(18), priority: 'low' },
      { col: 'backlog', title: 'Marka kılavuzu — PDF', who: 'b', labels: ['logo'],
        desc: 'Her şey bitince toplanacak. 20-24 sayfa hedef.',
        due: iso(25), priority: 'low' },
      { col: 'backlog', title: 'Sadakat kartı sistemi', who: 'a', labels: ['basili'],
        desc: 'Fiziksel kart mı, uygulama mı? Müşteri henüz karar vermedi.',
        due: iso(30), priority: 'low' },
      { col: 'backlog', title: 'Personel önlük ve tişört', who: 'b', labels: ['ambalaj'],
        desc: 'Açılıştan iki hafta önce basılmalı.', due: iso(35), priority: 'low' },
    ],
  },
  {
    name: 'Stüdyo Web Sitesi', icon: 'globe', color: 'oklch(55% 0.11 250)',
    labels: [
      ['icerik', 'Content', 'İçerik', 'amber'],
      ['tasarim', 'Design', 'Tasarım', 'purple'],
      ['gelistirme', 'Development', 'Geliştirme', 'blue'],
      ['seo', 'SEO', 'SEO', 'green'],
    ],
    tasks: [
      { col: 'done', title: 'Mevcut sitenin analizi', who: 'b', labels: ['icerik'],
        desc: 'Ortalama kalış 24 saniye. En çok çıkılan sayfa: İletişim. Formda 6 alan var, fazla.',
        start: iso(-20), due: iso(-17), priority: 'mid',
        subtasks: [['Analytics dökümü', 1], ['Isı haritası', 1]] },
      { col: 'done', title: 'Site haritası ve sayfa listesi', who: 'a', labels: ['icerik'],
        desc: 'Beş sayfa: Ana, İşler, Vaka analizi, Hakkımızda, İletişim. Blog şimdilik yok.',
        start: iso(-17), due: iso(-13), priority: 'mid',
        subtasks: [['Sayfa listesi', 1], ['Gezinme yapısı', 1]] },
      { col: 'review', title: 'Ana sayfa tasarımı', who: 'a', labels: ['tasarim'],
        desc: 'Hero\'da tek bir iş, büyük görsel. Ekip içinde "çok boş" tartışması var.',
        start: iso(-9), due: iso(2), priority: 'high',
        subtasks: [['Hero', 1], ['İşler şeridi', 1], ['Alt bilgi', 1], ['Mobil', 0]],
        comments: [['b', 'Hero fazla boş geldi bana. En azından bir alt başlık koyalım mı?'],
                   ['a', 'Boşluk bilinçli — tek işe odaklanıyor. Bir hafta yaşayıp tekrar bakalım.'],
                   ['b', 'Tamam, ikna oldum. Mobilde nasıl duracağını görünce karar veririz.']] },
      { col: 'doing', title: 'Vaka analizi şablonu', who: 'b', labels: ['tasarim'],
        desc: 'Problem → süreç → sonuç. Her işte aynı iskelet, içerik değişecek.',
        start: iso(-4), due: iso(5), priority: 'high',
        subtasks: [['İskelet', 1], ['Meridyen örneği', 0], ['Kuzey Kahve örneği', 0]] },
      { col: 'doing', title: 'İşler sayfası — grid', who: 'a', labels: ['tasarim'],
        desc: 'Üç kolon masaüstü, tek kolon mobil. Filtreleme gerekmiyor, iş sayısı az.',
        start: iso(-3), due: iso(6), priority: 'mid',
        subtasks: [['Grid', 1], ['Kart hover', 0]] },
      { col: 'doing', title: 'Metin yazımı — Hakkımızda', who: 'b', labels: ['icerik'],
        desc: 'Kısa olsun. "Tutkulu ekip" gibi cümleler kullanmıyoruz.',
        start: iso(-2), due: iso(7), priority: 'mid' },
      { col: 'todo', title: 'İletişim formu — 3 alana indir', who: 'a', labels: ['gelistirme'],
        desc: 'İsim, e-posta, mesaj. Bütçe ve zaman alanları kaldırılacak.',
        due: iso(10), priority: 'high' },
      { col: 'todo', title: 'Fotoğraf çekimi — ofis ve ekip', who: 'b', labels: ['icerik'],
        desc: 'Yarım gün. Doğal ışık, poz verilmiş görünmesin.',
        due: iso(13), priority: 'mid',
        subtasks: [['Fotoğrafçı ayarla', 1], ['Çekim listesi', 0]] },
      { col: 'todo', title: 'Sayfa başlıkları ve meta açıklamalar', who: 'a', labels: ['seo'],
        desc: 'Beş sayfa için başlık + açıklama.', due: iso(16), priority: 'low' },
      { col: 'todo', title: 'Görsel optimizasyonu', who: 'b', labels: ['gelistirme', 'seo'],
        desc: 'WebP, lazy loading. Şu an ana sayfa 4.2MB — kabul edilemez.',
        due: iso(17), priority: 'mid' },
      { col: 'backlog', title: 'Çok dilli yapı — İngilizce', who: 'a', labels: ['icerik'],
        desc: 'Yurt dışı işler için. Önce Türkçe bitsin.', due: iso(28), priority: 'low' },
      { col: 'backlog', title: 'Blog altyapısı', who: 'b', labels: ['gelistirme'],
        desc: 'Yazacak mıyız gerçekten? Karar verilmeden yapılmasın.',
        due: iso(40), priority: 'low' },
    ],
  },
  {
    name: 'Stüdyo İşleri', icon: 'briefcase', color: 'oklch(52% 0.06 160)',
    labels: [
      ['finans', 'Finance', 'Finans', 'green'],
      ['ekip', 'Team', 'Ekip', 'purple'],
      ['ofis', 'Office', 'Ofis', 'amber'],
    ],
    tasks: [
      { col: 'done', title: 'Ağustos faturaları', who: 'a', labels: ['finans'],
        desc: 'Meridyen ve Kuzey Kahve kesildi. İkisi de vadesinde ödendi.',
        start: iso(-14), due: iso(-10), priority: 'high',
        subtasks: [['Meridyen', 1], ['Kuzey Kahve', 1]] },
      { col: 'done', title: 'Yeni monitör alımı', who: 'b', labels: ['ofis'],
        desc: 'İki adet 27" renk kalibreli. Kurulum yapıldı.',
        start: iso(-12), due: iso(-8), priority: 'mid' },
      { col: 'review', title: 'Eylül teklifleri', who: 'b', labels: ['finans'],
        desc: 'İki yeni potansiyel müşteri. Fiyatlandırma gözden geçiriliyor.',
        start: iso(-4), due: iso(3), priority: 'high',
        subtasks: [['Teklif A', 1], ['Teklif B', 0]] },
      { col: 'doing', title: 'Stajyer ilanı ve görüşmeler', who: 'a', labels: ['ekip'],
        desc: 'Altı başvuru geldi, üçü görüşmeye çağrıldı.',
        start: iso(-5), due: iso(7), priority: 'mid',
        subtasks: [['İlan metni', 1], ['Ön eleme', 1], ['Görüşmeler', 0]],
        comments: [['a', 'Üç kişiyi çağırdım, salı ve çarşamba. Sen de katılır mısın?'],
                   ['b', 'Katılırım. Portfolyoları önceden atar mısın?']] },
      { col: 'doing', title: 'Yazılım lisansları yenileme', who: 'b', labels: ['finans', 'ofis'],
        desc: 'Tasarım paketi ve yedekleme servisi ekimde doluyor.',
        start: iso(-1), due: iso(9), priority: 'mid' },
      { col: 'todo', title: 'Portfolyo güncellemesi', who: 'a', labels: ['ekip'],
        desc: 'Son üç iş eklenecek. Web sitesi bitince oradan da yayınlanır.',
        due: iso(14), priority: 'mid' },
      { col: 'todo', title: 'Ofis internet hızı', who: 'b', labels: ['ofis'],
        desc: 'Yükleme hızı yetersiz, büyük dosya göndermek eziyet. Tarifeler karşılaştırılacak.',
        due: iso(16), priority: 'low' },
      { col: 'todo', title: 'Sözleşme şablonu güncelleme', who: 'a', labels: ['finans'],
        desc: 'Revizyon turu sayısı sözleşmede net yazmalı. Meridyen\'de sıkıntı çıktı.',
        due: iso(20), priority: 'high' },
      { col: 'backlog', title: 'Ekip eğitim bütçesi', who: 'b', labels: ['ekip'],
        desc: 'Kişi başı yıllık bir konferans veya kurs.', due: iso(45), priority: 'low' },
      { col: 'backlog', title: 'Arşiv temizliği', who: 'a', labels: ['ofis'],
        desc: 'İki yıldan eski proje dosyaları soğuk depolamaya.', due: iso(50), priority: 'low' },
    ],
  },
];

// ── mevcut projeye eklenecek görevler (kolonlar: brief/draft/design/revision/delivery)
const EXTRA_MAIN = [
  { col: 'delivery', title: 'Tipografi lisansı — satın alma', who: 'b', labels: ['approved'],
    desc: 'Uygulama içi kullanım için lisans alındı. Fatura müşteriye yansıtıldı.',
    start: iso(-15), due: iso(-9), priority: 'mid',
    subtasks: [['Lisans karşılaştırma', 1], ['Satın alma', 1]] },
  { col: 'delivery', title: 'Marka kılavuzu — 1. bölüm', who: 'a', labels: ['approved'],
    desc: 'Logo kullanımı, boşluk kuralları, yanlış kullanımlar. Teslim edildi.',
    start: iso(-13), due: iso(-7), priority: 'mid',
    subtasks: [['Logo bölümü', 1], ['Yanlış kullanımlar', 1], ['PDF çıktı', 1]] },
  { col: 'revision', title: 'İşlem geçmişi — filtreleme', who: 'b', labels: ['ux', 'revision'],
    desc: 'Müşteri tarih aralığı seçicisini karmaşık buldu. Hazır aralıklar eklenecek.',
    start: iso(-5), due: iso(4), priority: 'mid',
    subtasks: [['Hazır aralıklar', 1], ['Özel aralık', 0]] },
  { col: 'design', title: 'Ayarlar ekranı', who: 'a', labels: ['ui'],
    desc: 'Profil, güvenlik, bildirimler, dil. Dört bölüm, tek sayfa.',
    start: iso(-2), due: iso(8), priority: 'mid',
    subtasks: [['Bölüm yapısı', 1], ['Form bileşenleri', 0], ['Karanlık tema', 0]] },
  { col: 'design', title: 'Hata ve uyarı durumları', who: 'b', labels: ['ui', 'ux'],
    desc: 'Bağlantı yok, işlem başarısız, oturum doldu. Üçü de aynı dili konuşmalı.',
    start: iso(-1), due: iso(10), priority: 'mid',
    subtasks: [['Metin tonu', 1], ['Görsel dil', 0]] },
  { col: 'draft', title: 'Kartı dondurma akışı', who: 'a', labels: ['ux'],
    desc: 'Tek dokunuşla dondur, geri almak da aynı kolaylıkta olmalı.',
    start: iso(2), due: iso(13), priority: 'mid' },
  { col: 'draft', title: 'Hesap özeti — PDF çıktısı', who: 'b', labels: ['ux'],
    desc: 'Aylık özet. Banka formatı yasal zorunluluk, esneme alanı dar.',
    start: iso(3), due: iso(15), priority: 'low' },
  { col: 'brief', title: 'Widget — ana ekran bakiyesi', who: 'a', labels: ['ui'],
    desc: 'iOS ve Android widget. Teknik kısıtlar araştırılacak.', due: iso(22), priority: 'low' },
  { col: 'brief', title: 'Sesli komut ile transfer', who: 'b', labels: ['ux'],
    desc: 'Müşterinin fikri. Güvenlik tarafı ciddi soru işareti — önce o konuşulmalı.',
    due: iso(26), priority: 'low' },
];

const NOTES = [
  { who: 'b', title: 'Kuzey Kahve — Marka Brief\'i', body:
`# Kuzey Kahve

**Müşteri:** Kuzey Kahve (tek şube, ikincisi planlanıyor)
**Kapsam:** İsim, logo, ambalaj, basılı malzeme, tabela

## Konumlandırma
Mahalle kahvecisi. Üçüncü nesil kahve kalitesi ama havası olmayan bir yer.
Müşterinin kendi cümlesi: *"İnsanlar laptopla gelip dört saat otursun istemiyorum,
kahvesini alıp gününe devam etsin."*

## Ton
Sakin, sıcak, gösterişsiz. **"Zanaat", "tutku", "yolculuk" kelimeleri yasak** —
sektörde herkes kullanıyor, hiçbir anlamı kalmamış.

## Renk yönü
Kraft kağıdı, koyu yeşil, kırık beyaz. Parlak renk yok.

## Teslim
Açılış 6 hafta sonra. Tabela ve ambalaj o tarihten 2 hafta önce hazır olmalı.` },

  { who: 'a', title: 'Fiyatlandırma — İç Not', body:
`Tekliflerde tutarlı olalım diye yazıyorum.

## Günlük oran
Tasarım günü bazında hesaplıyoruz. Saat bazlı geçmeyeceğiz — müşteriyi de bizi de
yanlış yere itiyor.

## Revizyon
Fiyata **iki tur** revizyon dahil. Üçüncüden itibaren ek ücret.
Bunu sözleşmeye net yazmalıyız; Meridyen'de tam bu yüzden tartışma çıktı.

## Kapsam dışı
- Geliştirme
- Baskı ve üretim maliyeti (müşteri doğrudan matbaaya öder)
- Stok fotoğraf ve yazı tipi lisansları

## İndirim
Uzun soluklu işlerde %10'a kadar. Tek seferlik işlerde indirim yok.` },

  { who: 'b', title: 'Web Sitesi — İçerik Planı', body:
`## Sayfalar

| Sayfa | Durum | Sorumlu |
|---|---|---|
| Ana | Tasarım incelemede | Test 1 |
| İşler | Tasarım devam | Test 1 |
| Vaka analizi | Şablon devam | Test 2 |
| Hakkımızda | Metin yazılıyor | Test 2 |
| İletişim | Bekliyor | Test 1 |

## Vaka analizi iskeleti
1. Müşteri kimdi, ne istedi
2. Neyi farklı yaptık
3. Sonuç — mümkünse sayı ile

## Yazım kuralları
- Kısa cümle
- "Biz" değil, işin kendisi konuşsun
- Sıfat yerine örnek ver` },

  { who: 'a', title: 'Stajyer Görüşmeleri — Sorular', body:
`Üç adayla salı ve çarşamba görüşülecek.

## Sormak istediklerim
- Portfolyodaki bir işi seç, **neyi değiştirirdin?**
- Bir geri bildirimle hiç fikir ayrılığına düştün mü, ne yaptın?
- Hangi araçları kullanıyorsun — ve neden onu seçtin?

## Sormayacaklarımız
"Beş yıl sonra kendini nerede görüyorsun" tarzı sorular. Kimse dürüst cevap vermiyor.

## Değerlendirme
Portfolyo kalitesinden çok **düşünme biçimi**. Yeteneği öğretmek zor,
aracı öğretmek kolay.` },

  { who: 'b', title: 'Erişilebilirlik — Kontrol Listesi', body:
`Her teslimden önce bakılacaklar. Meridyen'de öğrendiklerimizden çıktı.

## Renk
- [ ] Metin/arka plan kontrastı en az **4.5:1** (büyük metin 3:1)
- [ ] Bilgi sadece renkle verilmiyor — ikon veya metin de var
- [ ] Karanlık temada da ölçüldü

## Tipografi
- [ ] Gövde metni 16px altına inmiyor
- [ ] Satır yüksekliği en az 1.5
- [ ] Sayısal alanlarda tabular rakam

## Etkileşim
- [ ] Dokunma hedefleri en az 44×44px
- [ ] Klavye ile gezinilebiliyor, odak görünür
- [ ] Hata mesajı sorunu **ve çözümü** söylüyor

## Hareket
- [ ] "Hareketi azalt" ayarına saygı gösteriliyor` },

  { who: 'a', title: 'Haftalık Durum — Özet', body:
`## Bu hafta biten
- Logo son rötuşları (Kuzey Kahve) — onay bekliyor
- Renk paleti erişilebilirlik düzeltmesi (Meridyen)
- Ağustos faturaları kesildi ve tahsil edildi

## Devam eden
- Meridyen: ana ekran, ikon seti, onboarding revizyonu
- Kuzey Kahve: ambalaj serisi, menü
- Web sitesi: vaka analizi şablonu

## Tıkanan
- **Kart başvuru akışı** — müşteriden yasal metinler hâlâ gelmedi, iki haftadır bekliyoruz
- **Tabela** — belediye izni çıkmadan ölçü kesinleşmiyor

## Gelecek hafta
Stajyer görüşmeleri, Eylül teklifleri, Meridyen ara teslim.` },
];

const CHANNELS = [
  { name: 'tasarım', description: 'Tasarım tartışmaları ve geri bildirim', icon: 'palette',
    messages: [
      ['a', 'Kuzey Kahve logosunun 16px halini attım, bir bakar mısınız?'],
      ['b', 'Şimdi çok daha iyi. Önceki halde iğne tamamen kayboluyordu.'],
      ['a', 'Tabelada tersi olabilir diye düşünüyorum — orada hat çok kalın durabilir.'],
      ['b', 'Haklısın. Tabela için ayrı bir varyant yapalım, ince hatlı.'],
      ['a', 'İki varyantlı logo sistemi olur o zaman: küçük boyut ve büyük boyut.'],
      ['b', 'Marka kılavuzuna da bunu yazalım, müşteri yanlış kullanmasın.'],
      ['a', 'Yazıyorum. "Hangi boyutta hangi versiyon" diye bir sayfa açtım.'],
      ['b', 'Web sitesi hero\'su konusunda hâlâ tam ikna olmuş değilim ama mobilde göreyim.'],
      ['a', 'Mobil bugün çıkar. Boş durmasının sebebi tek işe odaklanması — kalabalık olursa o etki kaybolur.'],
      ['b', 'Anladım, görünce konuşuruz.'],
    ] },
  { name: 'meridyen', description: 'Meridyen projesi — müşteri işleri', icon: 'briefcase',
    messages: [
      ['b', 'Müşteri kart başvurusu için yasal metinleri hâlâ göndermedi.'],
      ['a', 'İki hafta oldu. Bugün bir hatırlatma maili atayım mı?'],
      ['b', 'At bence. Gecikme bizden kaynaklı görünmesin, yazılı olsun.'],
      ['a', 'Attım. Kibarca "bu olmadan başlayamıyoruz" dedim.'],
      ['b', 'Doğru yaklaşım. Onboarding revizyonu bu arada bitmek üzere.'],
      ['a', '4 adıma indi mi gerçekten?'],
      ['b', 'İndi. Kimlik ve telefon doğrulama tek ekranda, akış çok daha rahat.'],
      ['a', 'Perşembe sunumunda bunu önce gösterelim, en görünür iyileştirme.'],
      ['b', 'Katılıyorum. Ben akışın kısa bir videosunu hazırlarım.'],
      ['a', 'Süper. Ben de renk paleti öncesi/sonrası karşılaştırması hazırlayayım.'],
      ['b', 'Kontrast rakamlarını da koy, somut olur.'],
      ['a', 'Koyuyorum. 3.9 → 4.7, güzel görünüyor.'],
    ] },
  { name: 'rastgele', description: 'İş dışı her şey', icon: 'coffee',
    messages: [
      ['a', 'Kuzey Kahve numuneleri geldi bu arada. Kahve de göndermişler.'],
      ['b', 'Ciddi misin, nasıl?'],
      ['a', 'İyi. Gerçekten iyi. Projeye biraz daha inandım.'],
      ['b', 'Mutfakta mı bıraktın?'],
      ['a', 'Bıraktım ama kupa yok, hepsi lavaboda.'],
      ['b', 'Bulaşık makinesini akşam çalıştıralım artık.'],
      ['a', 'Yeni monitörler de çok iyi oldu, renk farkı gözle görülür.'],
      ['b', 'Evet, eski monitörde her şey daha sıcak görünüyormuş. Şimdi anladım niye baskılar farklı çıkıyordu.'],
    ] },
];

const DM = [
  ['a', 'Perşembe sunumu için kim ne anlatıyor, netleştirelim mi?'],
  ['b', 'Netleştirelim. Ben onboarding ve renk paletini alayım.'],
  ['a', 'Tamam, ben de ana ekran ve ikon setini anlatırım.'],
  ['b', 'Açılışı sen mi yapıyorsun?'],
  ['a', 'Yapayım. Üç cümlelik bir giriş hazırladım, uzatmayacağım.'],
  ['b', 'İyi olur. Geçen sefer giriş 10 dakika sürmüştü, sunum sıkışmıştı.'],
  ['a', 'Aynen o yüzden kısa tutuyorum. Bir de demo sırasını önceden prova edelim mi?'],
  ['b', 'Edelim, çarşamba öğleden sonra uygunum.'],
  ['a', 'Çarşamba 15:00 diyelim o zaman.'],
  ['b', 'Anlaştık. Kart başvurusu konusunu da açacak mıyız?'],
  ['a', 'Açacağız ama kısa. "Sizden metin bekliyoruz" deyip geçeriz, suçlayıcı olmasın.'],
  ['b', 'Doğru ton bu. Tamamdır, çarşamba görüşürüz.'],
];

// ─────────────────────────────────────────────────────────────────────────────

class Session {
  constructor() { this.jar = new Map(); this.me = null; }
  get cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); }
  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(this.jar.size ? { cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [n, ...v] = c.split(';')[0].split('=');
      if (n && v.length) this.jar.set(n.trim(), v.join('='));
    }
    const t = await res.text();
    let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(d && (d.error || d.message)) || ''}`);
    return d;
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  patch(p, b) { return this.req('PATCH', p, b); }
  async login(e, pw) { const r = await this.post('/api/auth/login', { email: e, password: pw }); this.me = r.user; return r.user; }
}

const log = (...a) => console.log(...a);
const ok = (s) => log('  \x1b[32m✓\x1b[0m ' + s);
const skip = (s) => log('  \x1b[2m–\x1b[0m ' + s);
const info = (s) => log('  \x1b[2m·\x1b[0m ' + s);
const warn = (s) => log('  \x1b[33m!\x1b[0m ' + s);
const norm = (s) => (s || '').toString().toLocaleLowerCase('tr');

/** Alt görevleri önce hepsini oluştur, sonra işaretle — ilerleme doğru hesaplansın. */
async function addTask(sess, slugOf, projectId, colId, labelSlug, t) {
  const s = sess[t.who];
  const payload = {
    title: t.title, desc: t.desc || '', col: colId(t.col),
    priority: t.priority || 'mid', assignees: [slugOf[t.who]],
    labels: (t.labels || []).map(labelSlug).filter(Boolean),
  };
  if (t.due) payload.due = t.due;
  if (t.start) payload.start = t.start;
  const created = await s.post(`/api/projects/${projectId}/tasks`, payload);
  const id = created.id ?? created.task?.id;

  const made = [];
  for (const [title, done] of t.subtasks || []) {
    const st = await s.post(`/api/tasks/${id}/subtasks`, { title });
    made.push([st.id ?? st.subtask?.id, done]);
  }
  for (const [stId, done] of made) if (done && stId) await s.patch(`/api/subtasks/${stId}`, { done: true });

  for (const [who, text] of t.comments || []) await sess[who].post(`/api/tasks/${id}/comments`, { text });
  return { subs: made.length, coms: (t.comments || []).length };
}

async function main() {
  log('');
  log('\x1b[1mStoaBoard — genişletme paketi\x1b[0m');
  log(`  hedef : ${BASE}`);
  log(`  mod   : ${WRITE ? '\x1b[31mYAZMA (--go)\x1b[0m' : '\x1b[36msadece plan\x1b[0m'}`);
  log('');

  if (!ACCOUNTS.a.email || !ACCOUNTS.b.email) {
    warn('STOA_A_EMAIL / STOA_A_PASS / STOA_B_EMAIL / STOA_B_PASS ver.');
    process.exit(1);
  }

  log('\x1b[1m1. Giriş\x1b[0m');
  const A = new Session(), B = new Session();
  const ua = await A.login(ACCOUNTS.a.email, ACCOUNTS.a.pass);
  const ub = await B.login(ACCOUNTS.b.email, ACCOUNTS.b.pass);
  ok(`${ua.name} · ${ub.name}`);
  const sess = { a: A, b: B };
  const slugOf = { a: ua.id, b: ub.id };

  // Proje/kolon/etiket/kanal işlemleri manage_projects ister; görev oluşturmak istemez.
  // Hangi hesabın yetkisi varsa onu "yönetici oturumu" seçiyoruz — zararsız bir
  // boş PATCH ile yokluyoruz (boş gövde hiçbir alanı değiştirmiyor).
  let ADMIN = null, adminName = '';
  {
    const probeCols = await A.get('/api/projects');
    const anyProj = probeCols[0];
    if (!anyProj) throw new Error('Hiç proje yok — önce arayüzden bir proje aç.');
    const cols = await A.get(`/api/projects/${anyProj.id}/columns`);
    for (const [nm, s] of [[ua.name, A], [ub.name, B]]) {
      try { await s.patch(`/api/columns/${cols[0].db_id}`, {}); ADMIN = s; adminName = nm; break; }
      catch { /* yetkisi yok, diğerini dene */ }
    }
    if (!ADMIN) throw new Error('İki hesabın da proje yönetme yetkisi yok. Birine "Yönetici" rolü ver.');
  }
  ok(`yönetim işlemleri: ${adminName}`);

  const totals = {
    tasks: PROJECTS.reduce((n, p) => n + p.tasks.length, 0) + EXTRA_MAIN.length,
    notes: NOTES.length,
    msgs: CHANNELS.reduce((n, c) => n + c.messages.length, 0) + DM.length,
  };
  log('');
  log('\x1b[1m2. Plan\x1b[0m');
  info(`${PROJECTS.length} yeni proje  ·  ${totals.tasks} görev  ·  ${totals.notes} not`);
  info(`${CHANNELS.length} yeni kanal  ·  ${totals.msgs} mesaj (DM dahil)`);
  info(`"Teslim" ve "Done" kolonları tamamlandı olarak işaretlenecek`);

  if (!WRITE) {
    log('');
    log('\x1b[36mKuru çalıştırma — hiçbir şey oluşturulmadı.\x1b[0m');
    log('Oluşturmak için:  \x1b[1mnode stoa-seed-more.mjs --go\x1b[0m');
    log('');
    return;
  }

  const c = { proj: 0, task: 0, sub: 0, com: 0, note: 0, msg: 0, chan: 0 };

  // ── mevcut projenin "tamamlandı" kolonu ──
  log('');
  log('\x1b[1m3. Tamamlandı kolonları\x1b[0m');
  const existing = await ADMIN.get('/api/projects');
  const main = existing.find((p) => norm(p.name) === norm(MAIN_PROJECT));
  if (main) {
    const cols = await ADMIN.get(`/api/projects/${main.id}/columns`);
    const last = cols[cols.length - 1];
    if (last && !last.is_done) {
      await ADMIN.patch(`/api/columns/${last.db_id}`, { is_done: true });
      ok(`${main.name}: "${last.title_tr || last.title}" → tamamlandı`);
    } else skip(`${main.name}: zaten işaretli`);
  }

  // ── yeni projeler ──
  log('');
  log('\x1b[1m4. Yeni projeler\x1b[0m');
  for (const P of PROJECTS) {
    let proj = existing.find((p) => norm(p.name) === norm(P.name));
    if (proj) { skip(`${P.name} — zaten var, atlanıyor`); continue; }

    proj = await ADMIN.post('/api/projects', { name: P.name, icon: P.icon, color: P.color });
    c.proj++;
    ok(P.name);

    for (const [slug, en, tr, tone] of P.labels) {
      await ADMIN.post(`/api/projects/${proj.id}/labels`, { slug, name_en: en, name_tr: tr, tone });
    }
    const cols = await ADMIN.get(`/api/projects/${proj.id}/columns`);
    const doneCol = cols.find((x) => x.id === 'done');
    if (doneCol && !doneCol.is_done) await ADMIN.patch(`/api/columns/${doneCol.db_id}`, { is_done: true });

    const labels = await ADMIN.get(`/api/projects/${proj.id}/labels`);
    const labelList = Object.entries(labels).map(([slug, v]) => ({ slug, ...(v || {}) }));
    const labelSlug = (w) => {
      const l = labelList.find((x) => [x.slug, x.en, x.tr].some((f) => norm(f) === norm(w)));
      if (!l) warn(`etiket yok: ${w}`);
      return l ? l.slug : null;
    };
    const colId = (w) => (cols.find((x) => [x.id, x.title, x.title_tr].some((f) => norm(f) === norm(w))) || cols[0]).id;

    for (const t of P.tasks) {
      const r = await addTask(sess, slugOf, proj.id, colId, labelSlug, t);
      c.task++; c.sub += r.subs; c.com += r.coms;
    }
    info(`   ${P.tasks.length} görev eklendi`);
  }

  // ── mevcut projeye ek görevler ──
  if (main) {
    log('');
    log(`\x1b[1m5. "${main.name}" için ek görevler\x1b[0m`);
    const cols = await ADMIN.get(`/api/projects/${main.id}/columns`);
    const labels = await ADMIN.get(`/api/projects/${main.id}/labels`);
    const labelList = Object.entries(labels).map(([slug, v]) => ({ slug, ...(v || {}) }));
    const labelSlug = (w) => {
      const l = labelList.find((x) => [x.slug, x.en, x.tr].some((f) => norm(f) === norm(w)));
      return l ? l.slug : null;
    };
    const colId = (w) => (cols.find((x) => [x.id, x.title, x.title_tr].some((f) => norm(f) === norm(w))) || cols[0]).id;
    const have = new Set((await ADMIN.get(`/api/projects/${main.id}/tasks`)).map((t) => t.title));
    for (const t of EXTRA_MAIN) {
      if (have.has(t.title)) { skip(t.title); continue; }
      const r = await addTask(sess, slugOf, main.id, colId, labelSlug, t);
      c.task++; c.sub += r.subs; c.com += r.coms;
      ok(`[${t.col}] ${t.title}`);
    }
  }

  // ── notlar ──
  log('');
  log('\x1b[1m6. Notlar\x1b[0m');
  for (const n of NOTES) {
    await sess[n.who].post('/api/notes', { title: n.title, body: n.body, visibility: 'workspace' });
    c.note++; ok(n.title);
  }

  // ── kanallar ──
  log('');
  log('\x1b[1m7. Kanallar\x1b[0m');
  const boot = await ADMIN.get('/api/bootstrap');
  const haveChan = new Set((boot.channels || []).map((x) => norm(x.slug || x.name)));
  for (const CH of CHANNELS) {
    const slugGuess = norm(CH.name).replace(/\s+/g, '-');
    if (haveChan.has(slugGuess) || haveChan.has(norm(CH.name))) {
      skip(`#${CH.name} — zaten var`);
    } else {
      await ADMIN.post('/api/channels', {
        name: CH.name, type: 'public', description: CH.description,
        icon: CH.icon, member_slugs: [slugOf.a, slugOf.b],
      });
      c.chan++; ok(`#${CH.name}`);
    }
    for (const [who, text] of CH.messages) {
      await sess[who].post('/api/chat/messages', { text, channel: slugGuess });
      c.msg++;
    }
  }

  // ── DM ──
  log('');
  log('\x1b[1m8. Direkt mesajlar\x1b[0m');
  for (const [who, text] of DM) {
    const to = who === 'a' ? slugOf.b : slugOf.a;
    await sess[who].post('/api/chat/messages', { text, to });
    c.msg++;
  }
  ok(`${DM.length} mesaj (Test 1 ↔ Test 2)`);

  log('');
  log('\x1b[1m\x1b[32mBitti.\x1b[0m');
  log(`  ${c.proj} proje · ${c.task} görev · ${c.sub} alt görev · ${c.com} yorum`);
  log(`  ${c.note} not · ${c.chan} kanal · ${c.msg} mesaj`);
  log('');
}

main().catch((e) => { log(''); console.error('\x1b[31mHATA:\x1b[0m ' + e.message); log(''); process.exit(1); });
