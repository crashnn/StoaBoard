// Kart açıklamasının paragraflara ayrılması.
//
// KUSUR (17 Eylül 2026, kullanıcı): "kartta açıklama girince çok karmaşık
// görünüyor... sen işlerken nasıl nizami yazmışsın, okunur formatta ancak karta
// işlenince text area olur da rastgele yazarsın, bir nizam yoktur."
//
// Ölçüldü ve haklıydı. Sebep şaşırtıcı: metnin YAPISI KAYITTA VARDI, ekranda
// yoktu. `drawer.jsx` açıklamanın tamamını tek bir `p` bloğuna koyuyordu ve
// HTML'de `\n` boşluğa çöktüğü için başlıklar, madde imleri ve ayraçlar tek
// paragrafa akıyordu. MCP ile yazılmış uzun kart açıklamaları okunamaz
// hâldeydi. Veri hiç bozulmamıştı; kayıp yalnızca çizimdeydi.
//
// Düzeltme İKİ parçalı ve ikisi farklı şeyi kurtarıyor:
//   1) `belge.js` — boş satır PARAGRAF sınırıdır, ayrı bloklara ayrılır
//   2) `styles.css` `white-space: pre-wrap` — blok İÇİNDEKİ tek satır sonları
// Yalnızca biri yapılırsa yarım kalır, o yüzden ikisi de kilitleniyor.
//
// Kural `drawer.jsx`ten AYRI bir modülde (`belge.js`) duruyor çünkü saf: girdi
// düz metin, çıktı paragraf dizisi, React yok. Depoda bu kalıp var
// (`rozet.js`, `bildirimMetni.js`) ve sunucu testleri onları doğrudan içe
// aktarıyor — kaynak taramak yerine DAVRANIŞ ölçülebilsin diye.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { paragraflaraBol } from '../../client/src/belge.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('paragraflaraBol — boş satır paragraf sınırı', () => {
  test('boş satır paragrafları ayırıyor', () => {
    assert.deepEqual(paragraflaraBol('bir\n\niki\n\nüç'), ['bir', 'iki', 'üç']);
  });

  test('TEK satır sonu paragrafı BÖLMÜYOR — liste bütün kalıyor', () => {
    // Kusurun diğer yarısı burada. Madde imi listesi tek satır sonlarıyla
    // yazılıyor; her satırı ayrı paragraf yapmak listeyi dağıtır ve aradaki
    // tipografik boşluk onu listeye değil kopuk cümlelere benzetir.
    // Satır sonları paragrafın İÇİNDE kalıyor, CSS onları gösteriyor.
    const liste = '• ana ekranda simge → PWA yeter\n• kapalıyken bildirim → PWA\n• mağaza → sarmalayıcı';
    assert.deepEqual(paragraflaraBol(liste), [liste]);
  });

  test('kullanıcının gerçek durumu: başlık + liste + paragraf', () => {
    const metin = [
      'ÖNCE SORULMASI GEREKEN: "app" ile ne kazanmak isteniyor?',
      '',
      '• ana ekranda simge → PWA yeter',
      '• mağazada görünmek → sarmalayıcı şart',
      '',
      '━━━ ÜÇ YOL ━━━',
      '',
      '1) PWA — bugünkü kodun üstüne',
    ].join('\n');
    const p = paragraflaraBol(metin);
    assert.equal(p.length, 4, 'dört paragraf bekleniyordu');
    assert.ok(p[1].includes('\n'), 'liste tek paragrafta ve satır sonları duruyor');
    assert.equal(p[2], '━━━ ÜÇ YOL ━━━');
  });

  test('CRLF de bölünüyor — açıklama üç ayrı kaynaktan geliyor', () => {
    // MCP, tarayıcı ve içe aktarma aynı satır sonunu kullanmıyor. `\r\n`
    // bölünmeden geçerse sınır bulunamaz ve metin yine tek paragrafa düşer,
    // yani kusur Windows'tan yazılmış her açıklamada aynen sürerdi.
    assert.deepEqual(paragraflaraBol('bir\r\n\r\niki'), ['bir', 'iki']);
  });

  test('TEK bir CRLF paragraf BÖLMÜYOR — \\r\\n bir satır sonudur, iki değil', () => {
    // BU TESTİ MUTASYON YAZDIRDI. Yukarıdaki CRLF testi `\r\n` → `\n`
    // dönüşümünü ölçtüğünü sanıyordu ama ölçmüyordu: bir alt satırdaki
    // `\r` → `\n` dönüşümü onu örtüyor. O dönüşüm tek başına `\r\n`yi `\n\n`
    // yapar, yani TEK bir Windows satır sonunu PARAGRAF SINIRINA çevirir.
    // İki boş satırlık girdide sonuç tesadüfen aynı çıktığı için mutasyon
    // kaçtı.
    //
    // Ölçüt artık ayırt edici: CRLF ile yazılmış bir madde imi listesi tek
    // paragraf kalmalı. Windows'tan yapıştırılan her liste bu satıra bağlı.
    assert.deepEqual(paragraflaraBol('• bir\r\n• iki'), ['• bir\n• iki']);
  });

  test('boş satırdaki boşluk/sekme sınırı bozmuyor', () => {
    // Elle yazılmış metinlerde "boş" satır çoğu zaman boşluk taşıyor.
    assert.deepEqual(paragraflaraBol('bir\n   \niki'), ['bir', 'iki']);
    assert.deepEqual(paragraflaraBol('bir\n\t\niki'), ['bir', 'iki']);
  });

  test('üç ve daha fazla boş satır tek sınır sayılıyor — boş paragraf üretilmiyor', () => {
    assert.deepEqual(paragraflaraBol('bir\n\n\n\niki'), ['bir', 'iki']);
  });

  test('BAŞTAKİ girinti korunuyor, sondaki boşluk siliniyor', () => {
    // Girinti yazarın kararı: kartlara SQL ve kod parçaları yazılıyor ve
    // `pre-wrap` onları girintili gösteriyor. İki ucu birden kırpmak o
    // blokları sola yapıştırırdı.
    const p = paragraflaraBol('    UPDATE notifications SET read = false;   ');
    assert.deepEqual(p, ['    UPDATE notifications SET read = false;']);
  });

  test('boş ve tanımsız girdi boş dizi — çağıran yerde dal gerekmiyor', () => {
    assert.deepEqual(paragraflaraBol(''), []);
    assert.deepEqual(paragraflaraBol(null), []);
    assert.deepEqual(paragraflaraBol(undefined), []);
    assert.deepEqual(paragraflaraBol('   \n\n  '), []);
  });

  test('boş satırsız metin tek paragraf — eski davranışla aynı', () => {
    // Geriye dönük uyum: kısa açıklamalar bugüne kadar tek blok olarak
    // çiziliyordu ve öyle kalmalı.
    assert.deepEqual(paragraflaraBol('Tek satırlık açıklama'), ['Tek satırlık açıklama']);
  });
});

