# BUG REPORT — The Office on Rent CRM

> **Status: fixes applied 2026-09-18.** 29 of these 39 defects are fixed and verified, 1 was
> retracted as a false positive, 5 are partially fixed and 4 were deliberately left alone.
> **CRM-BUG-039 was found later, during a hands-on sign-in session, and is fixed.**
> See **[FIX_REPORT.md](FIX_REPORT.md)** for what changed, how each fix was verified, and the two
> decisions that need a product owner. This document is preserved as the original audit record.

All defects below were **reproduced against a running instance**, not inferred from source.

- Date: 2026-09-18
- Environment: local development — MongoDB `mongodb://127.0.0.1:27017/the_office_on_rent`,
  backend `:5000`, Vite frontend `:5173`, Node 22.15.0, `APP_MODE=single_client`
- ⚠️ The local database is a **mirror of live business data** (real staff emails, 1,174 real leads).
  All test data created during the audit was removed; the database was verified back at baseline.
- Total: **39 defects** — 0 CRITICAL · 11 HIGH · 16 MEDIUM · 12 LOW

## Severity definitions used here

- **CRITICAL** — data loss, auth bypass, or a broken core workflow with no workaround.
- **HIGH** — real data exposure, a broken feature on a shipped page, or a scaling wall.
- **MEDIUM** — incorrect behaviour with a workaround, or a defence-in-depth gap.
- **LOW** — polish, semantics, or hardening.

**No CRITICAL defects were found.** Authentication, write-side authorization, tenant isolation and
lead data-scoping all held under direct attack. The HIGH findings are concentrated in three places:
**read-side role gating**, **file upload/serving**, and **unbounded list responses**.

---

## CRM-BUG-001 — Lead list returns the entire table when `page`/`limit` are omitted

- **Severity**: HIGH · **Category**: Performance / Data
- **Module**: Leads · **Route**: `GET /api/leads` · **Role**: any with leads access
- **File**: `backend/src/utils/queryOptions.js:9-20`, `backend/src/controllers/lead.controller.js:1936`

**Preconditions**: a company with a meaningful number of leads (1,174 here).

**Steps to reproduce**
1. `GET /api/leads` with a valid token and **no** `page` or `limit` query parameter.
2. Observe the response body.

**Expected**: a bounded page plus pagination metadata.

**Actual**: **1,195 rows, 2,721 KB, 481 ms**, and `pagination: null`.

**Evidence**

| Request | Rows | Size | Time |
|---|---|---|---|
| `GET /api/leads` | 1195 | 2721 KB | 481 ms |
| `GET /api/leads?search=` | 1195 | 2721 KB | 344 ms |
| `GET /api/leads?status=NEW` | 807 | 1834 KB | 249 ms |
| `GET /api/leads?limit[]=5&limit[]=9` | 1195 | 2721 KB | 424 ms |
| `GET /api/leads?limit=5` | 5 | 14 KB | 17 ms |
| `GET /api/leads?limit=100000` | 200 | 480 KB | 90 ms (cap works) |

**Root cause**: `parsePagination` sets `enabled:false` when *neither* `page` nor `limit` is present,
and the controller then skips `.skip()/.limit()` entirely. A filter-only request therefore streams the
whole result set. An array-valued `limit[]=` also misses (Express's simple query parser leaves the key
as `limit[]`, so `query.limit` is `undefined`), taking the same unbounded path.

**Real-world impact — this is not hypothetical.** Seven shipped screens call `getAllLeads()` with no
arguments, so each of these downloads the full lead table on every visit:

`frontend/src/modules/admin/AdminCommandConsole.jsx:2795` · `admin/TeamManager.jsx:487` ·
`field/FieldOps.jsx:351` · `finance/FinancialCore.jsx:435` · `reports/IntelligenceReports.jsx:248` ·
`reports/RoleLeaderboard.jsx:120` · `tasks/TaskManager.jsx:242`

**Recommended fix**: default `enabled` to true — always apply a limit (e.g. `defaultLimit` 25,
`maxLimit` 200) whether or not the client asked. Normalise array-valued `page`/`limit` to their first
element. Then give the seven callers an explicit `limit`, or a purpose-built aggregate endpoint for
the ones that only need counts.

**Regression risk**: Medium. Callers that today rely on receiving every lead will start seeing one
page; each of the seven call sites needs review alongside the change.

---

## CRM-BUG-002 — Uploaded files are served with no authorization

