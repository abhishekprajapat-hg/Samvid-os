/**
 * Removes one demo company and everything that belongs to it.
 *
 * Usage (PowerShell):
 *   $env:DEMO_COMPANY_SLUG="samvid-demo"; $env:DEMO_EMAIL_DOMAIN="samviddemo.in"
 *   $env:CONFIRM_REMOVE_DEMO_COMPANY="samvid-demo"; npm run remove:demo-company
 *
 * Safety: refuses unless CONFIRM_REMOVE_DEMO_COMPANY repeats the slug, and
 * refuses if the company has any login outside DEMO_EMAIL_DOMAIN - so it can
 * never be pointed at a real tenant by mistake.
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const slug = String(process.env.DEMO_COMPANY_SLUG || "").trim().toLowerCase();
const domain = String(process.env.DEMO_EMAIL_DOMAIN || "").trim().toLowerCase();

const run = async () => {
  if (!slug || slug === "client" || !domain || domain === "test.com") {
    throw new Error("Set DEMO_COMPANY_SLUG and DEMO_EMAIL_DOMAIN to the demo company's values.");
  }
  if (String(process.env.CONFIRM_REMOVE_DEMO_COMPANY || "").trim().toLowerCase() !== slug) {
    throw new Error(`Set CONFIRM_REMOVE_DEMO_COMPANY=${slug} to confirm.`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const modelsDir = path.join(__dirname, "..", "models");
  for (const file of fs.readdirSync(modelsDir)) require(path.join(modelsDir, file));

  const Company = mongoose.model("Company");
  const User = mongoose.model("User");
  const Lead = mongoose.model("Lead");

  const company = await Company.findOne({ subdomain: slug }).lean();
  if (!company) {
    console.log(`No company with subdomain "${slug}" - nothing to remove.`);
    return;
  }

  const users = await User.find({ companyId: company._id }).select("_id email").lean();
  const foreign = users.filter((user) => !String(user.email || "").toLowerCase().endsWith(`@${domain}`));
  if (foreign.length) {
    throw new Error(
      `Refusing: company "${slug}" has ${foreign.length} login(s) outside @${domain} (e.g. ${foreign[0].email}). It does not look like a demo company.`,
    );
  }

  const userIds = users.map((user) => user._id);
  const leadIds = (await Lead.find({ companyId: company._id }).select("_id").lean()).map((lead) => lead._id);
  const removed = {};
  const drop = async (modelName, filter) => {
    const result = await mongoose.model(modelName).deleteMany(filter);
    if (result.deletedCount) removed[modelName] = (removed[modelName] || 0) + result.deletedCount;
  };

  // Records keyed by lead or user rather than company.
  if (mongoose.modelNames().includes("LeadActivity")) await drop("LeadActivity", { lead: { $in: leadIds } });
  if (mongoose.modelNames().includes("LeadDiary")) await drop("LeadDiary", { lead: { $in: leadIds } });
  if (mongoose.modelNames().includes("ChatRoom")) {
    const roomIds = (await mongoose.model("ChatRoom").find({ participants: { $in: userIds } }).select("_id participants").lean())
      .filter((room) => (room.participants || []).every((id) => userIds.some((userId) => String(userId) === String(id))))
      .map((room) => room._id);
    await drop("ChatMessage", { room: { $in: roomIds } });
    if (mongoose.modelNames().includes("ChatCallHistory")) await drop("ChatCallHistory", { room: { $in: roomIds } });
    await drop("ChatRoom", { _id: { $in: roomIds } });
  }
  for (const modelName of ["RefreshToken", "PushSubscription"]) {
    if (!mongoose.modelNames().includes(modelName)) continue;
    const schemaPaths = mongoose.model(modelName).schema.paths;
    const userField = ["user", "userId"].find((field) => schemaPaths[field]);
    if (userField) await drop(modelName, { [userField]: { $in: userIds } });
  }

  // Everything tenant-scoped.
  for (const modelName of mongoose.modelNames()) {
    if (modelName === "Company") continue;
    if (mongoose.model(modelName).schema.paths.companyId) {
      await drop(modelName, { companyId: company._id });
    }
  }
  await drop("Company", { _id: company._id });

  console.log(`Removed demo company "${company.name}" (${slug}) from ${mongoose.connection.name}:`);
  console.log(JSON.stringify(removed, null, 2));
};

run()
  .catch((error) => {
    console.error(`removeDemoCompany failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
