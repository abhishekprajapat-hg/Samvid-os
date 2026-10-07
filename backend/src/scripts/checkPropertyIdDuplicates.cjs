#!/usr/bin/env node
/*
 * Reports - and on request repairs - duplicate inventory propertyIds.
 *
 * Inventory.propertyId is server-generated from an atomic counter, and the
 * schema declares a unique partial index on { companyId, propertyId }. Records
 * created before the counter existed can still share an id ("Prop-01" appears
 * three times in the audited database), and because MongoDB refuses to build a
 * unique index over existing duplicates, that index silently never gets created
 * - so the safety net is not actually in place.
 *
 *   node src/scripts/checkPropertyIdDuplicates.cjs            # report only
 *   node src/scripts/checkPropertyIdDuplicates.cjs --apply    # renumber dupes
 *
 * --apply keeps the oldest record's id and re-issues the others from the same
 * counter new records use. Run the report first: a propertyId may appear on a
 * signed contract or a shared listing, so decide deliberately which record
 * keeps the original.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const PREFIX = { COMMERCIAL: "COM", RESIDENTIAL: "RES" };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const inventories = db.collection("inventories");

  const groups = await inventories.aggregate([
    { $match: { propertyId: { $type: "string", $ne: "" } } },
    { $group: { _id: { companyId: "$companyId", propertyId: "$propertyId" }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();

  if (!groups.length) {
    console.log("No duplicate propertyIds found.");
  } else {
    console.log(`Found ${groups.length} duplicated propertyId value(s):\n`);
    for (const group of groups) {
      console.log(`  "${group._id.propertyId}" x${group.n}  (company ${group._id.companyId})`);
      const docs = await inventories
        .find({ _id: { $in: group.ids } }, { projection: { propertyId: 1, projectName: 1, createdAt: 1, inventoryType: 1 } })
        .sort({ createdAt: 1 })
        .toArray();
      docs.forEach((doc, index) => {
        console.log(`      ${index === 0 ? "keep  " : "rename"} ${doc._id}  ${String(doc.projectName || "").slice(0, 34).padEnd(34)} ${doc.createdAt?.toISOString?.().slice(0, 10) || ""}`);
      });

      if (APPLY) {
        for (const doc of docs.slice(1)) {
          const category = PREFIX[doc.inventoryType] ? doc.inventoryType : "COMMERCIAL";
          const counter = await db.collection("inventoryidcounters").findOneAndUpdate(
            { companyId: group._id.companyId, category },
            { $inc: { seq: 1 } },
            { returnDocument: "after", upsert: true },
          );
          const seq = counter?.seq ?? counter?.value?.seq;
          const nextId = `${PREFIX[category]}-${String(seq).padStart(4, "0")}`;
          await inventories.updateOne({ _id: doc._id }, { $set: { propertyId: nextId, unitNumber: nextId } });
          console.log(`      -> ${doc._id} renamed to ${nextId}`);
        }
      }
    }
    if (!APPLY) console.log("\nReport only. Re-run with --apply to renumber the duplicates.");
  }

  // Report whether the unique index actually exists.
  const indexes = await inventories.indexes();
  const uniqueIndex = indexes.find((index) => index.name === "companyId_1_propertyId_1");
  console.log(`\nUnique index companyId_1_propertyId_1: ${uniqueIndex ? "present" : "MISSING"}`);
  if (!uniqueIndex) {
    console.log("It cannot be built while duplicates exist. Once this report is clean, create it with:");
    console.log('  db.inventories.createIndex({ companyId: 1, propertyId: 1 }, { unique: true, partialFilterExpression: { propertyId: { $type: "string", $ne: "" } } })');
  }

  await mongoose.disconnect();
})().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
