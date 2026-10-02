// Toplu işlem (2 Ekim 2026 taraması, madde C).
//
// ÖLÇÜLEN: hiçbir görünümde seçim kutusu yoktu. Beş kartı taşımak beş ayrı
// sürükleme, çöpe atmak beş ayrı çekmece açışı demekti. Tablo görünümü bunun
// doğal evi — zaten elektronik tablo gibi duruyor.
//
// TASARIM KARARI: toplu UÇ yazılmadı, kartlar tek tek çağrılıyor. Her kartın
// kendi geçiş kaydı (`task_transitions`), kendi yayını ve kendi geçmişi
// olmalı; toplu bir uç bunları tek satıra indirir ve "kim taşıdı" sorusu beş
// kart için tek cevaba düşerdi — kartta geçmiş (madde B) daha yeni
// eklenmişken onu bozmak olurdu.
//
// BEDELİ yarım başarı ve o bedel ÖDENİYOR: sonuç sayılıp kullanıcıya olduğu
// gibi söyleniyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { topluCalistir, topluSonucMetni, secimiDegistir, hepsiniSec } from '../../client/src/topluIslem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOARD = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'board.jsx'));

const ceviri = (k, fb) => fb;

describe('topluCalistir — yarım başarı sayılıyor', () => {
  test('hepsi tutarsa hepsi başarılı', async () => {
    const r = await topluCalistir(['1', '2', '3'], async () => {});
    assert.deepEqual(r.basarili, ['1', '2', '3']);
    assert.deepEqual(r.basarisiz, []);
  });

  test('BİRİ DÜŞSE kalanlar devam ediyor', async () => {
    // On kartın birinde sorun varsa ötekiler yine taşınsın.
    const r = await topluCalistir(['1', '2', '3'], async (id) => {
      if (id === '2') throw new Error('olmadı');
    });
    assert.deepEqual(r.basarili, ['1', '3']);
    assert.deepEqual(r.basarisiz, ['2']);
  });

  test('SIRAYLA çağırıyor, paralel değil', async () => {
    // Yirmi kart için yirmi eşzamanlı istek sunucuyu ve soket yayınını
    // gereksiz sıkıştırır.
    const sira = [];
    await topluCalistir(['1', '2', '3'], async (id) => {
      sira.push('bas' + id);
      await new Promise((r) => setTimeout(r, 5));
      sira.push('bit' + id);
    });
    assert.deepEqual(sira, ['bas1', 'bit1', 'bas2', 'bit2', 'bas3', 'bit3']);
  });

  test('boş liste patlamıyor', async () => {
    const r = await topluCalistir([], async () => {});
    assert.deepEqual(r, { basarili: [], basarisiz: [] });
  });
});

describe('topluSonucMetni — yarım başarı SESSİZ kalmıyor', () => {
  test('hepsi tuttuysa sayı söyleniyor', () => {
    assert.equal(topluSonucMetni({ basarili: ['a', 'b'], basarisiz: [] }, ceviri), '2 kart işlendi');
  });

  test('YARIM başarı ayrı cümle', () => {
    // "5 kart taşındı" demek, ikisi düşmüşken yalan olurdu.
    assert.equal(
      topluSonucMetni({ basarili: ['a'], basarisiz: ['b', 'c'] }, ceviri),
      '1 kart işlendi, 2 tanesi başarısız',
    );
  });

  test('hiçbiri tutmadıysa bu da söyleniyor', () => {
    assert.equal(topluSonucMetni({ basarili: [], basarisiz: ['a'] }, ceviri), 'Hiçbir kart işlenemedi');
  });

  test('yapacak bir şey yoksa bildirim YOK', () => {
    assert.equal(topluSonucMetni({ basarili: [], basarisiz: [] }, ceviri), null);
  });
});

