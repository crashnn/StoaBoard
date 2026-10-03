// Canlı bağlantının durumu (3 Ekim 2026).
//
// KUSUR: istemcinin tamamında TEK BİR `disconnect` işleyicisi yoktu. Soket
// `app.jsx`te kuruluyor, sonra yalnızca BAŞKALARININ varlığı dinleniyordu
// (`user_online` / `user_offline`). Dizüstü uyandığında, wifi değiştiğinde ya
// da sunucu yeniden başladığında pano bayat kalıyor ve bunu söyleyen hiçbir
// şey yok: kartlar duruyor, sohbet sessizleşiyor, kullanıcı "kimse bir şey
// yapmıyor" sanıyor.
//
// Bu deponun adını koyduğu düşmanın tam örneği — sessiz başarısızlık.
// "Koşulun yokluk hâli ya reddetmeli ya gürültü çıkarmalı"; çıkarmıyordu.
//
// İKİ AYRI SORU, İKİ AYRI ÖLÇÜT — ilk yazışımda bunları karıştırdım:
//   · ŞERİT geciktiriliyor (kısa blip gürültü yapmasın).
//   · TAZELEME geciktirilmiyor (300 ms'de de olaylar gerçekten kayboluyor).
// Şeridi geciktirmek bir arayüz kararı; tazelemeyi geciktirmek veri kaybı.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { GECIKME_MS, baglantiDurumu, baglantiMetni, tazelenmeliMi } from '../../client/src/baglanti.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));

describe('durum — saf', () => {
  test('bağlıyken şerit yok', () => {
    assert.equal(baglantiDurumu({ bagli: true }), 'bagli');
  });

  test('KISA BLİP şerit açmıyor', () => {
    // Socket.IO 300 ms'de geri dönüyor. Her blipte şerit çakmak, şeridi
    // gürültüye çeviren şey olurdu — sonra kimse bakmaz.
    assert.equal(baglantiDurumu({ bagli: false, deniyor: false, gecikmeGecti: false }), 'bagli');
  });

  test('gecikme geçtiyse KOPUK', () => {
    assert.equal(baglantiDurumu({ bagli: false, deniyor: false, gecikmeGecti: true }), 'kopuk');
  });

  test('deneme sürüyorsa DÖNÜYOR — ayrı cümle', () => {
    // "Bağlantı yok" kullanıcıya bir şey yapması gerektiğini düşündürür;
    // "bağlanılıyor" beklemesini söyler. İkisini tek duruma indirmek
    // kullanıcıyı gereksiz yere harekete geçirir.
    assert.equal(baglantiDurumu({ bagli: false, deniyor: true, gecikmeGecti: true }), 'donuyor');
  });

  test('bağlı olmak denemeyi YENİYOR', () => {
    // Yarış durumu: `connect` ile `reconnect_attempt` aynı turda gelirse
    // sonuç "bağlı" olmalı, "dönüyor" değil.
    assert.equal(baglantiDurumu({ bagli: true, deniyor: true, gecikmeGecti: true }), 'bagli');
  });

  test('gecikme ÖLÇÜLEBİLİR ve sıfır değil', () => {
    // Sıfır gecikme "her blipte şerit" demek; çok uzun gecikme "hiç şerit
    // yok" demek. Ayırt edicilik kapısı: değer bir aralıkta olmalı.
    assert.ok(GECIKME_MS >= 1000 && GECIKME_MS <= 10000, `gecikme ${GECIKME_MS} ms`);
  });
});

describe('metin', () => {
  test('her iki durumun da bir cümlesi var', () => {
    assert.ok(baglantiMetni('kopuk', (k, fb) => fb));
    assert.ok(baglantiMetni('donuyor', (k, fb) => fb));
  });

  test('iki cümle BİRBİRİNDEN FARKLI', () => {
    // Aynı metni dönseler ayrı durum tutmanın anlamı kalmazdı.
    assert.notEqual(baglantiMetni('kopuk', (k, fb) => fb), baglantiMetni('donuyor', (k, fb) => fb));
  });

  test('bağlıyken metin YOK — şerit çizilmiyor', () => {
    assert.equal(baglantiMetni('bagli', (k, fb) => fb), null);
  });

  test('sözlük anahtarı kullanılıyor, metin gömülü değil', () => {
    const gorulen = [];
    baglantiMetni('kopuk', (k, fb) => { gorulen.push(k); return fb; });
    baglantiMetni('donuyor', (k, fb) => { gorulen.push(k); return fb; });
    assert.deepEqual(gorulen, ['conn_lost', 'conn_retry']);
  });

  test('çeviri verilmezse Türkçe yedeğe düşüyor, patlamıyor', () => {
    assert.match(baglantiMetni('kopuk', null), /Bağlantı koptu/);
  });
});

describe('tazeleme — ölçüt GÖRÜNEN DURUM değil', () => {
  test('gerçekten koptuysa tazeliyor', () => {
    assert.equal(tazelenmeliMi({ koptu: true }), true);
  });

  test('İLK bağlanmada tazelemiyor — önyükleme zaten yapıldı', () => {
    assert.equal(tazelenmeliMi({ koptu: false }), false);
    assert.equal(tazelenmeliMi({}), false);
  });
});

