// Vitrin sayfası — dil denkliği, sözleşme ve token eşliği.
//
// NİÇİN AYRI DOSYA: `dil.test.js` `client/src/views` altını tarıyor ve
// APP_I18N sözlüğünü ölçüyor. Vitrin oturumsuz misafire giden STATİK bir
// sayfa; uygulama sözlüğü yüklenmeden çalışmak zorunda, o yüzden kendi
// iki dilli mekanizmasını taşıyor (`data-en` kardeş alanı). Aynı kural,
// ayrı mekanizma — `auth.jsx`in AUTH_I18N'i için verilen kararın aynısı
// (CLAUDE.md).
//
// Vitrin ÜÇ ayrı ayrışma riski taşıyor ve üçü de burada kilitli:
//
//   1. DİL. Bir metin eklenip `data-en`i unutulursa İngilizce arayüzde
//      Türkçe kalır ve bu SESSİZ bir kusurdur: sayfa çalışır, yalnızca
//      yanlış dilde durur. Deponun en pahalı dersi bu (31 ihlal).
//   2. SÖZLEŞME. Düğmeler `/giris` ve `/giris?kayit=1`e, sayı bandı
//      `/api/public/stats`e bağlı. `app.js` bu yolları biliyor; biri
//      yeniden adlandırılırsa vitrin sessizce kırık bağlantı gösterir.
//   3. TOKEN. `vitrin.css` uygulamanın CSS'ini İÇE AKTARMIYOR (misafire
//      210 KB indirmemek için, gerekçe dosyanın başında) ve bu iki yerde
//      iki değer demek. Ödün bilinçli, ama ayrışması bilinçli değil.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');
const VITRIN = path.join(KOK, 'static', 'vitrin');

