# FEATURE INVENTORY — The Office on Rent CRM

Discovered by reading the actual implementation (routers, controllers, services, models, React
route table and module components) and confirmed by exercising the running application.
Nothing in this file is assumed from naming conventions.

- Date: 2026-09-18
- Backend: Express 5 + Mongoose 9 (CommonJS), Socket.IO, JWT auth
- Frontend: React 19 + Vite 7 + React Router 7 + Tailwind + Zustand
- Database: MongoDB (`the_office_on_rent`) — 57 collections
- Modules discovered: **17**
- Distinct features catalogued: **214**
- Frontend routes: **37**
- Canonical API endpoints: **243** (486 counting the `/api/client` twin mount, 479 unique paths)

Test status legend: `PASS` verified working · `FAIL` defect found · `PARTIAL` mostly working with a
defect · `BLOCKED` could not be exercised · `NOT TESTED` out of reach in this environment.

---

## 1. Authentication & Session

| Feature | Route / Endpoint | Roles | Expected behaviour | Status |
|---|---|---|---|---|
| Staff login | `POST /api/auth/login`, `/login` | public | Issue access + refresh token | PASS |
| Admin-portal login variant | `/login/admin` (`portal:"ADMIN"`) | public | Non-admins refused | PASS |
| Current user | `GET /api/auth/me` | any | Returns profile, no password hash | PASS |
| Refresh access token | `POST /api/auth/refresh` | any | Rotates refresh token | PASS |
| Refresh-token rotation | — | any | Consumed token rejected | PASS |
| Logout | `POST /api/auth/logout` | any | Revokes refresh token | PARTIAL — access token stays valid (CRM-BUG-017) |
| Session persistence across reload | localStorage `token`/`user`/`role` | any | Session survives refresh | PASS |
| Protected-route guard (direct URL) | `/*` | any | Redirect to `/login` | PASS |
| Back button after logout | — | any | Cannot restore authenticated page | PASS |
| Deactivated account blocked | login | any | 403 "Account is deactivated" | PARTIAL — enumerable (CRM-BUG-027) |
| Company-inactive block | `protect` middleware | any | 403 | PASS |
| Session idle timeout | `utils/systemSettings.js` | any | Auto-logout after configured idle | NOT TESTED (time-based) |
| Password reset / forgot password | — | — | **Feature does not exist** | N/A |
| Remember me | — | — | **Feature does not exist** | N/A |
| Account self-registration | — | — | **Does not exist** (admin-created only) | N/A |

## 2. Authorization / RBAC

| Feature | Where | Notes | Status |
|---|---|---|---|
| Built-in roles (9) | `constants/role.constants.js` | ADMIN, MANAGER, EXECUTIVE, INSIDE_EXECUTIVE, FIELD_EXECUTIVE, PRODUCTION_EXECUTIVE, COMMUNITY_MANAGER, CHANNEL_PARTNER, COWORKING_ADMIN | PASS |
| Page catalogue (22 pages × 8 actions) | `constants/page.constants.js` | view/create/edit/delete/export/approve/assign/follow_up | PASS |
| Per-role page defaults | `constants/rolePageAccess.constants.js` | Defaults per role | FAIL — not enforced server-side (CRM-BUG-004) |
| Per-employee page override | `PATCH /api/access/users/:id/pages` | `{pageAccess:[{pageKey,actions}]}` | PASS |
| Effective permissions for self | `GET /api/access/me` | Any signed-in user | PASS |
| Data scope (ALL/TEAM/ASSIGNED/SELF) | `access.service.js` | Hierarchy scoping on lists | PASS |
| Hierarchy (parentId chain) | `hierarchy.service.js` | Manager sees own branch | PASS |
| Custom roles (company-defined) | `GET/POST/PATCH/DELETE /api/roles` | ADMIN + MANAGER only | PASS |
| Privilege-escalation guard on grants | `assertGrantablePermissions` | Cannot grant what you lack | PASS |
| Coworking capability permissions | `requirePermission("bookings.view"…)` | Separate capability names | PASS |
| Verb→action mapping for writes | `requirePageActionForMethod` | DELETE accepts `edit` | FAIL (CRM-BUG-007) |

## 3. User Management

