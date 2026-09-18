// Gezinme hedefleri — her "şuraya git" ÇİZİLEN bir görünüme varmalı.
//
// KUSUR SINIFI (18 Eylül 2026): var olmayan bir görünüme gitmek hata vermiyor,
// hiçbir dalı çizmiyor — ekran sessizce boş kalıyor. Bu sınıfa iki kez düşüldü:
//
//   1. Dashboard "Tümünü gör" → onView('list'). Liste çoktan panonun alt
//      görünümü olmuştu; kullanıcı gerçek cihazda beyaz ekran gördü (#202).
//   2. Hukuki sayfanın kapat düğmesi, oturumsuzken onViewChange('auth').
//      'auth' diye bir görünüm yok (giriş ekranını `authed` açar); giriş
//      yapınca içerik alanı boştu ve adres efekti 'auth'u diske yazdığı için
//      her yenilemede yine boş açılıyordu.
//
// Ayrıca kayıtlı görünüm (`stoa.view`) üç yerde okunuyordu ve eski `list`
// göçünü yalnızca biri yapıyordu — aynı olgunun birden çok okuyucusu.
//
// Bu dosya iki şeyi kilitliyor: (a) kaynaktaki her SABİT gezinme hedefi
// app.jsx'in gerçekten çizdiği bir görünüm, (b) `stoa.view`in tek okuyucusu
// rota.js. Değişken hedefli çağrılar (`setView(dest)`) burada ölçülmüyor;
// onların kaynağı olan tablolar (G_MAP, komut paleti `goto:`) ölçülüyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GORUNUM_YOLLARI, HUKUKI_YOLLAR, hatirlananGorunum, hatirlananGorunumuOku,
} from '../../client/src/rota.js';
import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');
const APP = yorumsuzDosya(path.join(ISTEMCI, 'app.jsx'));

const HUKUKI = [...HUKUKI_YOLLAR].map((y) => y.slice(1));

// İstemci kaynakları bir kez okunuyor (yorumsuz): data.jsx büyük, her testte
// yeniden okumak dosyayı saniyelerce uzatıyordu.
const KAYNAK = new Map(
  kaynakDosyalari(ISTEMCI, /\.jsx?$/).map((d) => [
    path.relative(ISTEMCI, d).replace(/\\/g, '/'),
    yorumsuzDosya(d),
  ]),
);

