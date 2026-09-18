// Dashboard doğruluk denetimi (kart #202).
//
// Kart şunu istiyordu: "dashboard'daki her sayı ve grafik için 'bu veri nereden
// geliyor' sorusu cevaplanmalı." 10 Eylül'de bir grafiğin İMAL EDİLMİŞ olduğu
// bulunmuştu (haftalık toplamı 0.9 / 1.2 / 0.8 / 1.0 ile çarpıp "Ay" üretiyordu).
//
// 18 Eylül'deki tarama uydurma veri BULMADI. Bulduğu üç şey başka türdendi:
//
//   1. "Bu hafta +N tamamlandı" RAPORLARDAN FARKLI bir tanım kullanıyordu —
//      hareket günlüğünü sayıyordu, `completedAt`i değil. Uydurma değil ama
//      aynı olgunun ikinci, ayrışan okuyucusu. Etiket de "bu hafta" diyordu,
//      pencere kayan 7 gündü.
//   2. "Takım hareketleri" kişiyi İLK ADINDAN tanıyordu; iki "Eray Atalay"
//      varken ikisinin hareketi aynı avatarla, aynı adla görünüyordu.
//   3. "Tümünü gör" var olmayan bir görünüme (`list`) gidiyordu; kullanıcı boş
//      bir sayfa görüyordu (18 Eylül, gerçek cihazda bildirildi).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sonGunlerdeTamamlanan } from '../../client/src/sayim.js';
import { activityToDict } from '../src/lib/serializers.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');
const DASH = yorumsuzDosya(path.join(CLIENT, 'views', 'dashboard.jsx'));
const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));

const GUN = 24 * 60 * 60 * 1000;
const SIMDI = Date.parse('2026-09-18T12:00:00Z');
const once = (gun) => new Date(SIMDI - gun * GUN).toISOString();
const BITIS = new Set(['done']);

describe('sonGunlerdeTamamlanan — raporlarla aynı tanım (completed_at)', () => {
  test('son 7 günde tamamlanan ve bitişte duran kartları sayıyor', () => {
    const kartlar = [
      { col: 'done', completed_at: once(1) },
      { col: 'done', completed_at: once(6.9) },
      { col: 'done', completed_at: once(8) },   // pencere dışı
    ];
    assert.equal(sonGunlerdeTamamlanan(kartlar, BITIS, SIMDI), 2);
  });

  test('completed_at olmayan kart SAYILMIYOR — günlükte kaydı olsa bile', () => {
    // Eski hesap hareket günlüğünü sayıyordu: bitişe atılıp geri alınan kartın
    // kaydı kalıyor ve "tamamlandı" sayılıyordu. Sunucu geri alınca
    // completedAt'i siliyor; bu tanım onu doğru olarak dışarıda bırakıyor.
    assert.equal(sonGunlerdeTamamlanan([{ col: 'done', completed_at: null }], BITIS, SIMDI), 0);
  });

  test('bitiş dışındaki kolonda duran kart sayılmıyor — bayat alan aklamıyor', () => {
    assert.equal(sonGunlerdeTamamlanan([{ col: 'doing', completed_at: once(1) }], BITIS, SIMDI), 0);
  });

  test('BÜTÜN bitiş kolonları sayılıyor, yalnızca ilki değil', () => {
    // Eski hesap `chartCols.find(c => c.is_done)` ile İLK bitiş kolonuna
    // bakıyordu; iki bitiş kolonu olan panoda ikincisi hiç sayılmıyordu.
    const iki = new Set(['done', 'yayinda']);
    const kartlar = [
      { col: 'done', completed_at: once(1) },
      { col: 'yayinda', completed_at: once(2) },
    ];
    assert.equal(sonGunlerdeTamamlanan(kartlar, iki, SIMDI), 2);
  });

  test('gelecek tarihli kayıt sayılmıyor', () => {
    assert.equal(sonGunlerdeTamamlanan([{ col: 'done', completed_at: once(-1) }], BITIS, SIMDI), 0);
  });

  test('boş/bozuk girdide patlamıyor', () => {
    assert.equal(sonGunlerdeTamamlanan(null, BITIS, SIMDI), 0);
    assert.equal(sonGunlerdeTamamlanan([{ col: 'done', completed_at: 'bozuk' }], BITIS, SIMDI), 0);
  });
});

describe('dashboard kaynakları doğru yere bağlı (#202)', () => {
  test('tamamlanan sayısı sayim.js\'ten, hareket günlüğünden değil', () => {
    // Ölçüt `weeklyDone` atamasına bağlı; dosyada bir yerde fonksiyon adının
    // geçmesi onu kullandığını göstermez.
    const satir = DASH.match(/const weeklyDone = ([^;]+);/);
    assert.ok(satir, 'weeklyDone ataması bulunamadı');
    assert.match(satir[1], /sonGunlerdeTamamlanan\(tasks, doneColIds,/,
      'tamamlanan sayısı tek tanımdan (completed_at) gelmiyor');
    assert.doesNotMatch(DASH, /DATA\.THROUGHPUT/,
      'dashboard hâlâ hareket günlüğü sayımını (THROUGHPUT) okuyor — raporlarla ayrışan ikinci tanım');
  });

  test('etkinlik kişiyi kimliğiyle buluyor, ad önekiyle değil', () => {
    const bas = DASH.indexOf('etkinlik.map(');
    assert.notEqual(bas, -1, 'etkinlik döngüsü bulunamadı');
    const blok = DASH.slice(bas, DASH.indexOf('activity-time', bas));
    assert.match(blok, /mm\.id === a\.user_slug/,
      'etkinlik üyeyi slug ile bulmuyor');
    assert.doesNotMatch(blok, /startsWith\(a\.who\)/,
      'etkinlik hâlâ ilk ad önekiyle eşleşiyor — iki "Eray" aynı kişi görünür');
  });

  test('sunucu etkinlikte kimliği veriyor', () => {
    const d = activityToDict({
      user: { name: 'Eray Atalay - 2', slug: 'eray-atalay' },
      createdAt: new Date(), text: '{}',
    });
    assert.equal(d.user_slug, 'eray-atalay');
    assert.equal(activityToDict({ user: null, createdAt: new Date(), text: '{}' }).user_slug, null,
      'silinmiş kullanıcıda null olmalı, patlamamalı');
  });

  test('dashboard\'un gittiği HER görünümün uygulamada karşılığı var', () => {
    // Paletteki "yayılan her eylemin karşılığı olmalı" testinin kardeşi
    // (global.test.js). Belirti ikisinde de aynı: tıklanıyor, hiçbir şey
    // olmuyor ya da boş sayfa. "Tümünü gör" `onView('list')` çağırıyordu ve
    // `list` diye bir görünüm yoktu.
    const gecerli = new Set([...APP.matchAll(/view === '(\w+)'/g)].map((m) => m[1]));
    assert.ok(gecerli.size >= 5, `app.jsx'te yalnızca ${gecerli.size} görünüm bulundu — tarama bozuk`);
    const gidilen = [...DASH.matchAll(/onView(?:\?\.)?\(\s*'(\w+)'/g)].map((m) => m[1]);
    assert.ok(gidilen.length >= 3, 'dashboard\'daki görünüm çağrıları bulunamadı — tarama bozuk');
    const karsiliksiz = [...new Set(gidilen.filter((g) => !gecerli.has(g)))];
    assert.deepEqual(karsiliksiz, [],
      `dashboard karşılığı olmayan görünüme gidiyor: ${karsiliksiz.join(', ')} — kullanıcı boş sayfa görür`);
  });
});
