# Mobile Parity Spec — The Office On Rent

**Status:** Historical baseline · audited 2026-09-21
**Owner:** Abhishek Prajapat
**Reference implementation:** `frontend/src` (the web app)
**Target:** `mobile/` (Expo / React Native)

> This document records the starting audit and is intentionally not rewritten
> as work lands. Current closure status is tracked in
> [06_WEB_FEATURE_GAP_REGISTER.md](06_WEB_FEATURE_GAP_REGISTER.md).

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

## 5a. Deliberate divergence from web — the register

Parity is the default. Where mobile is knowingly *not* the web app, it is
written here, with what web would have to gain to close the gap. An entry in
this table is a decision; anything not in it is a bug.

### 2026-09-21 — Tasks module, built to mobile comps

Six design comps were supplied for Tasks and implemented as drawn. They are
ahead of `frontend/src/modules/tasks/TaskManager.jsx`, which has none of the
following:

| Divergence | Mobile | Web today | To close |
| --- | --- | --- | --- |
| Scope tabs | All Task / Assigned / My Task / Team across the top | One list, filtered | Port the four scopes; the API already serves them via `?scope=assigned\|mine` |
| Board view | Kanban of To Do / In Progress / Completed, List⇄Board toggle | List only | Port the board; no API change needed |
| Team roll-up | Workload bands + per-person roster, ADMIN/MANAGER only | Not present | Port; `/tasks/stats/by-user` already exists and is admin-gated |
| Task detail | Full page: fact grid, description, checklist, activity rail | Inline panel | Port the page |
| Task form | Full page, create and edit share it | Modal | Optional; the modal is fine on a desktop |

Two of these read as mobile-only conveniences and two (board, team roll-up) are
real product surface that web should eventually get. Tracked as a follow-up,
not as part of the mobile phases.

**Workload bands are a mobile invention.** The comp shows Busy / Balanced /
Available / Offline but not the rule behind them. The rule is set in
`mobile/src/modules/tasks/taskConstants.ts` — a deactivated account is Offline,
four or more open tasks is Busy, one to three is Balanced, none is Available —
and is the single source both the legend and the roster read. If web adopts the
roll-up it must adopt this rule or change it in both places.

**The activity rail is derived, not audited.** There is no task audit endpoint,
so the timeline is built from what the record holds: `createdAt` + `createdBy`,
each `assignmentHistory` entry, and `updatedAt`. It does not show status or
field-level edits, because nothing records them. `buildActivity()` in
`TaskDetailsScreen.tsx` is the one place to change if an audit trail lands.

### 2026-09-22 — Pipeline, built to mobile comps

Six comps for the leads module. The list was rebuilt to comp 1; Lead Details
gained the five tabs from comp 5 by grouping the sections it already had
rather than rewriting a 4,987-line screen.

**The comps contradicted each other and were resolved by asking:**

| Conflict | Comps said | Resolution |
| --- | --- | --- |
| Bottom bar | Slot 4 "Pipeline" (1–2), slot 3 (5–6), "Leads" (2); Attendance absent from all | User chose **Home · Pipeline · Tasks · Attendance · More**. Calendar moves to More |
| Detail tabs | Overview/Details/Activities/Tasks (2), +Documents (3), Overview/Requirements/Notes/Tasks/Activity (5) | Comp 5's set |
| Lead ID format | `#LEA204` (2) vs `EEA204` (4–6) | Left as the existing last-6-of-id, which is what the data supports |
| Header | Hamburger + logo + bell + avatar (1) vs logo + tagline + search + avatar (4, 6) | Neither; the app-wide `AppHeader` stays as built |

**Regression found and fixed:** when Contacts left the tab bar last turn, the
Owner Database, Broker Database and Contacts screens all became unreachable —
More excludes Owner/Broker on the assumption Contacts covers them, but no
`Contacts` entry existed in the navigation catalogue. One has been added, so
More has a door to the directories again.

