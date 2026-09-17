// Metin kontrasti — sonuk yazi goz karariyla degil, hesapla yakalanir.
//
// Kusur (10 Eylul 2026): "beyaz modda bazi yazilar sonuk duruyor" diye
// bildirildi. Olculdugunde sorun tahminden genisti — uc temanin ucunde de iki
// murekkep tonu metin icin okunamaz durumdaydi:
//
//   --ink-faint  2.29:1  (71 yerde metin rengi)
//   --ink-dim    1.68:1  (14 yerde metin rengi)
//
// WCAG AA normal metin icin 4.5:1 ister. Bu, "sessiz yanlis" ailesinin gorsel
// akrabasi: hicbir sey bozulmuyor, hata cikmiyor, yalnizca kimse okuyamiyor.
// Kimse de sikayet edene kadar fark etmiyor.
//
// Belgeye "acik ton kullanma" yazmak bu kusuru bir daha engellemez; olcut
// sayisal oldugu icin dogrudan kilitlenebilir. Test CSS'i okuyor, hangi
// tokenlarin METIN rengi olarak kullanildigini kendisi buluyor ve her temada
// her yuzeye karsi kontrasti hesapliyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CSS = fs.readFileSync(path.join(KOK, 'client', 'src', 'styles.css'), 'utf8');

const AA_NORMAL = 4.5;

// Metin rengi OLMAYAN, bilincli olarak dusuk kontrastli tokenlar.
// Her biri gerekcesiyle listeleniyor; listeye ekleme yapmak bir karardir.
const METIN_DEGIL = new Set([
  // Kenarlik, avatar dolgusu, devre disi oge. Metin olarak kullanilmasi
  // 1.68:1 demek — hicbir deger secilemez. Kullanildigi yerler 10 Eylul'de
  // --ink-muted'a alindi.
  '--ink-dim',
]);

// ─── Renk matematigi (WCAG 2.x goreli parlaklik) ────────────────────────────

