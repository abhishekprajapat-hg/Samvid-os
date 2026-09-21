# Mobile Navigation & Access Contract

**Purpose:** mobile must show a user exactly the screens web shows them — no
more, no fewer. Today it does not, because mobile reimplements visibility with
hardcoded role checks while web derives it from a permission model served by the
API. This document specifies the shared model.

---

## 1. The problem, stated exactly

**Web** (`frontend/src/components/workbench/workbenchNavigation.js`) decides
visibility with `roleCanSeeItem(item, userRole, user)`, which evaluates four
things in order: explicit page grants, role lists, channel-partner inventory
access, and coworking permissions.

**Mobile** (`src/navigation/RoleTabs.tsx`, `src/modules/more/MoreMenuScreen.tsx`)
decides visibility with:

```ts
const isAdmin = role === "ADMIN";
const isManagement = role === "ADMIN" || role === "MANAGER";
```

These two produce different answers for any account where an admin has
customised page access. A user whose `leads` grant was revoked on web still sees
Leads on mobile — and gets an empty screen or a 403 when they tap it.

**This must be fixed before any module phase**, because every ported screen
inherits the wrong gate otherwise. It is Phase 2.

## 2. Roles

Eight roles, defined identically in `mobile/src/types/index.ts` and the web nav:

| Role | Web nav grouping |
| --- | --- |
| `ADMIN` | `MANAGEMENT_ROLES`, `SALES_ROLES`, `COWORKING_ROLES` |
| `MANAGER` | `MANAGEMENT_ROLES`, `SALES_ROLES`, `COWORKING_ROLES` |
| `EXECUTIVE` | `SALES_ROLES` |
| `FIELD_EXECUTIVE` | `SALES_ROLES` |
| `PRODUCTION_EXECUTIVE` | `PRODUCTION_ROLES` |
| `COMMUNITY_MANAGER` | `PRODUCTION_ROLES` |
| `CHANNEL_PARTNER` | `PARTNER_ROLES` |
| `COWORKING_ADMIN` | `COWORKING_ROLES` |

Mobile currently has **no home screen for `PRODUCTION_EXECUTIVE` or
`COMMUNITY_MANAGER`** — web routes them to `ProductionExecutiveDashboard`.
Tracked in Phase 5.

## 3. The page catalogue

22 pages, served by `GET /api/access/catalog`, defined in
`backend/src/constants/page.constants.js`. **Nothing may hardcode this list** —
web doesn't, and mobile must not either.

| Key | Label | Group | Web path |
| --- | --- | --- | --- |
| `dashboard` | Dashboard | Workspace | `/dashboard` |
| `tasks` | Tasks | Workspace | `/tasks` |
| `attendance` | Attendance | Workspace | `/attendance` |
| `calendar` | Calendar | Workspace | `/calendar` |
| `chat` | Team Chat | Workspace | `/chat` |
| `leads` | Leads | Sales | `/leads` |
| `my_leads` | My Leads | Sales | `/my-leads` |
| `inventory` | Inventory | Sales | `/inventory` |
| `projects` | Projects | Sales | `/projects` |
| `field_ops` | Field Ops | Sales | `/map` |
| `finance` | Finance | Business | `/finance` |
| `reports` | Reports | Business | `/reports` |
| `leaderboard` | Leaderboard | Business | `/leaderboard` |
| `targets` | Targets | Business | `/targets` |
| `coworking_booking` | Coworking Booking Board | Coworking | `/coworking/booking-board` |
| `coworking_clients` | Coworking Clients | Coworking | `/coworking/clients` |
| `admin_team` | Team Access | Admin | `/admin/users` |
| `admin_notifications` | Alerts | Admin | `/admin/notifications` |
| `admin_console` | Console | Admin | `/admin/console` |
| `admin_meta_ads` | Meta Ads | Admin | `/admin/meta-ads` |
| `settings` | Settings | Admin | `/settings` |
| `profile` | Profile | Account | `/profile` |

Page grants are spelled `page.<key>.<action>`, actions being
`view · create · edit · delete · export · approve · assign · follow_up`.
`dashboard` is `alwaysAccessible`.

## 4. The visibility algorithm — port verbatim

This is `roleCanSeeItem` from web, restated. Mobile must implement it in
`mobile/src/navigation/access.ts` with identical branching. Do not "simplify"
it; each branch exists for a reason noted in the web source.

```
ROLE_ONLY_PAGES = { admin_team, admin_notifications, admin_console,
                    admin_meta_ads, settings }

canSee(item, role, user):
  permissions   = Array.isArray(user.permissions) ? user.permissions : null
  isConfigured  = role !== "ADMIN" && user.enforcePageAccess && permissions
  isWidenable   = item.page && !ROLE_ONLY_PAGES.has(item.page)

  # 1. Explicit employee page grants override menu role defaults —
  #    but only for pages whose API is not hard-gated on ADMIN/MANAGER.
  if isConfigured and isWidenable:
      if not permissions.includes("page.{item.page}.view"): return false
  else:
      if not item.roles.includes(role): return false
      # A role-only page can still be *revoked* from a configured role.
      if isConfigured and item.page
         and not permissions.includes("page.{item.page}.view"): return false

  # 2. Channel partners only see inventory if explicitly allowed.
  if item.requiresInventoryAccessForPartner
     and role == "CHANNEL_PARTNER" and not user.canViewInventory: return false

  # 3. Coworking permissions. null = still loading — don't hide mid-fetch
  #    or the nav flickers; the screen itself gates on load.
  if item.permission and role != "ADMIN":
      if permissions and not permissions.includes(item.permission): return false

  return true
```

