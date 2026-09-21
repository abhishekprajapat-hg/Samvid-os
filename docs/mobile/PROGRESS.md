# Mobile Build Progress

Living status for the phase plan in [04_MOBILE_IMPLEMENTATION_PHASES.md](04_MOBILE_IMPLEMENTATION_PHASES.md).

**Last updated:** 2026-09-21 · web reference commit `2ba5fdd`

| Phase | Scope | Status |
| --- | --- | :---: |
| 0 | Unbreak the build | ✅ Done |
| 1 | Design system | ✅ Done |
| 2 | Navigation & access | ✅ Done |
| 3 | Attendance & uploads | ✅ Done |
| 4 | Leads & inventory depth | ✅ Done (one item deferred) |
| 5 | Missing sales modules | ✅ Done |
| 6 | Coworking | ✅ Done |
| 7 | Admin depth | 🟡 Partial |
| 8 | Gaps, legal & polish | 🟡 Legal done |
| 9 | Push & native integration | ✅ Done |
| 10 | Release | ⛔ Needs devices & store accounts |

## Verification

All three gates pass as of the last change:

```
npm run typecheck   # tsc --noEmit, 0 errors
npm test            # 122 tests, 122 pass, 0 fail
npx expo export --platform web   # bundles clean

cd ../backend && npm test        # 221 tests, 221 pass, 0 fail
```

---

## Phase 0 — Unbreak the build ✅

`RoleTabs.tsx` imported three screens that did not exist, so nothing compiled.
All three were built as working screens rather than placeholders.

| Delivered | Notes |
| --- | --- |
| `modules/attendance/AttendanceScreen.tsx` | Check in/out, breaks, worked & late totals, leave balance, recent days |
| `modules/reports/RoleLeaderboardScreen.tsx` | Ranked cards, role filters, "you" highlight |
| `modules/admin/AdminMetaAdsScreen.tsx` | Integration readiness, page IDs, token set/replace/clear, copyable webhook URLs |
| `services/attendanceService.ts` | All 20 endpoints, mirroring the web service |
| `services/saasService.ts` | Tenant settings + Meta integration |
| `userService.getRoleLeaderboard` | Added to match web |

**Bug found and fixed:** `tsc` was dying with `RangeError: Maximum call stack
size exceeded`. Not the app's code — `tsconfig.json` extended
`expo/tsconfig.base`, which sets `allowJs: true` and does not exclude `dist`, so
after any `expo export` the compiler tried to parse the 4.24 MB web bundle.
`tsconfig.json` now declares its own `include`/`exclude`. Anyone running export
then typecheck would have hit this.

Also replaced RN's core `Clipboard` (deprecated, slated for removal) with
`expo-clipboard`.

## Phase 1 — Design system ✅

The blocker was that screens bypassed the token file: **1,332 hardcoded hex
literals across 125 distinct values**. Rewriting tokens alone would have changed
almost nothing on screen.

Those literals turned out to be stock Tailwind defaults — precisely the palette
web used *before* its redesign — so an exact mapping existed. A scripted
migration moved **1,252 literals across 30 files** to the redesign values at the
identical scale position. The CallScreen's bespoke dark gradient is excluded by
name; it has no web counterpart and folding it in would flatten the screen.

| Delivered | Notes |
| --- | --- |
| `theme/tokens.ts` | Full web palette, light + dark schemes, radii `7/10/14` (was `12–24`), web type scale, 3-level elevation with Android `elevation`. Export shape held stable so 29k lines pick it up unedited |
| `theme/ThemeContext.tsx` | light / dark / system, persisted to AsyncStorage |
| `theme/fonts.ts` + `applyGlobalFont.ts` | Inter 400/500/600/700 and JetBrains Mono 400/500, as web loads. RN ignores `fontWeight` on a custom family, so weight is resolved to a **face** globally rather than editing every style block |
| `components/ui/` | Button (5 variants × 3 sizes), Card + 5 sub-components, Badge (8 variants), Input, SearchInput, IconButton, Tabs, Sheet, ConfirmDialog, EmptyState, ErrorState, Skeleton |
| `components/ui/Icon.tsx` | lucide adapter; **128 Ionicons call sites migrated**, 0 remaining. Nav glyphs now match `workbenchNavigation.js` exactly |
| `components/common/Screen.tsx` | Flat header matching web, replacing the floating translucent 24px-radius card |
| `components/common/ui.tsx` | Now a shim re-exporting the real kit, so pre-Phase-1 screens get the new design without edits |
| `app.json` | `userInterfaceStyle` → `automatic`, splash `#000000` → `#f5f7fa`, display name → "Office On Rent", iOS bundle identifier added |

