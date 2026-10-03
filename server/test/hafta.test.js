// Haftanın ilk günü (3 Ekim 2026).
//
// KUSUR: ayarlarda "Haftanın ilk günü" diye üç seçenekli bir ayar vardı
// (Pazartesi / Pazar / Cumartesi), seçileni gösteriyordu ve HİÇBİR ŞEY
// YAPMIYORDU. `weekStart` `stoa.tweaks`e yazılıyor ve takvim onu hiç
// okumuyordu: Pazartesi DÖRT yerde gömülüydü (`(getDay() + 6) % 7`) ve gün
// adları tablosu da Pazartesi'den başlıyordu.
//
// `setTweak` ile yazılan ama okunmayan dört alandan biri — sınıf aramasıyla
// bulundu (ötekiler `dndEnabled`/`dndStart`/`dndEnd` ve `dateFormat`).
//
// HESAP VE ÇİZİM BİRLİKTE DÖNMEK ZORUNDA, ve bu testin en önemli işi bu:
// yalnızca hesabı döndürmek takvimi SESSİZCE YANLIŞ yapardı — 1 Ekim Pazar
// olarak hesaplanır ama başlıkta "Pzt" yazardı, yani her kart bir gün
// kaymış görünürdü. Kusur "düzeltilmiş" görünür, takvim yalan söylerdi.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import {
  HAFTA_BASLANGICLARI, haftaBasi, gunOfseti, gunAdlariSirali, haftaninBasi,
} from '../../client/src/hafta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAKVIM = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'calendar.jsx'));
const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));

const ADLAR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
// 1 Ekim 2026 = Perşembe. 4 Ekim 2026 = Pazar.
const PERSEMBE = new Date(2026, 9, 1);
const PAZAR = new Date(2026, 9, 4);

describe('başlangıç günü', () => {
  test('üç seçenek de tanınıyor', () => {
    assert.equal(haftaBasi('mon'), 1);
    assert.equal(haftaBasi('sun'), 0);
    assert.equal(haftaBasi('sat'), 6);
  });

  test('TANINMAYAN değer PAZARTESİ\'ye düşüyor', () => {
    // `grupla()` ve alt görünüm adında olduğu gibi: bayat ya da elle
    // yazılmış bir değer sessizce bozuk bir takvim üretmemeli.
    for (const k of [undefined, null, '', 'pzt', 'monday', 42, {}]) {
      assert.equal(haftaBasi(k), 1, `${JSON.stringify(k)} Pazartesi'ye düşmüyor`);
    }
  });

  test('ayarın sunduğu seçenekler ile TANINANLAR aynı küme', () => {
    // Ayarda dördüncü bir düğme eklenip burada tanınmazsa sessizce
    // Pazartesi'ye düşer ve kullanıcı seçiminin işlemediğini görür.
    for (const k of HAFTA_BASLANGICLARI) {
      assert.ok([0, 1, 6].includes(haftaBasi(k)), `${k} tanınmıyor`);
    }
    assert.equal(HAFTA_BASLANGICLARI.length, 3);
  });
});

describe('gün ofseti', () => {
  test('PAZARTESİ başlangıcı — bugünkü davranış korunuyor', () => {
    // Eski kod `(getDay() + 6) % 7` kullanıyordu; Pazartesi seçiliyken
    // sonuç BİREBİR aynı kalmalı, yoksa ayarı hiç değiştirmemiş herkesin
    // takvimi kayar.
    for (let g = 0; g < 7; g += 1) {
      const d = new Date(2026, 9, 4 + g);           // 4 Ekim Pazar'dan itibaren
      assert.equal(gunOfseti(d, 'mon'), (d.getDay() + 6) % 7, `gün ${g}`);
    }
  });

  test('PAZAR başlangıcı', () => {
    assert.equal(gunOfseti(PAZAR, 'sun'), 0);
    assert.equal(gunOfseti(PERSEMBE, 'sun'), 4);
  });

  test('CUMARTESİ başlangıcı', () => {
    assert.equal(gunOfseti(new Date(2026, 9, 3), 'sat'), 0, '3 Ekim Cumartesi');
    assert.equal(gunOfseti(PAZAR, 'sat'), 1);
  });

  test('ofset her zaman 0–6 arasında', () => {
    for (const w of HAFTA_BASLANGICLARI) {
      for (let g = 0; g < 7; g += 1) {
        const o = gunOfseti(new Date(2026, 9, 4 + g), w);
        assert.ok(o >= 0 && o <= 6, `${w}/${g} → ${o}`);
      }
    }
  });

  test('bozuk tarih patlamıyor', () => {
    assert.equal(typeof gunOfseti(new Date('olmayan'), 'mon'), 'number');
    assert.equal(typeof gunOfseti(null, 'mon'), 'number');
  });
});

