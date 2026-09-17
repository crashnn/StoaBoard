// Alt görevin tek kaynağı ve ilerlemenin tek üreticisi.
//
// ── Korunan kusur ─────────────────────────────────────────────────────────
//
// 13 Eylül 2026'da Cowork MCP 0.5.0'ı canlıda denerken #19'da üç ayrı hikâye
// gördü: `subtasks_detail` "yapılmadı", `doc` içindeki liste "yapıldı",
// ilerleme %100. Kök sebep MCP'den eskiydi — çekmece yapılacaklar listesini
// `task.doc`a yazıp ilerlemeyi kendisi hesaplıyordu, kart açma penceresi ve
// MCP `subtasks` tablosuna yazıyordu. İki kaynağı birden taşıyan 5 kartın 3'ü
// ayrışmıştı. Aynı denemede ilerlemenin de donduğu görüldü: son alt görevi
// silinen kart `doing` kolonunda %100 kaldı.
//
// Bu dosya iki katmanı kilitliyor:
//   1. Saf çekirdek (`lib/checklist.js`) — kural ve göçün birleştirme planı.
//      Vakalar gerçek kartlardan alındı (#11, #18, #19, #40, #42).
//   2. Tarama — ikinci kaynağın ya da ikinci üreticinin geri gelmesi: uç
//      ilerlemeyi gövdeden okursa, `doc`a liste yazılabilirse, istemci liste
//      bloğu üretirse test kırılır.
//
//   çalıştır:  npm.cmd test        (Windows PowerShell)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ilerlemeHesapla,
  docKontrolListesiVarMi,
  kontrolListesiMaddeleri,
  docKontrolListesiz,
  kontrolListesiBirlestir,
} from '../src/lib/checklist.js';
import { taskToDetailDict } from '../src/lib/serializers.js';
import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

// ─── 1. İlerleme kuralı ───────────────────────────────────────────────────

describe('ilerlemeHesapla — tek kural', () => {
  test('alt görevi kalmayan bitmemiş kart 0 — donmuyor (#114)', () => {
    assert.equal(ilerlemeHesapla({ altlar: [], kolonBitti: false }), 0);
  });

  test('bitmiş kolondaki kart 100, alt görevleri işaretsiz olsa da', () => {
    // #4: "tamamlandı" kolonunda, 0/2. Taşıma 100 yazıyor, işaretlemek oranı
    // yazıyordu — iki kural çelişiyordu; kolon kazanıyor.
    const altlar = [{ done: false }, { done: false }];
    assert.equal(ilerlemeHesapla({ altlar, kolonBitti: true }), 100);
    assert.equal(ilerlemeHesapla({ altlar: [], kolonBitti: true }), 100);
  });

  test('bitmemiş kolonda tamamlanan alt görev oranı, yuvarlanmış', () => {
    const uc = [{ done: true }, { done: true }, { done: false }];
    assert.equal(ilerlemeHesapla({ altlar: uc, kolonBitti: false }), 67);
    assert.equal(ilerlemeHesapla({ altlar: [{ done: true }], kolonBitti: false }), 100);
  });

  test('kolon durumu bilinmiyorsa (NULL is_done) bitmemiş sayılıyor', () => {
    // 86 kolonun 53'ünde is_done NULL (13 Eylül). "Bitmiş" ancak açıkça true.
    assert.equal(ilerlemeHesapla({ altlar: [], kolonBitti: null }), 0);
    assert.equal(ilerlemeHesapla({ altlar: [], kolonBitti: undefined }), 0);
  });

  test('bozuk girdi patlamıyor', () => {
    assert.equal(ilerlemeHesapla({ altlar: null, kolonBitti: false }), 0);
    assert.equal(ilerlemeHesapla({ altlar: [null, { done: true }], kolonBitti: false }), 50);
  });
});

// ─── 2. doc okuma ve ayıklama ─────────────────────────────────────────────

