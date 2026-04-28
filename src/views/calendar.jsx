// Calendar view — month grid

const { useState: useCalState } = React;

function CalendarView({ tasks, onOpenTask }) {
  // Fixed month: April 2026 (matches seed dates)
  const [cursor, setCursor] = useCalState(new Date('2026-04-01'));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][month];

  // Monday-first week
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  // leading
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, other: true, dateStr: null });
  }
  // current
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, other: false, dateStr, today: dateStr === '2026-04-21' });
  }
  // trailing to fill 6 rows (42)
  while (cells.length < 42) {
    cells.push({ day: cells.length - daysInMonth - startDayOfWeek + 1, other: true, dateStr: null });
  }

  const tasksFor = (dateStr) => tasks.filter(t => t.due === dateStr);

  const weekdays = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const today = new Date().toISOString().slice(0, 10);
  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <div>
          <div className="cal-title">Takvim</div>
          <div className="cal-month">{monthName} <em>{year}</em></div>
        </div>
        <div className="cal-header-actions">
          <div className="cal-nav">
            <button className="icon-btn" onClick={goPrev}><Icon name="chevronLeft" size={15} /></button>
            <button className="icon-btn" onClick={goNext}><Icon name="chevronRight" size={15} /></button>
          </div>
          <button className="btn btn-ghost" onClick={() => setCursor(new Date())}>Bugün</button>
        </div>
      </div>

      <div className="cal-panels">
        <div className="cal-summary">
          <div className="cal-stat">
            <span>Toplam görev</span>
            <strong>{tasks.length}</strong>
          </div>
          <div className="cal-stat">
            <span>Bugün</span>
            <strong>{tasksFor(today).length}</strong>
          </div>
          <div className="cal-stat">
            <span>Gecikmiş</span>
            <strong>{tasks.filter(t => t.due && new Date(t.due) < new Date() && t.col !== 'done').length}</strong>
          </div>
        </div>
        <div className="cal-filter-row">
          <span>Görünüm:</span>
          <button className="filter-chip" data-active="true">Ay</button>
          <button className="filter-chip">Hafta</button>
          <button className="filter-chip">Ajanda</button>
        </div>
      </div>

      <div className="cal-grid">
        {weekdays.map(w => <div key={w} className="cal-weekday">{w}</div>)}
        {cells.map((c, i) => {
          const dayTasks = c.dateStr ? tasksFor(c.dateStr) : [];
          const visible = dayTasks.slice(0, 3);
          const rest = dayTasks.length - 3;
          return (
            <div key={i} className="cal-day" data-other={c.other} data-today={c.today}>
              <div className="day-num">{c.day}</div>
              {visible.map(t => {
                const tone = DATA.LABELS[t.labels[0]]?.tone || 'slate';
                return (
                  <div key={t.id} className="cal-chip" data-tone={tone} onClick={() => onOpenTask(t)} title={t.title}>
                    {t.title}
                  </div>
                );
              })}
              {rest > 0 && <div className="cal-more">+{rest} daha</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.CalendarView = CalendarView;
