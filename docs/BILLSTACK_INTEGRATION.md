# CRM → BillStack Phase 1

This integration is backend-owned and company-scoped. It does not implement SSO,
invoice editing, invoice replication, payment replication, or a historical import.
Mobile continues using the existing lead APIs; invoice handoff is web-only.

## Configuration

Set these in the backend deployment environment (never Vite, mobile, Company
metadata, source control, or API responses):

- `BILLSTACK_BASE_URL`: BillStack origin/base URL, without `/api/integrations`.
- `BILLSTACK_API_KEY`: integration secret used in `X-Billstack-Api-Key`.
- `BILLSTACK_FRONTEND_URL`: explicit trusted BillStack frontend origin (no path).
- `BILLSTACK_COMPANY_ID`: required CRM Company ObjectId binding. Other companies
  cannot use this credential. All four settings are required to enable sync.

Production requires HTTPS. HTTP is accepted only for localhost/127.0.0.1 outside
production. URLs with embedded credentials, query strings or fragments are
rejected. Axios redirects are disabled so credentials cannot follow a redirect.
Each remote request times out after 15 seconds. Missing configuration does not
prevent the CRM from starting or successfully closing/booking customers.

The local BillStack branch at `C:/Users/asus/Desktop/Nemnidhi/billstack` was
reviewed against the CRM adapter. Response parsing is isolated in `backend/src/services/billstack.service.js`:

- Customer ID: `customerId`, `customer.id`, or `customer._id`, at the top level or
  inside `data`. A non-empty string is required; generic `id` is not guessed.
- Handoff: `handoffUrl`, top level or inside `data`. Its origin must match the
  configured `BILLSTACK_FRONTEND_URL` origin, which may differ from the API origin.
  No handoff URL is persisted or logged by CRM.

The reviewed BillStack controller returns `data.customer._id` for upsert and
`data.handoffUrl` for handoff; both are accepted. Optional tax-state fields remain
omitted rather than inferred from CRM preferences. No return URL is sent.
Actual browser/database E2E validation remains necessary.

## Identity and eligibility

- Real Estate: existing `Lead`, only while `status === CLOSED`.
  External ID: `toor:<companyId>:lead:<leadId>`.
- Coworking: canonical `CoworkingClient`.
  External ID: `toor:<companyId>:coworking-client:<clientId>`.
- Current board: `BOOKED`, non-empty customer name, agreement ID, valid ordered
  start/end dates, and usable contact information. RESERVED and previousClients
  are never conversion evidence.
- Structured coworking: ACTIVE/COMPLETED bookings or
  ACTIVE/EXPIRING/EXPIRED/TERMINATED contracts. Customer status alone is not proof.

Coworking board saves retain optimistic version checks. Only after a successful
save does the identity bridge run. It creates/resolves the canonical customer,
then saves its `canonicalClientId` to the board under the same version check before
scheduling sync. Integration metadata does not increment the business version.
Board saves preserve established backend bindings even when older browser state
omits them; frontend responses merge only identity metadata without overwriting
newer user edits or causing another autosave. Browser verification flags are
ignored. Canonical phone/email/GST/address edits update the same record after
checking conflicting canonical identifiers. Conflicting multi-cabin snapshots
fail closed for Billing while the board operation remains saved. An orphaned canonical record from a lost race is
not eligible without persisted occupancy or a structured operational record.

New onboarding creates a random identity shared across the selected cabins;
names are not keys. Legacy fallback identity includes agreement and full contact
details. A deterministic Mongo ObjectId makes repeated resolution of the same
board identity retry-safe even with Mongo auto-indexing disabled. Existing GST
matches require compatible customer information. Phone/email matches alone
cause a review flag instead of an automatic merge or duplicate creation.
Conflicting canonical references and incomplete data are flagged on the board.
Review and explicitly link a verified canonical client through the existing
company-scoped board API; there is no automated fuzzy-match migration.

Existing stored board customers can be resolved when their board is explicitly
saved. The worker does not scan untouched historical boards. Historical import
remains a separate reviewed operation. Conflicts with another canonical customer require review. Supported board
customer edits update the established customer; structured client updates use
the same sync/retry path. Board source fingerprints prevent unrelated board
saves from overwriting structured client edits.

