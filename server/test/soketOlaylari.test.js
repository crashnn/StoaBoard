// Soket olay adları — iki uç aynı kümeyi konuşuyor (3 Ekim 2026).
//
// NİÇİN VAR: gerçek zamanlı bir uygulamada en pahalı sessiz kusur, adların
// ayrışması. Sunucu `note_updated` yayınlar, istemci `note_update` dinler ve
// özellik ÖLÜ doğar: hata yok, kayıt yok, ekranda yalnızca "bazen
// güncellenmiyor" var. Bu deponun bir toplantıyı yakan sınıfı
// (`lib/emit.js`in başındaki not) tam buydu, orada yayının kendisi
// sessizdi; buradaki ikinci biçim, yayın çalışıyor ama kimse dinlemiyor.
//
// NASIL ORTAYA ÇIKTI: sınıf aramasında (0-AQ) elle grep atıldı ve ON olay
// "istemci dinliyor, sunucu yayınlamıyor" diye göründü. Hepsi yanlış
// alarmdı — sunucuda BEŞ ayrı yayın yolu var (`.emit` doğrudan, `panoYayini`,
// `emitToUsers`, `emitNoteEvent`, ve bunları saran `etkinlikYayini`) ve grep
// üçünü görmüyordu. Yani soru elle cevaplanamıyor; cevaplayacak şey test.
//
// TARAMA YAPICA TAM, ve bu dosyanın en önemli özelliği bu. Önce bir kural
// kilitleniyor: `server/src` içindeki HER `.emit(` çağrısı ya düz metin ya da
// kapsayan işlevin olay PARAMETRESİNİ alır. Bu kural tutuyorsa olay adlarının
// tamamı ya `.emit('X'` olarak ya da bir sarmalayıcı ÇAĞRISINDA metin olarak
// görünür — başka saklanacak yer yok. Yeni bir sarmalayıcı eklenirse tarama
// onu kendiliğinden buluyor, çünkü `.emit(<param>)` kalıbından geriye
// izliyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { yorumsuzKaynak } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUNUCU = path.resolve(__dirname, '..', 'src');
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');

/** Bir ağaçtaki bütün .js/.jsx dosyaları, yorumları boşluğa çevrilmiş. */
function kaynaklar(kok, uzantilar) {
  const cikti = [];
  const gez = (dizin) => {
    for (const ad of fs.readdirSync(dizin)) {
      const tam = path.join(dizin, ad);
      const st = fs.statSync(tam);
      if (st.isDirectory()) { gez(tam); continue; }
      if (!uzantilar.some((u) => ad.endsWith(u))) continue;
      cikti.push({ yol: tam, src: yorumsuzKaynak(fs.readFileSync(tam, 'utf8').replace(/\r\n/g, '\n')) });
    }
  };
  gez(kok);
  return cikti;
}

const SUNUCU_KAYNAK = kaynaklar(SUNUCU, ['.js']);
const ISTEMCI_KAYNAK = kaynaklar(ISTEMCI, ['.js', '.jsx']);

const OLAY_ADI = /^[a-z][a-z0-9_]*$/;

/**
 * `.emit(` çağrılarının ilk argümanları: metin olanlar ve değişken olanlar.
 */
