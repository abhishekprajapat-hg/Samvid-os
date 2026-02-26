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
- `EXPO_PUBLIC_API_BASE_URL=http://<server>/api/client`
- `EXPO_PUBLIC_SOCKET_URL=http://<server>`
- `EXPO_PUBLIC_SOCKET_PATH=/socket.io`

## Run
```bash
cd mobile
npm install
npm run start
```

## Current scope
- Core features are working with real APIs: login, role-based tabs, leads, inventory, chat, users, reports summary.
- Web-only visuals/animations are intentionally replaced by mobile-native UI.
- Calendar/details/settings advanced flows are scaffolded and ready for next iteration.
