// Trello → StoaBoard dönüştürücüsünün saf testleri (kart #152, 2. adım).
//
// Aşağıdaki örnek Trello'nun gerçek pano dışa aktarımının biçiminde: alan
// adları, ObjectId kimlikler, en yeniden eskiye eylemler, closed işareti,
// pos ile sıralama. Dönüştürücünün KARARLARI test ediliyor, Trello'nun biçimi
// değil: bitiş listesi seçilmeden geçmez, arşiv taşınmaz ama sayılır,
// kırpma sessiz değil, çıkan paket doğrulamadan olduğu gibi geçer.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { trelloPaketi, trelloMu, trelloListeleri, objectIdZamani } from '../src/lib/trello.js';
import { paketiDogrula, ICE_SINIR, TASINMA_BICIM } from '../src/lib/tasinma.js';

const now = new Date('2026-09-20T10:00:00Z');

// 0x5f8a1b2c = 1602886444 → 2020-10-16T22:14:04Z
const KART1 = '5f8a1b2c3d4e5f6a7b8c9d0e';
const KART2 = '5f8a1b2d3d4e5f6a7b8c9d0f';
const KART_ARSIV = '5f8a1b2e3d4e5f6a7b8c9d10';
const KART_OKSUZ = '5f8a1b2f3d4e5f6a7b8c9d11';

function pano() {
  return {
    id: '5f8a1a003d4e5f6a7b8c9d00',
    name: 'Ürün Yol Haritası',
    desc: '',
    closed: false,
    prefs: { permissionLevel: 'private' },
    labelNames: { green: 'Hazır', red: '' },
    lists: [
      { id: 'L2', name: 'Yapılıyor', closed: false, pos: 2 },
      { id: 'L1', name: 'Yapılacak', closed: false, pos: 1 },
      { id: 'L3', name: 'Bitti', closed: false, pos: 3 },
      { id: 'LA', name: 'Eski', closed: true, pos: 4 },
    ],
    labels: [
      { id: 'E1', name: 'Hazır', color: 'green' },
      { id: 'E2', name: '', color: 'red_dark' },
      { id: 'E3', name: 'Hazır', color: 'black' },
    ],
    members: [
      { id: 'M1', username: 'aysek', fullName: 'Ayşe Kaya' },
      { id: 'M2', username: 'mcan', fullName: '' },
    ],
    cards: [
      {
        id: KART1, name: 'Giriş ekranı', desc: 'Açıklama **kalın**', closed: false, idList: 'L1',
        idLabels: ['E1', 'E2'], idMembers: ['M1', 'M2'], pos: 65535, due: '2026-10-01T12:00:00.000Z',
        dueComplete: false, start: '2026-09-25T00:00:00.000Z', dateLastActivity: '2026-09-19T08:00:00.000Z',
      },
      {
        id: KART2, name: 'Bitmiş iş', desc: '', closed: false, idList: 'L3',
        idLabels: [], idMembers: [], pos: 100, due: null, dateLastActivity: '2026-09-18T09:30:00.000Z',
      },
      { id: KART_ARSIV, name: 'Arşivde', desc: '', closed: true, idList: 'L1', idLabels: [], idMembers: [], pos: 1 },
      { id: KART_OKSUZ, name: 'Listesi arşivde', desc: '', closed: false, idList: 'LA', idLabels: [], idMembers: [], pos: 1 },
    ],
    checklists: [
      { id: 'C2', idCard: KART1, name: 'Test', pos: 2, checkItems: [
        { id: 'i3', name: 'birim', state: 'complete', pos: 1 },
      ] },
      { id: 'C1', idCard: KART1, name: 'Tasarım', pos: 1, checkItems: [
        { id: 'i2', name: 'mobil', state: 'incomplete', pos: 2 },
        { id: 'i1', name: 'masaüstü', state: 'complete', pos: 1 },
      ] },
      { id: 'C3', idCard: KART2, name: 'Tek liste', pos: 1, checkItems: [
        { id: 'i4', name: 'yalnız madde', state: 'incomplete', pos: 1 },
      ] },
    ],
    actions: [
      { id: 'A2', type: 'commentCard', date: '2026-09-19T08:00:00.000Z', data: { text: 'sonraki yorum', card: { id: KART1 } }, memberCreator: { id: 'M1', username: 'aysek', fullName: 'Ayşe Kaya' } },
      { id: 'A3', type: 'updateCard', date: '2026-09-19T07:00:00.000Z', data: { card: { id: KART1 } }, memberCreator: { id: 'M1' } },
      { id: 'A1', type: 'commentCard', date: '2026-09-18T08:00:00.000Z', data: { text: 'ilk yorum', card: { id: KART1 } }, memberCreator: { id: 'MX', username: 'disardan', fullName: 'Dış Kişi' } },
      { id: 'A4', type: 'commentCard', date: '2026-09-18T08:00:00.000Z', data: { text: 'arşive yorum', card: { id: KART_ARSIV } }, memberCreator: { id: 'M1' } },
    ],
  };
}