- **Severity**: HIGH · **Category**: Security / Privacy
- **Module**: Uploads · **Route**: `GET /api/uploads/files/**` · **Role**: unauthenticated
- **File**: `backend/src/app.js:107-114`

**Steps to reproduce**
1. Upload any file via `POST /api/uploads?category=lead-documents`.
2. Take the returned URL, discard the token, and request it with **no** `Authorization` header.

**Expected**: 401/403 for files attached to business records.

**Actual**: `HTTP 200`, file body returned. Verified with no credentials at all.

**Root cause**: `express.static(uploadsRootDir)` is mounted before any auth middleware and has none of
its own. Upload categories include `lead-documents`, `inventory-documents`, `profile-images` and
`chat` — i.e. customer KYC and deal paperwork.

**Mitigating factor**: filenames are `Date.now()-<12 hex chars>`, so URLs are not trivially guessable.
This is obscurity, not access control: URLs leak through chat, shared links, browser history, referrer
headers and server logs.

**Recommended fix**: serve uploads through an authenticated handler that resolves the owning record
and checks the caller's access to it, then streams from disk (or issues a short-lived signed URL).
Keep `Cross-Origin-Resource-Policy` and add `Content-Disposition: attachment` for documents.

**Regression risk**: Medium — every `<img>`/link that currently points at `/api/uploads/files/...`
must send credentials or use the signed URL.

---

## CRM-BUG-003 — `application/octet-stream` in the upload allowlist defeats MIME filtering

- **Severity**: HIGH · **Category**: Security
- **Module**: Uploads · **Route**: `POST /api/uploads` · **Role**: any authenticated
- **File**: `backend/src/config/uploadStorage.js:26-48, 73-79`

**Steps to reproduce**
1. `POST /api/uploads?category=chat` with filename `payload.html` and
   `Content-Type: application/octet-stream`.
2. Request the returned URL in a browser.

**Expected**: unsupported file type rejected.

**Actual**: accepted (`201`) and later served as `Content-Type: text/html; charset=utf-8`.

**Evidence**

| Upload | Result |
|---|---|
| `payload.html` as `application/octet-stream` | 201 — served as `text/html` |
| `payload.svg` with inline `<script>` as `image/svg+xml` | 201 — served as `image/svg+xml` |
| `tool.exe` as `application/octet-stream` | 201 — stored with `.exe` |
| `invoice.pdf.html` as `application/octet-stream` | 201 — served as `text/html` |
| `shell.php` as `application/x-php` | 400 — correctly rejected |
| `../../../../evil.png` (path traversal) | 201 — filename correctly sanitised, **no traversal** |

**Why this is not CRITICAL**: I tested script execution in a real browser. Helmet's CSP
(`script-src 'self'`) **blocked** the inline script in both the uploaded HTML and SVG:

> "Executing inline script violates the following Content Security Policy directive `script-src 'self'`"

and `deploy/nginx.the-office-on-rent.conf` proxies `/api/` through Express, so CSP also applies in
production. Stored XSS is therefore mitigated **today** — but only by CSP. The MIME allowlist itself
is not doing its job, and the app will host arbitrary `.html`/`.exe` content on its own trusted
domain (phishing / malware distribution), which also becomes script execution the moment CSP is
relaxed or uploads move to a CDN that does not send these headers.

**Recommended fix**: drop `application/octet-stream` from `ALLOWED_MIME_TYPES`; validate the file's
magic bytes rather than the client-supplied MIME; allowlist extensions as well as MIME types; store
with a neutral extension and serve documents with `Content-Disposition: attachment`; rasterise or
reject SVG.

**Regression risk**: Low-Medium — legitimate clients that send `octet-stream` for ordinary documents
will need the correct MIME or an extension allowlist.

---

## CRM-BUG-004 — Role page defaults are never enforced server-side

- **Severity**: HIGH · **Category**: Security (authorization)
- **Module**: Access Control · **Roles**: CHANNEL_PARTNER, COWORKING_ADMIN, PRODUCTION_EXECUTIVE, COMMUNITY_MANAGER
- **File**: `backend/src/services/access.service.js:150` (`enforcePageAccess: hasPageOverride`),
  `backend/src/middleware/pageAccess.middleware.js:12-14, 31`

**Root cause**: `enforcePageAccess` is set to `hasPageOverride` — true **only** for accounts an admin
has explicitly customised. For every account still on its role defaults, both `requirePageAccess` and
`requirePageActionForMethod` `return next()` immediately. So `rolePageAccess.constants.js` — which
defines what each role is supposed to reach — is effectively **advisory on the server**; it shapes
navigation in the UI but gates nothing for default accounts. Only routes with an explicit
`checkRole`/`checkRoleOrPageAccess` gate are actually protected.

