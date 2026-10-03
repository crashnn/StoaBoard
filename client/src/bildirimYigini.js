/**
 * Bildirim yığını — patlama hâlinde tek toast, tek ding.
 *
 * NİÇİN VAR: 2 Ekim'de toplu atama geldi ve BILDIRIMLER.md'nin 6. boşluğu
 * ("toplu işlerde gürültü riski") risk olmaktan çıkıp canlı davranış oldu.
 * Yirmi kartı Ayşe'ye atamak sunucuda yirmi ayrı `task_assigned` bildirimi
 * üretiyor — uç kart başına çağrıldığı için, ve o uç bilinçli olarak
 * böyle (her kartın kendi geçiş kaydı olsun diye toplu uç açılmadı).
 *
 * `task_assigned` ayrıca S1 kararıyla EKRANI KESEN iki türden biri. Yani
 * yirmi kart = yirmi toast + yirmi ding. Toast'ın değeri seyrekliğinden
 * geliyor; yirmi tanesi onu değersizleştirir ve kullanıcı bir daha
 * bakmaz — kesme hakkını kaybetmiş oluruz.
 *
 * KARAR: ilk bildirim HEMEN gösteriliyor, gerisi sayılıyor, pencere
 * kapanınca TEK özet çıkıyor ("+19 yeni atama").
 *
 * Alternatif olan "hepsini bekletip tek toast göster" reddedildi: tek bir
 * atama bildirimi de pencere kadar gecikirdi, yani yaygın durumu nadir
 * durum için yavaşlatmak olurdu. Burada tek atama hiç gecikmiyor.
 *
 * NİÇİN SUNUCUDA DEĞİL: bildirim tablosunda `type` sütunu yok (metin hazır
 * geliyor), yani sunucuda birleştirme şema değişikliği ister ve bu depoda
 * şema elle, bilinçli uygulanıyor. Burada kapatılan şey KESMEnin gürültüsü;
 * panelde yirmi satır olduğu gibi duruyor ve bu doğru — kullanıcı hangi
 * kartların atandığını görmek isteyecek.
 */

/** Patlama penceresi. Toplu işlem yirmi kartı bundan kısa sürede bitiriyor. */
export const PENCERE_MS = 2500;

/**
 * Bu bildirim gösterilmeli mi, sayılmalı mı?
 *
 * @param {{basladi: number}|null|undefined} kayit O türün açık penceresi.
 * @param {number} simdi
 * @param {number} pencere
 * @returns {'ilk'|'say'}
 */
export function yiginKarari(kayit, simdi, pencere = PENCERE_MS) {
  if (!kayit || typeof kayit.basladi !== 'number') return 'ilk';
  // Pencere İLK bildirimden sayılıyor, sonuncudan değil. Sonuncudan
  // sayılsaydı saniyede bir gelen sürekli bir akış pencereyi hiç
  // kapatmaz ve kullanıcı özeti hiç görmezdi.
  return simdi - kayit.basladi > pencere ? 'ilk' : 'say';
}

/**
 * Özet cümlesi. `sayi` İLK BİLDİRİMDEN SONRAKİLERİN sayısı.
 *
 * Bir tane bile fazla yoksa null: "+0 yeni atama" diye bir cümle yok ve
 * gereksiz bir toast, kapatmaya çalıştığımız gürültünün kendisi olurdu.
 */
export function ozetMetni(tur, sayi, ceviri) {
  if (!(sayi > 0)) return null;
  const t = (k, fb) => (typeof ceviri === 'function' ? ceviri(k, fb) : fb);
  const kalip = tur === 'task_assigned'
    ? t('notif_burst_assigned', '+{n} yeni atama')
    : tur === 'mention'
      ? t('notif_burst_mention', '+{n} yeni bahsetme')
      : t('notif_burst_other', '+{n} yeni bildirim');
  return String(kalip).replace('{n}', sayi);
}
