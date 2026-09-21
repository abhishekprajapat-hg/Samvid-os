# Mobile Implementation Phases

**How to use this:** phases run in order. Each has a gate — the phase is not
done until every box is ticked, and the next phase does not start early. The
ordering is dependency-driven, not preference: Phase 2 gates every screen phase
after it, so doing screens first means redoing their access checks later.

**Sizing** is relative, derived from the LOC to port (see the gap matrix in
`00_MOBILE_PARITY_SPEC.md`): **S** < 500 · **M** 500–2,000 · **L** 2,000–5,000 ·
**XL** > 5,000 lines of reference code.

**Per-phase ritual**
1. Record the web reference commit at phase start (`git rev-parse HEAD`).
2. Build against that commit only — ignore web changes mid-phase.
3. At phase close, diff web since that commit and file anything new as backlog.
4. `npx tsc --noEmit` and `npx expo export --platform web` must pass.

---

## Phase 0 — Unbreak the build · **S**

Nothing can be verified while the app doesn't compile. This is the only phase
with no design or parity work.

**Scope**
- `src/modules/attendance/AttendanceScreen.tsx`
- `src/modules/reports/RoleLeaderboardScreen.tsx`
- `src/modules/admin/AdminMetaAdsScreen.tsx`

All three are imported by `RoleTabs.tsx` and absent from disk and from git.

**Approach:** create them as real but minimal screens — header, loading state,
`AppEmptyState` placeholder — wired into navigation. Do **not** stub them as
`null`; a stub that renders nothing is indistinguishable from a bug later.
Full implementations land in Phases 3, 8, and 7 respectively.

**Gate**
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx expo export --platform web` succeeds
- [ ] App launches on a physical Android device and every tab opens for all 8 roles
- [ ] Commit: `fix(mobile): restore the three screens the tab bar was importing`

---

## Phase 1 — Design system · **M**

Establish the token and component contract from `01_MOBILE_DESIGN_SYSTEM.md`.
Every later phase depends on this; building screens first means re-theming them.

**Scope**
- Rewrite `src/theme/tokens.ts` to the web values (this changes *every* colour
  and radius currently in use — expect the whole app to shift)
- `src/theme/ThemeContext.tsx` — light/dark/system, persisted
- `src/components/ui/` — the full kit: `AppButton` (5 variants, 3 sizes),
  `AppCard` + 4 sub-components, `AppBadge` (8 variants), `AppInput`,
  `AppSelect`, `AppIconButton`, `AppTabs`, `AppEmptyState`, `AppSkeleton`,
  `AppSearchInput`, `AppModal`, `AppConfirmDialog`, `AppToast`, `AppErrorState`
- Bundle Inter (400/500/600/700) + JetBrains Mono (400/500) via `expo-font`
- Replace `@expo/vector-icons` with `lucide-react-native` app-wide
- `app.json`: `userInterfaceStyle` → `"automatic"`, splash background
  `#000000` → theme-correct

**Known breakage:** existing screens hardcode colours (`RoleTabs.tsx`
`"#0f172a"`, `MoreMenuScreen.tsx` `"#e2e8f0"` etc.). Sweep them as part of this
phase — leaving them means two palettes in one app.

**Gate**
- [ ] `grep -rE '#[0-9a-fA-F]{6}' src/modules src/navigation` returns nothing
- [ ] Every primitive renders correctly in light and dark
- [ ] A screenshot of the UI kit at 390px sits beside the web `KitchenSink`
      screenshot and the two read as one product
- [ ] Touch targets ≥ 44 via `hitSlop` where visual height is smaller

---

## Phase 2 — Navigation & access · **M**

Implements `02_MOBILE_NAVIGATION_AND_ACCESS.md`. **The most important phase.**
Ship this wrong and all 15 remaining modules inherit the wrong permission gate.

