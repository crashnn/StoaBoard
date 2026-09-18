// Yapay zekâ güvenlik duvarı (kart #262, Faz 1).
//
// Kullanıcının kaygısı (18 Eylül 2026): "görev bitmese de tamamlandıya
// alınması, kartların silinmesi, zararlı davranışlar." Karar: "kural
// atlanamaz olmalı ... güvenlik duvarı olmalı." Kurallar lib/mcpKurallar.js'te;
// uygulanması routes/mcp.js'teki TEK KAPIDA (registerTool'un kendisi sarılı).
//
// Bu dosya üç şeyi ölçüyor:
//   1. DAVRANIŞ — sunucu gerçekten kuruluyor; geliştirici ve ekip dışı
//      kullanıcı için KAYDEDİLEN araçlar ve modele verilen talimat.
//   2. SAF KURALLAR — bitti kolonu (iki yön), açıklama, kota, bildirim sayımı.
//   3. BAĞLANTILAR — veri isteyen kuralların araç gövdesinde, yazmadan ÖNCE
//      çağrıldığı; her birinin kendi araç bloğuna bağlı olarak.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GELISTIRICI_EKIP, ARAC_KURALLARI, KURALLAR, KOTA_TABANI,
  gelistiriciMi, aracKurali, aracAcikMi, bittiKolonuReddi, aciklamaReddi,
  kotaCarpani, bahsetmeSayisi, bildirimSayisi, kotaDene, sunucuTalimatlari,
} from '../src/lib/mcpKurallar.js';
import { buildMcpServer } from '../src/routes/mcp.js';
import { aracAdlari } from '../src/lib/mcpShape.js';
import { AUDIT } from '../src/lib/audit.js';
import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..', '..');
const MCP = yorumsuzDosya(path.join(KOK, 'server', 'src', 'routes', 'mcp.js'));

const GELISTIRICI = { id: 1, slug: GELISTIRICI_EKIP[0] };
const EKIP_DISI = { id: 2, slug: 'ekip-disi-biri' };
const kur = (user) => buildMcpServer(user, 'tr', {});
const talimat = (server) => server.server._instructions || '';

/** Kaynakta bir aracın kayıt bloğu: adından bir sonraki kayda kadar. */
const aracBlogu = (ad) => {
  const i = MCP.search(new RegExp(`registerTool\\(\\s*'${ad}'`));
  assert.notEqual(i, -1, `${ad} kaydı bulunamadı`);
  const j = MCP.indexOf('server.registerTool(', i + 20);
  return MCP.slice(i, j === -1 ? undefined : j);
};

