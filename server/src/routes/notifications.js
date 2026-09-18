// Python karşılığı: api.py içindeki notification endpoint'leri
//
//   GET    /api/notifications              user'ın son 50 bildirimi
//   POST   /api/notifications/:id/read     tek bildirimi okundu yap
//   POST   /api/notifications/read-all     hepsini okundu yap
//   DELETE /api/notifications/:id          sil
//   POST   /api/notifications              manuel bildirim oluştur (kendine veya başkasına)

import { Router } from 'express';

import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/session.js';
import { notificationToDict } from '../lib/serializers.js';
import { createAndPush } from '../lib/notifications.js';
import { resolveWorkspaceId, usersShareWorkspace } from '../lib/workspace.js';

export const notificationsRouter = Router();

async function loadUser(req) {
  const uid = req.session?.userId;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const notifs = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifs.map(notificationToDict));
  }),
);

notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);

    // KUSUR (17 Eylül 2026, kart #193 — kök sebep buymuş).
    //
    // Burada `where: { userId, read: false }` yazıyordu ve HİÇBİR ŞEYİ
    // güncellemiyordu. Sebep şemada: `read Boolean?` yani NULL olabilir, ve
    // `createAndPush` alanı hiç yazmıyor — her bildirim `read = NULL` doğuyor.
    // SQL'de `read = false`, `read IS NULL` satırlarını EŞLEŞTİRMEZ.
    //
    // Sonuç mükemmel bir sessiz başarısızlıktı: sorgu hatasız koşuyor, sıfır
    // satır güncelliyor, uç `ok` dönüyor. İstemci iyimser güncellemeyi yapıyor,
    // noktalar kayboluyor, sonraki okumada geri geliyor. F5 ve hard refresh de
    // çözmüyordu çünkü veri GERÇEKTEN okunmamıştı.
    //
    // Tekil okuma (`/:notifId/read`) çalışıyordu ve bu kusuru gizliyordu:
    // `update({ data: { read: true } })` kimliğe gidiyor, `read`in değerine
    // bakmıyor. Yani "bildirime tıkla" çalışıyor, "tümünü oku" çalışmıyordu.
    //
    // `read` SÜZGECİ TÜMDEN KALDIRILDI. Zaten okunmuş bir satırı yeniden
    // okundu yazmak işlemsiz; NULL/false ayrımını burada yeniden kurmak aynı
    // tuzağı başka bir yazımla geri getirirdi.
    const { count } = await prisma.notification.updateMany({
      where: { userId: user.id },
      data: { read: true },
    });

    // Sayı yanıta konuyor ki işlem GÖZLEMLENEBİLİR olsun. Bu kusur dört gün
    // boyunca fark edilmedi çünkü uç her zaman aynı `{ ok: true }` dönüyordu:
    // "hepsini okudum" ile "hiçbirini okuyamadım" aynı cevabı veriyordu.
    res.json({ ok: true, updated: count });
  }),
);

notificationsRouter.post(
  '/:notifId/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const notifId = parseInt(req.params.notifId, 10);
    const n = await prisma.notification.findFirst({
      where: { id: notifId, userId: user.id },
    });
    if (!n) return res.status(404).json({ error: 'err_notification_not_found', message: 'Bildirim bulunamadı' });
    await prisma.notification.update({
      where: { id: notifId },
      data: { read: true },
    });
    res.json({ ok: true });
  }),
);

notificationsRouter.delete(
  '/:notifId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const notifId = parseInt(req.params.notifId, 10);
    const n = await prisma.notification.findFirst({
      where: { id: notifId, userId: user.id },
    });
    if (!n) return res.status(404).json({ error: 'err_notification_not_found', message: 'Bildirim bulunamadı' });
    await prisma.notification.delete({ where: { id: notifId } });
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const data = req.body || {};
    const text = (data.text || '').trim();
    if (!text) return res.status(400).json({ error: 'err_notification_text_required', message: 'Bildirim metni gerekli' });

    // Hedef kullanıcı, gönderenin AKTİF çalışma alanının üyesi olmalı.
    //
    // KUSUR (12 Eylül 2026): burada yalnızca "böyle bir kullanıcı var mı" diye
    // bakılıyordu. Yani kimliği doğrulanmış herhangi biri, hiç tanımadığı
    // birine serbest metinle bildirim gönderebiliyordu — kimlik avı ve taciz
    // yüzeyi. Metin istemcide HTML olarak da basılıyordu; o dal 0-P'de kapandı
    // ama "kime yazabilirim" sorusu açıktı.
    //
    // Var/yok farkı BİLEREK gizleniyor: olmayan kullanıcı da, üye olmayan
    // kullanıcı da aynı 403'ü alıyor. Aksi hâlde bu uç "şu kimlikte kullanıcı
    // var mı" sorusunun kahini olurdu (GUVENLIK.md §4, 8. soru).
    //
    // Kapı kapalı başarısızlık: aktif alan yoksa, kimlik sayı değilse ya da
    // taraflardan biri üye değilse `usersShareWorkspace` false döner.
    // Aktif alan ÇÖZÜLMÜŞ kimlikten (kart #204): ham sütun bayatsa kapı
    // yanlış alana bakar, bildirim de yanlış alana yazılırdı.
    const aktifWs = await resolveWorkspaceId(user);
    const hedefHam = data.user_id;
    const targetId = (hedefHam === undefined || hedefHam === null || hedefHam === '')
      ? user.id
      : Number(hedefHam);
    if (targetId !== user.id) {
      const paylasiyor = Number.isInteger(targetId)
        && await usersShareWorkspace(user.id, targetId, aktifWs);
      if (!paylasiyor) {
        return res.status(403).json({
          error: 'err_not_workspace_member',
          message: 'Bu çalışma alanına üye değilsiniz',
        });
      }
    }

    const io = req.app.get('io');
    const notif = await createAndPush(io, {
      userId: targetId,
      text,
      workspaceId: aktifWs,
    });
    res.status(201).json(notificationToDict(notif));
  }),
);
