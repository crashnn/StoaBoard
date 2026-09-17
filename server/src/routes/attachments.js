// Python karşılığı: api.py'deki task attachment + chat upload endpoint'leri
//
//   GET    /api/tasks/:taskId/attachments    list
//   POST   /api/tasks/:taskId/attachments    upload (multer)
//   GET    /api/attachments/:id              serve file bytes
//   PATCH  /api/attachments/:id              rename (display_name)
//   DELETE /api/attachments/:id              delete (cascades UploadedFile)
//
//   POST   /api/chat/upload                  chat file upload → /api/media/:id

import { Router } from 'express';

import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/session.js';
import { memberForWorkspace } from '../lib/workspace.js';
import { taskAttachmentToDict } from '../lib/serializers.js';
import { upload, storeFile, uploadErrorHandler } from '../lib/uploads.js';
import { resolveChatTarget } from '../lib/channels.js';
import { rateLimited } from '../lib/rateLimit.js';

export const taskAttachmentsRouter = Router();   // /tasks/:taskId/attachments
export const attachmentsRouter = Router();       // /attachments/:id
export const chatUploadRouter = Router();        // /chat/upload

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'text/',
  'application/zip',
  'application/msword',
  'application/vnd.',
];

// Sohbet yüklemesi hız sınırı. Dosya `uploaded_files` tablosuna bytes olarak
// yazılıyor ve satırın sahibi yok; sınırsız tekrar tek bir hesabın depoyu
// doldurmasına yetiyordu. Anahtar KULLANICI kimliği, IP değil: aynı ofisten
// çalışan ekip tek IP'den gelir ve birbirini sınırlardı.
const CHAT_UPLOAD_MAX = 20;
const CHAT_UPLOAD_WINDOW_MS = 10 * 60 * 1000;

const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const ALLOWED_VIDEO_EXT = new Set(['mp4', 'webm', 'ogg', 'mov']);

async function loadUser(req) {
  const uid = req.session?.userId;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

async function requireTaskAccess(req, res, taskId) {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: 'err_auth_required' });
    return null;
  }
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    res.status(404).json({ error: 'err_task_not_found', message: 'Görev bulunamadı' });
    return null;
  }
  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
  });
  if (!project) {
    res.status(404).json({ error: 'err_project_not_found', message: 'Proje bulunamadı' });
    return null;
  }
  const member = await memberForWorkspace(user.id, project.workspaceId);
  if (!member) {
  // Kâhin kapalı: red, "bulunamadı" ile aynı gövde (kart #227, tasks.js).
    res.status(404).json({ error: 'err_task_not_found', message: 'Görev bulunamadı' });
    return null;
  }
  return { user, task, project };
}

// ─── GET /api/tasks/:taskId/attachments ────────────────────────────────────

taskAttachmentsRouter.get(
  '/:taskId/attachments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    const ctx = await requireTaskAccess(req, res, taskId);
    if (!ctx) return;
    const atts = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: { uploader: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(atts.map(taskAttachmentToDict));
  }),
);

// ─── POST /api/tasks/:taskId/attachments ───────────────────────────────────

taskAttachmentsRouter.post(
  '/:taskId/attachments',
  requireAuth,
  upload.single('file'),
  uploadErrorHandler,
  asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.taskId, 10);
    const ctx = await requireTaskAccess(req, res, taskId);
    if (!ctx) return;

    if (!req.file) return res.status(400).json({ error: 'err_file_not_found', message: 'Dosya bulunamadı' });
    if (!req.file.originalname) {
      return res.status(400).json({ error: 'err_file_name_empty', message: 'Dosya adı boş' });
    }
    // Boyut kontrolü multer'da (uploads.js, UPLOAD_MAX_BYTES) ve aşım
    // `uploadErrorHandler` ile 413'e çevriliyor. Buradaki eski `> 20 MB`
    // kontrolü erişilemezdi: multer zaten 10 MB'da kesiyordu.
    const mime = req.file.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
      return res.status(415).json({ error: 'err_unsupported_file_type', message: `Desteklenmeyen dosya türü: ${mime}` });
    }

    const stored = await storeFile(req.file, 'attachment');
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileId: stored.id,
        fileName: req.file.originalname,
        fileType: mime,
        uploaderId: ctx.user.id,
      },
      include: { uploader: true },
    });
    res.status(201).json(taskAttachmentToDict(attachment));
  }),
);

// ─── GET /api/attachments/:id ──────────────────────────────────────────────

