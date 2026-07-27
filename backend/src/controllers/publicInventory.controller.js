const Inventory = require("../models/Inventory");
const InventoryShareLink = require("../models/InventoryShareLink");
const Company = require("../models/Company");
const logger = require("../config/logger");

const CLIENT_SAFE_FIELDS = [
  "_id",
  "projectName",
  "towerName",
  "unitNumber",
  "propertyId",
  "inventoryType",
  "price",
  "deposit",
  "type",
  "category",
  "furnishingStatus",
  "status",
  "location",
  "city",
  "area",
  "pincode",
  "buildingName",
  "floorNumber",
  "totalFloors",
  "totalArea",
  "carpetArea",
  "builtUpArea",
  "areaUnit",
  "maintenanceCharges",
  "commercialDetails",
  "residentialDetails",
  "siteLocation",
  "images",
  "documents",
  "floorPlans",
  "videoTours",
];

const toClientSafeView = (inventory) => {
  if (!inventory) return null;

  const safe = {};
  CLIENT_SAFE_FIELDS.forEach((field) => {
    if (inventory[field] !== undefined) {
      safe[field] = inventory[field];
    }
  });

  const titleParts = [inventory.projectName, inventory.towerName, inventory.unitNumber]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  safe.title = titleParts.join(" - ") || "Property";

  return safe;
};

exports.getSharedInventory = async (req, res) => {
  try {
    const shareToken = String(req.params.shareToken || "").trim();
    if (!shareToken) {
      return res.status(400).json({ message: "Share token is required" });
    }

    const shareLink = await InventoryShareLink.findOne({
      token: shareToken,
      isActive: true,
    }).lean();

    if (!shareLink) {
      return res.status(404).json({ message: "This share link is invalid or has been revoked" });
    }

    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return res.status(410).json({ message: "This share link has expired" });
    }

    const company = await Company.findById(shareLink.companyId)
      .select("_id status")
      .lean();
    if (!company) {
      return res.status(404).json({ message: "Property not found" });
    }
    if (company.status !== "ACTIVE") {
      return res.status(403).json({ message: "This share link is not available" });
    }

    const inventory = await Inventory.findById(shareLink.inventoryId).lean();
    if (!inventory) {
      return res.status(404).json({ message: "Property not found" });
    }

    const clientView = toClientSafeView(inventory);

    return res.json({
      ok: true,
      inventory: clientView,
    });
  } catch (error) {
    logger.error({
      error: error.message,
      details: error.stack || null,
      message: "Failed to load shared inventory",
    });
    return res.status(500).json({ message: "Failed to load property details" });
  }
};