describe('açıklama çizimi — iki parçanın ikisi de bağlı', () => {
  test('`drawer.jsx` saf bölücüyü kullanıyor, kendi kopyasını değil', () => {
    // Ölçüt `_basicDoc` bloğuna bağlı, dosya geneline değil: `belge.js`
    // içe aktarılmış olması onu bu fonksiyonun KULLANDIĞINI göstermez.
    const src = fs.readFileSync(path.join(KOK, 'client', 'src', 'drawer.jsx'), 'utf8');
    const bas = src.indexOf('function _basicDoc');
    assert.notEqual(bas, -1, '_basicDoc bulunamadı');
    const blok = src.slice(bas, src.indexOf('\n}', bas));
    assert.ok(/paragraflaraBol\(task\.desc\)/.test(blok),
      'açıklama hâlâ tek parça yazılıyor — satır sonları ekranda kaybolur');
  });

  test('CSS blok içi satır sonlarını koruyor', () => {
    // İkinci yarı. Paragraflara bölmek tek başına yetmiyor: bir paragrafın
    // İÇİNDEKİ satır sonları (madde imleri) `pre-wrap` olmadan yine çöker.
    const css = fs.readFileSync(path.join(KOK, 'client', 'src', 'styles.css'), 'utf8');
    const bas = css.indexOf('.doc-block p');
    assert.notEqual(bas, -1, '.doc-block p kuralı yok');
    const blok = css.slice(bas, css.indexOf('}', bas));
    assert.ok(/white-space:\s*pre-wrap/.test(blok),
      'doc bloklarında satır sonu korunmuyor — liste tek satıra akar');
    assert.ok(/overflow-wrap:\s*break-word|overflow-wrap:\s*anywhere/.test(blok),
      'uzun boşluksuz dize (URL, kimlik) kabı taşırır');
  });
});
