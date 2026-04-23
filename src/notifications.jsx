// Notifications panel

function NotifPanel({ open, onClose }) {
  const [tab, setTab] = React.useState('all');
  const [items, setItems] = React.useState(DATA.NOTIFICATIONS);
  const filtered = tab === 'unread' ? items.filter(n => n.unread) : items;
  const unreadCount = items.filter(n => n.unread).length;

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
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              <Icon name="check" size={20} /><br />
              Hepsi bu kadar.
            </div>
          )}
          {filtered.map(n => (
            <div key={n.id} className="notif-item" data-unread={n.unread} onClick={() => setItems(items.map(x => x.id === n.id ? { ...x, unread: false } : x))}>
              <div className="notif-body">
                <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', fontSize: 12 }}>
          <button style={{ color: 'var(--ink-muted)' }} onClick={() => setItems(items.map(x => ({ ...x, unread: false })))}>
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
