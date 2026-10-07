const USER_ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  INSIDE_EXECUTIVE: "INSIDE_EXECUTIVE",
  EXECUTIVE: "EXECUTIVE",
  FIELD_EXECUTIVE: "FIELD_EXECUTIVE",
  PRODUCTION_EXECUTIVE: "PRODUCTION_EXECUTIVE",
  COMMUNITY_MANAGER: "COMMUNITY_MANAGER",
  CHANNEL_PARTNER: "CHANNEL_PARTNER",
  COWORKING_ADMIN: "COWORKING_ADMIN",
});

const COWORKING_ROLES = Object.freeze([
  USER_ROLES.COWORKING_ADMIN,
]);

const MANAGEMENT_ROLES = Object.freeze([
  USER_ROLES.MANAGER,
]);

const PLATFORM_ADMIN_ROLES = Object.freeze([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
]);

const EXECUTIVE_ROLES = Object.freeze([
  USER_ROLES.INSIDE_EXECUTIVE,
  USER_ROLES.EXECUTIVE,
  USER_ROLES.FIELD_EXECUTIVE,
]);

const LEAD_OWNER_ROLES = Object.freeze([
  USER_ROLES.INSIDE_EXECUTIVE,
  USER_ROLES.EXECUTIVE,
]);

const MANUAL_LEAD_TRANSFER_TARGET_ROLES = Object.freeze([
  ...LEAD_OWNER_ROLES,
  USER_ROLES.FIELD_EXECUTIVE,
]);

const INSIDE_EXECUTIVE_ROLES = Object.freeze([
  USER_ROLES.INSIDE_EXECUTIVE,
]);

const PRODUCTION_ROLES = Object.freeze([
  USER_ROLES.PRODUCTION_EXECUTIVE,
  USER_ROLES.COMMUNITY_MANAGER,
]);

const LEAD_MANAGEMENT_ROLES = Object.freeze([
  ...PLATFORM_ADMIN_ROLES,
  ...MANAGEMENT_ROLES,
]);

const ROLE_LABELS = Object.freeze({
  [USER_ROLES.SUPER_ADMIN]: "Super Admin",
  [USER_ROLES.ADMIN]: "Admin",
  [USER_ROLES.MANAGER]: "Manager",
  [USER_ROLES.INSIDE_EXECUTIVE]: "Inside Executive",
  [USER_ROLES.EXECUTIVE]: "Executive",
  [USER_ROLES.FIELD_EXECUTIVE]: "Field Executive",
  [USER_ROLES.PRODUCTION_EXECUTIVE]: "Production Executive",
  [USER_ROLES.COMMUNITY_MANAGER]: "Community Manager",
  [USER_ROLES.CHANNEL_PARTNER]: "Channel Partner",
  [USER_ROLES.COWORKING_ADMIN]: "Coworking admin",
});

/*
 * One line saying what a role is for, printed under its name on the roles
 * screen. Kept beside the labels because it is the same kind of thing - how a
 * role is presented, not what it may do, which is the permission list.
 */
const ROLE_DESCRIPTIONS = Object.freeze({
  [USER_ROLES.ADMIN]: "Full system access.",
  [USER_ROLES.MANAGER]: "Manage leads, team and reports.",
  [USER_ROLES.INSIDE_EXECUTIVE]: "Qualify and route incoming leads.",
  [USER_ROLES.EXECUTIVE]: "Leads, tasks and inventory view.",
  [USER_ROLES.FIELD_EXECUTIVE]: "Site visits and field updates.",
  [USER_ROLES.PRODUCTION_EXECUTIVE]: "Projects and fit-out delivery.",
  [USER_ROLES.COMMUNITY_MANAGER]: "Members, spaces and day-to-day ops.",
  [USER_ROLES.CHANNEL_PARTNER]: "Refer clients and track their leads.",
  [USER_ROLES.COWORKING_ADMIN]: "Bookings, contracts and coworking billing.",
});

/*
 * Who each role reports to. Every role except Admin reports to a Manager, and
 * a Manager reports to an Admin (business rule, 29 Sep 2026).
 */
const ROLE_PARENT_RULES = Object.freeze({
  [USER_ROLES.SUPER_ADMIN]: [],
  [USER_ROLES.ADMIN]: [],
  [USER_ROLES.MANAGER]: [USER_ROLES.ADMIN],
  [USER_ROLES.INSIDE_EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.FIELD_EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.PRODUCTION_EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.COMMUNITY_MANAGER]: [USER_ROLES.MANAGER],
  [USER_ROLES.CHANNEL_PARTNER]: [USER_ROLES.MANAGER],
  [USER_ROLES.COWORKING_ADMIN]: [USER_ROLES.MANAGER],
});

const AUTO_PARENT_POOL_BY_ROLE = Object.freeze({
  [USER_ROLES.ADMIN]: [USER_ROLES.SUPER_ADMIN],
  [USER_ROLES.MANAGER]: [USER_ROLES.ADMIN],
  [USER_ROLES.INSIDE_EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.FIELD_EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.PRODUCTION_EXECUTIVE]: [USER_ROLES.MANAGER],
  [USER_ROLES.COMMUNITY_MANAGER]: [USER_ROLES.MANAGER],
  [USER_ROLES.CHANNEL_PARTNER]: [USER_ROLES.MANAGER],
  [USER_ROLES.COWORKING_ADMIN]: [USER_ROLES.MANAGER],
});

const DEFAULT_DESCENDANT_DEPTH = 8;

const isManagementRole = (role) => MANAGEMENT_ROLES.includes(role);
const isPlatformAdminRole = (role) => PLATFORM_ADMIN_ROLES.includes(role);
const isSuperAdminRole = (role) => role === USER_ROLES.SUPER_ADMIN;
const isExecutiveRole = (role) => EXECUTIVE_ROLES.includes(role);
const isProductionRole = (role) => PRODUCTION_ROLES.includes(role);
const isLeadManagementRole = (role) => LEAD_MANAGEMENT_ROLES.includes(role);

const getAllowedParentRoles = (role) => ROLE_PARENT_RULES[role] || [];
const getAutoParentRoles = (role) => AUTO_PARENT_POOL_BY_ROLE[role] || [];

module.exports = {
  USER_ROLES,
  PLATFORM_ADMIN_ROLES,
  COWORKING_ROLES,
  MANAGEMENT_ROLES,
  EXECUTIVE_ROLES,
  LEAD_OWNER_ROLES,
  MANUAL_LEAD_TRANSFER_TARGET_ROLES,
  INSIDE_EXECUTIVE_ROLES,
  PRODUCTION_ROLES,
  LEAD_MANAGEMENT_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_PARENT_RULES,
  AUTO_PARENT_POOL_BY_ROLE,
  DEFAULT_DESCENDANT_DEPTH,
  isManagementRole,
  isPlatformAdminRole,
  isSuperAdminRole,
  isExecutiveRole,
  isProductionRole,
  isLeadManagementRole,
  getAllowedParentRoles,
  getAutoParentRoles,
};