## Durable processing

Lead status updates and approved status requests mark pending state as part of
the successful lead save, then schedule a job after persistence. Closed-lead
profile edits schedule attribute updates using the same external ID.

Structured `activateBooking()` and `activateContract()` persist a reconciliation
marker and schedule the same canonical client service. Board and structured
paths therefore share one BillStack customer when they reference the same client.

`BillstackSyncJob._id` is the external ID, supplying database-enforced uniqueness
without depending on a newly built secondary index. Jobs persist attempts,
status, fingerprint, desired fingerprint, retry time, sanitized error and lease.
With valid configuration, the existing server starts one 30-second worker
restricted to the configured company. Disabled/missing configuration does not
start a worker or create new jobs. Claims use atomic updates and a
two-minute lease; transient failures back off up to one hour (429 Retry-After is respected up to
one day). Network errors, timeouts, 408/429 and 5xx retry. Permanent validation,
identity conflict, authentication and configuration failures stop automatic retry.
Corrected payloads or an explicit manual retry can schedule another attempt. Manual retry can make
a failed job due immediately. Sweeps process at most 20 jobs with four concurrent
requests; leases survive process restarts. Worker startup is idempotent and a
stop/drain function is available without changing existing CRM process shutdown. Reconciliation reads explicit pending markers,
not all CLOSED leads or all coworking clients.

Remote success followed by local failure retries the same external ID. Exactly
once HTTP delivery is not claimed: correctness relies on BillStack's upsert
idempotency. Attribute changes during processing leave work pending. A customer
that becomes ineligible is not handed off. Remote failures do not undo saved CRM
business operations. Database/integration scheduling failures keep durable
markers for retry; validation failures require corrected customer data.

Suggested operational indexes are declared on the job schema. If production
disables autoIndex, review/build that index through the normal deployment
process. No migration or index creation has been executed by this task.

## Permissions and API

Billing is registered in the existing page catalogue:

- `page.billing.view`
- `page.billing.create_invoice`
- `page.billing.sync_customer`

ADMIN receives the catalogue's full access. MANAGER receives these actions by
default. Other roles, including COWORKING_ADMIN, receive none by default.
Explicit employee overrides replace defaults. Permissions use the existing
strict `requirePermission`/resolved-access service, not the permissive fallback
in legacy page helpers and not unrelated coworking invoice permissions.

Admin uses the existing Team Access → Page access editor. Manager can use that
same editor to change only Billing for reporting-team employees, cannot change
Admin/Manager peers or themselves, cannot grant actions they do not hold, and
preserves the employee's other grants and default inheritance. A sparse `pageActionOverrides.billing`
field is resolved through the existing page/action resolver and updated atomically;
it does not rewrite `pageAccessOverride`. Admin Billing-only edits use the same
path. Explicit whole-access edits/reset retain their existing full-override semantics.
An employee also needs the underlying Leads/My Leads or Coworking page access;
existing lead record/data scope remains enforced.

Routes exist under both `/api/client/billing` and `/api/billing`:

| Method and suffix | Permission | Result |
|---|---|---|
| `GET /:type/:id` | Billing view | Safe sync status, last timestamp/error, CRM entity identity |
| `POST /:type/:id/sync` | Retry Sync | Immediate bounded sync attempt; 200 synced or 202 pending/failed |
| `POST /:type/:id/handoff` | Create Invoice | Ensure eligible CRM customer sync, then `{ handoffUrl }` |

`type` is `lead`, `coworking-client`, or `board`. For `board`, `id` is a cabin
code resolved against the company's persisted BOOKED occupancy. Other IDs are
Mongo ObjectIds. POST bodies can be `{}`. Browser company/customer IDs, API keys
and integration URLs are never inputs to remote calls. Authentication and
company checks precede permission/customer checks. A denied action returns 403;
ineligible or pending identity/sync returns 409; integration failures return a
sanitized error. The sync endpoint may return 202 with FAILED status and a safe
lastSyncError for a failed attempt.

## Web UI and login

