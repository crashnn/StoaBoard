// Taşınma uçları: çalışma alanını dışa aktarma (ve ileride içe aktarma).
//
// app.js'te `/api/workspaces/me` altına, workspacesRouter'dan ÖNCE takılı.
// Eşleşmeyen yol next() ile oraya düşer. Ayrı dosya olmasının sebebi
// workspaces.js'in 1.100 satırı geçmiş olması ve bu işin kendi güvenlik
// eleğini taşıması (aşağıda).
//
// GÜVENLİK ELEĞİ (GUVENLIK.md §4), dışa aktarma için:
//  1. Kim: requireAuth + manage_workspace. Sıradan üye alamaz; alanı yöneten
//     zaten her şeyi görüyor, dosya ona yeni bir şey göstermiyor.
//  2. Kapsam: yalnızca AKTİF alan (`/me`). İstemciden kimlik alınmıyor.
//  3. IDOR: kimlik parametresi yok, deneyecek yer yok.
//  4. Başarısızlık kapalı: üyelik yoksa 403, yetki yoksa 403; "üye yoksa
//     devam" dalı yok.
//  5. Yanıt: iç kimlik yok, e-posta yok, parola özeti yok (lib/tasinma.js
//     başındaki kurallar; guvenlik.test.js dosyayı e-posta için tarıyor).
//  6. Girdi: yok.
//  7. Veri dışarı çıkıyor: EVET. Denetim kaydına workspace.export, sayılarla
//     (rapor dışa aktarımıyla aynı kalıp: kim, ne zaman, kaç kart, IP).
//     Biçim JSON; Excel formül yüzeyi yok. Content-Disposition'daki dosya
//     adı süzülüyor.
//  8. Hata mesajı: iki kod, ikisi de sözlükte; iç ayrıntı yok.
//  9. Silme: çöp kutusu dosyaya girmiyor; denetim kaydı ilişkisiz tabloda.
// 10. Test: paketleyici saf (tasinma.test.js); yetkisiz senaryo yetki
//     taramasında (requireAuth) ve manage_workspace kapısı bu dosyada.

import { Router } from 'express';

import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/session.js';
import { currentMember, hasPermission } from '../lib/workspace.js';
import { recordAudit, AUDIT } from '../lib/audit.js';
import { alanPaketi, paketOzeti, paketDosyaAdi } from '../lib/tasinma.js';

export const tasinmaRouter = Router();

async function loadUser(req) {
  const uid = req.session?.userId;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

// ── GET /workspaces/me/export ────────────────────────────────────────────

tasinmaRouter.get(
  '/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const member = await currentMember(user);
    if (!member) return res.status(403).json({ error: 'err_member_not_found', message: 'Üye bulunamadı' });
    if (!hasPermission(member, 'manage_workspace')) {
      return res.status(403).json({ error: 'err_export_forbidden', message: 'Çalışma alanını dışa aktarma yetkiniz yok' });
    }

    const workspaceId = member.workspaceId;
    const [workspace, members, projects] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, slug: true } }),
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { slug: true, name: true } }, workspaceRole: { select: { name: true } } },
      }),
      prisma.project.findMany({
        where: { workspaceId },
        include: { columns: true, labels: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    if (!workspace) return res.status(403).json({ error: 'err_member_not_found', message: 'Üye bulunamadı' });

    const tasks = await prisma.task.findMany({
      where: { projectId: { in: projects.map((p) => p.id) }, deletedAt: null },
      include: {
        subtasks: true,
        comments: { include: { user: { select: { slug: true } } } },
        assignees: { include: { user: { select: { slug: true } } } },
        labelLinks: { include: { label: { select: { slug: true } } } },
        creator: { select: { slug: true } },
      },
      orderBy: { id: 'asc' },
    });

    const now = new Date();
    const paket = alanPaketi({ workspace, exportedBy: user, members, projects, tasks, now });
    const ozet = paketOzeti(paket);

    // Kayda içerik değil sayı yazılır (lib/audit.js başındaki kural).
    recordAudit(req, {
      workspaceId,
      user,
      action: AUDIT.WORKSPACE_EXPORT,
      detail: ozet,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${paketDosyaAdi(workspace.slug, now)}"`);
    res.send(JSON.stringify(paket, null, 2));
  }),
);