attachmentsRouter.get(
  '/:attId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const attId = parseInt(req.params.attId, 10);
    const att = await prisma.taskAttachment.findUnique({
      where: { id: attId },
      include: { uploadedFile: true },
    });
    if (!att) return res.status(404).json({ error: 'err_attachment_not_found', message: 'Ek bulunamadı' });
    const ctx = await requireTaskAccess(req, res, att.taskId);
    if (!ctx) return;
    const uf = att.uploadedFile;
    if (!uf) return res.status(404).json({ error: 'err_file_not_found', message: 'Dosya bulunamadı' });

    res.setHeader('Content-Type', uf.contentType || 'application/octet-stream');
    const safeName = (att.fileName || 'file').replace(/"/g, '');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    res.end(uf.data || Buffer.alloc(0));
  }),
);

// ─── PATCH /api/attachments/:id ────────────────────────────────────────────

attachmentsRouter.patch(
  '/:attId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const attId = parseInt(req.params.attId, 10);
    const att = await prisma.taskAttachment.findUnique({ where: { id: attId } });
    if (!att) return res.status(404).json({ error: 'err_attachment_not_found', message: 'Ek bulunamadı' });
    const ctx = await requireTaskAccess(req, res, att.taskId);
    if (!ctx) return;

    const name = (req.body?.display_name || '').trim();
    if (name) {
      await prisma.taskAttachment.update({
        where: { id: attId },
        data: { displayName: name },
      });
    }
    const updated = await prisma.taskAttachment.findUnique({
      where: { id: attId },
      include: { uploader: true },
    });
    res.json(taskAttachmentToDict(updated));
  }),
);

// ─── DELETE /api/attachments/:id ───────────────────────────────────────────

attachmentsRouter.delete(
  '/:attId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const attId = parseInt(req.params.attId, 10);
    const att = await prisma.taskAttachment.findUnique({ where: { id: attId } });
    if (!att) return res.status(404).json({ error: 'err_attachment_not_found', message: 'Ek bulunamadı' });
    const ctx = await requireTaskAccess(req, res, att.taskId);
    if (!ctx) return;
    await prisma.$transaction([
      prisma.taskAttachment.delete({ where: { id: attId } }),
      prisma.uploadedFile.delete({ where: { id: att.fileId } }),
    ]);
    res.json({ ok: true });
  }),
);

// ─── POST /api/chat/upload ─────────────────────────────────────────────────
//
// Chat'e dosya yükleme. Image/video uzantısına göre type ('image'|'video'|'file')
// karar verir. Cloudinary entegrasyonu Python'da vardı, şimdilik atlandı —
// sadece DB storage. (Sonra eklemek istersek storeFile öncesi try/catch ile sarılır.)

chatUploadRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  uploadErrorHandler,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ error: 'err_auth_required' });

    // Hedef kapısı mesaj göndermeyle AYNI yardımcıdan geçiyor: yüklenen dosya
    // artık bir kanala ya da DM'e bağlı ve yükleyen o hedefe yazabiliyor.
    // Öncesinde uç yalnızca oturum istiyordu; dosya hiçbir şeye bağlı değildi,
    // yani alanı olmayan ya da kanala üye olmayan biri de yükleyebiliyordu.
    const hedef = await resolveChatTarget(user, {
      to: req.body?.to || null,
      channel: req.body?.channel,
    });
    if (!hedef.ok) {
      return res.status(hedef.status).json({ error: hedef.error, message: hedef.message });
    }

    if (rateLimited(`chat-upload:${user.id}`, CHAT_UPLOAD_MAX, CHAT_UPLOAD_WINDOW_MS)) {
      return res.status(429).json({
        error: 'err_upload_rate_limited',
        message: 'Çok fazla dosya yüklediniz; biraz sonra tekrar deneyin',
      });
    }

    if (!req.file) return res.status(400).json({ error: 'err_no_file_selected', message: 'Dosya seçilmedi' });
    const origName = req.file.originalname || '';
    if (!origName) return res.status(400).json({ error: 'err_invalid_file', message: 'Geçersiz dosya' });

    // Kart eki bu denetimden geçiyordu, sohbet yüklemesi geçmiyordu: aynı
    // depoya yazan iki kapıdan yalnızca biri tür soruyordu.
    const mime = req.file.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
      return res.status(415).json({ error: 'err_unsupported_file_type', message: `Desteklenmeyen dosya türü: ${mime}` });
    }

    const ext = origName.includes('.')
      ? origName.split('.').pop().toLowerCase()
      : '';
    let ftype = 'file';
    if (ALLOWED_IMAGE_EXT.has(ext)) ftype = 'image';
    else if (ALLOWED_VIDEO_EXT.has(ext)) ftype = 'video';

    const stored = await storeFile(req.file, 'chat');
    res.json({
      url: `/api/media/${stored.id}`,
      type: ftype,
      name: origName,
      size: req.file.size,
    });
  }),
);
