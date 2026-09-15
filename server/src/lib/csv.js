// CSV üretimi — saf, bağımlılıksız.
//
// Kendi modülünde duruyor çünkü burada bir güvenlik kuralı yaşıyor ve o kuralın
// veritabanı olmadan test edilebilmesi gerekiyor.

/**
 * Ayraç SEKME, kodlama UTF-16LE — Excel'in "Unicode metin" biçimi.
 *
 * TARİHÇE (15 Eylül 2026'da değişti). Önceki biçim UTF-8 BOM + `sep=;`
 * yönergesi + noktalı virgüldü ve iki tuzağı vardı:
 *
 * 1. Excel, dosya `sep=` ile başlayınca eski içe aktarma yoluna geçiyor ve
 *    UTF-8 BOM'u YOK SAYIYOR: sütunlar doğru ayrılıyor, Türkçe karakterler
 *    "baÄŸlayÄ±cÄ±" oluyor. Demo provasında akış raporunda görüldü.
 * 2. `sep=` olmadan ayraç Windows BÖLGE ayarına bağlı (Office dilinden
 *    bağımsız): Türkiye bölgesi `;`, ABD bölgesi `,`. Aynı ofiste ikisi de
 *    var; hangisini seçersek öbür makinede her satır tek sütuna yığılıyor.
 *
 * UTF-16LE BOM'lu dosyayı Excel her bölgede aynı okuyor: kodlamayı BOM'dan
 * alıyor ve ayraç olarak sekmeyi kullanıyor; `sep=` gerekmiyor. Uzantı
 * `.csv` kalıyor. Bedeli: Excel dışı araçlar dosyayı `utf-16` diye açmalı
 * (pandas: `encoding='utf-16'`); hedef kitle Excel açan yöneticiler.
 *
 * Metin düzeyinde `CSV_BOM` U+FEFF'tir; `csvBuffer` bütün metni UTF-16LE'ye
 * çevirdiğinde bu karakter dosyanın başında `FF FE` bayt çiftine dönüşür —
 * yani UTF-16LE BOM'un ta kendisi. Ayrı bir bayt eklenmez.
 */
export const CSV_SEPARATOR = '\t';

/** Metin BOM'u (U+FEFF); UTF-16LE'ye çevrilince `FF FE`. */
export const CSV_BOM = '﻿';

/** HTTP yanıtı için içerik türü — charset BOM'la tutarlı olmalı. */
export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-16';

/**
 * Bir hücreyi CSV için güvenli hâle getir.
 *
 * İki ayrı iş yapıyor ve ikisi karıştırılmamalı:
 *
 * 1. Ayraç kaçışı — tırnak, sekme, noktalı virgül, satır sonu içeren
 *    değerler tırnak içine alınır. Noktalı virgül artık ayraç değil ama
 *    tırnaklanmaya devam ediyor: zararsız, eski testleri ve eski dosyaları
 *    okuyan araçları bozmuyor.
 *
 * 2. Formül koruması — bu bir GÜVENLİK gereği. Excel, '=' '+' '-' '@' (ve
 *    sekme/CR) ile başlayan hücreyi formül sayıp çalıştırıyor ve tırnak içine
 *    almak bunu engellemiyor. Rapor dosyalarındaki görev başlıkları ile kişi
 *    adları kullanıcı girdisi, dosyayı açan ise genelde yönetici; yani saldırı
 *    veriyi değil, veriyi açan kişiyi hedefliyor. Baştaki tek tırnak Excel'de
 *    görünmez, hücreyi metin olarak sabitler.
 *
 * Sayılar dokunulmadan geçer; aksi halde negatif değerler formül korumasına
 * takılıp metne dönüşürdü.
 */
export function csvCell(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);

  const s = v === null || v === undefined ? '' : String(v);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;

  return /[";\t\n\r]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}

/**
 * Başlık satırı ve satırlardan CSV METNİ üret (henüz kodlanmamış).
 * Başa BOM konur, satırlar CRLF ile ayrılır (Excel beklentisi).
 * `sep=` yönergesi bilerek YOK — Excel onu görünce BOM'u yok sayıyordu;
 * gerekçe dosyanın başında.
 */
export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(CSV_SEPARATOR)];
  for (const r of rows) lines.push(r.map(csvCell).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join('\r\n');
}

/**
 * HTTP gövdesi: `toCsv` metninin UTF-16LE baytları. İlk iki bayt `FF FE`
 * (BOM), sonrası her karakter iki bayt. Yanıt Buffer olarak gönderilir;
 * string gönderilseydi Express UTF-8'e çevirir, BOM anlamını yitirirdi.
 */
export function csvBuffer(headers, rows) {
  return Buffer.from(toCsv(headers, rows), 'utf16le');
}
