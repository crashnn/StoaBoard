// Dokunmatik jestler — tek kaynak (client/src/jest.js; kartlar #238 #265 #267).
//
// #238'in eşik/hız/dokunmatik ölçütleri drawer.jsx içindeydi ve mobil.test.js
// onları kaynak tarayarak kilitliyordu. #265 (yatay kaydır → komşu kart) ve
// #267 (sohbet panelini aşağı çek → kapat) aynı mantığı isteyince mantık saf
// bir modüle taşındı. Kazanç yalnızca kopya yasağı değil: karar artık
// GERÇEK GİRDİYLE ölçülüyor (mesafe, süre, boyut), "kaynakta `j.y / sure`
// geçiyor mu" diye değil.
//
// İşleyici fabrikaları da sahte bir öğe ve sahte dokunma olaylarıyla
// sınanıyor: yön kilidi, satır içi stilin temizlenmesi, uçta direnç.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import {
  YON_ESIGI_PX, KENAR_PAYI_PX, DIRENC,
  yonKilidi, esikGecildi, gecisKarari, kenardanMi, izlemeMesafesi,
  dikeyCekJesti, yatayKaydirJesti,
} from '../../client/src/jest.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ISTEMCI = path.join(KOK, 'client', 'src');

// ── Saf kararlar ──────────────────────────────────────────────────────────

describe('yonKilidi — ilk hareket yönü belirler', () => {
  test('eşik altında karar yok', () => {
    assert.equal(yonKilidi(YON_ESIGI_PX - 1, 0), null);
    assert.equal(yonKilidi(3, -4), null);
  });
  test('yatay ve dikey ayrışıyor; eğikte büyük eksen kazanıyor', () => {
    assert.equal(yonKilidi(-30, 5), 'yatay');
    assert.equal(yonKilidi(2, 40), 'dikey');
    assert.equal(yonKilidi(12, 11), 'yatay');
    assert.equal(yonKilidi(11, 12), 'dikey');
  });
});

describe('esikGecildi — İKİ eşik: uzun sürükleme VE hızlı fiske', () => {
  // Tek eşik ikisinden birini yanlış yorumlar: yalnızca mesafe fiskeyi görmez,
  // yalnızca hız dikkatli sürüklemeyi görmez.
  test('yavaş ama uzun sürükleme geçiyor', () => {
    assert.equal(esikGecildi({ mesafe: 250, sure: 2000, boyut: 800 }), true);
  });
  test('kısa ama hızlı fiske geçiyor', () => {
    assert.equal(esikGecildi({ mesafe: 90, sure: 100, boyut: 800 }), true);
  });
  test('kısa ve yavaş geçmiyor — geri yaylanır', () => {
    assert.equal(esikGecildi({ mesafe: 90, sure: 800, boyut: 800 }), false);
  });
  test('çok kısa hareket hızlı olsa da fiske değil', () => {
    // Parmak titremesi 20 px'i 10 ms'de alabilir; o kapatma değildir.
    assert.equal(esikGecildi({ mesafe: 20, sure: 10, boyut: 800 }), false);
  });
  test('eşik ekran boyutuna göre — küçük telefonda daha kısa mesafe yeter', () => {
    assert.equal(esikGecildi({ mesafe: 150, sure: 2000, boyut: 500 }), true);
    assert.equal(esikGecildi({ mesafe: 150, sure: 2000, boyut: 800 }), false);
  });
  test('sıfır süre bölme hatası üretmiyor', () => {
    assert.equal(esikGecildi({ mesafe: 100, sure: 0, boyut: 800 }), true);
  });
});

