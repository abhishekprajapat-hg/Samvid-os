require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User.js");
const { USER_ROLES } = require("../constants/role.constants");
const { assertSeedAllowed } = require("./seedSafetyGuard.cjs");

async function createSuperAdmin() {
  assertSeedAllowed({ scriptName: "seed:super-admin", destructive: false });
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ role: USER_ROLES.SUPER_ADMIN });
  if (existing) {
    console.log(`Super admin already exists: ${existing.email}`);
    process.exit(0);
  }

  const email = String(process.env.SUPER_ADMIN_EMAIL || "superadmin@test.com").trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || "123456");
  const name = String(process.env.SUPER_ADMIN_NAME || "Super Admin").trim();
  const phone = String(process.env.SUPER_ADMIN_PHONE || "9999999990").trim();

  const superAdmin = new User({
    name,
    email,
    phone,
    password,
    role: USER_ROLES.SUPER_ADMIN,
    companyId: null,
  });
  await superAdmin.save();

  console.log(`Super admin created successfully: ${superAdmin.email}`);
  process.exit(0);
}

createSuperAdmin().catch((error) => {
  console.error(`createSuperAdmin failed: ${error.message}`);
  process.exit(1);
});