describe('trelloMu / trelloListeleri — tanıma', () => {
  test('lists + cards + idList → Trello; bizim paket (format var) → değil', () => {
    assert.equal(trelloMu(pano()), true);
    assert.equal(trelloMu({ format: TASINMA_BICIM, lists: [], cards: [] }), false);
    assert.equal(trelloMu({ projects: [] }), false);
    assert.equal(trelloMu(null), false);
    assert.equal(trelloMu([]), false);
  });
  test('listeler pos sırasında, arşivdeki liste seçilemez', () => {
    assert.deepEqual(trelloListeleri(pano()), [
      { id: 'L1', name: 'Yapılacak' }, { id: 'L2', name: 'Yapılıyor' }, { id: 'L3', name: 'Bitti' },
    ]);
    assert.deepEqual(trelloListeleri({ nope: 1 }), []);
  });
});

describe('objectIdZamani — kart açılış tarihi kimlikten', () => {
  test('ilk 8 hane Unix saniyesi', () => {
    assert.equal(objectIdZamani(KART1), '2020-10-16T22:14:04.000Z');
  });
  test('ObjectId değilse null', () => {
    assert.equal(objectIdZamani('abc'), null);
    assert.equal(objectIdZamani(null), null);
    assert.equal(objectIdZamani('zzzzzzzz3d4e5f6a7b8c9d0e'), null);
  });
});

describe('trelloPaketi — bitiş listesi kararı', () => {
  test('done_list verilmezse (undefined) reddedilir: sistem tahmin etmez', () => {
    const r = trelloPaketi(pano(), { now });
    assert.equal(r.ok, false);
    assert.match(r.sebep, /done_list/);
  });
  test('null = bitiş kolonu yok; hiçbir kolon is_done olmaz', () => {
    const r = trelloPaketi(pano(), { doneListId: null, now });
    assert.equal(r.ok, true);
    assert.ok(r.paket.projects[0].columns.every((c) => c.is_done === false));
    assert.ok(r.paket.projects[0].tasks.every((t) => t.completed_at === null));
  });
  test('seçilen liste is_done; adı "Bitti" olan başka liste değil', () => {
    const r = trelloPaketi(pano(), { doneListId: 'L1', now });
    const kolonlar = r.paket.projects[0].columns;
    assert.deepEqual(kolonlar.map((c) => [c.slug, c.is_done]), [['yapılacak', true], ['yapılıyor', false], ['bitti', false]]);
  });
  test('arşivdeki ya da olmayan liste bitiş seçilemez', () => {
    assert.equal(trelloPaketi(pano(), { doneListId: 'LA', now }).ok, false);
    assert.equal(trelloPaketi(pano(), { doneListId: 'YOK', now }).ok, false);
  });
  test('Trello değilse reddedilir', () => {
    assert.equal(trelloPaketi({ format: TASINMA_BICIM }, { doneListId: null }).ok, false);
  });
});

