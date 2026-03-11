require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Inventory = require("../models/Inventory");

const toObjectIdString = (value) => String(value || "").trim();
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const collectLeadOwnerIds = (lead) => {
  const ids = [
    lead?.createdBy,
    lead?.assignedTo,
    lead?.assignedManager,
    lead?.assignedExecutive,
    lead?.assignedFieldExecutive,
  ]
    .map((value) => toObjectIdString(value))
    .filter((value) => isValidObjectId(value));

  return [...new Set(ids)];
};

const collectLeadInventoryIds = (lead) => {
  const candidateIds = [];
  if (lead?.inventoryId) candidateIds.push(lead.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    candidateIds.push(...lead.relatedInventoryIds);
  }

  const ids = candidateIds
    .map((value) => toObjectIdString(value))
    .filter((value) => isValidObjectId(value));

  return [...new Set(ids)];
};

async function resolveLeadCompanyId(lead) {
  const ownerIds = collectLeadOwnerIds(lead);
  if (ownerIds.length) {
    const users = await User.find({ _id: { $in: ownerIds }, companyId: { $ne: null } })
      .select("companyId")
      .lean();

    const companyIds = [
      ...new Set(
        users
          .map((row) => toObjectIdString(row?.companyId))
          .filter((value) => isValidObjectId(value)),
      ),
    ];

    if (companyIds.length === 1) {
      return companyIds[0];
    }
    if (companyIds.length > 1) {
      return null;
    }
  }

  const inventoryIds = collectLeadInventoryIds(lead);
  if (!inventoryIds.length) return null;

  const inventories = await Inventory.find({
    _id: { $in: inventoryIds },
    companyId: { $ne: null },
  })
    .select("companyId")
    .lean();
  const inventoryCompanyIds = [
    ...new Set(
      inventories
        .map((row) => toObjectIdString(row?.companyId))
        .filter((value) => isValidObjectId(value)),
    ),
  ];

  if (inventoryCompanyIds.length === 1) {
    return inventoryCompanyIds[0];
  }

  return null;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const leads = await Lead.find({
    $or: [{ companyId: null }, { companyId: { $exists: false } }],
  })
    .select(
      "_id companyId createdBy assignedTo assignedManager assignedExecutive assignedFieldExecutive inventoryId relatedInventoryIds",
    )
    .lean();

  if (!leads.length) {
    console.log("No leads require company backfill.");
    process.exit(0);
  }

  let matched = 0;
  let skipped = 0;
  const operations = [];

  for (const lead of leads) {
    const resolvedCompanyId = await resolveLeadCompanyId(lead);
    if (!resolvedCompanyId) {
      skipped += 1;
      continue;
    }

    operations.push({
      updateOne: {
        filter: { _id: lead._id },
        update: { $set: { companyId: resolvedCompanyId } },
      },
    });
    matched += 1;
  }

  if (operations.length) {
    await Lead.bulkWrite(operations, { ordered: false });
  }

  console.log(
    `Lead company backfill complete. scanned=${leads.length}, matched=${matched}, skipped=${skipped}`,
  );
  process.exit(0);
}

run().catch((error) => {
  console.error(`backfillLeadCompany failed: ${error.message}`);
  process.exit(1);
});

