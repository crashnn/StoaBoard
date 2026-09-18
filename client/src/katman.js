// Geri tuşu en üstteki katmanı kapatsın (kart #252) — saf yönetici.
//
// KUSUR (18 Eylül 2026, sade tur 2): "kart açıp geri tuşu ile kartı
// kapatabiliyoruz ancak new task deyip gelen ekranda yaparsak new task ekranı
// gitmiyor." #228 görünümleri ve kart çekmecesini adrese bağlamıştı; açılır
// katmanlar (Yeni görev penceresi, komut paleti, bildirim paneli, sohbet
// paneli, mobil yan menü) geçmişte iz bırakmıyordu. Geri tuşu katmanı
// atlayıp alttaki ekranı değiştiriyordu. Mobilde kullanıcının refleksi
// "geri = en üstteki katmanı kapat".
//
// ── Nasıl ─────────────────────────────────────────────────────────────────
//
// Katman açılınca geçmişe AYNI adresle bir kayıt eklenir (yalnızca state).
// Geri tuşu o kaydı tüketir; `popstate` burada en üstteki katmanı kapatır ve
// yönlendirme YAPILMAZ (adres zaten aynı).
//
// Katman arayüzden kapanırsa (X, Esc, dışarı tıklama) eklediğimiz kayıt
// `history.back()` ile geri alınır — yoksa bir sonraki geri tuşu "hiçbir şey
// yapmıyor" gibi görünür. O `back()`in doğuracağı `popstate` BİZİM
// isteğimizdir, yutulur (`bekleyen` sayacı).
//
// ── Eşzamansızlık tuzağı ──────────────────────────────────────────────────
//
// `back()` eşzamansız. Kullanıcı katmanı kapatırken aynı anda ekran
// değiştirirse (paletten "Sohbet"), yeni adres ÖNCE yazılır ve geç gelen
// back() onu siler. Bu yüzden `bekliyor()` doğruyken app.jsx'in adres etkisi
// yazmıyor; yutulan `popstate`ten sonra adres yeniden eşitleniyor.
//
// Saf: geçmiş nesnesi dışarıdan veriliyor, test sahte bir geçmişle koşuyor.

export function katmanYoneticisi(gecmis) {
  const yigin = []; // { id, kapat } — en üstteki sonda
  let sayac = 0;
  let bekleyen = 0; // kendi back() çağrılarımızın doğuracağı popstate sayısı

  return {
    /** Katman açıldı: kayıt ekle, kimliği dön. */
    ac(kapat) {
      const id = ++sayac;
      // Mevcut state korunuyor: #228'in `kart` / `kartItildi` alanları katman
      // kaydının altında kaybolmasın.
      gecmis.pushState({ ...(gecmis.state || {}), katman: id }, '');
      yigin.push({ id, kapat });
      return id;
    },

    /**
     * Katman kapandı. Yığında hâlâ duruyorsa arayüzden kapanmıştır: kaydını
     * geri al. Yığında yoksa geri tuşuyla kapanmıştır (popstate zaten çıkardı).
     */
    kapandi(id) {
      const i = yigin.findIndex((k) => k.id === id);
      if (i === -1) return;
      yigin.splice(i, 1);
      bekleyen++;
      gecmis.back();
    },

    /**
     * popstate geldi. 'yut' — kendi back()'imiz; 'kapatti' — geri tuşu en
     * üstteki katmanı kapattı; null — katman işi değil, çağıran yönlendirsin.
     */
    popstate() {
      if (bekleyen > 0) { bekleyen--; return 'yut'; }
      const ust = yigin.pop();
      if (!ust) return null;
      ust.kapat();
      return 'kapatti';
    },

    /** Kendi back()'imiz yolda mı — yoldaysa adres yazılmamalı. */
    bekliyor() { return bekleyen > 0; },

    acikSayisi() { return yigin.length; },
  };
}
