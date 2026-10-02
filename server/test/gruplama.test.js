// Liste görünümünde gruplama ölçütü (2 Ekim 2026 taraması, madde 2).
//
// ÖNEMLİ DÜZELTME: taramanın "gruplama yok" notu YARI YANLIŞTI. Liste
// görünümü zaten gruplanıyordu — ama ölçüt sabitti, her zaman kolon. Eksik
// olan grup değil SEÇİMDİ. Kodu okumadan yazılan envanter maddesi böyle
// kayabiliyor; buraya da yazıldı ki ders kaybolmasın.
//
// İKİ KARAR gruplamanın anlamını belirliyor ve ikisi de burada kilitli:
// bir kart birden çok grupta görünebiliyor (etiket/atanan), ve boş grup
// yalnızca kolonda gösteriliyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { grupla, GRUP_OLCUTLERI } from '../../client/src/gruplama.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOARD = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'board.jsx'));

const KOLONLAR = [
  { id: 'todo', title: 'To Do', color: '#1', is_done: false },
  { id: 'doing', title: 'In Progress', color: '#2', is_done: false },
  { id: 'done', title: 'Done', color: '#3', is_done: true },
];
const UYELER = [
  { id: 'ayse', name: 'Ayşe Kaya', color: '#a' },
  { id: 'mehmet', name: 'Mehmet Can', color: '#m' },
  { id: 'bos', name: 'Hiç Kartı Olmayan', color: '#b' },
];
const ETIKETLER = {
  hata: { tr: 'Hata' },
  ozellik: { tr: 'Özellik' },
  kullanilmayan: { tr: 'Kullanılmayan' },
};
const p = {
  kolonlar: KOLONLAR,
  uyeler: UYELER,
  etiketler: ETIKETLER,
  ceviri: (k, fb) => fb,
  kolonAdi: (c) => c.title,
};

const GOREVLER = [
  { id: '1', col: 'todo', priority: 'high', assignees: ['ayse'], labels: ['hata'] },
  { id: '2', col: 'todo', priority: 'low', assignees: ['ayse', 'mehmet'], labels: ['hata', 'ozellik'] },
  { id: '3', col: 'doing', assignees: [], labels: [] },
];

describe('kolona göre gruplama — varsayılan', () => {
  test('kolon sırası PANODAKİ sıra', () => {
    const g = grupla(GOREVLER, 'col', p);
    assert.deepEqual(g.map((x) => x.anahtar), ['todo', 'doing', 'done']);
  });

  test('BOŞ KOLON da gösteriliyor — panonun yapısı', () => {
    // "Done" boş ama listede: oraya kart eklemek gerekir ve başlıktaki "+"
    // oradan çalışıyor.
    const g = grupla(GOREVLER, 'col', p);
    const done = g.find((x) => x.anahtar === 'done');
    assert.ok(done, 'boş kolon listeden düşmüş');
    assert.equal(done.gorevler.length, 0);
  });

  test('kolon grubu "+" için kolon kimliği taşıyor', () => {
    assert.equal(grupla(GOREVLER, 'col', p)[0].kolonId, 'todo');
  });
});

describe('atanana göre gruplama', () => {
  test('bir kart İKİ kişiye atanmışsa İKİSİNDE DE görünüyor', () => {
    // Alternatif — yalnızca ilkine koymak — "Mehmet'in işleri" listesinde
    // Mehmet'e de atanmış bir kartı gizlerdi; liste yalan söylerdi.
    const g = grupla(GOREVLER, 'assignee', p);
    const ayse = g.find((x) => x.anahtar === 'assignee:ayse');
    const mehmet = g.find((x) => x.anahtar === 'assignee:mehmet');
    assert.deepEqual(ayse.gorevler.map((t) => t.id), ['1', '2']);
    assert.deepEqual(mehmet.gorevler.map((t) => t.id), ['2']);
  });

  test('KARTI OLMAYAN üye listede YOK', () => {
    const g = grupla(GOREVLER, 'assignee', p);
    assert.ok(!g.some((x) => x.anahtar === 'assignee:bos'), 'boş üye grubu gürültü üretiyor');
  });

  test('atanmamış kartlar EN SONDA kendi grubunda', () => {
    const g = grupla(GOREVLER, 'assignee', p);
    assert.equal(g.at(-1).anahtar, 'assignee:yok');
    assert.deepEqual(g.at(-1).gorevler.map((t) => t.id), ['3']);
  });

  test('atanmamış kart yoksa o grup HİÇ çizilmiyor', () => {
    const g = grupla([GOREVLER[0]], 'assignee', p);
    assert.ok(!g.some((x) => x.anahtar === 'assignee:yok'));
  });

  test('grup "+" taşımıyor — bir kişinin içine kart eklenmez', () => {
    assert.equal(grupla(GOREVLER, 'assignee', p)[0].kolonId, null);
  });
});

