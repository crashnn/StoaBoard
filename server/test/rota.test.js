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
  girisSonrasiKaydet, girisSonrasiOku, girisSonrasiSil, baslangicYolu,
  projeyiHatirla, hatirlananProje,
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
    assert.match(APP, /const bekleyenKart = useRef\(yoldanDurum\(baslangicYolu\(window\.location\.pathname, girisSonrasiOku\(\)\)\)\?\.kart \|\| null\);/,
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

// ─── #248: misafir kart bağlantısıyla gelince girişten sonra o karta dönüş ───
//
// KUSUR: misafir /pano/kart/193 ile gelince adres /giris yapılıyordu; giriş
// yapınca ilk yükleme etkisi adreste kart göremiyor, bekleyen kartı siliyordu.
// Hedef sekmede (sessionStorage) tutuluyor: giriş ekranında dil değiştirmek
// sayfayı yeniliyor ve bellekteki her şey kayboluyor.

const sahteDepo = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
};

describe('rota — girişten sonra dönülecek adres (#248)', () => {
  test('yalnızca uygulama içi açılış adresi hedef olarak yazılıyor', () => {
    for (const [yol, beklenen] of [['/pano/kart/193', '/pano/kart/193'], ['/raporlar', '/raporlar'], ['/pano/', '/pano']]) {
      const d = sahteDepo();
      girisSonrasiKaydet(yol, d);
      assert.equal(girisSonrasiOku(d), beklenen, yol);
    }
    // Giriş, kök, hukuki ve tanınmayan adres hedef DEĞİL: /giris'te yenilenen
    // sayfa bekleyen kartın üstüne yazmamalı.
    for (const yol of ['/giris', '/', '/gizlilik-sartlari', '/xyz', '//evil.com/pano']) {
      const d = sahteDepo();
      d.setItem('stoa.girisSonrasi', '/pano/kart/7');
      girisSonrasiKaydet(yol, d);
      assert.equal(girisSonrasiOku(d), '/pano/kart/7', `${yol} bekleyen hedefi ezdi`);
    }
  });

  test('okunan hedef doğrulanıyor — depo kullanıcı denetiminde', () => {
    for (const bozuk of ['//evil.com', 'https://evil.com/pano', '/pano/kart/abc', '', 'javascript:alert(1)']) {
      const d = sahteDepo();
      d.setItem('stoa.girisSonrasi', bozuk);
      assert.equal(girisSonrasiOku(d), null, `kabul edildi: ${bozuk}`);
    }
  });

  test('hedef tek kullanımlık', () => {
    const d = sahteDepo();
    girisSonrasiKaydet('/pano/kart/5', d);
    assert.equal(girisSonrasiOku(d), '/pano/kart/5', 'okumak silmemeli — açılışta iki kez okunuyor');
    girisSonrasiSil(d);
    assert.equal(girisSonrasiOku(d), null);
  });

  test('başlangıç yolu: adres bir yer söylüyorsa o, söylemiyorsa hedef', () => {
    assert.equal(baslangicYolu('/giris', '/pano/kart/193'), '/pano/kart/193');
    assert.equal(baslangicYolu('/', '/raporlar'), '/raporlar');
    // Adres kendisi bir yer söylüyorsa bekleyen hedef onu EZMİYOR.
    assert.equal(baslangicYolu('/sohbet', '/pano/kart/193'), '/sohbet');
    assert.equal(baslangicYolu('/gizlilik-sartlari', '/pano/kart/193'), '/gizlilik-sartlari');
    // Hedef yoksa ya da bozuksa adres olduğu gibi.
    assert.equal(baslangicYolu('/giris', null), '/giris');
    assert.equal(baslangicYolu('/giris', '//evil.com'), '/giris');
  });
});

