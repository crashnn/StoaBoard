// Notifications panel
// Gerçek backend API + SocketIO anlık bildirim desteği

function NotifPanel({ open, onClose }) {
  const [tab, setTab] = React.useState('all');
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // ── İlk yüklemede backend'den çek ───────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/notifications', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  // ── SocketIO: anlık bildirim dinle ───────────────────────────────────────
  React.useEffect(() => {
    if (typeof window.socket === 'undefined') return;

    const handler = (notif) => {
      setItems(prev => [notif, ...prev]);
    };

    window.socket.on('notification', handler);
    return () => window.socket.off('notification', handler);
  }, []);

  const filtered = tab === 'unread' ? items.filter(n => n.unread) : items;
  const unreadCount = items.filter(n => n.unread).length;

  // ── Tek bildirimi okundu işaretle ────────────────────────────────────────
  const markRead = (notif) => {
    if (!notif.unread) return;
    fetch(`/api/notifications/${notif.id}/read`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setItems(prev => prev.map(x => x.id === notif.id ? { ...x, unread: false } : x));
  };

  // ── Tümünü okundu işaretle ───────────────────────────────────────────────
  const markAllRead = () => {
    fetch('/api/notifications/read-all', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setItems(prev => prev.map(x => ({ ...x, unread: false })));
  };

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 69 }} onClick={onClose} />}
      <div className="notif-panel" data-open={open}>
        <div className="notif-head">
          <div className="notif-title">Bildirimler</div>
          {unreadCount > 0 && <div className="notif-count">{unreadCount}</div>}
          <div className="notif-tabs">
            <button data-active={tab === 'all'} onClick={() => setTab('all')}>Tümü</button>
            <button data-active={tab === 'unread'} onClick={() => setTab('unread')}>Okunmamış</button>
          </div>
        </div>

        <div className="notif-list">
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              Yükleniyor...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              <Icon name="check" size={20} /><br />
              Hepsi bu kadar.
            </div>
          )}
          {!loading && filtered.map(n => (
            <div
              key={n.id}
              className="notif-item"
              data-unread={n.unread}
              onClick={() => markRead(n)}
            >
              <div className="notif-body">
                <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', fontSize: 12 }}>
          <button style={{ color: 'var(--ink-muted)' }} onClick={markAllRead}>
            Tümünü okundu işaretle
          </button>
          <button style={{ marginLeft: 'auto', color: 'var(--ink-muted)' }}>
            Ayarlar <Icon name="arrowRight" size={11} />
          </button>
        </div>
      </div>
    </>
  );
}

window.NotifPanel = NotifPanel;