// Çöp kutusunda toplu geri alma ve arama (3 Ekim 2026).
//
// ENVANTER MADDESİ YARI YANLIŞTI — gruplamada olduğu gibi. "Çöpte arama yok"
// diye yazılmıştı; arama vardı. Kodu okumadan yazılan madde böyle kayıyor ve
// ikinci kez aynı sınıfa düşüldüğü için buraya da not ediliyor: envanter
// maddesi, kodu açmadan "eksik" demez.
//
// Gerçek eksikler ikisi de okuyunca çıktı:
//   1. Toplu geri alma yok — otuz kart otuz tıklama, tek alternatif
//      "Tümünü boşalt", yani geri almanın tam tersi.
//   2. Arama SATIRDA YAZANDAN AZINI tarıyordu: proje adı ve kolon satırda
//      duruyor ama süzgeç yalnızca başlığa bakıyordu.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';
import { copAnahtari, copAyristir, copSuzgeci, secilebilirAnahtarlar } from '../../client/src/copToplu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRASH = yorumsuzDosya(path.resolve(__dirname, '..', '..', 'client', 'src', 'views', 'trash.jsx'));

const GOREVLER = [
  { id: '1', title: 'İş planı', project_name: 'Ana Proje', col: 'todo' },
  { id: '2', title: 'Hata kaydı', project_name: 'Narflow', col: 'doing' },
];
const NOTLAR = [
  { id: '1', title: 'Toplantı notu', preview: 'Kırılma noktaları' },
  { id: '5', title: null, preview: 'başlıksız' },
];

describe('anahtarlar — tür ile birlikte', () => {
  test('görev ve not kimliği ÇAKIŞMIYOR', () => {
    // Çöpte ikisi aynı listede ve kimlikleri bağımsız sayaçlardan geliyor:
    // düz kimlik tutan bir seçim kümesi, görev 1'i seçince not 1'i de
    // seçili gösterirdi.
    assert.notEqual(copAnahtari('task', '1'), copAnahtari('note', '1'));
  });

  test('ayrıştırma türü ve kimliği geri veriyor', () => {
    assert.deepEqual(copAyristir('task-12'), { tur: 'task', id: '12' });
    assert.deepEqual(copAyristir('note-5'), { tur: 'note', id: '5' });
  });

  test('kimliğin İÇİNDE tire olsa da tür doğru okunuyor', () => {
    // `split('-')` kullanılsaydı UUID'ye geçildiği gün sessizce yanlış
    // kimlik üretirdi — kayıt bulunamaz, hata "kayıt yok" derdi ve sebep
    // aranırdı.
    assert.deepEqual(copAyristir('task-a1b2-c3d4'), { tur: 'task', id: 'a1b2-c3d4' });
  });

  test('bozuk anahtar null, patlamıyor', () => {
    assert.equal(copAyristir(''), null);
    assert.equal(copAyristir('-5'), null);
    assert.equal(copAyristir(null), null);
  });
});

describe('arama — satırda yazanın tamamı', () => {
  test('PROJE ADIYLA bulunuyor', () => {
    // Ad satırda yazıyor; aranmaması kullanıcıya "gördüğüm kelime
    // çalışmıyor" diyordu.
    const r = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, 'narflow');
    assert.deepEqual(r.gorevler.map((t) => t.id), ['2']);
  });

  test('başlıkla bulunuyor', () => {
    const r = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, 'hata');
    assert.deepEqual(r.gorevler.map((t) => t.id), ['2']);
  });

  test('EK ALAN (kolon adı) da taranıyor', () => {
    const r = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, 'in progress',
      (t) => [t.col === 'doing' ? 'In Progress' : 'To Do']);
    assert.deepEqual(r.gorevler.map((t) => t.id), ['2']);
  });

  test('arama KATLAMALI — "is" değil, doğru yazımla bulunamıyordu', () => {
    // Düz `toLowerCase()` "İş planı"nı "iş" aramasında kaçırıyor.
    assert.ok(!'İş planı'.toLowerCase().includes('iş'));
    const r = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, 'iş');
    assert.deepEqual(r.gorevler.map((t) => t.id), ['1']);
  });

  test('not ÖNİZLEMESİ de katlamalı taranıyor', () => {
    const r = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, 'kirilma');
    assert.deepEqual(r.notlar.map((n) => n.id), ['1']);
  });

  test('boş sorgu HER ŞEYİ geçiriyor', () => {
    const r = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, '');
    assert.equal(r.gorevler.length, 2);
    assert.equal(r.notlar.length, 2);
  });

  test('eksik girdi patlamıyor', () => {
    assert.deepEqual(copSuzgeci(undefined, 'x'), { gorevler: [], notlar: [] });
    assert.deepEqual(copSuzgeci({}, 'x'), { gorevler: [], notlar: [] });
  });
});

describe('seçilebilir satırlar — yetki', () => {
  test('yetki varsa görev de not da seçilebilir', () => {
    const k = secilebilirAnahtarlar({ gorevler: GOREVLER, notlar: NOTLAR }, { gorevYetkisi: true });
    assert.deepEqual(k, ['task-1', 'task-2', 'note-1', 'note-5']);
  });

  test('YETKİSİZ kullanıcının görevleri listeye HİÇ girmiyor', () => {
    // Alternatif — hepsini seçtirip işlem sırasında düşürmek — sessiz
    // başarısızlık olurdu: "12 seçili" görüp "5 öğe işlendi" mesajı alan
    // kullanıcıya farkı kimse açıklamazdı. Notlar kişisel, onlar kalıyor.
    const k = secilebilirAnahtarlar({ gorevler: GOREVLER, notlar: NOTLAR }, { gorevYetkisi: false });
    assert.deepEqual(k, ['note-1', 'note-5']);
  });

  test('liste SÜZÜLMÜŞ kümeden kuruluyor', () => {
    // "Hepsini seç" aramanın gösterdiğini kapsamalı; görünmeyen kartı
    // seçmek kullanıcının görmediği şeyi değiştirmek olurdu.
    const s = copSuzgeci({ gorevler: GOREVLER, notlar: NOTLAR }, 'narflow');
    assert.deepEqual(secilebilirAnahtarlar(s, { gorevYetkisi: true }), ['task-2']);
  });
});

