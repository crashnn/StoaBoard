// DM geçmişi erişilemediğinde SEBEP söyleniyor, boş liste değil.
//
// KUSUR (30 Eylül 2026, kullanıcının arkadaşı): "dm sohbetinde mesajlar
// vardı, tekrar girdi mesaj yok denmiş, tekrar girince mesajlar geri
// yüklenmiş."
//
// İki uçta birden sessiz başarısızlık vardı ve ikisi üst üste binince
// kullanıcı geçmişinin silindiğini sandı:
//
//   SUNUCU — erişim reddi `200 + []` dönüyordu. "Göremezsin" ile "mesaj yok"
//   ayırt edilemiyordu.
//
//   İSTEMCİ — `if (!Array.isArray(msgs)) return;` hata gövdesini sessizce
//   atıyordu; sunucu bir gün düzgün hata dönse bile ekran yine boş kalırdı.
//
// NİÇİN "BAZEN": kapı `resolveWorkspaceId` ile kişinin AKTİF alanına bakıyor,
// ama DM sorgusunun kendisi alana göre süzülmüyor. Aktif alan karşı tarafın
// üyesi olmadığı bir alansa kapı kapanıyor, alan değişince açılıyor.
// Mesajlar hep yerinde; oynayan şey kapı.
//
// KAPSAM NOTU: bu dosya kapının NE ZAMAN kapandığını değil, kapandığında NE
// SÖYLENDİĞİNİ ölçüyor. DM'in alana bağlı mı platform geneli mi olacağı
// hâlâ karara bağlı bir ürün sorusu (TOPLANTI-KARSILIGI.md, "sohbet
// kapsamı") ve bilerek açık bırakıldı.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAT_ROUTE = path.resolve(__dirname, '..', 'src', 'routes', 'chat.js');
const CHAT_VIEW = path.resolve(__dirname, '..', '..', 'client', 'src', 'chat.jsx');
const CHANNELS_LIB = path.resolve(__dirname, '..', 'src', 'lib', 'channels.js');
const DATA = path.resolve(__dirname, '..', '..', 'client', 'src', 'data.jsx');

describe('sunucu — erişilemeyen DM boş liste dönmüyor', () => {
  const src = yorumsuzDosya(CHAT_ROUTE);
  // Ölçüt GET /messages bloğuna bağlı, dosya geneline değil: `res.json([])`
  // başka bir uçta meşru olabilir.
  const bas = src.indexOf("chatRouter.get(\n  '/messages',");
  const blok = src.slice(bas, src.indexOf('chatRouter.', bas + 10));

  test('blok gerçekten bulundu — tarama kör değil', () => {
    assert.ok(bas > -1, 'GET /messages bulunamadı');
    assert.ok(blok.includes('withSlug'), 'yanlış blok taranıyor');
  });

  test('DM dalında res.json([]) ile red YOK', () => {
    // Kusurun kendisi. Üç red de bu yolla dönüyordu.
    const dmBas = blok.indexOf('if (withSlug) {');
    const dmBlok = blok.slice(dmBas, blok.indexOf('} else {', dmBas));
    assert.ok(!/return res\.json\(\[\]\)/.test(dmBlok),
      'erişim reddi hâlâ boş liste dönüyor — istemci bunu "mesaj yok" diye çizer');
  });

  test('red 404 ve kodlu', () => {
    assert.match(blok, /error: 'err_dm_not_available'/,
      'reddin kodu yok — istemci çeviremez');
    assert.match(blok, /res\.status\(404\)/, 'red bir hata durumu taşımıyor');
  });

  test('KÂHİN KAPALI — üç red de aynı gövdeyi dönüyor', () => {
    // "Böyle bir kullanıcı yok" ile "ortak alanınız yok" ayrılırsa, dışarıdan
    // biri deneme yanılmayla kullanıcı listesi çıkarabilir (GUVENLIK.md 8;
    // aynı karar kart erişiminde de alınmıştı, #227).
    const dmBas = blok.indexOf('if (withSlug) {');
    const dmBlok = blok.slice(dmBas, blok.indexOf('} else {', dmBas));
    const redler = [...dmBlok.matchAll(/return (\w+)\(\);/g)].map((m) => m[1]);
    assert.ok(redler.length >= 2, `DM dalında ${redler.length} red görüldü, en az iki bekleniyordu`);
    assert.equal(new Set(redler).size, 1,
      `redler ayrışmış (${[...new Set(redler)].join(', ')}) — var/yok farkı kâhin oluşturur`);
  });
});

