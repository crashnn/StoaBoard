// Kart tarihleri — başlangıç varsayılan, bitiş kullanıcının.
//
// KARAR (17 Eylül 2026, kullanıcı): "task oluştururken başlangıç tarihi
// oluşturduğu an, bitiş tarihi kullanıcı belirlesin" ve ardından "ancak
// başlangıç değişebilir, default bugün o gün olsun."
//
// İki yarısı da kural:
//   • BAŞLANGIÇ boşsa bugünle doluyor — VARSAYILAN, dayatma değil. Elle
//     verilen değere dokunulmuyor, kullanıcı sonradan da değiştirebiliyor.
//   • BİTİŞ boş doğuyor. Tahmin edilen bir bitiş, girilmemiş bitişten kötüdür:
//     raporda gerçekmiş gibi görünür ve kimse onu koymadığını bilmez.
//
// Boş başlangıç akış raporunda "açılış" ile karışıyordu (TODO, 16 Eylül); bu
// varsayılan o karışıklığı da kaynağında kurutuyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDate, bugununTarihi } from '../src/lib/projects.js';
import { bugunYerel, yerelGunAnahtari } from '../../client/src/tarih.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TASKS = path.resolve(__dirname, '..', 'src', 'routes', 'tasks.js');
const MODALS = path.resolve(__dirname, '..', '..', 'client', 'src', 'modals.jsx');

describe('bugununTarihi — parseDate ile aynı biçim', () => {
  test('UTC gece yarısı döndürüyor, "şu an" değil', () => {
    // Biçim `parseDate`e BAĞLI, kendi başına değil. `new Date()` yazmak aynı
    // alanın iki ayrı biçimde doğması demek olurdu: kartın saati saklanır,
    // listede görünmez (`toISOString().slice(0, 10)` onu keser), ama sıralama
    // ve rapor karşılaştırmaları sessizce kayardı.
    const d = bugununTarihi();
    assert.equal(d.getUTCHours(), 0);
    assert.equal(d.getUTCMinutes(), 0);
    assert.equal(d.getUTCSeconds(), 0);
    assert.equal(d.getUTCMilliseconds(), 0);
  });

  test('bugünün UTC takvim gününü veriyor', () => {
    const simdi = new Date();
    const d = bugununTarihi();
    assert.equal(d.getUTCFullYear(), simdi.getUTCFullYear());
    assert.equal(d.getUTCMonth(), simdi.getUTCMonth());
    assert.equal(d.getUTCDate(), simdi.getUTCDate());
  });

  test('`parseDate` ile gidiş-dönüş birebir', () => {
    // Asıl ölçüt bu: varsayılan tarih, elle girilmiş bir tarihten AYIRT
    // EDİLEMEZ olmalı. Aksi hâlde "bugün açılan kart" ile "başlangıcı bugün
    // seçilmiş kart" veritabanında farklı görünür ve karşılaştırmalar şaşar.
    const d = bugununTarihi();
    const metin = d.toISOString().slice(0, 10);
    assert.deepEqual(parseDate(metin), d);
  });

  test('her çağrı eşit değer üretiyor — saat ilerlese de', () => {
    assert.deepEqual(bugununTarihi(), bugununTarihi());
  });
});

describe('kart oluşturma — başlangıç dolu, bitiş boş', () => {
  const src = yorumsuzDosya(TASKS);
  // Ölçüt oluşturma bloğuna bağlı, dosya geneline değil: `bugununTarihi`
  // dosyada geçiyor olması onun BU alana uygulandığını göstermez (CLAUDE.md).
  const bas = src.indexOf('projectTasksRouter.post(');
  const blok = src.slice(bas, src.indexOf('tasksRouter.get(', bas));

  test('başlangıç boşsa bugünle doluyor', () => {
    assert.match(blok, /startDate:\s*parseDate\(data\.start\)\s*\|\|\s*bugununTarihi\(\)/,
      'yeni kartın başlangıcı boş doğuyor — akış raporunda "açılış" ile karışır');
  });

  test('elle verilen başlangıca DOKUNULMUYOR', () => {
    // `||` sırası önemli: `bugununTarihi() || parseDate(...)` olsaydı
    // kullanıcının seçtiği tarih hiç yazılmazdı ve kusur sessiz olurdu —
    // kart oluşur, tarih görünür, ama yanlış.
    const m = /startDate:\s*([^,]+),/.exec(blok);
    assert.ok(m, 'startDate ataması bulunamadı');
    assert.ok(m[1].trim().startsWith('parseDate(data.start)'),
      'varsayılan, elle verilen değerin ÖNÜNE geçmiş');
  });

  test('BİTİŞ tarihine varsayılan verilmiyor', () => {
    // Kararın öteki yarısı ve ters yönlü kilit. Bir gün "tutarlı olsun" diye
    // bitişe de varsayılan konursa rapor uydurma teslim tarihleri gösterir.
    assert.match(blok, /dueDate:\s*parseDate\(data\.due\),/,
      'bitiş tarihine varsayılan eklenmiş — kullanıcının kararı olmalı');
  });
});

