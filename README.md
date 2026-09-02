# StoaBoard

Takımlar için gerçek zamanlı proje yönetim uygulaması. Workspace, proje, board, takvim, liste, notlar, chat ve bildirimler tek bir Node.js + React kabuğu içinde çalışır.

## Özellikler

- **Workspace & üyelik** — Davet kodu ile workspace'e katılma, roller ve özel rol başlıkları
- **Projeler** — İkon seçimi, üye atama, proje bazlı board/list/calendar/notes görünümleri
- **Board (Kanban)** — Sürükle-bırak kolonlar, "done" işaretli kolonlar, etiketler, atama tarihleri
- **Takvim & Liste** — Aynı görevlerin farklı görünümleri, start/due tarihleri, kişi bazlı atama tarihleri
- **Notlar** — Modal tabanlı not editörü, workspace görünürlüğü, görev linkleme
- **Chat** — Kanallar (default `general`), direkt mesaj, mesaj sabitleme, reply, soft delete, okundu bilgisi
- **Bildirimler** — Görev, mention, davet ve chat bildirimleri; Socket.IO ile canlı
- **Presence** — `online / away / dnd / offline` durumları, kullanıcı bazlı `away_timeout`
- **Auth** — E-posta + parola, Google Sign-In, şifre sıfırlama akışı
- **Tema sistemi** — `oklch()` + `color-mix()` üzerine kurulu accent renk sistemi, açık/krem/koyu tema, custom hex desteği. Marka rengi `#1a4a70` (navy).

## Teknoloji

**Backend** (`server/`)
- Node.js 20+ / Express 4
- Prisma ORM
- PostgreSQL (Neon)
- Socket.IO (real-time chat + presence)
- express-session + connect-pg-simple (PostgreSQL-backed sessions)
- google-auth-library, nodemailer, multer

**Frontend** (`client/`)
- React 18 + Vite 6
- Tek sayfa SPA; `client/src/` altında modüler JSX (views, modals, drawer, chat, notifications, palette, tweaks)
- `npm run build` çıktıyı `static/dist/`e yazar, sunucu oradan servis eder — ayrı bir frontend sunucusu yok

## Proje Yapısı

```
StoaBoard/
├── server/
│   ├── src/
│   │   ├── index.js            # HTTP + Socket.IO başlat
│   │   ├── app.js              # Express app + middleware
│   │   ├── config.js           # Env odaklı config
│   │   ├── db.js               # Prisma client (warmup ile)
│   │   ├── routes/             # auth, api, workspaces, projects, tasks,
│   │   │                       # channels, chat, notes, notifications, attachments
│   │   ├── sockets/chat.js     # Socket.IO event handler'ları
│   │   └── lib/                # password, session, rateLimit, user, workspace,
│   │                           # channels, notes, projects, uploads, serializers
│   ├── prisma/
│   │   └── schema.prisma       # DB şeması (Neon ile senkron)
│   └── package.json
├── client/
│   ├── src/
│   │   ├── main.jsx            # React giriş noktası
│   │   ├── app.jsx             # Uygulama kabuğu, state, socket
│   │   ├── shell.jsx           # Sidebar + topbar
│   │   ├── views/              # dashboard, board, list, calendar,
│   │   │                       # notes, settings, trash, auth, legal
│   │   ├── chat.jsx            # Sohbet paneli ve tam ekran sohbet
│   │   ├── data.jsx            # API sarmalayıcı + i18n (tr, en, de, es, ru)
│   │   └── styles.css          # oklch tabanlı tema
│   ├── index.html
│   └── vite.config.js          # build → ../static/dist, dev proxy → :5000
├── static/
│   ├── dist/                   # Vite build çıktısı (versiyonlanmaz)
│   └── *.png/svg               # marka asset'leri
├── railway.toml                # Railway deploy config
├── nixpacks.toml               # Node 20 pin
└── README.md
```

## Geliştirme

### Gereksinimler
- Node.js 20+
- PostgreSQL erişimi (önerilen: Neon ücretsiz tier)

### Adımlar

Sunucu ve istemci ayrı paketler; ikisinin de bağımlılıkları kurulmalı.

**1. Sunucu**

```bash
git clone https://github.com/crashnn/StoaBoard.git
cd StoaBoard/server

# .env önce oluşturulmalı.
cp .env.example .env
# DATABASE_URL, SECRET_KEY, GOOGLE_CLIENT_ID değerlerini doldur

npm install          # postinstall: yalnızca prisma generate
npm run dev          # nodemon, :5000
```

> **Not:** `postinstall` ve `npm start` artık şema göndermiyor (2 Eylül 2026).
> Şemayı kurmak için `npm run prisma:push` — bilerek, elle.

**2. İstemci**

```bash
cd ../client
npm install

# Google ile giriş butonu isteniyorsa (opsiyonel)
echo "VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com" > .env

npm run dev          # Vite, :5173 — /api ve /socket.io :5000'e proxy'lenir
```

