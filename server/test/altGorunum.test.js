// Panonun alt görünümü — tanınmayan ad BOŞ EKRAN bırakıyordu (3 Ekim 2026).
//
// KUSUR: dört dal (`subView === 'list' | 'kanban' | 'table' | 'timeline'`)
// birbirinden bağımsız ve hiçbiri eşleşmezse ekranda ne kart, ne kolon, ne
// hata kalıyordu. `localStorage`daki `stoa.boardSubView` bayat ya da bozuk
// bir değer taşıyorsa (eski sürümden kalan bir ad, elle yazılmış bir şey)
// kullanıcı bomboş bir pano görüyor ve sebebi hiçbir yerde yazmıyor.
//
// NASIL BULUNDU: bir Playwright betiğinin kendi hatasıyla. Betik değeri
// `'board'` diye yazdı — doğrusu `'kanban'` — pano bomboş açıldı ve ölçüt
// "kart görünmüyor" dedi. Yani kusuru gösteren şey onun KAZAYLA
// tetiklenmesiydi; demek ki kullanıcıda da tetiklenebilir.
//
// ÖLÇÜT TEK ÖRNEĞİ DEĞİL SINIFI KAPATIYOR. Üç küme birbirine eşit olmak
// zorunda: tanınan adlar, seçicideki düğmeler, ve gerçekten çizilen dallar.
// Böylece yarın beşinci bir görünüm eklenip listeye yazılmazsa (ya da
// listeye yazılıp çizilmezse) test durduruyor — "bir daha olmasın" diye
// belgeye yazmak yerine olmasını imkânsız kılan basamak (CLAUDE.md).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOARD = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'board.jsx'));

/** `const ALT_GORUNUMLER = [...]` içindeki adlar. */
function taninanlar() {
  const m = BOARD.match(/const ALT_GORUNUMLER = \[([^\]]*)\]/);
  assert.ok(m, 'tanınan alt görünüm listesi bulunamadı');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** Seçici düğmelerinin kimlikleri — `subViews` dizisinden. */
function seciciler() {
  const bas = BOARD.indexOf('const subViews = [');
  assert.ok(bas > 0, 'alt görünüm seçicisi bulunamadı');
  const blok = BOARD.slice(bas, BOARD.indexOf('];', bas));
  return [...blok.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((x) => x[1]);
}

/** Gerçekten çizilen dallar — `subView === 'x'` koşulları. */
function dallar() {
  return [...new Set([...BOARD.matchAll(/subView === '([^']+)'/g)].map((x) => x[1]))];
}

describe('alt görünüm — tanınmayan ad boş ekran bırakmıyor', () => {
  test('ad TANINAN bir değere indirgeniyor', () => {
    assert.match(BOARD, /function altGorunum\(ad\) \{\s*\n\s*return ALT_GORUNUMLER\.includes\(ad\) \? ad : '([^']+)';/,
      'tanınmayan ad olduğu gibi kullanılıyor — hiçbir dal eşleşmezse ekran boş kalır');
  });

  test('yedek değer GERÇEKTEN çizilen bir görünüm', () => {
    // Yedeğin kendisi çizilmeyen bir ad olsa kusur aynen yerinde kalırdı:
    // indirgeme yapılır, ekran yine boş açılır.
    const m = BOARD.match(/return ALT_GORUNUMLER\.includes\(ad\) \? ad : '([^']+)';/);
    assert.ok(m, 'yedek değer okunamadı');
    assert.ok(dallar().includes(m[1]),
      `yedek "${m[1]}" çizilen bir görünüm değil — indirgeme boş ekranı çözmüyor`);
  });

  test('BAŞLANGIÇ değeri indirgemeden geçiyor', () => {
    // Kusur tam burada doğuyordu: `localStorage.getItem(...) || 'kanban'`
    // yalnızca YOKLUĞU karşılıyor, BOZUKLUĞU karşılamıyor.
    const bas = BOARD.indexOf('const [subView, setSubView] =');
    assert.ok(bas > 0, 'alt görünüm durumu bulunamadı');
    const satir = BOARD.slice(bas, BOARD.indexOf('\n', bas));
    assert.match(satir, /altGorunum\(/, 'başlangıç değeri indirgenmiyor');
    assert.doesNotMatch(satir, /localStorage\.getItem\('stoa\.boardSubView'\) \|\| 'kanban'\)?\s*$/,
      'eski (yalnızca yokluğu karşılayan) biçim geri gelmiş');
  });

  test('DIŞARIDAN gelen ad da indirgemeden geçiyor', () => {
    // `initialSubView` bugün çağrılmıyor ama prop yüzeyde duruyor; oradan
    // gelen bir ad indirgenmezse kusur ikinci bir kapıdan geri döner.
    const bas = BOARD.indexOf('if (initialSubView');
    assert.ok(bas > 0, 'dış ad kapısı bulunamadı');
    const satir = BOARD.slice(bas, BOARD.indexOf('\n', bas));
    assert.match(satir, /setSubView\(altGorunum\(initialSubView\)\)/,
      'dışarıdan gelen ad indirgenmeden duruma yazılıyor');
  });
});

describe('üç küme birbirine EŞİT — sınıf kapalı', () => {
  test('tanınan adlar = seçici düğmeleri', () => {
    // Listeye yazılmayan bir düğme, tıklandığında boş ekran açardı.
    assert.deepEqual([...taninanlar()].sort(), [...seciciler()].sort());
  });

  test('tanınan adlar = çizilen dallar', () => {
    // Çizilmeyen bir ad tanınıyorsa, indirgeme onu geçirir ve ekran boş
    // kalır — indirgemenin varlığı tek başına yetmiyor.
    assert.deepEqual([...taninanlar()].sort(), [...dallar()].sort());
  });

  test('ölçüt gerçekten dört görünümü görüyor', () => {
    // Ayırt edicilik kapısı: üç küme de BOŞ olsa yukarıdaki iki ölçüt
    // birbirine eşit çıkıp hiçbir şeyi ölçmezdi.
    assert.equal(taninanlar().length, 4);
    assert.deepEqual([...taninanlar()].sort(), ['kanban', 'list', 'table', 'timeline']);
  });
});
