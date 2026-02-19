require("dotenv").config();
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const User = require("../models/User");
const DEFAULT_SEED_COUNT = 24;

const parseSeedCount = (rawValue, fallback) => {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const PROJECTS = [
  "Skyline Residency",
  "Palm Greens",
  "Central Business Tower",
  "Lakeview Enclave",
  "Aster Heights",
  "Grand Horizon",
  "Maple Corporate Park",
  "Sunset Valley",
  "Blue Orbit Homes",
  "Regal Courtyard",
];

const TOWERS = ["A", "B", "C", "D"];
const LOCATIONS = [
  "Sector 62, Noida",
  "Golf Course Road, Gurgaon",
  "Dwarka, Delhi",
  "Indirapuram, Ghaziabad",
  "Sector 88, Faridabad",
];

const STATUSES = ["Available", "Blocked", "Sold"];

const buildUnit = ({ index, teamId, companyId, adminId }) => {
  const projectName = PROJECTS[index % PROJECTS.length];
  const towerName = TOWERS[index % TOWERS.length];
  const unitNumber = `${towerName}-${String(index + 101)}`;
  const location = LOCATIONS[index % LOCATIONS.length];
  const basePrice = 6500000 + (index % 10) * 250000;

  return {
    projectName: `Seed ${projectName}`,
    towerName,
    unitNumber,
    location,
    price: basePrice,
    status: STATUSES[index % STATUSES.length],
    images: [],
    documents: [],
    companyId,
    teamId,
    createdBy: adminId,
    approvedBy: adminId,
    updatedBy: adminId,
  };
};

async function seedInventory() {
  try {
    const seedCount = parseSeedCount(
      process.argv[2] || process.env.INVENTORY_SEED_COUNT,
      DEFAULT_SEED_COUNT,
    );

    await mongoose.connect(process.env.MONGO_URI);

    const [admin, manager] = await Promise.all([
      User.findOne({ role: "ADMIN", isActive: true }).select("_id companyId"),
      User.findOne({ role: "MANAGER", isActive: true }).select("_id companyId"),
    ]);

    if (!admin || !manager) {
      throw new Error("Seeder needs one active ADMIN and one active MANAGER user");
    }

    const companyId = manager.companyId || admin.companyId;
    if (!companyId) {
      throw new Error("Seeder needs users with companyId");
    }

    if (
      manager.companyId
      && admin.companyId
      && String(manager.companyId) !== String(admin.companyId)
    ) {
      throw new Error("Seeder found admin and manager from different companies");
    }

    await Inventory.deleteMany({
      projectName: { $regex: /^Seed /i },
    });

    const rows = Array.from({ length: seedCount }, (_, index) =>
      buildUnit({
        index,
        teamId: manager._id,
        companyId,
        adminId: admin._id,
      }),
    );

    const inserted = await Inventory.insertMany(rows, { ordered: false });
    console.log(`Seeded ${inserted.length} inventory rows successfully`);
  } catch (error) {
    console.error("Inventory seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedInventory();
