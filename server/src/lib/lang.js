// İstek başına arayüz dili.
//
// Sunucu bazı metinleri kendisi üretiyor: CSV başlıkları, süre etiketleri ve
// içine kolon adı gömülen kolon geçiş hatası gibi dinamik mesajlar. Bunlar
// istemcide çevrilemiyor, çünkü metnin içindeki değerler sunucuda oluşuyor.
//
// İstemci dili iki yoldan geçiriyor: indirme bağlantılarında ?lang (başlık
// eklenemiyor, adres doğrudan tarayıcıya veriliyor), diğer her istekte
// X-Stoa-Lang başlığı — apiFetch onu her çağrıya ekliyor.
//
// 'tr' ve 'en' dışındaki diller sözlükte zaten Türkçe'ye düştüğü için burada
// da 'tr'ye indirgeniyor.
export function reqLang(req) {
  const raw = req.query?.lang || req.get?.('X-Stoa-Lang') || '';
  return String(raw).toLowerCase().startsWith('en') ? 'en' : 'tr';
}
