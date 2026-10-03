/**
 * Klavye kısayollarının TEK KAYNAĞI.
 *
 * NİÇİN VAR — üç kusur bir aradaydı (3 Ekim 2026):
 *
 * 1. ÖZELLEŞTİRME HİÇBİR ŞEY YAPMIYORDU. Ayarlar ekranı `stoa.shortcuts`e
 *    yazıyor, "kaydedildi" gösteriyor ve o anahtarı KİMSE okumuyordu;
 *    `app.jsx`teki işleyici tuşları gömülü tutuyordu. Kullanıcı "Yeni
 *    görev"i T yapıyor, T hiçbir şey yapmıyor, N hâlâ çalışıyor. Sessizce
 *    hiçbir şey yapmayan bir ayar, olmayan bir ayardan kötüdür: kullanıcı
 *    onu denemiş ve uygulamanın bozuk olduğunu düşünmüştür.
 *
 * 2. LİSTE GERÇEKLE AYRIŞMIŞTI, İKİ YÖNDE. Ayarlar `G,H`yi "Ana sayfa" diye
 *    yazıyordu ama işleyicinin haritasında `h` yoktu (panel `G,D`). `/`
 *    (arama odakla) da yazılıydı ve hiçbir yerde işleyicisi yoktu. Tersi de
 *    doğruydu: `G+N`, `G+R`, `G+T`, `G+D` gerçekten çalışıyor ama listede
 *    yoktu, yani kimse keşfedemiyordu.
 *
 * 3. EKRANDA KISAYOL YARDIMI YOKTU. Ayarlarda bir sayfa var ama akış
 *    içinde `?` ile bakılacak bir yer yok.
 *
 * Bu, CLAUDE.md'deki merdivenin dibidir: kural BELGEDE yazılıydı ve kod
 * başka şey yapıyordu. Çözüm belgeyi düzeltmek değil, belgeyi KALDIRMAK —
 * liste artık doğrulanan şeyin kendisi. İşleyici, ayarlar ekranı ve `?`
 * yardımı üçü de buradan besleniyor; biri ayrışamaz çünkü ikinci bir liste
 * yok. `kisayol.test.js` her girdinin gerçekten bir işi olduğunu ve
 * işleyicinin başka tuş gömmediğini kilitliyor.
 */

/**
 * `tur` ne yapılacağını söylüyor ve işleyici buna göre davranıyor:
 *   'palet'  — komut paletini aç
 *   'kart'   — yeni görev kipi
 *   'arama'  — pano arama kutusuna odaklan
 *   'gnav'   — G dizisinin ikinci tuşu; `hedef` görünüm, `altGorunum` varsa yazılır
 *   'kacis'  — bütün panelleri kapat
 *   'bilgi'  — YALNIZCA referans; işleyicisi başka yerde (sohbet, kart odağı)
 *
 * `ozelleStirilebilir: false` olanlar ayarlar ekranında salt okunur
 * gösteriliyor. Gerekçe: Esc evrensel bir kaçış ve değiştirilmesi
 * kullanıcıyı kilitler; sohbetteki ⏎ ve kart oklarının işleyicileri kendi
 * bileşenlerinde ve onları buraya bağlamak bu turda kapsam dışı. Ama
 * LİSTEDE DURUYORLAR, çünkü asıl sorun keşfedilememekti.
 */
