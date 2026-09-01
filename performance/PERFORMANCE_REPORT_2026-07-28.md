# Performance Report

Date: 2026-07-28

## Scope

The false-positive performance tests were replaced with authenticated, fail-closed performance scenarios. No load was executed against production, VPS, or real customer data.

## Environment

- Workstation: Windows / PowerShell
- Node.js: 22.15.0
- k6: not installed locally
- Target environment: not provided
- Required isolation guard: `CONFIRM_ISOLATED_PERF_ENV=true`
- Required target marker: `PERF_ENVIRONMENT=performance`, `staging`, `isolated`, or `local-isolated`

## Dataset Requirements

- Authenticated API reads require a valid `ACCESS_TOKEN` for an isolated tenant.
- 5,000-row lead import generates synthetic `@example.invalid` leads in one `/api/leads/bulk` request.
- 5,000-row inventory import generates synthetic inventory in ten `/api/inventory/bulk` batches of 500 rows because the backend API enforces a 500-row request limit.
- Reservation/closure race requires `PERF_RESERVATION_PAIRS_JSON` with staging-only `{ "leadId", "inventoryId" }` pairs.
- Token refresh load requires `REFRESH_TOKENS_JSON` with at least one distinct refresh token per refresh VU.
- Webhook burst/dedup requires `META_APP_SECRET`, `META_PAGE_ID`, and staging Meta page mapping.
- Socket delivery load requires `SENDER_ACCESS_TOKEN`, `RECEIVER_ACCESS_TOKEN`, and `RECEIVER_USER_ID` for two active same-company users.

## Implemented Scenarios

| Scenario | Command shape | Notes |
| --- | --- | --- |
| Normal API load | `k6 run performance/k6/core-business.js` with `LOAD_PROFILE=normal` | Authenticated reads plus separate health metrics |
| Spike API load | `LOAD_PROFILE=spike` | Ramping base/peak/recovery VUs |
| Stress API load | `LOAD_PROFILE=stress` | Higher sustained authenticated read pressure |
| Two-hour soak | `LOAD_PROFILE=soak` | Requires `METRICS_BEARER_TOKEN`; samples `/api/metrics` RSS |
| 5,000 lead import | `LOAD_PROFILE=lead_import_5000` | Requires `ALLOW_PERF_WRITES=true` |
| 5,000 inventory import | `LOAD_PROFILE=inventory_import_5000` | Requires `ALLOW_PERF_WRITES=true`; sends 10x500 batches |
| Concurrent search/dashboard | `LOAD_PROFILE=concurrent_read` | Concurrent lead search, inventory search, dashboard/bootstrap/stat requests |
| Reservation/closure race | `LOAD_PROFILE=reservation_closure` | Requires fixture ID pairs and write confirmation |
| Simultaneous token refresh | `LOAD_PROFILE=token_refresh` | Expects `200` refresh contracts only; `401` is failure |
| Webhook bursts/dedup | `k6 run performance/k6/webhook-ingestion.js` | Signed Meta webhooks, processed/duplicate counters required |
| Socket delivery load | `node performance/socket/socket-load.mjs` | Authenticated Socket.IO clients send messages and calculate delivery percent |

## Thresholds

- API p95 under 750 ms for authenticated API work.
- Health p95 under 500 ms, measured separately from protected APIs.
- API and health error rates below 1%.
- Socket delivery at least 99%.
- Reservation/closure state conflict rate exactly 0.
- Import row counters must reach 5,000 for lead and inventory import profiles.
- Soak memory requires `/api/metrics` RSS samples; optional `MAX_RSS_BYTES` enforces an absolute RSS ceiling.

## Results

No performance result is claimed from this workstation.

- k6 execution: blocked because `k6` is not installed.
- Isolated target execution: blocked because no staging/performance `BASE_URL`, tokens, fixture IDs, or synthetic dataset confirmation were provided.
- Socket script execution: fail-closed behavior verified; it exits immediately when `BASE_URL` is missing.
- Syntax validation: `core-business.js`, `webhook-ingestion.js`, and `socket-load.mjs` parse successfully.

## Bottlenecks Found

- Existing k6 test was a false positive: it defaulted to localhost, accepted non-5xx responses, missed auth requirements, and used `/api/attendance/my`.
- Inventory bulk upload is intentionally capped at 500 rows per request, so 5,000-row performance testing must use ten batches unless the API contract changes.
- Capacity cannot be recommended until isolated staging provides real k6/socket results and MongoDB explain evidence.

## MongoDB Explain Evidence

No query/index changes were made in this pass. Because no isolated performance database URI was supplied and no load run was executed, no `explain()` evidence was collected. Any future query optimization from failed/slow scenarios must include:

- exact slow endpoint and request shape,
- existing indexes,
- `explain("executionStats")`,
- before/after p95 and error-rate evidence,
- proof that tenant isolation predicates remain indexed and intact.

## Recommended Capacity

No production capacity recommendation is defensible yet. Use the first isolated run as the baseline:

- start normal load at 20 API VUs and 10 socket sender/receiver pairs,
- increase normal read load until p95 approaches 750 ms or error rate approaches 1%,
- run spike/stress only after normal load is stable,
- run soak for the full two hours with metrics enabled,
- size the initial production target below 60% of the first failing sustained VU level.
