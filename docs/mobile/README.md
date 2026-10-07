# Mobile App Documentation

Planning and specification set for bringing `mobile/` (Expo / React Native) to
parity with `frontend/` (the web app), for release on Google Play, the App
Store, and as a sideload APK.

Written 2026-09-21 against web reference commit `2ba5fdd`; parity closure was
re-audited on 2026-09-25 against the `mobile-web-parity` working tree. The
current result is [06_WEB_FEATURE_GAP_REGISTER.md](06_WEB_FEATURE_GAP_REGISTER.md).

## Read in this order

| # | Document | What it answers |
| --- | --- | --- |
| — | [**Progress**](PROGRESS.md) | **What is built so far, and what each phase actually delivered** |
| 00 | [Mobile Parity Spec](00_MOBILE_PARITY_SPEC.md) | What "parity" means, what state the app is in today, and exactly what is missing |
| 01 | [Design System Contract](01_MOBILE_DESIGN_SYSTEM.md) | The token and component definition of "exact same design" |
| 02 | [Navigation & Access Contract](02_MOBILE_NAVIGATION_AND_ACCESS.md) | How roles and permissions decide what a user sees, and the algorithm both apps share |
| 03 | [API Contract](03_MOBILE_API_CONTRACT.md) | The 249-endpoint backend surface and the mobile service layer that must cover it |
| 04 | [Implementation Phases](04_MOBILE_IMPLEMENTATION_PHASES.md) | The phase-by-phase build plan with acceptance gates |
| 05 | [Release Playbook](05_MOBILE_RELEASE_PLAYBOOK.md) | Build, sign, and ship to all three channels |

## The three things worth knowing up front

All three were the blocking problems at the start of this work. **All three are
now fixed** — see [PROGRESS.md](PROGRESS.md) for what shipped.

1. ~~**The mobile app does not compile.**~~ `RoleTabs.tsx` imported three
   screens that didn't exist. Fixed in Phase 0; all three are now real screens,
   and the root cause of a second failure (tsc parsing the `dist/` bundle) is
   fixed in `tsconfig.json`.

2. ~~**Mobile's design tokens are the pre-redesign palette.**~~ 1,252 hardcoded
   colour literals were migrated to the web redesign values, the token file was
   rewritten against `tailwind.config.js`, and a UI kit built to the web
   component contract. Fixed in Phase 1.

3. ~~**Mobile decides who sees what with hardcoded role checks.**~~
   `roleCanSeeItem` is now ported verbatim, tabs are computed rather than
   hardcoded, and every route carries a gate. Fixed in Phase 2, with 54 tests.

## Scope at a glance

- **54,531** lines of web module code is the reference
- **29,389** lines exist on mobile today
- **8** modules at parity · **14** partial · **15** missing *(at the start of the work)*
- **9** of 18 service modules had no mobile counterpart; **4** have since been added

## Running the checks

```bash
cd mobile
npm run typecheck                 # tsc --noEmit
npm test                          # mobile unit/invariant tests (220)
npx expo export --platform web    # bundle check
```

## Superseded

These are kept for history; the set above replaces them:

- `mobile/PARITY_QUEUE.md`
- `mobile/FRONTEND_MIGRATION_STATUS.md`
