import api from "./api";

/* Mirrors frontend/src/services/saasService.js. Tenant-level settings and the
 * Meta lead-ads integration, both gated on ADMIN/MANAGER by the backend. */

export type MetaIntegration = {
  companyName?: string;
  subdomain?: string;
  pageIds?: string[];
  accessTokenConfigured?: boolean;
  accessTokenPreview?: string;
  webhook?: {
    globalCallbackUrl?: string;
    tenantScopedCallbackUrl?: string;
    verifyTokenConfigured?: boolean;
  } | null;
  readiness?: {
    ready?: boolean;
    missing?: string[];
    [key: string]: unknown;
  } | null;
};

export const getMyTenantMetaIntegration = async (): Promise<MetaIntegration | null> => {
  const res = await api.get("/saas/tenant/meta");
  return res.data?.integration || null;
};

export const updateMyTenantMetaIntegration = async (
  payload: Record<string, unknown> = {},
): Promise<MetaIntegration | null> => {
  const res = await api.patch("/saas/tenant/meta", payload);
  return res.data?.integration || null;
};

export const getMyTenantSettings = async () => {
  const res = await api.get("/saas/tenant/settings");
  return res.data?.settings || null;
};

export const updateMyTenantSettings = async (payload: Record<string, unknown> = {}) => {
  const res = await api.patch("/saas/tenant/settings", payload);
  return res.data?.settings || null;
};
