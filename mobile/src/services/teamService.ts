import api from "./api";

/*
 * The team screens' calls.
 *
 * `userService` stays what it is - the account-shaped calls the rest of the
 * app already makes. This adds the two the team comps need and nothing else:
 * the employment patch, which goes to the admin route rather than the one
 * `updateUserByAdmin` there points at, and the company's roles with what each
 * may reach.
 */

/* --------------------------------------------------------------- members -- */

export type TeamMemberPatch = {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  customRoleId?: string | null;
  reportingToId?: string | null;
  isActive?: boolean;
  employeeId?: string;
  department?: string;
  branch?: string;
  shiftTiming?: string;
  joiningDate?: string | null;
  monthlyTarget?: number;
  leadCapacity?: number;
  taskCapacity?: number;
  mustChangePassword?: boolean;
  password?: string;
};

/*
 * PATCH /users/admin/:id, not /users/:id.
 *
 * The two differ: the plain route takes name, phone, active and - for an
 * admin - role and reporting line, and silently drops everything else. The
 * admin route is the one that reads the employment block, so that is the one
 * an employment edit has to use or the save appears to work and changes
 * nothing.
 */
export const updateTeamMember = async (userId: string, payload: TeamMemberPatch) => {
  const res = await api.patch(`/users/admin/${userId}`, payload);
  return res.data?.user || null;
};

/* ----------------------------------------------------------------- roles -- */

export type RoleMember = {
  _id?: string;
  name?: string;
  isActive?: boolean;
  profileImageUrl?: string;
};

export type RoleRow = {
  key: string;
  label: string;
  description: string;
  permissions: string[];
  /*
   * What this role's holders reach, already resolved: its own page grants when
   * it has any, the built-in defaults otherwise. The matrix shows a handful of
   * these and writes the whole list back, so the ones it does not draw have to
   * come along or a save would drop them.
   */
  pageAccess: Array<{ pageKey: string; actions: string[] }>;
  isOverridden: boolean;
  /** ADMIN reaches everything by definition, so its list cannot be edited. */
  isFixed: boolean;
  memberIds: RoleMember[];
  memberCount: number;
  updatedAt?: string | null;
};

export type CustomRoleRow = {
  key: string;
  customRoleId: string;
  label: string;
  description: string;
  baseRole: string;
  baseRoleLabel: string;
  businessCategory: string;
  memberIds: RoleMember[];
  memberCount: number;
};

export type PageCatalogueRow = {
  key: string;
  label: string;
  group: string;
  path: string;
  actions: string[];
  alwaysAccessible?: boolean;
};

export const getRolesWithPermissions = async (): Promise<{
  pages: PageCatalogueRow[];
  roles: RoleRow[];
  customRoles: CustomRoleRow[];
}> => {
  const res = await api.get("/access/roles");
  return {
    pages: Array.isArray(res.data?.pages) ? res.data.pages : [],
    roles: Array.isArray(res.data?.roles) ? res.data.roles : [],
    customRoles: Array.isArray(res.data?.customRoles) ? res.data.customRoles : [],
  };
};

export const saveRolePermissions = async (role: string, permissions: string[]) => {
  const res = await api.patch(`/access/roles/${role}`, { permissions });
  return {
    message: String(res.data?.message || "Permissions saved"),
    role: (res.data?.role || null) as RoleRow | null,
  };
};
