// Panoda klavyeyle kart kullanımı ve geri alınabilir çöpe atma (2 Ekim 2026).
//
// NİÇİN EKLENDİ: pano ölçüldü ve kartlar `tabIndex: -1`, `role`süzdü — yani
// sekmeyle ulaşılamıyor, klavyeyle açılamıyor, taşınamıyordu. Uygulama ise
// kısayolları komut paletinde kullanıcıya GÖSTERİYOR (G D, G B, N): gezinme
// vaat edilmiş, işin kendisi (kartlar) dışarıda kalmıştı. Ekran okuyucu için
// de aynı kapı kapalıydı. #330'un ailesi: orada kapalı bir pencere odağı
// çalıyordu, burada açık bir pano odağı hiç kabul etmiyordu.
//
// Aynı turda ikinci bir eksik: kart çöpe atılınca ekrandan siliniyor ve
// kullanıcıya hiçbir şey söylenmiyordu. Geri almanın tek yolu Çöp Kutusu
// görünümünü bulmaktı; oysa sunucu ucu (`POST /tasks/:id/restore`) zaten
// vardı — eksik olan tek şey TEKLİFİN KENDİSİYDİ.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { komsuKolonId, hedefKartSirasi } from '../../client/src/klavyePano.js';
import { bugunYerel, gunSonra } from '../../client/src/tarih.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');
const BOARD = yorumsuzDosya(path.join(CLIENT, 'views', 'board.jsx'));
const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));
const SHELL = yorumsuzDosya(path.join(CLIENT, 'shell.jsx'));
const CSS = yorumsuzDosya(path.join(CLIENT, 'styles.css'));

const KOLONLAR = [{ id: 'backlog' }, { id: 'todo' }, { id: 'doing' }, { id: 'review' }, { id: 'done' }];

describe('komsuKolonId — saf', () => {
  test('sağa ve sola bir adım', () => {
    assert.equal(komsuKolonId(KOLONLAR, 'todo', 1), 'doing');
    assert.equal(komsuKolonId(KOLONLAR, 'todo', -1), 'backlog');
  });

  test('KENARDA SARMA YOK — bu bir karar, kaza değil', () => {
    // Sarma olsaydı "Tamamlandı"da sağa basmak kartı "Backlog"a atardı:
    // Shift ile taşırken bitmiş bir kart sessizce en başa dönerdi.
    assert.equal(komsuKolonId(KOLONLAR, 'done', 1), null);
    assert.equal(komsuKolonId(KOLONLAR, 'backlog', -1), null);
  });

  test('bilinmeyen kolon null döner, patlamaz', () => {
    assert.equal(komsuKolonId(KOLONLAR, 'olmayan', 1), null);
    assert.equal(komsuKolonId(null, 'todo', 1), null);
    assert.equal(komsuKolonId([], 'todo', 1), null);
  });

  test('tek kolonlu panoda her iki yön de null', () => {
    assert.equal(komsuKolonId([{ id: 'tek' }], 'tek', 1), null);
    assert.equal(komsuKolonId([{ id: 'tek' }], 'tek', -1), null);
  });
});

describe('hedefKartSirasi — saf', () => {
  test('aynı sıra varsa korunuyor', () => {
    assert.equal(hedefKartSirasi(2, 5), 2);
  });

  test('hedef kolon KISAYSA son karta düşüyor', () => {
    // Boşluğa atlamak odağı kaybetmek olurdu; klavyeyle gezinme ortada kalır.
    assert.equal(hedefKartSirasi(4, 2), 1);
  });

  test('hedef kolon BOŞSA null — odak oynatılmıyor', () => {
    assert.equal(hedefKartSirasi(0, 0), null);
    assert.equal(hedefKartSirasi(3, 0), null);
  });

  test('bozuk girdi patlamıyor', () => {
    assert.equal(hedefKartSirasi(-1, 3), 0);
    assert.equal(hedefKartSirasi(NaN, 3), 0);
    assert.equal(hedefKartSirasi(1, NaN), null);
  });
});

