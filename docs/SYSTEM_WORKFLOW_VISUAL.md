# Samvid OS Visual Workflow

Last updated: 2026-03-20

This document gives a visual view of how the major Samvid OS functions work across web, mobile, backend, realtime events, and tenant operations.

It is intentionally business-flow focused. For file-by-file technical coverage, use:

- [Web Frontend Pages and Components](./FRONTEND_WEB_DOCUMENTATION.md)
- [Mobile Screens and Components](./MOBILE_APP_DOCUMENTATION.md)
- [Backend Functionality and API Surface](./BACKEND_FUNCTIONALITY_DOCUMENTATION.md)

## 1. System Map

```mermaid
flowchart LR
  WEBUSER[Web user]
  MOBUSER[Mobile user]
  META[Meta lead forms]
  SUPER[Super admin]

  WEB[Web app]
  MOBILE[Mobile app]
  API[Express API]
  SOCKET[Socket.IO]
  CORE[Controllers and services]
  DB[(MongoDB)]

  WEBUSER --> WEB
  MOBUSER --> MOBILE
  META --> API
  SUPER --> WEB

  WEB --> API
  MOBILE --> API
  WEB <--> SOCKET
  MOBILE <--> SOCKET

  API --> CORE
  CORE --> DB
  API --> SOCKET
```

**Core idea**

- Web and mobile both use the same backend domain logic.
- API requests handle auth, role gating, tenant scope, and persistence.
- Socket.IO handles realtime chat, call, alert, and approval signals.
- MongoDB stores tenants, users, leads, inventory, chat, targets, and subscriptions.

**Primary source anchors**

- `frontend/src/App.jsx`
- `mobile/src/navigation/RootNavigator.tsx`
- `backend/src/app.js`
- `backend/src/server.js`

## 2. Role and Tenant Hierarchy

```mermaid
flowchart TD
  SA[SUPER_ADMIN]
  C[Company tenant]
  A[ADMIN]
  M[MANAGER]
  AM[ASSISTANT_MANAGER]
  TL[TEAM_LEADER]
  EX[EXECUTIVE]
  FEX[FIELD_EXECUTIVE]
  CP[CHANNEL_PARTNER]

  SA --> C
  C --> A
  A --> M
  M --> AM
  AM --> TL
  TL --> EX
  TL --> FEX
  A --> CP
```

**What this means operationally**

- `SUPER_ADMIN` works at platform level across all tenants.
- `ADMIN` owns one company tenant and controls approvals, users, and tenant settings.
- Management roles control teams and lead distribution inside the tenant hierarchy.
- Executives and field executives operate on assigned work.
- Channel partners remain tenant-scoped but with tighter access.

**Primary source anchors**

- `backend/src/constants/role.constants.js`
- `backend/src/routes/user.routes.js`
- `backend/src/routes/saas.routes.js`

## 3. Login, Tenant Resolution, and Session Flow

```mermaid
sequenceDiagram
  participant W as Web app
  participant M as Mobile app
  participant API as Express API
  participant TEN as Tenant middleware
  participant AUTH as Auth controller
  participant DB as MongoDB

  W->>API: POST /auth/login
  Note over W,API: Includes portal and tenant slug or tenant path
  API->>TEN: Resolve tenant from path, header, host
  API->>AUTH: Validate email, password, portal, tenant
  AUTH->>DB: Load user and company
  AUTH->>DB: Issue access and refresh tokens
  AUTH-->>W: user + tenant + accessToken + refreshToken
  W->>W: Store token, role, user, tenantSlug
  W->>API: Future API calls add Authorization and X-Tenant-Slug
  W->>API: /auth/me can re-hydrate tenant slug after refresh

  M->>API: POST /auth/login
  API->>AUTH: Validate credentials
  AUTH-->>M: user + accessToken + refreshToken
  M->>M: Persist session in sessionStorage
  M->>API: Future API calls add Authorization
```

**Web-specific runtime rules**

- The web app keeps tenant-aware URLs like `/<tenant-slug>/leads`.
- Session restore can redirect the browser back into the tenant-prefixed route space.
- Inactivity timeout and theme settings are applied on the client shell.

**Mobile-specific runtime rules**

- Mobile restores the stored session on app start.
- If session expiry is reached in background or refresh fails, the app clears session and returns to login.

**Primary source anchors**

