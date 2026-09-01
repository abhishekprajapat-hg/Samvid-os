# Samvid OS Data Integrity, Backup, Restore And Rollback Runbook

This runbook is for isolated staging infrastructure with synthetic data only. Do not use production, VPS, or real customer data.

## Required Environment

- `CONFIRM_ISOLATED_STAGING=true`
- `STAGING_MONGO_URI` points to an explicit database name containing `staging`, `test`, `qa`, `sandbox`, `perf`, or `isolated`
- `RESTORE_MONGO_URI` points to a different empty database with the same safe naming rule
- `BASE_URL` points to the isolated backend deployment
- `FRONTEND_URL` points to the matching isolated frontend deployment
- `ACCESS_TOKEN` belongs to a synthetic admin user in the isolated tenant
- `METRICS_BEARER_TOKEN` is configured when `/api/metrics` is protected
- `CONFIRM_RESTORE_TARGET_EMPTY=true` only immediately before restore verification

The helper scripts reject `NODE_ENV=production` and URI strings containing production/VPS markers.

## Clean Database Setup

1. Create a new local or staging MongoDB database whose name includes a safe marker, for example `samvid_os_staging_restore_test`.
2. Seed synthetic companies, users, leads, inventory, requests, chat rooms, and subscriptions.
3. Run index creation and validation:

```powershell
cd backend
$env:CONFIRM_ISOLATED_STAGING="true"
$env:STAGING_MONGO_URI="mongodb://127.0.0.1:27017/samvid_os_staging_test"
$env:SYNC_INDEXES="true"
node src/scripts/stagingDataIntegrityAudit.cjs
```

4. Rerun the same command. The second run must complete without destructive index churn or validation failures.

## Migration Safety

1. Take a backup before any migration.
2. Run the migration against realistic synthetic old-schema data.
3. Rerun the migration; it must be idempotent.
4. Simulate partial failure by stopping the process mid-run against disposable staging, then rerun and validate.
5. Run both the previous app version and the new app version against the migrated database for smoke checks:
   - `/api/health`
   - `/api/client/health`
   - login and refresh
   - lead list and lead closure
   - inventory list and reservation
   - chat message send
   - Meta webhook test event

## Backup And Restore

```powershell
cd backend
$env:CONFIRM_ISOLATED_STAGING="true"
$env:CONFIRM_RESTORE_TARGET_EMPTY="true"
$env:STAGING_MONGO_URI="mongodb://127.0.0.1:27017/samvid_os_staging_test"
$env:RESTORE_MONGO_URI="mongodb://127.0.0.1:27017/samvid_os_restore_test"
node src/scripts/backupRestoreVerify.cjs

$env:STAGING_MONGO_URI=$env:RESTORE_MONGO_URI
$env:SYNC_INDEXES="false"
node src/scripts/stagingDataIntegrityAudit.cjs
```

Record:

- backup start and finish time
- restore finish time
- recovery point as backup finish time
- recovery time as backup plus restore duration
- restored record counts
- relationship validation result

## Failure And Retry Cases

Run these only with synthetic fixture IDs.

- duplicate manual lead create requests
- duplicate Meta webhook leadgen IDs
- simultaneous token refresh using separate refresh tokens per worker
- simultaneous inventory reservation retries
- simultaneous lead closure retries
- process restart during reservation or closure traffic
- backend restart during authenticated read and chat traffic
- storage provider outage by using isolated invalid storage credentials
- Meta API outage by routing the isolated Meta Graph dependency to a controlled failure endpoint
- Socket.IO restart and reconnect with two authenticated synthetic users

After each failure test, run:

```powershell
cd backend
$env:CONFIRM_ISOLATED_STAGING="true"
$env:STAGING_MONGO_URI="mongodb://127.0.0.1:27017/samvid_os_staging_test"
node src/scripts/stagingDataIntegrityAudit.cjs
```

The audit must report zero failures for missing tenant relationships, missing lead/inventory links, blocked inventory with sale lead, and sold inventory still marked reserved.

## Deployment Compatibility

1. Deploy backend version N and frontend version N to isolated staging.
2. Seed synthetic data and run smoke tests.
3. Deploy backend version N+1 while frontend N is still served; run the same smoke tests.
4. Deploy frontend N+1; run smoke tests again.
5. Restart the backend during read, write, and Socket.IO traffic; clients must reconnect or retry without contradictory data.

## Rollback

1. Pause new deploys and capture request IDs for failing flows.
2. Roll backend artifact back to the last known-good version.
3. Roll frontend artifact back only if the frontend/backend API contract is incompatible.
4. Run:
   - `/api/health`
   - `/api/client/health`
   - login
   - refresh token
   - lead list
   - inventory list
   - reservation smoke
   - lead closure smoke
   - chat socket reconnect smoke
5. Restore MongoDB only if validation proves schema/data corruption and the rollback cannot operate on the current schema.
6. Validate restored data with `stagingDataIntegrityAudit.cjs`.

## Observability Verification

- Every failed API response includes `requestId`.
- Response header `x-request-id` is present.
- Logs are structured JSON.
- Authorization headers, passwords, access tokens, and refresh tokens are redacted.
- `/api/metrics` exposes HTTP counters, duration histogram, in-flight gauge, and default Node metrics.
- Alerts should fire for:
  - MongoDB connection failure
  - storage upload failure rate
  - Meta webhook failure rate
  - 5xx error rate
  - sustained latency
  - process restart loop
  - Socket.IO reconnect spike

Do not store personal information, raw tokens, secrets, or full uploaded file content in logs.
