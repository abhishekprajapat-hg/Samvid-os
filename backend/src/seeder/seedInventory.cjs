require("dotenv").config();
const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const User = require("../models/User");

const DEFAULT_PER_TYPE = 2;

const TYPE_COMBINATIONS = Object.freeze([
  {
    inventoryType: "COMMERCIAL",
    dealType: "Sale",
    shortCode: "COM-S",
    city: "Gurugram",
    area: "Cyber City",
    pincode: "122002",
    basePrice: 18000000,
    baseLat: 28.4945,
    baseLng: 77.0877,
  },
  {
    inventoryType: "COMMERCIAL",
    dealType: "Rent",
    shortCode: "COM-R",
    city: "Noida",
    area: "Sector 62",
    pincode: "201309",
    basePrice: 250000,
    baseLat: 28.6275,
    baseLng: 77.3748,
  },
  {
    inventoryType: "RESIDENTIAL",
    dealType: "Sale",
    shortCode: "RES-S",
    city: "Noida",
    area: "Sector 137",
    pincode: "201305",
    basePrice: 9800000,
    baseLat: 28.5454,
    baseLng: 77.391,
  },
  {
    inventoryType: "RESIDENTIAL",
    dealType: "Rent",
    shortCode: "RES-R",
    city: "Delhi",
    area: "Dwarka",
    pincode: "110075",
    basePrice: 45000,
    baseLat: 28.5921,
    baseLng: 77.0477,
  },
]);