**Scope**
- `src/services/accessService.ts`, `src/services/permissionService.ts`
- `src/navigation/access.ts` — verbatim port of `roleCanSeeItem`
- `src/navigation/navigationCatalogue.ts` — mirrors `SIDEBAR_GROUPS`, fed by
  `GET /api/access/catalog` (never hardcoded)
- Rewrite `RoleTabs.tsx`: tabs computed from `TAB_PREFERENCE`, deleting the five
  hardcoded `if (role === ...)` blocks
- Rewrite `MoreMenuScreen.tsx`: grouped like web, permission-derived
- `PageAccessGate` and `CoworkingPermissionGate` components
- Deep link routes for all 22 pages under `theofficeonrent://`

**Gate**
- [ ] Unit tests cover every branch of `roleCanSeeItem`
- [ ] `grep -rn 'role === "' src/navigation src/modules` returns nothing
- [ ] **Parity test:** for each of the 8 roles, reachable mobile screens ==
      reachable web routes. Repeat for an account with `enforcePageAccess: true`
      and a customised grant list, and for a `CHANNEL_PARTNER` with
      `canViewInventory` both on and off
- [ ] Every deep link opens the right screen or the access-denied state

---

## Phase 3 — Attendance & uploads · **L**

First real module phase. Attendance is chosen first because it currently
**breaks the build**, it is the highest-frequency mobile use case (staff check
in from a phone, not a desktop), and it forces the upload + location plumbing
that four later phases need.

**Scope**
- `src/services/attendanceService.ts` — all 20 endpoints
- `src/services/uploadService.ts` — `expo-image-picker` /
  `expo-document-picker` → multipart
- `AttendanceScreen.tsx` ← `AttendanceHub.jsx` (1,744 LOC): check-in/out,
  breaks, daily view, leave balance, leave requests
- `AttendanceViolationsScreen.tsx` ← `AttendanceViolations.jsx` (169 LOC)
- Geolocation via `expo-location`; `app.json` permission entries for Android
  and iOS with usage strings

**Layout adaptation:** the web hub is a wide table of days × staff. On phone:
a prominent check-in/out card on top, then a scrollable day list; the admin
cross-staff view becomes a filterable list, not a grid.

**Gate**
- [ ] Check-in and check-out write the same records as web, verified in DB
- [ ] Location permission denial is handled gracefully (does not hard-block)
- [ ] Break start/end, leave request, leave balance all match web
- [ ] Admin can view and amend another user's attendance, exactly as on web
- [ ] Upload works for camera, gallery, and document on both platforms

---

## Phase 4 — Leads & inventory depth · **XL**

The two biggest existing 🟡 modules. Mobile already has substantial code here
(`LeadDetailsScreen` 4,961 LOC; `AssetVaultScreen` 2,325 LOC) — this phase is
**audit-and-close-gaps**, not a rewrite.

**Scope**
- Diff `LeadDetailsScreen.tsx` against `LeadDetailsRebuilt.jsx` (3,556 LOC)
  section by section; close every gap including admin review/approval branches
- `LeadsMatrixScreen.tsx` (929) vs `LeadsMatrix.jsx` + 6 components (8,809 LOC):
  filters flyout → bottom sheet, pipeline views, pipeline team view,
  coworking requirement fields
- `src/services/inventoryRequestService.ts` — 9 endpoints
- `AssetVaultScreen.tsx`: request/review workflow to full web depth
- Re-verify `Lead.js` and `User.js` model shapes first — both are modified in
  the current working tree

**Gate**
- [ ] Section-by-section checklist against the web screens, signed off
- [ ] Every lead stage transition available on web is available on mobile
- [ ] Filters produce identical result sets for identical inputs
- [ ] Inventory request → review → approve round-trips correctly per role

---

## Phase 5 — Missing sales modules · **L**

Five screens that do not exist on mobile at all.

**Scope**
- `src/services/crmContactService.ts` (6), `projectService.ts` (5),
  `publicInventoryService.ts` (1)
