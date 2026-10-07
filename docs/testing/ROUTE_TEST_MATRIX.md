# ROUTE TEST MATRIX — Frontend

Every route in `frontend/src/App.jsx` was loaded in a real browser (Playwright driving Microsoft Edge /
Chromium) as a logged-in ADMIN, with console output, uncaught exceptions and network traffic captured
per route. No route is marked Tested unless it was actually navigated to.

- Date: 2026-09-18
- Browser: Edge (Chromium) 1440×900, plus 9 viewport widths for responsive checks
- Routes discovered: **37** (32 navigable + 5 parameterised/dev-only)
- Routes loaded: **32** · blank screens: **0** · crashes: **0** · console errors: **1 route**

## Legend

`Auth` — authentication required. `Result` — what actually happened.

---

## Public routes

| Route | Page | Auth | Allowed roles | Expected | Tested | Result | Issue |
|---|---|---|---|---|---|---|---|
| `/login` | Login | No | all | Render login form | Yes | PASS — email+password+submit render, password masked, invalid creds show an error | CRM-BUG-021 (unlabeled inputs) |
| `/login/admin` | Login (admin portal) | No | all | Admin-only portal | Yes | PASS — non-admins refused by API | — |
| `/privacy-policy` | DataUseNotice | No | all | Static legal page | Yes | PASS — 2,236 chars, 0 API calls | — |
| `/terms-and-conditions` | ServiceTermsNotice | No | all | Static legal page | Yes | PASS — 1,993 chars | — |
| `/data-use-notice` | DataUseNotice | No | all | Static legal page | Yes | PASS | — |
| `/service-terms` | ServiceTermsNotice | No | all | Static legal page | Yes | PASS | — |
| `/shared/inventory/:shareToken` | SharedInventoryView | No | all | Public listing via share token | Yes (API) | PASS — valid token 200, invalid 404, no owner PII | — |
| `/portal/*` | redirect | No | all | Redirects to `/` | Yes | PASS | — |

## Protected application routes