**Steps to reproduce**
1. Create a CHANNEL_PARTNER (whose defaults contain no `tasks`, `chat` or `targets` page).
2. Call `GET /api/tasks`, `/api/chat/rooms`, `/api/targets/my` with that token.

**Expected**: 403. **Actual**: 200.

**Evidence** (observed status per role, real sessions)

| Endpoint | Page required | PRODUCTION_EXEC | COMMUNITY_MGR | CHANNEL_PARTNER | COWORKING_ADMIN |
|---|---|---|---|---|---|
| `GET /api/tasks` | tasks | 200 (ok) | 200 (ok) | **200** | **200** |
| `GET /api/tasks/stats` | tasks | 200 | 200 | **200** | **200** |
| `GET /api/chat/rooms` | chat | 200 (ok) | 200 (ok) | **200** | **200** |
| `GET /api/chat/contacts` | chat | 200 | 200 | **200** | **200** |
| `GET /api/chat/escalations` | chat | 200 | 200 | **200** | **200** |
| `GET /api/targets/my` | targets | 200 (ok) | 200 (ok) | **200** | **200** |
| `GET /api/attendance/me` | attendance | 200 (ok) | 200 (ok) | 200 (ok) | **200** |
| `GET /api/attendance/violations` | attendance | 200 | 200 | 200 | **200** |
| `GET /api/contacts` | inventory | **200** | **200** | 200 (ok) | **200** |

Bold = the role's defaults do not include that page. Contrast with properly gated routes, which
behaved correctly: `GET /api/leads` → 403 for PRODUCTION_EXEC / COMMUNITY_MGR / COWORKING_ADMIN;
`/api/inventory`, `/api/projects`, `/api/roles`, `/api/coworking/clients`, `/api/attendance/policy` all
403 as expected.

**Verified not affected**: once an admin **does** set a page override, enforcement switches on and
works correctly — ungranted pages returned 403 and a `create`-less grant blocked `POST /api/leads`.

**Recommended fix**: make enforcement unconditional — resolve pages from the role defaults when there
is no override, and drop the `enforcePageAccess` flag from the middleware's early return. Expect this
to surface currently-passing traffic as 403; roll it out behind a flag and audit real traffic first.

**Regression risk**: **High** — this widens enforcement for every default-role account. Needs a
staged rollout with logging-only mode first.

---

## CRM-BUG-005 — Owner/Broker contact database readable by roles without the Inventory page

- **Severity**: HIGH · **Category**: Security / Privacy
- **Module**: Inventory → Contacts · **Route**: `GET /api/contacts`, `GET /api/contacts/identify`
- **File**: `backend/src/routes/crmContact.routes.js:11-13`

**Steps**: as PRODUCTION_EXECUTIVE or COMMUNITY_MANAGER (neither has `inventory` in its defaults),
call `GET /api/contacts`.

**Expected**: 403. **Actual**: `200` with owner records including phone numbers
(e.g. `{"kind":"OWNER","phone":"9999999999", ...}`).

For a real-estate CRM the owner/broker database is among the most commercially sensitive assets it
holds. The route relies solely on `requirePageAccess("inventory")`, which is inert for default-role
accounts (CRM-BUG-004). The router does block CHANNEL_PARTNER explicitly — that guard is correct and
should be the model for the other roles.

**Recommended fix**: add an explicit `checkRoleOrPageAccess([...allowed roles], "inventory")` to
`crmContact.routes.js`, as `inventory.routes.js` already does.

---

## CRM-BUG-006 — Internal staff directory exposed to the external CHANNEL_PARTNER role

- **Severity**: HIGH · **Category**: Security / Privacy
- **Module**: Chat · **Route**: `GET /api/chat/contacts` · **Role**: CHANNEL_PARTNER

**Steps**: authenticate as CHANNEL_PARTNER, call `GET /api/chat/contacts`.

**Expected**: 403 — `chat` is not in the CHANNEL_PARTNER defaults, and channel partners are external
brokers, not staff.

**Actual**: `200` with **26 internal staff records** (`_id`, `name`, `role`, `roleLabel`).
The same role also reaches `/api/chat/rooms`, `/conversations`, `/broadcasts`, `/escalations` and
`/escalation-logs`.

**Recommended fix**: gate `chat.routes.js` with an explicit role check that excludes CHANNEL_PARTNER,
independent of the page-access flag.

