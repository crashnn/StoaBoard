// Task detail drawer — Notion-style rich doc

const { useState: useDrawerState } = React;

function TaskDrawer({ open, task, onClose, onMoveTask }) {
  if (!task) return null;

  const members = task.assignees.map(id => DATA.MEMBERS.find(m => m.id === id)).filter(Boolean);
  const col = DATA.COLUMNS.find(c => c.id === task.col);

  // Use rich doc if it's the detailed task, else generate basic
  const detail = task.id === 't8' ? DATA.TASK_DETAIL_T8 : {
    doc: [
      { kind: 'h2', text: 'Açıklama' },
      { kind: 'p', text: task.desc || 'Bu kart için henüz detaylı açıklama eklenmedi. Başlatmak için çift tıklayın veya bir şablon seçin.' },
      task.subtasks ? { kind: 'h2', text: 'Alt görevler' } : null,
      task.subtasks ? { kind: 'checklist', items: [
        { done: true, text: 'Başlangıç gereksinimleri toplandı' },
        { done: true, text: 'Tasarım taslağı hazırlandı' },
        { done: false, text: 'İmplementasyon' },
        { done: false, text: 'Test ve kabul' },
      ]} : null,
    ].filter(Boolean),
    comments: [
      { author: 'baris', time: '1 saat önce', text: 'Bu kartı aldım, yarın sabaha kadar bitiririm.' },
    ],
  };

  return (
    <>
      <div className="drawer-overlay" data-open={open} onClick={onClose} />
      <div className="drawer" data-open={open}>
        <div className="drawer-head">
          <div className="drawer-crumbs">
            <span>StoaBoard Web</span>
            <span className="sep"><Icon name="chevronRight" size={11} /></span>
            <span style={{ color: 'var(--ink)' }}>{col.title_tr}</span>
          </div>
          <div className="drawer-head-actions">
            <button className="icon-btn" title="Kopyala"><Icon name="copy" size={15} /></button>
            <button className="icon-btn" title="Tam ekran"><Icon name="expand" size={14} /></button>
            <button className="icon-btn" title="Daha fazla"><Icon name="moreH" size={15} /></button>
            <button className="icon-btn" title="Kapat" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>
        </div>

        <div className="drawer-body">
          <div className="doc-title" contentEditable suppressContentEditableWarning>{task.title}</div>

          <div className="props-grid">
            <div className="prop-label"><Icon name="circleHalf" size={13} /> Durum</div>
            <div className="prop-value">
              <select
                value={task.col}
                onChange={(e) => onMoveTask(task.id, e.target.value)}
                style={{ border: 'none', background: 'none', padding: 0, fontSize: 13, cursor: 'pointer', outline: 'none' }}
              >
                {DATA.COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title_tr}</option>)}
              </select>
            </div>

            <div className="prop-label"><Icon name="flag" size={13} /> Öncelik</div>
            <div className="prop-value">
              <span className="priority-dot" data-p={task.priority} />
              {task.priority === 'high' ? 'Yüksek' : task.priority === 'mid' ? 'Orta' : 'Düşük'}
            </div>

            <div className="prop-label"><Icon name="users" size={13} /> Atanan</div>
            <div className="prop-value">
              <AvatarStack members={members} size="sm" />
              <span style={{ color: 'var(--ink-muted)', marginLeft: 4 }}>
                {members.map(m => m.name.split(' ')[0]).join(', ')}
              </span>
            </div>

            <div className="prop-label"><Icon name="calendar" size={13} /> Bitiş</div>
            <div className="prop-value">
              {task.due ? (
                <>
                  <span style={{ color: DATA.isOverdue(task.due, task.col) ? 'var(--status-rose)' : 'var(--ink)' }}>
                    {DATA.fmtDate(task.due)}, 2026
                  </span>
                  {DATA.isOverdue(task.due, task.col) && <span style={{ color: 'var(--status-rose)', fontSize: 12 }}>· geçti</span>}
                </>
              ) : <span style={{ color: 'var(--ink-muted)' }}>Tarih ekle</span>}
            </div>

            <div className="prop-label"><Icon name="tag" size={13} /> Etiketler</div>
            <div className="prop-value" style={{ gap: 4, flexWrap: 'wrap' }}>
              {task.labels.map(l => {
                const lab = DATA.LABELS[l];
                return lab && <span key={l} className="tag" data-tone={lab.tone}>{lab.tr}</span>;
              })}
              <button className="tag" style={{ cursor: 'pointer', borderStyle: 'dashed' }}><Icon name="plus" size={10} strokeWidth={2} /></button>
            </div>

            <div className="prop-label"><Icon name="link" size={13} /> Bağlantılı</div>
            <div className="prop-value" style={{ color: 'var(--ink-muted)', fontSize: 12.5 }}>
              {task.id === 't8' ? '2 bağımlı kart' : 'Bağlantı yok'}
            </div>
          </div>

          <div className="doc-content">
            {detail.doc.map((b, i) => <DocBlock key={i} block={b} />)}
          </div>

          <div className="comments-section">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '-0.005em', marginBottom: 6 }}>
              Yorumlar <span style={{ color: 'var(--ink-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>· {detail.comments.length}</span>
            </h3>
            {detail.comments.map((c, i) => {
              const m = DATA.MEMBERS.find(mm => mm.id === c.author);
              return (
                <div className="comment-row" key={i}>
                  <Avatar member={m} size="sm" />
                  <div className="comment-body">
                    <div className="comment-head">
                      <span className="comment-name">{m?.name}</span>
                      <span className="comment-time">{c.time}</span>
                    </div>
                    <div className="comment-text">{c.text}</div>
                  </div>
                </div>
              );
            })}
            <div className="comment-compose">
              <Avatar member={DATA.MEMBERS[0]} size="sm" />
              <textarea placeholder="Yorum yaz... @ ile bahset" />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost">İptal</button>
              <button className="btn btn-primary">Gönder</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DocBlock({ block }) {
  const [checks, setChecks] = useDrawerState(() => (block.items || []).map(i => !!i.done));

  switch (block.kind) {
    case 'h2': return <h2>{block.text}</h2>;
    case 'h3': return <h3>{block.text}</h3>;
    case 'p':  return <p>{block.text}</p>;
    case 'ul': return <ul>{block.items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
    case 'pre': return <pre>{block.text}</pre>;
    case 'quote': return <blockquote>{block.text}</blockquote>;
    case 'checklist':
      return (
        <div className="checklist">
          {block.items.map((it, i) => (
            <div
              key={i}
              className="check-row"
              data-checked={checks[i]}
              onClick={() => setChecks(checks.map((c, j) => j === i ? !c : c))}
            >
              <div className="list-check" data-checked={checks[i]}>
                {checks[i] && <Icon name="check" size={10} strokeWidth={2.5} />}
              </div>
              <span className="check-text" style={{ fontSize: 14, lineHeight: 1.5 }}>{it.text}</span>
            </div>
          ))}
        </div>
      );
    default: return null;
  }
}

window.TaskDrawer = TaskDrawer;
