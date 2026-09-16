// Taşınma paketinin saf testleri.
//
// Paketleyici (lib/tasinma.js) veritabanına dokunmuyor; burada yüklenmiş
// satırların taklidi veriliyor ve çıkan dosyanın KURALLARI doğrulanıyor.
// Kurallar dosyanın başında: iç kimlik yok, e-posta yok, çöp yok, ekler ve
// raporlama verisi bilerek dışarıda. Her biri bir güvenlik ya da ürün kararı;
// test o kararın sessizce geri alınmasını engelliyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { alanPaketi, paketOzeti, paketDosyaAdi, TASINMA_BICIM, TASINMA_SURUM } from '../src/lib/tasinma.js';

const now = new Date('2026-09-16T12:00:00Z');

function ornek() {
  const ali = { id: 1, slug: 'ali', name: 'Ali', email: 'ali@ornek.com', passwordHash: 'x' };
  const ayse = { id: 2, slug: 'ayse', name: 'Ayşe', email: 'ayse@ornek.com', passwordHash: 'y' };
  const workspace = { id: 15, name: 'Deneme', slug: 'deneme', inviteCode: 'GIZLI' };
  const members = [
    { workspaceId: 15, userId: 1, user: ali, workspaceRole: { name: 'Sahip' }, roleTitle: 'Kurucu' },
    { workspaceId: 15, userId: 2, user: ayse, workspaceRole: null, role: 'editor', roleTitle: null },
  ];
  const projects = [{
    id: 23, name: 'Ana', color: 'mavi', icon: 'code',
    columns: [
      { id: 118, slug: 'todo', title: 'To Do', titleTr: 'Yapılacak', color: null, position: 1, isDone: false, allowedNext: null },
      { id: 121, slug: 'done', title: 'Done', titleTr: 'Tamamlandı', color: null, position: 2, isDone: true, allowedNext: ['todo'] },
      { id: 117, slug: 'backlog', title: 'Backlog', titleTr: null, color: null, position: 0, isDone: null, allowedNext: null },
    ],
    labels: [{ id: 7, slug: 'bug', nameEn: 'Bug', nameTr: 'Hata', colorTone: 'rose' }],
  }];
  const tasks = [
    {
      id: 100, projectId: 23, columnId: 121, title: 'Bitti', description: 'a', doc: null, priority: 'high',
      dueDate: new Date('2026-09-10'), startDate: null, assigneeDates: null, position: 2,
      createdAt: new Date('2026-09-01T08:00:00Z'), completedAt: new Date('2026-09-10T08:00:00Z'), deletedAt: null,
      creator: ali,
      subtasks: [{ id: 5, title: 'ikinci', done: true, position: 2 }, { id: 4, title: 'birinci', done: false, position: 1 }],
      comments: [
        { id: 9, text: 'sonra', createdAt: new Date('2026-09-02T00:00:00Z'), user: ayse },
        { id: 8, text: 'önce', createdAt: new Date('2026-09-01T00:00:00Z'), user: ali },
      ],
      assignees: [{ user: ayse }, { user: ali }],
      labelLinks: [{ label: { id: 7, slug: 'bug' } }],
    },
    {
      id: 101, projectId: 23, columnId: 118, title: 'Açık', description: null, doc: { blocks: [] }, priority: null,
      dueDate: null, startDate: null, assigneeDates: null, position: 1,
      createdAt: new Date('2026-09-05T00:00:00Z'), completedAt: null, deletedAt: null,
      creator: null, subtasks: [], comments: [], assignees: [], labelLinks: [],
    },
    {
      id: 102, projectId: 23, columnId: 118, title: 'Çöpte', description: 'gizli', doc: null, priority: 'mid',
      dueDate: null, startDate: null, assigneeDates: null, position: 3,
      createdAt: new Date(), completedAt: null, deletedAt: new Date(),
      creator: ali, subtasks: [], comments: [], assignees: [], labelLinks: [],
    },
  ];
  return { workspace, exportedBy: ali, members, projects, tasks, now };
}

/** Nesne ağacındaki bütün anahtar adları (iç içe, diziler dahil). */
function tumAnahtarlar(v, acc = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => tumAnahtarlar(x, acc));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) { acc.add(k); tumAnahtarlar(x, acc); }
  }
  return acc;
}

