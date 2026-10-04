// Proje bazlı erişim — "bu kullanıcı bu projeyi görebilir mi?"
//
// Kararlar PROJE-ERISIMI.md'de (10 Eylül 2026). Bu dosya o belgenin 4.
// adımının ilk yarısı: ortak kapı ve saf karar mantığı. UÇLARA HENÜZ BAĞLI
// DEĞİL ve bu bilinçli — `project_members` tablosu canlıda oluşmadan kapıyı
// bir uca bağlamak, yönetici olmayan herkesin isteğini 500'e düşürür
// (DEVIR 0-AS, sıralama kısıtı).
//
// VERİTABANINI İÇE AKTARMIYOR. Sorgu yapan tek işlev (`projeErisimiCoz`)
// istemciyi parametre olarak alıyor: çağıran `prisma` geçirir, test sahte
// bir istemci. Yetkilendirme kodun en kritik parçası ve sınanması bir
// veritabanına bağlı olmamalı — `permissions.js` ile aynı karar.

import { hasPermission } from './permissions.js';

/**
 * Bütün projeleri gören izin.
 *
 * Karar "yönetici bütün projeleri görür" diyor, ama bu depoda "yönetici" bir
 * rol ADI değil: roller alan başına düzenlenebilir izin kümeleri ve adı
 * değiştirilebilir. Kural bu yüzden bir izne bağlanmak zorunda.
 *
 * NİÇİN `manage_members`: kararın gerekçesi "zaten üyeleri, rolleri ve alanı
 * yönetiyor; kendini ekleyerek nasılsa girebilirdi". Projeye kimin
 * gireceğine karar veren yetki üye yönetimidir — alana katılma onayı da
 * (proje seçimi oraya gelecek) bu izinle yapılıyor. Görmek ile ekleyebilmek
 * aynı izne bağlı olmalı; ayrışırsa ya gördüğü projeye kimseyi ekleyemeyen
 * ya da göremediği projeye kendini ekleyip giren bir rol doğar.
 *
 * NİÇİN `manage_workspace` DEĞİL: varsayılan "Yönetici" rolünde yok, yani
 * onu seçmek kararı fiilen "yalnızca sahip görür"e çevirirdi.
 * NİÇİN `manage_projects` DEĞİL: proje açıp düzenleme yetkisi, alan
 * genelinde üye seçme yetkisi değil.
 *
 * Varsayılan Yönetici rolünün bu izni taşıması testle kilitli.
 */
export const HER_PROJEYI_GOREN_IZIN = 'manage_members';

/** Üye, proje üyeliğine bakılmaksızın alandaki her projeyi görür mü? */
export function herProjeyiGorur(member) {
  return hasPermission(member, HER_PROJEYI_GOREN_IZIN);
}

/**
 * Saf karar: bu alan üyesi bu projeyi görebilir mi?
 *
 *   member      — çalışma alanı üyeliği (`workspaceRole` dahil) ya da null
 *   project     — en az `{ id, workspaceId }`
 *   projeUyesi  — `project_members` satırı ya da null
 *
 * KAPALI BAŞARISIZLIK, her girdide. Eksik ya da tutarsız bir girdi reddeder,
 * atlanmaz (GUVENLIK.md §4, 4. soru):
 *   - üyelik başka bir alana aitse (yanlış alanın üyeliği geçirilmiş) red —
 *     o alanın sahibi olmak bu alanda hiçbir şey vermiyor;
 *   - satır başka bir kullanıcıya ya da projeye aitse red — çağıran yanlış
 *     satırı geçirmişse bu kimseye erişim açmamalı;
 *   - `projeUyesi` tanımsızsa red — "satıra bakmayı unuttum" ile "satır yok"
 *     aynı sonucu vermeli, ikincisi "satır var" sanılmamalı.
 */
export function projeyiGorebilir({ member, project, projeUyesi } = {}) {
  if (!member || !project) return false;
  if (member.workspaceId !== project.workspaceId) return false;
  if (herProjeyiGorur(member)) return true;
  if (!projeUyesi) return false;
  return projeUyesi.projectId === project.id && projeUyesi.userId === member.userId;
}

