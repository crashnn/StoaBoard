// Darboğaz tablosu ve dönem karşılaştırmasının saf testleri (kart #146).
//
// İki karar kilitleniyor:
// 1. Kartların birikip ÇIKMADIĞI kolon darboğaz sayılır — eski "bekleme"
//    tablosu yalnızca kapanmış beklemeyi ölçtüğü için bunu sıfır gösterirdi.
// 2. Şu an bekleyen kartın süresi rapor penceresine kırpılır: geçmiş dönemin
//    raporuna bugünün birikimi karışmaz, pencereden önce başlayan bekleyişin
//    yalnızca pencere içi kısmı sayılır.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { darbogazTablosu, kolonEtiketi } from '../src/lib/darbogaz.js';
import { oncekiAralik, aralikGunu, donemFarki, ozetKalibi } from '../src/lib/donem.js';

const S = 60 * 60 * 1000;
const t0 = new Date('2026-09-01T00:00:00Z');
const saat = (n) => new Date(t0.getTime() + n * S);

const kolonlar = [
  { id: 3, title: 'Done', titleTr: 'Tamamlandı', position: 3, isDone: true },
  { id: 1, title: 'To Do', titleTr: 'Yapılacak', position: 1, isDone: false },
  { id: 2, title: 'In Progress', titleTr: 'Yapılıyor', position: 2, isDone: false },
];

describe('darbogazTablosu — sıra ve funnel', () => {
  test('satırlar pano sırasında, etiket Türkçe ad; geçişi olmayan kolon da satırda (sıfır)', () => {
    const r = darbogazTablosu({ columns: kolonlar, transitions: [], acikKartlar: [], now: saat(100) });
    assert.deepEqual(r.rows.map((x) => x.label), ['Yapılacak', 'Yapılıyor', 'Tamamlandı']);
    assert.deepEqual(r.rows.map((x) => x.is_done), [false, false, true]);
    assert.equal(r.bottleneck, null);
    assert.equal(r.total_hours, 0);
  });

  test('funnel: kolona giren AYRI kart sayısı — aynı kart iki kez girse bir sayılır', () => {
    const transitions = [
      { taskId: 1, toTitle: 'Yapılacak', at: saat(0) },
      { taskId: 1, toTitle: 'Yapılıyor', at: saat(10) },
      { taskId: 1, toTitle: 'Yapılacak', at: saat(20) },
      { taskId: 2, toTitle: 'Yapılacak', at: saat(0) },
    ];
    const r = darbogazTablosu({ columns: kolonlar, transitions, acikKartlar: [], now: saat(100) });
    const [todo, doing] = r.rows;
    assert.equal(todo.entered, 2);
    assert.equal(doing.entered, 1);
  });

  test('kapanmış bekleme: ardışık geçişler arası süre önceki hedef kolona; ortalama ve ortanca', () => {
    const transitions = [
      { taskId: 1, toTitle: 'Yapılacak', at: saat(0) },
      { taskId: 1, toTitle: 'Yapılıyor', at: saat(10) },   // Yapılacak'ta 10 sa
      { taskId: 1, toTitle: 'Tamamlandı', at: saat(40) },  // Yapılıyor'da 30 sa
      { taskId: 2, toTitle: 'Yapılacak', at: saat(0) },
      { taskId: 2, toTitle: 'Yapılıyor', at: saat(30) },   // Yapılacak'ta 30 sa
    ];
    const r = darbogazTablosu({ columns: kolonlar, transitions, acikKartlar: [], now: saat(100) });
    const [todo, doing] = r.rows;
    assert.equal(todo.samples, 2);
    assert.equal(todo.avg_hours, 20);
    assert.equal(todo.median_hours, 20);
    assert.equal(doing.samples, 1);
    assert.equal(doing.avg_hours, 30);
  });

  test('geçiş kaydında olup panoda olmayan kolon (silinmiş) satır olarak sona eklenir', () => {
    const transitions = [{ taskId: 1, toTitle: 'Eski Kolon', at: saat(0) }];
    const r = darbogazTablosu({ columns: kolonlar, transitions, acikKartlar: [], now: saat(1) });
    assert.equal(r.rows.at(-1).label, 'Eski Kolon');
    assert.equal(r.rows.at(-1).entered, 1);
  });
});

