// Raporlar — kişi, dönem ve akış raporları.
//
// Üç rapor da aynı iki kaynaktan çıkar: kolon geçiş kaydı (süreç zamanı) ve
// süre kaydı (harcanan emek). İkisi ayrı şeydir: bir iş üç haftada bitmiş ama
// altı saat emek almış olabilir.
//
// Çıktı iki biçimde alınır: CSV (yöneticiler veriyi kendi kesip biçer) ve
// yazdırma (tarayıcı PDF'e çevirir). Ayrı bir PDF kütüphanesi bilinçli olarak
// eklenmedi — yazdırma sayfası aynı işi görüyor.

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../icons.jsx';

const T = (k, fb) => (window.t?.(k) !== k && window.t?.(k)) || fb;

const iso = (d) => d.toISOString().slice(0, 10);

function presetRange(key) {
  const today = new Date();
  const to = iso(today);
  const d = new Date(today);
  switch (key) {
    case 'month':
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case 'q':
      d.setMonth(d.getMonth() - 3);
      return { from: iso(d), to };
    case 'half':
      d.setMonth(d.getMonth() - 6);
      return { from: iso(d), to };
    case 'year':
      return { from: iso(new Date(today.getFullYear(), 0, 1)), to };
    default:
      d.setDate(d.getDate() - 30);
      return { from: iso(d), to };
  }
}

const PRESETS = [
  { key: 'month', label: 'Bu ay' },
  { key: 'q', label: 'Son 3 ay' },
  { key: 'half', label: 'Son 6 ay' },
  { key: 'year', label: 'Bu yıl' },
];

const KINDS = [
  { key: 'person', label: 'Kişi raporu', sub: 'Kim, hangi işte, ne kadar süre' },
  { key: 'period', label: 'Dönem raporu', sub: 'Ne açıldı, ne bitti, ne bekliyor' },
  { key: 'flow', label: 'Akış raporu', sub: 'İşler kaç günde bitiyor' },
  // Denetim kaydı yalnızca çalışma alanını yönetenlere gösterilir; sunucu
  // tarafında da aynı kontrol var, buradaki gizleme yalnızca arayüz kolaylığı.
  { key: 'audit', label: 'Denetim kaydı', sub: 'Veriyi kim dışarı çıkardı', admin: true },
];

// Eylem adlarının okunabilir karşılığı.
const ACTION_LABEL = {
  'report.export': 'Rapor dışa aktarıldı',
  'member.removed': 'Üye çıkarıldı',
  'member.role_changed': 'Üye rolü değişti',
  'invite.code_viewed': 'Davet kodu görüntülendi',
  'workspace.trash_emptied': 'Çöp kutusu boşaltıldı',
};

const REPORT_LABEL = { person: 'Kişi', period: 'Dönem', flow: 'Akış' };

