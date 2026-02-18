require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User.js");

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ role: "ADMIN" });

  if (existing) {
    console.log("Admin already exists");
    process.exit();
  }

  const admin = new User({
    name: "Super Admin",
    email: "admin@test.com",
    phone: "9999999999",
    password: "123456",
    role: "ADMIN",
    companyId: new mongoose.Types.ObjectId(),
  });
  admin.companyId = admin._id;
  await admin.save();

  console.log("Admin created successfully ✅");
  process.exit();
}

createAdmin();