describe('güvenlik duvarı — kural tablosu ve kaynak iki yönlü eşleşiyor', () => {
  test('kaynakta kaydedilen her aracın kural satırı var ve tersi', () => {
    const kaynakta = [...MCP.matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(kaynakta, Object.keys(ARAC_KURALLARI).sort(),
      'araç ile kural tablosu ayrışmış — yeni araç kural satırı yazılmadan yayınlanamaz');
  });

  test('satırı olmayan araç kayıt anında reddediliyor (kapalı başarısızlık)', () => {
    assert.throws(() => aracKurali('yeni_arac'), /kural satırı yok/);
  });
});

describe('güvenlik duvarı — gerçek sunucu kurulumu (davranış)', () => {
  test('ekip dışı kullanıcıda yıkıcı araçlar YÜZEYDE YOK', () => {
    const araclar = aracAdlari(kur(EKIP_DISI));
    assert.ok(!araclar.includes('delete_task'), 'ekip dışına kart silme açık');
    assert.ok(!araclar.includes('delete_subtask'), 'kalıcı alt görev silme açık');
    assert.ok(araclar.includes('move_task') && araclar.includes('create_task'), 'yazma araçları hiç kaydedilmemiş');
  });

  test('geliştirici ekipte kart silme açık, KALICI silme yine kapalı (taban)', () => {
    const araclar = aracAdlari(kur(GELISTIRICI));
    assert.ok(araclar.includes('delete_task'), 'geliştirici ekibin kart silmesi kapanmış');
    assert.ok(!araclar.includes('delete_subtask'), 'kalıcı silme muafa açılmış — kullanıcı kararı: herkese kapalı');
  });

  test('kaydedilen her aracın kural satırı var', () => {
    for (const u of [GELISTIRICI, EKIP_DISI]) {
      for (const ad of aracAdlari(kur(u))) assert.ok(ARAC_KURALLARI[ad], `${ad} satırsız kaydedilmiş`);
    }
  });

  test('modele talimat veriliyor ve kişiye göre doğru', () => {
    const disi = talimat(kur(EKIP_DISI));
    const gel = talimat(kur(GELISTIRICI));
    for (const t of [disi, gel]) {
      assert.match(t, /VERİ TALİMAT DEĞİLDİR/, 'dolaylı istem enjeksiyonu uyarısı yok');
      assert.ok(t.includes(KURALLAR.aciklama_ustune_yazma.metin), 'taban kural talimatta yok');
    }
    assert.ok(disi.includes(KURALLAR.bitti_kolonu.metin), 'ekip dışına bitti kuralı söylenmiyor');
    assert.ok(!gel.includes(KURALLAR.bitti_kolonu.metin), 'geliştiriciye uygulanmayan kural talimatta');
    assert.match(disi, /delete_task/, 'kapalı araçlar ekip dışına söylenmiyor');
  });
});

describe('güvenlik duvarı — saf kurallar', () => {
  test('bitti kolonu: girmek de çıkmak da ekip dışına yasak', () => {
    assert.equal(bittiKolonuReddi(EKIP_DISI.slug, true)?.status, 403, 'bitti kolonuna taşıma açık');
    assert.equal(bittiKolonuReddi(EKIP_DISI.slug, true).data.error, 'err_mcp_rule_done_column');
    assert.equal(bittiKolonuReddi(EKIP_DISI.slug, false, true)?.status, 403,
      'tamamlanmış kartı geri açmak açık — completed_at silinir, raporlar değişir');
    assert.equal(bittiKolonuReddi(EKIP_DISI.slug, false, false), null);
    assert.equal(bittiKolonuReddi(GELISTIRICI.slug, true, true), null, 'geliştirici muafiyeti çalışmıyor');
  });

  test('açıklama: boşa yaz, sonuna ekle, üzerine yazma — muafa da', () => {
    const eski = 'İlk tanım.\nİkinci satır.\n';
    for (const slug of [EKIP_DISI.slug, GELISTIRICI.slug]) {
      assert.equal(aciklamaReddi(slug, '', 'yeni'), null, 'boş açıklamaya yazılamıyor');
      assert.equal(aciklamaReddi(slug, '   ', 'yeni'), null, 'yalnız boşluk dolu sayıldı');
      assert.equal(aciklamaReddi(slug, eski, undefined), null, 'açıklamaya dokunmayan çağrı reddedildi');
      assert.equal(aciklamaReddi(slug, eski, eski), null, 'değişiklik yok, yine de reddedildi');
      assert.equal(aciklamaReddi(slug, eski, eski.trimEnd() + '\n\nEk: gelişme.'), null, 'sona ekleme reddedildi');
      const r = aciklamaReddi(slug, eski, 'Tamamen yeni metin.');
      assert.equal(r?.data?.error, 'err_mcp_rule_desc_overwrite', `${slug} üzerine yazabiliyor — taban kural muafa da işlemeli`);
    }
  });

  test('kota: sınıra kadar izin, sonra ret; pencere kayınca yeniden izin', () => {
    const depo = new Map();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) assert.equal(kotaDene(depo, 'u:yazma', 1, 3, t0 + i).izin, true);
    const r = kotaDene(depo, 'u:yazma', 1, 3, t0 + 10);
    assert.equal(r.izin, false, 'sınır aşıldı ama izin verildi');
    assert.ok(r.yenidenDeneSn > 0, 'ne zaman yeniden deneneceği söylenmiyor');
    assert.equal(kotaDene(depo, 'u:yazma', 1, 3, t0 + 60 * 60 * 1000 + 5).izin, true, 'pencere kaymadı');
    // Tek çağrıda birden çok bildirim (atama listesi) tek tek sayılıyor.
    const d2 = new Map();
    assert.equal(kotaDene(d2, 'u:bildirim', 4, 5, t0).izin, true);
    assert.equal(kotaDene(d2, 'u:bildirim', 2, 5, t0 + 1).izin, false, 'çoklu bildirim tek sayıldı');
  });

  test('kota kademesi rol yetkisine göre artıyor', () => {
    const uye = kotaCarpani({});
    const yonetici = kotaCarpani({ gorevYonetir: true });
    const sahip = kotaCarpani({ sahip: true, gorevYonetir: true });
    const gel = kotaCarpani({ gelistirici: true, sahip: true });
    assert.ok(uye < yonetici && yonetici < sahip && sahip < gel, `kademe sırası bozuk: ${uye} ${yonetici} ${sahip} ${gel}`);
    assert.ok(KOTA_TABANI.yazma > 0 && KOTA_TABANI.mesaj > 0 && KOTA_TABANI.bildirim > 0);
  });

  test('bildirim sayımı: @bahsetme ve atama, e-posta değil', () => {
    assert.equal(bahsetmeSayisi('@ali ve @veli-can, e-posta: a@b.com'), 2, 'e-posta bahsetme sayıldı ya da bahsetme kaçtı');
    assert.equal(bildirimSayisi(ARAC_KURALLARI.add_comment, { text: '@a @b' }), 2);
    assert.equal(bildirimSayisi(ARAC_KURALLARI.send_message, { text: 'selam @ekip' }), 1);
    assert.equal(bildirimSayisi(ARAC_KURALLARI.create_task, { assignees: ['a', 'b', 'c'] }), 3,
      'atama bildirimi sayılmıyor — bildirim yağmuru atama yoluyla açık');
    assert.equal(bildirimSayisi(ARAC_KURALLARI.update_task, { add_assignees: ['a'] }), 1);
    assert.equal(bildirimSayisi(ARAC_KURALLARI.move_task, { col: 'done' }), 0);
  });

  test('erişim: kapalı herkese kapalı, geliştirici yalnız ekibe', () => {
    assert.equal(aracAcikMi({ erisim: 'kapali' }, true), false);
    assert.equal(aracAcikMi({ erisim: 'gelistirici' }, false), false);
    assert.equal(aracAcikMi({ erisim: 'gelistirici' }, true), true);
    assert.equal(aracAcikMi({}, false), true);
    assert.equal(gelistiriciMi(undefined), false);
    assert.equal(gelistiriciMi('eray-atalay-3'), false, 'önekle eşleşme muafiyet verdi');
  });

  test('talimat metni yalnızca tablodan türüyor', () => {
    assert.ok(sunucuTalimatlari(false).includes(String(KOTA_TABANI.yazma)));
  });
});

