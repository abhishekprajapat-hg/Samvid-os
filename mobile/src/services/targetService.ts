import api from "./api";

export const getMyTargets = async (params: { month?: string } = {}) => {
  const res = await api.get("/targets/my", { params });
  return {
    month: String(res.data?.month || ""),
    canAssign: Boolean(res.data?.canAssign),
    allowedChildRoles: Array.isArray(res.data?.allowedChildRoles) ? res.data.allowedChildRoles : [],
    assignableReports: Array.isArray(res.data?.assignableReports) ? res.data.assignableReports : [],
    myTarget: res.data?.myTarget || null,
    incoming: Array.isArray(res.data?.incoming) ? res.data.incoming : [],
    outgoing: Array.isArray(res.data?.outgoing) ? res.data.outgoing : [],
  };
};

export const assignHierarchyTarget = async (payload: {
  assignedToId: string;
  month: string;
  leadsTarget: number;
  revenueTarget: number;
  siteVisitTarget: number;
  notes?: string;
}) => {
  const res = await api.post("/targets/assign", payload);
  return {
    month: String(res.data?.month || ""),
    target: res.data?.target || null,
    message: String(res.data?.message || "Target assigned successfully"),
  };
};

