// İstemcinin çağırdığı her yol sunucuda VAR MI? (3 Ekim 2026)
//
// NİÇİN VAR: soket olaylarındaki ad ayrışmasının (`soketOlaylari.test.js`)
// HTTP karşılığı. İstemci `/api/notes/trash` çağırır, sunucu
// `/api/notes/cop` sunar ve özellik ÖLÜ doğar: istek 404 döner, `apiFetch`
// onu hataya çevirir, çağrı yeri `catch`te yutar ya da boş liste gösterir.
// Ekranda "çöp kutusu boş" yazar — doğru cevap veriyormuş gibi.
//
// BU TUR BİR KUSUR BULMADI. 123 sunucu yolu ve 103 istemci çağrısı
// karşılaştırıldı, hepsi eşleşti. Teslim edilen şey KİLİT: yüzey büyük
// (yüzden fazla çağrı yeri) ve bir sonraki yazım hatası sessiz kalmasın.
//
// NE YAKALIYOR: parça SAYISI (derinlik hatası), SABİT parçaların yazımı
// (iki yönde: istemci yolunu bozmak da sunucu yolunu yeniden adlandırmak
// da), montaj önekinin değişmesi, ve yeni bir router'ın mount edilmemesi.
//
// NE YAKALAMIYOR: şablon ara değerinin doğru TİPTE olduğunu. `/api/tasks/
// ${noteId}` yanlış kimliği gönderse tarama göremez — çalışma anında ne
// geldiğini bilmiyor. Sınır burada yazılı ki "uç eşleşmesi tam test
// edilmiş" sanılmasın.
//
// EŞLEŞME KURALI EXPRESS'TEN SIKI ve gerekçesi `uyuyorMu`da: müsamahalı
// kural (sunucu `:param` ise her şey uyar) mutasyon turunda İKİ KEZ kaçtı.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya, yorumsuzKaynak } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'app.js'));
const ROUTES = path.resolve(__dirname, '..', 'src', 'routes');
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');

/** `app.use('/api/x', yRouter)` → değişken adı başına önek listesi. */
function montajOnekleri() {
  const onek = new Map();
  for (const m of APP.matchAll(/app\.use\(\s*'(\/api[^']*)'\s*,\s*([A-Za-z_$][\w$]*)/g)) {
    if (!onek.has(m[2])) onek.set(m[2], []);
    onek.get(m[2]).push(m[1]);
  }
  return onek;
}

/** Sunucunun sunduğu `YÖNTEM /tam/yol` kümesi. */
function sunucuYollari() {
  const onek = montajOnekleri();
  const yollar = new Set();
  const montajsiz = new Set();
  for (const ad of fs.readdirSync(ROUTES)) {
    if (!ad.endsWith('.js')) continue;
    const src = yorumsuzDosya(path.join(ROUTES, ad));
    // IKI KAPI, ikisi de taramanin KENDI hatasindan dogdu:
    //  · `(?<![.\w$])` — `req.app.get('io')` ifadesi `app.get(` gibi
    //    gorunuyor ve rota sanilmisti. Degisken noktadan SONRA gelmemeli.
    //  · Yol `/` ile baslamali — `app.get('io')` gibi ayar okumalari rota
    //    degil. Ikisi birlikte dokuz hayalet kaydi eledi.
    for (const m of src.matchAll(
      /(?<![.\w$])([A-Za-z_$][\w$]*)\.(get|post|patch|put|delete)\(\s*'(\/[^']*)'/g,
    )) {
      const [, degisken, yontem, yol] = m;
      const onekler = onek.get(degisken);
      if (!onekler) { montajsiz.add(`${ad}:${degisken}`); continue; }
      for (const o of onekler) {
        const tam = (o + (yol === '/' ? '' : yol)).replace(/\/+$/, '') || '/';
        yollar.add(`${yontem.toUpperCase()} ${tam}`);
      }
    }
  }
  return { yollar, montajsiz };
}

/** İstemcinin çağırdığı `YÖNTEM /yol` kümesi — şablon ara değerleri `:p`. */
function istemciCagrilari() {
  const cagrilar = new Map();
  const gez = (dizin) => {
    for (const ad of fs.readdirSync(dizin)) {
      const tam = path.join(dizin, ad);
      if (fs.statSync(tam).isDirectory()) { gez(tam); continue; }
      if (!/\.(js|jsx)$/.test(ad)) continue;
      const src = yorumsuzKaynak(fs.readFileSync(tam, 'utf8').replace(/\r\n/g, '\n'));
      for (const m of src.matchAll(/apiFetch\(\s*(?:'([^']*)'|`([^`]*)`)([^)]{0,220})/g)) {
        const ham = m[1] ?? m[2];
        if (!ham.startsWith('/api')) continue;
        // Yöntem `apiFetch`in ikinci argümanından; yoksa GET.
        const ym = /method:\s*'(\w+)'/.exec(m[3] || '');
        const yontem = (ym ? ym[1] : 'GET').toUpperCase();
        const yol = ham
          .replace(/\$\{[^}]*\}/g, ':p')     // şablon ara değeri
          .replace(/\?.*$/, '')              // sorgu dizisi yolun parçası değil
          .replace(/\/+$/, '') || '/';
        const anahtar = `${yontem} ${yol}`;
        if (!cagrilar.has(anahtar)) cagrilar.set(anahtar, ad);
      }
    }
  };
  gez(ISTEMCI);
  return cagrilar;
}