export const KISAYOLLAR = [
  { id: 'cmd_palette', tur: 'palet', tuslar: ['Ctrl', 'K'],
    anahtar: 'set_sct_cmd_palette', yedek: 'Komut paleti aç' },
  { id: 'new_task', tur: 'kart', tuslar: ['N'],
    anahtar: 'set_sct_new_task', yedek: 'Yeni görev' },
  { id: 'search', tur: 'arama', tuslar: ['/'],
    anahtar: 'set_sct_search', yedek: 'Arama odakla' },

  { id: 'go_dashboard', tur: 'gnav', tuslar: ['G', 'D'], hedef: 'dashboard',
    anahtar: 'set_sct_home', yedek: 'Ana sayfa' },
  { id: 'go_board', tur: 'gnav', tuslar: ['G', 'B'], hedef: 'board', altGorunum: 'kanban',
    anahtar: 'set_sct_board', yedek: 'Pano (Kanban)' },
  { id: 'go_list', tur: 'gnav', tuslar: ['G', 'L'], hedef: 'board', altGorunum: 'list',
    anahtar: 'set_sct_list', yedek: 'Liste görünümü' },
  { id: 'go_calendar', tur: 'gnav', tuslar: ['G', 'C'], hedef: 'calendar',
    anahtar: 'set_sct_calendar', yedek: 'Takvim' },
  { id: 'go_chat', tur: 'gnav', tuslar: ['G', 'M'], hedef: 'chat',
    anahtar: 'set_sct_chat', yedek: 'Sohbet' },
  { id: 'go_notes', tur: 'gnav', tuslar: ['G', 'N'], hedef: 'notes',
    anahtar: 'set_sct_notes', yedek: 'Notlar' },
  { id: 'go_reports', tur: 'gnav', tuslar: ['G', 'R'], hedef: 'reports',
    anahtar: 'set_sct_reports', yedek: 'Raporlar' },
  { id: 'go_trash', tur: 'gnav', tuslar: ['G', 'T'], hedef: 'trash',
    anahtar: 'set_sct_trash', yedek: 'Çöp kutusu' },
  { id: 'go_settings', tur: 'gnav', tuslar: ['G', 'S'], hedef: 'settings',
    anahtar: 'set_sct_settings', yedek: 'Ayarlar' },

  { id: 'close_panels', tur: 'kacis', tuslar: ['Esc'], ozelleStirilebilir: false,
    anahtar: 'set_sct_close_panels', yedek: 'Tüm panelleri kapat' },

  // Referans — işleyicileri kendi bileşenlerinde.
  { id: 'card_open', tur: 'bilgi', tuslar: ['↵'], ozelleStirilebilir: false,
    anahtar: 'set_sct_card_open', yedek: 'Odaklı kartı aç' },
  { id: 'card_move', tur: 'bilgi', tuslar: ['⇧', '←', '→'], ozelleStirilebilir: false,
    anahtar: 'set_sct_card_move', yedek: 'Odaklı kartı kolon değiştir' },
  { id: 'card_nav', tur: 'bilgi', tuslar: ['←', '→', '↑', '↓'], ozelleStirilebilir: false,
    anahtar: 'set_sct_card_nav', yedek: 'Kartlar arasında gezin' },
  { id: 'send_msg', tur: 'bilgi', tuslar: ['↵'], ozelleStirilebilir: false,
    anahtar: 'set_sct_send', yedek: 'Mesaj gönder' },
  { id: 'newline', tur: 'bilgi', tuslar: ['⇧', '↵'], ozelleStirilebilir: false,
    anahtar: 'set_sct_newline', yedek: 'Yeni satır (mesajda)' },
];

/** `?` yardımında ve ayarlarda gruplama — düz bir liste yirmi satır olurdu. */
export const BOLUMLER = [
  { id: 'genel', anahtar: 'sct_group_general', yedek: 'Genel',
    idler: ['cmd_palette', 'new_task', 'search', 'close_panels'] },
  { id: 'gezinme', anahtar: 'sct_group_nav', yedek: 'Gezinme (G ardından)',
    idler: ['go_dashboard', 'go_board', 'go_list', 'go_calendar', 'go_chat',
      'go_notes', 'go_reports', 'go_trash', 'go_settings'] },
  { id: 'kart', anahtar: 'sct_group_card', yedek: 'Pano kartı',
    idler: ['card_open', 'card_nav', 'card_move'] },
  { id: 'sohbet', anahtar: 'sct_group_chat', yedek: 'Sohbet',
    idler: ['send_msg', 'newline'] },
];

/**
 * Özelleştirilmiş atamaları varsayılanla birleştirir.
 *
 * ÖZELLEŞTİRİLEMEZ girdinin özel ataması YOK SAYILIYOR. Depodaki bayat bir
 * `stoa.shortcuts` (ya da elle yazılmış bir değer) Esc'i başka bir tuşa
 * alabilirdi ve kullanıcı açık bir panelden çıkamazdı.
 */
export function tusAtamalari(ozel) {
  const o = (ozel && typeof ozel === 'object') ? ozel : {};
  const d = {};
  for (const k of KISAYOLLAR) {
    const degistirilebilir = k.ozelleStirilebilir !== false;
    const secilen = degistirilebilir && Array.isArray(o[k.id]) && o[k.id].length > 0
      ? o[k.id]
      : k.tuslar;
    d[k.id] = secilen;
  }
  return d;
}

/**
 * Değiştirici tuşların TEK SÖZCÜK DAĞARCIĞI.
 *
 * NİÇİN DIŞA AÇIK: ayarlardaki kayıt arayüzü kendi sözcüklerini kullanıyordu
 * (`'⌘'`, `'⌥'`, `'⇧'`) ve eşleştirici `'Ctrl'` arıyordu. Yani kullanıcı
 * Ctrl+K kaydettiğinde depoya `['⌘','K']` yazılıyor, eşleştirici Ctrl
 * gerekliliğini GÖRMÜYOR ve kısayol düz K oluyordu — Ctrl'süz her K paleti
 * açardı. İki sözcük dağarcığı, bu turda kapatılan "iki liste" kusurunun
 * tuş düzeyindeki hâli. Kaydedici artık buradan okuyor.
 */
