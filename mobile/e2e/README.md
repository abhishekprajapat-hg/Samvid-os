# Samvid OS Mobile E2E

These flows are Maestro smoke and contract flows for the Expo SDK 54 mobile app.

## Prerequisites

- Install Maestro and make `maestro` available on `PATH`.
- Build or install a development client for the target device.
- Android uses `com.samvidos.crm` from `app.json`.
- iOS uses the `com.samvidos.crm` bundle identifier from `app.json` and requires macOS/Xcode. On Windows, iOS flows are documentation-ready but not executable locally.
- Point the app at an isolated backend/test tenant before running business flows. Do not run upload, call, or lead mutation flows against production data.

## Environment

Set these values before running login-based flows:

```powershell
$env:SAMVID_MOBILE_EMAIL="admin@test.com"
$env:SAMVID_MOBILE_PASSWORD="<test-password>"
```

## Commands

```powershell
npm run test:e2e:smoke
npm run test:e2e:android
npm run test:e2e:ios
```

## Coverage Intent

- `android/smoke.yaml` and `ios/smoke.yaml` cover fresh launch, login controls, session entry, and logout visibility.
- `android/business-smoke.yaml` covers navigation touchpoints for leads, inventory, tasks, attendance, chat, profile, and the More menu.
- Full native coverage for camera/gallery, document picker, microphone, notifications, geolocation, media upload, call persistence, and socket reconnection requires a running test backend plus emulator/simulator permissions. Keep those flows on isolated data only.
