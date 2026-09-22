# FINAL QA REPORT — The Office on Rent CRM

> **Status: fixes applied 2026-09-18** — see **[FIX_REPORT.md](FIX_REPORT.md)**. The findings below
> describe the codebase *as audited*, before the fixes. The production-readiness assessment in the
> Executive Summary should be read against the fix report, which closes all ten HIGH findings.

**Date**: 2026-09-18 · **Branch**: `main` @ `2ba5fdd` · **Auditor**: automated end-to-end QA audit

---

## Executive Summary

I audited this CRM end to end against a **running instance** — real HTTP requests through the real
Express middleware stack to the real MongoDB, and a real Chromium browser driving the real React app.
Nothing here is marked PASS on the strength of reading code.

**1,013 test scenarios executed: 806 passed, 207 failed.** From those failures, **38 distinct
defects**: **0 CRITICAL, 10 HIGH, 16 MEDIUM, 12 LOW**.

The headline is more reassuring than the raw failure count suggests. **The things that would be
catastrophic are sound.** I attacked authentication with forged `alg:none` tokens, wrong-secret
signatures, expired tokens, scoped-token substitution and NoSQL operator injection — all refused. I
attempted privilege escalation from five different low-privilege roles against user creation, user
deletion, target assignment, attendance policy, custom-role creation and self-granting page access —
**every write-side escalation was blocked**. I tried IDOR on leads and tasks from two unrelated
executive accounts — all returned 404. Mass assignment was ignored. Path traversal was sanitised.
Lead search is regex-escaped. Rate limiting fires. Security headers are properly configured via
helmet. Referential integrity across 1,174 leads is clean: zero orphans, zero missing `companyId`,
zero missing timestamps. Responsive layout is genuinely excellent — **zero horizontal overflow across
12 pages × 9 viewport widths**. All 32 navigable routes render with no blank screens and no crashes.

The real problems cluster in three places:

1. **Read-side authorization.** Write permissions are enforced well; *read* permissions are not.
   `enforcePageAccess` is set to `hasPageOverride`, so `rolePageAccess.constants.js` — the file that
   defines what each role may reach — is **inert on the server for every account still on its role
   defaults**. It shapes the UI and gates nothing. Concretely: an external CHANNEL_PARTNER can read
   the internal staff directory (26 people) and company-wide lead totals; a PRODUCTION_EXECUTIVE can
   read the owner/broker contact database with phone numbers. This is the most important cluster.

2. **File upload and serving.** Uploaded files — including `lead-documents` and customer KYC — are
   served by `express.static` with **no authorization at all**. And `application/octet-stream` sits
   in the MIME allowlist, which defeats the allowlist entirely. I verified in a browser that CSP
   currently blocks script execution from uploaded HTML/SVG, so this is not stored XSS today; it is
   one config change away from being so.

3. **Unbounded list responses.** `GET /api/leads` without `page`/`limit` returns **all 1,195 leads,
   2.7 MB, in one response** — and seven shipped screens call it exactly that way on every visit.
   This is the clearest scaling wall in the codebase.

Also worth naming: validation quality is **inconsistent rather than absent**. Inventory, Projects and
Contacts return clean field-level `400`s. Users, Leads and Tasks return `500 "Server error"` for a
missing required field, and Leads accepts a lead whose name and phone are both `"   "`. The good
modules are the template for fixing the others.

**This CRM is not production-ready as it stands** — not because it is fragile, but because the
read-side authorization gap and the unauthenticated file access are live privacy exposures involving
real customer data, and the unbounded lead query will degrade sharply as the database grows.

---

## Environment Tested

| Item | Value |
|---|---|
| Database | `mongodb://127.0.0.1:27017/the_office_on_rent` — **local** |
| Backend | `http://127.0.0.1:5000` (Express 5.2.1, Node 22.15.0) |
| Frontend | `http://127.0.0.1:5173` (Vite 7.2.4 dev server) |
| Browser | Microsoft Edge (Chromium) via Playwright 1.63 |
| Mode | `APP_MODE=single_client`, `NODE_ENV` unset (development) |
| Data | **Mirror of live business data** — real staff emails, 1,174 real leads, 2,428 activities |

**Safety**: the environment was confirmed local *before* any mutating test. Because the local database
mirrors production data, I made **no destructive changes to existing records** — every test wrote only
new, clearly-labelled QA rows, and every one was removed afterwards. Post-cleanup verification:
leads 1174, leadActivities 2428, users 12, tasks 14 — **identical to the pre-audit baseline**. The 7
uploaded test files were deleted. The one page-access override I created was reverted to `null`. The
git working tree is unchanged apart from the new files under `docs/testing/`. The running dev servers
were never restarted and no environment variable was modified.

---

## Modules Discovered — 17

