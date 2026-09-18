// Çekmecede kartlar arası geçiş — aynı kolonda önceki / sonraki (kart #246).
//
// İSTEK (18 Eylül 2026, kullanıcı): "Kartlar arasında ileri, geri geçişleri
// olabilir ... Tüm kolonların kendi içinde olmalı, kart geçişi." Bir kolonu
// baştan sona okumak için her kartta çekmeceyi kapatıp panoda sonrakine
// basmak gerekiyordu.
//
// Kural saf bir modülde (`client/src/komsu.js`) ve burada DAVRANIŞI ölçülüyor.
// Bağlantılar (app.jsx, drawer.jsx) kendi bloklarına bağlı olarak ayrıca
// kilitleniyor: kural doğru olup çekmece onu okumazsa özellik yok demektir.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { komsuKartlar } from '../../client/src/komsu.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..', 'client', 'src');
const APP = yorumsuzDosya(path.join(KOK, 'app.jsx'));
const DRAWER = yorumsuzDosya(path.join(KOK, 'drawer.jsx'));

const K = (id, col, project_id = 1) => ({ id, col, project_id });

describe('komsu — aynı kolonda önceki / sonraki', () => {
  const kartlar = [K(1, 'todo'), K(2, 'doing'), K(3, 'todo'), K(4, 'todo'), K(5, 'review')];

  test('ortadaki kartın iki komşusu da aynı kolondan, panonun sırasıyla', () => {
    const k = komsuKartlar(kartlar, kartlar[2]); // 3
    assert.equal(k.onceki?.id, 1);
    assert.equal(k.sonraki?.id, 4);
    assert.equal(k.sira, 2);
    assert.equal(k.toplam, 3);
  });

  test('kolonun başında önceki yok, sonunda sonraki yok — öteki kolona ATLAMAZ', () => {
    const bas = komsuKartlar(kartlar, kartlar[0]); // 1
    assert.equal(bas.onceki, null);
    assert.equal(bas.sonraki?.id, 3);
    const son = komsuKartlar(kartlar, kartlar[3]); // 4
    assert.equal(son.sonraki, null, 'kolon sonunda başka kolonun kartına geçiyor');
    assert.equal(son.onceki?.id, 3);
  });

  test('kolonda tek kart: iki yön de kapalı, sayaç 1/1', () => {
    const k = komsuKartlar(kartlar, kartlar[1]); // doing
    assert.deepEqual([k.onceki, k.sonraki, k.sira, k.toplam], [null, null, 1, 1]);
  });

  test('kimlik dize ile sayı karışık gelse de kart kendi listesinde bulunuyor', () => {
    // Soket yayını ile ilk yükleme kimliği farklı türde getirebiliyor.
    const k = komsuKartlar(kartlar, { id: '3', col: 'todo', project_id: '1' });
    assert.equal(k.sira, 2, 'dize kimlik eşleşmedi — düğmeler sebepsiz kapalı kalır');
    assert.equal(k.sonraki?.id, 4);
  });

  test('başka projenin aynı adlı kolonu listeye karışmıyor', () => {
    const karisik = [K(1, 'todo', 1), K(9, 'todo', 2), K(3, 'todo', 1)];
    const k = komsuKartlar(karisik, karisik[0]);
    assert.equal(k.sonraki?.id, 3);
    assert.equal(k.toplam, 2);
  });

  test('kart yok ya da listede değil: boş sonuç, istisna yok', () => {
    assert.deepEqual(komsuKartlar(kartlar, null), { onceki: null, sonraki: null, sira: 0, toplam: 0 });
    assert.deepEqual(komsuKartlar(kartlar, K(99, 'todo')), { onceki: null, sonraki: null, sira: 0, toplam: 0 });
    assert.deepEqual(komsuKartlar(null, K(1, 'todo')), { onceki: null, sonraki: null, sira: 0, toplam: 0 });
  });
});

