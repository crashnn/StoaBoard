/**
 * `?` ile açılan kısayol yardımı.
 *
 * NİÇİN VAR: kısayollar vardı ama keşfedilemiyordu. Ayarlarda bir sayfa
 * duruyor — oraya gitmek için akışı bırakmak gerekiyor, ve dört kısayol
 * (`G+N`, `G+R`, `G+T`, `G+D`) orada hiç yazılı DEĞİLDİ, yani çalıştıkları
 * hâlde kimse bilmiyordu.
 *
 * LİSTE BURADA DEĞİL. İçerik `kisayollar.js`ten geliyor, yani bu ekran
 * bayatlayamaz: yeni bir kısayol eklenince burada kendiliğinden görünür,
 * kaldırılınca kendiliğinden kaybolur. İkinci bir liste tutmak bu turda
 * kapatılan kusurun ta kendisiydi.
 *
 * ÖZELLEŞTİRİLMİŞ ATAMALAR GÖSTERİLİYOR, varsayılan değil: kullanıcı
 * kısayolu değiştirdiyse burada kendi tuşunu görmeli, yoksa yardım ekranı
 * ona yanlış tuşu söyler.
 */

import { Icon } from './icons.jsx';
import { KISAYOLLAR, BOLUMLER, tusAtamalari } from './kisayollar.js';

export function KisayolYardimi({ open, onClose }) {
  if (!open) return null;

  let ozel = null;
  try { ozel = JSON.parse(localStorage.getItem('stoa.shortcuts') || 'null'); } catch { ozel = null; }
  const atamalar = tusAtamalari(ozel);
  const T = (k, fb) => window.t?.(k) || fb;

  return (
    <div className="kisayol-arka" onClick={onClose}>
      {/* Tıklama ARKA PLANA kaçmamalı: kutunun içine basmak kapatırdı. */}
      <div className="kisayol-kutu" onClick={(e) => e.stopPropagation()} role="dialog"
        aria-label={T('sct_help_title', 'Klavye kısayolları')}>
        <div className="kisayol-bas">
          <span className="kisayol-baslik">
            <Icon name="cmd" size={14} /> {T('sct_help_title', 'Klavye kısayolları')}
          </span>
          <button type="button" className="kisayol-kapat" onClick={onClose}
            title={T('ui_close', 'Kapat')}>
            <Icon name="x" size={13} />
          </button>
        </div>

        <div className="kisayol-bolumler">
          {BOLUMLER.map((bolum) => {
            const satirlar = bolum.idler
              .map((id) => KISAYOLLAR.find((k) => k.id === id))
              .filter(Boolean);
            if (satirlar.length === 0) return null;
            return (
              <div key={bolum.id} className="kisayol-bolum">
                <div className="kisayol-bolum-bas">{T(bolum.anahtar, bolum.yedek)}</div>
                {satirlar.map((k) => (
                  <div key={k.id} className="kisayol-satir">
                    <span className="kisayol-etiket">{T(k.anahtar, k.yedek)}</span>
                    <span className="kisayol-tuslar">
                      {(atamalar[k.id] || k.tuslar).map((t, i) => <kbd key={i}>{t}</kbd>)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="kisayol-ayak">
          {T('sct_help_foot', 'Kısayolları Ayarlar → Kısayollar altından değiştirebilirsin.')}
        </div>
      </div>
    </div>
  );
}