// Tarayicilar PAHALI (butun agaci okuyor) ve dort olcutte de gerekiyor;
// bir kez hesaplanip saklaniyor. Oncesinde kosum 32 saniye suruyordu.
let _sunucu = null;
const sunucuBir = () => (_sunucu ||= sunucuYollari());
let _istemci = null;
const istemciBir = () => (_istemci ||= istemciCagrilari());

const parcala = (s) => {
  const bosluk = s.indexOf(' ');
  return { yontem: s.slice(0, bosluk), seg: s.slice(bosluk + 1).split('/').filter(Boolean) };
};

/**
 * İstemci yolu bu sunucu yoluna uyuyor mu?
 *
 * KURAL EXPRESS'TEN SIKI, ve bilerek. İlk yazışımda "sunucu parçası
 * `:param` ise her şey uyar" diyordum — Express'in gerçek davranışı bu, ama
 * ölçüt olarak işe yaramıyor: `/api/notes/cop` yazım hatası
 * `/api/notes/:id` rotası tarafından EMİLİYOR ve test geçiyordu. Mutasyon
 * turu bunu iki yönden de yakaladı (istemci yolunu bozmak, sunucu yolunu
 * yeniden adlandırmak) ve başlıkta yazdığım "yazım hatasını yakalar"
 * iddiası yanlış çıktı.
 *
 * Sıkı kural: istemcinin yazdığı SABİT parça, sunucuda da aynı SABİT parça
 * olmalı. Ara değer (`:p`) ise sunucunun parametresine ya da sabitine
 * uyabilir — çalışma anında ne geldiğini tarama bilemez.
 *
 * Böylece `/api/notes/cop` artık hiçbir şeye uymuyor: sunucuda `cop` adlı
 * sabit parça yok. Express onu `:id`ye yönlendirir, kayıt bulunamaz ve
 * özellik yine sessizce ölür — yani kusur gerçek, sadece 404 yerine "boş
 * sonuç" biçiminde.
 */
function uyuyorMu(c, s) {
  if (c.yontem !== s.yontem) return false;
  if (c.seg.length !== s.seg.length) return false;
  return c.seg.every((seg, i) => (seg === ':p' ? true : seg === s.seg[i]));
}

describe('tarama kör kalamaz', () => {
  test('MONTAJ edilmemiş router yok — önek bulunamayan uç sessizce atlanmaz', () => {
    // Bu testin temeli: bir router `app.js`te mount edilmiyorsa yolları
    // hesaplanamıyor ve tarama onları ATLIYOR. Atlanan uç, "istemci
    // çağırıyor ama yok" ölçütünü sessizce aklardı.
    //
    // Bugün mount edilmeyen router'lar var ve bunlar MCP yüzeyi ile
    // `index.js`ten mount edilenler; ikisi de `/api` altında değil, yani
    // istemcinin `apiFetch` yolu hiç oraya gitmiyor.
    const { montajsiz } = sunucuBir();
    const BEKLENEN = new Set(['mcp.js:mcpRouter']);
    const yeni = [...montajsiz].filter((m) => !BEKLENEN.has(m)).sort();
    assert.deepEqual(yeni, [],
      'Bu router\'lar app.js\'te `/api` altına mount edilmiyor, yani tarama '
      + 'yollarını hesaplayamıyor ve atlıyor. Mount noktası eklendiyse bu '
      + 'listeye değil app.js\'e bakılmalı:\n  ' + yeni.join('\n  '));
  });

  test('tarama GERÇEKTEN yol buluyor — ayırt edicilik kapısı', () => {
    // İki küme de boş olsa aşağıdaki ölçüt hiçbir şey ölçmezdi.
    const { yollar } = sunucuBir();
    assert.ok(yollar.size >= 100, `sunucuda yalnızca ${yollar.size} yol bulundu`);
    assert.ok(istemciBir().size >= 80,
      `istemcide yalnızca ${istemciBir().size} çağrı bulundu`);
  });

  test('istemci çağrıları ŞABLONLU olanları da kapsıyor', () => {
    // Çağrıların üçte ikisi şablon; yalnızca düz metinleri görmek taramayı
    // sessizce daraltırdı.
    //
    // AÇIK SINIR: bu ölçüt bir TABAN, mutasyonla doğrulanmadı. Kırılması
    // için kaynaktan otuz beş şablonlu çağrının birden kalkması gerekir ve
    // gerçekçi tek bir mutasyon bunu yapmıyor. Taramanın şablon desenini
    // kaybetmesine karşı koruyor, kaynaktaki bir değişikliğe karşı değil.
    const sablonlu = [...istemciBir().keys()].filter((a) => a.includes(':p'));
    assert.ok(sablonlu.length >= 30, `yalnızca ${sablonlu.length} şablonlu çağrı görüldü`);
  });
});

describe('istemcinin çağırdığı her yol sunucuda var', () => {
  test('eşleşmeyen çağrı YOK', () => {
    // Kaçırılan hâli: istemci `/api/notes/trash` çağırır, sunucu
    // `/api/notes/cop` sunar. İstek 404 döner, çağrı yeri yutar ve ekranda
    // "çöp kutusu boş" yazar — doğru cevap veriyormuş gibi.
    const sunucu = [...sunucuBir().yollar].map(parcala);
    const eksik = [];
    for (const [anahtar, dosya] of istemciBir()) {
      const c = parcala(anahtar);
      if (!sunucu.some((s) => uyuyorMu(c, s))) eksik.push(`${anahtar}   (${dosya})`);
    }
    assert.deepEqual(eksik, [],
      'Bu çağrıların sunucuda karşılığı yok — istek 404 döner ve özellik '
      + 'sessizce ölür:\n  ' + eksik.join('\n  '));
  });
});
