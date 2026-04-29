// Kanban board view

const { useState: useBoardState, useRef: useBoardRef, useEffect: useBoardEf } = React;

function Card({ task, onOpen, onDragStart, onDragEnd, dragging, tweaks, onTitleChange, canManageTasks }) {
  const members = (task.assignees || []).map(id => DATA.MEMBERS.find(m => m.id === id)).filter(Boolean);
  const isDone = task.col === 'done';
  const overdue = DATA.isOverdue(task.due, task.col);
  const titleRef = useBoardRef(null);
  const [editing, setEditing] = useBoardState(false);

  const handleTitleDblClick = (e) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => {
      titleRef.current?.focus();
      document.execCommand('selectAll', false, null);
    }, 10);
  };

  const handleTitleBlur = () => {
    setEditing(false);
    const newText = titleRef.current?.textContent?.trim();
    if (newText && newText !== task.title) onTitleChange(task.id, newText);
  };

  const handleTitleKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); titleRef.current.textContent = task.title; titleRef.current?.blur(); }
  };

  return (
    <div
      className="card"
      draggable={!editing && canManageTasks}
      data-dragging={dragging}
      data-done={isDone}
      data-show-progress={tweaks.showProgress}
      data-show-tags={tweaks.showTags}
      onClick={() => !editing && onOpen(task)}
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
    >
      {(task.labels || []).length > 0 && (
        <div className="card-tags">
          {(task.labels || []).map(l => {
            const lab = DATA.LABELS[l];
            if (!lab) return null;
            return <span key={l} className="tag" data-tone={lab.tone}>{lab.tr}</span>;
          })}
        </div>
      )}

      <div
        ref={titleRef}
        className="card-title"
        contentEditable={editing}
        suppressContentEditableWarning
        onDoubleClick={canManageTasks ? handleTitleDblClick : undefined}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKey}
      >
        {task.title}
      </div>

      {task.desc && <div className="card-desc-preview">{task.desc}</div>}

      <div className="card-meta">
        <div className="priority-pill">
          <span className="priority-dot" data-p={task.priority} />
          <span style={{ color: 'var(--ink-muted)' }}>
            {task.priority === 'high' ? 'Yüksek' : task.priority === 'mid' ? 'Orta' : 'Düşük'}
          </span>
        </div>
        {task.due && (
          <div className="meta-item" data-warn={overdue} data-done={isDone}>
            <Icon name="calendar" size={12} />
            {DATA.fmtDate(task.due)}
          </div>
        )}
        {task.subtasks && (
          <div className="meta-item" title="Alt görevler">
            <Icon name="circleCheck" size={12} /> {task.subtasks}
          </div>
        )}
      </div>

      {(tweaks.showProgress || task.comments || task.attachments || members.length > 0) && (
        <div className="card-footer">
          {task.comments > 0 && <div className="meta-item"><Icon name="msg" size={12} /> {task.comments}</div>}
          {task.attachments > 0 && <div className="meta-item"><Icon name="paperclip" size={12} /> {task.attachments}</div>}
          {tweaks.showProgress && task.progress > 0 && (
            <div className="progress-row">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
              <span>{task.progress}%</span>
            </div>
          )}
          {members.length > 0 && (
            <div className="card-assignees"><AvatarStack members={members} size="sm" max={3} /></div>
          )}
        </div>
      )}
    </div>
  );
}

function Column({ col, tasks, onOpenTask, onDropCard, onDragStart, onDragEnd, dragging, tweaks, onOpenModal, onTitleChange, canManageTasks }) {
  const [dragOver, setDragOver] = useBoardState(false);

  return (
    <div className="column">
      <div className="col-header">
        <div className="col-dot" style={{ background: col.color }} />
        <span className="col-title">{col.title_tr}</span>
        <span className="col-count">{tasks.length}</span>
        <div className="col-actions">
          {canManageTasks && <button onClick={() => onOpenModal(col.id)} title="Yeni görev"><Icon name="plus" size={14} /></button>}
          <button title="Daha fazla"><Icon name="moreH" size={14} /></button>
        </div>
      </div>
      <div
        className="col-body"
        data-drag-over={dragOver}
        onDragOver={(e) => { if (!canManageTasks) return; e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { if (!canManageTasks) return; e.preventDefault(); setDragOver(false); onDropCard(col.id); }}
      >
        {tasks.map(t => (
          <Card
            key={t.id}
            task={t}
            onOpen={onOpenTask}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={dragging === t.id}
            tweaks={tweaks}
            onTitleChange={onTitleChange}
            canManageTasks={canManageTasks}
          />
        ))}
        {canManageTasks && (
          <button className="col-add" onClick={() => onOpenModal(col.id)}>
            <Icon name="plus" size={13} /> Görev ekle
          </button>
        )}
      </div>
    </div>
  );
}

function BoardView({ tasks, onOpenTask, onMoveTask, tweaks, onOpenModal, onTitleChange, canManageTasks, canManageProjects }) {
  const [draggingId, setDraggingId] = useBoardState(null);
  const [columns, setColumns] = useBoardState(() => DATA.COLUMNS || []);
  const [isAddingColumn, setIsAddingColumn] = useBoardState(false);
  const [newColumnTitle, setNewColumnTitle] = useBoardState("");

  useBoardEf(() => {
    setColumns(DATA.COLUMNS || []);
  }, [tasks]);

  const handleDragStart = (e, task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDraggingId(task.id);
  };
  const handleDragEnd = () => setDraggingId(null);
  const handleDrop = (targetColId) => {
    if (draggingId) { onMoveTask(draggingId, targetColId); setDraggingId(null); }
  };

  const handleAddColumn = async () => {
    const title = newColumnTitle.trim();
    if (!title) return;

    const projectId = window.CURRENT_PROJECT_ID || DATA.currentProject?.id;
    if (!projectId) {
      alert('Proje seçili değil.');
      return;
    }

    try {
      const created = await API.createColumn(projectId, { title });
      window.DATA.COLUMNS = [...(window.DATA.COLUMNS || []), created];
      setColumns(prev => [...prev, created]);
      setNewColumnTitle("");
      setIsAddingColumn(false);
    } catch (e) {
      alert('Kolon oluşturulamadı: ' + e.message);
      console.error('createColumn error:', e);
    }
  };

  return (
    <div className="board">
      {columns.map(col => (
        <Column
          key={col.id}
          col={col}
          tasks={tasks.filter(t => t.col === col.id)}
          onOpenTask={onOpenTask}
          onDropCard={handleDrop}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          dragging={draggingId}
          tweaks={tweaks}
          onOpenModal={onOpenModal}
          onTitleChange={onTitleChange}
          canManageTasks={canManageTasks}
        />
      ))}
      {canManageProjects && (isAddingColumn ? (
        <div className="add-column-form">
          <input
            autoFocus
            className="add-column-input"
            placeholder="Kolon başlığı yazın..."
            value={newColumnTitle}
            onChange={(e) => setNewColumnTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddColumn();
              if (e.key === 'Escape') setIsAddingColumn(false);
            }}
          />
          <div className="add-column-actions">
            <button className="btn-save" onClick={handleAddColumn}>Ekle</button>
            <button className="btn-cancel" onClick={() => setIsAddingColumn(false)}>İptal</button>
          </div>
        </div>
      ) : (
        <button className="add-column-btn" onClick={() => setIsAddingColumn(true)}>
          <Icon name="plus" size={14} /> Kolon ekle
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { Card, Column, BoardView });