describe('gecisKarari — sola sonraki, sağa önceki, kolon sonunda dur', () => {
  const komsular = { onceki: true, sonraki: true };
  test('sola kaydırma SONRAKİ kart (galeri alışkanlığı)', () => {
    assert.equal(gecisKarari({ dx: -200, sure: 300, genislik: 400, ...komsular }), 'sonraki');
  });
  test('sağa kaydırma ÖNCEKİ kart', () => {
    assert.equal(gecisKarari({ dx: 200, sure: 300, genislik: 400, ...komsular }), 'onceki');
  });
  test('eşik altında geçiş yok', () => {
    assert.equal(gecisKarari({ dx: -40, sure: 800, genislik: 400, ...komsular }), null);
  });
  test('yönde komşu yoksa eşik geçilse de null — öteki kolona atlamaz (#246)', () => {
    assert.equal(gecisKarari({ dx: -300, sure: 100, genislik: 400, onceki: true, sonraki: false }), null);
    assert.equal(gecisKarari({ dx: 300, sure: 100, genislik: 400, onceki: false, sonraki: true }), null);
  });
});

describe('kenar payı ve uçta direnç', () => {
  test('ekran kenarından başlayan dokunuş tarayıcının', () => {
    assert.equal(kenardanMi(KENAR_PAYI_PX - 1, 400), true);
    assert.equal(kenardanMi(400 - KENAR_PAYI_PX + 1, 400), true);
    assert.equal(kenardanMi(200, 400), false);
  });
  test('komşu varken birebir izler, yokken dirençli', () => {
    assert.equal(izlemeMesafesi(-100, { onceki: true, sonraki: true }), -100);
    assert.equal(izlemeMesafesi(-100, { onceki: true, sonraki: false }), -100 * DIRENC);
    assert.equal(izlemeMesafesi(100, { onceki: false, sonraki: true }), 100 * DIRENC);
  });
});

// ── İşleyici fabrikaları (sahte DOM) ──────────────────────────────────────

const dokun = (x, y, target = { nodeType: 1, tagName: 'DIV', parentElement: null }) => ({
  touches: [{ clientX: x, clientY: y }],
  target,
});

function sahteOrtam({ dokunmatik = true } = {}) {
  globalThis.window = {
    innerHeight: 800,
    innerWidth: 400,
    matchMedia: () => ({ matches: dokunmatik }),
  };
  globalThis.document = { activeElement: null, getSelection: () => ({ isCollapsed: true, toString: () => '' }) };
  globalThis.getComputedStyle = () => ({ overflowX: 'visible' });
}
function ortamiKaldir() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.getComputedStyle;
}

