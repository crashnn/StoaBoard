// Python karşılığı: auth.py _send_reset_email
//
// SMTP yapılandırılmışsa gerçek mail atar, değilse konsola yazar (dev mode).

import nodemailer from 'nodemailer';

function readSmtpEnv() {
  return {
    host: (process.env.SMTP_HOST || '').trim(),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').trim(),
    from: (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim(),
  };
}

let cachedTransporter = null;
function getTransporter(cfg) {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port === 587,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return cachedTransporter;
}

/**
 * Şifre sıfırlama kodunu mail at. SMTP yoksa konsola yaz (dev).
 * Python tarafıyla aynı subject ve gövdeyi kullanır.
 */
export async function sendResetEmail(toEmail, code) {
  const cfg = readSmtpEnv();

  const body =
    `Merhaba,\n\n` +
    `StoaBoard şifre sıfırlama kodunuz:\n\n` +
    `  ${code}\n\n` +
    `Bu kod 15 dakika geçerlidir.\n` +
    `Bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.\n\n` +
    `StoaBoard Ekibi`;

  if (!cfg.host || !cfg.user) {
    console.log(`[StoaBoard DEV] Şifre sıfırlama kodu (${toEmail}): ${code}`);
    return;
  }

  await getTransporter(cfg).sendMail({
    from: cfg.from || 'no-reply@stoaboard.app',
    to: toEmail,
    subject: 'StoaBoard – Şifre Sıfırlama Kodu',
    text: body,
  });
}

// ─── Bildirim e-postaları ───────────────────────────────────────────────────
//
// Bilinçli olarak varsayılan KAPALI: NOTIFY_EMAIL=1 verilmeden tek bir posta
// gitmez. Gerçek insanlara mail gönderen bir özelliğin sessizce açılmaması
// gerekir; SMTP zaten tanımlı olduğu için aksi hâlde ilk dağıtımda herkese
// posta giderdi.
//
// İlgili env:
//   NOTIFY_EMAIL=1                       özelliği aç
//   NOTIFY_EMAIL_TYPES=task_assigned,mention   hangi bildirimler postalansın
//   APP_URL=https://www.stoaboard.com    postadaki bağlantının kökü

export function emailNotificationsEnabled() {
  return String(process.env.NOTIFY_EMAIL || '').trim() === '1';
}

export function emailableTypes() {
  const raw = (process.env.NOTIFY_EMAIL_TYPES || 'task_assigned,mention').trim();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Bildirim gövdesini insan okuyabilir Türkçeye çevir.
 *
 * İstemci tarafı bu JSON'u i18n ile çiziyor; posta için sunucuda ayrı bir
 * karşılık gerekiyor. Mention bildirimleri JSON değil düz HTML string olarak
 * üretiliyor, o yüzden parse başarısız olursa etiketler temizlenip kullanılır.
 */
export function renderNotification(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.type) {
    const plain = String(text || '').replace(/<[^>]*>/g, '').trim();
    return { type: 'mention', title: 'Sizden bahsedildi', body: plain };
  }
  switch (parsed.type) {
    case 'task_assigned':
      return {
        type: 'task_assigned',
        title: 'Size bir görev atandı',
        body: `${parsed.who || 'Bir takım arkadaşınız'}, "${parsed.task || ''}" görevini size atadı.`,
      };
    case 'comment_added':
      return {
        type: 'comment_added',
        title: 'Görevinize yorum yapıldı',
        body: `${parsed.who || 'Bir takım arkadaşınız'} yorum yazdı: ${parsed.preview || ''}`,
      };
    case 'task_moved':
      return {
        type: 'task_moved',
        title: 'Görev taşındı',
        body: `"${parsed.task || ''}" görevi "${parsed.col || ''}" kolonuna taşındı.`,
      };
    case 'join_request':
      return {
        type: 'join_request',
        title: 'Katılma isteği',
        body: `${parsed.who || 'Bir kullanıcı'} çalışma alanınıza katılmak istiyor.`,
      };
    default:
      return { type: parsed.type, title: 'StoaBoard bildirimi', body: '' };
  }
}

/**
 * Bildirim postası gönder. Hata fırlatmaz — posta gidemezse uygulama akışı
 * etkilenmemeli, bildirim zaten uygulama içinde ve soket üzerinden iletildi.
 */
export async function sendNotificationEmail(toEmail, rendered) {
  if (!toEmail || !rendered) return false;
  const cfg = readSmtpEnv();
  const appUrl = (process.env.APP_URL || 'https://www.stoaboard.com').replace(/\/+$/, '');

  const body =
    `${rendered.body}\n\n` +
    `StoaBoard'da görüntüle: ${appUrl}\n\n` +
    `Bu bildirimleri almak istemiyorsanız StoaBoard > Ayarlar üzerinden kapatabilirsiniz.`;

  if (!cfg.host || !cfg.user) {
    console.log(`[StoaBoard DEV] Bildirim postası (${toEmail}): ${rendered.title} — ${rendered.body}`);
    return false;
  }

  try {
    await getTransporter(cfg).sendMail({
      from: cfg.from || 'no-reply@stoaboard.app',
      to: toEmail,
      subject: `StoaBoard – ${rendered.title}`,
      text: body,
    });
    return true;
  } catch (err) {
    console.warn('[mail] bildirim postası gönderilemedi:', err.message);
    return false;
  }
}
