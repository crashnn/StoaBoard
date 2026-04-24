// App shell: sidebar + topbar + shared bits

const { useState, useEffect } = React;

// ── Global Toast State ────────────────────────────────────────────────────
window.TOAST_QUEUE = [];
window.TOAST_LISTENER = null;

function showToast(message, type = 'info') {
  const id = Date.now() + Math.random();
  const toast = { id, message, type, _createdAt: Date.now() };
  window.TOAST_QUEUE.push(toast);
  if (window.TOAST_LISTENER) {
    window.TOAST_LISTENER([...window.TOAST_QUEUE]);
  }
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    window.TOAST_LISTENER = (newToasts) => setToasts(newToasts);
    
    // Auto-remove toasts after 4 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      window.TOAST_QUEUE = window.TOAST_QUEUE.filter(t => {
        return (now - (t._createdAt || now)) < 4000;
      });
      if (window.TOAST_LISTENER) {
        window.TOAST_LISTENER([...window.TOAST_QUEUE]);
      }
    }, 500);
    
    return () => {
      clearInterval(interval);
      window.TOAST_LISTENER = null;
    };
  }, []);

  const removeToast = (id) => {
    window.TOAST_QUEUE = window.TOAST_QUEUE.filter(t => t.id !== id);
    setToasts([...window.TOAST_QUEUE]);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            background: toast.type === 'message' ? 'var(--accent)' : 'var(--bg-raised)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: 300,
            wordWrap: 'break-word',
            pointerEvents: 'auto',
            animation: 'toastIn 0.3s ease-out',
            cursor: 'pointer'
          }}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function Avatar({ member, size = 'sm' }) {
  if (!member) return null;
  return (
    <div className="avatar" data-size={size} style={{ background: member.color || 'var(--ink-muted)' }} title={member.name}>
      {member.initials}
    </div>
  );
}

