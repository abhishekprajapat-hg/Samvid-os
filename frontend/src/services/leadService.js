import api from "./api";

export const getLeadPool = async () => {
  const res = await api.get("/leads");
  return res.data;
};

export const getAllLeads = async () => {
  const res = await api.get("/leads");
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

export const getLeadActivity = async (leadId) => {
  const res = await api.get(`/leads/${leadId}/activity`);
  return res.data?.activities || [];
};