describe('trelloPaketi — dönüşüm kuralları', () => {
  const r = trelloPaketi(pano(), { doneListId: 'L3', now });
  const proje = r.paket.projects[0];
  const kart1 = proje.tasks.find((t) => t.title === 'Giriş ekranı');
  const kart2 = proje.tasks.find((t) => t.title === 'Bitmiş iş');

  test('paket başlığı bizim biçim, kaynak trello, tek proje = pano adı', () => {
    assert.equal(r.paket.format, TASINMA_BICIM);
    assert.equal(r.paket.source, 'trello');
    assert.equal(r.paket.projects.length, 1);
    assert.equal(proje.name, 'Ürün Yol Haritası');
    assert.equal(r.paket.workspace.name, 'Ürün Yol Haritası');
  });

  test('listeler pos sırasında kolon; slug kolonSlug ile (Türkçe harf kalır), arşivdeki liste yok', () => {
    assert.deepEqual(proje.columns.map((c) => c.slug), ['yapılacak', 'yapılıyor', 'bitti']);
    assert.deepEqual(proje.columns.map((c) => c.position), [0, 1, 2]);
    assert.equal(proje.columns[2].is_done, true);
  });

  test('arşivdeki kart ve listesi arşivde olan kart TAŞINMAZ ama SAYILIR', () => {
    assert.deepEqual(proje.tasks.map((t) => t.title).sort(), ['Bitmiş iş', 'Giriş ekranı']);
    assert.equal(r.rapor.cards, 2);
    assert.equal(r.rapor.archived_cards, 1);
    assert.equal(r.rapor.orphan_cards, 1);
    assert.equal(r.rapor.archived_lists, 1);
    assert.equal(r.rapor.lists, 3);
  });

  test('etiketler: adsız etiket renk adını alır, aynı ad -2 ile ayrılır, renk tona çevrilir, _dark düşer', () => {
    assert.deepEqual(proje.labels, [
      { slug: 'hazir', name_en: 'Hazır', name_tr: 'Hazır', color_tone: 'green' },
      { slug: 'red', name_en: 'red', name_tr: 'red', color_tone: 'rose' },
      { slug: 'hazir-2', name_en: 'Hazır', name_tr: 'Hazır', color_tone: null },
    ]);
    assert.deepEqual(kart1.labels, ['hazir', 'red']);
  });

  test('üyeler: ad slug\'a çevrilir (ayse-kaya), adsız üye kullanıcı adına düşer', () => {
    assert.deepEqual(r.paket.members.map((m) => m.slug), ['ayse-kaya', 'mcan']);
    assert.deepEqual(kart1.assignees, ['ayse-kaya', 'mcan']);
    assert.equal(r.paket.members[0].trello_username, 'aysek');
  });

  test('kart alanları: açıklama olduğu gibi, doc null, öncelik mid, günler YYYY-MM-DD, pos konum', () => {
    assert.equal(kart1.description, 'Açıklama **kalın**');
    assert.equal(kart1.doc, null);
    assert.equal(kart1.priority, 'mid');
    assert.equal(kart1.column, 'yapılacak');
    assert.equal(kart1.due, '2026-10-01');
    assert.equal(kart1.start, '2026-09-25');
    assert.equal(kart1.position, 65535);
    assert.equal(kart1.created_by, null);
  });

  test('açılış tarihi ObjectId\'den; tamamlanma yalnızca bitiş listesinde ve son hareketten', () => {
    assert.equal(kart1.created_at, '2020-10-16T22:14:04.000Z');
    assert.equal(kart1.completed_at, null);
    assert.equal(kart2.completed_at, '2026-09-18T09:30:00.000Z');
  });

  test('kontrol listeleri: birden fazlaysa liste adı öne, pos sırasında, state=complete → done', () => {
    assert.deepEqual(kart1.subtasks.map((s) => [s.title, s.done]), [
      ['Tasarım: masaüstü', true], ['Tasarım: mobil', false], ['Test: birim', true],
    ]);
    // Tek listede ön ek yok.
    assert.deepEqual(kart2.subtasks.map((s) => s.title), ['yalnız madde']);
    assert.equal(r.rapor.checklist_items, 4);
  });

  test('yorumlar yalnızca commentCard, eskiden yeniye, yazar üye eşlemesinden ya da addan; arşiv kartın yorumu yok', () => {
    assert.deepEqual(kart1.comments.map((y) => [y.author, y.text]), [
      ['dis-kisi', 'ilk yorum'], ['ayse-kaya', 'sonraki yorum'],
    ]);
    assert.equal(kart1.comments[0].created_at, '2026-09-18T08:00:00.000Z');
    assert.equal(r.rapor.comments, 2);
  });

  test('ÇIKAN PAKET DOĞRULAMADAN OLDUĞU GİBİ GEÇER — rota için ikinci bir yol yok', () => {
    const d = paketiDogrula(r.paket);
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(d.ozet.tasks, 2);
    assert.equal(d.ozet.subtasks, 4);
    assert.equal(d.ozet.comments, 2);
  });
});