export const DEGISTIRICILER = { ctrl: 'Ctrl', alt: 'Alt', shift: '⇧' };

/** Tek tuşu karşılaştırılabilir biçime indirger: 'Ctrl', 'K', '/', 'Esc'… */
function tusKatla(t) {
  const s = String(t ?? '');
  if (s === '⌘') return DEGISTIRICILER.ctrl;      // kayıt arayüzünün eski sözcüğü
  if (s === '⌥') return DEGISTIRICILER.alt;
  if (s === '⇧') return DEGISTIRICILER.shift;
  if (s.length === 1) return s.toUpperCase();
  const alt = s.toLowerCase();
  if (alt === 'control' || alt === 'ctrl') return DEGISTIRICILER.ctrl;
  if (alt === 'meta' || alt === 'cmd') return DEGISTIRICILER.ctrl;   // Mac'te aynı yuva
  if (alt === 'alt' || alt === 'option') return DEGISTIRICILER.alt;
  if (alt === 'shift') return DEGISTIRICILER.shift;
  if (alt === 'escape' || alt === 'esc') return 'Esc';
  if (alt === 'enter') return '↵';
  return s;
}

/**
 * Olaya hangi kısayol uyuyor?
 *
 * `gBekliyor` true ise G dizisinin İKİNCİ tuşundayız ve yalnızca `gnav`
 * girdileri aranıyor. Aksi hâlde tek tuşlu (ya da Ctrl'lü) girdiler.
 *
 * NİÇİN SAF: eşleşme kuralı işleyicinin içinde yazılıydı ve test edilemiyordu.
 * Burada olay nesnesinin yalnızca üç alanı okunuyor, yani düz bir nesneyle
 * de çağrılabiliyor.
 *
 * @returns {string|null} kısayol kimliği
 */
export function eslesenKisayol({ key, ctrlKey, metaKey, altKey }, { gBekliyor = false, atamalar } = {}) {
  const a = atamalar || tusAtamalari(null);
  const basilan = tusKatla(key);
  const ctrl = !!(ctrlKey || metaKey);
  const alt = !!altKey;
  const MOD = new Set(Object.values(DEGISTIRICILER));

  for (const k of KISAYOLLAR) {
    const tuslar = a[k.id] || k.tuslar;
    if (k.tur === 'bilgi') continue;          // işleyicisi başka yerde

    if (k.tur === 'gnav') {
      if (!gBekliyor) continue;
      // Dizinin ilk tuşu G, ikincisi anlamlı olan.
      if (tusKatla(tuslar[0]) !== 'G') continue;
      if (tusKatla(tuslar[1]) === basilan) return k.id;
      continue;
    }

    if (gBekliyor) continue;                   // dizi içindeyken tek tuş yok
    const katlanan = tuslar.map(tusKatla);
    // DEĞİŞTİRİCİLER İKİ YÖNDE eşleşmeli: gerekliyse basılı olmalı,
    // gerekli değilse basılı OLMAMALI. Tek yön kontrol edilse Ctrl+N de
    // "yeni görev" sayılır ve tarayıcının kendi kısayolunu çalardı.
    if (katlanan.includes(DEGISTIRICILER.ctrl) !== ctrl) continue;
    if (katlanan.includes(DEGISTIRICILER.alt) !== alt) continue;
    const anaTus = katlanan.filter((t) => !MOD.has(t));
    if (anaTus.length === 1 && anaTus[0] === basilan) return k.id;
  }
  return null;
}

/**
 * G dizisi bu tuşla BAŞLIYOR mu?
 *
 * Harf sabit değil, atamalardan okunuyor: kullanıcı gezinme kısayolunu
 * `['X','B']` yaptıysa dizi X ile başlamalı. Sabit bir `'g'` karşılaştırması
 * özelleştirmeyi yarı çalışır hâlde bırakırdı — ikinci tuş değişir, ilki
 * değişmezdi.
 */
export function diziBaslatiyorMu({ key, ctrlKey, metaKey }, atamalar) {
  if (ctrlKey || metaKey) return false;
  const a = atamalar || tusAtamalari(null);
  const basilan = tusKatla(key);
  return KISAYOLLAR.some((k) => k.tur === 'gnav'
    && tusKatla((a[k.id] || k.tuslar)[0]) === basilan);
}

/** Kısayolu bulan yardımcı — çağrı yerleri `find` tekrarlamasın. */
export function kisayol(id) {
  return KISAYOLLAR.find((k) => k.id === id) || null;
}
