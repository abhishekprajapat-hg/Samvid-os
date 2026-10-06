/*
 * One-off fix for the reporting rule (29 Sep 2026): every role except Admin
 * reports to a Manager, and a Manager reports to an Admin.
 *
 * Existing accounts created under the old rule (Coworking admins reported to
 * an Admin) keep that parent until someone edits them. This moves every
 * active non-Admin, non-Manager account whose parent is not an active Manager
 * in the same company under the Manager with the fewest direct reports,
 * preferring one with the same business category.
 *
 *   node src/scripts/moveStaffUnderManagers.cjs           # dry run, prints the plan
 *   node src/scripts/moveStaffUnderManagers.cjs --apply   # writes the changes
 */
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");
const { USER_ROLES } = require("../constants/role.constants");

const APPLY = process.argv.includes("--apply");

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const managers = await User.find({ role: USER_ROLES.MANAGER, isActive: true })
    .select("_id name companyId roleType")
    .lean();
  const managersByCompany = new Map();
  for (const manager of managers) {
    const key = String(manager.companyId || "");
    if (!managersByCompany.has(key)) managersByCompany.set(key, []);
    managersByCompany.get(key).push(manager);
  }

  const reportCounts = new Map();
  const counts = await User.aggregate([
    { $match: { parentId: { $in: managers.map((row) => row._id) }, isActive: true } },
    { $group: { _id: "$parentId", count: { $sum: 1 } } },
  ]);
  counts.forEach((row) => reportCounts.set(String(row._id), row.count));

  const managerIds = new Set(managers.map((row) => String(row._id)));
  const staff = await User.find({
    role: { $nin: [USER_ROLES.ADMIN, USER_ROLES.MANAGER] },
    isActive: true,
  })
    .select("_id name email role roleType companyId parentId")
    .lean();

  const misplaced = staff.filter((user) => !managerIds.has(String(user.parentId || "")));
  let moved = 0;
  let skipped = 0;

  for (const user of misplaced) {
    const pool = managersByCompany.get(String(user.companyId || "")) || [];
    if (!pool.length) {
      skipped += 1;
      console.log(`SKIP  ${user.email} (${user.role}): no active Manager in the company`);
      continue;
    }
    const sameCategory = pool.filter((manager) =>
      manager.roleType === "BOTH" || manager.roleType === user.roleType);
    const candidates = sameCategory.length ? sameCategory : pool;
    const target = [...candidates].sort((a, b) =>
      (reportCounts.get(String(a._id)) || 0) - (reportCounts.get(String(b._id)) || 0))[0];

    console.log(`${APPLY ? "MOVE" : "PLAN"}  ${user.email} (${user.role}) -> ${target.name}`);
    reportCounts.set(String(target._id), (reportCounts.get(String(target._id)) || 0) + 1);
    moved += 1;
    if (APPLY) {
      // eslint-disable-next-line no-await-in-loop
      await User.updateOne({ _id: user._id }, { $set: { parentId: target._id } });
    }
  }

  console.log(`${misplaced.length} account(s) not under a Manager; ${moved} ${APPLY ? "moved" : "to move"}, ${skipped} skipped.`);
  if (!APPLY && moved) console.log("Dry run only. Re-run with --apply to write the changes.");
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