describe('kontrol listesi — doc tarafı', () => {
  test('liste bloğu var mı', () => {
    assert.equal(docKontrolListesiVarMi([{ kind: 'p', text: 'a' }]), false);
    assert.equal(docKontrolListesiVarMi([{ kind: 'checklist', items: [] }]), true);
    assert.equal(docKontrolListesiVarMi(null), false);
    assert.equal(docKontrolListesiVarMi('checklist'), false);
  });

  test('maddeler: üç saklanma biçimi, birden çok blok, boş madde atlanıyor', () => {
    const doc = [
      { kind: 'checklist', items: [{ id: 10, text: 'a', done: true }, { text: 'b', done: false }] },
      { kind: 'p', text: 'ara' },
      { kind: 'checklist', items: ['düz metin', { text: '   ', done: true }, { text: ' c ' }] },
    ];
    assert.deepEqual(kontrolListesiMaddeleri(doc), [
      { text: 'a', done: true, id: 10 },
      { text: 'b', done: false, id: null },
      { text: 'düz metin', done: false, id: null },
      { text: 'c', done: false, id: null },
    ]);
  });

  test('ayıklama listeyi ve hemen önündeki üretilmiş başlığı çıkarıyor (#19)', () => {
    const doc = [
      { kind: 'h2', text: 'Açıklama' }, { kind: 'p', text: 'ttakcviöm' },
      { kind: 'h2', text: 'Alt görevler' }, { kind: 'checklist', items: [{ text: 'a', done: true }] },
    ];
    assert.deepEqual(docKontrolListesiz(doc), [
      { kind: 'h2', text: 'Açıklama' }, { kind: 'p', text: 'ttakcviöm' },
    ]);
  });

  test('altında liste olmayan "Alt görevler" başlığı kullanıcınındır, kalıyor', () => {
    const doc = [{ kind: 'h2', text: 'Alt görevler' }, { kind: 'p', text: 'elle yazdım' }];
    assert.deepEqual(docKontrolListesiz(doc), doc);
  });

  test('başlıksız liste de gidiyor (#11 — çekmecenin yazdığı biçim)', () => {
    const doc = [{ kind: 'p', text: 'x' }, { kind: 'checklist', items: [] }];
    assert.deepEqual(docKontrolListesiz(doc), [{ kind: 'p', text: 'x' }]);
  });
});

// ─── 3. Göçün birleştirme planı — gerçek kartlardan ───────────────────────

describe('kontrolListesiBirlestir — veri kaybettirmeden birleştirir', () => {
  test('#19: eşleşen maddede işaret DOC\'tan alınıyor', () => {
    // Doc saklıyken çekmece yalnızca doc'u gösteriyordu; tablo bayat kopyaydı.
    const plan = kontrolListesiBirlestir({
      docMaddeler: [{ text: 'a', done: true, id: null }],
      altlar: [{ id: 10, title: 'a', done: false }],
    });
    assert.deepEqual(plan, { guncelle: [{ id: 10, done: true }], ekle: [] });
  });

  test('#42: bir madde eşleşiyor, iki madde yeni satır oluyor', () => {
    const plan = kontrolListesiBirlestir({
      docMaddeler: [
        { text: 'Meta Reklamlarını Başarılı bir şekilde rapor çıkarmak', done: true, id: null },
        { text: "Google Drive'da bir klasöre yüklenmesi", done: true, id: null },
        { text: 'Her Markanın teker teker raporunun çıkarılması', done: true, id: null },
      ],
      altlar: [{ id: 20, title: 'Meta Reklamlarını Başarılı bir şekilde rapor çıkarmak', done: true }],
    });
    assert.deepEqual(plan.guncelle, []);
    assert.deepEqual(plan.ekle, [
      { title: "Google Drive'da bir klasöre yüklenmesi", done: true },
      { title: 'Her Markanın teker teker raporunun çıkarılması', done: true },
    ]);
  });

  test('#18: aynı metin iki kez — satırlar sırayla, birer kez eşleşiyor', () => {
    const plan = kontrolListesiBirlestir({
      docMaddeler: [{ text: 'asdasd', done: true, id: null }, { text: 'asdasd', done: true, id: null }],
      altlar: [{ id: 8, title: 'asdasd', done: true }, { id: 9, title: 'asdasd', done: true }],
    });
    assert.deepEqual(plan, { guncelle: [], ekle: [] });
  });

  test('#11: tabloda hiç satır yok — bütün maddeler işaretleriyle ekleniyor', () => {
    const plan = kontrolListesiBirlestir({
      docMaddeler: [{ text: 'bir', done: true, id: null }, { text: 'iki', done: false, id: null }],
      altlar: [],
    });
    assert.deepEqual(plan.ekle, [{ title: 'bir', done: true }, { title: 'iki', done: false }]);
  });

  test('doc\'ta olmayan tablo satırı silinmiyor — plan silme bilmiyor', () => {
    const plan = kontrolListesiBirlestir({
      docMaddeler: [{ text: 'a', done: false, id: null }],
      altlar: [{ id: 1, title: 'a', done: false }, { id: 2, title: 'MCP ile açıldı', done: false }],
    });
    assert.deepEqual(Object.keys(plan).sort(), ['ekle', 'guncelle']);
    assert.deepEqual(plan, { guncelle: [], ekle: [] });
  });

  test('önce kimlik, sonra metin; metin eşleşmesi boşluk ve Türkçe büyük harf duyarsız', () => {
    const kimlikle = kontrolListesiBirlestir({
      docMaddeler: [{ text: 'başlık değişmiş', done: true, id: 5 }],
      altlar: [{ id: 5, title: 'eski başlık', done: false }],
    });
    assert.deepEqual(kimlikle, { guncelle: [{ id: 5, done: true }], ekle: [] });

    const metinle = kontrolListesiBirlestir({
      docMaddeler: [{ text: '  İLK   iş ', done: false, id: null }],
      altlar: [{ id: 7, title: 'ilk iş', done: false }],
    });
    assert.deepEqual(metinle, { guncelle: [], ekle: [] });
  });

  test('plan iki kez uygulanırsa ikincisi boş — göç tekrar koşulabilir', () => {
    const docMaddeler = [{ text: 'a', done: true, id: null }, { text: 'b', done: false, id: null }];
    const ilk = kontrolListesiBirlestir({ docMaddeler, altlar: [{ id: 1, title: 'a', done: false }] });
    const sonra = [
      { id: 1, title: 'a', done: ilk.guncelle.find((g) => g.id === 1)?.done ?? false },
      ...ilk.ekle.map((e, i) => ({ id: 100 + i, title: e.title, done: e.done })),
    ];
    assert.deepEqual(kontrolListesiBirlestir({ docMaddeler, altlar: sonra }), { guncelle: [], ekle: [] });
  });
});

