// Süre kaydı (work log) ve raporlar.
//
//   GET    /api/tasks/:taskId/worklogs      görevin süre kayıtları
//   POST   /api/tasks/:taskId/worklogs      süre gir (yalnızca kendi adına)
//   DELETE /api/worklogs/:logId             kendi kaydını sil (veya manage_tasks)
//
//   GET    /api/reports/person              kim, hangi işte, ne kadar süre
//   GET    /api/reports/period              dönemde ne açıldı, ne bitti
//   GET    /api/reports/flow                işler kaç günde bitiyor, nerede bekliyor
//
// Rapor uçları ?format=csv ile CSV döner. Ayraç noktalı virgül: Türkçe yerel
// ayarlı Excel virgülle ayrılmış dosyayı tek sütuna yığıyor.

import { Router } from 'express';

import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/session.js';
import { memberForWorkspace, hasPermission } from '../lib/workspace.js';
import {
  personReport,
  periodReport,
  flowReport,
  resolveRange,
  formatMinutes,
} from '../lib/reporting.js';

export const taskWorkLogsRouter = Router(); // /api/tasks/:taskId/worklogs
export const workLogsRouter = Router();     // /api/worklogs/:logId
export const reportsRouter = Router();      // /api/reports/*

async function loadUser(req) {
  const uid = req.session?.userId;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

function workLogToDict(l, meId = null) {
  return {
    id: String(l.id),
    is_mine: meId != null && l.userId === meId,
    task_id: l.taskId,
    task_title: l.taskTitle,
    user_id: l.userId,
    user_name: l.userName,
    minutes: l.minutes,
    minutes_label: formatMinutes(l.minutes),
    spent_on: l.spentOn ? new Date(l.spentOn).toISOString().slice(0, 10) : null,
    note: l.note || '',
    created_at: l.createdAt ? l.createdAt.toISOString() : null,
  };
}

/**
 * "2s 30d", "2:30", "150" (dakika), "1.5s" gibi girdileri dakikaya çevirir.
 * Kabul edilmezse null döner.
 */
export function parseDuration(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input > 0 ? Math.round(input) : null;
  }
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return null;

  // 2:30 → 150
  const clock = /^(\d{1,3}):([0-5]?\d)$/.exec(raw);
  if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);

  // "2s 30d" / "2h30m" / "2 saat 30 dakika"
  let total = 0;
  let matched = false;
  const hourRe = /(\d+(?:[.,]\d+)?)\s*(s|h|saat|hour)/;
  const minRe = /(\d+(?:[.,]\d+)?)\s*(d|m|dk|dakika|min)/;
  const hm = hourRe.exec(raw);
  if (hm) {
    total += parseFloat(hm[1].replace(',', '.')) * 60;
    matched = true;
  }
  const mm = minRe.exec(raw);
  if (mm) {
    total += parseFloat(mm[1].replace(',', '.'));
    matched = true;
  }
  if (matched) {
    const r = Math.round(total);
    return r > 0 ? r : null;
  }

  // Düz sayı → dakika
  const plain = /^(\d+(?:[.,]\d+)?)$/.exec(raw);
  if (plain) {
    const r = Math.round(parseFloat(plain[1].replace(',', '.')));
    return r > 0 ? r : null;
  }
  return null;
}

/** Göreve eriş + workspace üyeliği doğrula. */
async function loadTaskAccess(req, res, taskId) {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: 'err_auth_required' });
    return null;
  }
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    res.status(404).json({ error: 'Görev bulunamadı' });
    return null;
  }
  const project = await prisma.project.findUnique({ where: { id: task.projectId } });
  if (!project) {
    res.status(404).json({ error: 'Proje bulunamadı' });
    return null;
  }
  const member = await memberForWorkspace(user.id, project.workspaceId);
  if (!member) {
    res.status(403).json({ error: 'Bu projeye erişiminiz yok' });
    return null;
  }
  return { user, task, project, member };
}

// ─── GET /tasks/:taskId/worklogs ────────────────────────────────────────────

