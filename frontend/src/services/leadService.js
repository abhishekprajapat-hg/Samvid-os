import api from "./api";

export const getLeadPool = async (params = {}) => {
  const res = await api.get("/leads", { params });
  return res.data;
};

/*
 * The server now always paginates, so a bare GET /leads returns the first page
 * rather than the whole table. Seven screens (Finance, Reports, Leaderboard,
 * Team Manager, Field Ops, Tasks, Admin Console) were written against the old
 * "returns everything" behaviour, so this walks the pages for them instead of
 * silently handing back 25 rows.
 *
 * Each response is bounded and the walk stops at MAX_LEAD_PAGES, which caps
 * what one screen can pull. That keeps those screens correct today; the real
 * fix is for them to ask for an aggregate rather than every lead, and each one
 * should move to a summary endpoint or an explicit filter.
 */
const LEAD_PAGE_SIZE = 200;
const MAX_LEAD_PAGES = 25;

export const getAllLeads = async (params = {}) => {
  const first = await api.get("/leads", {
    params: { limit: LEAD_PAGE_SIZE, page: 1, ...params },
  });
  const rows = first.data?.leads || [];

  // An explicit page/limit from the caller means they are driving pagination
  // themselves, so hand back exactly the page they asked for.
  if (params.page !== undefined || params.limit !== undefined) return rows;

  let pageInfo = first.data?.pagination;
  let page = 1;
  while (pageInfo?.hasNextPage && page < MAX_LEAD_PAGES) {
    page += 1;
    const next = await api.get("/leads", {
      params: { limit: LEAD_PAGE_SIZE, page, ...params },
    });
    rows.push(...(next.data?.leads || []));
    pageInfo = next.data?.pagination;
  }

  return rows;
};

export const getLeadById = async (leadId) => {
  const res = await api.get(`/leads/${leadId}`);
  return res.data?.lead || null;
};

export const getLeadPaymentRequests = async (params = {}) => {
  const res = await api.get("/leads/payment-requests", { params });
  return res.data?.requests || [];
};

export const createLead = async (payload) => {
  const res = await api.post("/leads", payload);
  return res.data?.lead;
};

export const bulkUploadLeads = async (rows = []) => {
  const res = await api.post("/leads/bulk", { rows }, { timeout: 120000 });
  return res.data || {};
};

export const updateLeadStatus = async (leadId, payload) => {
  const res = await api.patch(`/leads/${leadId}/status`, payload);
  return res.data?.lead;
};

export const assignLead = async (leadId, payloadOrUserId) => {
  const payload =
    typeof payloadOrUserId === "object" && payloadOrUserId !== null
      ? payloadOrUserId
      : { assignedTo: payloadOrUserId };
  const res = await api.patch(`/leads/${leadId}/assign`, payload);
  return res.data?.lead;
};

export const addLeadRelatedProperty = async (leadId, inventoryId) => {
  const res = await api.patch(`/leads/${leadId}/properties`, { inventoryId });
  return res.data?.lead || null;
};

export const selectLeadRelatedProperty = async (leadId, inventoryId) => {
  const res = await api.patch(`/leads/${leadId}/properties/${inventoryId}/select`);
  return res.data?.lead || null;
};

export const removeLeadRelatedProperty = async (leadId, inventoryId) => {
  const res = await api.delete(`/leads/${leadId}/properties/${inventoryId}`);
  return res.data?.lead || null;
};

export const getLeadActivity = async (leadId, params = {}, options = {}) => {
  const res = await api.get(`/leads/${leadId}/activity`, { params });
  if (options.withMeta) {
    return {
      activities: res.data?.activities || [],
      pagination: res.data?.pagination || null,
    };
  }

  return res.data?.activities || [];
};

export const getLeadActivityWithMeta = async (leadId, params = {}) => {
  const res = await api.get(`/leads/${leadId}/activity`, { params });
  return {
    activities: res.data?.activities || [],
    pagination: res.data?.pagination || null,
  };
};

export const getLeadDiary = async (leadId, params = {}, options = {}) => {
  const res = await api.get(`/leads/${leadId}/diary`, { params });
  if (options.withMeta) {
    return {
      entries: res.data?.entries || [],
      pagination: res.data?.pagination || null,
    };
  }

  return res.data?.entries || [];
};

export const addLeadDiaryEntry = async (leadId, note) => {
  const res = await api.post(`/leads/${leadId}/diary`, { note });
  return res.data?.entry || null;
};

export const updateLeadDiaryEntry = async (leadId, entryId, note) => {
  const res = await api.patch(`/leads/${leadId}/diary/${entryId}`, { note });
  return res.data?.entry || null;
};
