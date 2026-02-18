require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Inventory = require("../models/Inventory");
const InventoryRequest = require("../models/InventoryRequest");
const InventoryActivity = require("../models/InventoryActivity");

const toId = (value) => String(value || "");

const resolveUserCompanyId = (user, byId, stack = new Set()) => {
  if (!user) return null;
  if (user.companyId) return user.companyId;

  const userId = toId(user._id);
  if (!userId || stack.has(userId)) return null;
  stack.add(userId);

  if (user.role === "ADMIN") {
    return user._id;
  }

  const parent = byId.get(toId(user.parentId));
  return resolveUserCompanyId(parent, byId, stack);
};

async function backfillCompany() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const allUsers = await User.find({})
      .select("_id role parentId companyId")
      .lean();

    const usersById = new Map(allUsers.map((user) => [toId(user._id), user]));
    const userOps = [];

    allUsers.forEach((user) => {
      if (user.companyId) return;
      const resolvedCompanyId = resolveUserCompanyId(user, usersById);
      if (!resolvedCompanyId) return;
      userOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { companyId: resolvedCompanyId } },
        },
      });
    });

    if (userOps.length) {
      await User.bulkWrite(userOps, { ordered: false });
    }

    const refreshedUsers = await User.find({})
      .select("_id role parentId companyId")
      .lean();
    const refreshedUsersById = new Map(
      refreshedUsers.map((user) => [toId(user._id), user]),
    );

    const admins = refreshedUsers.filter((user) => user.role === "ADMIN" && user.companyId);
    const fallbackCompanyId = admins.length ? admins[0].companyId : null;

    const inventoryRows = await Inventory.find({
      $or: [{ companyId: { $exists: false } }, { companyId: null }],
    })
      .select("_id createdBy teamId")
      .lean();

    const inventoryOps = [];
    inventoryRows.forEach((row) => {
      const creator = refreshedUsersById.get(toId(row.createdBy));
      const manager = refreshedUsersById.get(toId(row.teamId));
      const resolvedCompanyId =
        creator?.companyId || manager?.companyId || fallbackCompanyId || null;

      if (!resolvedCompanyId) return;
      inventoryOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { companyId: resolvedCompanyId } },
        },
      });
    });

    if (inventoryOps.length) {
      await Inventory.bulkWrite(inventoryOps, { ordered: false });
    }

    const inventories = await Inventory.find({})
      .select("_id companyId")
      .lean();
    const inventoryCompanyById = new Map(
      inventories.map((item) => [toId(item._id), item.companyId || null]),
    );

    const requestRows = await InventoryRequest.find({
      $or: [
        { companyId: { $exists: false } },
        { companyId: null },
        { proposedData: { $exists: false } },
      ],
    })
      .select("_id requestedBy inventoryId companyId proposedData proposedChanges type")
      .lean();

    const requestOps = [];
    requestRows.forEach((row) => {
      const requester = refreshedUsersById.get(toId(row.requestedBy));
      const inventoryCompanyId = inventoryCompanyById.get(toId(row.inventoryId));
      const resolvedCompanyId =
        row.companyId || requester?.companyId || inventoryCompanyId || fallbackCompanyId || null;

      const update = {};
      if (resolvedCompanyId) {
        update.companyId = resolvedCompanyId;
      }
      if (!row.proposedData && row.proposedChanges) {
        update.proposedData = row.proposedChanges;
      }
      if (!row.type) {
        update.type = "create";
      }

      if (Object.keys(update).length === 0) return;
      requestOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: update },
        },
      });
    });

    if (requestOps.length) {
      await InventoryRequest.bulkWrite(requestOps, { ordered: false });
    }

    const activityRows = await InventoryActivity.find({
      $or: [{ companyId: { $exists: false } }, { companyId: null }],
    })
      .select("_id inventoryId")
      .lean();

    const activityOps = [];
    activityRows.forEach((row) => {
      const resolvedCompanyId = inventoryCompanyById.get(toId(row.inventoryId)) || null;
      if (!resolvedCompanyId) return;
      activityOps.push({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { companyId: resolvedCompanyId } },
        },
      });
    });

    if (activityOps.length) {
      await InventoryActivity.bulkWrite(activityOps, { ordered: false });
    }

    console.log("Backfill complete");
    console.log(`Users updated: ${userOps.length}`);
    console.log(`Inventory updated: ${inventoryOps.length}`);
    console.log(`Inventory requests updated: ${requestOps.length}`);
    console.log(`Inventory activities updated: ${activityOps.length}`);
  } catch (error) {
    console.error("Company backfill failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

backfillCompany();
