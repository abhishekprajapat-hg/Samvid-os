const RolePermission = require("../models/RolePermission");
const { USER_ROLES } = require("../constants/role.constants");
const {
  PERMISSIONS,
  getDefaultPermissionsForRole,
  isValidPermission,
  isAdminProtectedPermission,
} = require("../constants/permission.constants");
const {
  CRM_PAGES,
  ALWAYS_ACCESSIBLE_PAGE_KEYS,
  isValidPageKey,
  isValidPageAction,
  toPagePermission,
  toPagePermissions,
  buildFullPageAccess,
} = require("../constants/page.constants");
const {
  getDefaultPageAccessForRole,
  getDefaultDataScopeForRole,
} = require("../constants/rolePageAccess.constants");
const { createHttpError } = require("../utils/httpError");
const { createTtlCache } = require("../utils/ttlCache");

// Avoid repeating company permission reads on every API request.
// Permission and employee page updates invalidate this short-lived cache.
const accessProfileCache = createTtlCache({
  ttlMs: process.env.ACCESS_PROFILE_CACHE_TTL_MS || 30000,
  maxEntries: process.env.ACCESS_PROFILE_CACHE_MAX_ENTRIES || 2000,
});

const invalidateAccessCache = () => accessProfileCache.clear();

const isAdminRole = (role) => role === USER_ROLES.ADMIN;

const resolveLegacyPermissions = async ({ companyId, role }) => {
  if (isAdminRole(role)) return [...PERMISSIONS];

  const override = await RolePermission.findOne({ companyId, role })
    .select("permissions")
    .lean();
  if (override) return override.permissions || [];

  return getDefaultPermissionsForRole(role);
};

const normalizePageEntries = (pages = []) =>
  pages
    .map((entry) => ({
      pageKey: String(entry?.pageKey || "").trim(),
      actions: Array.isArray(entry?.actions) ? entry.actions : [],
    }))
    .filter((entry) => isValidPageKey(entry.pageKey))
    .map((entry) => ({
      pageKey: entry.pageKey,
      actions: [
        ...new Set(
          ["view", ...entry.actions].filter((action) =>
            isValidPageAction(entry.pageKey, action)),
        ),
      ],
    }));

const normalizePageOverride = (entries = [], inherited = new Map()) =>
  entries.map((entry) => {
    // Older records stored only the page key. Preserve their old behaviour by
    // inheriting that role page's action set when it is still available.
    if (typeof entry === "string") {
      return inherited.get(entry) || { pageKey: entry, actions: ["view"] };
    }
    return {
      pageKey: String(entry?.pageKey || "").trim(),
      actions: Array.isArray(entry?.actions) ? entry.actions : ["view"],
    };
  });

// Pages every signed-in account keeps no matter what a role says — the spec's
// "Profile and Logout stay reachable" rule.
const withAlwaysAccessiblePages = (pages) => {
  const byKey = new Map(pages.map((entry) => [entry.pageKey, entry]));

  ALWAYS_ACCESSIBLE_PAGE_KEYS.forEach((pageKey) => {
    if (byKey.has(pageKey)) return;
    byKey.set(pageKey, { pageKey, actions: ["view"] });
  });

  return [...byKey.values()];
};