**Found while grouping the detail screen:** there are two Lead Diary blocks in
`LeadDetailsScreen`. One is live inside the controls card; the second is a
duplicate disabled with `{false ? … : null}`. The disabled copy was left alone
— it is dead code, not a feature to switch on — and the Notes tab is built from
the same state (`diaryEntries`, `diaryNoteDraft`, `submitDiary`) rather than by
relocating either block. The dead copy should be deleted once the concurrent
sessions settle.

**Not carried over:** the inline Call / WhatsApp buttons the old lead card had.
The comp replaces them with a kebab, so those two actions moved into its sheet
rather than being dropped.

### 2026-09-24 — Team, built to comps 37–40

Four comps: Add Team Member, Member Details, Roles & Permissions and the Team
hub. `TeamManagerScreen` was rebuilt to comp 40;
`AddTeamMemberScreen`, `MemberDetailsScreen` and `RolesPermissionsScreen` are
new. `UserDetailsEditorScreen` stays as the edit form the pencil opens.

**Backend, additive.** `User` gained `employeeId`, `joiningDate`, `invitedAt`,
`inviteAcceptedAt`, `mustChangePassword`, `leadCapacity` and `taskCapacity`;
`createUserByRole` and `updateUserByAdmin` read them through one shared
`readEmploymentFields`, so a partial patch cannot blank a field nobody touched.
Login stamps `inviteAcceptedAt` the first time an invited account signs in,
which is what clears the list's Invited chip.

**Roles reuse the store that already existed.** `RolePermission` is the
per-company override of a role's permission list and `access.service` already
reads it, but it had no home outside the coworking module. `GET`/`PATCH
/api/access/roles` (admin only) expose `listRolesWithPermissions` and
`updateRolePermissions` verbatim — same audit entry, same cache invalidation,
same `assertGrantablePermissions` guard. Nothing new is stored.

One thing that record could hold but nothing honoured: `page.<key>.<action>`
strings in a role's list granted the API check while the page stayed missing
from the navigation `access.service` builds. `pageEntriesFromPermissions` now
reads them back into the page list when the user has no per-user override, so
the two agree. A role whose list carries no `page.*` entry keeps the defaults
in `rolePageAccess.constants.js`, which is every company that has only used the
older screens — so the change is opt-in at the moment an admin first saves a
matrix.

**Two service bugs surfaced while wiring this up**, both in `accessService.ts`
and both dead on arrival: `updateUserPageAccess` sent `pages`, a key the route
does not read, so every call answered 400; and `getUserPageAccess` returned the
page *catalogue* as though it were the grant, which would have shown every page
as granted. Nothing else called either function.

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| "Send email invitation", with the server posting it | There is no mail transport on this backend | The account is created either way and the invitation is composed on the device, in the admin's own mail app, with the sign-in details in it. `invitedAt` records that it was handed over; the first sign-in clears it. Without a mail app the details go to the clipboard instead |
| No password field anywhere on the form | An account needs one from the moment it exists | One is generated and handed over with the invitation. "Add without invitation" copies it for the admin to pass on |
| "Require password reset on first login" | No login flow reads such a flag | Stored as `mustChangePassword` and shown on the member page. **Not enforced at login** — enforcing it would mean changing the web app's login too, which is outside this batch |
| "Require 2-step verification" | The app has no second factor | Drawn, disabled, and captioned with why. A toggle that reads "on" while every login is still one password is worse than no toggle |
| "Can manage roles / invite members / view audit logs" | `roles.manage`, `users.create` and `audit_logs.view` already exist as permissions | The three toggles grant exactly those, so switching one on grants the thing it names |
| A permission matrix over seven pages | The catalogue has twenty | The matrix draws the comp's seven and a save carries the other thirteen through untouched — the roles payload ships each role's whole resolved `pageAccess` for that reason |
| Editing "Sales Manager" as a role of its own | A company-defined role is a preset over a built-in one; the built-in role is what every scoping rule reads | Selecting a preset edits the built-in role underneath. The card names it and says how many people that reaches, because the blast radius is wider than the row you tapped |
| "18 leads · 5 tasks" per member, "18 / 25" workloads | Counts are derivable; the caps were not stored | `leadCapacity` / `taskCapacity` on the user, defaulted to the comp's 25 and 10. They are a target to compare against, not a limit anything enforces — a lead router that refused to assign past them would strand leads |
| "Revenue ₹3.2 L" on a member | No per-deal value exists on a lead | Closed deals priced at the same flat figure the leaderboard uses (`DEAL_VALUE`, matching `gamification.ts`) |
| "Site Visits — 3 this week" | The profile route counts site visits without a window | Reads "3 open", which is what the number actually is |
| A handshake glyph for Deals Closed, a crown for Admin | Ionicons has neither | `ribbon` and `shield-checkmark`, the nearest solid glyphs in the set already in use |
| "On Break" / "On Leave" per member | Only `/attendance/daily` knows, and it needs the attendance grant | Read from today's roster when it is readable; without it everyone active simply reads as active, rather than the app guessing who is absent |
| A "Teams" card with a Manage teams destination | A team is the `department` string on a user — there is no team record | The card groups that field; tapping a row filters by it. "Manage teams" opens a sheet listing the teams, the roles screen and (for an admin) Rebalance executives, which is where that existing tool moved to |

