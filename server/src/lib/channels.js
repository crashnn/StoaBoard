// Python karşılığı: api.py içindeki _user_can_create_channel,
// _list_accessible_channels, _get_channel_or_404, _user_channel_role,
// _can_manage_channel, channel serialization.
//
// Bootstrap için minimum gerekenleri içerir; chat grubunda genişletilecek.

import { prisma } from '../db.js';
import { resolveWorkspaceId, usersShareWorkspace } from './workspace.js';

const CHANNEL_SLUG_STRIP = /[^a-z0-9\-_çğıöşü]+/g;

/**
 * Python _slugify_channel karşılığı: lower, allowed harfler/digits/-/_,
 * Turkish karakterleri korur; geri kalan ardışıkları '-' yapar.
 */
export function slugifyChannel(name) {
  const raw = (name || '').trim().toLowerCase();
  return raw.replace(CHANNEL_SLUG_STRIP, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/**
 * Kullanıcının kanaldaki rolü ('owner' | 'admin' | 'member') veya null.
 * Public kanallarda workspace üyesi otomatik 'member'.
 */
export async function userChannelRole(channel, userId) {
  if (!channel) return null;
  const cm = (channel.members || []).find((m) => m.userId === userId);
  if (cm) return cm.role || 'member';
  if (channel.type === 'public' && channel.workspaceId) {
    const wm = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: channel.workspaceId, userId } },
    });
    if (wm) return 'member';
    const ws = await prisma.workspace.findUnique({
      where: { id: channel.workspaceId },
    });
    if (ws?.ownerId === userId) return 'member';
  }
  return null;
}

export function canManageChannel(role) {
  return role === 'owner' || role === 'admin';
}

// ── Kanal geçmişi kesimi (kart #119) ──────────────────────────────────────
//
// KARAR (kullanıcı, 18 Eylül 2026): "Alana yeni katılan birisi kanalın tüm
// geçmişini okuyamamalı, o anda giriş yaptıktan sonra okumalıdır. ... bir
// şirkete giriş yaptığında sana atadıkları e-posta hesabı ile eski geçmişi
// göremiyoruz, o andan itibaren olan konuşmalar görünüyor."
//
// Kesim noktası KATILIM ANI; kanal başına ayar yok. Şema değişmedi:
// `channel_members.joined_at` zaten var ve her kanal üyeliği açık bir satırla
// kuruluyor (genel kanala onayda, herkese açık kanala kanal açılırken, özele
// davette). Satırı olmayan tek durum, üye katıldıktan ÖNCE açılmış bir
// herkese açık kanal — onay yolu yalnızca "genel"e ekliyordu. Orada yedek
// ölçüt çalışma alanına katılım isteğinin zamanı; artık onay bütün herkese
// açık kanallara satır yazıyor (workspaces.js), yedek eski üyeler için.
//
// Kaynak yoksa (kurucu, istek kaydı olmayan eski üye) başlangıç null =
// kesim yok. Bu bir sessiz geçiş DEĞİL, kararın kendisi: kurucu ve ilk
// üyeler geçmişin tamamına sahip; katılım anı olmayan birine uydurma bir
// tarih dayatmak ya hiçbir şey göstermez ya rastgele bir yerden keser.
//
// DM'de kesim yok: iki taraf da baştan beri konuşmanın içinde.

/**
 * Saf: kullanıcının kanalda görebildiği geçmişin başlangıcı.
 *
 * @param {{ joinedAt?: Date|null }|null} uyelik kanal üyelik satırı
 * @param {{ createdAt?: Date|null }|null} katilimIstegi onaylanmış alan katılım isteği
 * @returns {Date|null} null = kesim yok
 */
export function gecmisBaslangici(uyelik, katilimIstegi) {
  if (uyelik) return uyelik.joinedAt || null;
  return katilimIstegi?.createdAt || null;
}

/** Saf: başlangıcı Prisma `where` parçasına çevirir. */
export function gecmisSuzgeci(baslangic) {
  return baslangic ? { createdAt: { gte: baslangic } } : {};
}

/**
 * Kullanıcının kanalda görebildiği geçmişin başlangıcı — veritabanından.
 * `channel` üyeleriyle (`members`) yüklenmiş olmalı.
 */
