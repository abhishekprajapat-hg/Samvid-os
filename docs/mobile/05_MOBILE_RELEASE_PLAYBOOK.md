# Mobile Release Playbook

Distribution targets, in the order they'll be used:

1. **Sideload APK** — staff get builds directly, no review, fastest loop
2. **Google Play Store** — Android, public/managed distribution
3. **Apple App Store** — iOS

---

## 1. Current build configuration

`mobile/eas.json` already defines three profiles:

| Profile | Distribution | Android output | Use |
| --- | --- | --- | --- |
| `development` | internal | APK | Dev client + Metro |
| `preview` | internal | APK | **Sideload to staff** |
| `production` | store | AAB (default) | Play / App Store |

`appVersionSource: "remote"` and `autoIncrement: true` on production mean EAS
owns the build number — don't hand-edit it in `app.json`.

EAS project: `cc83e8b0-5b74-445f-81a9-338fe9648d25`
Android package: `com.theofficeonrent.crm`
OTA updates: `https://u.expo.dev/cc83e8b0-5b74-445f-81a9-338fe9648d25`,
`runtimeVersion.policy: "appVersion"`

## 2. Gaps to close before the first store submission

Each of these blocks or risks a submission. Owning phase in brackets.

| Gap | Impact | Phase |
| --- | --- | --- |
| **No iOS bundle identifier** in `app.json` | Cannot build for iOS at all | 10 |
| **App name is `the-office-on-rent`** | Shows as the slug on the home screen. Set a display name — e.g. "Office On Rent" | 10 |
| **Splash background `#000000`** | Matches neither theme; flashes black on launch | 1 |
| **`userInterfaceStyle: "light"`** | Dark mode can't engage | 1 |
| **No privacy policy URL** | Required by both stores | 8 + 10 |
| **Legal screens not in the app** | Store reviewers look for them | 8 |
| **No location permission strings** | Attendance check-in will crash on iOS | 3 |
| **No notification permission config** | Push can't register | 9 |
| **`newArchEnabled: false`** | Fine today; Expo is moving on. Note it, don't change it mid-port | — |
| **Camera/mic strings say "video calls" only** | Inaccurate once uploads ship — Apple rejects vague or wrong usage strings | 3 |

### Permissions to declare

Android (`app.json` → `android.permissions`), current list is
`CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `INTERNET`. Add:

```
ACCESS_FINE_LOCATION      ACCESS_COARSE_LOCATION    (attendance, field ops)
READ_MEDIA_IMAGES         READ_MEDIA_VIDEO          (uploads, Android 13+)
POST_NOTIFICATIONS                                  (push, Android 13+)
USE_BIOMETRIC                                       (biometric unlock)
```

iOS (`app.json` → `ios.infoPlist`) — every string must say what the app
actually does with the data, specifically:

```
NSCameraUsageDescription           — video calls AND document/photo capture
NSMicrophoneUsageDescription       — voice and video calls
NSPhotoLibraryUsageDescription     — attaching photos to leads and inventory
NSLocationWhenInUseUsageDescription— attendance check-in and field visits
NSFaceIDUsageDescription           — unlocking the app
```

## 3. Sideload APK (first channel to go live)

```bash
cd mobile
eas build --platform android --profile preview
```

Produces an APK on a download URL. Distribute to staff directly.

**Notes**
- Sideloaded APKs get no automatic updates. `expo-updates` is configured, so
  JS-only changes still push OTA — but a native change (new dependency, new
  permission) needs a fresh APK.
- The signing key must stay consistent or installs fail with a signature
  mismatch. Let EAS manage credentials; don't generate keystores locally.
- Android blocks unknown sources by default — staff need one-time "Install
  unknown apps" permission for whatever app opens the link.

## 4. Google Play Store

**One-time setup**
1. Play Console developer account (one-off fee)
2. Create the app; package `com.theofficeonrent.crm` must match `app.json`
3. Complete: Data Safety form, content rating, target audience, privacy policy
   URL, app access instructions

**Data Safety** — this app collects, at minimum: name, email, phone, precise
location (attendance), photos/documents (uploads), and in-app messages. Declare
all of it; a mismatch between the form and what the app does is the most common
cause of a Play rejection here.

**App access** — the whole app is behind a login. Play *requires* working
demo credentials for review. Create a dedicated reviewer account with a role
that can see a representative slice of the app, and put the credentials in the
App access section.

**Build and submit**
```bash
eas build --platform android --profile production   # AAB
eas submit --platform android --latest
```

Ship to **internal testing** first, then closed → open → production staged
rollout. Don't go straight to production.

## 5. Apple App Store

**One-time setup**
1. Apple Developer Program membership (annual)
2. App Store Connect record; add `ios.bundleIdentifier` to `app.json` first
3. App Privacy questionnaire — same disclosures as Play's Data Safety
4. Demo account credentials in App Review Information — same requirement as Play

**Build and submit**
```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

