// Çevrimiçi varlığın (presence) YÜZEYE ÇIKAN hâli — tek kaynak.
//
// KUSUR (kart #332, 2 Ekim 2026, çift hesaplı turda KANITLANDI): kimliği
// doğrulanmış herhangi bir kullanıcı, platformda o anda çevrimiçi olan
// HERKESİN slug'ını öğreniyordu — hiçbir çalışma alanını paylaşmasa bile.
// Ölçüm: yalnızca kendisinin üye olduğu bir alanda oturan hesabın
// `/api/bootstrap` yanıtında `online_users: ["claude-code", "claude-code-1",
// "eray-atalay-3"]` göründü; üç slug'ın ikisi o alanın üyesi değildi.
// Slug kozmetik bir değer değil: @bahsetme ve DM aramasında kullanılan
// adres. Yani sızan şey "kim çevrimiçi" değil, "bu platformda hangi hesaplar
// var" bilgisinin bir alt kümesiydi — GUVENLIK.md'deki "var/yok kâhini
// açmamalı" kuralıyla aynı aile (#227).
//
// İKİ OKUYUCU, AYNI KUSUR: `routes/api.js` önyüklemede ve
// `sockets/chat.js` bağlantı anında listeyi ayrı ayrı kuruyordu; ikisi de
// `onlineState.getOnlineIds()` ile bellekteki haritanın tamamını alıp
// süzmeden yüzeye taşıyordu. Kart yalnızca birincisini anlatıyor, çünkü
// soket tarafının `user_online`/`user_offline` YAYINLARI doğru (yalnızca
// `ws_*` odalarına gidiyor). Bağlantıdaki ilk anlık görüntü o yayınlardan
// ayrı bir yoldu ve kapsamsızdı.
//
// NİÇİN BURADA, NİÇİN SIRA BU: ölçüt "önce kapsam, sonra varlık". Adaylar
// kişinin ORTAK ALAN paylaştığı üyelerden geliyor, çevrimiçilik ancak o
// küme içinde soruluyor. Ters sıra (önce çevrimiçi olanlar, sonra süz)
// kapsamsız bir "kim çevrimiçi" sorusu gerektirirdi; `onlineState`'teki o
// erişimci (`getOnlineIds`) bu yüzden silindi — kusuru bir daha yapmak için
// önce onu geri yazmak gerekiyor (CLAUDE.md, merdivenin üst basamağı).
//
// KAPSAM KARARI — "aktif alan" DEĞİL, "ortak alan": DM kapısında 1 Ekim'de
// alınan kararın aynısı (`ortakAlanId`, DEVIR 0-AJ). Soket zaten kişinin
// BÜTÜN alanlarının odalarına katılıyor, yani `user_online` olayları ortak
// alanlardan geliyor. İlk anlık görüntüyü aktif alana daraltmak, akan
// olaylardan daha dar bir küme verir ve iki okuyucu yine ayrışırdı.

import { prisma } from '../db.js';
import * as onlineState from './onlineState.js';

/**
 * SAF: aday kullanıcılar + varlık okuyucusu → yüzeye çıkacak liste.
 *
 * Aynı kişi iki ortak alandan iki kez gelebilir; liste kimliğe göre tekilleniyor.
 *
 * @param {Array<{id:number, slug:string}>} adaylar Kapsamı geçmiş kullanıcılar.
 * @param {{isOnline:Function, getStatus:Function}} varlik Bellek-içi durum.
 */
export function onlineListesiKur(adaylar, varlik) {
  const gorulen = new Set();
  const liste = [];
  for (const u of adaylar || []) {
    if (!u || !u.slug || gorulen.has(u.id)) continue;
    if (!varlik.isOnline(u.id)) continue;
    gorulen.add(u.id);
    liste.push({ slug: u.slug, status: varlik.getStatus(u.id) });
  }
  return liste;
}

/**
 * Kişinin GÖRMEYE HAKKI OLAN çevrimiçi kişiler: en az bir çalışma alanını
 * paylaştığı üyeler. Kendisi de listede (kendi alanlarının üyesi).
 *
 * @param {number} userId
 * @returns {Promise<Array<{slug:string, status:string}>>}
 */
export async function gorunurOnlineKisiler(userId) {
  if (!userId) return [];
  const satirlar = await prisma.workspaceMember.findMany({
    where: { workspace: { members: { some: { userId } } } },
    select: { user: { select: { id: true, slug: true } } },
  });
  return onlineListesiKur(
    satirlar.map((r) => r.user),
    onlineState,
  );
}
