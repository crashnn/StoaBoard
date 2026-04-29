// Main app — API-backed with real-time chat

const { useState: useS, useEffect: useEf, useRef: useRef } = React;

function App() {
  const [authed, setAuthed]                 = useS(false);
  const [loading, setLoading]               = useS(true);
  const [needsWorkspace, setNeedsWorkspace] = useS(false);
  const [view, setView]                     = useS(() => localStorage.getItem('stoa.view') || 'board');
  const [tasks, setTasks]                   = useS([]);
  const [currentProject, setCurrentProject] = useS(null);
  const [drawerTask, setDrawerTask]         = useS(null);
  const [modalOpen, setModalOpen]           = useS(false);
  const [modalCol, setModalCol]             = useS('todo');
  const [cmdOpen, setCmdOpen]               = useS(false);
  const [notifOpen, setNotifOpen]           = useS(false);
  const [chatOpen, setChatOpen]             = useS(false);
  const [chatDmWith, setChatDmWith]         = useS(null);
  const [onlineUsers, setOnlineUsers]       = useS(new Map()); // slug → status
  const [members, setMembers]               = useS([]);
  const [projectModal, setProjectModal]     = useS(false);
  const [tweaksAvailable, setTweaksAvailable] = useS(false);
  const [socket, setSocket]                 = useS(null);
  const [workspaces, setWorkspaces]         = useS([]);
  const [wsSwitcherOpen, setWsSwitcherOpen] = useS(false);
  const [wsJoinModalOpen, setWsJoinModalOpen] = useS(false);
  const [wsLogoUrl, setWsLogoUrl]           = useS(null);

  const activityTimer  = useRef(null);
  const currentStatus  = useRef('online');
  const [myStatusState, setMyStatusState] = useS('online');
  const [notifCount, setNotifCount]       = useS(0);

  const [tweaks, setTweaks] = useS(() => {
    const saved = localStorage.getItem('stoa.tweaks');
    return saved ? JSON.parse(saved) : (window.__TWEAKS__ || {});
  });

  const setTweak = (key, value) => {
    const next = { ...tweaks, [key]: value };
    setTweaks(next);
    localStorage.setItem('stoa.tweaks', JSON.stringify(next));
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*'); } catch (e) {}
  };

  useEf(() => localStorage.setItem('stoa.view', view), [view]);
  useEf(() => { document.documentElement.dataset.theme    = tweaks.theme;    }, [tweaks.theme]);
  useEf(() => { document.documentElement.dataset.accent   = tweaks.accent;   }, [tweaks.accent]);
  useEf(() => { document.documentElement.dataset.fontpair = tweaks.fontPair; }, [tweaks.fontPair]);
  useEf(() => { document.documentElement.dataset.density  = tweaks.density;  }, [tweaks.density]);

  useEf(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode')        setTweaksAvailable(true);
      else if (e.data?.type === '__deactivate_edit_mode') setTweaksAvailable(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
    return () => window.removeEventListener('message', handler);
  }, []);

  // Keyboard shortcuts
  useEf(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true); }
      else if (e.key === 'Escape') {
        setDrawerTask(null); setModalOpen(false); setCmdOpen(false);
        setNotifOpen(false); setChatOpen(false); setProjectModal(false);
        setWsSwitcherOpen(false);
      } else if (
        e.key === 'n' && !e.metaKey && !e.ctrlKey &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA' &&
        !document.activeElement.isContentEditable
      ) { setModalCol('todo'); setModalOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Auth + bootstrap on mount ────────────────────────────────────────────
  useEf(() => {
    API.me()
      .then(() => API.bootstrap())
      .then((data) => {
        if (data.needs_workspace) {
          window.CURRENT_USER = data.user;
          setAuthed(true); setNeedsWorkspace(true); setLoading(false);
          return;
        }
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.online_users) _applyOnlineUsers(data.online_users);
        if (data.workspaces)   setWorkspaces(data.workspaces);
        setAuthed(true); setNeedsWorkspace(false); setLoading(false);
      })
      .catch(() => { setAuthed(false); setLoading(false); });
  }, []);

  // ── Socket.IO connection ─────────────────────────────────────────────────
  useEf(() => {
    if (!authed || needsWorkspace || !window.io) return;
    const sock = window.io({ transports: ['websocket', 'polling'] });
    window.SOCKET = sock;
    setSocket(sock);

    sock.on('online_users', ({ users }) => _applyOnlineUsers(users));
    sock.on('user_online',  ({ user, status }) => setOnlineUsers(prev => {
      const n = new Map(prev); n.set(user, status || 'online'); return n;
    }));
    sock.on('user_offline', ({ user }) => setOnlineUsers(prev => {
      const n = new Map(prev); n.delete(user); return n;
    }));
    sock.on('user_status',  ({ user, status }) => setOnlineUsers(prev => {
      const n = new Map(prev); n.set(user, status); return n;
    }));
    sock.on('member_joined', ({ member }) => {
      setMembers(prev => {
        if (prev.find(m => m.id === member.id)) return prev;
        const next = [...prev, member];
        window.DATA.MEMBERS = next;
        return next;
      });
    });
    sock.on('workspace_switched', ({ workspace_id }) => {
      API.bootstrap().then(data => {
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.workspaces) setWorkspaces(data.workspaces);
      }).catch(() => {});
    });

    // Real-time notifications (from DM / @mention / task assignment)
    sock.on('notification', (notif) => {
      if (!notif) return;
      if (!window.DATA.NOTIFICATIONS) window.DATA.NOTIFICATIONS = [];
      if (!window.DATA.NOTIFICATIONS.some(n => n.id === notif.id)) {
        window.DATA.NOTIFICATIONS.unshift(notif);
        setNotifCount(c => c + 1);
      }
    });

    // Global chat_message handler — shows toast when chat panel is closed
    // and respects DND mode
    sock.on('chat_message', (msg) => {
      const me = window.CURRENT_USER?.id;
      if (!msg || msg.from === me) return;

      // Only toast if chat panel is not open (chat panel handles its own notifications)
      if (window.__CHAT_OPEN__) return;

      const twks = JSON.parse(localStorage.getItem('stoa.tweaks') || '{}');
      const notifyMessages = twks.notifyMessages !== false;
      const notifyToasts   = twks.notifyToasts   !== false;
      const myStatus = window.__MY_STATUS__ || 'online';

      if (!notifyMessages) return;
      if (myStatus === 'dnd') return;    // no pop-up in DND
      if (!notifyToasts) return;

      const allMembers = window.DATA?.MEMBERS || [];
      const sender = allMembers.find(m => m.id === msg.from);
      if (sender && window.showToast) {
        const preview = msg.text || (msg.file_name ? '📎 ' + msg.file_name : '📎 Dosya');
        window.showToast(`${sender.name}: ${preview}`, 'message');
      }
    });

    return () => {
      sock.disconnect();
      window.SOCKET = null;
      setSocket(null);
    };
  }, [authed, needsWorkspace]);

  // ── Activity tracking → presence status ─────────────────────────────────
  useEf(() => {
    if (!authed || needsWorkspace) return;

    const getTimeout = () => {
      const user = window.CURRENT_USER;
      return ((user?.away_timeout) || 15) * 60 * 1000;
    };

    const setStatus = (status) => {
      if (currentStatus.current === status) return;
      if (currentStatus.current === 'dnd') return;  // never auto-override DND
      currentStatus.current = status;
      setMyStatusState(status);
      window.__MY_STATUS__ = status;
      if (window.SOCKET) window.SOCKET.emit('set_status', { status });
      API.updatePreferences({ status }).catch(() => {});
    };

    const resetTimer = () => {
      clearTimeout(activityTimer.current);
      if (currentStatus.current !== 'dnd') {
        setStatus('online');
        activityTimer.current = setTimeout(() => setStatus('away'), getTimeout());
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    // Go offline when page is closed/hidden
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(activityTimer.current);
        // Don't emit offline on visibility change — only on actual disconnect
      } else {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(activityTimer.current);
      events.forEach(ev => document.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authed, needsWorkspace, socket]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _applyOnlineUsers(users) {
    // users is array of {slug, status} objects
    const map = new Map();
    if (Array.isArray(users)) {
      users.forEach(u => {
        if (typeof u === 'string') map.set(u, 'online');
        else if (u.slug) map.set(u.slug, u.status || 'online');
      });
    }
    setOnlineUsers(map);
  }

  function _applyBootstrap(data) {
    window.DATA.MEMBERS       = data.members       || [];
    setMembers(data.members || []);
    window.DATA.COLUMNS       = data.columns       || [];
    window.DATA.LABELS        = data.labels        || {};
    window.DATA.PROJECTS      = data.projects      || [];
    window.DATA.WORKSPACE     = data.workspace     || {};
    window.DATA.WORKSPACES    = data.workspaces    || [];
    setWsLogoUrl(data.workspace?.logo_url || null);
    window.DATA.NOTIFICATIONS = data.notifications || [];
    window.DATA.ACTIVITY      = data.activity      || [];
    window.DATA.THROUGHPUT    = data.throughput    || [];
    window.CURRENT_USER       = data.user;
    window.CURRENT_PROJECT_ID = data.current_project;
  }

  // ── Workspace ready (after setup) ─────────────────────────────────────────
  const handleWorkspaceReady = () => {
    API.bootstrap()
      .then((data) => {
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.online_users) _applyOnlineUsers(data.online_users);
        if (data.workspaces)   setWorkspaces(data.workspaces);
        setNeedsWorkspace(false);
      })
      .catch((e) => alert('Veriler yüklenemedi: ' + e.message));
  };

  // ── Workspace switching ───────────────────────────────────────────────────
  const handleSwitchWorkspace = async (wsId) => {
    try {
      await API.switchWorkspace(wsId);
      // Notify socket server to update rooms
      if (window.SOCKET) window.SOCKET.emit('switch_workspace', { workspace_id: wsId });
      const data = await API.bootstrap();
      _applyBootstrap(data);
      setTasks(data.tasks || []);
      setCurrentProject(data.current_project ? { id: data.current_project } : null);
      if (data.online_users) _applyOnlineUsers(data.online_users);
      if (data.workspaces)   setWorkspaces(data.workspaces);
      setWsSwitcherOpen(false);
    } catch (e) { alert('Çalışma alanı değiştirilemedi: ' + e.message); }
  };

  // ── Task operations ───────────────────────────────────────────────────────

  const moveTask = async (id, colId) => {
    const prev = tasks;
    setTasks(tasks.map(t => t.id === id ? { ...t, col: colId, progress: colId === 'done' ? 100 : t.progress } : t));
    if (drawerTask?.id === id) setDrawerTask(dt => ({ ...dt, col: colId }));
    try { await API.updateTask(id, { col: colId }); }
    catch (e) { setTasks(prev); console.error('moveTask failed:', e.message); }
  };

  const updateTitle = async (id, title) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, title } : t));
    try { await API.updateTask(id, { title }); } catch (e) { console.error(e); }
  };

  const createTask = async (formData) => {
    const projectId = window.CURRENT_PROJECT_ID || 1;
    try {
      const created = await API.createTask(projectId, formData);
      setTasks(prev => [created, ...prev]);
    } catch (e) { alert('Görev oluşturulamadı: ' + e.message); }
  };

  const deleteTask = async (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    setDrawerTask(null);
    try { await API.deleteTask(id); } catch (e) { console.error(e); }
  };

  // ── Project switch ────────────────────────────────────────────────────────

  const switchProject = async (projectId) => {
    try {
      const data = await API.bootstrap(projectId);
      _applyBootstrap(data);
      setTasks(data.tasks || []);
      setCurrentProject(data.current_project ? { id: data.current_project } : null);
      setView('board');
    } catch (e) { console.error('switchProject failed:', e.message); }
  };

  const handleCreateProject = async (name, color, icon) => {
    try {
      const p = await API.createProject({ name, color, icon });
      window.DATA.PROJECTS = [...(window.DATA.PROJECTS || []), p];
      await switchProject(p.id);
      setProjectModal(false);
    } catch (e) { alert('Proje oluşturulamadı: ' + e.message); }
  };

  const openChat = (dmWithSlug) => {
    // only accept actual slug strings — filter out DOM events, booleans, etc.
    const slug = typeof dmWithSlug === 'string' ? dmWithSlug : null;
    setChatDmWith(slug);
    setChatOpen(true);
    window.__CHAT_OPEN__ = true;
  };

  const handleCmd = (action) => {
    if (action.startsWith('goto:'))       setView(action.slice(5));
    else if (action === 'new:task')       openModal('todo');
    else if (action === 'open:notifs')    setNotifOpen(true);
    else if (action === 'open:chat')      openChat();
    else if (action === 'new:project')    setProjectModal(true);
    else if (action === 'toggle:theme') {
      const order = ['light','cream','dark'];
      setTweak('theme', order[(order.indexOf(tweaks.theme) + 1) % order.length]);
    }
    else if (action === 'toggle:sidebar') setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed);
    else if (action === 'logout')         handleLogout();
  };

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleSignIn = (extraData) => {
    API.bootstrap()
      .then((data) => {
        if (data.needs_workspace) {
          window.CURRENT_USER = data.user;
          setAuthed(true); setNeedsWorkspace(true);
          return;
        }
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.online_users) _applyOnlineUsers(data.online_users);
        if (data.workspaces)   setWorkspaces(data.workspaces);
        setAuthed(true); setNeedsWorkspace(false);
      })
      .catch((e) => alert('Veri yüklenemedi: ' + e.message));
  };

  const handleLogout = async () => {
    if (window.SOCKET) { window.SOCKET.disconnect(); window.SOCKET = null; setSocket(null); }
    try { await API.logout(); } catch (_) {}
    window.DATA.MEMBERS = []; window.DATA.COLUMNS = []; window.DATA.LABELS = {};
    window.DATA.PROJECTS = []; window.DATA.WORKSPACE = {}; window.DATA.WORKSPACES = [];
    setAuthed(false); setNeedsWorkspace(false);
    setTasks([]); setOnlineUsers(new Map()); setWorkspaces([]);
    setWsLogoUrl(null);
    setTweak('theme', 'cream');
  };

  const openDrawer = (task) => setDrawerTask(task);
  const closeDrawer = () => setDrawerTask(null);
  const openModal = (colId) => { setModalCol(colId || 'todo'); setModalOpen(true); };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: 14 }}>
          <div className="sidebar-logo" style={{ margin: '0 auto 12px' }}>
            <Icon name="bolt" size={20} strokeWidth={1.8} />
          </div>
          Yükleniyor…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="app" data-auth="true">
        <AuthPage onSignIn={handleSignIn} />
      </div>
    );
  }

  if (needsWorkspace) {
    return (
      <div className="app" data-auth="true">
        <WorkspaceSetupPage onReady={handleWorkspaceReady} onLogout={handleLogout} />
      </div>
    );
  }

  const crumb = { board:'Pano', list:'Liste', calendar:'Takvim', dashboard:'Ana Sayfa', settings:'Ayarlar' }[view] || 'Pano';
  const noProject = !currentProject && DATA.PROJECTS.length === 0;

  // Convert onlineUsers map to Set of online slugs (for backward compat) and expose full map
  const onlineSet = new Set(onlineUsers.keys());

  return (
    <div className="app">
      <ToastContainer />
      <Sidebar
        collapsed={tweaks.sidebarCollapsed}
        onCollapseToggle={() => setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed)}
        view={view} onView={setView}
        projects={DATA.PROJECTS}
        members={members}
        openCmd={() => setCmdOpen(true)}
        onlineUsers={onlineSet}
        onlineStatuses={onlineUsers}
        onChatOpen={openChat}
        onSwitchProject={switchProject}
        onNewProject={() => setProjectModal(true)}
        workspaces={workspaces}
        wsLogoUrl={wsLogoUrl}
        onSwitchWorkspace={handleSwitchWorkspace}
        wsSwitcherOpen={wsSwitcherOpen}
        onWsSwitcherToggle={() => setWsSwitcherOpen(v => !v)}
        onAddWorkspace={() => { setWsSwitcherOpen(false); setWsJoinModalOpen(true); }}
        currentStatus={myStatusState}
        onStatusChange={(s) => {
          currentStatus.current = s;
          setMyStatusState(s);
          window.__MY_STATUS__ = s;
          if (window.SOCKET) window.SOCKET.emit('set_status', { status: s });
          API.updatePreferences({ status: s }).catch(() => {});
        }}
      />
      <div className="main">
        <Topbar
          view={view} onView={setView}
          openCmd={() => setCmdOpen(true)}
          openNotifs={() => { setNotifOpen(!notifOpen); setNotifCount(0); }}
          openModal={() => openModal('todo')}
          activeCrumb={crumb}
          onChatOpen={() => openChat()}
          notifCount={notifCount}
        />

        {noProject && view !== 'settings' ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--ink-muted)' }}>
            <Icon name="layoutBoard" size={48} strokeWidth={1} />
            <div style={{ fontSize:22, fontFamily:'var(--font-display)', color:'var(--ink)' }}>Henüz proje yok</div>
            <div style={{ fontSize:14 }}>İlk projenizi oluşturun.</div>
            <button className="btn btn-primary" onClick={() => setProjectModal(true)}>
              <Icon name="plus" size={14} /> Proje Oluştur
            </button>
          </div>
        ) : (
          <>
            {view === 'board'     && <BoardView tasks={tasks} onOpenTask={openDrawer} onMoveTask={moveTask} tweaks={tweaks} onOpenModal={openModal} onTitleChange={updateTitle} />}
            {view === 'list'      && <ListView tasks={tasks} onOpenTask={openDrawer} onMoveTask={moveTask} />}
            {view === 'calendar'  && <CalendarView tasks={tasks} onOpenTask={openDrawer} />}
            {view === 'dashboard' && <DashboardView tasks={tasks} onOpenTask={openDrawer} />}
          </>
        )}
        {view === 'settings' && <SettingsView tweaks={tweaks} setTweak={setTweak} onLogout={handleLogout} onWsLogoChange={setWsLogoUrl} />}
      </div>

      <TaskDrawer
        open={!!drawerTask} task={drawerTask} onClose={closeDrawer}
        onMoveTask={moveTask}
        onTaskUpdate={(updated) => setTasks(tasks.map(t => t.id === updated.id ? { ...t, ...updated } : t))}
        onDelete={deleteTask}
      />
      <AddTaskModal open={modalOpen} onClose={() => setModalOpen(false)} defaultCol={modalCol} onCreate={createTask} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmd} />
      <NotifPanel open={notifOpen} onClose={() => { setNotifOpen(false); setNotifCount(0); }} socket={socket} />
      <ChatPanel
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatDmWith(null); window.__CHAT_OPEN__ = false; }}
        onlineUsers={onlineSet}
        onlineStatuses={onlineUsers}
        members={members}
        socket={socket}
        initialDmWith={chatDmWith}
      />
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} visible={tweaksAvailable} />
      {projectModal && <NewProjectModal onClose={() => setProjectModal(false)} onCreate={handleCreateProject} />}
      {wsJoinModalOpen && (
        <AddWorkspaceModal
          onClose={() => setWsJoinModalOpen(false)}
          onDone={async (wsId) => {
            setWsJoinModalOpen(false);
            await handleSwitchWorkspace(wsId);
          }}
        />
      )}
    </div>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────

