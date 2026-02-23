import api from "./api";

export const getInventoryAssets = async (params = {}) => {
  const res = await api.get("/inventory", { params });
  return res.data?.assets || [];
};

export const getInventoryAssetsWithMeta = async (params = {}) => {
  const res = await api.get("/inventory", { params });
  return {
    assets: res.data?.assets || [],
    inventory: res.data?.inventory || [],
    pagination: res.data?.pagination || null,
  };
};

export const getInventoryAssetById = async (assetId) => {
  const res = await api.get(`/inventory/${assetId}`);
  return {
    asset: res.data?.asset || null,
    inventory: res.data?.inventory || null,
  };
};

export const getInventoryAssetActivity = async (assetId, params = {}) => {
  const res = await api.get(`/inventory/${assetId}/activity`, { params });
  return res.data?.activities || [];
};

export const createInventoryAsset = async (payload) => {
  const res = await api.post("/inventory", payload);
  return res.data?.asset;
};

export const createInventoryCreateRequest = async (payload) => {
  const res = await api.post("/inventory-request", {
    proposedData: payload,
  });
  return res.data?.request || null;
};

export const updateInventoryAsset = async (assetId, payload) => {
  const res = await api.patch(`/inventory/${assetId}`, payload);
  return res.data?.asset;
};

export const deleteInventoryAsset = async (assetId) => {
  await api.delete(`/inventory/${assetId}`);
};

export const requestInventoryStatusChange = async (assetId, status) => {
  const res = await api.post(`/inventory-request/update/${assetId}`, {
    proposedData: { status },
  });

  return res.data?.request || null;
};

export const requestInventoryUpdateChange = async (assetId, proposedData) => {
  const res = await api.post(`/inventory-request/update/${assetId}`, {
    proposedData,
  });

  return res.data?.request || null;
};

export const getPendingInventoryRequests = async () => {
  const res = await api.get("/inventory-request/pending");
  return res.data?.requests || [];
};

export const approveInventoryRequest = async (requestId) => {
  const res = await api.patch(`/inventory-request/${requestId}/approve`);
  return res.data || null;
};

export const rejectInventoryRequest = async (requestId, rejectionReason) => {
  const res = await api.patch(`/inventory-request/${requestId}/reject`, {
    rejectionReason,
  });
  return res.data || null;
};
