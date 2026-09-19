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

// Mesaj silme iyimser: ekrandan önce kalkıyor. Sunucu reddettiğinde yalnızca
// console.error vardı — kullanıcı silindi sanıyor, mesaj öbür herkeste
// duruyordu (#268 aile, sessiz başarısızlık). Ölçüt `catch` gövdesine bağlı:
// mesaj geri konmalı VE kullanıcıya söylenmeli.
describe('mesaj silinemezse geri geliyor ve söyleniyor (#268 aile)', () => {
  test('handleDeleteMessage hatası sessiz değil', () => {
    const bas = CHAT.indexOf('const handleDeleteMessage = async');
    assert.ok(bas >= 0, 'handleDeleteMessage bulunamadı');
    const govde = CHAT.slice(bas, CHAT.indexOf('\n  };', bas));
    const c = govde.indexOf('catch (e) {');
    assert.ok(c >= 0, 'API hatası yakalanmıyor');
    const yakala = govde.slice(c);
    assert.match(yakala, /setMessages\(/, 'hata sonrası mesaj geri konmuyor');
    assert.match(yakala, /window\.showToast\?\.\(\(window\.t\?\.\('chat_msg_delete_failed'\)/, 'hata kullanıcıya söylenmiyor');
  });
});

// Panel kipinde "Genel" sekmesi activeChannel'ın mesajlarını gösteriyordu ama
// kanalı SEÇECEK bir yüzey yoktu; genel dışındaki kanala ulaşmak tam ekrana
// geçip listeden seçmeyi gerektiriyordu (#253, 18 Eylül sade tur maddesi 13).
// Şerit yalnızca panel dalında (`!fullPage`) ve yalnızca birden fazla kanal
// varken çizilir. Ölçüt şeridin kendi bloğuna bağlı: dosyanın başka yerinde
// (tam sayfa listesi) zaten `setActiveChannel(slug)` geçiyor, dosya geneli
// bir arama şeridi silinse de yeşil kalırdı.
describe('sohbet paneli — kanal şeridi (#253)', () => {
  const BAS = "{!dmWith && tab === 'general' && channels.length > 1 && (";
  const blok = () => {
    const i = CHAT.indexOf(BAS);
    assert.ok(i >= 0, 'kanal şeridi bloğu yok');
    const j = CHAT.indexOf('\n        )}', i);
    return { i, govde: CHAT.slice(i, j) };
  };

  test('şerit panel dalında, tam sayfa dalında değil', () => {
    const { i } = blok();
    const panel = CHAT.indexOf('{!fullPage && (');
    assert.ok(panel >= 0 && i > panel, 'şerit panel (!fullPage) dalından önce duruyor');
  });

  test('her kanal bir düğme, dokununca aktif kanal değişiyor', () => {
    const { govde } = blok();
    assert.match(govde, /className="chat-channel-strip"/);
    assert.match(govde, /channels\.map\(/, 'kanal listesi dolaşılmıyor');
    assert.match(govde, /onClick=\{\(\) => setActiveChannel\(slug\)\}/, 'dokunma aktif kanalı değiştirmiyor');
    assert.match(govde, /const aktif = \(activeChannel \|\| 'general'\) === slug/, 'aktif kanal ölçütü eksik ya da null-genel eşlemesi yok');
    assert.match(govde, /data-active=\{aktif\}/, 'aktif kanal işaretlenmiyor');
    assert.match(govde, /<ChannelIconMark channel=\{ch\} slug=\{slug\}/, 'kanal simgesi tam sayfa listesiyle aynı kaynaktan gelmiyor');
  });

  test('erişilebilirlik etiketi iki dilde de var', () => {
    const { govde } = blok();
    assert.match(govde, /aria-label=\{window\.t\?\.\('chat_channel_strip'\)/);
    const [tr, en] = kopyalar(DATA, 'chat_channel_strip:', '\n');
    assert.ok(tr && en, 'chat_channel_strip iki sözlükte de olmalı');
    assert.notEqual(tr, en, 'tr ve en karşılığı aynı — biri kopya');
  });

  test('şerit yatay kayıyor, satır sarmıyor', () => {
    const css = yorumsuzDosya(path.join(ISTEMCI, 'styles.css'));
    const i = css.indexOf('.chat-channel-strip {');
    assert.ok(i >= 0, '.chat-channel-strip kuralı yok');
    const kural = css.slice(i, css.indexOf('}', i));
    assert.match(kural, /overflow-x:\s*auto/, 'şerit taşınca kaydırılamıyor');
    const dugme = css.slice(css.indexOf('.chat-channel-strip button {'));
    assert.match(dugme.slice(0, dugme.indexOf('}')), /white-space:\s*nowrap/, 'kanal adı satır sarıyor');
  });
});
