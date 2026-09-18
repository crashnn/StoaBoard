// Kart çekmecesinin kırıntı satırı (kart #263).
//
// KUSUR (18 Eylül 2026, kullanıcı telefonda, ekran görüntülü): "Açık kartta id
// görünmüyor, id açık olmasına rağmen." İki kusur aynı satırdaydı:
//
//   1. Numara ÇİZİLİYORDU ama sıfır genişliğe eziliyordu. Daralma kuralı
//      `.drawer-crumbs > span:last-child`e yazılmıştı (kolon adı taşmasın diye);
//      numara açıkken son eleman NUMARANIN kendisi oluyordu. Telefonda başlık
//      dolu olduğu için (‹ 1/26 › + üç düğme) numara 0 px'e iniyordu.
//   2. Kırıntının ilk öğesi sabit "StoaBoard Web" metniydi — kartın projesi
//      ne olursa olsun. dil.test bunu yakalamıyordu: Türkçe harf yok.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya, yorumsuzKaynak } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');
const DRAWER = yorumsuzDosya(path.join(ISTEMCI, 'drawer.jsx'));
const CSS = yorumsuzKaynak(fs.readFileSync(path.join(ISTEMCI, 'styles.css'), 'utf8').replace(/\r\n/g, '\n'));

/** Kırıntı satırının kendisi: açılış div'inden eylem düğmelerine kadar. */
const KIRINTI = (() => {
  const i = DRAWER.indexOf('<div className="drawer-crumbs">');
  assert.notEqual(i, -1, 'kırıntı satırı bulunamadı');
  return DRAWER.slice(i, DRAWER.indexOf('<div className="drawer-head-actions">', i));
})();

/** Seçicisi tam olarak `secici` olan CSS kurallarının gövdeleri. */
const kurallar = (secici) => {
  const kacis = secici.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...CSS.matchAll(new RegExp(`(?:^|})\\s*${kacis}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
};

describe('çekmece kırıntısı — kart numarası ve proje adı (#263)', () => {
  test('proje adı kartın kendi projesinden, sabit metin yok', () => {
    assert.ok(!DRAWER.includes('StoaBoard Web'), 'sabit "StoaBoard Web" geri geldi');
    assert.match(DRAWER, /const projeAdi = \(window\.DATA\?\.PROJECTS \|\| \[\]\)\.find\(p => String\(p\.id\) === String\(task\.project_id\)\)\?\.name/,
      'proje adı kartın project_id\'sinden çözülmüyor');
    assert.match(KIRINTI, /\{projeAdi && <span className="crumb-text">\{projeAdi\}<\/span>\}/,
      'kırıntı proje adını göstermiyor');
  });

  test('numara kırıntıda ve hiç daralmıyor', () => {
    assert.match(KIRINTI, /className="card-id"/, 'numara kırıntıdan çıkmış');
    const govdeler = kurallar('.drawer-crumbs .card-id');
    assert.ok(govdeler.length > 0, '.drawer-crumbs .card-id kuralı yok');
    assert.ok(govdeler.some((g) => /flex-shrink:\s*0/.test(g)),
      'numara daralabilir — telefonda dolu başlıkta sıfır genişliğe ezilir');
  });

  test('daralma METİN kırıntılarına bağlı, sıraya değil', () => {
    // Sıraya bağlı bir daralma kuralı (son eleman, n'inci eleman) numarayı
    // yeniden yakalar: numara açıkken son eleman odur.
    assert.doesNotMatch(CSS, /\.drawer-crumbs\s*>\s*span:(last|nth)-/,
      'kırıntıda sıraya bağlı kural var — numara açıkken onu ezer');
    const metin = kurallar('.drawer-crumbs .crumb-text');
    assert.ok(metin.some((g) => /min-width:\s*0/.test(g) && /text-overflow:\s*ellipsis/.test(g)),
      'metin kırıntıları daralmıyor — uzun proje/kolon adı başlığı taşırır');
    // Kolon adı da metin kırıntısı: daralma ona uygulanmalı, numaraya değil.
    assert.match(KIRINTI, /<span className="crumb-text" style=\{\{ color: 'var\(--ink\)' \}\}>\{col\.title_tr\}<\/span>/,
      'kolon adı crumb-text sınıfını taşımıyor');
    assert.doesNotMatch(KIRINTI, /className="card-id[^"]*crumb-text|className="crumb-text[^"]*card-id/,
      'numara metin kırıntısı sınıfını almış — daralır');
  });
});