- `backend/src/middleware/tenant.middleware.js`
- `backend/src/controllers/auth.controller.js`
- `frontend/src/components/auth/Login.jsx`
- `frontend/src/utils/tenantRouting.js`
- `frontend/src/services/api.js`
- `mobile/src/context/AuthContext.tsx`
- `mobile/src/services/api.ts`

## 4. Client Runtime Flow

```mermaid
flowchart LR
  WEBSTART[Web app start] --> WEBSESSION[Restore local session]
  WEBSESSION --> WEBROLE[Resolve role and tenant]
  WEBROLE --> WEBROUTES[Apply protected routes]
  WEBROUTES --> WEBPAGES[Load role-based modules]
  WEBPAGES --> WEBALERTS[Chat and admin notification provider]
  WEBPAGES --> WEBGEO[Field executive live location sync]

  MOBSTART[Mobile app start] --> MOBSESSION[Restore session storage]
  MOBSESSION --> MOBAUTH[AuthProvider]
  MOBAUTH --> MOBNAV[RoleTabs navigation]
  MOBNAV --> MOBSCREENS[Role-based screens]
  MOBSCREENS --> MOBALERTS[Realtime alerts provider]
```

**Primary source anchors**

- `frontend/src/App.jsx`
- `frontend/src/context/chatNotificationProvider.jsx`
- `mobile/src/navigation/RootNavigator.tsx`
- `mobile/src/navigation/RoleTabs.tsx`
- `mobile/src/context/RealtimeAlertsContext.tsx`

## 5. Lead Lifecycle

```mermaid
flowchart TD
  SRC[Lead source]
  MANUAL[Manual lead create]
  BULK[Bulk CSV upload]
  META[Meta webhook lead]
  CREATE[Create lead record]
  ASSIGN[Run auto assignment]
  SELF[Self assign to active executive requester]
  TEAM[Assign inside requester team]
  HIER[Assign by hierarchy or global fallback]
  MATRIX[Show in Leads Matrix and dashboards]
  WORK[Update status, diary, follow-up, activity]
  REQUEST[Optional status request]
  PENDING[Pending admin review]
  APPROVE[Approve or reject]
  CLOSE[Deal close path]
  REMAIN[Partial payment follow-up]

  SRC --> MANUAL --> CREATE
  SRC --> BULK --> CREATE
  SRC --> META --> CREATE
  CREATE --> ASSIGN
  ASSIGN --> SELF
  ASSIGN --> TEAM
  ASSIGN --> HIER
  SELF --> MATRIX
  TEAM --> MATRIX
  HIER --> MATRIX
  MATRIX --> WORK
  WORK --> REQUEST
  REQUEST --> PENDING
  PENDING --> APPROVE
  WORK --> CLOSE
  CLOSE --> REMAIN
```

**Flow explanation**

- Leads enter the system from manual creation, admin bulk upload, or Meta webhook ingestion.
- New leads are auto-assigned using hierarchy-aware balancing logic.
- Users then work the lead through lead details, follow-ups, diaries, and activity tracking.
- Sensitive state transitions can enter a status-request approval path.
- Close and payment flows can trigger admin notifications and additional follow-up work for remaining collection.

**Assignment logic**

- If an active executive or field executive creates the lead, the lead can self-assign.
- If a management user creates the lead, the system tries to assign within that reporting tree.
- If no local team candidate is best, the service falls back to hierarchy/global balancing.

**Primary source anchors**

- `backend/src/routes/lead.routes.js`
- `backend/src/controllers/lead.controller.js`
- `backend/src/services/leadAssignment.service.js`
- `frontend/src/modules/leads/LeadsMatrix.jsx`
- `mobile/src/modules/leads/LeadsMatrixScreen.tsx`
- `mobile/src/modules/leads/LeadDetailsScreen.tsx`

## 6. Deal Closure and Payment Approval Flow

```mermaid
flowchart TD
  LD[Lead details]
  PAY[Enter payment mode and payment type]
  PART{Partial payment}
  FULL[Full payment]
  PFU[Require next follow-up for remaining collection]
  REQ[Create admin payment request or close request]
  ADMIN[Admin notifications and approval queue]
  DECIDE{Approve or reject}
  CLOSED[Lead closed]
  REMCOL[Remaining payment collected]
  ADMIN2[Admin notified again]

  LD --> PAY
  PAY --> PART
  PART -- No --> FULL --> REQ
  PART -- Yes --> PFU --> REQ
  REQ --> ADMIN
  ADMIN --> DECIDE
  DECIDE -- Approve --> CLOSED
  DECIDE -- Reject --> LD
  PFU --> REMCOL --> ADMIN2 --> DECIDE
```

