// Proje bazlı erişim — ortak kapı ve saf karar mantığı.
//
// Kararlar PROJE-ERISIMI.md'de (10 Eylül 2026): yönetici her projeyi görür,
// diğer üyeler yalnızca eklendikleri projeleri, yeni üye hiçbir projeyi.
// Bu dosya o kararların sunucudaki TEK karşılığını kilitliyor
// (`src/lib/projeErisimi.js`). Kapı henüz hiçbir uca bağlı değil — sebebi
// ve onu koruyan kilit en altta.
//
// Veritabanı gerektirmiyor: sorgu yapan işlev istemciyi parametre olarak
// alıyor ve burada sahte bir istemciyle koşuyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HER_PROJEYI_GOREN_IZIN,
  herProjeyiGorur,
  projeyiGorebilir,
  gorunurProjeKosulu,
  projeErisimiCoz,
} from '../src/lib/projeErisimi.js';
import { ALL_PERMISSIONS } from '../src/lib/permissions.js';
import { yorumsuzDosya, kaynakDosyalari } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');

// ─── Örnek dünya ────────────────────────────────────────────────────────────
//
// İki alan. Alan 1'de üç proje, alan 2'de bir proje. Rol izinleri varsayılan
// rollerle aynı (`routes/workspaces.js`, DEFAULT_ROLES) — kural varsayılan
// "Yönetici"yi kapsamazsa kararın kendisi bozulmuş olur.
const YONETICI = { permissions: ['manage_tasks', 'manage_projects', 'manage_members', 'manage_channels', 'delete_messages', 'invite_members', 'view_reports'] };
const DUZENLEYICI = { permissions: ['manage_tasks'] };
const GORUNTULEYICI = { permissions: [] };
// Proje açıp düzenleyebilen ama üye yönetemeyen bir rol: her projeyi
// GÖRMEMELİ (izin seçiminin gerekçesi kaynakta).
const PROJE_YONETEN = { permissions: ['manage_projects', 'manage_tasks'] };

const uye = (userId, workspaceId, rol, role = 'member') => ({ userId, workspaceId, role, workspaceRole: rol });

const SAHIP = uye(1, 1, null, 'owner');
const ADMIN = uye(2, 1, YONETICI);
const EDITOR = uye(3, 1, DUZENLEYICI);
const IZLEYICI = uye(4, 1, GORUNTULEYICI);
const PROJECI = uye(5, 1, PROJE_YONETEN);
const YENI = uye(6, 1, DUZENLEYICI); // hiçbir projeye eklenmemiş
const OBUR_SAHIP = uye(7, 2, null, 'owner'); // alan 2'nin sahibi

const UYELER = [SAHIP, ADMIN, EDITOR, IZLEYICI, PROJECI, YENI, OBUR_SAHIP];
const PROJELER = [
  { id: 10, workspaceId: 1 },
  { id: 11, workspaceId: 1 },
  { id: 12, workspaceId: 1 },
  { id: 20, workspaceId: 2 },
];
const SATIRLAR = [
  { projectId: 10, userId: 3 },
  { projectId: 11, userId: 4 },
  { projectId: 10, userId: 5 },
  // Alan 2'deki projenin satırı alan 1'in bir üyesine — alan üyeliği
  // olmadan satır tek başına hiçbir şey açmamalı.
  { projectId: 20, userId: 3 },
];
const satir = (projectId, userId) => SATIRLAR.find((s) => s.projectId === projectId && s.userId === userId) || null;
const gorebilir = (m, p) => projeyiGorebilir({ member: m, project: p, projeUyesi: satir(p.id, m.userId) });
const gorduguProjeler = (m) => PROJELER.filter((p) => gorebilir(m, p)).map((p) => p.id);

// ─── Kararın kendisi ────────────────────────────────────────────────────────

