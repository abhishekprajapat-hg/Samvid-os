import type { UserRole } from "../types";
import {
  ALL_NAV_ITEMS,
  NAV_GROUPS,
  ROLE_ONLY_PAGES,
  TAB_PREFERENCE,
  type NavGroup,
  type NavItem,
} from "./navigationCatalogue";

/*
 * A line-by-line port of roleCanSeeItem() from
 * frontend/src/components/workbench/workbenchNavigation.js.
 *
 * It replaces the `role === "ADMIN"` checks the mobile navigation used to make.
 * Those disagreed with web for any account whose page access an admin had
 * customised: mobile would offer a tab the API then refused.
 *
 * Do not "simplify" the branching. Each branch is load-bearing and the reason
 * is noted against it.
 */

export type AccessUser = {
  permissions?: string[] | null;
  enforcePageAccess?: boolean;
  canViewInventory?: boolean;
};

export const canSeeItem = (item: NavItem, rawRole: UserRole | null, user: AccessUser = {}) => {
  if (!rawRole) return false;
  // Samvid OS: a platform SUPER_ADMIN sees everything an ADMIN sees.
  const userRole: UserRole = rawRole === "SUPER_ADMIN" ? "ADMIN" : rawRole;

  const permissions = Array.isArray(user?.permissions) ? user.permissions : null;

  // Explicit employee pages override the menu defaults. Protected admin pages
  // also retain their built-in role requirements.
  const isConfiguredRole =
    userRole !== "ADMIN" && Boolean(user?.enforcePageAccess) && Boolean(permissions);
  const pageIsWidenable = Boolean(item.page) && !ROLE_ONLY_PAGES.has(item.page);

  if (isConfiguredRole && pageIsWidenable) {
    if (!permissions!.includes(`page.${item.page}.view`)) return false;
  } else {
    if (!item.roles.includes(userRole)) return false;
    // Role-only pages can still be revoked from a configured role.
    if (isConfiguredRole && item.page && !permissions!.includes(`page.${item.page}.view`)) {
      return false;
    }
  }

  if (
    item.requiresInventoryAccessForPartner &&
    userRole === "CHANNEL_PARTNER" &&
    !user?.canViewInventory
  ) {
    return false;
  }

  if (item.permission && userRole !== "ADMIN") {
    /*
     * Permissions haven't loaded yet (null) - don't hide the item mid-fetch and
     * make the nav flicker; the screen itself gates on load. Once loaded,
     * enforce the real list.
     */
    if (permissions && !permissions.includes(item.permission)) return false;
  }

  return true;
};

/** Visible nav groups, empty ones dropped - mirrors getVisibleSidebarGroups. */
export const getVisibleGroups = (userRole: UserRole | null, user: AccessUser = {}): NavGroup[] =>
  NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSeeItem(item, userRole, user)),
  })).filter((group) => group.items.length > 0);

export const getVisibleItems = (userRole: UserRole | null, user: AccessUser = {}): NavItem[] =>
  ALL_NAV_ITEMS.filter((item) => canSeeItem(item, userRole, user));

/**
 * The bottom tabs for a role: the first four destinations it can reach, taken
 * in TAB_PREFERENCE order. "More" is added by the navigator, not here.
 */
export const getTabItems = (
  userRole: UserRole | null,
  user: AccessUser = {},
  limit = 4,
): NavItem[] => {
  const visible = getVisibleItems(userRole, user);
  const tabs: NavItem[] = [];

  for (const page of TAB_PREFERENCE) {
    if (tabs.length >= limit) break;
    const item = visible.find((candidate) => candidate.page === page);
    // A role can reach Leads via either the `leads` or `my_leads` page; both map
    // to the same screen, so take whichever it has and not a duplicate tab.
    if (item && !tabs.some((existing) => existing.screen === item.screen)) {
      tabs.push(item);
    }
  }

  // A role with nothing in the preference list still needs somewhere to land.
  if (tabs.length === 0 && visible.length > 0) tabs.push(visible[0]);

  return tabs;
};

/** The More screen: everything reachable that is not already a tab. */
export const getMoreGroups = (
  userRole: UserRole | null,
  user: AccessUser = {},
  tabScreens: string[] = [],
): NavGroup[] => {
  const taken = new Set(tabScreens);
  return getVisibleGroups(userRole, user)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !taken.has(item.screen)),
    }))
    .filter((group) => group.items.length > 0);
};

/** Whether a page key is reachable - used by the route guards. */
export const canAccessPage = (
  pageKey: string,
  userRole: UserRole | null,
  user: AccessUser = {},
): boolean => {
  const items = ALL_NAV_ITEMS.filter((item) => item.page === pageKey);
  if (items.length === 0) return true; // Not a gated destination.
  return items.some((item) => canSeeItem(item, userRole, user));
};
