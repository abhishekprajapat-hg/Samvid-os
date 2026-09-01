require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const SAFE_DB_MARKERS = ["test", "staging", "stage", "qa", "sandbox", "perf", "isolated"];
const DANGEROUS_URI_MARKERS = ["prod", "production", "vps"];

const MODEL_FILES = [
  "Company",
  "User",
  "Lead",
  "Inventory",
  "LeadStatusRequest",
  "InventoryRequest",
  "InventoryActivity",
  "ChatRoom",
  "ChatConversation",
  "ChatMessage",
  "ChatCallHistory",
  "Task",
  "Attendance",
  "LeaveRequest",
  "AttendanceRegularization",
  "TargetAssignment",
  "RefreshToken",
  "SubscriptionPlan",
  "TenantSubscription",
];

const fail = (message) => {
  throw new Error(message);
};

const parseMongoDbName = (mongoUri) => {
  try {
    const parsed = new URL(String(mongoUri || "").replace(/^mongodb(\+srv)?:\/\//i, "http://"));
    return decodeURIComponent(String(parsed.pathname || "").replace(/^\/+/, "").split("/")[0] || "");
  } catch {
    return "";
  }
};

const assertSafeMongoUri = (mongoUri) => {
  if (!mongoUri) fail("STAGING_MONGO_URI is required.");
  if (process.env.NODE_ENV === "production") {
    fail("Refusing to run with NODE_ENV=production.");
  }
  if (String(process.env.CONFIRM_ISOLATED_STAGING || "").toLowerCase() !== "true") {
    fail("CONFIRM_ISOLATED_STAGING=true is required.");
  }

  const dbName = parseMongoDbName(mongoUri);
  if (!dbName) fail("Mongo URI must include an explicit database name.");

  const normalizedUri = mongoUri.toLowerCase();
  const normalizedDb = dbName.toLowerCase();
  if (!SAFE_DB_MARKERS.some((marker) => normalizedDb.includes(marker))) {
    fail(`Database name "${dbName}" must include one of: ${SAFE_DB_MARKERS.join(", ")}.`);
  }
  if (DANGEROUS_URI_MARKERS.some((marker) => normalizedUri.includes(marker))) {
    fail("Mongo URI contains a production/VPS marker; use isolated staging only.");
  }

  return dbName;
};

const loadModels = () => {
  const modelsDir = path.resolve(__dirname, "../models");
  for (const modelFile of MODEL_FILES) {
    require(path.join(modelsDir, `${modelFile}.js`));
  }
};

const count = (Model, filter = {}) => Model.countDocuments(filter);

const countLookupMisses = async ({ Model, localField, from, as, filter = {} }) => {
  const [row] = await Model.aggregate([
    { $match: { ...filter, [localField]: { $exists: true, $ne: null } } },
    {
      $lookup: {
        from,
        localField,
        foreignField: "_id",
        as,
      },
    },
    { $match: { [as]: { $size: 0 } } },
    { $count: "count" },
  ]);
  return row?.count || 0;
};

const collectCounts = async () => {
  const names = mongoose.modelNames().sort();
  const rows = {};
  for (const name of names) {
    rows[name] = await count(mongoose.model(name));
  }
  return rows;
};

const collectIndexStatus = async ({ syncIndexes }) => {
  const rows = {};
  for (const modelName of mongoose.modelNames().sort()) {
    const Model = mongoose.model(modelName);
    if (syncIndexes) {
      rows[modelName] = {
        synced: await Model.syncIndexes(),
        indexes: await Model.collection.indexes(),
      };
    } else {
      rows[modelName] = {
        synced: false,
        indexes: await Model.collection.indexes(),
      };
    }
  }
  return rows;
};

const validateRelationships = async () => {
  const Company = mongoose.model("Company");
  const User = mongoose.model("User");
  const Lead = mongoose.model("Lead");
  const Inventory = mongoose.model("Inventory");
  const LeadStatusRequest = mongoose.model("LeadStatusRequest");
  const InventoryRequest = mongoose.model("InventoryRequest");
  const ChatMessage = mongoose.model("ChatMessage");
  const ChatRoom = mongoose.model("ChatRoom");

  const checks = {
    companies: await count(Company),
    usersWithoutCompany: await count(User, { companyId: { $in: [null, undefined] } }),
    leadsWithoutCompany: await count(Lead, { companyId: { $in: [null, undefined] } }),
    inventoryWithoutCompany: await count(Inventory, { companyId: { $in: [null, undefined] } }),
    usersWithMissingCompany: await countLookupMisses({
      Model: User,
      localField: "companyId",
      from: "companies",
      as: "company",
    }),
    leadsWithMissingCompany: await countLookupMisses({
      Model: Lead,
      localField: "companyId",
      from: "companies",
      as: "company",
    }),
    inventoryWithMissingCompany: await countLookupMisses({
      Model: Inventory,
      localField: "companyId",
      from: "companies",
      as: "company",
    }),
    leadsWithMissingAssignee: await countLookupMisses({
      Model: Lead,
      localField: "assignedTo",
      from: "users",
      as: "assignee",
    }),
    inventoryWithMissingReservationLead: await countLookupMisses({
      Model: Inventory,
      localField: "reservationLeadId",
      from: "leads",
      as: "reservationLead",
    }),
    inventorySoldWithMissingSaleLead: await countLookupMisses({
      Model: Inventory,
      localField: "saleDetails.leadId",
      from: "leads",
      as: "saleLead",
      filter: { status: "Sold" },
    }),
    leadStatusRequestsWithMissingLead: await countLookupMisses({
      Model: LeadStatusRequest,
      localField: "lead",
      from: "leads",
      as: "lead",
    }),
    inventoryRequestsWithMissingInventory: await countLookupMisses({
      Model: InventoryRequest,
      localField: "inventoryId",
      from: "inventories",
      as: "inventory",
    }),
    chatMessagesWithMissingRoom: await countLookupMisses({
      Model: ChatMessage,
      localField: "room",
      from: "chatrooms",
      as: "room",
    }),
    chatRoomsWithoutParticipants: await count(ChatRoom, {
      $or: [{ participants: { $exists: false } }, { participants: { $size: 0 } }],
    }),
    blockedInventoryWithSaleLead: await count(Inventory, {
      status: "Blocked",
      "saleDetails.leadId": { $exists: true, $ne: null },
    }),
    soldInventoryStillReserved: await count(Inventory, {
      status: "Sold",
      reservationLeadId: { $exists: true, $ne: null },
    }),
  };

  const failures = Object.entries(checks)
    .filter(([key, value]) => key !== "companies" && value > 0)
    .map(([key, value]) => ({ check: key, count: value }));

  return { checks, failures };
};

const writeJsonReport = (report) => {
  const outputPath = String(process.env.AUDIT_REPORT_PATH || "").trim();
  if (!outputPath) return null;

  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`);
  return resolved;
};

const run = async () => {
  const startedAt = new Date();
  const mongoUri = process.env.STAGING_MONGO_URI;
  const dbName = assertSafeMongoUri(mongoUri);
  const syncIndexes = String(process.env.SYNC_INDEXES || "").toLowerCase() === "true";

  loadModels();

  await mongoose.connect(mongoUri, {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,
  });

  const counts = await collectCounts();
  const indexes = await collectIndexStatus({ syncIndexes });
  const relationships = await validateRelationships();

  const report = {
    ok: relationships.failures.length === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    database: dbName,
    mode: syncIndexes ? "sync-indexes-and-validate" : "validate-only",
    counts,
    indexCounts: Object.fromEntries(
      Object.entries(indexes).map(([model, row]) => [model, row.indexes.length]),
    ),
    relationships,
  };

  const writtenPath = writeJsonReport(report);
  console.log(JSON.stringify({ ...report, reportPath: writtenPath }, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(`Staging data integrity audit failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect failures while exiting.
    }
  });