// ── İSTEMCİ YARISI ────────────────────────────────────────────────────────
//
// 17 Eylül'de kuralın yalnızca SUNUCU yarısı kilitlendi ve kusur tam o
// boşluktan geçti: `routes/tasks.js` başlangıcı bugünle dolduruyordu, ama
// `AddTaskModal` alanı ZORUNLU tutuyordu (`if (!startDate) … hasErr = true`).
// Sunucunun varsayılanı hiç devreye giremiyordu, çünkü istemci boş değer
// göndermeye izin vermiyordu. Kullanıcı her kartta tarihi elle seçiyordu —
// karar alınmış, yarısı uygulanmış, kimse fark etmemişti (1 Ekim 2026).
//
// Ders tanıdık: kuralın UYGULANDIĞI her yer ayrı ayrı ölçülmeli. Sunucu
// tarafının doğru olması, kullanıcının o yolu görebildiğini göstermiyor.

describe('bugunYerel — kullanıcının gördüğü gün', () => {
  test('YYYY-MM-DD biçiminde', () => {
    assert.match(bugunYerel(), /^\d{4}-\d{2}-\d{2}$/);
  });

  test('YEREL takvim gününü veriyor, UTC değil', () => {
    // UTC+3'te yerel 00:00-03:00 arasında UTC hâlâ dün. `toISOString()`
    // kullanılsaydı sabahın köründe açılan kart bir gün geride doğardı.
    const d = new Date(2026, 9, 1, 1, 30);
    assert.equal(yerelGunAnahtari(d), '2026-10-01');
  });

  test('takvimin ürettiği biçimle aynı', () => {
    // `calendar.jsx` hücre tarihini elle kuruyor; modal oraya da veri
    // veriyor (`initialDates`), biçim ayrışırsa seçim sessizce kayar.
    const d = new Date(2026, 0, 5);
    assert.equal(yerelGunAnahtari(d), '2026-01-05', 'tek haneli ay/gün sıfırla doldurulmalı');
  });
});

describe('yeni görev penceresi — başlangıç dolu açılıyor, bitiş boş', () => {
  const src = yorumsuzDosya(MODALS);
  // Ölçüt pencerenin AÇILIŞ bloğuna bağlı, dosya geneline değil.
  const bas = src.indexOf('if (open) {');
  const blok = src.slice(bas, src.indexOf('}, [open]);', bas));

  test('başlangıç bugünle doluyor', () => {
    assert.match(blok, /setStartDate\(initialDates\?\.start \|\| bugunYerel\(\)\)/,
      'pencere başlangıcı boş açıyor — kullanıcı her kartta elle seçmek zorunda kalır');
  });

  test('elle/takvimden gelen tarih ÖNDE — varsayılan onu ezmiyor', () => {
    const m = /setStartDate\(([^;]+)\);/.exec(blok);
    assert.ok(m, 'setStartDate çağrısı bulunamadı');
    assert.ok(m[1].trim().startsWith('initialDates?.start'),
      'varsayılan, takvimden seçilen tarihin önüne geçmiş');
  });

  test('BİTİŞ varsayılan almıyor', () => {
    assert.match(blok, /if \(initialDates\?\.end\)\s+setDue\(initialDates\.end\)/,
      'bitişe varsayılan eklenmiş — kullanıcının kararı olmalı');
    assert.ok(!/setDue\([^)]*bugunYerel/.test(blok), 'bitiş bugünle dolduruluyor');
  });

  test('başlangıç ZORUNLU değil — varsayılan, dayatma değil', () => {
    // Kusurun kendisi. Alan boşaltılabilmeli; boş giderse sunucunun
    // varsayılanı devralıyor (yukarıdaki blok).
    const gonder = src.slice(src.indexOf('const submit = async'), src.indexOf('const handleKey'));
    assert.ok(!/!startDate/.test(gonder),
      'başlangıç hâlâ zorunlu — sunucudaki varsayılan hiç devreye giremez');
  });
});