**Type scale.** These comps run a much higher contrast than the brand scale
assumed: a 26–27pt page title over 9–11pt row text. The first pass used the
scale's body sizes (12–15) for member rows, which made every row 19pt taller
than the comp and truncated names and tile labels. Sizes were then fitted
string by string against Inter's own advance widths — see the note in
`01_MOBILE_DESIGN_SYSTEM.md`.

**New token triplet:** `infoTint` / `infoChip` / `infoInk`, the blue counterpart
to the existing warn and alert triplets. An invitation waiting to be accepted is
the first state in the app that is neither good nor bad, and the status pills
had to survive the dark scheme.

### 2026-09-24 — Leaderboard, Performance and Achievements, built to comps 34–36

Three comps for the gamification side of Reports. `RoleLeaderboardScreen` was
rebuilt; `PerformerScreen` and `AchievementsScreen` are new. `PerformanceScreen`
was left alone - it is the Targets page and has nothing to do with these.

**No backend change.** The comps state their own scoring rules - the
Leaderboard prints the table under "How Points Work" - so a score is the sum of
what somebody did, priced by that table, computed in
`modules/reports/gamification.ts`. Nothing is stored, which means a score can
always be explained by pointing at the records behind it, and correcting a lead
corrects the leaderboard. A badge is a threshold on a count, so it unlocks the
moment the count is reached and un-unlocks if the record behind it is
corrected.

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| "Unlocked 12 Sep 2024" under each badge | Nothing records when a threshold was crossed, and back-dating it from the records would be a guess | The tile says "Unlocked", and a locked one shows its progress instead |
| Photographic avatars on the podium | No avatar is stored on a user | The initials avatar the rest of the app uses, with the podium ring in gold / silver / bronze as drawn |
| A crown over first place | Ionicons has no crown | `ribbon` in the comp's gold, which is the nearest solid glyph in the set already used |
| "₹5,000 / ₹3,000 / ₹2,000" monthly bonuses | No store, and no comp draws a settings screen for them | `REWARD_TIERS` in gamification.ts, beside the points table. Both are policy rather than arithmetic, so they sit together at the top of one file |
| "Level 8" at 1,720 points | The comp's own level and its "280 pts to Level 9" do not agree with each other | A level every 250 points, which is the mechanic the comp implies and is internally consistent. It is one constant if the pace needs changing |
| "Send recognition" | No in-app recognition feed | The share sheet, with the person's month in it - it reaches whichever channel the team actually uses |
| "7-Day Streak" and "Attendance Hero" | `/attendance/me` only reads your own record | Counted on your own Achievements page and left at zero on somebody else's, rather than showing a number the endpoint cannot support |

