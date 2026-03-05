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

export type LeadDiaryEntry = {
  _id: string;
  note?: string;
  conversation?: string;
  visitDetails?: string;
  nextStep?: string;
  conversionDetails?: string;
  voiceNoteUrl?: string;
  voiceNoteName?: string;
  isEdited?: boolean;
  lastEditedAt?: string | null;
  lastEditedBy?: { _id?: string; name?: string; role?: string };
  editHistory?: Array<{
    previousNote?: string;
    updatedNote?: string;
    editedAt?: string;
    editedBy?: { _id?: string; name?: string; role?: string };
  }>;
  createdAt: string;
  createdBy?: { _id?: string; name?: string; role?: string };
};

export const getLeadDiary = async (leadId: string): Promise<LeadDiaryEntry[]> => {
  const res = await api.get(`/leads/${leadId}/diary`);
  return res.data?.entries || [];
};

export const addLeadDiaryEntry = async (
  leadId: string,
  payload: {
    note?: string;
    conversation?: string;
    visitDetails?: string;
    nextStep?: string;
    conversionDetails?: string;
    voiceNoteUrl?: string;
    voiceNoteName?: string;
  },
): Promise<LeadDiaryEntry | null> => {
  const res = await api.post(`/leads/${leadId}/diary`, payload);
  return res.data?.entry || null;
};

export const updateLeadDiaryEntry = async (
  leadId: string,
  entryId: string,
  payload: { note: string },
): Promise<LeadDiaryEntry | null> => {
  const res = await api.patch(`/leads/${leadId}/diary/${entryId}`, payload);
  return res.data?.entry || null;
};

export type LeadStatusRequest = {
  _id: string;
  proposedStatus: string;
  proposedNextFollowUp?: string | null;
  proposedSaleMeta?: {
    leadId?: string;
    leadName?: string;
    paymentMode?: "Cash" | "Cheque" | "Bank Transfer" | "UPI" | string;
    totalAmount?: number | null;
    partialAmount?: number | null;
    remainingAmount?: number | null;
    remainingDueDate?: string;
    paymentDate?: string;
    cheque?: {
      bankName?: string;
      chequeNumber?: string;
      chequeDate?: string;
    };
    bankTransfer?: {
      transferType?: "RTGS" | "IMPS" | "NEFT" | string;
      utrNumber?: string;
    };
    upi?: {
      transactionId?: string;
    };
  } | null;
  attachment?: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    size?: number;
    storagePath?: string;
  } | null;
  requestNote: string;
  status: "pending" | "approved" | "rejected";
  requestedBy?: { _id?: string; name?: string; role?: string };
  lead?: { _id?: string; name?: string; status?: string; nextFollowUp?: string };
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: { _id?: string; name?: string; role?: string };
  reviewNote?: string;
  rejectionReason?: string;
};

export const requestLeadStatusChange = async (
  leadId: string,
  payload: {
    status: string;
    nextFollowUp?: string;
    requestNote?: string;
    attachment?: {
      fileName?: string;
      fileUrl?: string;
      mimeType?: string;
      size?: number;
      storagePath?: string;
    };
    saleMeta?: {
      leadId?: string;
      leadName?: string;
      paymentMode: string;
      totalAmount: number;
      partialAmount: number;
      remainingAmount: number;
      remainingDueDate?: string;
      paymentDate?: string;
      cheque?: { bankName: string; chequeNumber: string; chequeDate: string };
      bankTransfer?: { transferType: string; utrNumber: string };
      upi?: { transactionId: string };
    };
  },
): Promise<LeadStatusRequest | null> => {
  const res = await api.post(`/leads/${leadId}/status-request`, payload);
  return res.data?.request || null;
};

export const getPendingLeadStatusRequests = async (params: { leadId?: string } = {}): Promise<LeadStatusRequest[]> => {
  const res = await api.get("/leads/status-requests/pending", { params });
  return res.data?.requests || [];
};

export const approveLeadStatusRequest = async (
  requestId: string,
  payload: { reviewNote?: string } = {},
): Promise<{ lead?: Lead; request?: LeadStatusRequest }> => {
  const res = await api.patch(`/leads/status-requests/${requestId}/approve`, payload);
  return {
    lead: res.data?.lead,
    request: res.data?.request,
  };
};

export const rejectLeadStatusRequest = async (
  requestId: string,
  rejectionReason: string,
): Promise<{ request?: LeadStatusRequest }> => {
  const res = await api.patch(`/leads/status-requests/${requestId}/reject`, { rejectionReason });
  return {
    request: res.data?.request,
  };
};
