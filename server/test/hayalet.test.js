// Kalıcı silinen kart başkasının panosunda hayalet kalıyor mu (kart #339).
//
// KUSUR (2 Ekim 2026, çift hesaplı canlı turda ölçüldü ve ekran görüntüsüyle
// kaydedildi; kullanıcı da bağımsız olarak gördü): B bir kartı KALICI
// sildiğinde kart A'nın panosunda duruyordu. Çöpe atma, geri alma ve kart
// açma yayınları çalışıyordu — yalnızca kalıcı silme yayın yapmıyordu.
//
// Ekran görüntüsündeki asıl ayrıntı tutarsızlıktı: kenar çubuğunda "Ana
// Proje 0" yazarken pano kolonunda kart duruyor ve kolon sayacı "1"
// gösteriyordu. Durum bayat değil, kendi içinde ÇELİŞKİLİ — yani bir yerde
// işlenen olay başka bir yerde hiç işlenmiyordu.
//
// ETKİ: var olmayan bir kart tıklanabilir hâlde duruyor. Açan, taşıyan ya da
// yorum yazan kişi sunucudan ret alıyor. Çöp kutusunu boşaltan bir yönetici
// ekibin panolarında saatlerce hayalet kart bırakıyor.
//
// ÖLÇÜTÜN SEÇİMİ — niçin "şu uca yayın eklendi mi" DEĞİL:
// Kusurun sınıfı "aynı olgunun iki yolu, biri yayın yapıyor öteki yapmıyor".
// Tek ucu kilitlemek üçüncü bir silme yolu eklendiğinde aynı kusuru geri
// getirir. Bu yüzden ölçüt BÜTÜN kalıcı silme çağrılarını tarıyor: her biri
// ya yayın yapar ya da GEREKÇESİYLE muafiyet listesinde durur. Aynı kalıp
// `yetki.test.js`in `ACIK_UCLAR` listesinde — test kararı zorlar, sessizce
// geçmeye izin vermez.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES = path.resolve(__dirname, '..', 'src', 'routes');

// Kartı KALICI silen her çağrı. Anahtar: dosya + çağrının metni.
// `gerekce` dolu olan muaftır; muafiyetin karşılığı yayın yapmamaktır.
const MUAF = {
  'api.js|prisma.task.deleteMany({ where: { id: { in: expiredIds } } })':
    'Otuz günü geçmiş çöp kartlarının kendiliğinden temizliği (önyükleme '
    + 'içinde). Bu kartlar zaten çöpteydi, yani kimsenin panosunda '
    + 'durmuyorlardı; dahası işlemin bir aktörü yok — kullanıcı bir şey '
    + 'yapmadı, süre doldu. Yayın yapmak "biri sildi" izlenimi verirdi.',
  'api.js|tx.task.deleteMany({ where: { id: { in: taskIds } } })':
    'Hesap silme: kullanıcının sahibi olduğu çalışma alanları projeleriyle '
    + 'birlikte tamamen gidiyor. Kart yayını burada yetersiz — alanın '
    + 'kendisi yok oluyor ve öteki üyelerin ekranı bütün hâlinde bayat '
    + 'kalıyor. O daha büyük boşluk #272/#273 ailesinin konusu; kart '
    + 'yayınıyla kapanmaz, o yüzden burada bilerek yapılmıyor.',
};

/** Satırın içinde bulunduğu route bloğunu döner (bir sonraki mount noktasına kadar). */
function blok(src, konum) {
  const bas = src.lastIndexOf('Router.', konum);
  const sonrakiMount = src.indexOf('Router.', konum);
  const son = sonrakiMount > konum ? sonrakiMount : src.length;
  return src.slice(bas === -1 ? 0 : bas, son);
}

