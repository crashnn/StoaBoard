// Main app — API-backed with real-time chat

const { useState: useS, useEffect: useEf } = React;

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
  const [onlineUsers, setOnlineUsers]       = useS(new Set());
  const [members, setMembers]               = useS([]);
  const [projectModal, setProjectModal]     = useS(false);
  const [tweaksAvailable, setTweaksAvailable] = useS(false);

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
        if (data.online_users) setOnlineUsers(new Set(data.online_users));
        setAuthed(true); setNeedsWorkspace(false); setLoading(false);
      })
      .catch(() => { setAuthed(false); setLoading(false); });
  }, []);

  // ── Socket.IO connection ─────────────────────────────────────────────────
  useEf(() => {
    if (!authed || needsWorkspace || !window.io) return;
    const sock = window.io({ transports: ['websocket', 'polling'] });
    window.SOCKET = sock;
    sock.on('online_users',  ({ users })  => setOnlineUsers(new Set(users)));
    sock.on('user_online',   ({ user })   => setOnlineUsers(prev => { const n = new Set(prev); n.add(user); return n; }));
    sock.on('user_offline',  ({ user })   => setOnlineUsers(prev => { const n = new Set(prev); n.delete(user); return n; }));
    sock.on('member_joined', ({ member }) => {
      setMembers(prev => {
        if (prev.find(m => m.id === member.id)) return prev;
        const next = [...prev, member];
        window.DATA.MEMBERS = next;
        return next;
      });
    });
    return () => { sock.disconnect(); window.SOCKET = null; };
  }, [authed, needsWorkspace]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _applyBootstrap(data) {
    window.DATA.MEMBERS       = data.members       || [];
    setMembers(data.members || []);
    window.DATA.COLUMNS       = data.columns       || [];
    window.DATA.LABELS        = data.labels        || {};
    window.DATA.PROJECTS      = data.projects      || [];
    window.DATA.WORKSPACE     = data.workspace     || {};
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
        if (data.online_users) setOnlineUsers(new Set(data.online_users));
        setNeedsWorkspace(false);
      })
      .catch((e) => alert('Veriler yüklenemedi: ' + e.message));
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

  const handleCreateProject = async (name, color) => {
    try {
      const p = await API.createProject({ name, color });
      window.DATA.PROJECTS = [...(window.DATA.PROJECTS || []), p];
      await switchProject(p.id);
      setProjectModal(false);
    } catch (e) { alert('Proje oluşturulamadı: ' + e.message); }
  };

  const openChat = (dmWithSlug) => { setChatDmWith(dmWithSlug || null); setChatOpen(true); };

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
        if (data.online_users) setOnlineUsers(new Set(data.online_users));
        setAuthed(true); setNeedsWorkspace(false);
      })
      .catch((e) => alert('Veri yüklenemedi: ' + e.message));
  };

  const handleLogout = async () => {
    if (window.SOCKET) { window.SOCKET.disconnect(); window.SOCKET = null; }
    try { await API.logout(); } catch (_) {}
    window.DATA.MEMBERS = []; window.DATA.COLUMNS = []; window.DATA.LABELS = {};
    window.DATA.PROJECTS = []; window.DATA.WORKSPACE = {};
    setAuthed(false); setNeedsWorkspace(false);
    setTasks([]); setOnlineUsers(new Set());
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
        onlineUsers={onlineUsers}
        onChatOpen={openChat}
        onSwitchProject={switchProject}
        onNewProject={() => setProjectModal(true)}
      />
      <div className="main">
        <Topbar
          view={view} onView={setView}
          openCmd={() => setCmdOpen(true)}
          openNotifs={() => setNotifOpen(!notifOpen)}
          openModal={() => openModal('todo')}
          activeCrumb={crumb}
          onChatOpen={() => openChat()}
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
        {view === 'settings' && <SettingsView tweaks={tweaks} setTweak={setTweak} onLogout={handleLogout} />}
      </div>

      <TaskDrawer
        open={!!drawerTask} task={drawerTask} onClose={closeDrawer}
        onMoveTask={moveTask}
        onTaskUpdate={(updated) => setTasks(tasks.map(t => t.id === updated.id ? { ...t, ...updated } : t))}
        onDelete={deleteTask}
      />
      <AddTaskModal open={modalOpen} onClose={() => setModalOpen(false)} defaultCol={modalCol} onCreate={createTask} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmd} />
      <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => { setChatOpen(false); setChatDmWith(null); }} onlineUsers={onlineUsers} members={members} />
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} visible={tweaksAvailable} />
      {projectModal && <NewProjectModal onClose={() => setProjectModal(false)} onCreate={handleCreateProject} />}
    </div>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName]   = React.useState('');
  const [color, setColor] = React.useState('oklch(55% 0.13 25)');
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
    await onCreate(name.trim(), color);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" data-open="true" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Yeni Proje</div>
          <div className="modal-sub">Projeniz için bir isim ve renk seçin.</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Proje Adı</label>
              <input autoFocus placeholder="Örn: Web Sitesi, Mobil Uygulama..." value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Renk</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {colors.map(([label, val]) => (
                  <button key={val} type="button" title={label} onClick={() => setColor(val)}
                    style={{ width:28, height:28, borderRadius:7, background:val, cursor:'pointer',
                      border: color===val ? '2px solid var(--ink)' : '2px solid transparent',
                      transform: color===val ? 'scale(1.1)' : 'none' }} />
                ))}
              </div>
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
