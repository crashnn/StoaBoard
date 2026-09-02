// CSV üretimi — saf, bağımlılıksız.
//
// Kendi modülünde duruyor çünkü burada bir güvenlik kuralı yaşıyor ve o kuralın
// veritabanı olmadan test edilebilmesi gerekiyor.

/** Excel'in Türkçe yerel ayarı virgülle ayrılmış dosyayı tek sütuna yığıyor. */
export const CSV_SEPARATOR = ';';

/** Excel UTF-8'i BOM olmadan yanlış okuyor, Türkçe karakterler bozuluyor. */
export const CSV_BOM = '﻿';

/**
 * Bir hücreyi CSV için güvenli hâle getir.
 *
 * İki ayrı iş yapıyor ve ikisi karıştırılmamalı:
 *
 * 1. Ayraç kaçışı — tırnak, noktalı virgül, satır sonu içeren değerler
 *    tırnak içine alınır. Bu bir biçim gereği.
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

  return /[";\n\r]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}

/**
 * Başlık satırı ve satırlardan CSV gövdesi üret.
 * Başa BOM konur, satırlar CRLF ile ayrılır (Excel beklentisi).
 *
 * İlk satır 'sep=;' yönergesi: Excel bu satırı yerel ayarından bağımsız okur ve
 * ayracı ona göre seçer. Onsuz, yerel ayarı virgül olan Excel (örn. İngilizce
 * kurulum) noktalı virgülü tanımıyor ve tüm satırı tek sütuna yığıyordu —
 * Türkçe Excel ise noktalı virgül beklediği için ters durum yaşanıyordu. Bu
 * yönerge ikisini de doğru açar. Bedeli: Excel dışı araçlar (bazı sürümlerde
 * Google Sheets) bu satırı düz bir hücre olarak gösterebilir; hedef Excel.
 */
export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(CSV_SEPARATOR)];
  for (const r of rows) lines.push(r.map(csvCell).join(CSV_SEPARATOR));
  return CSV_BOM + `sep=${CSV_SEPARATOR}\r\n` + lines.join('\r\n');
}