describe('komsu — bağlantılar', () => {
  test('çekmece VE tam sayfa kart komşuları alıyor, ikisi de aynı kuraldan', () => {
    assert.match(APP, /const cekmeceKomsu = komsuKartlar\(tasks, drawerTask\);/, 'çekmece komşuları hesaplanmıyor');
    assert.match(APP, /const sayfaKomsu = komsuKartlar\(tasks, taskPageTask\);/, 'tam sayfa kart komşuları hesaplanmıyor');
    assert.match(APP, /komsu=\{cekmeceKomsu\}\s+onKomsu=\{openDrawer\}/, 'çekmeceye komşu geçilmiyor');
    assert.match(APP, /komsu=\{sayfaKomsu\}\s+onKomsu=\{setTaskPageTask\}/, 'tam sayfa karta komşu geçilmiyor');
  });

  test('karttan karta geçişte adres DEĞİŞTİRİLİYOR, eklenmiyor (#228 ile uyum)', () => {
    // On kart gezip X'e basan kullanıcı panoya dönmeli; her geçiş kayıt
    // ekleseydi geri tuşu kart kart geriye yürür, X'in back()'i de bir
    // önceki karta düşerdi.
    const bas = APP.indexOf('if (kartId && yoldanDurum(simdiki)?.kart) {');
    assert.notEqual(bas, -1, 'karttan karta geçiş ayrımı yok — her geçiş geçmişe kayıt ekliyor');
    const dal = APP.slice(bas, APP.indexOf('}', bas));
    assert.match(dal, /replaceState/, 'karttan karta geçiş pushState ile yazılıyor');
    assert.match(dal, /kartItildi: !!window\.history\.state\?\.kartItildi/,
      'kartItildi korunmuyor — doğrudan bağlantıyla gelen kartta geçiş sonrası back() siteden çıkarır');
    // Ayrım, genel push/replace dalından ÖNCE olmalı; yoksa oraya hiç düşmez.
    assert.ok(bas < APP.indexOf('if (girisNoktasiMi(simdiki)) {'), 'geçiş ayrımı genel daldan sonra — ölü kod');
  });

  test('sol/sağ ok geçiş yapıyor, ama bir alan düzenlenirken DEĞİL', () => {
    const bas = DRAWER.indexOf("if (e.key === 'ArrowLeft' && komsu?.onceki)");
    assert.notEqual(bas, -1, 'sol ok bağlı değil');
    const blok = DRAWER.slice(DRAWER.lastIndexOf('const onKey = (e) => {', bas), DRAWER.indexOf('};', bas));
    assert.match(blok, /duzenleniyor\(\)\) return;/,
      'düzenleme kapısı yok — yorum yazarken imleci sola alan kullanıcı başka kartta bulur kendini');
    assert.match(blok, /e\.key === 'ArrowRight' && komsu\?\.sonraki/, 'sağ ok bağlı değil');
    const kapi = DRAWER.slice(DRAWER.indexOf('const duzenleniyor = () => {'), bas);
    assert.match(kapi, /isContentEditable/, 'kart gövdesi contentEditable — kapı onu görmüyor');
  });

  test('yorum taslağı karta bağlı: geçişte saklanıyor, dönüşte geri geliyor', () => {
    const bas = DRAWER.indexOf('const taslakSahibi = useDrawerRef(null);');
    assert.notEqual(bas, -1, 'taslak sahibi izlenmiyor — A\'da yazılan yorum B\'nin kutusunda kalır');
    const blok = DRAWER.slice(bas, DRAWER.indexOf('}, [task?.id]);', bas));
    assert.match(blok, /taslaklar\.current\.set\(String\(eski\), mevcut\)/, 'eski kartın taslağı saklanmıyor');
    assert.match(blok, /taslaklar\.current\.get\(String\(yeni\)\)/, 'yeni kartın taslağı yüklenmiyor');
  });

  test('düğmeler kolon sınırında kapanıyor ve konum sayısı görünüyor', () => {
    const bas = DRAWER.indexOf('className="drawer-nav"');
    assert.notEqual(bas, -1, 'geçiş düğmeleri yok');
    const blok = DRAWER.slice(bas, DRAWER.indexOf('drawer_duplicate', bas));
    assert.match(blok, /disabled=\{!komsu\.onceki\}/, 'önceki düğmesi kolon başında kapanmıyor');
    assert.match(blok, /disabled=\{!komsu\.sonraki\}/, 'sonraki düğmesi kolon sonunda kapanmıyor');
    assert.match(blok, /\{komsu\.sira\}\/\{komsu\.toplam\}/, 'konum sayısı yok');
  });
});