- `OwnerDatabaseScreen.tsx` ← `OwnerDatabase.jsx`
- `BrokerDatabaseScreen.tsx` ← `BrokerDatabase.jsx`
- `ProjectsScreen.tsx` ← `Projects.jsx` (1,949 LOC)
- `ProjectDetailsScreen.tsx` ← `ProjectDetails.jsx` (416 LOC)
- `SharedInventoryViewScreen.tsx` ← `SharedInventoryView.jsx` — **unauthenticated**,
  reached by share-token deep link
- `ProductionDashboardScreen.tsx` ← `ProductionExecutiveDashboard.jsx` (255 LOC)
  — `PRODUCTION_EXECUTIVE` and `COMMUNITY_MANAGER` have no mobile home today
- `FieldOpsScreen` map section: `react-native-maps` (web uses `react-leaflet`)

**Note:** `react-native-maps` is not yet a dependency. Adding it requires a new
native build — schedule the EAS build accordingly.

**Gate**
- [ ] Contact bulk import parity (web has `contactBulkImport.js`) or an
      explicit, documented decision to defer it on mobile
- [ ] Share-token screen loads with no session present
- [ ] Both production roles land on a working dashboard

---

## Phase 6 — Coworking · **XL**

Entirely unbuilt on mobile: ~2,700 LOC of web code over 92 endpoints. Depends
on the permission layer from Phase 2 — coworking is the only module with
fine-grained permissions (`cabins.view`, `clients.view`, and 48 more).

**Scope**
- 11 service files (see `03_MOBILE_API_CONTRACT.md` §2.10)
- `BookingBoardScreen` ← `BookingBoard.jsx` (608) + `boardStore.js` (742)
- Floor plan / seat map: `FloorPlanArchitecture`, `FloorLayoutMap`,
  `WingSeatMap` — SVG on web, `react-native-svg` on mobile (already a dependency)
- `CabinDetailPanel` → bottom sheet
- `OnboardClientDialog` (588) → multi-step form screen
- `DocumentChecklist` + `kycDocuments.js` (268) — depends on Phase 3 uploads
- `TransferCabinDialog`, `SpaceSummaryPanel`
- `CoworkingClientsScreen` + `ClientProfileScreen`

**Layout adaptation:** the booking board is a large 2D floor plan — the single
hardest thing in this port to make usable on a phone. Plan for pinch-zoom and
pan on the seat map plus a parallel list view; do not assume the web layout
scales down.

**Gate**
- [ ] All 50 coworking permissions enforced identically to web
- [ ] Booking create / update / cancel round-trips
- [ ] Seat assign / release reflects on the board immediately
- [ ] KYC upload and checklist complete
- [ ] `COWORKING_ADMIN` has a fully working app

---

## Phase 7 — Admin depth · **XL**

**Scope**
- `AdminCommandConsoleScreen` (505) ← `AdminCommandConsole.jsx` (**3,830 LOC** —
  the single largest screen in the app). **Split it** into a hub plus
  sub-screens; one 3,800-line RN screen would be unmaintainable and slow to mount
- `UserDetailsEditorScreen` (381) ← `UserDetailsEditor.jsx` (1,786) — large gap
- `NotificationsScreen` (1,176) ← `AdminNotifications.jsx` (1,597) — full
  filter/action stack
- `TeamManagerScreen` (838) ← `TeamManager.jsx` + `TeamManagerCards` +
  `TeamManagerPanels` (2,185)
- `AdminMetaAdsScreen` ← `AdminMetaAdsPanel.jsx` (417) — replaces the Phase 0
  placeholder
- `src/services/roleService.ts` (5), `saasService.ts` (4)

**Gate**
- [ ] Every admin action available on web is available on mobile
- [ ] Console sub-screens each mount in under a second on a mid-range Android
- [ ] Page-access editing from mobile produces the same result as from web

---

## Phase 8 — Remaining gaps, legal & polish · **L**

