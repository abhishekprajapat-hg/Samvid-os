# Client to Backend API Contract Inventory

Generated for the automated-test-foundation/P0 contract phase.

## Implemented Or Already Matched

### Auth
- `POST /auth/login` -> `backend/src/routes/auth.routes.js`
- `POST /auth/refresh` -> `backend/src/routes/auth.routes.js`
- `GET /auth/me` -> `backend/src/routes/auth.routes.js`
- `POST /auth/logout` -> `backend/src/routes/auth.routes.js`
- `POST /auth/register` -> mobile service only; no mounted backend route.

### Client Bootstrap
- `GET /health` through `/api/client/health` -> `backend/src/routes/client.routes.js`
- `GET /bootstrap` through `/api/client/bootstrap` -> `backend/src/routes/client.routes.js`

### Leads
- `GET /leads`
- `POST /leads`
- `POST /leads/bulk`
- `GET /leads/followups/today`
- `GET /leads/payment-requests`
- `GET /leads/status-requests`
- `GET /leads/status-requests/pending`
- `GET /leads/performance/overview`
- `GET /leads/:leadId`
- `PATCH /leads/:leadId`
- `PATCH /leads/:leadId/status`
- `POST /leads/:leadId/status-request`
- `PATCH /leads/status-requests/:requestId/approve`
- `PATCH /leads/status-requests/:requestId/reject`
- `PATCH /leads/:leadId/assign`
- `PATCH /leads/:leadId/properties`
- `PATCH /leads/:leadId/properties/:inventoryId/select`
- `DELETE /leads/:leadId/properties/:inventoryId`
- `GET /leads/:leadId/activity`
- `GET /leads/:leadId/diary`
- `POST /leads/:leadId/diary`
- `PATCH /leads/:leadId/diary/:entryId` -> active and implemented in this phase.

### Users
- `GET /users`
- `POST /users/create`
- `GET /users/my-team`
- `GET /users/profile`
- `PATCH /users/profile`
- `GET /users/:userId/profile`
- `PATCH /users/:userId/designation`
- `PATCH /users/:userId/channel-partner/inventory-access`
- `PATCH /users/:userId` -> active and consolidated to the canonical admin/manager update flow in this phase.
- `PATCH /users/location`
- `GET /users/field-locations`
- `POST /users/rebalance-executives`
- `POST /users/:userId/delete-request`
- `GET /users/delete-requests/admin`
- `PATCH /users/delete-requests/:requestId/review`
- `DELETE /users/:userId`
- `GET /users/leaderboard`

### Attendance
- `GET /attendance/me`
- `POST /attendance/check-in`
- `POST /attendance/break/start`
- `POST /attendance/break/end`
- `POST /attendance/check-out`
- `PATCH /attendance/users/:userId/:date/status`
- `GET /attendance/users/:userId`
- `GET /attendance/daily`
- `GET /attendance/policy`
- `PATCH /attendance/policy`
- `GET /attendance/leave-balance/my`
- `POST /attendance/leave-requests`
- `GET /attendance/leave-requests/my`
- `GET /attendance/leave-requests/admin`
- `PATCH /attendance/leave-requests/:requestId/review`
- `POST /attendance/regularizations` -> active and mounted in this phase.
- `GET /attendance/regularizations/my` -> active and mounted in this phase.
- `GET /attendance/regularizations/admin` -> active and mounted in this phase.
- `PATCH /attendance/regularizations/:regularizationId/review` -> active and mounted in this phase.

### Inventory And Inventory Requests
- `GET /inventory`
- `GET /inventory/dashboard`
- `GET /inventory/:id`
- `POST /inventory`
- `POST /inventory/bulk`
- `POST /inventory/:id/share`
- `PATCH /inventory/:id`
- `DELETE /inventory/:id`
- `POST /inventory-request/status-change`
- `POST /inventory-request/:inventoryId/request`
- `GET /inventory-request/pending`
- `PATCH /inventory-request/:requestId/approve`
- `PATCH /inventory-request/:requestId/reject`
- `PATCH /inventory-request/:requestId/pre-approve`
- `GET /inventory-request/my`
- `POST /inventory-request/:requestId/comment`
- `POST /inventory-request/:requestId/cancel`

### Chat, Tasks, Targets, SaaS, Assistant, Webhooks
- Chat service calls map to `/chat` REST routes or the existing Socket.IO chat flow.
- Task service calls map to `/tasks` routes.
- Target service calls map to `/targets` routes.
- SaaS service calls map to `/saas` routes.
- Office assistant calls map to `/assistant/ask`.
- Meta webhook service calls map to `/webhook/meta` and `/client/webhook/meta`; both POST routes verify the exact raw JSON body with `X-Hub-Signature-256`.
- Authenticated upload flows for chat, profile photos, lead closure/status documents, and inventory media use `POST /chat/uploads`.

## Missing Routes Fixed In This Phase
- Active and implemented: `PATCH /leads/:leadId/diary/:entryId`.
- Active and mounted: attendance regularization create/my/admin/review endpoints.
- Active and consolidated: duplicate `PATCH /users/:userId` route definitions.
- Active and implemented: `POST /chat/uploads` stores validated files through the configured backend storage adapter.

## Intentionally Socket Or Service Flow
- Chat realtime connection, typing, delivery, read, call signaling and popup alerts are intentionally handled through the existing Socket.IO client/server flow plus the REST chat routes for persistence.
- Mobile `/chat/calls` REST calls fall back to local call-log state when absent; live call signaling remains socket/WebRTC driven.

## Upload Contract
- `POST /chat/uploads` requires a valid bearer token and tenant/company context.
- Response shape is `{ attachment: { fileName, fileUrl, mimeType, size, storagePath } }`.
- Supported file types are limited to active UI needs: JPEG, PNG, WebP, HEIC/HEIF images, PDF, MP4 video, and common chat audio formats (`mp3`, `m4a/mp4`, `aac`, `ogg`, `wav`).
- The backend validates filename/path traversal, extension, declared MIME type, magic bytes, empty files, maximum size, executable signatures, and obvious script/polyglot content before calling storage.
- Expected upload failures return controlled `400`, `413`, `415`, `500`, or `503` responses.

## Dead Code To Remove Later
- `POST /auth/register` is present in the mobile service but no current screen usage was found in this phase.
- `POST /users/profile-picture` and `DELETE /users/profile-picture` are present in mobile user service, but current profile upload usage goes through `uploadChatFile`; confirm and remove or implement in a later profile-media phase.

## Remaining Mismatches Deferred
- Mobile auth register/profile-picture service helpers remain unmounted backend contracts and should be cleaned up or implemented after a UI usage decision.
