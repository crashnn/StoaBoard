// Genel CSV içe aktarmanın saf testleri (kart #152, 3. adım).
//
// CSV'nin biçimi yok; testler ayrıştırıcının gevşekliklerini (ayraç tahmini,
// tırnak, BOM, CRLF), eşleme tahminini (Türkçe/İngilizce başlıklar) ve
// paket kurallarını (bitiş değerini kullanıcı seçer, boş başlık atlanır ve
// sayılır, aynı sütun iki hedefe gitmez, çıkan paket doğrulamadan geçer)
// kilitliyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  csvAyristir, ayracTahmini, eslemeTahmini, ayrikDegerler, csvOnizleme,
  oncelikCoz, tarihCoz, csvPaketi, CSV_HEDEFLER,
} from '../src/lib/csvIce.js';
import { paketiDogrula, ICE_SINIR } from '../src/lib/tasinma.js';

const ORNEK = [
  'Başlık;Açıklama;Durum;Öncelik;Atanan;Etiketler;Bitiş',
  'Giriş ekranı;"Açıklama; noktalı virgüllü";Yapılacak;Yüksek;Ayşe Kaya, Mehmet Can;mobil,tasarım;20.09.2026',
  'Ödeme;"İki ""tırnaklı"" satır\nikinci satır";Devam Ediyor;orta;;arka uç;2026-10-01',
  ';açıklama var başlık yok;Yapılacak;;;;',
  'Bitmiş iş;;Tamamlandı;low;Ayşe Kaya;;',
  '',
].join('\r\n');

describe('csvAyristir — ayraç, tırnak, BOM, satır sonu', () => {
  test('noktalı virgül tahmin edilir; tırnak içi ayraç ve satır sonu korunur; "" → "', () => {
    const r = csvAyristir(`﻿${ORNEK}`);
    assert.equal(r.delimiter, ';');
    assert.deepEqual(r.headers, ['Başlık', 'Açıklama', 'Durum', 'Öncelik', 'Atanan', 'Etiketler', 'Bitiş']);
    assert.equal(r.rows.length, 4);
    assert.equal(r.rows[0][1], 'Açıklama; noktalı virgüllü');
    assert.equal(r.rows[1][1], 'İki "tırnaklı" satır\nikinci satır');
  });
  test('virgül ve sekme de tahmin edilir; eksik hücreler boşla tamamlanır', () => {
    assert.equal(ayracTahmini('a,b,c'), ',');
    assert.equal(ayracTahmini('a\tb\tc'), '\t');
    assert.equal(ayracTahmini('"a,b";c'), ';');
    const r = csvAyristir('a,b,c\n1\n');
    assert.deepEqual(r.rows, [['1', '', '']]);
  });
  test('boş dosya ve yalnızca başlık', () => {
    assert.deepEqual(csvAyristir(''), { delimiter: ',', headers: [], rows: [] });
    const r = csvAyristir('title,desc');
    assert.deepEqual(r.headers, ['title', 'desc']);
    assert.deepEqual(r.rows, []);
  });
  test('boş başlık hücresine ad verilir', () => {
    assert.deepEqual(csvAyristir('a,,c\n1,2,3').headers, ['a', 'sutun_2', 'c']);
  });
});

describe('eslemeTahmini — Türkçe ve İngilizce başlıklar', () => {
  test('Türkçe başlıklar', () => {
    const g = eslemeTahmini(['Başlık', 'Açıklama', 'Durum', 'Öncelik', 'Atanan', 'Etiketler', 'Bitiş']);
    assert.deepEqual(g, { title: 0, description: 1, column: 2, priority: 3, assignees: 4, labels: 5, due: 6 });
  });
  test('İngilizce başlıklar, farklı sıra; bir başlık tek hedefe', () => {
    const g = eslemeTahmini(['Due Date', 'Task Name', 'Status', 'Tags', 'Owner', 'Start Date', 'Notes']);
    assert.deepEqual(g, { title: 1, description: 6, column: 2, assignees: 4, labels: 3, due: 0, start: 5 });
  });
  test('tanınmayan başlıklar boş bırakılır', () => {
    assert.deepEqual(eslemeTahmini(['x', 'y']), {});
  });
});