const HTML_HAM = fs.readFileSync(path.join(VITRIN, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS_HAM = fs.readFileSync(path.join(VITRIN, 'vitrin.css'), 'utf8').replace(/\r\n/g, '\n');

// Yorumlar ÖNCE boşluğa çevriliyor, silinmiyor: konumlar korunuyor.
// Bu dosyadaki yorumlar kuralı ANLATIYOR ve yasaklı metinlerin kendisini
// içeriyor ("Giriş", "data-en"); tarama onları kod sanarsa iki yönde de
// yanılır. Bu tuzak bu depoda üç kez düştü (CLAUDE.md).
const yorumsuz = (s, bas, son) => {
  const re = new RegExp(`${bas}[\\s\\S]*?${son}`, 'g');
  return s.replace(re, (m) => m.replace(/[^\n]/g, ' '));
};
const HTML = yorumsuz(HTML_HAM, '<!--', '-->');
const CSS = yorumsuz(CSS_HAM, '/\\*', '\\*/');

// ─── 1. Dil denkliği ───────────────────────────────────────────────────────

/**
 * Metin taşıyan basit elemanları çıkarır: `<h1 ...>metin</h1>`.
 *
 * İç içe eleman taşıyanlar (logo gibi) bilerek dışarıda: onların metni
 * muafiyet listesinde. Desen `[^<]+` kullanıyor, yani yalnızca DÜZ metin
 * içeren elemanları yakalıyor — böylece bir eleman iki kez sayılmıyor.
 */
function metinliElemanlar() {
  const out = [];
  const re = /<(h1|h2|p|span|b|a)\b([^>]*)>([^<]+)<\/\1>/g;
  for (const m of HTML.matchAll(re)) {
    const metin = m[3].trim();
    if (!metin) continue;
    out.push({ etiket: m[1], ozellikler: m[2], metin, tam: m[0] });
  }
  return out;
}

/**
 * Çevirisi BEKLENMEYEN metinler ve her birinin gerekçesi.
 *
 * Liste `ACIK_UCLAR` kalıbının aynısı: engellemek değil, KARARI GÖRÜNÜR
 * KILMAK için var. Yeni bir muafiyet gerekçesiyle buraya yazılmak zorunda
 * ve gözden geçirmede görünür oluyor.
 */
const MUAF = new Map([
  ['StoaBoard', 'Marka adı — çevrilmiyor.'],
  ['© 2026 StoaBoard', 'Telif satırı; marka adı ve yıl.'],
  ['TR', 'Dil kodu. Endonim kuralı: İngilizce arayüzde de "TR" yazmalı.'],
  ['EN', 'Dil kodu; yukarıdaki gerekçe.'],
  ['—', 'Sayı bandı yer tutucusu; değer API\'den geliyor.'],
  ['Story point', 'Terim İngilizce olarak yerleşik; Türkçede de böyle kullanılıyor.'],
]);

describe('Vitrin — dil denkliği', () => {
  const elemanlar = metinliElemanlar();

  test('tarama gerçekten eleman buluyor', () => {
    // Desen bozulursa liste boşalır ve aşağıdaki test sessizce geçerdi.
    assert.ok(
      elemanlar.length >= 20,
      `yalnızca ${elemanlar.length} metinli eleman bulundu; tarama deseni bozulmuş olabilir`,
    );
  });

  test('her metnin İngilizce karşılığı var', () => {
    const eksik = [];
    for (const el of elemanlar) {
      if (MUAF.has(el.metin)) continue;
      if (/data-en="/.test(el.ozellikler)) continue;
      eksik.push(`<${el.etiket}> "${el.metin.slice(0, 60)}"`);
    }
    assert.deepEqual(
      eksik, [],
      'Bu metinlerin `data-en` karşılığı yok. İngilizce arayüzde Türkçe '
      + 'kalırlar ve bu SESSİZ bir kusurdur: sayfa çalışır, yanlış dilde '
      + 'durur. Çevrilmemesi gerekiyorsa MUAF listesine GEREKÇESİYLE yaz.\n  '
      + eksik.join('\n  '),
    );
  });

  test('hiçbir data-en boş değil', () => {
    // Boş `data-en` çeviriyi silmek olurdu ve betik onu atlıyor; yani
    // eleman "çevrilmiş" görünür ama Türkçe kalır. Sessiz kusur.
    const bos = [...HTML.matchAll(/data-en="\s*"/g)].map((m) => m[0]);
    assert.deepEqual(bos, [], 'Boş `data-en` var; çeviri hiç uygulanmaz.');
  });

  test('sayfa Türkçe boyanıyor, İngilizce sonradan uygulanıyor', () => {
    // Sıra önemli: Türkçe İŞARETLEMEDE durmalı. Tersi olursa Türkçe
    // ziyaretçi bir an İngilizce görür (dil sıçraması) ve JS kapalıysa
    // sayfa tümden İngilizce kalır.
    assert.match(HTML, /<html lang="tr">/, 'kök dil tr değil');
    assert.match(
      HTML, /if \(dil === EN\)/,
      'Dil değiştirme yalnızca İngilizce için çalışmıyor olabilir; Türkçe '
      + 'işaretlemede durmalı ki sıçrama olmasın.',
    );
  });

  test('dil anahtarı uygulamanınkiyle aynı', () => {
    // Vitrin ayrı bir anahtar kullansaydı kullanıcı dili vitrinde seçip
    // giriş ekranında Türkçe bulurdu — aynı olgunun iki okuyucusu.
    assert.match(
      HTML, /'stoa\.lang'/,
      "Vitrin dil tercihini `stoa.lang` anahtarından okumuyor; uygulama "
      + '(auth.jsx, app.jsx) o anahtarı kullanıyor.',
    );
  });
});

// ─── 2. Sözleşme ───────────────────────────────────────────────────────────

describe('Vitrin — sunucu sözleşmesi', () => {
  test('giriş ve kayıt yolları yerinde — HEPSİ, biri değil', () => {
    // İlk yazım yalnızca "bir yerde var mı" diye bakıyordu ve mutasyon turu
    // onu düşürdü: üç kayıt düğmesinden İKİSİNİ bozmak testi kırmıyordu,
    // çünkü kalan biri deseni karşılıyordu. Ölçüt artık BÜTÜN çağrı
    // düğmelerinin doğru yola gitmesi — sayfada yanlış yere giden tek bir
    // düğme, kayıt akışının o girişten kırık olması demek.
    const kayitDugmeleri = [...HTML.matchAll(/<a class="dolgulu[^"]*" href="([^"]+)"/g)]
      .map((m) => m[1]);
    assert.ok(
      kayitDugmeleri.length >= 3,
      `Yalnızca ${kayitDugmeleri.length} dolgulu düğme bulundu; brief üst `
      + 'çubukta, kahramanda ve kapanışta birer tane istiyor.',
    );
    const yanlis = kayitDugmeleri.filter((h) => h !== '/giris?kayit=1');
    assert.deepEqual(
      yanlis, [],
      `Kayıt düğmelerinden bazıları yanlış yola gidiyor: ${JSON.stringify(yanlis)}. `
      + 'Hepsi /giris?kayit=1 olmalı.',
    );

    // "Giriş" bağlantıları da aynı şekilde: üst çubuk ve kahraman.
    const girisSayisi = [...HTML.matchAll(/href="\/giris"/g)].length;
    assert.ok(
      girisSayisi >= 2,
      `/giris bağlantısı ${girisSayisi} yerde; üst çubukta ve kahramanda `
      + 'olmak üzere en az iki tane beklenir.',
    );
  });

  test('sayı bandı uca bağlı ve üç kanca da var', () => {
    assert.match(HTML, /\/api\/public\/stats/, 'sayı bandı ucu çağrılmıyor');
    for (const anahtar of ['workspaces', 'tasks', 'completed']) {
      assert.match(
        HTML, new RegExp(`data-stat="${anahtar}"`),
        `data-stat="${anahtar}" kancası yok; uç o alanı döndürüyor.`,
      );
    }
  });

  test('uydurma sayı yok — yer tutucu tire', () => {
    // Brief'in açık yasağı. Uç cevap vermezse tire kalıyor; "0" da
    // yazılmıyor, çünkü sıfır bilinmeyenle aynı şey değil ve boş bir ürün
    // izlenimi verirdi.
    const bant = HTML.slice(HTML.indexOf('class="sayilar"'), HTML.indexOf('</section>', HTML.indexOf('class="sayilar"')));
    const degerler = [...bant.matchAll(/data-stat="[a-z]+">([^<]*)</g)].map((m) => m[1].trim());
    assert.deepEqual(
      degerler, ['—', '—', '—'],
      `Sayı bandına sabit değer yazılmış: ${JSON.stringify(degerler)}. `
      + 'Gerçek sayılar API\'den gelir; yer tutucu tire olmalı.',
    );
  });

  test('sunucu vitrini gerçekten bu dosyadan veriyor', () => {
    // Yol değişirse vitrin sessizce servis edilmez ve misafir SPA'ya düşer.
    const appJs = fs.readFileSync(path.join(KOK, 'server', 'src', 'app.js'), 'utf8');
    assert.match(
      appJs, /'vitrin', 'index\.html'/,
      "app.js `static/vitrin/index.html` yolunu okumuyor; vitrin servis edilmez.",
    );
  });
});

// ─── 3. Token eşliği ───────────────────────────────────────────────────────

describe('Vitrin — tokenlar uygulamayla aynı', () => {
  // `vitrin.css` uygulamanın CSS'ini içe aktarmıyor (gerekçe dosyanın
  // başında: misafire 210 KB indirmemek). Ödün iki yerde iki değer; bu test
  // ayrışmayı yakalıyor. Değerler kasten farklılaştırılacaksa test de
  // güncellenmeli — karar görünür olsun.
  const uygulamaCss = fs.readFileSync(
    path.join(KOK, 'client', 'src', 'styles.css'), 'utf8',
  ).replace(/\r\n/g, '\n');

  const OLCULEN = [
    '--bg', '--bg-raised', '--bg-subtle', '--bg-sunken',
    '--ink', '--ink-2', '--ink-muted', '--ink-faint', '--ink-dim',
    '--line', '--line-strong',
    '--r-sm', '--r-md', '--r-lg', '--r-xl',
  ];

  /** Bir CSS metninde `:root { ... }` bloğundaki değişken değerini okur. */
  const oku = (css, ad) => {
    const bas = css.indexOf(':root {');
    assert.ok(bas >= 0, ':root bloğu bulunamadı');
    const son = css.indexOf('\n}', bas);
    const blok = css.slice(bas, son);
    const m = blok.match(new RegExp(`${ad}:\\s*([^;]+);`));
    return m ? m[1].trim() : null;
  };

  for (const ad of OLCULEN) {
    test(`${ad} aynı`, () => {
      const vitrinDeger = oku(CSS, ad);
      const uygulamaDeger = oku(uygulamaCss, ad);
      assert.ok(vitrinDeger, `vitrin.css içinde ${ad} yok`);
      assert.ok(uygulamaDeger, `styles.css içinde ${ad} yok`);
      assert.equal(
        vitrinDeger, uygulamaDeger,
        `${ad} ayrışmış — vitrin "${vitrinDeger}", uygulama "${uygulamaDeger}". `
        + 'Vitrin ürüne benzemek zorunda; token elle kopyalandığı için '
        + 'ayrışabiliyor ve bu test o yüzden var.',
      );
    });
  }

  test('vurgu rengi koyu temada açılıyor', () => {
    // Uygulama koyu temada --accent-navy'yi oklch(70% 0.10 240) yapıyor;
    // sabit lacivert koyu zeminde ~1.6:1 kontrastla okunmuyor. Bu kusur
    // uygulamada bir kez düzeltildi (styles.css yorumu) ve tasarım
    // taslağında bir kez daha kuruldu — vitrinde tekrarlanmasın.
    const koyu = CSS.slice(CSS.indexOf('prefers-color-scheme: dark'));
    assert.match(
      koyu, /--accent:\s*oklch\(/,
      'Koyu temada vurgu rengi açılmıyor. Sabit lacivert koyu zeminde '
      + 'okunmuyor; uygulama orada oklch(70% 0.10 240) kullanıyor.',
    );
  });
});