describe('dikeyCekJesti — aşağı çek → kapat', () => {
  beforeEach(() => sahteOrtam());
  afterEach(ortamiKaldir);

  const kur = (ek = {}) => {
    const el = { style: {} };
    let kapandi = 0;
    const j = dikeyCekJesti({ panel: () => el, kapat: () => { kapandi += 1; }, ...ek });
    return { el, j, kapandi: () => kapandi };
  };

  test('uzun aşağı çekiş kapatıyor ve satır içi stili temizliyor', () => {
    const { el, j, kapandi } = kur();
    j.onTouchStart(dokun(100, 100));
    j.onTouchMove(dokun(100, 130));
    assert.equal(el.style.transform, 'translateY(30px)', 'parmağı izlemiyor');
    j.onTouchMove(dokun(100, 400));
    j.onTouchEnd();
    assert.equal(kapandi(), 1);
    assert.equal(el.style.transform, '', 'stil temizlenmedi — CSS geri alamaz');
    assert.equal(el.style.transition, '');
  });

  test('eşik altında kapanmıyor, stil yine temizleniyor (geri yaylanma)', () => {
    const { el, j, kapandi } = kur();
    j.onTouchStart(dokun(100, 100));
    j.onTouchMove(dokun(100, 150));
    j.onTouchEnd();
    assert.equal(kapandi(), 0);
    assert.equal(el.style.transform, '');
  });

  test('yukarı çekiş 0\'da duruyor', () => {
    const { el, j } = kur();
    j.onTouchStart(dokun(100, 300));
    j.onTouchMove(dokun(100, 200));
    assert.equal(el.style.transform, 'translateY(0px)');
  });

  test('YATAY başlayan hareket dikey jesti tetiklemiyor (yön kilidi)', () => {
    const { el, j, kapandi } = kur();
    j.onTouchStart(dokun(100, 100));
    j.onTouchMove(dokun(140, 105));   // önce yatay → kilit yatay
    j.onTouchMove(dokun(140, 500));   // sonra aşağı — artık dikey değil
    assert.equal(el.style.transform, undefined, 'yatay kilitliyken dikey izleme yapıldı');
    j.onTouchEnd();
    assert.equal(kapandi(), 0);
  });

  test('dokunmatik değilse jest hiç kurulmuyor', () => {
    ortamiKaldir(); sahteOrtam({ dokunmatik: false });
    const { el, j, kapandi } = kur();
    j.onTouchStart(dokun(100, 100));
    j.onTouchMove(dokun(100, 500));
    assert.equal(el.style.transform, undefined, 'fareli cihazda parmak izlendi');
    j.onTouchEnd();
    assert.equal(kapandi(), 0);
  });

  test('etkin() yanlışsa kurulmuyor — sohbette yazarken (#267)', () => {
    const { j, kapandi } = kur({ etkin: () => false });
    j.onTouchStart(dokun(100, 100));
    j.onTouchMove(dokun(100, 500));
    j.onTouchEnd();
    assert.equal(kapandi(), 0);
  });

  test('iki parmak jest değil', () => {
    const { j, kapandi } = kur();
    j.onTouchStart({ touches: [{ clientX: 1, clientY: 1 }, { clientX: 2, clientY: 2 }] });
    j.onTouchMove(dokun(100, 500));
    j.onTouchEnd();
    assert.equal(kapandi(), 0);
  });

  test('iptalde stil temizleniyor', () => {
    const { el, j } = kur();
    j.onTouchStart(dokun(100, 100));
    j.onTouchMove(dokun(100, 200));
    j.onTouchCancel();
    assert.equal(el.style.transform, '');
  });
});

describe('yatayKaydirJesti — kaydır → komşu kart (#265)', () => {
  beforeEach(() => sahteOrtam());
  afterEach(ortamiKaldir);

  const kur = (komsu = { onceki: true, sonraki: true }) => {
    const el = { style: {} };
    const gecisler = [];
    const j = yatayKaydirJesti({ panel: () => el, komsu: () => komsu, gec: (y) => gecisler.push(y) });
    return { el, j, gecisler };
  };

  test('sola uzun kaydırma sonraki karta geçiyor, stil temizleniyor', () => {
    const { el, j, gecisler } = kur();
    j.onTouchStart(dokun(300, 200));
    j.onTouchMove(dokun(150, 205));
    assert.equal(el.style.transform, 'translateX(-150px)');
    j.onTouchEnd();
    assert.deepEqual(gecisler, ['sonraki']);
    assert.equal(el.style.transform, '');
  });

  test('DİKEY başlayan hareket (okuma) yatay jesti tetiklemiyor', () => {
    const { el, j, gecisler } = kur();
    j.onTouchStart(dokun(200, 100));
    j.onTouchMove(dokun(203, 140));   // aşağı → kilit dikey
    j.onTouchMove(dokun(20, 140));    // sonra sola — artık yatay değil
    assert.equal(el.style.transform, undefined);
    j.onTouchEnd();
    assert.deepEqual(gecisler, []);
  });

  test('kolon sonunda dirençle izliyor ve geçmiyor', () => {
    const { el, j, gecisler } = kur({ onceki: true, sonraki: false });
    j.onTouchStart(dokun(300, 200));
    j.onTouchMove(dokun(100, 200));
    assert.equal(el.style.transform, `translateX(${-200 * DIRENC}px)`);
    j.onTouchEnd();
    assert.deepEqual(gecisler, []);
  });

  test('ekran kenarından başlayan dokunuş tarayıcıya bırakılıyor', () => {
    const { j, gecisler } = kur();
    j.onTouchStart(dokun(5, 200));
    j.onTouchMove(dokun(300, 200));
    j.onTouchEnd();
    assert.deepEqual(gecisler, []);
  });

  test('metin kutusundan başlayan hareket jest değil (imleç taşınır)', () => {
    const { j, gecisler } = kur();
    const kutu = { nodeType: 1, tagName: 'TEXTAREA', parentElement: null };
    j.onTouchStart(dokun(300, 200, kutu));
    j.onTouchMove(dokun(50, 200, kutu));
    j.onTouchEnd();
    assert.deepEqual(gecisler, []);
  });

  test('yatay kayan içerikten (kod bloğu) başlayan hareket jest değil', () => {
    const { j, gecisler } = kur();
    const pre = { nodeType: 1, tagName: 'PRE', parentElement: null, scrollWidth: 900, clientWidth: 300 };
    globalThis.getComputedStyle = () => ({ overflowX: 'auto' });
    j.onTouchStart(dokun(300, 200, pre));
    j.onTouchMove(dokun(50, 200, pre));
    j.onTouchEnd();
    assert.deepEqual(gecisler, []);
  });

  test('seçili metin varken jest değil (seçimi genişletme)', () => {
    const { j, gecisler } = kur();
    globalThis.document.getSelection = () => ({ isCollapsed: false, toString: () => 'seçim' });
    j.onTouchStart(dokun(300, 200));
    j.onTouchMove(dokun(50, 200));
    j.onTouchEnd();
    assert.deepEqual(gecisler, []);
  });
});