**Scope**
- `DataUseNoticeScreen` + `ServiceTermsNoticeScreen` ← `legal/` —
  **required for app store submission**, do not defer past this phase
- `RoleLeaderboardScreen` ← `RoleLeaderboard.jsx` (354) — replaces the Phase 0
  placeholder
- `UserProfileScreen` (478) ← `UserProfile.jsx` (931) — role-specific cards
- `TaskManagerScreen` (1,547) ← `TaskManager.jsx` (3,054)
- `MasterScheduleScreen` (622) ← `MasterSchedule.jsx` (1,098)
- `IntelligenceReportsScreen` (668) ← `IntelligenceReports.jsx` + sections (1,000)
- Chat: admin alert pathways, role badges, attachment/call state UX
- Error boundaries on every stack; crash reporting

**Gate**
- [ ] Legal screens reachable without a session (store reviewers check this)
- [ ] Every 🟡 in the gap matrix is now ✅
- [ ] No unhandled promise rejections in a full role-walkthrough

---

## Phase 9 — Push & native integration · **M**

The reason for building native rather than shipping the PWA — make it count.

**Scope**
- **Backend first:** `POST /api/push/subscribe` accepts an Expo token alongside
  the existing web `PushSubscription`; send path fans out to both. Coordinate
  before starting — this is the one phase touching backend code
- `expo-notifications`: permission, token registration, foreground handler
- Notification → deep link into the right screen (Phase 2 routes)
- Quick reply from the notification, matching the web drawer reply feature
- Biometric unlock (`expo-local-authentication`) over the stored session
- `expo-updates` OTA channel wiring (already configured in `app.json`)
- Background/foreground socket lifecycle (`03_MOBILE_API_CONTRACT.md` §4)

**Gate**
- [ ] Push arrives on a physical Android and a physical iOS device, app killed
- [ ] Tapping a notification lands on the correct record
- [ ] Reply from the notification posts the message
- [ ] Web push still works — regression check

---

## Phase 10 — Release · **M**

Executes `05_MOBILE_RELEASE_PLAYBOOK.md`.

**Scope**
- Full role-by-role regression pass on physical devices
- App icons, splash, store listing copy, screenshots, privacy policy links
- EAS production profiles; AAB for Play, IPA for App Store, APK for sideload
- Internal testing track → staged rollout

**Gate**
- [ ] All 8 roles pass the regression checklist on Android and iOS
- [ ] Builds produced and installed from each of the three channels
- [ ] Crash-free rate measured over an internal testing period

---

## Sequencing summary

```
Phase 0  Unbreak build        S    ── blocks everything
Phase 1  Design system        M    ── blocks all screen work
Phase 2  Navigation & access  M    ── blocks all module work
   ├─ Phase 3  Attendance & uploads   L   ── unblocks uploads for 4/6/8
   ├─ Phase 4  Leads & inventory      XL
   ├─ Phase 5  Sales modules          L
   ├─ Phase 6  Coworking              XL  ── needs 2 (perms) + 3 (uploads)
   ├─ Phase 7  Admin depth            XL
   └─ Phase 8  Gaps, legal, polish    L
Phase 9  Push & native          M    ── needs backend change
Phase 10 Release                M
```

Phases 3–8 are independent of each other once 2 lands, so they can be
reordered by business priority or run in parallel by different people. 0, 1, 2
are strictly sequential; 9 and 10 come last.

## Backlog — deliberately deferred

| Item | Why deferred |
| --- | --- |
| Offline write queue | Web has none; would be mobile-only behaviour |
| Tablet layouts | Phone is the design target |
| `manager/LeadPool` | Desktop-heavy; folded into leads |
| `contactBulkImport` | Decide in Phase 5 |
| Web `Tooltip` equivalents | No hover on touch; resolved per use site |
| `KitchenSink` | Dev-only, though a mobile version would help Phase 1 review |