describe('darbogazTablosu — şu an bekleyenler ve darboğaz kararı', () => {
  test('BİRİKİP ÇIKMAYAN kolon darboğazdır: kapanmış beklemesi sıfır olsa da', () => {
    // Yapılıyor'dan 1 kart 2 saatte çıkmış; Yapılacak'ta 3 kart 50'şer saattir bekliyor.
    const transitions = [
      { taskId: 9, toTitle: 'Yapılıyor', at: saat(0) },
      { taskId: 9, toTitle: 'Tamamlandı', at: saat(2) },
    ];
    const acikKartlar = [
      { taskId: 1, label: 'Yapılacak', since: saat(50) },
      { taskId: 2, label: 'Yapılacak', since: saat(50) },
      { taskId: 3, label: 'Yapılacak', since: saat(50) },
    ];
    const r = darbogazTablosu({ columns: kolonlar, transitions, acikKartlar, now: saat(100) });
    const [todo, doing] = r.rows;
    assert.equal(todo.samples, 0);
    assert.equal(todo.waiting_now, 3);
    assert.equal(todo.waiting_avg_days, Math.round((50 / 24) * 10) / 10);
    assert.equal(todo.total_hours, 150);
    assert.equal(doing.total_hours, 2);
    assert.equal(r.bottleneck, 'Yapılacak');
    assert.equal(todo.bottleneck, true);
    assert.equal(doing.bottleneck, false);
    assert.equal(todo.share, 99);
    assert.equal(doing.share, 1);
    assert.equal(r.total_hours, 152);
  });

  test('bitiş kolonu yarışa girmez: orada bekleyen kart darboğaz yapmaz, paya girmez', () => {
    const acikKartlar = [
      { taskId: 1, label: 'Tamamlandı', since: saat(0) },
      { taskId: 2, label: 'Yapılıyor', since: saat(90) },
    ];
    const r = darbogazTablosu({ columns: kolonlar, transitions: [], acikKartlar, now: saat(100) });
    assert.equal(r.bottleneck, 'Yapılıyor');
    const done = r.rows.find((x) => x.is_done);
    assert.equal(done.waiting_now, 1);
    assert.equal(done.share, 0);
    assert.equal(r.total_hours, 10);
  });

  test('pencereye kırpma: from öncesi başlayan bekleyiş yalnızca from\'dan itibaren; to sonrası sayılmaz', () => {
    const acikKartlar = [{ taskId: 1, label: 'Yapılacak', since: saat(0) }];
    // Pencere 40..60, bugün 100: sayılan 20 saat.
    const r = darbogazTablosu({ columns: kolonlar, transitions: [], acikKartlar, from: saat(40), to: saat(60), now: saat(100) });
    assert.equal(r.rows[0].total_hours, 20);
    // Pencere 40..200, bugün 100: sayılan 60 saat (bugüne kadar).
    const r2 = darbogazTablosu({ columns: kolonlar, transitions: [], acikKartlar, from: saat(40), to: saat(200), now: saat(100) });
    assert.equal(r2.rows[0].total_hours, 60);
    // Pencere tamamen bekleyişten önce: kart o dönemde henüz yoktu, sayılmaz.
    const r3 = darbogazTablosu({ columns: kolonlar, transitions: [], acikKartlar: [{ taskId: 1, label: 'Yapılacak', since: saat(80) }], from: saat(40), to: saat(60), now: saat(100) });
    assert.equal(r3.rows[0].waiting_now, 0);
    assert.equal(r3.bottleneck, null);
  });

  test('etiketi olmayan ya da tarihi bozuk açık kart atlanır, patlatmaz', () => {
    const acikKartlar = [
      { taskId: 1, label: null, since: saat(0) },
      { taskId: 2, label: 'Yapılacak', since: 'bozuk' },
    ];
    const r = darbogazTablosu({ columns: kolonlar, transitions: [], acikKartlar, now: saat(10) });
    assert.equal(r.rows[0].waiting_now, 0);
  });

  test('kolonEtiketi: Türkçe ad, yoksa ad, yoksa tire', () => {
    assert.equal(kolonEtiketi({ title: 'Done', titleTr: 'Tamamlandı' }), 'Tamamlandı');
    assert.equal(kolonEtiketi({ title: 'Done', titleTr: null }), 'Done');
    assert.equal(kolonEtiketi({}), '—');
  });
});

describe('donem — önceki aralık ve fark', () => {
  test('önceki aralık aynı uzunlukta ve hemen önce, bitişik ama çakışmaz', () => {
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date('2026-09-16T23:59:59.999Z');
    const o = oncekiAralik(from, to);
    assert.equal(o.to.getTime(), from.getTime() - 1);
    assert.equal(to.getTime() - from.getTime(), o.to.getTime() - o.from.getTime());
    assert.equal(o.from.toISOString(), '2026-08-16T00:00:00.000Z');
    assert.equal(aralikGunu(from, to), 16);
  });

  test('fark: diff ve yüzde; önceki sıfırsa yüzde null (sonsuz değil)', () => {
    const f = donemFarki({ created: 12, completed: 9, moves: 30, total_minutes: 600 }, { created: 8, completed: 6, moves: 0, total_minutes: 1200 });
    assert.deepEqual(f.created, { now: 12, previous: 8, diff: 4, pct: 50 });
    assert.deepEqual(f.completed, { now: 9, previous: 6, diff: 3, pct: 50 });
    assert.deepEqual(f.moves, { now: 30, previous: 0, diff: 30, pct: null });
    assert.deepEqual(f.total_minutes, { now: 600, previous: 1200, diff: -600, pct: -50 });
  });

  test('eksik alanlar sıfır sayılır', () => {
    const f = donemFarki({}, undefined);
    assert.deepEqual(f.created, { now: 0, previous: 0, diff: 0, pct: null });
  });

  test('özet kalıbı: quiet / first / up / down / flat', () => {
    const k = (s, o) => ozetKalibi(s, donemFarki(s, o));
    assert.equal(k({ created: 0, completed: 0, moves: 0 }, { created: 5, completed: 5, moves: 5 }), 'quiet');
    assert.equal(k({ created: 3, completed: 1, moves: 2 }, { created: 0, completed: 0, moves: 0 }), 'first');
    assert.equal(k({ created: 3, completed: 5, moves: 2 }, { created: 1, completed: 2, moves: 1 }), 'up');
    assert.equal(k({ created: 3, completed: 1, moves: 2 }, { created: 1, completed: 2, moves: 1 }), 'down');
    assert.equal(k({ created: 3, completed: 2, moves: 2 }, { created: 1, completed: 2, moves: 1 }), 'flat');
  });
});