| Feature | Endpoint | Roles | Status |
|---|---|---|---|
| List users (hierarchy-scoped) | `GET /api/users` | any (scoped) | PASS |
| Create user | `POST /api/users/create` | ADMIN, MANAGER | PARTIAL (CRM-BUG-009, -023) |
| Create user with custom role preset | `POST /api/users/create` + `customRoleId` | ADMIN, MANAGER | PASS |
| Edit user (admin) | `PATCH /api/users/admin/:userId` | ADMIN | PASS |
| Edit user (role-scoped) | `PATCH /api/users/:userId` | ADMIN, MANAGER | PASS |
| Change designation | `PATCH /api/users/:userId/designation` | ADMIN/MANAGER | PASS |
| Delete user | `DELETE /api/users/:userId` | ADMIN only | PASS |
| Request user deletion | `POST /api/users/:userId/delete-request` | MANAGER only | PASS |
| Review delete request | `PATCH /api/users/delete-requests/:id/review` | ADMIN only | PASS |
| My profile | `GET/PATCH /api/users/profile` | any | PASS |
| User profile (admin view) | `GET /api/users/:userId/profile` | ADMIN only | PASS |
| My team | `GET /api/users/my-team` | any | PASS |
| Role leaderboard | `GET /api/users/leaderboard` | ADMIN/MANAGER/EXEC/FIELD/PARTNER | FAIL (CRM-BUG-012) |
| Rebalance executives | `POST /api/users/rebalance-executives` | ADMIN, MANAGER | PASS |
| Channel-partner inventory access flag | `PATCH /api/users/:id/channel-partner/inventory-access` | ADMIN | PASS |
| Live location update | `PATCH /api/users/location` | FIELD_EXECUTIVE | PASS |
| Field executive locations | `GET /api/users/field-locations` | ADMIN/MANAGER/FIELD | PASS |
| Employee page-access screen | `/admin/users/:userId` | ADMIN | PASS |

## 4. Leads / CRM Pipeline (largest module — 21 endpoints)

| Feature | Endpoint | Status |
|---|---|---|
| List leads (filters, search, pagination) | `GET /api/leads` | FAIL — unbounded without page/limit (CRM-BUG-001) |
| Lead detail | `GET /api/leads/:leadId` | PASS |
| Create lead | `POST /api/leads` | FAIL — almost no validation (CRM-BUG-011) |
| Bulk upload leads | `POST /api/leads/bulk` | PASS (row cap enforced) |
| Update lead | `PATCH /api/leads/:leadId` | PASS |
| Delete lead | `DELETE /api/leads/:leadId` | PASS |
| Change status (10-stage pipeline) | `PATCH /api/leads/:leadId/status` | PASS — enum + closure rules enforced |
| Assign / reassign | `PATCH /api/leads/:leadId/assign` | PASS |
| Lead pool (unassigned) | `GET /api/leads/pool` | PASS |
| Activity trail | `GET /api/leads/:leadId/activity` | PASS |
| Lead diary notes | `GET/POST/PATCH /api/leads/:leadId/diary` | PASS |
| Follow-up scheduling + reminder toast | `nextFollowUp` + `FollowUpReminderToast` | PASS |
| Attach / select / remove properties | `PATCH|DELETE /api/leads/:leadId/properties/...` | PASS |
| Payment requests / closure approval | `GET /api/leads/payment-requests` | PASS |
| Status-change requests | `GET /api/leads/status-requests` | FAIL — readable by all roles (CRM-BUG-008) |
| Performance overview | `GET /api/leads/performance/overview` | FAIL — readable by all roles (CRM-BUG-008) |
| Duplicate detection (phone) | `Lead` unique-ish check | PASS — "Lead already exists" |
| Advanced filters flyout | `LeadAdvancedFilters.jsx` | PASS |
| Search (name/phone/project) | `?search=` | PASS — regex-escaped |
| Sorting | `?sortBy=` | FAIL — ignored (CRM-BUG-015) |
| Export to CSV/XLSX | `LeadsMatrix` client-side | PASS |
| Call / WhatsApp / Email quick actions | row action buttons | PASS (render + aria-labels) |
| Coworking requirement fields | `CoworkingRequirementFields.jsx` | PASS |
| Meta (Facebook) lead webhook | `GET/POST /api/webhook/meta` | NOT TESTED (external) |

