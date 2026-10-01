// Oturum sahibinin adresi ve kart listesinin tekilliği.
//
// KUSUR (30 Eylül 2026, kullanıcı): "Görev oluşturunca iki tane kart
// açılıyor, bu önceden yoktu." Ekran görüntüsündeki iki kart AYNI numarayı
// (#305) taşıyordu — sunucu iki kayıt açmamıştı, tek kart listeye iki kez
// girmişti.
//
// Zincir:
//   1. `lib/user.js` → `userToDict` adresi `id` alanında gönderiyor ve
//      `slug` diye bir alan HİÇ göndermiyor.
//   2. `app.jsx` → `benimYankim` tam o olmayan alanı okuyordu, yani soket
//      yankı süzgeci yazıldığı günden (17 Eylül) beri hiç çalışmadı.
//   3. `routes/tasks.js` `task_created` olayını 201 yanıtından ÖNCE
//      yayınlıyor. Yankı iyimser eklemeden önce gelip kartı listeye
//      koyuyor, ardından HTTP yanıtı aynı kartı ikinci kez koyuyordu.
//
// Üç halkanın üçü de ayrı ayrı kilitleniyor. Biri doğru olup öteki
// bozulduğunda kusur aynen geri gelir.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { userToDict } from '../src/lib/user.js';
import { kartiYerlestir } from '../../client/src/kartListesi.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

// `ben.js` `window`a bakıyor; Node'da küresel nesneyi testin kurması gerek.
globalThis.window = globalThis;
const { benSlug, benimYankim } = await import('../../client/src/ben.js');

function oturum(kullanici) {
  globalThis.CURRENT_USER = kullanici;
}

describe('oturum sahibinin adresi — tek okuyucu', () => {
  test('sunucunun kullanıcı sözlüğünde slug alanı YOK, adres id alanında', () => {
    // Kusurun kökü. Bu satır kırılırsa `ben.js`in gerekçesi değişmiş
    // demektir ve oradaki açıklama da güncellenmeli.
    const d = userToDict({
      slug: 'eray-atalay', name: 'Eray Atalay', roleTitle: 'Stajyer',
      avatarInitials: 'EA', avatarColor: 'x', status: 'online', awayTimeout: 15,
    });
    assert.equal(d.id, 'eray-atalay', 'adres id alanında olmalı');
    assert.ok(!('slug' in d), 'sözlükte slug alanı var — ben.js yanlış alanı okuyor olabilir');
  });

  test('benSlug id alanını okuyor', () => {
    oturum({ id: 'eray-atalay', name: 'Eray Atalay' });
    assert.equal(benSlug(), 'eray-atalay');
    oturum(null);
    assert.equal(benSlug(), null, 'oturum yokken null dönmeli');
  });

  test('benimYankim kendi eylemimi eliyor, başkasınınkini elemiyor', () => {
    oturum({ id: 'eray-atalay' });
    assert.equal(benimYankim('eray-atalay'), true, 'kendi yankım elenmeli');
    assert.equal(benimYankim('mustafa-yigit'), false, 'başkasının olayı uygulanmalı');
  });

  test('actor ya da oturum boşsa olay UYGULANIYOR — sessizce yutulmuyor', () => {
    // Sunucu adres koyamadıysa olayı uygulamak, atlayıp ekranı sessizce
    // eski bırakmaktan iyidir. Bu depoda sessiz başarısızlık yasak.
    oturum({ id: 'eray-atalay' });
    assert.equal(benimYankim(null), false);
    assert.equal(benimYankim(undefined), false);
    oturum(null);
    assert.equal(benimYankim('eray-atalay'), false);
  });

  test('istemci kaynağında CURRENT_USER.slug okuması yok', () => {
    // KULLANIMI ölçüyor, bildirimi değil (18 Eylül dersi): `ben.js`in var
    // olması kimsenin onu kullandığını göstermez. Olmayan alanı okuyan tek
    // bir satır kalırsa o yol yine sessizce undefined üretir.
    //
    // Yorumlar boşluğa çevriliyor: `ben.js` ve `app.jsx` eski ifadeyi
    // AÇIKLAMA olarak taşıyor ve o metin kod sanılırsa test kendi
    // belgesinden kırılır (11 Eylül'de tam bu yaşandı).
    const kacaklar = [];
    const tara = (dizin) => {
      for (const ad of fs.readdirSync(dizin)) {
        const tam = path.join(dizin, ad);
        if (fs.statSync(tam).isDirectory()) { tara(tam); continue; }
        if (!/\.(jsx?|mjs)$/.test(ad)) continue;
        const src = yorumsuzDosya(tam);
        src.split(/\r?\n/).forEach((satir, i) => {
          if (/CURRENT_USER\s*\??\.\s*slug/.test(satir)) kacaklar.push(`${ad}:${i + 1}`);
        });
      }
    };
    tara(CLIENT);
    assert.deepEqual(kacaklar, [],
      'CURRENT_USER.slug her zaman undefined — adres id alanında, benSlug() kullan');
  });
});