describe('proje görünürlüğü: verilen kararlar', () => {
  test('sahip ve varsayılan Yönetici alanındaki her projeyi görür, satır olmadan', () => {
    assert.deepEqual(gorduguProjeler(SAHIP), [10, 11, 12]);
    assert.deepEqual(gorduguProjeler(ADMIN), [10, 11, 12]);
  });

  test('diğer üyeler yalnızca eklendikleri projeyi görür', () => {
    assert.deepEqual(gorduguProjeler(EDITOR), [10]);
    assert.deepEqual(gorduguProjeler(IZLEYICI), [11]);
  });

  test('yeni üye hiçbir proje görmez', () => {
    assert.deepEqual(gorduguProjeler(YENI), []);
  });

  test('proje yönetme izni her projeyi görmeye yetmez', () => {
    // `manage_projects` seçilseydi bu rol 12'yi de görürdü.
    assert.equal(herProjeyiGorur(PROJECI), false);
    assert.deepEqual(gorduguProjeler(PROJECI), [10]);
  });

  test('başka alanın sahibi olmak bu alanda hiçbir şey vermiyor', () => {
    assert.deepEqual(gorduguProjeler(OBUR_SAHIP), [20]);
  });

  test('alan dışındaki projenin satırı erişim açmıyor', () => {
    // EDITOR'ün proje 20 için satırı var ama alan 2'nin üyesi değil; elindeki
    // üyelik alan 1'in. Kapı yanlış alanın üyeliğini geçireni reddetmeli.
    assert.equal(gorebilir(EDITOR, PROJELER[3]), false);
  });
});

describe('proje görünürlüğü: kapalı başarısızlık', () => {
  const p10 = PROJELER[0];

  test('eksik girdi reddeder', () => {
    assert.equal(projeyiGorebilir(), false);
    assert.equal(projeyiGorebilir({ member: null, project: p10, projeUyesi: satir(10, 3) }), false);
    assert.equal(projeyiGorebilir({ member: EDITOR, project: null, projeUyesi: satir(10, 3) }), false);
  });

  test('satıra bakmayı unutmak "satır var" sayılmıyor', () => {
    // `projeUyesi` tanımsız = çağıran sorguyu atmamış. "Yok" ile aynı sonuç.
    assert.equal(projeyiGorebilir({ member: EDITOR, project: p10 }), false);
  });

  test('başka kullanıcının ya da başka projenin satırı erişim açmıyor', () => {
    assert.equal(projeyiGorebilir({ member: YENI, project: p10, projeUyesi: satir(10, 3) }), false);
    assert.equal(projeyiGorebilir({ member: EDITOR, project: PROJELER[2], projeUyesi: satir(10, 3) }), false);
  });

  test('tür karışıklığı geçmiyor: kimliğin metin hâli eşleşme sayılmaz', () => {
    assert.equal(projeyiGorebilir({ member: EDITOR, project: p10, projeUyesi: { projectId: '10', userId: 3 } }), false);
  });
});

// ─── Liste koşulu, tekil kapıyla AYNI kural ─────────────────────────────────
//
// Kenar çubuğu listeden, pano kimlikten açılıyor. İki biçim ayrışırsa biri
// sızar. Koşul burada küçük bir yorumlayıcıyla örnek dünyaya uygulanıyor ve
// her üye için tekil kapının sonucuyla karşılaştırılıyor.

// Yalnızca `gorunurProjeKosulu`nun ürettiği iki biçimi tanıyor. Tanımadığı
// bir anahtar görürse fırlatıyor — koşul yeni bir biçim kazanırsa yorumlayıcı
// onu sessizce "uyuyor" saymamalı.
function kosuluUygula(kosul, proje) {
  for (const [k, v] of Object.entries(kosul)) {
    if (k === 'workspaceId') {
      if (proje.workspaceId !== v) return false;
    } else if (k === 'members') {
      const anahtarlar = Object.keys(v);
      if (anahtarlar.length !== 1 || anahtarlar[0] !== 'some') throw new Error(`tanınmayan members biçimi: ${anahtarlar}`);
      const { userId, ...fazla } = v.some;
      if (Object.keys(fazla).length) throw new Error('tanınmayan members.some alanı');
      if (!satir(proje.id, userId)) return false;
    } else {
      throw new Error(`tanınmayan koşul anahtarı: ${k}`);
    }
  }
  return true;
}