// app.jsx'in ÇİZDİĞİ görünümler: oturum açık render bloğundaki JSX dalları,
// `{view === 'x' && …}` ya da `{!taskPageTask && view === 'x' && …}` biçimi.
// Blok `const crumb =` ile başlıyor; üstteki etkilerdeki karşılaştırmalar
// kesiliyor. Düz `view === 'x'` aranmıyor: render içindeki bir üçlü ifade
// (`view === 'list' ? a : b`) hiçbir şey çizmediği hâlde ölçütü aklardı.
const RENDER = (() => {
  const i = APP.indexOf('const crumb =');
  assert.ok(i > 0, 'app.jsx render bloğu bulunamadı (const crumb =)');
  return APP.slice(i);
})();
const DAL = /\{\s*(?:!taskPageTask\s*&&\s*)?\(?view === '([a-z-]+)'(?:\s*\|\|\s*view === '([a-z-]+)')?\)?\s*&&/g;
const CIZILEN = new Set([...RENDER.matchAll(DAL)].flatMap((m) => [m[1], m[2]]).filter(Boolean));

describe('gezinme — çizilen görünümler ile adres tablosu aynı küme', () => {
  test('her adresli görünüm app.jsx\'te çiziliyor', () => {
    for (const g of Object.keys(GORUNUM_YOLLARI)) {
      assert.ok(CIZILEN.has(g), `${g} adres alıyor ama app.jsx onu çizmiyor — adrese gelen boş ekran görür`);
    }
  });

  test('çizilen her görünüm ya adres tablosunda ya hukuki', () => {
    // Yeni bir görünüm eklendiyse adresi de eklenmeli; yoksa durumdanYol onu
    // /pano'ya çevirir ve yenileyen kullanıcı panoda uyanır.
    for (const g of CIZILEN) {
      assert.ok(Object.hasOwn(GORUNUM_YOLLARI, g) || HUKUKI.includes(g),
        `${g} çiziliyor ama rota.js GORUNUM_YOLLARI'nda yok`);
    }
  });
});

describe('gezinme — sabit hedefler çizilen bir görünüme varıyor', () => {
  const CAGRI = /\b(?:setView|onView|onViewChange)\s*(?:\?\.)?\s*\(/g;

  // Çağrının argümanı, dengeli parantezle — iç içe çağrı (`hatirlananGorunumuOku()`)
  // argümanı erken kesmesin.
  const arguman = (src, acilis) => {
    let derinlik = 0;
    for (let i = acilis; i < src.length; i++) {
      if (src[i] === '(') derinlik++;
      else if (src[i] === ')' && --derinlik === 0) return src.slice(acilis + 1, i);
    }
    return src.slice(acilis + 1);
  };

  // Argümandaki SONUÇ konumundaki literaller: başta ya da `?` `:` `||` `??`
  // sonrasında. Yalnızca baştakine bakan ilk desen
  // `onViewChange(authed ? x : 'auth')` biçimini kaçırıyordu (mutasyon buldu).
  // Karşılaştırmadaki literal (`x === 'foo' ? …`) hedef değil, sayılmıyor.
  const HEDEF = /(?:^|\?(?!\.)|:|\|\||\?\?)\s*['"]([a-z-]+)['"]/g;

  test('setView / onView / onViewChange hedefleri', () => {
    const bulunan = new Map(); // dosya → hedefler
    for (const [ad, src] of KAYNAK) {
      for (const m of src.matchAll(CAGRI)) {
        const arg = arguman(src, m.index + m[0].length - 1);
        for (const h of arg.matchAll(HEDEF)) {
          if (!bulunan.has(ad)) bulunan.set(ad, []);
          bulunan.get(ad).push(h[1]);
          assert.ok(CIZILEN.has(h[1]),
            `${ad}: '${h[1]}' görünümüne gidiliyor ama app.jsx onu çizmiyor — ekran boş kalır`);
        }
      }
    }
    // Desen bir gün hiçbir şeye uymazsa test boşuna yeşil kalmasın: bilinen
    // üç çağıranın hepsi görülmüş olmalı.
    for (const beklenen of ['app.jsx', 'shell.jsx', 'views/dashboard.jsx']) {
      assert.ok(bulunan.has(beklenen), `${beklenen} içinde gezinme çağrısı bulunamadı — desen kaymış olabilir`);
    }
  });

  test('G kısayol tablosu (G_MAP)', () => {
    const m = /const G_MAP = \{([^}]*)\}/.exec(APP);
    assert.ok(m, 'G_MAP bulunamadı');
    const hedefler = [...m[1].matchAll(/:\s*'([a-z-]+)'/g)].map((x) => x[1]);
    assert.ok(hedefler.length > 0, 'G_MAP değerleri okunamadı');
    for (const h of hedefler) assert.ok(CIZILEN.has(h), `G_MAP → '${h}' çizilmiyor`);
  });

  test('komut paleti goto: eylemleri', () => {
    const data = KAYNAK.get('data.jsx');
    const eylemler = [...data.matchAll(/action:\s*'goto:([a-z-]+)'/g)].map((x) => x[1]);
    assert.ok(eylemler.length > 0, 'goto: eylemi bulunamadı');
    for (const e of eylemler) {
      // Özel karşılanan eylem (ör. goto:board-list → pano + liste alt görünümü)
      // kendi dalına sahip; kalanlar setView(action.slice(5)) ile gidiyor.
      const ozel = APP.includes(`action === 'goto:${e}'`);
      assert.ok(ozel || CIZILEN.has(e), `goto:${e} ne özel karşılanıyor ne çizilen bir görünüm`);
    }
  });
});

describe('gezinme — hatırlanan görünüm (stoa.view) tek okuyucudan', () => {
  test('gerçek görünüm aynen dönüyor', () => {
    for (const g of Object.keys(GORUNUM_YOLLARI)) {
      assert.deepEqual(hatirlananGorunum(g), { gorunum: g, altGorunum: null });
    }
  });

  test('eski list kaydı panonun liste alt görünümüne göçüyor', () => {
    assert.deepEqual(hatirlananGorunum('list'), { gorunum: 'board', altGorunum: 'list' });
  });

  test('geçersiz kayıt panoya düşüyor — auth, hukuki, prototip, boş', () => {
    for (const k of ['auth', 'gizlilik-sartlari', 'hizmet-sartlari', 'toString', '__proto__', '', null, undefined, 'xyz']) {
      assert.deepEqual(hatirlananGorunum(k), { gorunum: 'board', altGorunum: null }, `kayıt: ${String(k)}`);
    }
  });

  test('okuyucu depoya yalnızca göçte yazıyor', () => {
    const sahte = (deger) => {
      const yazilan = {};
      return {
        yazilan,
        getItem: (k) => (k === 'stoa.view' ? deger : null),
        setItem: (k, v) => { yazilan[k] = v; },
      };
    };
    const eski = sahte('list');
    assert.equal(hatirlananGorunumuOku(eski), 'board');
    assert.deepEqual(eski.yazilan, { 'stoa.boardSubView': 'list' });

    const normal = sahte('calendar');
    assert.equal(hatirlananGorunumuOku(normal), 'calendar');
    assert.deepEqual(normal.yazilan, {});
  });

  test('istemcide stoa.view başka hiçbir yerde okunmuyor', () => {
    // Üç okuyucu vardı, göçü biri yapıyordu. Yeni bir okuyucu eklemek isteyen
    // hatirlananGorunumuOku'yu çağırmalı.
    const OKUMA = /getItem\(\s*['"`]stoa\.view['"`]/;
    assert.match(KAYNAK.get('rota.js'), OKUMA, 'tek okuyucu rota.js\'te değil — ölçüt boşa dönüyor');
    for (const [ad, src] of KAYNAK) {
      if (ad === 'rota.js') continue;
      assert.doesNotMatch(src, OKUMA,
        `${ad} stoa.view'i kendisi okuyor — rota.js hatirlananGorunumuOku kullanılmalı`);
    }
  });
});