**Key subtlety:** page grants can *widen* access beyond the role list for
ordinary pages, but for `ROLE_ONLY_PAGES` they can only *narrow*. Those five
pages have APIs hard-gated on ADMIN/MANAGER, so widening them would render a
screen that cannot load.

## 5. Navigation model

### 5.1 Web structure

Six sidebar groups (`SIDEBAR_GROUPS`):

| Group | Items |
| --- | --- |
| `WORK` | Home, Tasks, Calendar, Attendance |
| `SALES` | Pipeline, My Leads, Inventory, Owner Database, Broker Database, Projects, Field Ops |
| `BUSINESS` | Finance, Reports, Leaderboard, Targets |
| `TEAM` | Chat |
| `ADMIN` | Team, Console, Meta Ads, Notifications, Settings |
| `COWORKING` | Booking Board, Clients |

Profile sits in the sidebar footer chip (`PROFILE_ITEM`), not in a group.

### 5.2 Mobile structure

A phone cannot show 23 destinations. The mapping:

```
RootNavigator
├── AuthStack               (unauthenticated)
│   └── Login
└── AppStack                (authenticated)
    ├── RoleTabs            — 5 bottom tabs, role-derived
    │   ├── Home            → role dashboard
    │   ├── Pipeline        → Leads or My Leads (whichever the role can see)
    │   ├── Inventory       → AssetVault
    │   ├── Chat            → TeamChat            [badge: chatUnreadTotal]
    │   └── More            → MoreMenu            [badge: notificationUnreadTotal]
    └── Pushed screens      — everything else, via native stack
```

**Tab selection must be computed, not hardcoded.** Build the tab list by running
the visibility algorithm over an ordered preference list and taking the first
four the role can see, then always appending `More`:

```
TAB_PREFERENCE = [dashboard, leads|my_leads, inventory, chat,
                  coworking_booking, tasks, attendance, finance, reports]
```

This replaces the current five hardcoded `if (role === "...")` blocks in
`RoleTabs.tsx` and automatically gives `COWORKING_ADMIN` and
`PRODUCTION_EXECUTIVE` sensible tabs — neither of which works today.

### 5.3 The More screen

Mirrors `getVisibleSidebarGroups()` — grouped exactly as web
(`WORK / SALES / BUSINESS / TEAM / ADMIN / COWORKING`), minus whatever is
already a tab, plus the Profile footer chip. Current `MoreMenuScreen` is a flat
ungrouped list with hardcoded role checks and hardcoded colours; it is rewritten
in Phase 2.

### 5.4 Deep links

`app.json` already declares `"scheme": "theofficeonrent"`. Every page path needs
a deep link so push notifications can open the right screen:

`theofficeonrent://leads/:leadId` → `LeadDetails`, and so on for each of the 22
pages. Required by Phase 9 (push).

## 6. Route guards

Web wraps routes in `PageAccessGate` and `CoworkingPermissionGate`. Mobile needs
the equivalent, because nav-level hiding is not enough — a deep link or a push
notification can land a user on a screen their nav never offered.

- `<PageAccessGate page="leads">` — renders the screen, or an
  `AppEmptyState` "You don't have access to this page" with a back action.
- `<CoworkingPermissionGate permission="cabins.view">` — same, for the 50
  coworking permissions in `frontend/src/constants/permissions.js`.

## 7. Session behaviour

Web reads a session timeout from system settings
(`getSessionTimeoutMs`, `SYSTEM_SETTINGS_UPDATED_EVENT`). Mobile has
`src/utils/systemSettings.ts` (88 lines) already — verify it enforces the same
timeout and the same "settings updated" invalidation, and that backgrounding the
app counts toward the timeout the way tab-blur does on web.

## 8. Acceptance criteria

- [ ] `access.ts` is a line-by-line port of `roleCanSeeItem`, with a unit test
      per branch
- [ ] Page catalogue is fetched from `GET /api/access/catalog`, never hardcoded
- [ ] Zero `role === "ADMIN"` literals remain in navigation or screen files
- [ ] Tabs are computed from the preference list
- [ ] More screen groups match `SIDEBAR_GROUPS` exactly
- [ ] Every screen is wrapped in the appropriate gate
- [ ] Verification: for each of the 8 roles, the set of reachable screens on
      mobile equals the set of reachable routes on web — including for an
      account with `enforcePageAccess` on and a customised grant list