describe('seçim — saf', () => {
  test('seçim KOPYALANIYOR, yerinde değiştirilmiyor', () => {
    // React durumu yerinde değiştirmek yeniden çizim tetiklemez: seçim
    // ekranda değişmemiş görünürdü.
    const once = new Set(['a']);
    const sonra = secimiDegistir(once, 'b');
    assert.notEqual(once, sonra);
    assert.deepEqual([...once], ['a']);
    assert.deepEqual([...sonra], ['a', 'b']);
  });

  test('ikinci kez tıklamak seçimi kaldırıyor', () => {
    assert.deepEqual([...secimiDegistir(new Set(['a', 'b']), 'a')], ['b']);
  });

  test('hepsini seç YALNIZCA GÖRÜNENLERİ kapsıyor', () => {
    // Süzgeç açıkken "hepsi" ekranda olmayan kartı kapsarsa kullanıcı
    // görmediği bir kartı taşır.
    const r = hepsiniSec(new Set(['gizli']), ['a', 'b']);
    assert.deepEqual([...r].sort(), ['a', 'b', 'gizli']);
  });

  test('hepsi zaten seçiliyse seçimi KALDIRIYOR', () => {
    const r = hepsiniSec(new Set(['a', 'b', 'gizli']), ['a', 'b']);
    assert.deepEqual([...r], ['gizli'], 'görünmeyen seçim de silinmiş');
  });

  test('görünen yoksa hepsini seç bir şey yapmıyor', () => {
    assert.deepEqual([...hepsiniSec(new Set(['a']), [])], ['a']);
  });
});

describe('tablo görünümü — toplu işlem bağlantısı', () => {
  const tablo = () => {
    const bas = BOARD.indexOf('function TableView(');
    assert.ok(bas > 0, 'TableView bulunamadı');
    return BOARD.slice(bas, BOARD.indexOf('\nfunction ', bas + 10));
  };

  test('seçim KİMLİKLE tutuluyor, nesneyle değil', () => {
    // Liste yeniden süzüldüğünde nesne kimliği değişir ve seçim sessizce
    // kaybolurdu.
    assert.match(tablo(), /secili\.has\(String\(t\.id\)\)/, 'seçim nesne kimliğine bağlı');
  });

  test('toplu işlem YALNIZCA GÖRÜNEN kartlara uygulanıyor', () => {
    const t = tablo();
    assert.match(t, /const seciliGorunen = \[\.\.\.secili\]\.filter\(\(id\) => gorunenIdler\.includes\(id\)\)/,
      'görünmeyen kart da işleme giriyor');
    // HER çağrı süzgeçten geçmeli, "en az bir tane" değil. MUTASYON BUNU
    // YAKALADI: taşıma dalı `[...secili]`ye çevrildiğinde test geçmeye devam
    // etti, çünkü çöp dalı hâlâ `seciliGorunen` kullanıyordu — komşudan
    // ödünç alma. Sayı kullanılıyor ve ne sayıldığı yazılı: toplu çağrıların
    // SAYISI kadar süzgeçli çağrı olmalı.
    const cagrilar = [...t.matchAll(/topluCalistir\(/g)].length;
    const suzgecli = [...t.matchAll(/topluCalistir\(seciliGorunen/g)].length;
    assert.ok(cagrilar >= 2, `beklenenden az toplu çağrı: ${cagrilar}`);
    assert.equal(suzgecli, cagrilar,
      `${cagrilar} toplu çağrıdan yalnızca ${suzgecli} tanesi görünen süzgecinden geçiyor`);
  });

  test('yetkisiz kullanıcı toplu işlem YAPAMIYOR', () => {
    const t = tablo();
    assert.match(t, /if \(!canManageTasks \|\| topluMesgul\) return;/, 'yetki kapısı yok');
    assert.match(t, /canManageTasks && seciliGorunen\.length > 0 && \(/, 'çubuk yetkisizde de çiziliyor');
  });

  test('kutuya tıklamak kartı AÇMIYOR', () => {
    // Satırın kendi `onClick`i kartı açıyor; yayılma durmazsa her seçim
    // çekmeceyi açardı.
    const t = tablo();
    const hucre = t.slice(t.indexOf('{canManageTasks && ('), t.indexOf('</td>', t.indexOf('{canManageTasks && (')));
    assert.match(hucre, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/, 'tıklama satıra kaçıyor');
  });

  test('sonuç kullanıcıya SÖYLENİYOR', () => {
    const t = tablo();
    assert.match(t, /topluSonucMetni\(sonuc,/, 'sonuç cümleye çevrilmiyor');
    assert.match(t, /window\.showToast\?\.\(mesaj/, 'sonuç kullanıcıya gösterilmiyor');
    assert.match(t, /sonuc\.basarisiz\.length \? 'error' : 'info'/, 'yarım başarı normal bildirim gibi gösteriliyor');
  });

  test('işlem bitince seçim BIRAKILIYOR', () => {
    // Kalsaydı kullanıcı aynı kartları ikinci kez işleyebilirdi.
    assert.match(tablo(), /setSecili\(new Set\(\)\);\s*\n\s*setTopluMesgul\(false\);/, 'seçim temizlenmiyor');
  });
});