Side effect: dropping Ionicons cut the web bundle from **4.24 MB → 3.8 MB**.

**Known limit.** `StyleSheet.create` runs once at import, so screens reading the
static `colors` export are fixed to light. The UI kit and any migrated screen
follow the active scheme; legacy screens go dark as they are touched in later
phases. This is why dark mode ships as infrastructure now and completes in
Phase 8.

## Phase 2 — Navigation & access ✅

The correctness phase. Mobile decided visibility with `role === "ADMIN"` while
web derives it from an API-served permission model — so the two disagreed for
any account with customised page access, offering a tab the API then refused.

| Delivered | Notes |
| --- | --- |
| `services/accessService.ts` | `/access/me`, `/access/catalog`, per-user page config |
| `services/permissionService.ts` | `/coworking/permissions/me`, `toPagePermission` |
| `navigation/navigationCatalogue.ts` | Mirror of `SIDEBAR_GROUPS` — same role arrays, page keys, permission strings, partner flags, same six groups |
| `navigation/access.ts` | Line-by-line port of `roleCanSeeItem`, plus tab selection and More-group derivation |
| `context/PermissionContext.tsx` | Mirror of web's `PermissionProvider`; refreshes on `AppState` → active (the mobile equivalent of tab focus) and every 30s |
| `components/auth/PageAccessGate.tsx` | `PageAccessGate` + `CoworkingPermissionGate`, so a deep link cannot bypass the nav |
| `navigation/RoleTabs.tsx` | **Rewritten.** Tabs computed from `TAB_PREFERENCE`; the five hardcoded per-role blocks are gone. Every route wrapped in its gate |
| `modules/more/MoreMenuScreen.tsx` | **Rewritten.** Grouped exactly like the web sidebar, permission-derived, Profile in a footer chip |
| `test/access.test.cjs` | **54 tests** covering every branch |

Test infrastructure note: `jest-expo@57` requires React 19.2.3 but Expo SDK 54
pins 19.1.0, so it will not install. The access layer is pure TypeScript with no
React, so the tests run on Node's built-in runner against a small CommonJS
build — no new runtime dependency, and it matches the backend's existing
`.test.cjs` convention.

**Fixed as a side effect:** `COWORKING_ADMIN`, `PRODUCTION_EXECUTIVE` and
`COMMUNITY_MANAGER` previously fell through to a generic tab set. Tabs are now
derived, so every role lands somewhere sensible.

### Still open from Phase 2

- **Deep links.** `theofficeonrent://` is declared in `app.json` but per-page
  link config is not wired. Needed by Phase 9 (push → open the right record).
- Destinations in the catalogue that mobile has not built (coworking, projects,
  the contact databases) are filtered by `BUILT_SCREENS` in `RoleTabs.tsx`, so
  the UI never offers a dead route. Each name drops off that list as its phase
  lands.

## Phase 3 — Attendance & uploads ✅

`attendanceService.ts` (all 20 endpoints) and the first cut of the attendance
screen landed in Phase 0 to unbreak the build; this phase completed the module
and shipped the upload plumbing four later phases depend on.