const buildAccessProfile = async (user) => {
  const baseRole = user?.role || "";
  const companyId = user?.companyId || null;

  if (isAdminRole(baseRole)) {
    const pages = buildFullPageAccess();
    return {
      role: baseRole,
      baseRole,
      isAdmin: true,
      permissions: [...PERMISSIONS, ...toPagePermissions(pages)],
      pages,
      dataScope: "ALL",
      // Nothing to enforce: an ADMIN reaches every page by definition.
      enforcePageAccess: false,
    };
  }

  const legacyPermissions = companyId ? await resolveLegacyPermissions({ companyId, role: baseRole }) : [];
  let pages = withAlwaysAccessiblePages(normalizePageEntries(getDefaultPageAccessForRole(baseRole)));

  const hasPageOverride = Array.isArray(user?.pageAccessOverride);
  if (hasPageOverride) {
    const inherited = new Map(pages.map((page) => [page.pageKey, page]));
    pages = withAlwaysAccessiblePages(normalizePageEntries(
      normalizePageOverride(user.pageAccessOverride, inherited),
    ));
  }

  const permissions = [
    ...new Set([
      ...legacyPermissions.filter((permission) => !hasPageOverride || !permission.startsWith("page.")),
      ...toPagePermissions(pages),
      // Coworking sub-routes still use their legacy capability names, so mirror
      // each explicitly granted page action into those API permissions.
      ...(hasPageOverride
        ? pages.flatMap(({ pageKey, actions = [] }) => {
          const permissionMap = {
            coworking_booking: {
              view: ["cabins.view", "bookings.view", "seats.view"],
              create: ["cabins.create", "bookings.create", "seats.assign"],
              edit: ["cabins.update", "bookings.update", "seats.release"],
              delete: ["bookings.cancel"],
            },
            coworking_clients: {
              view: ["clients.view"],
              create: ["clients.create"],
              edit: ["clients.update"],
              delete: ["clients.delete"],
            },
          }[pageKey];
          return [...new Set(actions.flatMap((action) => permissionMap?.[action] || []))];
        })
        : []),
    ]),
  ];

  return {
    role: baseRole,
    baseRole,
    isAdmin: false,
    permissions,
    pages,
    dataScope: getDefaultDataScopeForRole(baseRole),
    enforcePageAccess: hasPageOverride,
  };
};

// Cache by company, built-in role and employee page selection.
const resolveAccessProfile = async (user) => {
  const cacheKey = [
    String(user?.companyId || ""),
    String(user?.role || ""),
    JSON.stringify(user?.pageAccessOverride ?? null),
  ].join("|");

  const cached = accessProfileCache.get(cacheKey);
  if (cached) return cached;

  const profile = await buildAccessProfile(user);
  accessProfileCache.set(cacheKey, profile);
  return profile;
};

const resolveEffectivePermissions = async ({ companyId, role, user }) => {
  if (user) {
    const profile = await resolveAccessProfile(user);
    return profile.permissions;
  }
  return resolveLegacyPermissions({ companyId, role });
};

const hasPermission = async (user, permission) => {
  if (isAdminRole(user?.role)) return true;
  if (!user?.companyId) {
    throw createHttpError(403, "Company context is required");
  }
  const profile = await resolveAccessProfile(user);
  return profile.permissions.includes(permission);
};

const canAccessPage = (profile, pageKey) =>
  profile.isAdmin
  || !profile.enforcePageAccess
  || profile.permissions.includes(toPagePermission(pageKey, "view"));

/* ------------------------------------------------------------------ *
 * Privilege-escalation guards
 *
 * Everything below answers one question: may THIS actor hand out THAT
 * capability? An ADMIN always may. Anyone else may only grant what they
 * already hold, and may never grant an admin-protected permission — which is
 * what stops an authorized Manager from minting an admin-equivalent role or
 * promoting themselves.
 * ------------------------------------------------------------------ */

const getActorPermissionSet = async (actor) => {
  const profile = await resolveAccessProfile(actor);
  return { profile, permissionSet: new Set(profile.permissions) };
};

const assertGrantablePermissions = async ({ actor, permissions = [] }) => {
  const unknown = permissions.filter((permission) => !isValidPermission(permission));
  if (unknown.length) {
    throw createHttpError(400, `Unknown permission: ${unknown[0]}`);
  }

  if (isAdminRole(actor?.role)) return;

  const protectedGrants = permissions.filter((permission) =>
    isAdminProtectedPermission(permission));
  if (protectedGrants.length) {
    throw createHttpError(
      403,
      `Only an Admin can grant protected permissions (${protectedGrants.join(", ")})`,
    );
  }

  const { permissionSet } = await getActorPermissionSet(actor);
  const beyondActor = permissions.filter((permission) => !permissionSet.has(permission));
  if (beyondActor.length) {
    throw createHttpError(
      403,
      `You cannot grant permissions you do not hold yourself (${beyondActor.join(", ")})`,
    );
  }
};

module.exports = {
  CRM_PAGES,
  invalidateAccessCache,
  isAdminRole,
  normalizePageEntries,
  normalizePageOverride,
  withAlwaysAccessiblePages,
  resolveLegacyPermissions,
  resolveAccessProfile,
  resolveEffectivePermissions,
  hasPermission,
  canAccessPage,
  getActorPermissionSet,
  assertGrantablePermissions,
};
