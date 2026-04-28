// App shell: sidebar + topbar + shared bits

const { useState } = React;

function Avatar({ member, size = 'sm', ring = true }) {
  if (!member) return null;
  const style = {
    background: member.color || 'var(--ink-muted)',
  };
  return (
    <div className="avatar" data-size={size} style={style} title={member.name}>
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

function Sidebar({ collapsed, onCollapseToggle, view, onView, projects, openCmd }) {
  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sidebar-header">
        <div className="sidebar-logo"><Icon name="bolt" size={16} strokeWidth={1.8} /></div>
        <div className="sidebar-logo-text">Stoa<em>Board</em></div>
        <button className="sidebar-collapse-btn" onClick={onCollapseToggle} title={collapsed ? 'Genişlet' : 'Daralt'}>
          <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={14} />
        </button>
      </div>

      <div className="workspace-switcher" title="Çalışma alanı">
        <div className="ws-avatar">S</div>
        <div className="ws-info">
          <div className="ws-name">Stoa Labs</div>
          <div className="ws-sub">6 üye · Pro plan</div>
        </div>
        <div className="ws-arrow"><Icon name="chevronDown" size={14} /></div>
      </div>

      <div className="sidebar-search" onClick={openCmd}>
        <Icon name="search" size={14} />
        <span className="sidebar-label">Ara veya komut...</span>
        <kbd>⌘K</kbd>
      </div>

      <div className="sidebar-section">
        <NavItem icon="home"        label="Ana Sayfa"      sub="Home"            onClick={() => onView('dashboard')} active={view === 'dashboard'} />
        <NavItem icon="layoutBoard" label="Pano"           sub="Board"           onClick={() => onView('board')}     active={view === 'board'} />
        <NavItem icon="list"        label="Liste"          sub="List"            onClick={() => onView('list')}      active={view === 'list'} />
        <NavItem icon="calendar"    label="Takvim"         sub="Calendar"        onClick={() => onView('calendar')}  active={view === 'calendar'} />
        <NavItem icon="inbox"       label="Gelen Kutusu"   sub="Inbox"  badge="3" />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Projeler</span>
          <button title="Yeni proje"><Icon name="plus" size={13} /></button>
        </div>
        {projects.map(p => (
          <div className="project-item" key={p.id}>
            <div className="project-dot" style={{ background: p.color }} />
            <span className="sidebar-label">{p.name}</span>
            <span className="project-meta">{p.open}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Takım</span>
          <button title="Davet et"><Icon name="userPlus" size={13} /></button>
        </div>
        {DATA.MEMBERS.slice(0, 4).map(m => (
          <div className="project-item" key={m.id}>
            <Avatar member={m} size="sm" />
            <span className="sidebar-label">{m.name}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <NavItem icon="settings" label="Ayarlar" sub="Settings" onClick={() => onView('settings')} active={view === 'settings'} />
        <NavItem icon="help"     label="Yardım"  sub="Help" />
        <div className="user-profile">
          <Avatar member={DATA.MEMBERS[0]} size="md" />
          <div className="user-meta">
            <div className="user-name">{DATA.MEMBERS[0].name}</div>
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

function Topbar({ view, onView, openCmd, openNotifs, openModal, activeCrumb }) {
  const viewLabel = {
    board: { tr: 'Pano', en: 'Board' },
    list: { tr: 'Liste', en: 'List' },
    calendar: { tr: 'Takvim', en: 'Calendar' },
    dashboard: { tr: 'Ana Sayfa', en: 'Home' },
    settings: { tr: 'Ayarlar', en: 'Settings' },
  }[view] || { tr: 'Pano', en: 'Board' };

  return (
    <div className="topbar">
      <div className="topbar-crumbs">
        <span>Stoa Labs</span>
        <span className="sep"><Icon name="chevronRight" size={12} /></span>
        <span>StoaBoard Web</span>
        <span className="sep"><Icon name="chevronRight" size={12} /></span>
        <span className="current">{activeCrumb || viewLabel.tr}</span>
      </div>
      <div className="topbar-right">
        {(view === 'board' || view === 'list' || view === 'calendar') && (
          <div className="view-switch">
            <button data-active={view === 'board'}    onClick={() => onView('board')}>   <Icon name="layoutBoard" size={13} /> Pano</button>
            <button data-active={view === 'list'}     onClick={() => onView('list')}>    <Icon name="list" size={13} /> Liste</button>
            <button data-active={view === 'calendar'} onClick={() => onView('calendar')}><Icon name="calendar" size={13} /> Takvim</button>
          </div>
        )}
        <button className="icon-btn" onClick={openCmd} title="Komut paleti (⌘K)"><Icon name="search" size={16} /></button>
        <button className="icon-btn" onClick={openNotifs} title="Bildirimler"><Icon name="bell" size={16} /><span className="pip" /></button>
        <button className="btn btn-primary" onClick={openModal}><Icon name="plus" size={14} /> Yeni görev</button>
      </div>
    </div>
  );
}

Object.assign(window, { Avatar, AvatarStack, Sidebar, Topbar, NavItem });
