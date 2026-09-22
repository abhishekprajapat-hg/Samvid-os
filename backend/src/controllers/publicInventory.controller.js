const Inventory = require("../models/Inventory");
const InventoryShareLink = require("../models/InventoryShareLink");
const logger = require("../config/logger");
const { withFileToken } = require("../utils/fileAccessToken");

// A share link has no session, so each media URL it hands out carries its own
// short-lived token bound to that one file.
const FILE_URL_FIELDS = ["images", "documents", "floorPlans", "videoTours"];
const signMediaUrls = (safe) => {
  FILE_URL_FIELDS.forEach((field) => {
    if (!Array.isArray(safe[field])) return;
    safe[field] = safe[field].map((entry) => {
      if (typeof entry === "string") return withFileToken(entry);
      if (entry && typeof entry === "object" && entry.url) {
        return { ...entry, url: withFileToken(entry.url) };
      }
      return entry;
    });
  });
  return safe;
};

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
  "superBuiltUpArea",
  "length",
  "width",
  "height",
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

  return signMediaUrls(safe);
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
