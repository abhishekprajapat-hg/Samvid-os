import type { UserRole } from "../types";

/*
 * The mobile mirror of frontend/src/components/workbench/workbenchNavigation.js.
 *
 * The role arrays, page keys, permission strings and partner-inventory flags
 * are copied across literally. If a value here disagrees with the web file,
 * this file is wrong - that is the whole contract. Grouping and labels match
 * SIDEBAR_GROUPS so the More screen reads like the web sidebar.
 */

const MANAGEMENT_ROLES: UserRole[] = ["ADMIN", "MANAGER"];
const SALES_ROLES: UserRole[] = [...MANAGEMENT_ROLES, "EXECUTIVE", "FIELD_EXECUTIVE"];
const PRODUCTION_ROLES: UserRole[] = ["PRODUCTION_EXECUTIVE", "COMMUNITY_MANAGER"];
const PARTNER_ROLES: UserRole[] = ["CHANNEL_PARTNER"];
const COWORKING_ROLES: UserRole[] = ["ADMIN", "MANAGER", "COWORKING_ADMIN"];

export type NavItem = {
  /** The route name registered in RoleTabs' stack. */
  screen: string;
  label: string;
  icon: string;
  /** Page key from the backend catalogue; drives page.<key>.view grants. */
  page: string;
  roles: UserRole[];
  /** Web path, kept so the two files can be diffed against each other. */
  path: string;
  permission?: string;
  requiresInventoryAccessForPartner?: boolean;
};

export type NavGroup = { group: string; items: NavItem[] };

/*
 * One entry per destination, in the same six groups the web sidebar uses.
 *
 * Screens not yet built on mobile are absent rather than present-and-broken;
 * each arrives with the phase that builds it. Tracked in
 * docs/mobile/00_MOBILE_PARITY_SPEC.md.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    group: "WORK",
    items: [
      { screen: "Dashboard", label: "Home", icon: "dashboard", page: "dashboard", path: "/dashboard", roles: [...SALES_ROLES, ...PRODUCTION_ROLES, ...PARTNER_ROLES] },
      { screen: "Tasks", label: "Tasks", icon: "tasks", page: "tasks", path: "/tasks", roles: [...SALES_ROLES, ...PRODUCTION_ROLES] },
      { screen: "Calendar", label: "Calendar", icon: "calendar", page: "calendar", path: "/calendar", roles: SALES_ROLES },
      { screen: "Attendance", label: "Attendance", icon: "attendance", page: "attendance", path: "/attendance", roles: [...SALES_ROLES, ...PRODUCTION_ROLES, ...PARTNER_ROLES] },
    ],
  },
  {
    group: "SALES",
    items: [
      { screen: "Leads", label: "Pipeline", icon: "leads", page: "leads", path: "/leads", roles: ["ADMIN", "MANAGER", "CHANNEL_PARTNER"] },
      { screen: "Leads", label: "My Leads", icon: "leads", page: "my_leads", path: "/my-leads", roles: ["EXECUTIVE", "FIELD_EXECUTIVE"] },
      { screen: "Inventory", label: "Inventory", icon: "inventory", page: "inventory", path: "/inventory", roles: [...SALES_ROLES, ...PARTNER_ROLES], requiresInventoryAccessForPartner: true },
      // Both contact directories are internal, so channel partners are left out
      // here exactly as the API leaves them out.
      { screen: "OwnerDatabase", label: "Owner Database", icon: "leads", page: "inventory", path: "/inventory/owners", roles: SALES_ROLES },
      { screen: "BrokerDatabase", label: "Broker Database", icon: "leads", page: "inventory", path: "/inventory/brokers", roles: SALES_ROLES },
      { screen: "Projects", label: "Projects", icon: "projects", page: "projects", path: "/projects", roles: [...SALES_ROLES, ...PARTNER_ROLES], requiresInventoryAccessForPartner: true },
      { screen: "Field Ops", label: "Field Ops", icon: "fieldOps", page: "field_ops", path: "/map", roles: ["ADMIN", "MANAGER", "FIELD_EXECUTIVE"] },
    ],
  },
  {
    group: "BUSINESS",
    items: [
      { screen: "Finance", label: "Finance", icon: "finance", page: "finance", path: "/finance", roles: ["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"] },
      { screen: "Reports", label: "Reports", icon: "reports", page: "reports", path: "/reports", roles: MANAGEMENT_ROLES },
      { screen: "Leaderboard", label: "Leaderboard", icon: "leaderboard", page: "leaderboard", path: "/leaderboard", roles: [...SALES_ROLES, ...PARTNER_ROLES] },
      // Web declares /targets twice - "Targets" for sales, "Performance" for
      // production - and unions the roles into one sidebar entry. Same here.
      { screen: "Targets", label: "Targets", icon: "targets", page: "targets", path: "/targets", roles: [...SALES_ROLES, ...PRODUCTION_ROLES] },
    ],
  },
  {
    group: "TEAM",
    items: [
      { screen: "Chat", label: "Chat", icon: "chat", page: "chat", path: "/chat", roles: [...SALES_ROLES, ...PRODUCTION_ROLES] },
    ],
  },
  {
    group: "ADMIN",
    items: [
      { screen: "Users", label: "Team", icon: "leads", page: "admin_team", path: "/admin/users", roles: MANAGEMENT_ROLES },
      { screen: "Console", label: "Console", icon: "admin", page: "admin_console", path: "/admin/console", roles: ["ADMIN", "MANAGER"] },
      { screen: "MetaAds", label: "Meta Ads", icon: "trend", page: "admin_meta_ads", path: "/admin/meta-ads", roles: ["ADMIN", "MANAGER"] },
      { screen: "Notifications", label: "Notifications", icon: "notifications", page: "admin_notifications", path: "/admin/notifications", roles: MANAGEMENT_ROLES },
      { screen: "Settings", label: "Settings", icon: "settings", page: "settings", path: "/settings", roles: MANAGEMENT_ROLES },
    ],
  },
  {
    group: "COWORKING",
    items: [
      { screen: "CoworkingBooking", label: "Booking Board", icon: "coworking", page: "coworking_booking", path: "/coworking/booking-board", roles: COWORKING_ROLES, permission: "cabins.view" },
      { screen: "CoworkingClients", label: "Clients", icon: "leads", page: "coworking_clients", path: "/coworking/clients", roles: COWORKING_ROLES, permission: "clients.view" },
    ],
  },
];

/** Web keeps Profile in the sidebar footer chip rather than a nav group. */
export const PROFILE_ITEM: NavItem = {
  screen: "Profile",
  label: "Profile",
  icon: "profile",
  page: "profile",
  path: "/profile",
  roles: [...SALES_ROLES, ...PRODUCTION_ROLES, ...PARTNER_ROLES],
};

/*
 * Pages whose page-access grant can only ever *narrow*, never widen: their APIs
 * are hard-gated on ADMIN/MANAGER, so showing them to anyone else would produce
 * a screen that cannot load.
 */
export const ROLE_ONLY_PAGES = new Set([
  "admin_team",
  "admin_notifications",
  "admin_console",
  "admin_meta_ads",
  "settings",
]);

/*
 * Tab preference order. The first four destinations a role can actually see
 * become its bottom tabs, and "More" is always appended.
 *
 * Replaces the five hardcoded per-role tab blocks the old RoleTabs had, which
 * left COWORKING_ADMIN and the production roles without a sensible home.
 */
export const TAB_PREFERENCE: string[] = [
  "dashboard",
  "leads",
  "my_leads",
  "inventory",
  "chat",
  "coworking_booking",
  "tasks",
  "attendance",
  "finance",
  "reports",
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
