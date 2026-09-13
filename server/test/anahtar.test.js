// Kişinin kendi MCP anahtarları — Ayarlar → Claude bağlantısı.
//
// ── Neden bu dosya var ────────────────────────────────────────────────────
//
// 13 Eylül 2026'ya kadar her MCP anahtarı Railway'de elle ekleniyordu. Artık
// kişi kendi anahtarını üretiyor; bu, kimlik doğrulamanın yeni bir kapısı ve
// bir kimlik kapısında hata sessiz olmaz — yanlış kişiye erişim demektir.
// Dosya dört şeyi kilitliyor:
//
//   1. Saf çekirdek: anahtar biçimi, özet, etiket, kaydın geçerliliği.
//   2. Kapsam: uçtaki her sorgu kişinin KENDİ anahtarlarıyla sınırlı (IDOR).
//   3. Sır: ham anahtar yalnızca oluşturma yanıtında; denetim kaydına, önbelleğe,
//      listeye düşmüyor.
//   4. Oturum hijyeni: parola sıfırlanınca da değişince de anahtarlar iptal
//      ediliyor. Hesabı ele geçiren birinin ürettiği anahtar parola değişince
//      yaşarsa, parola değiştirmek işe yaramaz (GUVENLIK.md, bölüm 3).
//
//   çalıştır:  npm.cmd test        (Windows PowerShell)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  yeniMcpAnahtari,
  anahtarEtiketi,
  kayittanKullanici,
  mcpTokenToDict,
  hashToken,
  MIN_TOKEN_LENGTH,
  ANAHTAR_ONEKI,
} from '../src/lib/mcpToken.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const oku = (yol) => yorumsuzDosya(path.join(SRC, ...yol.split('/')));

/** `ad(` çağrılarının parantez içleri — iç içe parantezi sayarak. */
function cagriGovdeleri(kaynak, ad) {
  const govdeler = [];
  let i = kaynak.indexOf(`${ad}(`);
  while (i !== -1) {
    const bas = i + ad.length + 1;
    let derinlik = 1;
    let j = bas;
    for (; j < kaynak.length && derinlik > 0; j += 1) {
      if (kaynak[j] === '(') derinlik += 1;
      else if (kaynak[j] === ')') derinlik -= 1;
    }
    govdeler.push(kaynak.slice(bas, j - 1));
    i = kaynak.indexOf(`${ad}(`, j);
  }
  return govdeler;
}

// ─── 1. Saf çekirdek ───────────────────────────────────────────────────────

describe('yeniMcpAnahtari — biçim ve özet', () => {
  test('önekli, 32 bayt base64url, özet saklanan değerle aynı hesaptan', () => {
    const { ham, ozet, onek } = yeniMcpAnahtari();
    assert.match(ham, /^stoa_[A-Za-z0-9_-]{43}$/);
    assert.ok(ham.length >= MIN_TOKEN_LENGTH);
    assert.equal(ozet, hashToken(ham), 'saklanan özet kimlik kapısının hesapladığıyla aynı olmalı');
    assert.equal(onek, ham.slice(0, ANAHTAR_ONEKI.length + 4));
  });

  test('önek anahtarı ele vermiyor — yalnızca dört karakter açık', () => {
    const { ham, onek } = yeniMcpAnahtari();
    assert.equal(onek.length, 9);
    assert.ok(ham.length - onek.length >= 39);
  });

  test('her çağrı farklı anahtar', () => {
    const kume = new Set(Array.from({ length: 50 }, () => yeniMcpAnahtari().ham));
    assert.equal(kume.size, 50);
  });
});

describe('anahtarEtiketi — listede ayırt edilebilir, temiz', () => {
  test('kırpılıyor, iç boşluk sıkışıyor', () => {
    assert.equal(anahtarEtiketi('  İş   bilgisayarı  '), 'İş bilgisayarı');
  });

  test('kontrol karakterleri atılıyor', () => {
    // Karakterler kodla üretiliyor: kaynak dosyaya ham kontrol karakteri
    // yazmak, dosyayı grep'in gözünde ikili dosyaya çeviriyor (13 Eylül).
    const kirli = `Ev${String.fromCharCode(0)}${String.fromCharCode(10)}bilgisayarı${String.fromCharCode(127)}`;
    assert.equal(anahtarEtiketi(kirli), 'Ev bilgisayarı');
  });

  test('80 karakterle sınırlı; boş ya da metin değilse "Claude"', () => {
    assert.equal(anahtarEtiketi('x'.repeat(200)).length, 80);
    for (const bos of ['', '   ', null, undefined, 42, { label: 'a' }]) {
      assert.equal(anahtarEtiketi(bos), 'Claude');
    }
  });
});