describe('istemci — hata gövdesi yutulmuyor', () => {
  const src = yorumsuzDosya(CHAT_VIEW);
  const bas = src.indexOf('const url = dmWith');
  const blok = src.slice(bas, src.indexOf('Load pinned messages', bas) > -1
    ? src.indexOf('const [pinnedMessages', bas)
    : bas + 3000);

  test('dizi olmayan yanıt sessizce atlanmıyor', () => {
    assert.ok(!/if \(!Array\.isArray\(msgs\)\) return;/.test(src),
      'hata gövdesi hâlâ sessizce atılıyor — ekran sebebi söylemeden boş kalır');
  });

  test('yanıt başarısızsa hata durumu yazılıyor', () => {
    assert.match(blok, /setGecmisHatasi\(/,
      'yükleme hatası kullanıcıya hiç ulaşmıyor');
    assert.match(blok, /!r\.ok \|\| !Array\.isArray\(/,
      'HTTP durumuna bakılmıyor');
  });

  test('hata kodu önce sözlükten geçiyor', () => {
    // Ham `fetch` kullanıldığı için `apiFetch`in çeviri katmanı devrede
    // değil; sözleşme elle uygulanmalı (aynısı `dosyaYukle` içinde de var).
    assert.match(blok, /window\.t\?\.\(kod\) !== kod/,
      'sunucudan gelen kod ham gösteriliyor');
  });

  test('boş ekran ile hata ekranı AYRI', () => {
    // İkisi aynı metni gösterirse kusur geri gelmiş olur: kullanıcı yine
    // "mesaj yok" okur.
    assert.match(src, /messages\.length === 0 && gecmisHatasi &&/,
      'hata durumu için ayrı bir boş ekran yok');
    assert.match(src, /messages\.length === 0 && !gecmisHatasi &&/,
      '"ilk mesajı gönder" metni hata durumunda da gösteriliyor');
  });

  test('yeni istekte hata temizleniyor', () => {
    // Kalan hata, sonraki başarılı yüklemede ekranda kalırsa kullanıcı
    // sohbetin hâlâ bozuk olduğunu sanır.
    assert.match(blok, /setGecmisHatasi\(null\)/, 'önceki hata sıfırlanmıyor');
  });
});

// ── DM KAPISI: aktif alan degil, ortak alan ──────────────────────────────
//
// Kapinin NE ZAMAN kapandigi 1 Ekim 2026'da degisti (urun karari,
// kullanici: "DM platform geneli olsun"). Birebir uygulanmadi ve gerekcesi
// kayda degir: kapiyi tamamen kaldirmak, cok kiracili kurulumda BASKA bir
// musterinin calisanina adres tahmin ederek DM atma imkani verirdi
// (GUVENLIK.md 2). Olcut "su an hangi alandayim" yerine "bu kisiyle BIR
// YERDE birlikte calisiyor muyum" oldu: kusur tamamen kapaniyor, kiraci
// siniri duruyor.
//
// Davranis testi yok, bilerek: `ortakAlanId` prisma'ya gidiyor ve bu
// koşumun tamami veritabanisiz (CLAUDE.md). Olculen sey BAGLANTI — iki
// kapinin ayni olcutu kullandigi.

describe('DM kapısı okuma ve yazmada aynı ölçütü kullanıyor', () => {
  const route = yorumsuzDosya(CHAT_ROUTE);
  const lib = yorumsuzDosya(CHANNELS_LIB);

  test('okuma kapısı ortak alana bakıyor', () => {
    // Çapa GET /messages'in DM dalı. `'/messages'` tek başına yetmiyor:
    // aynı yol POST için de tanımlı ve dosyada ÖNCE geliyor.
    const bas = route.indexOf('if (withSlug) {');
    const blok = route.slice(bas, route.indexOf('} else {', bas));
    assert.match(blok, /ortakAlanId\(user\.id, other\.id/,
      'okuma hâlâ aktif alana bakıyor — sohbet alan değişince kaybolur');
  });

  test('yazma kapısı aynı yardımcıyı kullanıyor', () => {
    const bas = lib.indexOf('export async function resolveChatTarget');
    const blok = lib.slice(bas, lib.indexOf('const workspaceId = await resolveWorkspaceId(user);', bas));
    assert.match(blok, /ortakAlanId\(user\.id, receiver\.id/,
      'yazma hâlâ aktif alana bakıyor — kişi kendi sohbetine cevap yazamaz');
  });

  test('aktif alana bağlı eski ölçüt DM yolunda kalmadı', () => {
    // `usersShareWorkspace` hâlâ meşru: bahsetme kapsamı bilerek AKTİF
    // alana bakıyor (#257). Ölçüt o yüzden dosya geneli değil, DM dalı.
    const bas = route.indexOf('if (withSlug) {');
    const dm = route.slice(bas, route.indexOf('} else {', bas));
    assert.ok(!/usersShareWorkspace/.test(dm), 'DM okuma dalında eski ölçüt duruyor');
    assert.ok(!/usersShareWorkspace/.test(lib), 'channels.js hâlâ eski ölçütü taşıyor');
  });
});

describe('şikâyet düğmesi söz vermiyor', () => {
  // Ayni temanin ucuncu yuzu: kullaniciya olmayan bir sey soylenmemeli.
  // Dugme "Mesaj raporlandi, ekibimiz inceleyecek." diyordu ve arkasinda
  // hicbir sey yoktu — uc yok, tablo yok, denetim kaydi yok, bildirim yok.
  const view = yorumsuzDosya(CHAT_VIEW);
  const data = yorumsuzDosya(DATA);

  test('"raporlandı" sözü kaldırıldı', () => {
    assert.ok(!view.includes('chat_reported'), 'chat.jsx hâlâ söz veren anahtarı kullanıyor');
    assert.ok(!data.includes('chat_reported'), 'data.jsx hâlâ ölü anahtarı taşıyor');
  });

  test('yerine durumu söyleyen metin var, iki dilde', () => {
    assert.match(view, /chat_report_unavailable/, 'düğme hiçbir şey söylemiyor');
    const say = (data.match(/chat_report_unavailable:/g) || []).length;
    assert.equal(say, 2, `anahtar ${say} sözlükte — tr ve en ikisinde de olmalı`);
  });
});