Reusable `BillstackSection` appears on CLOSED Real Estate details
(`LeadDetailsRebuilt`) and currently BOOKED coworking profiles (`ClientProfile`).
It displays sync state, pending/failure messages, separately permissioned Sync /
retry and Create Invoice buttons, and loading/error states. RESERVED-only and
former-only profiles do not show it. Status refreshes every ten seconds.

Create Invoice calls CRM, receives a fresh handoff, and navigates to exactly that
URL. CRM does not construct a BillStack editor URL or call BillStack directly.
The frontend allows 45 seconds for the two bounded backend requests. BillStack
retains its normal authentication: a logged-in user reaches its existing editor;
a logged-out user must log in and resumes through BillStack's session-storage continuation. BillStack now shares one consume promise per
user/business/token across Strict Mode replay and access-token refresh; the server
still consumes the token once, only for the same tenant, within three minutes.
Expired/used tokens require a fresh CRM handoff. Request logs redact handoff tokens.
No SSO or stable customer-page URL is implemented.

## Existing-customer dry run

From `backend`, when authorized to read the selected database:

```powershell
node scripts/billstack-dry-run.cjs --company <CRM_COMPANY_OBJECT_ID>
```

The script requires exactly one explicit company ID. It disables automatic
collection/index creation and uses raw collection reads; there are no writes or
BillStack calls. It has not been run against a real database.

JSON output separates eligible candidates, excluded records, ambiguous closure
or identity records, missing required data, duplicate identities, already-synced
records, and structured coworking evidence. It includes proposed external IDs
and masked contact/address/tax payload previews. Unresolved board customers are
flagged for canonical identity review. Structured data is reported separately
with board overlap information, not added to the import total. No universally
approved-payment filter is imposed on CLOSED leads. Duplicate-contact reports
require reviewing all referenced external IDs before import.

## Verification commands

```powershell
# backend
node --test test/*.test.cjs
# frontend
node --test test/billstack.test.cjs
npm run build
npm run lint
# repository root
git diff --check
```

Tests use isolated repositories/mock transport, not production MongoDB or
BillStack. Frontend tests use the existing esbuild dependency and a hook harness;
they cover permission rendering, retry, error, handoff navigation and board
identity behavior. They are not a substitute for a real browser/provider check.

## Manual staging end-to-end checks

1. Configure a staging BillStack origin/key and explicit test company. Verify
   the actual response envelopes before enabling production credentials.
2. Real Estate: create a test lead, assign a property with a valid price, record
   payment and brokerage, then close as Admin/Manager. Confirm property Sold,
   lead CLOSED, and one synced customer. Repeat via an employee's close request
   and Admin/Manager approval. NEW, INTERESTED and REQUESTED must not sync.
3. Change supported details on the closed lead. Confirm BillStack updates the
   same external ID/customer rather than creating another customer.
4. Coworking: onboard a complete customer into two cabins in one operation.
   Reload; verify the same canonicalClientId on both snapshots and one remote
   customer. A RESERVED-only hold must not sync. Confirm a hold, complete its
   details, save and verify conversion. Test an incomplete booking and a
   conflicting identity: the booking remains saved and Billing explains review.
5. Open the board in two tabs and save the stale tab. Verify 409, no overwrite
   and no external sync for its rejected state. Verify structured booking and
   contract activation use the same customer if that operational API is used.
6. Delegate Billing View + Create Invoice through Team Access while retaining
   underlying lead/coworking access. Verify the employee can invoice only an
   accessible eligible customer. Revoke Create Invoice and verify API 403 as
   well as hidden UI. View alone must not grant retry/create. Verify a Manager
   cannot alter another team, themselves, or unrelated page access.
7. With a valid BillStack session, click Create Invoice and verify its existing
   editor opens with the correct customer. In a private browser without that
   session, repeat and verify login is mandatory and continuation works.
8. Make the staging BillStack endpoint temporarily unavailable. Close/book a
   customer and verify the CRM operation succeeds and durable failed/retry state
   appears. Restore service and retry, or wait for backoff. Verify one customer.
9. Attempt cross-company IDs and payload-supplied BillStack customer IDs/keys.
   Verify there is no cross-tenant handoff and browser input cannot choose the
   remote customer. Inspect browser bundles/network responses for secrets.
