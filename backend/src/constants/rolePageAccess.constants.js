const { USER_ROLES } = require("./role.constants");
const { PAGE_ACTIONS, CRM_PAGES, buildFullPageAccess } = require("./page.constants");

// Default pages and data scopes for the built-in employee roles.
// Individual page selections override these defaults in access.service.

const { VIEW, CREATE, EDIT, DELETE, EXPORT, APPROVE, ASSIGN, FOLLOW_UP } = PAGE_ACTIONS;

const page = (pageKey, actions = [VIEW]) => ({ pageKey, actions: [...actions] });

const SALES_FULL_LEADS = [VIEW, CREATE, EDIT, ASSIGN, FOLLOW_UP, EXPORT];
const OWN_LEADS = [VIEW, CREATE, EDIT, FOLLOW_UP];

const MANAGER_PAGES = [
  page("dashboard"),
  page("leads", [...SALES_FULL_LEADS, DELETE]),
  page("inventory", [VIEW, CREATE, EDIT, DELETE, APPROVE, EXPORT]),
  page("projects", [VIEW, CREATE, EDIT, DELETE]),
  page("field_ops", [VIEW, EDIT]),
  page("finance", [VIEW, EXPORT]),
  page("reports", [VIEW, EXPORT]),
  page("leaderboard"),
  page("targets", [VIEW, EDIT]),
  page("calendar", [VIEW, CREATE, EDIT]),
  page("tasks", [VIEW, CREATE, EDIT, DELETE]),
  page("attendance", [VIEW, EDIT, APPROVE]),
  page("chat", [VIEW, CREATE]),
  page("coworking_booking", [VIEW, CREATE, EDIT]),
  page("coworking_clients", [VIEW, CREATE, EDIT, DELETE]),
  page("admin_team", [VIEW, CREATE, EDIT]),
  page("admin_notifications", [VIEW, EDIT]),
  page("admin_console", [VIEW, EDIT]),
  page("admin_meta_ads", [VIEW, EDIT]),
  page("settings", [VIEW, EDIT]),
  page("profile", [VIEW, EDIT]),
];

const EXECUTIVE_PAGES = [
  page("dashboard"),
  page("leads", SALES_FULL_LEADS),
  page("my_leads", OWN_LEADS),
  page("inventory", [VIEW, CREATE, EDIT]),
  page("projects", [VIEW]),
  page("finance", [VIEW]),
  page("leaderboard"),
  page("targets", [VIEW]),
  page("calendar", [VIEW, CREATE, EDIT]),
  page("tasks", [VIEW, CREATE, EDIT]),
  page("attendance", [VIEW, EDIT]),
  page("chat", [VIEW, CREATE]),
  page("profile", [VIEW, EDIT]),
];

const FIELD_EXECUTIVE_PAGES = [
  ...EXECUTIVE_PAGES.filter((entry) => entry.pageKey !== "profile"),
  page("field_ops", [VIEW, EDIT]),
  page("profile", [VIEW, EDIT]),
];

const PRODUCTION_PAGES = [
  page("dashboard"),
  page("targets", [VIEW]),
  page("tasks", [VIEW, CREATE, EDIT]),
  page("attendance", [VIEW, EDIT]),
  page("chat", [VIEW, CREATE]),
  page("profile", [VIEW, EDIT]),
];

const CHANNEL_PARTNER_PAGES = [
  page("dashboard"),
  page("leads", [VIEW, CREATE, EDIT, FOLLOW_UP]),
  // Inventory stays subject to the per-account canViewInventory flag, which the
  // page guard does not replace.
  page("inventory", [VIEW]),
  page("projects", [VIEW]),
  page("finance", [VIEW]),
  page("leaderboard"),
  page("attendance", [VIEW, EDIT]),
  page("profile", [VIEW, EDIT]),
];

const COWORKING_ADMIN_PAGES = [
  page("dashboard"),
  page("coworking_booking", [VIEW, CREATE, EDIT]),
  page("coworking_clients", [VIEW, CREATE, EDIT, DELETE]),
  page("profile", [VIEW, EDIT]),
];

const DEFAULT_ROLE_PAGE_ACCESS = Object.freeze({
  [USER_ROLES.ADMIN]: buildFullPageAccess(),
  [USER_ROLES.MANAGER]: MANAGER_PAGES,
  [USER_ROLES.EXECUTIVE]: EXECUTIVE_PAGES,
  // Legacy inside executives share the executive defaults.
  [USER_ROLES.INSIDE_EXECUTIVE]: EXECUTIVE_PAGES,
  [USER_ROLES.FIELD_EXECUTIVE]: FIELD_EXECUTIVE_PAGES,
  [USER_ROLES.PRODUCTION_EXECUTIVE]: PRODUCTION_PAGES,
  [USER_ROLES.COMMUNITY_MANAGER]: PRODUCTION_PAGES,
  [USER_ROLES.CHANNEL_PARTNER]: CHANNEL_PARTNER_PAGES,
  [USER_ROLES.COWORKING_ADMIN]: COWORKING_ADMIN_PAGES,
});

const DEFAULT_ROLE_DATA_SCOPE = Object.freeze({
  [USER_ROLES.ADMIN]: "ALL",
  [USER_ROLES.MANAGER]: "TEAM",
  [USER_ROLES.EXECUTIVE]: "ASSIGNED",
  [USER_ROLES.INSIDE_EXECUTIVE]: "ASSIGNED",
  [USER_ROLES.FIELD_EXECUTIVE]: "ASSIGNED",
  [USER_ROLES.PRODUCTION_EXECUTIVE]: "ASSIGNED",
  [USER_ROLES.COMMUNITY_MANAGER]: "ASSIGNED",
  [USER_ROLES.CHANNEL_PARTNER]: "SELF",
  [USER_ROLES.COWORKING_ADMIN]: "ALL",
});

const getDefaultPageAccessForRole = (baseRole) =>
  (DEFAULT_ROLE_PAGE_ACCESS[baseRole] || []).map((entry) => ({
    pageKey: entry.pageKey,
    actions: [...entry.actions],
  }));

const getDefaultDataScopeForRole = (baseRole) =>
  DEFAULT_ROLE_DATA_SCOPE[baseRole] || "ASSIGNED";

module.exports = {
  CRM_PAGES,
  DEFAULT_ROLE_PAGE_ACCESS,
  DEFAULT_ROLE_DATA_SCOPE,
  getDefaultPageAccessForRole,
  getDefaultDataScopeForRole,
};