// ─── 4. Serileştirici artık ikinci kaynağı üretmiyor ──────────────────────

describe('taskToDetailDict — alt görevler doc\'a kopyalanmıyor', () => {
  test('saklı doc yokken üretilen doc liste bloğu taşımıyor', () => {
    // Çekmece bu bloğu okuyup doc olarak geri saklıyordu; ikinci kaynak buradan
    // doğuyordu.
    const d = taskToDetailDict({
      id: 1, title: 'k', description: 'açıklama', priority: 'mid', progress: 0, projectId: 1,
      doc: null, column: null, creator: null, assignees: [], labelLinks: [], comments: [],
      subtasks: [{ id: 3, title: 'alt', done: false }],
    });
    assert.equal(docKontrolListesiVarMi(d.doc), false);
    assert.deepEqual(d.subtasks_detail, [{ id: 3, text: 'alt', done: false }]);
  });
});

// ─── 5. Tarama — ikinci kaynak ve ikinci üretici geri gelmesin ─────────────

/** `ad(` çağrısının parantez içini döner; iç içe parantezi sayarak. */
function cagriGovdeleri(kaynak, ad) {
  const govdeler = [];
  let i = kaynak.indexOf(`${ad}(`);
  while (i !== -1) {
    const bas = i + ad.length + 1;
    let derinlik = 1;
    let j = bas;
    for (; j < kaynak.length && derinlik > 0; j += 1) {
      if (kaynak[j] === '(') derinlik += 1;
      else if (kaynak[j] === ')') derinlik -= 1;
    }
    govdeler.push(kaynak.slice(bas, j - 1));
    i = kaynak.indexOf(`${ad}(`, j);
  }
  return govdeler;
}

