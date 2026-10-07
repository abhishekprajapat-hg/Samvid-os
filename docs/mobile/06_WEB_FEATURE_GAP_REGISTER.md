# Web → Mobile Feature Gap Register

**Opened:** 2026-09-25 · web reference: working tree on `mobile-web-parity`

The instruction was to copy every web feature into the app. This register is
the list that instruction turns into. It was built three ways, because each
catches what the others miss:

1. **Endpoint diff.** Every `api.<verb>("/path")` in `frontend/src` against the
   same in `mobile/src`. Web calls 118 distinct endpoints; 12 had no mobile
   caller.
2. **Service-usage diff.** A web service function that some web screen calls,
   whose mobile counterpart no mobile screen calls. This finds features whose
   plumbing was ported but whose button never was.
3. **Handler read-through.** The `handle*` / `on*` functions and toolbar
   actions of every web module, checked against its mobile counterpart. This
   finds client-side features (exports, bulk selection, reminders) that never
   touch a new endpoint.

Legend: ✅ done · 🟡 partial · ❌ missing · ➖ deliberately not ported (reason given)

## P0 — the app is wrong, not just short

| # | Area | Gap | Status |
| --- | --- | --- | :---: |
| 0.1 | Build | `AdminCommandConsoleScreen.tsx` does not typecheck at HEAD - the audit/confirm code landed without its imports from `consoleActions.ts` (26 errors) | ✅ |
| 0.2 | Auth | Sign-out never calls `POST /auth/logout`, so the refresh token stays valid on the server after a phone signs out | ✅ |
| 0.3 | Coworking | Web's board and client directory read **one board document** (`GET/PUT /coworking/board`); mobile reads the relational `/coworking/cabins` API. The two apps can show different cabins and different clients | ✅ |
| 0.4 | Field | Web streams a Field Executive's position (`PATCH /users/location`) while they are signed in; Field Ops' map is drawn from it. Mobile - the device field staff actually carry - never sends it | ✅ |

## P1 — daily-use features

### Chat
| # | Gap | Status |
| --- | --- | :---: |
| 1.1 | Read receipts: mark room read on open, delivered / seen per message, tick states | ✅ |
| 1.2 | Typing indicator (`chat:typing`, both directions) | ✅ |
| 1.3 | Delete a message - for me / for everyone | ✅ |
| 1.4 | Clear a conversation | ✅ |
| 1.5 | Start a direct chat from the contact list (`POST /chat/rooms/direct`) | ✅ |
| 1.6 | Search messages inside a conversation | ✅ |

### Alerts
| # | Gap | Status |
| --- | --- | :---: |
| 1.7 | Follow-up reminders (web `FollowUpReminderToast`: overdue / due / 15 / 30 / 60 min buckets, polled every minute) | ✅ |
| 1.8 | Approve / reject straight from an admin-request alert (web `AdminRequestAlertToast`) | ✅ |
| 1.9 | Notification inbox: read / unread state, mark all read, open the record an alert is about | ✅ |
| 1.10 | Push settings: status, enable / disable on this device, send a test (web `PushNotificationCard`) | ✅ |

### Leads
| # | Gap | Status |
| --- | --- | :---: |
| 1.11 | Multi-select in the pipeline + export selected as CSV | ✅ |
| 1.12 | Bulk upload leads from CSV (and xlsx) - reversed the Phase 4 scope decision on instruction | ✅ |
| 1.13 | Team view: pipeline grouped by assignee (web `PipelineTeam`) | ✅ |
| 1.14 | Broker phone hint on a new lead (`identifyContact`) | ✅ |
| 1.15 | Pick the active related property (`selectLeadRelatedProperty`) | ✅ |

### Calendar
| # | Gap | Status |
| --- | --- | :---: |
| 1.16 | Delete a follow-up | ✅ |
| 1.17 | Tick a task complete from the day card | ✅ |

### Inventory, projects, contacts
| # | Gap | Status |
| --- | --- | :---: |
| 1.18 | Approve / reject inventory requests from the vault's review panel | ✅ |
| 1.19 | Share a property into a chat conversation | ✅ |
| 1.20 | Projects: create, edit, delete (amenities, BHK configuration, images) | ✅ |
| 1.21 | Contacts: create / edit a contact, bulk import from CSV | ✅ |

### Tasks
| # | Gap | Status |
| --- | --- | :---: |
| 1.22 | Assignee picker from `/tasks/assignees` (who *this* user may assign to), not the whole user list | ✅ |
| 1.23 | Quick add | ✅ |
| 1.24 | Subtasks: add, edit, delete, toggle | ✅ |

### Attendance & profile
| # | Gap | Status |
| --- | --- | :---: |
| 1.25 | Break correction (web `BreakCorrectionDialog`) | ✅ |
| 1.26 | Break type when a manager starts a team member's break | ✅ |
| 1.27 | Profile: attendance calendar, leave balance, leave requests, apply for leave | ✅ |
| 1.28 | Profile photo upload / remove | ✅ |

## P2 — admin depth

