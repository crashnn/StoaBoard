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
//  6. Girdi: yalnızca ?format=json|csv|md; tanınmayan değer JSON'a düşer
//     (reddetmek yerine varsayılana dönmek burada güvenli: üç biçim de aynı
//     veriyi taşıyor, yanlış biçim yanlış veri demek değil).
//  7. Veri dışarı çıkıyor: EVET. Denetim kaydına workspace.export, sayılarla
//     ve biçimle (rapor dışa aktarımıyla aynı kalıp: kim, ne zaman, kaç kart,
//     IP). CSV, Excel formül korumasından geçiyor (lib/csv.js csvCell).
//     Content-Disposition'daki dosya adı süzülüyor.
//  8. Hata mesajı: iki kod, ikisi de sözlükte; iç ayrıntı yok.
//  9. Silme: çöp kutusu dosyaya girmiyor; denetim kaydı ilişkisiz tabloda.
// 10. Test: paketleyici saf (tasinma.test.js); yetkisiz senaryo yetki
//     taramasında (requireAuth) ve manage_workspace kapısı bu dosyada.
//
// GÜVENLİK ELEĞİ, içe aktarma için (farklı olanlar):
//  1. Kim: requireAuth + manage_workspace. Dosya yüklemek proje AÇMAK demek;
//     manage_projects yetmez, alanın tamamına dokunuyor.
//  2. Kapsam: yalnızca aktif alan; dosya hangi alandan geldiğini söylese de
//     (workspace.slug) ona bakılmaz, hedef her zaman aktif alan.
//  4. Başarısızlık kapalı: doğrulama İLK hatada reddeder; yazma tek
//     transaction, ortada patlarsa hiçbir şey kalmaz (ya hepsi ya hiçbiri).
//  6. Girdi: lib/tasinma.js paketiDogrula — tür, uzunluk, sınır, slug
//     biçimi, kolon/etiket referansı, tarih; doc gövdesi docDenetle'den
//     geçer, doc içinde kontrol listesi reddedilir. Gövde 10 MB (app.js).
//  5. Kişi eşleme: dosyadaki slug yalnızca AKTİF ALANIN ÜYELERİ arasında
//     aranır; eşleşmeyen atanan sessizce başka birine bağlanmaz, kart
//     atanmadan gelir ve kartın altına "şu kişi üye değil" yorumu düşer.
//     Yorum ve kart yazarı eşleşmezse içe aktaran kişi yazılır. Yani dosya
//     üye olmayan birine hiçbir şey yaptıramaz.
//  7. Denetim kaydı workspace.import, sayılarla ve eşleşmeyen slug sayısıyla.
//  9. İçe aktarma her zaman YENİ proje açar, var olana karışmaz: yanlış
//     dosya yüklendiyse proje silinir, iş biter.

import { Router } from 'express';

import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/session.js';
import { currentMember, hasPermission } from '../lib/workspace.js';
import { recordAudit, AUDIT } from '../lib/audit.js';
import { reqLang } from '../lib/lang.js';
import { csvBuffer, CSV_CONTENT_TYPE } from '../lib/csv.js';
import { recordTransition, yeniKartTamamlanma } from '../lib/reporting.js';
import { ilerlemeHesapla } from '../lib/checklist.js';
import {
  alanPaketi, paketOzeti, paketDosyaAdi, paketCsv, paketMarkdown,
  paketiDogrula, dogrulamaMesaji, benzersizProjeAdi,
} from '../lib/tasinma.js';

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
    const format = ['json', 'csv', 'md'].includes(req.query.format) ? req.query.format : 'json';
    const lang = reqLang(req);

    // Kayda içerik değil sayı yazılır (lib/audit.js başındaki kural).
    recordAudit(req, {
      workspaceId,
      user,
      action: AUDIT.WORKSPACE_EXPORT,
      detail: { ...ozet, format },
    });

    res.setHeader('Content-Disposition', `attachment; filename="${paketDosyaAdi(workspace.slug, now, format)}"`);
    if (format === 'csv') {
      // UTF-16LE + sekme; gerekçesi lib/csv.js başında.
      const { headers, rows } = paketCsv(paket, lang);
      res.setHeader('Content-Type', CSV_CONTENT_TYPE);
      return res.send(csvBuffer(headers, rows));
    }
    if (format === 'md') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(paketMarkdown(paket, lang));
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(paket, null, 2));
  }),
);

// ── POST /workspaces/me/import ───────────────────────────────────────────

const tarih = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

