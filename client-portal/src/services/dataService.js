import api from "./api";

export const getMyClient = async () => {
  const res = await api.get("/me/client");
  return res.data.client;
};

export const getMyInvoices = async (params = {}) => {
  const res = await api.get("/invoices", { params });
  return { invoices: res.data.invoices || [], pagination: res.data.pagination || null };
};

export const getMyInvoiceById = async (invoiceId) => {
  const res = await api.get(`/invoices/${invoiceId}`);
  return res.data.invoice;
};

export const getMyBookings = async (params = {}) => {
  const res = await api.get("/bookings", { params });
  return { bookings: res.data.bookings || [], pagination: res.data.pagination || null };
};

export const getMyContracts = async (params = {}) => {
  const res = await api.get("/contracts", { params });
  return { contracts: res.data.contracts || [], pagination: res.data.pagination || null };
};

export const getMyContractById = async (contractId) => {
  const res = await api.get(`/contracts/${contractId}`);
  return res.data.contract;
};

export const getMyDocuments = async () => {
  const res = await api.get("/documents");
  return res.data.documents || [];
};
