// Ters eğik çizgisi kaybolmuş düzenli ifadeler (kart #210 aile taraması).
//
// KUSUR (18 Eylül 2026): kontrast.test.js'teki "sohbet mesajı satır içi renk
// taşımıyor" testi `/style:s*{[^}]*}/` desenini kullanıyordu — `\s*` yazılırken
// ters eğik çizgi kaybolmuş. Desen hiçbir şeye eşleşmiyordu, test her zaman
// yeşildi ve tam koruduğu kusur (balon içinde satır içi tema rengi) sessizce
// geri geldi: kullanıcı "ek okunamaz" dedi.
//
// Nasıl oluyor: bir kabuk heredoc'u ya da çift tırnaklı komut `\\`yi `\`ye,
// `\s`yi `s`ye indirebiliyor. Aynı gün bu oturumda üç kez daha oldu; her
// seferinde dosya ya yüklenmedi ya da çapa tutmadı — ama bir desenin içinde
// kaybolursa HİÇBİR ŞEY BOZULMAZ, yalnızca test körleşir.
//
// Ölçüt: düzenli ifade değişmezinde, önünde harf/rakam/ters eğik çizgi
// OLMAYAN `s*`, `s+`, `d+`, `w+`… — kaybolmuş `\s`, `\d`, `\w`nin izi.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');

const REGEX_DEGISMEZI = /(?:^|[=(,:!&|?\s])\/((?:\\.|[^/\n\\])+)\/[gimsuy]*/g;
const KAYIP_TERS_CIZGI = /(^|[^\\A-Za-z0-9_])[sdw][*+?](?![a-z])/;

function bul(dosyalar) {
  const out = [];
  for (const dosya of dosyalar) {
    const satirlar = fs.readFileSync(dosya, 'utf8').split('\n');
    satirlar.forEach((satir, i) => {
      if (/^\s*(\/\/|\*)/.test(satir)) return; // yorum satırı
      for (const m of satir.matchAll(REGEX_DEGISMEZI)) {
        if (KAYIP_TERS_CIZGI.test(m[1])) out.push(`${path.relative(KOK, dosya)}:${i + 1}  /${m[1]}/`);
      }
    });
  }
  return out;
}

describe('düzenli ifadelerde kaybolmuş ters eğik çizgi yok (#210)', () => {
  test('ölçüt kör değil — bilinen bozuk deseni yakalıyor', () => {
    const gecici = path.join(__dirname, '.desen-ornek.tmp.js');
    // Örnekteki bölü işareti karakter koduyla üretiliyor: kaynakta düz yazılsaydı
    // aşağıdaki tarama bu dosyanın kendisinde onu bulurdu.
    const b = String.fromCharCode(47);
    fs.writeFileSync(gecici, `const a = jsx.matchAll(${b}style:s*{[^}]*}${b}g);\n`);
    try {
      assert.equal(bul([gecici]).length, 1, 'tarama kontrast.test.js\'i körleştiren deseni bile görmüyor');
    } finally {
      fs.unlinkSync(gecici);
    }
  });

  test('testlerde ve kaynakta kaybolmuş \\s / \\d / \\w izi yok', () => {
    const dosyalar = [
      ...kaynakDosyalari(path.join(KOK, 'server', 'test'), /\.js$/),
      ...kaynakDosyalari(path.join(KOK, 'server', 'src'), /\.js$/),
      ...kaynakDosyalari(path.join(KOK, 'client', 'src'), /\.jsx?$/),
    ];
    assert.ok(dosyalar.length > 50, 'dosya listesi boş — tarama hiçbir şeye bakmıyor');
    assert.deepEqual(bul(dosyalar), [],
      'Düzenli ifadede ters eğik çizgisi kaybolmuş görünen desen var. `s*` büyük olasılıkla '
      + '`\\s*` olmalıydı — desen hiçbir şeye eşleşmez ve onu kullanan test körleşir.');
  });
});