describe('değer çözümleyiciler', () => {
  test('öncelik: Türkçe/İngilizce/sayı; bilinmeyen null', () => {
    assert.equal(oncelikCoz('Yüksek'), 'high');
    assert.equal(oncelikCoz('URGENT'), 'high');
    assert.equal(oncelikCoz('P2'), 'mid');
    assert.equal(oncelikCoz('düşük'), 'low');
    assert.equal(oncelikCoz('3'), 'low');
    assert.equal(oncelikCoz('şaka'), null);
  });
  test('tarih: ISO, saatli ISO, 20.09.2026, 20/09/2026, imkânsız gün → ay/gün; bozuk null', () => {
    assert.equal(tarihCoz('2026-09-20'), '2026-09-20');
    assert.equal(tarihCoz('2026-09-20 14:30:00'), '2026-09-20');
    assert.equal(tarihCoz('20.09.2026'), '2026-09-20');
    assert.equal(tarihCoz('20/09/2026'), '2026-09-20');
    assert.equal(tarihCoz('09/20/2026'), '2026-09-20');
    // Belirsiz tarih: GÜN ÖNCE (Türkçe yerel ayar) — 5 Eylül, 9 Mayıs değil.
    assert.equal(tarihCoz('05/09/2026'), '2026-09-05');
    assert.equal(tarihCoz('05.09.2026'), '2026-09-05');
    assert.equal(tarihCoz('31.02.2026'), null);
    assert.equal(tarihCoz('yarın'), null);
    assert.equal(tarihCoz(''), null);
  });
  test('ayrık değerler: ilk görülme sırası, 30 üstü null', () => {
    const rows = [['b'], ['a'], ['b'], ['']];
    assert.deepEqual(ayrikDegerler(rows, 0), ['b', 'a']);
    const cok = Array.from({ length: 40 }, (_, i) => [`v${i}`]);
    assert.equal(ayrikDegerler(cok, 0), null);
  });
});

describe('csvOnizleme — eşleme formunun malzemesi', () => {
  test('başlıklar, satır sayısı, örnek, tahmin, ayrık değerler', () => {
    const on = csvOnizleme(ORNEK);
    assert.equal(on.ok, true);
    assert.equal(on.delimiter, ';');
    assert.equal(on.row_count, 4);
    assert.equal(on.sample.length, 4);
    assert.equal(on.guess.title, 0);
    assert.deepEqual(on.distinct[2], ['Yapılacak', 'Devam Ediyor', 'Tamamlandı']);
  });
  test('sekme ayracı "tab" diye döner; başlıksız dosya reddedilir', () => {
    assert.equal(csvOnizleme('a\tb\n1\t2').delimiter, 'tab');
    assert.equal(csvOnizleme('   ').ok, false);
  });
});

