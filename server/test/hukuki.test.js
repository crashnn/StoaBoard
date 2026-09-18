// Hukuki sayfalar (gizlilik / hizmet şartları) — oturumsuz görünüm (kart #254).
//
// KUSUR (18 Eylül 2026, kullanıcı gizli sekmede, ekran görüntülü): sayfa
// "1. bölüm"ün ortasından başlıyordu; logo, başlık ve Kapat düğmesi hiç
// görünmüyordu — Kapat'a ulaşılamadığı için sayfadan çıkılamıyordu. Kap
// `.app` kabuğunun (100dvh, overflow: hidden) içinde `alignItems: center` ile
// dikey ortalıyordu: uzun içerikte taşma yukarıya da dağılıyor ve kaydırma
// alanının DIŞINDA kalıyor.
//
// Aynı satırda React'in sessizce yok saydığı bir yazım hatası vardı:
// `justifycontent` (küçük c) — Kapat düğmesi sağa yaslanmıyordu. Aile
// taraması: istemcinin stil nesnelerinde küçük harfle yazılmış başka anahtar
// yok; bundan sonrası testle kilitli.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');
const LEGAL = yorumsuzDosya(path.join(ISTEMCI, 'views', 'legal.jsx'));

/** `bas`tan itibaren ilk `style={{ … }}` nesnesinin gövdesi. */
const stilGovdesi = (src, bas) => {
  const i = src.indexOf('style={{', src.indexOf(bas));
  assert.notEqual(i, -1, `stil bulunamadı: ${bas}`);
  return src.slice(i, src.indexOf('}}', i));
};

describe('hukuki sayfa — oturumsuz görünüm üstten başlıyor (#254)', () => {
  test('dış kap kendi kaydırma alanı ve DİKEY ORTALAMIYOR', () => {
    const kap = stilGovdesi(LEGAL, 'className="legal-page-public"');
    assert.match(kap, /overflowY: 'auto'/, 'kap kaydırılamıyor');
    assert.match(kap, /height: '100%'/, 'kap kabuğu doldurmuyor — kabuk keser');
    assert.doesNotMatch(kap, /alignItems: 'center'/,
      'kap dikey ortalıyor — uzun içerikte üst kısım kaydırma alanının dışına taşar');
  });

  test('ortalama kartın margin:auto\'sundan — taşınca sıfıra iner', () => {
    // Kartın kendi stil nesnesi: `maxWidth: 720`yi taşıyan nesne.
    const i = LEGAL.indexOf('maxWidth: 720');
    assert.notEqual(i, -1, 'kart bulunamadı');
    const govde = LEGAL.slice(LEGAL.lastIndexOf('style={{', i), LEGAL.indexOf('}}', i));
    assert.match(govde, /margin: 'auto'/, 'kart ortalanmıyor ya da ortalama kaptan geliyor');
  });
});

describe('stil nesneleri — küçük harfle yazılmış anahtar yok (aile)', () => {
  test('istemcideki style={{ }} içinde camelCase anahtarın küçük harfli hâli yok', () => {
    const dosyalar = kaynakDosyalari(ISTEMCI, /\.jsx$/).map((d) => [path.relative(ISTEMCI, d), yorumsuzDosya(d)]);
    const govdeler = [];
    for (const [ad, src] of dosyalar) {
      for (const m of src.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) govdeler.push([ad, m[1], m.index, src]);
    }
    const bilinen = new Set();
    for (const [, g] of govdeler) for (const k of g.matchAll(/\b([a-z]+[A-Z][A-Za-z]*)\s*:/g)) bilinen.add(k[1]);
    const kucuk = new Map([...bilinen].map((k) => [k.toLowerCase(), k]));
    assert.ok(kucuk.has('justifycontent'), 'tarama kör — bilinen anahtarlar toplanmamış');
    const bulgular = [];
    for (const [ad, g, idx, src] of govdeler) {
      for (const k of g.matchAll(/(?:^|[{,\s])([a-z]{6,})\s*:/g)) {
        const dogru = kucuk.get(k[1]);
        if (dogru && dogru !== k[1]) bulgular.push(`${ad}:${src.slice(0, idx).split('\n').length} ${k[1]} → ${dogru}`);
      }
    }
    assert.deepEqual(bulgular, [], `React'in sessizce yok saydığı stil anahtarı:\n${bulgular.join('\n')}`);
  });
});