/**
 * Liste uçları için Prisma `where` parçası: üyenin görebildiği projeler.
 *
 * Kapı tek projede `projeyiGorebilir`, listede bu — ikisi AYNI kuralın iki
 * biçimi ve ayrışmamaları testle kilitli. Ayrı yazılsalar biri sızar: kenar
 * çubuğu projeyi gizler ama kimlikle açılan pano onu gösterir, ya da tersi.
 *
 * Üyelik yoksa FIRLATIYOR, boş bir koşul döndürmüyor. Boş koşul (`{}`)
 * Prisma'da "her proje" demek — platformdaki bütün projeler. Bugün liste
 * uçları üyelik yoksa erken dönüyor (`if (!member) return res.json([])`);
 * bu işlev o dalı unutan bir çağrıda sessizce her şeyi açmamalı.
 */
export function gorunurProjeKosulu(member) {
  if (!member || member.workspaceId == null || member.userId == null) {
    throw new Error('gorunurProjeKosulu: üyelik olmadan proje koşulu kurulamaz');
  }
  if (herProjeyiGorur(member)) return { workspaceId: member.workspaceId };
  return {
    workspaceId: member.workspaceId,
    members: { some: { userId: member.userId } },
  };
}

// Reddin TEK biçimi. "Proje yok" ile "proje var ama göremiyorsun" buradan
// AYNI nesneyle dönüyor — çağıranın elinde ikisini ayırt edecek bir bilgi
// yok, dolayısıyla farklı yanıt yazamaz.
//
// NİÇİN BURADA: kâhin kuralı (kart #227) bugün altı kopyada YAZIMLA
// korunuyor ve bir tarama testi onları ayrışmasın diye izliyor. Proje kapısı
// yedinci bir "kayıt var ama erişim yok" dalı eklerdi. Onu da yazımla
// korumak yerine kapı ayrımı HİÇ DIŞARI VERMİYOR: kâhini açmak artık bir
// dikkatsizlik değil, bu dosyayı değiştirmeyi gerektiriyor.
const RED = Object.freeze({ erisim: false });

/**
 * Ortak kapı: projeyi ve erişim kararını yükler.
 *
 *   client     — Prisma istemcisi (ya da işlem); çağıran `prisma` geçirir
 *   userId     — oturumdaki kullanıcı (`req.session.userId`, gövdeden ASLA)
 *   projectId  — istekten gelen kimlik; doğrulanmamış kabul edilir
 *
 * Dönüş: `{ erisim: true, project, member }` ya da `{ erisim: false }`.
 * Red tek biçimli (yukarıdaki not). İzin reddi (403) bu kapının işi değil:
 * görebildiği bir projede işlemi yapamamak meşru olarak ayırt edilebilir,
 * çünkü kullanıcı projenin varlığını zaten biliyor — çağıran `member` ile
 * `hasPermission` sorar.
 *
 * Yöneticide `project_members` HİÇ SORGULANMIYOR: karar satıra bağlı değil,
 * ve sorgu atmamak yöneticinin erişimini tablonun durumundan bağımsız kılıyor.
 */
export async function projeErisimiCoz(client, userId, projectId) {
  // Kimlik doğrulanmadan sorguya girmiyor. `parseInt('abc')` NaN üretir ve
  // Prisma NaN'ı reddedip 500 fırlatır — 500 de bir ayrım, ve "geçersiz
  // kimlik" ile "yok" aynı yanıtı vermeli.
  if (!Number.isSafeInteger(userId) || userId <= 0) return RED;
  if (!Number.isSafeInteger(projectId) || projectId <= 0) return RED;

  const project = await client.project.findUnique({ where: { id: projectId } });
  if (!project) return RED;

  // `memberForWorkspace` (lib/workspace.js) ile AYNI sorgu. Oradan çağrılmıyor,
  // çünkü o modül veritabanını içe aktarıyor ve bu dosyanın sınanabilirliği
  // istemcinin dışarıdan gelmesine bağlı.
  const member = await client.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    include: { workspaceRole: true },
  });
  if (!member) return RED;

  const projeUyesi = herProjeyiGorur(member)
    ? null
    : await client.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId } },
    });

  if (!projeyiGorebilir({ member, project, projeUyesi })) return RED;
  return { erisim: true, project, member };
}
