// List / table view

const { useState: useListState } = React;

function ListView({ tasks, onOpenTask, onMoveTask }) {
  const groups = DATA.COLUMNS.map(col => ({
    col,
    tasks: tasks.filter(t => t.col === col.id),
  }));

  return (
    <div className="list-view">
      {groups.map(({ col, tasks }) => (
        <div className="list-group" key={col.id}>
          <div className="list-group-header">
            <div className="col-dot" style={{ background: col.color }} />
            <span style={{ color: 'var(--ink)' }}>{col.title_tr}</span>
            <span className="col-count">{tasks.length}</span>
          </div>
          <table className="list-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Başlık</th>
                <th style={{ width: 120 }}>Etiketler</th>
                <th style={{ width: 110 }}>Öncelik</th>
                <th style={{ width: 110 }}>Bitiş</th>
                <th style={{ width: 120 }}>Atanan</th>
                <th style={{ width: 90 }}>İlerleme</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const members = t.assignees.map(id => DATA.MEMBERS.find(m => m.id === id)).filter(Boolean);
                const isDone = t.col === 'done';
                const overdue = DATA.isOverdue(t.due, t.col);
                return (
                  <tr key={t.id} data-done={isDone} onClick={() => onOpenTask(t)}>
                    <td>
                      <div
                        className="list-check"
                        data-checked={isDone}
                        onClick={(e) => { e.stopPropagation(); onMoveTask(t.id, isDone ? 'todo' : 'done'); }}
                      >
                        {isDone && <Icon name="check" size={10} strokeWidth={2.5} />}
                      </div>
                    </td>
                    <td className="title" style={{ fontWeight: 500 }}>{t.title}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {t.labels.slice(0, 2).map(l => {
                          const lab = DATA.LABELS[l];
                          return lab && <span key={l} className="tag" data-tone={lab.tone}>{lab.tr}</span>;
                        })}
                      </div>
                    </td>
                    <td>
                      <span className="priority-pill">
                        <span className="priority-dot" data-p={t.priority} />
                        <span style={{ color: 'var(--ink-muted)' }}>
                          {t.priority === 'high' ? 'Yüksek' : t.priority === 'mid' ? 'Orta' : 'Düşük'}
                        </span>
                      </span>
                    </td>
                    <td>
                      {t.due && (
                        <span className="meta-item" data-warn={overdue}>
                          <Icon name="calendar" size={12} /> {DATA.fmtDate(t.due)}
                        </span>
                      )}
                    </td>
                    <td><AvatarStack members={members} size="sm" max={3} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-bar" style={{ width: 60 }}>
                          <div className="progress-fill" style={{ width: `${t.progress || 0}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--ink-muted)', width: 26, textAlign: 'right' }}>{t.progress || 0}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

window.ListView = ListView;
