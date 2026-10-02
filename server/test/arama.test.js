// Çalışma alanı geneli arama (2 Ekim 2026 taraması, madde A).
//
// KUSUR: komut paleti görev ararken `window.__APP_TASKS__` içinde süzüyordu,
// yani YALNIZCA aktif projenin yüklü kartlarında ve YALNIZCA başlıkta. Üç
// projeli bir alanda "o kartı bir yere yazmıştım" sorusunun cevabı yoktu.
// Yer tutucu ise "Komut, görev veya sayfa ara…" diyordu — 17 Eylül'de aynı
// vaadin yarısı kapatılmış, öteki yarısı açık kalmıştı.
//
// SUNUCUDA YETENEK ZATEN VARDI: MCP'nin `search_tasks` aracı doğru arıyor.
// Eksik olan, arayüze açılmış bir uçtu. Bu yüzden eşleştirici YENİDEN
// YAZILMADI; aynı `aramaEslesir` iki yüzeyi de besliyor. Testin ilk işi bu
// paylaşımı kilitlemek: ikinci bir eşleştirme kuralı doğarsa Türkçe harf
// katlaması bir yüzeyde olup ötekinde olmaz ve fark kimsenin gözüne
// çarpmaz.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { aramaEslesir, katla } from '../src/lib/mcpShape.js';
import { aramaKesiti } from '../src/lib/arama.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'notes.js'));
const PALETTE = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'palette.jsx'));

describe('eşleştirme — başlık VE açıklama, Türkçe harf katlamalı', () => {
  const kart = { title: 'İlker için rapor', desc: 'Aylık özet çıkarılacak' };

  test('başlıkta eşleşiyor', () => {
    assert.equal(aramaEslesir(kart, 'rapor'), true);
  });

  test('AÇIKLAMADA eşleşiyor — eski aramanın göremediği yer', () => {
    assert.equal(aramaEslesir(kart, 'özet'), true);
  });

  test('Türkçe I/İ/ı/i ayrımı aramayı engellemiyor', () => {
    // `toLowerCase()` tek başına "İlker"i "i̇lker" yapar ve "ilker" aramasını
    // kaçırırdı; `toLocaleLowerCase('tr')` ise ters yönde kırar.
    assert.equal(aramaEslesir(kart, 'ilker'), true);
    assert.equal(aramaEslesir(kart, 'İLKER'), true);
    assert.equal(katla('İIıi'), 'iiii');
  });

  test('boş sorgu hiçbir şeyle eşleşmiyor', () => {
    assert.equal(aramaEslesir(kart, ''), false);
    assert.equal(aramaEslesir(kart, '   '), false);
  });
});

describe('aramaKesiti — sonucun NİÇİN çıktığını gösteriyor', () => {
  const uzun = 'Bu kartın açıklaması epey uzun ve aranan kelime tam ortada duruyor, '
    + 'çünkü kullanıcı eşleşmenin nerede olduğunu görmek istiyor.';

  test('eşleşmenin geçtiği yerden kesiyor', () => {
    const k = aramaKesiti(uzun, 'ortada');
    assert.ok(k.includes('ortada'), `kesit eşleşmeyi içermiyor: ${k}`);
    assert.ok(k.length < uzun.length, 'kesit kırpılmamış');
  });

  test('başta eşleşince baştan ediyor, üç nokta koymuyor', () => {
    const k = aramaKesiti(uzun, 'Bu kartın');
    assert.ok(!k.startsWith('…'), `baştan eşleşmede önek var: ${k}`);
  });

  test('açıklamada eşleşme yoksa (başlıkta eşleşmiştir) baştan kesiyor', () => {
    const k = aramaKesiti(uzun, 'hicbiryerdeyok');
    assert.ok(k.startsWith('Bu kartın'), k);
  });

  test('boş açıklama null — çağıran satırı hiç çizmiyor', () => {
    assert.equal(aramaKesiti('', 'a'), null);
    assert.equal(aramaKesiti(null, 'a'), null);
  });

  test('kesit KELİMENİN ORTASINDAN kesmiyor', () => {
    const k = aramaKesiti(uzun, 'Bu kartın');
    assert.ok(/[\s…]$/.test(k) || k === uzun, `kesit kelime ortasında bitiyor: ${k}`);
  });

  test('katlama eşleştiriciyle AYNI — kesit eşleşmeyi gösteriyor', () => {
    // Ayrışsalardı kart listede çıkar ama kesit ilgisiz bir yeri gösterirdi.
    //
    // ÖLÇÜT MUTASYONLA DÜZELTİLDİ: ilk hâli 'İlker raporu hazırladı' metnini
    // kullanıyordu ve eşleşme BAŞTAYDI — katlama kaybolsa da kesit baştan
    // kesildiği için aynı metni taşıyor, test geçiyordu. Eşleşme artık metnin
    // UZAĞINDA: katlama olmazsa kesit oraya hiç ulaşamaz.
    const uzak = 'Bu açıklamanın başı tamamen ilgisiz bir cümleyle doludur ve '
      + 'epeyce uzun sürer, ta ki sonlara doğru İlker adı geçene kadar.';
    const k = aramaKesiti(uzak, 'ilker');
    assert.ok(k.includes('İlker'), `kesit eşleşmeyi göstermiyor: ${k}`);
    assert.ok(k.startsWith('…'), `kesit baştan kesilmiş, eşleşmeye gitmemiş: ${k}`);
  });
});

