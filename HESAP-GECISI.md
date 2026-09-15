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
| 1 | **StoaBoard MCP bağlayıcısı** | claude.ai → Settings → Connectors → özel bağlayıcı → `https://www.stoaboard.com/mcp` | Kart okuma/yazma. Bağlayıcı ayarı eski hesapta kaldı. MCP anahtarı sunucu tarafında (Railway ortam değişkeni) olduğu için aynı anahtar geçerli |
| 2 | Notion bağlayıcısı | claude.ai → Connectors | Yalnızca kullanılacaksa |
| 3 | Figma bağlayıcısı | claude.ai → Connectors | Yalnızca tasarım işi varsa |
| 4 | Artifact'lar | — | Eski hesapta kaldı, taşınamaz |
| 5 | Abonelik / extra usage | claude.ai → Billing (**tarayıcıdan**, Play Store'dan değil) | Play Store aboneliğinde extra usage sekmesi açılmıyor |

Doğrulama: bağlayıcıdan sonra Claude'a `whoami` çağırt. Yanıtta aktif alan
ve `available_tools` görünmeli (MCP 0.6.0). Kurulumda "Detected OAuth" gibi
bir tuhaflık çıkarsa bkz. CLAUDE.md → `/.well-known` tuzağı.

## 2. Makinede duran, hesaptan bağımsız: dokunma, sadece kontrol et

15 Eylül'de yerinde oldukları doğrulandı:

- [x] **`server/.env`**: gitignore'da, yalnızca bu makinede. Yerel Neon dalı
      bağlantısı ve MCP tarama anahtarı burada. Kökte `.env` yok (iki .env
      tuzağı geçerli değil). **Ev makinesinde ayrı bir kopyası var**; biri
      değişirse öteki elle güncellenir.
- [x] **`git config core.hooksPath` → `.githooks`**: makine başına bir kez
      yapılır, hesapla ilgisi yok.
- [x] **`~/.claude/settings.json`**: `model: opus`, `effortLevel: low`,
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
