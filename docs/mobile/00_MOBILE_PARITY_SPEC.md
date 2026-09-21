# Mobile Parity Spec — The Office On Rent

**Status:** Draft 1 · 2026-09-21
**Owner:** Abhishek Prajapat
**Reference implementation:** `frontend/src` (the web app)
**Target:** `mobile/` (Expo / React Native)

---

## 1. Goal

Make the mobile app match the web app: same screens, same data, same rules,
same visual language — on Android (Play Store + sideload APK) and iOS (App Store).

## 2. What "exact same" means here, precisely

The instruction was "exact same design, exact same functions." Two of those
three words need a definition before anyone can tell whether a phase is done,
because React Native has no CSS, no Tailwind, no DOM, and no hover state.

| Dimension | Contract |
| --- | --- |
| **Functions** | **Literal parity.** Every action a role can take on web, it can take on mobile, against the same endpoint, with the same validation, the same permission gate, and the same resulting state. No mobile-only shortcuts, no silently dropped fields. This is testable and is the hard acceptance bar. |
| **Data** | **Literal parity.** Same fields shown, same formatting (currency, dates, area units), same sort/filter/search semantics. |
| **Design** | **Token parity, not pixel parity.** Mobile reproduces the web's colour tokens, radii, type scale, elevation, and component anatomy exactly (see `01_MOBILE_DESIGN_SYSTEM.md`). Layout adapts to a phone: tables become cards, sidebars become tabs, hover becomes press. A screen is "done" when a person who knows the web app recognises the mobile screen instantly and finds every control. |

**Why design is not literal:** a 12-column data grid at 1440px cannot be
reproduced at 390px without becoming unusable. Forcing it would satisfy the
letter of "exact design" and break the actual goal, which is that the app is
the same product. Every layout adaptation is written down per-screen in the
phase docs so this stays a decision, not a drift.

## 3. Current state — audit as of 2026-09-21

### 3.1 The mobile app does not currently compile

`npx tsc --noEmit` in `mobile/`:

```
src/navigation/RoleTabs.tsx(24,39): error TS2307: Cannot find module '../modules/reports/RoleLeaderboardScreen'
src/navigation/RoleTabs.tsx(27,34): error TS2307: Cannot find module '../modules/attendance/AttendanceScreen'
src/navigation/RoleTabs.tsx(30,36): error TS2307: Cannot find module '../modules/admin/AdminMetaAdsScreen'
```

`mobile/src/navigation/RoleTabs.tsx` imports three screens that do not exist on
disk and are not in git (`git ls-files mobile` → 69 files, none of them these).
Nothing can ship until this is fixed. It is Phase 0.

### 3.2 Size of the gap

| | Web (`frontend/src/modules`) | Mobile (`mobile/src`) |
| --- | ---: | ---: |
| Lines of code | 54,531 | 29,389 |
| Module directories | 18 | 15 |

Mobile is not a stub — `LeadDetailsScreen.tsx` is 4,961 lines, larger than the
web original it mirrors. The gap is concentrated in **whole modules that were
never started**, not in shallow versions of everything.

### 3.3 Module-by-module gap matrix

Legend: **✅ present** · **🟡 partial** · **❌ missing** · **➖ out of scope**

| Web module | LOC | Mobile counterpart | LOC | State | Notes |
| --- | ---: | --- | ---: | :---: | --- |
| `auth/Login` | — | `auth/LoginScreen` | 377 | ✅ | Re-theme only |
| `manager/ManagerDashboard` | — | `manager/ManagerDashboardScreen` | 1,225 | ✅ | |
| `executive/ExecutiveDashboard` | 402 | `executive/ExecutiveDashboardScreen` | 326 | ✅ | |
| `field/FieldDashboard` | 183 | `field/FieldDashboardScreen` | 439 | ✅ | |
| `field/FieldOps` (+3 cmp) | 917+457 | `field/FieldOpsScreen` | 721 | 🟡 | Map section needs native map |
| `leads/LeadsMatrix` (+6 cmp) | 3,835+4,974 | `leads/LeadsMatrixScreen` | 929 | 🟡 | Filters flyout, pipeline views, team view missing |
| `leads/LeadDetailsRebuilt` | 3,556 | `leads/LeadDetailsScreen` | 4,961 | 🟡 | Verify against rebuilt web version + admin approval branches |
| `inventory/AssetVault` (+4 cmp) | 4,568+951 | `inventory/AssetVaultScreen` | 2,325 | 🟡 | Request/review workflow depth |
| `inventory/InventoryDetails` | 618 | `inventory/InventoryDetailsScreen` | 1,546 | ✅ | |
| `inventory/OwnerDatabase` | — | — | — | ❌ | Not started |
| `inventory/BrokerDatabase` | — | — | — | ❌ | Not started |
| `inventory/Projects` | 1,949 | — | — | ❌ | Not started |
| `inventory/ProjectDetails` | 416 | — | — | ❌ | Not started |
| `inventory/SharedInventoryView` | — | — | — | ❌ | Public share-token view |
| `attendance/AttendanceHub` | 1,744 | **referenced, absent** | — | ❌ | **Breaks the build** |
| `attendance/AttendanceViolations` | 169 | — | — | ❌ | |
| `tasks/TaskManager` | 3,054 | `tasks/TaskManagerScreen` | 1,547 | 🟡 | |
| `calendar/MasterSchedule` | 1,098 | `calendar/MasterScheduleScreen` | 622 | 🟡 | |
| `chat/TeamChat` (+1 cmp) | 3,138+244 | `chat/TeamChatScreen` + 3 | 773+2,435 | 🟡 | Admin alert pathways, role badges |
| `finance/FinancialCore` | 945 | `finance/FinancialCoreScreen` | 1,145 | ✅ | |
| `reports/IntelligenceReports` (+1) | 604+396 | `reports/IntelligenceReportsScreen` | 668 | 🟡 | |
| `reports/Performance` | 338 | `reports/PerformanceScreen` | 1,494 | ✅ | |
| `reports/RoleLeaderboard` | 354 | **referenced, absent** | — | ❌ | **Breaks the build** |
| `admin/TeamManager` (+2 cmp) | 999+1,186 | `admin/TeamManagerScreen` | 838 | 🟡 | Advanced cards/panels |
| `admin/UserDetailsEditor` | 1,786 | `admin/UserDetailsEditorScreen` | 381 | 🟡 | Large gap |
| `admin/AdminCommandConsole` | 3,830 | `admin/AdminCommandConsoleScreen` | 505 | 🟡 | Large gap |
| `admin/AdminNotifications` | 1,597 | `notifications/NotificationsScreen` | 1,176 | 🟡 | Full filter/action stack |
| `admin/AdminMetaAdsPanel` | 417 | **referenced, absent** | — | ❌ | **Breaks the build** |
| `admin/SystemSettings` | 277 | `admin/SystemSettingsScreen` | 311 | ✅ | |
| `profile/UserProfile` | 931 | `profile/UserProfileScreen` | 478 | 🟡 | Role-specific summary cards |
| `coworking/booking/*` | ~2,700 | — | — | ❌ | Booking board, floor plans, KYC, cabins |
| `coworking/clients/*` | ~530 | — | — | ❌ | Clients page + profile |
| `production/ProductionExecutiveDashboard` | 255 | — | — | ❌ | Role has no mobile home |
| `legal/DataUseNotice` | 100 | — | — | ❌ | **Store submission needs this** |
| `legal/ServiceTermsNotice` | 105 | — | — | ❌ | **Store submission needs this** |
| `manager/LeadPool` | 116 | — | — | ➖ | Desktop-heavy; folded into leads |
| `portal/ClientHome` | 345 | — | — | ➖ | Separate `client-portal/` app |
| `portal/ClientListing` | 248 | — | — | ➖ | Separate `client-portal/` app |
| `dev/KitchenSink` | 253 | — | — | ➖ | Dev-only route |