describe('arama ucu — kapsam ve dürüstlük', () => {
  // Ucun KENDI govdesi. Ilk yazim sondaki `|| NOTES.length` yuzunden dosyanin
  // KALANINI dondurüyordu (arama ucu dosyadaki son `meTasksRouter` rotasi) ve
  // MUTASYON BUNU YAKALADI: `requireAuth` silindiginde test gecmeye devam
  // etti, cunku ilerideki baska bir rotanin `requireAuth`unu goruyordu —
  // CLAUDE.md'deki "komsudan odunc alma" tuzaginin ta kendisi. Sinir artik
  // rotanin kendi kapanisi.
  const uc = () => {
    const bas = NOTES.indexOf("meTasksRouter.get(\n  '/search'");
    assert.ok(bas > 0, 'arama ucu bulunamadı');
    const son = NOTES.indexOf('\n);\n', bas);
    assert.ok(son > bas, 'arama ucunun kapanışı bulunamadı');
    const govde = NOTES.slice(bas, son);
    // Ölçütün kendini koruması: gövde makul uzunlukta olmalı, dosyanın
    // tamamı ya da boş olmamalı.
    assert.ok(govde.length > 200 && govde.length < NOTES.length / 2,
      `uç gövdesi beklenmedik uzunlukta (${govde.length}) — sınır kayması`);
    return govde;
  };

  test('yalnızca kişinin AKTİF ALANINDA arıyor', () => {
    const b = uc();
    assert.match(b, /resolveWorkspaceId\(user\)/, 'alan çözülmüyor');
    assert.match(b, /project: \{ workspaceId: wsId \}/, 'sorgu alanla sınırlı değil');
    // Proje kimliği DIŞARIDAN alınmamalı: alınsaydı başka alandaki bir
    // projenin kimliği denenebilirdi (IDOR).
    assert.doesNotMatch(b, /req\.query\.project/, 'proje kimliği dışarıdan alınıyor');
  });

  test('çöptekiler aranmıyor', () => {
    assert.match(uc(), /deletedAt: null/, 'çöpteki kartlar arama sonucuna giriyor');
  });

  test('requireAuth taşıyor', () => {
    assert.match(uc(), /requireAuth/, 'uç kimlik doğrulaması istemiyor');
  });

  test('eşleştirici PAYLAŞILIYOR, yeniden yazılmıyor', () => {
    assert.match(uc(), /aramaEslesir\(/, 'uç ortak eşleştiriciyi kullanmıyor');
    // SQL tarafında arama yapılsaydı Türkçe katlama kaybolurdu.
    assert.doesNotMatch(uc(), /contains:/, 'eşleştirme SQL\'e kaymış — Türkçe harf katlaması kaybolur');
  });

  test('eksik sonuç SESSİZ kalmıyor', () => {
    const b = uc();
    assert.match(b, /truncated: rows\.length >= TARAMA_TAVANI/, 'tarama tavanı kullanıcıya söylenmiyor');
    assert.match(b, /total: eslesen\.length/, 'toplam eşleşme sayısı dönmüyor');
  });

  test('çok kısa sorgu bütün panoyu döndürmüyor', () => {
    assert.match(uc(), /q\.length < 2/, 'tek harf aramasına kapı yok');
  });
});

describe('palet TEK KAYNAKTAN okuyor', () => {
  test('METİN araması yerel listede süzmüyor', () => {
    // İki okuyucu aynı soruya farklı cevap verirse hangisinin doğru olduğu
    // ekrandan anlaşılmaz. Bu depodaki tekrarlayan sınıf.
    //
    // ÖLÇÜT YALNIZCA METİN ARAMASINI YASAKLIYOR, `__APP_TASKS__`i değil.
    // İlk yazımda genel bir yasaktı ve `#193` kart numarası aramasını da
    // kırdı — o yol MEŞRU: önek eşleşmesi için yüklü listeyi kullanıyor ve
    // aktif projede bulamazsa "yine de aç" diyerek kartı sunucudan çekiyor
    // (kendi geri düşüşü var, gerekçesi palette.jsx'te yazılı). Yasak,
    // BAŞLIK METNİNDE süzmeye.
    assert.doesNotMatch(PALETTE, /__APP_TASKS__[\s\S]{0,300}\(t\.title \|\| ''\)\.toLowerCase\(\)\.includes/,
      'palet başlık metnini yerel listede süzüyor — aktif projeyle sınırlı kalır');
  });

  test('sunucu araması çağrılıyor ve geciktiriliyor', () => {
    // Ölçüt ARAMA ETKİSİNİN gövdesine bağlı. İlk hâli dosya genelinde
    // `setTimeout` arıyordu ve MUTASYON YAKALADI: geciktirme kaldırılınca
    // test geçmeye devam etti, çünkü paletin odak veren başka bir
    // `setTimeout`u var — komşudan ödünç alma.
    const bas = PALETTE.indexOf('const sorgu = q.trim();');
    assert.ok(bas > 0, 'arama etkisi bulunamadı');
    const blok = PALETTE.slice(bas, PALETTE.indexOf('const flat =', bas));
    assert.match(blok, /window\.API\?\.gorevAra\?\.\(sorgu\)/, 'arama ucu çağrılmıyor');
    assert.match(blok, /setTimeout\(/, 'her tuşta istek atılıyor — geciktirme yok');
    assert.match(blok, /clearTimeout\(zaman\)/, 'bekleyen istek temizlenmiyor');
  });

  test('YAVAŞ YANIT yenisini EZEMİYOR', () => {
    // İptal bayrağı olmazsa geç gelen geniş arama, sonradan yazılan dar
    // aramanın sonucunu ezer ve kullanıcı yazdığıyla ilgisiz liste görür.
    const bas = PALETTE.indexOf('const sorgu = q.trim();');
    const blok = PALETTE.slice(bas, PALETTE.indexOf('const flat =', bas));
    assert.match(blok, /let iptal = false;/, 'iptal bayrağı yok');
    assert.match(blok, /if \(iptal\) return;/, 'yanıt iptal edilmişken de uygulanıyor');
    assert.match(blok, /return \(\) => \{ iptal = true;/, 'temizleme iptal etmiyor');
  });

  test('arama ÇALIŞMIYORSA kullanıcıya söyleniyor', () => {
    // Sessizce boş liste, "sonuç yok" ile "arayamadım"ı aynı şey yapardı.
    assert.match(PALETTE, /palette_search_failed/, 'hata durumu kullanıcıya gösterilmiyor');
    assert.match(PALETTE, /setAramaHatasi\(true\)/, 'hata durumu tutulmuyor');
  });

  test('sonuç satırı HANGİ PROJEDE olduğunu yazıyor', () => {
    // Sonuçlar artık başka projelerden de gelebiliyor; proje adı olmadan
    // liste "bu kart nerede" sorusunu cevaplamaz.
    assert.match(PALETTE, /t\.project_name/, 'sonuçta proje adı gösterilmiyor');
  });
});

// ─── Sorgu ŞEMAYLA uyuşuyor mu ─────────────────────────────────────────────
//
// BU ÖLÇÜT BİR CANLI KUSURDAN DOĞDU (2 Ekim 2026). Arama ucunun ilk hâli
// `orderBy: { updatedAt: 'desc' }` ve `select: { desc: true }` yazıyordu.
// Task modelinde `updatedAt` YOK ve açıklama alanının adı `description` —
// `desc` yalnızca API yanıtındaki ad. Sorgu canlıda patladı ve palet "arama
// çalışmıyor" dedi.
//
// YUKARIDAKİ YİRMİ BİR ÖLÇÜT BUNU GÖREMEDİ, çünkü hepsi kaynağın METNİNİ
// tarıyor; hiçbiri sorguyu ÇALIŞTIRMIYOR. Veritabanı isteyen bir test de
// `npm test`in sözleşmesini bozardı ("veritabanı gerektirmez"). Aradaki yol:
// sorgudaki alan adlarını ŞEMADAN okunan gerçek alanlarla karşılaştırmak —
// veritabanı olmadan, ama metin eşleştirmesinden fazlası.

describe('arama sorgusu şemadaki alanları kullanıyor', () => {
  const SEMA = yorumsuzDosya(path.resolve(__dirname, '..', 'prisma', 'schema.prisma'));

  /** `model Task { ... }` içindeki alan adları. */
  const taskAlanlari = () => {
    const bas = SEMA.indexOf('model Task {');
    assert.ok(bas > 0, 'Task modeli bulunamadı');
    const govde = SEMA.slice(bas, SEMA.indexOf('\n}', bas));
    return new Set([...govde.matchAll(/^\s{2}(\w+)\s+\w/gm)].map((m) => m[1]));
  };

  const aramaUcu = () => {
    const bas = NOTES.indexOf("meTasksRouter.get(\n  '/search'");
    return NOTES.slice(bas, NOTES.indexOf('\n);\n', bas));
  };

  test('şema okuması gerçekten alan buluyor', () => {
    const alanlar = taskAlanlari();
    assert.ok(alanlar.has('title') && alanlar.has('description') && alanlar.has('deletedAt'),
      `Task alanları okunamadı: ${[...alanlar].slice(0, 8)}`);
    assert.ok(!alanlar.has('updatedAt'),
      'Task artık updatedAt taşıyor — ölçütün dayandığı olgu değişmiş, gözden geçir');
  });

  test('select ve orderBy ŞEMADA VAR OLAN alanları kullanıyor', () => {
    const alanlar = taskAlanlari();
    const uc = aramaUcu();
    const secim = uc.slice(uc.indexOf('select: {'), uc.indexOf('\n    });', uc.indexOf('select: {')));
    // Üst düzey alanlar: `project` ve `column` ilişkileri de şemada var.
    const kullanilan = [...secim.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]);
    assert.ok(kullanilan.length >= 4, `select beklenenden dar: ${kullanilan}`);
    for (const ad of kullanilan) {
      assert.ok(alanlar.has(ad), `select'te şemada OLMAYAN alan: ${ad}`);
    }
    const sira = /orderBy: \{ (\w+):/.exec(uc);
    assert.ok(sira, 'orderBy bulunamadı');
    assert.ok(alanlar.has(sira[1]), `orderBy şemada OLMAYAN alanı kullanıyor: ${sira[1]}`);
  });

  test('açıklama ŞEMA ADIYLA okunuyor, API adıyla değil', () => {
    const uc = aramaUcu();
    assert.match(uc, /desc: r\.description/, 'eşleştiriciye açıklama yanlış alandan veriliyor');
    assert.doesNotMatch(uc, /r\.desc\b/, '`r.desc` diye bir alan yok — undefined gelir, açıklama hiç aranmaz');
  });
});
