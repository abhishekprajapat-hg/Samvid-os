require("dotenv").config();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];

function buildLead(index, assignedTo) {
  const serial = String(index + 1).padStart(2, "0");
  const stamp = Date.now().toString().slice(-6);
  const cities = ["Noida", "Gurgaon", "Delhi", "Ghaziabad", "Faridabad"];
  const projects = [
    "2BHK Apartment",
    "3BHK Apartment",
    "Villa",
    "Office Space",
    "Retail Shop",
  ];

  return {
    name: `Seed Lead ${serial}`,
    phone: `98${stamp}${String(1000 + index).slice(-4)}`,
    email: `seed.lead${serial}@example.com`,
    city: cities[index % cities.length],
    projectInterested: projects[index % projects.length],
    source: "MANUAL",
    status: "NEW",
    assignedTo: assignedTo || null,
    createdBy: null,
  };
}

async function seedLeads() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const executives = await User.find({
      role: { $in: EXECUTIVE_ROLES },
      isActive: true,
    }).select("_id");

    const leads = [];
    for (let i = 0; i < 30; i += 1) {
      const assignedTo = executives.length
        ? executives[i % executives.length]._id
        : null;
      leads.push(buildLead(i, assignedTo));
    }

    const inserted = await Lead.insertMany(leads, { ordered: true });
    console.log(`Seeded ${inserted.length} leads successfully`);
  } catch (error) {
    console.error("Lead seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedLeads();