describe('app.jsx bağlantısı', () => {
  const soketEtkisi = () => {
    const bas = APP.indexOf("const sock = io({ transports:");
    assert.ok(bas > 0, 'soket kurulumu bulunamadı');
    const son = APP.indexOf('}, [authed, needsWorkspace]);', bas);
    assert.ok(son > bas, 'soket etkisi kapanmıyor');
    return APP.slice(bas, son);
  };

  test('disconnect DİNLENİYOR ve İŞ YAPIYOR — kusurun kendisi buydu', () => {
    // ÖLÇÜT GÖVDEYE BAĞLI. İlk hâli yalnızca `sock.on('disconnect', () => {`
    // kalıbını arıyordu ve aklama denemesi geçti: ölü bir
    // `if (false) sock.on('disconnect', () => {});` satırı ölçütü doyurdu.
    // İşleyicinin VAR OLMASI değil, iş YAPMASI ölçülüyor — ve tek bir tane
    // olduğu sayılıyor.
    const t = soketEtkisi();
    const kac = (t.match(/sock\.on\('disconnect'/g) || []).length;
    assert.equal(kac, 1, `${kac} disconnect işleyicisi — biri ölü olabilir`);
    // Gövde İŞLEYİCİNİN KENDİ KAPANIŞINA kadar: `\n    });` aramak yetmedi,
    // çünkü ölü TEK SATIRLIK bir işleyici (`() => {});`) orada kapanmıyor ve
    // dilim aşağıdaki gerçek işleyiciye taşıyordu — pencere genişken ölçüt
    // yine komşusundan ödünç alıyor. İlk `});` ölü işleyiciyi kendi
    // satırında bitiriyor, gerçek işleyicide ise zamanlayıcının içine
    // düşüyor, yani iki ölçüt de hâlâ kapsamda.
    const bas = t.indexOf("sock.on('disconnect'");
    const govde = t.slice(bas, t.indexOf('});', bas) + 3);
    assert.match(govde, /koptu = true;/, 'kopma kaydedilmiyor — tazeleme tetiklenemez');
    assert.match(govde, /gecikmeZamani = setTimeout\(/, 'şerit hiç açılmıyor');
  });

  test('connect DİNLENİYOR ve tek tane', () => {
    const t = soketEtkisi();
    assert.equal((t.match(/sock\.on\('connect'/g) || []).length, 1);
  });

  test('yeniden bağlanma denemesi dinleniyor', () => {
    assert.match(soketEtkisi(), /sock\.io\.on\('reconnect_attempt', \(\) => \{/);
  });

  test('geri dönüşte VERİ de tazeleniyor', () => {
    // Şeridi kaldırmak yetmez: kopukken gönderilen olaylar geri gelmiyor.
    // "Bağlantı var" deyip bayat pano göstermek hiç söylememekten daha
    // kötü, çünkü kullanıcı artık ekrana güveniyor.
    const bas = soketEtkisi().indexOf("sock.on('connect'");
    const govde = soketEtkisi().slice(bas, soketEtkisi().indexOf("sock.on('disconnect'", bas));
    assert.match(govde, /tazelenmeliMi\(\{ koptu \}\)/, 'tazeleme kapısı yok');
    assert.match(govde, /onyukle\(/, 'veri tazelenmiyor');
    assert.match(govde, /_applyBootstrap\(data\)/, 'gelen veri uygulanmıyor');
  });

  test('TAZELEME DÜŞERSE sessiz kalmıyor', () => {
    // Tazeleme başarısızsa ekrandaki veri hâlâ bayat; şerit kalkmamalı.
    // Bu, aynı kusurun ikinci biçimi olurdu.
    const t = soketEtkisi();
    const bas = t.indexOf("sock.on('connect'");
    const govde = t.slice(bas, t.indexOf("sock.on('disconnect'", bas));
    assert.match(govde, /\.catch\(\(\) => \{[\s\S]*?durumuKur\(/, 'tazeleme hatası yutuluyor');
  });

  test('gecikme zamanlayıcısının kimliği SIFIRLANIYOR', () => {
    // Sıfırlanmazsa `reconnect_attempt` kapısı ("gecikme hâlâ bekliyor mu")
    // ateşlendikten sonra da dolu kimliği görür ve "bağlanılıyor" durumu HİÇ
    // görünmez — sessiz kalmanın ikinci biçimi. İlk yazışımda tam bu hata
    // vardı.
    const t = soketEtkisi();
    const bas = t.indexOf('gecikmeZamani = setTimeout(');
    assert.ok(bas > 0, 'gecikme zamanlayıcısı bulunamadı');
    const govde = t.slice(bas, t.indexOf('}, GECIKME_MS);', bas));
    assert.match(govde, /gecikmeZamani = null;/, 'zamanlayıcı kimliği sıfırlanmıyor');
  });

  test('etki TEMİZLENİRKEN zamanlayıcı ve durum bırakılmıyor', () => {
    // Alan değişiminde şerit "bağlantı koptu" diye takılı kalırdı.
    const bas = APP.indexOf('return () => {', APP.indexOf("const sock = io({ transports:"));
    const temizlik = APP.slice(bas, APP.indexOf('};', bas));
    assert.match(temizlik, /clearTimeout\(gecikmeZamani\)/, 'zamanlayıcı sızıyor');
    assert.match(temizlik, /setCanliDurum\('bagli'\)/, 'şerit takılı kalıyor');
  });

  test('şerit TOAST DEĞİL — koşul sürerken ekranda duruyor', () => {
    // Toast kayboluyor, koşul kaybolmuyor. Toast'la söylemek "iki saniye
    // sonra kullanıcı yine bilmiyor" demek.
    assert.match(APP, /\{canliDurum !== 'bagli' && \(\s*\n\s*<div className="canli-serit"/,
      'bağlantı durumu şeritle söylenmiyor');
    assert.doesNotMatch(APP, /showToast\?\.\([^)]*conn_lost/, 'durum toast ile söyleniyor');
  });

  test('şerit ekran okuyucuya da söylüyor', () => {
    const bas = APP.indexOf('className="canli-serit"');
    assert.ok(bas > 0, 'şerit bulunamadı');
    assert.match(APP.slice(bas, APP.indexOf('>', bas)), /role="status"/,
      'şerit yalnızca göze görünüyor');
  });
});
