// Kişinin kendi MCP anahtarları — Ayarlar → Claude bağlantısı.
//
//   GET    /api/mcp-tokens        kendi etkin anahtarlarım (ham anahtar ve özet yok)
//   POST   /api/mcp-tokens        yeni anahtar; ham hâli YALNIZCA bu yanıtta
//   DELETE /api/mcp-tokens/:id    kendi anahtarımı iptal et
//
// ── Neden var ─────────────────────────────────────────────────────────────
//
// 13 Eylül 2026'ya kadar her MCP anahtarı Railway'deki `STOA_MCP_TOKENS`
// değişkenine elle eklenip yeniden dağıtılıyordu. Yeni bir kişiye Claude
// erişimi vermek, Railway erişimi olan tek kişiye bağlıydı — ekip değiştikçe
// sürdürülemez. Ortak "servis hesabı" TODO'da gerekçesiyle elendi: anahtar
// kişiye bağlı olmalı, yoksa denetim kaydı "bunu kim yaptı" diyemez.
//
// ── Kapsam ────────────────────────────────────────────────────────────────
//
// Her sorgu `userId: user.id` ile daraltılıyor — kişi YALNIZCA kendi
// anahtarlarını görür ve iptal eder. Başkasının anahtar kimliği verilirse
// sonuç, hiç var olmayan kimlikle aynı 404 (var/yok kâhini yok).
// `anahtar.test.js` her sorgunun bu daraltmayı taşıdığını tarıyor.
//
// Anahtar çalışma alanına değil kişiye bağlı: MCP kişinin üye olduğu alanlarda,
// onun izinleriyle çalışıyor. Bu yüzden ayrı bir izin istemiyor — giriş yapmış
// herkes kendisi için anahtar üretebilir; ürettiği anahtar ondan fazlasını
// yapamaz.

import { Router } from 'express';

import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/session.js';
import { currentMember } from '../lib/workspace.js';
import { rateLimited } from '../lib/rateLimit.js';
import { recordAudit, AUDIT } from '../lib/audit.js';
import {
  yeniMcpAnahtari,
  anahtarEtiketi,
  mcpTokenToDict,
  AKTIF_ANAHTAR_SINIRI,
} from '../lib/mcpToken.js';

export const mcpTokensRouter = Router();

async function oturumKullanicisi(req) {
  const uid = req.session?.userId;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

/** Denetim satırının düşeceği alan: kişinin o anki aktif alanı, yoksa hiçbiri. */
async function denetimAlani(user) {
  const member = await currentMember(user);
  return member?.workspaceId ?? null;
}

// ─── GET / ─────────────────────────────────────────────────────────────────

mcpTokensRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await oturumKullanicisi(req);
    if (!user) return res.status(401).json({ error: 'err_auth_required', message: 'Giriş gerekli' });

    const satirlar = await prisma.mcpToken.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ limit: AKTIF_ANAHTAR_SINIRI, tokens: satirlar.map(mcpTokenToDict) });
  }),
);

// ─── POST / ────────────────────────────────────────────────────────────────

mcpTokensRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await oturumKullanicisi(req);
    if (!user) return res.status(401).json({ error: 'err_auth_required', message: 'Giriş gerekli' });

    // Saatte on: ele geçirilmiş bir oturumun toplu anahtar üretip dağıtmasını
    // yavaşlatıyor; gerçek kullanımda saatte ondan fazla anahtar gerekmez.
    if (rateLimited(`mcp-token:${user.id}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({
        error: 'err_mcp_token_rate_limited',
        message: 'Çok fazla anahtar oluşturuldu; bir süre sonra yeniden deneyin',
      });
    }

    const etkin = await prisma.mcpToken.count({ where: { userId: user.id, revokedAt: null } });
    if (etkin >= AKTIF_ANAHTAR_SINIRI) {
      return res.status(409).json({
        error: 'err_mcp_token_limit',
        message: 'Etkin anahtar sınırına ulaşıldı; yeni anahtar için birini iptal edin',
        limit: AKTIF_ANAHTAR_SINIRI,
      });
    }

    const { ham, ozet, onek } = yeniMcpAnahtari();
    const satir = await prisma.mcpToken.create({
      data: {
        userId: user.id,
        label: anahtarEtiketi(req.body?.label),
        tokenHash: ozet,
        prefix: onek,
      },
    });

    recordAudit(req, {
      workspaceId: await denetimAlani(user),
      user,
      action: AUDIT.MCP_TOKEN_CREATED,
      // Ham anahtar da özeti de yazılmıyor; önek tanımak için yeter.
      detail: { token_id: String(satir.id), prefix: satir.prefix },
    });

    // Ham anahtar bu yanıttan başka hiçbir yere gitmiyor; ara bellekte de
    // kalmasın.
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({ token: ham, ...mcpTokenToDict(satir) });
  }),
);

// ─── DELETE /:id ───────────────────────────────────────────────────────────

mcpTokensRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await oturumKullanicisi(req);
    if (!user) return res.status(401).json({ error: 'err_auth_required', message: 'Giriş gerekli' });

    const id = Number.parseInt(req.params.id, 10);
    // Tek sorgu hem aitliği hem varlığı soruyor: başkasının anahtarı ile
    // olmayan anahtar aynı 404'ü alıyor.
    const { count } = Number.isSafeInteger(id) && id > 0
      ? await prisma.mcpToken.updateMany({
        where: { id, userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      : { count: 0 };

    if (!count) {
      return res.status(404).json({ error: 'err_mcp_token_not_found', message: 'Anahtar bulunamadı' });
    }

    recordAudit(req, {
      workspaceId: await denetimAlani(user),
      user,
      action: AUDIT.MCP_TOKEN_REVOKED,
      detail: { token_id: String(id), reason: 'kullanıcı iptal etti' },
    });
    return res.json({ ok: true });
  }),
);