---

## CRM-BUG-007 — `DELETE` is authorised by an `edit` grant

- **Severity**: HIGH · **Category**: Security (authorization)
- **Module**: Access Control · **File**: `backend/src/middleware/pageAccess.middleware.js:40-46`

```js
DELETE: ["delete", "edit"],   // an edit grant satisfies a delete request
POST:   ["create", "edit", "assign", "follow_up", "approve", "delete"],
```

**Steps to reproduce**
1. Grant a user `pageAccess: [{pageKey:"inventory", actions:["view","edit"]}]` — **no** `delete`.
2. Call `DELETE /api/contacts/<id>`.

**Expected**: 403. **Actual**: the permission gate passes and the handler runs (I targeted a
non-existent id deliberately, so the response was `404 "Contact not found"` — proof the gate was
cleared without deleting live data).

`DELETE /api/contacts/:contactId` has **no** secondary ownership or role check — it goes straight to
`Contact.findOneAndDelete(...)`, a hard delete with no soft-delete and no audit entry
(`crmContact.routes.js:61-69`). An employee granted view+edit on Inventory can therefore permanently
destroy owner/broker records.

`DELETE /api/tasks/:taskId` also clears the gate but is saved by its controller's creator/admin check.
`DELETE /api/inventory/:id` correctly returned 403 because its route adds
`checkRoleOrPageAction(["ADMIN"], "delete", "inventory")`.

**Recommended fix**: map `DELETE → ["delete"]` only, and `POST → ["create"]` for creation routes
(keep the wider set for action-style POSTs such as `/approve` by declaring the action explicitly per
route with `requirePageAction`). Add an explicit role gate and an audit-log entry to the contact
delete route.

**Regression risk**: Medium — any user relying on the loose mapping will lose delete access
(which is the point).

---

## CRM-BUG-008 — Company-wide lead analytics readable by every role

- **Severity**: HIGH · **Category**: Security / Data exposure
- **Module**: Leads · **Routes**: `GET /api/leads/performance/overview`, `GET /api/leads/status-requests`

**Steps**: call as PRODUCTION_EXECUTIVE, COMMUNITY_MANAGER, COWORKING_ADMIN or CHANNEL_PARTNER.

**Expected**: 403 — three of these roles get 403 from `GET /api/leads` itself.

**Actual**: `200` with company-wide figures:

```json
{"overview":{"summary":{"totalLeads":1174,"transferredLeads":0,"closed":1,"closeVelocity":0.085...}}}
```

The inconsistency is the tell: the **list** endpoint is gated but these sibling endpoints are not, so
the aggregate leaks what the list refuses. CHANNEL_PARTNER — an external broker role — can read total
pipeline volume and close rates.

**Recommended fix**: apply the same gate the list endpoint uses to every `/api/leads/*` analytics
route, and scope aggregates to the caller's data scope rather than the whole company.

---

## CRM-BUG-009 — Mongoose validation errors surface as HTTP 500 "Server error"

- **Severity**: HIGH · **Category**: API / UX
- **Modules**: User Management, Leads, Tasks

**Steps**: `POST /api/users/create` with no `name` (or no `email`, no `password`, a blank name, or a
password under 6 characters).

**Expected**: `400` naming the offending field. **Actual**: `500 {"message":"Server error"}`.

**Evidence**

| Request | Expected | Actual |
|---|---|---|
| `POST /api/users/create` missing `name` | 400 | **500** Server error |
| `POST /api/users/create` missing `email` | 400 | **500** |
| `POST /api/users/create` missing `password` | 400 | **500** |
| `POST /api/users/create` name `"   "` | 400 | **500** |
| `POST /api/users/create` password `"12345"` | 400 | **500** |
| `POST /api/leads` `{name:null, phone:null}` | 400 | **500** |
| `POST /api/tasks` whitespace title | 400 | **500** Failed to create task |
| `POST /api/tasks` invalid `status`/`priority` | 400 | **500** |
| `POST /api/tasks` unparseable `dueDate` | 400 | **500** |

**Root cause**: `ValidationError`/`CastError` from Mongoose fall through to the generic `catch`, which
returns 500. Consequences: users see "Server error" instead of "Name is required"; genuine 500 alerts
are drowned in ordinary validation noise; and the error rate metric is misleading.

Other modules already do this correctly — `POST /api/inventory`, `/api/projects` and `/api/contacts`
all return clean `400`s with field-level messages (`"projectName is required"`, `"towerName is
required"`, `"Name, valid phone and contact type are required"`). Use those as the pattern.