// ── Bağlantı: sohbet paneli ve CSS ────────────────────────────────────────

describe('sohbet paneli aşağı çek → kapat (#267) — ortak modüle bağlı', () => {
  const CHAT = yorumsuzDosya(path.join(ISTEMCI, 'chat.jsx'));
  const CSS = yorumsuzDosya(path.join(ISTEMCI, 'styles.css'));

  test('jest kuruluyor, yazarken kapalı, yalnızca panel kipinde', () => {
    const i = CHAT.indexOf('cekJestRef.current = dikeyCekJesti({');
    assert.ok(i >= 0, 'sohbet paneli dikeyCekJesti kurmuyor');
    const blok = CHAT.slice(i, CHAT.indexOf('});', i));
    assert.match(blok, /etkin: \(\) => !yaziliyorMu\(\)/, 'yazma kutusu odaktayken jest kapanmıyor');
    assert.match(CHAT, /const cekJest = fullPage \? \{\} : cekJestRef\.current;/, 'tam sayfada da jest bağlanıyor');
    assert.match(CHAT, /className="chat-drag" \{\.\.\.cekJest\}/, 'jest başlık bölgesine bağlı değil');
    assert.match(CHAT, /className="chat-grab" aria-hidden="true"/, 'tutamak yok — görünmez jest olmayan jesttir');
    assert.match(CHAT, /className="chat-panel"[^>]*ref=\{panelRef\}/, 'kaydırılacak panel ref almıyor');
  });

  test('tutamak dokunmatik bloğunda, varsayılan gizli; liste kaydırma zinciri kesik', () => {
    assert.match(CSS, /\.chat-grab \{ display: none; \}/, 'sohbet tutamağı varsayılan gizli değil');
    const bas = CSS.indexOf('@media (pointer: coarse)');
    const blok = CSS.slice(bas, CSS.indexOf('\n}\n', bas));
    assert.match(blok, /\.chat-grab\s*\{/, 'sohbet tutamağı dokunmatik kuralına bağlı değil');
    assert.match(blok, /\.drawer \{ touch-action: pan-y; \}/, 'çekmecede yatay hareket tarayıcıya kalıyor (#265)');
    const m = CSS.indexOf('.chat-messages {');
    assert.match(CSS.slice(m, CSS.indexOf('}', m)), /overscroll-behavior-y:\s*contain/, 'mesaj listesinden çekmek sayfayı yeniler');
  });
});
