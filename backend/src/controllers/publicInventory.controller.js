const Inventory = require("../models/Inventory");
const InventoryShareLink = require("../models/InventoryShareLink");
const Company = require("../models/Company");
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

// Internal brokerage details a client must never see on a shared page, even if
// a field is later added to the allowlist by mistake: which building it is,
// the office/unit number, which floor, and anything about the owner.
// towerName is filled from the building name by the inventory form, and
// unitNumber can hold the real office number on older records.
const CLIENT_HIDDEN_FIELDS = new Set([
  "buildingName",
  "towerName",
  "officeNumber",
  "unitNumber",
  "floorNumber",
  "ownerName",
  "ownerNumber",
  "ownerWhatsappNumber",
  "ownerContactId",
  "ownerType",
  "keyManagerName",
  "keyManagerNumber",
]);

// subtypeData is free-form and can carry plot numbers or similar identifiers;
// the shared page does not show it, so it is not sent at all.
const HIDDEN_DETAIL_KEYS = ["subtypeData"];

const CLIENT_SAFE_FIELDS = [
  "_id",
  "projectName",
  "propertyId",
  "inventoryType",
  "price",
  "rent",
  "deposit",
  "type",
  "category",
  "furnishingStatus",
  "status",
  "location",
  "city",
  "area",
  "pincode",
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
    if (CLIENT_HIDDEN_FIELDS.has(field)) return;
    if (inventory[field] !== undefined) {
      safe[field] = inventory[field];
    }
  });

  ["commercialDetails", "residentialDetails"].forEach((key) => {
    if (!safe[key] || typeof safe[key] !== "object") return;
    const details = { ...safe[key] };
    HIDDEN_DETAIL_KEYS.forEach((hidden) => { delete details[hidden]; });
    safe[key] = details;
  });

  // The title is built only from the listing name, never the building,
  // tower or unit, so the heading cannot give the building away.
  safe.title = String(inventory.projectName || "").trim() || "Property";

  return signMediaUrls(safe);
};

exports.toClientSafeView = toClientSafeView;

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
