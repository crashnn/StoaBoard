// Pano gerçek zamanlı — kart, kolon ve yorum değişiklikleri karşı tarafa.
//
// KUSUR (17 Eylül 2026, kullanıcının D turu): "sohbet anlık gelirken kolon,
// comment F5 istiyor GÖRÜNMEK için."
//
// Kart #235 bunu önce "bildirim gelmiyor" diye kaydetmişti ve ofis oturumu
// `createAndPush`e `io` geçirilmiyor olabileceğini yazmıştı — ölçülmediği de
// dürüstçe not edilmişti. Ölçüldü ve o hipotez YANLIŞ çıktı: `io` her çağrı
// yerinde geçiyor, soket `user_<id>` odasına gerçekten katılıyor.
//
// Asıl eksik bambaşkaydı ve daha büyüktü: `routes/projects.js` ile
// `routes/tasks.js` TEK BİR soket olayı yayınlamıyordu, istemci de hiçbir pano
// olayı dinlemiyordu. Yani pano hiç gerçek zamanlı değildi. Sohbet, notlar ve
// bildirimler öyleydi; ürünün asıl iddiası olan pano değildi.
//
// Kullanıcının cümlesindeki "görünmek için" teşhisin kendisiydi: eksik olan
// bildirim değil, NESNENİN KENDİSİYDİ.
//
// Bu dosya iki şeyi ayrı ayrı kilitliyor, çünkü biri doğru olup öteki eksikken
// kusur aynen sürer:
//   1. yayın kuralının DAVRANIŞI (saf, sahte soketle ölçülüyor)
//   2. yayın noktalarının uçlara BAĞLI olduğu (kaynakta, koruduğu bloğa bağlı)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { panoYayini } from '../src/lib/board.js';
import { taskToDict, GOREV_INCLUDE } from '../src/lib/serializers.js';
import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

/** Yayınları toplayan sahte Socket.IO sunucusu. */
function sahteIo() {
  const cagrilar = [];
  return {
    cagrilar,
    to(oda) {
      return { emit: (olay, govde) => cagrilar.push({ oda, olay, govde }) };
    },
  };
}

describe('panoYayini — alan odasına, aktörüyle birlikte', () => {
  test('olay `ws_<id>` odasına gidiyor', () => {
    // Oda seçimi bilinçli: soket bağlanırken bu odaya zaten katılıyor
    // (sockets/chat.js), yani yeni bir üyelik tesisatı gerekmiyor.
    const io = sahteIo();
    const sonuc = panoYayini(io, 'task_created', 42, { task: { id: '7' } }, 'eray-atalay');
    assert.equal(sonuc, true);
    assert.equal(io.cagrilar.length, 1);
    assert.equal(io.cagrilar[0].oda, 'ws_42');
    assert.equal(io.cagrilar[0].olay, 'task_created');
  });

  test('aktör gövdeye ekleniyor — yankı elemesi buna bağlı', () => {
    // İstemci kendi yaptığı işin yankısını bununla eliyor. Aktör düşerse
    // eylemi yapanın ekranı iki kez oynar ve sürüklerken titrer.
    const io = sahteIo();
    panoYayini(io, 'task_updated', 1, { task: { id: '9' } }, 'eray-atalay');
    assert.equal(io.cagrilar[0].govde.actor, 'eray-atalay');
    assert.deepEqual(io.cagrilar[0].govde.task, { id: '9' });
  });

  test('aktör verilmezse null — alan sessizce kaybolmuyor', () => {
    const io = sahteIo();
    panoYayini(io, 'task_deleted', 1, { id: '3' });
    assert.equal(io.cagrilar[0].govde.actor, null);
  });

  test('workspaceId yoksa YAYIN YOK ve false dönüyor', () => {
    // "io yok"tan ayrı bir arıza: sunucu yayın yapabiliyor ama bu isteğin
    // hedefi belirsiz. Sessiz geçilseydi olay hiçbir odaya gitmez ve belirti
    // "gerçek zamanlı bazen çalışmıyor" olurdu — teşhisi en zor sınıf
    // (CLAUDE.md, sessiz başarısızlık).
    const io = sahteIo();
    assert.equal(panoYayini(io, 'task_created', null, { task: {} }, 'x'), false);
    assert.equal(panoYayini(io, 'task_created', undefined, { task: {} }, 'x'), false);
    assert.equal(io.cagrilar.length, 0, 'hedefsiz olay yine de yayınlanmış');
  });

  test('io yoksa patlamıyor, false dönüyor', () => {
    // Yayının gönderilememesi kullanıcının işlemini başarısız kılmamalı:
    // kart taşındı, veritabanına yazıldı. Ama sessizce de yutulmuyor —
    // gerekçe `lib/emit.js`in başında.
    assert.equal(panoYayini(null, 'task_created', 1, { task: {} }, 'x'), false);
  });
});

