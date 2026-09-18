// Geri tuşu en üstteki katmanı kapatır (kart #252).
//
// KUSUR (18 Eylül 2026, sade tur 2): "new task deyip gelen ekranda geri tuşu
// yaparsak new task ekranı gitmiyor." Açılır katmanlar geçmişte iz
// bırakmıyordu; geri tuşu katmanı atlayıp alttaki ekranı değiştiriyordu.
//
// Yönetici saf (client/src/katman.js) ve burada sahte bir geçmişle ÇALIŞTIRILIYOR.
// app.jsx bağlantıları ayrıca kendi bloklarına bağlı olarak kilitleniyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { katmanYoneticisi } from '../../client/src/katman.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISTEMCI = path.resolve(__dirname, '..', '..', 'client', 'src');
const APP = yorumsuzDosya(path.join(ISTEMCI, 'app.jsx'));
const MODAL = yorumsuzDosya(path.join(ISTEMCI, 'modals.jsx'));

/** Tarayıcı geçmişinin küçük bir taklidi — back() yalnızca sayılıyor. */
function sahteGecmis(ilkState = null) {
  return {
    state: ilkState,
    eklenen: [],
    geriSayisi: 0,
    pushState(s) { this.eklenen.push(s); this.state = s; },
    back() { this.geriSayisi++; },
  };
}

describe('katman yöneticisi — davranış', () => {
  test('açılış kayıt ekliyor ve #228 kart alanlarını koruyor', () => {
    const g = sahteGecmis({ kart: '193', kartItildi: true });
    const y = katmanYoneticisi(g);
    y.ac(() => {});
    assert.equal(g.eklenen.length, 1, 'katman geçmişe kayıt eklemedi — geri tuşu onu atlar');
    assert.equal(g.eklenen[0].kart, '193', 'kart alanı katman kaydının altında kayboldu');
    assert.equal(g.eklenen[0].kartItildi, true);
    assert.ok(g.eklenen[0].katman, 'katman işareti yok');
  });

  test('geri tuşu en üstteki katmanı kapatıyor ve ikinci back() atılmıyor', () => {
    const g = sahteGecmis();
    const y = katmanYoneticisi(g);
    let kapandi = 0;
    const id = y.ac(() => { kapandi++; });
    assert.equal(y.popstate(), 'kapatti');
    assert.equal(kapandi, 1, 'geri tuşu katmanı kapatmadı');
    // React temizliği ardından kapandi() çağırır — kayıt zaten tüketildi.
    y.kapandi(id);
    assert.equal(g.geriSayisi, 0, 'geri tuşuyla kapanan katman için fazladan back() — kullanıcı bir ekran fazla geri gider');
  });

  test('arayüzden kapanınca kayıt geri alınıyor, doğan popstate yutuluyor', () => {
    const g = sahteGecmis();
    const y = katmanYoneticisi(g);
    let kapandi = 0;
    const id = y.ac(() => { kapandi++; });
    y.kapandi(id);
    assert.equal(g.geriSayisi, 1, 'kayıt geri alınmadı — sonraki geri tuşu boşa gider');
    assert.equal(y.bekliyor(), true, 'back() yoldayken adres yazılabilir — yeni adres silinir');
    assert.equal(y.popstate(), 'yut', 'kendi back()\'imiz yönlendirme sanıldı');
    assert.equal(y.bekliyor(), false);
    assert.equal(kapandi, 0, 'arayüzden kapanan katmanın kapatıcısı ikinci kez çağrıldı');
  });

  test('iç içe katmanlarda geri tuşu yalnızca EN ÜSTTEKİNİ kapatıyor', () => {
    const y = katmanYoneticisi(sahteGecmis());
    const sira = [];
    y.ac(() => sira.push('alt'));
    y.ac(() => sira.push('ust'));
    y.popstate();
    assert.deepEqual(sira, ['ust']);
    assert.equal(y.acikSayisi(), 1);
  });

  test('açık katman yokken popstate yönlendirmeye bırakılıyor', () => {
    assert.equal(katmanYoneticisi(sahteGecmis()).popstate(), null);
  });
});

