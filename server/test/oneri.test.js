// Arama önerileri — palet boşken son dokunulan / atanmış / hareketli (kart #245).
//
// KARAR (kullanıcı, 18 Eylül 2026): hareket kaydından türet, şema yok.
// Kural saf (lib/oneri.js) ve burada davranış olarak ölçülüyor; uç ve palet
// bağlantıları kendi bloklarına bağlı.
//
// GÜVENLİK (GUVENLIK.md §4): öneri, kullanıcının göremediği kartı
// göstermemeli — bitmiş, çöpteki ve başka alandaki kart hiçbir bölüme
// girmez. Kural bunu "kartlar haritasında yoksa hiç girmez" ile uyguluyor;
// haritayı uç aktif alan + deletedAt null + bitmemiş kolonla kuruyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { oneriKur, ONERI_SINIRI, HAREKETLI_PENCERE_MS } from '../src/lib/oneri.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');
const NOTES = yorumsuzDosya(path.join(KOK, 'server', 'src', 'routes', 'notes.js'));
const PALET = yorumsuzDosya(path.join(KOK, 'client', 'src', 'palette.jsx'));

const simdi = new Date('2026-09-18T12:00:00Z');
const once = (saat) => new Date(simdi.getTime() - saat * 3600 * 1000);
const kart = (id) => ({ id: String(id), title: `K${id}` });
const harita = (...ids) => new Map(ids.map((id) => [id, kart(id)]));

describe('öneri — kural', () => {
  test('dokunulan: kart başına en yeni hareket, yeni önce', () => {
    const r = oneriKur({
      dokunulan: [{ taskId: 1, at: once(5) }, { taskId: 2, at: once(1) }, { taskId: 1, at: once(0.5) }],
      kartlar: harita(1, 2), simdi,
    });
    assert.deepEqual(r.dokunulan.map((k) => k.id), ['1', '2']);
  });

  test('bitmiş/çöpteki/başka alandaki kart hiçbir bölüme girmiyor — haritada yok', () => {
    const r = oneriKur({
      dokunulan: [{ taskId: 9, at: once(1) }],
      atanmis: [9],
      hareketli: [{ taskId: 9, at: once(1) }],
      kartlar: harita(1), simdi,
    });
    assert.deepEqual([r.dokunulan, r.atanmis, r.hareketli], [[], [], []], 'görünmez kart öneri yolundan sızdı');
  });

  test('bir kart yalnızca İLK uyduğu bölümde', () => {
    const r = oneriKur({
      dokunulan: [{ taskId: 1, at: once(1) }],
      atanmis: [1, 2],
      hareketli: [{ taskId: 1, at: once(1) }, { taskId: 2, at: once(1) }, { taskId: 3, at: once(1) }],
      kartlar: harita(1, 2, 3), simdi,
    });
    assert.deepEqual(r.dokunulan.map((k) => k.id), ['1']);
    assert.deepEqual(r.atanmis.map((k) => k.id), ['2']);
    assert.deepEqual(r.hareketli.map((k) => k.id), ['3']);
  });

  test('atanmışlar son hareketi yeni olan önce, hareketsizler sonda', () => {
    const r = oneriKur({
      atanmis: [1, 2, 3],
      hareketli: [{ taskId: 2, at: once(1) }, { taskId: 3, at: once(10) }],
      kartlar: harita(1, 2, 3), simdi,
    });
    assert.deepEqual(r.atanmis.map((k) => k.id), ['2', '3', '1']);
  });

  test('hareketli yalnızca 48 saatlik pencere', () => {
    const r = oneriKur({
      hareketli: [{ taskId: 1, at: once(47) }, { taskId: 2, at: once(49) }],
      kartlar: harita(1, 2), simdi,
    });
    assert.deepEqual(r.hareketli.map((k) => k.id), ['1'], 'pencere dışı hareket öneriye girdi');
    assert.equal(HAREKETLI_PENCERE_MS, 48 * 3600 * 1000);
  });

  test('bölüm başına sınır', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    const r = oneriKur({ atanmis: ids, kartlar: harita(...ids), simdi });
    assert.equal(r.atanmis.length, ONERI_SINIRI);
  });
});

describe('öneri — bağlantılar', () => {
  test('uç: aktif alan resolveWorkspaceId ile, bitmiş ve silinmiş kart dışarıda, NULL is_done bitmemiş', () => {
    const i = NOTES.indexOf("'/oneriler',");
    assert.notEqual(i, -1, 'uç yok');
    const b = NOTES.slice(i, NOTES.indexOf('meTasksRouter.get(', i));
    assert.match(b, /const wsId = await resolveWorkspaceId\(user\);/, 'aktif alan tek kaynaktan okunmuyor');
    assert.match(b, /deletedAt: null,\s+OR: \[\{ column: null \}, \{ column: \{ isDone: false \} \}, \{ column: \{ isDone: null \} \}\],/,
      'kart haritası bitmiş/silinmiş kartı dışarıda bırakmıyor ya da NULL is_done bitmiş sayılıyor');
    assert.match(b, /projectId: \{ in: projeIds \},\s+deletedAt: null,/, 'kartlar aktif alanın projeleriyle sınırlı değil');
    assert.match(b, /res\.json\(oneriKur\(\{/, 'uç saf kuraldan geçmiyor');
    // Uç requireAuth taşıyor (yetki.test.js de genel olarak kilitliyor).
    assert.match(b.slice(0, 80), /requireAuth/, 'uç requireAuth taşımıyor');
  });

  test('palet: boş sorguda üç bölüm komutların önünde, sorgu gelince çekiliyor', () => {
    assert.match(PALET, /window\.API\?\.oneriler\?\.\(\)/, 'palet önerileri çekmiyor');
    const i = PALET.indexOf('if (!q && oneriler) {');
    assert.notEqual(i, -1, 'boş sorgu dalı yok — öneriler yazılınca da kalır ya da hiç çıkmaz');
    const b = PALET.slice(i, PALET.indexOf('if (q) {', i));
    for (const [anahtar, alan] of [['palette_group_recent', 'dokunulan'], ['palette_group_mine', 'atanmis'], ['palette_group_active', 'hareketli']]) {
      assert.ok(b.includes(`'${anahtar}'`) && b.includes(`oneriler.${alan}`), `${alan} bölümü çizilmiyor`);
    }
    assert.match(b, /\.\.\.all,\s*\];/, 'öneriler komutların önüne değil yerine geçiyor');
    assert.match(PALET, /\}, \[q, oneriler\]\);/, 'öneriler geldiğinde liste yenilenmiyor (useMemo bağımlılığı)');
  });
});
