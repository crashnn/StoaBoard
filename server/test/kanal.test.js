// Sohbet kanalı — görünen ad tek kaynaktan (kart #249).
//
// KUSUR (18 Eylül 2026, kullanıcının ekran görüntüsü): "AI İletişim Kanalı -
// Köprü" açıkken boş durum "Send the first message to the general channel.",
// yazma kutusu "Write to #general..." diyordu. chat.jsx DM olmayan HER kanal
// için sabit bir "genel kanal" metni kullanıyordu; kanal adı hiç okunmuyordu.
// Başlık doğru adı gösterdiği için ekran kendi içinde çelişiyordu.
//
// Metin iki bileşen dalında (panel + tam sayfa) ikişer kez geçiyor. Test her
// KOPYAYI ayrı ayrı ölçüyor: "dosyada en az bir doğru kullanım var" ölçütü,
// bir kopyanın eski hâlinde kalmasını kaçırırdı.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');
const CHAT = yorumsuzDosya(path.join(ISTEMCI, 'chat.jsx'));
const DATA = yorumsuzDosya(path.join(ISTEMCI, 'data.jsx'));

/** `bas`ın her geçişinden itibaren `son`a kadar olan parçalar. */
const kopyalar = (src, bas, son) => {
  const out = [];
  for (let i = src.indexOf(bas); i !== -1; i = src.indexOf(bas, i + 1)) {
    const j = src.indexOf(son, i + bas.length);
    out.push(src.slice(i, j === -1 ? undefined : j));
  }
  return out;
};

// Kanal adını fonksiyonla yerleştiren çağrı. Düz metin (`, kanalAdi)`)
// kabul edilmiyor: String.replace ikinci argüman metinse `$&` gibi dizileri
// özel yorumlar ve adında `$` geçen kanal bozulur.
const YERLESTIR = /\.replace\('\{kanal\}', \(\) => kanalAdi\)/;

describe('sohbet — kanal adı boş durum ve yazma kutusunda (#249)', () => {
  test('görünen ad tek yerde kuruluyor ve başlık da onu okuyor', () => {
    assert.match(CHAT, /const kanalAdi = _findCh\(activeChannel\)\?\.name \|\| activeChannel \|\| 'genel';/,
      'kanalAdi tanımı yok ya da açık kanaldan okunmuyor');
    assert.doesNotMatch(CHAT, /\{\(_findCh\(activeChannel\)\?\.name\) \|\| activeChannel/,
      'başlık adı yine kendisi kuruyor — aynı olgunun ikinci okuyucusu');
  });

  test('her boş durum kopyası kanal adını kullanıyor', () => {
    // Mesaj listesinin boş durumu; yıldızlı/sabitli/üye boş durumları da
    // chat-empty sınıfını taşıyor, çapa onlara kaymasın.
    const bloklar = kopyalar(CHAT, '{messages.length === 0 && (', '</div>');
    assert.equal(bloklar.length, 2, `boş durum kopya sayısı ${bloklar.length} — panel ve tam sayfa bekleniyor`);
    for (const [i, b] of bloklar.entries()) {
      assert.match(b, /window\.t\?\.\('chat_channel_first'\)/, `boş durum #${i + 1} kanal anahtarını kullanmıyor`);
      assert.match(b, YERLESTIR, `boş durum #${i + 1} kanal adını yerleştirmiyor`);
    }
  });

  test('her yazma kutusu kopyası kanal adını kullanıyor', () => {
    const satirlar = kopyalar(CHAT, 'placeholder={pendingFile ?', '\n');
    assert.equal(satirlar.length, 2, `yazma kutusu kopya sayısı ${satirlar.length} — panel ve tam sayfa bekleniyor`);
    for (const [i, s] of satirlar.entries()) {
      assert.match(s, /window\.t\?\.\('chat_write_channel'\)/, `yazma kutusu #${i + 1} kanal anahtarını kullanmıyor`);
      assert.match(s, YERLESTIR, `yazma kutusu #${i + 1} kanal adını yerleştirmiyor`);
    }
  });

  test('sabit "genel kanal" anahtarları kalktı', () => {
    for (const eski of ['chat_general_first', 'chat_write_general']) {
      assert.ok(!CHAT.includes(eski), `chat.jsx hâlâ ${eski} kullanıyor`);
      assert.ok(!DATA.includes(eski), `data.jsx hâlâ ${eski} taşıyor — ölü anahtar`);
    }
  });

  test('iki dilde de metin kanal adını taşıyor', () => {
    // Anahtar eşliğini dil.test.js ölçüyor; burada ölçülen, çevirinin yer
    // tutucuyu DÜŞÜRMEMESİ: düşerse İngilizce arayüzde ad sessizce kaybolur.
    for (const anahtar of ['chat_channel_first', 'chat_write_channel']) {
      const degerler = [...DATA.matchAll(new RegExp(`${anahtar}:'([^']*)'`, 'g'))].map((m) => m[1]);
      assert.equal(degerler.length, 2, `${anahtar}: ${degerler.length} sözlükte — tr ve en bekleniyor`);
      for (const d of degerler) assert.ok(d.includes('{kanal}'), `${anahtar} = '${d}' yer tutucu taşımıyor`);
    }
  });
});
