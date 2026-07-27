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

export const tenant = {
  _id: "company-a",
  name: "Company A",
  subdomain: "company-a",
  status: "ACTIVE",
};

export const roleUsers = Object.fromEntries(
  ROLES.map((role) => [
    role,
    {
      _id: `e2e-${role.toLowerCase()}`,
      name: `${role.replace(/_/g, " ")} User`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      companyId: role === "SUPER_ADMIN" ? null : tenant._id,
      canViewInventory: role === "CHANNEL_PARTNER",
    },
  ]),
);

export const records = {
  leads: [
    { _id: "lead-1", name: "Asha Lead", phone: "9876543210", status: "NEW", projectInterested: "Samvid Tower" },
  ],
  inventory: [
    { _id: "inv-1", projectName: "Samvid Tower", towerName: "A", unitNumber: "101", status: "Available", price: 1200000 },
  ],
  users: Object.values(roleUsers),
  tasks: [
    { _id: "task-1", title: "Call Asha", status: "OPEN", priority: "HIGH", tags: ["follow-up"] },
  ],
  companies: [tenant],
  leaderboard: [{ userId: "e2e-executive", name: "Executive User", score: 12 }],
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
  SUPER_ADMIN: ["/leads"],
  ADMIN: ["/super-admin"],
  MANAGER: ["/super-admin"],
  INSIDE_EXECUTIVE: ["/admin/users", "/reports"],
  EXECUTIVE: ["/admin/users", "/reports"],
  FIELD_EXECUTIVE: ["/admin/users", "/reports"],
  PRODUCTION_EXECUTIVE: ["/leads", "/finance"],
  CHANNEL_PARTNER: ["/chat", "/tasks"],
};
