/**
 * Extended demo dataset, layered on top of feedLocalDemoData.cjs.
 *
 * The base seeder gives every screen something to show; this one gives the
 * numbers depth, so a demo looks like a working business:
 *   - a second sales team (manager + executives + channel partners)
 *   - ~140 more leads across every pipeline stage, spread over six months
 *   - ~40 closed deals with approved payments, brokerage and sold inventory
 *   - a populated leaderboard for every role tab
 *   - more inventory, pending approval requests, tasks, six months of targets
 *   - chat rooms with history, CRM contacts, saved reports
 *   - six months of finance history (rent invoices, receipts, brokerage
 *     income, salaries and running costs)
 *
 * Everything is deterministic (seeded RNG, fixed codes) and idempotent, and
 * every write is scoped to the demo company passed in by the base seeder.
 */
const User = require("../models/User");
const Inventory = require("../models/Inventory");
const InventoryActivity = require("../models/InventoryActivity");
const InventoryRequest = require("../models/InventoryRequest");
const Lead = require("../models/Lead");
const LeadActivity = require("../models/leadActivity.model");
const LeadDiary = require("../models/leadDiary.model");
const LeadStatusRequest = require("../models/LeadStatusRequest");
const Task = require("../models/Task");
const TargetAssignment = require("../models/TargetAssignment");
const Attendance = require("../models/Attendance");
const ChatRoom = require("../models/ChatRoom");
const ChatMessage = require("../models/ChatMessage");
const CrmContact = require("../models/CrmContact");
const Report = require("../models/Report");
const CoworkingClient = require("../models/CoworkingClient");
const CoworkingContract = require("../models/CoworkingContract");
const CoworkingProperty = require("../models/CoworkingProperty");
const CoworkingInvoice = require("../models/CoworkingInvoice");
const CoworkingPayment = require("../models/CoworkingPayment");
const CoworkingExpense = require("../models/CoworkingExpense");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const InventoryIdCounter = require("../models/InventoryIdCounter");

const { USER_ROLES } = require("../constants/role.constants");
const { computeInvoiceTotals, deriveInvoiceStatus } = require("../services/coworkingBilling.calc");

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
const makeRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const FIRST_NAMES = [
  "Aakash", "Bhavna", "Chirag", "Deepika", "Eshan", "Falguni", "Gaurav", "Hema", "Irfan", "Jaya",
  "Kunal", "Lavanya", "Manish", "Nandini", "Ojas", "Pallavi", "Rakesh", "Sakshi", "Tushar", "Urvashi",
  "Varun", "Yamini", "Zubin", "Abhay", "Charu", "Dhruv", "Gitanjali", "Hitesh", "Juhi", "Kartik",
];
const LAST_NAMES = [
  "Agarwal", "Bhatia", "Chopra", "Dutta", "Garg", "Hegde", "Jain", "Kohli", "Luthra", "Mathur",
  "Nanda", "Oberoi", "Prasad", "Rastogi", "Saxena", "Tandon", "Uppal", "Vohra", "Walia", "Yadav",
];
const FIRM_PREFIXES = [
  "Acme", "Bright", "Crest", "Delta", "Elite", "Falcon", "Globe", "Helix", "Ion", "Jade",
  "Kinetic", "Lotus", "Matrix", "Nova", "Orbit", "Prime", "Quest", "Radiant", "Sapphire", "Titan",
];
const FIRM_SUFFIXES = ["Technologies", "Consulting", "Logistics", "Pharma", "Media", "Foods", "Finserv", "Infra", "Retail", "Labs"];
const PROFESSIONS = ["IT Services", "Doctor", "Chartered Accountant", "Lawyer", "Startup Founder", "Banker", "Architect", "Retailer", "Consultant", "Manufacturer"];
const CITIES = [
  ["Gurugram", ["Cyber City", "Golf Course Road", "Sohna Road", "Sector 57"]],
  ["Noida", ["Sector 62", "Sector 18", "Sector 92", "Noida Expressway"]],
  ["Delhi", ["Connaught Place", "Nehru Place", "Saket", "Okhla"]],
  ["Faridabad", ["Sector 15", "NH-19", "Neharpar"]],
];
const CHANNELS = ["META", "JUSTDIAL", "99ACRES", "WEBSITE", "REFERENCE", "BROKER", "DIRECT_CALL", "DIRECT_VISIT", "MYBRICKS", "OLX"];

const OPEN_STATUSES = [
  // status, weight
  ["NEW", 9],
  ["CONTACTED", 10],
  ["FOLLOW_UP_1", 6],
  ["FOLLOW_UP_2", 4],
  ["FOLLOW_UP_3", 3],
  ["INTERESTED", 9],
  ["SITE_VISIT_SCHEDULED", 7],
  ["SITE_VISIT", 9],
  ["SITE_VISIT_OVERDUE", 3],
  ["NOT_PICKING_CALLS", 4],
  ["MISSING_IN_ACTION", 3],
  ["REQUESTED", 4],
  ["LOST", 6],
  ["INVALID", 2],
];