describe('önceliğe göre gruplama', () => {
  test('sıra yüksekten düşüğe', () => {
    const g = grupla(GOREVLER, 'priority', p);
    assert.deepEqual(g.map((x) => x.anahtar), ['priority:high', 'priority:mid', 'priority:low']);
  });

  test('ÖNCELİKSİZ kart "orta" sayılıyor, ayrı grup açılmıyor', () => {
    // Kartın kendisi de öyle davranıyor (varsayılan `mid`); ayrı bir
    // "önceliksiz" grubu ekranda var olmayan bir ayrım uydururdu.
    const g = grupla(GOREVLER, 'priority', p);
    assert.deepEqual(g.find((x) => x.anahtar === 'priority:mid').gorevler.map((t) => t.id), ['3']);
    assert.ok(!g.some((x) => /yok|null/.test(x.anahtar)));
  });

  test('boş öncelik grubu gösterilmiyor', () => {
    const g = grupla([GOREVLER[0]], 'priority', p);
    assert.deepEqual(g.map((x) => x.anahtar), ['priority:high']);
  });
});

describe('etikete göre gruplama', () => {
  test('iki etiketli kart İKİ grupta', () => {
    const g = grupla(GOREVLER, 'label', p);
    assert.deepEqual(g.find((x) => x.anahtar === 'label:hata').gorevler.map((t) => t.id), ['1', '2']);
    assert.deepEqual(g.find((x) => x.anahtar === 'label:ozellik').gorevler.map((t) => t.id), ['2']);
  });

  test('kullanılmayan etiket listede YOK', () => {
    assert.ok(!grupla(GOREVLER, 'label', p).some((x) => x.anahtar === 'label:kullanilmayan'));
  });

  test('etiketsizler en sonda', () => {
    const g = grupla(GOREVLER, 'label', p);
    assert.equal(g.at(-1).anahtar, 'label:yok');
  });
});

describe('bozuk girdi patlamıyor', () => {
  test('boş liste ve eksik parametre', () => {
    assert.deepEqual(grupla([], 'assignee', p), []);
    assert.deepEqual(grupla(null, 'priority', p), []);
    assert.deepEqual(grupla(GOREVLER, 'col', {}), []);
  });

  test('tanınmayan ölçüt KOLONA düşüyor', () => {
    // Sessizce boş liste döndürmek, ekranı sebepsiz boş bırakırdı.
    assert.deepEqual(grupla(GOREVLER, 'olmayan', p).map((x) => x.anahtar), ['todo', 'doing', 'done']);
  });
});

describe('liste görünümü bağlantısı', () => {
  test('gruplar tek kaynaktan geliyor', () => {
    assert.match(BOARD, /grupla\(visibleTasks, grupOlcutu, \{/, 'liste kendi gruplamasını kuruyor');
  });

  test('BİTMİŞLİK kartın KENDİ kolonundan okunuyor', () => {
    // Grup başlığından okunsaydı "öncelik: yüksek" grubundaki her kart
    // bitmiş görünürdü — gruplama kolon olmayabilir.
    // ÖLÇÜT LİSTE BLOĞUNA BAĞLI, dosya geneline değil. İlk hâli
    // `const isDone = col.is_done;` desenini dosya genelinde yasaklıyordu ve
    // ZAMAN ÇİZELGESİNİ de vuruyordu — orada gruplama her zaman kolona göre,
    // yani o okuma MEŞRU. Aynı sınıfın ters yönü: ölçüt komşudan ödünç
    // almak yerine komşuyu suçluyordu.
    const bas = BOARD.indexOf("{subView === 'list' && (");
    assert.ok(bas > 0, 'liste görünümü bulunamadı');
    const liste = BOARD.slice(bas, BOARD.indexOf("{subView === 'table' && (", bas));
    assert.match(liste, /const kartKolonu = DATA\.COLUMNS\.find\(c => c\.id === t\.col\);/,
      'bitmişlik grup başlığından okunuyor');
    assert.doesNotMatch(liste, /const isDone = col\.is_done;/, 'eski okuma geri gelmiş');
  });

  test('"+" YALNIZCA kolon grubunda', () => {
    // Bir önceliğin ya da etiketin "içine" kart eklemek diye bir şey yok.
    assert.match(BOARD, /canManageTasks && !collapsed && grup\.kolonId && \(/,
      '"+" kolon olmayan grupta da çiziliyor');
  });

  test('ölçüt HATIRLANIYOR', () => {
    assert.match(BOARD, /localStorage\.getItem\('stoa\.listGroupBy'\)/, 'ölçüt hatırlanmıyor');
    assert.match(BOARD, /localStorage\.setItem\('stoa\.listGroupBy', grupOlcutu\)/, 'ölçüt yazılmıyor');
  });

  test('seçici YALNIZCA liste görünümünde', () => {
    // Öteki üç görünümde gruplama yok; orada duran bir seçici hiçbir şeye
    // yaramayan bir düğme olurdu.
    assert.match(BOARD, /\{subView === 'list' && \(\s*\n\s*<div className="grup-secici"/,
      'gruplama seçicisi bütün görünümlerde çiziliyor');
  });

  test('dört ölçüt de seçicide', () => {
    assert.equal(GRUP_OLCUTLERI.length, 4);
    assert.deepEqual(GRUP_OLCUTLERI.map((o) => o.id), ['col', 'assignee', 'priority', 'label']);
  });
});
