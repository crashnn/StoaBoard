// Pano olaylarının yayını — kart, kolon ve yorum değişiklikleri karşı tarafa.
//
// ── Niçin var ─────────────────────────────────────────────────────────────
//
// 17 Eylül 2026'da ölçüldü (kart #235): `routes/projects.js` ve
// `routes/tasks.js` TEK BİR soket olayı yayınlamıyordu ve istemci de hiçbir
// pano olayı dinlemiyordu. Yani kart eklemek, taşımak, kolon açmak, yorum
// yazmak — hiçbiri başka kullanıcıya canlı gitmiyordu. Sohbet gidiyordu,
// çünkü onun kendi soket yolu vardı.
//
// Kullanıcı bunu canlıda buldu ve cümlesi teşhisin kendisiydi: "sohbet anlık
// gelirken kolon, comment F5 istiyor GÖRÜNMEK için." Kart o sırada bunu
// "bildirim gelmiyor" diye kaydetmişti; ölçüm, eksik olanın bildirim değil
// nesnenin kendisi olduğunu gösterdi.
//
// ── Oda seçimi ────────────────────────────────────────────────────────────
//
// Pano olayları `ws_<workspaceId>` odasına gidiyor. Soket bağlanırken bu odaya
// zaten katılıyor (`sockets/chat.js`), yani yeni bir üyelik tesisatı
// gerekmiyor. Alan üyeliği bugün panoyu görme hakkıyla aynı şey: bir üye
// çalışma alanındaki her şeyi görüyor (CLAUDE.md, "proje bazlı üyelik" hâlâ
// açık). PROJE BAZLI ÜYELİK GELDİĞİNDE BURASI DARALTILMALI — o gün bu yorum
// bir borç senedidir: oda `ws_` değil proje bazlı olmalı, yoksa gerçek zamanlı
// yol, REST'in kapattığı kapıyı açık bırakır.
//
// ── Yankı elemesi ─────────────────────────────────────────────────────────
//
// Her gövde `actor` taşıyor: eylemi yapan kişinin slug'ı. İstemci kendi
// yaptığı işin yankısını yok sayıyor, çünkü kendi ekranını zaten iyimser
// güncellemişti. Bu kalıp notlardan geliyor (`emitNoteEvent`), yeni değil.
//
// ── Başarısızlık ──────────────────────────────────────────────────────────
//
// Yayın `emitSafely` üzerinden geçiyor: gönderilememesi isteği düşürmüyor ama
// sessizce de yutulmuyor, günlüğe yazılıyor. Gerekçesi `lib/emit.js`in
// başında. `workspaceId` yokluğu ayrıca raporlanıyor — o durumda olay hiçbir
// odaya gitmez ve sebebi "io yok"tan farklıdır.

import { prisma } from '../db.js';
import { emitSafely } from './emit.js';
import {
  columnToDict, activityToDict, taskToDict, labelToDictValue, workspaceRoleToDict, GOREV_INCLUDE,
} from './serializers.js';
import { kenarCubuguProjeleri } from './projects.js';
import { memberToDict } from './workspace.js';

/**
 * Yeni hareket kaydını alanın odasına yayınlar (#259).
 *
 * KUSUR (18 Eylül 2026, sade tur 25): "A ile kart taşıyınca takım
 * hareketleri değişmedi … F5 attıktan sonra geldi." Ana Sayfa'nın hareket
 * listesi yalnızca önyüklemeden geliyordu, hiçbir olayla tazelenmiyordu.
 *
 * Kartın kendi olayından (task_updated) türetilmiyor: hareket metnini
 * sunucu kuruyor (hangi kolona, hangi başlıkla) ve kaydın kimliği yalnızca
 * burada var. İstemci aynı cümleyi ikinci kez kursaydı iki okuyucu olurdu.
 *
 * Çağıran bunu işlem KESİNLEŞTİKTEN SONRA yapar: içeride yayınlanan kayıt,
 * işlem geri alınırsa var olmayan bir hareket olarak ekranda kalırdı.
 * `project_id` gövdede: istemci yalnızca aktif projenin listesine ekliyor.
 */