Geliştirmede [http://localhost:5173](http://localhost:5173) kullanılır; Vite
API ve websocket isteklerini sunucuya yönlendirir.

Tek süreçte production gibi çalıştırmak için istemciyi derleyip sunucuyu başlat:

```bash
cd client && npm run build     # → static/dist
cd ../server && npm start      # → http://localhost:5000
```

### Önemli env değişkenleri

```env
# Zorunlu
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
SECRET_KEY=long-random-string-en-az-32-byte

# Opsiyonel
PORT=5000
NODE_ENV=development              # production'da otomatik tetiklenir
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:5000  # virgülle ayır; '*' tüm origin
SESSION_COOKIE_SECURE=false       # production'da true

# SMTP (şifre sıfırlama mailı için; yoksa konsola yazar)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@stoaboard.app
```

İstemci tarafında derleme anında okunan tek değişken var (`client/.env`):

```env
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

Sunucudaki `GOOGLE_CLIENT_ID` token'ı doğrular, istemcideki `VITE_GOOGLE_CLIENT_ID`
ise giriş butonunu çizer. **İkisi de aynı değeri almalı**; yalnızca biri verilirse
Google girişi çalışmaz.

## Production Deploy (Railway)

`GitHub → Railway → Neon PostgreSQL` akışı:

1. Railway'de yeni proje, GitHub repo'sunu bağla
2. Environment Variables ekle:
   - `DATABASE_URL` (Neon'dan al, `?sslmode=require` ile)
   - `SECRET_KEY` (32+ byte rastgele)
   - `SESSION_COOKIE_SECURE=true`
   - `NODE_ENV=production`
   - `GOOGLE_CLIENT_ID` (opsiyonel)
3. Deploy otomatik tetiklenir

[railway.toml](railway.toml) build ve start komutlarını yönetir:
- Build: `cd client && npm ci && npm run build && cd ../server && npm ci`
- Start: `cd server && npm start`
- Healthcheck: `GET /`

Yani istemci derlemesi de dağıtımın parçası: Railway `static/dist`i build sırasında
üretir, sunucu onu servis eder. `VITE_GOOGLE_CLIENT_ID` Railway'de tanımlı olmalı —
build anında okunur, çalışma anında değil.

> **Uyarı:** `chat upload` ve `task attachment` dosyaları PostgreSQL'de bytea olarak tutulur. Bu, Railway gibi efemer filesystem'lerde kayıp riskini önler. Yüksek hacimli kullanım için Cloudinary/S3/R2 entegrasyonu önerilir.

## Tema & Renk Sistemi

Accent renk sistemi `oklch()` + `color-mix()` üzerine kuruludur. Yeni renk eklerken hex yerine oklch tercih edilir; soft/softer/ink türevleri otomatik üretilir.

- CSS değişkenleri: [client/src/styles.css](client/src/styles.css) → `:root` (default navy) + `[data-accent="..."]` + `[data-accent="custom"]`
- Accent state: `localStorage.stoa.tweaks` JSON, anahtar `accent` ve opsiyonel `accentHex`
- App.jsx içinde `document.documentElement.dataset.accent` set edilir; `custom` durumunda `--accent` inline yazılır
- Auth ekranları (`client/src/views/auth.jsx`) bilinçli olarak hardcoded `#1a4a70` kullanır — login öncesi tweaks yüklü değildir

## Güvenlik Notları

- `SECRET_KEY` production'da env üzerinden zorunlu
- CORS env ile kısıtlanır (`CORS_ORIGINS`)
- Rate limiting (`/api/auth` için 15 dk içinde 30 deneme), session lifetime 30 gün, HttpOnly + SameSite=Lax cookie
- Production'da `SESSION_COOKIE_SECURE=true` ile HTTPS zorunlu
- `X-Content-Type-Options`, `X-Frame-Options=SAMEORIGIN`, `Referrer-Policy` header'ları
- Upload limiti 10 MB; attachment 20 MB; chat upload 50 MB
- Şifre hash: Node'un yerleşik `crypto.scryptSync` (werkzeug scrypt formatıyla uyumlu)
- Session store: PostgreSQL (`connect-pg-simple`), server restart'ında oturum kaybı yok

## Belgeler

| Dosya | İçerik |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code için yönlendirme — durum, tuzaklar, çalışma biçimi |
| [TODO.md](TODO.md) | Kapatılanlar ve sıradakiler, gerekçeleriyle |
| [GUVENLIK.md](GUVENLIK.md) | Tehdit modeli ve her yeni özelliğin geçmesi gereken elek |
| [TOPLANTI-KARSILIGI.md](TOPLANTI-KARSILIGI.md) | Toplantı geri bildirimlerinin karşılığı |
| [BILDIRIMLER.md](BILDIRIMLER.md) | Bildirim sisteminin durumu ve karar bekleyen tasarım soruları |
| [RAPORLAMA-TESTI.md](RAPORLAMA-TESTI.md) | `raporlama` dalını başka makinede ayağa kaldırma ve test |

## Testler

```bash
cd server
npm test          # Windows PowerShell'de: npm.cmd test
```

54 test, veritabanı gerektirmez. Kapatılan güvenlik kusurlarının regresyon
korumaları ve bütün sunucu modüllerinin yüklendiğini doğrulayan smoke testi.

## Lisans

Özel proje. Yayım hakları sahibine aittir.
