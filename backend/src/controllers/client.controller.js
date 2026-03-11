const {
  USER_ROLES,
  MANAGEMENT_ROLES,
  EXECUTIVE_ROLES,
} = require("../constants/role.constants");

const MANAGEMENT_SET = new Set([USER_ROLES.ADMIN, ...MANAGEMENT_ROLES]);
const EXECUTIVE_SET = new Set(EXECUTIVE_ROLES);
const PLATFORM_SET = new Set([USER_ROLES.SUPER_ADMIN]);

const toUserView = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  companyId: user.companyId || null,
  parentId: user.parentId || null,
  partnerCode: user.partnerCode || null,
});

const toCapabilities = (role) => ({
  canManagePlatform: PLATFORM_SET.has(role),
  canManageUsers: MANAGEMENT_SET.has(role),
  canManageLeads: MANAGEMENT_SET.has(role) || EXECUTIVE_SET.has(role),
  canManageInventory: role === USER_ROLES.ADMIN,
  canApproveInventoryRequests: role === USER_ROLES.ADMIN,
  canCreateInventoryRequests: role === USER_ROLES.FIELD_EXECUTIVE,
  canUseRealtimeChat: true,
});

exports.health = (_req, res) => {
  res.json({
    ok: true,
    service: "samvid-client-api",
    channels: ["web", "mobile"],
    timestamp: new Date().toISOString(),
  });
};

exports.bootstrap = (req, res) => {
  const role = req.user?.role || "";

  res.json({
    ok: true,
    apiBasePath: "/api/client",
    socket: {
      path: "/socket.io",
    },
    user: toUserView(req.user),
    tenant: req.tenant
      ? {
        id: req.tenant._id,
        name: req.tenant.name,
        subdomain: req.tenant.subdomain,
        routePrefix: `/${req.tenant.subdomain}`,
        customDomain: req.tenant.customDomain || "",
        status: req.tenant.status,
      }
      : null,
    capabilities: toCapabilities(role),
    timestamp: new Date().toISOString(),
  });
};