| # | Gap | Status |
| --- | --- | :---: |
| 2.1 | Admin console: finance, performance ranking, drill-down, search, hot leads, CSV export, saved workflows, threshold subscriptions, date-range parsing, Hindi normalisation, English/Hindi voice input | ✅ |
| 2.2 | User editor: attendance calendar, tasks, leave balance and type breakdown, project stats | ✅ |
| 2.3 | Team manager: edit a custom role; channel-partner inventory access toggle; per-employee page access editor | ✅ |
| 2.4 | Field Ops: quick locate, workload, dispatch and task queues | ✅ |
| 2.5 | Global page search (web's top command bar) | ✅ |

**Closure check (2026-09-25):** mobile TypeScript validation passed, all 220
mobile tests passed, and Expo produced a complete web export (3,182 modules).

## Second pass (2026-09-28)

A fourth method, run after the first three closed: every web button label,
`title` and `aria-label` searched for in the mobile source, each miss read by
hand. Most misses were wording or web-only chrome. These were real:

| # | Area | Gap | Status |
| --- | --- | --- | :---: |
| 3.1 | Chat | Conversation list: unread badge per chat, All / Unread filter, "Mark all read" (web `TeamChatPanels`) | ✅ |
| 3.2 | Tasks | Priority, tag and lead filters (web's filter row; mobile had status and assignee only) | ✅ |
| 3.3 | Leads | Proposal: "Copy" failed on every phone although `expo-clipboard` is installed; "Img Links" and "Share Images" missing | ✅ |
| 3.4 | Inventory | Shared listing page: web's property rows, commercial / residential details, files & media, location, Print / Save PDF, Share - mobile showed title, price and amenities only | ✅ |
| 3.5 | Reports | Web's Intelligence figures - transferred leads, average days to close, cost per lead, executive performance, where leads are lost, source mix - and its CSV export | ✅ |
| 3.6 | Inventory, leads | Address search with coordinates filled from the pick (web: OpenStreetMap by default, Google Places when configured); mobile could only pin the phone's own position | ✅ |
| 3.7 | Leads | **Data loss.** Every status save on the lead screen rebuilt `requirements` without the property subtype, its preferences or the coworking terms, and the server replaces requirements whole - so a save from the phone erased what the desk had entered | ✅ |
| 3.8 | Leads | Requirement editor: property subtype, the subtype's preference fields, coworking cabins and terms (web `LeadDetailsRebuilt` + `CoworkingRequirementFields`) | ✅ |
| 3.9 | Leads | New lead: subtype preferences, coworking terms, preferred localities (with place search when Google is configured) and site coordinates | ✅ |
| 3.10 | Inventory | Property form: web adds and edits with one full form (subtype preferences, dimensions, super built-up, deposit, office number, documents available, owner WhatsApp and ownership, key manager, deal details, video tours, sale details when Sold). Mobile's wizard covers part of it and its edit dialog far less | ✅ |

Where the phone differs from web on these items, and why:

| Item | Web | Phone | Why |
| --- | --- | --- | --- |
| 3.1 | Opening the chat page marks every conversation read on the server | Conversations stay unread until opened or "Mark all read" is tapped | Marking on open sends "seen" receipts for messages nobody has read, and empties the Unread filter the moment it could be used |
| 3.3 | "Share Images" attaches up to eight photos to one share | One share sheet per photo, with Stop between them | The phone's share sheet takes one file; a multi-file share needs a new native module |
| 3.5 | Figures on the Reports page itself | Their own screen, "Pipeline Intelligence", reached from the Reports hub | The hub is drawn to the comps; the figures and the CSV are web's, counted by web's arithmetic |
| 3.6 | Lead localities suggest only with a Google key | Same | Parity: no key, plain typing - OpenStreetMap is used for property addresses only, as on web |
| 3.10 | Add and edit share one dialog | Edit uses the full form; add keeps the comps' wizard, which links to the full form and offers "Add more details" once published | The wizard is the comp; the full form is web's field set |

Checked and not gaps: web's paged inventory fetch (mobile asks for the whole
list, which the server returns unpaged); the Hot Client toggle (mobile sets
`temperature`, which the server keeps in step with `hotClient`); the
leaderboard's window / mode switches (a documented comp redesign with its own
month and role filters); Reports' "+ Branch", "+ Executive", "+ Source" and
"Schedule email" (buttons with no handler on web); "drop a spreadsheet" on the
vault's add tile (a caption; web has no drop handler); `manager/LeadPool.jsx`
(mock data, not routed); the shared page's heart (local state, never saved).

## Deliberately not ported

| Web | Why |
| --- | --- |
| `portal/ClientHome`, `portal/ClientListing` | The client portal is its own app (`client-portal/`), out of scope since the spec's first draft |
| `dev/KitchenSink` | Dev-only route |
| `pushService` service-worker plumbing | Web Push is a browser mechanism; the phone's equivalent is Expo push, already live (Phase 9). The *controls* around it are 1.10 |
| `BackToTopButton`, `useIsMobileViewport`, fullscreen chat toggle | Browser affordances with no phone counterpart |
