import api from "./api";
import type { InventoryActivity, InventoryAsset } from "../types";

const toLegacyStatus = (status: unknown) => (String(status || "").trim() === "Blocked" ? "Blocked" : String(status || "Available"));

const normalizeInventoryToAsset = (inventory: any): InventoryAsset | null => {
  if (!inventory || typeof inventory !== "object") return null;
  const title = [inventory.projectName, inventory.towerName, inventory.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");
  return {
    _id: String(inventory._id || ""),
    title: title || "Inventory Unit",
    location: String(inventory.location || ""),
    price: Number(inventory.price || 0),
    type: String(inventory.type || "Sale"),
    category: String(inventory.category || "Apartment"),
    status: toLegacyStatus(inventory.status),
    reservationReason: String(inventory.reservationReason || ""),
    reservationLeadId: (inventory as any)?.reservationLeadId?._id || (inventory as any)?.reservationLeadId || "",
    reservationLead: (inventory as any)?.reservationLeadId || null,
    saleDetails: (inventory as any)?.saleDetails || null,
    images: Array.isArray(inventory.images) ? inventory.images : [],
    documents: Array.isArray(inventory.documents) ? inventory.documents : [],
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
  };
};

export const getInventoryAssets = async (params: Record<string, unknown> = {}): Promise<InventoryAsset[]> => {
  const res = await api.get("/inventory", { params });
  if (Array.isArray(res.data?.assets) && res.data.assets.length) {
    return res.data.assets;
  }
  if (Array.isArray(res.data?.inventory) && res.data.inventory.length) {
    return res.data.inventory.map((row: any) => normalizeInventoryToAsset(row)).filter(Boolean);
  }
  return [];
};

export const getInventoryAssetById = async (assetId: string): Promise<{ asset: InventoryAsset | null; inventory: Record<string, unknown> | null }> => {
  const res = await api.get(`/inventory/${assetId}`);
  const inventory = res.data?.inventory || null;
  const legacyAsset = res.data?.asset || null;
  const normalizedFallback = normalizeInventoryToAsset(inventory);
  return {
    asset: legacyAsset || normalizedFallback,
    inventory,
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

export const requestInventoryStatusChange = async (
  assetId: string,
  status: string,
  payload: { leadId?: string; requestNote?: string; saleDetails?: Record<string, unknown> | null } = {},
) => {
  const leadId = String(payload.leadId || "").trim();
  const requestNote = String(payload.requestNote || "").trim();
  const saleDetails = payload.saleDetails && typeof payload.saleDetails === "object"
    ? payload.saleDetails
    : null;
  const res = await api.post(`/inventory-request/update/${assetId}`, {
    proposedData: {
      status,
      reservationReason: status === "Blocked" ? requestNote : "",
      reservationLeadId: status === "Blocked" ? leadId : "",
      saleDetails: status === "Sold" ? saleDetails : null,
    },
    requestNote,
    relatedLeadId: status === "Sold" ? String((saleDetails as any)?.leadId || "").trim() : leadId,
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