### 2026-09-24 — Reports, built to comps 30–33

Four comps: a hub, a sales report, a finance report and a custom builder. The
screen that was here aggregated leads and inventory client-side under the name
"Intelligence Reports"; that stays the method, and is now the whole module.

**There is no reporting endpoint, on purpose.** Every figure is counted from
the records the app already reads - leads, the finance ledger, inventory, task
stats - by `modules/reports/reportData.ts`. A report therefore cannot disagree
with the screen it summarises, and a new metric is a function rather than a
migration.

**One small model was added:** `Report` (`/api/reports`) stores the *question* -
name, range, sections, metrics, filters, visualization, format - and never the
numbers. That is what "Recent Reports" lists and what "Save as template" keeps;
reopening one answers it from today's data instead of showing a stale copy. The
reports page gained `create` and `delete` for it.

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| "Avg Response 18 min" | `lastContactedAt` is the only contact timestamp, and it moves on every touch | Counted as the gap from `createdAt` to `lastContactedAt`, which is an upper bound - the safer way to be wrong about a service level - and the derivation is written down in `reportData.ts` |
| Funnel captioned "stage conversion from previous stage" | The comp's own numbers are each stage over the *first* stage, not the one above | The numbers follow the comp, and so does the caption, because they are what the comp shows |
| "Properties +2" on the hub | Nothing records how many properties existed last month | The tile shows the count without a change figure rather than inventing a baseline |
| "Email report after generation" | No mail transport on the server | Composed in the phone's mail app, ready to send, and the field says so |
| Excel as an export format | No spreadsheet writer | The format is stored on the report; PDF renders on-device with `expo-print` and CSV through the share sheet. Excel records the preference and exports as CSV, which Excel opens |
| Charts | No charting dependency | Drawn in plain SVG in `reportCharts.tsx` - donut, combo bars with a trend line, area, multi-line, funnel, bar list - because a library would bring a theming layer to fight for six figures on four screens |

**Half-width cards.** Comps 30 and 33 run their chart cards two to a row. At
430pt that leaves each about 185pt, so those cards step their type down a size
and the funnel and legend columns are narrower than they would be full width.

### 2026-09-23 — Finance, built to comps 26–29

Four comps: a dashboard, a transactions list, an invoice and an Add Entry form.
The screen that was here derived a company's money from lead deal payments and
a flat commission per closed deal; that was a stand-in for a ledger.

**The coworking finance models were widened, on the user's decision.**
`CoworkingInvoice`, `CoworkingPayment` and `CoworkingExpense` are the only
complete money ledger in the product and they match comps 28 and 29 almost
field for field, but they were scoped to coworking clients, contracts and
properties. Rather than stand up a second invoicing system beside them:

| Model | Added |
| --- | --- |
| `CoworkingInvoice` | `clientId` no longer required; `leadId`, `contactId`, `inventoryId` beside it |
| `CoworkingPayment` | `invoiceId` and `clientId` optional (money taken in with no invoice raised); `leadId`, `contactId`, `inventoryId`, `category`, `title`, `payerName`, `receipts[]` |
| `CoworkingExpense` | `inventoryId`, `leadId`, `contactId`, `referenceNumber` |

Nothing existing changes shape - a coworking row still sets `clientId` /
`propertyId` exactly as before, and every coworking query keeps working.
`amountPaid` is still written only by `recalculateAmountPaid`, which sums the
ledger, so the phone can never disagree with the desktop about what is owed.

