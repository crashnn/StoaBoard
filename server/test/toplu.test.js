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
import { topluCalistir, topluSonucMetni, secimiDegistir, hepsiniSec, atamaEkleniyorMu, yeniAtananlar } from '../../client/src/topluIslem.js';

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

// ─── Üç küçük iş (tarama maddesi D) ────────────────────────────────────────

describe('bitiş tarihi başlangıçtan önce olamaz', () => {
  const TASKS = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'tasks.js'));

  test('tarihe DOKUNAN istek tutarlılık istiyor', () => {
    // ÖLÇÜLEN: kart "2 Oct – 29 Sep" gösteriyordu ve kimse uyarmıyordu.
    // Rapor bu veriyle yanlış konuşur: akış süresi negatif çıkar.
    const bas = TASKS.indexOf("if ('due' in data || 'start' in data) {");
    assert.ok(bas > 0, 'tarih tutarlılık kapısı yok');
    const blok = TASKS.slice(bas, TASKS.indexOf('\n    }', bas));
    assert.match(blok, /yeniBitis < yeniBaslangic/, 'karşılaştırma yapılmıyor');
    assert.match(blok, /err_due_before_start/, 'ret kodu yok');
    assert.match(blok, /status\(400\)/, 'ret 400 değil');
  });

  test('DEĞİŞMEYEN alan eski değerinden okunuyor', () => {
    // Yalnızca `due` gönderilirse başlangıç karttan gelmeli; yoksa kural
    // yarım uygulanır ve tek alan güncelleyen istek hep geçerdi.
    const bas = TASKS.indexOf("if ('due' in data || 'start' in data) {");
    const blok = TASKS.slice(bas, TASKS.indexOf('\n    }', bas));
    assert.match(blok, /'due' in data \? updates\.dueDate : task\.dueDate/, 'bitiş eski değerden okunmuyor');
    assert.match(blok, /'start' in data \? updates\.startDate : task\.startDate/, 'başlangıç eski değerden okunmuyor');
  });

  test('tarihe DOKUNMAYAN istek denetlenmiyor', () => {
    // Eski kartların bir kısmı zaten tutarsız olabilir; başlığını düzeltmek
    // isteyen birinin isteği ilgisiz bir sebeple düşmemeli.
    const bas = TASKS.indexOf("if ('due' in data || 'start' in data) {");
    assert.ok(bas > 0);
    // Kapı koşullu: koşulsuz olsaydı her PATCH denetlenirdi.
    assert.doesNotMatch(TASKS.slice(bas - 200, bas), /if \(true\)/, 'kapı koşulsuz');
  });
});

describe('karta bağlantı kopyalama', () => {
  const DRAWER = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'drawer.jsx'));

  test('adres TEK KAYNAKTAN kuruluyor', () => {
    // Elle birleştirilseydi (`/pano/kart/` + id) kart adresinin biçimi
    // değiştiğinde bağlantı sessizce bozulurdu; biçim `rota.js`te tanımlı.
    assert.match(DRAWER, /durumdanYol\('board', task\.id\)/, 'adres rota.js üzerinden kurulmuyor');
    assert.doesNotMatch(DRAWER, /'\/pano\/kart\/' \+/, 'adres elle birleştiriliyor');
  });

  test('pano erişimi reddedilirse SESSİZ kalmıyor', () => {
    // Pano izni verilmeyebiliyor; sessizce başarısız olmak "kopyaladım"
    // sanmaya yol açardı.
    const bas = DRAWER.indexOf('const baglantiKopyala');
    const blok = DRAWER.slice(bas, DRAWER.indexOf('\n  };', bas));
    // Ölçüt ULAŞILABİLİRLİĞE bakıyor, varlığa değil. MUTASYON BUNU YAKALADI:
    // catch'in başına `return;` konunca test geçmeye devam etti, çünkü
    // `showToast` metni blokta hâlâ duruyordu — ölü kodu canlı saymak.
    // Artık catch gövdesinin İLK ifadesi ölçülüyor.
    const catchBas = blok.indexOf('catch (_) {');
    assert.ok(catchBas > 0, 'hata dalı yok');
    const govde = blok.slice(catchBas + 'catch (_) {'.length).trim();
    assert.ok(govde.startsWith('window.showToast'),
      `hata dalında ilk iş kullanıcıya söylemek değil: ${govde.slice(0, 60)}`);
  });
});

describe('ana sayfa övgüsü yalnızca iş varken', () => {
  const DASH = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'dashboard.jsx'));

  test('boş panoda "harika gidiyor" YAZMIYOR', () => {
    // "0 kart aktif — harika gidiyorsunuz!" hiçbir şey olmayan yerde övgü.
    assert.match(DASH, /overdue === 0 && inProgress > 0 && ` \$\{window\.t\('dash_sub_great'\)\}`/,
      'övgü iş olmadan da yazılıyor');
  });
});

