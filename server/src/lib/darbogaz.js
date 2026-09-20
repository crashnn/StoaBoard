// Darboğaz tablosu ve funnel — saf (kart #146, "kolon bazlı darboğaz").
//
// Akış raporundaki "Kolonlarda bekleme" tablosu yalnızca KAPANMIŞ beklemeyi
// ölçüyordu: bir kartın o kolonda geçirdiği süre, ancak kart oradan
// çıktıysa hesaba giriyordu. Tam da darboğazın tanımı olan durum — kartların
// bir kolonda birikip ÇIKMAMASI — tabloda sıfır bekleme olarak görünüyordu.
// Bu dosya iki ölçüyü yan yana koyuyor: kapanmış bekleme (geçiş kaydından)
// ve şu an bekleyen kartların birikmiş süresi (kartın son geçişinden bugüne).
//
// Darboğaz = aralıkta kart-zamanının en çok biriktiği kolon: kapanmış
// bekleme toplamı + şu an bekleyenlerin birikmiş süresi. Bitiş kolonu yarışa
// girmez (orada beklemek iş değil, bitmiş iş). "Hedef gün" ölçütü YOK:
// kolon başına hedef bir ayar ister (şema), o karar #198/#237 ile bekliyor;
// hedefi uydurmak yerine payı gösteriyoruz.
//
// Etiket = kolonun Türkçe adı ya da adı — geçiş kaydı toTitle'ı öyle yazıyor
// (recordTransition). Birden fazla proje seçiliyse aynı adlı kolonlar tek
// satırda toplanır; dönem raporunun by_column'u ile aynı yaklaşım.

const SAAT_MS = 60 * 60 * 1000;

function ortanca(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const yuvarla = (n) => Math.round(n * 10) / 10;

/** Kolonun raporda görünen adı; geçiş kaydındaki toTitle ile aynı kural. */
export const kolonEtiketi = (c) => (c.titleTr || c.title || '—');

/**
 * @param {object} p
 * @param {Array}  p.columns      BoardColumn satırları: { title, titleTr, position, isDone }
 * @param {Array}  p.transitions  Aralıktaki geçişler, (taskId, at) sırasında:
 *                                { taskId, toTitle, toIsDone, at }
 * @param {Array}  p.acikKartlar  Şu an açık kartlar: { taskId, label, since }
 *                                label = bulunduğu kolonun etiketi, since =
 *                                son geçişinin anı (yoksa açılış anı)
 * @param {Date}   p.from         rapor aralığı; bekleyen kartın süresi bu
 * @param {Date}   p.to           pencereye KIRPILIR — geçmiş bir dönemin
 *                                raporuna bugünün birikimi karışmasın
 * @param {Date}   p.now
 * @returns {{ rows: Array, total_hours: number, bottleneck: string|null }}
 */
export function darbogazTablosu({ columns = [], transitions = [], acikKartlar = [], from = null, to = null, now = new Date() }) {
  // Satırlar pano sırasında; birden çok projede aynı ad tek satır, ilk
  // görüldüğü konumda. Bitiş işareti: o adla işaretli EN AZ bir kolon varsa.
  const satirlar = new Map(); // label → satır
  const sirali = [...columns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const c of sirali) {
    const label = kolonEtiketi(c);
    if (!satirlar.has(label)) {
      satirlar.set(label, { label, is_done: c.isDone === true, girenler: new Set(), kapanmis: [], bekleyen: [] });
    } else if (c.isDone === true) {
      satirlar.get(label).is_done = true;
    }
  }
  // Geçiş kaydında olup panoda artık olmayan kolon (silinmiş): satır sona.
  const satir = (label) => {
    if (!satirlar.has(label)) satirlar.set(label, { label, is_done: false, girenler: new Set(), kapanmis: [], bekleyen: [] });
    return satirlar.get(label);
  };

  // Funnel: kolona giren ayrı kart sayısı. Kapanmış bekleme: aynı kartın
  // ardışık iki geçişi arasındaki süre, öncekinin hedef kolonuna yazılır.
  let onceki = null;
  for (const t of transitions) {
    const label = t.toTitle || '—';
    satir(label).girenler.add(t.taskId);
    if (onceki && onceki.taskId === t.taskId && onceki.toTitle) {
      const saat = (new Date(t.at) - new Date(onceki.at)) / SAAT_MS;
      if (saat >= 0) satir(onceki.toTitle).kapanmis.push(saat);
    }
    onceki = t;
  }

  // Şu an bekleyenler: kartın bulunduğu kolonda son geçişinden bugüne — ama
  // yalnızca rapor penceresine düşen kısmı. Bugün açılan kart geçen ayın
  // raporunda bekleyen sayılmaz; iki ay önce takılan kartın yalnızca bu
  // aydaki bekleyişi bu ayın raporuna girer.
  const pencereSonu = to && to < now ? to : now;
  for (const k of acikKartlar) {
    if (!k.label) continue;
    const since = new Date(k.since);
    if (Number.isNaN(since.getTime())) continue;
    const baslangic = from && since < from ? from : since;
    const saat = (pencereSonu - baslangic) / SAAT_MS;
    if (Number.isFinite(saat) && saat > 0) satir(k.label).bekleyen.push(saat);
  }

  let toplam = 0;
  const rows = [...satirlar.values()].map((s) => {
    const kapanmisToplam = s.kapanmis.reduce((a, b) => a + b, 0);
    const bekleyenToplam = s.bekleyen.reduce((a, b) => a + b, 0);
    const birikim = kapanmisToplam + bekleyenToplam;
    if (!s.is_done) toplam += birikim;
    return {
      label: s.label,
      is_done: s.is_done,
      entered: s.girenler.size,
      samples: s.kapanmis.length,
      avg_hours: s.kapanmis.length ? yuvarla(kapanmisToplam / s.kapanmis.length) : 0,
      median_hours: yuvarla(ortanca(s.kapanmis)),
      waiting_now: s.bekleyen.length,
      waiting_avg_days: s.bekleyen.length ? yuvarla(bekleyenToplam / s.bekleyen.length / 24) : 0,
      total_hours: yuvarla(birikim),
      share: 0,
      bottleneck: false,
    };
  });

  let darbogaz = null;
  if (toplam > 0) {
    for (const r of rows) {
      if (r.is_done) continue;
      r.share = Math.round((r.total_hours / toplam) * 100);
      if (!darbogaz || r.total_hours > darbogaz.total_hours) darbogaz = r;
    }
    if (darbogaz && darbogaz.total_hours > 0) darbogaz.bottleneck = true;
  }

  return { rows, total_hours: yuvarla(toplam), bottleneck: darbogaz?.bottleneck ? darbogaz.label : null };
}
