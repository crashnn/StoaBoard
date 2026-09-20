// Aktif alan geçişi bütün sekmelere yayınlanır (kart #289).
//
// 20 Eylül 2026: Claude MCP'den alan değiştirdi, kullanıcının açık sekmesi
// eski alanda kaldı. Ölçüm üç yol buldu: tarayıcının soket olayı yalnızca
// kendi soketine haber veriyordu (socket.emit), REST ucu (MCP buradan geçer)
// hiç vermiyordu, alan açma ve kodla katılma da vermiyordu. Tek yardımcı
// (lib/emit.js alanGecisiYayini) kullanıcının odasına yayınlıyor;
// currentWorkspaceId'yi yazan yollar ona bağlı.
//
// Ölçütler ilgili BLOĞA daraltılmış (CLAUDE.md, 17 Eylül dersi): "dosyada
// alanGecisiYayini geçiyor" demek, bir yolun geri alınmasını başka bir yol
// aklar. Her yol kendi gövdesinde aranıyor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { yorumsuzDosya } from './yardimcilar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const CLIENT = path.resolve(__dirname, '..', '..', 'client', 'src');

const EMIT = yorumsuzDosya(path.join(SRC, 'lib', 'emit.js'));
const WS = yorumsuzDosya(path.join(SRC, 'routes', 'workspaces.js'));
const CHAT = yorumsuzDosya(path.join(SRC, 'sockets', 'chat.js'));
const APP = yorumsuzDosya(path.join(CLIENT, 'app.jsx'));

/** `baslangic` ile onu izleyen ilk `bitis` arasındaki gövde. */
function blok(src, baslangic, bitis) {
  const i = src.indexOf(baslangic);
  assert.ok(i >= 0, `blok bulunamadı: ${baslangic}`);
  const j = src.indexOf(bitis, i);
  assert.ok(j > i, `blok sonu bulunamadı: ${bitis}`);
  return src.slice(i, j);
}

describe('alanGecisiYayini — kullanıcının odasına, doğru olayla', () => {
  test('user_<id> odasına workspace_switched; emitSafely üstünden (sessiz başarısızlık yok)', () => {
    const fn = blok(EMIT, 'export function alanGecisiYayini(', '\n}');
    assert.match(fn, /emitSafely\(io,\s*'workspace_switched'/);
    assert.match(fn, /\.to\(`user_\$\{userId\}`\)\.emit\('workspace_switched',\s*\{\s*workspace_id:\s*workspaceId\s*\}\)/);
  });
});

describe('currentWorkspaceId yazan her yol yayınlıyor', () => {
  test('REST /:wsId/switch — MCP set_active_workspace bu uçtan geçer', () => {
    const govde = blok(WS, "'/:wsId/switch',", 'res.json(');
    assert.match(govde, /currentWorkspaceId:\s*wsId/);
    assert.match(govde, /alanGecisiYayini\(req\.app\.get\('io'\),\s*user\.id,\s*wsId\)/,
      'switch ucu yayınlamıyor — MCP\'den alan değişince sekme F5 ister');
  });

  test('kodla katılma, zaten üyeyse: geçiş yayınlanır', () => {
    const govde = blok(WS, 'if (existing) {', 'return res.json(');
    assert.match(govde, /currentWorkspaceId:\s*ws\.id/);
    assert.match(govde, /alanGecisiYayini\(req\.app\.get\('io'\),\s*user\.id,\s*ws\.id\)/);
  });

  test('alan açma: transaction bittikten SONRA yayın, yanıttan önce', () => {
    const govde = blok(WS, 'invite_code: result.inviteCode', '}),');
    // Yayın, gövdenin ÖNCESİNDE (transaction kapandıktan sonra) ve yanıt satırından önce olmalı.
    const oncesi = WS.slice(WS.indexOf('return ws;\n    });'), WS.indexOf('invite_code: result.inviteCode'));
    assert.match(oncesi, /alanGecisiYayini\(req\.app\.get\('io'\),\s*user\.id,\s*result\.id\)/,
      'yeni alan açılınca öbür sekmeler eski alanda kalır');
    assert.doesNotMatch(govde, /alanGecisiYayini/);
  });

  test('soket switch_workspace: kendi soketine değil, kullanıcının bütün sekmelerine', () => {
    const govde = blok(CHAT, "socket.on('switch_workspace'", "socket.on('chat_message'");
    assert.match(govde, /alanGecisiYayini\(io,\s*user\.id,\s*wsId\)/);
    assert.doesNotMatch(govde, /socket\.emit\('workspace_switched'/,
      'yalnızca bu sokete yayın geri geldi — öbür sekmeler görmez');
  });
});

describe('istemci — olayı bütün sekmeler alır, başlatan sekme iki kez yüklemez', () => {
  test("workspace_switched dinleyicisi zaten o alandaysa yüklemez", () => {
    const govde = blok(APP, "sock.on('workspace_switched'", 'onyukle(workspace_id)');
    assert.match(govde, /String\(window\.DATA\?\.WORKSPACE\?\.id\)\s*===\s*String\(workspace_id\)\)\s*return/);
  });

  test('handleSwitchWorkspace soket olayı göndermiyor — REST ucu yayınlıyor, çift yayın olmasın', () => {
    const govde = blok(APP, 'const handleSwitchWorkspace = async', '\n  };');
    assert.match(govde, /API\.switchWorkspace\(wsId\)/);
    assert.doesNotMatch(govde, /emit\('switch_workspace'/);
  });
});
