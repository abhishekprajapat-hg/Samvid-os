# Samvid OS Mobile (React Native)

This folder contains the mobile app conversion of the Samvid web frontend using the same backend APIs and business logic.

## What is reused from web app
- Same API endpoints (`/auth`, `/leads`, `/inventory`, `/users`, `/chat`)
- Same role-based access (`ADMIN`, `MANAGER`, `EXECUTIVE`, `FIELD_EXECUTIVE`)
- Same core service layer concepts (auth, leads, inventory, chat, reports)

## Mobile folder structure
- `src/services`: API + feature services (ported from web)
- `src/modules`: RN screens grouped by same business modules as web
- `src/context`: auth/session context
- `src/navigation`: auth stack + role tabs
- `src/storage`: AsyncStorage session handling
- `src/utils`: shared helpers

## Environment variables
Set in `.env` for Expo:
- `EXPO_PUBLIC_API_BASE_URL=https://nemnidhi.cloud/api`
- `EXPO_PUBLIC_SOCKET_URL=https://nemnidhi.cloud`
- `EXPO_PUBLIC_SOCKET_PATH=/socket.io`
- Default mode is cloud-first (including dev builds).
- Optional local API mode (Expo dev only): `EXPO_PUBLIC_USE_LOCAL_API=true`
- Optional TURN relay for production calling reliability:
  - `EXPO_PUBLIC_TURN_URL=turn:your-turn-host:3478`
  - `EXPO_PUBLIC_TURN_URLS=turn:your-turn-host:3478,turns:your-turn-host:5349`
  - `EXPO_PUBLIC_TURN_USERNAME=...`
  - `EXPO_PUBLIC_TURN_CREDENTIAL=...`

## Run
```bash
cd mobile
npm install
npm run start
```

## Calling-enabled run (required for audio/video calls)
- Build and install Android development client (one-time): `npm run android`
- Start Metro for dev client: `npm run start`
- Open installed app (not Expo Go), then connect to Metro.
- For cloud testing, keep `EXPO_PUBLIC_USE_LOCAL_API` unset/false so app stays on cloud URLs.

## Expo Go scan + Web
- Expo Go (no native WebRTC calling): `npm run start:go`
- Same WiFi LAN mode (dev client): `npm run start:lan`
- Web (port 19021): `npm run web`
- Important: scan the QR shown by `expo start` (Metro), not EAS/deployment QR.

## Current scope
- Core features are working with real APIs: login, role-based tabs, leads, inventory, chat, users, reports summary.
- Web-only visuals/animations are intentionally replaced by mobile-native UI.
- Calendar/details/settings advanced flows are scaffolded and ready for next iteration.
