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
      setError(e.message || 'Süre kayıtları alınamadı');
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
      setError(
        err.code === 'err_bad_duration'
          ? 'Süre anlaşılamadı. Örnek: 90, 1:30 veya "1s 30d".'
          : err.code === 'err_future_date'
            ? 'İleri bir tarihe süre girilemez.'
            : err.code === 'err_duration_too_long'
              ? 'Tek kayıt en fazla 24 saat olabilir.'
              : (err.message || 'Süre kaydedilemedi'),
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await API.deleteWorkLog(id);
      await load();
    } catch (err) {
      setError(err.message || 'Kayıt silinemedi');
    }
  };

  return (
    <div className="worklog-section">
      <h3 className="worklog-title">
        Harcanan süre
        {totalLabel && <span className="worklog-total">· {totalLabel}</span>}
      </h3>

      {!open ? (
        <button className="worklog-add-btn" onClick={() => setOpen(true)}>
          <Icon name="clock" size={13} /> Süre ekle
        </button>
      ) : (
        <form className="worklog-form" onSubmit={submit}>
          <div className="worklog-form-row">
            <input
              className="worklog-input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="1s 30d"
              title='Kabul edilen biçimler: 90 (dakika), 1:30, "1s 30d"'
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
            placeholder="Not (isteğe bağlı)"
          />
          <div className="worklog-form-row">
            <button className="btn btn-primary" type="submit" disabled={saving || !duration.trim()}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => { setOpen(false); setError(null); setDuration(''); setNote(''); }}
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {error && <div className="worklog-error">{error}</div>}

      {loading && !logs.length && <div className="worklog-empty">Yükleniyor…</div>}

      {!loading && !logs.length && !open && (
        <div className="worklog-empty">Bu göreve henüz süre girilmedi.</div>
      )}

      {logs.length > 0 && (
        <div className="worklog-list">
          {logs.map((l) => (
            <div className="worklog-row" key={l.id}>
              <span className="worklog-row-time">{l.minutes_label}</span>
              <span className="worklog-row-main">
                <span className="worklog-row-who">{l.user_name || 'Bilinmeyen'}</span>
                {l.note && <span className="worklog-row-note">{l.note}</span>}
              </span>
              <span className="worklog-row-date">{l.spent_on}</span>
              {l.is_mine && (
                <button
                  className="worklog-row-del"
                  title="Kaydı sil"
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