**A new surface, not a new ledger.** `/api/finance` (overview, transactions,
invoices, entries) reads those three collections and merges the two that are
cash movements into one feed. It is mounted outside `/api/coworking` so it is
reached by the Finance page rather than by the coworking roles, and the finance
page gained `create` and `edit` actions because Add Entry really does create.

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| "Net cash flow", Income and Expenses on one hero | Income is what was billed in the month plus anything taken in with no invoice behind it; Collected is what actually arrived | Both are returned and labelled separately, so Collected ≠ Income when a bill is outstanding - which is what makes Receivables meaningful |
| A "Overdue" choice on Add Entry's Payment status | Overdue is a state a row falls into once its date passes, not one you pick | The three segments are drawn; Overdue saves as pending and the list shows it as late on its own |
| "Send payment confirmation" by email | There is no mail transport on the server | Composed in the phone's mail app, ready to send, and the field says so. Same for "Send reminder" on the invoice |
| "Download PDF" | No report service | Rendered on the device with `expo-print` and handed to the share sheet |
| "Export Report" | Same | The month's rows as a CSV, through the share sheet |
| "Create Invoice" in Quick Actions | An invoice is raised from a coworking contract, and no comp draws a composer | The tile opens Add Entry in Income mode. This is the one action not wired literally - a composer needs a comp before it is worth designing |

### 2026-09-23 — Pipeline, redrawn to comps 17–20

Four comps: the pipeline list, Add Lead, Lead Details and Update Lead. They
supersede the six from 2026-09-22. `LeadsMatrixScreen` was rebuilt; Add Lead and
Update Lead are new pages; Lead Details keeps its five tabs and gained the
comp's bar and summary above them.

**A backend field was added, on the user's decision.** Three of the four comps
show a three-way lead temperature and the model only had `hotClient: Boolean`.
`Lead.temperature` (`COLD` / `WARM` / `HOT` / `""`) now exists, and
`applyLeadTemperature()` in `lead.controller.js` keeps the two in step on every
write - `HOT` sets the flag, anything else clears it, and a client that only
knows the flag still works. `""` means the lead predates the field; mobile reads
it through `temperatureOf()` and draws it as the comp's blue **New** badge
rather than defaulting it to a value nobody chose.

**Six stages over seventeen statuses.** The comps' New / Contacted / Interested
/ Visit / Requested / Closed are a view, not a replacement: `STAGES` in
`leadPipeline.ts` gives each one the statuses it owns, and a seventh **Other**
chip catches `MISSING_IN_ACTION`, `INVALID`, `OWNER` and `BROKER` so no lead
becomes unreachable by browsing. The filter sheet still offers the full list.

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| A "Website" source on the lead card | `sourceChannel` had no Website value | `WEBSITE` added to the enum on the model and in the controller's list, and to the source select |
| "Discuss shortlisted properties" under the follow-up date | `nextFollowUp` was a bare timestamp | `Lead.followUpPurpose` added. Update Lead's Purpose select now persists it and Lead Details reads it back; without a column it could only have lived in a reminder one phone had scheduled |
| "Coworking · 12 seats" on the card | The comp counts a coworking enquiry in seats, not square feet | `requirements.commercial.seats`, which already existed, with the area falling back in for every other type |
| "Within 30 days" in the Requirement card | No possession or move-in column, and no comp has a field that sets one | Omitted. The comp's own Add Lead screen puts "Move-in within 30 days" in the free-text notes, so there is nothing to read it from |
| "Low / Warm / Hot" on Add Lead, "Cold / Warm / Hot" on Update Lead | One field | Cold / Warm / Hot on both, since that is what the column stores. The comps contradict each other here |
| Notes on Add Lead | `Lead` has no notes field | The first diary entry, which is where every later note goes anyway |
| A reminder lead time ("30 minutes before") | The backend schedules nothing | A device-local notification, as the task comps already do. The screen says so rather than implying it follows the user to another device |
| An interaction channel and outcome on Update Lead | The diary has free text, no channel or outcome column | Written into the line as "Call · Connected — …", the same way the attendance sheet records an effective time |
| "Next Action" on Update Lead | No column | The diary's `nextStep`, which exists for exactly this |
| Area and Budget as single selects | The model stores `areaMin/Max` and `budgetMin/Max` | Preset ranges as drawn, plus a "Custom range…" option that swaps in two number fields so the precision is still reachable |
| Closed as just another step on the stepper | A close records the payment mode, amount and reference, and some roles need an approval | Picking Closed on Update Lead offers to open Lead Details, where that form lives. Writing the status straight through would either be refused or record a close without the money |

