export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "INSIDE_EXECUTIVE",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "PRODUCTION_EXECUTIVE",
  "CHANNEL_PARTNER",
];

export const roleUsers = Object.fromEntries(
  ROLES.map((role) => [
    role,
    {
      _id: `user-${role.toLowerCase()}`,
      name: `${role.replace(/_/g, " ")} User`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      companyId: role === "SUPER_ADMIN" ? null : "company-a",
      canViewInventory: role === "CHANNEL_PARTNER",
    },
  ]),
);

export const tenant = {
  _id: "company-a",
  name: "Company A",
  subdomain: "company-a",
  status: "ACTIVE",
};

export const pagePayloads = {
  leads: [{ _id: "lead-1", name: "Asha Lead", phone: "9876543210", status: "NEW" }],
  inventory: [{ _id: "inv-1", projectName: "Samvid Tower", towerName: "A", unitNumber: "101", status: "Available" }],
  users: Object.values(roleUsers),
  tasks: [{ _id: "task-1", title: "Call lead", status: "OPEN", priority: "HIGH" }],
  attendance: { status: "PRESENT", workedMinutes: 480 },
};

export const routeMatrix = {
  SUPER_ADMIN: ["/dashboard", "/super-admin", "/admin/notifications", "/admin/users", "/admin/console", "/admin/meta-ads", "/settings", "/profile"],
  ADMIN: ["/dashboard", "/leads", "/inventory", "/finance", "/map", "/reports", "/leaderboard", "/calendar", "/tasks", "/attendance", "/admin/notifications", "/admin/users", "/admin/console", "/admin/meta-ads", "/settings", "/targets", "/chat", "/profile"],
  MANAGER: ["/dashboard", "/leads", "/inventory", "/finance", "/map", "/reports", "/leaderboard", "/calendar", "/tasks", "/attendance", "/admin/notifications", "/admin/users", "/admin/console", "/admin/meta-ads", "/settings", "/targets", "/chat", "/profile"],
  INSIDE_EXECUTIVE: ["/dashboard", "/leads", "/my-leads", "/inventory", "/finance", "/leaderboard", "/calendar", "/tasks", "/attendance", "/targets", "/chat", "/profile"],
  EXECUTIVE: ["/dashboard", "/leads", "/my-leads", "/inventory", "/finance", "/leaderboard", "/calendar", "/tasks", "/attendance", "/targets", "/chat", "/profile"],
  FIELD_EXECUTIVE: ["/dashboard", "/leads", "/my-leads", "/inventory", "/finance", "/map", "/leaderboard", "/calendar", "/tasks", "/attendance", "/targets", "/chat", "/profile"],
  PRODUCTION_EXECUTIVE: ["/dashboard", "/tasks", "/attendance", "/targets", "/chat", "/profile"],
  CHANNEL_PARTNER: ["/dashboard", "/leads", "/inventory", "/finance", "/leaderboard", "/attendance", "/profile"],
};

export const forbiddenRouteSamples = {
  SUPER_ADMIN: ["/leads", "/inventory"],
  ADMIN: ["/super-admin"],
  MANAGER: ["/super-admin"],
  INSIDE_EXECUTIVE: ["/admin/users", "/reports", "/map"],
  EXECUTIVE: ["/admin/users", "/reports"],
  FIELD_EXECUTIVE: ["/admin/users", "/reports"],
  PRODUCTION_EXECUTIVE: ["/leads", "/finance", "/admin/users"],
  CHANNEL_PARTNER: ["/chat", "/tasks", "/admin/users"],
};
