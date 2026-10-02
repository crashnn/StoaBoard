// Kalıcı kayda ve yanıta GÖRÜNTÜ METNİ yazmak (kart #331).
//
// ORTAK KALIP: görüntülenecek metni saklamak, referansı değil. Saklanan metin
// yazıldığı andaki adı ve DİLİ donduruyor; okuma anında çözülmesi gereken şey
// yazma anında çözülüyor.
//
// ÖLÇÜLEN KUSUR (2 Ekim 2026, Playwright turu): `routes/tasks.js` etkinlik
// gövdesine `col: newCol.titleTr || newCol.title` yazıyordu. Şablon
// çevriliyor (`activity_task_moved`) ama içine konan değer çevrilmiyor —
// İngilizce arayüzde ana sayfadaki akış "moved X to İncelemede" diyordu ve
// #288'in istemci düzeltmesi (`kolonAdi`) oraya yetişemiyordu. İkinci yer
// `routes/notes.js`: iki uç `col_title: r.column?.titleTr` döndürüyordu, yani
// sunucu okuyanın dilini bilmeden Türkçe başlığı seçiyordu.
//
// İRONİ, kartta da yazılı: `tasks.js`te aynı kural otuz satır yukarıda DOĞRU
// uygulanıyor (409 mesajı `reqLang(req)` ile kuruluyor) ve gerekçesi yorumda.
// Kural dosyanın içinde biliniyordu, otuz satır sonra unutulmuştu. CLAUDE.md:
// "dil kuralı belgede yazılıydı ve 31 yerde ihlal edildi."
//
// ━━ KURALIN KAPSAMI BİLİNÇLİ OLARAK DARALTILDI ━━
//
// Kart "kolon, proje ve kullanıcı ADI girmesin" diyordu. Uygulanan kural
// yalnızca DİL donmasını yasaklıyor; AD donmasını yasaklamıyor. Fark:
//
//   DİL donması (yasak): kolonun iki başlığı var (`title` / `titleTr`) ve
//   hangisinin doğru olduğu OKUYANA göre değişir. Sunucu seçerse yanlış
//   seçmiş olur — okuyanın dilini bilmiyor. Çözümü var ve bedelsiz: iki
//   başlığı birlikte gönder, dili istemcideki tek okuyucu (`kolonAdi`)
//   seçsin.
//
//   AD donması (yasak değil): `who: user.name`, `channel: full.name`,
//   `workspace: ws.name`. Bunların tek bir doğru karşılığı var ve dile göre
//   değişmiyor; yalnızca sonradan DEĞİŞEBİLİR. Okuma anında çözmek burada
//   daha kötü olabilir: bildirim, okuyanın GÖREMEDİĞİ bir varlıktan söz
//   edebiliyor ("şu alana kabul edildin", "şu kanala eklendin") ve referans
//   çözülemezse ad bugün dolu olan yerde YARIN BOŞ çıkar. Yani kuralı oraya
//   genişletmek görünür bir gerileme üretirdi.
//
// Yeniden adlandırma donması bir gün sorun olursa çözüm alan alan ve
// "okuyan o varlığı görebiliyor mu" sorusu cevaplandıktan sonra. O karar bu
// kartta verilmedi; verilmediği buraya yazıldı ki bir sonraki oturum
// "kart name'i de yasaklıyordu" diye yarım bir iş yapmasın.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';
import { etkinlikMetni } from '../../client/src/bildirimMetni.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const ROUTES = path.join(SRC, 'routes');

// Kolon nesnelerinin bu depodaki adları. Ölçüt bunların görüntü alanlarını
// okumayı yasaklıyor; `slug` serbest, çünkü referans odur.
const KOLON_DEGISKENI = /\b(?:newCol|col|column|fromCol|toCol|moveToCol|moveFromCol)\??\.(?:title|titleTr)\b/;

