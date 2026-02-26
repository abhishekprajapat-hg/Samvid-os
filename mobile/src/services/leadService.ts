import api from "./api";
import type { Lead } from "../types";

export const getAllLeads = async (): Promise<Lead[]> => {
  const res = await api.get("/leads");
  return res.data?.leads || [];
};

export const createLead = async (payload: Partial<Lead>): Promise<Lead> => {
  const res = await api.post("/leads", payload);
  return res.data?.lead;
};

export const updateLeadStatus = async (leadId: string, payload: Partial<Lead>): Promise<Lead> => {
  const res = await api.patch(`/leads/${leadId}/status`, payload);
  return res.data?.lead;
};

export const assignLead = async (leadId: string, executiveId: string): Promise<Lead> => {
  const res = await api.patch(`/leads/${leadId}/assign`, { executiveId });
  return res.data?.lead;
};

export const getLeadActivity = async (leadId: string): Promise<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>> => {
  const res = await api.get(`/leads/${leadId}/activity`);
  return res.data?.activities || [];
};