**Recommended fix**: add an error-mapping helper (or Express error middleware) that converts
`err.name === "ValidationError"` → 400 with the field list and `CastError` → 400 "Invalid <field>",
and apply it in the shared error handler in `app.js`.

**Regression risk**: Low — strictly improves responses.

---

## CRM-BUG-010 — Full-size images served unresized (up to 14.9 MB)

- **Severity**: HIGH · **Category**: Performance
- **Module**: Uploads / Tasks / Profile

Captured from real page loads:

| Route | Asset | Size |
|---|---|---|
| `/tasks` | `profile-images/1786437514546-….jpg` | **14,904 KB** |
| `/tasks`, `/profile` | `profile-images/1786437486703-….jpg` | **5,749 KB** |
| `/projects` | `chat/1785997785223-….png` | 926 KB |

A ~15 MB avatar is downloaded to render a small profile circle. The upload path stores the original
bytes (limit 25 MB) with no resizing, and no thumbnail variant is generated.

**Recommended fix**: generate resized derivatives on upload (e.g. sharp: 64/128/256 px avatars,
max ~1600 px for photos), serve the smallest sufficient variant, and add long-lived cache headers
(the static mount already sets `maxAge: 30d, immutable`).

---

## MEDIUM severity

### CRM-BUG-011 — Lead creation accepts almost any input
**Category**: Data integrity · `POST /api/leads`

| Input | Result |
|---|---|
| name `"   "`, phone `"   "` | **201** — junk lead created (confirmed stored as `{"name":"   ","phone":"   "}`) |
| phone `"abcdefghij"` | 201 |
| phone `"12"` / `"9"` | 201 |
| phone 40 digits | 201 |
| `email: "not-an-email"` | 201 |
| 10,000-character name | 201 |
| `budget: -50000` | 201 |
| `status: "NOT_A_STATUS"` | 201 (silently ignored) |
| `nextFollowUpAt: "not-a-date"` | 201 (silently ignored) |

Whitespace passes the `!name` check because `"   "` is truthy, and `trim: true` runs afterwards.
Correctly rejected: NoSQL operator in `phone` (400). **Fix**: trim before the required check; add
length bounds, a phone-format rule and an email rule; reject unknown enum values instead of dropping
them. Note this is a create-time gap only — `PATCH /leads/:id/status` *does* validate the enum and
enforces "Brokerage Received is required when closing a deal".

### CRM-BUG-012 — `/leaderboard` is broken for ADMIN on first load
**Category**: Functional · `frontend/src/modules/reports/RoleLeaderboard.jsx:89`

`selectedRole` is initialised to the viewer's own role from localStorage, so an admin sends
`role=ADMIN`. `LEADERBOARD_ROLE_OPTIONS_BY_ACTOR[ADMIN]` is `[MANAGER, EXECUTIVE, FIELD_EXECUTIVE,
CHANNEL_PARTNER]` — ADMIN is not a rankable target — so the API returns
`400 {"message":"Invalid role filter"}`. The page renders "No leaderboard rows for this month",
"of 0", and the text **"Invalid role filter"**. Because `allowedRoleFilters` never arrives, the role
selector does not render either, so the user cannot recover. Also the only route in the whole sweep
that logged a console error.

**Fix**: send no `role` on first load (the backend already defaults to `allowedRoles[0]`), or read
the options first and select `allowedRoleFilters[0]`. Roles absent from the map
(PRODUCTION_EXECUTIVE, COMMUNITY_MANAGER, COWORKING_ADMIN, INSIDE_EXECUTIVE) get 403 — hide the nav
entry for them.

### CRM-BUG-013 — NoSQL operators reach the Mongo query on login
**Category**: Security · `backend/src/controllers/auth.controller.js:176`

`POST /api/auth/login` with `{"email":{"$ne":null},"password":{"$ne":null}}` → **500**.
`User.findOne({ email })` passes the object straight into the query and **matches a user**; the
request only fails because `bcrypt.compare` throws on a non-string. Authentication is intact, but it
is held together by a downstream exception rather than input validation. **Fix**: require
`typeof email === "string" && typeof password === "string"` before querying (and sanitise globally).

### CRM-BUG-014 — Invalid credentials return 400 instead of 401
**Category**: API semantics. Both "wrong password" and "unknown email" return
`400 {"message":"Invalid credentials"}`. Clients distinguishing auth failure from malformed input
cannot. Good news: the two cases are **identical**, so there is no user enumeration here.

