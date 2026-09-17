const Attendance = require("../models/Attendance");
const Leave = require("../models/LeaveRequest");
const User = require("../models/User");
const Violation = require("../models/AttendanceViolation");
const dateKey = (date, timezone) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
const escalationLevel = (kind, count) => kind === "REJECTED_LEAVE" ? (count >= 5 ? "MANAGEMENT_REVIEW" : count >= 3 ? "WARNING" : "RECORDED") : count >= 3 ? "MANAGEMENT_REVIEW" : "RECORDED";
const classifyAbsence = ({ day, today, joined, weekday, weeklyOffDays, attendance, leaves, timezone }) => {
 if (day >= today || day < joined || weeklyOffDays.includes(weekday)) return null;
 if (attendance?.checkInAt || (attendance && attendance.status !== "ABSENT")) return null;
 const covering = leaves.filter(row => row.fromDate <= day && row.toDate >= day && row.status !== "CANCELLED");
 if (covering.some(row => ["APPROVED", "PENDING"].includes(row.status))) return null;
 if (covering.some(row => row.status === "REJECTED" && row.reviewedAt && dateKey(row.reviewedAt, timezone) <= day)) return "REJECTED_LEAVE";
 return covering.length ? null : "UNINFORMED";
};
const reconcileMonth = async ({ companyId, userIds, month, policy }) => {
 const timezone = policy.timezone || "Asia/Kolkata";
 const today = dateKey(new Date(), timezone), from = `${month}-01`, to = `${month}-31`;
 const [users, attendance, leaves, existing] = await Promise.all([
  User.find({ companyId, _id: { $in: userIds }, isActive: true }).select("_id name createdAt").lean(),
  Attendance.find({ companyId, userId: { $in: userIds }, attendanceDate: { $gte: from, $lte: to } }).lean(),
  Leave.find({ companyId, userId: { $in: userIds }, fromDate: { $lte: to }, toDate: { $gte: from } }).lean(),
  Violation.find({ companyId, userId: { $in: userIds }, month }).lean(),
 ]);
 const byKey = new Map(existing.map(row => [`${row.userId}:${row.date}`, row]));
 const attendanceMap = new Map(attendance.map(row => [`${row.userId}:${row.attendanceDate}`, row]));
 const summaries = [], rows = [];
 for (const user of users) {
  const userLeaves = leaves.filter(row => String(row.userId) === String(user._id));
  const joined = user.createdAt ? dateKey(user.createdAt, timezone) : from;
  const counts = { REJECTED_LEAVE: 0, UNINFORMED: 0 };
  for (let number = 1; number <= 31; number++) {
   const day = `${month}-${String(number).padStart(2, "0")}`;
   const calendar = new Date(`${day}T12:00:00Z`);
   if (calendar.toISOString().slice(0, 7) !== month) break;
   const key = `${user._id}:${day}`, previous = byKey.get(key);
   const kind = classifyAbsence({ day, today, joined, weekday: calendar.getUTCDay(), weeklyOffDays: policy.weeklyOffDays || [0], attendance: attendanceMap.get(key), leaves: userLeaves, timezone });
   const active = Boolean(kind && !previous?.excused);
   if (!active && !previous) continue;
   const ordinal = active ? ++counts[kind] : 0;
   const level = active ? escalationLevel(kind, ordinal) : "RECORDED";
   const fields = { month, kind: kind || previous.kind, active, ordinal, level };
   let row = previous;
   if (!previous || Object.entries(fields).some(([key, value]) => previous[key] !== value)) {
    const filter = { companyId, userId: user._id, date: day, ...(previous ? { updatedAt: previous.updatedAt } : {}) };
    try {
     row = await Violation.findOneAndUpdate(filter, { $set: fields, $push: { history: { action: active ? level : "RECONCILED", note: active ? `${kind}: monthly occurrence ${ordinal}` : "Attendance/leave correction or management exemption", at: new Date() } } }, { upsert: !previous, new: true, runValidators: true }).lean();
    } catch (error) { if (error.code !== 11000) throw error; row = await Violation.findOne({ companyId, userId: user._id, date: day }).lean(); }
   }
   if (row) rows.push({ ...row, userName: user.name });
  }
  summaries.push({ userId: user._id, name: user.name, rejectedLeave: counts.REJECTED_LEAVE, uninformed: counts.UNINFORMED, rejectedLevel: escalationLevel("REJECTED_LEAVE", counts.REJECTED_LEAVE), uninformedLevel: escalationLevel("UNINFORMED", counts.UNINFORMED) });
 }
 return { month, summaries, violations: rows, policyNote: "Management review required at 5 rejected-leave absences or 3 uninformed absences. Final disciplinary wording/actions require management or HR confirmation." };
};
module.exports = { escalationLevel, classifyAbsence, reconcileMonth };

module.exports.runViolationSweep = async () => {
 const Company = require("../models/Company");
 const Policy = require("../models/AttendancePolicy");
 for await (const company of Company.find({}).select("_id").cursor()) {
  const policy = await Policy.findOne({ companyId: company._id }).lean() || { timezone: "Asia/Kolkata", weeklyOffDays: [0] };
  const today = dateKey(new Date(), policy.timezone || "Asia/Kolkata");
  const users = await User.find({ companyId: company._id, isActive: true, role: { $ne: "ADMIN" } }).select("_id").lean();
  const months = [today.slice(0, 7)];
  if (today.endsWith("-01")) months.push(new Date(new Date(`${today}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 7));
  for (const month of months) await reconcileMonth({ companyId: company._id, userIds: users.map(user => user._id), month, policy });
 }
};
