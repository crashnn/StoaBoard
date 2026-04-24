// Auth page + Workspace setup

const { useState: useAuthState } = React;

function AuthPage({ onSignIn }) {
  const [mode, setMode]   = useAuthState('signin');
  const [error, setError] = useAuthState('');
  const [busy, setBusy]   = useAuthState(false);
  const [form, setForm]   = useAuthState({ name: '', email: '', password: '' });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await API.login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError('Ad soyad zorunludur'); setBusy(false); return; }
        await API.register(form.name.trim(), form.email, form.password);
      }
      onSignIn();
    } catch (err) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand">
          <div className="sidebar-logo"><Icon name="bolt" size={16} strokeWidth={1.8} /></div>
          <div className="sidebar-logo-text" style={{ fontSize: 22 }}>Stoa<em>Board</em></div>
        </div>
        <div className="auth-hero">
          <h1>Takımının işi <em>konuşsun</em>, kartları değil.</h1>
          <p>StoaBoard — pano, liste ve takvimde aynı anda çalışan hafif, hızlı bir proje yönetim aracı. Startup takımları için tasarlandı, ekibinle 15 saniyede başla.</p>
          <div style={{ display:'flex', gap:28, fontSize:12.5, color:'var(--ink-muted)' }}>
            <div><strong style={{ color:'var(--ink)', fontFamily:'var(--font-display)', fontSize:22, display:'block', lineHeight:1 }}>6k+</strong> aktif takım</div>
            <div><strong style={{ color:'var(--ink)', fontFamily:'var(--font-display)', fontSize:22, display:'block', lineHeight:1 }}>98%</strong> memnuniyet</div>
            <div><strong style={{ color:'var(--ink)', fontFamily:'var(--font-display)', fontSize:22, display:'block', lineHeight:1 }}>15sn</strong> başlama süresi</div>
          </div>
          <div className="auth-quote">
            "StoaBoard'a geçtikten sonra haftalık sync toplantılarımızı yarıya indirdik."
            <cite>— Deniz Arslan, Flux Labs</cite>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <h2>{mode === 'signin' ? 'Tekrar hoşgeldin.' : 'Hesap oluştur.'}</h2>
          <p className="sub">{mode === 'signin' ? 'Devam etmek için giriş yap.' : 'Takımınla başlamak için 30 saniye.'}</p>

          <div className="auth-tabs">
            <button data-active={mode === 'signin'} onClick={() => { setMode('signin'); setError(''); }}>Giriş yap</button>
            <button data-active={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>Kaydol</button>
          </div>

          {error && (
            <div style={{ padding:'10px 14px', borderRadius:8, background:'oklch(58% 0.13 10 / 0.12)', color:'var(--status-rose)', fontSize:13, marginBottom:4 }}>
              {error}
            </div>
          )}

          <form className="auth-fields" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="field">
                <label>Ad Soyad</label>
                <input placeholder="Aliz Kaya" value={form.name} onChange={set('name')} required />
              </div>
            )}
            <div className="field">
              <label>E-posta</label>
              <input type="email" placeholder="sen@example.com" value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label>
                Parola{' '}
                {mode === 'signin' && (
                  <a href="#" style={{ float:'right', color:'var(--ink-muted)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>Unuttun mu?</a>
                )}
              </label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={8} />
            </div>
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? 'Lütfen bekle…' : mode === 'signin' ? 'Giriş yap' : 'Hesap oluştur'}
            </button>
          </form>

          <div className="auth-foot">
            {mode === 'signin'
              ? <><span>Hesabın yok mu?</span> <a onClick={() => { setMode('signup'); setError(''); }} style={{ cursor:'pointer' }}>Ücretsiz kaydol</a></>
              : <>Kaydolarak şartları kabul etmiş sayılırsın.</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Workspace Setup Page ───────────────────────────────────────────────────

function WorkspaceSetupPage({ onReady, onLogout }) {
  const [tab, setTab]       = React.useState('create');
  const [wsName, setWsName] = React.useState('');
  const [code, setCode]     = React.useState('');
  const [error, setError]   = React.useState('');
  const [busy, setBusy]     = React.useState(false);
  const me = window.CURRENT_USER || {};

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    setError(''); setBusy(true);
    try {
      await API.createWorkspace({ name: wsName.trim() });
      onReady();
    } catch (err) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(''); setBusy(true);
    try {
      await API.joinWorkspace(code.trim());
      onReady();
    } catch (err) {
      setError(err.message || 'Geçersiz davet kodu');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand">
          <div className="sidebar-logo"><Icon name="bolt" size={16} strokeWidth={1.8} /></div>
          <div className="sidebar-logo-text" style={{ fontSize: 22 }}>Stoa<em>Board</em></div>
        </div>
        <div className="auth-hero">
          <h1>Çalışma alanın <em>hazır</em> mı?</h1>
          <p>Kendi takımını kur ve projeleri yönet — ya da bir davet koduyla mevcut takıma katıl.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:8 }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-soft)', display:'grid', placeItems:'center', flexShrink:0 }}>
                <Icon name="bolt" size={15} />
              </div>
              <div>
                <div style={{ fontWeight:500, fontSize:14, color:'var(--ink)' }}>Takım kur</div>
                <div style={{ fontSize:13, color:'var(--ink-muted)', marginTop:2 }}>Davet kodu oluştur, ekibini ekle</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-soft)', display:'grid', placeItems:'center', flexShrink:0 }}>
                <Icon name="msg" size={15} />
              </div>
              <div>
                <div style={{ fontWeight:500, fontSize:14, color:'var(--ink)' }}>Takıma katıl</div>
                <div style={{ fontSize:13, color:'var(--ink-muted)', marginTop:2 }}>Sana verilen 8 haneli kodu gir</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <Avatar member={me} size="md" />
            <div>
              <div style={{ fontWeight:500, fontSize:14 }}>{me.name || 'Kullanıcı'}</div>
              <div style={{ fontSize:12, color:'var(--ink-muted)' }}>Çalışma alanı seç</div>
            </div>
          </div>

          <div className="auth-tabs">
            <button data-active={tab === 'create'} onClick={() => { setTab('create'); setError(''); }}>Takım Kur</button>
            <button data-active={tab === 'join'}   onClick={() => { setTab('join');   setError(''); }}>Takıma Katıl</button>
          </div>

          {error && (
            <div style={{ padding:'10px 14px', borderRadius:8, background:'oklch(58% 0.13 10 / 0.12)', color:'var(--status-rose)', fontSize:13, marginBottom:4 }}>
              {error}
            </div>
          )}

          {tab === 'create' ? (
            <form className="auth-fields" onSubmit={handleCreate}>
              <div className="field">
                <label>Takım / Çalışma Alanı Adı</label>
                <input
                  autoFocus
                  placeholder="Örn: Flux Labs, Kişisel Projeler…"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  required
                />
              </div>
              <div style={{ padding:'12px 14px', background:'var(--bg-subtle)', borderRadius:10, fontSize:12.5, color:'var(--ink-muted)', lineHeight:1.6 }}>
                <strong style={{ color:'var(--ink)' }}>Takım kurduğunda:</strong><br/>
                • Otomatik davet kodu oluşturulur<br/>
                • Üyelerin kodu girerek katılabilir<br/>
                • Kodu istediğin zaman yenileyebilir veya silebilirsin
              </div>
              <button type="submit" className="auth-submit" disabled={busy || !wsName.trim()}>
                {busy ? 'Oluşturuluyor…' : 'Takımı Kur'}
              </button>
            </form>
          ) : (
            <form className="auth-fields" onSubmit={handleJoin}>
              <div className="field">
                <label>Davet Kodu</label>
                <input
                  autoFocus
                  placeholder="ABCD1234"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  style={{ fontFamily:'var(--font-mono)', letterSpacing:'0.1em', fontSize:18, textAlign:'center' }}
                  required
                />
              </div>
              <div style={{ padding:'12px 14px', background:'var(--bg-subtle)', borderRadius:10, fontSize:12.5, color:'var(--ink-muted)' }}>
                Kodu takım yöneticisinden isteyin. Büyük/küçük harf fark etmez.
              </div>
              <button type="submit" className="auth-submit" disabled={busy || code.length < 6}>
                {busy ? 'Katılınıyor…' : 'Takıma Katıl'}
              </button>
            </form>
          )}

          <div className="auth-foot">
            <a onClick={onLogout} style={{ cursor:'pointer', color:'var(--ink-muted)' }}>
              <Icon name="logOut" size={12} /> Çıkış yap
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AuthPage = AuthPage;
window.WorkspaceSetupPage = WorkspaceSetupPage;