describe('yayın noktaları uçlara bağlı', () => {
  const TASKS = yorumsuzDosya(path.join(SRC, 'routes', 'tasks.js'));
  const PROJECTS = yorumsuzDosya(path.join(SRC, 'routes', 'projects.js'));

  // Ölçüt her seferinde İLGİLİ BLOĞA daralıyor, dosya geneline değil: dosyada
  // "bir yerde" `panoYayini` geçmesi, ARADIĞIMIZ ucun yayın yaptığını
  // göstermez. Bu depoda o tuzağa bugün beş kez düşüldü (CLAUDE.md).
  const blok = (src, bas, son) => {
    const i = src.indexOf(bas);
    assert.notEqual(i, -1, `blok başlangıcı bulunamadı: ${bas}`);
    const j = src.indexOf(son, i);
    assert.notEqual(j, -1, `blok sonu bulunamadı: ${son}`);
    return src.slice(i, j);
  };

  test('kart oluşturma yayınlıyor', () => {
    const b = blok(TASKS, 'projectTasksRouter.post(', 'tasksRouter.get(');
    assert.match(b, /panoYayini\(io, 'task_created'/,
      'yeni kart karşı tarafta F5 olmadan görünmez');
  });

  test('kart güncelleme yayınlıyor — taşıma da bu uçtan geçiyor', () => {
    const b = blok(TASKS, 'tasksRouter.patch(', 'tasksRouter.delete(');
    assert.match(b, /panoYayini\(io, 'task_updated'/,
      'kolon değişimi karşı tarafa gitmiyor — kart eski kolonunda kalır');
  });

  test('kart çöpe atma yayınlıyor', () => {
    const b = blok(TASKS, "tasksRouter.delete(\n  '/:taskId',", 'tasksRouter.post(');
    // `[\s\S]*?` — `[^)]*` DEĞİL. İlk çağrı argümanı `req.app.get('io')` ve
    // içinde parantez var; `[^)]*` oraya takılıp eşleşmiyor. CLAUDE.md bu
    // tuzağı adıyla anlatıyor (iç içe parantezi geçemeyen desen) ve testi
    // yazarken yine düştüm — mutasyon değil, testin kendisi kırılarak buldu.
    assert.match(b, /panoYayini\([\s\S]*?'task_deleted'/,
      'silinen kart karşı tarafta durmaya devam eder');
  });

  test('yorum ekleme yayınlıyor', () => {
    const b = blok(TASKS, "tasksRouter.post(\n  '/:taskId/comments'", 'commentsRouter.delete(');
    assert.match(b, /panoYayini\(io, 'task_comment'/,
      'yorum sayacı karşı tarafta F5 istemeye devam eder');
  });

  test('kolon ekleme, güncelleme, silme ve sıralama yayınlıyor', () => {
    // Dördü de aynı olayı (`board_columns`) gönderiyor: sunucu kolon LİSTESİNİ
    // bütün hâlinde yolluyor, dolayısıyla istemcide tek bir uygulama dalı var.
    // Dört ayrı birleştirme mantığı dört ayrı kusur yeri olurdu.
    const ekle = blok(PROJECTS, "projectsRouter.post(\n  '/:projectId/columns',", 'projectsRouter.post(\n  \'/:projectId/columns/reorder\'');
    assert.match(ekle, /kolonlariYayinla\(/, 'kolon ekleme yayınlamıyor');

    const sirala = blok(PROJECTS, "'/:projectId/columns/reorder'", 'columnsRouter.patch(');
    assert.match(sirala, /kolonlariYayinla\(/, 'kolon sıralama yayınlamıyor');

    const guncelle = blok(PROJECTS, 'columnsRouter.patch(', 'columnsRouter.delete(');
    assert.match(guncelle, /kolonlariYayinla\(/, 'kolon güncelleme yayınlamıyor');

    // Blok sonu bir SONRAKİ yönlendirici bildirimi: yorum satırına çapalamak
    // kırılgandı, yorumlar `yorumsuzDosya` ile zaten boşluğa çevriliyor.
    const sil = blok(PROJECTS, 'columnsRouter.delete(', 'projectsRouter.get(');
    assert.match(sil, /kolonlariYayinla\(/,
      'kolon silme yayınlamıyor — üstelik kartları da oynatıyor');
  });
});

describe('istemci pano olaylarını dinliyor ve kendi yankısını eliyor', () => {
  const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));

  test('beş olayın beşi de dinleniyor', () => {
    for (const olay of ['task_created', 'task_updated', 'task_deleted', 'board_columns', 'task_comment']) {
      assert.ok(APP.includes(`sock.on('${olay}'`), `${olay} dinlenmiyor`);
    }
  });

  test('yankı elemesi var — kendi işlemi iki kez uygulanmıyor', () => {
    // Eylemi yapanın ekranı zaten iyimser güncellendi. Kendi yankısını
    // uygulamak kart listesini iki kez oynatır; sürükleme sırasında titreme
    // olarak görünür.
    assert.match(APP, /const benimYankim = \(actor\) => actor && actor === window\.CURRENT_USER\?\.slug/,
      'yankı elemesi yok');
    const bas = APP.indexOf("sock.on('task_created'");
    const son = APP.indexOf("sock.on('notification'", bas);
    const blok = APP.slice(bas, son);
    const kullanim = (blok.match(/benimYankim\(actor\)/g) || []).length;
    assert.equal(kullanim, 5,
      `yankı elemesi ${kullanim} dinleyicide kullanılıyor, beşinde birden olmalı`);
  });

  test('kart olayları AKTİF projeye göre süzülüyor', () => {
    // `tasks` yalnızca aktif projenin kartlarını tutuyor. Başka projedeki bir
    // kartı listeye eklemek panoyu sessizce yanlış yapardı: ekranda görünür
    // ama hiçbir kolona ait değil.
    assert.match(APP, /const aktifProjede = \(t\) => String\(t\?\.project_id\) === String\(window\.CURRENT_PROJECT_ID\)/,
      'proje süzgeci yok');
    for (const olay of ['task_created', 'task_updated']) {
      const bas = APP.indexOf(`sock.on('${olay}'`);
      const blok = APP.slice(bas, APP.indexOf('});', bas));
      assert.match(blok, /aktifProjede\(task\)/, `${olay} proje süzgecinden geçmiyor`);
    }
  });

  test('kolon olayı görevleri de tazeliyor — silme kartları oynatıyor', () => {
    // Kolon silmek sunucuda kartları ilk kolona taşıyor. Yalnızca kolon
    // listesini güncellemek kartları yanlış kolonda gösterirdi.
    const bas = APP.indexOf("sock.on('board_columns'");
    const blok = APP.slice(bas, APP.indexOf("sock.on('task_comment'", bas));
    assert.match(blok, /API\.projectTasks\(/,
      'kolon değişiminden sonra görevler tazelenmiyor');
    assert.match(blok, /window\.DATA\.COLUMNS = columns/,
      'kolon listesi uygulanmıyor');
  });
});

// ── Çekmece kolonları KARTIN projesinden (kart #154) ───────────────────────
//
// KUSUR (16 Eylül 2026): çekmece kolon adını ve "taşı" menüsünü aktif
// projenin kolonlarından (DATA.COLUMNS) okuyordu. Rapor satırı ya da
// bildirimden başka projenin kartı açılınca ad ham slug görünüyor, menü
// yabancı kolonları sunuyordu; seçilince sunucu kendi projesinde eşleşme
// aradığı için taşıma sessizce olmuyordu. Kolon listesi artık ayrıntıyla
// birlikte sunucudan geliyor; çekmece varsa onu, yoksa eski listeyi okuyor.

describe('çekmece kolonları kartın projesinden geliyor (#154)', () => {
  const KOK154 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const TASKS = yorumsuzDosya(path.join(KOK154, 'server', 'src', 'routes', 'tasks.js'));
  const DRAWER = yorumsuzDosya(path.join(KOK154, 'client', 'src', 'drawer.jsx'));

  test('GET /tasks/:id kartın projesinin kolonlarını sırayla ekliyor', () => {
    const i = TASKS.indexOf("tasksRouter.get(\n  '/:taskId',");
    assert.notEqual(i, -1, 'GET /tasks/:id bulunamadı');
    const b = TASKS.slice(i, TASKS.indexOf('tasksRouter.', i + 10));
    assert.match(b, /where: \{ projectId: access\.task\.projectId \},\s+orderBy: \{ position: 'asc' \},/,
      'kolonlar kartın projesinden sıralı okunmuyor');
    assert.match(b, /columns: kolonlar\.map\(columnToDict\)/, 'kolonlar yanıta girmiyor');
  });

  test('çekmece ayrıntıdaki kolonları okuyor; ad da taşı menüsü de aynı listeden', () => {
    assert.match(DRAWER, /const kolonlar = Array\.isArray\(detail\?\.columns\) && detail\.columns\.length \? detail\.columns : DATA\.COLUMNS;/,
      'çekmece ayrıntıdaki kolon listesini kullanmıyor');
    assert.match(DRAWER, /const col = kolonlar\.find\(c => c\.id === task\.col\)/, 'kolon adı hâlâ aktif projeden');
    assert.match(DRAWER, /\{kolonlar\.map\(c => \(\s+<button key=\{c\.id\}/, 'taşı menüsü hâlâ aktif projeden');
    // İki okuyucu kalmamalı: DATA.COLUMNS yalnızca yedek olarak, tek yerde.
    const kullanim = (DRAWER.match(/DATA\.COLUMNS/g) || []).length;
    assert.equal(kullanim, 1, `DATA.COLUMNS çekmecede ${kullanim} yerde okunuyor — yalnızca yedek olarak, tek yerde olmalı`);
  });
});

// ── Canlı kolon panoya YANSIYOR (kart #235, 18 Eylül) ──────────────────────
//
// KUSUR (sade tur 23, iki pencere, ekran görüntülü): B yeni kolon açtı, A'ya
// bildirim geldi ama kolon GELMEDİ; F5 sonrası göründü. Olay sunucudan
// geliyordu ve DATA.COLUMNS'a yazılıyordu — yukarıdaki test tam olarak bunu
// ölçüyordu ve yeşildi. Pano ise kolonları KENDİ durumunda tutuyor, o durum
// yalnızca açılışta doluyordu: yazılan liste hiç okunmuyordu. Bildirimi değil
// KULLANIMI ölçmek gerekiyordu (CLAUDE.md, 18 Eylül dersi).

describe('canlı kolon panonun kendi durumuna yansıyor (#235)', () => {
  const K = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const APP235 = yorumsuzDosya(path.join(K, 'client', 'src', 'app.jsx'));
  const BOARD235 = yorumsuzDosya(path.join(K, 'client', 'src', 'views', 'board.jsx'));
  const OLAY = 'stoa:kolonlarDegisti';

  test('kolon olayı listeyi yazdıktan SONRA panoya haber veriyor', () => {
    const bas = APP235.indexOf("sock.on('board_columns'");
    const blok = APP235.slice(bas, APP235.indexOf("sock.on('task_comment'", bas));
    const yaz = blok.indexOf('window.DATA.COLUMNS = columns');
    const haber = blok.indexOf(`window.dispatchEvent(new CustomEvent('${OLAY}'))`);
    assert.ok(haber > 0, 'pano haberdar edilmiyor — kolon F5\'e kadar görünmez');
    assert.ok(haber > yaz, 'haber listeyi yazmadan ÖNCE gidiyor — pano eski listeyi okur');
  });

  test('pano aynı olayı dinleyip KENDİ durumunu küresel listeden tazeliyor', () => {
    const i = BOARD235.indexOf(`window.addEventListener('${OLAY}'`);
    assert.ok(i > 0, 'pano kolon olayını dinlemiyor');
    const govde = BOARD235.slice(BOARD235.lastIndexOf('useBoardEf(', i), BOARD235.indexOf('}, []);', i));
    assert.match(govde, /setColumns\(tekKolonlar\(window\.DATA\.COLUMNS\)\)/,
      'pano durumu küresel listeden tazelenmiyor');
    assert.match(govde, new RegExp(`removeEventListener\\('${OLAY}'`), 'dinleyici sökülmüyor — her kurulumda birikir');
  });

  test('tekilleştirme tek kuraldan — açılış ve canlı olay aynı fonksiyonu kullanıyor', () => {
    assert.equal((BOARD235.match(/new Set\(\);\s*return \(cols/g) || []).length, 1, 'tekilleştirme kopyalanmış');
    assert.match(BOARD235, /useBoardState\(\(\) => tekKolonlar\(DATA\.COLUMNS\)\)/, 'açılış tekKolonlar kullanmıyor');
  });
});

// "BEN" rozeti ile ona yer açan boşluk (#268). Rozet mutlak konumlu, üst
// satırın üstüne biniyor. Boşluk `data-mine`dan okunuyordu (`&& !isDone`),
// rozet ise yalnızca `isAssignedToMe`den: bitmiş kartta rozet kaldı, boşluk
// gitti, başlık rozetin altına girdi. Aynı olgunun iki okuyucusu — ölçüt
// ikisinin AYNI ifadeden okuduğu.
describe('"BEN" rozeti ve boşluğu aynı koşuldan (#268)', () => {
  const K = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const board = yorumsuzDosya(path.join(K, 'client', 'src', 'views', 'board.jsx'));
  const css = yorumsuzDosya(path.join(K, 'client', 'src', 'styles.css'));

  test('rozet ve data-ben aynı ifadeyi okuyor', () => {
    const rozet = /\{([^{}]+?) && \(\s*<div className="card-ben">/.exec(board);
    const alan = /data-ben=\{([^{}]+)\}/.exec(board);
    assert.ok(rozet, 'rozet bulunamadı');
    assert.ok(alan, 'data-ben yok — rozetin boşluğu neye bağlı?');
    assert.equal(alan[1].trim(), rozet[1].trim(), 'rozet ile boşluk farklı koşuldan okuyor');
  });

  test('boşluk data-ben kuralında, üst satırın iki biçimine de', () => {
    const kural = /([^{}]+)\{\s*padding-right:\s*\d+px;\s*\}/g;
    const secenler = [...css.matchAll(kural)].map((m) => m[1]).filter((s) => /\.card\[data-(?:ben|mine)="true"\]/.test(s));
    const hepsi = secenler.join(',');
    assert.match(hepsi, /\.card\[data-ben="true"\] > \.card-tags/, 'etiket şeridi rozetin altına giriyor');
    assert.match(hepsi, /\.card\[data-ben="true"\] > \.card-title/, 'başlık rozetin altına giriyor');
    assert.doesNotMatch(hepsi, /data-mine/, 'boşluk yine data-mine\'a bağlı');
  });
});

// Takım hareketleri canlı (#259). KUSUR (18 Eylül, sade tur 25): "A ile kart
// taşıyınca takım hareketleri değişmedi … F5 attıktan sonra geldi." Liste
// yalnızca önyüklemeden geliyordu ve `window.DATA.ACTIVITY` globalindeydi —
// olay gelse bile global değişince ekran çizilmezdi. Üç şey ayrı ölçülüyor:
// yayın kuralı, her hareket YAZARININ yayınlaması (işlem dışında), istemcinin
// uygulaması.
describe('takım hareketleri canlı (#259)', async () => {
  const { etkinlikYayini } = await import('../src/lib/board.js');
  const { etkinligeEkle, ETKINLIK_AZAMI } = await import('../../client/src/etkinlik.js');
  const K = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const app = yorumsuzDosya(path.join(K, 'client', 'src', 'app.jsx'));

  test('etkinlikYayini: alan odasına, projesi ve kimliğiyle', () => {
    const io = sahteIo();
    const satir = { id: 41, projectId: 7, text: '{}', createdAt: new Date(), user: { name: 'Eray Atalay', slug: 'eray' } };
    assert.equal(etkinlikYayini(io, 15, satir, 'eray'), true);
    assert.equal(io.cagrilar.length, 1);
    const { oda, olay, govde } = io.cagrilar[0];
    assert.equal(oda, 'ws_15');
    assert.equal(olay, 'activity_new');
    assert.equal(govde.project_id, '7');
    assert.equal(govde.activity.id, '41', 'kimliksiz kayıt istemcide tekilleştirilemez');
    assert.equal(govde.activity.user_slug, 'eray');
    assert.equal(govde.actor, 'eray');
    assert.equal(etkinlikYayini(sahteIo(), 15, null, 'eray'), false, 'satır yoksa yayın yok');
  });

  test('etkinligeEkle: başa, tekil, sunucuyla aynı sınır', () => {
    const on = Array.from({ length: ETKINLIK_AZAMI }, (_, i) => ({ id: String(i) }));
    const yeni = etkinligeEkle(on, { id: 'x' });
    assert.equal(yeni[0].id, 'x');
    assert.equal(yeni.length, ETKINLIK_AZAMI, 'liste sınırı aştı');
    assert.equal(etkinligeEkle(on, { id: 3 }), on, 'aynı kimlik iki kez');
    assert.equal(etkinligeEkle(on, { text: 'kimliksiz' }), on);
    assert.deepEqual(etkinligeEkle(undefined, { id: 'a' }), [{ id: 'a' }]);
    assert.equal(ETKINLIK_AZAMI, 10, 'sunucunun önyükleme sınırı (api.js take: 10) ile ayrıştı');
  });

  test('her hareket yazarı yayınlıyor — işlem kesinleştikten sonra', () => {
    /** `{`den eşi olan `}`e kadar (yorumsuz kaynakta). */
    const blokSonu = (src, ac) => {
      let d = 0;
      for (let i = ac; i < src.length; i += 1) {
        if (src[i] === '{') d += 1;
        else if (src[i] === '}') { d -= 1; if (d === 0) return i; }
      }
      return -1;
    };
    let yazar = 0;
    for (const ad of ['tasks.js', 'projects.js']) {
      const src = yorumsuzDosya(path.join(SRC, 'routes', ad));
      const cagrilar = [...src.matchAll(/(\w+) = await logActivity\(/g)];
      yazar += cagrilar.length;
      assert.doesNotMatch(src, /[;{]\s*await logActivity\(/, `${ad}: hareket satırı yakalanmadan yazılıyor`);
      const yayinlar = [...src.matchAll(/etkinlikYayini\(io, [^,]+, ([\w.]+), user\.slug\)/g)];
      assert.equal(yayinlar.length, cagrilar.length, `${ad}: her hareket yazarına bir yayın düşmüyor`);
      for (const y of yayinlar) {
        const degisken = y[1].split('.').pop();
        assert.ok(cagrilar.some((c) => c[1] === degisken), `${ad}: yayınlanan '${y[1]}' yazılan satır değil`);
      }
      for (const t of src.matchAll(/prisma\.\$transaction\(async \(tx\) => \{/g)) {
        const ac = t.index + t[0].length - 1;
        const govde = src.slice(ac, blokSonu(src, ac));
        assert.doesNotMatch(govde, /etkinlikYayini\(/, `${ad}: yayın işlem içinde — geri alınırsa hayalet hareket`);
      }
    }
    assert.equal(yazar, 3, 'hareket yazarı sayısı değişti (kart açma, taşıma, kolon) — yayını da ekle');
    // Satır kullanıcısız dönerse yayındaki kayıt adsız/avatarsız çıkar.
    const lib = yorumsuzDosya(path.join(SRC, 'lib', 'projects.js'));
    const lb = lib.indexOf('export async function logActivity');
    assert.match(lib.slice(lb, lib.indexOf('\n}', lb)), /include: \{ user: true \}/, 'logActivity kullanıcıyı döndürmüyor');
  });

  test('istemci: aktif projeye, yankı elenmeden, durumdan', () => {
    const bas = app.indexOf("sock.on('activity_new'");
    assert.ok(bas >= 0, 'activity_new dinlenmiyor');
    const govde = app.slice(bas, app.indexOf('});', bas));
    assert.match(govde, /String\(project_id\) !== String\(window\.CURRENT_PROJECT_ID\)/, 'başka projenin hareketi listeye giriyor');
    assert.match(govde, /setEtkinlik\(prev => etkinligeEkle\(prev, activity\)\)/);
    assert.doesNotMatch(govde, /benimYankim/, 'kendi hareketin görünmez olur — yankı burada iyimser uygulanmıyor');
    assert.match(app, /setEtkinlik\(data\.activity \|\| \[\]\);/, 'önyükleme durumu doldurmuyor');
    assert.match(app, /<DashboardView [^>]*etkinlik=\{etkinlik\}/);
    for (const d of kaynakDosyalari(path.join(K, 'client', 'src'), /\.(jsx?|mjs)$/)) {
      assert.doesNotMatch(yorumsuzDosya(d), /DATA\.ACTIVITY/, `${path.basename(d)}: global hareket listesi geri geldi — değişince çizilmez`);
    }
  });
});

// ─── #271 — kartta görünen ama kartın kendisine dokunmayan değişiklikler ─────
//
// Alt görev, ek ve yorum silme kartın satırını değiştirmiyor ama kartta
// GÖRÜNEN şeyi (ilerleme, "2/5", ataç ve yorum sayacı) değiştiriyor. 19 Eylül'e
// kadar hiçbiri yayınlanmıyordu. Ölçüt her uçta kendi bloğuna bağlı.

describe('alt görev, ek ve yorum silme kartı yeniden yayınlıyor (#271)', () => {
  const TASKS = yorumsuzDosya(path.join(SRC, 'routes', 'tasks.js'));
  const ATT = yorumsuzDosya(path.join(SRC, 'routes', 'attachments.js'));
  const BOARD = yorumsuzDosya(path.join(SRC, 'lib', 'board.js'));
  const blok = (src, bas, son) => {
    const i = src.indexOf(bas);
    assert.notEqual(i, -1, `blok başlangıcı bulunamadı: ${bas}`);
    const j = src.indexOf(son, i);
    assert.notEqual(j, -1, `blok sonu bulunamadı: ${son}`);
    return src.slice(i, j);
  };
  // Yayın YANITTAN ÖNCE olmalı: yanıttan sonraki satır, asyncHandler'ın
  // istek yaşam döngüsünde teknik olarak koşar ama "yanıt gitti, sonra yayın
  // yapılmadı" hatası buradan görünmez. Sıra ölçülüyor.
  const yayinOnce = (b, ad) => {
    const y = b.indexOf('gorevYayini(');
    assert.notEqual(y, -1, `${ad}: kart yeniden yayınlanmıyor — karşı taraf F5'e kadar eski sayacı görür`);
    const sonYanit = Math.max(b.lastIndexOf('res.json('), b.lastIndexOf('res.status(201)'));
    assert.ok(sonYanit > y, `${ad}: yayın başarılı yanıttan sonra`);
  };

  test('alt görev ekleme / düzenleme / silme', () => {
    yayinOnce(blok(TASKS, "tasksRouter.post(\n  '/:taskId/subtasks'", 'subtasksRouter.patch('), 'alt görev ekleme');
    yayinOnce(blok(TASKS, 'subtasksRouter.patch(', 'subtasksRouter.delete('), 'alt görev düzenleme');
    yayinOnce(blok(TASKS, 'subtasksRouter.delete(', 'tasksRouter.get('), 'alt görev silme');
  });

  test('yorum silme (ekleme zaten yayınlıyordu)', () => {
    yayinOnce(blok(TASKS, 'commentsRouter.delete(', '\n);'), 'yorum silme');
  });

  test('ek yükleme / yeniden adlandırma / silme', () => {
    yayinOnce(blok(ATT, "taskAttachmentsRouter.post(", 'attachmentsRouter.get('), 'ek yükleme');
    yayinOnce(blok(ATT, 'attachmentsRouter.patch(', 'attachmentsRouter.delete('), 'ek adlandırma');
    yayinOnce(blok(ATT, 'attachmentsRouter.delete(', 'chatUploadRouter.post('), 'ek silme');
  });

  test('gorevYayini kartı GOREV_INCLUDE ile yükleyip task_updated gönderiyor; çöpteki kart yayınlanmıyor', () => {
    const b = blok(BOARD, 'export async function gorevYayini', '\n}');
    assert.match(b, /include: \{ \.\.\.GOREV_INCLUDE/, 'dict için gereken join\'ler eksik — sayaçlar 0 gider');
    assert.match(b, /if \(!task \|\| task\.deletedAt\) return false;/, 'çöpteki kart panoya "güncellendi" diye geri gelir');
    assert.match(b, /panoYayini\(io, 'task_updated'/, 'istemcinin dinlediği olay değil');
  });

  test('ek sayısı kartta artık gerçek — sabit 0 değil', () => {
    // 19 Eylül'e kadar `attachments: 0` sabitti; önyükleme ekleri hiç
    // yüklemiyordu. Ataç simgesi hiçbir kartta hiçbir zaman görünmüyordu.
    assert.ok(GOREV_INCLUDE.attachments, 'include ekleri yüklemiyor');
    const dict = taskToDict({ id: 1, title: 't', column: { slug: 'todo' }, attachments: [{ id: 1 }, { id: 2 }] });
    assert.equal(dict.attachments, 2);
    assert.equal(taskToDict({ id: 1, title: 't', column: { slug: 'todo' } }).attachments, 0);
  });

  test('görev include bloğunun kopyası kalmadı — tek kaynak GOREV_INCLUDE', () => {
    // Beş route dosyasında elle kopyalanmış include vardı; hiçbirinde ek yoktu.
    // Kopya geri gelirse sayaçlardan biri yine sessizce 0 olur.
    const kopya = kaynakDosyalari(path.join(SRC, 'routes'), /\.js$/)
      .filter((f) => /labelLinks: \{ include: \{ label: true \} \},\s*subtasks: true,\s*comments: \{ select: \{ id: true \} \}/.test(yorumsuzDosya(f)))
      .map((f) => path.basename(f));
    assert.deepEqual(kopya, [], 'görev include bloğu yeniden kopyalanmış');
  });
});
