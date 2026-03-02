..
.369id OS Project Report

**Report Date:** 2026-03-02  
**Repository Path:** `c:\Users\abhishe\OneDrive\Desktop\samvid-os` 

## 1. Executive Summary

Samvid OS is a multi-client CRM/operations platform with a shared backend and two user-facing clients:
- Web app (`frontend`) built with React + Vite.
- Mobile app (`mobile`) built with Expo + React Native.
- Backend (`backend`) built with Express + MongoDB + Socket.IO.

The codebase is functionally rich and already supports:
- Role-based authentication and access control.
- Lead lifecycle and assignment workflows.
- Inventory management plus approval workflow.
- Realtime chat, broadcast, escalation, and call signaling/history.
- Targets/performance tracking.
- Deployment assets for VPS + Nginx + PM2.

Current quality status is mixed:
- Frontend production build passes.
- Mobile TypeScript check passes.
- Backend app module loads successfully.
- Frontend lint currently fails with 14 errors and 1 warning.
-
 No project-level automated tests were found under app source directories.

## 2. Monorepo Structure

- `backend/`: API server, business logic, realtime socket layer, Mongo models.
- `frontend/`: React web dashboard and role-specific modules.
- `mobile/`: React Native app with role-based tab navigation and feature parity work.
- `deploy/`: PM2 ecosystem and Nginx config.
- `DEPLOY_VPS.md`, `deploy.sh`: deployment runbook and automation script.

Approximate source scale (app code only):
- Backend: 63 files, ~10,032 LOC.
- Frontend: 54 files, ~15,535 LOC.
- Mobile: 36 files, ~9,079 LOC.

## 3. Architecture Overview

### 3.1 Backend

Core stack:
- Express 5, Mongoose, JWT auth, Socket.IO, Pino logging, Prometheus metrics.

Main API surfaces:
- Health and metrics: `/api/health`, `/api/metrics`.
- Client namespace: `/api/client/*` (web and mobile primary integration path).
- Also mounted directly for compatibility: `/api/leads`, `/api/auth`, `/api/users`, `/api/targets`, `/api/inventory`, `/api/inventory-request`, `/api/webhook`, `/api/chat`.

Core domain modules:
- Auth: login, refresh token rotation, logout, `me` endpoint.
- Users: hierarchy-aware team/user management and live location updates.
- Leads: create/list/assign/status, related inventory linking, diary and activity timelines, follow-ups.
- Inventory: CRUD, bulk create, activity logs, request/approval workflow for field-driven updates.
- Targets: monthly assignment and retrieval.
- Chat: rooms, direct/group/lead chats, messages (text/property/media), escalation logs, broadcasts, read/delivery/seen states.
- Realtime calls: signaling and persisted call history.
- Webhook: Meta verification and inbound processing.

Operational controls:
- Helmet, CORS, compression.
- Request IDs and structured HTTP logging.
- Per-surface rate limiting (API/auth/webhook/write/chat).
- Prometheus metrics and slow request warning threshold.

### 3.2 Frontend (Web)

Core stack:
- React 19, React Router, Vite, Tailwind, framer-motion, Axios, Socket.IO client.

Key characteristics:
- Role-based route gating across admin/manager/executive/field/channel-partner flows.
- Lazy-loaded modules for dashboards and domain sections.
- Session restore + refresh token interceptor.
- Local system settings persistence (`sessionTimeout`, compact UI, reduce motion, high contrast).
- Field-executive geolocation sync for live location tracking.
- Realtime team chat UI with message/call interactions.

Feature modules present:
- `admin`, `calendar`, `chat`, `executive`, `field`, `finance`, `inventory`, `leads`, `legal`, `manager`, `portal`, `profile`, `reports`.

### 3.3 Mobile (React Native)

Core stack:
- Expo SDK 54, React Native 0.81, React Navigation, AsyncStorage, Socket.IO client, WebRTC package.

Key characteristics:
- Auth-gated root navigation with role-based bottom tabs.
- Shared backend API usage (`/api/client`) and socket path.
- Session persistence via AsyncStorage.
- Dedicated screens for lead/inventory/chat/report/admin/finance/calendar flows.
- Ongoing parity alignment documented in `FRONTEND_MIGRATION_STATUS.md`.

## 4. Access Model and Multi-Tenant Context

