require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User.js");
const { USER_ROLES } = require("../constants/role.constants");

const parseArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const item = process.argv.find((arg) => arg.startsWith(prefix));
  if (!item) return fallback;
  return item.slice(prefix.length).trim() || fallback;
};

async function createSuperAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = String(parseArg("email", process.env.SUPER_ADMIN_EMAIL || "owner@platform.local"))
    .trim()
    .toLowerCase();
  const password = String(parseArg("password", process.env.SUPER_ADMIN_PASSWORD || "ChangeMe@123"));
  const name = String(parseArg("name", process.env.SUPER_ADMIN_NAME || "Platform Super Admin"))
    .trim();
  const phone = String(parseArg("phone", process.env.SUPER_ADMIN_PHONE || "")).trim();

  const existing = await User.findOne({ role: USER_ROLES.SUPER_ADMIN }).select("_id email").lean();
  if (existing) {
    console.log(`SUPER_ADMIN already exists: ${existing.email}`);
    process.exit(0);
  }

  const existingEmail = await User.findOne({ email }).select("_id").lean();
  if (existingEmail) {
    console.error("Cannot create SUPER_ADMIN: email already exists");
    process.exit(1);
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: USER_ROLES.SUPER_ADMIN,
    companyId: null,
    parentId: null,
    isActive: true,
  });

  console.log(`SUPER_ADMIN created successfully: ${user.email}`);
  process.exit(0);
}

createSuperAdmin().catch((error) => {
  console.error(`createSuperAdmin failed: ${error.message}`);
  process.exit(1);
});