**Key business rules**

- Non-cash close paths require a payment reference.
- Partial payments require a positive remaining amount.
- Partial-payment close flows must keep the collection loop open through a next follow-up.
- Admin receives realtime events for payment approval, deal closure, and remaining-payment collection.

**Primary source anchors**

- `backend/src/controllers/lead.controller.js`
- `frontend/src/modules/admin/AdminNotifications.jsx`
- `frontend/src/context/chatNotificationProvider.jsx`
- `mobile/src/modules/notifications/NotificationsScreen.tsx`
- `mobile/src/context/RealtimeAlertsContext.tsx`

## 7. Inventory Workflow

```mermaid
flowchart TD
  VIEW[Inventory view]
  DIRECT{Actor can change directly}
  ADMINWRITE[Direct create, update, delete]
  REQ[Create inventory request]
  PRE{Needs management pre-approval}
  MGR[Manager, assistant manager, or team leader pre-approves]
  ADMIN[Admin final review]
  DECIDE{Approve or reject}
  APPLY[Apply inventory mutation]
  SYNC[Sync lead links, diary, activity, and notifications]
  DONE[Updated inventory visible to users]

  VIEW --> DIRECT
  DIRECT -- Yes --> ADMINWRITE --> SYNC --> DONE
  DIRECT -- No --> REQ --> PRE
  PRE -- Yes --> MGR --> ADMIN
  PRE -- No --> ADMIN
  ADMIN --> DECIDE
  DECIDE -- Approve --> APPLY --> SYNC --> DONE
  DECIDE -- Reject --> DONE
```

**Important status-specific rules**

- `Blocked` requests require a lead selection and a diary note.
- `Sold` requests require `saleDetails`, including payment information and the linked lead.
- Review events emit realtime notifications to admin, role, company, and team rooms.

**Primary source anchors**

- `backend/src/routes/inventory.routes.js`
- `backend/src/routes/inventoryRequest.routes.js`
- `backend/src/controllers/inventory.controller.js`
- `backend/src/controllers/inventoryRequest.controller.js`
- `backend/src/controllers/inventoryApproval.controller.js`
- `backend/src/services/inventoryWorkflow.service.js`
- `backend/src/services/inventoryNotification.service.js`
- `frontend/src/modules/inventory/AssetVault.jsx`
- `mobile/src/modules/inventory/AssetVaultScreen.tsx`

## 8. Realtime Chat, Alerts, and Calling

```mermaid
sequenceDiagram
  participant CLIENT as Web or mobile client
  participant SOCK as Socket.IO server
  participant CHAT as Chat services
  participant DB as MongoDB
  participant ALERT as Notification provider

  CLIENT->>SOCK: Connect with auth token
  SOCK->>CHAT: Authenticate user and load access context
  SOCK-->>CLIENT: Join user, role, company, team, and room channels

  CLIENT->>SOCK: Send message or typing event
  SOCK->>CHAT: Persist message and validate room access
  CHAT->>DB: Save room, message, receipts, call logs
  SOCK-->>CLIENT: Emit new message, delivered, seen, read, call updates
  SOCK-->>ALERT: Emit admin, inventory, and payment notification events
  ALERT-->>CLIENT: Update unread counts, toasts, popups, and incoming call UI
```

**What runs through the realtime layer**

- Room and direct messaging
- Typing, delivered, seen, and room-read receipts
- Incoming and outgoing call signaling
- Admin request alerts
- Inventory approval alerts
- Lead payment approval alerts

**Primary source anchors**

- `backend/src/server.js`
- `backend/src/socket/chat.socket.js`
- `backend/src/services/chatRoom.service.js`
- `backend/src/services/chatCall.service.js`
- `frontend/src/modules/chat/TeamChat.jsx`
- `frontend/src/context/chatNotificationProvider.jsx`
- `mobile/src/modules/chat/ChatConversationScreen.tsx`
- `mobile/src/modules/chat/CallScreen.tsx`
- `mobile/src/context/RealtimeAlertsContext.tsx`

## 9. Meta Webhook to Lead Pipeline

