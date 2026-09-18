// Kanal geçmişi kesimi — yeni üye katılımından öncesini görmez (kart #119).
//
// KARAR (kullanıcı, 18 Eylül 2026): "Alana yeni katılan birisi kanalın tüm
// geçmişini okuyamamalı, o anda giriş yaptıktan sonra okumalıdır." E-posta
// örneği: şirkete girince eski yazışmalar gelmez, o andan itibarenkiler gelir.
//
// Kural saf (`gecmisBaslangici`, `gecmisSuzgeci`) ve burada davranış olarak
// ölçülüyor. Bağlantılar — mesaj listesi, sabitlenmişler, medya, kanal
// listesindeki son mesaj önizlemesi, onayda kanal üyeliği — kendi
// bloklarına bağlı olarak ayrıca kilitleniyor: kural doğru olup bir okuma
// yolu onu atlarsa kesim yalnızca görünüşte olur.
//
// Yol üstünde çıkan güvenlik kusuru da burada kilitli: "bütün sabitlenmişler"
// ve "bütün medya" okumaları kanal üyeliğine hiç bakmıyordu — özel kanalın
// içeriği alandaki herkese listeleniyordu.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gecmisBaslangici, gecmisSuzgeci } from '../src/lib/channels.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const CHAT = yorumsuzDosya(path.join(SRC, 'routes', 'chat.js'));
const KANAL = yorumsuzDosya(path.join(SRC, 'lib', 'channels.js'));
const WS = yorumsuzDosya(path.join(SRC, 'routes', 'workspaces.js'));
const CHAT_JSX = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'chat.jsx'));

describe('kanal geçmişi kesimi — kural', () => {
  const t1 = new Date('2026-09-10T10:00:00Z');
  const t2 = new Date('2026-09-12T10:00:00Z');

  test('kanal üyeliği varsa kesim katılım anı', () => {
    assert.equal(gecmisBaslangici({ joinedAt: t1 }, { createdAt: t2 }), t1,
      'üyelik satırı dururken alan katılım isteği kazandı');
  });

  test('kanal üyeliği yoksa yedek: onaylanmış alan katılım isteğinin zamanı', () => {
    // Üye katıldıktan ÖNCE açılmış herkese açık kanal: satır yok, alan
    // üyeliği üzerinden okunuyor. Kesim yine katılım anı olmalı.
    assert.equal(gecmisBaslangici(null, { createdAt: t2 }), t2);
  });

  test('hiçbir kaynak yoksa kesim yok — kurucu geçmişin tamamını görür', () => {
    assert.equal(gecmisBaslangici(null, null), null);
    assert.equal(gecmisBaslangici({ joinedAt: null }, { createdAt: t2 }), null,
      'zamanı boş üyelik satırı yedek ölçüte düşmemeli: satır var, "ilk üye" demek');
  });

  test('süzgeç: başlangıç varsa createdAt >= başlangıç, yoksa boş', () => {
    assert.deepEqual(gecmisSuzgeci(t1), { createdAt: { gte: t1 } });
    assert.deepEqual(gecmisSuzgeci(null), {});
  });
});