tasinmaRouter.post(
  '/import',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const member = await currentMember(user);
    if (!member) return res.status(403).json({ error: 'err_member_not_found', message: 'Üye bulunamadı' });
    if (!hasPermission(member, 'manage_workspace')) {
      return res.status(403).json({ error: 'err_import_forbidden', message: 'Çalışma alanına içe aktarma yetkiniz yok' });
    }
    const lang = reqLang(req);
    const workspaceId = member.workspaceId;

    const paket = req.body;
    const dogrulama = paketiDogrula(paket);
    if (!dogrulama.ok) {
      return res.status(400).json({ error: 'err_import_invalid', message: dogrulamaMesaji(dogrulama, lang) });
    }

    // Kişi eşleme yalnızca alan üyeleri arasında (elek 5).
    const uyeler = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, slug: true } } },
    });
    const slugToId = new Map(uyeler.map((m) => [m.user.slug, m.user.id]));
    const mevcutProjeler = await prisma.project.findMany({ where: { workspaceId }, select: { name: true } });
    const kullanilanAdlar = new Set(mevcutProjeler.map((p) => p.name));

    const eslesmeyen = new Set();
    const ozet = { projects: 0, tasks: 0, subtasks: 0, comments: 0 };
    const now = new Date();
    const uyeDegilNotu = (sluglar) => (lang === 'en'
      ? `Import: assignee${sluglar.length > 1 ? 's' : ''} ${sluglar.map((x) => `@${x}`).join(', ')} not a member of this workspace; left unassigned.`
      : `İçe aktarma: ${sluglar.map((x) => `@${x}`).join(', ')} bu alanın üyesi değil; kart atanmadan alındı.`);

    const yeniProjeIdleri = await prisma.$transaction(async (tx) => {
      const idler = [];
      for (const p of paket.projects) {
        const ad = benzersizProjeAdi(p.name, kullanilanAdlar);
        kullanilanAdlar.add(ad);
        const proje = await tx.project.create({
          data: { workspaceId, name: ad, color: p.color ?? null, icon: p.icon ?? null },
        });
        idler.push(proje.id);
        ozet.projects += 1;

        // Kolonlar: dosyadaki sıra korunur; bitiş işareti dosyadan.
        const kolonlar = new Map(); // slug → satır
        const kolonListesi = (p.columns ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        for (let i = 0; i < kolonListesi.length; i += 1) {
          const c = kolonListesi[i];
          const satir = await tx.boardColumn.create({
            data: {
              projectId: proje.id,
              slug: c.slug,
              title: c.title,
              titleTr: c.title_tr ?? null,
              color: c.color ?? null,
              position: i,
              isDone: c.is_done === true,
              allowedNext: Array.isArray(c.allowed_next) && c.allowed_next.length ? c.allowed_next : null,
            },
          });
          kolonlar.set(c.slug, satir);
        }

        const etiketler = new Map(); // slug → id
        for (const l of p.labels ?? []) {
          const satir = await tx.label.create({
            data: { projectId: proje.id, slug: l.slug, nameEn: l.name_en, nameTr: l.name_tr ?? null, colorTone: l.color_tone ?? null },
          });
          etiketler.set(l.slug, satir.id);
        }

        const kartlar = (p.tasks ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        for (let i = 0; i < kartlar.length; i += 1) {
          const t = kartlar[i];
          const kolon = t.column ? kolonlar.get(t.column) : null;
          const altlar = (t.subtasks ?? []).map((a, j) => ({ title: a.title, done: a.done === true, position: a.position ?? j }));
          const acilis = tarih(t.created_at) || now;
          // Bitiş kolonundaysa dosyadaki tamamlanma, yoksa şimdi; başka
          // kolondaysa null (yeniKartTamamlanma ile aynı kural).
          const tamamlanma = kolon?.isDone === true ? (tarih(t.completed_at) || yeniKartTamamlanma(kolon, now)) : null;
          const yazan = t.created_by && slugToId.has(t.created_by) ? slugToId.get(t.created_by) : user.id;

          const kart = await tx.task.create({
            data: {
              projectId: proje.id,
              columnId: kolon?.id ?? null,
              title: t.title,
              description: t.description ?? '',
              doc: t.doc ?? null,
              priority: t.priority ?? 'mid',
              progress: ilerlemeHesapla({ altlar, kolonBitti: kolon?.isDone === true }),
              dueDate: tarih(t.due),
              startDate: tarih(t.start),
              assigneeDates: t.assignee_dates ?? null,
              createdBy: yazan,
              createdAt: acilis,
              completedAt: tamamlanma,
              position: t.position ?? i,
            },
          });
          ozet.tasks += 1;

          for (const slug of t.labels ?? []) {
            const labelId = etiketler.get(slug);
            if (labelId) await tx.taskLabel.create({ data: { taskId: kart.id, labelId } });
          }

          const uyeOlmayan = [];
          const atananIdler = new Set();
          for (const slug of t.assignees ?? []) {
            const uid = slugToId.get(slug);
            if (uid) atananIdler.add(uid); else { uyeOlmayan.push(slug); eslesmeyen.add(slug); }
          }
          for (const uid of atananIdler) await tx.taskAssignee.create({ data: { taskId: kart.id, userId: uid } });

          if (altlar.length) {
            await tx.subtask.createMany({ data: altlar.map((a) => ({ taskId: kart.id, title: a.title, done: a.done, position: a.position })) });
            ozet.subtasks += altlar.length;
          }

          const yorumlar = (t.comments ?? []).map((y) => ({
            taskId: kart.id,
            userId: y.author && slugToId.has(y.author) ? slugToId.get(y.author) : user.id,
            text: y.text,
            createdAt: tarih(y.created_at) || acilis,
          }));
          if (uyeOlmayan.length) {
            yorumlar.push({ taskId: kart.id, userId: user.id, text: uyeDegilNotu(uyeOlmayan), createdAt: now });
          }
          if (yorumlar.length) {
            await tx.comment.createMany({ data: yorumlar });
            ozet.comments += yorumlar.length;
          }

          // İlk yerleşim de bir geçiştir (kart açma ucuyla aynı); tarihi
          // dosyadaki açılış ki akış raporu "bugün açıldı" demesin.
          await recordTransition(tx, {
            task: { id: kart.id, title: t.title, projectId: proje.id },
            project: proje,
            user,
            fromCol: null,
            toCol: kolon,
            at: acilis,
          });
        }
      }
      return idler;
    }, { maxWait: 10000, timeout: 120000 });

    recordAudit(req, {
      workspaceId,
      user,
      action: AUDIT.WORKSPACE_IMPORT,
      detail: { ...ozet, unmatched_assignees: eslesmeyen.size, source: paket.workspace?.slug ?? null },
    });

    res.status(201).json({
      ok: true,
      ...ozet,
      project_ids: yeniProjeIdleri.map(String),
      unmatched_assignees: [...eslesmeyen],
    });
  }),
);
