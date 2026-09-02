// Göreve harcanan süre — manuel giriş ve liste.
//
// Kasten manuel: otomatik sayaç, geliştiricinin gerçekten ne kadar çalıştığını
// değil, sekmenin ne kadar açık kaldığını ölçüyor. Kurumsal raporlamada istenen
// veri beyan edilmiş emek.
//
// Kişi kendi süresini girer. Başkasının kaydını yalnızca görev yönetme izni
// olan silebilir; sunucu tarafında da aynı kural uygulanıyor.

import { useState, useEffect, useCallback } from 'react';
import { Icon } from './icons.jsx';

// Çeviri: anahtar yoksa window.t anahtarın kendisini döndürür, o yüzden
// karşılaştırıp Türkçe yedeğe düşüyoruz. reports.jsx ile aynı yardımcı.
const T = (k, fb) => (window.t?.(k) !== k && window.t?.(k)) || fb;

// Sunucu hata kodunu çevirir; sözlükte yoksa sunucunun gönderdiği metne düşer.
const apiError = (e, fbKey, fb) => (e?.code && T(e.code, e.message)) || e?.message || T(fbKey, fb);

const todayIso = () => new Date().toISOString().slice(0, 10);

function WorkLogSection({ taskId }) {
  const [logs, setLogs] = useState([]);
  const [totalLabel, setTotalLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState('');
  const [spentOn, setSpentOn] = useState(todayIso);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const d = await API.getWorkLogs(taskId);
      setLogs(d.logs || []);
      setTotalLabel(d.total_minutes_label || '');
    } catch (e) {
      setError(apiError(e, 'wl_err_load', 'Süre kayıtları alınamadı'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const raw = duration.trim();
    if (!raw || saving) return;
    setSaving(true);
    setError(null);
    try {
      await API.addWorkLog(taskId, {
        minutes: raw,
        spent_on: spentOn,
        note: note.trim() || undefined,
      });
      setDuration('');
      setNote('');
      await load();
    } catch (err) {
      // Biçim, ileri tarih ve 24 saat sınırı hatalarının hepsi sunucudan kodla
      // geliyor ve sözlükte karşılıkları var; apiError üçünü de çeviriyor.
      setError(apiError(err, 'wl_err_save', 'Süre kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await API.deleteWorkLog(id);
      await load();
    } catch (err) {
      setError(apiError(err, 'wl_err_delete', 'Kayıt silinemedi'));
    }
  };

  return (
    <div className="worklog-section">
      <h3 className="worklog-title">
        {T('wl_title', 'Harcanan süre')}
        {totalLabel && <span className="worklog-total">· {totalLabel}</span>}
      </h3>

      {!open ? (
        <button className="worklog-add-btn" onClick={() => setOpen(true)}>
          <Icon name="clock" size={13} /> {T('wl_add', 'Süre ekle')}
        </button>
      ) : (
        <form className="worklog-form" onSubmit={submit}>
          <div className="worklog-form-row">
            <input
              className="worklog-input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={T('wl_placeholder', '1s 30d')}
              title={T('wl_format_hint', 'Kabul edilen biçimler: 90 (dakika), 1:30, "1s 30d"')}
              autoFocus
            />
            <input
              className="worklog-input worklog-date"
              type="date"
              value={spentOn}
              max={todayIso()}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </div>
          <input
            className="worklog-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={T('wl_note_placeholder', 'Not (isteğe bağlı)')}
          />
          <div className="worklog-form-row">
            <button className="btn btn-primary" type="submit" disabled={saving || !duration.trim()}>
              {saving ? T('wl_saving', 'Kaydediliyor…') : T('wl_save', 'Kaydet')}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => { setOpen(false); setError(null); setDuration(''); setNote(''); }}
            >
              {T('wl_cancel', 'Vazgeç')}
            </button>
          </div>
        </form>
      )}

      {error && <div className="worklog-error">{error}</div>}

      {loading && !logs.length && <div className="worklog-empty">{T('wl_loading', 'Yükleniyor…')}</div>}

      {!loading && !logs.length && !open && (
        <div className="worklog-empty">{T('wl_empty', 'Bu göreve henüz süre girilmedi.')}</div>
      )}

      {logs.length > 0 && (
        <div className="worklog-list">
          {logs.map((l) => (
            <div className="worklog-row" key={l.id}>
              <span className="worklog-row-time">{l.minutes_label}</span>
              <span className="worklog-row-main">
                <span className="worklog-row-who">{l.user_name || T('wl_unknown', 'Bilinmeyen')}</span>
                {l.note && <span className="worklog-row-note">{l.note}</span>}
              </span>
              <span className="worklog-row-date">{l.spent_on}</span>
              {l.is_mine && (
                <button
                  className="worklog-row-del"
                  title={T('wl_delete', 'Kaydı sil')}
                  onClick={() => remove(l.id)}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { WorkLogSection };
export default WorkLogSection;
