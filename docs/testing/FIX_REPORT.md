# FIX REPORT — 2026-09-18

Follow-up to `BUG_REPORT.md`. Every fix below was re-tested against the running
application, not just compiled. Where a defect turned out not to be real, it is retracted here
rather than quietly dropped.

## Result

| | Count |
|---|---|
| Defects reported in the audit | 38 |
| Found later, hands-on (CRM-BUG-039) | 1 |
| **Fixed and verified** | **29** |
| Retracted (audit false positive) | 1 |
| Partially fixed | 5 |
| Deliberately not changed | 4 |

**Verification**: backend suite **220/220** passing (199 pre-existing + **21 new regression tests**),
frontend `npm run lint` clean (0 errors, 0 warnings — was 4 warnings), `npm run build` succeeds,
plus **160 targeted assertions** across six verification suites and a 26-route browser sweep that now
reports **0 console errors and 0 failing API calls** (both were 1 before).

The local database was returned to its exact pre-audit baseline after testing:
leads 1174, leadActivities 2428, users 12, tasks 14.

---

## Fixed and verified

### Security / data exposure

**CRM-BUG-002 — uploaded files served with no authorization.**
Uploads now sit behind `requireFileAccess`, which accepts one of three credentials: a staff bearer
token, an httpOnly `oor_file_access` cookie issued at login (scoped to `/api/uploads`, `SameSite=Lax`,
`Secure` in production), or a per-file `?t=` token. The cookie is what makes `<img src>` work without
touching the ~25 components that render uploads. Upload URLs are now **relative**, which also fixes a
latent bug where the serving host was baked into the stored record. A response interceptor in
`services/api.js` rewrites historical absolute URLs to relative in one place. Public inventory share
links sign each media URL individually, so an anonymous visitor can still see the listing's photos
but the token cannot be replayed against another file.
*Verified*: unauthenticated GET → 401; bearer → 200; cookie → 200; forged cookie → 401; a token minted
for one file → 401 on another; a file token rejected by `/api/auth/me`; images still render in a real
browser (3 upload requests, all 200, no broken `<img>`).

**CRM-BUG-003 — `application/octet-stream` defeated the upload allowlist.**
Removed from the allowlist, along with `image/svg+xml`. The file extension must now also be
recognised, so `invoice.pdf.html` is refused on its real extension. Anything still reaching disk as
`.html`/`.svg`/`.xml` is served as `application/octet-stream` with `Content-Disposition: attachment`.
*Verified*: html-as-octet-stream, svg-with-script, `.exe`, double-extension and a truthful MIME with a
dangerous extension are all refused; real JPEG and PDF still upload.

**CRM-BUG-005 / 006 / 008 — read-side leaks.**
`crmContact.routes.js`, `chat.routes.js` and `lead.routes.js` now carry explicit
`checkRoleOrPageAccess` gates, matching the pattern `inventory.routes.js` already used. Company-wide
lead analytics and the status-request queue are additionally restricted to internal staff, so the
external `CHANNEL_PARTNER` role cannot read them.
*Verified*: owner/broker directory, internal chat directory and lead analytics all 403 for the roles
that should not see them, while every role that legitimately uses them still gets 200.

**CRM-BUG-007 — `DELETE` authorised by an `edit` grant.**
`DELETE` now maps to `["delete"]` only. `POST` no longer accepts `delete`. The contact delete route
additionally requires ADMIN/MANAGER and writes an audit-log entry, since it is an unrecoverable hard
delete.
*Verified*: with a `[view, edit]` grant, `DELETE` on contacts and tasks returns 403; with an explicit
`delete` grant it reaches the handler; `PATCH` and `GET` are unaffected.

**CRM-BUG-013 — NoSQL operators reached the Mongo query on login.**
Credentials are type-checked before the query. Authentication no longer depends on bcrypt throwing.

**CRM-BUG-018 — CORS accepted any LAN origin with credentials.**
The `192.168.x.x` allowance now applies only outside production, in `app.js` and `server.js`.

**CRM-BUG-027 — deactivated accounts were enumerable.**
The password is verified before the `isActive` check, so a deactivated account is indistinguishable
from any other failure unless you already hold the password.

**CRM-BUG-034 — email uniqueness was global, not per tenant.**
The duplicate check is scoped to `companyId`.

