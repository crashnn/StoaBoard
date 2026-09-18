// Açık sekme dağıtımı fark ediyor (kart #201).
//
// KUSUR (13 Eylül 2026, DEVIR 0-U): tek kaynak dağıtımından sonra açık bir
// sekme eski çekmeceyle çalıştı ve dört işlemin dördü reddedildi. Kurtaran,
// sunucunun ret mesajıydı — yani şans. Dağıtım sıklığı arttıkça (17 Eylül'de
// 23 commit) eski sekme yeni kapıya daha sık takılır.
//
// Tasarım: sunucu index.html'i verirken dağıtım kimliğini SAYFAYA gömüyor,
// her yanıta `X-Stoa-Build` başlığı koyuyor; istemci ikisi ayrışınca bir kez,
// kalıcı bir "yeni sürüm, yenile" uyarısı çıkarıyor. Kendiliğinden yenileme
// YOK. index.html `Cache-Control: no-cache` ile gidiyor.
//
// Kural saf (`client/src/surum.js`); bağlantılar kendi bloklarına bağlı.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { surumOlcutu, yeniSurumVar, YER_TUTUCU } from '../../client/src/surum.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');
const APP = yorumsuzDosya(path.join(KOK, 'server', 'src', 'app.js'));
const CONFIG = yorumsuzDosya(path.join(KOK, 'server', 'src', 'config.js'));
const DATA = yorumsuzDosya(path.join(KOK, 'client', 'src', 'data.jsx'));
const SHELL = yorumsuzDosya(path.join(KOK, 'client', 'src', 'shell.jsx'));
const INDEX = yorumsuzDosya(path.join(KOK, 'client', 'index.html'));

describe('sürüm — kural', () => {
  test('yer tutucu ölçüt değil: geliştirmede karşılaştırma yapılmaz', () => {
    assert.equal(surumOlcutu(YER_TUTUCU), null);
    assert.equal(surumOlcutu(''), null);
    assert.equal(surumOlcutu(undefined), null);
    assert.equal(surumOlcutu('abc123'), 'abc123');
  });

  test('yeni sürüm yalnızca iki kimlik de biliniyor ve farklıysa', () => {
    assert.equal(yeniSurumVar('a', 'b'), true);
    assert.equal(yeniSurumVar('a', 'a'), false);
    assert.equal(yeniSurumVar(null, 'b'), false, 'ölçüt yokken "yeni" dendi — her yanıt uyarı çıkarır');
    assert.equal(yeniSurumVar('a', null), false, 'başlıksız yanıt (vekil, hata sayfası) "yeni" sayıldı');
  });
});

describe('sürüm — bağlantılar', () => {
  test('dağıtım kimliği sabit değil: ortamdan, yoksa süreç başlangıcından', () => {
    const i = CONFIG.indexOf('const build =');
    assert.notEqual(i, -1, 'config.build yok');
    const b = CONFIG.slice(i, CONFIG.indexOf(';', CONFIG.indexOf('||', i)));
    assert.match(b, /RAILWAY_GIT_COMMIT_SHA/, 'Railway commit özeti okunmuyor — her dağıtım aynı kimliği taşır');
    assert.match(b, /Date\.now\(\)/, 'ortam değişkeni yokken kimlik sabit — dağıtım fark edilmez');
    assert.match(CONFIG, /^\s+build,$/m, 'build config nesnesine girmiyor');
  });

  test('her yanıt X-Stoa-Build taşıyor', () => {
    const i = APP.indexOf("res.setHeader('X-Content-Type-Options', 'nosniff');");
    assert.notEqual(i, -1);
    const blok = APP.slice(i, APP.indexOf('next();', i));
    assert.match(blok, /res\.setHeader\('X-Stoa-Build', config\.build\);/, 'sürüm başlığı güvenlik başlıklarıyla birlikte konmuyor');
  });

  test('index.html her yerde sendIndex ile, no-cache ve gömülü kimlikle gidiyor', () => {
    assert.doesNotMatch(APP, /\.send\(indexHtml\)/, 'index.html sendIndex dışından gönderiliyor — o yol önbellek başlığını atlar');
    const i = APP.indexOf('function sendIndex(res, html) {');
    assert.notEqual(i, -1, 'sendIndex yok');
    const b = APP.slice(i, APP.indexOf('\n}', i));
    assert.match(b, /res\.setHeader\('Cache-Control', 'no-cache'\);/, 'index.html için no-cache yok — tarayıcı eski sayfayı sezgisiyle verir');
    assert.ok((APP.match(/sendIndex\(res, indexHtml\)/g) || []).length >= 3, 'üç gönderim noktasının hepsi sendIndex kullanmıyor');
    // Tırnaklı belirteç: aynı satırdaki `window.__STOA_BUILD__` özellik adı
    // değil, DEĞER değişmeli. İlk yazımda düz replace özellik adını buldu.
    assert.match(APP, /\.replace\("'__STOA_BUILD__'", `'\$\{config\.build\}'`\)/, 'gömülü kimlik tırnaklı belirteçle değiştirilmiyor');
  });

  test('sayfada yer tutucu var, sunucunun değiştireceği biçimde', () => {
    assert.match(INDEX, /window\.__STOA_BUILD__ = '__STOA_BUILD__';/, 'index.html gömülü kimlik satırını taşımıyor');
  });

  test('apiFetch her yanıtta başlığı ölçütle karşılaştırıyor; uyarı bir kez ve kalıcı', () => {
    const i = DATA.indexOf('async function apiFetch(path, options = {}) {');
    const b = DATA.slice(i, DATA.indexOf('\n}', i));
    assert.match(b, /surumKontrol\(res\.headers\.get\('X-Stoa-Build'\)\);/, 'apiFetch sürüm başlığına bakmıyor');
    const k = DATA.indexOf('export function surumKontrol(sunucuSurumu) {');
    const kb = DATA.slice(k, DATA.indexOf('\n}', k));
    assert.match(kb, /window\.__STOA_BUILD__/, 'ölçüt sayfadaki gömülü değerden alınmıyor');
    assert.match(kb, /if \(surumUyarildi \|\| !yeniSurumVar\(olcut, sunucuSurumu\)\) return false;/, 'kural saf modülden okunmuyor ya da uyarı tekrarlanıyor');
    assert.match(kb, /sticky: true/, 'uyarı beş saniyede kaybolur — görülmeden gider');
    assert.match(kb, /meta: \{ reload: true \}/, 'uyarıya tıklamak yenilemiyor');
    assert.doesNotMatch(kb, /location\.reload/, 'kendiliğinden yenileme var — kullanıcının taslağı gider');
  });

  test('yapışkan bildirim süreyle düşmüyor, tıklanınca yeniliyor', () => {
    assert.match(SHELL, /filter\(t => t\.sticky \|\| \(now - \(t\._createdAt \|\| now\)\) < 5000\)/, 'yapışkan bildirim de beş saniyede siliniyor');
    const i = SHELL.indexOf('const handleClick = (toast) => {');
    const b = SHELL.slice(i, SHELL.indexOf('};', i));
    assert.match(b, /if \(toast\.meta\?\.reload\) \{ window\.location\.reload\(\); return; \}/, 'yenile bildirimi tıklanınca yenilemiyor');
  });
});
