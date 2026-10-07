import api from "./api";
import type { Lead } from "../types";

const LEAD_STATUS_REVIEW_ENABLED = String(process.env.EXPO_PUBLIC_ENABLE_LEAD_STATUS_REVIEW || "true").trim().toLowerCase() !== "false";

export type CompanyPerformanceOverview = {
  summary: {
    totalLeads: number;
    closed: number;
    closeVelocity: number;
  };
  weekly: Array<{
    label: string;
    created: number;
    closed: number;
    open: number;
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    role: string;
    assigned: number;
    closed: number;
    visits: number;
    scorePercent: number;
  }>;
  range?: "ALL" | "THIS_MONTH" | "CUSTOM" | string;
  periodLabel?: string;
  generatedAt?: string;
};

/*
 * The server always paginates, so a bare GET /leads returns the first page -
 * not the whole table. Mobile used to make exactly that bare call, which meant
 * every screen built on this (the pipeline, the dashboards, the sale-lead
 * picker, tasks) silently showed only the first page of leads.
 *
 * This walks the pages the way frontend/src/services/leadService.js does, with
 * the same page size and the same cap. The real fix on both sides is for those
 * screens to ask for an aggregate rather than every lead.
 */
const LEAD_PAGE_SIZE = 200;
const MAX_LEAD_PAGES = 25;