// Validates through the model, then writes with explicit createdAt/updatedAt.
// Mongoose stamps timestamps itself on insert, which would put every seeded
// note and message at "now" instead of when it happened.
const insertWithDates = async (Model, docs) => {
  if (!docs.length) return;
  const raw = [];
  for (const doc of docs) {
    const { createdAt, updatedAt, ...rest } = doc;
    const model = new Model(rest);
    await model.validate();
    const plain = model.toObject({ depopulate: true, virtuals: false });
    plain.createdAt = createdAt;
    plain.updatedAt = updatedAt || createdAt;
    raw.push(plain);
  }
  await Model.collection.insertMany(raw, { ordered: false });
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
const seedDemoExtras = async ({ companyId, adminId, managerId, users, helpers }) => {
  const { upsert, setCounter, days, atTime, dateKey, monthKey, demoEmail, now, DEMO_PASSWORD, PARTNER_CODE_PREFIX, oid } = helpers;
  const rng = makeRng(20261007);
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const between = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const weighted = (rows) => {
    const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng() * total;
    for (const [value, weight] of rows) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return rows[rows.length - 1][0];
  };
  const DAY_MS = 24 * 60 * 60 * 1000;
  // Most activity is recent, so the default 30-day leaderboard is full, but a
  // tail reaches back six months for the trend charts.
  const recentOffset = () => (rng() < 0.6 ? between(1, 28) : between(29, 175));

  // -------------------------------------------------------------------------
  // 1. Second sales team
  // -------------------------------------------------------------------------
  const manager2Id = oid("user-manager2@test.com");
  const extraStaff = [
    // email, name, role, roleType, department, branch, monthlyTarget, parent
    ["manager2@test.com", "Rohan Mehra", USER_ROLES.MANAGER, "BOTH", "Sales", "Noida", 70, adminId],
    ["executive3@test.com", "Simran Kaur", USER_ROLES.EXECUTIVE, "COMMERCIAL", "Sales", "Noida", 25, manager2Id],
    ["executive4@test.com", "Aman Gupta", USER_ROLES.EXECUTIVE, "RESIDENTIAL", "Sales", "Delhi", 25, manager2Id],
    ["inside_executive3@test.com", "Farah Khan", USER_ROLES.INSIDE_EXECUTIVE, "COMMERCIAL", "Inside Sales", "Noida", 30, manager2Id],
    ["field_executive3@test.com", "Deepak Yadav", USER_ROLES.FIELD_EXECUTIVE, "COMMERCIAL", "Field Ops", "Delhi", 20, manager2Id],
    ["channel_partner2@test.com", "Nitin Arora", USER_ROLES.CHANNEL_PARTNER, "COMMERCIAL", "Partnerships", "Noida", 10, manager2Id],
    ["channel_partner3@test.com", "Kavya Reddy", USER_ROLES.CHANNEL_PARTNER, "RESIDENTIAL", "Partnerships", "Gurugram", 10, managerId],
  ];

  for (const [index, [email, name, role, roleType, department, branch, monthlyTarget, parentId]] of extraStaff.entries()) {
    const existing = await User.findOne({ email: demoEmail(email) }).select("_id companyId").lean();
    if (existing && String(existing.companyId) !== String(companyId)) {
      throw new Error(`${demoEmail(email)} already belongs to another company; refusing to touch it.`);
    }
    const _id = existing?._id || (email === "manager2@test.com" ? manager2Id : oid(`user-${email}`));
    users[email] = await upsert(User, { _id }, {
      name,
      email: demoEmail(email),
      phone: `98200${String(10000 + index)}`,
      password: DEMO_PASSWORD,
      role,
      roleType,
      companyId,
      parentId,
      isActive: true,
      canViewInventory: true,
      department,
      branch,
      shiftTiming: "10:00 - 19:00",
      monthlyTarget,
      partnerCode: `${PARTNER_CODE_PREFIX}${role === USER_ROLES.CHANNEL_PARTNER ? `CP-DEMO-00${index}` : `DEMO-X${index + 1}`}`,
      brokerageConfig: {
        mode: role === USER_ROLES.CHANNEL_PARTNER ? "PERCENTAGE" : "FLAT",
        value: role === USER_ROLES.CHANNEL_PARTNER ? 2 : 50000,
        notes: "Seeded demo brokerage setup",
      },
      lastLoginAt: days(-(index % 4)),
    });
  }
  const manager2 = users["manager2@test.com"];
  const managerOf = (user) => (String(user.parentId) === String(manager2._id) ? manager2._id : managerId);

  // -------------------------------------------------------------------------
  // 2. More inventory (some of it is sold to the closed deals below)
  // -------------------------------------------------------------------------
  const inventoryRows = [];
  const commercialProjects = [
    ["Skyline Business Tower", "Tower C", "Sector 62, Noida", "Noida", "Sector 62", "201301"],
    ["Cyber Greens Annexe", "Block 2", "DLF Cyber City, Gurugram", "Gurugram", "Cyber City", "122002"],
    ["Nehru Place Trade Centre", "Wing A", "Nehru Place, Delhi", "Delhi", "Nehru Place", "110019"],
    ["Golf Course Corporate Park", "Tower 1", "Golf Course Road, Gurugram", "Gurugram", "Sector 42", "122002"],
  ];
  const residentialProjects = [
    ["Emerald Residency", "Tower 5", "Sector 57, Gurugram", "Gurugram", "Sector 57", "122003"],
    ["Palm Grove Floors", "Floor 3", "Sector 92, Noida", "Noida", "Sector 92", "201304"],
    ["Saket Heights", "Tower B", "Saket, Delhi", "Delhi", "Saket", "110017"],
  ];
  for (let index = 0; index < 18; index += 1) {
    const [projectName, towerName, location, city, area, pincode] = commercialProjects[index % commercialProjects.length];
    const totalArea = 800 + between(0, 30) * 100;
    const forSale = index % 3 !== 0;
    inventoryRows.push({
      propertyId: `COM-${9101 + index}`,
      projectName,
      towerName,
      inventoryType: "COMMERCIAL",
      type: forSale ? "Sale" : "Rent",
      category: index % 6 === 5 ? "Shop" : "Office",
      furnishingStatus: pick(["FULLY_FURNISHED", "SEMI_FURNISHED", "BARE_SHELL"]),
      price: forSale ? totalArea * between(9500, 16500) : null,
      rent: forSale ? null : totalArea * between(90, 160),
      location, city, area, pincode,
      floorNumber: between(1, 14),
      totalFloors: 15,
      totalArea,
      carpetArea: Math.round(totalArea * 0.8),
      seats: Math.round(totalArea / 30),
      cabins: between(2, 8),
    });
  }
  for (let index = 0; index < 12; index += 1) {
    const [projectName, towerName, location, city, area, pincode] = residentialProjects[index % residentialProjects.length];
    const bedrooms = between(2, 4);
    const totalArea = 900 + bedrooms * 350 + between(0, 4) * 50;
    const forSale = index % 4 !== 0;
    inventoryRows.push({
      propertyId: `RES-${9101 + index}`,
      projectName,
      towerName,
      inventoryType: "RESIDENTIAL",
      type: forSale ? "Sale" : "Rent",
      category: "Apartment",
      furnishingStatus: pick(["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"]),
      price: forSale ? totalArea * between(6800, 11500) : null,
      rent: forSale ? null : totalArea * between(28, 45),
      location, city, area, pincode,
      floorNumber: between(1, 18),
      totalFloors: 20,
      totalArea,
      carpetArea: Math.round(totalArea * 0.78),
      bhkType: `${bedrooms}BHK`,
      bedrooms,
      bathrooms: bedrooms,
    });
  }

  const inventories = [];
  for (const [index, row] of inventoryRows.entries()) {
    const isCommercial = row.inventoryType === "COMMERCIAL";
    const data = {
      projectName: row.projectName,
      towerName: row.towerName,
      unitNumber: row.propertyId,
      inventoryType: row.inventoryType,
      type: row.type,
      category: row.category,
      furnishingStatus: row.furnishingStatus,
      status: "Available",
      price: row.price,
      rent: row.rent,
      deposit: row.rent ? row.rent * 6 : null,
      depositMonths: row.rent ? 6 : null,
      agreementYears: row.rent ? 3 : null,
      lockInYears: row.rent ? 1 : null,
      location: row.location,
      city: row.city,
      area: row.area,
      pincode: row.pincode,
      buildingName: `${row.projectName} ${row.towerName}`,
      floorNumber: row.floorNumber,
      totalFloors: row.totalFloors,
      totalArea: row.totalArea,
      carpetArea: row.carpetArea,
      builtUpArea: row.totalArea,
      superBuiltUpArea: Math.round(row.totalArea * 1.12),
      areaUnit: "SQ_FT",
      maintenanceCharges: isCommercial ? 12 : 4,
      officeNumber: isCommercial ? `${row.floorNumber}${String(index + 1).padStart(2, "0")}` : "",
      ownerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      ownerNumber: `98330${String(30000 + index)}`,
      ownerWhatsappNumber: `98330${String(30000 + index)}`,
      ownerType: index % 3 === 0 ? "1ST" : "2ND",
      keyManagerName: "Deepak Yadav",
      keyManagerNumber: "9820010004",
      dealType: row.type === "Sale" ? "PURCHASE" : "RENT",
      propertyDate: days(-(20 + index * 4)),
      gstApplicable: isCommercial,
      documentsAvailable: {
        registry: true,
        searchReport: index % 2 === 0,
        electricityNoc: true,
        maintenanceNoc: index % 3 === 0,
        taxReceipt: true,
        loanNoc: false,
      },
      siteLocation: { lat: 28.4 + (index % 10) * 0.02, lng: 77.0 + (index % 7) * 0.03 },
      images: isCommercial
        ? [
            "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200",
            "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200",
          ]
        : [
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200",
          ],
      floorPlans: [],
      documents: [],
      videoTours: [],
      teamId: index % 2 === 0 ? managerId : manager2._id,
      createdBy: adminId,
      approvedBy: adminId,
      updatedBy: index % 2 === 0 ? managerId : manager2._id,
    };
    if (isCommercial) {
      data.commercialDetails = {
        officeType: row.category === "Shop" ? "SHOP" : row.furnishingStatus === "BARE_SHELL" ? "BARE_SHELL" : "FULLY_FURNISHED",
        officeLayout: {
          totalCabins: row.cabins,
          cabinSeats: row.cabins * 2,
          workstations: row.seats,
          seats: row.seats,
          conferenceRooms: 1,
          conferenceSeats: 10,
          receptionArea: true,
          waitingArea: true,
        },
        amenities: {
          pantry: true,
          cafeteria: index % 2 === 0,
          washroomType: "BOTH",
          serverRoom: index % 2 === 0,
          storageRoom: true,
          breakoutArea: index % 3 === 0,
          liftAvailable: true,
          powerBackup: true,
          centralAC: true,
        },
        buildingDetails: { totalFloors: row.totalFloors, parkingType: "BOTH", parkingSlots: 8 + index, securityType: "BOTH", fireSafety: true },
        availability: { readyToMove: true, underConstruction: false, availableFrom: days(10) },
      };
      data.residentialDetails = undefined;
    } else {
      data.residentialDetails = {
        propertyType: "FLAT",
        bhkType: row.bhkType,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        balcony: row.bedrooms,
        studyRoom: index % 2 === 0,
        servantRoom: index % 3 === 0,
        parking: 1,
        amenities: { modularKitchen: true, lift: true, security: true, powerBackup: true, gym: index % 2 === 0, swimmingPool: index % 3 === 0, clubhouse: true },
        utilities: { waterSupply: "MUNICIPAL", electricityBackup: true, gasPipeline: index % 2 === 0 },
      };
      data.commercialDetails = undefined;
    }

    // Status is decided by the deals below; keep whatever an earlier run set.
    const existing = await Inventory.findOne({ companyId, propertyId: row.propertyId }).select("status saleDetails reservationLeadId").lean();
    if (existing) {
      data.status = existing.status;
      data.saleDetails = existing.saleDetails || null;
      data.reservationLeadId = existing.reservationLeadId || null;
    }
    const inventory = await upsert(Inventory, { companyId, propertyId: row.propertyId }, data);
    inventories.push(inventory);
    await upsert(InventoryActivity, { companyId, inventoryId: inventory._id, actionType: "DIRECT_CREATE" }, {
      changedBy: adminId,
      role: USER_ROLES.ADMIN,
      newValue: { propertyId: row.propertyId, status: "Available" },
      timestamp: days(-(40 - index)),
    });
  }
  await setCounter(InventoryIdCounter, { companyId, category: "COMMERCIAL" }, 9118);
  await setCounter(InventoryIdCounter, { companyId, category: "RESIDENTIAL" }, 9112);
  const saleStock = inventories.filter((row) => row.type === "Sale");
  let saleCursor = 0;

  // -------------------------------------------------------------------------
  // 3. Pipeline: bulk leads and closed deals
  // -------------------------------------------------------------------------
  // email, closing rate, lead count - the spread gives each leaderboard a
  // clear 1st / 2nd / 3rd instead of a tie.
  const salesOwners = [
    ["executive3@test.com", 0.38, 16],
    ["executive@test.com", 0.34, 15],
    ["field_executive3@test.com", 0.32, 12],
    ["inside_executive@test.com", 0.3, 16],
    ["field_executive@test.com", 0.28, 12],
    ["executive2@test.com", 0.26, 15],
    ["inside_executive3@test.com", 0.24, 14],
    ["field_executive2@test.com", 0.22, 11],
    ["executive4@test.com", 0.2, 13],
    ["inside_executive2@test.com", 0.18, 14],
  ];
  const partnerCreators = [
    ["channel_partner2@test.com", 0.2],
    ["channel_partner@test.com", 0.13],
    ["channel_partner3@test.com", 0.08],
  ];
  const fieldExecutives = ["field_executive@test.com", "field_executive2@test.com", "field_executive3@test.com"].map((email) => users[email]);

  const pipelineLeads = [];
  let closedCount = 0;
  let leadSerial = 0;
  for (const [ownerIndex, [ownerEmail, closeRate, leadCount]] of salesOwners.entries()) {
    const owner = users[ownerEmail];
    const isFieldOwner = owner.role === USER_ROLES.FIELD_EXECUTIVE;
    const ownerManagerId = managerOf(owner);
    const closedTarget = Math.round(leadCount * closeRate);

    for (let slot = 0; slot < leadCount; slot += 1) {
      leadSerial += 1;
      const isClosed = slot < closedTarget;
      const status = isClosed ? "CLOSED" : weighted(OPEN_STATUSES);
      const isCommercial = rng() < 0.6;
      const [city, localities] = pick(CITIES);
      const isFirm = isCommercial && rng() < 0.7;
      const personName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const name = isFirm ? `${pick(FIRM_PREFIXES)} ${pick(FIRM_SUFFIXES)}` : personName;
      const phone = `977${String(ownerIndex).padStart(2, "0")}${String(slot + 1).padStart(5, "0")}`;
      const channel = pick(CHANNELS);
      const isMeta = channel === "META";
      const budgetMin = isCommercial ? between(60, 300) * 100000 : between(45, 150) * 100000;
      const budgetMax = Math.round(budgetMin * 1.35);
      const areaMin = isCommercial ? between(8, 40) * 100 : between(9, 20) * 100;

      const createdOffset = isClosed ? recentOffset() + between(10, 40) : recentOffset();
      const createdAt = days(-Math.min(createdOffset, 178));
      const closedAt = isClosed
        ? new Date(Math.min(now.getTime() - DAY_MS, createdAt.getTime() + between(7, 45) * DAY_MS))
        : null;
      const lastTouch = isClosed
        ? closedAt
        : status === "NEW"
          ? createdAt
          : new Date(Math.min(now.getTime() - DAY_MS / 2, createdAt.getTime() + between(1, 20) * DAY_MS));

      const partnerRow = partnerCreators.find(([, share]) => rng() < share);
      const creator = partnerRow ? users[partnerRow[0]] : rng() < 0.25 ? { _id: adminId } : { _id: ownerManagerId };
      const isSiteVisitStage = ["SITE_VISIT_SCHEDULED", "SITE_VISIT", "SITE_VISIT_OVERDUE", "REQUESTED", "CLOSED"].includes(status);
      const fieldExecutive = isFieldOwner ? owner : isSiteVisitStage ? pick(fieldExecutives) : null;

      const data = {
        name,
        company: isFirm ? name : "",
        email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}.${leadSerial}@example.com`,
        companyId,
        city,
        preferredLocations: [pick(localities), pick(localities)].filter((value, index, list) => list.indexOf(value) === index),
        projectInterested: isCommercial ? pick(commercialProjects)[0] : pick(residentialProjects)[0],
        clientProfession: isFirm ? "Business" : pick(PROFESSIONS),
        source: isMeta ? "META" : "MANUAL",
        sourceChannel: channel,
        metaLeadId: isMeta ? `META-DEMO-X${String(leadSerial).padStart(4, "0")}` : "",
        metaPageId: isMeta ? "1122334455" : "",
        metaFormId: isMeta ? "5566778899" : "",
        status,
        hotClient: ["CLOSED", "REQUESTED", "INTERESTED", "SITE_VISIT"].includes(status),
        temperature: ["CLOSED", "REQUESTED", "INTERESTED", "SITE_VISIT"].includes(status)
          ? "HOT"
          : ["LOST", "INVALID", "MISSING_IN_ACTION", "NOT_PICKING_CALLS"].includes(status) ? "COLD" : "WARM",
        requirements: {
          inventoryType: isCommercial ? "COMMERCIAL" : "RESIDENTIAL",
          transactionType: rng() < 0.65 ? "SALE" : isCommercial ? "LEASE" : "RENT",
          furnishingStatus: pick(["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"]),
          propertySubtype: isCommercial ? "OFFICE" : "FLAT",
          budgetMin,
          budgetMax,
          areaMin,
          areaMax: Math.round(areaMin * 1.4),
          areaUnit: "SQ_FT",
          commercial: isCommercial
            ? {
                seats: Math.max(10, Math.round(areaMin / 30)),
                cabins: between(2, 8),
                conferenceRooms: between(1, 2),
                conferenceSeats: 8,
                parkingAvailable: true,
                pantry: true,
                receptionArea: true,
                powerBackup: true,
                centralAC: rng() < 0.7,
                fireSafety: true,
                readyToMove: rng() < 0.7,
              }
            : {},
          residential: isCommercial
            ? {}
            : {
                bhkType: pick(["2BHK", "3BHK", "4BHK"]),
                floor: between(1, 15),
                amenities: { lift: true, security: true, powerBackup: true, parking: true, modularKitchen: rng() < 0.6 },
              },
        },
        assignedTo: owner._id,
        assignedManager: ownerManagerId,
        assignedExecutive: isFieldOwner ? null : owner._id,
        assignedFieldExecutive: fieldExecutive ? fieldExecutive._id : null,
        assignmentHistory: [
          {
            action: "ASSIGNED",
            fromUser: ownerManagerId,
            toUser: owner._id,
            reason: "Seeded demo assignment",
            statusAtTransfer: "NEW",
            createdAt,
            createdBy: ownerManagerId,
          },
        ],
        qualifiedBy: ["NEW", "INVALID"].includes(status) ? null : ownerManagerId,
        qualifiedAt: ["NEW", "INVALID"].includes(status) ? null : new Date(createdAt.getTime() + DAY_MS),
        createdBy: creator._id,
        lastContactedAt: status === "NEW" ? null : lastTouch,
        nextFollowUp: ["CLOSED", "LOST", "INVALID"].includes(status) ? null : days(between(-3, 9)),
        followUpPurpose: ["CLOSED", "LOST", "INVALID"].includes(status) ? "" : pick([
          "Share shortlisted properties",
          "Confirm site visit slot",
          "Negotiate final price",
          "Collect KYC documents",
          "Follow up on budget approval",
        ]),
        dealPayment: undefined,
        brokerageReceived: null,
        brokerageDistributed: 0,
        brokerageClosedAt: null,
        brokerageClosedBy: null,
        brokerageDistributionBreakdown: [],
        inventoryId: null,
        relatedInventoryIds: [],
      };

      let soldInventory = null;
      if (isClosed) {
        closedCount += 1;
        const isSale = data.requirements.transactionType === "SALE";
        if (isSale && saleCursor < saleStock.length && rng() < 0.75) {
          soldInventory = saleStock[saleCursor];
          saleCursor += 1;
        }
        const dealValue = soldInventory?.price || (isSale ? budgetMin : Math.round(budgetMin / 120));
        // ~2% of a sale, two months' rent on a lease.
        const brokerage = Math.max(75000, Math.round((isSale ? dealValue * 0.02 : dealValue * 2) / 1000) * 1000);
        const isPartial = rng() < 0.25;
        const partnerShare = partnerRow ? Math.round(brokerage * 0.15) : 0;
        const executiveShare = Math.round(brokerage * 0.2);
        Object.assign(data, {
          brokerageReceived: brokerage,
          brokerageDistributed: executiveShare + partnerShare,
          brokerageClosedAt: closedAt,
          brokerageClosedBy: ownerManagerId,
          brokerageDistributionBreakdown: [
            { recipientName: owner.name, recipientType: owner.role, amount: executiveShare, note: "Closing incentive", paidDate: closedAt },
            ...(partnerRow
              ? [{ recipientName: users[partnerRow[0]].name, recipientType: "CHANNEL_PARTNER", amount: partnerShare, note: "Referral share", paidDate: closedAt }]
              : []),
          ],
          dealPayment: {
            mode: pick(["UPI", "NET_BANKING_NEFTRTGSIMPS", "NET_BANKING_NEFTRTGSIMPS", "CHECK"]),
            paymentType: isPartial ? "PARTIAL" : "FULL",
            remainingAmount: isPartial ? Math.round(dealValue * 0.3) : 0,
            paymentReference: `UTR-DEMO-${String(leadSerial).padStart(5, "0")}`,
            note: isPartial ? "Token received, balance due on registry" : "Full payment received",
            approvalStatus: "APPROVED",
            approvalNote: "Verified against bank statement",
            approvalRequestedBy: owner._id,
            approvalRequestedAt: new Date(closedAt.getTime() - DAY_MS),
            approvalReviewedBy: adminId,
            approvalReviewedAt: closedAt,
            requestedFromStatus: "SITE_VISIT",
            requestedTargetStatus: "CLOSED",
          },
        });
        if (soldInventory) {
          data.inventoryId = soldInventory._id;
          data.relatedInventoryIds = [soldInventory._id];
          data.projectInterested = soldInventory.projectName;
        }
      } else if (status === "REQUESTED") {
        data.dealPayment = {
          mode: "UPI",
          paymentType: "PARTIAL",
          remainingAmount: Math.round(budgetMin * 0.8),
          paymentReference: `UPI-DEMO-${String(leadSerial).padStart(5, "0")}`,
          note: "Token amount received, awaiting admin approval",
          approvalStatus: "PENDING",
          approvalRequestedBy: owner._id,
          approvalRequestedAt: lastTouch,
          requestedFromStatus: "SITE_VISIT",
          requestedTargetStatus: "CLOSED",
        };
      }

      const lead = await upsert(Lead, { companyId, phone }, data);
      // createdAt is immutable through Mongoose; place the record in its month
      // directly, after validation and hooks have run.
      await Lead.collection.updateOne({ _id: lead._id }, { $set: { createdAt, updatedAt: lastTouch } });
      pipelineLeads.push({ lead, owner, status, createdAt, closedAt, lastTouch, soldInventory, creator, partnerRow });

      if (soldInventory) {
        soldInventory.status = "Sold";
        soldInventory.reservationLeadId = null;
        soldInventory.reservationReason = "";
        soldInventory.saleDetails = {
          leadId: lead._id,
          paymentMode: data.dealPayment.mode,
          paymentType: data.dealPayment.paymentType,
          totalAmount: soldInventory.price,
          remainingAmount: data.dealPayment.remainingAmount,
          paymentReference: data.dealPayment.paymentReference,
          note: `Sold to ${name}`,
          soldAt: closedAt,
        };
        soldInventory.updatedBy = ownerManagerId;
        await soldInventory.save();
        await upsert(InventoryActivity, { companyId, inventoryId: soldInventory._id, actionType: "DIRECT_UPDATE" }, {
          changedBy: ownerManagerId,
          role: USER_ROLES.MANAGER,
          oldValue: { status: "Available" },
          newValue: { status: "Sold" },
          timestamp: closedAt,
        });
      }
    }
  }

  // Hold a few unsold units for leads waiting on approval.
  const requestedLeads = pipelineLeads.filter((row) => row.status === "REQUESTED");
  for (const row of requestedLeads.slice(0, 4)) {
    if (saleCursor >= saleStock.length) break;
    const unit = saleStock[saleCursor];
    saleCursor += 1;
    unit.status = "Blocked";
    unit.reservationLeadId = row.lead._id;
    unit.reservationReason = `Blocked for ${row.lead.name} pending token approval`;
    await unit.save();
    row.lead.inventoryId = unit._id;
    row.lead.relatedInventoryIds = [unit._id];
    await row.lead.save();
    await Lead.collection.updateOne({ _id: row.lead._id }, { $set: { createdAt: row.createdAt, updatedAt: row.lastTouch } });
  }

  // Activity trail and diary notes. Replaced wholesale on every run - these
  // leads only exist in the demo company.
  const pipelineLeadIds = pipelineLeads.map((row) => row.lead._id);
  await LeadActivity.deleteMany({ lead: { $in: pipelineLeadIds } });
  await LeadDiary.deleteMany({ lead: { $in: pipelineLeadIds } });
  const activityDocs = [];
  const diaryDocs = [];
  for (const row of pipelineLeads) {
    const steps = ["Lead created", "Assigned to executive"];
    if (row.status !== "NEW") steps.push("Call made", "Requirement captured");
    if (["SITE_VISIT_SCHEDULED", "SITE_VISIT", "SITE_VISIT_OVERDUE", "REQUESTED", "CLOSED"].includes(row.status)) steps.push("Site visit scheduled");
    if (["SITE_VISIT", "REQUESTED", "CLOSED"].includes(row.status)) steps.push("Site visit completed");
    if (row.status === "REQUESTED") steps.push("Closure requested");
    if (row.status === "CLOSED") steps.push("Closure approved", "Deal closed");
    if (row.status === "LOST") steps.push("Marked lost");
    const span = Math.max(1, row.lastTouch.getTime() - row.createdAt.getTime());
    steps.forEach((action, step) => {
      const at = new Date(row.createdAt.getTime() + (span * step) / Math.max(1, steps.length - 1));
      activityDocs.push({
        lead: row.lead._id,
        action,
        performedBy: step === 0 ? row.creator._id : row.owner._id,
        createdAt: at,
        updatedAt: at,
      });
    });
    if (row.status !== "NEW") {
      diaryDocs.push({
        lead: row.lead._id,
        note: `Discussion with ${row.lead.name}`,
        conversation: `Walked ${row.lead.name} through ${row.lead.projectInterested} options within budget.`,
        visitDetails: row.closedAt || row.status === "SITE_VISIT" ? "Site visit done with the field team; client liked the floor plate." : "",
        nextStep: row.closedAt ? "Hand over documents to production." : "Share shortlisted options on WhatsApp.",
        conversionDetails: row.closedAt ? "Deal closed, brokerage invoice raised." : "",
        createdBy: row.owner._id,
        createdAt: row.lastTouch,
        updatedAt: row.lastTouch,
      });
    }
  }
  await insertWithDates(LeadActivity, activityDocs);
  await insertWithDates(LeadDiary, diaryDocs);

  // -------------------------------------------------------------------------
  // 4. Approval queues (lead status + inventory requests)
  // -------------------------------------------------------------------------
  await LeadStatusRequest.deleteMany({ companyId, lead: { $in: pipelineLeadIds } });
  const statusRequestCandidates = pipelineLeads.filter((row) => ["INTERESTED", "SITE_VISIT", "CONTACTED"].includes(row.status)).slice(0, 8);
  const statusRequestDocs = statusRequestCandidates.map((row, index) => {
    const state = index < 5 ? "pending" : index < 7 ? "approved" : "rejected";
    const proposedStatus = row.status === "CONTACTED" ? "INTERESTED" : row.status === "INTERESTED" ? "SITE_VISIT_SCHEDULED" : "REQUESTED";
    return {
      companyId,
      lead: row.lead._id,
      requestedBy: row.owner._id,
      proposedStatus,
      proposedNextFollowUp: days(index + 1),
      requestNote: `Client confirmed interest - moving ${row.lead.name} to ${proposedStatus.replace(/_/g, " ").toLowerCase()}.`,
      status: state,
      reviewedBy: state === "pending" ? null : managerOf(row.owner),
      reviewedAt: state === "pending" ? null : days(-1),
      reviewNote: state === "approved" ? "Approved." : "",
      rejectionReason: state === "rejected" ? "Please attach the site visit photos first." : "",
    };
  });
  for (const doc of statusRequestDocs) await new LeadStatusRequest(doc).save();

  await InventoryRequest.deleteMany({ companyId, requestNote: /^\[demo\]/ });
  const availableUnits = inventories.filter((row) => row.status === "Available");
  const inventoryRequestRows = [
    ["create", "executive3@test.com", "pending", null, { projectName: "Noida Tech Park", towerName: "Tower 2", unitNumber: "NTP-1204", inventoryType: "COMMERCIAL", type: "Rent", category: "Office", rent: 210000, location: "Sector 132, Noida", city: "Noida", totalArea: 1800 }],
    ["update", "executive@test.com", "pending", availableUnits[0], { price: availableUnits[0] ? Math.round((availableUnits[0].price || availableUnits[0].rent || 0) * 0.95) : 0 }],
    ["update", "field_executive@test.com", "pending", availableUnits[1], { furnishingStatus: "FULLY_FURNISHED" }],
    ["delete", "inside_executive3@test.com", "pending", availableUnits[2], {}],
    ["create", "executive4@test.com", "approved", null, { projectName: "Saket Heights", towerName: "Tower C", unitNumber: "SH-C-702", inventoryType: "RESIDENTIAL", type: "Sale", category: "Apartment", price: 18500000, location: "Saket, Delhi", city: "Delhi", totalArea: 1950 }],
    ["update", "executive2@test.com", "rejected", availableUnits[3], { rent: 50000 }],
  ];
  for (const [index, [type, email, state, unit, proposedData]] of inventoryRequestRows.entries()) {
    const requester = users[email];
    await new InventoryRequest({
      companyId,
      requestedBy: requester._id,
      type,
      proposedData,
      requestNote: `[demo] ${type === "create" ? "New listing from owner meeting" : type === "update" ? "Owner revised the terms" : "Owner withdrew the unit"}`,
      status: state,
      reviewedBy: state === "pending" ? null : adminId,
      reviewedAt: state === "pending" ? null : days(-(index + 1)),
      rejectionReason: state === "rejected" ? "Rent below the owner's floor price." : "",
      teamId: managerOf(requester),
      inventoryId: unit ? unit._id : null,
    }).save();
  }

  // -------------------------------------------------------------------------
  // 5. Tasks
  // -------------------------------------------------------------------------
  const taskTemplates = [
    ["Call back {lead}", "HIGH", ["call"]],
    ["Share brochure with {lead}", "MEDIUM", ["follow-up"]],
    ["Confirm site visit for {lead}", "HIGH", ["site-visit"]],
    ["Collect KYC from {lead}", "MEDIUM", ["documents"]],
    ["Negotiate final terms with {lead}", "HIGH", ["negotiation"]],
    ["Send agreement draft to {lead}", "MEDIUM", ["documents"]],
  ];
  const taskStatuses = ["TODO", "TODO", "IN_PROGRESS", "IN_PROGRESS", "COMPLETED", "BACKLOG"];
  const openForTasks = pipelineLeads.filter((row) => !["LOST", "INVALID"].includes(row.status));
  let tasksSeeded = 0;
  for (let index = 0; index < 36 && index < openForTasks.length; index += 1) {
    const row = openForTasks[(index * 7) % openForTasks.length];
    const [template, priority, tags] = taskTemplates[index % taskTemplates.length];
    const status = row.status === "CLOSED" ? "COMPLETED" : taskStatuses[index % taskStatuses.length];
    const title = `${template.replace("{lead}", row.lead.name)} [#${index + 1}]`;
    await upsert(Task, { companyId, title }, {
      description: `Demo task for ${row.lead.name} (${row.status.replace(/_/g, " ").toLowerCase()}).`,
      status,
      priority,
      assignedTo: row.owner._id,
      createdBy: managerOf(row.owner),
      leadId: row.lead._id,
      dueDate: status === "COMPLETED" ? days(-between(1, 20)) : days(between(-2, 10)),
      tags,
      subtasks: [
        { title: "Prepare context", isCompleted: status !== "TODO" },
        { title: "Execute", isCompleted: status === "COMPLETED" },
        { title: "Log outcome in CRM", isCompleted: status === "COMPLETED" },
      ],
    });
    tasksSeeded += 1;
  }

  // -------------------------------------------------------------------------
  // 6. Targets - six months for everyone who sells
  // -------------------------------------------------------------------------
  const targetPeople = [
    ["manager@test.com", 120, 9000000, 40],
    ["manager2@test.com", 100, 7500000, 35],
    ...salesOwners.map(([email]) => {
      const role = users[email].role;
      if (role === USER_ROLES.FIELD_EXECUTIVE) return [email, 12, 1200000, 45];
      if (role === USER_ROLES.INSIDE_EXECUTIVE) return [email, 40, 2200000, 10];
      return [email, 30, 3000000, 14];
    }),
    ["channel_partner@test.com", 10, 1500000, 6],
    ["channel_partner2@test.com", 10, 1500000, 6],
    ["channel_partner3@test.com", 8, 1200000, 5],
  ];
  let targetsSeeded = 0;
  for (let offset = -5; offset <= 0; offset += 1) {
    const month = monthKey(offset);
    const factor = 0.8 + (offset + 5) * 0.04;
    for (const [email, leadsTarget, revenueTarget, siteVisitTarget] of targetPeople) {
      const user = users[email];
      const isManager = user.role === USER_ROLES.MANAGER;
      await upsert(TargetAssignment, { companyId, assignedTo: user._id, month }, {
        assignedBy: isManager ? adminId : managerOf(user),
        assignedByRole: isManager ? USER_ROLES.ADMIN : USER_ROLES.MANAGER,
        assignedToRole: user.role,
        leadsTarget: Math.round(leadsTarget * factor),
        revenueTarget: Math.round(revenueTarget * factor),
        siteVisitTarget: Math.round(siteVisitTarget * factor),
        notes: offset === 0 ? "Current month target" : `Target for ${month}`,
      });
      targetsSeeded += 1;
    }
  }

  // -------------------------------------------------------------------------
  // 7. Attendance for the new team (last three weeks)
  // -------------------------------------------------------------------------
  const newStaff = extraStaff.map(([email]) => users[email]).filter((user) => user.role !== USER_ROLES.CHANNEL_PARTNER);
  for (const [userIndex, user] of newStaff.entries()) {
    for (let offset = 21; offset >= 1; offset -= 1) {
      const day = days(-offset);
      if (day.getDay() === 0) continue;
      const rotation = (offset + userIndex) % 10;
      const status = rotation === 3 ? "LATE" : rotation === 6 ? "HALF_DAY" : "PRESENT";
      const checkInAt = atTime(day, status === "LATE" ? 10 : 9, status === "LATE" ? 41 : 52);
      const checkOutAt = atTime(day, status === "HALF_DAY" ? 14 : 19, 10);
      await upsert(Attendance, { companyId, userId: user._id, attendanceDate: dateKey(day) }, {
        checkInAt,
        checkOutAt,
        checkInLocation: { latitude: 28.6271, longitude: 77.372, accuracy: 10, distanceMeters: 35, effectiveDistanceMeters: 25, accuracyBufferMeters: 10 },
        checkOutLocation: { latitude: 28.6272, longitude: 77.3721, accuracy: 12, distanceMeters: 40, effectiveDistanceMeters: 28, accuracyBufferMeters: 12 },
        workedMinutes: Math.max(0, Math.round((checkOutAt - checkInAt) / 60000) - 40),
        totalBreakMinutes: 40,
        breakSessions: [{ startAt: atTime(day, 13, 30), endAt: atTime(day, 14, 10), durationMinutes: 40, startNote: "Lunch", endNote: "Back at desk" }],
        status,
        source: user.role === USER_ROLES.FIELD_EXECUTIVE ? "MOBILE" : "WEB",
        checkInNote: "",
        checkOutNote: "",
        metadata: {},
      });
    }
  }

  // -------------------------------------------------------------------------
  // 8. Chat history
  // -------------------------------------------------------------------------
  const directKey = (left, right) => [String(left), String(right)].sort().join(":");
  const chatScripts = [
    ["manager@test.com", "executive@test.com", ["Karan, where are we on the Emerald Residency deal?", "Client signed the token today, sending the cheque photo.", "Great work. Raise the closure request once it clears."]],
    ["manager@test.com", "inside_executive@test.com", ["Please call the new Meta leads before 12.", "On it, 6 done already. Two want site visits this week.", "Loop in Imran for the Cyber City ones."]],
    ["manager2@test.com", "executive3@test.com", ["Simran, you're top of the leaderboard this month!", "Thank you! Two more closures lined up for next week.", "Keep it going - let me know if you need pricing approval."]],
    ["manager2@test.com", "field_executive3@test.com", ["Deepak, can you cover the Nehru Place visit at 4?", "Yes, leaving now. Will share photos after.", "Thanks!"]],
    ["admin@test.com", "manager@test.com", ["Priya, please review the pending closure approvals.", "Reviewing now, will clear them by EOD."]],
    ["admin@test.com", "manager2@test.com", ["Rohan, Noida team targets for next month are up.", "Seen them. We'll need two more field visits a week to hit it."]],
  ];
  let chatMessages = 0;
  const seededRoomIds = [];
  for (const [index, [fromEmail, toEmail, lines]] of chatScripts.entries()) {
    const from = users[fromEmail];
    const to = users[toEmail];
    const key = directKey(from._id, to._id);
    const lastAt = new Date(now.getTime() - (index + 1) * 3 * 60 * 60 * 1000);
    const room = await upsert(ChatRoom, { directKey: key }, {
      type: "direct",
      participants: [from._id, to._id],
      createdBy: from._id,
      teamId: managerOf(to),
      lastMessage: lines[lines.length - 1],
      lastMessageAt: lastAt,
      lastMessageSender: lines.length % 2 === 1 ? from._id : to._id,
      unreadCounts: [
        { user: from._id, count: 0 },
        { user: to._id, count: index % 2 === 0 ? 1 : 0 },
      ],
    });
    seededRoomIds.push(room._id);
    await ChatMessage.deleteMany({ room: room._id });
    const docs = lines.map((text, step) => {
      const sender = step % 2 === 0 ? from : to;
      const receiver = step % 2 === 0 ? to : from;
      const at = new Date(lastAt.getTime() - (lines.length - 1 - step) * 20 * 60 * 1000);
      const isLastUnread = step === lines.length - 1 && index % 2 === 0;
      return {
        room: room._id,
        sender: sender._id,
        text,
        type: "text",
        deliveredTo: [{ user: receiver._id, at }],
        seenBy: isLastUnread ? [] : [{ user: receiver._id, at }],
        createdAt: at,
        updatedAt: at,
      };
    });
    await insertWithDates(ChatMessage, docs);
    chatMessages += docs.length;
  }

  const groupMembers = [
    "manager@test.com", "manager2@test.com", "executive@test.com", "executive2@test.com", "executive3@test.com",
    "executive4@test.com", "inside_executive@test.com", "inside_executive3@test.com", "field_executive@test.com", "field_executive3@test.com",
  ].map((email) => users[email]._id);
  const groupLines = [
    ["admin@test.com", "Morning team! Weekly review at 11 in the conference room."],
    ["manager@test.com", "Please update every lead's next follow-up before the review."],
    ["executive3@test.com", "Closed Matrix Technologies yesterday - 4,200 sq ft in Sector 62."],
    ["manager2@test.com", "Brilliant. That puts Noida team ahead for the month."],
    ["field_executive@test.com", "Three site visits done today, all positive."],
  ];
  const groupLastAt = new Date(now.getTime() - 45 * 60 * 1000);
  const groupRoom = await upsert(ChatRoom, { type: "group", name: "Sales Team", createdBy: adminId }, {
    participants: [adminId, ...groupMembers],
    teamId: managerId,
    lastMessage: groupLines[groupLines.length - 1][1],
    lastMessageAt: groupLastAt,
    lastMessageSender: users[groupLines[groupLines.length - 1][0]]._id,
    unreadCounts: [adminId, ...groupMembers].map((user) => ({ user, count: 0 })),
  });
  seededRoomIds.push(groupRoom._id);
  await ChatMessage.deleteMany({ room: groupRoom._id });
  const groupDocs = groupLines.map(([email, text], step) => {
    const at = new Date(groupLastAt.getTime() - (groupLines.length - 1 - step) * 35 * 60 * 1000);
    return {
      room: groupRoom._id,
      sender: users[email]._id,
      text,
      type: "text",
      deliveredTo: [],
      seenBy: [],
      createdAt: at,
      updatedAt: at,
    };
  });
  await insertWithDates(ChatMessage, groupDocs);
  chatMessages += groupDocs.length;

  // -------------------------------------------------------------------------
  // 9. CRM contacts (property owners) and saved reports
  // -------------------------------------------------------------------------
  for (const [index, unit] of inventories.slice(0, 10).entries()) {
    await upsert(CrmContact, { companyId, kind: "OWNER", phone: unit.ownerNumber }, {
      name: unit.ownerName,
      email: `${unit.ownerName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.com`,
      city: unit.city,
      company: index % 3 === 0 ? `${unit.ownerName.split(" ")[1]} Estates` : "",
      notes: "Owner of a listed unit - prefers WhatsApp.",
      propertyDetails: `${unit.projectName} ${unit.towerName}, unit ${unit.unitNumber}`,
      inventoryIds: [unit._id],
      createdBy: adminId,
    });
  }
  const reportRows = [
    ["Monthly Business Overview", "BUSINESS_OVERVIEW", ["SALES", "FINANCE", "INVENTORY", "TEAM"], "CARDS", false, -2],
    ["Sales Pipeline - Last 90 days", "SALES_PIPELINE", ["SALES"], "BAR", false, -7],
    ["Finance Summary", "FINANCE", ["FINANCE"], "LINE", false, -12],
    ["Weekly Team Performance", "TEAM_TASKS", ["TEAM", "ATTENDANCE"], "TABLE", true, -20],
    ["Inventory Status", "INVENTORY", ["INVENTORY"], "BAR", true, -25],
  ];
  for (const [name, type, sections, visualization, isTemplate, offset] of reportRows) {
    await upsert(Report, { companyId, name }, {
      type,
      from: days(offset - 90),
      to: days(offset),
      sections,
      metrics: [],
      visualization,
      compareWithPrevious: true,
      format: "PDF",
      isTemplate,
      summary: `${pipelineLeads.length} leads, ${closedCount} closed deals`,
      generatedBy: adminId,
      generatedAt: days(offset),
    });
  }

  // -------------------------------------------------------------------------
  // 10. Six months of finance history
  // -------------------------------------------------------------------------
  const coworkingAdmin = users["coworking_admin@test.com"];
  const clients = await CoworkingClient.find({ companyId, status: "ACTIVE" }).sort({ clientCode: 1 }).lean();
  const contracts = await CoworkingContract.find({ companyId }).lean();
  const properties = await CoworkingProperty.find({ companyId }).sort({ propertyCode: 1 }).lean();
  const rentByClient = { "CLI-0001": 45000, "CLI-0002": 9000, "CLI-0003": 72000, "CLI-0005": 56000 };
  let invoicesSeeded = 0;
  let paymentsSeeded = 0;
  let expensesSeeded = 0;

  for (let offset = -5; offset <= -1; offset += 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1, 10, 0, 0);
    const ym = monthKey(offset).replace("-", "");
    for (const client of clients) {
      const rent = rentByClient[client.clientCode];
      if (!rent) continue;
      const contract = contracts.find((row) => String(row.clientId) === String(client._id));
      const totals = computeInvoiceTotals({
        lineItems: [
          { description: "Monthly workspace rent", quantity: 1, unitPrice: rent },
          { description: "Facility and internet charges", quantity: 1, unitPrice: Math.round(rent * 0.05) },
        ],
        discountType: "NONE",
        discountValue: 0,
        additionalCharges: [],
        gstRate: 18,
      });
      const dueDate = new Date(monthStart.getTime() + 9 * DAY_MS);
      const invoiceNumber = `INV-H${ym}-${client.clientCode.slice(-4)}`;
      const invoice = await upsert(CoworkingInvoice, { companyId, invoiceNumber }, {
        clientId: client._id,
        contractId: contract ? contract._id : null,
        billingPeriodStart: monthStart,
        billingPeriodEnd: new Date(now.getFullYear(), now.getMonth() + offset + 1, 0),
        ...totals,
        amountPaid: totals.totalAmount,
        dueDate,
        status: deriveInvoiceStatus({ totalAmount: totals.totalAmount, amountPaid: totals.totalAmount, dueDate, currentStatus: "PENDING", now }),
        notes: "Seeded demo invoice history.",
        createdBy: coworkingAdmin._id,
      });
      await CoworkingInvoice.collection.updateOne({ _id: invoice._id }, { $set: { createdAt: monthStart, updatedAt: dueDate } });
      invoicesSeeded += 1;

      await upsert(CoworkingPayment, { companyId, paymentCode: `PAY-H${ym}-${client.clientCode.slice(-4)}` }, {
        invoiceId: invoice._id,
        clientId: client._id,
        category: "RENT",
        title: `${client.companyName} rent`,
        payerName: client.companyName,
        type: "PAYMENT",
        amount: totals.totalAmount,
        method: "BANK_TRANSFER",
        transactionReference: `NEFT-H${ym}-${client.clientCode.slice(-4)}`,
        paymentDate: new Date(dueDate.getTime() - 2 * DAY_MS),
        status: "COMPLETED",
        notes: "Seeded demo payment history.",
        createdBy: coworkingAdmin._id,
      });
      paymentsSeeded += 1;
    }

    const monthlyCosts = [
      ["RENT", "Monthly building rent", 450000, "BANK_TRANSFER", "Landlord", properties[0]],
      ["UTILITIES", "Electricity and water", 78000 + (offset + 5) * 4000, "UPI", "DHBVN", properties[0]],
      ["SALARY", "Team salaries", 1150000, "BANK_TRANSFER", "Payroll", null],
      ["MARKETING", "Meta and portal ads", 95000 + (offset + 5) * 10000, "CARD", "Meta Platforms", null],
      ["MAINTENANCE", "Housekeeping and security", 62000, "BANK_TRANSFER", "FacilityPro", properties[1] || properties[0]],
    ];
    for (const [index, [category, description, amount, paymentMethod, vendor, property]] of monthlyCosts.entries()) {
      const expenseDate = new Date(monthStart.getTime() + (3 + index * 4) * DAY_MS);
      await upsert(CoworkingExpense, { companyId, expenseCode: `EXP-H${ym}-${index + 1}` }, {
        propertyId: property ? property._id : null,
        category,
        description,
        amount,
        expenseDate,
        paymentMethod,
        vendor,
        notes: "Seeded demo expense history.",
        status: "PAID",
        approvedBy: adminId,
        approvedAt: expenseDate,
        paidAt: expenseDate,
        createdBy: adminId,
      });
      expensesSeeded += 1;
    }
  }

  // Current month salaries and ads are still awaiting payment.
  for (const [index, [category, description, amount]] of [["SALARY", "Team salaries", 1150000], ["MARKETING", "Meta and portal ads", 160000]].entries()) {
    await upsert(CoworkingExpense, { companyId, expenseCode: `EXP-H${monthKey(0).replace("-", "")}-${index + 1}` }, {
      category,
      description,
      amount,
      expenseDate: days(-1),
      paymentMethod: "BANK_TRANSFER",
      vendor: category === "SALARY" ? "Payroll" : "Meta Platforms",
      notes: "Seeded demo expense.",
      status: index === 0 ? "APPROVED" : "PENDING",
      approvedBy: index === 0 ? adminId : null,
      approvedAt: index === 0 ? days(-1) : null,
      createdBy: adminId,
    });
    expensesSeeded += 1;
  }

  // Brokerage receipts for every closed deal, so finance income tracks sales.
  for (const row of pipelineLeads.filter((item) => item.closedAt)) {
    await upsert(CoworkingPayment, { companyId, paymentCode: `RCPT-D${row.lead.phone.slice(-7)}` }, {
      leadId: row.lead._id,
      inventoryId: row.soldInventory ? row.soldInventory._id : null,
      category: "BROKERAGE",
      title: `Brokerage - ${row.lead.name}`,
      payerName: row.lead.name,
      type: "PAYMENT",
      amount: row.lead.brokerageReceived,
      method: row.lead.dealPayment?.mode === "UPI" ? "UPI" : row.lead.dealPayment?.mode === "CHECK" ? "CHEQUE" : "BANK_TRANSFER",
      transactionReference: row.lead.dealPayment?.paymentReference || `UTR-${row.lead.phone}`,
      paymentDate: row.closedAt,
      status: "COMPLETED",
      notes: "Seeded demo brokerage receipt.",
      createdBy: adminId,
    });
    paymentsSeeded += 1;
  }

  await setCounter(CoworkingIdCounter, { companyId, category: "INVOICE" }, 100);
  await setCounter(CoworkingIdCounter, { companyId, category: "PAYMENT" }, 100);
  await setCounter(CoworkingIdCounter, { companyId, category: "EXPENSE" }, 100);

  return {
    extraStaff: extraStaff.length,
    extraInventory: inventories.length,
    pipelineLeads: pipelineLeads.length,
    closedDeals: closedCount,
    soldUnits: inventories.filter((row) => row.status === "Sold").length,
    leadStatusRequests: statusRequestDocs.length,
    inventoryRequests: inventoryRequestRows.length,
    extraTasks: tasksSeeded,
    targetRows: targetsSeeded,
    chatRooms: seededRoomIds.length,
    chatMessages,
    reports: reportRows.length,
    invoiceHistory: invoicesSeeded,
    paymentHistory: paymentsSeeded,
    expenseHistory: expensesSeeded,
  };
};

module.exports = { seedDemoExtras };
