require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Company = require("../models/Company");
const { USER_ROLES } = require("../constants/role.constants");

const sanitizeSubdomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const buildBaseSubdomain = ({ adminUser, companyId }) => {
  const fromEmail = String(adminUser?.email || "").split("@")[0];
  const fromName = String(adminUser?.name || "");
  const fromId = String(companyId || "").slice(-8);
  return sanitizeSubdomain(fromEmail || fromName || `tenant-${fromId}`) || `tenant-${fromId}`;
};

async function ensureUniqueSubdomain(base, takenSet) {
  let attempt = 0;
  while (attempt < 5000) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`;
    if (!takenSet.has(candidate)) {
      const exists = await Company.findOne({ subdomain: candidate }).select("_id").lean();
      if (!exists) {
        takenSet.add(candidate);
        return candidate;
      }
    }
    attempt += 1;
  }
  throw new Error("Unable to resolve unique subdomain");
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const companyIds = await User.distinct("companyId", { companyId: { $ne: null } });
  if (!companyIds.length) {
    console.log("No companyId values found in users. Nothing to backfill.");
    process.exit(0);
  }

  const takenSet = new Set(
    (await Company.find({}).select("subdomain").lean()).map((row) => String(row.subdomain || "")),
  );

  let created = 0;
  let skipped = 0;

  for (const companyId of companyIds) {
    const exists = await Company.findById(companyId).select("_id").lean();
    if (exists) {
      skipped += 1;
      continue;
    }

    const adminUser = await User.findOne({
      companyId,
      role: USER_ROLES.ADMIN,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .select("_id name email")
      .lean();

    const anyUser = adminUser
      || await User.findOne({ companyId })
        .sort({ createdAt: 1 })
        .select("_id name email")
        .lean();

    const base = buildBaseSubdomain({ adminUser: anyUser, companyId });
    const subdomain = await ensureUniqueSubdomain(base, takenSet);
    const companyName = String(anyUser?.name || `Company ${String(companyId).slice(-6)}`).trim();

    await Company.create({
      _id: companyId,
      name: companyName,
      subdomain,
      ownerUserId: adminUser?._id || anyUser?._id || null,
      status: "ACTIVE",
      settings: {},
      metadata: {
        backfilledAt: new Date().toISOString(),
      },
    });
    created += 1;
    console.log(`Backfilled company: ${companyName} (${subdomain})`);
  }

  console.log(`Backfill complete. created=${created}, skipped=${skipped}`);
  process.exit(0);
}

run().catch((error) => {
  console.error(`backfillCompanies failed: ${error.message}`);
  process.exit(1);
});

