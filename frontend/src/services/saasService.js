import api from "./api";

export const listCompanies = async (params = {}) => {
  const res = await api.get("/saas/companies", { params });
  return {
    page: Number(res.data?.page || 1),
    limit: Number(res.data?.limit || 20),
    total: Number(res.data?.total || 0),
    companies: Array.isArray(res.data?.companies) ? res.data.companies : [],
  };
};

export const createCompany = async (payload = {}) => {
  const res = await api.post("/saas/companies", payload);
  return res.data;
};

export const updateCompany = async (companyId, payload = {}) => {
  const res = await api.patch(`/saas/companies/${companyId}`, payload);
  return res.data;
};

export const deleteCompany = async (companyId) => {
  const res = await api.delete(`/saas/companies/${companyId}`);
  return res.data;
};

export const resetCompanyAdminPassword = async (companyId, payload = {}) => {
  const res = await api.post(`/saas/companies/${companyId}/admin/reset-password`, payload);
  return res.data;
};

export const getMyTenantMetaIntegration = async () => {
  const res = await api.get("/saas/tenant/meta");
  return res.data?.integration || null;
};

export const updateMyTenantMetaIntegration = async (payload = {}) => {
  const res = await api.patch("/saas/tenant/meta", payload);
  return res.data?.integration || null;
};

export const listPlans = async () => {
  const res = await api.get("/saas/plans");
  return Array.isArray(res.data?.plans) ? res.data.plans : [];
};

export const createPlan = async (payload = {}) => {
  const res = await api.post("/saas/plans", payload);
  return res.data;
};

export const updatePlan = async (planId, payload = {}) => {
  const res = await api.patch(`/saas/plans/${planId}`, payload);
  return res.data;
};

export const assignSubscription = async (payload = {}) => {
  const res = await api.post("/saas/subscriptions/assign", payload);
  return res.data;
};

export const getCompanyUsage = async (companyId) => {
  const res = await api.get(`/saas/usage/${companyId}`);
  return {
    company: res.data?.company || null,
    usage: res.data?.usage || null,
    timestamp: res.data?.timestamp || "",
  };
};

export const getGlobalAnalytics = async () => {
  const res = await api.get("/saas/analytics/global");
  return {
    overview: res.data?.overview || {},
    topCompanies: Array.isArray(res.data?.topCompanies) ? res.data.topCompanies : [],
    generatedAt: res.data?.generatedAt || "",
  };
};