describe('çöp ekranı bağlantısı', () => {
  const govde = (ad) => {
    const bas = TRASH.indexOf(ad);
    assert.ok(bas > 0, `${ad} bulunamadı`);
    const son = TRASH.indexOf('\n  };', bas);
    assert.ok(son > bas, `${ad} gövdesi kapanmıyor`);
    return TRASH.slice(bas, son);
  };

  test('toplu işlem GÖRÜNEN seçim üzerinden yürüyor', () => {
    // `secili` üzerinden yürüseydi arama daraldıktan sonra kümede kalan,
    // ekranda olmayan satır da işlem görürdü.
    assert.match(govde('const topluIsle = async'), /topluCalistir\(seciliGorunen, \(anahtar\) => \{/,
      'toplu işlem görünmeyen satırlara da uygulanıyor');
  });

  test('boş seçimde HİÇ başlamıyor', () => {
    assert.match(govde('const topluIsle = async'),
      /if \(topluMesgul \|\| seciliGorunen\.length === 0\) return;/, 'boş seçimde istek gidiyor');
  });

  test('kalıcı silme İKİ ADIMLI', () => {
    // Geri alınamayan işlem tek tıkla olmuyor — satır başına onay da,
    // "Tümünü boşalt" da aynı kuralda.
    const bas = TRASH.indexOf('className="toplu-cubuk trash-toplu"');
    assert.ok(bas > 0, 'toplu çubuk bulunamadı');
    const cubuk = TRASH.slice(bas, TRASH.indexOf('</div>', bas));
    assert.match(cubuk, /topluSilOnay \?/, 'kalıcı silme onaysız');
    assert.match(cubuk, /onClick=\{\(\) => setTopluSilOnay\(true\)\}/, 'onay kapısı yok');
    // GERİ ALMA onaysız ve öyle kalmalı: geri alınabilir bir işlem için
    // onay istemek, onayı anlamsızlaştırır.
    assert.match(cubuk, /onClick=\{\(\) => topluIsle\('restore'\)\}/, 'geri alma bağlı değil');
  });

  test('kutu YETKİSİZ satırda çizilmiyor', () => {
    const bas = TRASH.indexOf('className="trash-item-check"');
    assert.ok(bas > 0, 'görev kutusu bulunamadı');
    // Kutudan hemen önceki koşul `canManageTasks` olmalı.
    assert.match(TRASH.slice(Math.max(0, bas - 260), bas), /\{canManageTasks && \(\s*$|\{canManageTasks && \(/,
      'yetkisiz kullanıcıya seçim kutusu çiziliyor');
  });

  test('seçim kutuları TEK anahtar kuralından geçiyor', () => {
    // Satırda elle `task-${id}` kurmak, anahtar biçimi değiştiği gün
    // ayrıştırmayla sessizce ayrışırdı.
    assert.match(TRASH, /const itemKey = copAnahtari\('task', task\.id\);/);
    assert.match(TRASH, /const itemKey = copAnahtari\('note', note\.id\);/);
    assert.doesNotMatch(TRASH, /itemKey = `(task|note)-/, 'anahtar elle kuruluyor');
  });

  test('"hepsini seç" SÜZÜLMÜŞ kümeyi alıyor', () => {
    // Mutasyon bu ölçüt olmadan kaçtı: kutu `tasks`/`notes` üzerinden
    // kurulunca "hepsini seç" aramanın GİZLEDİĞİ satırları da seçiyordu ve
    // sonra `seciliGorunen` onları düşürüyordu — kullanıcı "40 seçili"
    // görüp "3 öğe işlendi" mesajı alırdı.
    //
    // Ölçüt İKİ yere bağlı, çünkü kural iki yerde yaşıyor: kutunun hangi
    // listeyi geçirdiği, ve o listenin neden kurulduğu.
    const bas = TRASH.indexOf('className="trash-hepsi"');
    assert.ok(bas > 0, 'hepsini seç kutusu bulunamadı');
    const kutu = TRASH.slice(bas, TRASH.indexOf('</label>', bas));
    assert.match(kutu, /hepsiniSec\(secili, secilebilir\)/,
      '"hepsini seç" kendi listesini kuruyor');

    const kurBas = TRASH.indexOf('const secilebilir = secilebilirAnahtarlar(');
    assert.ok(kurBas > 0, 'seçilebilir liste bulunamadı');
    const kur = TRASH.slice(kurBas, TRASH.indexOf(');', kurBas));
    assert.match(kur, /gorevler: filteredTasks, notlar: filteredNotes/,
      'seçilebilir liste SÜZÜLMEMİŞ kümeden kuruluyor');
  });

  test('sonuç mesajı "kart" değil "öğe" diyor', () => {
    // Çöpte not da var; `topluSonucMetni`nin varsayılan metni iki notu
    // kart sayardı. Çeviri seam'i tam buna yarıyor.
    assert.match(govde('const copCeviri ='), /COP_METIN\[k\]/, 'çeviri eşlemesi atlanmış');
    assert.match(TRASH, /topluSonucMetni\(sonuc, copCeviri\)/, 'çöp metni bağlanmamış');
  });
});
