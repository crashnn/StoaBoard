// Yapay zekâ kural dosyasının YEREL referansla karşılaştırılması (kart #262).
//
// Kullanıcı kararı (18 Eylül 2026): kural dosyasını geliştirici ekip (Claude
// Code dahil) commit ile değiştirebilir — ama kullanıcının makinesinde
// dosyanın .gitignore'lu bir referans kopyası durur. Çekilen her değişiklik
// bununla karşılaştırılır; kurallar ESNETİLMİŞSE hemen görülür, açık kapatılır,
// kim yaptıysa sorgulanır.
//
// Referans depoya girmiyor (kök .gitignore: .kural-referans/). Girseydi onu da
// aynı commit değiştirebilirdi ve karşılaştırma hiçbir şey yakalamazdı.
//
// Kullanım:
//   node server/scripts/kural-referans.mjs          karşılaştır (kanca bunu çağırır)
//   node server/scripts/kural-referans.mjs --kabul  değişikliği inceledim, referansı güncelle
//
// Birleştirmeyi ENGELLEMİYOR, bağırıyor: çekilen kod zaten yerelde; engellemek
// yalnızca kullanıcıyı yarım bir ağaçla bırakırdı. Karar insanın.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KAYNAK = path.join(KOK, 'server', 'src', 'lib', 'mcpKurallar.js');
const REF_DIZIN = path.join(KOK, '.kural-referans');
const REFERANS = path.join(REF_DIZIN, 'mcpKurallar.js');

const oku = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

if (!fs.existsSync(KAYNAK)) {
  console.error('[kural-referans] kural dosyası yok: ' + KAYNAK);
  process.exit(1);
}

if (process.argv.includes('--kabul') || !fs.existsSync(REFERANS)) {
  const ilk = !fs.existsSync(REFERANS);
  fs.mkdirSync(REF_DIZIN, { recursive: true });
  fs.copyFileSync(KAYNAK, REFERANS);
  console.log(ilk
    ? '[kural-referans] referans ilk kez oluşturuldu: .kural-referans/mcpKurallar.js'
    : '[kural-referans] değişiklik kabul edildi, referans güncellendi.');
  process.exit(0);
}

const simdi = oku(KAYNAK).split('\n');
const ref = oku(REFERANS).split('\n');
if (simdi.join('\n') === ref.join('\n')) process.exit(0);

// Basit satır farkı: referansta olup şimdi olmayan (-) ve tersi (+).
const refKume = new Set(ref);
const simdiKume = new Set(simdi);
const silinen = ref.filter((l) => l.trim() && !simdiKume.has(l));
const eklenen = simdi.filter((l) => l.trim() && !refKume.has(l));

// Esneme şüphesi: muaf listesi, erişim ya da taban kural bayrağı değişti mi.
const SUPHE = /GELISTIRICI_EKIP|erisim:|gelistiriciyeUygulanir|KOTA_TABANI|kotaCarpani|return (null|true|5|3|2|1);/;
const supheli = [...silinen, ...eklenen].filter((l) => SUPHE.test(l));

let yazar = '(bilinmiyor)';
try {
  yazar = execSync('git log -3 --format="%h  %an  %ad  %s" --date=short -- server/src/lib/mcpKurallar.js', { cwd: KOK })
    .toString().trim();
} catch { /* git yoksa yazar bilinmez; uyarı yine basılır */ }

const cizgi = '═'.repeat(72);
console.log(`\n${cizgi}\n  UYARI — YAPAY ZEKÂ KURAL DOSYASI DEĞİŞTİ (server/src/lib/mcpKurallar.js)\n${cizgi}`);
console.log('Yerel referansla aynı değil. Kurallar esnetilmiş olabilir — incele.\n');
if (supheli.length) {
  console.log('!! ESNEME ŞÜPHESİ — muafiyet, erişim, taban kural ya da kota satırı değişti:');
  for (const l of supheli) console.log('   ' + (silinen.includes(l) ? '- ' : '+ ') + l.trim());
  console.log('');
}
console.log(`Silinen satır: ${silinen.length}   Eklenen satır: ${eklenen.length}`);
for (const l of silinen.slice(0, 40)) console.log('  - ' + l);
for (const l of eklenen.slice(0, 40)) console.log('  + ' + l);
console.log(`\nSon değişiklikler (kim, ne zaman):\n${yazar}\n`);
console.log('İnceledin ve uygunsa:  node server/scripts/kural-referans.mjs --kabul');
console.log(`${cizgi}\n`);
process.exit(0);
