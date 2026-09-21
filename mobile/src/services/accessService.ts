import api from "./api";

/* Mirrors frontend/src/services/accessService.js. */

export type MyAccess = {
  role: string;
  isAdmin: boolean;
  permissions: string[];
  pages: string[];
  dataScope: string;
  enforcePageAccess: boolean;
};

const unwrapList = (value: unknown): string[] => (Array.isArray(value) ? value : []);

/** The signed-in account's effective permissions, page access and data scope. */
export const getMyAccess = async (): Promise<MyAccess> => {
  const res = await api.get("/access/me");
  const access = res.data?.access || {};
  return {
    role: String(access.role || ""),
    isAdmin: Boolean(access.isAdmin),
    permissions: unwrapList(access.permissions),
    pages: unwrapList(access.pages),
    dataScope: String(access.dataScope || "ASSIGNED"),
    enforcePageAccess: Boolean(access.enforcePageAccess),
  };
};

export type PageCatalogueEntry = {
  key: string;
  label: string;
  group: string;
  path: string;
  actions: string[];
  alwaysAccessible?: boolean;
};

/*
 * The page catalogue. Web reads this from the API rather than hardcoding the
 * list, and so does mobile - adding a page on the backend should not require a
 * mobile release.
 */
export const getPageCatalogue = async (): Promise<PageCatalogueEntry[]> => {
  const res = await api.get("/access/catalog");
  const pages = res.data?.pages || res.data?.catalog || res.data;
  return Array.isArray(pages) ? pages : [];
};

/** [ADMIN] A specific user's page configuration. */
export const getUserPageAccess = async (userId: string) => {
  const res = await api.get(`/access/users/${userId}/pages`);
  return {
    pages: unwrapList(res.data?.pages),
    enforcePageAccess: Boolean(res.data?.enforcePageAccess),
  };
};

/** [ADMIN] Replace a user's page configuration. */
export const updateUserPageAccess = async (
  userId: string,
  payload: { pages?: string[]; enforcePageAccess?: boolean },
) => {
  const res = await api.patch(`/access/users/${userId}/pages`, payload);
  return {
    message: String(res.data?.message || "Page access updated"),
    pages: unwrapList(res.data?.pages),
    enforcePageAccess: Boolean(res.data?.enforcePageAccess),
  };
};