describe('liste koşulu tekil kapıyla aynı kuralı söylüyor', () => {
  test('her üye için iki biçim aynı proje kümesini veriyor', () => {
    for (const m of UYELER) {
      const kosul = gorunurProjeKosulu(m);
      const listede = PROJELER.filter((p) => kosuluUygula(kosul, p)).map((p) => p.id);
      assert.deepEqual(listede, gorduguProjeler(m), `üye ${m.userId}: liste ile kapı ayrışmış`);
    }
  });

  test('ayırt edicilik: örnek dünya iki biçimin farkını gösterebiliyor', () => {
    // Herkes her şeyi ya da hiçbir şeyi görseydi eşitlik bir şey ölçmezdi.
    const kumeler = new Set(UYELER.map((m) => JSON.stringify(gorduguProjeler(m))));
    assert.ok(kumeler.size >= 4, `örnek dünya fazla tekdüze (${kumeler.size} farklı küme)`);
  });

  test('üyelik yoksa koşul FIRLATIYOR — boş koşul "her proje" demek', () => {
    assert.throws(() => gorunurProjeKosulu(null));
    assert.throws(() => gorunurProjeKosulu({ workspaceId: 1 }));
    assert.throws(() => gorunurProjeKosulu({ userId: 3 }));
  });

  test('yönetici olmayanın koşulu alanı da daraltıyor', () => {
    // Yalnızca `members.some` yazmak, kişinin BAŞKA alanlardaki projelerini
    // de aktif alanın listesine taşırdı.
    assert.equal(gorunurProjeKosulu(EDITOR).workspaceId, 1);
  });
});

// ─── Ortak kapı: kâhin tasarımda kapalı ─────────────────────────────────────

/** Sahte Prisma istemcisi: örnek dünyayı sorgulatır ve çağrıları sayar. */
function sahteIstemci() {
  const cagri = { project: 0, workspaceMember: 0, projectMember: 0 };
  return {
    cagri,
    project: {
      findUnique: async ({ where }) => { cagri.project++; return PROJELER.find((p) => p.id === where.id) || null; },
    },
    workspaceMember: {
      findUnique: async ({ where }) => {
        cagri.workspaceMember++;
        const { workspaceId, userId } = where.workspaceId_userId;
        return UYELER.find((m) => m.workspaceId === workspaceId && m.userId === userId) || null;
      },
    },
    projectMember: {
      findUnique: async ({ where }) => {
        cagri.projectMember++;
        const { projectId, userId } = where.projectId_userId;
        return satir(projectId, userId);
      },
    },
  };
}

describe('projeErisimiCoz: ortak kapı', () => {
  test('görebilen için proje ve üyelik döner', async () => {
    const r = await projeErisimiCoz(sahteIstemci(), 3, 10);
    assert.equal(r.erisim, true);
    assert.equal(r.project.id, 10);
    assert.equal(r.member.userId, 3);
  });

  test('"proje yok", "alan üyesi değil" ve "projeye eklenmemiş" AYNI reddi veriyor', async () => {
    // Kâhin kuralı (kart #227): kimlik deneyerek varlık çıkarsanamamalı.
    // Kapı ayrımı dışarı vermediği için çağıran farklı yanıt yazamaz.
    const yok = await projeErisimiCoz(sahteIstemci(), 3, 999);
    const uyeDegil = await projeErisimiCoz(sahteIstemci(), 7, 10);
    const eklenmemis = await projeErisimiCoz(sahteIstemci(), 3, 12);
    assert.deepEqual(yok, { erisim: false });
    assert.deepEqual(uyeDegil, yok);
    assert.deepEqual(eklenmemis, yok);
  });

  test('yönetici için proje üyeliği hiç sorgulanmıyor', async () => {
    const ist = sahteIstemci();
    const r = await projeErisimiCoz(ist, 2, 12);
    assert.equal(r.erisim, true);
    assert.equal(ist.cagri.projectMember, 0);
  });

  test('yönetici olmayan için proje üyeliği sorgulanıyor', async () => {
    // Ayırt edicilik: üstteki test sayaç hiç artmadığı için geçiyor olamaz.
    const ist = sahteIstemci();
    await projeErisimiCoz(ist, 3, 12);
    assert.equal(ist.cagri.projectMember, 1);
  });

  test('geçersiz kimlik sorguya hiç girmiyor ve aynı reddi veriyor', async () => {
    for (const [uid, pid] of [[3, NaN], [3, '10'], [3, 0], [3, -1], [3, 1.5], [NaN, 10], [null, 10], [undefined, 10]]) {
      const ist = sahteIstemci();
      const r = await projeErisimiCoz(ist, uid, pid);
      assert.deepEqual(r, { erisim: false }, `(${uid}, ${pid})`);
      assert.deepEqual(ist.cagri, { project: 0, workspaceMember: 0, projectMember: 0 }, `(${uid}, ${pid}) sorguya girdi`);
    }
  });

  test('ret nesnesi paylaşılıyor ama değiştirilemiyor', async () => {
    // Tek bir dondurulmuş nesne: bir çağıranın ona alan yazması öbür
    // isteklerin reddini değiştirmemeli.
    const r = await projeErisimiCoz(sahteIstemci(), 3, 999);
    assert.ok(Object.isFrozen(r));
  });
});