| Delivered | Notes |
| --- | --- |
| `utils/location.ts` | `expo-location` wrapper. Balanced accuracy, not Highest — Highest waits on GPS, and indoors (where people check in) that can hang or never resolve. Falls back to a ≤5-minute cached fix, and never throws: a refusal, a timeout or location-off each resolve to a reason the UI can show |
| `services/uploadService.ts` | Camera, library and document pickers → multipart. Client-side mirror of the server allowlist and the 25 MB cap, Android content-URI filename repair, sequential multi-upload, and `toAbsoluteUrl` because the API stores relative URLs that a browser resolves for free and a native app does not |
| `AttendanceScreen.tsx` | Now a hub with tabs: **My day · Leave · Team · Violations** |
| `components/MyDaySection.tsx` | Check in/out, breaks, worked & late totals, recent days |
| `components/LeaveSection.tsx` | Balance, request history, new request sheet |
| `components/TeamSection.tsx` | Day roster with a date stepper, summary counts, and the pending-leave approve/reject queue |
| `components/ViolationsSection.tsx` | Month-scoped violations and per-person summaries, with the review sheet |
| `app.json` | iOS purpose strings for camera, mic, photos and location — each stating what the app actually does, since Apple rejects vague ones. Android gains `ACCESS_FINE/COARSE_LOCATION`, `READ_MEDIA_IMAGES/VIDEO`, `POST_NOTIFICATIONS`. `expo-location` plugin configured **when-in-use only** |

**Check-in is geofenced.** `validateAttendanceGeofence` in the backend rejects a
fix outside `policy.officeRadiusMeters` and returns 400 when location is missing
— but only when `policy.geofenceEnabled` is on. So the screen reads the policy
from `/attendance/me` and requests location *only* when it will actually be
checked; prompting otherwise is a permission dialog with nothing behind it.
Requests send `source: "MOBILE"`, which the `ATTENDANCE_SOURCE` enum supports
and which web has no way to set.

**Deviation from the plan:** `04_MOBILE_IMPLEMENTATION_PHASES.md` listed
`AttendanceViolationsScreen` as its own screen. It shipped as a tab inside the
hub instead — it is management-only and always reached from attendance, so a
separate stack route would have been a destination nothing linked to.

**Needs a native rebuild.** `expo-location` is a new native module, so the next
device build must be a fresh binary, not an OTA update.

## Phase 4 — Leads & inventory depth ✅

An audit-and-close-gaps phase rather than a rewrite: mobile already had
`LeadDetailsScreen` at 4,961 lines and `AssetVaultScreen` at 2,325. Comparing
the *service surface* each side uses turned out to be the quickest way to find
real divergence.

### Bugs found and fixed

**The lead detail screen could show the wrong person's lead.** It fetched the
entire lead list and filtered client-side, then fell through to `leadRows[0]`
when the requested lead was not in the list — silently rendering a different
record, against which any subsequent edit would have been applied. It now uses
`GET /leads/:id`, which the backend scopes through `findAccessibleLeadById` and
404s properly. Cheaper on mobile data and correct. The list is still fetched,
but only to populate the sale-lead picker, and it can no longer decide which
lead is on screen.

**Inventory delete ignored the approval workflow.** Mobile called
`deleteInventoryAsset` for every role, so a non-admin got a 403 where web would
have raised a delete request. Mobile's role list also disagreed with web in
three ways: it granted direct delete to `MANAGER` and `CHANNEL_PARTNER` (web:
`ADMIN` only), it left `ADMIN`/`MANAGER` out of the status-change request roles,
and it ignored page-access grants entirely.

**Requests raised by a non-reviewer vanished.** Web picks
`getPendingInventoryRequests()` or `getMyInventoryRequests()` by role; mobile
only ever called the reviewer branch, so an executive who requested an edit or
delete had no way to see the outcome.

**Share produced text, not a link.** Web mints a tokenised public URL; mobile
shared a plain description, so the recipient got a blurb they could not open.

### Delivered