| Route | Page | Auth | Allowed roles | Expected | Tested | Result | Issue |
|---|---|---|---|---|---|---|---|
| `/` | Dashboard by role | Yes | all | Role-specific dashboard | Yes | PASS — 2,687 ms, 6 API calls | CRM-BUG-016 |
| `/dashboard` | Dashboard by role | Yes | all | Same as `/` | Yes | PASS — 2,661 ms | CRM-BUG-016 |
| `/leads` | LeadsMatrix | Yes | ADMIN, MANAGER, EXEC, INSIDE_EXEC, FIELD_EXEC, PARTNER | Pipeline table | Yes | PASS — 38 KB text, 100 rows, search + Load-more verified | CRM-BUG-001, -015 |
| `/leads/:leadId` | Lead details | Yes | as above | Lead detail view | Yes | PASS — clicking the name cell navigates to `/leads/:id` | CRM-BUG-031 |
| `/my-leads` | LeadsMatrix (own) | Yes | EXEC, INSIDE_EXEC, FIELD_EXEC | Own leads only | Yes | PASS — 38 KB text | — |
| `/my-leads/:leadId` | Lead details | Yes | as above | Detail | Yes | PASS | — |
| `/inventory` | AssetVault | Yes | ADMIN, MANAGER, EXEC, FIELD_EXEC, PARTNER | Inventory workspace | Yes | PASS — create dialog opens | CRM-BUG-019, -020 |
| `/inventory/owners` | OwnerDatabase | Yes | as above | Owner contacts | Yes | PASS — 4 API calls | CRM-BUG-005 |
| `/inventory/brokers` | BrokerDatabase | Yes | as above | Broker contacts | Yes | PASS | CRM-BUG-005 |
| `/inventory/contacts` | → `/inventory/owners` | Yes | as above | Redirect | Yes | PASS | — |
| `/inventory/:id` | InventoryDetails | Yes | as above | Property detail | Yes | PASS | — |
| `/projects` | Projects | Yes | ADMIN, MANAGER, EXEC, FIELD_EXEC | Project list | Yes | PASS | CRM-BUG-010 (926 KB image) |
| `/projects/:id` | ProjectDetails | Yes | as above | Project detail | Yes | PASS | — |
| `/finance` | FinancialCore | Yes | ADMIN, MANAGER, EXEC, PARTNER | Revenue & collections | Yes | PASS — 2,591 ms | CRM-BUG-001, -016 |
| `/map` | FieldOps | Yes | ADMIN, MANAGER, FIELD_EXEC | Leaflet map + dispatch | Yes | PASS — 5,160 chars, 7 API calls | CRM-BUG-001 |
| `/reports` | IntelligenceReports | Yes | ADMIN, MANAGER | Funnel analytics | Yes | PASS | CRM-BUG-001, -016 |
| `/leaderboard` | RoleLeaderboard | Yes | ADMIN, MANAGER, EXEC, FIELD_EXEC, PARTNER | Ranked peers | Yes | **FAIL** — 400 from `/users/leaderboard?role=ADMIN`, empty board, "Invalid role filter" shown, no role selector | **CRM-BUG-012** |
| `/calendar` | MasterSchedule | Yes | all with calendar page | Month/week/day | Yes | PASS — 42 KB text | — |
| `/tasks` | TaskManager | Yes | all with tasks page | Task board | Yes | PASS — create dialog opens, focus enters dialog | CRM-BUG-010 (14.9 MB image), -019 |
| `/attendance` | AttendanceHub | Yes | all with attendance page | Attendance board | Yes | PASS — 15 KB text, 7 API calls | — |
| `/targets` | Targets | Yes | all with targets page | Targets view | Yes | PASS | **CRM-BUG-016** (`targets/my` ×6) |
| `/chat` | TeamChat | Yes | all with chat page | Rooms + messages | Yes | PASS — 6.5 KB text | CRM-BUG-006 |
| `/profile` | UserProfile | Yes | all | Own profile | Yes | PASS | CRM-BUG-010 (5.7 MB image), -021 |
| `/settings` | SystemSettings | Yes | ADMIN, MANAGER | System settings | Yes | PASS — 3 API calls | — |
| `/admin/notifications` | AdminNotifications | Yes | ADMIN, MANAGER | Approval alerts | Yes | PASS | — |
| `/admin/users` | TeamManager | Yes | ADMIN, MANAGER | Team + access | Yes | PASS — 9 KB text; create dialog opens; empty-form validation shown | CRM-BUG-019, -020 |
| `/admin/users/:userId` | UserDetailsEditor | Yes | ADMIN | Per-employee page access | Yes (API) | PASS — grants apply and are enforced | — |
| `/admin/console` | AdminCommandConsole | Yes | ADMIN | Command console | Yes | PASS — 8 API calls | CRM-BUG-001 |
| `/admin/meta-ads` | AdminMetaAdsPanel | Yes | ADMIN | Meta ads integration | Yes | PASS | — |
| `/coworking` | → booking board | Yes | ADMIN, MANAGER, COWORKING_ADMIN | Redirect/board | Yes | PASS | CRM-BUG-016 |
| `/coworking/booking-board` | BookingBoard | Yes | as above | Floor/cabin board | Yes | PASS — 2,964 ms | CRM-BUG-016 |
| `/coworking/clients` | ClientsPage | Yes | as above | Coworking clients | Yes | PASS | — |
| `/_kitchen-sink` | KitchenSink | Yes | dev only | Component gallery | No | NOT TESTED — dev-only route, `import.meta.env.DEV` | Should not ship to production |
| `/*` (unmatched) | — | Yes | all | 404 page | Yes | **FAIL** — app shell renders with an empty content area; no 404 message | **CRM-BUG-022** |

---

## Responsive results (9 widths × 12 key pages = 108 checks)

**No horizontal overflow at any width on any page tested.** This is a genuinely good result.

| Page | 320 | 375 | 390 | 430 | 768 | 1024 | 1280 | 1440 | 1920 |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/leads` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/inventory` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/tasks` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/attendance` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/admin/users` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/reports` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/calendar` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/chat` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/coworking/booking-board` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/profile` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `/settings` | ok | ok | ok | ok | ok | ok | ok | ok | ok |

Remaining responsive issue: at 375 px, **10 of 30** visible tap targets are smaller than 44×44 px
(CRM-BUG-030).

## Route load performance (network-idle, dev server, warm)

| Band | Routes |
|---|---|
| < 2.5 s | `/settings`, `/admin/meta-ads`, `/targets`, `/admin/notifications`, `/profile`, legal pages |
| 2.5–3.0 s | `/`, `/dashboard`, `/my-leads`, `/inventory/*`, `/finance`, `/reports`, `/attendance`, `/chat`, `/calendar`, `/admin/users` |
| 3.0–3.7 s | `/leads` (3.5 s), `/inventory` (3.6 s), `/map`, `/tasks`, `/coworking/*`, `/admin/console` |

These are Vite **dev-server** timings (unminified, on-demand transform); the production build is a
separate profile. Treat them as relative, not absolute.
