// Klavye kısayolları — tek kaynak (3 Ekim 2026).
//
// ÜÇ KUSUR BİR ARADAYDI ve hepsi aynı sınıf: belge koddan ayrışmıştı.
//
// 1. ÖZELLEŞTİRME HİÇBİR ŞEY YAPMIYORDU. Ayarlar ekranı `stoa.shortcuts`e
//    yazıyor, "kaydedildi" gösteriyor ve o anahtarı KİMSE okumuyordu;
//    işleyici tuşları gömülü tutuyordu. Kullanıcı "Yeni görev"i T yapıyor,
//    T hiçbir şey yapmıyor, N hâlâ çalışıyor. Sessizce hiçbir şey yapmayan
//    bir ayar, olmayan bir ayardan kötü: kullanıcı onu denemiş ve
//    uygulamanın bozuk olduğunu düşünmüştür.
//
// 2. LİSTE GERÇEKLE İKİ YÖNDE AYRIŞMIŞTI. Ayarlar `G,H`yi "Ana sayfa" diye
//    yazıyordu ama haritada `h` yoktu (panel `G,D`); `/` (arama odakla) da
//    yazılıydı ve hiçbir yerde işleyicisi yoktu. Tersi de doğruydu: `G+N`,
//    `G+R`, `G+T`, `G+D` çalışıyor ama listede yoktu.
//
// 3. Ekranda kısayol yardımı yoktu.
//
// CLAUDE.md'nin merdiveni: kural BELGEDE yazılıydı ve kod başka şey
// yapıyordu. Çözüm belgeyi düzeltmek değil KALDIRMAK — liste artık
// doğrulanan şeyin kendisi. Bu dosyanın asıl işi o tekliği zorlamak:
// ikinci bir liste doğmasın, ve listedeki her girdinin gerçekten bir
// işleyici yolu olsun.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import {
  KISAYOLLAR, BOLUMLER, DEGISTIRICILER, tusAtamalari, eslesenKisayol, diziBaslatiyorMu, kisayol,
} from '../../client/src/kisayollar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const istemci = (...p) => path.resolve(__dirname, '..', '..', 'client', 'src', ...p);
const APP = yorumsuzDosya(istemci('app.jsx'));
const AYAR = yorumsuzDosya(istemci('views', 'settings.jsx'));
const YARDIM = yorumsuzDosya(istemci('kisayolYardimi.jsx'));

const olay = (key, ek = {}) => ({ key, ctrlKey: false, metaKey: false, ...ek });

describe('liste — tutarlılık', () => {
  test('kimlikler TEK', () => {
    const idler = KISAYOLLAR.map((k) => k.id);
    assert.equal(new Set(idler).size, idler.length, 'yinelenen kısayol kimliği');
  });

  test('her girdi bir tür taşıyor ve tür TANINIYOR', () => {
    const TURLER = new Set(['palet', 'kart', 'arama', 'gnav', 'kacis', 'bilgi']);
    for (const k of KISAYOLLAR) {
      assert.ok(TURLER.has(k.tur), `${k.id} tanınmayan tür: ${k.tur}`);
      assert.ok(Array.isArray(k.tuslar) && k.tuslar.length > 0, `${k.id} tuşsuz`);
      assert.ok(k.anahtar && k.yedek, `${k.id} çeviri taşımıyor`);
    }
  });

  test('gnav girdileri G ile başlıyor ve HEDEF taşıyor', () => {
    for (const k of KISAYOLLAR.filter((x) => x.tur === 'gnav')) {
      assert.equal(k.tuslar.length, 2, `${k.id} iki tuşlu değil`);
      assert.equal(k.tuslar[0], 'G', `${k.id} dizi G ile başlamıyor`);
      assert.ok(k.hedef, `${k.id} hedef görünüm taşımıyor`);
    }
  });

  test('gnav tuşları ÇAKIŞMIYOR', () => {
    // İki kısayol aynı ikinci tuşu alsa biri sessizce ulaşılamaz olurdu.
    const ikinci = KISAYOLLAR.filter((k) => k.tur === 'gnav').map((k) => k.tuslar[1]);
    assert.equal(new Set(ikinci).size, ikinci.length, 'iki gezinme kısayolu aynı tuşta');
  });

  test('BÖLÜMLER listenin TAMAMINI kapsıyor', () => {
    // Bölüme yazılmayan bir kısayol `?` yardımında HİÇ görünmezdi — yani
    // keşfedilemezlik kusuru yeni bir kapıdan geri gelirdi.
    const bolumde = new Set(BOLUMLER.flatMap((b) => b.idler));
    for (const k of KISAYOLLAR) {
      assert.ok(bolumde.has(k.id), `${k.id} hiçbir bölümde yok — yardımda görünmez`);
    }
    // Ters yön: olmayan bir kimliği bölüme yazmak sessizce hiçbir şey
    // göstermez.
    for (const id of bolumde) {
      assert.ok(kisayol(id), `bölümde olmayan kısayol: ${id}`);
    }
  });
});