**Where the four comps disagree with each other**, each screen follows its own:
Priority reads "Low / Warm / Hot" on Add Lead and "Cold / Warm / Hot" on Update
Lead; a range is tight on the lead card (`1,000-1,500 sq ft`) and spaced on Lead
Details (`1,000 - 1,500 sq ft`); the temperature pill carries a flame on Lead
Details and not on the card. All of them are one column underneath.

**Phone numbers.** `POST /leads` dedupes on the exact trimmed string, and every
existing row holds a bare national number, so the comp's country-code block
stores the ten digits alone for +91 and prefixes the code for anything else.
Changing the format for +91 would have broken dedupe against existing leads.

**Lead Details does not stack two designs.** The comp's summary sits on top;
the profile card that predates it - the editable name, phone, email, city and
project, plus Save - is behind "Edit contact details" in the kebab, because the
summary already shows all of it read-only and leaving it inline made the screen
read as two apps in a row. Its duplicated header, status grid and Call /
WhatsApp / Mail / Maps row were dropped, since the comp's profile card carries
them. The section switcher under the summary was rebuilt in the comp's language
for the same reason, and its first tab is now called **Properties**: the comp's
summary is the overview, and that tab holds the linked properties and the
proposal generator. The tab bodies themselves are still the ported web screens
and should be redrawn when comps for them land.

**View tabs dropped, nothing lost.** The old Needs action / All / Team /
Unassigned / Closed switcher is gone. `matchesView` returned true for both All
and Team, so Team never filtered anything; the rest are quick filters the
server-side filter sheet already has.

### 2026-09-22 — Attendance, redrawn to the single-page comp

One comp, replacing the seven the module was built to in September. It puts my
own day and the team's on one scrolling page, so the hub's "Admin view" toggle
and its My day / Leave switch are gone. `AttendanceScreen` is presentation only
— the service calls, the roster row vocabulary in `attendanceShared.tsx` and
the five pushed pages are unchanged.

| Measured off the comp | Value |
| --- | --- |
| Page gutter | 18pt, as Home's comp draws it, not the 16 the inventory comps settled on |
| Card | 12pt padding, 10pt radius, 8pt between cards |
| Ring | 132pt across, 8pt stroke, `#039f78` on a `tintSoft` track, clockwise from twelve |
| Ring text | 22pt bold over a 9pt caption, both inside the ring |
| Check in / out tiles | 45pt tall, 9pt apart, a 27pt badge and a 10 / 13pt stack |
| Action buttons | 33pt tall, 6pt apart |
| Stat tiles | 61pt tall, four across a 5pt gap |
| Week cells | 57pt tall, five across an 8pt gap, a 5pt bar |

**Two deliberate departures from the measurements:**

- The comp's buttons are 33pt, below the 44pt iOS target. They are kept at 33
  because they run the full width of the card, where only the height is short
  of the guideline and the target is not hard to hit.
- The stat tile's badge is 22pt with 7pt padding, not the comp's 26 and 9. The
  comp's own face is about 15% narrower than Inter, so at the comp's spacing
  "Total Hours" truncates; the smaller badge buys the 50pt the label needs.

**Where the comp and the system disagree:**

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| "Office · Vijay Nagar" and "Within office radius" on the location strip | `AttendancePolicy` carries `officeLatitude`, `officeLongitude` and `officeRadiusMeters` — no name, and no fix until a check-in is attempted | "Office" plus the rule in force ("Check in within 150 m of the office", or that the check is off). Naming a locality would have been invented |
| Photographic avatars on the roster | No avatar is populated on the roster response | The initials avatar the rest of the app uses |
| A single header icon and nothing else | The hub's old tabs were the only door to leave, approvals, violations and the policy page | That icon opens a menu holding all of them, filtered by the manage grant. Its first two entries — My attendance and Leave — are there for everyone |

