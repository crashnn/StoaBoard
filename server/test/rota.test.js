// Görünüm başına adres — geri tuşu siteden atmasın (kart #228).
//
// KUSUR (17-18 Eylül 2026, kullanıcı gerçek cihazda): "ana sayfadan tümünü gör
// dedim listeye attı ... telefonun geri tuşu ile geri dönmek istedim ancak
// takıldı, çok atınca da Google ekranına attı." Giriş yapmış kullanıcı için
// bütün görünümler `/` adresindeydi; görünüm değiştirmek geçmiş kaydı
// üretmiyordu, geri tuşu SİTEDEN ÖNCEKİ sayfaya gidiyordu.
//
// KARARLAR (kullanıcı): Türkçe yollar · kart adres alıyor (/pano/kart/193) ·
// proje/kanal şimdilik adreste yok.
//
// Eşleme saf bir modülde (`client/src/rota.js`) ve burada DAVRANIŞI ölçülüyor.
// app.jsx'teki bağlantılar ayrıca, kendi bloklarına bağlı olarak kilitleniyor:
// eşleme doğru olup etki yanlış yazarsa kusur aynen sürer.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GORUNUM_YOLLARI, durumdanYol, yoldanDurum, girisNoktasiMi,
} from '../../client/src/rota.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));

describe('rota — görünüm ↔ adres eşlemesi', () => {
  test('her görünüm kendi adresine gidip geri dönüyor', () => {
    for (const [gorunum, yol] of Object.entries(GORUNUM_YOLLARI)) {
      assert.equal(durumdanYol(gorunum), yol);
      assert.deepEqual(yoldanDurum(yol), { gorunum, kart: null }, `${yol} geri çözülmüyor`);
    }
  });

  test('yollar Türkçe — karar', () => {
    assert.equal(GORUNUM_YOLLARI.board, '/pano');
    assert.equal(GORUNUM_YOLLARI.chat, '/sohbet');
    assert.equal(GORUNUM_YOLLARI.trash, '/cop');
  });

  test('kart adresi — gidiş ve dönüş', () => {
    assert.equal(durumdanYol('board', '193'), '/pano/kart/193');
    assert.equal(durumdanYol('reports', 193), '/pano/kart/193',
      'kart hangi görünümden açılırsa açılsın adresi aynı');
    assert.deepEqual(yoldanDurum('/pano/kart/193'), { gorunum: 'board', kart: '193' });
  });

  test('sondaki eğik çizgi aynı adres', () => {
    assert.deepEqual(yoldanDurum('/sohbet/'), { gorunum: 'chat', kart: null });
  });

  test('sayısal olmayan kart kimliği adres üretmiyor', () => {
    // Kimlik adrese yazılıyor; sayı değilse yazılmamalı (enjeksiyon kapısı
    // açılmasın, adres de bozulmasın).
    assert.equal(durumdanYol('board', '1/../x'), '/pano');
    assert.equal(yoldanDurum('/pano/kart/abc'), null);
  });

  test('tanınmayan görünüm panoya düşüyor, boş adres üretmiyor', () => {
    assert.equal(durumdanYol('olmayan'), '/pano');
  });

  test('giriş noktaları: kök, /giris ve tanınmayan adres — hukuki sayfa DEĞİL', () => {
    assert.equal(girisNoktasiMi('/'), true);
    assert.equal(girisNoktasiMi('/giris'), true);
    assert.equal(girisNoktasiMi('/bilinmeyen'), true);
    assert.equal(girisNoktasiMi('/pano'), false);
    assert.equal(girisNoktasiMi('/pano/kart/5'), false);
    assert.equal(girisNoktasiMi('/gizlilik-sartlari'), false,
      'hukuki sayfadan uygulamaya dönüş gerçek bir gezinme; geçmişte kalmalı');
  });
});

