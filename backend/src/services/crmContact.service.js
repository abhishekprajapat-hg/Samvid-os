const Contact = require("../models/CrmContact");
// Indian local numbers and +91 formats share a key. Other international numbers retain their country code.
const normalizePhone = (value) => {
 let digits = String(value || "").replace(/\D/g, "");
 if (digits.startsWith("00")) digits = digits.slice(2);
 if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
 if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
 return digits.length >= 7 && digits.length <= 15 ? digits : "";
};

const TEXT_FIELDS = { email: 200, notes: 3000, propertyDetails: 4000, company: 200, city: 120 };

const upsertContact = async ({ companyId, kind, phone, name, email, notes, propertyDetails, company, city, leadId, inventoryId, actor }) => {
 const normalized = normalizePhone(phone);
 if (!companyId || !normalized || !["OWNER", "BROKER"].includes(kind)) return null;
 const filter = { companyId, kind, phone: normalized };
 const fields = { name: String(name || normalized).trim().slice(0, 200) };
 const incoming = { email, notes, propertyDetails, company, city };
 for (const [field, limit] of Object.entries(TEXT_FIELDS)) {
  if (incoming[field] !== undefined && incoming[field] !== null && String(incoming[field]) !== "") {
   fields[field] = String(incoming[field]).trim().slice(0, limit);
  }
 }
 const links = {};
 if (leadId) links.leadIds = leadId;
 if (inventoryId) links.inventoryIds = inventoryId;
 const update = { $set: fields, $setOnInsert: { createdBy: actor }, ...(Object.keys(links).length ? { $addToSet: links } : {}) };
 try { return await Contact.findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true }); }
 catch (error) { if (error.code !== 11000) throw error; return Contact.findOneAndUpdate(filter, update, { new: true, runValidators: true }); }
};

/*
 * The broker gate.
 *
 * A number sitting in the Broker Database is not a customer enquiry, so it must
 * not become a lead. This is the single place that decides that, and every
 * intake path - manual, bulk and the Meta webhook - asks it rather than
 * repeating the rule. It returns the broker when one matches, so callers can
 * name them in the refusal instead of failing blankly.
 */
const findBrokerByPhone = async (companyId, phone) => {
 const normalized = normalizePhone(phone);
 if (!companyId || !normalized) return null;
 return Contact.findOne({ companyId, kind: "BROKER", phone: normalized }).select("_id name phone").lean();
};

// Records the refusal on the broker. Capped so a number under repeated
// automated submission cannot grow the document without bound.
const recordBlockedLead = async (contactId, { name, phone, origin = "MANUAL", attemptedBy = null } = {}) => {
 if (!contactId) return null;
 return Contact.findByIdAndUpdate(contactId, {
  $inc: { blockedLeadCount: 1 },
  $push: {
   blockedLeads: {
    $each: [{ name: String(name || "").slice(0, 200), phone: String(phone || "").slice(0, 20), origin, attemptedBy, at: new Date() }],
    $slice: -50,
   },
  },
 }, { new: true }).catch(() => null);
};

const MAX_BULK_CONTACT_ROWS = 5000;

/*
 * Bulk intake. Rows are independent: one bad row is reported and skipped rather
 * than failing the file, because a 400-row import that dies on row 12 wastes
 * the other 399. Rows are keyed by phone like every other write here, so
 * re-uploading a corrected sheet updates rather than duplicates.
 */
const bulkUpsertContacts = async ({ companyId, kind, rows, actor }) => {
 const failures = [];
 let createdCount = 0;
 let updatedCount = 0;
 const seen = new Map();

 for (const [index, row] of rows.entries()) {
  // Row 1 is the header in every sheet a person will upload.
  const rowNumber = index + 2;
  const name = String(row?.name || "").trim();
  const normalized = normalizePhone(row?.phone);

  if (!name && !normalized) continue;
  if (!name) { failures.push({ row: rowNumber, message: "Name is required" }); continue; }
  if (!normalized) { failures.push({ row: rowNumber, message: `Phone "${String(row?.phone || "").slice(0, 24)}" is not a valid number` }); continue; }
  if (seen.has(normalized)) { failures.push({ row: rowNumber, message: `Duplicate of row ${seen.get(normalized)} in this file` }); continue; }
  seen.set(normalized, rowNumber);

  try {
   const existing = await Contact.exists({ companyId, kind, phone: normalized });
   const saved = await upsertContact({ companyId, kind, phone: normalized, name, email: row.email, notes: row.notes, propertyDetails: row.propertyDetails, company: row.company, city: row.city, actor });
   if (!saved) { failures.push({ row: rowNumber, message: "Could not be saved" }); continue; }
   if (existing) updatedCount += 1; else createdCount += 1;
  } catch (error) {
   failures.push({ row: rowNumber, message: String(error?.message || "Could not be saved").slice(0, 200) });
  }
 }

 return { createdCount, updatedCount, failedCount: failures.length, failures };
};

module.exports = { normalizePhone, upsertContact, findBrokerByPhone, recordBlockedLead, bulkUpsertContacts, MAX_BULK_CONTACT_ROWS };
