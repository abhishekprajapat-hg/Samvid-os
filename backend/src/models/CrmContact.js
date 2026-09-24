const mongoose = require("mongoose");

// Leads that were refused because the number belongs to a broker. Kept on the
// broker rather than in the lead collection: the whole point is that these
// never became leads, but refusing them silently would leave nothing to check
// when somebody asks why an enquiry never arrived.
const blockedLeadSchema = new mongoose.Schema({
 name: { type: String, default: "", maxlength: 200 },
 phone: { type: String, default: "", maxlength: 20 },
 origin: { type: String, enum: ["MANUAL", "META", "BULK"], default: "MANUAL" },
 attemptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
 at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
 companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
 kind: { type: String, enum: ["OWNER", "BROKER"], required: true },
 phone: { type: String, required: true }, name: { type: String, required: true, maxlength: 200 },
 email: { type: String, default: "", maxlength: 200 }, notes: { type: String, default: "", maxlength: 3000 },
 propertyDetails: { type: String, default: "", maxlength: 4000 },
 company: { type: String, default: "", maxlength: 200 },
 city: { type: String, default: "", maxlength: 120 },
 leadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lead" }],
 inventoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }],
 blockedLeadCount: { type: Number, default: 0, min: 0 },
 blockedLeads: { type: [blockedLeadSchema], default: [] },
 createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
schema.index({ companyId: 1, kind: 1, phone: 1 }, { unique: true });
// The lead gate looks a broker up by number on every intake, so it gets its own index.
schema.index({ companyId: 1, kind: 1, phone: 1, blockedLeadCount: -1 });
module.exports = mongoose.model("CrmContact", schema);