```mermaid
flowchart TD
  META[Meta leadgen webhook]
  VERIFY[Webhook verify endpoint]
  RECEIVE[Receive leadgen event]
  ROUTE[Resolve company by configured page ID]
  FETCH[Fetch lead fields from Meta Graph API]
  NORMALIZE[Normalize name, phone, email, city, project]
  DEDUPE[Deduplicate or safely ignore duplicates]
  CREATE[Create lead in tenant scope]
  ASSIGN[Auto assign lead]
  USE[Lead becomes visible in CRM]

  META --> VERIFY
  META --> RECEIVE --> ROUTE --> FETCH --> NORMALIZE --> DEDUPE --> CREATE --> ASSIGN --> USE
```

**Why this matters**

- A single webhook surface can route events to the correct tenant by page ownership.
- Company-scoped page configuration decides which tenant receives a Meta lead.
- New Meta leads immediately join the same lead workflow as manual and bulk-created leads.

**Primary source anchors**

- `backend/src/routes/webhook.routes.js`
- `backend/src/controllers/webhook.controller.js`
- `backend/src/services/leadAssignment.service.js`
- `backend/src/controllers/saas.controller.js`

## 10. Targets, Reports, and Samvid Intelligence

```mermaid
flowchart LR
  USERS[Users and hierarchy]
  LEADS[Leads]
  INV[Inventory]
  TARGETS[Target assignments]
  PERF[Performance and leaderboard]
  REPORTS[Intelligence reports]
  SAMVID[Samvid ask endpoint]

  USERS --> TARGETS
  LEADS --> PERF
  LEADS --> REPORTS
  INV --> REPORTS
  USERS --> PERF
  TARGETS --> PERF
  LEADS --> SAMVID
  INV --> SAMVID
  USERS --> SAMVID
```

**Functional view**

- Targets are assigned through hierarchy-aware target APIs.
- Performance screens compare target achievement with live lead activity.
- Reports aggregate lead funnel, aging, inventory, and team output.
- Samvid queries the same live business data and returns intent-based snapshots.

**Primary source anchors**

- `backend/src/routes/target.routes.js`
- `backend/src/controllers/target.controller.js`
- `backend/src/routes/samvid.routes.js`
- `backend/src/controllers/samvid.controller.js`
- `frontend/src/modules/reports/Performance.jsx`
- `frontend/src/modules/reports/IntelligenceReports.jsx`
- `mobile/src/modules/reports/PerformanceScreen.tsx`
- `mobile/src/modules/chat/SamvidBotScreen.tsx`

## 11. SaaS and Tenant Administration Flow

```mermaid
flowchart TD
  SA[Super admin]
  COMP[Create company tenant]
  SUB[Generate unique subdomain and tenant metadata]
  ADMIN[Provision tenant admin]
  PLAN[Create or update subscription plan]
  ASSIGN[Assign subscription]
  TENANT[Tenant admin settings]
  META[Tenant Meta integration settings]
  USERS[Tenant users log in on company route]
  OPS[Company-scoped operations]

  SA --> COMP --> SUB --> ADMIN
  SA --> PLAN --> ASSIGN
  ADMIN --> TENANT --> META --> USERS --> OPS
```

**Operational view**

- `SUPER_ADMIN` manages tenants, plans, analytics, and usage.
- Tenant admins manage their own settings and Meta integration.
- Once a tenant is configured, normal web and mobile users operate within that company scope.

**Primary source anchors**

- `backend/src/routes/saas.routes.js`
- `backend/src/controllers/saas.controller.js`
- `backend/SAAS_ARCHITECTURE.md`
- `frontend/src/modules/admin/SuperAdminPanel.jsx`
- `frontend/src/services/saasService.js`

## 12. End-to-End Summary

```mermaid
flowchart LR
  TENANT[Tenant context]
  AUTH[Authenticated user]
  ROLE[Role-gated module access]
  DATA[Leads, inventory, chat, targets]
  APPROVAL[Admin approval paths]
  REALTIME[Realtime alerts and calls]
  ANALYTICS[Reports and Samvid]

  TENANT --> AUTH --> ROLE --> DATA --> APPROVAL --> REALTIME --> ANALYTICS
```

Samvid OS is essentially a tenant-aware operating system for sales teams:

- tenant resolution decides data ownership
- auth and role rules decide access
- lead and inventory workflows drive daily operations
- realtime events keep teams and admins synchronized
- reports, targets, and Samvid turn operations into insight

