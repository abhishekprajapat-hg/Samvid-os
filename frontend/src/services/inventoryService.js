import api from "./api";

const toInventoryTitle = (row = {}) => {
  const explicitTitle = String(row?.title || "").trim();
  if (explicitTitle) return explicitTitle;

  const parts = [row?.projectName, row?.towerName, row?.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.join(" - ") || "Inventory Unit";
};

const normalizeInventoryAsset = (row = {}) => ({
  ...row,
  title: toInventoryTitle(row),
});

export const getInventoryAssets = async (params = {}) => {
  const res = await api.get("/inventory", { params });
  const sourceRows = Array.isArray(res.data?.assets)
    ? res.data.assets
    : Array.isArray(res.data?.inventory)
      ? res.data.inventory
      : [];

  return sourceRows.map((row) => normalizeInventoryAsset(row));
};

export const getInventoryAssetsWithMeta = async (params = {}) => {
  const res = await api.get("/inventory", { params });
  const rawAssets = Array.isArray(res.data?.assets) ? res.data.assets : [];
  const rawInventory = Array.isArray(res.data?.inventory) ? res.data.inventory : [];

  return {
    assets: rawAssets.map((row) => normalizeInventoryAsset(row)),
    inventory: rawInventory.map((row) => normalizeInventoryAsset(row)),
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

export const requestInventoryStatusChange = async (assetId, status, reservationReason = "") => {
  const res = await api.post(`/inventory-request/update/${assetId}`, {
    proposedData: { status, reservationReason },
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
