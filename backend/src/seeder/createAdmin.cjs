require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User.js");
const Company = require("../models/Company.js");
const { USER_ROLES } = require("../constants/role.constants");

const sanitizeSubdomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ role: USER_ROLES.ADMIN });
  if (existing) {
    console.log("Admin already exists");
    process.exit(0);
  }

  const admin = new User({
    name: "Company Admin",
    email: "admin@test.com",
    phone: "9999999999",
    password: "123456",
    role: USER_ROLES.ADMIN,
    companyId: new mongoose.Types.ObjectId(),
  });
  admin.companyId = admin._id;
  await admin.save();

  const subdomain = sanitizeSubdomain(admin.email.split("@")[0])
    || `tenant-${String(admin._id).slice(-6)}`;

  await Company.create({
    _id: admin.companyId,
    name: "Default Company",
    subdomain,
    ownerUserId: admin._id,
    status: "ACTIVE",
  });

  console.log("Admin created successfully");
  process.exit(0);
}

createAdmin().catch((error) => {
  console.error(`createAdmin failed: ${error.message}`);
  process.exit(1);
});