taskWorkLogsRouter.get(
  '/:taskId/worklogs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    const access = await loadTaskAccess(req, res, taskId);
    if (!access) return;

    const logs = await prisma.workLog.findMany({
      where: { taskId },
      orderBy: [{ spentOn: 'desc' }, { id: 'desc' }],
    });
    const total = logs.reduce((a, l) => a + (l.minutes || 0), 0);
    res.json({
      logs: logs.map((l) => workLogToDict(l, access.user.id)),
      total_minutes: total,
      total_minutes_label: formatMinutes(total),
    });
  }),
);

// ─── POST /tasks/:taskId/worklogs ───────────────────────────────────────────

taskWorkLogsRouter.post(
  '/:taskId/worklogs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    const access = await loadTaskAccess(req, res, taskId);
    if (!access) return;
    const { user, task, project } = access;

    const data = req.body || {};
    const minutes = parseDuration(data.minutes ?? data.duration ?? data.time);
    if (!minutes) {
      return res.status(400).json({
        error: 'err_bad_duration',
        message: 'Süre anlaşılamadı. Örnek: 90, 1:30, "1s 30d".',
      });
    }
    if (minutes > 24 * 60) {
      return res.status(400).json({
        error: 'err_duration_too_long',
        message: 'Tek kayıt en fazla 24 saat olabilir.',
      });
    }

    // Tarih verilmezse bugün. İleri tarihe süre girilemez.
    let spentOn = new Date();
    if (typeof data.spent_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.spent_on.trim())) {
      const d = new Date(`${data.spent_on.trim()}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) spentOn = d;
    }
    spentOn.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    if (spentOn > todayEnd) {
      return res.status(400).json({
        error: 'err_future_date',
        message: 'İleri bir tarihe süre girilemez.',
      });
    }

    const log = await prisma.workLog.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        taskTitle: (task.title || '').slice(0, 500),
        userId: user.id,
        userName: (user.name || '').slice(0, 200),
        minutes,
        spentOn,
        note: (data.note || '').trim().slice(0, 500) || null,
      },
    });

    res.status(201).json(workLogToDict(log, user.id));
  }),
);

// ─── DELETE /worklogs/:logId ────────────────────────────────────────────────

workLogsRouter.delete(
  '/:logId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ error: 'err_auth_required' });

    const logId = parseInt(req.params.logId, 10);
    const log = await prisma.workLog.findUnique({ where: { id: logId } });
    if (!log) return res.status(404).json({ error: 'Süre kaydı bulunamadı' });

    // Kendi kaydı değilse manage_tasks izni gerekir.
    if (log.userId !== user.id) {
      const project = log.projectId
        ? await prisma.project.findUnique({ where: { id: log.projectId } })
        : null;
      const member = project
        ? await memberForWorkspace(user.id, project.workspaceId)
        : null;
      if (!member || !hasPermission(member, 'manage_tasks')) {
        return res.status(403).json({ error: 'Bu kaydı silme yetkiniz yok' });
      }
    }

    await prisma.workLog.delete({ where: { id: logId } });
    res.json({ ok: true });
  }),
);

// ─── Rapor kapsamı ──────────────────────────────────────────────────────────

/**
 * Rapor için proje kimliklerini çöz ve yetkiyi doğrula.
 * ?workspace=<id> zorunlu, ?project=<id> ile tek projeye daraltılabilir.
 */
async function resolveScope(req, res) {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: 'err_auth_required' });
    return null;
  }
  const workspaceId = parseInt(req.query.workspace, 10);
  if (!workspaceId) {
    res.status(400).json({ error: 'err_workspace_required', message: 'workspace parametresi zorunlu.' });
    return null;
  }
  const member = await memberForWorkspace(user.id, workspaceId);
  if (!member) {
    res.status(403).json({ error: 'Bu çalışma alanına erişiminiz yok' });
    return null;
  }

  const where = { workspaceId };
  if (req.query.project) {
    const pid = parseInt(req.query.project, 10);
    if (pid) where.id = pid;
  }
  const projects = await prisma.project.findMany({ where, select: { id: true, name: true } });
  return {
    user,
    member,
    workspaceId,
    projectIds: projects.map((p) => p.id),
    projects,
    range: resolveRange(req.query),
  };
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV gövdesi üret. Başına BOM konur; olmadan Excel Türkçe karakterleri bozuyor.
 */
function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(';')];
  for (const r of rows) lines.push(r.map(csvCell).join(';'));
  return '﻿' + lines.join('\r\n');
}

function sendCsv(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(headers, rows));
}

const dayStr = (d) => new Date(d).toISOString().slice(0, 10);

// ─── GET /reports/person ────────────────────────────────────────────────────

reportsRouter.get(
  '/person',
  requireAuth,
  asyncHandler(async (req, res) => {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    // ?user hem sayısal id hem slug kabul eder; istemci tarafı üyeleri slug ile
    // tutuyor, rapor tabloları ise sayısal id ile yazılıyor.
    let wantedUser = null;
    if (req.query.user) {
      const raw = String(req.query.user).trim();
      if (/^\d+$/.test(raw)) {
        wantedUser = parseInt(raw, 10);
      } else {
        const u = await prisma.user.findUnique({
          where: { slug: raw },
          select: { id: true },
        });
        if (!u) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        wantedUser = u.id;
      }
    }

    // Başkasının raporunu görmek için üye yönetimi izni gerekir; kişi kendi
    // raporunu her zaman görebilir.
    const seeingOthers = !wantedUser || wantedUser !== scope.user.id;
    if (seeingOthers && !hasPermission(scope.member, 'manage_members')) {
      if (!wantedUser) {
        // İzin yoksa sessizce kendi raporuna daralt — boş sayfa göstermektense.
        const own = await personReport(scope.projectIds, {
          ...scope.range,
          userId: scope.user.id,
        });
        return res.json({ ...own, scoped_to_self: true });
      }
      return res.status(403).json({ error: 'Başka kullanıcının raporunu görme yetkiniz yok' });
    }

    const report = await personReport(scope.projectIds, {
      ...scope.range,
      userId: wantedUser,
    });

    if (req.query.format === 'csv') {
      const rows = [];
      for (const p of report.people) {
        for (const t of p.tasks) {
          rows.push([
            p.name,
            t.title,
            t.minutes,
            formatMinutes(t.minutes),
            t.moves,
            t.completed ? 'Evet' : 'Hayır',
          ]);
        }
      }
      return sendCsv(
        res,
        `kisi-raporu_${dayStr(report.from)}_${dayStr(report.to)}.csv`,
        ['Kişi', 'Görev', 'Dakika', 'Süre', 'Hareket', 'Tamamlandı'],
        rows,
      );
    }
    res.json(report);
  }),
);

// ─── GET /reports/period ────────────────────────────────────────────────────

reportsRouter.get(
  '/period',
  requireAuth,
  asyncHandler(async (req, res) => {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const report = await periodReport(scope.projectIds, scope.range);

    if (req.query.format === 'csv') {
      const rows = report.completed_tasks.map((t) => [
        t.title,
        t.priority,
        t.created_at,
        t.completed_at,
        t.cycle_days,
        t.minutes,
        t.minutes_label,
      ]);
      return sendCsv(
        res,
        `donem-raporu_${dayStr(report.from)}_${dayStr(report.to)}.csv`,
        ['Görev', 'Öncelik', 'Açılış', 'Tamamlanma', 'Geçen gün', 'Dakika', 'Emek'],
        rows,
      );
    }
    res.json(report);
  }),
);

// ─── GET /reports/flow ──────────────────────────────────────────────────────

reportsRouter.get(
  '/flow',
  requireAuth,
  asyncHandler(async (req, res) => {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const report = await flowReport(scope.projectIds, scope.range);

    if (req.query.format === 'csv') {
      const rows = report.slowest.map((t) => [t.title, t.days, t.completed_at]);
      return sendCsv(
        res,
        `akis-raporu_${dayStr(report.from)}_${dayStr(report.to)}.csv`,
        ['Görev', 'Tamamlanma süresi (gün)', 'Tamamlanma tarihi'],
        rows,
      );
    }
    res.json(report);
  }),
);