describe('kart listesi — kimlikle tekil', () => {
  const K = (id, ek = {}) => ({ id, title: `kart ${id}`, ...ek });

  test('yeni kart başa giriyor', () => {
    assert.deepEqual(kartiYerlestir([K(2)], K(1)).map((t) => t.id), [1, 2]);
  });

  test('konum son ise sona giriyor — çöpten geri alma bu sırayı kullanıyor', () => {
    assert.deepEqual(kartiYerlestir([K(2)], K(1), 'son').map((t) => t.id), [2, 1]);
  });

  test('AYNI kart iki kez girerse ikinci kopya oluşmuyor', () => {
    // Çift kartın kendisi. Önce yankı, sonra HTTP yanıtı — ya da tersi.
    const sonra = kartiYerlestir(kartiYerlestir([], K(305)), K(305));
    assert.equal(sonra.length, 1, 'kart iki kez listeye girdi');
  });

  test('var olan kart YERİNDE güncelleniyor, sırası değişmiyor', () => {
    const liste = [K(1), K(2), K(3)];
    const sonra = kartiYerlestir(liste, { id: 2, title: 'yeni ad' });
    assert.deepEqual(sonra.map((t) => t.id), [1, 2, 3], 'sıra oynadı');
    assert.equal(sonra[1].title, 'yeni ad');
  });

  test('kimlik tür farkı tekilliği bozmuyor — sunucu sayı, adres metin verebiliyor', () => {
    assert.equal(kartiYerlestir([K(305)], K('305')).length, 1);
  });

  test('kart yoksa liste olduğu gibi kalıyor', () => {
    const liste = [K(1)];
    assert.equal(kartiYerlestir(liste, null), liste);
    assert.equal(kartiYerlestir(liste, { title: 'kimliksiz' }).length, 1);
  });
});

describe('çift kartın üç halkası kaynakta bağlı', () => {
  const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));

  test('iyimser ekleme de tekil yerleştirmeden geçiyor', () => {
    // Yalnızca soket tarafını tekil yapmak yetmez: çift kart İKİ yoldan
    // doğuyordu ve ikisi de aynı listeye yazıyor. Ölçüt `createTask`
    // bloğuna bağlı, dosya geneline değil.
    const bas = APP.indexOf('const createTask = async');
    assert.ok(bas > -1, 'createTask bulunamadı');
    const blok = APP.slice(bas, APP.indexOf('const deleteTask', bas));
    assert.match(blok, /kartiYerlestir\(prev, created\)/,
      'createTask kartı doğrudan listeye ekliyor — yankı önce gelirse ikinci kopya oluşur');
  });

  test('task_created dinleyicisi de aynı yerleştiriciyi kullanıyor', () => {
    const bas = APP.indexOf("sock.on('task_created'");
    const blok = APP.slice(bas, APP.indexOf("sock.on('task_updated'", bas));
    assert.match(blok, /kartiYerlestir\(/, 'yankı kartı tekil yerleştirmiyor');
  });

  test('sunucu task_created olayını 201 yanıtından ÖNCE yayınlıyor', () => {
    // Yarışın kaynağı. Sıra tersine dönerse tekil yerleştirme zaten
    // koruyor, ama bu satır sırayı BELGELEYEN ölçüt: biri emit'i aşağı
    // alırsa yukarıdaki iki testin niçin var olduğu anlaşılmaz olur.
    const TASKS = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'tasks.js'));
    const emit = TASKS.indexOf("panoYayini(io, 'task_created'");
    const yanit = TASKS.indexOf('res.status(201).json(dict)', emit);
    assert.ok(emit > -1 && yanit > emit,
      'task_created yayını 201 yanıtından sonraya alınmış — kartListesi.js gerekçesi güncellenmeli');
  });
});