### CRM-BUG-015 — `sortBy` is ignored on the leads list
**Category**: Functional. `?sortBy=name`, `?sortBy=-name` and no sort all returned the identical
first rows (`Concurrent B | QA XCompany | QA BadDate | QA PastFU`). Garbage values
(`sortBy=; drop`, `sortBy={"$ne":1}`) are safely ignored — no injection — but no sort is applied
either. **Fix**: map an allowlist of sortable fields to a Mongo sort, and reject the rest.

### CRM-BUG-016 — Duplicate API calls on page load
**Category**: Performance. `GET /api/client/leads` fires **twice** on 14 of 32 routes; combined with
CRM-BUG-001 that is ~5.4 MB per visit. `/targets` fires `GET /api/client/targets/my` **six times**.
The 8-second axios GET cache in `services/api.js` is not absorbing these (different param shapes or
concurrent in-flight calls). **Fix**: dedupe in-flight requests by cache key, and check for effects
re-running on unstable dependencies.

### CRM-BUG-017 — Access token stays valid after logout
**Category**: Security. After `POST /api/auth/logout`, the refresh token is correctly revoked
(subsequent refresh → 401) but the access token still returns `200` from `/api/auth/me` for the
remainder of its 15-minute TTL. Standard stateless-JWT behaviour, but it should be a documented,
deliberate choice. **Fix** (if tighter revocation is wanted): a short-lived denylist keyed on `jti`,
or a `tokenVersion` on the user checked in `protect`.

### CRM-BUG-018 — CORS allows any `192.168.x.x` origin with credentials
**Category**: Security · `backend/src/app.js:38-48` and the same logic in `server.js` for Socket.IO.
`isLanOrigin` reflects **any** `192.168.*` origin and sets `Access-Control-Allow-Credentials: true`.
Verified: `Origin: http://192.168.1.50:3000` → `ACAO: http://192.168.1.50:3000`, `credentials: true`.
Any device or app on the same office LAN can make credentialed cross-origin calls. Untrusted public
origins are correctly refused (`https://evil.example.com` → no ACAO). **Fix**: restrict the LAN rule
to development only (`NODE_ENV !== "production"`).

### CRM-BUG-019 — Escape does not close modals
**Category**: UX / Accessibility. Verified on `/admin/users`, `/tasks` and `/inventory`: the dialog
opens, `Escape` leaves it open. **Fix**: add a keydown handler in the shared `Modal` component.

### CRM-BUG-020 — Modals do not receive focus when opened
**Category**: Accessibility. On `/admin/users` and `/inventory` focus stays on the page behind the
dialog (`/tasks` does it correctly). No focus trap. Keyboard and screen-reader users are left outside
the dialog. **Fix**: move focus to the dialog on open, trap Tab within it, restore focus on close.

### CRM-BUG-021 — Accessibility violations (axe-core, WCAG 2.1 AA)
**Category**: Accessibility

| Page | Violation | Impact | Nodes |
|---|---|---|---|
| `/login` | inputs have no programmatic label | serious | 2 |
| `/login`, `/dashboard` | `select-name` — select has no accessible name | **critical** | 2 each |
| `/profile` | `button-name` — buttons with no discernible text | **critical** | 2 |
| `/profile` | `label` — form elements without labels | **critical** | 3 |
| `/tasks`, `/admin/users` | `nested-interactive` — interactive controls nested | serious | 27 each |
| `/login`, `/dashboard`, `/tasks`, `/admin/users`, `/profile` | `color-contrast` | serious | 2–10 |

`/leads` scored **0 violations** and row actions carry good aria-labels ("Call Abhishek Prajapat",
"More actions for…"), so the codebase clearly knows how to do this — it is inconsistently applied.
Focus indicators during keyboard navigation are visible (PASS).

### CRM-BUG-022 — No 404 page
**Category**: UX. `/this-route-does-not-exist` renders the full app shell (sidebar, header) with an
**empty content area** — 250 characters of nav and nothing else. There is no catch-all inside
`appRoutes` in `App.jsx`. **Fix**: add a `<Route path="*">` NotFound element.

### CRM-BUG-023 — User creation accepts invalid email and phone; duplicate phone allowed
**Category**: Data integrity. `POST /api/users/create` with `email: "not-an-email"` → **201**
(the account can then never receive mail and its login identity is broken).
`phone: "abcdefghij"` → 201. `phone: "1"` → 201. A second user with an existing phone → 201.
Duplicate **email** is correctly rejected, including case variants (emails are lowercased).
**Fix**: validate email format and phone shape; decide whether phone should be unique per company
(it is used for identification and WhatsApp routing) and add the index if so.

