const mongoose = require("mongoose");
const schema = new mongoose.Schema({
 companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
 date: { type: String, required: true }, month: { type: String, required: true },
 kind: { type: String, enum: ["REJECTED_LEAVE", "UNINFORMED"], required: true },
 active: { type: Boolean, default: true }, excused: { type: Boolean, default: false },
 ordinal: { type: Number, default: 0 }, level: { type: String, enum: ["RECORDED", "WARNING", "MANAGEMENT_REVIEW"], default: "RECORDED" },
 history: [{ action: String, note: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, at: { type: Date, default: Date.now } }],
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ companyId: 1, userId: 1, date: 1 }, { unique: true });
schema.index({ companyId: 1, month: 1, active: 1 });
module.exports = mongoose.model("AttendanceViolation", schema);