10. Review dry-run results before authorizing any separate historical import.

## Production prerequisites

Local/staging credentials, an explicit account-company binding, and real
logged-in/logged-out browser verification remain necessary. Automated tests use
mocked repositories/transport; no real database E2E run was performed. Resolve ambiguous
legacy identities before import. Confirm database index/deployment policy and
monitor pending/failed jobs. Customer linking based only on names is intentionally
not provided. This work does not migrate existing invoices or payments.

## File inventory

New files:

```text
backend/scripts/billstack-dry-run.cjs
backend/src/config/billstack.js
backend/src/controllers/billstack.controller.js
backend/src/models/BillstackSyncJob.js
backend/src/models/billstackState.js
backend/src/routes/billstack.routes.js
backend/src/services/billstack.service.js
backend/src/services/billstackCustomer.service.js
backend/src/services/billstackSync.service.js
backend/src/services/coworkingBoardIdentity.service.js
backend/test/billstack.test.cjs
frontend/src/components/billing/BillstackSection.jsx
frontend/src/services/billstackService.js
frontend/test/billstack.test.cjs
docs/BILLSTACK_INTEGRATION.md
```

Modified existing files:

```text
backend/.env.example
backend/src/app.js
backend/src/config/logger.js
backend/src/constants/page.constants.js
backend/src/constants/rolePageAccess.constants.js
backend/src/controllers/lead.controller.js
backend/src/controllers/userPageAccess.controller.js
backend/src/models/CoworkingBoardState.js
backend/src/models/CoworkingBooking.js
backend/src/models/CoworkingClient.js
backend/src/models/CoworkingContract.js
backend/src/models/Lead.js
backend/src/models/User.js
backend/src/services/access.service.js
backend/src/routes/accessControl.routes.js
backend/src/routes/client.routes.js
backend/src/routes/coworkingBoard.routes.js
backend/src/server.js
backend/src/services/coworkingBooking.service.js
backend/src/services/coworkingClient.service.js
backend/src/services/coworkingContract.service.js
backend/test/route-mounts.test.cjs
frontend/src/modules/admin/TeamManager.jsx
frontend/src/modules/admin/components/EmployeePageAccess.jsx
frontend/src/modules/coworking/booking/boardStore.js
frontend/src/modules/coworking/clients/components/ClientProfile.jsx
frontend/src/modules/leads/components/LeadDetailsRebuilt.jsx
```

The root `package-lock.json` change predates this implementation and is excluded.
Its SHA-256 remains
`DCC6BF48EB47E881579A5EACEDBBDA6F82401C52945D9301E84BA87619759AAF`.
Backend/frontend lockfiles and mobile are unchanged. No commit, push, merge or
deployment was performed.

## Local E2E configuration after review fixes

Use distinct ports: CRM API 5000, CRM frontend 5173, BillStack API 5001, BillStack
frontend 5174. No same-origin proxy workaround is required now.

```text
# CRM backend (all four required)
BILLSTACK_BASE_URL=http://127.0.0.1:5001
BILLSTACK_FRONTEND_URL=http://127.0.0.1:5174
BILLSTACK_COMPANY_ID=<CRM_TEST_COMPANY_OBJECT_ID>
BILLSTACK_API_KEY=<GENERATED_LOCAL_BILLSTACK_INTEGRATION_KEY>
# CRM frontend
VITE_API_BASE_URL=/api/client
VITE_DEV_API_TARGET=http://127.0.0.1:5000
# BillStack backend
CLIENT_URL=http://127.0.0.1:5174
FRONTEND_ORIGINS=http://127.0.0.1:5174
# BillStack frontend
VITE_API_BASE_URL=http://127.0.0.1:5001/api
```

Use separate local test databases and normal test accounts. BillStack requires a
transaction-capable replica set. Never use the shared/VPS tunnel for this test.
Start each backend with its existing `npm start` script and the stated PORT;
start frontends with `npm run dev -- --host 127.0.0.1 --port <5173-or-5174> --strictPort`.
Missing/invalid configuration leaves CRM operations available. Enabling it later
does not automatically import historical customers; use an explicit eligible
customer retry or the separately reviewed migration process.