### CRM-BUG-024 — Task creation returns 500 on bad enum/date
Covered by the evidence table in CRM-BUG-009; listed separately because the fix lives in
`task.controller.js`. `POST /api/tasks` also accepts a 5,000-character title.

### CRM-BUG-025 — `propertyId` is not unique
**Category**: Data integrity. Three of four inventory records share `propertyId: "Prop-01"`:

```
6a55fafc4daa7289bf359040  propertyId="Prop-01"
6a5600574daa7289bf359159  propertyId="Prop-01"
6a58b9c5edff6613ac4fd4fc  propertyId="Prop-01"
6aa29dddf433d91ce202fd12  propertyId="COM-0008"   <- counter-generated
```

The `propertyId_1` index exists but is **not unique**, so manually entered IDs can collide while
`InventoryIdCounter`-generated ones (`COM-0008`) are fine. Two different properties displaying the
same ID will confuse staff and any lookup by that ID. **Fix**: add a unique compound index on
`{companyId, propertyId}` after de-duplicating existing data, or always generate the ID.

### CRM-BUG-037 — Invalid list filters are silently ignored
**Category**: API. `?status=INVALID_STATUS` → 200 (filter dropped, full list returned);
`?fromDate=garbage` → 200; an inverted range `?fromDate=2030-01-01&toDate=2020-01-01` → 200 rather
than 400 or an empty set. A typo in a saved filter silently returns *more* data than intended.
Correct by contrast: `?source=WEBSITE` → `400 "Invalid source filter"` (the enum is `META|MANUAL`),
and `?assignedTo=not-an-id` → 400. **Fix**: validate every filter the way `source` already is.

---

## LOW severity

| ID | Title | Detail |
|---|---|---|
| CRM-BUG-026 | No empty state on lead search | Searching for a non-matching term correctly drops the table to 0 rows, but no "no results" message is shown — just an empty table. |
| CRM-BUG-027 | Deactivated accounts are enumerable | A deactivated account returns `403 "Account is deactivated"` *before* the password is checked, while every other failure returns `400 "Invalid credentials"`. Any email can be tested for deactivated status without the password. Move the `isActive` check after `matchPassword`. |
| CRM-BUG-028 | Duplicate email returns 400, not 409 | `POST /api/users/create` with an existing email → `400 "User already exists"`. REST semantics call for 409 Conflict. |
| CRM-BUG-029 | Tokens in `localStorage` | `token` and `refreshToken` are readable by any script on the origin. CSP currently mitigates injected script. Consider httpOnly cookies for the refresh token. |
| CRM-BUG-030 | Small tap targets | At 375 px, 10 of 30 visible interactive elements are under the 44×44 px guideline. |
| CRM-BUG-031 | Sticky header intercepts row clicks | The `app-context-header` captures pointer events for table rows near the top of the viewport; a row scrolled under it cannot be clicked until scrolled clear. |
| CRM-BUG-032 | No `npm test` script | `backend/package.json` defines no `test` script; the 199-test suite only runs via `node --test "test/*.test.cjs"`. `node --test test/` fails outright. CI cannot run `npm test`. |
| CRM-BUG-033 | ESLint warnings | 4 `react-hooks/exhaustive-deps` warnings in `App.jsx:347`, `AdminNotifications.jsx:340`, `TeamManager.jsx:505`, `LeadDetailsRebuilt.jsx:1407`. Build and lint both exit 0. |
| CRM-BUG-034 | Email uniqueness is global, not per tenant | `createUserByRole` runs `User.findOne({ email })` with no `companyId` filter, so one tenant can detect that an email exists in another. Irrelevant in `single_client` mode; a leak in multi-tenant mode. |
| CRM-BUG-035 | Stale testing documentation | `docs/TESTING_FLOW.md` tells you to run `npm --prefix backend run seed:super-admin`, which does not exist in `package.json`. Line 16 also contains corrupted text: `Inventory request and property status workflow]\75d q FG?`. |
| CRM-BUG-036 | Mongoose deprecation warning | `findOneAndUpdate()` is called with the deprecated `new` option (surfaced during `PATCH /api/users/profile`). Use `returnDocument: "after"`. |
| CRM-BUG-038 | Dev-only route in the router | `/_kitchen-sink` is guarded by `import.meta.env.DEV` and its own comment says "Removed in Phase 14". Confirm it is stripped from production builds. |

---

---