function kanal(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function parlaklik(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function kontrast(a, b) {
  const x = parlaklik(a);
  const y = parlaklik(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// ─── CSS'ten tema tablolarini cikar ─────────────────────────────────────────

const TEMALAR = {
  'varsayilan (isikli)': /:root\s*\{([\s\S]*?)\n\}/,
  cream: /\[data-theme="cream"\]\s*\{([\s\S]*?)\n\}/,
  dark: /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/,
};

function tokenlar(blokRe) {
  const m = CSS.match(blokRe);
  assert.ok(m, 'tema blogu CSS icinde bulunamadi');
  const t = {};
  for (const mm of m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    t[`--${mm[1]}`] = mm[2].toLowerCase();
  }
  return t;
}

// Hangi tokenlar METIN rengi olarak kullaniliyor? Testin kendisi bulsun —
// elle tutulan bir liste, yeni bir token eklendiginde sessizce eskir.
function metinTokenlari() {
  const bulunan = new Set();
  for (const m of CSS.matchAll(/color:\s*var\((--[a-z0-9-]+)/g)) bulunan.add(m[1]);
  const jsxKok = path.join(KOK, 'client', 'src');
  const gez = (dizin) => {
    for (const ad of fs.readdirSync(dizin)) {
      const tam = path.join(dizin, ad);
      if (fs.statSync(tam).isDirectory()) { gez(tam); continue; }
      if (!ad.endsWith('.jsx')) continue;
      const icerik = fs.readFileSync(tam, 'utf8');
      for (const m of icerik.matchAll(/color:\s*['"`]var\((--[a-z0-9-]+)/g)) bulunan.add(m[1]);
    }
  };
  gez(jsxKok);
  return [...bulunan].filter(t => t.startsWith('--ink'));
}

// ─── Testler ────────────────────────────────────────────────────────────────

describe('Metin kontrasti — WCAG AA (4.5:1)', () => {
  const metin = metinTokenlari();

  test('metin rengi olarak kullanilan token bulundu', () => {
    assert.ok(metin.length >= 3, `beklenenden az token bulundu: ${metin.join(', ')}`);
  });

  for (const [temaAdi, re] of Object.entries(TEMALAR)) {
    const t = tokenlar(re);
    const yuzeyler = ['--bg', '--bg-raised'].filter(y => t[y]);

    for (const token of metin) {
      if (METIN_DEGIL.has(token)) continue;
      if (!t[token]) continue; // bu tema o tokeni tanimlamiyorsa ust temadan miras

      test(`${temaAdi}: ${token} okunabilir`, () => {
        for (const y of yuzeyler) {
          const r = kontrast(t[token], t[y]);
          assert.ok(
            r >= AA_NORMAL,
            `${temaAdi} temasinda ${token} (${t[token]}) ${y} (${t[y]}) uzerinde `
            + `${r.toFixed(2)}:1 — AA normal metin ${AA_NORMAL}:1 istiyor. `
            + 'Tonu koyulastir (isikli/cream) ya da acikslastir (dark); '
            + 'metin olarak kullanilmayacaksa METIN_DEGIL listesine gerekcesiyle ekle.',
          );
        }
      });
    }
  }

  // Hiyerarsi de olculebilir: ton adlari bir siralamayi vaat ediyor ve o
  // siralama bozulunca kimse fark etmiyor. 10 Eylul'de tam bu oldu — faint
  // koyulastirilirken muted ile esitlendi, cream'de ise muted'dan koyu kaldi.
  for (const [temaAdi, re] of Object.entries(TEMALAR)) {
    test(`${temaAdi}: ink > ink-2 > ink-muted > ink-faint sirasi korunuyor`, () => {
      const t = tokenlar(re);
      const sira = ['--ink', '--ink-2', '--ink-muted', '--ink-faint'].filter(k => t[k]);
      const zemin = t['--bg'];
      const oranlar = sira.map(k => [k, kontrast(t[k], zemin)]);
      for (let i = 1; i < oranlar.length; i++) {
        assert.ok(
          oranlar[i - 1][1] > oranlar[i][1],
          `${temaAdi}: ${oranlar[i - 1][0]} (${oranlar[i - 1][1].toFixed(2)}:1) `
          + `${oranlar[i][0]} (${oranlar[i][1].toFixed(2)}:1) tonundan daha belirgin `
          + 'olmali. Ad bir siralama vaat ediyor; deger onu tutmuyor.',
        );
      }
    });
  }
});

// ─── Vurgu rengi: ornek kare ile uygulanan renk ayni kaynaktan gelmeli ──────
//
// Kusur (10 Eylul 2026): ayarlardaki renk kareleri ELLE yazilmis sabit
// degerlerdi ve her zaman isikli tema degerini gosteriyordu. Koyu tema her
// vurgu secenegini bilincli olarak aciyor (L %50-55 → %68-72), dolayisiyla
// kullanici #1a4a70 karesini secip ≈ #60a7d6 aliyordu. Ustelik ayni liste iki
// dosyada birden kopyalanmisti.
//
// Kareleri elle duzeltmek kusuru kapatmaz, bir sonraki ton degisikligine
// erteler. Cozum tek kaynak: --accent-<ad> degiskenleri. Bu test o tekligi
// kilitliyor — kareye ham bir renk yazan herkes burada durur.
describe('Vurgu rengi — ornek kare uygulanan rengi gosteriyor', () => {
  const SWATCH_DOSYALARI = [
    'client/src/views/settings.jsx',
    'client/src/tweaks.jsx',
  ];

  for (const goreli of SWATCH_DOSYALARI) {
    const icerik = fs.readFileSync(path.join(KOK, goreli), 'utf8');
    // ['navy','...'] bicimindeki ciftleri yakala
    const ciftler = [...icerik.matchAll(/\['(navy|terracotta|sage|slate|indigo|plum)',\s*'([^']+)'\]/g)];

    test(`${goreli}: vurgu kareleri bulundu`, () => {
      assert.equal(
        ciftler.length, 6,
        `alti vurgu secenegi bekleniyordu, ${ciftler.length} bulundu. `
        + 'Liste bicimi degistiyse bu test de guncellenmeli.',
      );
    });

    for (const [, ad, deger] of ciftler) {
      test(`${goreli}: ${ad} karesi degiskenden okuyor`, () => {
        assert.equal(
          deger, `var(--accent-${ad})`,
          `${ad} karesine ham renk yazilmis: "${deger}". Kare degiskeni `
          + `okumali (var(--accent-${ad})), yoksa koyu temada gosterdigi renk `
          + 'ile uygulanan renk ayrisir — 10 Eylul 2026 kusuru aynen geri gelir.',
        );
      });
    }
  }

  const VURGULAR = ['navy', 'terracotta', 'sage', 'slate', 'indigo', 'plum'];

  // Bir tema birden fazla blokta tanimlanabilir (CSS'i konuya gore bolmek
  // mesru). Test duzeni dayatmasin: ayni seciciye ait TUM bloklar birlestirilip
  // bakiliyor.
  function temaGovdesi(secici) {
    const re = new RegExp(`${secici}\\s*\\{([\\s\\S]*?)\\n\\}`, 'g');
    return [...CSS.matchAll(re)].map(m => m[1]).join('\n');
  }

  for (const ad of VURGULAR) {
    test(`--accent-${ad} hem isikli hem koyu temada tanimli`, () => {
      for (const [temaAdi, secici] of [['varsayilan', ':root'], ['dark', '\\[data-theme="dark"\\]']]) {
        assert.match(
          temaGovdesi(secici), new RegExp(`--accent-${ad}:`),
          `--accent-${ad} ${temaAdi} temasinda tanimli degil. Tanimsizsa o `
          + 'temada kare bos ya da yanlis renk gosterir.',
        );
      }
    });
  }

  test('hicbir [data-accent] blogu --accent\'e ham renk yazmiyor', () => {
    const satirlar = CSS.split('\n').filter(s => /^\[data-(accent|theme)[^\n]*--accent:/.test(s));
    assert.ok(satirlar.length >= 6, 'vurgu bloklari bulunamadi');
    for (const satir of satirlar) {
      const m = satir.match(/--accent:\s*([^;]+);/);
      if (!m) continue;
      assert.match(
        m[1].trim(), /^var\(--accent-[a-z]+\)$/,
        `Ham renk atanmis: "${m[1].trim()}"\n  ${satir.slice(0, 90)}\n`
        + '  --accent daima var(--accent-<ad>) okumali; ornek kareler de ayni '
        + 'degiskeni okuyor ve ancak boyle ayrisamazlar.',
      );
    }
  });
});

// ── Sohbet perdesi, karartmasi gereken seyin uzerinde olmali (kart #194) ───
//
// KUSUR (17 Eylul 2026, mobil saha turu): dar ekranda sohbet paneli donuk gri
// goruluyordu. Perde panelin KENDI `::before`'uydu ve amacinin tam tersini
// yapiyordu -- arka plani degil PANELI karartiyordu.
//
// Sebep tek ozellik: panel acikken transform tasiyor. Transform iki sey birden
// yapar: (1) yigilma baglami acar, yani negatif z-index panelden DISARI
// cikamaz; (2) sabit konumlu torunlar icin kapsayici blok olur, yani tam ekran
// kaplama ekrani degil PANELI kaplar. Ikisi birlesince perde yanlis tarafa
// dusuyordu. Mesaj balonlarinin net kalmasi teshisin kanitiydi: kendi opak
// arka planlari var ve perdeden SONRA boyaniyorlar.
//
// Kural CSS'te ifade edilemedigi icin merdivenin bir ust basamagina tasindi.
describe('Sohbet perdesi — transform tasiyan elemanin icinde degil (kart #194)', () => {
  // YORUMLAR ONCE BOSALTILIYOR -- bu testin ilk yazimi tam da bu yuzden yanlis
  // alarm verdi: styles.css'teki kusuru ANLATAN yorum, yasakli metnin
  // kendisini ("position: fixed", ".chat-panel ... ::before") iceriyor ve
  // tarama onu kod sandi. 11 Eylul'deki tuzagin CSS'teki kardesi (CLAUDE.md).
  // Silinmiyor, BOSLUGA cevriliyor: konumlar ve satir numaralari korunuyor.
  const CSS_KOD = CSS.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  /** Bir kuralin govdesi: secicinin gectigi yerden ilk '}' karakterine kadar.
   *  Ic ice parantezli secicilerde `[^)]*` kullanilmiyor -- o desen
   *  `:not([data-full-page="true"])` gibi bir seciciyi gecemez (CLAUDE.md). */
  const kuralGovdesi = (secici) => {
    const i = CSS_KOD.indexOf(secici);
    if (i < 0) return null;
    const bas = CSS_KOD.indexOf('{', i);
    const son = CSS_KOD.indexOf('}', bas);
    return bas < 0 || son < 0 ? null : CSS_KOD.slice(bas + 1, son);
  };

  test('perde panelin sozde-cocugu degil', () => {
    // Seciciyi satir basindan yakala: `body:has(.chat-panel...)::before`
    // mesru ve o da ".chat-panel" ile "::before" iceriyor. Olcut, seciciye
    // `.chat-panel` ile BASLAYIP `::before` ile bitmesi.
    const kacaklar = [...CSS_KOD.matchAll(/^\s*(\.chat-panel[^{\n]*::before)\s*\{([^}]*)\}/gm)]
      .filter(m => /position:\s*fixed/.test(m[2]))
      .map(m => m[1].trim());
    assert.deepEqual(
      kacaklar, [],
      'Sohbet perdesi yeniden panelin sozde-cocugu olarak yazilmis: '
      + `${kacaklar.join(', ')}\n  Panel transform tasidigi icin perde ne `
      + 'panelden disari cikabilir ne ekrani kaplayabilir; sonuc paneli '
      + 'karartmaktir (kart #194).',
    );
  });

  test('perde body uzerinde ve panelin hemen altinda katmanlanmis', () => {
    const govde = kuralGovdesi('body:has(.chat-panel');
    assert.ok(govde, 'body uzerindeki sohbet perdesi kurali bulunamadi');
    assert.match(govde, /position:\s*fixed/, 'perde ekrana sabitlenmemis');
    assert.match(govde, /inset:\s*0/, 'perde tam ekran degil');

    // Katmanlama iliskisi SAYIYLA kilitleniyor: panelin z-index'i degisip
    // perdeninki ayni kalirsa perde panelin USTUNE cikar ve kusur baska bir
    // yazimla aynen geri gelir. Iliski olculmezse bayatlar.
    const panelGovde = kuralGovdesi('.chat-panel:not([data-full-page="true"])');
    assert.ok(panelGovde, 'kompakt panel kurali bulunamadi');

    const perdeZ = Number((govde.match(/z-index:\s*(-?\d+)/) || [])[1]);
    const panelZ = Number((panelGovde.match(/z-index:\s*(-?\d+)/) || [])[1]);
    assert.ok(Number.isFinite(perdeZ), 'perdenin z-index degeri okunamadi');
    assert.ok(Number.isFinite(panelZ), 'panelin z-index degeri okunamadi');
    assert.ok(
      perdeZ > 0 && perdeZ < panelZ,
      `Perde (z-index ${perdeZ}) panelin (z-index ${panelZ}) ALTINDA ve `
      + 'sayfanin ustunde olmali. Degilse ya paneli karartir ya da arka plani '
      + 'hic karartmaz.',
    );
  });
});

// ── Giris ekrani, tam ekran olmadan da tamamen gorunmeli ───────────────────
//
// KUSUR (17 Eylul 2026, kullanici ekran goruntusu): tarayici tam ekran
// DEGILKEN kayit formunun basligi ustten kesiliyor ve ULASILAMIYORDU. F11
// basinca kayboldugu icin "sikisik gorunuyor" diye okunuyordu; oysa icerigin
// bir kismi gercekten erisilemezdi.
//
// SEBEP `align-items: center`. Bir esnek kapsayicida oge kapsayicidan UZUNSA,
// ortalama tasmayi iki yana ESIT dagitir; uste tasan kisim kaydirmayla
// ulasilamaz, cunku kaydirma yalnizca bitis yonunde calisir. `overflow-y: auto`
// burada yanlis bir guven veriyordu: cubuk vardi ama kesilen yeri acmiyordu.
//
// COZUM `margin: auto` -- otomatik kenar boslugu yalnizca POZITIF bos alani
// emer, alan negatifken sifira iner ve oge basa yaslanir.
//
// Bu kural CSS'te kendini savunamiyor: biri ortalamayi "daha temiz" diye
// `align-items: center`a geri cevirirse hicbir sey patlamaz, yalnizca giris
// ekraninin usttu yine kesilir. O yuzden merdivenin ust basamagina tasindi.
describe('Giris ekrani — ortalama, icerigi erisilemez kilmamali', () => {
  // Yorumlar once bosaltiliyor: bu dosyadaki kusuru ANLATAN yorumlar yasakli
  // metnin kendisini iciyor (`align-items: center`). Ayni tuzak bu turda bir
  // kez dustu (kart #194 taramasi), ikinci kez dusmesin.
  const KOD = CSS.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  const kuralGovdesi = (secici) => {
    const i = KOD.indexOf(secici);
    if (i < 0) return null;
    const bas = KOD.indexOf('{', i);
    const son = KOD.indexOf('}', bas);
    return bas < 0 || son < 0 ? null : KOD.slice(bas + 1, son);
  };

  test('.auth-form-wrap dikey ortalamayi align-items ile yapmiyor', () => {
    const govde = kuralGovdesi('.auth-form-wrap {');
    assert.ok(govde, '.auth-form-wrap kurali bulunamadi');
    assert.doesNotMatch(
      govde, /align-items:\s*center/,
      'Giris formu yeniden `align-items: center` ile ortalanmis. Form '
      + 'goruntu alanindan uzun oldugunda tasmanin usttu KAYDIRILAMAZ olur ve '
      + 'baslik kesilir (kart: F11 olmadan sikisik gorunum). Ortalamayi '
      + '`.auth-form { margin: auto }` yapmali.',
    );
  });

  test('.auth-form otomatik kenar bosluguyla ortalaniyor', () => {
    const govde = kuralGovdesi('.auth-form {');
    assert.ok(govde, '.auth-form kurali bulunamadi');
    assert.match(
      govde, /margin:\s*auto/,
      'Ortalamayi yapan `margin: auto` kaldirilmis; form artik hic '
      + 'ortalanmiyor ya da align-items\'e geri donulmus olabilir.',
    );
  });

  test('tam ekran yuksekligi kullanan auth kurallari dvh yedegi tasiyor', () => {
    // `vh` mobilde adres cubugu acikken en buyuk degeri donduruyor ve alt
    // kisim cubugun altinda kaliyor. Bu dosya `chat-panel`de zaten ikili
    // bildirim kullaniyor; giris ekrani de ayni kalibi izlemeli.
    for (const secici of ['.auth-page {', '.auth-visual {', '.auth-form-wrap {']) {
      const govde = kuralGovdesi(secici);
      assert.ok(govde, `${secici} kurali bulunamadi`);
      if (!/height:\s*100vh/.test(govde)) continue; // yukseklik vermiyorsa konu dis
      assert.match(
        govde, /height:\s*100dvh/,
        `${secici} 100vh veriyor ama 100dvh yedegi yok: mobilde adres cubugu `
        + 'acikken icerigin alti cubugun altinda kalir.',
      );
    }
  });
});

// ─── Balonun içi rengini balondan alır, temadan değil ───────────────────────
//
// KUSUR (kart #229, 17 Eylül 2026, kullanıcı canlıda bildirdi): sohbet
// balonunun İÇİNDEKİ ögeler rengini TEMADAN alıyordu. Karşı tarafın balonunda
// tesadüfen uyuyordu (o balon zaten tema renginde), ama KENDİ balonumuz ters:
//
//   açık tema: zemin `--ink` (koyu),        metin `--bg` (açık)
//   koyu tema: zemin `--accent` (AÇIK mavi), metin `--bg` (koyu)
//
// İki temada zemin TERS yöne dönüyor. Temadan beslenen her öge bu yüzden
// birinde mutlaka ters düşüyordu.
//
// ELLE YAZILMIŞ OVERRIDE'LAR SORUNU ÇÖZMÜYORDU, ERTELİYORDU. Beş tanesi vardı
// ve ikisi ÖLÇÜLDÜĞÜNDE YANLIŞ ÇIKTI:
//   - yanıt önizlemesi `white` ile karışıyordu -> koyu temada açık mavi zeminde
//     beyazımsı metin, okunmuyordu
//   - `md-code-inline` sabit siyahtı -> açık temada koyu balonda siyah üstüne
//     siyah
// Yani kural "biri fark edince yamanır" olduğu sürece, fark edilmeyen her öge
// sessizce ters kalıyor. Kullanıcının dediği gibi: bu aile yetim kalmış.
//
// YAPISAL CEVAP: `currentColor`. Balon `color` tanımlıyor ve o değer zaten
// temadan geliyor; içerideki öge onu miras alırsa hem temaya hem balona
// kendiliğinden uyar. İki soru tek mekanizmayla kapanır.

describe('sohbet balonunun içi rengini balondan alıyor', () => {
  // Balonun İÇİNDEKİ ögeler: seçici `.chat-bubble X` ya da `.chat-msg.mine X`
  // biçiminde bir TORUN hedefliyor. Balonun kendisi hariç — o, yüzeyin ta
  // kendisi ve rengini temadan almalı.
  // İkinci yol gerekiyor, çünkü tek yol yetmiyor: balonun içinde render
  // edilen bazı sınıfların seçicisi BALONA BAĞLI DEĞİL.
  //
  // Mutasyon turunda ortaya çıktı: `.comment-mention` çıplak bir sınıf (hem
  // sohbet balonunda hem kart yorumlarında kullanılıyor), yani seçicisinde
  // "balon" geçmiyor. Yalnızca seçiciye bakan tarama onu göremiyordu ve çipi
  // `var(--accent)` + `white` hâline geri döndüren mutasyon KAÇTI. Bir kuralın
  // nerede uygulandığı, seçicisinden okunamıyor.
  const BALON_ICI_SINIFLAR = [
    'comment-mention',   // @bahsetme çipi; kart yorumlarında da kullanılıyor
    'chat-file-attach',  // dosya eki kartı
    'chat-bubble-text',  // medya mesajının altındaki metin
  ];

  const ICERIDE = /\.chat-(?:bubble|msg\.mine)\b[^,{]*\s+\.[\w-]+/;
  const BUBBLE_KENDISI = /\.chat-bubble\s*(?:,|\{|$)/;

  // Temaya ya da sabit bir renge bağlanmak: balonun zeminini bilmeden renk
  // seçmek demek.
  const TEMADAN = /(?:background|color|border(?:-color)?)\s*:[^;]*(?:var\(--(?:bg|ink|line|accent)[\w-]*\)|#[0-9a-fA-F]{3,8}\b|\bwhite\b|\bblack\b|oklch\(\s*0%)/;

  function kurallar() {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(CSS)) !== null) {
      const secici = m[1].trim().replace(/\s+/g, ' ');
      if (!secici || secici.startsWith('@')) continue;
      out.push({ secici, govde: m[2] });
    }
    return out;
  }

  function balonIci(k) {
    if (ICERIDE.test(k.secici) && !BUBBLE_KENDISI.test(k.secici)) return true;
    return BALON_ICI_SINIFLAR.some((c) => new RegExp(`\\.${c}\\b`).test(k.secici));
  }

  function suclular() {
    return kurallar()
      .filter(balonIci)
      .filter((k) => TEMADAN.test(k.govde))
      .map((k) => `${k.secici} -> ${(k.govde.match(TEMADAN) || [''])[0].trim()}`);
  }

  test('balon içindeki hiçbir öge rengini temadan ya da sabitten almıyor', () => {
    assert.deepEqual(
      suclular(), [],
      'Balonun içindeki bir öge rengini temadan (ya da sabit bir değerden) alıyor. '
      + 'Kendi balonumuzun zemini İKİ TEMADA TERS YÖNE dönüyor, o yüzden temadan '
      + 'beslenen her öge birinde mutlaka ters düşer. `currentColor` kullan: '
      + 'balon `color` tanımlıyor ve o değer zaten temadan geliyor.',
    );
  });

  test('tarama gerçekten balon içi kural buluyor (kör değil)', () => {
    // İlk test "hiç eşleşme yok" hâlinde de yeşil kalırdı. Bu depoda üç tarama
    // testi ilk hâlinde tam olarak böyleydi.
    const iceridekiler = kurallar().filter(
      (k) => ICERIDE.test(k.secici) && !BUBBLE_KENDISI.test(k.secici),
    );
    assert.ok(
      iceridekiler.length >= 4,
      `yalnızca ${iceridekiler.length} balon içi kural bulundu — seçici deseni bozuk`,
    );
  });

  test('listede hayalet sınıf yok — liste bayatlamasın', () => {
    // Ters yön: listedeki bir sınıf artık balonun içinde render edilmiyorsa
    // listeden çıkmalı, yoksa liste bir gün gerçeği anlatmaz olur.
    const jsx = fs.readFileSync(path.join(KOK, 'client', 'src', 'chat.jsx'), 'utf8');
    const hayaletler = BALON_ICI_SINIFLAR.filter((c) => !jsx.includes(c));
    assert.deepEqual(hayaletler, [], 'Bu sınıflar chat.jsx\'te yok; listeden çıkar.');
  });

  test('balonun KENDİSİ temadan besleniyor — tarama onu suçlamıyor', () => {
    // NEGATİF DURUM, bilerek sınanıyor. Balon yüzeyin kendisi; rengini temadan
    // ALMALI. Kural ikisini karıştırırsa düzeltilmesi yanlış olan yeri bozmaya
    // zorlar.
    const balon = kurallar().find((k) => k.secici === '.chat-msg.mine .chat-bubble');
    assert.ok(balon, 'kendi balonumuzun kuralı bulunamadı');
    assert.ok(/var\(--ink\)/.test(balon.govde), 'balon zemini temadan gelmiyor');
    assert.ok(!suclular().some((x) => x.startsWith('.chat-msg.mine .chat-bubble ->')),
      'tarama balonun kendisini suçluyor — kural fazla geniş');
  });

  test('sohbet mesajı SATIR İÇİ renk stili taşımıyor', () => {
    // KÖR NOKTA, mutasyon turunda bulundu. Bahsetme çipi CSS'te değil,
    // chat.jsx'te satır içi stildeydi:
    //     style: { background: 'var(--accent)', color: 'white' }
    // Yukarıdaki taramaların HİÇBİRİ onu göremezdi — hepsi styles.css okuyor.
    // Çip sınıfa taşındı; bu test satır içi rengin geri gelmesini yasaklıyor.
    // Yalnızca RENK yasak: cursor, display gibi dinamik stiller serbest.
    const jsx = fs.readFileSync(path.join(KOK, 'client', 'src', 'chat.jsx'), 'utf8');
    const suclu = [...jsx.matchAll(/style:s*{[^}]*}/g)]
      .map((m) => m[0])
      .filter((x) => /(?:background|borderColor|(?<!font)[cC]olor)s*:/.test(x))
      .map((x) => x.replace(/s+/g, ' ').slice(0, 80));
    assert.deepEqual(suclu, [],
      'Sohbette satır içi renk stili var. CSS tarayan testler onu göremez; '
      + 'sınıfa taşı ki balon rengini miras alsın ve denetlenebilsin.');
  });
});
