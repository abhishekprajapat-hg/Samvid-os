// Canonical employee page catalogue. Page selections project into
// page.<key>.<action> permissions for navigation and API access checks.
// Always-accessible pages remain available for every signed-in account.

const PAGE_ACTIONS = Object.freeze({
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  EXPORT: "export",
  APPROVE: "approve",
  ASSIGN: "assign",
  FOLLOW_UP: "follow_up",
});

const CRM_PAGES = Object.freeze([
  {
    key: "dashboard",
    label: "Dashboard",
    group: "Workspace",
    path: "/dashboard",
    actions: [PAGE_ACTIONS.VIEW],
    alwaysAccessible: true,
  },
  {
    key: "leads",
    label: "Leads",
    group: "Sales",
    path: "/leads",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.DELETE,
      PAGE_ACTIONS.ASSIGN,
      PAGE_ACTIONS.FOLLOW_UP,
      PAGE_ACTIONS.EXPORT,
    ],
  },
  {
    key: "my_leads",
    label: "My Leads",
    group: "Sales",
    path: "/my-leads",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.FOLLOW_UP,
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    group: "Sales",
    path: "/inventory",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.DELETE,
      PAGE_ACTIONS.APPROVE,
      PAGE_ACTIONS.EXPORT,
    ],
  },
  {
    key: "projects",
    label: "Projects",
    group: "Sales",
    path: "/projects",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.DELETE,
    ],
  },
  {
    key: "field_ops",
    label: "Field Ops",
    group: "Sales",
    path: "/map",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
  },
  {
    key: "finance",
    label: "Finance",
    group: "Business",
    path: "/finance",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EXPORT],
  },
  {
    key: "reports",
    label: "Reports",
    group: "Business",
    path: "/reports",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EXPORT],
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    group: "Business",
    path: "/leaderboard",
    actions: [PAGE_ACTIONS.VIEW],
  },
  {
    key: "targets",
    label: "Targets",
    group: "Business",
    path: "/targets",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
  },
  {
    key: "calendar",
    label: "Calendar",
    group: "Workspace",
    path: "/calendar",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.CREATE, PAGE_ACTIONS.EDIT],
  },
  {
    key: "tasks",
    label: "Tasks",
    group: "Workspace",
    path: "/tasks",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.DELETE,
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    group: "Workspace",
    path: "/attendance",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT, PAGE_ACTIONS.APPROVE],
  },
  {
    key: "chat",
    label: "Team Chat",
    group: "Workspace",
    path: "/chat",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.CREATE],
  },
  {
    key: "coworking_booking",
    label: "Coworking Booking Board",
    group: "Coworking",
    path: "/coworking/booking-board",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.CREATE, PAGE_ACTIONS.EDIT],
  },
  {
    key: "coworking_clients",
    label: "Coworking Clients",
    group: "Coworking",
    path: "/coworking/clients",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.DELETE,
    ],
  },
  {
    key: "admin_team",
    label: "Team Access",
    group: "Admin",
    path: "/admin/users",
    actions: [
      PAGE_ACTIONS.VIEW,
      PAGE_ACTIONS.CREATE,
      PAGE_ACTIONS.EDIT,
      PAGE_ACTIONS.DELETE,
    ],
  },
  {
    key: "admin_notifications",
    label: "Alerts",
    group: "Admin",
    path: "/admin/notifications",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
  },
  {
    key: "admin_console",
    label: "Console",
    group: "Admin",
    path: "/admin/console",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
  },
  {
    key: "admin_meta_ads",
    label: "Meta Ads",
    group: "Admin",
    path: "/admin/meta-ads",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
  },
  {
    key: "settings",
    label: "Settings",
    group: "Admin",
    path: "/settings",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
  },
  {
    key: "profile",
    label: "Profile",
    group: "Account",
    path: "/profile",
    actions: [PAGE_ACTIONS.VIEW, PAGE_ACTIONS.EDIT],
    alwaysAccessible: true,
  },
]);

const PAGE_BY_KEY = new Map(CRM_PAGES.map((page) => [page.key, page]));
const PAGE_KEYS = Object.freeze(CRM_PAGES.map((page) => page.key));
const ALWAYS_ACCESSIBLE_PAGE_KEYS = Object.freeze(
  CRM_PAGES.filter((page) => page.alwaysAccessible).map((page) => page.key),
);

const isValidPageKey = (pageKey) => PAGE_BY_KEY.has(pageKey);

const isValidPageAction = (pageKey, action) =>
  Boolean(PAGE_BY_KEY.get(pageKey)?.actions.includes(action));

const toPagePermission = (pageKey, action) => `page.${pageKey}.${action}`;

// Flattens page entries into permission strings. "view" is implied by any
// granted action: a role that can edit leads can necessarily open the page.
const toPagePermissions = (pages = []) => {
  const permissions = new Set();

  pages.forEach((page) => {
    const pageKey = String(page?.pageKey || "").trim();
    if (!isValidPageKey(pageKey)) return;

    const actions = Array.isArray(page?.actions) ? page.actions : [];
    const validActions = actions.filter((action) => isValidPageAction(pageKey, action));
    if (!validActions.length) return;

    permissions.add(toPagePermission(pageKey, PAGE_ACTIONS.VIEW));
    validActions.forEach((action) => permissions.add(toPagePermission(pageKey, action)));
  });

  ALWAYS_ACCESSIBLE_PAGE_KEYS.forEach((pageKey) => {
    permissions.add(toPagePermission(pageKey, PAGE_ACTIONS.VIEW));
  });

  return [...permissions];
};

// Every page, every action — the grant an ADMIN (or a full-access system role)
// receives without having to enumerate the catalogue by hand.
const buildFullPageAccess = () =>
  CRM_PAGES.map((page) => ({ pageKey: page.key, actions: [...page.actions] }));

module.exports = {
  PAGE_ACTIONS,
  CRM_PAGES,
  PAGE_KEYS,
  ALWAYS_ACCESSIBLE_PAGE_KEYS,
  isValidPageKey,
  isValidPageAction,
  toPagePermission,
  toPagePermissions,
  buildFullPageAccess,
};
