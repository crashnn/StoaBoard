// Kart açıklamasının düz metinden paragraflara ayrılması — saf, test edilebilir.
//
// ── Kusur (17 Eylül 2026) ─────────────────────────────────────────────────
//
// Kullanıcı bildirdi: "kartta açıklama girince çok karmaşık görünüyor... karta
// işlenince text area olur da rastgele yazarsın, bir nizam yoktur."
//
// Ölçüldüğünde haklıydı ve sebep şaşırtıcıydı: metnin YAPISI KAYITTA VARDI,
// ekranda yoktu. `drawer.jsx` açıklamanın TAMAMINI tek bir `p` bloğuna
// koyuyordu, satır sonlarıyla birlikte. HTML'de `\n` boşluğa çöktüğü için
// başlıklar, madde imleri ve ayraçlar tek bir paragrafa akıyordu. Veri hiç
// bozulmamıştı; kayıp yalnızca çizimdeydi.
//
// Bu modül `drawer.jsx`ten AYRI duruyor çünkü kural saf: girdi düz metin,
// çıktı paragraf dizisi, React yok. Depoda bu kalıp var — `rozet.js` ve
// `bildirimMetni.js` de böyle ve sunucu testleri onları doğrudan içe aktarıyor.
// Kaynak taramak yerine davranışı ölçmek mümkün olsun diye.

/**
 * Düz metni paragraflara ayırır.
 *
 * BOŞ SATIR paragraf sınırıdır — tek satır sonu değil. Tek satır sonları
 * paragrafın içinde KALIYOR ve çizim tarafında `white-space: pre-wrap` ile
 * korunuyor; madde imi listeleri, ayraç satırları ve girintili bloklar bu
 * sayede bütün kalıyor. İki mekanizma birbirini tamamlıyor: burası paragraf
 * ARALIĞINI verir, CSS satır SONUNU korur. Yalnızca biri olursa yarım kalır.
 *
 * Satır sonu normalizasyonu bilinçli: açıklamalar MCP'den, tarayıcıdan ve içe
 * aktarmadan geliyor ve üçü aynı satır sonunu kullanmıyor. `\r\n` bölünmeden
 * geçerse sınır bulunamaz ve metin yine tek paragrafa düşer.
 *
 * @param {string} metin
 * @returns {string[]} paragraflar; metin boşsa boş dizi
 */
export function paragraflaraBol(metin) {
  if (metin === null || metin === undefined) return [];
  return String(metin)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n[ \t]*\n+/)
    // Sondaki boşluk siliniyor, BAŞTAKİ değil: girinti yazarın kararı ve
    // `pre-wrap` onu gösteriyor. İkisini birden kırpmak girintili blokları
    // (kartlara yazılan SQL ve kod parçaları gibi) sola yapıştırırdı.
    .map((p) => p.replace(/[ \t]+$/gm, '').replace(/\n+$/, ''))
    .filter((p) => p.trim() !== '');
}
