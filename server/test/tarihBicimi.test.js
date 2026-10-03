// Tarih biçimi ayarı (3 Ekim 2026).
//
// KUSUR: ayarlarda "Tarih formatı" diye üç seçenekli bir ayar vardı,
// seçileni gösteriyordu ve HİÇBİR ŞEY YAPMIYORDU. `dateFormat`
// `stoa.tweaks`e yazılıyor ve hiçbir yerde okunmuyordu.
//
// `setTweak` ile yazılan ama okunmayan DÖRT alandan sonuncusu; ötekiler
// `dndEnabled`/`dndStart`/`dndEnd` (`rahatsizEtme.js`) ve `weekStart`
// (`hafta.js`). Dördü de aynı sınıf arama turunda bulundu: kısayol
// kusurundan sonra "yazılıyor ama okunuyor mu" diye hepsi sayıldı.
//
// VARSAYILAN DAVRANIŞ KORUNUYOR ve bu testin bir işi onu kilitlemek:
// `dmY` seçeneğinin ayardaki önizlemesi ay ADLI biçim, yani bugünkü
// çıktının kendisi. Ayarı hiç ellemeyen kullanıcı aynı "24 Mayıs"ı
// görmeye devam ediyor. Üç seçeneğin ikisi numerik diye varsayılanı da
// numerik yapmak, ayarı hiç açmamış herkesin kart tarihlerini
// değiştirirdi — kimsenin istemediği bir görsel gerileme.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { TARIH_BICIMLERI, tarihBicimi, tarihYaz, yilBicimdeVarMi } from '../../client/src/tarihBicimi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const istemci = (...p) => path.resolve(__dirname, '..', '..', 'client', 'src', ...p);
const DATA = yorumsuzDosya(istemci('data.jsx'));
const AYAR = yorumsuzDosya(istemci('views', 'settings.jsx'));

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const D = new Date(2026, 4, 24);        // 24 Mayıs 2026

describe('biçim seçimi', () => {
  test('üç biçim de tanınıyor', () => {
    for (const b of TARIH_BICIMLERI) assert.equal(tarihBicimi(b), b);
  });

  test('TANINMAYAN biçim dmY\'ye düşüyor', () => {
    // Bayat ya da elle yazılmış bir değer boş string ya da "undefined"
    // üretmemeli: kart tarihinin yerinde "undefined" yazması, ayarın hiç
    // işlememesinden daha kötü görünür.
    for (const b of [undefined, null, '', 'iso', 'DMY', 42, {}]) {
      assert.equal(tarihBicimi(b), 'dmY', `${JSON.stringify(b)} dmY'ye düşmüyor`);
    }
  });
});

describe('yazım', () => {
  test('dmY — BUGÜNKÜ davranış, ay adlı ve yılsız', () => {
    // Varsayılanın kilidi: ayarı hiç ellemeyen kullanıcının ekranı
    // değişmemeli.
    assert.equal(tarihYaz(D, 'dmY', { aylar: AYLAR }), '24 Mayıs');
    assert.equal(tarihYaz(D, undefined, { aylar: AYLAR }), '24 Mayıs');
  });

  test('dmY — yıl İSTENİRSE ekleniyor', () => {
    assert.equal(tarihYaz(D, 'dmY', { aylar: AYLAR, yilEkle: true }), '24 Mayıs 2026');
  });

  test('Ymd — sıfır dolgulu ISO', () => {
    assert.equal(tarihYaz(D, 'Ymd', { aylar: AYLAR }), '2026-05-24');
    assert.equal(tarihYaz(new Date(2026, 0, 2), 'Ymd'), '2026-01-02', 'sıfır dolgu yok');
  });

  test('mdY — sıfır dolgulu ABD biçimi', () => {
    assert.equal(tarihYaz(D, 'mdY', { aylar: AYLAR }), '05/24/2026');
    assert.equal(tarihYaz(new Date(2026, 0, 2), 'mdY'), '01/02/2026');
  });

  test('numerik biçimler AY ADINA bağlı değil', () => {
    // Sözlük verilmese de çalışmalı; aksi hâlde dil yüklenmeden çizilen
    // bir ekran boş tarih gösterirdi.
    assert.equal(tarihYaz(D, 'Ymd'), '2026-05-24');
    assert.equal(tarihYaz(D, 'mdY'), '05/24/2026');
  });

  test('ay adı sözlüğü BOZUKSA sayıya düşüyor, boş kalmıyor', () => {
    assert.equal(tarihYaz(D, 'dmY', { aylar: ['a', 'b'] }), '24 5');
    assert.equal(tarihYaz(D, 'dmY'), '24 5');
  });

  test('üç biçim birbirinden FARKLI — ölçüt ayırt edici', () => {
    const c = TARIH_BICIMLERI.map((b) => tarihYaz(D, b, { aylar: AYLAR }));
    assert.equal(new Set(c).size, 3, `biçimler aynı çıktı: ${JSON.stringify(c)}`);
  });

  test('geçersiz tarih boş string, patlamıyor', () => {
    assert.equal(tarihYaz(new Date('olmayan'), 'dmY'), '');
    assert.equal(tarihYaz(null, 'dmY'), '');
    assert.equal(tarihYaz('2026-05-24', 'dmY'), '', 'metin Date sanılıyor');
  });
});

