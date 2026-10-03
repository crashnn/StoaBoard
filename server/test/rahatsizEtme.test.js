// Rahatsız etme penceresi (3 Ekim 2026).
//
// KUSUR: ayarlarda "Otomatik DND penceresi" anahtarı ve iki saat kutusu
// vardı ("Her gün belirli saat aralığında bildirimleri sustur", varsayılan
// 19:00–08:00). Üçü de `stoa.tweaks`e yazılıyor ve HİÇBİRİ okunmuyordu:
// bildirim kapısı `window.__MY_STATUS__ === 'dnd'` bakıyor, o da
// kullanıcının DURUM SEÇİCİSİNDEN geliyor — bu ayardan değil. İki ayrı
// "rahatsız etme" kavramı vardı ve ayarlardaki olan tamamen atıldı.
//
// Kullanıcı 19:00–08:00 kurmuş, sabaha kadar ding yiyor ve ayarın açık
// olduğunu görüyor. Aynı gün kısayollarda kapatılan sınıfın aynısı:
// sessizce hiçbir şey yapmayan bir ayar, olmayan bir ayardan kötüdür.
//
// NASIL BULUNDU: kısayol kusurundan sonra aynı sınıfı sistematik aradım —
// `setTweak` ile yazılan her alanın okunup okunmadığını saydım. Dört alan
// yazılıyor ama okunmuyordu: `dndEnabled`, `dndStart`, `dndEnd` (bu dosya),
// ve `dateFormat` + `weekStart` (ayrı iş).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { dakikayaCevir, penceredeMi, susturulmaliMi } from '../../client/src/rahatsizEtme.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));

const saat = (s, d = 0) => new Date(2026, 9, 3, s, d, 0);

describe('saat çevirisi', () => {
  test('geçerli saatler', () => {
    assert.equal(dakikayaCevir('00:00'), 0);
    assert.equal(dakikayaCevir('08:00'), 480);
    assert.equal(dakikayaCevir('19:30'), 1170);
    assert.equal(dakikayaCevir('23:59'), 1439);
    assert.equal(dakikayaCevir('9:05'), 545, 'tek haneli saat okunmuyor');
  });

  test('BOZUK girdi null — uydurma değer yok', () => {
    for (const k of ['', '24:00', '12:60', 'abc', '12', '12:5', null, undefined, '-1:00']) {
      assert.equal(dakikayaCevir(k), null, `${JSON.stringify(k)} null değil`);
    }
  });
});

describe('pencere — GECE YARISINI SARMA', () => {
  const BAS = dakikayaCevir('19:00');
  const BIT = dakikayaCevir('08:00');

  test('varsayılan 19:00–08:00 gece yarısını SARIYOR', () => {
    // Bu işin bütün zorluğu burada. Düz bir `bas <= simdi && simdi < bit`
    // karşılaştırması varsayılan ayarda HİÇ susturmazdı ve kusur
    // "düzeltilmiş" görünürdü.
    assert.equal(penceredeMi(dakikayaCevir('19:00'), BAS, BIT), true, 'başlangıç dışarıda');
    assert.equal(penceredeMi(dakikayaCevir('23:00'), BAS, BIT), true, 'gece yarısından önce dışarıda');
    assert.equal(penceredeMi(dakikayaCevir('00:30'), BAS, BIT), true, 'gece yarısından sonra dışarıda');
    assert.equal(penceredeMi(dakikayaCevir('07:59'), BAS, BIT), true, 'sabaha karşı dışarıda');
  });

  test('pencere DIŞI gerçekten dışarıda', () => {
    assert.equal(penceredeMi(dakikayaCevir('08:00'), BAS, BIT), false, 'bitiş HARİÇ olmalı');
    assert.equal(penceredeMi(dakikayaCevir('12:00'), BAS, BIT), false);
    assert.equal(penceredeMi(dakikayaCevir('18:59'), BAS, BIT), false);
  });

  test('SARMAYAN pencere de doğru', () => {
    const b = dakikayaCevir('09:00');
    const s = dakikayaCevir('17:00');
    assert.equal(penceredeMi(dakikayaCevir('12:00'), b, s), true);
    assert.equal(penceredeMi(dakikayaCevir('09:00'), b, s), true, 'başlangıç DAHİL');
    assert.equal(penceredeMi(dakikayaCevir('17:00'), b, s), false, 'bitiş HARİÇ');
    assert.equal(penceredeMi(dakikayaCevir('08:59'), b, s), false);
    assert.equal(penceredeMi(dakikayaCevir('23:00'), b, s), false);
  });

  test('EŞİT başlangıç ve bitiş = BOŞ pencere, 24 saat DEĞİL', () => {
    // Aynı saati iki kutuya yazan kullanıcı büyük olasılıkla yanlış
    // kurmuştur. "Hiç susturma" yanlış kurulumun ucuz sonucu, "bir gün
    // boyunca sustur" ise pahalı olanı — şüphede bildirim gösteriliyor.
    const b = dakikayaCevir('19:00');
    assert.equal(penceredeMi(dakikayaCevir('19:00'), b, b), false);
    assert.equal(penceredeMi(dakikayaCevir('03:00'), b, b), false);
  });

  test('null girdilerde susturmuyor', () => {
    assert.equal(penceredeMi(null, BAS, BIT), false);
    assert.equal(penceredeMi(600, null, BIT), false);
    assert.equal(penceredeMi(600, BAS, null), false);
  });
});