export const getAllLeads = async (params: Record<string, unknown> = {}): Promise<Lead[]> => {
  const first = await api.get("/leads", {
    params: { limit: LEAD_PAGE_SIZE, page: 1, ...params },
  });
  const rows: Lead[] = first.data?.leads || [];

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

/*
 * One lead, by id. Mirrors getLeadById in the web service.
 *
 * The backend scopes this through findAccessibleLeadById and 404s a lead the
 * caller is not entitled to - which is exactly why the detail screen must use
 * it rather than filtering a full list client-side.
 */
export const getLeadById = async (leadId: string): Promise<Lead | null> => {
  const id = String(leadId || "").trim();
  if (!id) return null;
  const res = await api.get(`/leads/${id}`);
  return res.data?.lead || null;
};

export const getCompanyPerformanceOverview = async (
  params: {
    range?: "ALL" | "THIS_MONTH" | "CUSTOM";
    month?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<CompanyPerformanceOverview | null> => {
  const res = await api.get("/leads/performance/overview", { params });
  return res.data?.overview || null;
};

export const createLead = async (payload: Partial<Lead>): Promise<Lead> => {
  const res = await api.post("/leads", payload);
  return res.data?.lead;
};

export const updateLeadBasics = async (
  leadId: string,
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
    projectInterested?: string;
    source?: string;
  },
): Promise<Lead | null> => {
  const res = await api.patch(`/leads/${leadId}`, payload);
  return res.data?.lead || null;
};

export const updateLeadStatus = async (leadId: string, payload: Partial<Lead>): Promise<Lead> => {
  const res = await api.patch(`/leads/${leadId}/status`, payload);
  return res.data?.lead;
};

const isFollowUpCleared = (lead: any) => {
  const value = lead?.nextFollowUp;
  return value === null || value === undefined || String(value).trim() === "";
};

export const clearLeadFollowUp = async (leadId: string, status = "NEW"): Promise<Lead | null> => {
  let lastLead: Lead | null = null;

  try {
    const res = await api.patch(`/leads/${leadId}/status`, { status, nextFollowUp: null });
    lastLead = res.data?.lead || null;
    if (isFollowUpCleared(lastLead)) return lastLead;
  } catch {}

  try {
    const res = await api.patch(`/leads/${leadId}/status`, { status, nextFollowUp: "" });
    lastLead = res.data?.lead || null;
    if (isFollowUpCleared(lastLead)) return lastLead;
  } catch {}

  try {
    const res = await api.patch(`/leads/${leadId}`, { nextFollowUp: null });
    lastLead = res.data?.lead || null;
    if (isFollowUpCleared(lastLead)) return lastLead;
  } catch {}

  try {
    const res = await api.patch(`/leads/${leadId}`, { nextFollowUp: "" });
    lastLead = res.data?.lead || null;
    if (isFollowUpCleared(lastLead)) return lastLead;
  } catch {}

  return lastLead;
};

export const assignLead = async (leadId: string, executiveId: string): Promise<Lead> => {
  const res = await api.patch(`/leads/${leadId}/assign`, { executiveId });
  return res.data?.lead;
};

export const addLeadRelatedProperty = async (leadId: string, inventoryId: string): Promise<Lead | null> => {
  const res = await api.patch(`/leads/${leadId}/properties`, { inventoryId });
  return res.data?.lead || null;
};

export const selectLeadRelatedProperty = async (leadId: string, inventoryId: string): Promise<Lead | null> => {
  const res = await api.patch(`/leads/${leadId}/properties/${inventoryId}/select`);
  return res.data?.lead || null;
};

export const removeLeadRelatedProperty = async (leadId: string, inventoryId: string): Promise<Lead | null> => {
  const res = await api.delete(`/leads/${leadId}/properties/${inventoryId}`);
  return res.data?.lead || null;
};

export const getLeadActivity = async (leadId: string): Promise<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>> => {
  const res = await api.get(`/leads/${leadId}/activity`);
  return res.data?.activities || [];
};

/** Activity plus pagination meta. Mirrors getLeadActivityWithMeta on web. */
export const getLeadActivityWithMeta = async (
  leadId: string,
  params: Record<string, unknown> = {},
) => {
  const res = await api.get(`/leads/${leadId}/activity`, { params });
  return {
    activities: Array.isArray(res.data?.activities) ? res.data.activities : [],
    pagination: res.data?.pagination || null,
  };
};

/*
 * Bulk import. Web parses the spreadsheet with xlsx and posts rows; on mobile
 * the file arrives through expo-document-picker, so the caller parses it and
 * hands the rows here. The long timeout matches web - a large import is slow.
 */
export const bulkUploadLeads = async (rows: Record<string, unknown>[] = []) => {
  const res = await api.post("/leads/bulk", { rows }, { timeout: 120000 });
  return res.data || {};
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
  closureDocuments?: Array<{
    url?: string;
    kind?: "image" | "pdf" | "file" | string;
    mimeType?: string;
    name?: string;
    size?: number;
  }>;
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
    closureDocuments?: Array<{
      url: string;
      kind?: "image" | "pdf" | "file" | string;
      mimeType?: string;
      name?: string;
      size?: number;
    }>;
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

export const getLeadStatusRequests = async (
  params: { leadId?: string; status?: "pending" | "approved" | "rejected" } = {},
): Promise<LeadStatusRequest[]> => {
  if (!LEAD_STATUS_REVIEW_ENABLED) return [];
  const res = await api.get("/leads/status-requests", { params });
  return res.data?.requests || [];
};

export const getPendingLeadStatusRequests = async (params: { leadId?: string } = {}): Promise<LeadStatusRequest[]> => {
  if (!LEAD_STATUS_REVIEW_ENABLED) return [];
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

export type LeadPaymentApprovalRequest = Lead & {
  dealPayment?: {
    mode?: string;
    paymentType?: string;
    remainingAmount?: number;
    paymentReference?: string;
    note?: string;
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | string;
    approvalNote?: string;
    approvalRequestedAt?: string;
    approvalReviewedAt?: string;
    approvalRequestedBy?: { _id?: string; name?: string; role?: string };
    approvalReviewedBy?: { _id?: string; name?: string; role?: string };
  };
};

export const getLeadPaymentRequests = async (
  params: { approvalStatus?: "ALL" | "PENDING" | "APPROVED" | "REJECTED"; limit?: number } = {},
): Promise<LeadPaymentApprovalRequest[]> => {
  const res = await api.get("/leads/payment-requests", { params });
  return Array.isArray(res.data?.requests) ? res.data.requests : [];
};

export const reviewLeadPaymentRequest = async (
  leadId: string,
  payload: {
    status: string;
    approvalStatus: "APPROVED" | "REJECTED";
    approvalNote?: string;
  },
): Promise<Lead | null> => {
  const res = await api.patch(`/leads/${leadId}/status`, {
    status: payload.status,
    dealPayment: {
      approvalStatus: payload.approvalStatus,
      approvalNote: String(payload.approvalNote || "").trim(),
    },
  });
  return res.data?.lead || null;
};
