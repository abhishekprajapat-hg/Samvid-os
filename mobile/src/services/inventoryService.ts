import api from "./api";
import type { InventoryActivity, InventoryAsset } from "../types";

export const getInventoryAssets = async (params: Record<string, unknown> = {}): Promise<InventoryAsset[]> => {
  const res = await api.get("/inventory", { params });
  return res.data?.assets || [];
};

export const getInventoryAssetById = async (assetId: string): Promise<{ asset: InventoryAsset | null; inventory: Record<string, unknown> | null }> => {
  const res = await api.get(`/inventory/${assetId}`);
  return {
    asset: res.data?.asset || null,
    inventory: res.data?.inventory || null,
  };
};

export const getInventoryAssetActivity = async (assetId: string, params: Record<string, unknown> = {}): Promise<InventoryActivity[]> => {
  const res = await api.get(`/inventory/${assetId}/activity`, { params });
  return res.data?.activities || [];
};

export const createInventoryAsset = async (payload: Partial<InventoryAsset>): Promise<InventoryAsset> => {
  const res = await api.post("/inventory", payload);
  return res.data?.asset;
};

export const updateInventoryAsset = async (assetId: string, payload: Partial<InventoryAsset>): Promise<InventoryAsset> => {
  const res = await api.patch(`/inventory/${assetId}`, payload);
  return res.data?.asset;
};

export const deleteInventoryAsset = async (assetId: string) => {
  await api.delete(`/inventory/${assetId}`);
};

export const requestInventoryStatusChange = async (assetId: string, status: string) => {
  const res = await api.post(`/inventory-request/update/${assetId}`, {
    proposedData: { status },
  });
  return res.data?.request || null;
};

export const getPendingInventoryRequests = async () => {
  const res = await api.get("/inventory-request/pending");
  return res.data?.requests || [];
};

export const approveInventoryRequest = async (requestId: string) => {
  const res = await api.patch(`/inventory-request/${requestId}/approve`);
  return res.data;
};

export const rejectInventoryRequest = async (requestId: string, rejectionReason: string) => {
  const res = await api.patch(`/inventory-request/${requestId}/reject`, {
    rejectionReason,
  });
  return res.data;
};