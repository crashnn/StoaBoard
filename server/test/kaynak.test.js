// Kaynak ve belge dosyalarında ham kontrol karakteri olmamalı.
//
// ── Korunan kusur (13 Eylül 2026) ─────────────────────────────────────────
//
// Aynı gün iki kez oldu. Etiket temizleyen düzenli ifade kaçış dizisiyle
// (`\u0000` gibi) yazıldı ama dosyaya HAM kontrol karakteri olarak düştü:
// düzenleme aracı parametredeki `\u` kaçışlarını yazmadan önce çözüyordu.
// Birincisi `lib/mcpToken.js`teydi ve kod yine çalışıyordu — bu yüzden sinsi:
// `grep` dosyayı "Binary file matches" diye ikili saydı, yani dosyadaki her
// arama sessizce boş dönmeye başladı. İkincisi aynı ifadeyi alıntılayan
// DEVIR.md paragrafına düştü.
//
// Düzeltmek yetmedi; üçüncüsü belgeye yazılarak engellenemezdi. Nitekim
// üçüncüsü bu dosyanın kendi başlığına düştü (yukarıdaki örnek kaçış) ve test
// İLK koşusunda onu yakaladı — mutasyon aranmadan, gerçek bir vakayla. Tarama
// sekme, satır sonu ve satır başı dışındaki bütün C0 kontrol karakterlerini ve
// DEL'i arıyor. Karakter gerçekten gerekiyorsa kaynakta kaçış dizisiyle
// yazılmalı (`String.fromCharCode(0)`, `\u0000` metni).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');

const KAPSAM = [
  [path.join(KOK, 'server', 'src'), /\.(js|mjs|cjs)$/],
  [path.join(KOK, 'server', 'test'), /\.(js|mjs|cjs)$/],
  [path.join(KOK, 'server', 'scripts'), /\.(js|mjs|cjs)$/],
  [path.join(KOK, 'server', 'prisma'), /\.prisma$/],
  [path.join(KOK, 'client', 'src'), /\.(js|jsx|css)$/],
];

function belgeler() {
  return fs.readdirSync(KOK).filter((ad) => ad.endsWith('.md')).map((ad) => path.join(KOK, ad));
}

/** Sekme (9), satır sonu (10) ve satır başı (13) dışındaki C0 karakterleri ve DEL. */
function kontrolKarakterleri(metin) {
  const bulunan = [];
  let satir = 1;
  for (let i = 0; i < metin.length; i += 1) {
    const k = metin.charCodeAt(i);
    if (k === 10) { satir += 1; continue; }
    if ((k < 32 && k !== 9 && k !== 13) || k === 127) bulunan.push({ satir, kod: k });
  }
  return bulunan;
}

describe('kaynak dosyaları — ham kontrol karakteri yok', () => {
  const dosyalar = [
    ...KAPSAM.flatMap(([dizin, desen]) => (fs.existsSync(dizin) ? kaynakDosyalari(dizin, desen) : [])),
    ...belgeler(),
  ];

  test('tarama gerçekten dosya buluyor', () => {
    assert.ok(dosyalar.length > 60, `yalnızca ${dosyalar.length} dosya bulundu — kapsam bozuk olabilir`);
    assert.ok(dosyalar.some((d) => d.endsWith('DEVIR.md')), 'belgeler taranmıyor');
  });

  test('hiçbir dosyada ham kontrol karakteri yok', () => {
    const bulgular = [];
    for (const dosya of dosyalar) {
      for (const { satir, kod } of kontrolKarakterleri(fs.readFileSync(dosya, 'utf8'))) {
        bulgular.push(`${path.relative(KOK, dosya)}:${satir}  U+${kod.toString(16).padStart(4, '0')}`);
      }
    }
    assert.deepEqual(
      bulgular.slice(0, 20), [],
      'Ham kontrol karakteri var. Kaynakta kaçış dizisiyle yaz; araç parametredeki '
      + '\\u kaçışlarını çözüp ham karakter yazabiliyor (13 Eylül).',
    );
  });

  test('tarayıcı kontrol karakterini gerçekten görüyor', () => {
    const ornek = `a${String.fromCharCode(0)}b\n${String.fromCharCode(31)}\tc${String.fromCharCode(127)}`;
    assert.deepEqual(kontrolKarakterleri(ornek), [{ satir: 1, kod: 0 }, { satir: 2, kod: 31 }, { satir: 2, kod: 127 }]);
    assert.deepEqual(kontrolKarakterleri('sekme\tve\r\nsatır'), []);
  });
});
