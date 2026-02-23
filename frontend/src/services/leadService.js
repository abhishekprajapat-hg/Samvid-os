import api from "./api";

export const getLeadPool = async (params = {}) => {
  const res = await api.get("/leads", { params });
  return res.data;
};

export const getAllLeads = async (params = {}) => {
  const res = await api.get("/leads", { params });
  return res.data?.leads || [];
};

export const createLead = async (payload) => {
  const res = await api.post("/leads", payload);
  return res.data?.lead;
};

export const updateLeadStatus = async (leadId, payload) => {
  const res = await api.patch(`/leads/${leadId}/status`, payload);
  return res.data?.lead;
};

export const assignLead = async (leadId, executiveId) => {
  const res = await api.patch(`/leads/${leadId}/assign`, { executiveId });
  return res.data?.lead;
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
