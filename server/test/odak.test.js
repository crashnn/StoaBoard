// Odak kimde? — gizli bir pencerenin odağı çalması (kart #330).
//
// KUSUR (2 Ekim 2026, Playwright doğrulama turunda ölçüldü): /pano taze
// açıldığında `document.activeElement` bir INPUT'tu — placeholder "What needs
// to be done?". Yani KAPALI "Yeni görev" penceresinin başlık kutusu odakta
// duruyordu. Ölçüm: g ardından d tuşlandı, adres /pano'da kaldı ve kutuya
// "gd" YAZILDI.
//
// TEK SATIRLIK SEBEP, İKİ ÖLÜ ÖZELLİK: `AddTaskModal` taslak koruma (#252)
// için kapalıyken de DOM'da duruyor; görünürlük yalnızca CSS'te
// (`data-open`). Başlık alanında ise `autoFocus` vardı ve React onu MOUNT
// anında uyguluyor, "görünür olduğunda" değil.
//
//   1. G+tuş gezinmesi öldü. `app.jsx` yazı alanı odaktayken kısayolu
//      bilerek atlıyor (doğru kural); G_MAP'teki dokuz kısayolun hiçbiri
//      panoda çalışmıyordu. Komut paleti bunları kullanıcıya GÖSTERİYOR —
//      yani vaat edilip tutulmayan bir özellik.
//   2. Sohbet panelinin aşağı çek-kapat jesti öldü (#267): `jest.js`
//      `yaziliyorMu()` aynı odağı okuyor. #267 bu yüzden doğrulamada kaldı.
//
// ÖLÇÜTÜN SEÇİMİ: "alanda autoFocus olmasın" demek yetmezdi — o kural bir
// sonraki alanda yine unutulur ve test yalnızca bilinen bir alanı korur.
// Burada korunan şey sınıfın kendisi: görünürlüğü MOUNT'a değil bir
// ÖZNİTELİĞE bağlı her pencere, kapalıyken `inert` taşımak zorunda. `inert`
// alt ağacı odak ve tıklama sırasından tamamen çıkarıyor, yani odak
// alınabilmesi tasarımen imkânsız oluyor (CLAUDE.md, merdivenin üst
// basamağı).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');
const MODALS = yorumsuzDosya(path.join(CLIENT, 'modals.jsx'));
const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));
const JEST = yorumsuzDosya(path.join(CLIENT, 'jest.js'));
const PALETTE = yorumsuzDosya(path.join(CLIENT, 'palette.jsx'));

// KAPALIYKEN DE DOM'DA DURAN ÖRTÜLER — ölçütün kapsamı bu liste.
//
// NİÇİN LİSTE, NİÇİN DOSYA TARAMASI DEĞİL: `data-open={...}` bu depoda iki
// ayrı iş için kullanılıyor. Biri "kapalıyken de duran panel" (buradakiler),
// öteki açılır menünün TETİĞİ (`dropdown.jsx` düğmesi ve oku). İkincisi
// kapalıyken de odak alabilmek ZORUNDA — menüyü açan şey o. Genel bir
// "data-open varsa inert olsun" taraması o düğmeleri ölü yapardı, yani
// tarama kuralı doğru ölçemiyor; kapsam elle ve gerekçeli.
//
// LİSTENİN SINIRI AÇIK: sonradan eklenen yeni bir panel buraya yazılmadıkça
// ölçülmez. Kapalıyken DOM'da duran öteki paneller (`chat-panel`,
// `notifications`, mobil kenar çubuğu) bu turda DOKUNULMADI: her biri ayrı
// karar ve cihazda doğrulama istiyor, pano kartı açıldı.
const ORTULER = [
  ['modals.jsx — AddTaskModal', MODALS],
  ['palette.jsx — komut paleti', PALETTE],
];

/** AddTaskModal'ın gövdesi — ölçütler dosya geneline değil buna bağlanıyor. */
function addTaskBlogu() {
  const bas = MODALS.indexOf('function AddTaskModal(');
  assert.ok(bas > 0, 'AddTaskModal bulunamadı');
  const son = MODALS.indexOf('\nfunction ', bas + 10);
  return MODALS.slice(bas, son > bas ? son : MODALS.length);
}