describe('atamalar — özelleştirme GERÇEKTEN uygulanıyor', () => {
  test('özel atama varsayılanı EZİYOR', () => {
    const a = tusAtamalari({ new_task: ['T'] });
    assert.deepEqual(a.new_task, ['T']);
  });

  test('özel atama yoksa varsayılan', () => {
    assert.deepEqual(tusAtamalari(null).new_task, ['N']);
    assert.deepEqual(tusAtamalari({}).new_task, ['N']);
  });

  test('ÖZELLEŞTİRİLEMEZ girdinin özel ataması YOK SAYILIYOR', () => {
    // Bayat ya da elle yazılmış bir `stoa.shortcuts` Esc'i başka tuşa
    // alabilirdi ve kullanıcı açık bir panelden çıkamazdı.
    assert.deepEqual(tusAtamalari({ close_panels: ['Q'] }).close_panels, ['Esc']);
  });

  test('bozuk değer varsayılana düşüyor, patlamıyor', () => {
    assert.deepEqual(tusAtamalari({ new_task: [] }).new_task, ['N']);
    assert.deepEqual(tusAtamalari({ new_task: 'T' }).new_task, ['N']);
    assert.deepEqual(tusAtamalari('bozuk').new_task, ['N']);
  });
});

describe('eşleşme — saf', () => {
  test('Ctrl+K paleti açıyor', () => {
    assert.equal(eslesenKisayol(olay('k', { ctrlKey: true })), 'cmd_palette');
    assert.equal(eslesenKisayol(olay('k', { metaKey: true })), 'cmd_palette', 'Mac yuvası yok');
  });

  test('CTRL olmadan K palet DEĞİL', () => {
    // Yoksa metin dışında her K palet açardı.
    assert.notEqual(eslesenKisayol(olay('k')), 'cmd_palette');
  });

  test('N yeni görev, / arama', () => {
    assert.equal(eslesenKisayol(olay('n')), 'new_task');
    assert.equal(eslesenKisayol(olay('/')), 'search');
  });

  test('büyük/küçük harf FARK ETMİYOR', () => {
    assert.equal(eslesenKisayol(olay('N')), 'new_task');
  });

  test('G dizisi İÇİNDEYKEN tek tuşlar devre dışı', () => {
    // `gBekliyor` iken N "yeni görev" olmamalı; dizinin ikinci tuşu olarak
    // değerlendirilmeli (ve `go_notes` o).
    assert.equal(eslesenKisayol(olay('n'), { gBekliyor: true }), 'go_notes');
  });

  test('G dizisi DIŞINDA gnav eşleşmiyor', () => {
    // Yoksa B tuşu panoya götürürdü ve kullanıcı sebebini bulamazdı.
    assert.equal(eslesenKisayol(olay('b')), null);
  });

  test('her gnav ikinci tuşu KENDİ kimliğini veriyor', () => {
    for (const k of KISAYOLLAR.filter((x) => x.tur === 'gnav')) {
      assert.equal(eslesenKisayol(olay(k.tuslar[1].toLowerCase()), { gBekliyor: true }), k.id);
    }
  });

  test('ÖZEL atama eşleşmeye yansıyor — kusurun kendisi buydu', () => {
    const atamalar = tusAtamalari({ new_task: ['T'], go_board: ['G', 'P'] });
    assert.equal(eslesenKisayol(olay('t'), { atamalar }), 'new_task');
    assert.equal(eslesenKisayol(olay('n'), { atamalar }), null, 'eski tuş hâlâ çalışıyor');
    assert.equal(eslesenKisayol(olay('p'), { gBekliyor: true, atamalar }), 'go_board');
    assert.equal(eslesenKisayol(olay('b'), { gBekliyor: true, atamalar }), null);
  });

  test('`bilgi` girdileri eşleşmiyor — işleyicileri başka yerde', () => {
    // Eşleşirlerse sohbette ⏎ global işleyiciye düşer ve mesaj gönderilmez.
    assert.equal(eslesenKisayol(olay('Enter')), null);
  });

  test('KAYIT ARAYÜZÜNÜN sözcükleri eşleştiriciyle AYNI', () => {
    // GERÇEK KUSUR, mutasyon turunda çıktı: kayıt arayüzü `'⌘'` ve `'⌥'`
    // yazıyordu, eşleştirici `'Ctrl'` arıyordu. Kullanıcı Ctrl+K
    // kaydettiğinde depoya `['⌘','K']` gidiyor, Ctrl gerekliliği GÖRÜNMÜYOR
    // ve kısayol düz K oluyordu — Ctrl'süz her K paleti açardı.
    const ctrl = tusAtamalari({ cmd_palette: [DEGISTIRICILER.ctrl, 'J'] });
    assert.equal(eslesenKisayol(olay('j', { ctrlKey: true }), { atamalar: ctrl }), 'cmd_palette');
    assert.equal(eslesenKisayol(olay('j'), { atamalar: ctrl }), null, 'Ctrl gerekliliği yok sayıldı');
    // Eski sözcük de çalışmalı: depoda bayat `['⌘','J']` kalmış olabilir.
    const eski = tusAtamalari({ cmd_palette: ['⌘', 'J'] });
    assert.equal(eslesenKisayol(olay('j', { ctrlKey: true }), { atamalar: eski }), 'cmd_palette',
      'bayat kayıt biçimi okunamıyor');
  });

  test('ALT da iki yönde eşleşiyor', () => {
    const a = tusAtamalari({ new_task: [DEGISTIRICILER.alt, 'T'] });
    assert.equal(eslesenKisayol(olay('t', { altKey: true }), { atamalar: a }), 'new_task');
    assert.equal(eslesenKisayol(olay('t'), { atamalar: a }), null, 'Alt gerekliliği yok sayıldı');
  });

  test('DEĞİŞTİRİCİ GEREKMEYEN kısayol, değiştirici basılıyken eşleşmiyor', () => {
    // Tek yön kontrol edilse Ctrl+N de "yeni görev" sayılır ve tarayıcının
    // kendi kısayolunu çalardı.
    assert.equal(eslesenKisayol(olay('n', { ctrlKey: true })), null);
    assert.equal(eslesenKisayol(olay('n', { altKey: true })), null);
  });

  test('tanınmayan tuş null', () => {
    assert.equal(eslesenKisayol(olay('z')), null);
    assert.equal(eslesenKisayol(olay(undefined)), null);
  });

  test('dizi BAŞLATAN tuş atamalardan okunuyor', () => {
    assert.equal(diziBaslatiyorMu(olay('g')), true);
    assert.equal(diziBaslatiyorMu(olay('x')), false);
    // Sabit bir `'g'` karşılaştırması özelleştirmeyi yarı çalışır bırakırdı:
    // ikinci tuş değişir, ilki değişmezdi.
    const atamalar = tusAtamalari({ go_board: ['X', 'B'] });
    assert.equal(diziBaslatiyorMu(olay('x'), atamalar), true);
  });

  test('Ctrl basılıyken dizi BAŞLAMIYOR', () => {
    assert.equal(diziBaslatiyorMu(olay('g', { ctrlKey: true })), false);
  });
});