const parsePerTypeCount = (rawValue, fallback) => {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const toDisplayIndex = (value) => String(value + 1).padStart(3, "0");

const buildCommercialDetails = ({ index }) => ({
  officeType: index % 2 === 0 ? "FULLY_FURNISHED" : "SEMI_FURNISHED",
  officeLayout: {
    totalCabins: 4 + index,
    workstations: 30 + index * 6,
    seats: 30 + index * 6,
    conferenceRooms: 1 + (index % 2),
    meetingRooms: 2 + (index % 2),
    receptionArea: true,
    waitingArea: true,
  },
  amenities: {
    pantry: true,
    cafeteria: index % 2 === 0,
    washroomType: index % 2 === 0 ? "BOTH" : "COMMON",
    serverRoom: true,
    storageRoom: index % 2 === 0,
    breakoutArea: true,
    liftAvailable: true,
    powerBackup: true,
    centralAC: true,
  },
  buildingDetails: {
    totalFloors: 16 + index,
    parkingType: index % 2 === 0 ? "COVERED" : "BOTH",
    parkingSlots: 5 + index,
    securityType: "BOTH",
    fireSafety: true,
  },
  availability: {
    readyToMove: index % 2 === 0,
    underConstruction: index % 2 !== 0,
    availableFrom:
      index % 2 === 0
        ? new Date("2026-03-01T00:00:00.000Z")
        : new Date("2026-07-15T00:00:00.000Z"),
  },
});

const buildResidentialDetails = ({ index }) => ({
  propertyType: index % 2 === 0 ? "FLAT" : "VILLA",
  bhkType: index % 2 === 0 ? "3BHK" : "4BHK",
  bedrooms: index % 2 === 0 ? 3 : 4,
  bathrooms: index % 2 === 0 ? 3 : 4,
  balcony: index % 2 === 0 ? 2 : 3,
  studyRoom: true,
  servantRoom: index % 2 !== 0,
  parking: 2,
  amenities: {
    modularKitchen: true,
    lift: true,
    security: true,
    powerBackup: true,
    gym: true,
    swimmingPool: index % 2 === 0,
    clubhouse: true,
  },
  utilities: {
    waterSupply: "MUNICIPAL",
    electricityBackup: true,
    gasPipeline: true,
  },
});

const buildSeedRow = ({
  combo,
  comboIndex,
  index,
  perType,
  companyId,
  teamId,
  actorId,
}) => {
  const displayIndex = toDisplayIndex(index);
  const propertyId = `SEED-${combo.shortCode}-${displayIndex}`;
  const isCommercial = combo.inventoryType === "COMMERCIAL";
  const projectLabel = isCommercial ? "Business Park" : "Residency";
  const blockLabel = isCommercial ? "Tower" : "Block";
  const towerName = `${blockLabel} ${String.fromCharCode(65 + index)}`;
  const unitNumber = `${combo.shortCode}-${displayIndex}`;
  const location = `${combo.area}, ${combo.city}, ${combo.pincode}`;
  const totalArea = isCommercial ? 3000 + index * 200 : 1800 + index * 120;
  const carpetArea = Math.round(totalArea * 0.78);
  const builtUpArea = Math.round(totalArea * 0.9);
  const floorNumber = isCommercial ? 3 + index : 7 + index;
  const totalFloors = isCommercial ? 20 : 30;
  const lat = Number((combo.baseLat + comboIndex * 0.005 + index * 0.0008).toFixed(6));
  const lng = Number((combo.baseLng + comboIndex * 0.005 + index * 0.0008).toFixed(6));

  const row = {
    companyId,
    projectName: `Seed ${projectLabel} ${combo.shortCode}`,
    towerName,
    unitNumber,
    propertyId,
    inventoryType: combo.inventoryType,
    price: combo.basePrice + index * (isCommercial ? 350000 : 180000),
    deposit:
      combo.dealType === "Rent"
        ? (combo.basePrice + index * (isCommercial ? 350000 : 180000)) * (isCommercial ? 4 : 2)
        : null,
    type: combo.dealType,
    category: isCommercial ? "Office" : (index % 2 === 0 ? "Apartment" : "Villa"),
    furnishingStatus: isCommercial
      ? (index % 2 === 0 ? "FULLY_FURNISHED" : "SEMI_FURNISHED")
      : (index % 2 === 0 ? "SEMI_FURNISHED" : "FULLY_FURNISHED"),
    status: "Available",
    location,
    city: combo.city,
    area: combo.area,
    pincode: combo.pincode,
    buildingName: `${projectLabel} ${perType}-${index + 1}`,
    floorNumber,
    totalFloors,
    totalArea,
    carpetArea,
    builtUpArea,
    areaUnit: "SQ_FT",
    maintenanceCharges: isCommercial ? 28000 + index * 1500 : 6500 + index * 500,
    siteLocation: { lat, lng },
    images: [],
    documents: [],
    floorPlans: [`https://example.com/floor-plans/${propertyId.toLowerCase()}.pdf`],
    videoTours: [`https://example.com/video-tours/${propertyId.toLowerCase()}`],
    teamId,
    createdBy: actorId,
    approvedBy: actorId,
    updatedBy: actorId,
  };

  if (isCommercial) {
    row.commercialDetails = buildCommercialDetails({ index });
  } else {
    row.residentialDetails = buildResidentialDetails({ index });
  }

  return row;
};

async function resolveSeederActors() {
  const admin = await User.findOne({
    role: "ADMIN",
    isActive: true,
    companyId: { $ne: null },
  })
    .sort({ createdAt: 1 })
    .select("_id companyId")
    .lean();

  if (!admin) {
    throw new Error("Seeder needs one active ADMIN user with companyId");
  }

  const manager = await User.findOne({
    role: "MANAGER",
    isActive: true,
    companyId: admin.companyId,
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  return {
    companyId: admin.companyId,
    actorId: admin._id,
    teamId: manager?._id || admin._id || null,
  };
}

async function seedInventoryByType() {
  try {
    const perType = parsePerTypeCount(
      process.argv[2] || process.env.INVENTORY_SEED_PER_TYPE,
      DEFAULT_PER_TYPE,
    );

    await mongoose.connect(process.env.MONGO_URI);
    const { companyId, actorId, teamId } = await resolveSeederActors();

    await Inventory.deleteMany({
      companyId,
      $or: [
        { propertyId: { $regex: /^SEED-/i } },
        { projectName: { $regex: /^Seed /i } },
      ],
    });

    const rows = [];
    TYPE_COMBINATIONS.forEach((combo, comboIndex) => {
      for (let index = 0; index < perType; index += 1) {
        rows.push(buildSeedRow({
          combo,
          comboIndex,
          index,
          perType,
          companyId,
          teamId,
          actorId,
        }));
      }
    });

    const inserted = await Inventory.insertMany(rows, { ordered: true });

    console.log(
      `Seeded ${inserted.length} properties (${perType} each for COMMERCIAL-Sale, COMMERCIAL-Rent, RESIDENTIAL-Sale, RESIDENTIAL-Rent)`,
    );
  } catch (error) {
    console.error("Inventory seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedInventoryByType();