export function etkinlikYayini(io, workspaceId, satir, actorSlug) {
  if (!satir) return false;
  return panoYayini(
    io,
    'activity_new',
    workspaceId,
    { project_id: String(satir.projectId), activity: activityToDict(satir) },
    actorSlug,
  );
}

/**
 * Pano olayını çalışma alanının odasına yayınlar.
 *
 * @param io           Socket.IO sunucusu
 * @param olay         Olay adı (`task_created`, `board_columns`, …)
 * @param workspaceId  Hedef alan
 * @param govde        Olay gövdesi; `actor` buraya eklenir
 * @param actorSlug    Eylemi yapan — istemci kendi yankısını bununla eliyor
 * @returns {boolean}  Yayın yapıldıysa true
 */
export function panoYayini(io, olay, workspaceId, govde, actorSlug) {
  if (!workspaceId) {
    // "io yok"tan ayrı bir arıza: sunucu yayın yapabiliyor ama bu isteğin
    // hedefi belirsiz. Sessiz geçilirse olay hiçbir yere gitmez ve belirti
    // "gerçek zamanlı bazen çalışmıyor" olur — teşhisi en zor sınıf.
    console.warn('[pano] workspaceId yok, olay gönderilemedi:', olay);
    return false;
  }
  return emitSafely(io, olay, (s) => {
    s.to(`ws_${workspaceId}`).emit(olay, { ...govde, actor: actorSlug || null });
  });
}

/**
 * Projenin kolon listesini bütün hâlinde yayınlar.
 *
 * TEK KOLONU DEĞİL LİSTEYİ gönderiyor, bilinçli olarak. Kolon işlemleri
 * (ekleme, düzenleme, silme, sıralama) listenin sırasını ve içeriğini farklı
 * biçimlerde değiştiriyor; istemcide dört ayrı birleştirme mantığı yazmak
 * dört ayrı kusur yeri demek. Liste küçük (proje başına birkaç kolon), bu yüzden
 * bütünü göndermenin bedeli yok ve istemci tarafı tek satıra iniyor.
 *
 * `project_id` gövdede: istemci kolon listesini ancak AKTİF proje için
 * uyguluyor. Başka projedeki bir kolon değişikliği aktif panonun kolonlarını
 * ezerse ekran sessizce yanlış hâle gelir.
 */
export async function kolonlariYayinla(io, project, actorSlug) {
  if (!project) return false;
  const kolonlar = await prisma.boardColumn.findMany({
    where: { projectId: project.id },
    orderBy: { position: 'asc' },
  });
  return panoYayini(
    io,
    'board_columns',
    project.workspaceId,
    { project_id: String(project.id), columns: kolonlar.map(columnToDict) },
    actorSlug,
  );
}

/**
 * Tek kartı yeniden yükleyip `task_updated` olarak yayınlar (kart #271).
 *
 * Kartın KENDİSİNE dokunmayan ama kartta GÖRÜNEN şeyleri değiştiren uçlar
 * için: alt görev (ilerleme çubuğu, "2/5"), ek (ataç sayacı), yorum silme
 * (yorum sayacı). Bunlar 19 Eylül'e kadar hiç yayınlanmıyordu; başka hesap
 * F5 basana kadar eski sayacı görüyordu — #235/#259 ile aynı sınıf.
 *
 * Kart baştan yükleniyor, çünkü çağıran uç elinde yalnızca alt kaydı
 * (subtask, attachment) tutuyor; dict'i oradan türetmek ikinci bir okuyucu
 * olurdu. Kart çöpteyse ya da yoksa yayın yok (`false`).
 */
