# Mobile API Contract

**Purpose:** mobile and web must talk to the same backend the same way. This
maps the full API surface, states which mobile service covers it, and defines
how the mobile service layer should mirror `frontend/src/services/`.

**Principle:** mobile services are a **1:1 mirror** of web services — same file
name, same exported function names, same arguments, same response shaping. Only
the transport wrapper differs (`axios` instance + `AsyncStorage` tokens instead
of cookies). This is what keeps double-maintenance survivable: when a web
service changes, the mobile diff is obvious.

---

## 1. Surface summary

**249 endpoints** across 33 route files, mounted in `backend/src/app.js`:

| Mount | Route file | Endpoints | Mobile service | State |
| --- | --- | ---: | --- | :---: |
| `/api/auth` | `auth.routes.js` | 4 | `authService.ts` | ✅ |
| `/api/users` | `user.routes.js` | 18 | `userService.ts` | 🟡 |
| `/api/leads` | `lead.routes.js` | 21 | `leadService.ts` | 🟡 |
| `/api/inventory` | `inventory.routes.js` | 8 | `inventoryService.ts` | 🟡 |
| `/api/inventory-request` | `inventoryRequest.routes.js` | 9 | — | ❌ |
| `/api/chat` | `chat.routes.js` | 20 | `chatService.ts` | 🟡 |
| `/api/tasks` | `task.routes.js` | 8 | `taskService.ts` | 🟡 |
| `/api/targets` | `target.routes.js` | 2 | `targetService.ts` | ✅ |
| `/api/assistant` | `officeAssistant.routes.js` | 1 | `officeAssistantService.ts` | ✅ |
| `/api/attendance` | `attendance.routes.js` | 20 | — | ❌ |
| `/api/access` | `accessControl.routes.js` | 3 | — | ❌ |
| `/api/roles` | `customRole.routes.js` | 5 | — | ❌ |
| `/api/projects` | `project.routes.js` | 5 | — | ❌ |
| `/api/uploads` | `upload.routes.js` | 1 | — | ❌ |
| `/api/push` | `push.routes.js` | 6 | `pushNotifications.ts` | 🟡 |
| `/api/contacts` | `crmContact.routes.js` | 6 | — | ❌ |
| `/api/public` | `publicInventory.routes.js` | 1 | — | ❌ |
| `/api/coworking` | 11 route files | 92 | — | ❌ |
| `/api/webhook` | `webhook.routes.js` | 2 | — | ➖ server-to-server |
| `/api/client` | `client.routes.js` | 2 | — | ➖ portal |
| `/api/portal*` | 2 route files | 11 | — | ➖ separate app |

**Mobile covers roughly 90 of ~225 in-scope endpoints.**

## 2. Services to create

Nine web services have no mobile counterpart. In dependency order:

### 2.1 `permissionService.ts` + `accessService.ts` — **blocking, Phase 2**

Everything else gates on these.

```
GET   /api/access/me                     → current user's page grants
GET   /api/access/users/:userId/pages    → [ADMIN] a user's page config
PATCH /api/access/users/:userId/pages    → [ADMIN] update page config
GET   /api/coworking/permissions/me      → coworking permission list
```

Mirror `frontend/src/services/accessService.js` and `permissionService.js`
exactly. The page catalogue comes from the catalog endpoint — do not hardcode
the 22 pages.

### 2.2 `attendanceService.ts` — Phase 3

20 endpoints, the largest missing single module:

```
GET   /me                               GET   /daily
GET   /users/:userId                    GET   /policy
PATCH /policy                           GET   /violations
PATCH /violations/:violationId          PATCH /users/:userId/:date/breaks
POST  /check-in                         POST  /check-out
POST  /break/start                      POST  /break/end
POST  /users/:userId/break
GET   /leave-balance/my                 GET   /leave-balance/:userId
GET   /leave-requests/my                GET   /leave-requests/admin
POST  /leave-requests
```

**Mobile-specific:** check-in/check-out need geolocation. Web calls
`updateMyLiveLocation` from `App.jsx`; mobile must request
`expo-location` permission and send the same payload shape. `app.json`
currently declares no location permission — add `ACCESS_FINE_LOCATION` /
`NSLocationWhenInUseUsageDescription`.

### 2.3 `uploadService.ts` — Phase 3

One endpoint (`POST /api/uploads`) but it unblocks attachments everywhere:
leads, inventory, chat, KYC, profile photos.

Mobile differs materially from web here — `expo-image-picker` /
`expo-document-picker` produce a file URI, not a `File`. Wrap it:

```ts
const form = new FormData();
form.append("file", { uri, name, type } as any);
```

Check `backend/src/config/uploadStorage.js` for accepted MIME types and size
limits and enforce them client-side before upload, as web does.

### 2.4 `projectService.ts` — Phase 5

```
GET /api/projects          GET /api/projects/:id     (+3 write endpoints)
```

### 2.5 `roleService.ts` — Phase 7

```
GET    /api/roles          GET    /api/roles/catalogue
POST   /api/roles          PATCH  /api/roles/:roleId    DELETE /api/roles/:roleId
```

