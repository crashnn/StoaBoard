// Soket yayını — başarısızlığı yutmadan, isteği de düşürmeden.
//
// Yayın kodunun her çağrı yerinde aynı ödünleşme var: gerçek zamanlı bir olayın
// gönderilememesi, kullanıcının işlemini başarısız kılmamalı. Kart taşındı,
// veritabanına yazıldı; karşı tarafın ekranı tazelenmediyse bu üzücüdür ama
// isteği 500'e çevirmek daha kötüdür.
//
// Bu ödünleşme doğruydu, uygulanışı değildi. On iki çağrı yeri yayını
// `try { ... } catch {}` içine alıyordu: hata yutuluyor, hiçbir yere de
// yazılmıyordu. Yani yayın tamamen çalışmaz hâle gelse — io kurulmamış, payload
// serileştirilemiyor, oda adı bozuk — kayıtlarda tek satır iz kalmıyordu.
// Belirti "gerçek zamanlı bazen çalışmıyor" olurdu ve bunun teşhisi, bu depoda
// bir toplantıyı yakan sınıfın ta kendisi.
//
// CLAUDE.md'deki kural: koşulun yokluk hâli ya reddetmeli ya gürültü
// çıkarmalı — sessizce atlamamalı. `recordAudit` bu kurala uyuyordu
// (başarısızlığı `console.warn`a yazar), yayın kodu uymuyordu. Fark kapatıldı.
//
// `io`nun hiç olmaması ayrı bir durum ve daha ciddisi: tek bir isteğin yayını
// değil, sürecin tamamının yayın yeteneği yok demektir. O yüzden ayrı mesajla
// raporlanıyor.

/**
 * Soket yayınını güvenli biçimde çalıştırır.
 *
 * @param io          Socket.IO sunucusu (yoksa uyarı basılır)
 * @param olay        Kayıtta görünecek olay adı — teşhisi mümkün kılan tek şey
 * @param fn          Yayını yapan işlev; `io` argümanıyla çağrılır
 * @returns {boolean} Yayın yapıldıysa true
 */
export function emitSafely(io, olay, fn) {
  if (!io) {
    console.warn('[socket] io yok, olay gönderilemedi:', olay);
    return false;
  }
  try {
    fn(io);
    return true;
  } catch (err) {
    console.warn('[socket] yayın başarısız:', olay, err?.message || err);
    return false;
  }
}

/**
 * Aktif alan değişti — kullanıcının BÜTÜN açık sekmelerine (#289).
 *
 * Alanı değiştiren üç yol vardı ve üçü farklı davranıyordu: tarayıcının
 * soket olayı yalnızca o sokete haber veriyordu (`socket.emit`), REST ucu
 * (MCP'nin set_active_workspace'i buradan geçer) hiç haber vermiyordu, alan
 * açma / kodla katılma da vermiyordu. Sonuç: Claude alanı değiştirince ya da
 * ikinci sekmede alan değiştirilince açık sekme eski alanda kalıyor, F5
 * istiyordu. `currentWorkspaceId`'yi yazan her yer bunu çağırır; oda
 * kullanıcının kendi odası (user_<id>), yani yalnızca o kişinin sekmeleri.
 */
export function alanGecisiYayini(io, userId, workspaceId) {
  return emitSafely(io, 'workspace_switched', (s) => {
    s.to(`user_${userId}`).emit('workspace_switched', { workspace_id: workspaceId });
  });
}