describe('rota — #248 app.jsx bağlantıları', () => {
  const blok = (bas, son) => {
    const i = APP.indexOf(bas);
    assert.notEqual(i, -1, `blok başı yok: ${bas}`);
    const j = APP.indexOf(son, i + bas.length);
    assert.notEqual(j, -1, `blok sonu yok: ${son}`);
    return APP.slice(i, j);
  };

  test('açılışta hedef yazılıyor ve görünüm ondan kuruluyor', () => {
    const b = blok('const [view, setView]', 'const [tasks, setTasks]');
    assert.match(b, /girisSonrasiKaydet\(path\)/, 'açılış adresi sekmeye yazılmıyor');
    assert.match(b, /yoldanDurum\(baslangicYolu\(path, girisSonrasiOku\(\)\)\)/,
      'görünüm bekleyen hedeften kurulmuyor — dil değişiminden sonra kart kaybolur');
  });

  test('oturum açılınca hedef okunup SİLİNİYOR ve kart açılıyor', () => {
    const b = blok('if (loading || !authed) return;', '}, [loading, authed]);');
    const oku = b.indexOf('yoldanDurum(baslangicYolu(window.location.pathname, girisSonrasiOku()))');
    const sil = b.indexOf('girisSonrasiSil()');
    const ac = b.indexOf('adrestekiKartiAc(adresten.kart)');
    assert.ok(oku > 0, 'ilk yükleme hedefi okumuyor — girişten sonra kart açılmaz');
    assert.ok(sil > oku, 'hedef okunduktan sonra silinmiyor — sonraki girişte beklenmedik kart açılır');
    assert.ok(ac > oku, 'hedefteki kart açılmıyor');
    assert.match(b, /if \(adresten\) setView\(adresten\.gorunum\);/, 'görünüm hedefe eşitlenmiyor');
  });

  test('misafirin /giris adresi uygulama adresinin YERİNE yazılıyor', () => {
    // Eklenirse geri tuşu /pano/kart/193'e döner, adres yine /giris'e itilir:
    // misafir geri tuşuyla siteden bile çıkamaz.
    const b = blok('} else if (!authed) {', '} else {');
    assert.match(b, /HUKUKI_YOLLAR\.has\(simdiki\) \? 'pushState' : 'replaceState'/,
      'misafir için /giris her zaman ekleniyor — geri tuşu döngüye girer');
    assert.match(b, /window\.history\[yaz\]\(\{\}, '', `\/giris\$\{window\.location\.search\}`\)/,
      'seçilen yöntem giriş adresini yazan çağrıda kullanılmıyor');
  });
});

// ─── #256: seçili proje yenilemede / girişte / alan değişiminde unutulmasın ───
//
// KUSUR: istemci önyüklemeyi PROJESİZ çağırıyordu, sunucu da parametre yoksa
// ilk projeyi seçiyordu. F5, giriş ve alan değiştirme kullanıcıyı her
// seferinde Ana Proje'ye atıyordu (18 Eylül 2026, sade tur 23/25). Projesiz
// çağrı BEŞ yerdeydi — biri düzelse dördü kalırdı; artık hepsi tek yardımcıdan.

