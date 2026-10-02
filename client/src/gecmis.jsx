// Kartın geçmişi — kim, ne zaman, hangi kolona taşıdı.
//
// NİÇİN VAR (2 Ekim 2026 taraması, madde B): "bu kart neden burada, kim
// taşıdı?" sorusunun cevabı arayüzde hiç yoktu. Kart kolondan kolona
// geçiyor, kimse kimin taşıdığını göremiyordu.
//
// Veri yeni DEĞİL: `task_transitions` her geçişi zaten yazıyordu (raporlar
// onu kullanıyor) ve `taskId` indeksliydi. Eksik olan yalnızca okuma ucu ve
// bu bölümdü.
//
// KOLON ADLARI DONMUŞ GELİYOR ve bu DOĞRU: kayıt, geçişin yaşandığı andaki
// adı taşıyor. Kolon sonradan yeniden adlandırılsa bile "o gün hangi kolona
// taşındı" cevabı değişmemeli. #331'in yasağı bugünün adını dondurmakla
// ilgiliydi; burada gösterilen şey tarihin kendisi.

import { useState, useEffect, useCallback } from 'react';
import { Icon } from './icons.jsx';

const T = (k, fb) => (window.t?.(k) !== k && window.t?.(k)) || fb;

function GecmisSection({ taskId }) {
  const [moves, setMoves] = useState([]);
  const [createdAt, setCreatedAt] = useState(null);
  const [durum, setDurum] = useState('yukleniyor'); // yukleniyor | hazir | hata
  const [acik, setAcik] = useState(false);

  const yukle = useCallback(async () => {
    if (!taskId) return;
    setDurum('yukleniyor');
    try {
      const d = await window.API.gorevGecmisi(taskId);
      setMoves(d.moves || []);
      setCreatedAt(d.created_at || null);
      setDurum('hazir');
    } catch (e) {
      // Sessiz boş liste YOK: "geçmiş yok" ile "geçmişi alamadım" ayrı
      // şeyler ve ikincisi kullanıcıya söylenmeli.
      console.warn('[gecmis] load failed:', e?.message);
      setDurum('hata');
    }
  }, [taskId]);

  useEffect(() => { if (acik) yukle(); }, [acik, yukle]);

  // Kart değişince kapalıya dön: açık kalsa önceki kartın geçmişi bir an
  // yeni kartınmış gibi görünürdü.
  useEffect(() => { setAcik(false); setMoves([]); setDurum('yukleniyor'); }, [taskId]);

  const zaman = (iso) => (window.DATA?.fmtTimeAgo ? window.DATA.fmtTimeAgo(iso) : new Date(iso).toLocaleString());

  return (
    <div className="drw-sec">
      <h3 className="drw-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {T('drawer_history', 'Geçmiş')}
        <button
          type="button" className="btn btn-ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => setAcik((o) => !o)}
        >
          {acik ? T('drawer_history_hide', 'Gizle') : T('drawer_history_show', 'Göster')}
        </button>
      </h3>

      {acik && durum === 'yukleniyor' && (
        <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{T('drawer_loading', 'Yükleniyor…')}</div>
      )}
      {acik && durum === 'hata' && (
        <div style={{ fontSize: 12, color: 'var(--status-rose)' }}>
          {T('drawer_history_failed', 'Geçmiş alınamadı')}
        </div>
      )}
      {acik && durum === 'hazir' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {moves.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              {T('drawer_history_empty', 'Bu kart hiç taşınmamış.')}
            </div>
          )}
          {moves.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
              <Icon name="arrowRight" size={11} />
              <span style={{ color: 'var(--ink)' }}>{m.user_name || T('drawer_history_someone', 'Biri')}</span>
              <span style={{ color: 'var(--ink-muted)' }}>
                {m.from ? `${m.from} → ${m.to}` : m.to}
              </span>
              <span style={{ color: 'var(--ink-faint)', marginLeft: 'auto' }}>{zaman(m.at)}</span>
            </div>
          ))}
          {createdAt && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
              <Icon name="plus" size={11} />
              <span style={{ color: 'var(--ink-muted)' }}>{T('drawer_history_created', 'Kart açıldı')}</span>
              <span style={{ color: 'var(--ink-faint)', marginLeft: 'auto' }}>{zaman(createdAt)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { GecmisSection };