describe('rota — app.jsx bağlantıları (#228)', () => {
  test('eşlemedeki her görünüm uygulamada çiziliyor — ölü adres yok', () => {
    const cizilen = new Set([...APP.matchAll(/view === '(\w+)'/g)].map((m) => m[1]));
    const olu = Object.keys(GORUNUM_YOLLARI).filter((g) => !cizilen.has(g));
    assert.deepEqual(olu, [], `adresi olan ama çizilmeyen görünüm: ${olu.join(', ')}`);
  });

  test('çizilen her görünümün bir adresi var — geri tuşu hiçbir ekranda siteden atmıyor', () => {
    const cizilen = new Set([...APP.matchAll(/view === '(\w+)'/g)].map((m) => m[1]));
    cizilen.delete('auth'); // giriş ekranı `authed` bayrağıyla açılıyor, kendi adresi /giris
    const adressiz = [...cizilen].filter((g) => !GORUNUM_YOLLARI[g]);
    assert.deepEqual(adressiz, [], `adresi olmayan görünüm: ${adressiz.join(', ')}`);
  });

  // Adres etkisinin gövdesi: "Görünüm başına adres" yorumundan etkinin
  // bağımlılık listesine kadar.
  const etki = () => {
    const bas = APP.indexOf('const kartId = drawerTask?.id ?? taskPageTask?.id ?? null;');
    assert.notEqual(bas, -1, 'adres etkisi bulunamadı');
    return APP.slice(bas, APP.indexOf('}, [view, authed, loading', bas));
  };

  test('adres durumdan türetiliyor ve eşitse yazılmıyor — geri tuşu döngüye girmiyor', () => {
    const b = etki();
    assert.match(b, /const hedef = durumdanYol\(view, kartId\);/, 'adres durumdan türetilmiyor');
    assert.match(b, /if \(simdiki === hedef\) return;/,
      'eşitlik kontrolü yok — popstate sonrası etki adresi yeniden yazar, geri tuşu döngüye girer');
  });

  test('kart arayüzden kapanınca BİZİM eklediğimiz kayıt geri alınıyor', () => {
    const b = etki();
    assert.match(b, /if \(!kartId && window\.history\.state\?\.kartItildi\)/,
      'kart kapanınca geri alınmıyor — sonraki geri tuşu kartı yeniden açar');
    assert.match(b, /window\.history\.back\(\)/, 'kart kaydı geri alınmıyor');
    assert.match(b, /kartItildi: true/,
      'eklenen kart kaydı işaretlenmiyor — doğrudan bağlantıyla gelen karta da back() çağrılır ve kullanıcı siteden çıkar');
  });

  test('giriş noktaları değiştiriliyor, eklenmiyor', () => {
    const b = etki();
    const i = b.indexOf('if (girisNoktasiMi(simdiki))');
    assert.notEqual(i, -1, 'giriş noktası ayrımı yok');
    const dal = b.slice(i, b.indexOf('} else {', i));
    assert.match(dal, /replaceState/,
      'giriş noktası geçmişe EKLENİYOR — geri tuşu kullanıcıyı bir kez daha / ya da giriş ekranına atar');
  });

  test('geri tuşu kartı kapatıyor', () => {
    const bas = APP.indexOf('const handlePop = () => {');
    assert.notEqual(bas, -1, 'popstate işleyicisi yok');
    const b = APP.slice(bas, APP.indexOf("window.addEventListener('popstate'", bas));
    assert.match(b, /yoldanDurum\(path\)/, 'popstate adresi çözmüyor');
    assert.match(b, /setDrawerTask\(null\)/, 'geri tuşu çekmeceyi kapatmıyor');
    assert.match(b, /setTaskPageTask\(null\)/, 'geri tuşu tam sayfa kartı kapatmıyor');
  });

  test('ilk yüklemede derin bağlantı ezilmiyor', () => {
    // Adres etkisi "kartı aç" etkisinden ÖNCE çalışıyor. Bekleyen kart
    // render sırasında adresten başlatılmazsa /pano/kart/5 /pano ile ezilir.
    assert.match(APP, /const bekleyenKart = useRef\(yoldanDurum\(window\.location\.pathname\)\?\.kart \|\| null\);/,
      'bekleyen kart adresten başlatılmıyor — derin bağlantı ilk yüklemede kaybolur');
  });

  test('#192 değişmezi duruyor: kimlik bilinmeden adres yazılmıyor', () => {
    const bas = APP.indexOf("if (view === 'gizlilik-sartlari' || view === 'hizmet-sartlari') {\n      if (window.location.pathname");
    assert.notEqual(bas, -1, 'adres etkisinin başı bulunamadı');
    const onu = APP.slice(Math.max(0, bas - 200), bas);
    assert.match(onu, /if \(loading\) return;/,
      'yükleme kapısı kalkmış — giriş yapmış kullanıcı bir an /giris\'e itilir (#192)');
  });
});
