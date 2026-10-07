# API TEST MATRIX

Complete endpoint inventory, extracted programmatically by instrumenting the live Express
router tree (not by grep), then probed against the running server.

- **243** canonical endpoints under `/api/...`
- Every business router is **mounted twice** — at `/api/<name>` and again at `/api/client/<name>`
  (the web and mobile clients use the `/api/client` namespace; `backend/test/route-mounts.test.cjs` enforces this).
  Counting both namespaces gives **479** addressable paths.

## Cross-cutting results

| Check | Result |
|---|---|
| Unauthenticated request to a protected endpoint | 401 on every endpoint probed |
| Forged `alg:none` JWT | 401 |
| JWT signed with the wrong secret | 401 |
| Expired JWT | 401 |
| Scoped (client-portal / push-reply) token used as a staff token | 401 |
| JWT for a deleted user id | 401 |
| Unknown route | 404 `{message, requestId}` in both namespaces |
| Wrong HTTP method on an existing path | 404 (no 500) |
| Malformed JSON body | 400, no stack trace |
| Stack traces / internals in error bodies | none observed across 9 probed write endpoints |
| Rate limiting on repeated failed logins | 429 after 4 attempts |

## Role access matrix (observed HTTP status per role)

Probed with a real session per role against every GET endpoint. `-` = not probed.

| Endpoint | ADMIN | MANAGER | EXECUTIVE | FIELD_EXEC | PRODUCTION_EXEC | COMM_MGR | PARTNER | CW_ADMIN | INSIDE_EXEC |
|---|---|---|---|---|---|---|---|---|---|
| `/api/access/me` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/access/users/:id/pages` | 404 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/attendance/daily` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/attendance/leave-balance/:id` | 404 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/attendance/leave-balance/my` | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/attendance/leave-requests/admin` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/attendance/leave-requests/my` | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/attendance/me` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/attendance/policy` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/attendance/users/:id` | 404 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/attendance/violations` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/auth/me` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/broadcasts` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/contacts` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/conversations` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/conversations/:id/messages` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/chat/escalation-logs` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/escalations` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/escalations/:id/logs` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/chat/rooms` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/chat/rooms/:id/messages` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/contacts` | 200 | 200 | 200 | 200 | 200 | 200 | 403 | 200 | 200 |
| `/api/contacts/:id/blocked-leads` | 404 | 404 | 404 | 404 | 404 | 404 | 403 | 404 | 404 |
| `/api/contacts/identify` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/coworking/audit-logs` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/board` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/bookings` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/bookings/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/bookings/available-cabins` | 400 | 400 | 403 | 403 | 403 | 403 | 403 | 400 | 403 |
| `/api/coworking/bookings/available-seats` | 400 | 400 | 403 | 403 | 403 | 403 | 403 | 400 | 403 |
| `/api/coworking/bookings/cabins/:id/calendar` | 400 | 400 | 403 | 403 | 403 | 403 | 403 | 400 | 403 |
| `/api/coworking/cabins` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/cabins/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/cabins/floor-view` | 400 | 400 | 403 | 403 | 403 | 403 | 403 | 400 | 403 |
| `/api/coworking/clients` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/clients/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/clients/:id/activity` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/clients/:id/assignments` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/clients/:id/portal-users` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/clients/birthdays` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/contracts` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/contracts/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/expenses` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/expenses/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/floors` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/floors/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/invoices` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/invoices/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/payments` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/permissions/me` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/properties` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/properties/:id` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 404 | 403 |
| `/api/coworking/roles` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/seats` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/coworking/users` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `/api/inventory` | 200 | 200 | 200 | 200 | 403 | 403 | 200 | 403 | 403 |
| `/api/inventory-request/my` | 200 | 200 | 200 | 200 | 403 | 403 | 200 | 403 | 403 |
| `/api/inventory-request/pending` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/inventory/:id` | 404 | 404 | 404 | 404 | 403 | 403 | 404 | 403 | 403 |
| `/api/inventory/:id/activity` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/leads` | 200 | 200 | 200 | 200 | 403 | 403 | 200 | 403 | 200 |
| `/api/leads/:id` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/leads/:id/activity` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/leads/:id/diary` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/leads/followups/today` | 200 | 200 | 200 | 200 | 403 | 403 | 200 | 403 | 200 |
| `/api/leads/payment-requests` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/leads/performance/overview` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/leads/status-requests` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/leads/status-requests/pending` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/projects` | 200 | 200 | 200 | 200 | 403 | 403 | 200 | 403 | 403 |
| `/api/projects/:id` | 404 | 404 | 404 | 404 | 403 | 403 | 404 | 403 | 403 |
| `/api/push/public-key` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/push/status` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/roles` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/roles/catalogue` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/targets/my` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/tasks` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/tasks/:id` | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| `/api/tasks/assignees` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/tasks/stats` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/tasks/stats/by-user` | 200 | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/users` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/users/:id/profile` | 404 | 404 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/users/delete-requests/admin` | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `/api/users/field-locations` | 200 | 200 | 403 | 200 | 403 | 403 | 403 | 403 | 403 |
| `/api/users/leaderboard` | 200 | 200 | 200 | 200 | 403 | 403 | 200 | 403 | 403 |
| `/api/users/my-team` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `/api/users/profile` | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |

## Full endpoint inventory

| # | Method | Canonical path | Also mounted at | Auth | Notes |
|---|---|---|---|---|---|
| 1 | DELETE | `/api/contacts/:contactId` | `/api/client/contacts/:contactId` | Bearer JWT |  |
| 2 | DELETE | `/api/coworking/cabins/:cabinId` | `/api/client/coworking/cabins/:cabinId` | Bearer JWT |  |
| 3 | DELETE | `/api/coworking/clients/:clientId` | `/api/client/coworking/clients/:clientId` | Bearer JWT |  |
| 4 | DELETE | `/api/coworking/clients/:clientId/contacts/:contactId` | `/api/client/coworking/clients/:clientId/contacts/:contactId` | Bearer JWT |  |
| 5 | DELETE | `/api/coworking/clients/:clientId/documents/:documentId` | `/api/client/coworking/clients/:clientId/documents/:documentId` | Bearer JWT |  |
| 6 | DELETE | `/api/coworking/contracts/:contractId/documents/:documentId` | `/api/client/coworking/contracts/:contractId/documents/:documentId` | Bearer JWT |  |
| 7 | DELETE | `/api/coworking/expenses/:expenseId` | `/api/client/coworking/expenses/:expenseId` | Bearer JWT |  |
| 8 | DELETE | `/api/coworking/expenses/:expenseId/receipts/:receiptId` | `/api/client/coworking/expenses/:expenseId/receipts/:receiptId` | Bearer JWT |  |
| 9 | DELETE | `/api/coworking/floors/:floorId` | `/api/client/coworking/floors/:floorId` | Bearer JWT |  |
| 10 | DELETE | `/api/coworking/properties/:propertyId` | `/api/client/coworking/properties/:propertyId` | Bearer JWT |  |
| 11 | DELETE | `/api/inventory/:id` | `/api/client/inventory/:id` | Bearer JWT |  |
| 12 | DELETE | `/api/leads/:leadId/properties/:inventoryId` | `/api/client/leads/:leadId/properties/:inventoryId` | Bearer JWT |  |
| 13 | DELETE | `/api/projects/:id` | `/api/client/projects/:id` | Bearer JWT |  |
| 14 | DELETE | `/api/roles/:roleId` | `/api/client/roles/:roleId` | Bearer JWT |  |
| 15 | DELETE | `/api/tasks/:taskId` | `/api/client/tasks/:taskId` | Bearer JWT |  |
| 16 | DELETE | `/api/users/:userId` | `/api/client/users/:userId` | Bearer JWT |  |
| 17 | GET | `/api/access/me` | `/api/client/access/me` | Bearer JWT |  |
| 18 | GET | `/api/access/users/:userId/pages` | `/api/client/access/users/:userId/pages` | Bearer JWT |  |
| 19 | GET | `/api/attendance/daily` | `/api/client/attendance/daily` | Bearer JWT |  |
| 20 | GET | `/api/attendance/leave-balance/:userId` | `/api/client/attendance/leave-balance/:userId` | Bearer JWT |  |
| 21 | GET | `/api/attendance/leave-balance/my` | `/api/client/attendance/leave-balance/my` | Bearer JWT |  |
| 22 | GET | `/api/attendance/leave-requests/admin` | `/api/client/attendance/leave-requests/admin` | Bearer JWT |  |
| 23 | GET | `/api/attendance/leave-requests/my` | `/api/client/attendance/leave-requests/my` | Bearer JWT |  |
| 24 | GET | `/api/attendance/me` | `/api/client/attendance/me` | Bearer JWT |  |
| 25 | GET | `/api/attendance/policy` | `/api/client/attendance/policy` | Bearer JWT |  |
| 26 | GET | `/api/attendance/users/:userId` | `/api/client/attendance/users/:userId` | Bearer JWT |  |
| 27 | GET | `/api/attendance/violations` | `/api/client/attendance/violations` | Bearer JWT |  |
| 28 | GET | `/api/auth/me` | `/api/client/auth/me` | Bearer JWT |  |
| 29 | GET | `/api/chat/broadcasts` | `/api/client/chat/broadcasts` | Bearer JWT |  |
| 30 | GET | `/api/chat/contacts` | `/api/client/chat/contacts` | Bearer JWT |  |
| 31 | GET | `/api/chat/conversations` | `/api/client/chat/conversations` | Bearer JWT |  |
| 32 | GET | `/api/chat/conversations/:conversationId/messages` | `/api/client/chat/conversations/:conversationId/messages` | Bearer JWT |  |
| 33 | GET | `/api/chat/escalation-logs` | `/api/client/chat/escalation-logs` | Bearer JWT |  |
| 34 | GET | `/api/chat/escalations` | `/api/client/chat/escalations` | Bearer JWT |  |
| 35 | GET | `/api/chat/escalations/:roomId/logs` | `/api/client/chat/escalations/:roomId/logs` | Bearer JWT |  |
| 36 | GET | `/api/chat/rooms` | `/api/client/chat/rooms` | Bearer JWT |  |
| 37 | GET | `/api/chat/rooms/:roomId/messages` | `/api/client/chat/rooms/:roomId/messages` | Bearer JWT |  |
| 38 | GET | `/api/contacts` | `/api/client/contacts` | Bearer JWT |  |
| 39 | GET | `/api/contacts/:contactId/blocked-leads` | `/api/client/contacts/:contactId/blocked-leads` | Bearer JWT |  |
| 40 | GET | `/api/contacts/identify` | `/api/client/contacts/identify` | Bearer JWT |  |
| 41 | GET | `/api/coworking/audit-logs` | `/api/client/coworking/audit-logs` | Bearer JWT |  |
| 42 | GET | `/api/coworking/board` | `/api/client/coworking/board` | Bearer JWT |  |
| 43 | GET | `/api/coworking/bookings` | `/api/client/coworking/bookings` | Bearer JWT |  |
| 44 | GET | `/api/coworking/bookings/:bookingId` | `/api/client/coworking/bookings/:bookingId` | Bearer JWT |  |
| 45 | GET | `/api/coworking/bookings/available-cabins` | `/api/client/coworking/bookings/available-cabins` | Bearer JWT |  |
| 46 | GET | `/api/coworking/bookings/available-seats` | `/api/client/coworking/bookings/available-seats` | Bearer JWT |  |
| 47 | GET | `/api/coworking/bookings/cabins/:cabinId/calendar` | `/api/client/coworking/bookings/cabins/:cabinId/calendar` | Bearer JWT |  |
| 48 | GET | `/api/coworking/cabins` | `/api/client/coworking/cabins` | Bearer JWT |  |
| 49 | GET | `/api/coworking/cabins/:cabinId` | `/api/client/coworking/cabins/:cabinId` | Bearer JWT |  |
| 50 | GET | `/api/coworking/cabins/floor-view` | `/api/client/coworking/cabins/floor-view` | Bearer JWT |  |
| 51 | GET | `/api/coworking/clients` | `/api/client/coworking/clients` | Bearer JWT |  |
| 52 | GET | `/api/coworking/clients/:clientId` | `/api/client/coworking/clients/:clientId` | Bearer JWT |  |
| 53 | GET | `/api/coworking/clients/:clientId/activity` | `/api/client/coworking/clients/:clientId/activity` | Bearer JWT |  |
| 54 | GET | `/api/coworking/clients/:clientId/assignments` | `/api/client/coworking/clients/:clientId/assignments` | Bearer JWT |  |
| 55 | GET | `/api/coworking/clients/:clientId/portal-users` | `/api/client/coworking/clients/:clientId/portal-users` | Bearer JWT |  |
| 56 | GET | `/api/coworking/clients/birthdays` | `/api/client/coworking/clients/birthdays` | Bearer JWT |  |
| 57 | GET | `/api/coworking/contracts` | `/api/client/coworking/contracts` | Bearer JWT |  |
| 58 | GET | `/api/coworking/contracts/:contractId` | `/api/client/coworking/contracts/:contractId` | Bearer JWT |  |
| 59 | GET | `/api/coworking/expenses` | `/api/client/coworking/expenses` | Bearer JWT |  |
| 60 | GET | `/api/coworking/expenses/:expenseId` | `/api/client/coworking/expenses/:expenseId` | Bearer JWT |  |
| 61 | GET | `/api/coworking/floors` | `/api/client/coworking/floors` | Bearer JWT |  |
| 62 | GET | `/api/coworking/floors/:floorId` | `/api/client/coworking/floors/:floorId` | Bearer JWT |  |
| 63 | GET | `/api/coworking/invoices` | `/api/client/coworking/invoices` | Bearer JWT |  |
| 64 | GET | `/api/coworking/invoices/:invoiceId` | `/api/client/coworking/invoices/:invoiceId` | Bearer JWT |  |
| 65 | GET | `/api/coworking/payments` | `/api/client/coworking/payments` | Bearer JWT |  |
| 66 | GET | `/api/coworking/permissions/me` | `/api/client/coworking/permissions/me` | Bearer JWT |  |
| 67 | GET | `/api/coworking/properties` | `/api/client/coworking/properties` | Bearer JWT |  |
| 68 | GET | `/api/coworking/properties/:propertyId` | `/api/client/coworking/properties/:propertyId` | Bearer JWT |  |
| 69 | GET | `/api/coworking/roles` | `/api/client/coworking/roles` | Bearer JWT |  |
| 70 | GET | `/api/coworking/seats` | `/api/client/coworking/seats` | Bearer JWT |  |
| 71 | GET | `/api/coworking/users` | `/api/client/coworking/users` | Bearer JWT |  |
| 72 | GET | `/api/inventory` | `/api/client/inventory` | Bearer JWT |  |
| 73 | GET | `/api/inventory-request/my` | `/api/client/inventory-request/my` | Bearer JWT |  |
| 74 | GET | `/api/inventory-request/pending` | `/api/client/inventory-request/pending` | Bearer JWT |  |
| 75 | GET | `/api/inventory/:id` | `/api/client/inventory/:id` | Bearer JWT |  |
| 76 | GET | `/api/inventory/:id/activity` | `/api/client/inventory/:id/activity` | Bearer JWT |  |
| 77 | GET | `/api/leads` | `/api/client/leads` | Bearer JWT |  |
| 78 | GET | `/api/leads/:leadId` | `/api/client/leads/:leadId` | Bearer JWT |  |
| 79 | GET | `/api/leads/:leadId/activity` | `/api/client/leads/:leadId/activity` | Bearer JWT |  |
| 80 | GET | `/api/leads/:leadId/diary` | `/api/client/leads/:leadId/diary` | Bearer JWT |  |
| 81 | GET | `/api/leads/followups/today` | `/api/client/leads/followups/today` | Bearer JWT |  |
| 82 | GET | `/api/leads/payment-requests` | `/api/client/leads/payment-requests` | Bearer JWT |  |
| 83 | GET | `/api/leads/performance/overview` | `/api/client/leads/performance/overview` | Bearer JWT |  |
| 84 | GET | `/api/leads/status-requests` | `/api/client/leads/status-requests` | Bearer JWT |  |
| 85 | GET | `/api/leads/status-requests/pending` | `/api/client/leads/status-requests/pending` | Bearer JWT |  |
| 86 | GET | `/api/portal/auth/me` | — | Bearer JWT | client-portal token scope |
| 87 | GET | `/api/portal/bookings` | — | Bearer JWT | client-portal token scope |
| 88 | GET | `/api/portal/contracts` | — | Bearer JWT | client-portal token scope |
| 89 | GET | `/api/portal/contracts/:contractId` | — | Bearer JWT | client-portal token scope |
| 90 | GET | `/api/portal/documents` | — | Bearer JWT | client-portal token scope |
| 91 | GET | `/api/portal/invoices` | — | Bearer JWT | client-portal token scope |
| 92 | GET | `/api/portal/invoices/:invoiceId` | — | Bearer JWT | client-portal token scope |
| 93 | GET | `/api/portal/me/client` | — | Bearer JWT | client-portal token scope |
| 94 | GET | `/api/projects` | `/api/client/projects` | Bearer JWT |  |
| 95 | GET | `/api/projects/:id` | `/api/client/projects/:id` | Bearer JWT |  |
| 96 | GET | `/api/public/inventory/:shareToken` | — | public | public share link |
| 97 | GET | `/api/push/public-key` | `/api/client/push/public-key` | Bearer JWT |  |
| 98 | GET | `/api/push/status` | `/api/client/push/status` | Bearer JWT |  |
| 99 | GET | `/api/roles` | `/api/client/roles` | Bearer JWT |  |
| 100 | GET | `/api/roles/catalogue` | `/api/client/roles/catalogue` | Bearer JWT |  |
| 101 | GET | `/api/targets/my` | `/api/client/targets/my` | Bearer JWT |  |
| 102 | GET | `/api/tasks` | `/api/client/tasks` | Bearer JWT |  |
| 103 | GET | `/api/tasks/:taskId` | `/api/client/tasks/:taskId` | Bearer JWT |  |
| 104 | GET | `/api/tasks/assignees` | `/api/client/tasks/assignees` | Bearer JWT |  |
| 105 | GET | `/api/tasks/stats` | `/api/client/tasks/stats` | Bearer JWT |  |
| 106 | GET | `/api/tasks/stats/by-user` | `/api/client/tasks/stats/by-user` | Bearer JWT |  |
| 107 | GET | `/api/users` | `/api/client/users` | Bearer JWT |  |
| 108 | GET | `/api/users/:userId/profile` | `/api/client/users/:userId/profile` | Bearer JWT |  |
| 109 | GET | `/api/users/delete-requests/admin` | `/api/client/users/delete-requests/admin` | Bearer JWT |  |
| 110 | GET | `/api/users/field-locations` | `/api/client/users/field-locations` | Bearer JWT |  |
| 111 | GET | `/api/users/leaderboard` | `/api/client/users/leaderboard` | Bearer JWT |  |
| 112 | GET | `/api/users/my-team` | `/api/client/users/my-team` | Bearer JWT |  |
| 113 | GET | `/api/users/profile` | `/api/client/users/profile` | Bearer JWT |  |
| 114 | GET | `/api/webhook/meta` | `/api/client/webhook/meta` | public | Meta webhook |
| 115 | PATCH | `/api/access/users/:userId/pages` | `/api/client/access/users/:userId/pages` | Bearer JWT |  |
| 116 | PATCH | `/api/attendance/leave-requests/:requestId/review` | `/api/client/attendance/leave-requests/:requestId/review` | Bearer JWT |  |
| 117 | PATCH | `/api/attendance/policy` | `/api/client/attendance/policy` | Bearer JWT |  |
| 118 | PATCH | `/api/attendance/users/:userId/:date/breaks` | `/api/client/attendance/users/:userId/:date/breaks` | Bearer JWT |  |
| 119 | PATCH | `/api/attendance/users/:userId/:date/status` | `/api/client/attendance/users/:userId/:date/status` | Bearer JWT |  |
| 120 | PATCH | `/api/attendance/violations/:violationId` | `/api/client/attendance/violations/:violationId` | Bearer JWT |  |
| 121 | PATCH | `/api/chat/messages/:messageId/delete` | `/api/client/chat/messages/:messageId/delete` | Bearer JWT |  |
| 122 | PATCH | `/api/chat/messages/:messageId/delivered` | `/api/client/chat/messages/:messageId/delivered` | Bearer JWT |  |
| 123 | PATCH | `/api/chat/messages/:messageId/seen` | `/api/client/chat/messages/:messageId/seen` | Bearer JWT |  |
| 124 | PATCH | `/api/chat/rooms/:roomId/clear` | `/api/client/chat/rooms/:roomId/clear` | Bearer JWT |  |
| 125 | PATCH | `/api/chat/rooms/:roomId/read` | `/api/client/chat/rooms/:roomId/read` | Bearer JWT |  |
| 126 | PATCH | `/api/coworking/bookings/:bookingId` | `/api/client/coworking/bookings/:bookingId` | Bearer JWT |  |
| 127 | PATCH | `/api/coworking/cabins/:cabinId` | `/api/client/coworking/cabins/:cabinId` | Bearer JWT |  |
| 128 | PATCH | `/api/coworking/clients/:clientId` | `/api/client/coworking/clients/:clientId` | Bearer JWT |  |
| 129 | PATCH | `/api/coworking/clients/:clientId/portal-users/:portalUserId/active` | `/api/client/coworking/clients/:clientId/portal-users/:portalUserId/active` | Bearer JWT |  |
| 130 | PATCH | `/api/coworking/contracts/:contractId` | `/api/client/coworking/contracts/:contractId` | Bearer JWT |  |
| 131 | PATCH | `/api/coworking/expenses/:expenseId` | `/api/client/coworking/expenses/:expenseId` | Bearer JWT |  |
| 132 | PATCH | `/api/coworking/floors/:floorId` | `/api/client/coworking/floors/:floorId` | Bearer JWT |  |
| 133 | PATCH | `/api/coworking/invoices/:invoiceId` | `/api/client/coworking/invoices/:invoiceId` | Bearer JWT |  |
| 134 | PATCH | `/api/coworking/properties/:propertyId` | `/api/client/coworking/properties/:propertyId` | Bearer JWT |  |
| 135 | PATCH | `/api/coworking/roles/:role` | `/api/client/coworking/roles/:role` | Bearer JWT |  |
| 136 | PATCH | `/api/coworking/users/:userId/role` | `/api/client/coworking/users/:userId/role` | Bearer JWT |  |
| 137 | PATCH | `/api/inventory-request/:id/approve` | `/api/client/inventory-request/:id/approve` | Bearer JWT |  |
| 138 | PATCH | `/api/inventory-request/:id/pre-approve` | `/api/client/inventory-request/:id/pre-approve` | Bearer JWT |  |
| 139 | PATCH | `/api/inventory-request/:id/reject` | `/api/client/inventory-request/:id/reject` | Bearer JWT |  |
| 140 | PATCH | `/api/inventory/:id` | `/api/client/inventory/:id` | Bearer JWT |  |
| 141 | PATCH | `/api/leads/:leadId` | `/api/client/leads/:leadId` | Bearer JWT |  |
| 142 | PATCH | `/api/leads/:leadId/assign` | `/api/client/leads/:leadId/assign` | Bearer JWT |  |
| 143 | PATCH | `/api/leads/:leadId/properties` | `/api/client/leads/:leadId/properties` | Bearer JWT |  |
| 144 | PATCH | `/api/leads/:leadId/properties/:inventoryId/select` | `/api/client/leads/:leadId/properties/:inventoryId/select` | Bearer JWT |  |
| 145 | PATCH | `/api/leads/:leadId/status` | `/api/client/leads/:leadId/status` | Bearer JWT |  |
| 146 | PATCH | `/api/leads/status-requests/:requestId/approve` | `/api/client/leads/status-requests/:requestId/approve` | Bearer JWT |  |
| 147 | PATCH | `/api/leads/status-requests/:requestId/reject` | `/api/client/leads/status-requests/:requestId/reject` | Bearer JWT |  |
| 148 | PATCH | `/api/projects/:id` | `/api/client/projects/:id` | Bearer JWT |  |
| 149 | PATCH | `/api/roles/:roleId` | `/api/client/roles/:roleId` | Bearer JWT |  |
| 150 | PATCH | `/api/tasks/:taskId` | `/api/client/tasks/:taskId` | Bearer JWT |  |
| 151 | PATCH | `/api/users/:userId` | `/api/client/users/:userId` | Bearer JWT |  |
| 152 | PATCH | `/api/users/:userId/channel-partner/inventory-access` | `/api/client/users/:userId/channel-partner/inventory-access` | Bearer JWT |  |
| 153 | PATCH | `/api/users/:userId/designation` | `/api/client/users/:userId/designation` | Bearer JWT |  |
| 154 | PATCH | `/api/users/admin/:userId` | `/api/client/users/admin/:userId` | Bearer JWT |  |
| 155 | PATCH | `/api/users/delete-requests/:requestId/review` | `/api/client/users/delete-requests/:requestId/review` | Bearer JWT |  |
| 156 | PATCH | `/api/users/location` | `/api/client/users/location` | Bearer JWT |  |
| 157 | PATCH | `/api/users/profile` | `/api/client/users/profile` | Bearer JWT |  |
| 158 | POST | `/api/assistant/ask` | — | Bearer JWT |  |
| 159 | POST | `/api/attendance/break/end` | `/api/client/attendance/break/end` | Bearer JWT |  |
| 160 | POST | `/api/attendance/break/start` | `/api/client/attendance/break/start` | Bearer JWT |  |
| 161 | POST | `/api/attendance/check-in` | `/api/client/attendance/check-in` | Bearer JWT |  |
| 162 | POST | `/api/attendance/check-out` | `/api/client/attendance/check-out` | Bearer JWT |  |
| 163 | POST | `/api/attendance/leave-requests` | `/api/client/attendance/leave-requests` | Bearer JWT |  |
| 164 | POST | `/api/attendance/users/:userId/break` | `/api/client/attendance/users/:userId/break` | Bearer JWT |  |
| 165 | POST | `/api/auth/login` | `/api/client/auth/login` | public |  |
| 166 | POST | `/api/auth/logout` | `/api/client/auth/logout` | Bearer JWT |  |
| 167 | POST | `/api/auth/refresh` | `/api/client/auth/refresh` | public |  |
| 168 | POST | `/api/chat/broadcasts` | `/api/client/chat/broadcasts` | Bearer JWT |  |
| 169 | POST | `/api/chat/messages` | `/api/client/chat/messages` | Bearer JWT |  |
| 170 | POST | `/api/chat/rooms/:roomId/messages` | `/api/client/chat/rooms/:roomId/messages` | Bearer JWT |  |
| 171 | POST | `/api/chat/rooms/direct` | `/api/client/chat/rooms/direct` | Bearer JWT |  |
| 172 | POST | `/api/chat/rooms/group` | `/api/client/chat/rooms/group` | Bearer JWT |  |
| 173 | POST | `/api/chat/rooms/lead` | `/api/client/chat/rooms/lead` | Bearer JWT |  |
| 174 | POST | `/api/contacts` | `/api/client/contacts` | Bearer JWT |  |
| 175 | POST | `/api/contacts/bulk` | `/api/client/contacts/bulk` | Bearer JWT |  |
| 176 | POST | `/api/coworking/bookings` | `/api/client/coworking/bookings` | Bearer JWT |  |
| 177 | POST | `/api/coworking/bookings/:bookingId/activate` | `/api/client/coworking/bookings/:bookingId/activate` | Bearer JWT |  |
| 178 | POST | `/api/coworking/bookings/:bookingId/cancel` | `/api/client/coworking/bookings/:bookingId/cancel` | Bearer JWT |  |
| 179 | POST | `/api/coworking/bookings/:bookingId/complete` | `/api/client/coworking/bookings/:bookingId/complete` | Bearer JWT |  |
| 180 | POST | `/api/coworking/bookings/:bookingId/confirm` | `/api/client/coworking/bookings/:bookingId/confirm` | Bearer JWT |  |
| 181 | POST | `/api/coworking/bookings/:bookingId/extend` | `/api/client/coworking/bookings/:bookingId/extend` | Bearer JWT |  |
| 182 | POST | `/api/coworking/bookings/:bookingId/no-show` | `/api/client/coworking/bookings/:bookingId/no-show` | Bearer JWT |  |
| 183 | POST | `/api/coworking/cabins` | `/api/client/coworking/cabins` | Bearer JWT |  |
| 184 | POST | `/api/coworking/cabins/:cabinId/block` | `/api/client/coworking/cabins/:cabinId/block` | Bearer JWT |  |
| 185 | POST | `/api/coworking/cabins/:cabinId/maintenance` | `/api/client/coworking/cabins/:cabinId/maintenance` | Bearer JWT |  |
| 186 | POST | `/api/coworking/cabins/:cabinId/maintenance/clear` | `/api/client/coworking/cabins/:cabinId/maintenance/clear` | Bearer JWT |  |
| 187 | POST | `/api/coworking/cabins/:cabinId/seats/:seatCode/assign` | `/api/client/coworking/cabins/:cabinId/seats/:seatCode/assign` | Bearer JWT |  |
| 188 | POST | `/api/coworking/cabins/:cabinId/seats/:seatCode/block` | `/api/client/coworking/cabins/:cabinId/seats/:seatCode/block` | Bearer JWT |  |
| 189 | POST | `/api/coworking/cabins/:cabinId/seats/:seatCode/maintenance` | `/api/client/coworking/cabins/:cabinId/seats/:seatCode/maintenance` | Bearer JWT |  |
| 190 | POST | `/api/coworking/cabins/:cabinId/seats/:seatCode/maintenance/clear` | `/api/client/coworking/cabins/:cabinId/seats/:seatCode/maintenance/clear` | Bearer JWT |  |
| 191 | POST | `/api/coworking/cabins/:cabinId/seats/:seatCode/release` | `/api/client/coworking/cabins/:cabinId/seats/:seatCode/release` | Bearer JWT |  |
| 192 | POST | `/api/coworking/cabins/:cabinId/seats/:seatCode/unblock` | `/api/client/coworking/cabins/:cabinId/seats/:seatCode/unblock` | Bearer JWT |  |
| 193 | POST | `/api/coworking/cabins/:cabinId/unblock` | `/api/client/coworking/cabins/:cabinId/unblock` | Bearer JWT |  |
| 194 | POST | `/api/coworking/clients` | `/api/client/coworking/clients` | Bearer JWT |  |
| 195 | POST | `/api/coworking/clients/:clientId/contacts` | `/api/client/coworking/clients/:clientId/contacts` | Bearer JWT |  |
| 196 | POST | `/api/coworking/clients/:clientId/documents` | `/api/client/coworking/clients/:clientId/documents` | Bearer JWT |  |
| 197 | POST | `/api/coworking/clients/:clientId/portal-users` | `/api/client/coworking/clients/:clientId/portal-users` | Bearer JWT |  |
| 198 | POST | `/api/coworking/clients/:clientId/portal-users/:portalUserId/reset-password` | `/api/client/coworking/clients/:clientId/portal-users/:portalUserId/reset-password` | Bearer JWT |  |
| 199 | POST | `/api/coworking/contracts` | `/api/client/coworking/contracts` | Bearer JWT |  |
| 200 | POST | `/api/coworking/contracts/:contractId/activate` | `/api/client/coworking/contracts/:contractId/activate` | Bearer JWT |  |
| 201 | POST | `/api/coworking/contracts/:contractId/documents` | `/api/client/coworking/contracts/:contractId/documents` | Bearer JWT |  |
| 202 | POST | `/api/coworking/contracts/:contractId/renew` | `/api/client/coworking/contracts/:contractId/renew` | Bearer JWT |  |
| 203 | POST | `/api/coworking/contracts/:contractId/terminate` | `/api/client/coworking/contracts/:contractId/terminate` | Bearer JWT |  |
| 204 | POST | `/api/coworking/expenses` | `/api/client/coworking/expenses` | Bearer JWT |  |
| 205 | POST | `/api/coworking/expenses/:expenseId/approve` | `/api/client/coworking/expenses/:expenseId/approve` | Bearer JWT |  |
| 206 | POST | `/api/coworking/expenses/:expenseId/mark-paid` | `/api/client/coworking/expenses/:expenseId/mark-paid` | Bearer JWT |  |
| 207 | POST | `/api/coworking/expenses/:expenseId/receipts` | `/api/client/coworking/expenses/:expenseId/receipts` | Bearer JWT |  |
| 208 | POST | `/api/coworking/expenses/:expenseId/reject` | `/api/client/coworking/expenses/:expenseId/reject` | Bearer JWT |  |
| 209 | POST | `/api/coworking/floors` | `/api/client/coworking/floors` | Bearer JWT |  |
| 210 | POST | `/api/coworking/invoices` | `/api/client/coworking/invoices` | Bearer JWT |  |
| 211 | POST | `/api/coworking/invoices/:invoiceId/cancel` | `/api/client/coworking/invoices/:invoiceId/cancel` | Bearer JWT |  |
| 212 | POST | `/api/coworking/invoices/generate-for-contract` | `/api/client/coworking/invoices/generate-for-contract` | Bearer JWT |  |
| 213 | POST | `/api/coworking/payments` | `/api/client/coworking/payments` | Bearer JWT |  |
| 214 | POST | `/api/coworking/payments/:paymentId/refund` | `/api/client/coworking/payments/:paymentId/refund` | Bearer JWT |  |
| 215 | POST | `/api/coworking/properties` | `/api/client/coworking/properties` | Bearer JWT |  |
| 216 | POST | `/api/inventory` | `/api/client/inventory` | Bearer JWT |  |
| 217 | POST | `/api/inventory-request` | `/api/client/inventory-request` | Bearer JWT |  |
| 218 | POST | `/api/inventory-request/create` | `/api/client/inventory-request/create` | Bearer JWT |  |
| 219 | POST | `/api/inventory-request/delete/:inventoryId` | `/api/client/inventory-request/delete/:inventoryId` | Bearer JWT |  |
| 220 | POST | `/api/inventory-request/update/:inventoryId` | `/api/client/inventory-request/update/:inventoryId` | Bearer JWT |  |
| 221 | POST | `/api/inventory/:id/share` | `/api/client/inventory/:id/share` | Bearer JWT |  |
| 222 | POST | `/api/inventory/bulk` | `/api/client/inventory/bulk` | Bearer JWT |  |
| 223 | POST | `/api/leads` | `/api/client/leads` | Bearer JWT |  |
| 224 | POST | `/api/leads/:leadId/diary` | `/api/client/leads/:leadId/diary` | Bearer JWT |  |
| 225 | POST | `/api/leads/:leadId/status-request` | `/api/client/leads/:leadId/status-request` | Bearer JWT |  |
| 226 | POST | `/api/leads/bulk` | `/api/client/leads/bulk` | Bearer JWT |  |
| 227 | POST | `/api/portal/auth/login` | — | public | client-portal token scope |
| 228 | POST | `/api/portal/auth/logout` | — | Bearer JWT | client-portal token scope |
| 229 | POST | `/api/portal/auth/refresh` | — | public | client-portal token scope |
| 230 | POST | `/api/projects` | `/api/client/projects` | Bearer JWT |  |
| 231 | POST | `/api/push/reply` | `/api/client/push/reply` | public |  |
| 232 | POST | `/api/push/subscribe` | `/api/client/push/subscribe` | Bearer JWT |  |
| 233 | POST | `/api/push/test` | `/api/client/push/test` | Bearer JWT |  |
| 234 | POST | `/api/push/unsubscribe` | `/api/client/push/unsubscribe` | Bearer JWT |  |
| 235 | POST | `/api/roles` | `/api/client/roles` | Bearer JWT |  |
| 236 | POST | `/api/targets/assign` | `/api/client/targets/assign` | Bearer JWT |  |
| 237 | POST | `/api/tasks` | `/api/client/tasks` | Bearer JWT |  |
| 238 | POST | `/api/uploads` | `/api/client/uploads` | Bearer JWT |  |
| 239 | POST | `/api/users/:userId/delete-request` | `/api/client/users/:userId/delete-request` | Bearer JWT |  |
| 240 | POST | `/api/users/create` | `/api/client/users/create` | Bearer JWT |  |
| 241 | POST | `/api/users/rebalance-executives` | `/api/client/users/rebalance-executives` | Bearer JWT |  |
| 242 | POST | `/api/webhook/meta` | `/api/client/webhook/meta` | public | Meta webhook |
| 243 | PUT | `/api/coworking/board` | `/api/client/coworking/board` | Bearer JWT |  |