| Item | Notes |
| --- | --- |
| `leadService.getLeadById` | Plus `getLeadActivityWithMeta` and `bulkUploadLeads`, completing the mirror of the web service |
| `inventoryService` | Added `createInventoryCreateRequest`, `requestInventoryDelete`, `requestInventoryUpdateChange` (web's spelling, aliasing the existing call), `getMyInventoryRequests`, `getInventoryAssetsWithMeta`, `createInventoryShareLink` |
| `modules/inventory/inventoryAccess.ts` | The eight capability flags from `AssetVault.jsx`, ported and shared rather than inlined next to the buttons that use them |
| `modules/leads/pipelineViews.ts` | Direct port of web's `pipelineViews.js` |
| `LeadsMatrixScreen` | The five pipeline views — **Needs action / All / Team / Unassigned / Closed** — with a live count on Needs action, defaulting to it as web does. Mobile previously had only a status dropdown, and this is the view a field executive opens to every morning |
| `AssetVaultScreen` | Delete now branches direct-vs-request; capabilities come from the shared rules |
| `components/MyInventoryRequests.tsx` | Collapsible panel showing a non-reviewer their own requests and outcomes |
| `InventoryDetailsScreen` | Share now mints a real share token and hands the URL to the native share sheet, summary included |
| `api.getWebAppOrigin()` | Browser-bound links need an origin a native app does not have. Derived from the API base, overridable with `EXPO_PUBLIC_WEB_APP_URL` |
| `test/pipelineViews.test.cjs` | 26 tests — day boundaries, terminal statuses, budget formatting |
| `test/inventoryAccess.test.cjs` | 24 tests — the delete cases especially, since that is where mobile had drifted |

Test count: **54 → 104**.

`createInventoryCreateRequest` is exported but unused, exactly as on web —
the service mirrors web 1:1 even where a function has no caller yet.

### Completing the phase

**The pipeline was truncated to 50 leads.** Web's `getAllLeads` walks the
pages — its own comment says "a bare GET /leads returns the first page rather
than the whole table" — while mobile made exactly that bare call. The backend
default limit is 50, so every mobile screen built on this (pipeline,
dashboards, the sale-lead picker, tasks) had been showing at most 50 leads.
Now paginates with the same page size and cap as web, and accepts params.

**The requirements model was a version behind.** The backend `Lead` schema and
web both carry `propertySubtype` + `subtypeData` and a `COWORKING` inventory
type; mobile had none of them, and was missing six of the newer commercial
fields. `frontend/src/config/propertyRequirementConfig.js` — 536 lines of pure
config and pure functions, no imports — is now ported verbatim as
`mobile/src/config/propertyRequirementConfig.ts`. The data literals are
unchanged, so a diff against the web file is the drift check; only the five
lookup helpers carry the annotations strict mode requires.

**Filters now reach the server.** Web turns its filter state into query params
and lets `GET /leads` do the work; mobile had only a status chip row.
`leadFilters.ts` reproduces that mapping — including the four quick filters and
their date arithmetic — and `LeadFiltersSheet` is the flyout as a bottom sheet.
Filtering client-side was never an option: it would only ever filter the rows
already downloaded.

| Item | Notes |
| --- | --- |
| `leadService.getAllLeads` | Paginates, and takes filter params |
| `config/propertyRequirementConfig.ts` | Verbatim port; adds `filterInventoryTypeOptions` for the coworking-category gate web applies at its call sites |
| `types/index.ts` | `COWORKING`, `propertySubtype`, `subtypeData`, and the six newer commercial booleans |
| `modules/leads/leadFilters.ts` | Filter state → query params, quick-filter expansion |
| `components/LeadFiltersSheet.tsx` | Status, source, assignee, created range, follow-up range, quick filters |
| `LeadsMatrixScreen` | Filter button with an active count, server-side reload on apply |
| `test/leadFilters.test.cjs` | 18 tests, pinning each quick filter to an exact parameter set |

Test count: **104 → 122**.

### Deliberately left out

**Bulk lead upload.** The service (`bulkUploadLeads`) is in place and
`uploadService` can already pick a file, but nothing parses a spreadsheet on
mobile. Web supports CSV and xlsx; matching it means porting a chain of
helpers (`parseBulkLeadCsvRows`, `parseBulkLeadRowsFromMatrix`,
`resolveLeadCsvHeaderKey` and its header-mapping table) plus adding the `xlsx`
dependency for workbooks.

Left out because importing a spreadsheet is a desk task — it is done once, from
wherever the file already is, which is not a phone. This is a scope decision,
not a blocker: say the word and it is a contained piece of work (pure
functions, no native module, so it ships over OTA).
## Phase 5 — Missing sales modules ✅

Six screens that did not exist on mobile at all, plus the three services
behind them.

| Delivered | Notes |
| --- | --- |
| `services/crmContactService.ts` | Web calls `/contacts` straight from the component; mobile keeps the service layer, as the API contract doc requires |
| `services/projectService.ts` | Mirrors the web service |
| `services/publicInventoryService.ts` | Its **own** axios client, deliberately not the shared `api` — that one attaches a bearer token and, on 401, refreshes and then signs the user out, none of which makes sense for a link meant for someone with no account |
| `components/ContactDatabaseScreen.tsx` | One implementation behind both directories, the way `ContactDatabasePage.jsx` serves both web pages |
| `OwnerDatabaseScreen` / `BrokerDatabaseScreen` | Thin wrappers, blurbs copied verbatim. Only the broker screen carries the blocked-lead count, because only brokers gate lead intake |
| `ProjectsScreen` | Searchable card list; search is a server parameter, not a local filter |
| `ProjectDetailsScreen` | The project record carries a wide, largely optional field set, so anything present and scalar renders as a labelled row — a field added on the backend appears without a mobile release |
| `SharedInventoryViewScreen` | Unauthenticated, reached by share token. Pairs with the share link added in Phase 4 |
| `ProductionDashboardScreen` | **`PRODUCTION_EXECUTIVE` and `COMMUNITY_MANAGER` now have a real home.** They were being routed to the task list; they do not work a sales pipeline, so this shows tasks and attendance as web does |
| `navigationCatalogue` / `RoleTabs` | Six routes registered and gated; `BUILT_SCREENS` now only excludes coworking |

### A plan assumption that was wrong

`04_MOBILE_IMPLEMENTATION_PHASES.md` listed "FieldOps map section:
`react-native-maps` (web uses `react-leaflet`)" and warned it would need a new
native build.

That was wrong. `FieldOpsScreen` already renders the map with **Leaflet inside
a WebView, against the same OpenStreetMap tiles web uses** — the same library,
the same tiles, the same markers. Moving to `react-native-maps` would add a
native dependency, require Google Maps API keys on Android, and replace OSM
tiles with Google's, which is *less* parity with web, not more. Left as it is.

**No new native modules in this phase**, so everything here ships over OTA.

## Phase 6 — Coworking ✅

The last unbuilt module: 92 endpoints, two screens.

| Delivered | Notes |
| --- | --- |
| `services/coworkingService.ts` | All 92 endpoints. Web splits these across eleven service files; grouped here in one sectioned module because mobile consumes them from two screens, not eleven pages. Function names still match web's |
| `modules/coworking/cabinData.ts` | Status model ported from `cabinData.js` |
| `BookingBoardScreen` | Wing-grouped cabin grid, status filters, block/unblock |
| `CoworkingClientsScreen` | Searchable list, profile sheet with holdings and activity |
| `RoleTabs` | Both wrapped in `PageAccessGate` **and** `CoworkingPermissionGate` — coworking is the one module with per-action permissions on top of page access |

**The colour convention is inverted, deliberately.** On this board red means a
cabin is *vacant* — earning nothing — and green means it is *let*. That is the
landlord's reading, not the guest's, and it is the opposite of the usual
ticketing convention. Mobile reproduces it exactly and keeps the legend on
screen; getting it backwards would have a manager reading the board inside out.

**The floor plan stays on web.** Web positions 65 cabins to the architect's
drawing with the temple, lift and passage band around them. Scaled to 390px
those tiles are about 20px across — too small to read, let alone tap. The phone
gets the same cabins grouped by wing in a legible grid, with the same status
colours. The spatial question ("which cabin is next to the lift?") gets asked at
a desk.

## Phase 9 — Push & native integration ✅

**Mobile push was a stub.** `pushNotifications.ts` only called `console.log`,
while `RootNavigator` invoked it as though it worked — the app asked for a
token, registered a tap listener, and got nothing.

### Backend (strictly additive — web push untouched)

| Change | Notes |
| --- | --- |
| `models/PushSubscription.js` | Adds `kind: WEB or EXPO`. Expo tokens carry no encryption keys, so `keys` is now required for WEB only, via a conditional validator |
| `routes/push.routes.js` | `/subscribe` accepts `{ kind: "EXPO", token }`. **Not gated on VAPID** — Expo needs no server credentials, so a deployment with no VAPID keys can still reach a phone |
| `services/push.service.js` | `sendToUser` splits by kind and fans out to Expo's API alongside web-push. `DeviceNotRegistered` is treated as Expo's 404/410 and deletes the row |

All **221 backend tests still pass**, including `push-reply.test.cjs`.

### Mobile

| Delivered | Notes |
| --- | --- |
| `services/pushNotifications.ts` | Real implementation: permission, Expo token, registration, tap listener including the cold-start case via `getLastNotificationResponseAsync` |
| `navigation/linking.ts` | Deep links for every route, using the **web paths**, so one link works on both apps |
| `RootNavigator` | A chat notification opens the conversation; anything else follows the `url` the server put in the payload, so a task or lead lands on its own screen |
| `AuthContext.logout` | Deregisters the device — a shared phone would otherwise keep delivering the previous user's alerts |
| `RealtimeAlertsContext` | **Removed** the local chat notification: the server already pushes chat messages, so keeping it would ring twice now that push is real |

Foreground banners are suppressed because the in-app toast already says it;
sound and badge still fire.

## Phase 8 — Legal ✅ (rest outstanding)

The store-blocking half is done.

| Delivered | Notes |
| --- | --- |
| `modules/legal/legalContent.ts` | Privacy (10 sections) and Terms (11), extracted **verbatim** from the web pages — this is the company's legal position, so it is copied, not paraphrased |
| `LegalNoticeScreen` | One renderer, two documents |
| `AuthStack` | Privacy, Terms and SharedInventory registered **signed-out** — both stores expect a reviewer to reach the policy without an account, and the rest of this app is behind a login |
| `MoreMenuScreen` | Links added |
| `LoginScreen` | **Fixed:** it carried its own abbreviated copy of the terms with different headings — two divergent statements of the legal position. Both modals now read the canonical text |

### Still open in Phase 8

- Dark mode completion. The infrastructure shipped in Phase 1, but screens
  reading the static `colors` export stay light until migrated to `useTheme()`.
- Crash reporting, and the remaining partial screens from the gap matrix
  (tasks, calendar, reports, chat depth, profile).

## Phase 7 — Admin depth 🟡

| Delivered | Notes |
| --- | --- |
| `services/roleService.ts` | Custom roles — catalogue, create, update, delete |
| `userService` additions | `createUserDeleteRequest`, `getAdminUserDeleteRequests`, `reviewUserDeleteRequest`, `updateChannelPartnerInventoryAccess`, `updateUserDesignation` |
| `TeamManagerScreen` | **Fixed:** deleting a user is an approval workflow on web — admin deletes directly, a manager raises a request. Mobile blocked non-admins entirely, so the workflow was unreachable from a phone |

### Still open in Phase 7

- **Reviewing user delete requests on mobile.** A manager can now raise one, but
  `NotificationsScreen` does not yet list them — an admin reviews on web. Not a
  broken loop (admins work at a desk), but it is half the workflow. Left out
  rather than patched blind into a 1,176-line screen.
- `AdminCommandConsoleScreen` (505 lines) vs web's 3,830: the console's
  analytics, audit and workflow tooling. The plan calls for splitting it into
  sub-screens rather than one monolith.
- `UserDetailsEditorScreen` (381 vs 1,786): missing the attendance, leave, task,
  project and custom-role panels.
- Custom-role management UI — the service is in place, nothing calls it yet.

## Phase 10 — Release ⛔

Not startable from here. It needs a Play Console account, an Apple Developer
membership, physical Android and iOS devices for the regression pass, and
signing credentials.

What this work *has* done is clear its blockers: legal screens reachable
signed-out, accurate iOS purpose strings, permissions declared, an iOS bundle
identifier, a real display name and a theme-correct splash.

**The next device build must be a fresh binary, not OTA** — `expo-location`,
`expo-clipboard`, `expo-notifications`, `expo-device` and `expo-linking` are all
new native modules since the last build.
