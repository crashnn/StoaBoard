// Raporlamanın veri katmanı: geçiş kaydı yazımı ve rapor sorguları.
//
// İki ayrı kaynak var ve karıştırılmamalı:
//   TaskTransition — kart ne zaman hangi kolona geçti (süreç/akış zamanı)
//   WorkLog        — kim göreve kaç dakika emek verdi (maliyet/emek)
//
// Bir iş üç haftada bitmiş ama altı saat emek almış olabilir. İlki geçişten,
// ikincisi süre kaydından hesaplanır; biri diğerinin yerine geçmez.

import { prisma } from '../db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Yazma ──────────────────────────────────────────────────────────────────

/**
 * Bir kolon geçişini kaydet. Transaction içinden çağrılabilir.
 *
 * Görev başlığı, kullanıcı adı ve kolon başlıkları o anki hâliyle kopyalanır;
 * kayıt sonradan silinen görev/kullanıcı için de okunabilir kalsın diye.
 */
export async function recordTransition(client, { task, project, user, fromCol, toCol }) {
  return client.taskTransition.create({
    data: {
      projectId: project?.id ?? task.projectId ?? null,
      taskId: task.id,
      taskTitle: (task.title || '').slice(0, 500),
      userId: user?.id ?? null,
      userName: user?.name ? user.name.slice(0, 200) : null,
      fromColumnId: fromCol?.id ?? null,
      fromTitle: fromCol ? (fromCol.titleTr || fromCol.title || '').slice(0, 100) : null,
      toColumnId: toCol?.id ?? null,
      toTitle: toCol ? (toCol.titleTr || toCol.title || '').slice(0, 100) : null,
      toIsDone: Boolean(toCol?.isDone),
      at: new Date(),
    },
  });
}

// ─── Ortak yardımcılar ──────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → gün başı Date. Geçersizse null. */
export function parseRangeDate(val, endOfDay = false) {
  if (typeof val !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val.trim());
  if (!m) return null;
  const d = new Date(`${val}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * İstekten tarih aralığı çıkar. Verilmezse son 30 gün.
 * Kurumsal tarafta 6 aylık dönem istendiği için üst sınır yok.
 */
export function resolveRange(query = {}) {
  const to = parseRangeDate(query.to, true) || new Date();
  const from =
    parseRangeDate(query.from) || new Date(to.getTime() - 30 * DAY_MS);
  return { from, to };
}

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/** Dakikayı "3s 20d" biçimine çevir. */
export function formatMinutes(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}d`;
  if (!r) return `${h}s`;
  return `${h}s ${r}d`;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ─── Kişi raporu ────────────────────────────────────────────────────────────

/**
 * "Bu kişi bu dönemde hangi işlerde çalıştı, ne kadar süre harcadı?"
 *
 * Emek süresi WorkLog'dan, hareket ve tamamlama sayısı TaskTransition'dan gelir.
 * userId verilirse tek kişi, verilmezse çalışma alanındaki herkes döner.
 */
export async function personReport(projectIds, { from, to, userId = null }) {
  if (!projectIds.length) return { people: [], from, to };

  const [logs, transitions] = await Promise.all([
    prisma.workLog.findMany({
      where: {
        projectId: { in: projectIds },
        spentOn: { gte: from, lte: to },
        ...(userId ? { userId } : {}),
      },
      orderBy: { spentOn: 'asc' },
    }),
    prisma.taskTransition.findMany({
      where: {
        projectId: { in: projectIds },
        at: { gte: from, lte: to },
        ...(userId ? { userId } : {}),
      },
      orderBy: { at: 'asc' },
    }),
  ]);

  const people = new Map();
  const ensure = (id, name) => {
    const key = id ?? 0;
    if (!people.has(key)) {
      people.set(key, {
        user_id: id,
        name: name || 'Bilinmeyen',
        minutes: 0,
        moves: 0,
        completed: 0,
        tasks: new Map(),
      });
    }
    const p = people.get(key);
    if (name && p.name === 'Bilinmeyen') p.name = name;
    return p;
  };

  for (const l of logs) {
    const p = ensure(l.userId, l.userName);
    p.minutes += l.minutes || 0;
    const k = l.taskId ?? `t:${l.taskTitle}`;
    if (!p.tasks.has(k)) {
      p.tasks.set(k, {
        task_id: l.taskId,
        title: l.taskTitle,
        minutes: 0,
        moves: 0,
        completed: false,
      });
    }
    p.tasks.get(k).minutes += l.minutes || 0;
  }

  for (const t of transitions) {
    const p = ensure(t.userId, t.userName);
    p.moves += 1;
    if (t.toIsDone) p.completed += 1;
    const k = t.taskId ?? `t:${t.taskTitle}`;
    if (!p.tasks.has(k)) {
      p.tasks.set(k, {
        task_id: t.taskId,
        title: t.taskTitle,
        minutes: 0,
        moves: 0,
        completed: false,
      });
    }
    const row = p.tasks.get(k);
    row.moves += 1;
    if (t.toIsDone) row.completed = true;
  }

  const out = [...people.values()]
    .map((p) => ({
      ...p,
      minutes_label: formatMinutes(p.minutes),
      tasks: [...p.tasks.values()].sort((a, b) => b.minutes - a.minutes || b.moves - a.moves),
    }))
    .sort((a, b) => b.minutes - a.minutes || b.moves - a.moves);

  return { people: out, from, to };
}

// ─── Dönem raporu ───────────────────────────────────────────────────────────

/**
 * "Bu dönemde ne açıldı, ne bitti, ne bekliyor?"
 * Üst yönetime sunulan özet bu.
 */
export async function periodReport(projectIds, { from, to }) {
  if (!projectIds.length) {
    return { from, to, created: 0, completed: 0, moves: 0, open: 0, by_column: [], completed_tasks: [] };
  }

  const [created, completedTasks, transitions, openTasks, columns, logs] = await Promise.all([
    prisma.task.count({
      where: { projectId: { in: projectIds }, createdAt: { gte: from, lte: to } },
    }),
    prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        completedAt: { gte: from, lte: to },
      },
      select: {
        id: true, title: true, createdAt: true, completedAt: true,
        projectId: true, priority: true,
      },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.taskTransition.findMany({
      where: { projectId: { in: projectIds }, at: { gte: from, lte: to } },
      select: { toTitle: true, toIsDone: true, at: true },
    }),
    prisma.task.count({
      where: { projectId: { in: projectIds }, deletedAt: null, completedAt: null },
    }),
    prisma.boardColumn.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { position: 'asc' },
    }),
    prisma.workLog.findMany({
      where: { projectId: { in: projectIds }, spentOn: { gte: from, lte: to } },
      select: { taskId: true, minutes: true },
    }),
  ]);

  const minutesByTask = new Map();
  let totalMinutes = 0;
  for (const l of logs) {
    totalMinutes += l.minutes || 0;
    if (l.taskId != null) {
      minutesByTask.set(l.taskId, (minutesByTask.get(l.taskId) || 0) + (l.minutes || 0));
    }
  }

  const byColumn = new Map();
  for (const c of columns) {
    const label = c.titleTr || c.title;
    if (!byColumn.has(label)) byColumn.set(label, 0);
  }
  for (const t of transitions) {
    const label = t.toTitle || '—';
    byColumn.set(label, (byColumn.get(label) || 0) + 1);
  }

  const completedRows = completedTasks.map((t) => {
    const days =
      t.createdAt && t.completedAt
        ? Math.max(0, (new Date(t.completedAt) - new Date(t.createdAt)) / DAY_MS)
        : null;
    return {
      task_id: t.id,
      title: t.title,
      priority: t.priority || 'mid',
      created_at: t.createdAt ? dayKey(t.createdAt) : null,
      completed_at: t.completedAt ? dayKey(t.completedAt) : null,
      cycle_days: days === null ? null : Math.round(days * 10) / 10,
      minutes: minutesByTask.get(t.id) || 0,
      minutes_label: formatMinutes(minutesByTask.get(t.id) || 0),
    };
  });

  return {
    from,
    to,
    created,
    completed: completedTasks.length,
    moves: transitions.length,
    open: openTasks,
    total_minutes: totalMinutes,
    total_minutes_label: formatMinutes(totalMinutes),
    by_column: [...byColumn.entries()].map(([label, count]) => ({ label, count })),
    completed_tasks: completedRows,
  };
}