describe('kayittanKullanici — kapalı başarısızlık', () => {
  const USER = { id: 5, slug: 'eray-atalay' };

  test('geçerli satır sahibini veriyor', () => {
    assert.equal(kayittanKullanici({ revokedAt: null, user: USER }), USER);
  });

  test('iptal edilmiş anahtar kimlik vermiyor', () => {
    assert.equal(kayittanKullanici({ revokedAt: new Date(), user: USER }), null);
  });

  test('satır yoksa ya da kullanıcı yüklenmemişse reddediliyor', () => {
    // `if (satir && satir.revokedAt)` kalıbı satır yokken kontrolü hiç
    // çalıştırmazdı — bu deponun tekrar eden kusuru.
    assert.equal(kayittanKullanici(null), null);
    assert.equal(kayittanKullanici(undefined), null);
    assert.equal(kayittanKullanici({ revokedAt: null }), null);
  });
});

describe('mcpTokenToDict — sır dışarı çıkmıyor', () => {
  test('özet de ham anahtar da yanıtta yok', () => {
    const d = mcpTokenToDict({
      id: 3, label: 'İş', prefix: 'stoa_ab12', tokenHash: 'f'.repeat(64),
      createdAt: new Date('2026-09-13T10:00:00Z'), lastUsedAt: null, revokedAt: null,
    });
    const metin = JSON.stringify(d);
    assert.ok(!metin.includes('f'.repeat(16)), 'özet yanıta sızıyor');
    assert.equal(d.id, '3');
    assert.equal(d.last_used_at, null);
  });
});

// ─── 2. Kapsam — kişi yalnızca kendi anahtarlarına dokunur ─────────────────