describe('kart klavyeye AÇIK (pano)', () => {
  // Ölçüt kartın kendi etiketine bağlı: dosyanın başka yerinde `tabIndex`
  // geçmesi (başka bir öğede) bu kusuru aklamamalı.
  const kartEtiketi = () => {
    const bas = BOARD.indexOf('className="card"');
    assert.ok(bas > 0, 'kart etiketi bulunamadı');
    const acilis = BOARD.lastIndexOf('<div', bas);
    const kapanis = BOARD.indexOf('>', BOARD.indexOf('onTouchEnd', bas));
    return BOARD.slice(acilis, kapanis + 1);
  };

  test('kart odaklanabilir ve ne olduğunu söylüyor', () => {
    const et = kartEtiketi();
    assert.match(et, /tabIndex=\{0\}/, 'kart sekmeyle ulaşılamıyor — pano yalnızca fareyle kullanılır');
    assert.match(et, /role="button"/, 'kartın rolü yok — ekran okuyucu onu tıklanabilir saymaz');
    assert.match(et, /aria-label=/, 'kartın erişilebilir adı yok');
    assert.match(et, /onKeyDown=\{kartKlavye\}/, 'kart tuş olayını dinlemiyor');
    assert.match(et, /data-task-id=\{task\.id\}/, 'kart kimliğini DOM\'a yazmıyor — taşımadan sonra odak geri verilemez');
  });

  test('odak GÖRÜNÜR — görünmeyen özellik yok sayılır (#156)', () => {
    assert.match(CSS, /\.card:focus-visible \{/,
      'odaklı kartın çerçevesi yok: klavye çalışır ama kullanıcı nerede olduğunu görmez');
  });

  test('başlık düzenlenirken tuşlar karta KAÇMIYOR', () => {
    // Başlık contentEditable ve kendi `handleTitleKey`i var; olay oradan
    // kabararak karta geliyor. Kapı olmazsa yazarken basılan ok tuşu kartı
    // taşırdı.
    const bas = BOARD.indexOf('const kartKlavye =');
    assert.ok(bas > 0, 'kartKlavye bulunamadı');
    const govde = BOARD.slice(bas, BOARD.indexOf('\n  return (', bas));
    assert.match(govde, /if \(e\.target !== e\.currentTarget\) return;/,
      'olay kaynağı denetlenmiyor — başlıkta yazarken ok tuşu kartı oynatır');
    // Kapı fonksiyonun BAŞINDA olmalı; sonrasında olması etkisiz kılar.
    const kapi = govde.indexOf('e.target !== e.currentTarget');
    const ilkIs = govde.search(/e\.preventDefault\(\)|onMoveTask\(|onOpen\(/);
    assert.ok(kapi < ilkIs, 'kaynak denetimi ilk işten SONRA geliyor — etkisiz');
  });

  test('TAŞIMA Shift istiyor, yalın ok yalnızca odağı oynatıyor', () => {
    // Yazma işlemi tek tuşla kazara olmamalı. Ölçüt taşıma dalının
    // `e.shiftKey` içinde olduğunu ve yetki kontrolü taşıdığını ölçüyor.
    const bas = BOARD.indexOf('const kartKlavye =');
    const govde = BOARD.slice(bas, BOARD.indexOf('\n  return (', bas));
    const shiftDali = govde.slice(govde.indexOf('if (e.shiftKey) {'));
    assert.ok(shiftDali.length > 0, 'Shift dalı yok');
    assert.match(shiftDali, /onMoveTask\(task\.id, hedefKolonId\)/, 'Shift dalı kartı taşımıyor');
    assert.match(shiftDali, /if \(!canManageTasks \|\| !onMoveTask\) return;/,
      'yetkisiz kullanıcı klavyeyle kart taşıyabiliyor');
    // Shift dalından ÖNCE taşıma çağrısı olmamalı.
    assert.equal(govde.indexOf('onMoveTask('), shiftDali.indexOf('onMoveTask(') + govde.indexOf('if (e.shiftKey) {'),
      'taşıma Shift dalının dışında da çağrılıyor — yalın ok tuşu kartı oynatır');
  });

  test('kısayollar komut paletinde GÖSTERİLİYOR', () => {
    // Bu depoda bir özellik görünmüyorsa yok sayılıyor (#156) ve #330'da
    // bunun daha kötüsü yaşandı: gösterilen ama çalışmayan kısayol.
    //
    // ÖLÇÜT KOMUT LİSTESİNE BAĞLI, dosyaya değil. İlk hâli
    // `data.includes(anahtar)` idi ve MUTASYON ONU YAKALADI: anahtar
    // listeden çıkarılıp yalnızca sözlükte bırakılınca test yine geçti —
    // yani metni arıyordu, kullanımı değil. Bu depodaki "aklama" sınıfının
    // ta kendisi.
    const data = yorumsuzDosya(path.join(CLIENT, 'data.jsx'));
    const bas = data.indexOf('function getCommands()');
    assert.ok(bas > 0, 'getCommands bulunamadı');
    const liste = data.slice(bas, data.indexOf('\n}', data.indexOf('return [', bas)));
    for (const anahtar of ['cmd_card_nav', 'cmd_card_open', 'cmd_card_move']) {
      assert.match(liste, new RegExp(`tl\\('${anahtar}'`), `${anahtar} komut listesinde kullanılmıyor`);
    }
    // Tuşların kendisi de yazılı olmalı: etiket "Kartlar arasında gezin"
    // dese ama hangi tuş olduğunu söylemese keşfedilebilirlik yarım kalır.
    assert.match(liste, /shortcut: 'Shift \+ ← →'/, 'taşıma kısayolu paletde yazılı değil');
  });
});

describe('çöpe atma GERİ ALINABİLİR', () => {
  test('silme başarılı olunca geri al teklif ediliyor', () => {
    // Ölçüt `deleteTask`ın kendi gövdesine bağlı.
    //
    // ÇAPA İMZADAN BAĞIMSIZ. İlk hâli `const deleteTask = async (id) =>`
    // arıyordu; 3 Ekim'de işlev `{ sessiz }` seçeneği aldı ve çapa düştü,
    // yani test koruduğu davranış hiç değişmediği hâlde kırıldı. İmza
    // listesi ölçülüyor değil; ölçülen şey teklifin BAŞARIDAN sonra
    // yapılması.
    const bas = APP.indexOf('const deleteTask = async (');
    assert.ok(bas > 0, 'deleteTask bulunamadı');
    const govde = APP.slice(bas, APP.indexOf('const restoreTask', bas));
    assert.match(govde, /eylem: \{/, 'çöpe atma bildirimi eylem taşımıyor');
    assert.match(govde, /calistir: \(\) => restoreTask\(id\)/, 'geri al düğmesi geri yüklemiyor');
    // Teklif BAŞARIDAN sonra: istek düşerse "geri al" demek yanlış olurdu
    // (geri alınacak bir şey yok, kart hiç gitmedi).
    const istek = govde.indexOf('await API.deleteTask(id)');
    assert.ok(istek < govde.indexOf('eylem: {'), 'teklif istekten önce yapılıyor');
    assert.ok(govde.indexOf('eylem: {') < govde.indexOf('} catch'), 'teklif catch bloğunda');
  });

  test('bildirim ömrü beş saniyeden uzun', () => {
    const bas = APP.indexOf('const deleteTask = async (');
    const govde = APP.slice(bas, APP.indexOf('const restoreTask', bas));
    const m = /omur: (\d+)/.exec(govde);
    assert.ok(m, 'ömür verilmemiş — varsayılan beş saniye, "acaba sildim mi" demeye yetmez');
    assert.ok(Number(m[1]) >= 10000, `ömür çok kısa: ${m[1]}ms`);
  });

  test('toast eylemi tıklanınca bildirimin KENDİ tıklaması çalışmıyor', () => {
    // Bildirime tıklamak başka bir şey yapıyor (sohbete gitmek, sayfayı
    // yenilemek). Yayılma durmazsa "Geri al" hem geri alır hem o işi yapar.
    const bas = SHELL.indexOf('toast.eylem && (');
    assert.ok(bas > 0, 'toast eylem düğmesi yok');
    const blok = SHELL.slice(bas, SHELL.indexOf('</button>', bas));
    assert.match(blok, /e\.stopPropagation\(\)/, 'yayılma durdurulmuyor');
    assert.match(blok, /removeToast\(toast\.id\)/, 'eylemden sonra bildirim kapanmıyor');
  });

  test('ömür alanı varsayılanı DEĞİŞTİRMİYOR', () => {
    // Bütün bildirimlerin ömrünü uzatmak, ekranı kalabalıklaştırırdı.
    const bas = SHELL.indexOf('window.TOAST_QUEUE = window.TOAST_QUEUE.filter(');
    assert.ok(bas > 0, 'düşürme süzgeci bulunamadı');
    const blok = SHELL.slice(bas, SHELL.indexOf(';', bas));
    assert.match(blok, /t\.omur \|\| 5000/, 'ömür varsayılanı korunmuyor');
    assert.match(blok, /t\.sticky \|\|/, 'yapışkan bildirim kuralı (#201) kaybolmuş');
  });
});

// ─── Hızlı tarih seçimi (2 Ekim 2026) ──────────────────────────────────────
//
// ÖLÇÜLEN: tarih koymanın tek yolu takvimi açıp günü gözle bulmaktı. "Yarın"
// demek bile takvimi taramayı gerektiriyordu. Takvimin içinde "Bugün" ve
// "Temizle" vardı; "Yarın" ve "Haftaya" yoktu.
//
// YOL ÜSTÜNDE ÇIKAN ASIL KUSUR: takvimdeki "Bugün" düğmesi tarihi KENDİ
// ELİYLE biçimlendiriyordu (`${t.getFullYear()}-${...}`), oysa `tarih.js`
// tam bu iş için var ve var olma sebebi ikinci bir "bugün" tanımının
// doğması. İki okuyucu, aynı olgu — bu depoda tekrarlanan sınıf.

describe('hızlı tarih seçimi — saf', () => {
  test('gunSonra(0) bugünle aynı', () => {
    assert.equal(gunSonra(0), bugunYerel());
  });

  test('gunSonra(1) ve (7) ileri gidiyor, biçim bozulmuyor', () => {
    for (const g of [1, 7]) {
      const d = gunSonra(g);
      assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `biçim bozuk: ${d}`);
      assert.ok(d > bugunYerel(), `${g} gün sonrası bugünden ileri değil: ${d}`);
    }
  });

  test('AY VE YIL SINIRINI geçiyor', () => {
    // Ölçüt gerçek takvimden bağımsız olsun diye aradaki gün sayısı
    // doğrulanıyor: 31 Aralık + 1 gün, 1 Ocak olmalı — "32 Aralık" değil.
    const bas = new Date(gunSonra(0) + 'T00:00:00');
    for (const g of [1, 7, 60, 400]) {
      const s = new Date(gunSonra(g) + 'T00:00:00');
      const fark = Math.round((s - bas) / 86400000);
      assert.equal(fark, g, `${g} gün sonrası ${fark} gün ileride`);
    }
  });

  test('bozuk girdi bugüne düşüyor, patlamıyor', () => {
    assert.equal(gunSonra(NaN), bugunYerel());
    assert.equal(gunSonra(undefined), bugunYerel());
  });

  test('YAZ SAATİ gecesinde bir GÜN ekliyor, 24 SAAT değil', () => {
    // Bu ölçüt mutasyon turunda doğdu: `setDate` yerine
    // `Date.now() + gun * 86400000` yazmak testi KIRMIYORDU, çünkü ölçüm
    // makinesi sabit UTC+3 ve iki hesap orada aynı sonucu veriyor. Yani
    // gerekçe yorumda yazılıydı ama ÖLÇÜLMÜYORDU.
    //
    // Kurgu: Avrupa/Berlin, 29 Mart 2026 gecesi saat ileri alınıyor. 28
    // Mart 23:30'dan 24 saat sonrası 30 Mart 00:30 (gün ATLIYOR); bir gün
    // sonrası ise 29 Mart. Kullanıcı "Yarın" dediğinde öbür günü almamalı.
    const eskiTz = process.env.TZ;
    try {
      process.env.TZ = 'Europe/Berlin';
      const taban = new Date('2026-03-28T23:30:00+01:00');
      assert.equal(gunSonra(1, taban), '2026-03-29',
        '"yarın" bir gün atladı — gün değil 24 saat ekleniyor olabilir');
      assert.equal(gunSonra(0, taban), '2026-03-28');
      assert.equal(gunSonra(7, taban), '2026-04-04');
    } finally {
      if (eskiTz === undefined) delete process.env.TZ;
      else process.env.TZ = eskiTz;
    }
  });
});

describe('tarih TEK KAYNAKTAN üretiliyor', () => {
  const MODALS = yorumsuzDosya(path.join(CLIENT, 'modals.jsx'));

  test('takvim "bugün"ü KENDİ ELİYLE biçimlendirmiyor', () => {
    // Kusurun kendisi: `${t.getFullYear()}-${String(t.getMonth()+1)...}`
    // ikinci bir "bugün" tanımıydı. Ölçüt KULLANIMI yasaklıyor (18 Eylül
    // dersi): `tarih.js`i içe aktarmak yetmez, elle biçimlendirme kalmamalı.
    assert.doesNotMatch(MODALS, /getFullYear\(\)\}-\$\{String\(/,
      'tarih elle biçimlendiriliyor — ikinci bir "bugün" tanımı doğuyor');
    assert.match(MODALS, /import \{ bugunYerel, gunSonra \} from '\.\/tarih\.js';/,
      'tarih yardımcıları içe aktarılmıyor');
  });

  test('hızlı seçim çipleri gunSonra ile üretiliyor', () => {
    const bas = MODALS.indexOf('const HIZLI_TARIHLER = [');
    assert.ok(bas > 0, 'hızlı tarih listesi yok');
    const liste = MODALS.slice(bas, MODALS.indexOf('];', bas));
    for (const [gun, anahtar] of [[0, 'cal_today'], [1, 'modal_date_tomorrow'], [7, 'modal_date_next_week']]) {
      assert.match(liste, new RegExp(`gun: ${gun}, anahtar: '${anahtar}'`), `${anahtar} (${gun} gün) listede yok`);
    }
    // Üç seçenek, daha fazlası değil: liste uzadıkça takvim kadar taranır
    // hâle gelir ve kazanç kaybolur.
    assert.equal((liste.match(/\{ gun:/g) || []).length, 3, 'hızlı seçim listesi beklenenden farklı uzunlukta');
    // Çipin tıklaması gerçekten `gunSonra` çağırmalı; liste doğru ama
    // tıklama elle hesaplasa ölçüt bir şey korumazdı.
    const cip = MODALS.slice(MODALS.indexOf('HIZLI_TARIHLER.map('), MODALS.indexOf('</button>', MODALS.indexOf('HIZLI_TARIHLER.map(')));
    assert.match(cip, /gunSonra\(gun\)/, 'çip tarihi tek kaynaktan almıyor');
  });

  test('temizleme seçeneği korunuyor', () => {
    // Hızlı seçim eklerken var olan bir yolu silmek sessiz bir gerileme
    // olurdu: tarihi KALDIRMAK da gerekiyor.
    assert.match(MODALS, /modal_date_clear/, 'tarihi temizleme düğmesi kaybolmuş');
  });
});
