// Kart gövdesi (`task.doc`) blok belgesinin saf denetimi — bağımlılıksız.
//
// NİÇİN VAR (15 Eylül 2026): çekmece blok düzenleyiciye dönüştü (Enter yeni
// paragraf, "/" ile tür seçimi). O güne kadar sunucu `doc`u olduğu gibi
// saklıyordu; yalnızca kontrol listesi bloğunu reddediyordu
// (lib/checklist.js). İstemci artık blok üretebildiği için sınır burada
// olmalı: bilinmeyen tür, aşırı uzun metin ya da şişirilmiş blok sayısı
// veritabanına girmesin. İstemcinin doğru davranmasına güvenmek yeterli
// değil — MCP de `doc` yazabilir, eski sekme de.
//
// GÜVENLİK NOTU: blok metni HİÇBİR YERDE HTML olarak basılmaz; istemci
// React metni olarak çizer. Bu dosya biçimi denetler, kaçış yapmaz — kaçış
// gerektiren bir çizim yolu açılırsa yanlış yer burası değil, orası olur
// (bildirim metnindeki saklı XSS dersi, bildirimMetni.js).

/** Kabul edilen blok türleri. `checklist` bilerek yok (alt görev tablosu). */
export const DOC_TURLERI = new Set(['h1', 'h2', 'h3', 'p', 'ul', 'pre', 'quote', 'callout']);

/** Tek blok metni için üst sınır (karakter). Açıklama senkronu zaten 1000'e kırpıyor. */
export const DOC_METIN_SINIRI = 10000;

/** Bir belgedeki blok sayısı üst sınırı. */
export const DOC_BLOK_SINIRI = 300;

/**
 * `doc`u denetler. Dönüş: `{ ok: true }` ya da `{ ok: false, sebep }`.
 * Sebep insan için (Türkçe), hata kodu çağıranın (`err_doc_invalid`).
 *
 * `null` kabul edilir: uç `doc: null`u "gövdeyi kaldır" diye okuyor.
 * Kontrol listesi burada denetlenmiyor; onun kendi kodu ve mesajı var
 * (`err_doc_checklist_retired`), sırası uçta önce geliyor.
 */
export function docDenetle(doc) {
  if (doc === null || doc === undefined) return { ok: true };
  if (!Array.isArray(doc)) return { ok: false, sebep: 'doc bir dizi olmalı' };
  if (doc.length > DOC_BLOK_SINIRI) return { ok: false, sebep: `en fazla ${DOC_BLOK_SINIRI} blok` };
  for (let i = 0; i < doc.length; i += 1) {
    const b = doc[i];
    if (!b || typeof b !== 'object') return { ok: false, sebep: `blok ${i}: nesne değil` };
    if (!DOC_TURLERI.has(b.kind)) return { ok: false, sebep: `blok ${i}: bilinmeyen tür "${String(b.kind)}"` };
    if (b.kind === 'ul') {
      if (!Array.isArray(b.items)) return { ok: false, sebep: `blok ${i}: liste maddeleri dizi olmalı` };
      if (b.items.length > DOC_BLOK_SINIRI) return { ok: false, sebep: `blok ${i}: en fazla ${DOC_BLOK_SINIRI} madde` };
      for (const it of b.items) {
        if (typeof it !== 'string' || it.length > DOC_METIN_SINIRI) return { ok: false, sebep: `blok ${i}: madde metni geçersiz` };
      }
      continue;
    }
    if (b.text !== undefined && typeof b.text !== 'string') return { ok: false, sebep: `blok ${i}: metin dize olmalı` };
    if ((b.text || '').length > DOC_METIN_SINIRI) return { ok: false, sebep: `blok ${i}: metin ${DOC_METIN_SINIRI} karakteri aşıyor` };
  }
  return { ok: true };
}

/**
 * Açıklama (`description`) senkronu için düz metin: MCP ve liste görünümü
 * gövdeyi buradan görür. Düzyazı blokları girer (başlık, paragraf, alıntı,
 * uyarı kutusu, liste maddeleri); kod bloğu girmez — bir yapıştırılmış
 * yığın açıklamayı ezmesin.
 */
export function docDuzMetin(doc) {
  if (!Array.isArray(doc)) return '';
  const parcalar = [];
  for (const b of doc) {
    if (!b) continue;
    if (b.kind === 'ul' && Array.isArray(b.items)) { parcalar.push(...b.items.filter((x) => typeof x === 'string' && x)); continue; }
    if (['h1', 'h2', 'h3', 'p', 'quote', 'callout'].includes(b.kind) && b.text) parcalar.push(b.text);
  }
  return parcalar.join(' ').slice(0, 1000);
}
