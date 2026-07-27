# Samvid OS Testing And Release Gates

## Local Setup

- Backend tests must use `MONGO_TEST_URI`; never use `MONGO_URI` or VPS Mongo for tests.
- The test database name must contain `test`, `vitest`, `integration`, or `e2e`.
- Recommended local backend URI:

```powershell
$env:MONGO_TEST_URI="mongodb://127.0.0.1:27017/samvid_os_local_test"
```

## Commands

Backend:

```powershell
cd backend
npm ci
npm run lint
npm run test
npm run test:coverage
npm audit --omit=dev --audit-level=high
```

Frontend:

```powershell
cd frontend
npm ci
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e:smoke
npm audit --omit=dev --audit-level=high
```

Mobile:

```powershell
cd mobile
npm ci
npm run test:unit
npm run test:coverage
npx tsc --noEmit
npm run test:e2e:smoke
npm audit --omit=dev --audit-level=high
```

## Fixture Accounts

Use isolated seeded test accounts only:

- Platform Super Admin
- Active Company A and Company B
- Suspended Company C
- One user for each supported role in Company A and Company B
- Active/inactive users
- Channel Partners with inventory access enabled and disabled

Do not reuse production passwords or production tenant IDs in test fixtures.

## CI Gates

PR gates block merge on:

- backend lint, coverage tests, and production audit
- frontend lint, coverage tests, production build, Playwright smoke, and production audit
- mobile unit coverage, TypeScript check, and production audit
- CodeQL
- Gitleaks secret scan

Nightly gates run full backend regression, browser E2E, mobile unit/typecheck, and moderate k6 load when `STAGING_BASE_URL` is configured.

Release gates require PR gates, k6 threshold pass, and deployment smoke against an explicitly supplied isolated staging URL.

## Security Triage Rules

- Critical/high direct runtime dependencies must be fixed before release unless a written risk acceptance exists.
- Do not use forced major upgrades without full backend, frontend, mobile, Playwright, and native smoke verification.
- Expo SDK-major remediation must be scheduled as a dedicated mobile upgrade phase.
- `xlsx` has no npm advisory fix. Treat browser workbook parsing as a high-risk accepted item until replaced or isolated. Prefer CSV-only ingestion or server-side parsing in a later phase.
- React Router advisories that only affect RSC/SSR must still be tracked because the package audit fails, even though this app is built as a Vite SPA.

## Performance Thresholds

Initial release thresholds:

- API p95 latency under 750 ms for normal load
- API error rate under 1%
- no sustained memory growth during the two-hour soak
- no Mongo query plan regression without `explain()` evidence
- 5,000-row lead upload completes without contradictory lead/inventory/activity/request states
- Socket.IO connect/message/broadcast/reconnect maintains 99% delivery under normal load

## Defect Template

- Title:
- Severity:
- Environment:
- Role and company:
- Endpoint or screen:
- Steps:
- Expected:
- Actual:
- Logs/request ID:
- Regression test:
- Fix owner:

## Release Checklist

- all functional suites green
- zero open P0/P1 defects
- 100% critical RBAC and company-isolation matrix
- at least 90% branch coverage for critical business services and 80% overall
- no unapproved critical/high security issue
- k6 normal/spike/stress/two-hour soak pass
- Socket.IO load/reconnect pass
- ZAP run only against isolated staging
- backup restore into clean DB verified
- deployment rollback verified

## Rollback Checklist

- identify release artifact/version
- pause new deployments
- restore previous backend and frontend artifacts
- run `/api/health`, `/api/client/health`, auth smoke, and tenant smoke
- verify Mongo migration compatibility
- restore backup only if schema/data corruption is confirmed
- capture incident timeline and request IDs
