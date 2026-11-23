# SERPENTIS — Multi-Platform Deployment Guide

This guide covers deploying and maintaining **SERPENTIS** across:
- **GitHub** (two-way source control + GitHub Actions CI/CD)
- **Cloudflare Workers + Durable Objects + D1** (real-time 2–12 player authoritative server & WebRTC signaling)
- **Cloudflare Pages** (global HTTPS frontend static hosting)
- **Android APK** (Capacitor WebView wrapper with native `RECORD_AUDIO` microphone permissions)
- **Windows EXE / Installer** (Tauri v2 desktop application with WebView2 & NSIS/MSI bundles)
- **Local / Node.js Server** (preserved `server.ts` + SQLite workflow via `npm run dev` / `npm start`)

---

## 1. GitHub Repository & Two-Way Synchronization

### Initial Push from Local Workspace
```bash
git init -b main
git add .
git commit -m "feat: multi-platform deployment setup (Cloudflare, Capacitor, Tauri, CI)"
git remote add origin https://github.com/<YOUR_ORG_OR_USER>/<YOUR_REPO>.git
git push -u origin main
```

### Two-Way Sync Workflow
- **Pull remote changes before working**:
  ```bash
  git pull --rebase origin main
  ```
- **Push local changes back to GitHub**:
  ```bash
  git status
  git add .
  git commit -m "describe your update"
  git push origin main
  ```
- Never commit `.env`, `data/`, `*.keystore`, `*.jks`, or generated build directories (all excluded in `.gitignore`).

### Required GitHub Repository Variables & Secrets
Configure in **GitHub → Repository → Settings → Secrets and variables → Actions**:

**Repository Variables (`vars`)**:
- `VITE_API_BASE_URL` — e.g. `https://deep-tile-multiplayer.<your-subdomain>.workers.dev`
- `VITE_WS_BASE_URL` — e.g. `wss://deep-tile-multiplayer.<your-subdomain>.workers.dev/ws`
- `CLOUDFLARE_D1_DATABASE_ID` — UUID returned when creating D1 (`deep-tile-db`)
- `CLOUDFLARE_PAGES_PROJECT` — Cloudflare Pages project name (default: `deep-tile`)

**Repository Secrets (`secrets`)**:
- `CLOUDFLARE_API_TOKEN` — API token with **Workers Scripts:Edit**, **Durable Objects:Edit**, **D1:Edit**, **Cloudflare Pages:Edit**
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare Account ID
- *(Optional for signed release APKs)*: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`

---

## 2. Cloudflare Workers, Durable Objects & D1 Backend

The `/cloudflare/` directory mirrors every endpoint and WebSocket game mechanic from `server.ts`, `server/db.ts`, and `server/multiplayerManager.ts` using edge-compatible primitives (`D1Database`, `PresenceHubDO`, `GameRoomDO`, and Web Crypto PBKDF2-SHA256 auth).

### Setup Steps
1. Authenticate Wrangler CLI:
   ```bash
   npx wrangler login
   ```
2. Create the D1 database and copy the outputted `database_id`:
   ```bash
   cd cloudflare
   npx wrangler d1 create deep-tile-db
   ```
3. Paste the `database_id` into `cloudflare/wrangler.toml` (and/or add it as `CLOUDFLARE_D1_DATABASE_ID` in GitHub Actions variables).
4. Apply the SQL schema migration:
   ```bash
   npx wrangler d1 migrations apply deep-tile-db --remote
   ```
5. *(Optional for strict mobile NAT traversal in voice chat)* Set TURN relay secrets:
   ```bash
   npx wrangler secret put VOICE_TURN_URL
   npx wrangler secret put VOICE_TURN_USERNAME
   npx wrangler secret put VOICE_TURN_CREDENTIAL
   ```
6. Deploy the Worker + Durable Objects:
   ```bash
   npx wrangler deploy
   ```
   Copy the deployed `https://deep-tile-multiplayer.<subdomain>.workers.dev` URL.