describe('csvPaketi — kurallar', () => {
  const esleme = eslemeTahmini(csvAyristir(ORNEK).headers);

  test('durum sütunu eşliyse done_value ZORUNLU; null = bitiş yok; dosyada olmayan değer reddedilir', () => {
    assert.match(csvPaketi(ORNEK, esleme, {}).sebep, /done_value/);
    const yok = csvPaketi(ORNEK, esleme, { doneValue: null });
    assert.equal(yok.ok, true);
    assert.ok(yok.paket.projects[0].columns.every((c) => !c.is_done));
    assert.equal(csvPaketi(ORNEK, esleme, { doneValue: 'Done' }).ok, false);
  });

  test('durum sütunu eşlenmemişse done_value istenmez, tek kolon "Yapılacak"', () => {
    const r = csvPaketi(ORNEK, { title: 0 }, {});
    assert.equal(r.ok, true);
    assert.deepEqual(r.paket.projects[0].columns.map((c) => [c.slug, c.title, c.is_done]), [['yapılacak', 'To Do', false]]);
    assert.ok(r.paket.projects[0].tasks.every((t) => t.column === 'yapılacak'));
  });

  test('kolonlar ilk görülme sırasında, seçilen değer bitiş; boş başlıklı satır atlanır ve sayılır', () => {
    const r = csvPaketi(ORNEK, esleme, { doneValue: 'Tamamlandı', name: 'takim.csv' });
    assert.equal(r.ok, true);
    const p = r.paket.projects[0];
    assert.deepEqual(p.columns.map((c) => [c.slug, c.is_done]), [['yapılacak', false], ['devam-ediyor', false], ['tamamlandı', true]]);
    assert.equal(r.rapor.cards, 3);
    assert.equal(r.rapor.skipped_empty_title, 1);
    assert.equal(p.name, 'takim.csv');
  });

  test('kart alanları: öncelik çözülür (bilinmeyen sayılır), atanan slug, etiket katalogda, tarih ISO', () => {
    const r = csvPaketi(ORNEK, esleme, { doneValue: 'Tamamlandı' });
    const p = r.paket.projects[0];
    const [giris, odeme, bitmis] = p.tasks;
    assert.equal(giris.priority, 'high');
    assert.equal(odeme.priority, 'mid');
    assert.equal(bitmis.priority, 'low');
    assert.deepEqual(giris.assignees, ['ayse-kaya', 'mehmet-can']);
    assert.deepEqual(giris.labels, ['mobil', 'tasarim']);
    assert.deepEqual(odeme.labels, ['arka-uc']);
    assert.deepEqual(p.labels.map((l) => l.slug), ['mobil', 'tasarim', 'arka-uc']);
    assert.equal(giris.due, '2026-09-20');
    assert.equal(odeme.due, '2026-10-01');
    assert.equal(bitmis.due, null);
    assert.equal(odeme.description, 'İki "tırnaklı" satır\nikinci satır');
    assert.equal(bitmis.column, 'tamamlandı');
  });

  test('bilinmeyen öncelik ve çözülemeyen tarih sayılır, kart yine gelir', () => {
    const metin = 'title,priority,due\nA,çok acil,yarın\n';
    const r = csvPaketi(metin, { title: 0, priority: 1, due: 2 }, {});
    assert.equal(r.ok, true);
    assert.equal(r.rapor.unknown_priority, 1);
    assert.equal(r.rapor.unparsed_dates, 1);
    assert.equal(r.paket.projects[0].tasks[0].priority, 'mid');
  });

  test('eşleme: title zorunlu, aynı sütun iki hedefe verilemez, dizin sınır dışı reddedilir', () => {
    assert.match(csvPaketi(ORNEK, { description: 1 }, {}).sebep, /başlık/);
    assert.match(csvPaketi(ORNEK, { title: 0, description: 0 }, {}).sebep, /iki hedefe/);
    assert.match(csvPaketi(ORNEK, { title: 99 }, {}).sebep, /geçersiz/);
    assert.equal(csvPaketi(ORNEK, null, {}).ok, false);
  });

  test('ÇIKAN PAKET DOĞRULAMADAN OLDUĞU GİBİ GEÇER', () => {
    const r = csvPaketi(ORNEK, esleme, { doneValue: 'Tamamlandı' });
    const d = paketiDogrula(r.paket);
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(d.ozet.tasks, 3);
  });

  test('kırpma sayılır; satır sınırı reddedilir', () => {
    const uzun = `title\n${'x'.repeat(ICE_SINIR.title + 1)}\n`;
    const r = csvPaketi(uzun, { title: 0 }, {});
    assert.equal(r.paket.projects[0].tasks[0].title.length, ICE_SINIR.title);
    assert.equal(r.rapor.truncated.titles, 1);
    const cok = `title\n${Array.from({ length: ICE_SINIR.tasks + 1 }, (_, i) => `k${i}`).join('\n')}\n`;
    assert.match(csvPaketi(cok, { title: 0 }, {}).sebep, /en fazla/);
  });

  test('hedef listesi sabit — istemcinin formu bununla kuruluyor', () => {
    assert.deepEqual(CSV_HEDEFLER, ['title', 'description', 'column', 'priority', 'assignees', 'labels', 'due', 'start']);
  });
});
