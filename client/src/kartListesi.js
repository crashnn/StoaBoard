// Kart listesine ekleme — KİMLİKLE tekil.
//
// NİÇİN VAR: aynı kart listeye iki ayrı yoldan girebiliyor ve ikisinin SIRASI
// garanti değil:
//
//   1. iyimser ekleme — `API.createTask` 201 yanıtı geldiğinde
//   2. soket yankısı — sunucu `task_created` olayını 201'den ÖNCE yayınlıyor
//
// 30 Eylül 2026'da yankı süzgeci kırıkken (bkz. `ben.js`) ikisi de çalıştı ve
// kart panoda iki kez göründü. Süzgeç düzeltildi, ama düzeltme TEK BAŞINA
// yeterli değil: süzgeç yalnızca kartı KENDİM açtığımda devrede. Başka bir
// sebeple (yeniden bağlanma, geri alma, aynı olayın iki kez gelmesi) aynı
// kart iki kez gelirse liste yine bozulurdu.
//
// CLAUDE.md'nin ölçütü: "bir kusuru kapatırken sor — bunu bir daha yapmayı
// imkânsız kılabilir miyim?" Burada kılınabiliyor. Ekleme artık idempotent:
// kart listede varsa ÜZERİNE YAZILIYOR, ikinci kopya oluşmuyor. Süzgeç bir
// daha kırılsa bile görünen kusur geri gelmez.
//
// KONUM bilerek parametre: pano kolonları diziyi OLDUĞU SIRADA çiziyor
// (kanban görünümünde sıralama yok, `board.jsx` → `visibleTasks.filter`).
// Yeni kart başa, çöpten geri alınan kart sona giriyordu; bu davranış
// korunuyor, yoksa düzeltme kartların yerini oynatırdı.
export function kartiYerlestir(liste, kart, konum = 'bas') {
  const mevcut = Array.isArray(liste) ? liste : [];
  if (!kart || kart.id == null) return mevcut;

  const i = mevcut.findIndex((t) => String(t?.id) === String(kart.id));
  if (i === -1) {
    return konum === 'son' ? [...mevcut, kart] : [kart, ...mevcut];
  }

  // Yerinde birleştir: kartın listedeki sırası korunuyor. Sunucudan gelen
  // gövde kısmi olabilir (yankıda tam kart geliyor ama yeniden kullanılırsa
  // diye), bu yüzden eski alanların üzerine yazılıyor, silinmiyor.
  const kopya = mevcut.slice();
  kopya[i] = { ...kopya[i], ...kart };
  return kopya;
}
