// Settings view

function SettingsView({ tweaks, setTweak }) {
  return (
    <div className="settings-wrap">
      <h1>Ayarlar<em>.</em></h1>
      <p className="settings-sub">Hesabınızı, çalışma alanınızı ve görünümü yönetin.</p>

      <div className="settings-section">
        <div>
          <h3>Profil</h3>
          <p className="desc">Takım üyelerinin sizi nasıl göreceği.</p>
        </div>
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <Avatar member={DATA.MEMBERS[0]} size="lg" />
            <button className="btn btn-ghost">Fotoğraf yükle</button>
            <button className="btn btn-ghost" style={{ color: 'var(--status-rose)' }}>Kaldır</button>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Ad Soyad</label>
              <input defaultValue="Aliz Kaya" />
            </div>
            <div className="field">
              <label>E-posta</label>
              <input defaultValue="aliz@stoalabs.co" />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Başlık</label>
            <input defaultValue="Founder · Product Manager" />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div>
          <h3>Görünüm</h3>
          <p className="desc">Tema, renk ve tipografi tercihlerin.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tweak-group">
            <div className="tweak-label">Tema</div>
            <div className="tweak-options">
              {['light','cream','dark'].map(t => (
                <button key={t} className="tweak-opt" data-active={tweaks.theme === t} onClick={() => setTweak('theme', t)}>
                  {t === 'light' ? 'Açık' : t === 'cream' ? 'Krem' : 'Koyu'}
                </button>
              ))}
            </div>
          </div>
          <div className="tweak-group">
            <div className="tweak-label">Vurgu rengi</div>
            <div className="swatch-row">
              {[
                ['terracotta','oklch(55% 0.13 25)'],
                ['sage','oklch(55% 0.09 150)'],
                ['slate','oklch(50% 0.04 250)'],
                ['indigo','oklch(52% 0.15 270)'],
                ['plum','oklch(50% 0.14 340)'],
              ].map(([k, v]) => (
                <button key={k} className="swatch" data-active={tweaks.accent === k} style={{ background: v }} onClick={() => setTweak('accent', k)} />
              ))}
            </div>
          </div>
          <div className="tweak-group">
            <div className="tweak-label">Yoğunluk</div>
            <div className="tweak-options">
              {['airy','balanced','compact'].map(d => (
                <button key={d} className="tweak-opt" data-active={tweaks.density === d} onClick={() => setTweak('density', d)}>
                  {d === 'airy' ? 'Ferah' : d === 'balanced' ? 'Dengeli' : 'Kompakt'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div>
          <h3>Bildirimler</h3>
          <p className="desc">E-posta ve uygulama içi bildirim tercihleri.</p>
        </div>
        <div>
          {[
            ['Bir kart sana atandığında', true],
            ['Takip ettiğin kartta yorum olduğunda', true],
            ['Bir kart senin son tarihini geçtiğinde', true],
            ['Haftalık özet (Pzt sabahı)', false],
            ['Pazarlama güncellemeleri', false],
          ].map(([label, defaultOn]) => (
            <SettingsToggle key={label} label={label} defaultOn={defaultOn} />
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div>
          <h3>Çalışma alanı</h3>
          <p className="desc">Stoa Labs için takım ayarları (yalnızca yöneticiler).</p>
        </div>
        <div>
          <div className="field">
            <label>Çalışma alanı adı</label>
            <input defaultValue="Stoa Labs" />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Slug</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-muted)' }}>
              stoaboard.app/<strong style={{ color: 'var(--ink)' }}>stoa-labs</strong>
            </div>
          </div>
          <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-subtle)', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="globe" size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Çalışma alanını herkese açık yap</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Bağlantıya sahip olan herkes görüntüleyebilir (düzenleyemez).</div>
            </div>
            <SettingsToggle label="" defaultOn={false} inline />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div>
          <h3 style={{ color: 'var(--status-rose)' }}>Tehlikeli bölge</h3>
          <p className="desc">Geri alınamayan işlemler.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}><Icon name="archive" size={14} /> Çalışma alanını arşivle</button>
          <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--status-rose)', borderColor: 'oklch(58% 0.13 10 / 0.3)' }}>
            <Icon name="trash" size={14} /> Hesabı sil
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({ label, defaultOn, inline }) {
  const [on, setOn] = React.useState(defaultOn);
  return (
    <div className="tweak-toggle" onClick={() => setOn(!on)}>
      {label && <span>{label}</span>}
      <div className="toggle" data-on={on} />
    </div>
  );
}

window.SettingsView = SettingsView;