describe('kapalı pencere odak alamaz (#330)', () => {
  for (const [ad, src] of ORTULER) {
    test(`${ad}: örtü kapalıyken inert`, () => {
      const etiketler = [...src.matchAll(/<div className="[\w-]*(?:overlay|panel|modal)"[^>]*data-open=\{[^>]*>/g)];
      assert.equal(etiketler.length, 1, `${ad}: beklenen örtü etiketi bulunamadı — kalıp değişmiş`);
      assert.match(etiketler[0][0], /\binert=/,
        `${ad}: kapalı örtüde inert yok, içindeki alanlar odak alabilir`);
    });
  }

  test('inert KAPALIYKEN var, açıkken yok', () => {
    // Ters yazım (`open ? '' : undefined`) pencereyi açıkken kullanılamaz
    // yapardı ve tarayıcıda hemen görülürdü; yine de ölçülüyor, çünkü
    // koşulun yönü testin göremediği bir yerde ters çevrilebilir.
    const etiket = /<div[^>]*data-open=\{open\}[^>]*>/.exec(MODALS);
    assert.ok(etiket, 'AddTaskModal örtüsü beklenen biçimde değil');
    assert.match(etiket[0], /inert=\{open \? undefined : ''\}/,
      'inert koşulu beklenen yönde değil — açıkken pencere ölü, kapalıyken odak alır');
  });

  test('başlık alanında autoFocus YOK', () => {
    // Ölçüt AddTaskModal bloğuna bağlı: aynı dosyadaki koşullu çizilen bir
    // pencerede autoFocus meşru (mount = görünür), onu yasaklamak yanlış
    // olurdu.
    assert.doesNotMatch(addTaskBlogu(), /autoFocus/,
      'kapalıyken DOM da duran pencerede autoFocus — mount anında odağı çalar');
  });

  test('odak pencere AÇILDIĞINDA veriliyor', () => {
    // autoFocus kaldırıldığında odağın hiç verilmemesi sessiz bir gerileme
    // olurdu: pencere açılır, kullanıcı yazmaya başlamak için tıklamak
    // zorunda kalır. Ölçüt `if (open) {` dalına bağlı.
    const blok = addTaskBlogu();
    const bas = blok.indexOf('if (open) {');
    assert.ok(bas > 0, 'açılış dalı bulunamadı');
    const dal = blok.slice(bas, blok.indexOf('}, [open]);', bas));
    assert.match(dal, /titleRef\.current\?\.focus\(\)/,
      'pencere açılırken başlık alanına odak verilmiyor');
    assert.match(blok, /ref=\{titleRef\}/, 'başlık alanı titleRef taşımıyor');
  });
});

describe('"kullanıcı yazıyor mu" tek kaynaktan (#330 ailesi)', () => {
  test('app.jsx kendi kopyasını taşımıyor, yardımcıyı kullanıyor', () => {
    // İKİ OKUYUCU KUSURU: aynı olgu `app.jsx` içinde `isEditing()` ve
    // `jest.js` içinde `yaziliyorMu()` diye iki kez yazılmıştı. Ölçüt
    // KULLANIMI ölçüyor, bildirimi değil (18 Eylül dersi): kopya bildirimi
    // silinip çağrı yerleri eski ada bakmaya devam ederse test kırılmalı.
    assert.doesNotMatch(APP, /const isEditing = \(\) =>/,
      'odak kontrolünün kopyası geri geldi — biri değişince öteki ayrışır');
    assert.doesNotMatch(APP, /isEditing\(\)/, 'app.jsx hâlâ kendi kopyasını çağırıyor');
    assert.match(APP, /import \{ yaziliyorMu \} from '\.\/jest\.js';/,
      'paylaşılan yardımcı içe aktarılmıyor');
  });

  test('kısayol kapısı yardımcıyı okuyor — ölçüt kısayol etkisine bağlı', () => {
    // Dosyada bir yerde `yaziliyorMu()` geçmesi yetmez: kapı tam bu
    // bloktaki erken dönüş.
    //
    // ÇAPA DEĞİŞTİ. Önce `const G_MAP =` sabitini arıyordu; 3 Ekim'de tuşlar
    // `kisayollar.js`e taşındı ve o sabit kalktı, yani çapa kaybolup test
    // KORUDUĞU DAVRANIŞ HİÇ DEĞİŞMEDİĞİ HÂLDE kırıldı. Yeni çapa
    // işleyicinin kendisi: adı, sabitlerinden daha uzun ömürlü.
    const bas = APP.indexOf('const onKey = (e) => {');
    assert.ok(bas > 0, 'kısayol işleyicisi bulunamadı');
    const blok = APP.slice(bas, APP.indexOf('pendingGTimer.current = setTimeout', bas));
    assert.match(blok, /if \(yaziliyorMu\(\)\) return;/,
      'kısayol kapısı paylaşılan odak kontrolünü okumuyor');
  });

  test('yardımcı odak yokluğunu karşılıyor', () => {
    // Silinen kopya `ae.tagName` okuyordu: `document.activeElement` null
    // olduğunda (nadir ama olur) kısayol işleyicisi patlardı ve bütün
    // klavye gezinmesi o anda ölürdü.
    assert.match(JEST, /return !!ae && \(ae\.tagName/,
      'yaziliyorMu null odağı karşılamıyor');
  });
});
