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
import { columnToDict, activityToDict, taskToDict, GOREV_INCLUDE } from './serializers.js';

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