function ProjectIconPicker({ selected, color, onChange }) {
  const icons = window.PROJECT_ICONS || [];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:4, maxHeight:180, overflowY:'auto', padding:'2px 0' }}>
      {icons.map(({ id, label }) => (
        <button key={id+label} type="button" title={label} onClick={() => onChange(id)}
          style={{
            width:32, height:32, borderRadius:8, display:'grid', placeItems:'center',
            background: selected === id ? color : 'var(--bg-raised)',
            color: selected === id ? 'white' : 'var(--ink-muted)',
            border: selected === id ? `2px solid ${color}` : '2px solid transparent',
            cursor:'pointer', transition:'all 0.12s', flexShrink:0,
          }}>
          <Icon name={id} size={15} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName]   = React.useState('');
  const [color, setColor] = React.useState('oklch(55% 0.13 25)');
  const [icon, setIcon]   = React.useState('folder');
  const [loading, setLoading] = React.useState(false);

  const colors = [
    ['Terracotta','oklch(55% 0.13 25)'], ['Sage','oklch(55% 0.09 150)'],
    ['Indigo','oklch(52% 0.15 270)'],    ['Plum','oklch(50% 0.14 340)'],
    ['Amber','oklch(65% 0.11 70)'],      ['Slate','oklch(50% 0.04 250)'],
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim(), color, icon);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" data-open="true" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Yeni Proje</div>
          <div className="modal-sub">Projeniz için isim, renk ve ikon seçin.</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Proje Adı</label>
              <input autoFocus placeholder="Örn: Web Sitesi, Mobil Uygulama..." value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Renk</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'2px 0' }}>
                {colors.map(([label, val]) => (
                  <button key={val} type="button" title={label} onClick={() => setColor(val)}
                    style={{ width:28, height:28, borderRadius:7, background:val, cursor:'pointer', flexShrink:0,
                      border: color===val ? '3px solid var(--ink)' : '2px solid transparent',
                      boxShadow: color===val ? '0 0 0 1px var(--bg), 0 0 0 3px var(--ink)' : 'none',
                      transition: 'box-shadow 0.15s' }} />
                ))}
              </div>
            </div>
            <div className="field">
              <label>İkon</label>
              <ProjectIconPicker selected={icon} color={color} onChange={setIcon} />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || loading}>
              {loading ? 'Oluşturuluyor…' : 'Proje Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add/Join Workspace Modal ──────────────────────────────────────────────

function AddWorkspaceModal({ onClose, onDone }) {
  const [tab, setTab]       = React.useState('create');
  const [wsName, setWsName] = React.useState('');
  const [code, setCode]     = React.useState('');
  const [error, setError]   = React.useState('');
  const [busy, setBusy]     = React.useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    setError(''); setBusy(true);
    try {
      const res = await API.createWorkspace({ name: wsName.trim() });
      onDone(res.workspace_id);
    } catch (err) {
      setError(err.message || 'Bir hata oluştu');
      setBusy(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(''); setBusy(true);
    try {
      const res = await API.joinWorkspace(code.trim());
      onDone(res.workspace_id);
    } catch (err) {
      setError(err.message || 'Geçersiz davet kodu');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" data-open="true" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <div className="modal-title">Takım Ekle</div>
          <div className="modal-sub">Yeni bir takım kur veya mevcut bir takıma katıl.</div>
        </div>
        <div className="modal-body" style={{ paddingTop: 0 }}>
          <div className="auth-tabs" style={{ marginBottom: 16 }}>
            <button data-active={tab === 'create'} onClick={() => { setTab('create'); setError(''); }}>Takım Kur</button>
            <button data-active={tab === 'join'}   onClick={() => { setTab('join');   setError(''); }}>Takıma Katıl</button>
          </div>
          {error && (
            <div style={{ padding:'8px 12px', borderRadius:8, background:'oklch(58% 0.13 10 / 0.12)', color:'var(--status-rose)', fontSize:12, marginBottom:12 }}>
              {error}
            </div>
          )}
          {tab === 'create' ? (
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>Takım Adı</label>
                <input autoFocus placeholder="Örn: Yeni Proje, Kişisel…" value={wsName} onChange={e => setWsName(e.target.value)} required />
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !wsName.trim()}>
                  {busy ? 'Oluşturuluyor…' : 'Takımı Kur'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <div className="field">
                <label>Davet Kodu</label>
                <input autoFocus placeholder="ABCD1234" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8}
                  style={{ fontFamily:'var(--font-mono)', letterSpacing:'0.1em', fontSize:18, textAlign:'center' }} required />
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6}>
                  {busy ? 'Katılınıyor…' : 'Takıma Katıl'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