**Totals:** 8 modules ✅ · 14 🟡 · 15 ❌ · 4 ➖

### 3.4 Design system drift

`mobile/src/theme/tokens.ts` is the **pre-redesign palette**. The web app has
since moved to a new token system. They currently disagree on nearly every value:

| Token | Web (current) | Mobile (stale) |
| --- | --- | --- |
| Primary | `#2549d6` | `#2563eb` |
| Background | `#f5f7fa` | `#f6f8fb` |
| Surface | `#ffffff` | `#f7fbff` |
| Border | `#e0e5ed` | `#e2e8f0` |
| Text | `#161c24` | `#0f172a` |
| Muted text | `#6c7789` | `#64748b` |
| Radius (sm/md/lg) | `7 / 10 / 14` | `12 / 14 / 18` |
| Dark theme | Full (`html.theme-dark`) | **None** |

Mobile also hardcodes colours outside the token file — `RoleTabs.tsx` sets
`tabBarActiveTintColor: "#0f172a"` inline. Phase 1 fixes both.

### 3.5 Service layer gap

Web has 18 service modules, mobile has 11. Missing on mobile:

`accessService` · `attendanceService` · `permissionService` · `projectService` ·
`publicInventoryService` · `pushService` · `roleService` · `saasService` · `uploadService`

`permissionService` and `accessService` are the blocking ones — without them
mobile cannot evaluate the page-access model that web enforces, so role
visibility on mobile is currently a hardcoded approximation rather than the
real rule. See `02_MOBILE_NAVIGATION_AND_ACCESS.md`.

## 4. Non-goals

- The client portal (`client-portal/`) stays a separate web app.
- `KitchenSink` and other dev-only routes are not ported.
- Tablet-optimised layouts. `supportsTablet` is on for iOS, but phone layout is
  the design target; tablet gets the phone layout scaled.
- Offline-first / local write queue. Mobile assumes connectivity, same as web.

## 5. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Web keeps moving during the port | Parity target drifts | Pin a reference commit per phase; re-diff at phase close |
| Double maintenance forever | Every web feature costs twice | Accepted trade-off of the native-port decision; keep shared logic in `services/` mirroring web 1:1 so only view code differs |
| iOS App Store review | Rejection, delay | Legal screens (Phase 8) + real native value (push, camera, biometrics) shipped before first submission |
| `AdminCommandConsole` is 3,830 LOC | Single largest screen | Phase 7 splits it into sub-screens rather than one monolith |
| Coworking module never started | ~2,700 LOC cold start | Phase 6 budgeted accordingly; depends on permission layer from Phase 2 |

## 6. Document set

| Doc | Purpose |
| --- | --- |
| `00_MOBILE_PARITY_SPEC.md` | This file — scope, audit, gap matrix |
| `01_MOBILE_DESIGN_SYSTEM.md` | Token + component contract (the "exact design" definition) |
| `02_MOBILE_NAVIGATION_AND_ACCESS.md` | Navigation model, roles, permissions, page access |
| `03_MOBILE_API_CONTRACT.md` | Backend surface and the mobile service layer that must cover it |
| `04_MOBILE_IMPLEMENTATION_PHASES.md` | Phase-by-phase plan with acceptance criteria |
| `05_MOBILE_RELEASE_PLAYBOOK.md` | Build, sign, and ship to Play Store / App Store / sideload |