**CRM-BUG-039 — an Admin locked themselves out after 8 ordinary sign-ins.**
Found in a hands-on sign-in session, not by the automated sweep. `/login` sent `portal:"GENERAL"`,
which the API refuses for an Admin, and the page retried as `"ADMIN"` — so every Admin sign-in cost a
403 first, and because `authLimiter` only skips responses under 400, eight ordinary sign-ins from one
IP exhausted the 8-per-15-minutes budget and locked the Admin out with no wrong password anywhere.
The shared page now sends no portal at all; `/login/admin` still sends `"ADMIN"` and still refuses
non-admins.
*Verified*: 8 consecutive real-form sign-ins, all reaching the app, one auth request each, zero 403s,
zero console errors.

### Correctness

**CRM-BUG-001 — lead list returned the entire table.**
`parsePagination` always paginates; the "no page/limit means no limit" branch is gone. Array-valued
and `limit[]`-style parameters are normalised instead of slipping through. `getAllLeads()` in the
frontend walks pages (200 per request, capped) so the seven screens written against the old behaviour
stay correct.
*Verified*: every shape that previously dumped the table is now bounded — a bare `GET /api/leads` went
from **1,195 rows / 2,721 KB** to **50 rows / 124 KB**; explicit paging works and pages differ.

**CRM-BUG-009 / 024 — validation errors surfaced as 500.**
A new `utils/mongooseError.js` maps `ValidationError` → 400 with the field name, `CastError` → 400,
duplicate key → 409. Wired into user, lead and task creation and into the global error handler.
*Verified*: "Name is required", "Password must be at least 6 characters", "Status has an unsupported
value", "Due date is not a valid date" — all 400.

**CRM-BUG-011 / 023 — lead and user intake accepted junk.**
Both now trim before the required check (`"   "` is no longer a valid name), validate email format and
phone shape (7–15 digits), and bound name length.

**CRM-BUG-012 — `/leaderboard` was broken for ADMIN.**
The role filter no longer seeds from the viewer's own role, so the first request omits `role` and the
API picks a rankable default.
*Verified in a browser*: no "Invalid role filter", and the role selector renders.

**CRM-BUG-014 — invalid credentials returned 400.** Now 401, with unknown-email and wrong-password
responses identical.

**CRM-BUG-015 — `sortBy` was ignored.** Implemented against an allowlist of sortable columns, with
`_id` as a tiebreak so paging stays stable; unknown fields are refused with 400.

**CRM-BUG-037 — invalid filters were silently dropped.** Unknown status values, unparseable dates and
inverted date ranges now return 400 instead of quietly returning more rows than intended.

**CRM-BUG-028 — duplicate email returned 400.** Now 409 Conflict; duplicate phone is also refused.

### Performance

**CRM-BUG-010 — full-size images served unresized.**
`sharp` added; uploads are downscaled per category (avatars 512 px, inventory 2000 px, chat 1600 px),
EXIF-rotated and re-encoded. Best-effort: a failure leaves the original rather than breaking the
upload. Non-images pass through byte-identical, small images are not upscaled, and the re-encode is
discarded if it would make the file bigger.
*Verified*: a 4000×3000 upload becomes 512×384 for an avatar; a PDF is unchanged.

### UX / accessibility

**CRM-BUG-022 — no 404 page.** Unknown routes rendered the shell around an empty content area; there
is now a proper NotFound with a route back to the dashboard. *Verified in a browser.*

**CRM-BUG-026 — no empty state on lead search.** The table's fallback said *"Nothing needs action —
every live lead here has a follow-up in the future"* for **every** empty result, so a search that
matched nothing gave a misleading answer. It is now search-aware and offers "Clear all filters".
*Verified in a browser*: "No leads match these filters".

**CRM-BUG-021 (part) — accessibility.** Login inputs and the profile photo input now have
programmatic labels.

### Hygiene

**CRM-BUG-032** — `npm test` and `npm run test:watch` added; `node --test test/` never worked, the
glob form does. **CRM-BUG-033** — all 4 ESLint warnings resolved, each on its merits rather than by
blanket-adding dependencies (two were deliberate mount-only effects and are now documented as such).
**CRM-BUG-035** — `docs/TESTING_FLOW.md`: corrupted line repaired, the non-existent
`seed:super-admin` reference removed, and a step added to run the automated suite.
**CRM-BUG-036** — the deprecated `{ new: true }` option replaced with `returnDocument: "after"` in
**24 files**. **CRM-BUG-038** — `/_kitchen-sink` confirmed already gated behind `import.meta.env.DEV`;
no change needed.

---

## Retracted — not a real defect