describe('kanal geçmişi kesimi — okuma yolları', () => {
  // Bir GET ucunun gövdesi: `chatRouter.get('/yol'`dan bir sonraki
  // chatRouter'a kadar. Yalnızca yol adıyla arandığında POST /messages
  // yakalanıyordu — ilk yazımda test yanlış işleyiciyi ölçtü.
  const uc = (yol) => {
    const bas = CHAT.indexOf(`chatRouter.get(\n  '${yol}',`);
    assert.notEqual(bas, -1, `GET ${yol} ucu bulunamadı`);
    const son = CHAT.indexOf('chatRouter.', bas + 10);
    return CHAT.slice(bas, son === -1 ? undefined : son);
  };

  test('GET /messages kanal dalı kesimi uyguluyor — genel kanal dahil', () => {
    const b = uc('/messages');
    assert.match(b, /const gecmis = gecmisSuzgeci\(chRow \? await kanalGecmisBaslangici\(chRow, user\.id\) : null\);/,
      'mesaj listesi kesim noktasını hesaplamıyor');
    assert.match(b, /where: \{ workspaceId: wsId, receiverId: null, \.\.\.channelFilter, \.\.\.gecmis \}/,
      'kesim sorguya girmiyor — hesaplanıyor ama uygulanmıyor');
    // Genel kanalın satırı da okunmalı; yoksa genel için kesim hiç olmaz.
    const satir = b.indexOf('const chRow = await prisma.channel.findFirst({');
    const kapi = b.indexOf("if (channel !== 'general') {");
    assert.ok(satir !== -1 && satir < kapi, 'kanal satırı yalnızca genel dışı için okunuyor — genel kanalda kesim yok');
  });

  test('GET /messages DM dalında kesim YOK — iki taraf da baştan beri konuşmada', () => {
    const b = uc('/messages');
    const dm = b.slice(b.indexOf('if (withSlug) {'), b.indexOf('} else {'));
    assert.doesNotMatch(dm, /gecmisSuzgeci|kanalGecmisBaslangici/, 'DM geçmişi kesiliyor');
  });

  test('GET /pinned scope=all yalnızca okunabilir kanalları tarıyor (özel kanal sızıntısı)', () => {
    const b = uc('/pinned');
    const dal = b.slice(b.indexOf("if (scope === 'all') {"), b.indexOf('} else {', b.indexOf("if (scope === 'all') {")));
    assert.match(dal, /where\.OR = await okunabilirKanalKosullari\(user\);/,
      'bütün sabitlenmişler alandaki her kanaldan geliyor — özel kanal üye olmayana listelenir');
    assert.doesNotMatch(dal, /prisma\.channel\.findMany/, 'eski "bütün kanallar" sorgusu duruyor');
  });

  test('GET /pinned tek kanal dalı üyelik kapısı + kesim uyguluyor', () => {
    const b = uc('/pinned');
    const dal = b.slice(b.indexOf('} else {', b.indexOf("if (scope === 'all') {")), b.indexOf('const limit ='));
    assert.match(dal, /userChannelRole\(chRow, user\.id\)/, 'sabitlenmiş listesi kanal üyeliğine bakmıyor');
    assert.match(dal, /Object\.assign\(where, gecmisSuzgeci\(chRow \? await kanalGecmisBaslangici\(chRow, user\.id\) : null\)\);/,
      'sabitlenmiş listesi kesimi uygulamıyor');
  });

  test('GET /media kanalsız çağrı yalnızca okunabilir kanalları tarıyor; kanallı çağrı kesim uyguluyor', () => {
    const b = uc('/media');
    assert.match(b, /channelFilter = \{ OR: kosullar \};/, 'kanalsız medya listesi alandaki her kanaldan geliyor');
    assert.match(b, /const kosullar = await okunabilirKanalKosullari\(user\);/);
    assert.match(b, /channel: channelSlug,\s+\.\.\.gecmisSuzgeci\(chRow \? await kanalGecmisBaslangici\(chRow, user\.id\) : null\),/,
      'kanallı medya listesi kesimi uygulamıyor');
  });

  test('okunabilir kanal koşulları yalnızca erişilebilir kanallardan kuruluyor, kanal başına kesimle', () => {
    const bas = KANAL.indexOf('export async function okunabilirKanalKosullari(user) {');
    assert.notEqual(bas, -1);
    const b = KANAL.slice(bas, KANAL.indexOf('\n}', bas));
    assert.match(b, /const kanallar = await listAccessibleChannels\(user\);/, 'koşullar erişim listesinden kurulmuyor');
    assert.match(b, /kosullar\.push\(\{ channel: c\.slug, \.\.\.suzgec \}\);/, 'kanal koşulu kesimsiz');
    assert.match(b, /if \(c\.slug === 'general'\) kosullar\.push\(\{ channel: null, \.\.\.suzgec \}\);/,
      'genel kanalın channel=NULL eski mesajları kesimsiz ya da hiç yok');
  });

  test('kanal listesindeki son mesaj önizlemesi kesimden öncekini göstermiyor', () => {
    const bas = KANAL.indexOf('export async function listAccessibleChannels(user) {');
    const b = KANAL.slice(bas, KANAL.indexOf('\n}', bas));
    assert.match(b, /c\.gecmisBaslangici = await kanalGecmisBaslangici\(c, user\.id\);/, 'kanal başına kesim hesaplanmıyor');
    assert.match(b, /if \(c && c\.gecmisBaslangici && r\.created_at && new Date\(r\.created_at\) < c\.gecmisBaslangici\) continue;/,
      'kesimden önceki son mesaj önizlemeye giriyor — kesim yalnızca görünüşte');
  });

  test('onay bütün herkese açık kanallara üyelik satırı yazıyor — yalnızca genel değil', () => {
    const bas = WS.indexOf('const acikKanallar = await tx.channel.findMany({');
    assert.notEqual(bas, -1, 'onay yolu herkese açık kanalları toplamıyor — yeni üyenin eski kanalda katılım anı yok');
    const b = WS.slice(bas, bas + 600);
    assert.match(b, /type: 'public'/, 'toplama herkese açık kanalla sınırlı değil — özel kanala da üye yazılır');
    assert.match(b, /for \(const kanal of acikKanallar\)/);
    assert.match(b, /tx\.channelMember\.upsert\(/, 'satır yazılmıyor');
  });

  test('istemci kesim notunu sunucunun history_from alanından kuruyor, DM\'de değil', () => {
    assert.match(KANAL, /data\.history_from = new Date\(channel\.gecmisBaslangici\)\.toISOString\(\);/,
      'kanal sözlüğü history_from taşımıyor — istemci notu kuramaz');
    const bas = CHAT_JSX.indexOf('const gecmisNotu = (() => {');
    assert.notEqual(bas, -1, 'istemcide kesim notu yok');
    const b = CHAT_JSX.slice(bas, CHAT_JSX.indexOf('})();', bas));
    assert.match(b, /if \(dmWith\) return null;/, 'DM\'de kesim notu çıkıyor');
    assert.match(b, /\?\.history_from/, 'not history_from alanından kurulmuyor');
    // İki mesaj listesi var (panel ve tam sayfa); not ikisinde de olmalı.
    const sayi = CHAT_JSX.split('className="chat-history-note"').length - 1;
    assert.equal(sayi, 2, `kesim notu ${sayi} yerde çiziliyor, iki mesaj listesi var`);
  });
});

describe('mesaj listesi — limit EN YENİ N mesajı seçiyor', () => {
  // MCP G turunda bulundu (18 Eylül 2026): `list_messages limit=1` en eski
  // mesajı döndürdü. REST `asc + take` yapıyordu; istemci limit vermediği
  // için yüzden fazla mesajlı kanal yeniden yüklenince en eski yüz geliyordu.
  test('iki dalda da sorgu desc, sonuç eskiden yeniye çevriliyor', () => {
    const bas = CHAT.indexOf("chatRouter.get(\n  '/messages',");
    assert.notEqual(bas, -1, 'GET /messages bulunamadı');
    const b = CHAT.slice(bas, CHAT.indexOf('chatRouter.', bas + 10));
    const sorgular = [...b.matchAll(/orderBy: \{ createdAt: '(\w+)' \},\s+take: limit,/g)].map((m) => m[1]);
    assert.deepEqual(sorgular, ['desc', 'desc'], 'DM ya da kanal dalı hâlâ asc + take: limit en eski N mesajı seçer');
    const ters = b.indexOf('messages.reverse();');
    assert.notEqual(ters, -1, 'sonuç eskiden yeniye çevrilmiyor — ekran ters sırada çizer');
    assert.ok(ters < b.indexOf('const out = [];'), 'çevirme, çıktı kurulduktan sonra geliyor');
  });
});
