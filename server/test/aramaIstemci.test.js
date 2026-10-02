// İstemci tarafı arama katlaması (3 Ekim 2026).
//
// NİÇİN VAR: istemcideki her arama düz `toLowerCase().includes()` kullanıyordu
// ve Türkçe'de bu SESSİZCE yanlış cevap veriyor. Ölçülmüş iki kusur:
//
//   'İş planı'.toLowerCase()          → 'i̇ş planı'  (i + U+0307, iki kod birimi)
//   'İş planı'.toLowerCase().includes('iş')  → FALSE  (doğru yazımla bile!)
//   'Kırılma'.toLowerCase().includes('kirilma') → FALSE
//
// Yani Türkçe klavyesi olmayan (ya da hızlı yazan) kullanıcı kartını
// bulamıyordu ve arama "sonuç yok" diyerek doğru cevap vermiş gibi duruyordu.
//
// İKİ TANIM, DENKLİĞİ KİLİTLİ. Kural sunucuda zaten çözülmüştü
// (`mcpShape.js` → `katla`) ama istemci paketine sunucu kodu sokmamak için
// `client/src/arama.js` ikinci bir tanım taşıyor. Bu testin asıl işi o iki
// tanımın AYNI cevabı vermesini zorlamak: birini değiştiren testi kırmak
// zorunda kalır. Ölçüt kaynak metni değil DAVRANIŞ — iki işlev aynı tabloda
// karşılaştırılıyor, gövdeleri karşılaştırılmıyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { katla as sunucuKatla } from '../src/lib/mcpShape.js';
import { katla, kapsiyor, kapsiyorBiri } from '../../client/src/arama.js';

// Türkçe aramanın bütün kırılma noktaları. Yeni bir kenar durumu çıkarsa
// buraya yazılır — iki tanıma birden sorulur.
const TABLO = [
  'İş planı', 'ı', 'I', 'i', 'İ', 'IT altyapısı', 'Kırılma', 'ISITMA',
  'Çalışma', 'ÖĞE', 'istanbul', 'İSTANBUL', 'Iğdır', 'ılık',
  '', null, undefined, 0, 42, 'ASCII only', 'MiXeD CaSe',
];

describe('katla — sunucuyla DENKLİK', () => {
  test('aynı tabloda iki tanım aynı cevabı veriyor', () => {
    for (const girdi of TABLO) {
      assert.equal(katla(girdi), sunucuKatla(girdi),
        `istemci ve sunucu katlaması ayrıştı: ${JSON.stringify(girdi)}`);
    }
  });
});

describe('katla — nokta dörtlüsü', () => {
  test('I, İ, ı, i hepsi "i"', () => {
    assert.equal(katla('I'), 'i');
    assert.equal(katla('İ'), 'i');
    assert.equal(katla('ı'), 'i');
    assert.equal(katla('i'), 'i');
  });

  test('birleşen nokta BIRAKILMIYOR', () => {
    // Düz `toLowerCase()` burada 'i' + U+0307 üretiyor ve her karşılaştırma
    // sessizce kayıyor. Katlama tireden ÖNCE çalıştığı için nokta hiç
    // doğmuyor.
    assert.equal(katla('İ').length, 1);
    assert.ok(!katla('İş').includes('̇'));
  });

  test('bozuk girdi patlamıyor', () => {
    assert.equal(katla(null), '');
    assert.equal(katla(undefined), '');
    assert.equal(katla(0), '0');
  });
});

describe('kapsiyor — ölçülen kusurlar', () => {
  test('DOĞRU TÜRKÇEYLE YAZILAN sorgu bile bulunamıyordu', () => {
    // En önemli kenar durumu, ve ilk yazışımda yanlış örnekle anlattığım
    // için buraya yazılı: sorun Türkçe klavyesi olmamak DEĞİL. "İş planı"
    // kartı, kullanıcı tam doğru biçimde "iş" yazdığında da bulunmuyordu:
    // `toLowerCase()` İ'yi "i" + U+0307'ye açıyor, yani metinde artık düz
      // bir "i" yok.
    assert.ok(!'İş planı'.toLowerCase().includes('iş'),
      'düz toLowerCase artık çalışıyorsa bu test anlamını yitirdi');
    assert.ok(kapsiyor('İş planı', 'iş'));
  });

  test('"istanbul" → "İstanbul" BULUYOR', () => {
    assert.ok(!'İstanbul'.toLowerCase().includes('istanbul'));
    assert.ok(kapsiyor('İstanbul', 'istanbul'));
  });

  test('"kirilma" → "Kırılma" BULUYOR', () => {
    assert.ok(kapsiyor('Kırılma', 'kirilma'));
    assert.ok(!'Kırılma'.toLowerCase().includes('kirilma'));
  });

  test('ters yön: ı taşıyan sorgu, i taşıyan metni buluyor', () => {
    assert.ok(kapsiyor('kirilma', 'kırılma'));
  });

  test('"it" araması "IT altyapısı"nı bulmaya devam ediyor', () => {
    // `toLocaleLowerCase('tr')` bu yönde kırıyordu; gerekçe mcpShape.js'te.
    assert.ok(kapsiyor('IT altyapısı', 'it'));
  });

  test('BOŞ SORGU her şeye uyuyor — süzgeç semantiği', () => {
    // Çağrı yerleri `!q || kapsiyor(...)` yazmak zorunda kalmasın diye.
    // Sunucudaki `aramaEslesir` ters yönde ve adı da farklı; iki ayrı soru.
    assert.ok(kapsiyor('herhangi', ''));
    assert.ok(kapsiyor('herhangi', '   '));
  });

  test('alakasız sorgu eşleşmiyor — katlama her şeyi eşitlemiyor', () => {
    assert.ok(!kapsiyor('İş planı', 'rapor'));
    assert.ok(!kapsiyor('Kırılma', 'kirilmaz'));
  });

  test('Ç/Ğ/Ö/Ş/Ü bilinçli olarak KAPSAM DIŞI', () => {
    // Sunucudaki kararla aynı. "öğe" aramasının "oge" ile bulunması ayrı
    // bir ürün kararı; buraya yazılı ki ileride "kusur" sanılmasın.
    assert.ok(!kapsiyor('Çalışma', 'calisma'));
    // ı → i katlandığı için bu geçiyor; ç ve ş olduğu gibi aranıyor.
    assert.ok(kapsiyor('Çalışma', 'çalişma'));
  });
});

describe('kapsiyorBiri', () => {
  test('alanlardan biri yeterli', () => {
    assert.ok(kapsiyorBiri(['Kart', 'Narflow'], 'narflow'));
    assert.ok(!kapsiyorBiri(['Kart', 'Narflow'], 'stoa'));
  });

  test('tek değer de kabul ediyor', () => {
    assert.ok(kapsiyorBiri('İstanbul', 'istanbul'));
  });

  test('eksik alanlar patlamıyor', () => {
    assert.ok(!kapsiyorBiri([null, undefined, ''], 'x'));
  });
});
