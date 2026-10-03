// Bildirim patlamasında tek kesme (3 Ekim 2026).
//
// KUSUR, VE KAYNAĞI BENİM ÖNCEKİ İŞİM: 2 Ekim'de toplu atama geldi.
// `PATCH /api/tasks/:id` yeni eklenen her atanana bir `task_assigned`
// bildirimi yazıyor ve toplu atama o ucu kart başına çağırıyor — yirmi kartı
// Ayşe'ye atamak Ayşe'ye yirmi bildirim gönderiyor. `task_assigned` ayrıca
// S1 kararıyla EKRANI KESEN iki türden biri (BILDIRIMLER.md), yani yirmi
// toast + yirmi ding.
//
// BILDIRIMLER.md bunu 6. boşluk olarak "gürültü RİSKİ" diye yazmış. Toplu
// işlem gelmeden önce risktir; geldikten sonra canlı davranış.
//
// KARAR: ilk bildirim HEMEN gösteriliyor, gerisi sayılıyor, pencere
// kapanınca TEK özet. Alternatif olan "hepsini bekletip tek toast" tek bir
// atamayı da geciktirirdi — yaygın durumu nadir durum için yavaşlatmak.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { PENCERE_MS, yiginKarari, ozetMetni } from '../../client/src/bildirimYigini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));

describe('yığın kararı — saf', () => {
  test('ilk bildirim GÖSTERİLİYOR', () => {
    assert.equal(yiginKarari(null, 1000), 'ilk');
    assert.equal(yiginKarari(undefined, 1000), 'ilk');
  });

  test('pencere içindeki ikinci bildirim SAYILIYOR', () => {
    assert.equal(yiginKarari({ basladi: 1000 }, 1500), 'say');
  });

  test('pencere GEÇTİKTEN sonra yeniden gösteriliyor', () => {
    // Sessizce yutmak, yarım saat sonra gelen bildirimi de kaçırmak olurdu.
    assert.equal(yiginKarari({ basladi: 1000 }, 1000 + PENCERE_MS + 1), 'ilk');
  });

  test('pencere İLK bildirimden sayılıyor, sonuncudan DEĞİL', () => {
    // Sonuncudan sayılsaydı saniyede bir gelen sürekli bir akış pencereyi
    // hiç kapatmaz ve kullanıcı özeti HİÇ görmezdi.
    //
    // İLK HÂLİ AYIRT ETMİYORDU: kayıt yalnızca `basladi` taşıdığı için
    // "son gelene bak" mutasyonu da aynı cevabı veriyordu (`sonGelen ||
    // basladi` yedeğe düşüyordu). Ölçüt artık kayda FAZLA ALAN koyuyor:
    // karar yalnızca `basladi`ya bakıyorsa sonuç değişmez.
    assert.equal(yiginKarari({ basladi: 1000, sayi: 9 }, 1000 + PENCERE_MS + 1), 'ilk');
    assert.equal(
      yiginKarari({ basladi: 1000, sonGelen: 1000 + PENCERE_MS, guncellendi: 1000 + PENCERE_MS, sayi: 9 },
        1000 + PENCERE_MS + 1),
      'ilk',
      'karar kayıttaki başka bir zamana bakıyor — pencere ilk bildirimden sayılmıyor');
  });

  test('sınırda sayılıyor — pencere kapsayıcı', () => {
    assert.equal(yiginKarari({ basladi: 1000 }, 1000 + PENCERE_MS), 'say');
  });

  test('bozuk kayıt patlamıyor, ilk sayılıyor', () => {
    assert.equal(yiginKarari({}, 1000), 'ilk');
    assert.equal(yiginKarari({ basladi: 'x' }, 1000), 'ilk');
  });

  test('pencere ÖLÇÜLEBİLİR bir aralıkta', () => {
    // Çok kısa: patlama yine yirmi toast üretir. Çok uzun: gerçek bir
    // bildirim sessizce yutulur.
    assert.ok(PENCERE_MS >= 1000 && PENCERE_MS <= 10000, `pencere ${PENCERE_MS} ms`);
  });
});