describe('mobil dokunma hedefleri (tarama maddesi E)', () => {
  const CSS = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'styles.css'));

  const kural = () => {
    const bas = CSS.indexOf('@media (pointer: coarse) {');
    assert.ok(bas > 0, 'dokunma hedefi kuralı yok');
    return CSS.slice(bas, CSS.indexOf('\n}', CSS.indexOf('.notif-dismiss::after', bas)));
  };

  test('ölçülen üç küçük düğme de kapsamda', () => {
    // 390px'te ölçüldü: kolon başlığı 22x22, kenar çubuğu 17x17,
    // bildirim 17x20. Üçü de ikon-only.
    // ÖLÇÜT `::after` KURALINA BAKIYOR, bloğun tamamına değil. MUTASYON
    // YAKALADI: yalnızca `.col-actions > button::after` seçicisi bozulunca
    // test geçmeye devam etti, çünkü aynı seçici yukarıdaki
    // `position: relative` kuralında hâlâ duruyordu. Dokunma alanını veren
    // şey `::after`; ölçüt oraya bağlı olmalı.
    // `secici::after` aranıyor, yalnızca `secici` değil: yukarıdaki
    // `position: relative` kuralı aynı seçicileri taşıyor ve çıplak arama
    // onlardan ödünç alırdı.
    const k = kural();
    for (const secici of ['.col-actions > button', '.sidebar-section-title > button', '.notif-dismiss']) {
      assert.ok(k.includes(`${secici}::after`),
        `${secici} için dokunma ALANI tanımlı değil (::after kuralında yok)`);
    }
  });

  test('GÖRÜNÜR boyut değişmiyor, yalnızca dokunma alanı', () => {
    // Görsel büyütmek masaüstü düzenini de oynatırdı.
    const k = kural();
    assert.match(k, /::after/, 'hedef sözde-öge ile genişletilmiyor');
    assert.doesNotMatch(k, /font-size|padding:/, 'kural görünür boyutu da değiştiriyor');

    // BİTİŞİK düğmeler yalnızca DİKEY büyüyor, yalnız duranlar iki yönde.
    //
    // Gerekçe CANLI ÖLÇÜMDEN geldi: "+" ve "..." yan yana ve 32px'lik alanlar
    // yatayda birbirinin üstüne biniyordu — merkezin 14px sağındaki nokta
    // KOMŞU düğmeye gidiyordu. Yani yatay büyüme, ölü boşluğu "yanlış
    // düğmeye isabet"e çeviriyordu. Dikeyde böyle bir komşu yok.
    const bitisik = k.slice(k.indexOf('.col-actions > button::after'),
      k.indexOf('.sidebar-section-title > button::after'));
    assert.match(bitisik, /height: 32px;/, 'bitişik düğmelerde dikey hedef 32px değil');
    assert.doesNotMatch(bitisik, /width: 32px/,
      'bitişik düğme yatayda da büyüyor — komşunun yerini çalar');

    const yalniz = k.slice(k.indexOf('.sidebar-section-title > button::after'));
    assert.match(yalniz, /width: 32px;/, 'yalnız duran düğmede yatay hedef 32px değil');
    assert.match(yalniz, /height: 32px;/, 'yalnız duran düğmede dikey hedef 32px değil');
  });

  test('YALNIZCA dokunmatikte — farede uygulanmıyor', () => {
    // Fareyle gezerken büyüyen görünmez alanlar komşu öğeleri bloklardı.
    assert.match(CSS, /@media \(pointer: coarse\) \{/, 'kural bütün cihazlarda geçerli');
  });
});

// ─── Toplu atama (madde C'nin kalan parçası) ───────────────────────────────
//
// C'de bilerek dışarıda bırakılmıştı ("üç işi yarım yapmaktansa ikisini tam
// yapmak"). Burada tamamlandı.
//
// TOGGLE SEMANTİĞİ: seçili kartların HEPSİNDE o kişi varsa kaldırılıyor,
// değilse hepsine ekleniyor — "hepsini seç" kutusuyla aynı mantık.
// REPLACE DEĞİL: "bu beş kartı Ayşe'ye ata" demek "Mehmet'i çıkar" demek
// değildir ve replace var olan atamaları SESSİZCE silerdi.

