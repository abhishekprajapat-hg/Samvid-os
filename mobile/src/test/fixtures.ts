import type { User, UserRole } from "../types";

export const supportedRoles: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "INSIDE_EXECUTIVE",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "PRODUCTION_EXECUTIVE",
  "CHANNEL_PARTNER",
];

export const makeUser = (role: UserRole = "ADMIN", patch: Partial<User> = {}): User => ({
  _id: `${role.toLowerCase()}-user`,
  name: `${role} User`,
  email: `${role.toLowerCase()}@example.com`,
  role,
  isActive: true,
  ...patch,
});
