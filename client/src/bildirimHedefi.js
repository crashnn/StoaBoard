// Bildirime basınca nereye gidilir — tür → hedef tablosu, TEK yerde (#258).
//
// KUSUR (18 Eylül 2026, kullanıcı): "bildirime basınca A'da genel sohbete
// attı beni. Bildirimler ne ile ilgili ise oraya route etmeli."
//
// Tıklama işleyicisi bir `if` merdiveniydi ve hedefi yazılmamış her tür en
// alttaki yedeğe düşüyordu: "göndereni varsa ona DM aç". Katılma isteğinin
// göndereni henüz üye olmayan kişi; `openChat` üye olmayanla DM açamayınca
// sohbet ekranının genel kanalına düşüyordu. Aynı yoldan column_added da
// (kolonu açana DM) yanlış yere gidiyordu.
//
// Artık tablo: her tür kendi hedefini yazar, gereken veri eksikse null döner
// ve null TIKLANAMAZ demektir — bilinmeyen tür sessizce sohbete gitmez.
// Liste satırının imleci ve oku da buradan okunuyor; eskiden ayrı bir tür
// listesiydi (aynı olgunun ikinci okuyucusu) ve join_request'i tıklanabilir
// göstermiyor ama tıklayınca yine götürüyordu.
//
// Sunucunun ürettiği tür kümesi ile bu tablo testte İKİ YÖNLÜ eşleşiyor
// (bildirimHedefi.test.js): yeni bir bildirim türü hedef yazmadan eklenemez.

/** Bildirim metnindeki JSON parametreleri; eski düz metin kayıtlarda {}. */
function parametreler(n) {
  try {
    const d = JSON.parse(n?.text || '');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

const kart = (n) => (n.task_id ? { tur: 'kart', kart: n.task_id } : null);
const dm = (n) => (n.sender_slug ? { tur: 'dm', kisi: n.sender_slug, mesaj: n.message_id || null } : null);
const kanal = (n) => (n.chat_channel ? { tur: 'kanal', kanal: n.chat_channel, mesaj: n.message_id || null } : null);

export const HEDEFLER = {
  dm_received: dm,
  // Kanal mesajı; kanalı yoksa gönderenle konuşma.
  message: (n) => kanal(n) || dm(n),
  // Kart yorumunda bahsetme karta, sohbette bahsetme mesajın olduğu yere.
  mention: (n) => kart(n) || kanal(n) || dm(n),
  task_assigned: kart,
  comment_added: kart,
  channel_added: kanal,
  // Kolon bir projeye ait. Parametresiz eski kayıtlar aktif projenin panosuna.
  column_added: (n) => {
    const p = parametreler(n).project;
    return { tur: 'pano', proje: p != null && p !== '' ? String(p) : null };
  },
  // Bekleyen istekler Ayarlar'da; bildirim yalnızca alan sahibine gidiyor.
  join_request: () => ({ tur: 'ayarlar', bolum: 'join_requests' }),
  // Katılınan alana geç. Alan kimliği yoksa gidecek yer yok.
  join_approved: (n) => (n.workspace_id ? { tur: 'alan', alan: String(n.workspace_id) } : null),
  // Yalnızca bilgi: reddedilen alanda gösterilecek bir şey yok.
  join_rejected: () => null,
};

/**
 * Bildirimin hedefi ya da null (tıklanamaz). `tur` çağıranın çözdüğü tür —
 * yapısal JSON yoksa eski metinden tahmin edilmiş olabilir ('info' dahil).
 *
 * Tabloda olmayan tür (eski düz metin kayıtlar): kartı varsa kart, kanalı
 * varsa kanal. Göndereni tek başına hedef SAYILMIYOR — kusurun kendisi o
 * yedekti.
 */
export function bildirimHedefi(n, tur) {
  if (!n) return null;
  if (Object.hasOwn(HEDEFLER, tur)) return HEDEFLER[tur](n);
  return kart(n) || kanal(n);
}
