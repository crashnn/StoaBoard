// Kullanıcı ve kolon adresleri (slug) — kart #251 ve aile taraması.
//
// KUSUR (18 Eylül 2026): kullanıcı adresi Türkçe harfleri siliyordu
// ("Ayşe Iğdır" → "aye-idr"). Aile taramasında kolon adresinde üç kusur daha
// çıktı: "İ" görünmez bir karakter bırakıyordu (#250'nin kanal kusurunun
// aynısı), aynı adla açılan ikinci kolon aynı adresi alıp panoda
// görünmüyordu (şemada tekillik yok, pano tekrarlananı eliyor) ve 60
// karakteri aşan ad veritabanı hatasına düşüyordu (VarChar 60).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { slugify } from '../src/lib/user.js';
import { kolonSlug, KOLON_SLUG_AZAMI } from '../src/lib/slug.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');

describe('kullanıcı adresi — Türkçe harf çevriliyor, silinmiyor (#251)', () => {
  test('Türkçe adlar okunur ASCII adrese dönüşüyor', () => {
    const beklenen = [
      ['İlker Işık', 'ilker-isik'],
      ['Ayşe Iğdır', 'ayse-igdir'],
      ['İsmail Öztürk', 'ismail-ozturk'],
      ['Çağla Ünal', 'cagla-unal'],
      ['ŞULE GÜNEŞ', 'sule-gunes'],
    ];
    for (const [ad, slug] of beklenen) assert.equal(slugify(ad), slug, ad);
  });

  test('eski davranış korunuyor, tire ve boş girdi düzgün', () => {
    assert.equal(slugify('Eray Atalay'), 'eray-atalay', 'mevcut adres biçimi değişti');
    assert.equal(slugify('Eray - Atalay'), 'eray-atalay', 'ardışık tire sıkıştırılmıyor');
    assert.equal(slugify('  -Ali- '), 'ali', 'baş/son tire kırpılmıyor');
    assert.equal(slugify(''), 'user');
    assert.equal(slugify('!!!'), 'user');
    assert.match(slugify('İlker'), /^[a-z0-9-]+$/, 'adres ASCII değil');
  });
});