Authentication & Session · Authorization/RBAC · User Management · Leads/CRM Pipeline · Inventory &
Property · Projects · Contacts (Owner/Broker) · Tasks · Attendance & Leave · Coworking (10
sub-modules) · Client Portal · Team Chat · Notifications & Web Push · Targets · Dashboards ·
Reports & Analytics · Calendar · Field Ops · Finance · File Uploads · Observability

## Features Discovered — 214

Catalogued in `FEATURE_INVENTORY.md` with route, endpoint, required role and verified status.

## Routes Discovered — 37 frontend routes

32 navigable (all loaded in a browser), plus parameterised and dev-only routes. Detailed in
`ROUTE_TEST_MATRIX.md`.

## APIs Discovered — 243 canonical endpoints

Extracted by **instrumenting the live Express router tree**, not by grepping. Every business router is
mounted twice (`/api/<name>` and `/api/client/<name>`), giving **479 addressable paths**. Full
inventory plus the per-role status matrix in `API_TEST_MATRIX.md`.

By surface: Coworking 92 · Leads 21 · Chat 20 · Attendance 20 · Users 18 · Inventory-request 9 ·
Tasks 8 · Inventory 8 · Portal 8 · Push 6 · Contacts 6 · Roles 5 · Projects 5 · SaaS 4 · Auth 4 ·
Access 3 · Webhook 2 · Targets 2 · Uploads 1 · Public 1 · Health/Metrics 2

---

## Tests Executed

| | Count |
|---|---|
| **Total scenarios** | **1,013** |
| Passed | **806** |
| Failed | **207** |
| Blocked | 1 (attendance check-in — requires browser geolocation permission) |
| Not tested | see below |

By suite: RBAC sweep 676 · Leads 83 · Auth 34 · User Management 34 · Security 29 · Modules 60 ·
Browser route sweep 29 · Responsive + a11y 13 · UI interaction 18 · Page access 15 · Pagination 18

Pre-existing backend suite: **199/199 passing** (`node --test "test/*.test.cjs"`).
Frontend: `npm run lint` → 0 errors, 4 warnings. `npm run build` → success in 45 s.

### Not tested (and why)

- **Meta/Facebook lead webhook** — requires external Meta callbacks.
- **Client Portal data endpoints** — no portal user credentials available; token-scope isolation *was* verified.
- **Email / WhatsApp reminders** — disabled in env (`EMAIL_REMINDERS_ENABLED=false`, `WHATSAPP_REMINDERS_ENABLED=false`), no real credentials.
- **Web push delivery** — `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` unset; the reply-token test suite passes.
- **Background sweeps** (auto-checkout, booking expiry, contract lifecycle, invoice overdue) — interval-driven; would need clock manipulation.
- **Attendance check-in** — geo-gated; the server correctly refuses without location.
- **Office Assistant** (`/api/assistant/ask`) and **SaaS/subscription** routes — out of scope for single-client mode.
- **Dashboard metric reconciliation** — dashboards render, but I did not reconcile every displayed KPI against a database aggregate. **This is the largest remaining gap** (see Production Risks).
- **Firefox / Safari** — tested on Chromium (Edge) only.
- **Load / stress testing** — deliberately not run; the data mirrors production.

---

## Findings by category

### Critical Bugs — 0

None. No authentication bypass, no write-side privilege escalation, no data-loss path, no injection
that reached execution.

### High Bugs — 10

| ID | Title |
|---|---|
| CRM-BUG-001 | `GET /api/leads` returns all 1,195 leads (2.7 MB) when `page`/`limit` are omitted — 7 screens do this |
| CRM-BUG-002 | Uploaded files (incl. lead documents / KYC) served with no authentication |
| CRM-BUG-003 | `application/octet-stream` in the upload allowlist defeats MIME filtering; `.html`/`.svg`/`.exe` accepted |
| CRM-BUG-004 | Role page defaults never enforced server-side (`enforcePageAccess = hasPageOverride`) |
| CRM-BUG-005 | Owner/Broker contact database readable by roles without the Inventory page |
| CRM-BUG-006 | Internal staff directory (26 people) exposed to the external CHANNEL_PARTNER role |
| CRM-BUG-007 | `DELETE` authorised by an `edit` grant; contact delete is a hard delete with no secondary check |
| CRM-BUG-008 | Company-wide lead analytics readable by every role including external partners |
| CRM-BUG-009 | Mongoose validation errors surface as HTTP 500 "Server error" |
| CRM-BUG-010 | Full-size images served unresized (14.9 MB avatar on `/tasks` and `/profile`) |

### Medium Bugs — 16

