# Hesap geçişi — yeni Claude hesabıyla ilk oturum

15 Eylül 2026'da Claude Code başka bir Claude hesabına geçirildi (eski hesabın
haftalık limiti yetmedi). **Depodaki her şey yerinde; önemli olan depo
dışındakiler.** Bu dosya onların listesi.

**Yeni oturumdaki Claude:** önce bu dosyayı, sonra [DEVIR.md](DEVIR.md) ve
[CLAUDE.md](CLAUDE.md) dosyalarını oku. Bölüm 1 ve 2'yi kontrol et, eksik
kalanı kullanıcıya tek listede bildir.

---

## 1. Hesaba bağlı: yeni hesapta YOK, kurulmalı

| # | Ne | Nasıl | Neden |
|---|---|---|---|
| 1 | **StoaBoard MCP bağlayıcısı** — ✅ 15 Eylül'de kuruldu, `whoami` ile doğrulandı | claude.ai → Settings → Connectors → özel bağlayıcı → `https://www.stoaboard.com/mcp` | Kart okuma/yazma. Bağlayıcı ayarı eski hesapta kaldı. MCP anahtarı sunucu tarafında (Railway ortam değişkeni) olduğu için aynı anahtar geçerli |
| 2 | Notion bağlayıcısı | claude.ai → Connectors | Yalnızca kullanılacaksa |
| 3 | Figma bağlayıcısı | claude.ai → Connectors | Yalnızca tasarım işi varsa |
| 4 | Artifact'lar | Sunum sayfası 15 Eylül'de yeni hesaptan yeniden yayımlandı: https://claude.ai/artifact/UDvf3wAgHpTGKf9m1X2fzx (kaynak: `TOPLANTI-2-SUNUM.html`) | Eski hesaptakiler taşınamaz |
| 5 | Abonelik / extra usage | claude.ai → Billing (**tarayıcıdan**, Play Store'dan değil) | Play Store aboneliğinde extra usage sekmesi açılmıyor |

### StoaBoard bağlayıcısını kurma (15 Eylül'de yapıldı, adımlar doğrulanmış)

Anahtar ve slug tek yerde: **Railway → StoaBoard servisi → Variables →
`STOA_MCP_TOKENS`**. Değer `slug:anahtar` biçiminde (`eray:s0k2…` gibi);
iki nokta öncesi StoaBoard kullanıcı slug'ı, sonrası anahtar. Anahtar
veritabanında tutulmuyor, sunucu yalnızca özetini belleğe alıyor
([mcpToken.js](server/src/lib/mcpToken.js)); Railway dışında tek kopya
iki makinenin `server/.env`'i (ofis makinesine 15 Eylül'de yazıldı).

Eski anahtarı bulamıyorsan ya da eski hesabın erişimini kesmek istiyorsan
yenisini üret ve Railway'de değeri değiştir (yeniden dağıtım gerekir):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

claude.ai → Settings → Connectors → **Add custom connector**:

