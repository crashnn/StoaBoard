// Settings view — profile, appearance, workspace (invite code + roles + members)

const PERM_LABELS = {
  manage_tasks:    'Görevleri yönet',
  manage_projects: 'Projeleri yönet',
  manage_members:  'Üyeleri yönet',
};
const ALL_PERMS = Object.keys(PERM_LABELS);

const ROLE_COLORS = [
  'oklch(52% 0.15 270)', 'oklch(55% 0.09 150)', 'oklch(55% 0.13 25)',
  'oklch(50% 0.14 340)', 'oklch(65% 0.11 70)',  'oklch(50% 0.04 250)',
];

function SettingsView({ tweaks, setTweak, onLogout }) {
  const me       = window.CURRENT_USER || DATA.MEMBERS[0] || {};
  const ws       = window.DATA.WORKSPACE || {};
  const isOwner  = ws.is_owner || false;

  const [name, setName]   = React.useState(me.name || '');
  const [role, setRole]   = React.useState(me.role || '');
  const [email, setEmail] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy]   = React.useState(false);

  // Workspace state
  const [inviteCode, setInviteCode]   = React.useState(ws.invite_code || null);
  const [codeLoading, setCodeLoading] = React.useState(false);
  const [codeCopied, setCodeCopied]   = React.useState(false);

  // Roles state
  const [roles, setRoles]           = React.useState(ws.roles || []);
  const [roleForm, setRoleForm]     = React.useState(null); // null = closed, {} = new, {id,...} = edit
  const [rolePerms, setRolePerms]   = React.useState([]);
  const [roleColor, setRoleColor]   = React.useState(ROLE_COLORS[0]);
  const [roleName, setRoleName]     = React.useState('');
  const [roleDefault, setRoleDefault] = React.useState(false);
  const [roleBusy, setRoleBusy]     = React.useState(false);

  // Members state
  const [members, setMembers]         = React.useState([...DATA.MEMBERS]);
  const [memberBusy, setMemberBusy]   = React.useState(null);

  const saveProfile = async () => {
    setBusy(true);
    try {
      const updated = await API.updateProfile({ name, role_title: role, email: email || undefined });
      window.CURRENT_USER = { ...window.CURRENT_USER, ...updated };
      const idx = DATA.MEMBERS.findIndex(m => m.id === me.id);
      if (idx >= 0) DATA.MEMBERS[idx] = { ...DATA.MEMBERS[idx], ...updated };
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert('Kaydedilemedi: ' + e.message); }
    finally { setBusy(false); }
  };

  // ── Invite code ───────────────────────────────────────────────────────────

  const copyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const regenCode = async () => {
    if (!confirm('Mevcut kod geçersiz olacak. Devam et?')) return;
    setCodeLoading(true);
    try {
      const res = await API.regenInviteCode();
      setInviteCode(res.invite_code);
      window.DATA.WORKSPACE = { ...window.DATA.WORKSPACE, invite_code: res.invite_code };
    } catch (e) { alert(e.message); }
    finally { setCodeLoading(false); }
  };

  const deleteCode = async () => {
    if (!confirm('Davet kodu silinecek. Yeni üyeler katılamaz. Devam et?')) return;
    setCodeLoading(true);
    try {
      await API.deleteInviteCode();
      setInviteCode(null);
      window.DATA.WORKSPACE = { ...window.DATA.WORKSPACE, invite_code: null };
    } catch (e) { alert(e.message); }
    finally { setCodeLoading(false); }
  };

  const enableCode = async () => {
    setCodeLoading(true);
    try {
      const res = await API.regenInviteCode();
      setInviteCode(res.invite_code);
      window.DATA.WORKSPACE = { ...window.DATA.WORKSPACE, invite_code: res.invite_code };
    } catch (e) { alert(e.message); }
    finally { setCodeLoading(false); }
  };

  // ── Roles ─────────────────────────────────────────────────────────────────

  const openRoleForm = (existing) => {
    if (existing) {
      setRoleName(existing.name);
      setRoleColor(existing.color);
      setRolePerms(existing.permissions || []);
      setRoleDefault(existing.is_default);
      setRoleForm(existing);
    } else {
      setRoleName('');
      setRoleColor(ROLE_COLORS[0]);
      setRolePerms([]);
      setRoleDefault(false);
      setRoleForm({});
    }
  };

  const togglePerm = (p) => setRolePerms(prev =>
    prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
  );

  const saveRole = async (e) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    setRoleBusy(true);
    try {
      const body = { name: roleName.trim(), color: roleColor, permissions: rolePerms, is_default: roleDefault };
      let saved;
      if (roleForm.id) {
        saved = await API.updateRole(roleForm.id, body);
        setRoles(roles.map(r => r.id === saved.id ? saved : r));
      } else {
        saved = await API.createRole(body);
        setRoles([...roles, saved]);
      }
      window.DATA.WORKSPACE = { ...window.DATA.WORKSPACE, roles: roles };
      setRoleForm(null);
    } catch (e) { alert(e.message); }
    finally { setRoleBusy(false); }
  };

  const deleteRoleById = async (id) => {
    if (!confirm('Bu rol silinecek. Üyelerden kaldırılacak. Devam et?')) return;
    try {
      await API.deleteRole(id);
      setRoles(roles.filter(r => r.id !== id));
    } catch (e) { alert(e.message); }
  };

  // ── Members ───────────────────────────────────────────────────────────────

  const changeMemberRole = async (slug, roleId) => {
    setMemberBusy(slug);
    try {
      await API.updateMember(slug, { role_id: roleId || null });
      setMembers(members.map(m =>
        m.id === slug
          ? { ...m, role_id: roleId, role_name: roles.find(r => r.id === roleId)?.name || '' }
          : m
      ));
    } catch (e) { alert(e.message); }
    finally { setMemberBusy(null); }
  };

  const removeMember = async (slug) => {
    if (!confirm('Bu üyeyi takımdan çıkar?')) return;
    try {
      await API.removeMember(slug);
      setMembers(members.filter(m => m.id !== slug));
      DATA.MEMBERS = DATA.MEMBERS.filter(m => m.id !== slug);
    } catch (e) { alert(e.message); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="settings-wrap">
      <h1>Ayarlar<em>.</em></h1>
      <p className="settings-sub">Hesabınızı, çalışma alanınızı ve görünümü yönetin.</p>

      {/* ── Profile ── */}
      <div className="settings-section">
        <div>
          <h3>Profil</h3>
          <p className="desc">Takım üyelerinin sizi nasıl göreceği.</p>
        </div>
        <div className="settings-card">
          <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:18 }}>
            <Avatar member={me} size="lg" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Ad Soyad</label>
              <input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>E-posta (değiştirmek için girin)</label>
              <input type="email" value={email} placeholder={me.id ? `${me.id}@...` : ''} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop:12 }}>
            <label>Başlık / Rol</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="Founder · Product Manager" />
          </div>
          <div style={{ marginTop:14 }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>
              {busy ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Appearance ── */}
      <div className="settings-section">
        <div>
          <h3>Görünüm</h3>
          <p className="desc">Tema, renk ve tipografi tercihlerin.</p>
        </div>
        <div className="settings-card settings-panel">
          <div className="tweak-group">
            <div className="tweak-label">Tema</div>
            <div className="tweak-options">
              {['light','cream','dark'].map(t => (
                <button key={t} className="tweak-opt" data-active={tweaks.theme===t} onClick={() => setTweak('theme',t)}>
                  {t==='light' ? 'Açık' : t==='cream' ? 'Krem' : 'Koyu'}
                </button>
              ))}
            </div>
          </div>
          <div className="tweak-group">
            <div className="tweak-label">Vurgu rengi</div>
            <div className="swatch-row">
              {[['terracotta','oklch(55% 0.13 25)'],['sage','oklch(55% 0.09 150)'],['slate','oklch(50% 0.04 250)'],['indigo','oklch(52% 0.15 270)'],['plum','oklch(50% 0.14 340)']].map(([k,v]) => (
                <button key={k} className="swatch" data-active={tweaks.accent===k} style={{ background:v }} onClick={() => setTweak('accent',k)} />
              ))}
            </div>
          </div>
          <div className="tweak-group">
            <div className="tweak-label">Yoğunluk</div>
            <div className="tweak-options">
              {['airy','balanced','compact'].map(d => (
                <button key={d} className="tweak-opt" data-active={tweaks.density===d} onClick={() => setTweak('density',d)}>
                  {d==='airy' ? 'Ferah' : d==='balanced' ? 'Dengeli' : 'Kompakt'}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Workspace / Invite code ── (owner only) */}
      {isOwner && (
        <div className="settings-section">
          <div>
            <h3>Davet Kodu</h3>
            <p className="desc">Bu kodu paylaşarak takıma üye ekleyin.</p>
          </div>
          <div className="settings-card settings-panel">
            {inviteCode ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', background:'var(--bg-raised)', border:'1px solid var(--line)', borderRadius:10, marginBottom:12 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:22, letterSpacing:'0.15em', fontWeight:600, color:'var(--ink)', flex:1 }}>
                    {inviteCode}
                  </span>
                  <button className="btn btn-ghost" onClick={copyCode} style={{ fontSize:12, padding:'5px 10px' }}>
                    {codeCopied ? '✓ Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost" onClick={regenCode} disabled={codeLoading}>
                    <Icon name="refresh" size={13} /> Yenile
                  </button>
                  <button className="btn btn-ghost" onClick={deleteCode} disabled={codeLoading} style={{ color:'var(--status-rose)' }}>
                    <Icon name="trash" size={13} /> Kodu Sil
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:13, color:'var(--ink-muted)', padding:'12px 14px', background:'var(--bg-subtle)', borderRadius:8 }}>
                  Davet kodu yok — şu an kimse davet edilemiyor.
                </div>
                <button className="btn btn-primary" onClick={enableCode} disabled={codeLoading}>
                  <Icon name="plus" size={13} /> Davet Kodu Oluştur
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Roles ── (owner only) */}
      {isOwner && (
        <div className="settings-section">
          <div>
            <h3>Roller</h3>
            <p className="desc">Özel roller ve izinler tanımlayın.</p>
          </div>
          <div className="settings-card settings-panel">
            {/* Role list */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
              {roles.map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-raised)', border:'1px solid var(--line)', borderRadius:9 }}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:r.color, flexShrink:0 }} />
                  <span style={{ fontWeight:500, fontSize:13, flex:1 }}>{r.name}</span>
                  {r.is_default && <span style={{ fontSize:10, padding:'2px 6px', background:'var(--accent-soft)', color:'var(--accent-ink)', borderRadius:4 }}>Varsayılan</span>}
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="icon-btn" title="Düzenle" onClick={() => openRoleForm(r)}><Icon name="edit" size={13} /></button>
                    <button className="icon-btn" title="Sil" onClick={() => deleteRoleById(r.id)} style={{ color:'var(--status-rose)' }}><Icon name="trash" size={13} /></button>
                  </div>
                </div>
              ))}
              {roles.length === 0 && (
                <div style={{ fontSize:13, color:'var(--ink-muted)', padding:'10px 0' }}>Henüz özel rol yok.</div>
              )}
            </div>

            {/* Add role button */}
            {!roleForm && (
              <button className="btn btn-ghost" onClick={() => openRoleForm(null)}>
                <Icon name="plus" size={13} /> Yeni Rol
              </button>
            )}

            {/* Role form */}
            {roleForm !== null && (
              <form onSubmit={saveRole} style={{ marginTop:8, padding:'16px', background:'var(--bg-subtle)', borderRadius:10, border:'1px solid var(--line)' }}>
                <div style={{ fontWeight:500, fontSize:13, marginBottom:12, color:'var(--ink)' }}>
                  {roleForm.id ? 'Rolü Düzenle' : 'Yeni Rol'}
                </div>
                <div className="field" style={{ marginBottom:10 }}>
                  <label>Rol Adı</label>
                  <input autoFocus placeholder="Örn: Geliştirici, Tasarımcı…" value={roleName} onChange={e => setRoleName(e.target.value)} required />
                </div>
                <div className="field" style={{ marginBottom:10 }}>
                  <label>Renk</label>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                    {ROLE_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setRoleColor(c)}
                        style={{ width:24, height:24, borderRadius:6, background:c, cursor:'pointer', flexShrink:0,
                          border: roleColor===c ? '2px solid var(--ink)' : '2px solid transparent',
                          transform: roleColor===c ? 'scale(1.15)' : 'none' }} />
                    ))}
                  </div>
                </div>
                <div className="field" style={{ marginBottom:10 }}>
                  <label>İzinler</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {ALL_PERMS.map(p => (
                      <label key={p} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                        <input type="checkbox" checked={rolePerms.includes(p)} onChange={() => togglePerm(p)} style={{ accentColor:'var(--accent)' }} />
                        {PERM_LABELS[p]}
                      </label>
                    ))}
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', marginBottom:14 }}>
                  <input type="checkbox" checked={roleDefault} onChange={e => setRoleDefault(e.target.checked)} style={{ accentColor:'var(--accent)' }} />
                  Yeni üyeler için varsayılan rol
                </label>
                <div style={{ display:'flex', gap:8 }}>
                  <button type="submit" className="btn btn-primary" disabled={roleBusy || !roleName.trim()}>
                    {roleBusy ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setRoleForm(null)}>İptal</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Members ── */}
      {ws.name && (
        <div className="settings-section">
          <div>
            <h3>Takım Üyeleri</h3>
            <p className="desc">{members.length} üye · {ws.name}</p>
          </div>
          <div className="settings-card settings-panel">
            {members.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'var(--bg-raised)', border:'1px solid var(--line)', borderRadius:9 }}>
                <Avatar member={m} size="md" />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>
                    {m.name}
                    {m.ws_role === 'owner' && (
                      <span style={{ marginLeft:6, fontSize:10, padding:'2px 6px', background:'oklch(65% 0.11 70 / 0.2)', color:'oklch(50% 0.1 70)', borderRadius:4 }}>Sahip</span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--ink-muted)' }}>{m.role || m.role_name || 'Üye'}</div>
                </div>
                {isOwner && m.ws_role !== 'owner' && (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <select
                      value={m.role_id || ''}
                      onChange={e => changeMemberRole(m.id, e.target.value ? parseInt(e.target.value) : null)}
                      disabled={memberBusy === m.id}
                      style={{ fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--ink)', cursor:'pointer' }}
                    >
                      <option value="">— Rol seç —</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <button
                      className="icon-btn"
                      title="Üyeyi çıkar"
                      onClick={() => removeMember(m.id)}
                      style={{ color:'var(--status-rose)' }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      <div className="settings-section">
        <div>
          <h3>Bildirimler</h3>
          <p className="desc">Uygulama içi bildirim tercihleri.</p>
        </div>
        <div className="settings-card settings-panel">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Mesaj Bildirimleri
          </div>
          <div className="tweak-toggle" onClick={() => setTweak('notifyMessages', !(tweaks.notifyMessages !== false))}>
            <span>Mesaj bildirimlerini etkinleştir</span>
            <div className="toggle" data-on={tweaks.notifyMessages !== false} />
          </div>
          <div className="tweak-toggle" style={{ opacity: tweaks.notifyMessages === false ? 0.4 : 1 }}
            onClick={() => tweaks.notifyMessages !== false && setTweak('notifyToasts', !(tweaks.notifyToasts !== false))}>
            <span>Sağ alt köşe baloncukları</span>
            <div className="toggle" data-on={tweaks.notifyMessages !== false && tweaks.notifyToasts !== false} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 10px' }}>
            Görev Bildirimleri
          </div>
          <div className="tweak-toggle" onClick={() => setTweak('notifyAssigned', !(tweaks.notifyAssigned !== false))}>
            <span>Bir kart sana atandığında</span>
            <div className="toggle" data-on={tweaks.notifyAssigned !== false} />
          </div>
          <div className="tweak-toggle" onClick={() => setTweak('notifyComments', !(tweaks.notifyComments !== false))}>
            <span>Takip ettiğin kartta yorum olduğunda</span>
            <div className="toggle" data-on={tweaks.notifyComments !== false} />
          </div>
          <div className="tweak-toggle" onClick={() => setTweak('notifyWeekly', !tweaks.notifyWeekly)}>
            <span>Haftalık özet (Pzt sabahı)</span>
            <div className="toggle" data-on={!!tweaks.notifyWeekly} />
          </div>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div className="settings-section">
        <div>
          <h3 style={{ color:'var(--status-rose)' }}>Tehlikeli bölge</h3>
          <p className="desc">Geri alınamayan işlemler.</p>
        </div>
        <div className="settings-card settings-panel">
          {onLogout && (
            <button className="btn btn-ghost" style={{ justifyContent:'flex-start' }} onClick={onLogout}>
              <Icon name="logOut" size={14} /> Çıkış yap
            </button>
          )}
          <button className="btn btn-ghost" style={{ justifyContent:'flex-start', color:'var(--status-rose)', borderColor:'oklch(58% 0.13 10 / 0.3)' }}>
            <Icon name="trash" size={14} /> Hesabı sil
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({ label, defaultOn }) {
  const [on, setOn] = React.useState(defaultOn);
  return (
    <div className="tweak-toggle" onClick={() => setOn(!on)}>
      {label && <span>{label}</span>}
      <div className="toggle" data-on={on} />
    </div>
  );
}

window.SettingsView = SettingsView;