describe('susturma kararı', () => {
  test('kapalıyken HİÇ susturmuyor — pencere içinde bile', () => {
    assert.equal(susturulmaliMi({ dndEnabled: false, dndStart: '19:00', dndEnd: '08:00' }, saat(23)), false);
    assert.equal(susturulmaliMi({}, saat(23)), false);
    assert.equal(susturulmaliMi(null, saat(23)), false);
  });

  test('açıkken pencere içinde SUSTURUYOR — kusurun kendisi buydu', () => {
    const t = { dndEnabled: true, dndStart: '19:00', dndEnd: '08:00' };
    assert.equal(susturulmaliMi(t, saat(23)), true);
    assert.equal(susturulmaliMi(t, saat(3)), true);
  });

  test('açıkken pencere DIŞINDA susturmuyor', () => {
    const t = { dndEnabled: true, dndStart: '19:00', dndEnd: '08:00' };
    assert.equal(susturulmaliMi(t, saat(12)), false);
  });

  test('saat verilmezse VARSAYILAN pencere — arayüzün gösterdiğiyle aynı', () => {
    // Ayarlar kutuları `|| '19:00'` / `|| '08:00'` ile dolduruluyor;
    // karar da aynı varsayılanı kullanmak zorunda, yoksa ekranda yazan
    // saat ile uygulanan saat ayrışır.
    assert.equal(susturulmaliMi({ dndEnabled: true }, saat(23)), true);
    assert.equal(susturulmaliMi({ dndEnabled: true }, saat(12)), false);
  });

  test('BOZUK saatte SUSTURMUYOR — bildirim yutulmuyor', () => {
    // Ters karar (şüphede susturmak) kullanıcının bildirimlerini sessizce
    // yutardı ve sebebi hiçbir yerde görünmezdi.
    assert.equal(susturulmaliMi({ dndEnabled: true, dndStart: 'bozuk', dndEnd: '08:00' }, saat(23)), false);
    assert.equal(susturulmaliMi({ dndEnabled: true, dndStart: '19:00', dndEnd: '99:99' }, saat(23)), false);
  });

  test('geçersiz tarih patlamıyor', () => {
    const t = { dndEnabled: true };
    assert.equal(susturulmaliMi(t, new Date('olmayan')), false);
    assert.equal(susturulmaliMi(t, null), false);
    assert.equal(susturulmaliMi(t, 'bugün'), false);
  });
});

describe('app.jsx bağlantısı', () => {
  test('BİLDİRİM kapısı pencereyi okuyor — kusurun kendisi buydu', () => {
    const bas = APP.indexOf('const izinVar = ');
    assert.ok(bas > 0, 'bildirim kapısı bulunamadı');
    const satir = APP.slice(bas, APP.indexOf(';', bas));
    assert.match(satir, /!susturulmaliMi\(twks, new Date\(\)\)/,
      'DND penceresi bildirim kapısında okunmuyor — ayar yine hiçbir şey yapmaz');
  });

  test('SOHBET kapısı da pencereyi okuyor', () => {
    // Ayar "bildirimleri sustur" diyor ve gece 3'te gelen bir DM de
    // bildirimdir. S1 kararı sohbeti kapsam dışında bırakıyor ama o karar
    // HANGİ OLAYIN kestiğiyle ilgili; sessiz saatler ayrı bir soru.
    const bas = APP.indexOf("sock.on('chat_message'");
    assert.ok(bas > 0, 'sohbet işleyicisi bulunamadı');
    const blok = APP.slice(bas, APP.indexOf('return () => {', bas));
    assert.match(blok, /const dndPenceresi = susturulmaliMi\(twks, new Date\(\)\);/,
      'sohbet penceresi hiç hesaplamıyor');
  });

  test('SES ve TOAST aynı pencereden geçiyor', () => {
    // 17 Eylül'de ding kapısızdı ve kullanıcı sesin nereden geldiğini
    // bulamıyordu; aynı kusurun ikinci biçimi, pencereyi yalnızca toast'a
    // uygulamak olurdu.
    const bas = APP.indexOf("sock.on('chat_message'");
    const blok = APP.slice(bas, APP.indexOf('return () => {', bas));
    const sesKapisi = blok.split('\n')
      .find((l) => /twks\.soundEnabled !== false && twks\.notifyMessages !== false/.test(l));
    assert.ok(sesKapisi, 'ses kapısı bulunamadı');
    assert.match(sesKapisi, /!dndPenceresi/, 'ses penceredeyken de çalıyor');
    assert.match(blok, /if \(myStatus === 'dnd' \|\| dndPenceresi\) return;/,
      'toast penceredeyken de gösteriliyor');
  });

  test('pencere BİR KEZ hesaplanıyor', () => {
    // İki ayrı `new Date()` çağrısı, pencere sınırında ses ve toast'ın
    // ayrışmasına yol açardı (biri 07:59'da, öteki 08:00'de karar verir).
    const bas = APP.indexOf("sock.on('chat_message'");
    const blok = APP.slice(bas, APP.indexOf('return () => {', bas));
    assert.equal((blok.match(/susturulmaliMi\(/g) || []).length, 1,
      'sohbet yolunda pencere birden fazla kez hesaplanıyor');
  });
});