describe('özet metni', () => {
  test('tür başına ayrı cümle', () => {
    assert.match(ozetMetni('task_assigned', 19, (k, fb) => fb), /19 yeni atama/);
    assert.match(ozetMetni('mention', 3, (k, fb) => fb), /3 yeni bahsetme/);
    assert.match(ozetMetni('baska', 2, (k, fb) => fb), /2 yeni bildirim/);
  });

  test('üç cümle birbirinden FARKLI', () => {
    const c = (tur) => ozetMetni(tur, 5, (k, fb) => fb);
    assert.equal(new Set([c('task_assigned'), c('mention'), c('baska')]).size, 3);
  });

  test('FAZLASI yoksa özet YOK', () => {
    // "+0 yeni atama" diye bir cümle yok ve gereksiz bir toast, kapatmaya
    // çalıştığımız gürültünün kendisi olurdu.
    assert.equal(ozetMetni('task_assigned', 0, (k, fb) => fb), null);
    assert.equal(ozetMetni('task_assigned', -1, (k, fb) => fb), null);
    assert.equal(ozetMetni('task_assigned', null, (k, fb) => fb), null);
  });

  test('sözlük anahtarları kullanılıyor, metin gömülü değil', () => {
    const gorulen = [];
    for (const tur of ['task_assigned', 'mention', 'baska']) {
      ozetMetni(tur, 1, (k, fb) => { gorulen.push(k); return fb; });
    }
    assert.deepEqual(gorulen, ['notif_burst_assigned', 'notif_burst_mention', 'notif_burst_other']);
  });

  test('çeviri verilmezse Türkçe yedeğe düşüyor', () => {
    assert.match(ozetMetni('task_assigned', 4, null), /4 yeni atama/);
  });
});

