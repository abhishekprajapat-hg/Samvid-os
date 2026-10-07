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

export type PageGrant = { pageKey: string; actions: string[] };

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

/*
 * [ADMIN] A specific user's page configuration.
 *
 * The route answers with three things, and they are not interchangeable:
 * `pages` is the whole catalogue, `pageKeys` is which of them this person
 * reaches, and `pageAccess` is that with the actions. Reading the catalogue as
 * though it were the grant made every page look granted.
 */
export const getUserPageAccess = async (userId: string) => {
  const res = await api.get(`/access/users/${userId}/pages`);
  return {
    catalogue: (Array.isArray(res.data?.pages) ? res.data.pages : []) as PageCatalogueEntry[],
    pageKeys: unwrapList(res.data?.pageKeys),
    pageAccess: (Array.isArray(res.data?.pageAccess) ? res.data.pageAccess : []) as PageGrant[],
    usesRoleDefaults: Boolean(res.data?.usesRoleDefaults),
  };
};

/*
 * [ADMIN] Replace a user's page configuration.
 *
 * The route reads `pageAccess` for the action-aware shape and `pageKeys` for
 * the older list of page keys, and rejects a body carrying neither. It was
 * being sent `pages`, which is the name the response uses, so every call
 * answered 400 - send what the route reads.
 *
 * `null` means "go back to the role defaults", which is why both keys are
 * nullable rather than optional-and-empty: an empty array is a deliberate
 * "grant nothing" and the route treats it that way.
 */
export const updateUserPageAccess = async (
  userId: string,
  payload: {
    pageAccess?: PageGrant[] | null;
    pageKeys?: string[] | null;
    enforcePageAccess?: boolean;
  },
) => {
  const res = await api.patch(`/access/users/${userId}/pages`, payload);
  return {
    message: String(res.data?.message || "Page access updated"),
    pages: unwrapList(res.data?.pageKeys),
    pageAccess: (Array.isArray(res.data?.pageAccess) ? res.data.pageAccess : []) as PageGrant[],
    usesRoleDefaults: Boolean(res.data?.usesRoleDefaults),
  };
};