Defined roles:
- `ADMIN`, `MANAGER`, `ASSISTANT_MANAGER`, `TEAM_LEADER`, `EXECUTIVE`, `FIELD_EXECUTIVE`, `CHANNEL_PARTNER`.

Notable control patterns:
- JWT `protect` middleware with role checks.
- Company context enforcement for tenant isolation on relevant routes.
- Hierarchy-driven parent/descendant assignment patterns.
- Chat role restrictions for group/broadcast/escalation paths.

## 5. Data Model Coverage

Primary entities:
- Users, refresh tokens.
- Leads + lead activity + lead diary.
- Inventory + inventory request + inventory activity.
- Target assignments.
- Chat rooms/messages/escalation logs/conversations/call history.

Notable model capabilities:
- Lead statuses and follow-up scheduling fields.
- Inventory uniqueness by company + project/tower/unit.
- Request lifecycle with manager pre-approval and admin final approval.
- Chat unread counters, clear markers, escalation metadata, broadcast targeting.
- Refresh token family/rotation/revocation semantics with TTL index.

## 6. Realtime and Integrations

Realtime channels include:
- Message send/receive.
- Typing indicators.
- Read/delivered/seen events.
- Escalation notifications.
- Call signaling and call state updates.

External integration:
- Meta webhook endpoints are present for lead ingestion/verification.
- Frontend supports optional maps provider/API key configuration.

## 7. Environment and Deployment

Deployment assets indicate:
- Backend process management through PM2 (`samvid-backend`, default port `5100` in deployment config).
- Nginx reverse proxy for `/api` and `/socket.io` plus static frontend hosting.
- `deploy.sh` supports pull/install/build/reload flow.

Environment observations:
- Runtime `.env` files exist in `backend`, `frontend`, and `mobile`.
- Deployment docs reference `.env.example` templates, but those templates were not found in the current repository tree.

## 8. Validation Snapshot (Executed on 2026-03-02)

Commands run:
- `frontend`: `npm run lint` -> **failed**.
- `frontend`: `npm run build` -> **passed**.
- `mobile`: `npx tsc --noEmit` -> **passed**.
- `backend`: `node -e "require('./src/app')"` -> **passed**.

Frontend lint findings summary:
- 14 errors, 1 warning.
- Mostly unused variables/imports and one React hook dependency warning.

## 9. Gaps, Risks, and Improvement Priorities

### High Priority
- Add automated tests (API integration tests + critical UI smoke tests). No app-level test/spec files were found under `backend/src`, `frontend/src`, or `mobile/src`.
- Resolve frontend lint failures to maintain code quality gates and reduce drift.
- Add versioned env example templates (`backend/.env.example`, `frontend/.env.example`, `mobile/.env.example`) to reduce onboarding and deploy misconfiguration risk.

### Medium Priority
- Review API contract consistency between clients and backend (example: mobile service includes a `registerUser` call to `/auth/register`, while current backend auth routes expose login/refresh/me/logout).
- Rationalize duplicate API mount strategy (`/api/client/*` and top-level `/api/*`) to reduce long-term route surface complexity.
- Expand observability dashboards/alerts around latency, error rates, and websocket health using existing Prometheus metrics.

### Low Priority
- Continue web-to-mobile parity pass for remaining UX polish and shared design system adoption.
- Document module ownership and release checklist per app.

## 10. Suggested 30-Day Action Plan

1. Stabilization (Week 1)
- Fix frontend lint issues and enforce lint in CI.
- Add missing `.env.example` files.

2. Reliability (Week 2)
- Add backend integration tests for auth/leads/inventory/chat core flows.
- Add basic frontend and mobile smoke tests for login + primary role navigation.

3. Consistency (Week 3)
- Align API contracts across web/mobile/backend and remove stale client calls.
- Review/reduce legacy alias routes where safe.

4. Operability (Week 4)
- Publish Prometheus dashboard templates and SLO alerts.
- Finalize deployment checklist and rollback notes.

## 11. Conclusion

Samvid OS has a solid multi-platform foundation and strong feature coverage for role-driven CRM operations, inventory workflows, and realtime collaboration. The most important next step is quality hardening: lint cleanup, test automation, and environment/documentation consistency. Once these are addressed, the codebase is well-positioned for stable scaling and faster release cadence.
