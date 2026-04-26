// Notifications panel — API-backed

function NotifPanel({ open, onClose, socket }) {
  const [tab, setTab]     = React.useState('all');
  const [items, setItems] = React.useState(() => DATA.NOTIFICATIONS || []);

  // Update when panel opens OR when new notifications arrive
  React.useEffect(() => {
    if (open) {
      // Fetch from API when opening
      API.getNotifications()
        .then(notifs => { setItems(notifs); DATA.NOTIFICATIONS = notifs; })
        .catch(() => {});
    }
  }, [open]);

  // Listen for real-time notifications — re-register when socket prop changes
  React.useEffect(() => {
    const sock = socket || window.SOCKET;
    if (!sock) return;

    const onNewNotification = (notif) => {
      setItems(prev => {
        if (prev.some(n => n.id === notif.id)) return prev;
        const newItems = [notif, ...prev];
        DATA.NOTIFICATIONS = newItems;
        return newItems;
      });
    };

    sock.on('notification', onNewNotification);
    return () => sock.off('notification', onNewNotification);
  }, [socket]);

  const markRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    try { await API.markRead(id); } catch (_) {}
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, unread: false })));
    try { await API.markAllRead(); } catch (_) {}
  };

  const dismiss = async (e, id) => {
    e.stopPropagation();
    setItems(prev => prev.filter(n => n.id !== id));
    try { await API.deleteNotif(id); } catch (_) {}
  };

  const filtered    = tab === 'unread' ? items.filter(n => n.unread) : items;
  const unreadCount = items.filter(n => n.unread).length;

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 69 }} onClick={onClose} />}
      <div className="notif-panel" data-open={open}>
        <div className="notif-head">
          <div className="notif-title">Bildirimler</div>
          {unreadCount > 0 && <div className="notif-count">{unreadCount}</div>}
          <div className="notif-tabs">
            <button data-active={tab === 'all'}    onClick={() => setTab('all')}>Tümü</button>
            <button data-active={tab === 'unread'} onClick={() => setTab('unread')}>Okunmamış</button>
          </div>
        </div>

        <div className="notif-list">
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              <Icon name="check" size={20} /><br />Hepsi bu kadar.
            </div>
          )}
          {filtered.map(n => (
            <div
              key={n.id}
              className="notif-item"
              data-unread={n.unread}
              onClick={() => markRead(n.id)}
              style={{ position: 'relative' }}
            >
              <div className="notif-body">
                <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                <div className="notif-time">{n.time}</div>
              </div>
              <button
                onClick={(e) => dismiss(e, n.id)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-faint)', padding: 2, lineHeight: 1,
                }}
                title="Kaldır"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', fontSize: 12 }}>
          <button style={{ color: 'var(--ink-muted)' }} onClick={markAllRead}>
            Tümünü okundu işaretle
          </button>
          <button style={{ marginLeft: 'auto', color: 'var(--ink-muted)' }} onClick={onClose}>
            Kapat <Icon name="arrowRight" size={11} />
          </button>
        </div>
      </div>
    </>
  );
}

window.NotifPanel = NotifPanel;
