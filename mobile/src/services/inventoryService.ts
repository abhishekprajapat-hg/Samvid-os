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
    officeNumber: String(inventory.officeNumber || ""),
    ownerName: String(inventory.ownerName || ""),
    ownerNumber: String(inventory.ownerNumber || ""),
    keyManagerName: String(inventory.keyManagerName || ""),
    keyManagerNumber: String(inventory.keyManagerNumber || ""),
    dealType: String(inventory.dealType || ""),
    propertyDate: inventory.propertyDate || "",
    gstApplicable: Boolean(inventory.gstApplicable),
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,

    /* Carried through so a list can show an area, a furnishing or a floor
       without fetching each row again. */
    propertyId: String(inventory.propertyId || ""),
    projectName: String(inventory.projectName || ""),
    towerName: String(inventory.towerName || ""),
    inventoryType: String(inventory.inventoryType || ""),
    furnishingStatus: String(inventory.furnishingStatus || ""),
    buildingName: String(inventory.buildingName || ""),
    floorNumber: inventory.floorNumber ?? null,
    totalFloors: inventory.totalFloors ?? null,
    carpetArea: inventory.carpetArea ?? null,
    builtUpArea: inventory.builtUpArea ?? null,
    totalArea: inventory.totalArea ?? null,
    areaUnit: String(inventory.areaUnit || "SQ_FT"),
    city: String(inventory.city || ""),
    area: String(inventory.area || ""),
    pincode: String(inventory.pincode || ""),
    rent: inventory.rent ?? null,
    maintenanceCharges: inventory.maintenanceCharges ?? null,
    floorPlans: Array.isArray(inventory.floorPlans) ? inventory.floorPlans : [],
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

export const requestInventoryUpdate = async (
  assetId: string,
  proposedData: Record<string, unknown>,
  requestNote = "",
) => {
  const res = await api.post(`/inventory-request/update/${assetId}`, {
    proposedData,
    requestNote: String(requestNote || "").trim(),
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

/* ------------------------------------------- request / review workflow -- */

/*
 * The half of inventory that goes through approval rather than writing
 * directly. Non-privileged roles cannot create, edit or delete an asset - they
 * raise a request and a manager approves it. Mirrors the same five functions in
 * frontend/src/services/inventoryService.js.
 */

/** Propose a brand-new asset for approval instead of creating it outright. */
export const createInventoryCreateRequest = async (payload: Record<string, unknown>) => {
  const res = await api.post("/inventory-request", { proposedData: payload });
  return res.data?.request || null;
};

/** Propose a deletion for approval. */
export const requestInventoryDelete = async (assetId: string, requestNote = "") => {
  const res = await api.post(`/inventory-request/delete/${assetId}`, {
    requestNote: String(requestNote || "").trim(),
  });
  return res.data?.request || null;
};

/*
 * Named to match web exactly. `requestInventoryUpdate` below is the original
 * mobile spelling, kept as an alias so the screens already calling it keep
 * working; prefer this name in new code.
 */
export const requestInventoryUpdateChange = async (
  assetId: string,
  proposedData: Record<string, unknown>,
  requestNote = "",
) => requestInventoryUpdate(assetId, proposedData, requestNote);

/** The requests *this* user raised, with their current review state. */
export const getMyInventoryRequests = async () => {
  const res = await api.get("/inventory-request/my");
  return Array.isArray(res.data?.requests) ? res.data.requests : [];
};

/** Assets plus pagination meta, for infinite scroll. */
export const getInventoryAssetsWithMeta = async (params: Record<string, unknown> = {}) => {
  const res = await api.get("/inventory", { params });
  const rawAssets = Array.isArray(res.data?.assets) ? res.data.assets : [];
  const rawInventory = Array.isArray(res.data?.inventory) ? res.data.inventory : [];
  return {
    assets: rawAssets,
    inventory: rawInventory,
    pagination: res.data?.pagination || null,
  };
};

/*
 * A public, time-limited share link for one asset. The token is consumed by
 * SharedInventoryView, which is unauthenticated - Phase 5.
 */
export const createInventoryShareLink = async (inventoryId: string) => {
  const res = await api.post(`/inventory/${inventoryId}/share`);
  return {
    shareToken: String(res.data?.shareToken || ""),
    expiresAt: res.data?.expiresAt || null,
  };
};
