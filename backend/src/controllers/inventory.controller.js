const {
  getInventoryList,
  getInventoryById,
  createInventoryDirect,
  updateInventoryDirect,
  deleteInventoryDirect,
  bulkCreateInventoryDirect,
  getInventoryActivities,
} = require("../services/inventoryWorkflow.service");

const FE_ROLE = "FIELD_EXECUTIVE";

const toLegacyStatus = (status) => {
  if (status === "Blocked") return "Reserved";
  return status || "Available";
};

const toLegacyAsset = (inventory, role) => {
  if (!inventory) return null;

  const titleParts = [inventory.projectName, inventory.towerName, inventory.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const asset = {
    _id: inventory._id,
    title: titleParts.join(" - ") || "Inventory Unit",
    location: inventory.location || "",
    price: inventory.price || 0,
    type: "Sale",
    category: "Apartment",
    status: toLegacyStatus(inventory.status),
    images: Array.isArray(inventory.images) ? inventory.images : [],
    documents: Array.isArray(inventory.documents) ? inventory.documents : [],
    projectName: inventory.projectName,
    towerName: inventory.towerName,
    unitNumber: inventory.unitNumber,
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
  };

  if (role !== FE_ROLE) {
    asset.teamId = inventory.teamId;
    asset.createdBy = inventory.createdBy;
    asset.approvedBy = inventory.approvedBy;
    asset.updatedBy = inventory.updatedBy;
  }

  return asset;
};

const toFieldExecutiveInventoryView = (inventory) => ({
  _id: inventory._id,
  projectName: inventory.projectName,
  towerName: inventory.towerName,
  unitNumber: inventory.unitNumber,
  price: inventory.price,
  status: inventory.status,
  location: inventory.location,
  images: Array.isArray(inventory.images) ? inventory.images : [],
  documents: Array.isArray(inventory.documents) ? inventory.documents : [],
  createdAt: inventory.createdAt,
  updatedAt: inventory.updatedAt,
});

const toRoleBasedInventory = (inventory, role) => {
  if (role === FE_ROLE) {
    return toFieldExecutiveInventoryView(inventory);
  }
  return inventory;
};

const handleControllerError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

exports.getInventory = async (req, res) => {
  try {
    const inventory = await getInventoryList({
      user: req.user,
      filters: {
        status: req.query?.status,
        search: req.query?.search,
      },
    });
    const visibleInventory = inventory.map((row) => toRoleBasedInventory(row, req.user.role));
    const assets = visibleInventory.map((row) => toLegacyAsset(row, req.user.role));

    return res.json({
      count: assets.length,
      assets,
      inventory: visibleInventory,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load inventory");
  }
};

exports.getInventoryById = async (req, res) => {
  try {
    const inventory = await getInventoryById({
      user: req.user,
      inventoryId: req.params.id,
    });
    const visibleInventory = toRoleBasedInventory(inventory, req.user.role);
    const asset = toLegacyAsset(visibleInventory, req.user.role);

    return res.json({ asset, inventory: visibleInventory });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load inventory item");
  }
};

exports.createInventory = async (req, res) => {
  try {
    const inventory = await createInventoryDirect({
      user: req.user,
      payload: req.body,
    });
    const asset = toLegacyAsset(inventory, req.user.role);

    return res.status(201).json({
      message: "Inventory created successfully",
      asset,
      inventory,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to create inventory");
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const inventory = await updateInventoryDirect({
      user: req.user,
      inventoryId: req.params.id,
      payload: req.body,
    });
    const asset = toLegacyAsset(inventory, req.user.role);

    return res.json({
      message: "Inventory updated successfully",
      asset,
      inventory,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to update inventory");
  }
};

exports.deleteInventory = async (req, res) => {
  try {
    await deleteInventoryDirect({
      user: req.user,
      inventoryId: req.params.id,
    });

    return res.json({ message: "Inventory deleted successfully" });
  } catch (error) {
    return handleControllerError(res, error, "Failed to delete inventory");
  }
};

exports.bulkUploadInventory = async (req, res) => {
  try {
    const result = await bulkCreateInventoryDirect({
      user: req.user,
      payload: req.body?.rows,
    });

    return res.status(201).json({
      message: "Bulk inventory upload processed",
      ...result,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to bulk upload inventory");
  }
};

exports.getInventoryActivity = async (req, res) => {
  try {
    const activities = await getInventoryActivities({
      user: req.user,
      inventoryId: req.params.id,
      limit: req.query?.limit,
    });

    return res.json({
      count: activities.length,
      activities,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load inventory activity");
  }
};

// Legacy compatibility aliases
exports.getInventoryAssets = exports.getInventory;
exports.createInventoryAsset = exports.createInventory;
exports.updateInventoryAsset = exports.updateInventory;
exports.deleteInventoryAsset = exports.deleteInventory;
