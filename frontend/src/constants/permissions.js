// Mirrors backend/src/constants/permission.constants.js. Kept in sync by hand
// (this repo has no shared package between frontend/backend — see CLAUDE.md).
export const PERMISSIONS = [
  "dashboard.view",

  "properties.view",
  "properties.create",
  "properties.update",
  "properties.delete",

  "cabins.view",
  "cabins.create",
  "cabins.update",
  "cabins.delete",
  "cabins.block",

  "seats.view",
  "seats.assign",
  "seats.release",

  "clients.view",
  "clients.create",
  "clients.update",
  "clients.delete",

  "bookings.view",
  "bookings.create",
  "bookings.update",
  "bookings.cancel",

  "contracts.view",
  "contracts.create",
  "contracts.update",
  "contracts.renew",

  "billing.view",
  "billing.create",
  "billing.update",

  "payments.view",
  "payments.create",
  "payments.refund",

  "expenses.view",
  "expenses.create",
  "expenses.update",
  "expenses.delete",
  "expenses.approve",

  "reports.view",
  "reports.export",

  "users.view",
  "users.create",
  "users.update",
  "users.delete",

  "roles.view",
  "roles.manage",


  "audit_logs.view",
];

export const PERMISSION_GROUPS = {
  Dashboard: ["dashboard.view"],
  Properties: ["properties.view", "properties.create", "properties.update", "properties.delete"],
  Cabins: ["cabins.view", "cabins.create", "cabins.update", "cabins.delete", "cabins.block"],
  Seats: ["seats.view", "seats.assign", "seats.release"],
  Clients: ["clients.view", "clients.create", "clients.update", "clients.delete"],
  Bookings: ["bookings.view", "bookings.create", "bookings.update", "bookings.cancel"],
  Contracts: ["contracts.view", "contracts.create", "contracts.update", "contracts.renew"],
  Billing: ["billing.view", "billing.create", "billing.update"],
  Payments: ["payments.view", "payments.create", "payments.refund"],
  Expenses: ["expenses.view", "expenses.create", "expenses.update", "expenses.delete", "expenses.approve"],
  Reports: ["reports.view", "reports.export"],
  Users: ["users.view", "users.create", "users.update", "users.delete"],
  Roles: ["roles.view", "roles.manage"],
  "Audit Logs": ["audit_logs.view"],
};

export const PERMISSION_LABELS = PERMISSIONS.reduce((labels, permission) => {
  const [, action] = permission.split(".");
  labels[permission] = action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return labels;
}, {});

// Page access permission strings, mirroring backend/src/constants/page.constants.js.
// The page catalogue itself is served by GET /api/access/catalog — nothing here
// hardcodes which pages exist, only how a page grant is spelled.
export const toPagePermission = (pageKey, action = "view") =>
  `page.${pageKey}.${action}`;
