// Team chat panel — real-time DM + group chat, file/image/video sharing

const { useState: useChatS, useEffect: useChatE, useRef: useChatRef, useCallback: useChatCb } = React;

// ── Lightbox ──────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useChatE(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'oklch(0% 0 0 / 0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'zoom-out',
    }}>
      <img src={src} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
      <button onClick={onClose} style={{
        position: 'absolute', top: 18, right: 22, background: 'oklch(20% 0 0 / 0.6)',
        color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 18,
      }}>✕</button>
    </div>
  );
}

// ── File size formatter ───────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Message bubble content ────────────────────────────────────────────────
function MsgContent({ msg, onImageClick }) {
  if (msg.file_type === 'image') {
    return (
      <div className="chat-media-wrap">
        <img
          src={msg.file_url} alt={msg.file_name || 'Resim'}
          className="chat-media-img"
          onClick={() => onImageClick(msg.file_url)}
          loading="lazy"
        />
        {msg.text && <div className="chat-bubble-text">{msg.text}</div>}
      </div>
    );
  }
  if (msg.file_type === 'video') {
    return (
      <div className="chat-media-wrap">
        <video src={msg.file_url} controls className="chat-media-video" />
        {msg.text && <div className="chat-bubble-text">{msg.text}</div>}
      </div>
    );
  }
  if (msg.file_type === 'file') {
    return (
      <div className="chat-file-attach">
        <Icon name="paperclip" size={14} />
        <a href={msg.file_url} target="_blank" rel="noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {msg.file_name || 'Dosya'}
        </a>
        {msg.text && <div className="chat-bubble-text" style={{ marginTop: 4 }}>{msg.text}</div>}
      </div>
    );
  }
  return <span>{msg.text}</span>;
}