describe('işleyici bağlantısı — ikinci liste YOK', () => {
  const isleyici = () => {
    const bas = APP.indexOf('const onKey = (e) => {');
    assert.ok(bas > 0, 'klavye işleyicisi bulunamadı');
    const son = APP.indexOf("window.addEventListener('keydown', onKey)", bas);
    assert.ok(son > bas, 'işleyici kapanmıyor');
    return APP.slice(bas, son);
  };

  test('tuşlar KAYNAKTAN geliyor, gömülü değil', () => {
    const i = isleyici();
    assert.match(i, /eslesenKisayol\(e, \{/, 'eşleşme kuralı yine işleyicinin içinde');
    assert.doesNotMatch(i, /const G_MAP = \{/, 'ikinci bir tuş haritası geri gelmiş');
  });

  test('ÖZELLEŞTİRME okunuyor — kusurun kendisi buydu', () => {
    const bas = APP.indexOf('const onKey = (e) => {');
    const once = APP.slice(APP.indexOf('const clearG =', 0), bas);
    assert.match(once, /localStorage\.getItem\('stoa\.shortcuts'\)/,
      'özel atamalar okunmuyor — ayarlar ekranı yine hiçbir şey yapmıyor');
    // ÖLÇÜT `atamalar`IN KENDİSİNE BAĞLI. İlk hâli yalnızca
    // `tusAtamalari(ozel)` kalıbını arıyordu ve aklama denemesi geçti:
    // çağrıyı ölü bir `_olu` değişkenine atayıp `atamalar`ı
    // `tusAtamalari(null)` ile kurmak testi yeşil bıraktı. İşleyicinin
    // KULLANDIĞI değer ölçülüyor, çağrının varlığı değil.
    assert.match(once, /const atamalar = tusAtamalari\(ozel\);/,
      'eşleşmede kullanılan atamalar özel değerden kurulmuyor');
    assert.doesNotMatch(once, /tusAtamalari\(null\)/,
      'işleyici varsayılan atamalara düşüyor');
  });

  test('gnav HEDEFİ ve alt görünümü kaynaktan okunuyor', () => {
    const i = isleyici();
    assert.match(i, /setView\(k\.hedef\)/, 'hedef görünüm gömülü');
    assert.match(i, /if \(k\.altGorunum\) localStorage\.setItem\('stoa\.boardSubView', k\.altGorunum\)/,
      'alt görünüm gömülü');
  });

  test('`/` araması GERÇEKTEN var — belgelenmiş ama yoktu', () => {
    assert.match(isleyici(), /if \(id === 'search'\)[\s\S]{0,260}?\.focus\(\)/,
      'arama kısayolu hâlâ sözde kalmış');
  });

  test('Esc ve palet YAZARKEN DE çalışıyor', () => {
    // İkisi de kullanıcıyı bir yerden ÇIKARIYOR; metin kutusunda
    // kilitlenmiş birinin tek yolu bunlar, o yüzden `yaziliyorMu`dan ÖNCE.
    const i = isleyici();
    const yaz = i.indexOf('if (yaziliyorMu()) return;');
    assert.ok(yaz > 0, 'yazma kapısı bulunamadı');
    assert.ok(i.indexOf("=== 'cmd_palette'") < yaz, 'palet yazarken çalışmıyor');
    assert.ok(i.indexOf("=== 'close_panels'") < yaz, 'Esc yazarken çalışmıyor');
    // Geri kalan her şey yazma kapısının SONRASINDA olmalı.
    assert.ok(i.indexOf("=== 'new_task'") > yaz, 'yeni görev metin kutusunda da tetikleniyor');
  });

  test('`?` yardımı açılıyor ve yardım ekranı çiziliyor', () => {
    assert.match(isleyici(), /if \(e\.key === '\?'\)[\s\S]{0,120}?setKisayolYardimi/,
      '`?` hiçbir şey yapmıyor');
    assert.match(APP, /<KisayolYardimi open=\{kisayolYardimi\}/, 'yardım ekranı çizilmiyor');
  });
});

describe('ayarlar ve yardım AYNI kaynaktan', () => {
  test('ayarlar kendi listesini TUTMUYOR', () => {
    // Önce bu dosya kendi `DEFAULT_SHORTCUTS` kopyasını taşıyordu ve
    // gerçekle iki yönde ayrışmıştı. Ölçüt kopyanın geri gelmesini
    // yasaklıyor: liste `KISAYOLLAR`dan TÜRETİLMELİ.
    assert.match(AYAR, /import \{[^}]*KISAYOLLAR[^}]*\} from '\.\.\/kisayollar\.js';/,
      'ayarlar ekranı tek kaynağı okumuyor');
    assert.match(AYAR, /const DEFAULT_SHORTCUTS = KISAYOLLAR\.map\(/,
      'ayarlar ekranı kendi listesini kuruyor');
    assert.doesNotMatch(AYAR, /\{ id: 'go_board',\s*label:/, 'elle yazılmış liste geri gelmiş');
  });

  test('SABİT kısayol ayarlarda kaydedilemiyor', () => {
    // Kaydetmeye izin verip uygulamamak, bu turda kapatılan yalanın aynısı.
    assert.match(AYAR, /onClick=\{sc\.sabit \? undefined : \(\) => setRecordingId\(sc\.id\)\}/,
      'sabit kısayol için kayıt başlatılabiliyor');
  });

  test('kayıt arayüzü DEĞİŞTİRİCİLERİ tek kaynaktan okuyor', () => {
    // Elle yazılmış sözcükler iki dağarcık demek ve kusur geri döner.
    assert.match(AYAR, /parts\.push\(DEGISTIRICILER\.ctrl\)/, 'kayıt kendi sözcüğünü yazıyor');
    assert.match(AYAR, /parts\.push\(DEGISTIRICILER\.alt\)/, 'kayıt kendi sözcüğünü yazıyor');
    assert.doesNotMatch(AYAR, /parts\.push\('⌘'\)/, 'eski sözcük geri gelmiş');
  });

  test('yardım ekranı kendi listesini TUTMUYOR', () => {
    assert.match(YARDIM, /from '\.\/kisayollar\.js'/, 'yardım ekranı tek kaynağı okumuyor');
    assert.doesNotMatch(YARDIM, /tuslar: \[/, 'yardım ekranında elle yazılmış tuş var');
  });

  test('yardım ekranı ÖZELLEŞTİRİLMİŞ tuşu gösteriyor', () => {
    // Varsayılanı gösterirse kullanıcıya YANLIŞ tuşu söyler.
    assert.match(YARDIM, /tusAtamalari\(ozel\)/, 'yardım varsayılanı gösteriyor');
    assert.match(YARDIM, /\(atamalar\[k\.id\] \|\| k\.tuslar\)/, 'atamalar okunmuyor');
  });
});