describe('kalıcı gövdeye kolon ADI yazılmıyor (#331)', () => {
  // Bütün `buildNotificationText(` çağrıları — gövde veritabanında saklanıyor
  // ve aylar sonra okunuyor.
  const cagrilar = [];
  for (const dosya of kaynakDosyalari(SRC, /\.js$/)) {
    const src = yorumsuzDosya(dosya);
    let i = src.indexOf('buildNotificationText(');
    while (i !== -1) {
      // Çağrının KENDİ parantezi: dosya geneline bakmak komşudan ödünç
      // almak olurdu (17 Eylül'de dört kez düşülen sınıf).
      const bas = src.indexOf('(', i);
      let derinlik = 0;
      let son = bas;
      for (; son < src.length; son += 1) {
        if (src[son] === '(') derinlik += 1;
        else if (src[son] === ')') { derinlik -= 1; if (derinlik === 0) break; }
      }
      cagrilar.push({
        dosya: path.relative(SRC, dosya).replace(/\\/g, '/'),
        metin: src.slice(bas, son + 1),
      });
      i = src.indexOf('buildNotificationText(', son);
    }
  }

  test('tarama gerçekten çağrı buluyor', () => {
    // Desen bozulup hiçbir şey bulmazsa aşağıdaki ölçüt bedava geçerdi.
    // Tanım satırının kendisi de eşleşiyor, o yüzden eşik ondan yüksek.
    assert.ok(cagrilar.length >= 10,
      `yalnızca ${cagrilar.length} çağrı bulundu — desen bozulmuş olabilir`);
  });

  for (const c of cagrilar) {
    test(`${c.dosya}: ${c.metin.slice(0, 48).replace(/\s+/g, ' ')}…`, () => {
      assert.doesNotMatch(c.metin, KOLON_DEGISKENI,
        'kalıcı gövdeye kolonun GÖRÜNEN ADI yazılıyor — yazıldığı andaki dili '
        + 'dondurur ve okuyan başka dildeyse yanlış kalır. Slug yaz, adı '
        + 'okuma anında çözülsün (istemcide kolonAdi).');
      assert.doesNotMatch(c.metin, /\btitle_tr\b/,
        'kalıcı gövdeye iki dilli başlık alanı yazılıyor');
    });
  }

  test('taşıma etkinliği kolonun SLUG\'ını yazıyor', () => {
    // Olumsuz ölçüt tek başına yetmez: `col` alanını tamamen silmek de
    // yasağı geçerdi ve şablondaki {col} boş kalırdı.
    const src = yorumsuzDosya(path.join(ROUTES, 'tasks.js'));
    const bas = src.indexOf("buildNotificationText('task_moved'");
    assert.ok(bas > 0, 'taşıma etkinliği bulunamadı');
    const cagri = src.slice(bas, src.indexOf('});', bas));
    assert.match(cagri, /col: newCol\.slug/, 'taşıma etkinliğinde kolon slug\'ı yok');
  });
});