export async function kanalGecmisBaslangici(channel, userId) {
  const uyelik = (channel.members || []).find((m) => m.userId === userId) || null;
  if (uyelik) return gecmisBaslangici(uyelik, null);
  const istek = channel.workspaceId
    ? await prisma.workspaceJoinRequest.findFirst({
        where: { workspaceId: channel.workspaceId, userId, status: 'approved' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
    : null;
  return gecmisBaslangici(null, istek);
}

/**
 * Kullanıcının çalışma alanında OKUYABİLDİĞİ kanal mesajları için Prisma
 * koşulları — kanal başına kendi kesim noktasıyla. `OR` listesine konur.
 *
 * Çok kanallı okumalar (bütün sabitlenmişler, bütün medya) bunu kullanır.
 * 18 Eylül 2026'ya kadar o iki okuma kanal üyeliğine HİÇ bakmıyordu: özel
 * kanalın sabitlenmiş mesajı ve dosyaları alandaki herkese listeleniyordu.
 * Koşul listesi yalnızca erişilebilir kanallardan kurulduğu için o sızıntı
 * da burada kapanıyor.
 *
 * "genel" kanalının eski mesajları `channel = NULL` ile duruyor; o satırlar
 * genel kanalın kesimine tabi.
 */
export async function okunabilirKanalKosullari(user) {
  const kanallar = await listAccessibleChannels(user);
  const kosullar = [];
  for (const c of kanallar) {
    const suzgec = gecmisSuzgeci(await kanalGecmisBaslangici(c, user.id));
    kosullar.push({ channel: c.slug, ...suzgec });
    if (c.slug === 'general') kosullar.push({ channel: null, ...suzgec });
  }
  return kosullar;
}

/**
 * Bahsedilen (@mention) kişiye bildirim gönderilmeli mi? Saf karar.
 *
 * Bildirim, mesajın önizlemesini taşıyor; dolayısıyla yalnızca mesajı görme
 * hakkı olan kişiye gitmeli. Aksi halde bir üye @slug yazarak çalışma alanı
 * dışındaki ya da özel kanala üye olmayan rastgele birine içerik sızdırabilir.
 *
 * DB erişimi (workspace ortaklığı, kanal rolü) çağıran tarafta çözülür; burası
 * yalnızca kararı verir ve test edilebilir kalır.
 *
 *   isDm               mesaj bir DM mi
 *   mentionedIsReceiver DM'de bahsedilen kişi karşı taraf mı
 *   sharesWorkspace    bahsedilen kişi mesajın çalışma alanında mı
 *   isPrivateChannel   kanal özel mi
 *   hasChannelRole     bahsedilen kişinin özel kanalda rolü var mı
 */
export function mentionAllowed({
  isDm = false,
  mentionedIsReceiver = false,
  sharesWorkspace = false,
  isPrivateChannel = false,
  hasChannelRole = false,
} = {}) {
  // DM: yalnızca karşı taraf. Üçüncü kişiye DM içeriği sızmamalı.
  if (isDm) return mentionedIsReceiver;
  // Kanal: önce çalışma alanı üyeliği; özel kanalda ayrıca kanal üyeliği şart.
  if (!sharesWorkspace) return false;
  return isPrivateChannel ? hasChannelRole : true;
}

/**
 * Kanal + bağlı mesajlarını sil. Transaction client al.
 * Python _delete_channel_tree karşılığı.
 */
export async function deleteChannelTree(tx, channel) {
  await tx.chatMessage.deleteMany({
    where: {
      workspaceId: channel.workspaceId,
      receiverId: null,
      channel: channel.slug,
    },
  });
  await tx.channelMember.deleteMany({ where: { channelId: channel.id } });
  await tx.channel.delete({ where: { id: channel.id } });
}

/**
 * Hidden-for alanı string ya da array gelebilir — array'e normalize et.
 */
export function parseHiddenFor(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

/**
 * Channel modelini frontend formatına çevir. Python Channel.to_dict() karşılığı.
 * `channel` { members: ChannelMember[], lastMessage? } şeklinde include edilmiş olmalı.
 *
 * `lastMessage` opsiyonel: { id, text, fileName, createdAt, sender:{slug,name} }
 */
export function channelToDict(channel, { currentUserId = null, includeMembers = false } = {}) {
  const data = {
    id: channel.slug, // frontend slug'ı id olarak kullanıyor
    channel_id: channel.id, // numeric id backend operasyonlar için
    slug: channel.slug,
    name: channel.name,
    description: channel.description || '',
    type: channel.type || 'public',
    icon: channel.icon || (channel.type === 'private' ? 'lock' : 'hash'),
    is_default: Boolean(channel.isDefault),
    created_by: channel.createdBy,
    member_count: channel.members?.length || 0,
  };
  if (currentUserId != null && Array.isArray(channel.members)) {
    const me = channel.members.find((m) => m.userId === currentUserId);
    data.my_role = me?.role || null;
    data.is_member = Boolean(me);
  }
  if (includeMembers && Array.isArray(channel.members)) {
    data.members = channel.members.map((m) => ({
      user_id: m.user?.slug || null,
      user_db_id: m.userId,
      name: m.user?.name || '',
      role: m.role || 'member',
      joined_at: m.joinedAt ? new Date(m.joinedAt).toISOString() : '',
    }));
  }
  // Kesim noktası (kart #119): istemci "geçmiş şu tarihten itibaren" notunu
  // buradan kuruyor. Yalnızca kesim varsa gelir; yokluğu "kesim yok" demek.
  if (channel.gecmisBaslangici) {
    data.history_from = new Date(channel.gecmisBaslangici).toISOString();
  }
  if (channel.lastMessage) {
    const lm = channel.lastMessage;
    data.last_message = {
      id: lm.id,
      text: lm.text || '',
      file_name: lm.fileName || null,
      time: lm.createdAt ? new Date(lm.createdAt).toISOString() : '',
      from: lm.sender?.slug || null,
      from_name: lm.sender?.name || '',
    };
  }
  return data;
}

/**
 * Workspace sahibi mi, ya da `manage_channels` / `channel:create` izinli mi.
 * Python _user_can_create_channel karşılığı.
 */
export async function userCanCreateChannel(user, workspaceId) {
  if (!workspaceId) return false;
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (ws?.ownerId === user.id) return true;

  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    include: { workspaceRole: true },
  });
  if (!m) return false;
  if (m.role === 'owner') return true;
  const perms = m.workspaceRole?.permissions;
  if (Array.isArray(perms)) {
    if (perms.includes('manage_channels') || perms.includes('channel:create')) {
      return true;
    }
  }
  return false;
}

/**
 * Kullanıcının görebileceği kanalları döner: aktif workspace'teki tüm public +
 * üye olduğu private kanallar. Default kanal (general) önce, sonra created_at.
 *
 * Python _list_accessible_channels karşılığı.
 */
export async function listAccessibleChannels(user) {
  const wsId = await resolveWorkspaceId(user);
  if (!wsId) return [];

  const pub = await prisma.channel.findMany({
    where: { workspaceId: wsId, type: 'public' },
    include: { members: { include: { user: true } } },
  });

  const privMemberships = await prisma.channelMember.findMany({
    where: { userId: user.id },
    select: { channelId: true },
  });
  const privIds = privMemberships.map((p) => p.channelId);
  const priv = privIds.length
    ? await prisma.channel.findMany({
        where: {
          workspaceId: wsId,
          type: 'private',
          id: { in: privIds },
        },
        include: { members: { include: { user: true } } },
      })
    : [];

  // dedupe by id (public+private kesişebilir teorik olarak)
  const byId = new Map();
  for (const c of [...pub, ...priv]) byId.set(c.id, c);

  // Kesim noktası kanal başına (kart #119). Son mesaj önizlemesi de buna
  // tabi: yeni üyenin kanal listesinde katılımından önceki bir mesajın
  // önizlemesi görünürse kesim yalnızca görünüşte olur.
  for (const c of byId.values()) {
    c.gecmisBaslangici = await kanalGecmisBaslangici(c, user.id);
  }

  // Her kanal için son mesajı tek raw SQL ile çek (DISTINCT ON kanal başına 1).
  // Sender adını workspace members'tan zaten biliyoruz; ekstra join gereksiz.
  const slugs = Array.from(byId.values()).map((c) => c.slug);
  if (slugs.length) {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON (channel)
        channel, id, text, file_name, sender_id, created_at
      FROM chat_messages
      WHERE workspace_id = ${wsId}
        AND receiver_id IS NULL
        AND is_deleted = false
        AND channel = ANY(${slugs}::text[])
      ORDER BY channel, created_at DESC
    `;
    // Sender slugları toplu çek
    const senderIds = [...new Set(rows.map((r) => r.sender_id).filter(Boolean))];
    const senders = senderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, slug: true, name: true },
        })
      : [];
    const senderById = new Map(senders.map((s) => [s.id, s]));

    for (const r of rows) {
      const c = byId.get(
        // r.channel slug, find channel by slug
        [...byId.values()].find((ch) => ch.slug === r.channel)?.id,
      );
      // En yeni mesaj bile kesimden önceyse görünür mesaj yok: önizleme yok.
      if (c && c.gecmisBaslangici && r.created_at && new Date(r.created_at) < c.gecmisBaslangici) continue;
      if (c) {
        const s = senderById.get(r.sender_id);
        c.lastMessage = {
          id: r.id,
          text: r.text,
          fileName: r.file_name,
          createdAt: r.created_at,
          sender: s ? { slug: s.slug, name: s.name } : null,
        };
      }
    }
  }

  // default önce, sonra created_at asc
  return Array.from(byId.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });
}

/**
 * Sohbet hedefini çözer ve YAZMA kapısını uygular.
 *
 * DM ise: karşı taraf var mı, kendisi değil mi, aynı çalışma alanında mı.
 * Kanal ise: kanal var mı, kullanıcının o kanalda rolü var mı.
 *
 * NİÇİN ORTAK BİR YARDIMCI: 16 Eylül 2026'ya kadar bu kapı yalnızca mesaj
 * gönderme ucunda (`POST /chat/messages`) duruyordu. Dosya yükleme ucu
 * (`POST /chat/upload`) hiçbir kanala ya da alana bağlı değildi ve yalnızca
 * oturum istiyordu. İki uç aynı sohbete yazıyor, dolayısıyla aynı kapıdan
 * geçmeli. Kapıyı ikinci kez YAZMAK yerine tek yere çıkarmanın sebebi
 * CLAUDE.md'deki merdiven: kopya ayrışabilir, ortak yardımcı ayrışamaz.
 * Bu deponun "aynı olgunun birden çok okuyucusu" kusur sınıfı.
 *
 * Dönüş, çağıranın doğrudan yanıta çevirebileceği biçimde:
 *   { ok: true,  workspaceId, receiver, channel, channelRow }
 *
 * `channelRow` yalnızca gerçek bir kanal kaydı varsa dolu (DM'de, 'general'da
 * ve alansız kullanıcıda null). Çağıranlar aynı satırı yeniden sormasın diye
 * döndürülüyor: bahsetme kapısı kanalın özel olup olmadığını, yayın da kimlere
 * gönderileceğini buradan okuyor. Öncesinde aynı satır üç kez sorgulanıyordu.
 *   { ok: false, status, error, message }
 */
export async function resolveChatTarget(user, { to = null, channel = 'general' } = {}) {
  const slug = ((channel || 'general') + '').trim().toLowerCase().slice(0, 80) || 'general';

  if (to) {
    const receiver = await prisma.user.findUnique({ where: { slug: to } });
    if (!receiver) {
      return { ok: false, status: 404, error: 'err_user_not_found', message: 'Kullanıcı bulunamadı' };
    }
    if (receiver.id === user.id) {
      return { ok: false, status: 400, error: 'err_cannot_message_self', message: 'Kendinize mesaj gönderemezsiniz' };
    }
    const workspaceId = await resolveWorkspaceId(user);
    if (!(await usersShareWorkspace(user.id, receiver.id, workspaceId))) {
      return { ok: false, status: 403, error: 'err_user_not_in_team', message: 'Bu kullanıcı aktif takımınızda değil' };
    }
    return { ok: true, workspaceId, receiver, channel: 'dm', channelRow: null };
  }

  const workspaceId = await resolveWorkspaceId(user);
  // Alanı olmayan kullanıcı ve 'general' bilerek kapı dışı: 'general' her
  // alanın örtük kanalı, ayrı bir `channels` kaydı olmayabiliyor.
  let chRow = null;
  if (workspaceId && slug !== 'general') {
    chRow = await prisma.channel.findFirst({
      where: { workspaceId, slug },
      include: { members: true },
    });
    // Var olmayan bir kanala yazılamaz; aksi halde kanal listesinde
    // görünmeyen, üyeliği ve moderasyonu olmayan gizli bir yazışma alanı
    // açılabiliyordu.
    if (!chRow) {
      return { ok: false, status: 404, error: 'err_channel_not_found', message: 'Kanal bulunamadı' };
    }
    if (!(await userChannelRole(chRow, user.id))) {
      return {
        ok: false,
        status: 403,
        error: 'err_channel_send_forbidden',
        message: 'Bu kanala mesaj gönderme yetkiniz yok',
      };
    }
  }
  return { ok: true, workspaceId, receiver: null, channel: slug, channelRow: chRow };
}