describe('kalıcı silme yayından geçiyor (#339)', () => {
  const dosyalar = ['tasks.js', 'workspaces.js', 'api.js'];
  const cagrilar = [];

  for (const ad of dosyalar) {
    const src = yorumsuzDosya(path.join(ROUTES, ad));
    // `task.delete(` ve `task.deleteMany(` — prisma ya da transaction (tx) üzerinden.
    for (const m of src.matchAll(/\b(?:prisma|tx)\.task\.delete(?:Many)?\([^;]*?\)/gs)) {
      cagrilar.push({ dosya: ad, metin: m[0].replace(/\s+/g, ' ').trim(), blok: blok(src, m.index) });
    }
  }

  test('tarama gerçekten kalıcı silme çağrısı buluyor', () => {
    // Ölçüt kendi kendini de koruyor: desen bozulup hiçbir şey bulmazsa
    // aşağıdaki testlerin tamamı bedava geçerdi.
    assert.ok(cagrilar.length >= 4,
      `yalnızca ${cagrilar.length} kalıcı silme çağrısı bulundu — desen bozulmuş olabilir`);
  });

  for (const c of cagrilar) {
    const anahtar = `${c.dosya}|${c.metin}`;
    test(`${c.dosya}: ${c.metin.slice(0, 60)}`, () => {
      if (MUAF[anahtar]) {
        // Muafiyetin anlamı yayın YAPMAMAK. Muaf bir yere yayın eklenirse
        // gerekçe bayatlamış demektir; test onu da söyler.
        assert.ok(!/task_deleted/.test(c.blok),
          `bu çağrı muafiyet listesinde ama yayın yapıyor — gerekçe güncellenmeli:\n${MUAF[anahtar]}`);
        return;
      }
      // Desen `[^;]*` ile sinirli, `[^)]*` ile DEGIL: cagri
      // `panoYayini(req.app.get('io'), 'task_deleted', ...)` biciminde ve
      // icindeki `)` yuzunden `[^)]*` eslesmiyordu. Bu testin ilk hali tam
      // bu nedenle, yayin YERINDEYKEN kirmizi dondu — CLAUDE.md'de adi
      // konmus tuzagin (ic ice parantez) ters yonu.
      assert.match(c.blok, /panoYayini\([^;]*'task_deleted'/,
        'kalıcı silme yayın yapmıyor — kart başkasının panosunda hayalet kalır.\n'
        + `Yayın eklenmeyecekse MUAF listesine GEREKÇESİYLE yaz. Anahtar:\n  '${anahtar}'`);
    });
  }

  test('muafiyet listesinde ölü kayıt yok', () => {
    // Muaf bir çağrı silinir ya da metni değişirse liste sessizce bayatlar ve
    // bir gün yanlış bir çağrıyı aklar.
    const anahtarlar = new Set(cagrilar.map((c) => `${c.dosya}|${c.metin}`));
    for (const k of Object.keys(MUAF)) {
      assert.ok(anahtarlar.has(k), `MUAF listesindeki kayıt artık kaynakta yok: ${k}`);
    }
  });

  test('tekil kalıcı silme kart KİMLİĞİNİ yayınlıyor', () => {
    // İstemci kimliğe göre süzüyor (app.jsx `task_deleted`); gövdede kimlik
    // yoksa yayın yapılır ama hiçbir şey silinmez — en sinsi hâli.
    const src = yorumsuzDosya(path.join(ROUTES, 'tasks.js'));
    const bas = src.indexOf("'/:taskId/permanent'");
    assert.ok(bas > 0, 'kalıcı silme ucu bulunamadı');
    const uc = src.slice(bas, src.indexOf('tasksRouter.', bas + 10));
    assert.match(uc, /panoYayini\(\s*req\.app\.get\('io'\),\s*'task_deleted',[^;]*\{ id: String\(taskId\) \}/,
      'kalıcı silme yayınında kart kimliği yok');
  });

  test('çöp boşaltma her kimlik için yayın yapıyor', () => {
    // "En az bir yayın var" ölçülemez bir ölçüt olurdu (17 Eylül dersi):
    // döngünün içinde olduğu ve SİLİNEN HER kimlik için çalıştığı ölçülüyor.
    const src = yorumsuzDosya(path.join(ROUTES, 'workspaces.js'));
    // Çapa DELETE ucunun KENDİSİ: aynı yol GET olarak da tanımlı (çöp
    // listesi) ve ilk eşleşme oydu — ölçüt yanlış bloğu ölçüyordu ve
    // "yayın yok" diyordu. `yorumsuzDosya` satır sonlarını \n'e
    // normalleştiriyor, bu yüzden çapa iki satırı birlikte arayabiliyor.
    const bas = src.indexOf("workspacesRouter.delete(\n  '/me/trash'");
    assert.ok(bas > 0, 'çöp boşaltma ucu bulunamadı');
    const uc = src.slice(bas, src.indexOf('workspacesRouter.', bas + 10));
    assert.match(uc, /for \(const id of taskIds\) \{\s*panoYayini\([^;]*'task_deleted'[^;]*\{ id: String\(id\) \}[^;]*;\s*\}/,
      'çöp boşaltma yayını silinen kimlikler üzerinde dönmüyor');
  });
});