describe('toplu atama — saf', () => {
  const g = (ids) => ({ assignees: ids });

  test('hiçbirinde yoksa EKLİYOR', () => {
    assert.equal(atamaEkleniyorMu([g([]), g(['x'])], 'ayse'), true);
  });

  test('HEPSİNDE varsa KALDIRIYOR', () => {
    assert.equal(atamaEkleniyorMu([g(['ayse']), g(['ayse', 'x'])], 'ayse'), false);
  });

  test('BAZISINDA varsa EKLİYOR — eksikleri tamamlamak beklenen davranış', () => {
    assert.equal(atamaEkleniyorMu([g(['ayse']), g([])], 'ayse'), true);
  });

  test('seçim boşsa ekleme yönünde, patlamıyor', () => {
    assert.equal(atamaEkleniyorMu([], 'ayse'), true);
    assert.equal(atamaEkleniyorMu(null, 'ayse'), true);
  });

  test('ekleme VAR OLANI korumuyor demek değil — öteki atananlar duruyor', () => {
    // Replace kusurunun tam karşılığı: Mehmet silinmemeli.
    assert.deepEqual(yeniAtananlar(g(['mehmet']), 'ayse', true), ['mehmet', 'ayse']);
  });

  test('aynı kişi İKİ KEZ eklenmiyor', () => {
    assert.deepEqual(yeniAtananlar(g(['ayse']), 'ayse', true), ['ayse']);
  });

  test('kaldırma YALNIZCA o kişiyi düşürüyor', () => {
    assert.deepEqual(yeniAtananlar(g(['ayse', 'mehmet']), 'ayse', false), ['mehmet']);
  });

  test('bozuk kart patlamıyor', () => {
    assert.deepEqual(yeniAtananlar(null, 'ayse', true), ['ayse']);
    assert.deepEqual(yeniAtananlar({}, 'ayse', false), []);
  });
});

describe('toplu atama — bağlantı', () => {
  // Her ölçüt `topluAta`nın KENDİ gövdesine bağlı, TableView'in tamamına
  // değil. Aklama denemesi iki ölçütü bir kerede akladı: yetki satırını
  // `topluAta`dan silip aynı metni `topluCope`ya koymak testi yeşil
  // bıraktı. Blok, kuralı taşıyan fonksiyonun kendisi olmalı (CLAUDE.md,
  // "ölçüt KORUDUĞU SATIRA bağlanmalı").
  const atamaGovdesi = () => {
    const bas = BOARD.indexOf('const topluAta = async (uyeId) => {');
    assert.ok(bas > 0, 'toplu atama yolu bulunamadı');
    const son = BOARD.indexOf('\n  };', bas);
    assert.ok(son > bas, 'toplu atama gövdesi kapanmıyor');
    return BOARD.slice(bas, son);
  };

  test('atama da GÖRÜNEN süzgecinden geçiyor', () => {
    assert.match(atamaGovdesi(), /topluCalistir\(seciliGorunen, \(id\) => \{/,
      'toplu atama görünmeyen kartlara da uygulanıyor');
  });

  test('yetki kapısı var', () => {
    assert.match(atamaGovdesi(), /if \(!canManageTasks \|\| topluMesgul \|\| !onAssignTask\) return;/,
      'yetkisiz kullanıcı toplu atama yapabiliyor');
  });

  test('yön BİR KEZ hesaplanıyor, kart başına değil', () => {
    // Kart başına hesaplansaydı ilk kart eklenir, ikincisi (artık ona da
    // eklendiği için) kaldırılırdı — işlem kendi kuyruğunu yerdi.
    //
    // "Hesap satırı döngüden önce mi" diye sormak YETMİYOR: aklama denemesi
    // doğru satırı yukarıda bırakıp geri çağrının içinde İKİNCİ bir hesap
    // yaptı ve ölçüt geçti. Ölçülen şey artık sayı: gövdede yön hesabı
    // TAM BİR kez geçiyor, ve o da döngünün dışında.
    const govde = atamaGovdesi();
    const kac = (govde.match(/atamaEkleniyorMu\(/g) || []).length;
    assert.equal(kac, 1, `yön ${kac} kez hesaplanıyor — bir kez olmalı`);
    assert.match(govde, /const ekle = atamaEkleniyorMu\(secilenler, uyeId\);/, 'yön hesabı yok');
    assert.ok(govde.indexOf('const ekle =') < govde.indexOf('topluCalistir('),
      'yön döngünün İÇİNDE hesaplanıyor — işlem kendi kuyruğunu yer');
  });

  test('atama hatası YUTULMUYOR', () => {
    // `topluCalistir` başarısızı ancak fırlatılırsa sayabilir.
    const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));
    const bas = APP.indexOf('const atamayiDegistir = async');
    assert.ok(bas > 0, 'atama yolu bulunamadı');
    const govde = APP.slice(bas, APP.indexOf('\n  };', bas));
    assert.doesNotMatch(govde, /catch/, 'atama hatası yutuluyor — yarım başarı sayılamaz');
    assert.match(govde, /await API\.updateTask\(id, \{ assignees \}\)/, 'atama sunucuya gitmiyor');
  });
});
