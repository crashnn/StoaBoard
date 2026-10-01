// Python karşılığı: app/online_state.py
//
// Bellek-içi presence tracking. { userId: { sids: Set, status } } map'i tutar.
// Status: 'online' | 'away' | 'dnd' | 'offline'.
//
// KUSUR (1 Ekim 2026, kullanıcı): "bazen de kullanıcılar uygulamada olsa da
// offline dönüşüyor."
//
// Sebep: kayıt kullanıcı başına TEK bir `sid` tutuyordu ve `setOffline`
// koşulsuz olarak bütün kaydı siliyordu. Bir kişinin birden çok soketi
// olabiliyor — ikinci sekme, telefon, ve en sık olanı Socket.IO'nun kendi
// yeniden bağlanması (ağ dalgalanması, dizüstünün uykuya girmesi, sekme
// arası gezinme). İki senaryo da kişiyi yanlışlıkla çevrimdışı yapıyordu:
//
//   • İki sekme: B açılınca A'nın sid'i EZİLİYOR. A kapanınca disconnect
//     kaydı tamamen siliyor, oysa B hâlâ bağlı.
//   • Yeniden bağlanma: yeni soket bağlanıp kaydı tazeledikten SONRA eski
//     soketin disconnect'i düşerse, taze kaydı siliyor. Kişi çevrimdışı
//     görünüyor ve bir daha connect olayı gelmediği için öyle kalıyor.
//
// Çözüm sayma: kayıt soket kimliklerinin KÜMESİNİ tutuyor, `setOffline`
// yalnızca o sid'i düşürüyor ve kümede soket kalmadıysa çevrimdışı diyor.
// Hangi soketin düştüğü bilinmeden çağrı yapılırsa (hesap silme) kayıt
// eskisi gibi tamamen kalkıyor.
const online = new Map(); // userId(int) -> { sids: Set<string>, status: string }

export function setOnline(userId, sid) {
  const existing = online.get(userId);
  if (existing) {
    // 'dnd' ve 'away' yeniden bağlantıda korunsun: kişi durumunu bilerek
    // seçmiş, yeni bir sekme açmak o seçimi iptal etmemeli.
    if (sid) existing.sids.add(sid);
    return;
  }
  online.set(userId, { sids: new Set(sid ? [sid] : []), status: 'online' });
}

/**
 * Bir soketi düşürür. `sid` verilmezse kayıt tamamen kalkar (hesap silme).
 *
 * @returns {boolean} Kişi artık tamamen çevrimdışı mı. Çağıran bu cevaba
 *   bakarak `user_offline` yayınlamalı: başka sekmesi açıkken "çevrimdışı"
 *   duyurmak, kusurun görünen yüzüydü.
 */
export function setOffline(userId, sid) {
  const entry = online.get(userId);
  if (!entry) return true;
  if (!sid) {
    online.delete(userId);
    return true;
  }
  entry.sids.delete(sid);
  if (entry.sids.size > 0) return false;
  online.delete(userId);
  return true;
}

export function setStatus(userId, status) {
  const entry = online.get(userId);
  if (entry) {
    entry.status = status;
    online.set(userId, entry);
  }
}

export function getStatus(userId) {
  return online.get(userId)?.status || 'offline';
}

export function isOnline(userId) {
  return online.has(userId);
}

export function getOnlineIds() {
  return Array.from(online.keys());
}

/** Kişinin açık soket sayısı — yalnızca test ve teşhis için. */
export function soketSayisi(userId) {
  return online.get(userId)?.sids.size || 0;
}

/** Test yalıtımı: modül durumu süreç boyunca yaşıyor. */
export function _sifirla() {
  online.clear();
}