describe('katman — app.jsx bağlantıları', () => {
  test('popstate önce katmana soruyor; yut → adres yeniden eşitlenir, kapattı → yönlendirme yok', () => {
    const bas = APP.indexOf('const handlePop = () => {');
    const govde = APP.slice(bas, APP.indexOf("window.addEventListener('popstate'", bas));
    const sor = govde.indexOf('katmanlar.current.popstate()');
    const yol = govde.indexOf('const path = window.location.pathname;');
    assert.ok(sor > 0 && sor < yol, 'popstate katmana sormadan yönlendiriyor — geri tuşu katmanı atlar');
    assert.match(govde, /if \(katman === 'yut'\) \{ setAdresTik\(\(t\) => t \+ 1\); return; \}/, 'yutulan back() sonrası adres eşitlenmiyor');
    assert.match(govde, /if \(katman === 'kapatti'\) return;/, 'katman kapanınca yine yönlendiriliyor');
  });

  test('adres etkisi back() yoldayken yazmıyor ve sayaçla yeniden koşuyor', () => {
    const bas = APP.indexOf('const kartId = drawerTask?.id ?? taskPageTask?.id ?? null;');
    const onu = APP.slice(APP.lastIndexOf('useEf(() => {', bas), bas);
    assert.match(onu, /katmanlar\.current\.bekliyor\(\)/, 'adres etkisi katmanın back()\'ini beklemiyor');
    const deps = APP.slice(bas, APP.indexOf(']);', bas));
    assert.match(deps, /\}, \[view, authed, loading, drawerTask\?\.id, taskPageTask\?\.id, adresTik$/, 'adresTik bağımlılıkta yok');
    // Bağımlılık listesi render sırasında okunuyor: sayaç etkiden SONRA
    // tanımlansaydı "tanımlanmadan kullanıldı" hatası uygulamayı çökertirdi.
    assert.ok(APP.indexOf('const [adresTik, setAdresTik]') < bas, 'adresTik adres etkisinden sonra tanımlı — TDZ çökmesi');
  });

  test('beş katman geri tuşuna bağlı, her biri kendi kapatma yoluyla', () => {
    const bagli = [...APP.matchAll(/useGeriKatmani\(katmanlar\.current, ([^,]+),/g)].map((m) => m[1].trim());
    for (const k of ['canManageTasks && modalOpen', 'cmdOpen', 'notifOpen', 'chatOpen', 'mobileSidebarOpen']) {
      assert.ok(bagli.includes(k), `${k} geri tuşuna bağlı değil`);
    }
    assert.match(APP, /useGeriKatmani\(katmanlar\.current, notifOpen, \(\) => \{ setNotifOpen\(false\); rozetBakildi\(\); \}\)/,
      'bildirim paneli geri tuşuyla kapanınca rozet "bakıldı" sayılmıyor — arayüzdeki kapanışla ayrışıyor');
  });

  test('hook: yalnız açılıp kapanmada kurulur, temizlikte kaydı geri alır', () => {
    const bas = APP.indexOf('function useGeriKatmani(');
    const govde = APP.slice(bas, APP.indexOf('\n}\n', bas));
    assert.match(govde, /return \(\) => yonetici\.kapandi\(id\);/, 'arayüzden kapanışta kayıt geri alınmıyor');
    assert.match(govde, /\}, \[acik, yonetici\]\);/, 'etki her çizimde yeniden kuruluyor — her seferinde yeni geçmiş kaydı');
  });
});

describe('Yeni görev taslağı — geri tuşu yazılanı silmiyor (#252)', () => {
  test('geri tuşu kapanışı bayrağı kaldırıyor, bayrak pencereye gidiyor', () => {
    assert.match(APP, /useGeriKatmani\(katmanlar\.current, canManageTasks && modalOpen, \(\) => \{\s*setModalGeriKapandi\(true\); setModalOpen\(false\);/,
      'geri tuşu kapanışı işaretlenmiyor');
    assert.match(APP, /taslakKoru=\{modalGeriKapandi\}/, 'bayrak pencereye verilmiyor');
  });

  test('pencere yalnız geri kapanışında saklıyor, açılışta geri koyup siliyor', () => {
    const bas = MODAL.indexOf('    if (!open) {');
    const kapanis = MODAL.slice(bas, MODAL.indexOf('    if (open) {', bas));
    assert.match(kapanis, /if \(taslakKoru && \(title\.trim\(\) \|\| desc\.trim\(\)\)\) yeniGorevTaslagi = \{ title, desc \};/,
      'geri kapanışında taslak saklanmıyor');
    const sakla = kapanis.indexOf('yeniGorevTaslagi = {');
    const sifirla = kapanis.indexOf("setTitle('')");
    assert.ok(sakla > 0 && sakla < sifirla, 'taslak sıfırlamadan SONRA saklanıyor — boş metin saklanır');
    const acilis = MODAL.slice(MODAL.indexOf('    if (open) {', bas), MODAL.indexOf('}, [open]);', bas));
    assert.match(acilis, /setTitle\(yeniGorevTaslagi\.title\); setDesc\(yeniGorevTaslagi\.desc\);/, 'taslak geri konmuyor');
    assert.match(acilis, /yeniGorevTaslagi = null;/, 'taslak tek kullanımlık değil — her açılışta geri gelir');
  });
});
