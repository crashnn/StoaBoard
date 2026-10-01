// Oturumdaki kullanıcının adresi (slug) — TEK OKUYUCU.
//
// KUSUR (30 Eylül 2026, kullanıcı): "Görev oluşturunca iki tane kart açılıyor,
// bu önceden yoktu." Ekran görüntüsündeki iki kart AYNI numarayı (#305)
// taşıyordu, yani sunucu iki kayıt açmamıştı — tek kart listeye iki kez
// girmişti.
//
// Kök sebep burada: sunucunun kullanıcı sözlüğü (`lib/user.js` → `userToDict`)
// adresi **`id` alanında** taşıyor ve `slug` diye bir alan hiç göndermiyor
// (dosyanın başındaki not bunu açıkça yazıyor: "id alanı kullanıcının sayısal
// id'sini değil slug'ını taşır"). `window.CURRENT_USER.slug` bu yüzden HER
// ZAMAN undefined.
//
// Soket yankı süzgeci (`app.jsx` → `benimYankim`) tam da o alanı okuyordu:
//
//     const benimYankim = (actor) => actor && actor === window.CURRENT_USER?.slug;
//
// Sağ taraf undefined olduğu için süzgeç 17 Eylül'de yazıldığı günden beri
// hiçbir zaman true dönmedi — kullanıcı KENDİ eyleminin yankısını da
// uyguluyordu. Çift kart bunun görünür hâli: `routes/tasks.js` `task_created`
// olayını 201 yanıtından ÖNCE yayınlıyor (emit satırı `res.status(201)`
// satırının üstünde), yani yankı iyimser eklemeden önce gelip kartı listeye
// koyuyor, ardından HTTP yanıtı aynı kartı ikinci kez koyuyordu.
//
// Aynı süzgeç `task_updated`, `task_deleted`, `board_columns`,
// `workspace_projects`, `project_labels`, `task_comment`, `note_created` ve
// `note_deleted` olaylarında da kullanılıyor; hepsi aynı sebeple çalışmıyordu.
//
// NİÇİN MODÜL: `chat.jsx` iki yerde `CURRENT_USER?.slug || CURRENT_USER?.id`
// yazarak bu tuzağı sessizce atlatmıştı — yani olgu biliniyordu ama tek
// yerde durmuyordu. CLAUDE.md'nin kuralı: aynı olgunun birden çok okuyucusu
// varsa ayrışır. Adres artık yalnızca buradan okunuyor ve `kimlik.test.js`
// kaynakta `CURRENT_USER`ın `slug` alanının okunmasını yasaklıyor.
export function benSlug() {
  const u = typeof window !== 'undefined' ? window.CURRENT_USER : null;
  return u?.id || null;
}

// Bir soket olayının gövdesindeki `actor` benim mi? Sunucu her pano olayına
// eylemi yapanın adresini koyuyor (`lib/board.js` → `panoYayini`); eylemi
// yapanın ekranı zaten iyimser güncellendiği için kendi yankısı ATLANMALI.
//
// `actor` boşsa false: sunucu adres koyamadıysa olayı uygulamak, atlayıp
// ekranı sessizce eski bırakmaktan iyidir.
export function benimYankim(actor) {
  const ben = benSlug();
  return !!actor && !!ben && actor === ben;
}