function AvatarStack({ members, size = 'sm', max = 4 }) {
  const shown = members.slice(0, max);
  const rest = members.length - max;
  return (
    <div className="avatar-stack">
      {shown.map(m => <Avatar key={m.id} member={m} size={size} />)}
      {rest > 0 && (
        <div className="avatar" data-size={size} style={{ background: 'var(--ink-dim)', color: 'var(--ink-2)' }}>
          +{rest}
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onCollapseToggle, view, onView, projects, members: membersProp, openCmd, onlineUsers, onChatOpen, onSwitchProject, onNewProject }) {
  const me = window.CURRENT_USER || {};
  const online = onlineUsers || new Set();
  const teamMembers = (membersProp || DATA.MEMBERS || []).filter(m => m.id !== me.id);

  return (
    <aside className="sidebar" data-collapsed={collapsed}>

      {/* Header — logo doubles as expand button when collapsed */}
      <div className="sidebar-header">
        <div
          className="sidebar-logo"
          onClick={collapsed ? onCollapseToggle : undefined}
          style={collapsed ? { cursor: 'pointer' } : undefined}
          title={collapsed ? 'Genişlet' : undefined}
        >
          <Icon name="bolt" size={16} strokeWidth={1.8} />
        </div>
        <div className="sidebar-logo-text">Stoa<em>Board</em></div>
        <button className="sidebar-collapse-btn" onClick={onCollapseToggle} title={collapsed ? 'Genişlet' : 'Daralt'}>
          <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={14} />
        </button>
      </div>

      <div className="workspace-switcher" title={DATA.WORKSPACE?.name || 'StoaBoard'}>
        <div className="ws-avatar">{(DATA.WORKSPACE?.name || 'S')[0].toUpperCase()}</div>
        <div className="ws-info">
          <div className="ws-name">{DATA.WORKSPACE?.name || 'StoaBoard'}</div>
          <div className="ws-sub">{DATA.MEMBERS.length} üye</div>
        </div>
        <div className="ws-arrow"><Icon name="chevronDown" size={14} /></div>
      </div>

      <div className="sidebar-search" onClick={openCmd}>
        <Icon name="search" size={14} />
        <span className="sidebar-label">Ara veya komut...</span>
        <kbd className="sidebar-label">⌘K</kbd>
      </div>

      <div className="sidebar-section">
        <NavItem icon="home"        label="Ana Sayfa"  sub="Home"     onClick={() => onView('dashboard')} active={view === 'dashboard'} />
        <NavItem icon="layoutBoard" label="Pano"       sub="Board"    onClick={() => onView('board')}     active={view === 'board'} />
        <NavItem icon="list"        label="Liste"      sub="List"     onClick={() => onView('list')}      active={view === 'list'} />
        <NavItem icon="calendar"    label="Takvim"     sub="Calendar" onClick={() => onView('calendar')}  active={view === 'calendar'} />
        <NavItem icon="msg"         label="Sohbet"     sub="Chat"     onClick={onChatOpen} />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Projeler</span>
          <button title="Yeni proje" onClick={onNewProject}><Icon name="plus" size={13} /></button>
        </div>
        {(projects || []).map(p => (
          <div className="project-item" key={p.id} onClick={() => onSwitchProject && onSwitchProject(p.id)}>
            <div className="project-dot" style={{ background: p.color }} />
            <span className="sidebar-label">{p.name}</span>
            <span className="project-meta">{p.open}</span>
          </div>
        ))}
        {(projects || []).length === 0 && (
          <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--ink-faint)' }}>
            <span className="sidebar-label">Henüz proje yok</span>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title"><span>Takım</span></div>
        {teamMembers.slice(0, 6).map(m => (
          <div className="project-item" key={m.id} onClick={() => onChatOpen && onChatOpen(m.id)}>
            <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
              <Avatar member={m} size="sm" />
              {online.has(m.id) && <span className="online-badge is-online" />}
            </div>
            <span className="sidebar-label">{m.name}</span>
            {online.has(m.id) && (
              <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--status-green)', flexShrink: 0 }} />
            )}
          </div>
        ))}
        {teamMembers.length === 0 && (
          <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--ink-faint)' }}>
            <span className="sidebar-label">Henüz başka üye yok</span>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <NavItem icon="settings" label="Ayarlar" sub="Settings" onClick={() => onView('settings')} active={view === 'settings'} />
        <div className="user-profile">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar member={me} size="md" />
            <span className="online-badge is-online" />
          </div>
          <div className="user-meta">
            <div className="user-name">{me.name}</div>
            <div className="user-status">Aktif</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, sub, badge, active, onClick }) {
  return (
    <div className="nav-item" data-active={!!active} onClick={onClick} title={sub}>
      <Icon name={icon} size={16} />
      <span className="sidebar-label">{label}</span>
      {badge && <span className="nav-badge" data-new={badge === 'Yeni'}>{badge}</span>}
    </div>
  );
}

function Topbar({ view, onView, openCmd, openNotifs, openModal, activeCrumb, onChatOpen }) {
  return (
    <div className="topbar">
      <div className="topbar-crumbs">
        <span>{DATA.WORKSPACE?.name || 'StoaBoard'}</span>
        <span className="sep"><Icon name="chevronRight" size={12} /></span>
        <span className="current">{activeCrumb}</span>
      </div>
      <div className="topbar-right">
        {(view === 'board' || view === 'list' || view === 'calendar') && (
          <div className="view-switch">
            <button data-active={view==='board'}    onClick={() => onView('board')}>   <Icon name="layoutBoard" size={13} /> Pano</button>
            <button data-active={view==='list'}     onClick={() => onView('list')}>    <Icon name="list" size={13} /> Liste</button>
            <button data-active={view==='calendar'} onClick={() => onView('calendar')}><Icon name="calendar" size={13} /> Takvim</button>
          </div>
        )}
        <button className="icon-btn" onClick={openCmd}    title="Komut paleti (⌘K)"><Icon name="search" size={16} /></button>
        <button className="icon-btn" onClick={onChatOpen} title="Takım Sohbeti"><Icon name="msg" size={16} /></button>
        <button className="icon-btn" onClick={openNotifs} title="Bildirimler"><Icon name="bell" size={16} /><span className="pip" /></button>
        <button className="btn btn-primary" onClick={openModal}><Icon name="plus" size={14} /> Yeni görev</button>
      </div>
    </div>
  );
}

Object.assign(window, { Avatar, AvatarStack, Sidebar, Topbar, NavItem });