CRM-BUG-011 lead creation accepts almost any input · 012 `/leaderboard` broken for ADMIN ·
013 NoSQL operators reach the login query · 014 invalid credentials return 400 not 401 ·
015 `sortBy` ignored · 016 duplicate API calls (`/leads` ×2 on 14 routes, `/targets/my` ×6) ·
017 access token valid after logout · 018 CORS allows any `192.168.x.x` with credentials ·
019 Escape does not close modals · 020 modals do not receive focus · 021 WCAG 2.1 AA violations ·
022 no 404 page · 023 user creation accepts invalid email/phone, duplicate phone ·
024 task creation 500s on bad enum/date · 025 `propertyId` not unique · 037 invalid filters silently ignored

### Low Bugs — 12

CRM-BUG-026 no empty state on lead search · 027 deactivated accounts enumerable · 028 duplicate email
returns 400 not 409 · 029 tokens in localStorage · 030 tap targets under 44 px · 031 sticky header
intercepts row clicks · 032 no `npm test` script · 033 4 ESLint warnings · 034 email uniqueness is
global not per-tenant · 035 stale/corrupted `TESTING_FLOW.md` · 036 Mongoose deprecation warning ·
038 dev-only `/_kitchen-sink` route in the router

---

## Security Findings

**Held under direct attack** — JWT forgery (`alg:none`, wrong secret, expired, deleted user, scoped
token substitution), NoSQL auth bypass, self-escalation to ADMIN, six write-side escalation paths
across four roles, IDOR on leads and tasks, mass assignment, path traversal, regex injection/ReDoS,
brute force (429 after 4 failures), CORS from an untrusted origin, stack-trace leakage. Security
headers are correct: CSP, HSTS, `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
no-referrer`, no `X-Powered-By`.

**Gaps**: read-side authorization (BUG-004/005/006/008), unauthenticated file access (BUG-002),
upload MIME allowlist (BUG-003), delete-via-edit (BUG-007), unvalidated operators reaching Mongo
(BUG-013), LAN-wide CORS (BUG-018), tokens in localStorage (BUG-029), account enumeration via the
deactivated-account response (BUG-027).

**Note on CSP**: it is currently the only thing preventing stored XSS from uploaded HTML/SVG. I
verified this in a browser and confirmed `deploy/nginx.the-office-on-rent.conf` proxies `/api/`
through Express so helmet's CSP applies in production too. Do not relax CSP or move uploads to a
CDN before fixing BUG-003.

## Performance Findings

- `GET /api/leads` unbounded: 2.7 MB / 481 ms, ×2 calls on 14 routes (BUG-001, BUG-016).
- 14.9 MB and 5.7 MB profile images served unresized (BUG-010).
- `/api/client/targets/my` called 6× on one page load (BUG-016).
- Dev-server route loads 2.0–3.6 s to network-idle (not a production measurement).
- Production build: 45 s, largest chunk `vendor` 642 KB (197 KB gzip); OCR, PDF, charts and
  spreadsheet correctly split into lazy chunks. Under the 900 KB warning limit. **Good.**
- `leads` carries **28 indexes** — excellent read coverage, but worth reviewing for write amplification.
- TTL caches (access profile 30 s, company status 30 s) and a slow-query plugin are in place. **Good.**

## Responsive Findings

**Zero horizontal overflow** across `/dashboard`, `/leads`, `/inventory`, `/tasks`, `/attendance`,
`/admin/users`, `/reports`, `/calendar`, `/chat`, `/coworking/booking-board`, `/profile`, `/settings`
at 320/375/390/430/768/1024/1280/1440/1920 px. The only responsive defect is tap-target size at
375 px (BUG-030). This area is in good shape.

## Accessibility Findings

Critical axe violations: `select-name` (`/login`, `/dashboard`), `button-name` and `label`
(`/profile`). Serious: `color-contrast` (5 pages), `nested-interactive` (×27 on `/tasks` and
`/admin/users`), unlabeled login inputs. Modal focus management is missing on 2 of 3 dialogs and
Escape closes none of them. Positives: `/leads` has **zero** violations, row actions carry descriptive
aria-labels, and focus indicators are visible during keyboard navigation.

---

## Missing Automated Tests

The existing 199-test suite covers route mounting, page access, lead filters, push-reply tokens,
coworking floor/booking and CRM requirements — genuinely good foundations. Not covered:

1. Authentication lifecycle (login/refresh rotation/logout revocation, token forgery rejection)
2. RBAC read-side matrix — a test asserting each role's reachable endpoints would have caught BUG-004/005/006/008
3. Input validation per module (would have caught the 500-instead-of-400 family, BUG-009/011/023/024)
4. Pagination bounds — would have caught BUG-001 directly
5. File upload type/authorization
6. IDOR regression tests for leads/tasks/contacts
7. Frontend: **no component or E2E tests at all** (no Vitest/Jest/Testing Library/Playwright)
8. Accessibility regression (axe in CI)
9. `npm test` script so CI can run any of it (BUG-032)

