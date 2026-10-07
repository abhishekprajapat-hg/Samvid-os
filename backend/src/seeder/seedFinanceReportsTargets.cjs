/**
 * Adds a focused, repeatable local dataset for Finance, Reports, Leaderboard,
 * and Targets. Existing CRM records are preserved; this script only upserts
 * its clearly labelled monthly demo leads and creates missing target rows.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Inventory = require("../models/Inventory");
const TargetAssignment = require("../models/TargetAssignment");
const User = require("../models/User");
const { USER_ROLES } = require("../constants/role.constants");
const { assertSeedAllowed } = require("./seedSafetyGuard.cjs");

const now = new Date();

const monthKey = (offset = 0) => {
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const eventDate = (monthOffset, slot) => {
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const availableDay = monthOffset === 0 ? Math.max(1, now.getDate()) : lastDay;
  const day = Math.min(lastDay, availableDay, 1 + (slot % Math.max(1, availableDay)));
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 9 + (slot % 8), 15, 0, 0);
};

const demoPhone = (monthOffset, index) => {
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const period = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `979${period}${String(index + 1).padStart(3, "0")}`;
};

const LEAD_ROWS = [
  // Current month: payments, closures, visits, open pipeline, and one loss.
  { name: "Apex Consulting", owner: "executive@test.com", status: "CLOSED", source: "META", channel: "META", brokerage: 850000, payment: ["UPI", "FULL", 0, "APPROVED"] },
  { name: "BluePeak Industries", owner: "executive@test.com", status: "CLOSED", source: "MANUAL", channel: "REFERENCE", brokerage: 620000, payment: ["NET_BANKING_NEFTRTGSIMPS", "PARTIAL", 2600000, "APPROVED"] },
  { name: "Cedar Analytics", owner: "executive2@test.com", status: "CLOSED", source: "META", channel: "META", brokerage: 540000, payment: ["NET_BANKING_NEFTRTGSIMPS", "FULL", 0, "APPROVED"], partner: true },
  { name: "Driftwood Retail", owner: "executive2@test.com", status: "CLOSED", source: "MANUAL", channel: "DIRECT_CALL", brokerage: 390000, payment: ["CASH", "FULL", 0, "APPROVED"] },
  { name: "Evergreen Workspace", owner: "field_executive@test.com", status: "CLOSED", source: "MANUAL", channel: "DIRECT_VISIT", brokerage: 480000, payment: ["CHECK", "FULL", 0, "APPROVED"] },
  { name: "Fusion Labs", owner: "executive@test.com", status: "REQUESTED", source: "META", channel: "META", payment: ["UPI", "PARTIAL", 1800000, "PENDING"] },
  { name: "Granite Exports", owner: "executive2@test.com", status: "REQUESTED", source: "MANUAL", channel: "BROKER", payment: ["NET_BANKING_NEFTRTGSIMPS", "FULL", 0, "PENDING"], partner: true },
  { name: "Horizon Foods", owner: "field_executive@test.com", status: "SITE_VISIT", source: "META", channel: "META" },
  { name: "Indigo Ventures", owner: "field_executive2@test.com", status: "SITE_VISIT", source: "MANUAL", channel: "WEBSITE", partner: true },
  { name: "Juniper Systems", owner: "executive@test.com", status: "SITE_VISIT", source: "MANUAL", channel: "JUSTDIAL" },
  { name: "Keystone Media", owner: "executive2@test.com", status: "CONTACTED", source: "META", channel: "META" },
  { name: "Lighthouse Legal", owner: "executive@test.com", status: "INTERESTED", source: "MANUAL", channel: "REFERENCE" },
  { name: "Meridian Health", owner: "executive2@test.com", status: "LOST", source: "META", channel: "META", payment: ["UPI", "PARTIAL", 900000, "REJECTED"] },
  { name: "Northstar Design", owner: "field_executive2@test.com", status: "NEW", source: "MANUAL", channel: "DIRECT_CALL" },

  // Previous periods make report comparisons and the six-month finance chart useful.
  { monthOffset: -1, name: "Orchid Technologies", owner: "executive@test.com", status: "CLOSED", source: "META", channel: "META", brokerage: 710000, payment: ["NET_BANKING_NEFTRTGSIMPS", "FULL", 0, "APPROVED"] },
  { monthOffset: -1, name: "Pioneer Logistics", owner: "executive2@test.com", status: "CLOSED", source: "MANUAL", channel: "BROKER", brokerage: 460000, payment: ["UPI", "PARTIAL", 1200000, "APPROVED"], partner: true },
  { monthOffset: -1, name: "Quartz Financial", owner: "field_executive@test.com", status: "SITE_VISIT", source: "MANUAL", channel: "DIRECT_VISIT" },
  { monthOffset: -1, name: "Riverstone Foods", owner: "field_executive2@test.com", status: "LOST", source: "META", channel: "META" },
  { monthOffset: -2, name: "Summit Advisory", owner: "executive@test.com", status: "CLOSED", source: "MANUAL", channel: "REFERENCE", brokerage: 580000, payment: ["CHECK", "FULL", 0, "APPROVED"] },
  { monthOffset: -2, name: "Terra Manufacturing", owner: "field_executive2@test.com", status: "CLOSED", source: "META", channel: "META", brokerage: 430000, payment: ["UPI", "FULL", 0, "APPROVED"] },
  { monthOffset: -3, name: "Urban Grid", owner: "executive2@test.com", status: "CLOSED", source: "MANUAL", channel: "WEBSITE", brokerage: 520000, payment: ["NET_BANKING_NEFTRTGSIMPS", "FULL", 0, "APPROVED"] },
  { monthOffset: -3, name: "Vista Commerce", owner: "executive@test.com", status: "CONTACTED", source: "META", channel: "META" },
];

const TARGET_ROWS = [
  ["manager@test.com", 24, 1200000, 10],
  ["executive@test.com", 10, 500000, 4],
  ["executive2@test.com", 10, 500000, 4],
  ["field_executive@test.com", 6, 250000, 8],
  ["field_executive2@test.com", 6, 250000, 8],
  ["channel_partner@test.com", 4, 200000, 2],
];

const seedLead = async ({ row, index, companyId, admin, manager, users, inventories }) => {
  const monthOffset = Number(row.monthOffset || 0);
  const occurredAt = eventDate(monthOffset, index);
  const owner = users.get(row.owner);
  const partner = users.get("channel_partner@test.com");
  if (!owner) throw new Error(`Missing active seed assignee: ${row.owner}`);

  const paymentIndex = LEAD_ROWS.slice(0, index + 1).filter((candidate) => candidate.payment).length - 1;
  const inventory = row.payment && inventories.length
    ? inventories[paymentIndex % inventories.length]
    : null;
  const phone = demoPhone(monthOffset, index);
  const payment = row.payment
    ? {
        mode: row.payment[0],
        paymentType: row.payment[1],
        remainingAmount: row.payment[2],
        paymentReference: `SAMVID-${monthKey(monthOffset).replace("-", "")}-${String(index + 1).padStart(3, "0")}`,
        note: "Seeded for the Samvid OS finance dashboard",
        approvalStatus: row.payment[3],
        approvalNote: row.payment[3] === "REJECTED" ? "Demo rejection for dashboard coverage" : "Demo payment verification",
        approvalRequestedBy: owner._id,
        approvalRequestedAt: occurredAt,
        approvalReviewedBy: row.payment[3] === "PENDING" ? null : admin._id,
        approvalReviewedAt: row.payment[3] === "PENDING" ? null : occurredAt,
        requestedFromStatus: "SITE_VISIT",
        requestedTargetStatus: "CLOSED",
      }
    : undefined;
  const isClosed = row.status === "CLOSED";
  const isFieldOwner = owner.role === USER_ROLES.FIELD_EXECUTIVE;
  const nextFollowUp = isClosed && row.payment?.[1] === "PARTIAL"
    ? new Date(now.getTime() + 7 * 86400000)
    : ["CLOSED", "LOST"].includes(row.status)
      ? null
      : new Date(now.getTime() + ((index % 5) + 1) * 86400000);

  const leadData = {
    name: `Samvid Demo - ${row.name}`,
    phone,
    email: `samvid.demo.${monthKey(monthOffset).replace("-", "")}.${String(index + 1).padStart(3, "0")}@example.com`,
    companyId,
    city: index % 3 === 0 ? "Gurugram" : index % 3 === 1 ? "Noida" : "Delhi",
    preferredLocations: ["Cyber City", "Sector 62"],
    projectInterested: inventory?.projectName || "Samvid Business Centre",
    clientProfession: "Business",
    source: row.source,
    sourceChannel: row.channel,
    status: row.status,
    hotClient: ["CLOSED", "REQUESTED", "INTERESTED"].includes(row.status),
    temperature: ["CLOSED", "REQUESTED", "INTERESTED"].includes(row.status) ? "HOT" : "WARM",
    requirements: {
      inventoryType: "COMMERCIAL",
      transactionType: "SALE",
      furnishingStatus: "SEMI_FURNISHED",
      propertySubtype: "OFFICE",
      budgetMin: 8000000,
      budgetMax: 30000000,
      areaMin: 1000,
      areaMax: 3500,
      areaUnit: "SQ_FT",
      commercial: {
        seats: 45,
        cabins: 4,
        conferenceRooms: 1,
        parkingAvailable: true,
        pantry: true,
        powerBackup: true,
        fireSafety: true,
        readyToMove: true,
      },
    },
    inventoryId: inventory?._id || null,
    relatedInventoryIds: inventory ? [inventory._id] : [],
    assignedTo: owner._id,
    assignedManager: manager._id,
    assignedExecutive: isFieldOwner ? null : owner._id,
    assignedFieldExecutive: isFieldOwner ? owner._id : null,
    createdBy: row.partner && partner ? partner._id : manager._id,
    qualifiedBy: manager._id,
    qualifiedAt: occurredAt,
    lastContactedAt: row.status === "NEW" ? null : occurredAt,
    nextFollowUp,
    assignmentHistory: [
      {
        action: "ASSIGNED",
        fromUser: manager._id,
        toUser: owner._id,
        reason: "Samvid OS finance/reporting demo data",
        statusAtTransfer: "NEW",
        createdAt: occurredAt,
        createdBy: manager._id,
      },
    ],
    dealPayment: payment,
    brokerageReceived: isClosed ? row.brokerage : null,
    brokerageDistributed: isClosed ? Math.round(row.brokerage * 0.3) : 0,
    brokerageClosedAt: isClosed ? occurredAt : null,
    brokerageClosedBy: isClosed ? manager._id : null,
    brokerageDistributionBreakdown: isClosed
      ? [{
          recipientName: owner.name,
          recipientType: owner.role,
          amount: Math.round(row.brokerage * 0.3),
          note: "Demo closing incentive",
          paidDate: occurredAt,
        }]
      : [],
  };

  let lead = await Lead.findOne({ companyId, phone });
  const created = !lead;
  if (!lead) lead = new Lead(leadData);
  else lead.set(leadData);
  await lead.save();

  // The dashboards intentionally filter by record timestamps. Keep the seeded
  // records in their representative months while still using save() above so
  // schema validation and CRM contact synchronization run normally.
  // `createdAt` is immutable at the Mongoose schema layer, so use the model's
  // native collection only for these two timestamp fields after validation.
  await Lead.collection.updateOne(
    { _id: lead._id },
    { $set: { createdAt: occurredAt, updatedAt: occurredAt } },
  );

  return created ? "created" : "updated";
};

const run = async () => {
  assertSeedAllowed({ scriptName: "seed:finance-demo", destructive: false });
  await mongoose.connect(process.env.MONGO_URI);

  const admin = await User.findOne({ email: "admin@test.com", role: USER_ROLES.ADMIN, isActive: true });
  if (!admin?.companyId) throw new Error("Active admin@test.com with a company is required");

  const companyId = admin.companyId;
  const requiredEmails = [...new Set([
    "manager@test.com",
    "channel_partner@test.com",
    ...LEAD_ROWS.map((row) => row.owner),
    ...TARGET_ROWS.map(([email]) => email),
  ])];
  const userRows = await User.find({ companyId, email: { $in: requiredEmails }, isActive: true });
  const users = new Map(userRows.map((user) => [user.email, user]));
  const manager = users.get("manager@test.com");
  if (!manager) throw new Error("Active manager@test.com in the admin company is required");

  const inventories = await Inventory.find({
    companyId,
    price: { $gt: 0 },
    status: { $in: ["Available", "Blocked"] },
  })
    .select("_id propertyId projectName price status")
    .sort({ propertyId: 1 })
    .lean();
  if (!inventories.length) throw new Error("At least one priced inventory record is required");

  const leadResult = { created: 0, updated: 0 };
  for (const [index, row] of LEAD_ROWS.entries()) {
    const result = await seedLead({ row, index, companyId, admin, manager, users, inventories });
    leadResult[result] += 1;
  }

  const targetResult = { created: 0, preserved: 0 };
  for (const periodOffset of [-1, 0]) {
    const month = monthKey(periodOffset);
    for (const [email, leadsTarget, revenueTarget, siteVisitTarget] of TARGET_ROWS) {
      const assignee = users.get(email);
      if (!assignee) throw new Error(`Missing active target assignee: ${email}`);
      const existing = await TargetAssignment.findOne({ companyId, assignedTo: assignee._id, month });
      if (existing) {
        targetResult.preserved += 1;
        continue;
      }
      const previousMonthFactor = periodOffset < 0 ? 0.85 : 1;
      await TargetAssignment.create({
        companyId,
        assignedBy: admin._id,
        assignedByRole: admin.role,
        assignedTo: assignee._id,
        assignedToRole: assignee.role,
        month,
        leadsTarget: Math.round(leadsTarget * previousMonthFactor),
        revenueTarget: Math.round(revenueTarget * previousMonthFactor),
        siteVisitTarget: Math.round(siteVisitTarget * previousMonthFactor),
        notes: `Samvid OS demo target for ${month}`,
      });
      targetResult.created += 1;
    }
  }

  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentDemoLeads = await Lead.countDocuments({
    companyId,
    phone: { $regex: `^979${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}` },
    createdAt: { $gte: currentStart, $lt: nextStart },
  });
  const currentTargets = await TargetAssignment.countDocuments({ companyId, month: monthKey(0) });

  console.log(JSON.stringify({
    database: mongoose.connection.name,
    companyId: String(companyId),
    demoLeads: leadResult,
    targets: targetResult,
    currentDemoLeads,
    currentTargets,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(`seedFinanceReportsTargets failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