describe('kolon adresi — İ, tekillik, uzunluk (#251 aile)', () => {
  test('"İ" görünmez karakter bırakmıyor', () => {
    const s = kolonSlug('İncelemede');
    assert.equal(s, 'incelemede');
    assert.ok(!/̇/.test(s), 'birleşik nokta (U+0307) adreste — MCP col ile yazılamaz');
  });

  test('aynı adla ikinci kolon ayrı adres alıyor', () => {
    const mevcut = new Set(['test', 'test-2']);
    assert.equal(kolonSlug('Test', new Set(['test'])), 'test-2', 'aynı ad aynı adresi aldı — ikinci kolon panoda görünmez');
    assert.equal(kolonSlug('Test', mevcut), 'test-3');
    assert.equal(kolonSlug('Başka', mevcut), 'başka', 'çakışmayan ad ek almış');
  });

  test('adres şemadaki sınırı hiçbir zaman aşmıyor — ek dahil', () => {
    const uzun = 'Çok uzun bir kolon adı '.repeat(10);
    const ilk = kolonSlug(uzun);
    assert.ok(ilk.length <= KOLON_SLUG_AZAMI, `adres ${ilk.length} karakter — veritabanı reddeder`);
    const ikinci = kolonSlug(uzun, new Set([ilk]));
    assert.ok(ikinci.length <= KOLON_SLUG_AZAMI, `ekli adres ${ikinci.length} karakter`);
    assert.ok(!ilk.endsWith('-'), 'kırpma sonunda tire bıraktı');
    // Sınır şemadan okunuyor: şema değişirse bu sabit de değişmeli.
    const sema = fs.readFileSync(path.resolve(SRC, '..', 'prisma', 'schema.prisma'), 'utf8');
    const model = sema.slice(sema.indexOf('model BoardColumn'), sema.indexOf('}', sema.indexOf('model BoardColumn')));
    assert.match(model, new RegExp(`slug\\s+String\\s+@db\\.VarChar\\(${KOLON_SLUG_AZAMI}\\)`), 'şemadaki sınır sabitle uyuşmuyor');
  });

  test('yalnız noktalamadan oluşan ad boş adres üretmiyor', () => {
    assert.equal(kolonSlug('!!! ???'), 'kolon');
    assert.equal(kolonSlug('Test / QA'), 'test-qa');
  });

  test('kolon oluşturma ucu bu fonksiyonu projenin mevcut adresleriyle çağırıyor', () => {
    const src = yorumsuzDosya(path.join(SRC, 'routes', 'projects.js'));
    assert.match(src, /slug: kolonSlug\(title, mevcutSluglar\)/, 'kolon adresi yine elle üretiliyor');
    assert.doesNotMatch(src, /title\.toLowerCase\(\)\.replace\(/, 'eski adres üretimi duruyor');
    const i = src.indexOf('const mevcutSluglar');
    assert.ok(i > 0, 'mevcut adresler okunmuyor');
    assert.match(src.slice(i, i + 200), /where: \{ projectId \}/, 'mevcut adresler projeye göre süzülmüyor');
  });
});

// ─── #290 — etiket adresi adı izler ─────────────────────────────────────────
//
// Etiketin adı değişince adresi eski kalıyordu: "feature" adresli "Arka Uç".
// Arayüz adresi göstermiyor ama MCP (valid_labels) ve dışa aktarım gösteriyor;
// kullanıcı "slug değişmiyor, yeniden mi açalım" diye sordu — yeniden açmak
// kart bağlarını kaybettirir. Kimlik id, adres addan türetilir ve tekil olur.

import { etiketSlug, ETIKET_SLUG_AZAMI } from '../src/lib/slug.js';

describe('etiketSlug — addan ASCII adres, projede tekil (#290)', () => {
  test('Türkçe harf çevrilir, boşluk tire, mevcutla çakışırsa -2', () => {
    assert.equal(etiketSlug('Arka Uç'), 'arka-uc');
    assert.equal(etiketSlug('Tasarım'), 'tasarim');
    assert.equal(etiketSlug('Arka Uç', new Set(['arka-uc'])), 'arka-uc-2');
    assert.equal(etiketSlug('Arka Uç', new Set(['arka-uc', 'arka-uc-2'])), 'arka-uc-3');
    assert.equal(etiketSlug('!!!'), 'etiket');
  });
  test('uzunluk sınırı ekle birlikte aşılmaz', () => {
    const uzun = etiketSlug('a'.repeat(200), new Set(['a'.repeat(ETIKET_SLUG_AZAMI - 4)]));
    assert.ok(uzun.length <= ETIKET_SLUG_AZAMI);
    assert.ok(uzun.endsWith('-2'));
  });

  const PROJECTS = yorumsuzDosya(path.resolve(__dirname, '..', 'src', 'routes', 'projects.js'));
  const APP = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'app.jsx'));
  const SETTINGS = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'settings.jsx'));
  const govde = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i); assert.ok(j > i, b); return src.slice(i, j); };

  test('PATCH etiket: ad değişince adres öteki etiketlere göre tekil üretilir, yanıt eski/yeni adresi verir, yayın renamed taşır', () => {
    const p = govde(PROJECTS, "projectsRouter.patch(\n  '/:projectId/labels/:slug'", "projectsRouter.delete(\n  '/:projectId/labels/:slug'");
    assert.match(p, /id: \{ not: label\.id \}/, 'etiket kendi adresiyle çakışır sayılır — her düzenlemede -2 alır');
    assert.match(p, /const yeniSlug = etiketSlug\(name, new Set\(digerleri\.map\(\(l\) => l\.slug\)\)\)/);
    assert.match(p, /updates\.slug = yeniSlug;\s*renamed = \{ from: label\.slug, to: yeniSlug \};/);
    assert.match(p, /etiketlerYayini\(req\.app\.get\('io'\), access\.project, renamed \? null : access\.user\.slug, \{ renamed \}\)/,
      'adres değişince yayın kendi sekmeme de gitmeli (kartlar eski adresi taşıyor)');
    assert.match(p, /res\.json\(\{ slug: updated\.slug, old_slug: label\.slug, label: labelToDictValue\(updated\) \}\)/);
  });

  test('istemci: kartlardaki eski adres yenisine çevrilir, yankı süzgeci renamed varken kapalı; ayarlar eski anahtarı düşürür', () => {
    const e = govde(APP, "sock.on('project_labels'", '\n    });');
    assert.match(e, /benimYankim\(actor\) && !renamed/);
    assert.match(e, /t\.labels\.map\(l => \(l === renamed\.from \? renamed\.to : l\)\)/);
    const s = govde(SETTINGS, 'const result = await API.updateLabel(', 'setEditingSlug(null);');
    assert.match(s, /delete next\[result\.old_slug \|\| editingSlug\];\s*next\[result\.slug\] = result\.label;/);
  });
});
