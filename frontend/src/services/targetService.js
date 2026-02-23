import api from "./api";

export const getMyTargets = async (params = {}) => {
  const res = await api.get("/targets/my", { params });
  return {
    month: res.data?.month || "",
    canAssign: Boolean(res.data?.canAssign),
    allowedChildRoles: res.data?.allowedChildRoles || [],
    assignableReports: res.data?.assignableReports || [],
    myTarget: res.data?.myTarget || null,
    incoming: res.data?.incoming || [],
    outgoing: res.data?.outgoing || [],
  };
};

export const assignHierarchyTarget = async (payload) => {
  const res = await api.post("/targets/assign", payload);
  return {
    month: res.data?.month || "",
    target: res.data?.target || null,
    message: res.data?.message || "Target assigned successfully",
  };
};