**Two screens added, because the comp's layout displaced their contents:**

- `MyAttendanceScreen` (`MyAttendance`) — my own recent days with worked, break
  and late-by per day. `AttendanceHistory` next door reads `/attendance/daily`,
  which 403s without the manage grant, so it could never have served as
  everyone's history; the non-manager's "View attendance history" link and the
  menu's first entry both point here.
- `AttendanceLeaveScreen` (`AttendanceLeave`) — `LeaveSection` unchanged, given a
  page now that the hub has no tab to hold it.

**The module now runs two palettes.** The hub, `MyAttendance` and the two new
headers are drawn in the comp's green (`theme/brand.ts`); history, details,
approvals, policy, violations and the leave panel itself are still on the
web-parity tokens, so the leave page's "Request leave" CTA is blue under a green
header. Nothing was recoloured piecemeal - a single green button in a blue panel
would read worse than the seam does - and the five pushed pages should be
redrawn together when comps for them land.

**Superseded but not deleted:** `components/MyDaySection.tsx` joins
`TeamSection.tsx` and `ViolationsSection.tsx` as unreferenced. Left in place for
the same reason as the others.

### 2026-09-21 — Attendance, built to mobile comps

Seven comps. The module went from one tabbed hub to a hub plus five pushed
pages, nested inside the Attendance tab so the bottom bar stays visible the
way the comps draw it.

| Built | Notes |
| --- | --- |
| `AttendanceScreen` | Admin roster with 2×2 stats, today card, filterable day list |
| `AttendanceHistoryScreen` | The roster on its own page with a movable date |
| `AttendanceDetailsScreen` | One person, one day: fact strip, live banner, timeline, geofence info |
| `AttendanceApprovalsScreen` | Pending / History leave queue |
| `AttendancePolicyScreen` | Geofence coordinates, radius, Leaflet map preview, today's insights |
| `AttendanceViolationsScreen` | Monthly violations per person, with the required management note |
| `attendanceShared.tsx` | Status vocabulary, roster row, stat grid, the Set Status sheet |

**The bottom bar changed again.** These comps put Attendance in slot four
where the Tasks comps put Contacts. Attendance wins, being the newer set;
Contacts is no longer a tab and is reached from More, which now lists it
because it is no longer in `TAB_SCREENS`.

**Where the comps and the system disagree:**

| Comp asks for | Reality | Decision |
| --- | --- | --- |
| Two request kinds in Approvals — "Leave Request" and "Attendance Correction" | There is one request entity (`LeaveRequest`) and one review endpoint. Nothing raises a correction request | Leave requests only. A correction tab would always be empty; the kind is a backend gap, not a mobile one |
| "Effective Time (Optional)" on the Set Status sheet | `PATCH /attendance/users/:id/:date/status` takes `status` and `note` only | The field is kept and prefixed onto the note (`Effective 10:50 AM — …`) so what was typed is recorded rather than dropped |
| Status choices include Working and On Break beside Present/Absent/Leave | WORKING and BREAK are derived, not stored; the stored enum has no such values | The sheet routes by kind: the two live states call the break endpoint, the rest patch the status |
| A live map on the policy page | No native map dependency is installed | Leaflet over OpenStreetMap in a WebView, the approach `FieldOpsScreen` already uses. Needs network; the coordinates are printed as text regardless |

**Kept although no comp shows it:** requesting leave and viewing your own
balance. Every comp is management's view, but `LeaveSection` is the only route
to either on a phone, so the personal side of the screen is a My day / Leave
switch. Dropping it would have removed the feature silently.

