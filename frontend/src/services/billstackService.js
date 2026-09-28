import api from './api';
const path = (type, id) => `/billing/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
export const getBillingStatus = async (type, id) => (await api.get(path(type, id))).data;
export const retryBillingSync = async (type, id) => (await api.post(`${path(type, id)}/sync`, {}, { timeout: 30000 })).data;
export const createBillingHandoff = async (type, id) => (await api.post(`${path(type, id)}/handoff`, {}, { timeout: 45000 })).data;