### 2.6 `publicInventoryService.ts` — Phase 5

```
GET /api/public/inventory/:shareToken    (unauthenticated)
```

Powers `SharedInventoryView`. Must work **without** a session — the axios
instance in `api.ts` always attaches a bearer token; use a bare `axios` call.

### 2.7 `saasService.ts` — Phase 7

4 endpoints backing company/tenant settings.

### 2.8 `crmContactService.ts` — Phase 5

6 endpoints backing Owner Database and Broker Database.

### 2.9 `inventoryRequestService.ts` — Phase 4

9 endpoints for the inventory request/review workflow — the main depth gap in
`AssetVaultScreen`.

### 2.10 Coworking services — Phase 6

92 endpoints under `/api/coworking`, all behind
`checkRoleOrPageAccess(COWORKING_ACCESS_ROLES, "coworking_booking", "coworking_clients")`
plus per-route `requirePermission(...)`:

| Sub-router | Endpoints | Mobile service |
| --- | ---: | --- |
| `/properties` | 5 | `coworkingPropertyService.ts` |
| `/floors` | 5 | `coworkingFloorService.ts` |
| `/board` | 2 | `coworkingBoardService.ts` |
| `/cabins` | 16 | `coworkingCabinService.ts` |
| `/clients` | 16 | `coworkingClientService.ts` |
| `/bookings` | 13 | `coworkingBookingService.ts` |
| `/contracts` | 9 | `coworkingContractService.ts` |
| `/invoices` | 6 | `coworkingInvoiceService.ts` |
| `/payments` | 3 | `coworkingPaymentService.ts` |
| `/expenses` | 10 | `coworkingExpenseService.ts` |
| root | 7 | `coworkingAccessService.ts` |

## 3. Transport layer

`mobile/src/services/api.ts` (130 lines) is in good shape: axios instance,
bearer token from `sessionStorage`, single-flight refresh on 401, unauthorized
handler. Keep it. Two gaps:

1. **No request timeout.** Add `timeout: 30000`. On mobile data a hung request
   never resolves and the screen spins forever.
2. **No retry on network error.** Web fails fast because the user can refresh;
   on mobile a tunnel or lift drops the connection constantly. Add one retry
   with backoff for idempotent (`GET`) requests only.

### Base URL resolution

Already handles dev/prod, Expo `hostUri`, and web preview. Production default
is `https://nemnidhi.cloud/api`. Env vars (`mobile/.env.example`):

```
EXPO_PUBLIC_API_BASE_URL       EXPO_PUBLIC_SOCKET_URL
EXPO_PUBLIC_SOCKET_PATH        EXPO_PUBLIC_USE_LOCAL_API
EXPO_PUBLIC_LOCAL_API_PORT     EXPO_PUBLIC_TURN_*
```

## 4. Realtime

Web uses `socket.io-client` via `chatSocket.js`; mobile has `chatSocket.ts`
(55 lines) and `RealtimeAlertsContext.tsx` (574 lines).

Mobile must additionally handle what a browser tab never does:

- **App backgrounding** — disconnect on `AppState` → `background`, reconnect on
  `active`, and refetch missed messages rather than relying on the socket
  buffer.
- **Network transitions** — Wi-Fi → cellular changes the socket's source
  address; listen and force reconnect.
- **Foreground vs background notifications** — an in-app toast when foregrounded,
  an OS notification when not. Web only ever does the former.

## 5. Push notifications

Web push shipped recently (`feat: web push notifications with reply from the
notification drawer`) using VAPID + service worker. **Mobile cannot reuse it** —
`/api/push/subscribe` takes a browser `PushSubscription`, while Expo produces an
Expo push token.

Backend work required (Phase 9), coordinate before starting:

```
POST /api/push/subscribe   — accept { kind: "expo", token } alongside
                             the existing web PushSubscription shape
POST /api/push/reply       — already exists; mobile reuses it for
                             notification quick-reply
```

The send path must then fan out to both web push and Expo's push service.
Check `backend/src/routes/push.routes.js` and its controller before estimating.

## 6. Data shape parity

Mobile types live in `mobile/src/types/index.ts` (196 lines) and cover
`UserRole`, `User`, `AuthPayload`, `LeadRequirements`. Web is plain JS with no
types, so **mobile's types are the only written record of these shapes** — and
they can silently drift from what the API returns.

Guard rail: for every service added, add its response type to `types/index.ts`,
and cross-check against the model in `backend/src/models/`. `Lead.js` and
`User.js` are both modified in the current working tree — re-verify before
Phase 4.

## 7. Acceptance criteria

- [ ] Every mobile service file name matches its web counterpart
- [ ] Every exported function matches web's name and argument order
- [ ] `api.ts` has a timeout and GET retry
- [ ] Socket reconnects correctly across background/foreground and Wi-Fi↔cellular
- [ ] Every new response shape typed in `types/index.ts`
- [ ] No endpoint called from a screen file directly — always via a service