describe('mcpTokens uçları — her sorgu kişinin kendisiyle sınırlı', () => {
  const kaynak = oku('routes/mcpTokens.js');

  test('mcpToken üzerindeki her Prisma çağrısı userId: user.id taşıyor', () => {
    const cagrilar = ['findMany', 'findFirst', 'findUnique', 'count', 'create', 'update', 'updateMany', 'delete', 'deleteMany']
      .flatMap((op) => cagriGovdeleri(kaynak, `prisma.mcpToken.${op}`).map((g) => ({ op, g })));
    assert.ok(cagrilar.length >= 4, `beklenenden az sorgu bulundu: ${cagrilar.length} — tarama bozuk olabilir`);
    const kacak = cagrilar.filter(({ g }) => !/userId:\s*user\.id/.test(g)).map(({ op }) => op);
    assert.deepEqual(kacak, [], 'Bu sorgular kişiyle sınırlı değil — başkasının anahtarı okunabilir ya da iptal edilebilir');
  });

  test('tekil iptal, aitliği ve varlığı tek sorguda soruyor — aynı 404', () => {
    // Önce bul, sonra sahibini kontrol et yazımı "var ama senin değil" ile
    // "yok" arasında fark yaratabilirdi.
    assert.ok(!/prisma\.mcpToken\.(findUnique|findFirst)\(/.test(kaynak), 'uç tekil anahtarı sahibinden bağımsız arıyor');
    assert.ok(/err_mcp_token_not_found/.test(kaynak));
  });
});

// ─── 3. Sır — ham anahtar tek bir yanıttan başka yere gitmiyor ─────────────

describe('ham anahtar — yalnızca oluşturma yanıtında', () => {
  const kaynak = oku('routes/mcpTokens.js');

  test('denetim kaydına ham anahtar ya da özet yazılmıyor', () => {
    const govdeler = cagriGovdeleri(kaynak, 'recordAudit');
    assert.ok(govdeler.length >= 2, 'denetim kaydı çağrıları bulunamadı');
    const sizan = govdeler.filter((g) => /\bham\b|\bozet\b|tokenHash/.test(g));
    assert.deepEqual(sizan, [], 'Denetim kaydı anahtarı ya da özetini taşıyor');
  });

  test('ham anahtar yalnızca bir kez, yanıt gövdesinde kullanılıyor', () => {
    const kullanim = [...kaynak.matchAll(/\bham\b/g)].length;
    // Biri üretimden alınırken (yapı bozma), biri yanıtta.
    assert.equal(kullanim, 2, `ham anahtar ${kullanim} yerde geçiyor — yalnızca üretim ve yanıt olmalı`);
    assert.match(kaynak, /json\(\{\s*token:\s*ham\b/);
  });

  test('anahtar taşıyan yanıt önbelleğe alınmıyor', () => {
    const post = kaynak.slice(kaynak.indexOf("mcpTokensRouter.post("), kaynak.indexOf("mcpTokensRouter.delete("));
    assert.ok(post.length > 200, 'POST bloğu bulunamadı');
    assert.match(post, /Cache-Control',\s*'no-store'/);
  });
});

// ─── 4. Kimlik kapısı ve oturum hijyeni ────────────────────────────────────

describe('kimlik kapısı — veritabanı anahtarı güvenli okunuyor', () => {
  test('ortam değişkeninde bulunmayan anahtar veritabanında aranıyor', () => {
    const kapi = oku('lib/mcpAuth.js');
    const blok = kapi.slice(kapi.indexOf('if (!slug)'));
    assert.ok(blok.length > 0 && blok.indexOf('anahtarSahibiniBul(') > 0, 'veritabanı anahtarı hiç aranmıyor');
    assert.ok(blok.indexOf('anahtarSahibiniBul(') < blok.indexOf("status(401)"), 'arama 401 kararından sonra geliyor');
  });

  test('veritabanı yolu iptal edilmiş anahtarı kayittanKullanici ile eliyor', () => {
    const depo = oku('lib/mcpTokenStore.js');
    const bul = depo.slice(depo.indexOf('export async function anahtarSahibiniBul'), depo.indexOf('export async function kullanicininAnahtarlariniIptalEt'));
    assert.ok(bul.includes('kayittanKullanici('), 'kaydın geçerliliği tek kapıdan geçmiyor');
    assert.ok(bul.includes('hashToken('), 'arama özet üzerinden yapılmıyor');
  });

  test('toplu iptal yalnızca etkin anahtarlara ve o kişiye dokunuyor', () => {
    const depo = oku('lib/mcpTokenStore.js');
    const iptal = cagriGovdeleri(depo, 'prisma.mcpToken.updateMany')[0] || '';
    assert.match(iptal, /userId[,\s]/, 'iptal kişiyle sınırlı değil');
    assert.match(iptal, /revokedAt:\s*null/, 'iptal edilmiş anahtarların tarihi yeniden yazılıyor');
  });
});

describe('oturum hijyeni — parola değişince anahtarlar da düşüyor', () => {
  test('parola sıfırlama anahtarları iptal ediyor', () => {
    const auth = oku('routes/auth.js');
    const i = auth.indexOf("'/reset-password'");
    assert.ok(i > 0, 'sıfırlama ucu bulunamadı');
    const sonraki = auth.indexOf('authRouter.', i + 10);
    const blok = auth.slice(i, sonraki > 0 ? sonraki : undefined);
    assert.ok(blok.includes('destroyUserSessions('), 'tarama yanlış bloğa bakıyor olabilir');
    assert.ok(blok.includes('kullanicininAnahtarlariniIptalEt('), 'sıfırlama MCP anahtarlarını iptal etmiyor');
  });

  test('profilden parola değişikliği anahtarları iptal ediyor', () => {
    const api = oku('routes/api.js');
    const i = api.indexOf('if (passwordChanged)');
    assert.ok(i > 0, 'parola değişikliği bloğu bulunamadı');
    const blok = api.slice(i, i + 900);
    assert.ok(blok.includes('destroyUserSessions('), 'tarama yanlış bloğa bakıyor olabilir');
    assert.ok(blok.includes('kullanicininAnahtarlariniIptalEt('), 'parola değişikliği MCP anahtarlarını iptal etmiyor');
  });
});
