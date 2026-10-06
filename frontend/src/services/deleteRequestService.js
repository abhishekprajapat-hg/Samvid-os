import api from "./api";

/*
 * Delete requests: a Manager's delete waits for an Admin's approval
 * (business rule, 29 Sep 2026). The delete routes answer a Manager with
 * 202 { approvalRequired: true, deleteRequest } instead of deleting.
 */

export const DELETE_REQUEST_SENT_MESSAGE = "Delete request sent to Admin for approval.";

// True when a delete call only queued a request for Admin approval.
export const isDeleteApprovalPending = (result) => Boolean(result?.approvalRequired);

// The message to show after a delete call, whichever way it went.
export const deleteOutcomeMessage = (result, deletedMessage = "Deleted") => (
  isDeleteApprovalPending(result)
    ? (result?.message || DELETE_REQUEST_SENT_MESSAGE)
    : deletedMessage
);

export const getDeleteRequests = async ({ status = "PENDING" } = {}) => {
  const res = await api.get("/delete-requests", { params: { status } });
  return Array.isArray(res.data?.requests) ? res.data.requests : [];
};

export const approveDeleteRequest = async (requestId, note = "") => {
  const res = await api.post(`/delete-requests/${requestId}/approve`, { note });
  return res.data || null;
};

export const rejectDeleteRequest = async (requestId, note = "") => {
  const res = await api.post(`/delete-requests/${requestId}/reject`, { note });
  return res.data || null;
};

export const cancelDeleteRequest = async (requestId) => {
  const res = await api.post(`/delete-requests/${requestId}/cancel`);
  return res.data || null;
};
