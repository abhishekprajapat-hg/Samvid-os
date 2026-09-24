const { createHttpError } = require("./httpError");
const mongoose = require("mongoose");

// Add every condition to the existing tenant/employee scope; never replace it.
const applyLeadAdvancedFilters = (query, values = {}) => {
  const clauses = [];
  const text = (key) => typeof values[key] === "string" ? values[key].trim() : "";
  if (text("source") && !["META", "MANUAL"].includes(text("source").toUpperCase())) throw createHttpError(400, "Invalid source filter");
  if (text("assignedTo") && text("assignedTo") !== "UNASSIGNED" && !mongoose.Types.ObjectId.isValid(text("assignedTo"))) throw createHttpError(400, "Invalid assigned employee filter");
  for (const [key, field] of [["city", "city"], ["project", "projectInterested"]]) {
    const value = text(key);
    if (value) clauses.push({ [field]: { $regex: value.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } });
  }
  for (const [key, field, allowed] of [
    ["inventoryType", "requirements.inventoryType", ["COMMERCIAL", "RESIDENTIAL"]],
    ["transactionType", "requirements.transactionType", ["SALE", "RENT", "LEASE"]],
  ]) {
    const value = text(key).toUpperCase();
    if (value && !allowed.includes(value)) throw createHttpError(400, `Invalid ${key} filter`);
    if (value) clauses.push({ [field]: value });
  }
  if (text("subtype")) clauses.push({ "requirements.propertySubtype": text("subtype").toUpperCase().slice(0, 100) });
  const min = text("budgetMin") === "" ? null : Number(text("budgetMin"));
  const max = text("budgetMax") === "" ? null : Number(text("budgetMax"));
  if ([min, max].some((value) => value !== null && (!Number.isFinite(value) || value < 0)) || (min !== null && max !== null && min > max)) {
    throw createHttpError(400, "Enter a valid budget range");
  }
  // Match overlapping known budget ranges, treating a single bound as a point.
  if (min !== null || max !== null) {
    const low = { $ifNull: ["$requirements.budgetMin", "$requirements.budgetMax"] };
    const high = { $ifNull: ["$requirements.budgetMax", "$requirements.budgetMin"] };
    clauses.push({ $expr: { $and: [
      { $ne: [low, null] }, { $ne: [high, null] },
      ...(min !== null ? [{ $gte: [high, min] }] : []),
      ...(max !== null ? [{ $lte: [low, max] }] : []),
    ] } });
  }
  for (const [fromKey, toKey, field] of [["createdFrom", "createdTo", "createdAt"], ["followUpDateFrom", "followUpDateTo", "nextFollowUp"]]) {
    const range = {};
    for (const [key, operator, time] of [[fromKey, "$gte", "00:00:00.000"], [toKey, "$lte", "23:59:59.999"]]) {
      const value = text(key);
      if (!value) continue;
      const date = new Date(`${value}T${time}+05:30`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw createHttpError(400, "Enter a valid date");
      range[operator] = date;
    }
    if (range.$gte && range.$lte && range.$gte > range.$lte) throw createHttpError(400, "From date must be before the to date");
    if (Object.keys(range).length) clauses.push({ [field]: range });
  }
  if (clauses.length) query.$and = [...(query.$and || []), ...clauses];
};
module.exports = { applyLeadAdvancedFilters };