> **Note on CORS**: By default `ALLOWED_ORIGINS = "*"` in `cloudflare/wrangler.toml` so Cloudflare Pages, Capacitor (`https://localhost`), and Tauri (`http://tauri.localhost`) connect immediately. For strict origin locking in production, set `ALLOWED_ORIGINS = "https://your-pages-domain.pages.dev,https://localhost,http://tauri.localhost,tauri://localhost"`.

---

## 3. Cloudflare Pages Frontend Deployment

1. Build the static frontend bundle pointing to your deployed Worker:
   ```bash
   VITE_API_BASE_URL="https://deep-tile-multiplayer.<subdomain>.workers.dev" \
   VITE_WS_BASE_URL="wss://deep-tile-multiplayer.<subdomain>.workers.dev/ws" \
   npm run build
   ```
2. Deploy `dist/` to Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name=deep-tile
   ```
   `public/_headers` automatically sets `Permissions-Policy: microphone=(self)` and cache headers on Cloudflare Pages.

If connecting Cloudflare Pages directly to GitHub:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Environment variables**: `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`

---

## 4. Android APK Packaging (Capacitor)

`capacitor.config.ts` uses `androidScheme: 'https'` so Android WebView runs in a secure HTTPS context required by WebRTC `getUserMedia()` for live voice chat.

### Prerequisites
- Android Studio / Android SDK + JDK 21 installed locally (or use GitHub Actions workflow `.github/workflows/android-apk.yml`).

### Build Locally
```bash
# 1. Build frontend pointing to remote Worker backend
VITE_API_BASE_URL="https://deep-tile-multiplayer.<subdomain>.workers.dev" \
VITE_WS_BASE_URL="wss://deep-tile-multiplayer.<subdomain>.workers.dev/ws" \
npm run build

# 2. Initialize native Android project & inject RECORD_AUDIO / INTERNET permissions (first time only)
npm run cap:android:init

# 3. For subsequent updates after editing web code:
npm run cap:sync

# 4. Compile Debug APK
cd android && ./gradlew assembleDebug
```
Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

For Play Store / release distribution:
- Generate a `.keystore` with `keytool`, keep it outside Git, and build `./gradlew assembleRelease` (or add the keystore secrets in GitHub Actions to produce signed APKs automatically).

---

## 5. Windows Desktop EXE Packaging (Tauri v2)

Desktop configuration resides in `/src-tauri/` (`tauri.conf.json`, `Cargo.toml`, `src/main.rs`, `src/lib.rs`, `capabilities/default.json`, `icons/icon.ico`).

### Prerequisites (Windows Machine or `windows-latest` CI Runner)
- Rust toolchain (`rustup`)
- Microsoft C++ Build Tools & Edge WebView2 Runtime
- Node.js 22+

### Build Locally on Windows
```powershell
$env:VITE_API_BASE_URL="https://deep-tile-multiplayer.<subdomain>.workers.dev"
$env:VITE_WS_BASE_URL="wss://deep-tile-multiplayer.<subdomain>.workers.dev/ws"
npm run tauri:build
```
Outputs:
- `src-tauri/target/release/serpentis.exe`
- `src-tauri/target/release/bundle/nsis/SERPENTIS_1.0.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/SERPENTIS_1.0.0_x64_en-US.msi`

Or trigger `.github/workflows/windows-exe.yml` directly in GitHub Actions to download built Windows `.exe` / `.msi` artifacts without needing a local Windows machine.

---

## 6. Local Single-Server Development (Preserved)

Leaving `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` unset keeps the original Node.js + Express + WebSocket + SQLite server unchanged:
```bash
npm run dev              # Development (Express + ws + Vite on port 3000)
npm run test:multiplayer # Multiplayer & Voice signaling test suite
npm run build && NODE_ENV=production npm start
```