describe('gün adları — ÇİZİM de dönüyor', () => {
  test('Pazartesi: liste olduğu gibi', () => {
    assert.deepEqual(gunAdlariSirali(ADLAR, 'mon'), ADLAR);
  });

  test('Pazar: "Paz" BAŞA geliyor', () => {
    assert.deepEqual(gunAdlariSirali(ADLAR, 'sun'),
      ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']);
  });

  test('Cumartesi: "Cmt" başa geliyor', () => {
    assert.deepEqual(gunAdlariSirali(ADLAR, 'sat'),
      ['Cmt', 'Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum']);
  });

  test('ÇİZİM ile HESAP tutarlı — asıl ölçüt', () => {
    // Sessiz kusur burada doğardı: hesap Pazar'dan başlar, başlık "Pzt"
    // yazar ve her kart bir gün kaymış görünür. Ölçüt ikisini birlikte
    // soruyor: ofseti 0 olan günün adı, listenin ilk adı olmalı.
    for (const w of HAFTA_BASLANGICLARI) {
      const sirali = gunAdlariSirali(ADLAR, w);
      for (let g = 0; g < 7; g += 1) {
        const d = new Date(2026, 9, 4 + g);        // 4 Ekim Pazar
        const adIndeksi = (d.getDay() + 6) % 7;    // ADLAR Pazartesi'den başlıyor
        assert.equal(sirali[gunOfseti(d, w)], ADLAR[adIndeksi],
          `${w}: ${d.toDateString()} yanlış kolonda`);
      }
    }
  });

  test('bozuk sözlük olduğu gibi dönüyor, patlamıyor', () => {
    assert.deepEqual(gunAdlariSirali(['a', 'b'], 'sun'), ['a', 'b']);
    assert.deepEqual(gunAdlariSirali(null, 'sun'), []);
  });
});

describe('haftanın başı', () => {
  test('Pazartesi başlangıcında Perşembe → aynı haftanın Pazartesi\'si', () => {
    const b = haftaninBasi(PERSEMBE, 'mon');
    assert.equal(b.getDay(), 1);
    assert.equal(b.getDate(), 28, 'Eylül 28');
  });

  test('Pazar başlangıcında Perşembe → o haftanın Pazar\'ı', () => {
    const b = haftaninBasi(PERSEMBE, 'sun');
    assert.equal(b.getDay(), 0);
    assert.equal(b.getDate(), 27);
  });

  test('girdi tarihi DEĞİŞTİRİLMİYOR', () => {
    // Yerinde değiştirme olsaydı takvim imleci her çizimde geriye kayardı.
    const d = new Date(2026, 9, 1);
    haftaninBasi(d, 'mon');
    assert.equal(d.getDate(), 1, 'girdi yerinde değiştirilmiş');
  });

  test('ay ve yıl sınırını geçiyor', () => {
    const b = haftaninBasi(new Date(2027, 0, 1), 'mon');   // 1 Ocak 2027 Cuma
    assert.equal(b.getFullYear(), 2026);
    assert.equal(b.getMonth(), 11);
    assert.equal(b.getDate(), 28);
  });
});

describe('takvim bağlantısı', () => {
  test('Pazartesi artık GÖMÜLÜ DEĞİL', () => {
    assert.doesNotMatch(TAKVIM, /\(\s*\w[\w.]*\.getDay\(\) \+ 6\) % 7/,
      'takvimde gömülü Pazartesi kalmış');
  });

  test('DÖRT hesap yeri de ayarı okuyor', () => {
    // Biri atlanırsa takvimin bir bölümü başka haftada olur: ay ızgarası
    // Pazar'dan başlar, mini takvim Pazartesi'den.
    for (const d of ['startDOW', 'miniFirstDOW']) {
      const bas = TAKVIM.indexOf(`const ${d}`);
      assert.ok(bas > 0, `${d} bulunamadı`);
      assert.match(TAKVIM.slice(bas, TAKVIM.indexOf('\n', bas)), /haftaBasiAyari/,
        `${d} ayarı okumuyor`);
    }
    assert.equal((TAKVIM.match(/haftaninBasi\(cursor, haftaBasiAyari\)/g) || []).length, 2,
      'hafta ızgarası ve sağ panel ikisi de ayarı okumuyor');
  });

  test('GÜN ADLARI da ayarı okuyor — çizim hesapla birlikte dönmeli', () => {
    assert.match(TAKVIM, /const CAL_DAYS_SHORT = \(haftaBasiAyari\) => gunAdlariSirali\(/,
      'gün adları Pazartesi\'de sabit');
    // Her çağrı yeri ayarı GEÇMELİ: biri atlanırsa o başlık satırı kayar.
    // Tanım bu sayıma GİRMİYOR: `CAL_DAYS_SHORT = (` biçiminde, yani
    // `CAL_DAYS_SHORT(` desenine uymuyor. İlk yazışımda bir fazla
    // çıkarmıştım ve test kendi sayım hatasıyla kırıldı.
    const cagri = (TAKVIM.match(/CAL_DAYS_SHORT\(/g) || []).length;
    const ayarli = (TAKVIM.match(/CAL_DAYS_SHORT\(haftaBasiAyari\)/g) || []).length;
    assert.ok(cagri >= 3, `gün adları ${cagri} yerde çiziliyor, en az üç olmalı`);
    assert.equal(ayarli, cagri, `${cagri} çağrıdan ${ayarli} tanesi ayarı geçiyor`);
  });

  test('ayar app.jsx\'ten PROP ile geliyor', () => {
    // `localStorage`dan okunsa ayar değişince takvim yeniden çizilmezdi;
    // kullanıcı Ayarlar'dan dönüp "işlemedi" sanırdı.
    assert.match(APP, /<CalendarView[^>]*haftaBasiAyari=\{tweaks\.weekStart\}/,
      'takvime hafta ayarı geçilmiyor');
  });
});