## 5. Inventory / Property

| Feature | Endpoint | Status |
|---|---|---|
| List / search inventory | `GET /api/inventory` | PASS |
| Inventory detail | `GET /api/inventory/:id` | PASS |
| Create inventory | `POST /api/inventory` | PASS — good field-level validation |
| Bulk upload | `POST /api/inventory/bulk` | PASS (ADMIN/MANAGER) |
| Update | `PATCH /api/inventory/:id` | PASS (ADMIN/MANAGER) |
| Delete | `DELETE /api/inventory/:id` | PASS (ADMIN only) |
| Activity log | `GET /api/inventory/:id/activity` | PASS |
| Share link (public) | `POST /api/inventory/:id/share` → `/shared/inventory/:token` | PASS — invalid token 404, no owner PII leaked |
| Auto-generated property IDs | `InventoryIdCounter` | FAIL — `propertyId` not unique (CRM-BUG-025) |
| Inventory approval workflow | `inventoryApproval.controller.js` | PASS |
| Inventory requests | `/api/inventory-request/*` (9 endpoints) | PASS |
| Owner database | `/inventory/owners` + `/api/contacts?kind=OWNER` | FAIL — cross-role readable (CRM-BUG-005) |
| Broker database | `/inventory/brokers` | FAIL — same |
| Contact bulk import | `POST /api/contacts/bulk` | PASS — row cap enforced |
| Asset vault | `/inventory` → `AssetVault.jsx` | PASS |
| Projects CRUD | `/api/projects` (5 endpoints) | PASS |

## 6. Tasks

| Feature | Endpoint | Status |
|---|---|---|
| List / filter tasks | `GET /api/tasks` | PASS |
| Task detail | `GET /api/tasks/:taskId` | PASS |
| Create task | `POST /api/tasks` | PARTIAL — 500s on bad enum/date (CRM-BUG-024) |
| Update task | `PATCH /api/tasks/:taskId` | PASS — receivers may only change status |
| Delete task | `DELETE /api/tasks/:taskId` | PASS — creator/admin only |
| Task stats | `GET /api/tasks/stats`, `/stats/by-user` | PASS |
| Assignee picker | `GET /api/tasks/assignees` | PASS |
| Subtasks | `subtasks[]` + `SubtaskDetailPanel.jsx` | PASS |
| Task visibility by role | `checkTaskAccess` | PASS — unrelated user 403 |
| Socket notification on assign/delete | `chat.socket.js` | PASS |
| Lead-linked tasks | `leadId` | PASS — blocked for production roles |

## 7. Attendance

| Feature | Endpoint | Status |
|---|---|---|
| My attendance | `GET /api/attendance/me` | PASS |
| Check-in (geo-gated) | `POST /api/attendance/check-in` | BLOCKED — requires location permission |
| Check-out | `POST /api/attendance/check-out` | PASS — refuses without check-in |
| Break start / end | `POST /api/attendance/break/*` | PASS — refuses when not checked in |
| Admin break management/correction | `POST|PATCH /api/attendance/users/:userId/...` | PASS |
| Daily attendance board | `GET /api/attendance/daily` | PASS — date validation works |
| Per-user attendance | `GET /api/attendance/users/:userId` | PASS |
| Attendance policy | `GET/PATCH /api/attendance/policy` | PASS — ADMIN/MANAGER only |
| Violations list + review | `GET /api/attendance/violations` | PASS |
| Leave balance (accrual) | `GET /api/attendance/leave-balance/my` | PASS |
| Leave requests + approval | `POST/GET/PATCH /api/attendance/leave-requests/*` | PASS — date range validated |
| Auto-checkout sweep | `server.js` interval | NOT TESTED (time-based) |

## 8. Coworking (92 endpoints — largest surface)

