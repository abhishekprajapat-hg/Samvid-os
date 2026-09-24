const { resolveAccessProfile, canAccessPage } = require("../services/access.service");
const { toPagePermission } = require("../constants/page.constants");

const normalizeRole = (value) => String(value || "").trim().toUpperCase();

// Enforce employee page selections on API route groups. Accounts using
// defaults keep the existing role gates. Any listed page satisfies a group.
exports.requirePageAccess = (...pageKeys) => async (req, res, next) => {
  try {
    if (!req.user) return next();

    const profile = await resolveAccessProfile(req.user);
    if (!profile.enforcePageAccess) return next();

    const allowed = pageKeys.some((pageKey) => canAccessPage(profile, pageKey));
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
    const actionsByMethod = {
      GET: ["view"],
      HEAD: ["view"],
      POST: ["create", "edit", "assign", "follow_up", "approve", "delete"],
      PUT: ["edit", "assign", "follow_up", "approve"],
      PATCH: ["edit", "assign", "follow_up", "approve"],
      DELETE: ["delete", "edit"],
    };
    const actions = actionsByMethod[req.method] || ["view"];
    const allowed = pageKeys.some((pageKey) => actions.some((action) => profile.permissions.includes(toPagePermission(pageKey, action))));
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
    if (profile.enforcePageAccess
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
    if (profile.enforcePageAccess
      && pageKeys.some((pageKey) => canAccessPage(profile, pageKey))) {
      return next();
    }
  } catch {
    // Fall through to the same denial the role check would have produced.
  }

  return res.status(403).json({ message: "Access denied" });
};