describe('yıl biçimin parçası mı', () => {
  test('numerik biçimlerde yıl zaten var', () => {
    assert.equal(yilBicimdeVarMi('Ymd'), true);
    assert.equal(yilBicimdeVarMi('mdY'), true);
  });

  test('dmY\'de yok — kısaltma orada anlamlı', () => {
    assert.equal(yilBicimdeVarMi('dmY'), false);
    assert.equal(yilBicimdeVarMi(undefined), false);
  });
});

describe('data.jsx bağlantısı', () => {
  test('fmtDate AYARI okuyor — kusurun kendisi buydu', () => {
    const bas = DATA.indexOf('function fmtDate(isoDate) {');
    assert.ok(bas > 0, 'fmtDate bulunamadı');
    const govde = DATA.slice(bas, DATA.indexOf('\n}', bas));
    assert.match(govde, /tarihYaz\(d, _tarihAyari\(\)/,
      'fmtDate biçimi gömülü tutuyor — ayar yine hiçbir şey yapmaz');
    assert.doesNotMatch(govde, /\$\{d\.getDate\(\)\} \$\{months\[/,
      'eski gömülü biçim geri gelmiş');
  });

  test('ayar OKUNURKEN patlamıyor', () => {
    // `stoa.tweaks` bozuk JSON olabilir (kullanıcı denetiminde) ve o anda
    // her tarih gösterimi çökerdi.
    const bas = DATA.indexOf('function _tarihAyari()');
    assert.ok(bas > 0, 'ayar okuyucu bulunamadı');
    const govde = DATA.slice(bas, DATA.indexOf('\n}', bas));
    assert.match(govde, /catch/, 'bozuk JSON yakalanmıyor');
  });

  test('fmtTimeAgo mutlak tarihi de AYNI biçimden geçiriyor', () => {
    // Geçmezse aynı ekranda iki ayrı tarih biçimi görünürdü: kart "24.05"
    // der, geçmiş satırı "24 Mayıs".
    const bas = DATA.indexOf('function fmtTimeAgo(iso) {');
    assert.ok(bas > 0, 'fmtTimeAgo bulunamadı');
    const govde = DATA.slice(bas, DATA.indexOf('\n}', bas));
    assert.match(govde, /tarihYaz\(d, bicim,/, 'mutlak tarih biçimi gömülü');
    assert.match(govde, /yilEkle: !ayniYil \|\| yilBicimdeVarMi\(bicim\)/,
      'numerik biçimde yıl atlanıyor — "05/24" hangi yıl?');
  });

  test('ayardaki ÖNİZLEME gerçek çıktıyla aynı', () => {
    // Önizleme yılı gösterip çıktı göstermezse ayar yine yalan söyler,
    // sadece daha küçük bir yalan. `dmY` önizlemesi yıl YAZMAMALI.
    const bas = AYAR.indexOf("['dmY',");
    assert.ok(bas > 0, 'dmY önizlemesi bulunamadı');
    const satir = AYAR.slice(bas, AYAR.indexOf('\n', bas));
    assert.doesNotMatch(satir, /20\d\d/, 'dmY önizlemesi yıl gösteriyor, çıktı göstermiyor');
    // Ters yön: numerik önizlemeler yılı GÖSTERMELİ.
    for (const b of ['Ymd', 'mdY']) {
      const i = AYAR.indexOf(`['${b}',`);
      assert.ok(i > 0, `${b} önizlemesi bulunamadı`);
      assert.match(AYAR.slice(i, AYAR.indexOf('\n', i)), /20\d\d/,
        `${b} önizlemesi yıl göstermiyor`);
    }
  });
});
