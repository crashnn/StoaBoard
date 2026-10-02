/**
 * Arama metni karşılaştırma — istemci tarafı.
 *
 * NEDEN AYRI BİR DOSYA: istemcideki her arama düz `toLowerCase().includes()`
 * kullanıyordu ve Türkçe'de bu sessizce yanlış cevap veriyor. JavaScript
 * `'İş'.toLowerCase()` çağrısına "i" + ayrı bir birleşen nokta (U+0307)
 * döndürüyor, yani iki kod birimi; `.includes('is')` FALSE. Ters yönde de
 * aynısı: `'Kırılma'.toLowerCase()` "kırılma" kalıyor ve "kirilma" aramasını
 * bulamıyor.
 *
 * Sonuç, Türkçe klavyesi olmayan (ya da hızlı yazan) kullanıcının kartını
 * bulamaması. Kusur görünmüyor çünkü arama "sonuç yok" diyor — doğru
 * cevap veriyormuş gibi duruyor. Bu deponun "sessiz başarısızlıktan kaçın"
 * kuralının tam örneği, sadece kaçınılmamış hâli.
 *
 * KURAL SUNUCUDAN GELİYOR: `server/src/lib/mcpShape.js` içindeki `katla`
 * aynı soruyu MCP aramasında çözmüş ve gerekçesini oraya yazmış — I, İ, ı, i
 * hepsi "i" sayılıyor, çünkü pano iki dilli ve arama bulmak içindir, ayırmak
 * için değil. Burada ikinci bir tanım duruyor (istemci paketine sunucu kodu
 * girmesin diye) ama İKİSİNİN DENKLİĞİ test ile kilitli: `arama.test.js`
 * ikisini de yükleyip aynı tabloda karşılaştırıyor. Birini değiştiren
 * testi kırmak zorunda kalır.
 *
 * Ç, Ğ, Ö, Ş, Ü bilinçli olarak KAPSAM DIŞI — sunucudaki kararla aynı.
 * Onları da katlamak "öğe" aramasının "oge" ile bulunması demek olurdu;
 * ayrı bir ürün kararı, ayrıca İngilizce içerikte yanlış eşleşme üretir.
 * Nokta dörtlüsü en sık düşülen ve en ucuz kapanan kusur.
 */
export function katla(metin) {
  return String(metin ?? '')
    .replace(/[İIı]/g, 'i')
    .toLowerCase();
}

/**
 * `metin` arama sorgusunu içeriyor mu?
 *
 * BOŞ SORGU TRUE döndürüyor ve bu bilinçli: `includes('')` de öyle yapar,
 * yani çağrı yerleri `!q || kapsiyor(...)` yazmak zorunda kalmıyor.
 * Sunucudaki `aramaEslesir` ters yönde (boş sorgu false) çünkü orada soru
 * "bu kart arama sonucuna girer mi" — süzgeç değil arama. İki ayrı soru,
 * iki ayrı ad: aynı adı taşıyıp farklı davranan iki fonksiyon tuzak olurdu.
 */
export function kapsiyor(metin, sorgu) {
  return katla(metin).includes(katla(sorgu).trim());
}

/** Alanlardan BİRİ sorguyu içeriyorsa yeter. */
export function kapsiyorBiri(alanlar, sorgu) {
  const liste = Array.isArray(alanlar) ? alanlar : [alanlar];
  return liste.some((a) => kapsiyor(a, sorgu));
}