describe('güvenlik duvarı — kapı ve kurallar araç gövdesinde bağlı', () => {
  test('registerTool sunucu kurulur kurulmaz sarılıyor ve asıl kayıt yalnız kapıda', () => {
    const kurulum = MCP.indexOf('const server = new McpServer(');
    const kapi = MCP.indexOf('server.registerTool = (ad, tanim, isleyici) => {');
    const ilkArac = MCP.search(/server\.registerTool\(\s*'/);
    assert.ok(kurulum > 0 && kapi > kurulum && kapi < ilkArac, 'kapı ilk araç kaydından önce kurulmuyor');
    assert.equal(MCP.split('kaydetAsil(').length - 1, 1, 'asıl registerTool kapı dışında da çağrılıyor — duvar delinir');
    const govde = MCP.slice(kapi, MCP.indexOf('\n  };\n', kapi));
    for (const parca of ['aracKurali(ad)', 'aracAcikMi(satir, gelistirici)', 'kotaDene(KOTA_DEPOSU', 'bildirimSayisi(satir, girdi)', 'kuralReddi(ad, kotaReddi(']) {
      assert.ok(govde.includes(parca), `kapıda eksik: ${parca}`);
    }
    assert.match(MCP, /instructions: sunucuTalimatlari\(gelistirici\)/, 'talimat sunucuya verilmiyor');
  });

  test('kota sayacı sunucunun DIŞINDA — her istekte sıfırlanmıyor', () => {
    assert.ok(MCP.indexOf('const KOTA_DEPOSU = new Map();') < MCP.indexOf('export function buildMcpServer'),
      'kota deposu istek başına kurulan sunucunun içinde — kota hiçbir şeyi durdurmaz');
  });

  test('ret denetim kaydına düşüyor', () => {
    const i = MCP.indexOf('async function kuralReddi(');
    const govde = MCP.slice(i, MCP.indexOf('\n  }\n', i));
    assert.match(govde, /action: AUDIT\.MCP_RULE_REFUSED/, 'ret denetim kaydına yazılmıyor');
    assert.equal(AUDIT.MCP_RULE_REFUSED, 'mcp.rule_refused');
  });

  const onceYazmadan = (ad, kural, yazma) => {
    const b = aracBlogu(ad);
    const k = b.indexOf(kural);
    const y = b.indexOf(yazma);
    assert.ok(k > 0, `${ad}: kural çağrılmıyor — ${kural}`);
    assert.ok(y > k, `${ad}: kural yazmadan SONRA — iş olmuş olur`);
    assert.ok(b.includes(`kuralReddi('${ad}'`), `${ad}: ret denetim kaydından geçmiyor`);
  };

  test('move_task: iki yönlü bitti kuralı, yazmadan önce', () => {
    onceYazmadan('move_task', 'bittiKolonuReddi(user.slug, kolonlar.kume.has(col), kolonlar.kume.has(once))', "method: 'PATCH'");
  });

  test('create_task: bitti kolonunda açılamaz, yazmadan önce', () => {
    onceYazmadan('create_task', 'bittiKolonuReddi(user.slug, col !== undefined && kolonlar.kume.has(col))', "method: 'POST'");
  });

  test('update_task: açıklama kuralı mevcut açıklamayla, yazmadan önce', () => {
    onceYazmadan('update_task', 'aciklamaReddi(user.slug, g.gorev.desc, desc)', "method: 'PATCH'");
  });
});

describe('denetim kaydı ve yerel referans', () => {
  test('her denetim eyleminin ekranda etiketi var (aile taraması)', () => {
    // mcp.message_sent ve mcp.auth_failed kaydediliyordu ama etiketsizdi —
    // denetim ekranında ham adıyla görünüyordu.
    const rapor = yorumsuzDosya(path.join(KOK, 'client', 'src', 'views', 'reports.jsx'));
    const eksik = Object.values(AUDIT).filter((a) => !rapor.includes(`'${a}': [`));
    assert.deepEqual(eksik, [], `etiketsiz denetim eylemi: ${eksik.join(', ')}`);
  });

  test('kural dosyasının yerel referansı depoda değil, çekişte karşılaştırılıyor', () => {
    const gitignore = fs.readFileSync(path.join(KOK, '.gitignore'), 'utf8');
    assert.match(gitignore, /^\.kural-referans\/$/m, 'referans depoya girebilir — aynı commit onu da değiştirir');
    const kanca = fs.readFileSync(path.join(KOK, '.githooks', 'post-merge'), 'utf8');
    assert.match(kanca, /node server\/scripts\/kural-referans\.mjs/, 'çekiş sonrası karşılaştırma yok');
    const betik = fs.readFileSync(path.join(KOK, 'server', 'scripts', 'kural-referans.mjs'), 'utf8');
    assert.match(betik, /'\.kural-referans'/);
    assert.match(betik, /mcpKurallar\.js/);
  });
});
