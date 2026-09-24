# CRM requirements fixes

Source: `CRM_Development_Issues_and_Improvement_Requirements.pdf` (three pages).

## Implemented

| Requirement | Result |
| --- | --- |
| Task receiver workflow | Status is visible and editable on each list row. Details offer In Progress / Ongoing, Mark Completed, a read-only checklist for receivers, and Back to task list. Failed status updates do not falsely change the displayed status. |
| Task assigner navigation | My Tasks, Assigned by Me, All Accessible Tasks, and management Team Tasks navigation. Creating a task returns to Assigned by Me with old filters cleared. Personal quick-add assigns the task to the current user. |
| Task access and tracking | Populated assignee/creator IDs are handled correctly. Status-only updates no longer generate reassignment notices. Filters and statistics respect the selected ownership scope. Unrelated lookup failures do not discard successfully loaded tasks. |
| Residential lead entry | Every new lead form starts from the current user's property type. Saving a lead no longer resets the next form to commercial defaults. Existing category selectors update property options immediately. |
| Admin/manager break corrections | Attendance → Team attendance → Manage breaks supports adding missed breaks and editing recorded breaks, including ongoing sessions. Managers are limited to their attendance hierarchy and admins to their company. A reason is required. |
| Break audit and totals | Each correction stores actor ID/name/role, timestamp, reason, and previous/new session values. The dialog displays correction history. Worked time is recalculated; invalid/overlapping/future breaks and stale/concurrent changes are rejected. |
| Inventory team owner | Legacy managers without an explicit property type consistently default to commercial. Missing, inactive, non-manager, and property-type mismatch cases now have distinct corrective messages. Company and manager validation remain enforced. Bulk validation caches include the property type. |
| Notifications | Shared notices auto-dismiss after 2.5 seconds for success and 4 seconds for routine errors. Notices have a dismiss button. Inventory validation/mapping errors persist until acknowledged; server/network errors remain temporary. |

## Verification

- Backend regression checks: `cd backend; node --test test/crm-requirements.test.cjs` — 67 passed. These execute real controller/service logic using isolated repository doubles and validate audit records against the Mongoose schema. No database is connected or changed.
- Frontend production build: `cd frontend; npm run build`.
- Targeted ESLint covers the changed task, lead, inventory, attendance, notification, and service files.
- Backend JavaScript syntax checks cover changed controllers, routes, models, services, and utilities.
- Browser verification could not run because no browser connection was available. No production deployment or production data repair was performed.

## Runtime acceptance checks

1. Sign in as a residential employee. Create two leads consecutively; both forms must show residential property options immediately. As admin, switch category and verify property options change without refreshing.
2. Assign a task to another employee. Confirm it appears under Assigned by Me. Sign in as the receiver, open it, verify its checklist is read-only, update its status, and complete it; confirm the creator sees the completed status on reloading their list.
3. As a manager, open Team attendance and add/edit a break for a checked-in team member. Verify totals, actor attribution, and correction history. Confirm an employee and a manager outside that hierarchy cannot use the correction endpoint.
4. Try an overlapping break and a stale form; neither must overwrite attendance. Verify the employee can end an ongoing manager-added break through the normal break action.
5. Upload inventory with a valid team mapping. For a genuinely inactive or mismatched manager, follow the displayed admin correction guidance; do not bypass validation or silently reassign the account.
6. Verify success and routine errors disappear on time, and required-action errors remain dismissible.

Task permission update: receivers can change only status, including receivers with management roles. Other fields and deletion are rejected by the API. Task creators retain editing rights.

Task notifications: employee status changes notify company admins; admin assignment/status updates notify the assignee. The actor receives no self-alert. Unchanged status does not emit a new event. Notification provider state resets on account/logout changes, and per-user task event IDs persist to suppress replayed events.

Role Type Both: create/edit users may select Both. Login/refresh preserve it. Both users can select and access commercial/residential leads and inventory within existing company, hierarchy, and role permissions. Both managers/executives participate in matching lead assignment pools. Properties themselves still have one category. Existing users should sign in again after an admin changes their role type.
