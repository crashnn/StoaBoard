// Notifications panel — API-backed

import React from 'react';
import { Icon } from './icons.jsx';
import { Avatar } from './shell.jsx';
import { panelGorunur } from './rozet.js';
import { API, renderNotifText, fmtTimeAgo, fmtAbsoluteDateTime } from './data.jsx';

function _parseNotifType(text) {
  try { const d = JSON.parse(text); if (d?.type) return d.type; } catch (_) {}
  return null;
}

// Zil sayacı da (app.jsx) aynı tür çözümünü kullanıyor; dışa açık.
export function notifType(text) { return _notifType(text); }

function _notifType(text) {
  const t = _parseNotifType(text);
  if (t) return t;
  const low = (text || '').toLowerCase();
  if (/mesaj gönderdi|gönderdi:|dm_received/.test(low)) return 'dm_received';
  if (/atadı|görev|atand|task_assigned/.test(low)) return 'task_assigned';
  if (/@|mention/.test(low)) return 'mention';
  return 'info';
}

function _notifIcon(type) {
  return {
    dm_received: 'msg', message: 'msg',
    task_assigned: 'circleCheck', task: 'circleCheck',
    mention: 'at', comment_added: 'msg',
    join_request: 'bell', join_approved: 'bell', join_rejected: 'bell',
    channel_added: 'msg', calendar: 'calendar', info: 'bell',
  }[type] || 'bell';
}

function _notifCategory(n) {
  const structured = _parseNotifType(n.text);
  if (structured) {
    if (['mention'].includes(structured)) return 'mention';
    if (['dm_received', 'channel_added'].includes(structured)) return 'message';
    if (['task_assigned', 'comment_added'].includes(structured)) return 'task';
    return 'other';
  }
  const t = (n.text || '').toLowerCase();
  if (n.chat_channel || n.sender_slug) return 'message';
  if (n.task_id) return 'task';
  if (/@/.test(t)) return 'mention';
  return 'other';
}