// ── Main Chat Panel ───────────────────────────────────────────────────────
function ChatPanel({ open, onClose, onlineUsers, members: membersProp }) {
  const [tab, setTab]             = useChatS('general');
  const [dmWith, setDmWith]       = useChatS(null);
  const [messages, setMessages]   = useChatS([]);
  const [text, setText]           = useChatS('');
  const [typingUser, setTypingUser] = useChatS(null);
  const [uploading, setUploading] = useChatS(false);
  const [lightbox, setLightbox]   = useChatS(null);
  const [pendingFile, setPendingFile] = useChatS(null); // {file, url, type, name} — preview before send

  const bottomRef   = useChatRef(null);
  const typingTimer = useChatRef(null);
  const inputRef    = useChatRef(null);
  const fileRef     = useChatRef(null);
  const msgIds      = useChatRef(new Set()); // deduplicate socket echoes

  const me = window.CURRENT_USER?.id;
  const allMembers = membersProp || DATA.MEMBERS || [];
  const members = allMembers.filter(m => m.id !== me);
  const dmUser = dmWith ? allMembers.find(m => m.id === dmWith) : null;
  const online = onlineUsers || new Set();

  // ── Load history ──────────────────────────────────────────────────────
  useChatE(() => {
    if (!open) return;
    msgIds.current = new Set();
    const url = dmWith ? `/api/chat/messages?with=${dmWith}` : '/api/chat/messages';
    fetch(url)
      .then(r => r.json())
      .then(msgs => {
        if (!Array.isArray(msgs)) return;
        msgs.forEach(m => msgIds.current.add(String(m.id)));
        setMessages(msgs);
      })
      .catch(() => setMessages([]));
  }, [open, dmWith]);

  // ── Socket listeners ──────────────────────────────────────────────────
  useChatE(() => {
    const sock = window.SOCKET;
    if (!sock) return;

    const onMsg = (msg) => {
      // Check relevance
      let relevant = false;
      if (dmWith) {
        relevant = (msg.from === dmWith && msg.to === me) || (msg.from === me && msg.to === dmWith);
      } else {
        relevant = !msg.to;
      }
      if (!relevant) return;

      const msgKey = String(msg.id);
      if (msgIds.current.has(msgKey)) return; // already shown (optimistic or duplicate)
      msgIds.current.add(msgKey);

      setMessages(prev => {
        // Replace matching optimistic message
        const optIdx = prev.findIndex(m => m._temp && m.from === msg.from && m.text === msg.text && !msg.file_url);
        if (optIdx !== -1) {
          const next = [...prev];
          next[optIdx] = msg;
          return next;
        }
        return [...prev, msg];
      });
    };

    const onTyping = ({ user, typing }) => {
      if (user === dmWith) {
        setTypingUser(typing ? user : null);
        if (typing) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingUser(null), 3000);
        }
      }
    };

    sock.on('chat_message', onMsg);
    sock.on('typing', onTyping);
    return () => {
      sock.off('chat_message', onMsg);
      sock.off('typing', onTyping);
    };
  }, [dmWith, me]);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useChatE(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Focus input ───────────────────────────────────────────────────────
  useChatE(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open, dmWith]);

  // ── Send text message ─────────────────────────────────────────────────
  const sendMessage = () => {
    const t = text.trim();
    if (!t && !pendingFile) return;
    if (!window.SOCKET) return;

    if (pendingFile) {
      // File already uploaded; send socket event with file info
      const tempMsg = {
        id: `temp_${Date.now()}`,
        from: me,
        to: dmWith || null,
        text: t || '',
        file_url: pendingFile.url,
        file_type: pendingFile.type,
        file_name: pendingFile.name,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        _temp: true,
      };
      setMessages(prev => [...prev, tempMsg]);
      window.SOCKET.emit('chat_message', {
        text: t || '',
        to: dmWith || null,
        file_url: pendingFile.url,
        file_type: pendingFile.type,
        file_name: pendingFile.name,
      });
      setPendingFile(null);
      setText('');
      return;
    }

    // Optimistic text message
    const tempMsg = {
      id: `temp_${Date.now()}`,
      from: me,
      to: dmWith || null,
      text: t,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      _temp: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    window.SOCKET.emit('chat_message', { text: t, to: dmWith || null });
    setText('');
  };

  // ── File pick & upload ────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/chat/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Yükleme başarısız'); return; }
      // Store pending file — user can optionally add text, then send
      setPendingFile({ url: data.url, type: data.type, name: data.name, size: data.size });
    } catch (err) {
      alert('Yükleme sırasında hata: ' + err.message);
    } finally {
      setUploading(false);
      inputRef.current?.focus();
    }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (dmWith && window.SOCKET) {
      window.SOCKET.emit('typing', { to: dmWith, typing: true });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        window.SOCKET?.emit('typing', { to: dmWith, typing: false });
      }, 2000);
    }
  };

  const openDm = (slug) => { setDmWith(slug); setMessages([]); setTypingUser(null); setPendingFile(null); };
  const backToGeneral = () => { setDmWith(null); setMessages([]); setPendingFile(null); };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div className="chat-overlay" data-open={open} onClick={onClose} />
      <div className="chat-panel" data-open={open}>

        {/* Header */}
        <div className="chat-head">
          {dmWith ? (
            <>
              <button className="icon-btn" onClick={backToGeneral}><Icon name="chevronLeft" size={16} /></button>
              <div style={{ position: 'relative', display: 'flex' }}>
                <Avatar member={dmUser} size="sm" />
                {online.has(dmWith) && <span className="online-badge is-online" />}
              </div>
              <div>
                <div className="chat-head-title">{dmUser?.name || dmWith}</div>
                <div style={{ fontSize: 11, color: online.has(dmWith) ? 'var(--status-green)' : 'var(--ink-faint)', lineHeight: 1.2 }}>
                  {online.has(dmWith) ? 'Çevrimiçi' : 'Çevrimdışı'}
                </div>
              </div>
            </>
          ) : (
            <span className="chat-head-title">Takım Sohbeti</span>
          )}
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Tabs */}
        {!dmWith && (
          <div className="chat-tabs">
            <button data-active={tab === 'general'} onClick={() => setTab('general')}>
              <Icon name="users" size={13} /> Genel
            </button>
            <button data-active={tab === 'dm'} onClick={() => setTab('dm')}>
              <Icon name="msg" size={13} /> Direkt
            </button>
          </div>
        )}

        {/* DM member list */}
        {!dmWith && tab === 'dm' ? (
          <div className="chat-member-list">
            {members.length === 0 ? (
              <div className="chat-empty">Henüz başka üye yok.</div>
            ) : members.map(m => (
              <div key={m.id} className="chat-member-row" onClick={() => openDm(m.id)}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar member={m} size="sm" />
                  {online.has(m.id) && <span className="online-badge is-online" />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: online.has(m.id) ? 'var(--status-green)' : 'var(--ink-faint)' }}>
                    {online.has(m.id) ? 'Çevrimiçi' : 'Çevrimdışı'}
                  </div>
                </div>
                <Icon name="chevronRight" size={14} style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">
                  {dmWith ? `${dmUser?.name || dmWith} ile sohbet başlat.` : 'Genel kanala ilk mesajı gönder.'}
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.from === me;
                const sender = allMembers.find(m => m.id === msg.from);
                const prevMsg = messages[i - 1];
                const showSender = !isMine && (!prevMsg || prevMsg.from !== msg.from);
                return (
                  <div key={msg.id || i} className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}>
                    {!isMine && (
                      <div className="chat-msg-avatar" style={{ visibility: showSender ? 'visible' : 'hidden' }}>
                        <Avatar member={sender} size="sm" />
                      </div>
                    )}
                    <div className="chat-bubble-wrap">
                      {showSender && !isMine && (
                        <div className="chat-sender-name">{sender?.name || msg.from}</div>
                      )}
                      <div className={`chat-bubble ${msg._temp ? 'chat-bubble-sending' : ''}`}>
                        <MsgContent msg={msg} onImageClick={setLightbox} />
                      </div>
                      <div className="chat-msg-time">{msg.time}</div>
                    </div>
                  </div>
                );
              })}
              {typingUser && (
                <div className="chat-typing-indicator">
                  <span>{allMembers.find(m => m.id === typingUser)?.name || typingUser} yazıyor</span>
                  <span className="typing-dots"><span /><span /><span /></span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Pending file preview */}
            {pendingFile && (
              <div className="chat-pending-file">
                {pendingFile.type === 'image' && (
                  <img src={pendingFile.url} alt="" style={{ height: 64, borderRadius: 6, objectFit: 'cover' }} />
                )}
                {pendingFile.type === 'video' && (
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="video" size={14} /> {pendingFile.name}
                  </div>
                )}
                {pendingFile.type === 'file' && (
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="paperclip" size={14} /> {pendingFile.name} ({fmtSize(pendingFile.size)})
                  </div>
                )}
                <button className="icon-btn" onClick={() => setPendingFile(null)} style={{ marginLeft: 'auto', color: 'var(--status-rose)' }}>
                  <Icon name="x" size={13} />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="chat-input-wrap">
              <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleFileChange}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" />
              <button
                className="icon-btn"
                title="Dosya / Fotoğraf / Video ekle"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ flexShrink: 0, color: uploading ? 'var(--accent)' : 'var(--ink-muted)' }}
              >
                {uploading ? <span style={{ fontSize: 11 }}>⏳</span> : <Icon name="paperclip" size={16} />}
              </button>
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder={pendingFile ? 'Açıklama ekle (isteğe bağlı)…' : (dmWith ? `${dmUser?.name || dmWith}'e mesaj yaz...` : 'Genel kanala yaz...')}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={!text.trim() && !pendingFile}
                style={{ flexShrink: 0, padding: '7px 10px', borderRadius: 8 }}
              >
                <Icon name="send" size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

window.ChatPanel = ChatPanel;
