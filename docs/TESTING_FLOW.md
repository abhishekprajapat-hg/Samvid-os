# Samvid OS Testing Flow (End-to-End)

Last updated: 2026-03-12

This is a practical, repeatable testing flow for local/staging verification before push/deploy.

## 1. Test Objective

Validate these critical business paths end-to-end:

- Tenant routing and login (`/<company-slug>/...`)
- Role-based access and hierarchy behavior
- Leads lifecycle (create, assign, rebalance, follow-up, close)
- Deal payment approval flow (including partial payment)
- Inventory request and property status workflow
- Admin notifications for approval-required actions

## 2. Prerequisites

- Node.js 20+
- MongoDB available and `MONGO_URI` configured in `backend/.env`
- Frontend and backend dependencies installed

Install once from repo root:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
```

## 3. Test Data Baseline

Run on non-production DB only.

### 3.1 Seed minimum users

```powershell
npm --prefix backend run seed:super-admin
npm --prefix backend run seed:admin
```

Defaults from seeder:

- Admin email: `admin@test.com`
- Admin password: `123456`

### 3.2 Seed inventory and leads

```powershell
npm --prefix backend run seed:inventory -- 20
npm --prefix backend run seed:leads -- 50
```

## 4. Start Application

Use the provided launcher (starts backend + frontend):

```powershell
npm run web:frontend
```

Expected:

- Backend: `http://127.0.0.1:5000`
- Frontend: `http://localhost:5173`

Health check:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method Get
```

Expected response includes `ok: true`.

## 5. Quick Smoke Gate (10-15 min)

Run these before full regression:

1. Login works for admin.
2. Lead Matrix opens without blank loop/reload.
3. Leads list loads.
4. Inventory list loads.
5. Admin Notifications page loads.
6. One lead detail page opens directly via URL.
7. Save lead update succeeds.

If any smoke step fails, stop and fix first.

## 6. Full Regression Flow

Use this order so dependencies remain valid.

### A. Tenant Routing and Session

1. Open `/login/admin` and login.
2. Verify app redirects to tenant path form (example: `/<slug>/leads`).
3. Hard refresh on lead detail URL like `/<slug>/leads/:leadId`.
4. Verify page opens and does not stay on endless `Loading...`.
5. Logout and confirm redirect to login.

Pass criteria:

- Tenant-prefixed routes consistently work after refresh and deep-link open.

### B. Hierarchy and Role Access

1. Create/reporting roles under admin (manager/team leader/executive/field executive/channel partner).
2. Login with each role and verify allowed modules.
3. Try restricted actions (forbidden by role) and verify proper denial.

Pass criteria:

- Role permissions match business rules (no unauthorized direct updates).

### C. Leads Core Flow

1. Create 1 lead from UI.
2. Confirm lead appears in Lead Matrix.
3. Open details and update status + follow-up + diary note.
4. Confirm activity timeline and diary entries update.

Pass criteria:

- Lead changes persist and reflect in matrix/details/timeline.

### D. Bulk Lead Upload (Admin)

1. Open Bulk Upload from Lead Matrix toolbar.
2. Upload/paste `lead-upload-10.csv`.
3. Verify success/failure row summary.
4. Confirm uploaded leads are visible and searchable.

Pass criteria:

- CSV rows are parsed correctly and inserted.

### E. Assignment and Rebalance

1. Verify new leads auto-assign where expected.
2. Trigger rebalance from team/admin flow.
3. Confirm lead ownership distribution changes.
4. Re-open changed leads and verify `assignedTo` is updated.

Pass criteria:

- Rebalance executes without error and updates assignments.

### F. Deal Closure + Partial Payment (Critical)

1. Open a lead and set status toward close flow.
2. Select payment type `PARTIAL`.
3. Enter remaining amount (`> 0`).
4. Verify lead details shows follow-up requirement for collection.
5. Click **Create Follow-up** (or Recreate) on lead details.
6. Save lead update.

Pass criteria:

- Follow-up is created/set on same lead details page.
- Remaining amount is saved correctly.

### G. Lead Matrix Pending Amount Visibility

1. Return to Lead Matrix after partial close.
2. Locate the same lead.
3. Verify remaining amount is visible in matrix row/card.

Pass criteria:

- Matrix shows pending amount for partial-payment leads.

### H. Admin Notification Flow (Deal/Payment)

1. Perform an action that requires admin approval (deal close/payment request).
2. Login as admin and open notifications.
3. Verify request appears with correct details.
4. Approve/reject and verify result reflected in lead/payment status.
5. When remaining payment is collected, verify second request reaches admin again.

Pass criteria:

- Admin receives and can process both initial close and remaining payment requests.

### I. Property Selection and Status Transition

1. On deal close request, select property tied to lead.
2. While request is pending, verify property shows reserved/block state.
3. After approval/closure completion, verify status becomes sold.
4. Validate role rules:
   - CP cannot perform restricted property status change actions.
   - Other allowed roles can create/request status updates per workflow.

Pass criteria:

- Property state transitions follow: pending request -> reserved -> sold.

### J. Regression: Existing Modules

Run basic checks so lead changes did not break other modules:

1. Inventory create/update/request approval.
2. Reports/Leaderboard load.
3. Chat opens and sends message.
4. Calendar and targets open.

Pass criteria:

- No console-breaking or API-breaking regressions.

## 7. API Spot Checks (Optional but Recommended)

Use these when UI result is unclear.

### Login token

```powershell
$body = @{ email = "admin@test.com"; password = "123456" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/auth/login" -Method Post -ContentType "application/json" -Body $body
$token = $login.token
```

### Fetch leads

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/leads" -Headers @{ Authorization = "Bearer $token" }
```

### Payment requests (admin)

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/leads/payment-requests" -Headers @{ Authorization = "Bearer $token" }
```

## 8. Build and Static Checks

Before final sign-off:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

If build/lint fails, release is blocked.

## 9. Defect Logging Template

For each bug, record:

- Module:
- Role used:
- URL:
- Repro steps:
- Actual result:
- Expected result:
- API response/status:
- Screenshot/video:
- Commit/branch tested:

## 10. Release Gate (Must Pass)

Release allowed only if all are true:

1. Smoke Gate fully pass.
2. Critical flows F, G, H, I pass.
3. No P1/P2 open defects.
4. Frontend lint + build pass.
5. Health endpoint stable and no fatal backend crash logs.