// ─── Kural verinin kendisine bağlı ──────────────────────────────────────────

describe('her projeyi gören izin', () => {
  test('sunucunun tanıdığı bir izin', () => {
    assert.ok(ALL_PERMISSIONS.includes(HER_PROJEYI_GOREN_IZIN));
  });

  test('varsayılan "Yönetici" rolü bu izni taşıyor', () => {
    // Karar "yönetici her projeyi görür". Varsayılan rolden izin çıkarılırsa
    // yeni açılan her alanda yönetici projelerini kaybeder — karar sessizce
    // tersine döner. Ölçüt DEFAULT_ROLES bloğunun içindeki Yönetici satırının
    // İZİN DİZİSİNE bağlı, dosya geneline değil.
    const src = yorumsuzDosya(path.join(SRC, 'routes', 'workspaces.js'));
    const bas = src.indexOf('const DEFAULT_ROLES = [');
    assert.ok(bas !== -1, 'DEFAULT_ROLES bulunamadı');
    const blok = src.slice(bas, src.indexOf('];', bas));
    const satirBas = blok.indexOf("['Yönetici'");
    assert.ok(satirBas !== -1, 'varsayılan Yönetici rolü bulunamadı');
    const dizi = blok.slice(blok.indexOf('[', satirBas + 1), blok.indexOf(']', satirBas + 1) + 1);
    assert.ok(dizi.includes(`'${HER_PROJEYI_GOREN_IZIN}'`),
      `varsayılan Yönetici rolünde '${HER_PROJEYI_GOREN_IZIN}' yok: ${dizi}`);
  });
});

// ─── Sıralama kısıtı ────────────────────────────────────────────────────────
//
// `project_members` tablosu canlıda HENÜZ YOK (DEVIR 0-AS). Kapıyı bir uca
// bağlayan kod gönderilirse yönetici olmayan her isteğin sorgusu var olmayan
// tabloya gider ve 500 döner — `main` her push'ta canlıya gidiyor.
//
// Bu kilit o sırayı belgeden teste taşıyor. Tablo canlıda oluşturulup
// tek seferlik aktarım yapıldıktan (DEVIR 0-AS'teki iki SQL bloğu) SONRA bu
// describe bloğu silinir — silmek, sıranın tamamlandığına dair bilinçli bir
// karar olmalı, unutulan bir adım değil.

describe('sıralama kısıtı: tablo canlıda yokken kapı uçlara bağlanmıyor', () => {
  test('src içinde projeErisimi.js dışında hiçbir dosya onu ya da tabloyu kullanmıyor', () => {
    const suclu = [];
    for (const dosya of kaynakDosyalari(SRC, /\.js$/)) {
      if (path.basename(dosya) === 'projeErisimi.js') continue;
      const src = yorumsuzDosya(dosya);
      if (/projeErisimi|\.projectMember\b/.test(src)) suclu.push(path.relative(SRC, dosya));
    }
    assert.deepEqual(suclu, [],
      'Proje kapısı bir uca bağlanmış. Tablo canlıda oluştu mu ve aktarım yapıldı mı? '
      + 'Yapıldıysa bu describe bloğunu sil; yapılmadıysa bu kod canlıyı kırar.');
  });
});
