/**
 * Feeds a full, schema-valid demo dataset into the LOCAL database:
 * company, users for every role, role permissions, projects, inventory,
 * leads (+activity/diary), tasks, targets, attendance, leave and the whole
 * coworking stack (properties, floors, cabins, clients, bookings, contracts,
 * invoices, payments, expenses).
 *
 * Everything is written through the Mongoose models so validators, enums and
 * pre-save hooks run exactly as they do for the API. Re-running is safe: each
 * record is upserted on its natural key.
 *
 * Usage: npm run seed:local-demo
 */
require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");

const Company = require("../models/Company");
const User = require("../models/User");
const RolePermission = require("../models/RolePermission");
const Project = require("../models/Project");
const ProjectIdCounter = require("../models/ProjectIdCounter");
const Inventory = require("../models/Inventory");
const InventoryIdCounter = require("../models/InventoryIdCounter");
const InventoryActivity = require("../models/InventoryActivity");
const Lead = require("../models/Lead");
const LeadActivity = require("../models/leadActivity.model");
const LeadDiary = require("../models/leadDiary.model");
const Task = require("../models/Task");
const TargetAssignment = require("../models/TargetAssignment");
const AttendancePolicy = require("../models/AttendancePolicy");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const CoworkingProperty = require("../models/CoworkingProperty");
const CoworkingFloor = require("../models/CoworkingFloor");
const CoworkingCabin = require("../models/CoworkingCabin");
const CoworkingClient = require("../models/CoworkingClient");
const CoworkingBooking = require("../models/CoworkingBooking");
const CoworkingContract = require("../models/CoworkingContract");
const CoworkingInvoice = require("../models/CoworkingInvoice");
const CoworkingPayment = require("../models/CoworkingPayment");
const CoworkingExpense = require("../models/CoworkingExpense");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");

const { USER_ROLES } = require("../constants/role.constants");
const { PERMISSIONS } = require("../constants/permission.constants");
const { generateSeatsForCabin } = require("../services/coworkingOccupancy.service");
const { computeInvoiceTotals, deriveInvoiceStatus } = require("../services/coworkingBilling.calc");

const DEMO_PASSWORD = "123456";
const truthyValues = new Set(["1", "true", "yes", "y", "on"]);
const parseBooleanEnv = (value) => truthyValues.has(String(value || "").trim().toLowerCase());

const parseMongoTarget = (mongoUri) => {
  try {
    const parsed = new URL(String(mongoUri || "").replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return {
      host: parsed.hostname,
      port: parsed.port || "27017",
      dbName: decodeURIComponent(String(parsed.pathname || "").replace(/^\/+/, "").split("/")[0]),
    };
  } catch {
    return { host: "", port: "", dbName: "" };
  }
};

// Guards against pointing this at the VPS database (or the 27018 SSH tunnel).
const assertLocalTarget = () => {
  const target = parseMongoTarget(process.env.MONGO_URI);
  const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
    String(target.host || "").toLowerCase(),
  );
  const allowShared = parseBooleanEnv(process.env.FEED_LOCAL_DEMO_DATA_ALLOW_SHARED);

  if ((!isLoopback || target.port === "27018") && !allowShared) {
    throw new Error(
      [
        "Refusing to feed demo data into a non-local or tunneled Mongo target.",
        `Target: ${target.host || "unknown"}:${target.port || "unknown"}/${target.dbName || "unknown"}.`,
        "Set FEED_LOCAL_DEMO_DATA_ALLOW_SHARED=true only if you intentionally want this on a shared database.",
      ].join(" "),
    );
  }
};

const oid = (seed) =>
  new mongoose.Types.ObjectId(crypto.createHash("md5").update(String(seed)).digest("hex").slice(0, 24));