function NotifPanel({ open, onClose, socket, onOpenTask, onOpenChat, currentWsId, tweaks, setTweak, fullPage }) {
  const [tab, setTab]           = React.useState('all');
  // Tam ekranda tercihler acik baslar; ama dar ekranda alt alta dizildigi icin
  // ekranin yarisini kaplayip bildirimleri gormeyi engelliyordu — orada kapali baslasin.
  const [prefsOpen, setPrefsOpen] = React.useState(
    () => fullPage && !(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 980px)').matches),
  );
  const [items, setItems]       = React.useState(() => DATA.NOTIFICATIONS || []);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    // fullPage modunda panel sayfanın kendisidir — outside click kapanma
    // davranışı uygulanmaz; aksi halde sekmeye tıkladığında panel dışı algılanıp
    // hemen dashboard'a dönüyordu.
    if (fullPage) return;
    const handler = (e) => {
      // Zil butonuna tiklamayi "disari tiklama" sayma: mousedown paneli kapatiyor,
      // ardindan butonun click'i tekrar aciyordu — panel bir turlu kapanmiyordu.
      if (e.target.closest?.('[data-notif-toggle]')) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, fullPage]);

  // Yükleme başarısız olursa panel BOŞ görünüyordu — "bildirimin yok" ile
  // "bildirimleri getiremedim" aynı ekrana çıkıyordu (kart #193 ile aynı
  // sınıf). Liste artık elde olanla duruyor ve sebep toast'a yazılıyor.
  const yuklemeHatasi = (e) => {
    window.showToast?.(
      (window.t?.('notif_err_load') || 'Bildirimler yüklenemedi')
      + (e?.message ? `: ${e.message}` : ''),
      'error',
    );
  };

  React.useEffect(() => {
    if (open) {
      API.getNotifications()
        .then(notifs => {
          setItems(notifs);
          DATA.NOTIFICATIONS = notifs;
          const unread = notifs.filter(n => n.unread).length;
          if (unread === 0) window.__NOTIF_BADGE_RESET__?.();
        })
        .catch(yuklemeHatasi);
    }
  }, [open]);

  // Full-page: also reload on mount since open is always true
  React.useEffect(() => {
    if (fullPage) {
      API.getNotifications()
        .then(notifs => { setItems(notifs); DATA.NOTIFICATIONS = notifs; })
        .catch(yuklemeHatasi);
    }
  }, [fullPage]);

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

  // İyimser güncelleme + yutulan hata = sessiz başarısızlık.
  //
  // KUSUR (17 Eylül 2026, kullanıcının mobil saha turu, kart #193): beş
  // bildirim işleminin beşi de `catch (_) {}` taşıyordu ve hepsi ekranı
  // SUNUCUYA YAZMADAN ÖNCE güncelliyordu. Yazma başarısız olduğunda ekran
  // "oldu" diyor, kayıt "olmadı" diyordu; kullanıcı "Tümünü oku"ya basıyor,
  // işlem başarılı görünüyor, sonraki açılışta bildirimler okunmamış geri
  // geliyordu. Başarısızlığın kendisi kadar kötüsü GÖRÜNMEZ olması: ne
  // kullanıcı ne de hata ayıklayan sebebi öğrenebiliyordu.
  //
  // CLAUDE.md'nin kuralı: yokluk hâli ya reddetmeli ya gürültü çıkarmalı.
  // Burada ikisi de yapılıyor — iyimser değişiklik GERİ ALINIYOR (ekran
  // yeniden gerçeği gösteriyor) ve hata toast'a yazılıyor.
  //
  // `onceki`nin `setItems` dışında yakalanma sebebi: React 18'de durum
  // güncelleyici saf olmalı, içinden bir değişkene yazmak StrictMode'un çift
  // çağrısında yanlış anlık görüntü bırakır. `items` render kapanışından
  // okunuyor ve bu işleyicilerin hepsi kullanıcı olayından çağrılıyor, yani
  // tazedir.
  const geriAl = (onceki, e) => {
    setItems(onceki);
    DATA.NOTIFICATIONS = onceki;
    window.showToast?.(
      (window.t?.('notif_err_action') || 'Bildirim işlemi kaydedilemedi')
      + (e?.message ? `: ${e.message}` : ''),
      'error',
    );
  };

  const markRead = async (id) => {
    const onceki = items;
    setItems(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    try { await API.markRead(id); } catch (e) { geriAl(onceki, e); }
  };

  const markAllRead = async () => {
    const onceki = items;
    setItems(prev => prev.map(n => ({ ...n, unread: false })));
    try {
      await API.markAllRead();
      const fresh = await API.getNotifications();
      setItems(fresh);
      DATA.NOTIFICATIONS = fresh;
      window.__NOTIF_BADGE_RESET__?.();
    } catch (e) { geriAl(onceki, e); }
  };

  const deleteAll = async () => {
    const onceki = items;
    const ids = filtered.map(n => n.id);
    setItems(prev => prev.filter(n => !ids.includes(n.id)));
    setConfirmDel(false);
    try { await Promise.all(ids.map(id => API.deleteNotif(id))); } catch (e) { geriAl(onceki, e); }
  };

  const dismiss = async (e, id) => {
    e.stopPropagation();
    const onceki = items;
    setItems(prev => prev.filter(n => n.id !== id));
    try { await API.deleteNotif(id); } catch (err) { geriAl(onceki, err); }
  };

  const handleNotifClick = (n) => {
    markRead(n.id);
    const type = n.type || _notifType(n.text);

    // ── DM → open DM conversation ────────────────────────────────────────────
    if (type === 'dm_received') {
      onOpenChat?.(n.sender_slug || null, n.message_id || null);
      return;
    }

    // ── Channel message → navigate to that channel ───────────────────────────
    if (type === 'message') {
      if (n.chat_channel) {
        onOpenChat?.(null, n.message_id || null, n.chat_channel);
      } else {
        onOpenChat?.(n.sender_slug || null, n.message_id || null);
      }
      return;
    }

    // ── Chat mention (no task) → open channel or DM ──────────────────────────
    if (type === 'mention' && !n.task_id) {
      if (n.chat_channel) {
        onOpenChat?.(null, n.message_id || null, n.chat_channel);
      } else {
        onOpenChat?.(n.sender_slug || null, n.message_id || null);
      }
      return;
    }

    // ── Task assignment / comment → open task on board ───────────────────────
    if (n.task_id) {
      const task = (window.__APP_TASKS__ || []).find(t => String(t.id) === String(n.task_id))
                || (window.DATA?.tasks || []).find(t => String(t.id) === String(n.task_id));
      if (task) { onOpenTask?.(task); return; }
      if (window.__OPEN_TASK_BY_ID__) { window.__OPEN_TASK_BY_ID__(n.task_id); return; }
    }

    // ── Channel mention fallback ──────────────────────────────────────────────
    if (n.chat_channel) {
      onOpenChat?.(null, n.message_id || null, n.chat_channel);
      return;
    }

    // ── Sender slug fallback ──────────────────────────────────────────────────
    if (n.sender_slug) {
      onOpenChat?.(n.sender_slug, n.message_id || null);
    }
  };

  // Aktif alanın bildirimleri + doğrudan mesajlar. Kural rozet.js'te; zil de
  // aynı kuralla sayıyor, aksi hâlde zil dolu panel boş kalıyordu (15 Eylül).
  const visibleItems = items.filter(n => panelGorunur(n, currentWsId, _notifType(n.text)));
  // Sekme sayıları yalnızca OKUNMAMIŞ sayar (15 Eylül). Eskiden toplamı
  // sayıyordu: "All 14" hepsi okunduktan sonra da 14 kalıyor, kullanıcı
  // "baktım, neden gitmiyor" diyordu. Hepsi okununca sayı kaybolur; liste
  // yine tamamını gösterir.
  const counts = visibleItems.reduce((acc, n) => {
    if (!n.unread) return acc;
    const c = _notifCategory(n);
    acc[c] = (acc[c] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    acc.unread = (acc.unread || 0) + 1;
    return acc;
  }, {});
  const filtered = tab === 'all' ? visibleItems
                 : tab === 'unread' ? visibleItems.filter(n => n.unread)
                 : visibleItems.filter(n => _notifCategory(n) === tab);
  const unreadCount = counts.unread || 0;

  // Nokta buradan besleniyor. Panel okundu/okunmadı işaretlemesini yapan yer,
  // dolayısıyla gerçeği ilk bilen de burası: "tümünü oku"dan sonra noktanın
  // gitmesi bu satıra bağlı. Sayı zaten panelGorunur'dan geçmiş öğelerden
  // geliyor, yani zil ve panel aynı kümeyi sayıyor — ikisinin ayrışması bu
  // depoda bir kez kusur olmuştu (15 Eylül).
  React.useEffect(() => {
    window.__NOTIF_UNREAD_SET__?.(unreadCount);
  }, [unreadCount]);

  const tabs = [
    { id: 'all',      label: window.t('notif_tab_all'),      count: counts.all || 0 },
    { id: 'unread',   label: window.t('notif_tab_unread'),   count: counts.unread || 0 },
    { id: 'mention',  label: window.t('notif_tab_mention'),  count: counts.mention || 0 },
    { id: 'message',  label: window.t('notif_tab_message'),  count: counts.message || 0 },
    { id: 'task',     label: window.t('notif_tab_task'),     count: counts.task || 0 },
    { id: 'calendar', label: window.t('notif_tab_calendar'), count: counts.calendar || 0 },
  ];

  // Preferences (reflect tweaks; default ON if undefined)
  const T = tweaks || {};
  const v = (k, def = true) => (T[k] === undefined ? def : !!T[k]);
  const updatePref = (k, val) => setTweak?.(k, val);

  return (
    <>
      <div
        className="notif-panel"
        ref={panelRef}
        data-open={open || !!fullPage}
        data-full-page={!!fullPage}
      >
        <div className="notif-head">
          <div className="notif-title">{window.t('notif_title')}</div>
          {unreadCount > 0 && <div className="notif-count">{unreadCount}</div>}
          {fullPage && (
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', fontSize: 11.5 }}
              onClick={markAllRead}
            >
              <Icon name="check" size={12} /> {window.t('notif_mark_all_read')}
            </button>
          )}
        </div>
        <div className="notif-tabs notif-tabs-scroll">
          {tabs.map(t => (
            <button key={t.id} data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
              {t.count > 0 && <span className="notif-tab-count">{t.count > 99 ? '99+' : t.count}</span>}
            </button>
          ))}
        </div>

        <div className="notif-list">
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              <Icon name="check" size={20} /><br />{window.t('notif_empty')}
            </div>
          )}
          {filtered.map(n => {
            const type = n.type || _notifType(n.text);
            // Bildirimi kimin tetiklediği (`sender_slug`) sunucudan zaten
            // geliyordu ama panel yalnızca tür simgesi çiziyordu; "beni kim
            // atadı" sorusu satırdan okunamıyordu (15 Eylül, demo provası).
            // Üye listesi aktif alana ait: gönderen orada yoksa (alandan
            // çıkarılmış ya da başka alanın bildirimi) simge olduğu gibi kalır,
            // boş kutu çizilmez.
            const sender = n.sender_slug
              ? (window.DATA?.MEMBERS || []).find(m => m.id === n.sender_slug)
              : null;
            return (
              <div
                key={n.id}
                className={`notif-item notif-type-${type}`}
                data-unread={n.unread}
                onClick={() => handleNotifClick(n)}
                style={{ cursor: (n.task_id || n.sender_slug || n.chat_channel || ['dm_received','message','mention','task_assigned','comment_added'].includes(n.type || _notifType(n.text))) ? 'pointer' : 'default' }}
              >
                {sender ? (
                  <Avatar member={sender} size="md" />
                ) : (
                  <div className="notif-icon-badge">
                    <Icon name={_notifIcon(type)} size={13} />
                  </div>
                )}
                <div className="notif-body">
                  <div className="notif-text" dangerouslySetInnerHTML={{ __html: renderNotifText(n.text) }} />
                  <div className="notif-time" title={fmtAbsoluteDateTime(n.time) || ''}>{fmtTimeAgo(n.time)}</div>
                </div>
                {(n.task_id || n.sender_slug || n.chat_channel || ['dm_received','message','mention','task_assigned','comment_added'].includes(n.type || _notifType(n.text))) && (
                  <Icon name="arrowRight" size={11} style={{ color: 'var(--ink-faint)', flexShrink: 0, marginRight: 24 }} />
                )}
                <button
                  className="notif-dismiss"
                  onClick={(e) => dismiss(e, n.id)}
                  title={window.t('notif_dismiss')}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Preferences özet section */}
        <div className="notif-prefs">
          <button
            className="notif-prefs-toggle"
            onClick={() => setPrefsOpen(o => !o)}
            aria-expanded={prefsOpen}
          >
            <Icon name="settings" size={12} />
            <span>{window.t('notif_prefs')}</span>
            <Icon name={prefsOpen ? 'chevronUp' : 'chevronDown'} size={11} style={{ marginLeft: 'auto' }} />
          </button>
          {prefsOpen && (
            <div className="notif-prefs-body">
              <NotifPrefRow
                label={window.t('notif_pref_sound')}
                desc={window.t('notif_pref_sound_desc')}
                checked={v('soundEnabled', true)}
                onChange={(b) => updatePref('soundEnabled', b)}
              />
              <NotifPrefRow
                label={window.t('notif_pref_dnd')}
                desc={window.t('notif_pref_dnd_desc')}
                checked={v('dndEnabled', false)}
                onChange={(b) => updatePref('dndEnabled', b)}
              />
              {v('dndEnabled', false) && (
                <div className="notif-pref-schedule">
                  <span>{window.t('notif_pref_dnd_time')}</span>
                  <input
                    type="time"
                    value={T.dndStart || '19:00'}
                    onChange={(e) => updatePref('dndStart', e.target.value)}
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={T.dndEnd || '08:00'}
                    onChange={(e) => updatePref('dndEnd', e.target.value)}
                  />
                </div>
              )}
              <NotifPrefRow
                label={window.t('notif_pref_desktop')}
                desc={window.t('notif_pref_desktop_desc')}
                checked={v('desktopPush', true)}
                onChange={(b) => updatePref('desktopPush', b)}
              />
              <NotifPrefRow
                label={window.t('notif_pref_cross_dm')}
                desc={window.t('notif_pref_cross_dm_desc')}
                checked={v('crossTeamDM', true)}
                onChange={(b) => updatePref('crossTeamDM', b)}
              />

              <div className="notif-prefs-foot">
                <button onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('stoa:gotoSettings', { detail: { section: 'notifications' } })); }}>
                  {window.t('notif_all_settings')} →
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', fontSize: 12, gap: 8 }}>
          {confirmDel ? (
            <>
              <span style={{ color: 'var(--ink-muted)' }}>{window.t('notif_confirm_delete')}</span>
              <button style={{ color: 'var(--status-rose)', fontWeight: 600 }} onClick={deleteAll}>{window.t('notif_yes')}</button>
              <button style={{ color: 'var(--ink-muted)' }} onClick={() => setConfirmDel(false)}>{window.t('notif_no')}</button>
            </>
          ) : (
            <>
              <button style={{ color: 'var(--ink-muted)' }} onClick={markAllRead}>
                {window.t('notif_mark_all_read')}
              </button>
              {filtered.length > 0 && (
                <button style={{ color: 'var(--status-rose)' }} onClick={() => setConfirmDel(true)}>
                  {window.t('notif_delete_all')}
                </button>
              )}
            </>
          )}
          <button style={{ marginLeft: 'auto', color: 'var(--ink-muted)' }} onClick={onClose}>
            {window.t('notif_close')} <Icon name="arrowRight" size={11} />
          </button>
        </div>
      </div>
    </>
  );
}

function NotifPrefRow({ label, desc, checked, onChange }) {
  return (
    <div className="notif-pref-row">
      <div className="notif-pref-text">
        <div className="notif-pref-label">{label}</div>
        {desc && <div className="notif-pref-desc">{desc}</div>}
      </div>
      <button
        type="button"
        className="toggle-switch"
        data-on={!!checked}
        onClick={() => onChange?.(!checked)}
        aria-pressed={!!checked}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export { NotifPanel, NotifPrefRow };
