require("dotenv").config();
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");

const sanitizeString = (value) => String(value || "").trim();

const buildUnitCodeFromId = (idValue) =>
  `UNIT-${String(idValue || "")
    .slice(-6)
    .toUpperCase()}`;

const deriveFieldsFromLegacyTitle = ({ title, fallbackId }) => {
  const cleanTitle = sanitizeString(title);
  if (!cleanTitle) {
    return {
      projectName: "",
      towerName: "",
      unitNumber: buildUnitCodeFromId(fallbackId),
    };
  }

  const parts = cleanTitle
    .split("-")
    .map((part) => sanitizeString(part))
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      projectName: parts.slice(0, parts.length - 2).join(" - "),
      towerName: parts[parts.length - 2],
      unitNumber: parts[parts.length - 1],
    };
  }

  if (parts.length === 2) {
    return {
      projectName: parts[0],
      towerName: parts[1],
      unitNumber: parts[1],
    };
  }

  return {
    projectName: parts[0],
    towerName: "Main",
    unitNumber: buildUnitCodeFromId(fallbackId),
  };
};

async function seedInventoryTitles() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const rows = await Inventory.find({})
      .select("_id projectName towerName unitNumber title")
      .lean();

    if (!rows.length) {
      console.log("No inventory rows found");
      return;
    }

    const bulkOps = [];
    let normalizedCount = 0;
    let derivedCount = 0;

    rows.forEach((row) => {
      const currentProjectName = sanitizeString(row.projectName);
      const currentTowerName = sanitizeString(row.towerName);
      const currentUnitNumber = sanitizeString(row.unitNumber);
      const derived = deriveFieldsFromLegacyTitle({
        title: row.title,
        fallbackId: row._id,
      });

      const nextProjectName = currentProjectName || derived.projectName || "Inventory";
      const nextTowerName = currentTowerName || derived.towerName || "Main";
      const nextUnitNumber = currentUnitNumber || derived.unitNumber || buildUnitCodeFromId(row._id);

      const hasChange =
        nextProjectName !== currentProjectName
        || nextTowerName !== currentTowerName
        || nextUnitNumber !== currentUnitNumber;

      if (!hasChange) {
        normalizedCount += 1;
        return;
      }

      const wasDerived =
        !currentProjectName || !currentTowerName || !currentUnitNumber;
      if (wasDerived) {
        derivedCount += 1;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              projectName: nextProjectName,
              towerName: nextTowerName,
              unitNumber: nextUnitNumber,
            },
          },
        },
      });
    });

    if (!bulkOps.length) {
      console.log(
        `Inventory title seed complete. Rows checked: ${rows.length}, already normalized: ${normalizedCount}, updated: 0`,
      );
      return;
    }

    const result = await Inventory.bulkWrite(bulkOps, { ordered: false });
    const modified = Number(result?.modifiedCount || 0);

    console.log(
      `Inventory title seed complete. Rows checked: ${rows.length}, updated: ${modified}, derived updates: ${derivedCount}`,
    );
  } catch (error) {
    console.error("Inventory title seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedInventoryTitles();
