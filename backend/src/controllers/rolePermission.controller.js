const User = require("../models/User");
const CustomRole = require("../models/CustomRole");
const { USER_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } = require("../constants/role.constants");
const { CRM_PAGES, buildFullPageAccess } = require("../constants/page.constants");
const { getDefaultPageAccessForRole } = require("../constants/rolePageAccess.constants");
const {
  normalizePageEntries,
  withAlwaysAccessiblePages,
  pageEntriesFromPermissions,
} = require("../services/access.service");
const {
  listRolesWithPermissions,
  updateRolePermissions,
} = require("../services/permission.service");

/*
 * Roles and what they may reach, company-wide.
 *
 * The storage is RolePermission, which access.service already reads when it
 * resolves anybody's profile - this only gives it a home an admin can get to
 * without going through the coworking module, where the existing pair of
 * routes sit behind a coworking page grant. Nothing new is stored and nothing
 * new is enforced; a save here is the same write the coworking screen makes,
 * with the same audit entry and the same cache invalidation.
 *
 * Two things a role screen needs that the service does not carry: how many
 * people hold the role, and the company-defined roles, which are presets over
 * a built-in role rather than roles of their own. Both are added here.
 */

/*
 * What a role's holders actually reach, resolved exactly as access.service
 * resolves it for somebody with no per-user override: the role's own page
 * grants when it has any, the defaults in rolePageAccess.constants otherwise.
 *
 * The screen needs this rather than the raw permission list, because it edits
 * a handful of pages and writes the whole list back. Without the pages it is
 * not showing, a save would silently drop them.
 */
const resolveRolePages = (role, permissions = []) => {
  if (role === USER_ROLES.ADMIN) return buildFullPageAccess();
  const fromPermissions = pageEntriesFromPermissions(permissions);
  const entries = fromPermissions.length ? fromPermissions : getDefaultPageAccessForRole(role);
  return withAlwaysAccessiblePages(normalizePageEntries(entries));
};

const roleView = (row, memberIds) => ({
  key: row.role,
  label: row.label || ROLE_LABELS[row.role] || row.role,
  description: ROLE_DESCRIPTIONS[row.role] || "",
  permissions: row.permissions || [],
  pageAccess: resolveRolePages(row.role, row.permissions || []),
  isOverridden: Boolean(row.isOverridden),
  /* ADMIN reaches everything by definition, so its list is not editable. */
  isFixed: Boolean(row.isFixed),
  memberIds: memberIds || [],
  memberCount: (memberIds || []).length,
  updatedAt: row.updatedAt || null,
});

exports.listRoles = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const [rows, members, customRoles] = await Promise.all([
      listRolesWithPermissions(companyId),
      User.find({ companyId })
        .select("_id name role customRoleId isActive profileImageUrl")
        .sort({ name: 1 })
        .lean(),
      CustomRole.find({ companyId, isActive: true })
        .select("name description baseRole businessCategory")
        .sort({ name: 1 })
        .lean(),
    ]);

    const byRole = new Map();
    const byCustomRole = new Map();
    for (const member of members) {
      const view = {
        _id: member._id,
        name: member.name || "",
        isActive: member.isActive !== false,
        profileImageUrl: member.profileImageUrl || "",
      };
      const customRoleId = String(member.customRoleId || "");
      if (customRoleId) {
        if (!byCustomRole.has(customRoleId)) byCustomRole.set(customRoleId, []);
        byCustomRole.get(customRoleId).push(view);
        continue;
      }
      if (!byRole.has(member.role)) byRole.set(member.role, []);
      byRole.get(member.role).push(view);
    }

    return res.json({
      pages: CRM_PAGES,
      roles: rows.map((row) => roleView(row, byRole.get(row.role))),
      /*
       * A custom role has no permission list of its own - assigning one copies
       * its base role onto the user, and every rule downstream reads that. So
       * it is reported with the base role it resolves to, and the screen edits
       * that role's list while naming what else it would affect.
       */
      customRoles: customRoles.map((role) => {
        const roleMembers = byCustomRole.get(String(role._id)) || [];
        return {
          key: `custom:${role._id}`,
          customRoleId: String(role._id),
          label: role.name || "",
          description: role.description || "",
          baseRole: role.baseRole,
          baseRoleLabel: ROLE_LABELS[role.baseRole] || role.baseRole,
          businessCategory: role.businessCategory || "",
          memberIds: roleMembers,
          memberCount: roleMembers.length,
        };
      }),
    });
  } catch (error) {
    req.log?.error({ error: error.message }, "listRoles failed");
    return res.status(500).json({ message: "Unable to load roles" });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const role = String(req.params.role || "").trim().toUpperCase();
    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ message: "Unknown role" });
    }

    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : null;
    if (!permissions) {
      return res.status(400).json({ message: "permissions must be a list" });
    }

    await updateRolePermissions({
      companyId: req.user.companyId,
      role,
      permissions,
      actingUser: req.user,
      req,
    });

    const rows = await listRolesWithPermissions(req.user.companyId);
    const updated = rows.find((row) => row.role === role);
    return res.json({
      message: `${ROLE_LABELS[role] || role} permissions saved`,
      role: updated ? roleView(updated, []) : null,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    req.log?.error({ error: error.message }, "updateRole failed");
    return res.status(500).json({ message: "Unable to save role permissions" });
  }
};