**CRM-BUG-016 — "duplicate API calls".** Re-measured with query strings included. There are **no**
duplicate requests: `/targets/my` ×6 is six different months for a trend chart, and `/leads` ×2 is two
different queries (a field-limited one for the follow-up reminder, and the table's own). The original
finding was an artifact of grouping requests by path after stripping the query string. The in-flight
dedupe and 8-second GET cache in `services/api.js` are working correctly.

---

## Partially fixed

**CRM-BUG-004 — role page defaults not enforced.** The capability is implemented and the specific
leaks it caused are already closed by the targeted gates above. `PAGE_ACCESS_ENFORCEMENT` accepts
`on` / `log` / `off` and **defaults to `log`**: requests are allowed but every would-be denial is
logged, so you can see the real impact before switching it on. An explicit per-employee override is
always enforced regardless of the mode.

I measured what flipping it to `on` does, across every GET endpoint for all 9 roles:
**14 requests newly denied, 0 newly allowed.** The 14 are exactly the intended closures
(`CHANNEL_PARTNER` and `COWORKING_ADMIN` losing tasks/targets/attendance they never had in their
defaults). Getting to 0 newly-allowed required a second fix: `checkRoleOrPageAccess` and
`checkRoleOrPageAction` now widen only on an **explicit** override, because enforcing defaults would
otherwise have handed every executive the ADMIN/MANAGER-only operations those helpers guard.

**Before switching to `on`, decide one product question**: `COWORKING_ADMIN` defaults contain no
`attendance` page, so that role will lose check-in/leave. If a coworking admin is a normal employee
who books time, the right fix is to add `attendance` to `COWORKING_ADMIN_PAGES` rather than leave
enforcement off.

**CRM-BUG-019 / 020 — modal Escape and focus.** The shared `components/ui/Modal` now closes on
Escape, moves focus in, traps Tab and restores focus on close, and a reusable
`hooks/useDialogDismiss.js` was added for the hand-rolled dialogs. It is wired into both Team Manager
panels — **`/admin/users` now closes on Escape with focus inside, verified in a browser**. The
bespoke bottom-sheet dialogs in `TaskManager.jsx` and `AssetVault.jsx` still do not close on Escape;
they each need the hook applied at their own call sites. **Not yet done.**

**CRM-BUG-025 — duplicate `propertyId`.** The cause is now understood and is narrower than reported:
`propertyId` is already server-generated from an atomic counter, so **new** collisions are impossible.
The schema already declares a unique partial index — it has silently never been built, because
MongoDB refuses to build a unique index over the three existing `"Prop-01"` records. I did **not**
rename them: those IDs may appear on signed contracts or shared listings, so which record keeps the
original is a business decision. Run `npm run check:property-ids` for the report (and `--apply` to
renumber), then create the index with the command the script prints.

---

## Deliberately not changed

**CRM-BUG-017 — access token valid after logout.** Logout correctly revokes the refresh token; the
access token remains valid for its 15-minute TTL. Fixing this properly means a `jti` denylist or a
`tokenVersion` check on every request. That is a design decision with a real cost, not a bug fix.

**CRM-BUG-029 — tokens in `localStorage`.** Moving the refresh token to an httpOnly cookie is the
right direction, but it changes the auth flow for the web app, the mobile app and the client portal
together. Worth doing deliberately. CSP currently mitigates the injected-script route.

**CRM-BUG-030 / 031 — tap targets under 44 px, sticky header intercepting top rows.** Both are real
but are layout changes across shared components with visual consequences that want a designer's eye.

**CRM-BUG-021 (remainder) — colour contrast and 27 `nested-interactive` violations** on `/tasks` and
`/admin/users`. Contrast is a design-token decision; `nested-interactive` means restructuring rows
that place buttons inside clickable rows. `/leads` already scores 0 violations and is the model.

---

## New regression tests

`backend/test/audit-regressions.test.cjs` — 21 tests, no database required, each naming the defect it
pins:

- pagination is always applied, caps oversized limits, survives array-valued parameters, falls back on junk
- validation/cast/duplicate errors map to 400/409 and a genuine fault stays a 500
- an uploaded file needs a credential; the cookie works; a forged cookie does not; a per-file token cannot be replayed; a file token is not a session; our URLs are rewritten and foreign CDN links are not
- the upload filter refuses octet-stream wildcards, SVG, `.exe` and double extensions
- `DELETE` is not satisfied by an `edit` grant, and is allowed once `delete` is granted
- a module gate widens only on an explicit page grant, never on role defaults

Still missing, and worth adding next: the RBAC read-side matrix as a test (it would have caught four
of the ten HIGH defects), and any frontend component/E2E tests — there are still none.
