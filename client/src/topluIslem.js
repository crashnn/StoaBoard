// Toplu işlemin saf çekirdeği (2 Ekim 2026 taraması, madde C).
//
// NİÇİN VAR: hiçbir görünümde seçim kutusu yoktu. Beş kartı taşımak beş ayrı
// sürükleme, çöpe atmak beş ayrı çekmece açışı demekti. Tablo görünümü bunun
// doğal evi — zaten elektronik tablo gibi duruyor.
//
// NİÇİN TOPLU UÇ YOK, TEK TEK ÇAĞRI VAR: her kartın kendi geçiş kaydı
// (`task_transitions`), kendi yayını ve kendi geçmişi olmalı. Toplu bir uç
// bunları tek satıra indirir ve "kim taşıdı" sorusu beş kart için tek
// cevaba düşerdi — kartta geçmiş (madde B) daha yeni eklenmişken onu
// bozmak olurdu.
//
// BEDELİ: yarım başarı mümkün. O yüzden sonuç SAYILIYOR ve kullanıcıya
// olduğu gibi söyleniyor — "5 kart taşındı" ile "3 taşındı, 2 başarısız"
// ayrı cümleler. Sessizce "tamam" demek bu depodaki en pahalı kusur sınıfı.

/**
 * İşi sırayla uygular ve kaç tanesinin tuttuğunu sayar.
 *
 * SIRAYLA, paralel değil: yirmi kart için yirmi eşzamanlı istek hem sunucuyu
 * hem de soket yayınını gereksiz sıkıştırır. Kullanıcı zaten bir toplu işlem
 * başlattığını biliyor; birkaç yüz milisaniye beklemek sorun değil.
 *
 * @param {Array<string>} idler
 * @param {(id: string) => Promise<any>} is Tek kart için yapılacak çağrı.
 * @returns {Promise<{basarili: string[], basarisiz: string[]}>}
 */
export async function topluCalistir(idler, is) {
  const basarili = [];
  const basarisiz = [];
  for (const id of idler || []) {
    try {
      await is(id);
      basarili.push(id);
    } catch (_) {
      // Tek kartın düşmesi kalanları durdurmuyor: on kartın birinde sorun
      // varsa ötekiler yine taşınsın. Hangilerinin düştüğü aşağıda sayılıyor.
      basarisiz.push(id);
    }
  }
  return { basarili, basarisiz };
}

/**
 * Sonucu kullanıcıya söylenecek cümleye çevirir.
 *
 * `ceviri(anahtar, yedek)` biçiminde bir işlev alıyor ki bu modül saf kalsın
 * ve sözlüğe bağlanmasın.
 */
export function topluSonucMetni({ basarili, basarisiz }, ceviri) {
  const t = (k, fb) => (typeof ceviri === 'function' ? ceviri(k, fb) : fb);
  const b = (basarili || []).length;
  const h = (basarisiz || []).length;

  if (b === 0 && h === 0) return null;          // yapacak bir şey yoktu
  if (h === 0) return t('bulk_done', '{n} kart işlendi').replace('{n}', b);
  if (b === 0) return t('bulk_all_failed', 'Hiçbir kart işlenemedi');
  return t('bulk_partial', '{n} kart işlendi, {m} tanesi başarısız')
    .replace('{n}', b)
    .replace('{m}', h);
}

/**
 * Seçimi günceller — tek kart.
 *
 * Küme KOPYALANIYOR: React durumu yerinde değiştirmek yeniden çizim
 * tetiklemez ve seçim ekranda değişmemiş görünür.
 */
export function secimiDegistir(secili, id) {
  const yeni = new Set(secili);
  if (yeni.has(id)) yeni.delete(id);
  else yeni.add(id);
  return yeni;
}

/**
 * "Hepsini seç" kutusunun davranışı: görünen kartların HEPSİ seçiliyse
 * seçimi kaldırır, değilse hepsini seçer.
 *
 * Ölçüt GÖRÜNENLER üzerinden: süzgeç açıkken "hepsi" ekranda olmayan kartı
 * kapsarsa kullanıcı görmediği bir kartı taşır.
 */