describe('rota — hatırlanan proje (#256)', () => {
  test('alan başına ayrı tutuluyor, alan bilinmiyorsa son alanın projesi', () => {
    const d = sahteDepo();
    projeyiHatirla(15, 47, d);
    projeyiHatirla('19', '52', d);
    assert.equal(hatirlananProje(15, d), '47', 'alan 15 kendi projesini unuttu');
    assert.equal(hatirlananProje(19, d), '52');
    assert.equal(hatirlananProje(null, d), '52', 'açılışta son kullanılan alanın projesi gelmeli');
    assert.equal(hatirlananProje(99, d), null, 'hiç girilmemiş alan için proje uydurulmamalı');
  });

  test('biçimsiz kimlik ne yazılıyor ne gönderiliyor', () => {
    const d = sahteDepo();
    for (const [a, p] of [[15, null], [15, undefined], [15, 'abc'], [null, 47], ['1;2', 47]]) {
      projeyiHatirla(a, p, d);
    }
    assert.equal(hatirlananProje(15, d), null);
    assert.equal(hatirlananProje(null, d), null, 'geçersiz yazma son alanı kaydetti');
    // Depo kullanıcı denetiminde: elle bozulmuş değer sunucuya gitmez.
    d.setItem('stoa.sonProje', JSON.stringify({ 15: '47 OR 1=1' }));
    assert.equal(hatirlananProje(15, d), null);
  });

  test('projesiz alana geçmek son geçerli kaydı ezmiyor', () => {
    // Projesi olmayan alanda önyükleme current_project: null döner. Yazma
    // doğrulanmasaydı "son alan" boş bir kayda dönerdi ve okuma doğrulaması
    // bunu örterdi — fark ancak SONRAKİ açılışta görünür (mutasyonla bulundu).
    const d = sahteDepo();
    projeyiHatirla(15, 47, d);
    projeyiHatirla(19, null, d);
    assert.equal(hatirlananProje(null, d), '47', 'geçersiz yazma son alanı ezdi');
  });

  test('bozuk kayıt siliniyor — her açılışta yeniden atılmıyor', () => {
    const d = sahteDepo();
    d.setItem('stoa.sonProje', '{bozuk');
    assert.equal(hatirlananProje(15, d), null);
    assert.equal(d.getItem('stoa.sonProje'), null, 'bozuk kayıt yerinde kaldı');
    d.setItem('stoa.sonProje', '[1,2]');
    assert.equal(hatirlananProje(0, d), null, 'dizi harita sayıldı');
    projeyiHatirla(15, 47, d);
    assert.equal(hatirlananProje(15, d), '47', 'bozuk kayıttan sonra yazma çalışmıyor');
    // Dizi "harita gibi" de çalışır (anahtarlar sayı) — ama büyük bir alan
    // kimliği diziyi o uzunluğa şişirir ve depoya binlerce `null` yazılır.
    // Eşdeğer SANILAN mutant tam burada ayrışıyor.
    d.setItem('stoa.sonProje', '[]');
    projeyiHatirla(100000, 1, d);
    assert.ok(d.getItem('stoa.sonProje').length < 100,
      `dizi kayıt şişti: ${d.getItem('stoa.sonProje').length} karakter`);
  });
});

describe('rota — #256 app.jsx bağlantıları', () => {
  const govde = (bas, son) => {
    const i = APP.indexOf(bas);
    assert.notEqual(i, -1, `blok başı yok: ${bas}`);
    return APP.slice(i, APP.indexOf(son, i + bas.length));
  };

  test('önyükleme yalnızca iki yoldan: hatırlanan proje ya da açık seçim', () => {
    // Projesiz `API.bootstrap()` sunucuda ilk projeyi seçer — kusurun kendisi.
    // Her çağrının argümanı sayılıyor: "en az bir doğru çağrı var" ölçütü,
    // beş yerden birinin eski hâlde kalmasını kaçırırdı.
    const argumanlar = [...APP.matchAll(/API\.bootstrap\(([^)]*\)?)\)/g)].map((m) => m[1]).sort();
    assert.deepEqual(argumanlar, ['hatirlananProje(alanId)', 'projectId'],
      `önyükleme çağrıları: ${argumanlar.join(' | ')}`);
  });

  test('kaydı tek yazan önyükleme uygulayıcısı', () => {
    const b = govde('function _applyBootstrap(data) {', '\n  }\n');
    assert.match(b, /projeyiHatirla\(data\.workspace\?\.id, data\.current_project\)/,
      'önyükleme sonrası açık proje hatırlanmıyor');
  });

  test('alan değişiminde YENİ alanın projesi isteniyor', () => {
    assert.match(govde('const handleSwitchWorkspace = async (wsId) => {', '\n  };\n'), /await onyukle\(wsId\)/,
      'alan değiştirme hangi alana gidildiğini söylemiyor — eski alanın projesi gönderilir');
    assert.match(govde("sock.on('workspace_switched'", '});'), /onyukle\(workspace_id\)/,
      'soket alan değişimi olayın taşıdığı alanı kullanmıyor');
  });
});
