// Çevrimiçi durumu ve DM okunmamış rozeti.
//
// İKİ KUSUR (1 Ekim 2026, kullanıcı):
//   • "bazen de kullanıcılar uygulamada olsa da offline dönüşüyor"
//   • "+1 rozeti hâlâ var, bir de hangi DM'den geldiğini anlamıyorum"
//
// Ortak yanları yok, ikisi de sohbet panelinde görünüyor.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as onlineState from '../src/lib/onlineState.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCKETS = path.resolve(__dirname, '..', 'src', 'sockets', 'chat.js');
const CHAT = path.resolve(__dirname, '..', '..', 'client', 'src', 'chat.jsx');

describe('çevrimiçi durumu — kişi başına birden çok soket', () => {
  beforeEach(() => onlineState._sifirla());

  test('tek soket: bağlan, kop, çevrimdışı', () => {
    onlineState.setOnline(7, 'sid-a');
    assert.equal(onlineState.isOnline(7), true);
    assert.equal(onlineState.setOffline(7, 'sid-a'), true, 'son soket düştü, çevrimdışı olmalı');
    assert.equal(onlineState.isOnline(7), false);
  });

  test('İKİ SEKME: biri kapanınca kişi çevrimdışı OLMUYOR', () => {
    // Kusurun kendisi. Eski kayıt tek `sid` tutuyordu: ikinci sekme
    // birincinin kimliğini eziyor, birinci kapanınca kayıt tamamen
    // siliniyordu — kişi hâlâ uygulamadayken "offline" görünüyordu.
    onlineState.setOnline(7, 'sid-a');
    onlineState.setOnline(7, 'sid-b');
    assert.equal(onlineState.soketSayisi(7), 2);
    assert.equal(onlineState.setOffline(7, 'sid-a'), false, 'öteki sekme açıkken çevrimdışı denmiş');
    assert.equal(onlineState.isOnline(7), true);
    assert.equal(onlineState.setOffline(7, 'sid-b'), true);
    assert.equal(onlineState.isOnline(7), false);
  });

  test('YENİDEN BAĞLANMA: eski soketin gecikmiş kopuşu taze kaydı düşürmüyor', () => {
    // Socket.IO ağ dalgalanmasında önce yeni soketi bağlayıp sonra eskinin
    // disconnect'ini gönderebiliyor. Eski kodda o gecikmiş olay taze kaydı
    // siliyor ve bir daha connect gelmediği için kişi öyle kalıyordu.
    onlineState.setOnline(7, 'eski');
    onlineState.setOnline(7, 'yeni');
    assert.equal(onlineState.setOffline(7, 'eski'), false);
    assert.equal(onlineState.isOnline(7), true, 'gecikmiş kopuş taze soketi düşürdü');
  });

  test('bilinmeyen sid kimseyi düşürmüyor', () => {
    onlineState.setOnline(7, 'sid-a');
    assert.equal(onlineState.setOffline(7, 'baska-sid'), false);
    assert.equal(onlineState.isOnline(7), true);
  });

  test('sid verilmezse kayıt tamamen kalkıyor — hesap silme bu yolu kullanıyor', () => {
    onlineState.setOnline(7, 'sid-a');
    onlineState.setOnline(7, 'sid-b');
    assert.equal(onlineState.setOffline(7), true);
    assert.equal(onlineState.isOnline(7), false, 'hesap silindi ama soketler ayakta kalmış');
  });

  test('seçilmiş durum yeni sekmede korunuyor', () => {
    // 'dnd' kişinin bilerek seçtiği bir şey; ikinci sekme açmak onu
    // sıfırlamamalı.
    onlineState.setOnline(7, 'sid-a');
    onlineState.setStatus(7, 'dnd');
    onlineState.setOnline(7, 'sid-b');
    assert.equal(onlineState.getStatus(7), 'dnd');
  });

  test('çevrimdışı olan kişi listede yok', () => {
    onlineState.setOnline(7, 'sid-a');
    onlineState.setOnline(9, 'sid-c');
    onlineState.setOffline(7, 'sid-a');
    assert.deepEqual(onlineState.getOnlineIds(), [9]);
  });
});

describe('disconnect yayını sayıya bağlı', () => {
  const src = yorumsuzDosya(SOCKETS);
  // Ölçüt disconnect bloğuna bağlı, dosya geneline değil.
  const bas = src.indexOf("socket.on('disconnect'");
  const blok = src.slice(bas, src.indexOf("socket.on('set_status'", bas));

  test('düşen soketin kimliği geçiriliyor', () => {
    assert.match(blok, /setOffline\(user\.id,\s*socket\.id\)/,
      'disconnect bütün kaydı siliyor — başka sekmesi olan kişi çevrimdışı olur');
  });

  test('kişi tamamen çevrimdışı değilse yayın YAPILMIYOR', () => {
    assert.match(blok, /if \(!tamamenCevrimdisi\) return;/,
      'başka sekmesi açıkken user_offline yayınlanıyor');
    // Yayının ve veritabanı yazımının o erken dönüşten SONRA geldiği
    // ölçülüyor: kontrol var olup altındaki satırlar üstüne çıkarsa koruma
    // yok demektir.
    const kapi = blok.indexOf('if (!tamamenCevrimdisi) return;');
    assert.ok(blok.indexOf("emit('user_offline'") > kapi, 'yayın kapının önünde');
    assert.ok(blok.indexOf("status: 'offline'") > kapi, 'veritabanı yazımı kapının önünde');
  });
});

describe('DM rozeti — sekme toplamı ile satırlar aynı kümeden', () => {
  const src = yorumsuzDosya(CHAT);

  test('toplam listelenen üyelerden hesaplanıyor', () => {
    // KUSUR: toplam bütün `dm_*` anahtarlarını topluyordu. O anahtarlar
    // localStorage'da yaşıyor ve alana göre kapsanmıyor; listede karşılığı
    // olmayan bir anahtar sekmede sayılıyor ama görülemiyor ve
    // temizlenemiyordu.
    assert.match(src, /const totalDm = members\.reduce\(/,
      'sekme toplamı satırlardan bağımsız hesaplanıyor — gösterdiği sayının satırı olmayabilir');
    assert.ok(!/startsWith\('dm_'\)/.test(src),
      'anahtar öneki üzerinden toplama geri gelmiş');
  });

  test('satır rozetleri de aynı anahtarı okuyor', () => {
    // Toplamı düzeltip satırları unutmak ters yönde ayrışma olurdu.
    const satirlar = [...src.matchAll(/const dmUnread = \(unreadCounts \|\| \{\}\)\[`dm_\$\{m\.id\}`\]/g)];
    assert.equal(satirlar.length, 2, 'iki DM listesi var; ikisi de aynı anahtarı okumalı');
  });
});