## CRM-BUG-039 — An Admin locks themselves out after 8 ordinary sign-ins

- **Severity**: HIGH · **Category**: Functional / Availability
- **Module**: Authentication · **Route**: `POST /api/auth/login` · **Role**: ADMIN
- **Found**: hands-on session, 2026-09-18 (after the first fix round)
- **File**: `frontend/src/components/auth/Login.jsx:21-45`, `backend/src/controllers/auth.controller.js:241`,
  `backend/src/middleware/rateLimit.middleware.js:33-38`

**Preconditions**: sign in as an Admin from the shared `/login` page.

**Steps to reproduce**
1. Sign in as `admin@test.com` at `/login`. It works.
2. Repeat seven more times within 15 minutes from the same IP.
3. On the eighth, sign-in fails with "Too many failed auth attempts. Please retry later."

**Expected**: a correct password never counts against a brute-force limiter.

**Actual**: the Admin is locked out for 15 minutes, having never typed a wrong password.

**Evidence**

```
login #1  leg1=403 (Admin must login via admin portal.)   leg2=200 (Login successful)
...
login #8  leg1=403 (Admin must login via admin portal.)   leg2=429 (Too many failed auth attempts)
>>> ADMIN LOCKED OUT after 8 normal logins <<<
```

**Root cause**: `/login` sent `portal: "GENERAL"`. The API refuses that combination for an Admin
(`portal === "GENERAL" && user.role === ADMIN` → 403), and the page then silently retried with
`portal: "ADMIN"`. So every Admin sign-in made **two** requests, the first always a 403. `authLimiter`
sets `skipSuccessfulRequests: true`, which only skips responses **under 400** — so each 403 consumed
one of the 8 slots. The retry made the flaw invisible in the UI while it burned the budget.

Aggravating factors: it is per-IP, so everyone behind one office NAT shares the 8; every Admin sign-in
also logged a browser console error and a 403 in the server logs that reads exactly like a failed
authentication, which would mask a real attack.

**Fix applied**: the shared sign-in page no longer sends a portal, so neither rule fires and sign-in is
a single request. `/login/admin` still sends `portal: "ADMIN"`, so that entrance keeps refusing
non-admins. The retry workaround is removed rather than left dormant.

**Verified**: 8 consecutive sign-ins through the real form — all 8 reached the app, **one** auth
request each, **zero** 403s, **zero** console errors; `/login/admin` still rejects a bad sign-in (401).
Regression test added.

**Regression risk**: Low. End-user behaviour is unchanged (an Admin could already sign in at `/login`);
only the wasted failing request is gone.

## Verified secure — attempted and correctly blocked

Recording what held up matters as much as what broke.

| Attack | Result |
|---|---|
| `alg:none` JWT forgery | 401 |
| JWT signed with a different secret | 401 |
| Expired JWT | 401 |
| JWT referencing a deleted user | 401 |
| Client-portal / push-reply scoped token used as a staff token | 401 |
| NoSQL auth bypass (`{$ne:null}` credentials) | No bypass (500 — see CRM-BUG-013) |
| Self-escalation to ADMIN via `PATCH /api/users/profile` | 400, role unchanged |
| Low-privilege user creating a user | 403 "Only ADMIN or MANAGER can create users" |
| Low-privilege user deleting a user | 403 "Only ADMIN can delete users" |
| Low-privilege user assigning targets | 403 |
| Low-privilege user editing the attendance policy | 403 |
| Low-privilege user creating a custom role | 403 |
| Low-privilege user granting themselves page access | 403 |
| IDOR: executive reading/editing/deleting another's lead | 404 on all three, for both executive accounts |
| Cross-role task access | 403 |
| Mass assignment of `_id` / `companyId` on user create | Ignored — verified in MongoDB |
| Path traversal in an upload filename (`../../../../evil.png`) | Sanitised, no traversal |
| Regex injection via lead search (`.*`, `(a+)+$`) | Escaped (`escapeRegex`), no ReDoS (≤170 ms) |
| Brute force: 12 failed logins | 429 after 4 |
| CORS from `https://evil.example.com` | No `Access-Control-Allow-Origin` |
| Stack traces in error responses | None across 9 probed write endpoints |
| Invalid inventory share token | 404; public payload contains no owner PII |
| Message to a chat room the user is not in | 404 |
| Back button after logout / direct URL while logged out | Redirected to `/login` |
| Referential integrity (1,174 leads, 18 tasks, 27 users) | 0 orphans, 0 missing `companyId`, 0 missing timestamps |