describe('app.jsx bağlantısı', () => {
  const yiginBlogu = () => {
    const bas = APP.indexOf('if (kesiyor && izinVar) {');
    assert.ok(bas > 0, 'kesme bloğu bulunamadı');
    const son = APP.indexOf("sock.on('chat_message'", bas);
    assert.ok(son > bas, 'blok kapanmıyor');
    return APP.slice(bas, son);
  };

  test('DING de yığından geçiyor — patlama tek ses', () => {
    // Ses eskiden kapının DIŞINDAYDI ve 17 Eylül'de içine alınmıştı; aynı
    // hatayı yığın eklerken tekrarlamak, yirmi toastı bire indirip yirmi
    // dingi bırakmak olurdu.
    const b = yiginBlogu();
    assert.match(b, /if \(yiginKarari\(kayit, simdi\) === 'ilk'\) \{[\s\S]*?_playDing\(\)/,
      'ding yığının dışında — patlama yirmi ses çıkarır');
    // Sayma dalında ses OLMAMALI.
    const sayDali = b.slice(b.indexOf('} else {'));
    assert.doesNotMatch(sayDali, /_playDing/, 'sayılan bildirim de ses çıkarıyor');

    // ULAŞILABİLİRLİK. Aklama denemesi yukarıdaki ölçütü akladı: metni
    // `if (false) { ... }` içine sarmak onu dalda BIRAKIYOR ama hiç
    // çalıştırmıyor. Kaynak taraması ulaşılabilirliği doğrudan göremez;
    // ölçülebilen şey YAPI — ding, dalın DOĞRUDAN çocuğu olmalı, yani
    // girintisi kardeşiyle aynı. Fazladan bir sarmalayıcı girintiyi
    // kaydırıyor; bütün dalı yeniden biçimlendirmek ikisini birlikte
    // kaydırır, yani ölçüt biçime değil yapıya bağlı.
    // Üç ölçüt birlikte gerekiyor, çünkü sarmalayıcı iki biçimde gelebilir:
    //  · AYNI SATIRDA (`if (false) { if (ses) _playDing(); }`) → satır
    //    biçimi yakalıyor. Girinti bunu KAÇIRDI, ilk denemede tam bu oldu.
    //  · ÖNCEKİ SATIRDA (`if (false) {` sonra ding) → girinti ve parantez
    //    dengesi yakalıyor.
    const satirlar = b.split('\n');
    const dingSatiri = satirlar.find((l) => /_playDing\(\)/.test(l));
    assert.ok(dingSatiri, 'ding satırı bulunamadı');
    assert.match(dingSatiri, /^\s*if \(twks\.soundEnabled !== false\) _playDing\(\);$/,
      'ding fazladan bir koşulun içine sarılmış — dalda duruyor ama çalışmıyor');

    const girinti = (satir) => satir.match(/^\s*/)[0].length;
    const kardes = satirlar.find((l) => /BILDIRIM_YIGINI\[tur\] = \{/.test(l));
    assert.ok(kardes, 'kardeş satır bulunamadı');
    assert.equal(girinti(dingSatiri), girinti(kardes), 'ding dalın doğrudan çocuğu değil');

    // Dalın açılışından ding satırına kadar parantezler DENGELİ olmalı:
    // kapanmamış bir blok açılmışsa ding onun içinde kalmış demektir.
    const dalBas = b.indexOf("=== 'ilk') {");
    const arasi = b.slice(dalBas, b.indexOf(dingSatiri));
    const ac = (arasi.match(/\{/g) || []).length;
    const kapa = (arasi.match(/\}/g) || []).length;
    assert.equal(ac - kapa, 1, `dal açılışı ile ding arasında ${ac - kapa} kapanmamış blok var`);

    // AÇIK SINIR: kaynak taraması ULAŞILABİLİRLİĞİ kanıtlayamaz. Yukarıdaki
    // üç ölçüt gerçekçi sarmalama biçimlerini kapatıyor; bilerek kurulmuş,
    // girintisi ve satır biçimi taklit eden bir ölü blok hâlâ geçebilir.
    // Bu sınır burada yazılı ki "ulaşılabilirlik test edilmiş" sanılmasın.
  });

  test('sayma dalında TOAST da yok', () => {
    const b = yiginBlogu();
    const sayDali = b.slice(b.indexOf('} else {'), b.indexOf('zamanlayici = setTimeout'));
    assert.doesNotMatch(sayDali, /showToast/, 'sayılan bildirim de toast gösteriyor');
  });

  test('özet İLKİ SAYMIYOR', () => {
    // İlk bildirim zaten gösterildi; özet yalnızca FAZLASINI söylüyor.
    // `sayi` olduğu gibi geçilse "+20" derdi ama on dokuz tanesi gizliydi.
    assert.match(yiginBlogu(), /ozetMetni\(tur, \(k\?\.sayi \|\| 1\) - 1,/,
      'özet ilk bildirimi de sayıyor');
  });

  test('yığın MODÜL KAPSAMINDA ve `.current` taşımıyor', () => {
    // Soket etkisi yeniden kurulduğunda (alan değişimi) sayaç sıfırlanmamalı,
    // yoksa aynı patlama ikinci bir kesme üretir. 18 Eylül'ün `.current`
    // dersi: bildirim değil KULLANIM ölçülüyor.
    assert.match(APP, /^const BILDIRIM_YIGINI = \{\};$/m, 'yığın modül kapsamında değil');
    assert.doesNotMatch(APP, /BILDIRIM_YIGINI\.current/, 'yığın ref gibi okunuyor');
  });

  test('önceki pencerenin zamanlayıcısı SIZMIYOR', () => {
    // Temizlenmezse eski pencere kapanırken yeni sayacın özetini basar.
    assert.match(yiginBlogu(), /clearTimeout\(kayit\?\.zamanlayici\)/, 'ilk dalda sızıyor');
    assert.match(yiginBlogu(), /clearTimeout\(kayit\.zamanlayici\)/, 'sayma dalında sızıyor');
  });

  test('yığın YALNIZCA kesen bildirimlere uygulanıyor', () => {
    // Sessiz birikenler zaten toast göstermiyor; onları da yığına sokmak
    // sayacı alakasız olaylarla doldurup gerçek patlamayı gizlerdi.
    assert.match(APP, /if \(kesiyor && izinVar\) \{\s*\n\s*const simdi = Date\.now\(\);/,
      'yığın kesme kapısının dışında');
  });
});