const now = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
const days = (offset) => new Date(now.getTime() + offset * DAY_MS);
const atTime = (date, hours, minutes) => {
  const copy = new Date(date);
  copy.setHours(hours, minutes, 0, 0);
  return copy;
};
const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthKey = (offset = 0) => {
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

// Upserts through the model so validators and pre-save hooks always run.
const upsert = async (Model, filter, data) => {
  let doc = await Model.findOne(filter);
  if (!doc) {
    doc = new Model({ ...filter, ...data });
  } else {
    doc.set(data);
  }
  await doc.save();
  return doc;
};

const setCounter = async (Model, filter, seq) => {
  await Model.updateOne(filter, { $max: { seq } }, { upsert: true });
};

// ---------------------------------------------------------------------------
// Company, users, role permissions
// ---------------------------------------------------------------------------
const seedCompanyAndUsers = async () => {
  const existingAdmin = await User.findOne({ email: "admin@test.com" });
  const existingCompany = await Company.findOne({
    $or: [{ subdomain: "client" }, ...(existingAdmin?.companyId ? [{ _id: existingAdmin.companyId }] : [])],
  });

  const companyId = existingCompany?._id || existingAdmin?.companyId || oid("company-client");
  const adminId = existingAdmin?._id || oid("user-admin");

  await upsert(Company, { _id: companyId }, {
    name: process.env.CLIENT_COMPANY_NAME || "Client Company",
    legalName: "Client Company Realty Pvt Ltd",
    subdomain: process.env.CLIENT_COMPANY_SLUG || "client",
    status: "ACTIVE",
    ownerUserId: adminId,
    createdBy: adminId,
    settings: {
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      currency: "INR",
      dateFormat: "DD/MM/YYYY",
      branding: { primaryColor: "#0f172a", logoUrl: "" },
    },
  });

  // role, email, name, roleType, department, branch, monthlyTarget
  const staffRows = [
    [USER_ROLES.ADMIN, "admin@test.com", "Aditya Rao", "COMMERCIAL", "Leadership", "Head Office", 0],
    [USER_ROLES.MANAGER, "manager@test.com", "Priya Nair", "COMMERCIAL", "Sales", "Gurugram", 80],
    [USER_ROLES.INSIDE_EXECUTIVE, "inside_executive@test.com", "Rahul Verma", "COMMERCIAL", "Inside Sales", "Gurugram", 30],
    [USER_ROLES.INSIDE_EXECUTIVE, "inside_executive2@test.com", "Sneha Iyer", "RESIDENTIAL", "Inside Sales", "Noida", 30],
    [USER_ROLES.EXECUTIVE, "executive@test.com", "Karan Malhotra", "RESIDENTIAL", "Sales", "Gurugram", 25],
    [USER_ROLES.EXECUTIVE, "executive2@test.com", "Divya Menon", "COMMERCIAL", "Sales", "Delhi", 25],
    [USER_ROLES.FIELD_EXECUTIVE, "field_executive@test.com", "Imran Sheikh", "COMMERCIAL", "Field Ops", "Gurugram", 20],
    [USER_ROLES.FIELD_EXECUTIVE, "field_executive2@test.com", "Tanvi Joshi", "RESIDENTIAL", "Field Ops", "Noida", 20],
    [USER_ROLES.PRODUCTION_EXECUTIVE, "production_executive@test.com", "Vikram Sethi", "COMMERCIAL", "Production", "Head Office", 15],
    [USER_ROLES.COMMUNITY_MANAGER, "community_manager@test.com", "Anita Desai", "COMMERCIAL", "Community", "Gurugram", 15],
    [USER_ROLES.CHANNEL_PARTNER, "channel_partner@test.com", "Mohit Bansal", "COMMERCIAL", "Partnerships", "Delhi", 10],
    [USER_ROLES.COWORKING_ADMIN, "coworking_admin@test.com", "Reena Kapoor", "COMMERCIAL", "Coworking", "Gurugram", 20],
  ];

  const existingUsersByEmail = await User.find({
    email: { $in: staffRows.map(([, email]) => email) },
  })
    .select("_id email")
    .lean();
  const existingUserIdByEmail = new Map(
    existingUsersByEmail.map((user) => [String(user.email || "").toLowerCase(), user._id]),
  );

  const existingManager = await User.findOne({ email: "manager@test.com" });
  const managerId = existingManager?._id || oid("user-manager");

  const users = {};
  for (const [index, row] of staffRows.entries()) {
    const [role, email, name, roleType, department, branch, monthlyTarget] = row;
    const isAdmin = role === USER_ROLES.ADMIN;
    const isManager = role === USER_ROLES.MANAGER;
    const _id =
      existingUserIdByEmail.get(String(email).toLowerCase())
      || (isAdmin ? adminId : isManager ? managerId : oid(`user-${email}`));
    const parentId = isAdmin
      ? null
      : isManager || role === USER_ROLES.COWORKING_ADMIN
        ? adminId
        : managerId;

    users[email] = await upsert(User, { _id }, {
      name,
      email,
      phone: `98100${String(10000 + index)}`,
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
      partnerCode: role === USER_ROLES.CHANNEL_PARTNER ? "CP-DEMO-001" : `DEMO-${index + 1}`,
      brokerageConfig: {
        mode: role === USER_ROLES.CHANNEL_PARTNER ? "PERCENTAGE" : "FLAT",
        value: role === USER_ROLES.CHANNEL_PARTNER ? 2 : 50000,
        notes: "Seeded demo brokerage setup",
      },
      lastLoginAt: isAdmin ? now : days(-(index % 5)),
    });
  }

  // ADMIN bypasses permission checks, but keeping a row for every role makes
  // the roles screen show a complete matrix.
  const readOnly = PERMISSIONS.filter((permission) => permission.endsWith(".view"));
  const permissionsByRole = {
    [USER_ROLES.ADMIN]: [...PERMISSIONS],
    [USER_ROLES.MANAGER]: [...PERMISSIONS],
    [USER_ROLES.COWORKING_ADMIN]: [...PERMISSIONS],
    [USER_ROLES.COMMUNITY_MANAGER]: [
      ...readOnly,
      "bookings.create",
      "bookings.update",
      "clients.create",
      "clients.update",
      "seats.assign",
      "seats.release",
    ],
    [USER_ROLES.PRODUCTION_EXECUTIVE]: [...readOnly, "billing.create", "billing.update", "payments.create"],
    [USER_ROLES.INSIDE_EXECUTIVE]: [...readOnly, "clients.create", "bookings.create"],
    [USER_ROLES.EXECUTIVE]: [...readOnly, "clients.create", "bookings.create"],
    [USER_ROLES.FIELD_EXECUTIVE]: [...readOnly],
    [USER_ROLES.CHANNEL_PARTNER]: ["dashboard.view", "properties.view", "cabins.view", "clients.view"],
  };

  // Earlier runs of this seeder wrote colon-style permissions that no longer validate.
  await RolePermission.deleteMany({ companyId, permissions: { $elemMatch: { $regex: ":" } } });
  await RolePermission.deleteMany({ companyId, _id: null });

  for (const [role, permissions] of Object.entries(permissionsByRole)) {
    await upsert(RolePermission, { companyId, role }, { permissions, updatedBy: adminId });
  }

  return { companyId, adminId, managerId, users };
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
const seedProjects = async ({ companyId, adminId }) => {
  // Drop the malformed projects written by the pre-model version of this seeder.
  await Project.deleteMany({ companyId, projectId: { $regex: "^OOR-PRJ-" } });

  await upsert(Project, { companyId, projectId: "COM-PROJ-0001" }, {
    projectCategory: "COMMERCIAL",
    projectName: "Skyline Business Tower",
    totalLandArea: "3.2 acres",
    totalFloors: 14,
    officesPerFloor: 6,
    totalOffices: 84,
    totalShops: 8,
    totalShowrooms: 4,
    offices: [
      { officeCode: "SBT-0801", officeName: "Corner Suite 801", floorNumber: 8, officeType: "PREMIUM_OFFICE", length: 42, breadth: 30, carpetArea: 1150, builtUpArea: 1260, facing: "NORTH_EAST", reservedParking: 2, status: "AVAILABLE", startingRate: 11500, currentRate: 12800 },
      { officeCode: "SBT-0902", officeName: "Suite 902", floorNumber: 9, officeType: "STANDARD_OFFICE", length: 36, breadth: 28, carpetArea: 940, builtUpArea: 1030, facing: "EAST", reservedParking: 1, status: "BOOKED", startingRate: 11000, currentRate: 12200 },
      { officeCode: "SBT-1101", officeName: "Suite 1101", floorNumber: 11, officeType: "CABIN_OFFICE", length: 40, breadth: 26, carpetArea: 980, builtUpArea: 1080, facing: "WEST", reservedParking: 1, status: "AVAILABLE", startingRate: 11800, currentRate: 13000 },
    ],
    shops: [
      { shopCode: "SBT-SH-01", floorNumber: 0, length: 24, breadth: 18, carpetArea: 400, builtUpArea: 460, facing: "NORTH", parking: 1, status: "AVAILABLE", startingRate: 21000, currentRate: 23500 },
    ],
    showrooms: [
      { showroomCode: "SBT-SR-01", floorNumber: 1, length: 48, breadth: 34, carpetArea: 1500, builtUpArea: 1680, entranceWidth: 12, ceilingHeight: 14, parking: 3, status: "RESERVED", startingRate: 18000, currentRate: 19500 },
    ],
    startingRate: 11000,
    currentRate: 12800,
    otherCharges: "IFMS and power backup billed at actuals.",
    status: "READY_TO_MOVE",
    amenities: ["LIFT", "HIGH_SPEED_ELEVATOR", "VISITOR_PARKING", "CAFETERIA", "RECEPTION_LOBBY"],
    location: "Sector 62, Noida",
    landmark: "Opposite metro station",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
    siteLocation: { lat: 28.6272, lng: 77.3719 },
    ownerManagerName: "Sanjay Gupta",
    ownerManagerMobile: "9811122233",
    brokerManagerName: "Mohit Bansal",
    brokerManagerMobile: "9811122244",
    createdBy: adminId,
  });

  await upsert(Project, { companyId, projectId: "RES-PROJ-0001" }, {
    projectCategory: "RESIDENTIAL",
    projectType: "BUILDING",
    projectName: "Emerald Residency",
    totalLandArea: "5 acres",
    numberOfFlats: 240,
    numberOfFloors: 20,
    flatsPerFloor: 12,
    bhkConfigurations: [
      { bhk: "2_BHK", size: 1150, bedrooms: 2, kitchens: 1, washrooms: 2, drawingRooms: 1, balconies: 2, servantRoom: false, reservedParking: 1 },
      { bhk: "3_BHK", size: 1650, bedrooms: 3, kitchens: 1, washrooms: 3, drawingRooms: 1, balconies: 3, servantRoom: true, reservedParking: 2 },
    ],
    startingRate: 7200,
    currentRate: 8400,
    status: "UNDER_CONSTRUCTION",
    amenities: ["KIDS_PLAY_AREA", "GARDEN", "SECURITY_24X7", "PARTY_LAWN"],
    housingCategory: "MIG",
    location: "Sector 57, Gurugram",
    landmark: "Near Golf Course Extension Road",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122003",
    siteLocation: { lat: 28.4211, lng: 77.0836 },
    ownerManagerName: "Rekha Sharma",
    ownerManagerMobile: "9811133344",
    createdBy: adminId,
  });

  await upsert(Project, { companyId, projectId: "RES-PROJ-0002" }, {
    projectCategory: "RESIDENTIAL",
    projectType: "PLOTTING",
    projectName: "Green Valley Plots",
    totalLandArea: "12 acres",
    totalPlots: 180,
    plotsAvailable: 64,
    plotSize: "1200",
    startingRate: 5200,
    currentRate: 6100,
    status: "RERA_APPROVED",
    amenities: ["GARDEN", "WATER_TANK", "SECURITY_24X7"],
    location: "Sohna Road, Gurugram",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122102",
    createdBy: adminId,
  });

  await setCounter(ProjectIdCounter, { companyId, category: "COMMERCIAL" }, 1);
  await setCounter(ProjectIdCounter, { companyId, category: "RESIDENTIAL" }, 2);
};

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
const LEAD_ROWS = [
  // name, phone, status, inventoryType, city, ownerEmail, budget, area, profession
  ["Aarav Mehta", "9810001001", "NEW", "COMMERCIAL", "Gurugram", "inside_executive@test.com", [9000000, 14000000], [1200, 1800], "IT Services"],
  ["Riya Sharma", "9810001002", "CONTACTED", "COMMERCIAL", "Noida", "inside_executive@test.com", [6000000, 9000000], [800, 1200], "EdTech Founder"],
  ["Kabir Sethi", "9810001003", "INTERESTED", "RESIDENTIAL", "Gurugram", "executive@test.com", [8000000, 11000000], [1400, 1800], "Doctor"],
  ["Neha Kapoor", "9810001004", "SITE_VISIT_SCHEDULED", "COMMERCIAL", "Delhi", "executive2@test.com", [12000000, 18000000], [1500, 2200], "Retail Chain Owner"],
  ["Om Realty LLP", "9810001005", "SITE_VISIT", "COMMERCIAL", "Faridabad", "executive2@test.com", [25000000, 35000000], [6000, 9000], "Logistics"],
  ["Maya Consultants", "9810001006", "CLOSED", "COMMERCIAL", "Gurugram", "inside_executive@test.com", [10000000, 13000000], [1100, 1500], "Consulting"],
  ["Devansh Rana", "9810001007", "NOT_PICKING_CALLS", "RESIDENTIAL", "Noida", "inside_executive2@test.com", [5000000, 7000000], [900, 1200], "Banking"],
  ["Ishita Bhatt", "9810001008", "MISSING_IN_ACTION", "RESIDENTIAL", "Gurugram", "executive@test.com", [6500000, 8500000], [1000, 1400], "Architect"],
  ["Zenith Softworks", "9810001009", "INTERESTED", "COMMERCIAL", "Noida", "inside_executive@test.com", [14000000, 20000000], [2000, 2800], "SaaS"],
  ["Pooja Agarwal", "9810001010", "SITE_VISIT_OVERDUE", "RESIDENTIAL", "Delhi", "executive@test.com", [9000000, 12000000], [1300, 1700], "Lawyer"],
  ["Harsh Vardhan", "9810001011", "CONTACTED", "COMMERCIAL", "Gurugram", "executive2@test.com", [7000000, 10000000], [900, 1300], "Fintech"],
  ["Aditi Roy", "9810001012", "NEW", "RESIDENTIAL", "Gurugram", "inside_executive2@test.com", [4500000, 6500000], [800, 1100], "Teacher"],
  ["Bharat Motors", "9810001013", "OWNER", "COMMERCIAL", "Faridabad", "executive2@test.com", [30000000, 42000000], [7000, 10000], "Automobile"],
  ["Rohit Khanna", "9810001014", "BROKER", "COMMERCIAL", "Delhi", "channel_partner@test.com", [11000000, 16000000], [1400, 2000], "Channel Partner"],
  ["Sana Qureshi", "9810001015", "INVALID", "RESIDENTIAL", "Noida", "inside_executive2@test.com", [0, 0], [0, 0], "Unknown"],
  ["Vertex Analytics", "9810001016", "REQUESTED", "COMMERCIAL", "Gurugram", "inside_executive@test.com", [16000000, 22000000], [2200, 3000], "Analytics"],
  ["Meera Pillai", "9810001017", "CLOSED", "RESIDENTIAL", "Gurugram", "executive@test.com", [7500000, 9500000], [1200, 1500], "Pharma"],
  ["Arjun Sinha", "9810001018", "LOST", "COMMERCIAL", "Noida", "inside_executive@test.com", [5000000, 7000000], [700, 1000], "Startup Founder"],
  ["Nikhil Grover", "9810001019", "SITE_VISIT_SCHEDULED", "RESIDENTIAL", "Gurugram", "executive@test.com", [10000000, 13500000], [1500, 1900], "Investment Banker"],
  ["Lakshmi Traders", "9810001020", "CONTACTED", "COMMERCIAL", "Delhi", "executive2@test.com", [8000000, 12000000], [1000, 1600], "Wholesale"],
  ["Tarun Chawla", "9810001021", "INTERESTED", "COMMERCIAL", "Gurugram", "inside_executive@test.com", [13000000, 17000000], [1800, 2400], "Media"],
  ["Shruti Rane", "9810001022", "NEW", "RESIDENTIAL", "Noida", "inside_executive2@test.com", [5500000, 7500000], [950, 1250], "HR Consultant"],
  ["Guptaji Foods", "9810001023", "SITE_VISIT", "COMMERCIAL", "Faridabad", "executive2@test.com", [18000000, 24000000], [3000, 4500], "F&B"],
  ["Ananya Das", "9810001024", "CONTACTED", "RESIDENTIAL", "Gurugram", "executive@test.com", [6000000, 8000000], [1000, 1300], "Designer"],
];

const seedLeads = async ({ companyId, adminId, managerId, users }) => {
  const fieldExecutives = [users["field_executive@test.com"], users["field_executive2@test.com"]];
  const leads = {};

  for (const [index, row] of LEAD_ROWS.entries()) {
    const [name, phone, status, inventoryType, city, ownerEmail, budget, area, profession] = row;
    const owner = users[ownerEmail];
    const isClosed = status === "CLOSED";
    const isSiteVisit = ["SITE_VISIT", "SITE_VISIT_SCHEDULED", "SITE_VISIT_OVERDUE"].includes(status);
    const fieldExecutive = isSiteVisit ? fieldExecutives[index % fieldExecutives.length] : null;
    const isMeta = index % 4 === 0;

    const data = {
      name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.com`,
      companyId,
      city,
      preferredLocations: inventoryType === "COMMERCIAL" ? ["Cyber City", "Sector 62", "Golf Course Road"] : ["Sector 57", "Sector 92"],
      projectInterested: inventoryType === "COMMERCIAL" ? "Skyline Business Tower" : "Emerald Residency",
      clientProfession: profession,
      source: isMeta ? "META" : "MANUAL",
      metaLeadId: isMeta ? `META-DEMO-${String(index + 1).padStart(3, "0")}` : "",
      metaPageId: isMeta ? "1122334455" : "",
      metaFormId: isMeta ? "5566778899" : "",
      status,
      requirements: {
        inventoryType,
        transactionType: inventoryType === "COMMERCIAL" ? "LEASE" : "SALE",
        furnishingStatus: index % 3 === 0 ? "FULLY_FURNISHED" : "SEMI_FURNISHED",
        propertySubtype: inventoryType === "COMMERCIAL" ? "OFFICE" : "FLAT",
        budgetMin: budget[0],
        budgetMax: budget[1],
        areaMin: area[0],
        areaMax: area[1],
        areaUnit: "SQ_FT",
        commercial: inventoryType === "COMMERCIAL"
          ? {
              seats: 40 + index,
              cabins: 4 + (index % 5),
              conferenceRooms: 1 + (index % 2),
              conferenceSeats: 8,
              parkingAvailable: true,
              pantry: true,
              receptionArea: true,
              powerBackup: true,
              centralAC: index % 2 === 0,
              fireSafety: true,
              readyToMove: index % 3 !== 0,
            }
          : {},
        residential: inventoryType === "RESIDENTIAL"
          ? {
              bhkType: index % 2 === 0 ? "3BHK" : "2BHK",
              floor: 3 + (index % 8),
              amenities: { lift: true, security: true, powerBackup: true, parking: true, modularKitchen: index % 2 === 0 },
            }
          : {},
      },
      assignedTo: owner._id,
      assignedManager: managerId,
      assignedExecutive: owner.role === USER_ROLES.CHANNEL_PARTNER ? null : owner._id,
      assignedFieldExecutive: fieldExecutive ? fieldExecutive._id : null,
      assignmentHistory: [
        {
          action: "ASSIGNED",
          fromUser: managerId,
          toUser: owner._id,
          reason: "Seeded demo assignment",
          statusAtTransfer: "NEW",
          createdAt: days(-(index + 3)),
          createdBy: managerId,
        },
      ],
      qualifiedBy: ["NEW", "INVALID"].includes(status) ? null : managerId,
      qualifiedAt: ["NEW", "INVALID"].includes(status) ? null : days(-(index + 2)),
      createdBy: index % 5 === 0 ? adminId : managerId,
      nextFollowUp: ["CLOSED", "LOST", "INVALID"].includes(status) ? null : days((index % 7) - 2),
      lastContactedAt: status === "NEW" ? null : days(-(index % 6) - 1),
    };

    if (isClosed) {
      const brokerage = 250000 + index * 15000;
      Object.assign(data, {
        brokerageReceived: brokerage,
        brokerageDistributed: Math.round(brokerage * 0.4),
        brokerageClosedAt: days(-(index + 1)),
        brokerageClosedBy: managerId,
        brokerageDistributionBreakdown: [
          { recipientName: owner.name, recipientType: "EXECUTIVE", amount: Math.round(brokerage * 0.25), note: "Closing incentive", paidDate: days(-index) },
          { recipientName: "Mohit Bansal", recipientType: "CHANNEL_PARTNER", amount: Math.round(brokerage * 0.15), note: "Referral share", paidDate: days(-index) },
        ],
        dealPayment: {
          mode: "NET_BANKING_NEFTRTGSIMPS",
          paymentType: "FULL",
          remainingAmount: 0,
          paymentReference: `NEFT-DEMO-${1000 + index}`,
          note: "Full brokerage received",
          approvalStatus: "APPROVED",
          approvalNote: "Verified against bank statement",
          approvalRequestedBy: owner._id,
          approvalRequestedAt: days(-(index + 2)),
          approvalReviewedBy: adminId,
          approvalReviewedAt: days(-(index + 1)),
          requestedFromStatus: "SITE_VISIT",
          requestedTargetStatus: "CLOSED",
        },
      });
    }

    const lead = await upsert(Lead, { companyId, phone }, data);
    leads[phone] = lead;

    // A short interaction trail so lead detail screens are not empty.
    const activityActions = ["LEAD_CREATED", "CALL_MADE", "FOLLOW_UP_SCHEDULED", "STATUS_UPDATED"];
    for (const [step, action] of activityActions.entries()) {
      await upsert(LeadActivity, { lead: lead._id, action }, {
        performedBy: step === 0 ? data.createdBy : owner._id,
      });
    }

    if (index % 2 === 0) {
      await upsert(LeadDiary, { lead: lead._id, note: `Requirement discussion with ${name}` }, {
        conversation: `Walked ${name} through ${data.projectInterested} pricing and availability.`,
        visitDetails: isSiteVisit ? "Site visit planned with the field executive." : "",
        nextStep: isClosed ? "Handover documents to production." : "Share shortlisted options on WhatsApp.",
        conversionDetails: isClosed ? "Deal closed, brokerage invoice raised." : "",
        createdBy: owner._id,
      });
    }
  }

  return leads;
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
const seedInventory = async ({ companyId, adminId, managerId, users, leads }) => {
  const blockedLead = leads["9810001004"];
  const soldLead = leads["9810001006"];

  const rows = [
    {
      propertyId: "COM-9001",
      projectName: "Skyline Business Tower",
      towerName: "Tower A",
      inventoryType: "COMMERCIAL",
      type: "Rent",
      category: "Office",
      status: "Available",
      furnishingStatus: "FULLY_FURNISHED",
      rent: 185000,
      deposit: 1110000,
      depositMonths: 6,
      agreementYears: 3,
      lockInYears: 1,
      price: null,
      location: "DLF Cyber City, Gurugram",
      city: "Gurugram",
      area: "Cyber City",
      pincode: "122002",
      buildingName: "Cyber Greens",
      floorNumber: 8,
      totalFloors: 14,
      totalArea: 1500,
      carpetArea: 1180,
      officeType: "FULLY_FURNISHED",
      seats: 45,
      cabins: 5,
    },
    {
      propertyId: "COM-9002",
      projectName: "Skyline Business Tower",
      towerName: "Tower B",
      inventoryType: "COMMERCIAL",
      type: "Rent",
      category: "Office",
      status: "Available",
      furnishingStatus: "BARE_SHELL",
      rent: 260000,
      deposit: 1560000,
      depositMonths: 6,
      agreementYears: 5,
      lockInYears: 2,
      price: null,
      location: "Sector 62, Noida",
      city: "Noida",
      area: "Sector 62",
      pincode: "201301",
      buildingName: "Skyline Corporate Park",
      floorNumber: 11,
      totalFloors: 14,
      totalArea: 2400,
      carpetArea: 1950,
      officeType: "BARE_SHELL",
      seats: 80,
      cabins: 8,
    },
    {
      propertyId: "COM-9003",
      projectName: "High Street Retail",
      towerName: "Block C",
      inventoryType: "COMMERCIAL",
      type: "Both",
      category: "Shop",
      status: "Blocked",
      furnishingStatus: "SEMI_FURNISHED",
      price: 21000000,
      rent: 125000,
      deposit: 750000,
      depositMonths: 6,
      location: "Connaught Place, Delhi",
      city: "Delhi",
      area: "Connaught Place",
      pincode: "110001",
      buildingName: "Regal Arcade",
      floorNumber: 0,
      totalFloors: 4,
      totalArea: 650,
      carpetArea: 560,
      officeType: "SHOP",
      reservationReason: "Blocked for Neha Kapoor pending token payment",
      reservationLeadId: blockedLead?._id || null,
    },
    {
      propertyId: "COM-9004",
      projectName: "Logistics Park",
      towerName: "Shed 4",
      inventoryType: "COMMERCIAL",
      type: "Rent",
      category: "Warehouse",
      status: "Available",
      furnishingStatus: "BARE_SHELL",
      rent: 420000,
      deposit: 2520000,
      depositMonths: 6,
      agreementYears: 9,
      lockInYears: 3,
      price: null,
      location: "Ballabgarh, Faridabad",
      city: "Faridabad",
      area: "Sector 59",
      pincode: "121004",
      buildingName: "NH-19 Logistics Park",
      floorNumber: 0,
      totalFloors: 1,
      totalArea: 8000,
      carpetArea: 7600,
      officeType: "WAREHOUSE",
    },
    {
      propertyId: "COM-9005",
      projectName: "Skyline Business Tower",
      towerName: "Tower A",
      inventoryType: "COMMERCIAL",
      type: "Sale",
      category: "Office",
      status: "Sold",
      furnishingStatus: "MANAGED_OFFICE",
      price: 16500000,
      location: "Golf Course Road, Gurugram",
      city: "Gurugram",
      area: "Sector 42",
      pincode: "122002",
      buildingName: "Skyline One",
      floorNumber: 6,
      totalFloors: 12,
      totalArea: 1350,
      carpetArea: 1080,
      officeType: "MANAGED_OFFICE",
      saleDetails: {
        leadId: soldLead?._id || null,
        paymentMode: "NET_BANKING_NEFTRTGSIMPS",
        paymentType: "FULL",
        totalAmount: 16500000,
        remainingAmount: 0,
        paymentReference: "RTGS-DEMO-77120",
        note: "Sold to Maya Consultants",
        soldAt: days(-12),
      },
    },
    {
      propertyId: "COM-9006",
      projectName: "Cyber Hub Annexe",
      towerName: "Tower D",
      inventoryType: "COMMERCIAL",
      type: "Rent",
      category: "Coworking",
      status: "Available",
      furnishingStatus: "COWORKING",
      rent: 95000,
      deposit: 285000,
      depositMonths: 3,
      agreementYears: 2,
      lockInYears: 1,
      price: null,
      location: "Udyog Vihar, Gurugram",
      city: "Gurugram",
      area: "Udyog Vihar",
      pincode: "122016",
      buildingName: "Annexe Two",
      floorNumber: 3,
      totalFloors: 7,
      totalArea: 900,
      carpetArea: 760,
      officeType: "COWORKING",
      seats: 24,
      cabins: 2,
    },
    {
      propertyId: "RES-9001",
      projectName: "Emerald Residency",
      towerName: "Tower 3",
      inventoryType: "RESIDENTIAL",
      type: "Rent",
      category: "Apartment",
      status: "Available",
      furnishingStatus: "SEMI_FURNISHED",
      rent: 75000,
      deposit: 225000,
      depositMonths: 3,
      agreementYears: 2,
      lockInYears: 1,
      price: null,
      location: "Sector 57, Gurugram",
      city: "Gurugram",
      area: "Sector 57",
      pincode: "122003",
      buildingName: "Emerald Tower 3",
      floorNumber: 9,
      totalFloors: 20,
      totalArea: 1800,
      carpetArea: 1420,
      bhkType: "3BHK",
      bedrooms: 3,
      bathrooms: 3,
    },
    {
      propertyId: "RES-9002",
      projectName: "Emerald Residency",
      towerName: "Tower 1",
      inventoryType: "RESIDENTIAL",
      type: "Sale",
      category: "Apartment",
      status: "Available",
      furnishingStatus: "UNFURNISHED",
      price: 9800000,
      location: "Sector 57, Gurugram",
      city: "Gurugram",
      area: "Sector 57",
      pincode: "122003",
      buildingName: "Emerald Tower 1",
      floorNumber: 14,
      totalFloors: 20,
      totalArea: 1650,
      carpetArea: 1290,
      bhkType: "3BHK",
      bedrooms: 3,
      bathrooms: 3,
    },
    {
      propertyId: "RES-9003",
      projectName: "Green Valley Plots",
      towerName: "Block B",
      inventoryType: "RESIDENTIAL",
      type: "Sale",
      category: "Plot",
      status: "Available",
      furnishingStatus: "UNFURNISHED",
      price: 7320000,
      location: "Sohna Road, Gurugram",
      city: "Gurugram",
      area: "Sohna",
      pincode: "122102",
      buildingName: "",
      floorNumber: 0,
      totalFloors: 0,
      totalArea: 1200,
      carpetArea: 1200,
    },
    {
      propertyId: "RES-9004",
      projectName: "Palm Grove Floors",
      towerName: "Floor 2",
      inventoryType: "RESIDENTIAL",
      type: "Rent",
      category: "Builder Floor",
      status: "Available",
      furnishingStatus: "FULLY_FURNISHED",
      rent: 62000,
      deposit: 186000,
      depositMonths: 3,
      agreementYears: 2,
      lockInYears: 1,
      price: null,
      location: "Sector 92, Noida",
      city: "Noida",
      area: "Sector 92",
      pincode: "201304",
      buildingName: "Palm Grove",
      floorNumber: 2,
      totalFloors: 4,
      totalArea: 1450,
      carpetArea: 1180,
      bhkType: "2BHK",
      bedrooms: 2,
      bathrooms: 2,
    },
  ];

  const created = [];
  for (const [index, row] of rows.entries()) {
    const isCommercial = row.inventoryType === "COMMERCIAL";
    const data = {
      projectName: row.projectName,
      towerName: row.towerName,
      unitNumber: row.propertyId,
      inventoryType: row.inventoryType,
      type: row.type,
      category: row.category,
      furnishingStatus: row.furnishingStatus,
      status: row.status,
      price: row.price ?? null,
      rent: row.rent ?? null,
      deposit: row.deposit ?? null,
      depositMonths: row.depositMonths ?? null,
      agreementYears: row.agreementYears ?? null,
      lockInYears: row.lockInYears ?? null,
      location: row.location,
      city: row.city,
      area: row.area,
      pincode: row.pincode,
      buildingName: row.buildingName,
      floorNumber: row.floorNumber,
      totalFloors: row.totalFloors,
      totalArea: row.totalArea,
      carpetArea: row.carpetArea,
      builtUpArea: row.totalArea,
      superBuiltUpArea: row.totalArea ? Math.round(row.totalArea * 1.12) : null,
      areaUnit: "SQ_FT",
      maintenanceCharges: isCommercial ? 12 : 4,
      officeNumber: isCommercial ? `${row.floorNumber}0${index + 1}` : "",
      ownerName: `Owner ${index + 1}`,
      ownerNumber: `98220${String(20000 + index)}`,
      ownerWhatsappNumber: `98220${String(20000 + index)}`,
      ownerType: index % 3 === 0 ? "1ST" : "2ND",
      keyManagerName: "Imran Sheikh",
      keyManagerNumber: "9810010006",
      dealType: row.type === "Sale" ? "PURCHASE" : row.type === "Rent" ? "RENT" : "LEASE",
      propertyDate: days(-(30 + index * 5)),
      gstApplicable: isCommercial,
      reservationReason: row.reservationReason || "",
      reservationLeadId: row.reservationLeadId || null,
      saleDetails: row.saleDetails || null,
      documentsAvailable: {
        registry: true,
        searchReport: index % 2 === 0,
        electricityNoc: true,
        maintenanceNoc: index % 3 === 0,
        taxReceipt: true,
        loanNoc: false,
      },
      siteLocation: { lat: 28.45 + index * 0.01, lng: 77.02 + index * 0.01 },
      images: [
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200",
        "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200",
      ],
      floorPlans: [],
      documents: [],
      videoTours: [],
      teamId: managerId,
      createdBy: adminId,
      approvedBy: adminId,
      updatedBy: managerId,
    };

    if (isCommercial) {
      data.commercialDetails = {
        officeType: row.officeType || "OFFICE",
        officeLayout: {
          totalCabins: row.cabins ?? null,
          cabinSeats: row.cabins ? row.cabins * 2 : null,
          workstations: row.seats ?? null,
          seats: row.seats ?? null,
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
        buildingDetails: {
          totalFloors: row.totalFloors,
          parkingType: "BOTH",
          parkingSlots: 10 + index,
          securityType: "BOTH",
          fireSafety: true,
        },
        availability: { readyToMove: true, underConstruction: false, availableFrom: days(7) },
      };
      data.residentialDetails = undefined;
    } else {
      data.residentialDetails = {
        propertyType: row.category === "Plot" ? "PLOT" : "FLAT",
        bhkType: row.bhkType || "",
        bedrooms: row.bedrooms ?? null,
        bathrooms: row.bathrooms ?? null,
        balcony: row.bedrooms ? row.bedrooms : null,
        studyRoom: index % 2 === 0,
        servantRoom: index % 3 === 0,
        parking: 1,
        amenities: {
          modularKitchen: true,
          lift: row.category !== "Plot",
          security: true,
          powerBackup: true,
          gym: index % 2 === 0,
          swimmingPool: index % 3 === 0,
          clubhouse: true,
        },
        utilities: { waterSupply: "MUNICIPAL", electricityBackup: true, gasPipeline: index % 2 === 0 },
      };
      data.commercialDetails = undefined;
    }

    const inventory = await upsert(Inventory, { companyId, propertyId: row.propertyId }, data);
    created.push(inventory);

    await upsert(InventoryActivity, { companyId, inventoryId: inventory._id, actionType: "DIRECT_CREATE" }, {
      changedBy: adminId,
      role: USER_ROLES.ADMIN,
      newValue: { propertyId: row.propertyId, status: row.status },
      timestamp: days(-(20 - index)),
    });
    if (row.status !== "Available") {
      await upsert(InventoryActivity, { companyId, inventoryId: inventory._id, actionType: "DIRECT_UPDATE" }, {
        changedBy: managerId,
        role: USER_ROLES.MANAGER,
        oldValue: { status: "Available" },
        newValue: { status: row.status },
        timestamp: days(-(5 - (index % 4))),
      });
    }
  }

  // Keep app-generated property ids clear of the seeded 9xxx band.
  await setCounter(InventoryIdCounter, { companyId, category: "COMMERCIAL" }, 9006);
  await setCounter(InventoryIdCounter, { companyId, category: "RESIDENTIAL" }, 9004);

  // Link a few leads to the inventory they are chasing.
  const linkRows = [
    ["9810001001", "COM-9001"],
    ["9810001002", "COM-9002"],
    ["9810001004", "COM-9003"],
    ["9810001005", "COM-9004"],
    ["9810001006", "COM-9005"],
    ["9810001003", "RES-9001"],
    ["9810001017", "RES-9002"],
    ["9810001019", "RES-9002"],
  ];
  const byPropertyId = new Map(created.map((row) => [row.propertyId, row]));
  for (const [phone, propertyId] of linkRows) {
    const lead = leads[phone];
    const inventory = byPropertyId.get(propertyId);
    if (!lead || !inventory) continue;
    lead.inventoryId = inventory._id;
    lead.relatedInventoryIds = [inventory._id];
    await lead.save();
  }

  return created;
};

// ---------------------------------------------------------------------------
// Tasks and targets
// ---------------------------------------------------------------------------
const seedTasksAndTargets = async ({ companyId, adminId, managerId, users, leads }) => {
  const taskRows = [
    ["Call the Cyber City enquiry", "TODO", "HIGH", "inside_executive@test.com", 1, "9810001001", ["call", "new-lead"]],
    ["Share Sector 62 options on WhatsApp", "IN_PROGRESS", "MEDIUM", "inside_executive@test.com", 2, "9810001002", ["follow-up"]],
    ["Schedule Noida site visit", "IN_PROGRESS", "HIGH", "field_executive@test.com", 1, "9810001004", ["site-visit"]],
    ["Prepare commercial lease proposal", "TODO", "HIGH", "manager@test.com", 3, "9810001005", ["proposal"]],
    ["Collect closed deal documents", "COMPLETED", "LOW", "production_executive@test.com", -2, "9810001006", ["documents"]],
    ["Verify owner KYC for COM-9003", "TODO", "MEDIUM", "production_executive@test.com", 4, "9810001004", ["kyc"]],
    ["Coworking cabin availability sweep", "TODO", "MEDIUM", "coworking_admin@test.com", 2, null, ["coworking"]],
    ["Chase overdue site visit", "TODO", "HIGH", "executive@test.com", 0, "9810001010", ["escalation"]],
    ["Update Emerald Residency price list", "BACKLOG", "LOW", "manager@test.com", 10, null, ["pricing"]],
    ["Re-engage missing-in-action leads", "IN_PROGRESS", "MEDIUM", "inside_executive2@test.com", 3, "9810001008", ["re-engage"]],
    ["Draft channel partner payout note", "TODO", "MEDIUM", "manager@test.com", 5, "9810001014", ["brokerage"]],
    ["Photoshoot for RES-9004", "BACKLOG", "LOW", "field_executive2@test.com", 8, null, ["marketing"]],
    ["Community welcome kit for new client", "COMPLETED", "LOW", "community_manager@test.com", -4, null, ["community"]],
    ["Monthly pipeline review deck", "IN_PROGRESS", "HIGH", "manager@test.com", 6, null, ["reporting"]],
    ["Reconcile March coworking invoices", "TODO", "HIGH", "coworking_admin@test.com", 2, null, ["billing"]],
    ["Warehouse client negotiation call", "TODO", "MEDIUM", "executive2@test.com", 1, "9810001023", ["negotiation"]],
  ];

  for (const [title, status, priority, assigneeEmail, dueOffset, leadPhone, tags] of taskRows) {
    await upsert(Task, { companyId, title }, {
      description: `${title} — seeded demo task for the ${status.toLowerCase()} column.`,
      status,
      priority,
      assignedTo: users[assigneeEmail]._id,
      createdBy: assigneeEmail === "manager@test.com" ? adminId : managerId,
      leadId: leadPhone && leads[leadPhone] ? leads[leadPhone]._id : null,
      dueDate: days(dueOffset),
      tags,
      subtasks: [
        { title: "Prepare context", isCompleted: status !== "TODO" },
        { title: "Execute", isCompleted: status === "COMPLETED" },
        { title: "Log outcome in CRM", isCompleted: status === "COMPLETED" },
      ],
    });
  }

  const targetRows = [
    ["manager@test.com", adminId, USER_ROLES.ADMIN, 120, 9000000, 40],
    ["inside_executive@test.com", managerId, USER_ROLES.MANAGER, 40, 2500000, 10],
    ["inside_executive2@test.com", managerId, USER_ROLES.MANAGER, 40, 2200000, 10],
    ["executive@test.com", managerId, USER_ROLES.MANAGER, 30, 3000000, 14],
    ["executive2@test.com", managerId, USER_ROLES.MANAGER, 30, 3200000, 14],
    ["field_executive@test.com", managerId, USER_ROLES.MANAGER, 12, 1200000, 45],
    ["field_executive2@test.com", managerId, USER_ROLES.MANAGER, 12, 1000000, 45],
    ["channel_partner@test.com", managerId, USER_ROLES.MANAGER, 10, 1500000, 6],
  ];

  for (const month of [monthKey(-1), monthKey(0)]) {
    for (const [email, assignedBy, assignedByRole, leadsTarget, revenueTarget, siteVisitTarget] of targetRows) {
      const user = users[email];
      const isPastMonth = month === monthKey(-1);
      await upsert(TargetAssignment, { companyId, assignedTo: user._id, month }, {
        assignedBy,
        assignedByRole,
        assignedToRole: user.role,
        leadsTarget: isPastMonth ? Math.round(leadsTarget * 0.9) : leadsTarget,
        revenueTarget: isPastMonth ? Math.round(revenueTarget * 0.9) : revenueTarget,
        siteVisitTarget: isPastMonth ? Math.round(siteVisitTarget * 0.9) : siteVisitTarget,
        notes: isPastMonth ? "Previous month target" : "Current month target",
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Attendance and leave
// ---------------------------------------------------------------------------
const seedAttendance = async ({ companyId, adminId, users }) => {
  await upsert(AttendancePolicy, { companyId }, {
    timezone: "Asia/Kolkata",
    shiftStartMinutes: 10 * 60,
    shiftEndMinutes: 19 * 60,
    graceMinutes: 20,
    halfDayMinutes: 240,
    fullDayMinutes: 450,
    weeklyOffDays: [0],
    allowCheckoutDuringBreak: true,
    geofenceEnabled: true,
    officeLatitude: 28.4595,
    officeLongitude: 77.0266,
    officeRadiusMeters: 300,
    notes: "Seeded demo policy — Gurugram head office.",
  });

  const trackedEmails = [
    "manager@test.com",
    "inside_executive@test.com",
    "inside_executive2@test.com",
    "executive@test.com",
    "executive2@test.com",
    "field_executive@test.com",
    "field_executive2@test.com",
    "production_executive@test.com",
    "community_manager@test.com",
    "coworking_admin@test.com",
  ];

  for (const [userIndex, email] of trackedEmails.entries()) {
    const user = users[email];
    for (let offset = 21; offset >= 1; offset -= 1) {
      const day = days(-offset);
      if (day.getDay() === 0) continue; // Sunday is the weekly off.

      const rotation = (offset + userIndex) % 9;
      let status = "PRESENT";
      if (rotation === 3) status = "LATE";
      else if (rotation === 5) status = "HALF_DAY";
      else if (rotation === 7) status = "LEAVE";
      else if (rotation === 8) status = "MISSED_CHECK_OUT";

      const base = {
        companyId,
        userId: user._id,
        attendanceDate: dateKey(day),
      };

      if (status === "LEAVE") {
        await upsert(Attendance, base, {
          checkInAt: null,
          checkOutAt: null,
          workedMinutes: 0,
          totalBreakMinutes: 0,
          breakSessions: [],
          status,
          source: "MANUAL",
          checkInNote: "Approved leave",
          metadata: { manualStatusBy: adminId, manualStatusAt: day, manualStatusNote: "Marked from leave request" },
        });
        continue;
      }

      const checkInAt = atTime(day, status === "LATE" ? 10 : 9, status === "LATE" ? 48 : 55);
      const checkOutAt = status === "MISSED_CHECK_OUT"
        ? null
        : atTime(day, status === "HALF_DAY" ? 14 : 19, status === "HALF_DAY" ? 10 : 15);
      const workedMinutes = checkOutAt
        ? Math.max(0, Math.round((checkOutAt - checkInAt) / 60000) - 40)
        : 0;

      await upsert(Attendance, base, {
        checkInAt,
        checkOutAt,
        checkInLocation: { latitude: 28.4596, longitude: 77.0267, accuracy: 12, distanceMeters: 40, effectiveDistanceMeters: 28, accuracyBufferMeters: 12 },
        checkOutLocation: checkOutAt
          ? { latitude: 28.4597, longitude: 77.0265, accuracy: 15, distanceMeters: 55, effectiveDistanceMeters: 40, accuracyBufferMeters: 15 }
          : null,
        workedMinutes,
        totalBreakMinutes: checkOutAt ? 40 : 0,
        breakSessions: checkOutAt
          ? [{ startAt: atTime(day, 13, 30), endAt: atTime(day, 14, 10), durationMinutes: 40, startNote: "Lunch", endNote: "Back at desk" }]
          : [],
        status,
        source: user.role === USER_ROLES.FIELD_EXECUTIVE ? "MOBILE" : "WEB",
        checkInNote: user.role === USER_ROLES.FIELD_EXECUTIVE ? "Starting field route" : "",
        checkOutNote: checkOutAt ? "" : "",
        metadata: checkOutAt
          ? {}
          : { autoCheckOutAt: atTime(day, 23, 59), autoCheckOutReason: "No checkout recorded" },
      });
    }
  }

  const leaveRows = [
    ["executive@test.com", -6, -5, "SICK", "APPROVED", "Viral fever, doctor advised rest."],
    ["inside_executive@test.com", 4, 5, "CASUAL", "PENDING", "Family function out of town."],
    ["field_executive@test.com", -12, -12, "EMERGENCY", "APPROVED", "Family emergency."],
    ["executive2@test.com", 9, 11, "CASUAL", "PENDING", "Planned short vacation."],
    ["inside_executive2@test.com", -3, -3, "SICK", "REJECTED", "Applied after the cutoff window."],
    ["community_manager@test.com", 14, 16, "UNPAID", "PENDING", "Extended personal leave."],
    ["production_executive@test.com", -20, -19, "CASUAL", "CANCELLED", "Plan cancelled by the employee."],
  ];

  for (const [email, fromOffset, toOffset, leaveType, status, reason] of leaveRows) {
    const fromDate = dateKey(days(fromOffset));
    const toDate = dateKey(days(toOffset));
    await upsert(LeaveRequest, { companyId, userId: users[email]._id, fromDate, toDate }, {
      totalDays: Math.max(1, toOffset - fromOffset + 1),
      leaveType,
      reason,
      status,
      reviewedBy: ["APPROVED", "REJECTED"].includes(status) ? adminId : null,
      reviewedAt: ["APPROVED", "REJECTED"].includes(status) ? days(fromOffset - 1) : null,
      reviewNote: status === "REJECTED" ? "Please plan leaves in advance." : status === "APPROVED" ? "Approved." : "",
      cancelledAt: status === "CANCELLED" ? days(fromOffset + 1) : null,
    });
  }
};

// ---------------------------------------------------------------------------
// Coworking
// ---------------------------------------------------------------------------
const seedCoworking = async ({ companyId, adminId, users }) => {
  const coworkingAdmin = users["coworking_admin@test.com"];
  const communityManager = users["community_manager@test.com"];

  const propertyRows = [
    ["PROP-0001", "OOR Coworking Hub", "Golf Course Road", "Gurugram", "Haryana", "122002", coworkingAdmin._id],
    ["PROP-0002", "OOR Workspace Noida", "Sector 62", "Noida", "Uttar Pradesh", "201301", communityManager._id],
  ];

  const properties = {};
  for (const [propertyCode, name, line1, city, state, pincode, managerId] of propertyRows) {
    properties[propertyCode] = await upsert(CoworkingProperty, { companyId, propertyCode }, {
      name,
      status: "ACTIVE",
      managerId,
      address: { line1, line2: "", city, state, pincode, country: "India" },
      contact: { name: "Front Desk", phone: "9810050001", email: "hub@example.com" },
      description: `Seeded demo coworking centre in ${city}.`,
      createdBy: adminId,
    });
  }

  const floorRows = [
    ["PROP-0001", 1, "Ground Level"],
    ["PROP-0001", 2, "Second Floor"],
    ["PROP-0001", 3, "Third Floor"],
    ["PROP-0002", 1, "First Floor"],
  ];

  const floors = {};
  for (const [propertyCode, floorNumber, name] of floorRows) {
    const property = properties[propertyCode];
    floors[`${propertyCode}-${floorNumber}`] = await upsert(
      CoworkingFloor,
      { companyId, propertyId: property._id, floorNumber },
      { name, status: "ACTIVE", createdBy: adminId },
    );
  }

  const clientRows = [
    ["CLI-0001", "Vertex Analytics", "Rohan Desai", "9820030001", "ACTIVE", "STARTUP", "VERIFIED", "Analytics"],
    ["CLI-0002", "Maya Consultants", "Maya Rathi", "9820030002", "ACTIVE", "SME", "VERIFIED", "Consulting"],
    ["CLI-0003", "Zenith Softworks", "Amit Zende", "9820030003", "ACTIVE", "SME", "SUBMITTED", "SaaS"],
    ["CLI-0004", "Bluewave Design", "Nisha Bhatt", "9820030004", "PROSPECT", "FREELANCER", "PENDING", "Design"],
    ["CLI-0005", "Northline Logistics", "Sameer Khan", "9820030005", "ACTIVE", "ENTERPRISE", "VERIFIED", "Logistics"],
    ["CLI-0006", "Kite Media", "Ira Kapoor", "9820030006", "INACTIVE", "STARTUP", "REJECTED", "Media"],
  ];

  const clients = {};
  for (const [index, row] of clientRows.entries()) {
    const [clientCode, companyName, contactPerson, phone, status, clientType, kycStatus, industry] = row;
    clients[clientCode] = await upsert(CoworkingClient, { companyId, clientCode }, {
      companyName,
      contactPerson,
      phone,
      alternatePhone: "",
      email: `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.com`,
      address: { line1: "Golf Course Road", city: "Gurugram", state: "Haryana", pincode: "122002", country: "India" },
      gstNumber: "",
      panNumber: "",
      kycStatus,
      clientType,
      industry,
      notes: "Seeded demo coworking client.",
      status,
      contacts: [
        { name: contactPerson, designation: "Primary contact", phone, email: `contact${index + 1}@example.com` },
      ],
      createdBy: adminId,
    });
  }

  // cabinCode, propertyCode, floorNumber, name, cabinType, capacity, rent, deposit, occupiedSeats, override
  const cabinRows = [
    ["CAB-001", "PROP-0001", 1, "Cabin A-101", "PRIVATE", 6, 45000, 90000, 6, "NONE", "CLI-0001"],
    ["CAB-002", "PROP-0001", 1, "Cabin A-102", "PRIVATE", 4, 32000, 64000, 2, "NONE", "CLI-0002"],
    ["CAB-003", "PROP-0001", 2, "Cabin B-201", "SHARED", 10, 68000, 136000, 4, "NONE", "CLI-0003"],
    ["CAB-004", "PROP-0001", 2, "Cabin B-202", "MANAGER_CABIN", 4, 38000, 76000, 0, "NONE", null],
    ["CAB-005", "PROP-0001", 3, "Cabin C-301", "PRIVATE", 8, 56000, 112000, 8, "NONE", "CLI-0005"],
    ["CAB-006", "PROP-0001", 3, "Meeting Pod C-302", "MEETING_POD", 4, 18000, 36000, 0, "MAINTENANCE", null],
    ["CAB-007", "PROP-0002", 1, "Cabin N-101", "PRIVATE", 6, 40000, 80000, 0, "BLOCKED", null],
    ["CAB-008", "PROP-0002", 1, "Cabin N-102", "SHARED", 12, 72000, 144000, 5, "NONE", "CLI-0003"],
  ];

  const cabins = {};
  for (const row of cabinRows) {
    const [cabinCode, propertyCode, floorNumber, name, cabinType, capacity, monthlyRent, securityDeposit, occupiedSeats, manualOverride, clientCode] = row;
    const property = properties[propertyCode];
    const floor = floors[`${propertyCode}-${floorNumber}`];
    const seats = generateSeatsForCabin(cabinCode, capacity);
    const client = clientCode ? clients[clientCode] : null;

    for (let seatIndex = 0; seatIndex < occupiedSeats; seatIndex += 1) {
      seats[seatIndex].status = "OCCUPIED";
      seats[seatIndex].assignedTo = {
        clientId: client ? client._id : null,
        label: client ? client.companyName : "",
        assignedAt: days(-30),
        assignedBy: coworkingAdmin._id,
      };
    }

    cabins[cabinCode] = await upsert(CoworkingCabin, { companyId, cabinCode }, {
      propertyId: property._id,
      floorId: floor._id,
      name,
      cabinType,
      capacityPreset: [4, 6, 8, 10, 12].includes(capacity) ? capacity : "CUSTOM",
      capacity,
      monthlyRent,
      securityDeposit,
      description: `Seeded demo cabin on floor ${floorNumber}.`,
      amenities: ["AC", "WHITEBOARD", "POWER_BACKUP", "ERGONOMIC_CHAIRS"],
      manualOverride,
      blockReason: manualOverride === "BLOCKED" ? "Held for an incoming enterprise client" : "",
      seats,
      createdBy: adminId,
    });
  }

  // bookingCode, clientCode, cabinCode, bookingType, seatIndex, startOffset, endOffset, status, price
  const bookingRows = [
    ["BKG-00001", "CLI-0001", "CAB-001", "CABIN", null, -60, 120, "ACTIVE", 45000],
    ["BKG-00002", "CLI-0002", "CAB-002", "SEAT", 1, -30, 90, "ACTIVE", 9000],
    ["BKG-00003", "CLI-0003", "CAB-003", "SEAT", 2, -15, 75, "CONFIRMED", 8500],
    ["BKG-00004", "CLI-0005", "CAB-005", "CABIN", null, -90, -10, "COMPLETED", 56000],
    ["BKG-00005", "CLI-0004", "CAB-004", "CABIN", null, 7, 187, "PENDING", 38000],
    ["BKG-00006", "CLI-0006", "CAB-008", "SEAT", 3, -45, -20, "CANCELLED", 7000],
    ["BKG-00007", "CLI-0003", "CAB-008", "CABIN", null, -20, 160, "ACTIVE", 72000],
  ];

  for (const row of bookingRows) {
    const [bookingCode, clientCode, cabinCode, bookingType, seatIndex, startOffset, endOffset, status, price] = row;
    const cabin = cabins[cabinCode];
    await upsert(CoworkingBooking, { companyId, bookingCode }, {
      clientId: clients[clientCode]._id,
      propertyId: cabin.propertyId,
      floorId: cabin.floorId,
      cabinId: cabin._id,
      seatCode: bookingType === "SEAT" ? cabin.seats[seatIndex].seatCode : "",
      bookingType,
      startDate: days(startOffset),
      endDate: days(endOffset),
      startTime: "",
      endTime: "",
      price,
      deposit: price * 2,
      status,
      notes: "Seeded demo booking.",
      isRecurring: false,
      recurrencePattern: "NONE",
      cancelledAt: status === "CANCELLED" ? days(endOffset) : null,
      cancelledReason: status === "CANCELLED" ? "Client deferred the move-in." : "",
      createdBy: coworkingAdmin._id,
    });
  }

  // contractCode, clientCode, cabinCode, contractType, seatIndex, startOffset, endOffset, rent, status
  const contractRows = [
    ["CTR-0001", "CLI-0001", "CAB-001", "CABIN", null, -60, 305, 45000, "ACTIVE"],
    ["CTR-0002", "CLI-0002", "CAB-002", "SEAT", 1, -30, 335, 9000, "ACTIVE"],
    ["CTR-0003", "CLI-0005", "CAB-005", "CABIN", null, -330, 20, 56000, "EXPIRING"],
    ["CTR-0004", "CLI-0004", "CAB-004", "CABIN", null, 7, 372, 38000, "DRAFT"],
    ["CTR-0005", "CLI-0006", "CAB-008", "SEAT", 3, -400, -35, 7000, "EXPIRED"],
  ];

  const contracts = {};
  for (const row of contractRows) {
    const [contractCode, clientCode, cabinCode, contractType, seatIndex, startOffset, endOffset, rent, status] = row;
    const cabin = cabins[cabinCode];
    contracts[contractCode] = await upsert(CoworkingContract, { companyId, contractCode }, {
      clientId: clients[clientCode]._id,
      propertyId: cabin.propertyId,
      floorId: cabin.floorId,
      cabinId: cabin._id,
      seatCode: contractType === "SEAT" ? cabin.seats[seatIndex].seatCode : "",
      contractType,
      startDate: days(startOffset),
      endDate: days(endOffset),
      rent,
      deposit: rent * 2,
      lockInPeriodMonths: 6,
      noticePeriodDays: 30,
      status,
      notes: "Seeded demo contract.",
      createdBy: coworkingAdmin._id,
    });
  }

  // invoiceNumber, clientCode, contractCode, rent, dueOffset, amountPaid
  const year = now.getFullYear();
  const invoiceRows = [
    [`INV-${year}-00001`, "CLI-0001", "CTR-0001", 45000, -35, 53100],
    [`INV-${year}-00002`, "CLI-0001", "CTR-0001", 45000, -5, 25000],
    [`INV-${year}-00003`, "CLI-0002", "CTR-0002", 9000, 10, 0],
    [`INV-${year}-00004`, "CLI-0005", "CTR-0003", 56000, -12, 0],
    [`INV-${year}-00005`, "CLI-0003", null, 72000, 15, 0],
    [`INV-${year}-00006`, "CLI-0006", "CTR-0005", 7000, -60, 8260],
  ];

  const invoices = {};
  for (const [invoiceNumber, clientCode, contractCode, rent, dueOffset, amountPaid] of invoiceRows) {
    const totals = computeInvoiceTotals({
      lineItems: [
        { description: "Monthly workspace rent", quantity: 1, unitPrice: rent },
        { description: "Facility and internet charges", quantity: 1, unitPrice: Math.round(rent * 0.05) },
      ],
      discountType: "NONE",
      discountValue: 0,
      additionalCharges: dueOffset < 0 ? [{ label: "Meeting room hours", amount: 1500 }] : [],
      gstRate: 18,
    });
    const dueDate = days(dueOffset);
    const status = deriveInvoiceStatus({
      totalAmount: totals.totalAmount,
      amountPaid,
      dueDate,
      currentStatus: "PENDING",
      now,
    });

    invoices[invoiceNumber] = await upsert(CoworkingInvoice, { companyId, invoiceNumber }, {
      clientId: clients[clientCode]._id,
      contractId: contractCode ? contracts[contractCode]._id : null,
      billingPeriodStart: days(dueOffset - 30),
      billingPeriodEnd: dueDate,
      ...totals,
      amountPaid,
      dueDate,
      status,
      notes: "Seeded demo invoice.",
      createdBy: coworkingAdmin._id,
    });
  }

  const paymentRows = [
    ["PAY-00001", `INV-${year}-00001`, "CLI-0001", 53100, "BANK_TRANSFER", -34],
    ["PAY-00002", `INV-${year}-00002`, "CLI-0001", 25000, "UPI", -4],
    ["PAY-00003", `INV-${year}-00006`, "CLI-0006", 8260, "CASH", -58],
  ];

  for (const [paymentCode, invoiceNumber, clientCode, amount, method, dateOffset] of paymentRows) {
    await upsert(CoworkingPayment, { companyId, paymentCode }, {
      invoiceId: invoices[invoiceNumber]._id,
      clientId: clients[clientCode]._id,
      type: "PAYMENT",
      amount,
      method,
      transactionReference: method === "CASH" ? "" : `TXN-DEMO-${paymentCode}`,
      paymentDate: days(dateOffset),
      status: "COMPLETED",
      notes: "Seeded demo payment.",
      createdBy: coworkingAdmin._id,
    });
  }

  const expenseRows = [
    ["EXP-00001", "PROP-0001", "RENT", "Monthly building rent", 450000, -25, "BANK_TRANSFER", "Landlord", "PAID"],
    ["EXP-00002", "PROP-0001", "UTILITIES", "Electricity bill", 86000, -20, "UPI", "DHBVN", "APPROVED"],
    ["EXP-00003", "PROP-0001", "MAINTENANCE", "HVAC servicing", 24000, -12, "CASH", "CoolCare Services", "PENDING"],
    ["EXP-00004", "PROP-0002", "SUPPLIES", "Pantry restock", 18500, -8, "CARD", "Metro Cash and Carry", "APPROVED"],
    ["EXP-00005", "PROP-0002", "MARKETING", "Local campaign", 65000, -4, "BANK_TRANSFER", "AdWorks", "PENDING"],
    ["EXP-00006", "PROP-0001", "REPAIRS", "Glass partition repair", 12500, -2, "UPI", "Sharma Glass Works", "REJECTED"],
  ];

  for (const row of expenseRows) {
    const [expenseCode, propertyCode, category, description, amount, dateOffset, paymentMethod, vendor, status] = row;
    await upsert(CoworkingExpense, { companyId, expenseCode }, {
      propertyId: properties[propertyCode]._id,
      category,
      description,
      amount,
      expenseDate: days(dateOffset),
      paymentMethod,
      vendor,
      notes: "Seeded demo expense.",
      status,
      approvedBy: ["APPROVED", "PAID"].includes(status) ? adminId : null,
      approvedAt: ["APPROVED", "PAID"].includes(status) ? days(dateOffset + 1) : null,
      rejectedReason: status === "REJECTED" ? "Missing vendor invoice." : "",
      paidAt: status === "PAID" ? days(dateOffset + 2) : null,
      createdBy: coworkingAdmin._id,
    });
  }

  const counters = [
    ["PROPERTY", propertyRows.length],
    ["CABIN", cabinRows.length],
    ["CLIENT", clientRows.length],
    ["BOOKING", bookingRows.length],
    ["CONTRACT", contractRows.length],
    ["INVOICE", invoiceRows.length],
    ["PAYMENT", paymentRows.length],
    ["EXPENSE", expenseRows.length],
  ];
  for (const [category, seq] of counters) {
    await setCounter(CoworkingIdCounter, { companyId, category }, seq);
  }
};

// ---------------------------------------------------------------------------
const main = async () => {
  assertLocalTarget();
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const { companyId, adminId, managerId, users } = await seedCompanyAndUsers();
  await seedProjects({ companyId, adminId });
  const leads = await seedLeads({ companyId, adminId, managerId, users });
  await seedInventory({ companyId, adminId, managerId, users, leads });
  await seedTasksAndTargets({ companyId, adminId, managerId, users, leads });
  await seedAttendance({ companyId, adminId, users });
  await seedCoworking({ companyId, adminId, users });

  const counts = {
    companies: await Company.countDocuments({ _id: companyId }),
    users: await User.countDocuments({ companyId }),
    rolePermissions: await RolePermission.countDocuments({ companyId }),
    projects: await Project.countDocuments({ companyId }),
    inventories: await Inventory.countDocuments({ companyId }),
    inventoryActivities: await InventoryActivity.countDocuments({ companyId }),
    leads: await Lead.countDocuments({ companyId }),
    leadActivities: await LeadActivity.countDocuments({}),
    leadDiaries: await LeadDiary.countDocuments({}),
    tasks: await Task.countDocuments({ companyId }),
    targetAssignments: await TargetAssignment.countDocuments({ companyId }),
    attendance: await Attendance.countDocuments({ companyId }),
    leaveRequests: await LeaveRequest.countDocuments({ companyId }),
    coworkingProperties: await CoworkingProperty.countDocuments({ companyId }),
    coworkingFloors: await CoworkingFloor.countDocuments({ companyId }),
    coworkingCabins: await CoworkingCabin.countDocuments({ companyId }),
    coworkingClients: await CoworkingClient.countDocuments({ companyId }),
    coworkingBookings: await CoworkingBooking.countDocuments({ companyId }),
    coworkingContracts: await CoworkingContract.countDocuments({ companyId }),
    coworkingInvoices: await CoworkingInvoice.countDocuments({ companyId }),
    coworkingPayments: await CoworkingPayment.countDocuments({ companyId }),
    coworkingExpenses: await CoworkingExpense.countDocuments({ companyId }),
  };

  console.log("Local demo data feed complete.");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Every seeded account uses the password ${DEMO_PASSWORD} (admin@test.com, manager@test.com, executive@test.com, coworking_admin@test.com, ...).`);

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(`feedLocalDemoData failed: ${error.message}`);
  if (error.errors) {
    for (const [path, detail] of Object.entries(error.errors)) {
      console.error(`  - ${path}: ${detail.message}`);
    }
  }
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors during failure
  }
  process.exit(1);
});