export function hepsiniSec(secili, gorunenIdler) {
  const gorunen = gorunenIdler || [];
  const hepsiSecili = gorunen.length > 0 && gorunen.every((id) => secili.has(id));
  if (hepsiSecili) {
    const yeni = new Set(secili);
    for (const id of gorunen) yeni.delete(id);
    return yeni;
  }
  return new Set([...secili, ...gorunen]);
}

/**
 * Toplu atamanın yönü: EKLE mi, KALDIR mı.
 *
 * TOGGLE SEMANTİĞİ, bilinçli: seçili kartların HEPSİNDE o kişi zaten varsa
 * kaldırılıyor, değilse hepsine ekleniyor. "Hepsini seç" kutusunun davranışı
 * da aynı — kullanıcı aynı mantığı iki yerde öğreniyor.
 *
 * NİÇİN DEĞİŞTİRME (replace) DEĞİL: "bu beş kartı Ayşe'ye ata" demek,
 * "Mehmet'i bu kartlardan çıkar" demek değildir. Replace, var olan
 * atamaları SESSİZCE siler ve bunu kimse fark etmez — bu depodaki en pahalı
 * kusur sınıfı. Eklemek geri alınabilir bir işlem, silmek değil.
 *
 * @param {Array} gorevler Seçili kartlar.
 * @param {string} uyeId
 * @returns {boolean} true = ekle, false = kaldır.
 */
export function atamaEkleniyorMu(gorevler, uyeId) {
  const liste = Array.isArray(gorevler) ? gorevler : [];
  if (liste.length === 0) return true;
  return !liste.every((g) => (g.assignees || []).includes(uyeId));
}

/**
 * Tek kartın yeni atanan listesi. Sıra korunuyor ve yineleme oluşmuyor.
 */
export function yeniAtananlar(gorev, uyeId, ekle) {
  const simdiki = (gorev?.assignees || []).filter(Boolean);
  if (ekle) return simdiki.includes(uyeId) ? simdiki : [...simdiki, uyeId];
  return simdiki.filter((id) => id !== uyeId);
}

/**
 * İşlem ÖNCESİ durumun anlık görüntüsü — geri alma buradan kuruluyor.
 *
 * NİÇİN VAR: bütün uygulamada tek bir "Geri al" vardı (çöpe atma). Toplu
 * işlem çubuğu "yirmi kartı yanlış kolona taşımayı" tek tıklık hâle getirdi
 * ve o tıklamanın geri dönüşü yoktu. Yanlışı kolaylaştırıp düzeltmeyi
 * kolaylaştırmamak, aracı kullanıcıya karşı kurmak olur.
 *
 * DİZİ KOPYALANIYOR (`[...]`), gerekçesi ince: kopyalanmazsa görüntü canlı
 * diziye TAKMA AD olur. `onAssignTask` durumu `{ ...t, ...updated }` ile
 * değiştirdiği için çoğu yolda yeni nesne doğuyor, ama tek bir yerde yerinde
 * değişiklik olsa görüntü de değişir ve "geri al" YENİ değeri geri
 * yazardı — hiçbir şey yapmayan, ama yapmış görünen bir düğme.
 *
 * @param {Array} gorevler Bütün kartlar (işlem öncesi hâlleriyle).
 * @param {Array<string>} idler İşleme girecek kimlikler.
 * @param {string} alan 'col' ya da 'assignees'.
 */
export function geriAlmaPlani(gorevler, idler, alan) {
  const izin = new Set((idler || []).map(String));
  return (gorevler || [])
    .filter((g) => izin.has(String(g.id)))
    .map((g) => ({
      id: String(g.id),
      deger: Array.isArray(g?.[alan]) ? [...g[alan]] : g?.[alan],
    }));
}

/**
 * Plandan YALNIZCA tutmuş olanları süzer.
 *
 * Yarım başarıda geri alma da yarım olmalı: beş kartın üçü taşındıysa geri
 * alma o üçünü döndürür. Başarısız ikisini "geri almak" hiç olmamış bir
 * değişikliği geri yazmak olurdu.
 */
export function geriAlinacaklar(plan, basarili) {
  const izin = new Set((basarili || []).map(String));
  return (plan || []).filter((p) => izin.has(String(p.id)));
}