| Alan | Değer |
|---|---|
| URL | `https://www.stoaboard.com/mcp` (kök adres değil, `/mcp` ile) |
| Authentication | **No sign-in**. Ekran "Sign in now — Detected" gösterir; `/.well-known` 404 döndüğü hâlde gösteriyor (401'i OAuth sanıyor olabilir). Aldırma, No sign-in seç |
| Request headers | `x-auth-token` = `<anahtar>` (yalnızca anahtar; `Bearer ` öneki de kabul edilir), Required işaretli |

Connect → "Connected to StoaBoard". Ardından Tool permissions ekranı gelir;
araç başlıkları Türkçe görünür (sunucu `title_language: tr`).

`Authorization` başlığı o ekranın listesinde yok, bu yüzden sunucu
`x-auth-token`u da kabul ediyor ([mcpAuth.js](server/src/lib/mcpAuth.js)).

**Tuzak (15 Eylül'de düşüldü):** başlığa `slug:anahtar` yazılırsa sunucu
401 döner, bağlayıcı da OAuth kaydına düşüp *"Couldn't register with
StoaBoard's sign-in service"* der. Hata OAuth'la ilgili görünür ama sebep
yanlış anahtardır. Başlığa iki nokta öncesi olmadan yalnızca anahtar
girilir. Curl ile teyit edildi: yalnızca anahtar → 200, `slug:anahtar` → 401.

Canlıdaki çift 15 Eylül'den beri `eray-atalay-3:…` (öncesinde `eray-atalay`
idi; slug Railway'de değiştirildi, anahtar aynı kaldı, yeniden dağıtıldı).
`whoami` bu anahtarla `eray-atalay-3` / Eray Atalay, "StoaBoard Geliştirme"
alanında owner döndürüyor.

Bağlayıcı eklendikten sonra **Claude Code'u yeniden başlat**. Bağlayıcı
açılışta hemen görünmeyebilir: 15 Eylül'de oturum açıldığında yoktu, bir iki
dakika sonra oturum içinde kendiliğinden bağlandı. `/mcp` listede göstermeli.

Doğrulama: Claude'a `whoami` çağırt. Yanıtta aktif alan ve
`available_tools` görünmeli (MCP 0.6.0). Kurulumda "Detected OAuth" gibi
bir tuhaflık çıkarsa bkz. CLAUDE.md → `/.well-known` tuzağı.

Canlıya karşı `mcp:tara` koşmak istersen aynı `slug:anahtar` çiftini
`server/.env`'e `STOA_MCP_TOKENS=` olarak yaz; betik anahtarı oradan okuyor.

## 2. Makinede duran, hesaptan bağımsız: dokunma, sadece kontrol et

15 Eylül'de yerinde oldukları doğrulandı:

- [x] **`server/.env`**: gitignore'da, yalnızca bu makinede. Yerel Neon dalı
      bağlantısı ve (15 Eylül'den beri) `STOA_MCP_TOKENS` burada; canlıya
      karşı `mcp:tara` bu yüzden bu makineden koşulabilir. Kökte `.env` yok
      (iki .env tuzağı geçerli değil). **Ev makinesinde ayrı bir kopyası
      var**; biri değişirse öteki elle güncellenir.
- [x] **`git config core.hooksPath` → `.githooks`**: makine başına bir kez
      yapılır, hesapla ilgisi yok.
- [x] **`~/.claude/settings.json`**: `model: opus`, `effortLevel: max`,
      `agentPushNotifEnabled: true`. Hesap değişince korunur.
- [x] **Oturum geçmişi** `~/.claude/projects/...StoaBoard/*.jsonl` içinde.
      `/resume` ile eski oturumlar açılabilir.
- [x] **Memory klasörü** aynı dizinde (şu an boş).
- `~/.claude/.credentials.json`: eski hesabın girişi. `/logout` + `/login`
      bunu değiştirir, elle dokunma.

Claude hesabıyla hiç ilgisi olmayanlar: **Railway** (canlı ortam
değişkenleri), **Neon** (üretim + yerel test dalı), **GitHub** `crashnn`
(CI faturalandırma kilidi hâlâ duruyor, koruyan şey pre-push kancası).

## 3. İlk komutlar

```bash
git fetch && git status          # proje iki makinede sürüyor
cd server && npm test            # 485 test, hepsi geçmeli
# MCP'ye dokunulacaksa, canlıya karşı:
MCP_URL=https://www.stoaboard.com/mcp npm run mcp:tara
```

## 4. Kaldığımız yer

Son iş MCP 0.6.0 (DEVIR 0-V). Sıradaki: **kişinin kendi MCP anahtarını
alabilmesi.** Genel öncelik listesi CLAUDE.md → "Sıradaki işler".

---

Geçiş tamamlanınca bu dosya silinebilir ya da özü DEVIR.md'ye tek satır
olarak eklenebilir.
