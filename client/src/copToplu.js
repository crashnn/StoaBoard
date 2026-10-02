/**
 * Çöp kutusunda toplu işlem ve arama — saf çekirdek.
 *
 * ENVANTER MADDESİ YARI YANLIŞTI: "çöpte arama yok" diye yazılmıştı, arama
 * vardı. Eksik olan iki başka şeydi ve ikisi de kodu okuyunca çıktı:
 *
 * 1. TOPLU GERİ ALMA yok. Otuz kartı tek tek geri almak otuz tıklama, ve
 *    tek alternatif "Tümünü boşalt" — yani geri almanın tam tersi, kalıcı
 *    silme. Kullanıcının elindeki iki uç: tek tek kurtarmak ya da hepsini
 *    yok etmek.
 * 2. Arama SATIRDA YAZANDAN AZINI tarıyordu: kartın proje adı ve kolonu
 *    satırda duruyor ama süzgeç yalnızca başlığa bakıyordu. "Narflow"
 *    yazan kullanıcı, ekranda "Narflow" yazan satırı bulamıyordu.
 *
 * ARAMA KATLAMALI: `arama.js`teki `kapsiyor` kullanılıyor, düz
 * `toLowerCase().includes()` değil — "İş planı" kartı "is" yazınca
 * bulunmuyordu (gerekçe `arama.js`in başında).
 *
 * ANAHTARLAR TÜRLE BİRLİKTE: çöpte görev ve not aynı listede duruyor ve
 * kimlikleri çakışabilir. `task-12` ile `note-12` ayrı satır; seçim kümesi
 * düz kimlik tutsaydı birini seçmek ötekini de seçmiş gösterirdi.
 */

import { kapsiyorBiri } from './arama.js';

/** Seçim kümesinde kullanılan anahtar. */
export function copAnahtari(tur, id) {
  return `${tur}-${id}`;
}

/**
 * Anahtarı türe ve kimliğe böler.
 *
 * İLK tireden bölünüyor: kimliğin içinde tire olsa bile (ileride UUID'ye
 * geçilirse) tür doğru okunur. `split('-')` ile bölmek o gün sessizce
 * yanlış kimlik üretirdi.
 */
export function copAyristir(anahtar) {
  const s = String(anahtar ?? '');
  const i = s.indexOf('-');
  if (i <= 0) return null;
  return { tur: s.slice(0, i), id: s.slice(i + 1) };
}

/**
 * Arama süzgeci — satırda GÖRÜNEN alanların hepsi taranıyor.
 *
 * Görev: başlık + proje adı. Not: başlık + önizleme.
 * Kolon adı dışarıda: adı çeviriden geliyor ve bu modül saf kalıyor; çağrı
 * yeri kolon adını `ekAlanlar` ile verebilir.
 */
export function copSuzgeci({ gorevler = [], notlar = [] } = {}, sorgu, ekAlanlar = null) {
  const ek = typeof ekAlanlar === 'function' ? ekAlanlar : () => [];
  return {
    gorevler: gorevler.filter((t) =>
      kapsiyorBiri([t.title, t.project_name, ...ek(t)], sorgu)),
    notlar: notlar.filter((n) => kapsiyorBiri([n.title, n.preview], sorgu)),
  };
}

/**
 * "Hepsini seç" için anahtar listesi.
 *
 * YETKİSİZ SATIR HİÇ LİSTEYE GİRMİYOR. Alternatif — hepsini seçip işlem
 * sırasında yetkisizleri düşürmek — sessiz başarısızlık olurdu: kullanıcı
 * "12 seçili" görüp "5 öğe geri alındı" mesajı alırdı ve farkı kimse
 * açıklamazdı. Kutular da aynı kurala göre çiziliyor, yani seçilemeyen bir
 * satırda kutu hiç görünmüyor.
 */
export function secilebilirAnahtarlar({ gorevler = [], notlar = [] } = {}, { gorevYetkisi = true } = {}) {
  const liste = [];
  if (gorevYetkisi) for (const t of gorevler) liste.push(copAnahtari('task', t.id));
  for (const n of notlar) liste.push(copAnahtari('note', n.id));
  return liste;
}