The harness built for this audit is reusable as a starting point: an in-process Express boot against a
test database, per-role session fixtures, a result recorder, and Playwright suites for route sweeps,
responsive checks and axe scans.

## Production Risks

1. **Customer PII exposure** — uploaded KYC/lead documents are fetchable by anyone with the URL, and
   the owner/broker phone database plus the staff directory are readable by roles that should not see
   them. For a CRM holding real customer data this is the risk I would escalate first.
2. **Scaling wall** — the unbounded lead query is already 2.7 MB at 1,174 leads and is called twice
   per visit on seven screens. At 10,000 leads this is ~23 MB per page load.
3. **Authorization model gives false assurance** — `rolePageAccess.constants.js` reads like an
   enforced policy and is not one for default accounts. Anyone reasoning about security from that file
   will reach the wrong conclusion. Fixing this is also the **highest-regression-risk** change in the
   list: it will turn currently-succeeding requests into 403s. Roll out in log-only mode first.
4. **Unverified dashboard numbers** — I confirmed dashboards render and that the underlying data is
   referentially clean, but did not reconcile displayed KPIs against database aggregates. If these
   numbers drive commission or performance decisions, they need their own verification pass.
5. **Single browser engine** — Chromium only; Safari/WebKit untested.
6. **Operational** — no `npm test` script means none of the 199 existing tests run in CI by default.

---

## Recommended Fix Order

**Phase 1 — data exposure (do first)**
1. CRM-BUG-002 — authenticate `/api/uploads/files/**`
2. CRM-BUG-005 + 006 + 008 — add explicit role gates to `crmContact.routes.js`, `chat.routes.js` and the `/api/leads/*` analytics routes (targeted fixes, low regression risk)
3. CRM-BUG-003 — remove `application/octet-stream`, validate magic bytes
4. CRM-BUG-007 — `DELETE → ["delete"]`; add a role gate + audit log to contact delete

**Phase 2 — scaling**
5. CRM-BUG-001 — always paginate; fix the 7 `getAllLeads()` call sites
6. CRM-BUG-016 — dedupe in-flight requests
7. CRM-BUG-010 — resize images on upload

**Phase 3 — the systemic authorization fix (staged)**
8. CRM-BUG-004 — enforce role defaults server-side. Ship in log-only mode, review real traffic, then enforce. Phase 1 already closes the specific leaks, so this can be done carefully rather than urgently.

**Phase 4 — correctness and data quality**
9. CRM-BUG-009 + 024 — map Mongoose errors to 400 (copy the Inventory/Projects pattern)
10. CRM-BUG-011 + 023 — validate lead and user input; trim before required checks
11. CRM-BUG-012 — fix the leaderboard default role
12. CRM-BUG-015 + 037 — implement sorting; validate filters
13. CRM-BUG-013 — type-check credentials before querying
14. CRM-BUG-025 — unique index on `{companyId, propertyId}`

**Phase 5 — UX and accessibility**
15. CRM-BUG-019 + 020 — modal Escape + focus trap in the shared `Modal`
16. CRM-BUG-021 — axe criticals, then contrast
17. CRM-BUG-022 + 026 — 404 page and search empty state
18. CRM-BUG-030 + 031 — tap targets, sticky-header overlap

**Phase 6 — hardening and hygiene**
19. CRM-BUG-018 — restrict LAN CORS to development
20. CRM-BUG-017 + 029 — token revocation strategy and storage
21. CRM-BUG-014 + 027 + 028 + 034 — status codes and enumeration
22. CRM-BUG-032 + 033 + 035 + 036 + 038 — `npm test`, lint warnings, docs, deprecation, dev route

**Then**: add the regression tests listed under *Missing Automated Tests*, starting with the RBAC
read-side matrix and pagination bounds — those two would have caught five of the ten HIGH defects.

---

## A note on how these numbers were produced

Three of my initially-flagged failures were **false positives that I re-tested and retracted**, rather
than leaving in to inflate the count:

- `GET /api/access/me` returning 200 for every role is **correct** — it returns the caller's own permissions.
- A `404` on a non-existent ID does not prove access; I re-ran those against **real** record IDs and confirmed scoping holds (executives get 404 on other people's leads).
- `GET /api/users` returning "all users" was actually returning **only the caller's own record** — hierarchy scoping working as designed.
- Mass assignment "succeeding" — I checked MongoDB directly and the injected `_id`/`companyId` were **not** persisted.
- The leads search and pagination controls I first reported as broken were me driving the **wrong elements** (the global Ctrl-K palette, and the selection-checkbox column). Re-tested with the correct selectors: search filters 100 → 0 and restores; "Load more leads" appends 100 → 200; clicking the name cell navigates to `/leads/:id`. All three **pass**.

34 RBAC rows were reclassified from FAIL to PASS on that basis. The remaining counts are what I could
reproduce.