export async function gorevYayini(io, taskId, actorSlug) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { ...GOREV_INCLUDE, project: { select: { workspaceId: true } } },
  });
  if (!task || task.deletedAt) return false;
  return panoYayini(io, 'task_updated', task.project?.workspaceId, { task: taskToDict(task) }, actorSlug);
}

/**
 * Alanın proje listesini bütün hâlinde yayınlar (#272). Kolon listesiyle
 * aynı karar: ekleme/adlandırma/silme için istemcide üç birleştirme dalı
 * yerine tek uygulama. Liste alan başına birkaç proje, bedeli yok.
 * Bootstrap'ın kenar çubuğuna verdiği sözlüklerin AYNISI (açık sayımıyla);
 * ikinci bir şekil yok.
 */
export async function projelerYayini(io, workspaceId, actorSlug) {
  if (!workspaceId) return false;
  const projects = await kenarCubuguProjeleri(workspaceId);
  return panoYayini(io, 'workspace_projects', workspaceId, { projects }, actorSlug);
}

/**
 * Projenin etiket sözlüğünü bütün hâlinde yayınlar (#272). `project_id`
 * gövdede: istemci yalnızca AKTİF projenin etiketlerini uyguluyor, kolonlar
 * gibi. Şekil bootstrap'ın `labels` alanıyla aynı (slug → değer).
 */
export async function etiketlerYayini(io, project, actorSlug) {
  if (!project) return false;
  const labels = await prisma.label.findMany({ where: { projectId: project.id } });
  const labelsMap = {};
  for (const l of labels) labelsMap[l.slug] = labelToDictValue(l);
  return panoYayini(
    io,
    'project_labels',
    project.workspaceId,
    { project_id: String(project.id), labels: labelsMap },
    actorSlug,
  );
}

// ── Alan düzeyi yayınlar (#273) ───────────────────────────────────────────
//
// Alan adı/logo, roller ve profil 19 Eylül'e kadar hiç yayınlanmıyordu;
// başkasının üst çubuğu, üye listesi ve avatarları F5'e kadar eski kalıyordu.
// Üçü de bootstrap'ın verdiği ŞEKLİN aynısını gönderiyor; istemcide yeni bir
// şekil yok, olan yerine yazılıyor.

/** Alanın adı/logosu değişti — yalnızca herkese ortak alanlar (izin yok). */
export async function alanYayini(io, workspaceId, actorSlug) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return false;
  return panoYayini(io, 'workspace_updated', workspaceId, {
    workspace: { id: String(ws.id), name: ws.name, logo_url: ws.logoUrl || null },
  }, actorSlug);
}

/**
 * Rol listesi değişti. Üye listesi de gidiyor: üyenin rol adı/rengi/izinleri
 * rolden türetiliyor (memberToDict), rol silinince üyeler varsayılana
 * düşüyor — istemcide "hangi üye etkilendi" hesabı ikinci bir okuyucu olurdu.
 */
export async function rollerYayini(io, workspaceId, actorSlug) {
  const [roles, uyeler] = await Promise.all([
    prisma.workspaceRole.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }),
    prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: true, workspaceRole: true } }),
  ]);
  return panoYayini(io, 'workspace_roles', workspaceId, {
    roles: roles.map(workspaceRoleToDict),
    members: uyeler.map(memberToDict).filter(Boolean),
  }, actorSlug);
}

/**
 * Kullanıcının profili (ad, avatar, unvan) değişti — üyesi olduğu HER alana,
 * o alandaki üye sözlüğüyle (rol alanları alana göre değişiyor). Yankı
 * elenmiyor: kendi ekranı da bu yoldan güncellensin, iki yol olmasın.
 */
export async function uyeYayini(io, userId) {
  const uyelikler = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { user: true, workspaceRole: true },
  });
  let n = 0;
  for (const wm of uyelikler) {
    const d = memberToDict(wm);
    if (d && panoYayini(io, 'member_updated', wm.workspaceId, { member: d }, null)) n += 1;
  }
  return n > 0;
}