function ReportsView({ onOpenTask, canManageWorkspace = false }) {
  const [kind, setKind] = useState('person');
  const [range, setRange] = useState(() => presetRange('month'));
  const [person, setPerson] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const workspaceId = DATA.WORKSPACE?.id;

  const params = useCallback(() => {
    const p = { workspace: workspaceId, from: range.from, to: range.to };
    if (kind === 'person' && person) p.user = person;
    return p;
  }, [workspaceId, range.from, range.to, kind, person]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    API.getReport(kind, params())
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Rapor alınamadı'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, params, workspaceId]);

  const visibleKinds = KINDS.filter((k) => !k.admin || canManageWorkspace);
  // Denetim kaydı CSV olarak dışa aktarılmıyor: dışa aktarmayı izleyen kaydın
  // kendisinin tek tıkla dosyaya dönmesi anlamsız olurdu.
  const csvHref = workspaceId && kind !== 'audit' ? API.reportCsvUrl(kind, params()) : null;
  const activeKind = KINDS.find((k) => k.key === kind);

  const rangeLabel = `${range.from} → ${range.to}`;

  return (
    <div className="dash report-view">
      <div className="report-head">
        <div>
          <div className="dash-h1">{T('nav_reports', 'Raporlar')}</div>
          <div className="dash-sub">{activeKind?.sub}</div>
        </div>
        <div className="report-actions no-print">
          {csvHref && (
            <a
              className="btn btn-ghost"
              href={csvHref}
              download
              title="Excel ile açılabilir CSV indir"
            >
              <Icon name="download" size={14} /> CSV
            </a>
          )}
          <button className="btn btn-ghost" onClick={() => window.print()} title="Yazdır veya PDF olarak kaydet">
            <Icon name="file" size={14} /> Yazdır
          </button>
        </div>
      </div>

      {/* Yazdırma çıktısında görünen künye */}
      <div className="report-stamp print-only">
        <strong>{DATA.WORKSPACE?.name || 'StoaBoard'}</strong> — {activeKind?.label} · {rangeLabel}
      </div>

      <div className="report-controls no-print">
        <div className="report-tabs">
          {visibleKinds.map((k) => (
            <button
              key={k.key}
              className="filter-chip"
              data-active={kind === k.key}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="report-range">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className="filter-chip"
              onClick={() => setRange(presetRange(p.key))}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
          <span className="report-range-sep">→</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>

        {kind === 'person' && (
          <div className="report-range">
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">Herkes</option>
              {(DATA.MEMBERS || []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <div className="dash-empty-state">Rapor hazırlanıyor…</div>}
      {error && <div className="dash-empty-state">{error}</div>}

      {!loading && !error && data && (
        <>
          {data.scoped_to_self && (
            <div className="report-note">
              Yalnızca kendi kayıtlarınız gösteriliyor. Diğer kişilerin raporu için
              üye yönetimi izni gerekiyor.
            </div>
          )}
          {kind === 'person' && <PersonReport data={data} onOpenTask={onOpenTask} />}
          {kind === 'period' && <PeriodReport data={data} onOpenTask={onOpenTask} />}
          {kind === 'flow' && <FlowReport data={data} onOpenTask={onOpenTask} />}
          {kind === 'audit' && <AuditReport data={data} />}
        </>
      )}
    </div>
  );
}

// ─── Kişi raporu ────────────────────────────────────────────────────────────

function PersonReport({ data, onOpenTask }) {
  if (!data.people?.length) {
    return <div className="dash-empty-state">Bu aralıkta kayıt yok.</div>;
  }
  return (
    <div className="report-body">
      {data.people.map((p) => (
        <div className="panel" key={p.user_id ?? p.name}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{p.name}</div>
              <div className="panel-sub">
                {p.tasks.length} görev · {p.moves} hareket · {p.completed} tamamlama
              </div>
            </div>
            <div className="report-total">{p.minutes_label}</div>
          </div>
          <div className="panel-body">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Görev</th>
                  <th style={{ width: 90 }}>Süre</th>
                  <th style={{ width: 90 }}>Hareket</th>
                  <th style={{ width: 110 }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {p.tasks.map((t) => (
                  <tr
                    key={t.task_id ?? t.title}
                    onClick={() => t.task_id && onOpenTask?.(String(t.task_id))}
                  >
                    <td className="title">{t.title}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {t.minutes ? formatMin(t.minutes) : '—'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{t.moves}</td>
                    <td>{t.completed ? 'Tamamlandı' : 'Devam ediyor'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dönem raporu ───────────────────────────────────────────────────────────

function PeriodReport({ data, onOpenTask }) {
  return (
    <div className="report-body">
      <div className="report-stats">
        <Stat label="Açılan" value={data.created} />
        <Stat label="Tamamlanan" value={data.completed} />
        <Stat label="Hareket" value={data.moves} />
        <Stat label="Açık kalan" value={data.open} />
        <Stat label="Toplam emek" value={data.total_minutes_label} />
      </div>

      {data.by_column?.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Kolon hareketleri</div>
          </div>
          <div className="panel-body">
            <div className="report-bars">
              {(() => {
                const max = Math.max(...data.by_column.map((c) => c.count), 1);
                return data.by_column.map((c) => (
                  <div className="report-bar-row" key={c.label}>
                    <span className="report-bar-label">{c.label}</span>
                    <span className="report-bar-track">
                      <span
                        className="report-bar-fill"
                        style={{ width: `${(c.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="report-bar-value">{c.count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Tamamlanan işler</div>
            <div className="panel-sub">{data.completed_tasks?.length || 0} kayıt</div>
          </div>
        </div>
        <div className="panel-body">
          {data.completed_tasks?.length ? (
            <table className="list-table">
              <thead>
                <tr>
                  <th>Görev</th>
                  <th style={{ width: 100 }}>Açılış</th>
                  <th style={{ width: 110 }}>Tamamlanma</th>
                  <th style={{ width: 90 }}>Geçen gün</th>
                  <th style={{ width: 90 }}>Emek</th>
                </tr>
              </thead>
              <tbody>
                {data.completed_tasks.map((t) => (
                  <tr key={t.task_id} onClick={() => onOpenTask?.(String(t.task_id))}>
                    <td className="title">{t.title}</td>
                    <td>{t.created_at || '—'}</td>
                    <td>{t.completed_at || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {t.cycle_days === null ? '—' : t.cycle_days}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {t.minutes ? t.minutes_label : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dash-empty-state">Bu aralıkta tamamlanan iş yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Akış raporu ────────────────────────────────────────────────────────────

function FlowReport({ data, onOpenTask }) {
  return (
    <div className="report-body">
      <div className="report-stats">
        <Stat label="Tamamlanan iş" value={data.count} />
        <Stat label="Ortalama süre" value={`${data.avg_days} gün`} />
        <Stat label="Ortanca süre" value={`${data.median_days} gün`} />
      </div>

      {data.dwell?.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Kolonlarda bekleme</div>
              <div className="panel-sub">İşler en çok nerede bekliyor</div>
            </div>
          </div>
          <div className="panel-body">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Kolon</th>
                  <th style={{ width: 120 }}>Ortalama</th>
                  <th style={{ width: 120 }}>Ortanca</th>
                  <th style={{ width: 90 }}>Ölçüm</th>
                </tr>
              </thead>
              <tbody>
                {data.dwell.map((d) => (
                  <tr key={d.label} style={{ cursor: 'default' }}>
                    <td className="title">{d.label}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtHours(d.avg_hours)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtHours(d.median_hours)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">En uzun süren işler</div>
            <div className="panel-sub">Açılıştan tamamlanmaya</div>
          </div>
        </div>
        <div className="panel-body">
          {data.slowest?.length ? (
            <table className="list-table">
              <thead>
                <tr>
                  <th>Görev</th>
                  <th style={{ width: 100 }}>Gün</th>
                  <th style={{ width: 120 }}>Tamamlanma</th>
                </tr>
              </thead>
              <tbody>
                {data.slowest.map((t) => (
                  <tr key={t.task_id} onClick={() => onOpenTask?.(String(t.task_id))}>
                    <td className="title">{t.title}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{t.days}</td>
                    <td>{t.completed_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dash-empty-state">Bu aralıkta tamamlanan iş yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Denetim kaydı ──────────────────────────────────────────────────────────

function AuditReport({ data }) {
  const entries = data.entries || [];
  if (!entries.length) {
    return <div className="dash-empty-state">Bu aralıkta kayıt yok.</div>;
  }
  const exports = entries.filter((e) => e.action === 'report.export').length;
  return (
    <div className="report-body">
      <div className="report-stats">
        <Stat label="Toplam olay" value={entries.length} />
        <Stat label="Dışa aktarma" value={exports} />
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Olaylar</div>
            <div className="panel-sub">En yeniden eskiye</div>
          </div>
        </div>
        <div className="panel-body">
          <table className="list-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>Zaman</th>
                <th style={{ width: 140 }}>Kişi</th>
                <th>Olay</th>
                <th style={{ width: 130 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ cursor: 'default' }}>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.at ? new Date(e.at).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td>{e.user_name}</td>
                  <td className="title">
                    {ACTION_LABEL[e.action] || e.action}
                    {e.detail && <AuditDetail detail={e.detail} />}
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuditDetail({ detail }) {
  if (detail.report) {
    return (
      <span className="audit-detail">
        {REPORT_LABEL[detail.report] || detail.report} raporu ·{' '}
        {detail.from} → {detail.to} · {detail.rows} satır
      </span>
    );
  }
  return null;
}

// ─── Küçük parçalar ─────────────────────────────────────────────────────────

function Stat({ label, value }) {
  return (
    <div className="report-stat">
      <div className="report-stat-value">{value}</div>
      <div className="report-stat-label">{label}</div>
    </div>
  );
}

function formatMin(m) {
  const min = Math.max(0, Math.round(m || 0));
  const h = Math.floor(min / 60);
  const r = min % 60;
  if (!h) return `${r}d`;
  if (!r) return `${h}s`;
  return `${h}s ${r}d`;
}

function fmtHours(h) {
  if (h == null) return '—';
  if (h < 24) return `${h} sa`;
  return `${Math.round((h / 24) * 10) / 10} gün`;
}

export { ReportsView };
export default ReportsView;