describe('yanıtta kolon adı OKUMA anında çözülüyor (#331)', () => {
  // `titleTr` bir route dosyasında yalnızca iki yerde geçebilir: Prisma
  // `select` cümlesinde (veriyi çekmek) ya da aşağıdaki gerekçeli
  // muafiyette. Üçüncü bir yer, sunucunun okuyanın yerine dil seçmesidir.
  const MUAF = {
    'tasks.js|const ad = (c) => (lang === \'en\' ? (c.title || c.titleTr) : (c.titleTr || c.title));':
      'Kolon geçiş reddinin 409 mesajı. Cümlenin içine kolon ADLARI gömülü '
      + 'olduğu için istemcide çevrilemiyor; bu yüzden cümle sunucuda, '
      + 'isteğin dilinde kuruluyor (`reqLang(req)`). Yani dil YİNE okuma '
      + 'anında seçiliyor — kuralın ihlali değil, doğru uygulanışı. Bu satır '
      + 'kartın işaret ettiği ironinin kendisi: otuz satır aşağısı yanlıştı.',
  };

  // Aranan şey "titleTr sözcüğü" değil, İKİ BAŞLIKTAN BİRİNİ SEÇME eylemi:
  // yani bir nesneden `.titleTr` OKUMAK. Bu ayrım önemli, çünkü sözcüğün
  // kendisi meşru yerlerde de geçiyor ve ilk yazımda hepsi işaretlendi:
  //
  //   `for (const [slug, title, titleTr, …] of defaults)`  → çıplak ad, yazma
  //   `data: { …, titleTr, … }`                            → kısayol, yazma
  //   `updates.titleTr = data.title_tr`                    → atama HEDEFİ
  //   `column: { select: { slug, title, titleTr } }`        → veri çekme
  //
  // Hiçbiri dil seçmiyor. Seçen şey `X.titleTr` ya da `X?.titleTr` okumasıdır.
  const OKUMA = /(\w+)\??\.titleTr\b/;

  /**
   * KARDEŞ ALAN KALIBI — kuralın onayladığı tek okuma biçimi.
   * Aynı nesneden `title` ve `title_tr` BİRLİKTE gönderiliyorsa dil seçimi
   * sunucuda yapılmıyor, istemciye bırakılıyor (`columnToDict` kalıbı).
   * Ölçüt önek karşılaştırıyor: `title: a.title, title_tr: b.titleTr` gibi
   * karışık bir satır muafiyeti kazanmıyor.
   */
  function kardesKalip(satir) {
    const t = /title:\s*([\w.?]+)\.title\b/.exec(satir);
    const tr = /title_tr:\s*([\w.?]+)\.titleTr\b/.exec(satir);
    return Boolean(t && tr && t[1] === tr[1]);
  }

  const bulgular = [];
  for (const dosya of kaynakDosyalari(ROUTES, /\.js$/)) {
    const src = yorumsuzDosya(dosya);
    const ad = path.basename(dosya);
    for (const satir of src.split('\n')) {
      const t = satir.trim();
      if (!OKUMA.test(t)) continue;
      if (/\.titleTr\s*=[^=]/.test(t)) continue;      // atama hedefi
      if (/select:\s*\{[^}]*titleTr/.test(t)) continue; // veri çekme
      if (kardesKalip(t)) continue;                    // iki başlık birlikte
      bulgular.push({ dosya: ad, satir: t });
    }
  }

  test('tarama gerçekten okuma buluyor', () => {
    // Dedektör bozulup hiçbir şey bulmazsa muafiyet testi de boş geçerdi.
    // Bugün tek okuma 409 mesajındaki (muaf) satır.
    assert.ok(bulgular.length >= 1,
      'hiç `.titleTr` okuması bulunamadı — dedektör bozulmuş olabilir');
  });

  for (const b of bulgular) {
    test(`${b.dosya}: ${b.satir.slice(0, 60)}…`, () => {
      const anahtar = `${b.dosya}|${b.satir}`;
      assert.ok(MUAF[anahtar],
        'route dosyası kolonun Türkçe başlığını OKUYOR. Sunucu okuyanın '
        + 'dilini bilmiyor: iki başlığı birlikte gönder (`columnToDict` '
        + 'kalıbı) ve dili istemcideki `kolonAdi` seçsin. Gerçekten sunucuda '
        + 'kurulması gerekiyorsa (cümlenin içine ad gömülüyorsa) dili '
        + '`reqLang(req)` ile oku ve MUAF listesine GEREKÇESİYLE yaz:\n'
        + `  '${anahtar}'`);
    });
  }

  test('muafiyet listesinde ölü kayıt yok', () => {
    const anahtarlar = new Set(bulgular.map((b) => `${b.dosya}|${b.satir}`));
    for (const k of Object.keys(MUAF)) {
      assert.ok(anahtarlar.has(k), `MUAF listesindeki kayıt artık kaynakta yok: ${k}`);
    }
  });

  test('notes uçları iki başlığı BİRLİKTE gönderiyor', () => {
    // Olumlu ölçüt: yasağı `col_title`ı tamamen silerek de geçebilirdik,
    // o zaman ekranda kolon adı hiç görünmezdi.
    const src = yorumsuzDosya(path.join(ROUTES, 'notes.js'));
    const esler = [...src.matchAll(/col_titles: r\.column\s*\?\s*\{ title: r\.column\.title, title_tr: r\.column\.titleTr \|\| r\.column\.title \}/g)];
    assert.equal(esler.length, 2,
      'iki uç da iki başlığı göndermiyor — biri eski kalıpta kalırsa ekranın yarısı Türkçe donar');
    assert.doesNotMatch(src, /col_title:/, 'tek başlık döndüren eski alan geri gelmiş');
  });
});

describe('etkinlikMetni — ad okuma anında çözülüyor (#331)', () => {
  const ceviri = (k) => (k === 'activity_task_moved' ? 'moved <em>{task}</em> to <strong>{col}</strong>' : null);
  const govde = (col) => JSON.stringify({ type: 'task_moved', task: 'Kart', col });

  test('slug çözücüden geçiyor', () => {
    const cikti = etkinlikMetni(govde('review'), ceviri, (s) => (s === 'review' ? 'In Review' : null));
    assert.match(cikti, /to <strong>In Review<\/strong>/);
  });

  test('ESKİ KAYIT: çözücü tanımazsa değer olduğu gibi kalıyor', () => {
    // Geriye dönük veri taşınmadı (bilinçli). #331 öncesinden kalan satırlar
    // gövdesinde "İncelemede" taşıyor; çözücü onu tanımaz ve metne düşer.
    const cikti = etkinlikMetni(govde('İncelemede'), ceviri, () => null);
    assert.match(cikti, /to <strong>İncelemede<\/strong>/);
  });

  test('çözücü verilmezse davranış değişmiyor', () => {
    const cikti = etkinlikMetni(govde('review'), ceviri);
    assert.match(cikti, /to <strong>review<\/strong>/);
  });

  test('çözülen ad da KAÇIŞLANIYOR', () => {
    // Çözücü kullanıcı tarafından yazılmış bir kolon adı döndürüyor ve çıktı
    // `dangerouslySetInnerHTML` ile basılıyor. Kaçış zincirinin bu yeni
    // parametreyi de kapsadığı ölçülüyor.
    const cikti = etkinlikMetni(govde('x'), ceviri, () => '<img src=x onerror=alert(1)>');
    assert.doesNotMatch(cikti, /<img/);
    assert.match(cikti, /&lt;img/);
  });
});