**Superseded but not deleted:** `components/TeamSection.tsx` and
`components/ViolationsSection.tsx` are fully replaced by the hub and the
violations page and are now unreferenced. Left in place rather than removed
because other sessions are active in this repo; they should be deleted once
that settles.

### 2026-09-21 — Calendar, aligned to mobile comps

Six comps were supplied for Calendar. Most of the module already matched them;
the gaps closed were the month badges (the letters and the colours were the
wrong way round — the comp reads **L** for lead follow-ups in amber and **T**
for tasks in green), a today marker that only appeared when today happened to
be the selected day, the labelled LEAD FOLLOW-UPS / TASK DEADLINES sections in
the day card, Tags and Created On in the follow-up sheet, and Custom plus a
resolved-span row in the Time Range filter.

**Three things the comps ask for that the data cannot answer:**

| Comp asks for | Data available | Decision |
| --- | --- | --- |
| "Under: Ashfiya Khan" on each follow-up card — the assignee's manager | No reporting line exists. `User` has no `reportsTo`/`manager` field in `mobile/src/types`, in `backend/src/models/User.js`, or in what `lead.controller` populates (`name role` only) | Row omitted. Inventing a hierarchy would put a wrong name in front of the person who has to act on the follow-up |
| A Tags card with free tags ("Commercial", "Office Space", "Priority") | `Lead` has no tags field. It does carry `requirements.inventoryType`, `.propertySubtype` and `.transactionType` | Chips are those three, prettified, and the card hides itself when none are set. Real data, same shape |
| Events drawn as hour-long blocks with a start and end time | Only `nextFollowUp` / `dueDate` — a single instant, no duration | One hour assumed, as `EVENT_MINUTES` in `MasterScheduleScreen.tsx`. Change it in one place if a duration field ever lands |

### 2026-09-21 — App chrome, built to mobile comps

| Divergence | Mobile | Web today | Note |
| --- | --- | --- | --- |
| App bar | Wordmark + alert bell + avatar, rendered as the tab navigator's `header` | Top command bar with search, date, theme, logout | Logout moved to More; search is per-screen on mobile |
| Bottom bar | **Fixed** five: Home, Tasks, Calendar, Contacts, More | Role-driven sidebar | See below |
| Contacts | One destination switching Owners ⇄ Brokers | Two sidebar entries | Same `ContactDatabaseScreen` underneath |

**The fixed tab bar overrides role-driven tab selection, on purpose.** Until
now `getTabItems()` picked the tabs from what a role could actually reach, which
kept the bar in step with the web sidebar. The comps specify one bar for
everyone, so that algorithm no longer chooses tabs.

What did *not* change: every tab is still wrapped in its `PageAccessGate`, so a
role without the grant lands on the gate rather than on a screen it may not
read. Everything that is no longer a tab stays reachable from More — which now
excludes the fixed five by name (`MORE_EXCLUDED_SCREENS` in `RoleTabs.tsx`)
rather than by asking the access algorithm, since asking it would have hidden
Leads, Inventory and Chat while nothing else offered them.

The Team tab is the one role-sensitive piece left: it is hidden for anyone who
is not ADMIN or MANAGER, because `/tasks/stats/by-user` returns 403 for them
and a visible tab that can only fail is worse than no tab.

---

## 6. Document set

| Doc | Purpose |
| --- | --- |
| `00_MOBILE_PARITY_SPEC.md` | This file — scope, audit, gap matrix |
| `01_MOBILE_DESIGN_SYSTEM.md` | Token + component contract (the "exact design" definition) |
| `02_MOBILE_NAVIGATION_AND_ACCESS.md` | Navigation model, roles, permissions, page access |
| `03_MOBILE_API_CONTRACT.md` | Backend surface and the mobile service layer that must cover it |
| `04_MOBILE_IMPLEMENTATION_PHASES.md` | Phase-by-phase plan with acceptance criteria |
| `05_MOBILE_RELEASE_PLAYBOOK.md` | Build, sign, and ship to Play Store / App Store / sideload |