function emitArgumanlari() {
  const metin = new Set();
  const degisken = new Set();
  for (const { src } of SUNUCU_KAYNAK) {
    for (const m of src.matchAll(/\.emit\(\s*('([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))/g)) {
      const d = m[2] ?? m[3];
      if (d !== undefined) metin.add(d);
      else degisken.add(m[4]);
    }
  }
  return { metin, degisken };
}

/**
 * Olay adını PARAMETRE olarak alan sarmalayıcıların adları.
 *
 * `.emit(<ad>)` görülen her dosyada, o adı parametre listesinde taşıyan
 * işlev aranıyor. Böylece sarmalayıcı listesi elle tutulmuyor.
 */
function sarmalayicilar(degiskenler) {
  const adlar = new Set();
  for (const { src } of SUNUCU_KAYNAK) {
    for (const d of degiskenler) {
      if (!src.includes(`.emit(${d}`)) continue;
      for (const m of src.matchAll(
        new RegExp(`function\\s+([A-Za-z_$][\\w$]*)\\s*\\([^)]*\\b${d}\\b[^)]*\\)`, 'g'),
      )) adlar.add(m[1]);
    }
  }
  return adlar;
}

/** Sarmalayıcı çağrılarında geçen olay adları. */
function sarmalayiciOlaylari(adlar) {
  const olaylar = new Set();
  for (const { src } of SUNUCU_KAYNAK) {
    for (const ad of adlar) {
      // OLAY ADI İKİNCİ ARGÜMAN. İlk yazışımda "çağrının içindeki bütün
      // metinleri topla" diyordum ve pencere `\)` ile kapanıyordu; çağrılar
      // `emitNoteEvent(req.app.get('io'), 'note_created', …)` biçiminde
      // olduğu için pencere `.get('io'` noktasında bitiyordu. Sonuç iki
      // yönlü yanlıştı: `'io'` olay sanıldı VE gerçek adlar kaçtı. Yani
      // taramanın kendi kusuru, ölçtüğü kusuru hem uyduruyor hem gizliyordu.
      //
      // `[^,]*` ilk argümanı virgüle kadar yutuyor; `req.app.get('io')`
      // içinde virgül olmadığı için nokta atışı, ve çok satırlı çağrılarda
      // da çalışıyor (virgül olmayan her şeyi, satır sonları dahil, geçer).
      for (const m of src.matchAll(
        new RegExp(`\\b${ad}\\(\\s*[^,]*,\\s*'([a-z][a-z0-9_]*)'`, 'g'),
      )) olaylar.add(m[1]);
    }
  }
  return olaylar;
}

/** İstemcinin dinlediği soket olayları. */
function istemciDinleyicileri() {
  const olaylar = new Set();
  for (const { src } of ISTEMCI_KAYNAK) {
    for (const m of src.matchAll(/\b(?:sock|socket|s|io)\s*\.\s*(?:io\s*\.\s*)?on\(\s*'([a-z][a-z0-9_]*)'/g)) {
      olaylar.add(m[1]);
    }
  }
  return olaylar;
}

// Socket.IO'nun kendi olayları — sunucu kodu bunları yayınlamaz.
const YERLESIK = new Set(['connect', 'disconnect', 'connect_error', 'reconnect_attempt', 'reconnect', 'error']);

// İSTEMCİNİN KENDİ YAYINLADIĞI olaylar: sunucu bunları DİNLER, yayınlamaz.
// `typing` iki yönlü — hem istemci gönderiyor hem sunucu dağıtıyor.
const ISTEMCI_YAYINI = new Set([]);

describe('yayın yolu — tarama kör kalamaz', () => {
  test('her `.emit(` ya METİN ya OLAY PARAMETRESİ alıyor', () => {
    // Bu testin TEMELİ. Tutmazsa aşağıdaki karşılaştırma eksik tarar ve
    // sessizce "her şey yolunda" der. Yeni bir yayın yolu eklenirse (olay
    // adı bir nesneden, bir diziden ya da bir şablondan geliyorsa) burası
    // durduruyor ve tarama güncellenmeye zorlanıyor.
    const { degisken } = emitArgumanlari();
    const beklenen = new Set(['olay', 'event']);
    for (const d of degisken) {
      assert.ok(beklenen.has(d),
        `\`.emit(${d})\` — tanınmayan yayın yolu. Olay adı artık taramanın `
        + 'göremediği bir yerden geliyor; bu dosyadaki tarama güncellenmeli.');
    }
  });

  test('sarmalayıcılar KAYNAKTAN bulunuyor, elle yazılmıyor', () => {
    const { degisken } = emitArgumanlari();
    const adlar = sarmalayicilar(degisken);
    // Bugün üç tane: `panoYayini`, `emitToUsers`, `emitNoteEvent`.
    assert.ok(adlar.size >= 3, `yalnızca ${adlar.size} sarmalayıcı bulundu: ${[...adlar]}`);
    for (const beklenen of ['panoYayini', 'emitToUsers', 'emitNoteEvent']) {
      assert.ok(adlar.has(beklenen), `${beklenen} bulunamadı — tarama kör`);
    }
  });

  test('tarama GERÇEKTEN olay buluyor — ayırt edicilik kapısı', () => {
    // İki küme de boş olsa aşağıdaki eşitlik ölçütleri hiçbir şey ölçmezdi.
    const { metin, degisken } = emitArgumanlari();
    const hepsi = new Set([...metin, ...sarmalayiciOlaylari(sarmalayicilar(degisken))]);
    assert.ok(hepsi.size >= 20, `sunucuda yalnızca ${hepsi.size} olay bulundu`);
    assert.ok(istemciDinleyicileri().size >= 20,
      `istemcide yalnızca ${istemciDinleyicileri().size} dinleyici bulundu`);
  });
});

describe('iki uç AYNI kümeyi konuşuyor', () => {
  const sunucuOlaylari = () => {
    const { metin, degisken } = emitArgumanlari();
    const hepsi = new Set([...metin]);
    for (const o of sarmalayiciOlaylari(sarmalayicilar(degisken))) hepsi.add(o);
    return new Set([...hepsi].filter((o) => OLAY_ADI.test(o)));
  };

  test('İSTEMCİNİN DİNLEDİĞİ her olay sunucuda YAYINLANIYOR', () => {
    // Kaçırılan hâli: istemci `note_update` dinler, sunucu `note_updated`
    // yayınlar. Özellik ölü doğar; hata yok, kayıt yok, "bazen
    // güncellenmiyor" var.
    const sunucu = sunucuOlaylari();
    const eksik = [...istemciDinleyicileri()]
      .filter((o) => !YERLESIK.has(o) && !ISTEMCI_YAYINI.has(o) && !sunucu.has(o));
    assert.deepEqual(eksik, [],
      'Bu olayları istemci dinliyor ama sunucu hiç yayınlamıyor — özellik ölü:\n  '
      + eksik.join(', '));
  });

  test('SUNUCUNUN YAYINLADIĞI her olay istemcide DİNLENİYOR', () => {
    // Ters yön: yayın yapılıyor, karşı taraf bakmıyor. Sunucu boşa iş
    // yapıyor ve bir ekran kendiliğinden tazelenmiyor.
    const dinlenen = istemciDinleyicileri();
    const bosa = [...sunucuOlaylari()].filter((o) => !dinlenen.has(o));
    assert.deepEqual(bosa, [],
      'Bu olaylar yayınlanıyor ama istemci dinlemiyor — boşa yayın:\n  ' + bosa.join(', '));
  });
});