describe('trelloPaketi — kırpma sessiz değil', () => {
  test('uzun başlık, açıklama ve yorum sınıra kırpılır ve sayılır', () => {
    const b = pano();
    b.cards[0].name = 'x'.repeat(ICE_SINIR.title + 5);
    b.cards[0].desc = 'y'.repeat(ICE_SINIR.description + 1);
    b.actions[0].data.text = 'z'.repeat(ICE_SINIR.comment + 1);
    const r = trelloPaketi(b, { doneListId: null, now });
    const t = r.paket.projects[0].tasks.find((x) => x.title.startsWith('x'));
    assert.equal(t.title.length, ICE_SINIR.title);
    assert.equal(t.description.length, ICE_SINIR.description);
    assert.equal(t.comments.at(-1).text.length, ICE_SINIR.comment);
    assert.deepEqual(r.rapor.truncated, { titles: 1, descriptions: 1, comments: 1 });
    assert.equal(paketiDogrula(r.paket).ok, true);
  });
  test('kart başına alt görev sınırı aşılırsa liste kırpılır ve sayılır', () => {
    const b = pano();
    b.checklists = [{ id: 'C', idCard: KART2, name: 'Çok', pos: 1, checkItems: Array.from({ length: ICE_SINIR.subtasks + 3 }, (_, i) => ({ id: `i${i}`, name: `m${i}`, state: 'incomplete', pos: i })) }];
    const r = trelloPaketi(b, { doneListId: null, now });
    const t = r.paket.projects[0].tasks.find((x) => x.title === 'Bitmiş iş');
    assert.equal(t.subtasks.length, ICE_SINIR.subtasks);
    assert.equal(r.rapor.truncated.subtask_lists, 1);
    assert.equal(paketiDogrula(r.paket).ok, true);
  });
  test('boş pano (liste yok, kart yok) da geçer', () => {
    const r = trelloPaketi({ name: 'Boş', lists: [], cards: [] }, { doneListId: null, now });
    assert.equal(r.ok, true);
    assert.equal(paketiDogrula(r.paket).ok, true);
    assert.equal(r.rapor.cards, 0);
  });
  test('bozuk kayıtlar (nesne olmayan liste/kart/üye) atlanır, patlatmaz', () => {
    const b = pano();
    b.lists.push(null, 'metin');
    b.cards.push(null, { name: 'idList yok' });
    b.members.push(null);
    b.labels.push(null);
    b.checklists.push(null);
    b.actions.push(null, { type: 'commentCard', data: {} });
    const r = trelloPaketi(b, { doneListId: 'L3', now });
    assert.equal(r.ok, true);
    assert.equal(paketiDogrula(r.paket).ok, true);
  });
});