// ─── Akış raporu ────────────────────────────────────────────────────────────

/**
 * "İşler ortalama kaç günde bitiyor, nerede bekliyor?"
 *
 * Tamamlanma süresi görevin oluşturulmasından completedAt'e kadar geçen süre.
 * Kolon bekleme süresi ardışık geçişler arasındaki farktan çıkar.
 */
export async function flowReport(projectIds, { from, to }) {
  if (!projectIds.length) {
    return { from, to, count: 0, avg_days: 0, median_days: 0, slowest: [], dwell: [] };
  }

  const completed = await prisma.task.findMany({
    where: { projectId: { in: projectIds }, completedAt: { gte: from, lte: to } },
    select: { id: true, title: true, createdAt: true, completedAt: true },
  });

  const durations = [];
  const rows = [];
  for (const t of completed) {
    if (!t.createdAt || !t.completedAt) continue;
    const days = Math.max(0, (new Date(t.completedAt) - new Date(t.createdAt)) / DAY_MS);
    durations.push(days);
    rows.push({
      task_id: t.id,
      title: t.title,
      days: Math.round(days * 10) / 10,
      completed_at: dayKey(t.completedAt),
    });
  }

  // Kolon bekleme süresi: aynı görevin ardışık geçişleri arasındaki fark,
  // önceki geçişin hedef kolonuna yazılır.
  const transitions = await prisma.taskTransition.findMany({
    where: { projectId: { in: projectIds }, at: { gte: from, lte: to } },
    orderBy: [{ taskId: 'asc' }, { at: 'asc' }],
    select: { taskId: true, toTitle: true, at: true },
  });

  const dwell = new Map();
  let prev = null;
  for (const t of transitions) {
    if (prev && prev.taskId === t.taskId && prev.toTitle) {
      const hours = (new Date(t.at) - new Date(prev.at)) / (60 * 60 * 1000);
      if (hours >= 0) {
        if (!dwell.has(prev.toTitle)) dwell.set(prev.toTitle, []);
        dwell.get(prev.toTitle).push(hours);
      }
    }
    prev = t;
  }

  const dwellRows = [...dwell.entries()]
    .map(([label, hours]) => ({
      label,
      samples: hours.length,
      avg_hours: Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10,
      median_hours: Math.round(median(hours) * 10) / 10,
    }))
    .sort((a, b) => b.avg_hours - a.avg_hours);

  const avg = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  return {
    from,
    to,
    count: durations.length,
    avg_days: Math.round(avg * 10) / 10,
    median_days: Math.round(median(durations) * 10) / 10,
    slowest: rows.sort((a, b) => b.days - a.days).slice(0, 15),
    dwell: dwellRows,
  };
}
