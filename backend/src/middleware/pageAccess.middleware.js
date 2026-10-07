const { resolveAccessProfile, canAccessPage } = require("../services/access.service");
const { toPagePermission } = require("../constants/page.constants");
const logger = require("../config/logger");

/*
 * In "log" mode the request is allowed through, but the denial that enforcement
 * would have produced is recorded. Grep these before switching the mode to
 * "on": each line is a call that will start returning 403.
 */
const reportWouldDeny = (req, profile, detail) => {
  if (profile.enforcementMode !== "log") return;
  logger.warn({
    message: "pageAccess: would deny under enforcement",
    role: profile.role,
    userId: String(req.user?._id || ""),
    method: req.method,
    path: req.originalUrl || req.path,
    ...detail,
  });
};

const normalizeRole = (value) => String(value || "").trim().toUpperCase();

// Enforce employee page selections on API route groups. Accounts using
// defaults keep the existing role gates. Any listed page satisfies a group.
exports.requirePageAccess = (...pageKeys) => async (req, res, next) => {
  try {
    if (!req.user) return next();

    const profile = await resolveAccessProfile(req.user);
    const allowed = pageKeys.some((pageKey) => canAccessPage(profile, pageKey));

    if (!profile.enforcePageAccess) {
      if (!pageKeys.some((pageKey) => profile.permissions.includes(toPagePermission(pageKey, "view")))) {
        reportWouldDeny(req, profile, { pages: pageKeys, reason: "page not granted" });
      }
      return next();
    }

    if (allowed) return next();

    return res.status(403).json({
      message: "Your account does not have access to this page",
      pages: pageKeys,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Server error",
    });
  }
};

// A page grant can be view-only. Map ordinary REST verbs to the action that
// they mutate so every module gets a server-side write gate automatically.
exports.requirePageActionForMethod = (...pageKeys) => async (req, res, next) => {
  try {
    if (!req.user) return next();
    const profile = await resolveAccessProfile(req.user);
    if (profile.isAdmin || !profile.enforcePageAccess) return next();
    /*
     * DELETE used to accept "edit" as well, which meant a grant of
     * { inventory: [view, edit] } was enough to hard-delete an owner or broker
     * record. A destructive verb now needs the destructive action and nothing
     * else. POST keeps the wider set because several POST routes are actions
     * rather than creations (/approve, /assign, /cancel); routes that really do
     * create something declare it explicitly with requirePageAction("create").
     */
    const actionsByMethod = {
      GET: ["view"],
      HEAD: ["view"],
      POST: ["create", "edit", "assign", "follow_up", "approve"],
      PUT: ["edit", "assign", "follow_up", "approve"],
      PATCH: ["edit", "assign", "follow_up", "approve"],
      DELETE: ["delete"],
    };
    const actions = actionsByMethod[req.method] || ["view"];
    const allowed = pageKeys.some((pageKey) => actions.some((action) => profile.permissions.includes(toPagePermission(pageKey, action))));
    if (!profile.enforcePageAccess) {
      if (!allowed) reportWouldDeny(req, profile, { pages: pageKeys, actions, reason: "action not granted" });
      return next();
    }
    if (allowed) return next();
    return res.status(403).json({ message: "Your account does not have permission to perform this action on the page", pages: pageKeys, actions });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Server error" });
  }
};

exports.requirePageAction = (action, ...pageKeys) => async (req, res, next) => {
  try {
    if (!req.user) return next();
    const profile = await resolveAccessProfile(req.user);
    if (profile.isAdmin || !profile.enforcePageAccess) return next();
    if (pageKeys.some((pageKey) => profile.permissions.includes(toPagePermission(pageKey, action)))) return next();
    return res.status(403).json({ message: `Your account does not have permission to ${action} on this page`, pages: pageKeys, action });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Server error" });
  }
};

// Preserve built-in role rules while allowing an Admin's explicit page action
// grant to widen one operation for one employee.
exports.checkRoleOrPageAction = (roles, action, ...pageKeys) => async (req, res, next) => {
  const userRole = normalizeRole(req.user?.role);
  if (roles.map(normalizeRole).includes(userRole)) return next();
  try {
    const profile = await resolveAccessProfile(req.user);
    if (profile.hasExplicitPageOverride
      && pageKeys.some((pageKey) => profile.permissions.includes(toPagePermission(pageKey, action)))) {
      return next();
    }
  } catch {
    // Fall through to the same denial as the role check.
  }
  return res.status(403).json({ message: "Access denied", action, pages: pageKeys });
};

// An explicit employee page grant can open a module outside their built-in
// role. Per-action permissions and data scope remain independently enforced.
exports.checkRoleOrPageAccess = (roles, ...pageKeys) => async (req, res, next) => {
  const userRole = normalizeRole(req.user?.role);
  const allowedRoles = roles.map(normalizeRole);

  if (allowedRoles.includes(userRole)) return next();

  try {
    const profile = await resolveAccessProfile(req.user);
    // Only an account that explicitly declares page access can widen this way;
    // otherwise an unconfigured role would inherit its base role's defaults
    // and quietly gain modules it never had.
    if (profile.hasExplicitPageOverride
      && pageKeys.some((pageKey) => canAccessPage(profile, pageKey))) {
      return next();
    }
  } catch {
    // Fall through to the same denial the role check would have produced.
  }

  return res.status(403).json({ message: "Access denied" });
};