describe('ilerlemenin tek üreticisi — tarama', () => {
  const tasks = yorumsuzDosya(path.join(SRC, 'routes', 'tasks.js'));

  test('kart ucu ilerlemeyi istek gövdesinden okumuyor', () => {
    assert.ok(!/data\.progress|'progress'\s+in\s+data/.test(tasks),
      'PATCH gövdedeki progress\'i kabul ediyor — eski bir sekme ikinci üreticiyi geri getirir');
  });

  test('uçlar ilerlemeyi elle yazmıyor; yazılan her yerde kural çağrılıyor', () => {
    const dosyalar = kaynakDosyalari(path.join(SRC, 'routes'), /\.js$/);
    assert.ok(dosyalar.length >= 5, `yalnızca ${dosyalar.length} route dosyası bulundu`);
    const kacak = [];
    for (const dosya of dosyalar) {
      const satirlar = yorumsuzDosya(dosya).split('\n');
      satirlar.forEach((satir, n) => {
        // İki biçim: `progress: x` / `progress = x` ve kısaltmalı `{ progress }`.
        // Eski satır içi hesap tam olarak ikincisiyle yazıyordu
        // (`data: { progress }`); desenin ilk hâli onu görmüyordu — mutasyon
        // tasarlanırken fark edildi, kısaltmalı biçimle ayrıca doğrulandı.
        const yaziyor = /\bprogress\s*[:=](?!=)/.test(satir) || /[{,]\s*progress\s*[,}]/.test(satir);
        if (yaziyor && !satir.includes('ilerlemeHesapla(')) {
          kacak.push(`${path.basename(dosya)}:${n + 1}  ${satir.trim()}`);
        }
      });
    }
    assert.deepEqual(kacak, [], 'İlerleme kuraldan geçmeden yazılıyor (lib/checklist.js)');
  });

  test('kolon taşımasından sonra ilerleme yeniden türetiliyor', () => {
    const patch = tasks.slice(tasks.indexOf("tasksRouter.patch("), tasks.indexOf('DELETE /tasks/:taskId'));
    assert.ok(patch.length > 500, 'PATCH bloğu bulunamadı — desen bozuk olabilir');
    assert.ok(/if\s*\(\s*moveToCol\s*\)\s*\{\s*await recalcTaskProgress\(/.test(patch),
      'Taşıma ilerlemeyi yeniden hesaplamıyor — alt görevsiz kart eski yüzdede donar');
  });

  test('alt görev ucu kendi hesabını yapmıyor, ortak işlevi çağırıyor', () => {
    const altUc = tasks.slice(tasks.indexOf('subtasksRouter.patch('), tasks.indexOf('subtasksRouter.delete('));
    assert.ok(altUc.includes('recalcTaskProgress('), 'PATCH /subtasks ilerlemeyi yeniden hesaplamıyor');
    assert.ok(!/Math\.round/.test(altUc), 'PATCH /subtasks ilerlemeyi kendisi hesaplıyor — ikinci üretici');
  });
});

describe('alt görevin tek kaynağı — tarama', () => {
  test('kart ucu kontrol listesi taşıyan doc\'u yazmadan önce reddediyor', () => {
    const tasks = yorumsuzDosya(path.join(SRC, 'routes', 'tasks.js'));
    const red = tasks.indexOf('docKontrolListesiVarMi(data.doc)');
    const yazim = tasks.indexOf('updates.doc =');
    assert.ok(red > 0, 'doc içindeki liste denetlenmiyor');
    assert.ok(yazim > 0, 'doc yazımı bulunamadı — desen bozuk olabilir');
    assert.ok(red < yazim, 'Denetim yazımdan sonra geliyor');
    assert.ok(tasks.includes("error: 'err_doc_checklist_retired'"), 'Ret bir hata koduyla dönmüyor');
  });

  test('istemci hiçbir yerde kontrol listesi bloğu üretmiyor', () => {
    const dosyalar = kaynakDosyalari(CLIENT, /\.jsx?$/);
    assert.ok(dosyalar.length >= 10, `yalnızca ${dosyalar.length} istemci dosyası bulundu`);
    const kacak = dosyalar
      .filter((d) => /kind\s*:\s*['"]checklist['"]/.test(yorumsuzDosya(d)))
      .map((d) => path.relative(CLIENT, d));
    assert.deepEqual(kacak, [], 'İstemci doc\'a liste bloğu yazıyor — alt görevin ikinci kaynağı');
  });

  test('istemci karta ilerleme göndermiyor', () => {
    const dosyalar = kaynakDosyalari(CLIENT, /\.jsx?$/);
    const kacak = [];
    for (const d of dosyalar) {
      for (const govde of cagriGovdeleri(yorumsuzDosya(d), 'updateTask')) {
        if (/\bprogress\b/.test(govde)) kacak.push(`${path.relative(CLIENT, d)}: updateTask(${govde.slice(0, 60)}…)`);
      }
    }
    assert.deepEqual(kacak, [], 'İstemci ilerlemeyi kendisi hesaplayıp gönderiyor');
  });
});

// ─── Kart gövdesi denetimi (lib/doc.js) ──────────────────────────────────────
//
// 15 Eylül 2026: çekmece blok düzenleyiciye dönüştü. Sunucu o güne kadar
// `doc`u olduğu gibi saklıyordu; artık tür ve boyut denetliyor. Bu blok
// sınırı kilitliyor: bilinmeyen tür girmez, kabul edilen türler çıkmaz,
// açıklama senkronu düzyazıyı alır, kodu almaz.
describe('kart gövdesi — docDenetle ve docDuzMetin', async () => {
  const { docDenetle, docDuzMetin, DOC_TURLERI, DOC_METIN_SINIRI, DOC_BLOK_SINIRI } =
    await import('../src/lib/doc.js');

  test('kabul edilen türler geçer, null geçer (gövdeyi kaldır)', () => {
    for (const kind of DOC_TURLERI) {
      const blok = kind === 'ul' ? { kind, items: ['a'] } : { kind, text: 'x' };
      assert.equal(docDenetle([blok]).ok, true, kind);
    }
    assert.equal(docDenetle(null).ok, true);
    assert.equal(docDenetle([]).ok, true);
  });

  test('bilinmeyen tür, dizi olmayan gövde, nesne olmayan blok reddedilir', () => {
    assert.equal(docDenetle([{ kind: 'iframe', text: 'x' }]).ok, false);
    assert.equal(docDenetle([{ kind: 'checklist', items: [] }]).ok, false, 'checklist burada da tür olarak yok');
    assert.equal(docDenetle('metin').ok, false);
    assert.equal(docDenetle([null]).ok, false);
    assert.equal(docDenetle([{ text: 'türsüz' }]).ok, false);
  });

  test('metin ve blok sayısı sınırları', () => {
    assert.equal(docDenetle([{ kind: 'p', text: 'a'.repeat(DOC_METIN_SINIRI) }]).ok, true);
    assert.equal(docDenetle([{ kind: 'p', text: 'a'.repeat(DOC_METIN_SINIRI + 1) }]).ok, false);
    assert.equal(docDenetle([{ kind: 'p', text: 5 }]).ok, false, 'metin dize olmalı');
    assert.equal(docDenetle(Array.from({ length: DOC_BLOK_SINIRI + 1 }, () => ({ kind: 'p', text: '' }))).ok, false);
    assert.equal(docDenetle([{ kind: 'ul', items: 'a,b' }]).ok, false, 'liste maddeleri dizi olmalı');
  });

  test('düz metin: içerik girer, YAPI (başlık, kod) girmez, 1000 karakterde kırpılır', () => {
    const doc = [
      { kind: 'h2', text: 'Açıklama' },
      { kind: 'p', text: 'Birinci' },
      { kind: 'pre', text: 'const gizli = 1;' },
      { kind: 'quote', text: 'Alıntı' },
      { kind: 'callout', text: 'Uyarı' },
      { kind: 'ul', items: ['madde', ''] },
    ];
    // 'Açıklama' bir h2; 17 Eylül 2026'dan beri düz metne GİRMİYOR.
    assert.equal(docDuzMetin(doc), 'Birinci Alıntı Uyarı madde');
    assert.equal(docDuzMetin([{ kind: 'p', text: 'x'.repeat(1500) }]).length, 1000);
    assert.equal(docDuzMetin(null), '');
  });

  // KUSUR (17 Eylül 2026, kart #199): başlıklar düz metne giriyordu ve bu,
  // her açıklama düzenlemesinde veriyi bozuyordu. Çekmece kartı açarken
  // gövdeye KENDİ ürettiği bölüm başlıklarını koyuyor (drawer.jsx: h2
  // 'Açıklama', h2 'Alt görevler'), yani onlar içerik değil arayüz etiketi.
  // Gözlenen hasar: #19'un açıklaması 'Açıklama ttakcviöm Alt görevler'.
  // Eski veriye özgü değildi — tarayıcıda açılan her kart yeniden üretiyordu.
  test('çekmecenin ürettiği bölüm başlıkları açıklamaya sızmıyor', () => {
    const cekmeceGovdesi = [
      { kind: 'h2', text: 'Açıklama', _i18n: 'drawer_description' },
      { kind: 'p', text: 'ttakcviöm' },
      { kind: 'h2', text: 'Alt görevler', _i18n: 'drawer_subtasks' },
    ];
    assert.equal(
      docDuzMetin(cekmeceGovdesi),
      'ttakcviöm',
      'bölüm başlıkları açıklamaya sızıyor — kart gövdesi her düzenlemede bozulur',
    );
  });

  test('kural yapısal: _i18n işareti OLMAYAN başlık da girmiyor', () => {
    // Kasıtlı tasarım kararı. `_i18n` istemci denetiminde bir alan;
    // ona güvenen bir kural, alanı göndermeyen bir istemcide çöker.
    // Üstelik kullanıcının elle yazdığı başlık da yapıdır: bir önizleme
    // için bölüm etiketi gürültüdür, kim yazmış olursa olsun.
    assert.equal(
      docDuzMetin([{ kind: 'h2', text: 'Elle yazılmış başlık' }, { kind: 'p', text: 'gövde' }]),
      'gövde',
      'kural _i18n alanına bağlanmış olabilir — istemci onu göndermezse başlık sızar',
    );
    assert.equal(docDuzMetin([{ kind: 'h1', text: 'H1' }, { kind: 'h3', text: 'H3' }]), '',
      'h1 ve h3 de yapıdır, h2 ile aynı kurala tabi');
  });
});
