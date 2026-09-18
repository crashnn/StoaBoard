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