**Review risks specific to this app**

| Guideline | Risk | Mitigation |
| --- | --- | --- |
| 4.2 Minimum Functionality | An app that's mostly forms over a web API can read as "a website in a wrapper" | Ship Phase 9 first — push, biometrics, camera, location are the native value. Submit *after* Phase 9, not before |
| 5.1.1 Data Collection | Precise location + documents + messages is a broad collection surface | Accurate privacy answers; request location only at the point of check-in, with a clear pre-prompt |
| 5.1.2 Data Use | Staff data | Privacy policy must cover employee monitoring (attendance, live location) explicitly |
| 2.1 App Completeness | Placeholder screens | Phase 0's three placeholders **must** be real by Phase 8 |
| 4.0 Design | Non-native patterns | Phase 1's touch-target and safe-area rules |

> **Live location.** `App.jsx` calls `updateMyLiveLocation` — the web app
> tracks staff position. On iOS, continuous or background location for employee
> monitoring draws extra scrutiny and needs a precise justification in review
> notes. Confirm whether mobile needs *background* location or only
> *when-in-use*; when-in-use is a much easier review. Decide in Phase 3.

## 6. Versioning

| Field | Owner | Rule |
| --- | --- | --- |
| `expo.version` | Manual, in `app.json` | Semver. Bump on every store release |
| `runtimeVersion` | Derived (`appVersion`) | Changes with `version` — so an OTA update only reaches builds of the same version |
| Android `versionCode` | EAS (`autoIncrement`) | Never hand-edit |
| iOS `buildNumber` | EAS (`autoIncrement`) | Never hand-edit |

**The runtime version trap:** with `policy: "appVersion"`, bumping
`expo.version` cuts off OTA updates to everyone still on the old version. So:
bump `version` for native releases; keep it fixed when you intend to reach
existing installs over OTA.

## 7. OTA updates

```bash
eas update --branch production --message "Phase 4: leads parity"
```

**Can** ship over OTA: JS, styles, images in `assets/`, most screen work.
**Cannot**: new native dependencies (`react-native-maps` in Phase 5,
`expo-local-authentication` in Phase 9), permission changes, `app.json` native
config. Those need a full rebuild and a store release.

Map to the phase plan: Phases 3, 5, and 9 each add native dependencies, so each
needs a new binary. Phases 4, 7, 8 are mostly JS and can reach staff over OTA.

## 8. Pre-release regression checklist

Run for **every one of the 8 roles**, on a physical Android and a physical iOS
device, before any store submission:

- [ ] Login, session refresh on 401, logout, session timeout
- [ ] Every tab and every More-menu entry opens without error
- [ ] Reachable screens match web for the same account (the Phase 2 parity test)
- [ ] Create / edit / delete on leads, inventory, tasks
- [ ] Attendance check-in and check-out, with location granted and denied
- [ ] File upload from camera, gallery, and documents
- [ ] Chat send/receive, attachments, and a call
- [ ] Push received with the app killed; tapping it deep-links correctly
- [ ] Light and dark mode on every screen
- [ ] Airplane mode: clear error states, no infinite spinners
- [ ] Background for 10 minutes, return: socket reconnects, data refreshes
- [ ] Rotation and small-screen (≤ 360px) layout
- [ ] Legal screens reachable without a session

## 9. Post-release

- Crash reporting wired (Phase 8) and watched for the first 72 hours
- Staged rollout on Play: 10% → 50% → 100%, halting on a crash-rate regression
- Keep the previous APK available for sideload rollback
- `expo-updates` gives a fast JS rollback: re-publish the prior bundle to the
  branch rather than waiting on store review