| Sub-module | Endpoints | Status |
|---|---|---|
| Properties | `/api/coworking/properties` (5) | PASS |
| Floors | `/api/coworking/floors` (5) | PASS |
| Cabins (+block/unblock/seats) | `/api/coworking/cabins` (14) | PASS |
| Booking board + saved state | `GET/PUT /api/coworking/board` | PASS |
| Bookings lifecycle | confirm/activate/complete/extend/cancel/no-show (14) | PASS |
| Clients + contacts + documents | `/api/coworking/clients` (16) | PASS |
| Contracts (activate/terminate/renew) | `/api/coworking/contracts` (9) | PASS |
| Invoices (+generate for contract) | `/api/coworking/invoices` (6) | PASS |
| Payments (+refund) | `/api/coworking/payments` (3) | PASS |
| Expenses (approve/reject/mark-paid) | `/api/coworking/expenses` (10) | PASS |
| Seat availability | `/api/coworking/seats` | PASS |
| My coworking permissions | `/api/coworking/permissions/me` | PASS |
| Birthday reminders | `/api/coworking/clients/birthdays` | PASS |
| Rent-reminder sweep (email/WhatsApp) | `server.js` intervals | NOT TESTED (disabled in env) |

## 9. Client Portal (separate token scope)

| Feature | Endpoint | Status |
|---|---|---|
| Portal login / refresh / logout / me | `/api/portal/auth/*` | PASS — scope isolated from staff tokens |
| My client profile | `GET /api/portal/me/client` | NOT TESTED (no portal credentials) |
| My invoices / bookings / contracts / documents | `/api/portal/*` | NOT TESTED |
| Staff token cannot be used on portal routes | — | PASS |
| Portal token cannot be used as a staff token | — | PASS |

## 10–17. Remaining modules

| # | Module | Key surface | Status |
|---|---|---|---|
| 10 | Team Chat | `/api/chat/*` (20), Socket.IO rooms, escalations, broadcasts, call history | PASS functionally; FAIL on role gating (CRM-BUG-006) |
| 11 | Notifications | Web push (VAPID), `/api/push/*`, reply-from-notification token | PASS (push disabled in env; reply-token suite green) |
| 12 | Targets | `GET /api/targets/my`, `POST /api/targets/assign` | PASS — assign is role-gated |
| 13 | Dashboards | Manager / Executive / Field / Production / Admin console | PASS render; metrics reconciliation NOT TESTED |
| 14 | Reports & Analytics | `/reports`, `/leaderboard`, Intelligence reports, Performance | PARTIAL (CRM-BUG-012) |
| 15 | Calendar | `/calendar` — follow-ups, tasks, meetings | PASS render |
| 16 | Field Ops | `/map` — Leaflet map, dispatch queue, visits, live locations | PASS render |
| 17 | Finance | `/finance` — revenue, brokerage, collections | PASS render |
| — | Office Assistant | `POST /api/assistant/ask` | NOT TESTED |
| — | SaaS / subscription | `/api/client/saas/*` | NOT TESTED (single-client mode) |
| — | File uploads | `POST /api/uploads`, static `/api/uploads/files` | FAIL (CRM-BUG-002, -003) |
| — | Legal pages | `/privacy-policy`, `/terms-and-conditions`, `/data-use-notice`, `/service-terms` | PASS |
| — | Observability | `/api/health`, `/api/metrics` (Prometheus) | PASS — metrics token-gated in production |

---

## Cross-cutting infrastructure discovered

- **Rate limiting**: `apiLimiter` 300/min, `authLimiter` 8 per 15 min (skips successes),
  `writeLimiter` 80/min, `chatMessageLimiter` 45/min, `webhookLimiter` 120/min — all verified active.
- **Security headers**: helmet with CSP, HSTS, `nosniff`, `X-Frame-Options`, no `X-Powered-By`.
- **Audit logging**: `AuditLog` model + `auditLog.service.js` on sensitive mutations.
- **Slow-query logging**: `mongooseSlowQueryPlugin`.
- **Caching**: TTL caches for access profiles (30s) and company status (30s); axios GET cache (8s).
- **Background sweeps**: attendance auto-checkout, attendance violations, booking expiry,
  contract lifecycle, invoice overdue, rent reminders.
- **Socket.IO**: chat rooms, task events, admin request alerts, presence.
- **Multi-tenancy**: `companyId` on every business collection; `tenant.middleware` + `company.middleware`.
  Currently running in `APP_MODE=single_client`.