describe('alanPaketi — biçim ve kapsam', () => {
  test('başlık alanları: biçim adı, sürüm, kim, ne zaman, hangi alan', () => {
    const p = alanPaketi(ornek());
    assert.equal(p.format, TASINMA_BICIM);
    assert.equal(p.version, TASINMA_SURUM);
    assert.equal(p.exported_at, '2026-09-16T12:00:00.000Z');
    assert.equal(p.exported_by, 'ali');
    assert.deepEqual(p.workspace, { name: 'Deneme', slug: 'deneme' });
  });

  // GUVENLIK.md §5: e-posta yalnızca kişinin kendi profilinde. Dosya elden
  // ele dolaşır; içe aktarma slug/ad ile eşler, e-postaya ihtiyacı yok.
  test('e-posta, parola özeti ve davet kodu dosyada YOK', () => {
    const metin = JSON.stringify(alanPaketi(ornek()));
    assert.ok(!metin.includes('@ornek.com'), 'e-posta sızdı');
    assert.ok(!metin.includes('GIZLI'), 'davet kodu sızdı');
    const anahtarlar = tumAnahtarlar(alanPaketi(ornek()));
    for (const yasak of ['email', 'passwordHash', 'password_hash', 'inviteCode', 'invite_code', 'id', 'userId', 'user_id', 'projectId', 'columnId']) {
      assert.ok(!anahtarlar.has(yasak), `yasak anahtar dosyada: ${yasak}`);
    }
  });

  test('kişiler slug ve adla; rol adı özel rolden, yoksa eski rol alanından', () => {
    const p = alanPaketi(ornek());
    assert.deepEqual(p.members, [
      { slug: 'ali', name: 'Ali', role: 'Sahip', role_title: 'Kurucu' },
      { slug: 'ayse', name: 'Ayşe', role: 'editor', role_title: null },
    ]);
  });

  test('çöp kutusundaki kart taşınmaz', () => {
    const p = alanPaketi(ornek());
    const basliklar = p.projects[0].tasks.map((t) => t.title);
    assert.deepEqual(basliklar, ['Açık', 'Bitti']);
    assert.ok(!JSON.stringify(p).includes('gizli'));
  });

  test('kolonlar konuma göre sıralı, is_done yalnızca true için true', () => {
    const p = alanPaketi(ornek());
    const k = p.projects[0].columns;
    assert.deepEqual(k.map((c) => c.slug), ['backlog', 'todo', 'done']);
    assert.deepEqual(k.map((c) => c.is_done), [false, false, true]);
    assert.deepEqual(k[2].allowed_next, ['todo']);
    assert.equal(k[0].allowed_next, null);
  });

  test('kart: kolon ve etiket slug ile, atananlar ve yazan slug ile, günler YYYY-MM-DD', () => {
    const p = alanPaketi(ornek());
    const t = p.projects[0].tasks.find((x) => x.title === 'Bitti');
    assert.equal(t.column, 'done');
    assert.deepEqual(t.labels, ['bug']);
    assert.deepEqual(t.assignees, ['ayse', 'ali']);
    assert.equal(t.created_by, 'ali');
    assert.equal(t.due, '2026-09-10');
    assert.equal(t.start, null);
    assert.equal(t.completed_at, '2026-09-10T08:00:00.000Z');
  });

  test('alt görevler konuma, yorumlar zamana göre sıralı', () => {
    const p = alanPaketi(ornek());
    const t = p.projects[0].tasks.find((x) => x.title === 'Bitti');
    assert.deepEqual(t.subtasks.map((s) => s.title), ['birinci', 'ikinci']);
    assert.deepEqual(t.subtasks.map((s) => s.done), [false, true]);
    assert.deepEqual(t.comments.map((c) => [c.author, c.text]), [['ali', 'önce'], ['ayse', 'sonra']]);
  });

  test('boş alanlar dürüst: açıklama "", öncelik varsayılan, yazan null, doc olduğu gibi', () => {
    const p = alanPaketi(ornek());
    const t = p.projects[0].tasks.find((x) => x.title === 'Açık');
    assert.equal(t.description, '');
    assert.equal(t.priority, 'mid');
    assert.equal(t.created_by, null);
    assert.deepEqual(t.doc, { blocks: [] });
    assert.equal(t.completed_at, null);
  });

  // Kapsam dışı olanlar dosyada ADIYLA yazılı: içe aktarma "kayıp" değil
  // "kapsam dışı" desin, kullanıcı da eklerinin gelmediğini dosyadan görsün.
  test('kapsam dışı liste dosyada', () => {
    const p = alanPaketi(ornek());
    assert.deepEqual(p.not_included, ['attachments', 'work_logs', 'transitions', 'notes', 'chat', 'trash']);
  });
});

describe('paketOzeti — denetim kaydına giden sayılar', () => {
  test('proje, kart, alt görev, yorum, üye', () => {
    assert.deepEqual(paketOzeti(alanPaketi(ornek())), { projects: 1, tasks: 2, subtasks: 2, comments: 2, members: 2 });
  });
});

describe('paketDosyaAdi — Content-Disposition güvenli', () => {
  test('slug ve gün', () => {
    assert.equal(paketDosyaAdi('deneme', now), 'stoaboard_deneme_2026-09-16.json');
  });
  // Slug zaten süzülü ama başlığa ham metin koymak başlık enjeksiyonu demek;
  // yardımcı buna güvenmiyor.
  test('tırnak, satır sonu ve noktalı virgül süzülür; boş slug yedeğe düşer', () => {
    assert.equal(paketDosyaAdi('a"b;\r\nc', now), 'stoaboard_abc_2026-09-16.json');
    assert.equal(paketDosyaAdi('', now), 'stoaboard_stoaboard_2026-09-16.json');
  });
});
