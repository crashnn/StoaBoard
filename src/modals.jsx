// Add Task modal

const { useState: useModalState, useEffect: useModalEffect, useRef: useModalRef } = React;

function AddTaskModal({ open, onClose, defaultCol, onCreate }) {
  const [title, setTitle] = useModalState('');
  const [desc, setDesc] = useModalState('');
  const [col, setCol] = useModalState(defaultCol || 'todo');
  const [priority, setPriority] = useModalState('mid');
  const [due, setDue] = useModalState('');
  const [labels, setLabels] = useModalState([]);
  const [assignees, setAssignees] = useModalState(['aliz']);
  const [colOpen, setColOpen] = useModalState(false);
  const [priorityOpen, setPriorityOpen] = useModalState(false);
  const colRef = useModalRef(null);
  const priorityRef = useModalRef(null);

  useModalEffect(() => {
    const handleClick = (e) => {
      if (colOpen && colRef.current && !colRef.current.contains(e.target)) {
        setColOpen(false);
      }
      if (priorityOpen && priorityRef.current && !priorityRef.current.contains(e.target)) {
        setPriorityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colOpen, priorityOpen]);

  React.useEffect(() => { if (defaultCol) setCol(defaultCol); }, [defaultCol, open]);
  React.useEffect(() => { if (!open) { setTitle(''); setDesc(''); } }, [open]);

  const toggleLabel = (k) => setLabels(labels.includes(k) ? labels.filter(x => x !== k) : [...labels, k]);
  const toggleAssignee = (k) => setAssignees(assignees.includes(k) ? assignees.filter(x => x !== k) : [...assignees, k]);

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      id: 't' + Date.now(),
      title: title.trim(),
      desc,
      col,
      priority,
      due: due || null,
      labels,
      assignees,
      progress: 0, comments: 0, attachments: 0,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" data-open={open} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Yeni görev</div>
          <div className="modal-sub">Atama, etiket ve son tarihi sonradan da düzenleyebilirsin.</div>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Başlık</label>
            <input autoFocus placeholder="Ne yapılacak?" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Açıklama</label>
            <textarea rows={3} placeholder="Daha fazla bağlam ekle..." value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Kolon</label>
              <div className="custom-dropdown" ref={colRef}>
                <button
                  type="button"
                  className="custom-dropdown-btn"
                  onClick={() => setColOpen(o => !o)}
                >
                  <span>{DATA.COLUMNS.find(c => c.id === col)?.title_tr || 'Seç'}</span>
                  <Icon name="chevronDown" size={12} />
                </button>
                {colOpen && (
                  <div className="custom-dropdown-menu">
                    {DATA.COLUMNS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className={`custom-dropdown-item${c.id === col ? ' active' : ''}`}
                        onClick={() => { setCol(c.id); setColOpen(false); }}
                      >
                        {c.title_tr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field">
              <label>Öncelik</label>
              <div className="custom-dropdown" ref={priorityRef}>
                <button
                  type="button"
                  className="custom-dropdown-btn"
                  onClick={() => setPriorityOpen(o => !o)}
                >
                  <span>{priority === 'high' ? 'Yüksek' : priority === 'mid' ? 'Orta' : 'Düşük'}</span>
                  <Icon name="chevronDown" size={12} />
                </button>
                {priorityOpen && (
                  <div className="custom-dropdown-menu">
                    {[
                      { id: 'high', label: 'Yüksek' },
                      { id: 'mid', label: 'Orta' },
                      { id: 'low', label: 'Düşük' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`custom-dropdown-item${item.id === priority ? ' active' : ''}`}
                        onClick={() => { setPriority(item.id); setPriorityOpen(false); }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field">
              <label>Bitiş</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Etiketler</label>
            <div className="chips">
              {Object.entries(DATA.LABELS).map(([k, l]) => (
                <div key={k} className="chip" data-selected={labels.includes(k)} onClick={() => toggleLabel(k)}>
                  <span className="priority-dot" style={{ background: `var(--status-${l.tone === 'accent' ? 'rose' : l.tone})`, width: 6, height: 6, marginLeft: 4 }} />
                  {l.tr}
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Atanan</label>
            <div className="chips">
              {DATA.MEMBERS.map(m => (
                <div key={m.id} className="chip" data-selected={assignees.includes(m.id)} onClick={() => toggleAssignee(m.id)}>
                  <Avatar member={m} size="sm" />
                  {m.name.split(' ')[0]}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={submit}>
            <Icon name="plus" size={13} /> Görevi oluştur
          </button>
        </div>
      </div>
    </div>
  );
}

window.AddTaskModal = AddTaskModal;
