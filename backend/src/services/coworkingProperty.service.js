const mongoose = require("mongoose");
const CoworkingProperty = require("../models/CoworkingProperty");
const CoworkingFloor = require("../models/CoworkingFloor");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const { PROPERTY_STATUSES, PROPERTY_ALLOWED_FIELDS } = require("../constants/coworking.constants");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const MOBILE_PATTERN = /^[0-9]{10}$/;

const generatePropertyCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "PROPERTY" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `PROP-${String(counter.seq).padStart(4, "0")}`;
};

const sanitizeAddress = (address = {}) => ({
  line1: String(address.line1 || "").trim().slice(0, 200),
  line2: String(address.line2 || "").trim().slice(0, 200),
  city: String(address.city || "").trim().slice(0, 100),
  state: String(address.state || "").trim().slice(0, 100),
  pincode: String(address.pincode || "").trim().slice(0, 10),
  country: String(address.country || "India").trim().slice(0, 100),
});

const sanitizeContact = (contact = {}) => {
  const phone = String(contact.phone || "").trim();
  if (phone && !MOBILE_PATTERN.test(phone)) {
    throw createHttpError(400, "contact.phone must be a valid 10-digit mobile number");
  }
  return {
    name: String(contact.name || "").trim().slice(0, 120),
    phone,
    email: String(contact.email || "").trim().toLowerCase().slice(0, 200),
  };
};

const sanitizePropertyPayload = (payload = {}, { mode }) => {
  const safe = {};

  for (const field of PROPERTY_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    if (field === "name") {
      const name = String(payload.name || "").trim();
      if (!name) throw createHttpError(400, "name is required");
      safe.name = name.slice(0, 200);
    } else if (field === "status") {
      const status = String(payload.status || "").trim().toUpperCase();
      if (!PROPERTY_STATUSES.includes(status)) throw createHttpError(400, "Invalid status");
      safe.status = status;
    } else if (field === "managerId") {
      const managerId = payload.managerId ? String(payload.managerId).trim() : "";
      if (managerId && !isValidObjectId(managerId)) throw createHttpError(400, "Invalid managerId");
      safe.managerId = managerId || null;
    } else if (field === "address") {
      safe.address = sanitizeAddress(payload.address);
    } else if (field === "contact") {
      safe.contact = sanitizeContact(payload.contact);
    } else if (field === "description") {
      safe.description = String(payload.description || "").trim().slice(0, 2000);
    }
  }

  if (mode === "create" && !safe.name) {
    throw createHttpError(400, "name is required");
  }

  return safe;
};

const createProperty = async ({ companyId, actingUser, payload }) => {
  const safePayload = sanitizePropertyPayload(payload, { mode: "create" });
  const propertyCode = await generatePropertyCode(companyId);

  const property = await CoworkingProperty.create({
    ...safePayload,
    companyId,
    propertyCode,
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "PROPERTY_CREATED",
    entityType: "CoworkingProperty",
    entityId: property._id,
    metadata: { propertyCode, name: property.name },
  });

  return property;
};

const listProperties = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });
  const filter = { companyId };

  if (query.status) filter.status = String(query.status).trim().toUpperCase();
  if (query.search) {
    const search = String(query.search).trim();
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { propertyCode: { $regex: search, $options: "i" } },
    ];
  }

  const [rows, totalCount] = await Promise.all([
    CoworkingProperty.find(filter)
      .populate("managerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingProperty.countDocuments(filter),
  ]);

  return { properties: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getPropertyById = async ({ companyId, propertyId }) => {
  if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid property id");
  const property = await CoworkingProperty.findOne({ _id: propertyId, companyId })
    .populate("managerId", "name email")
    .lean();
  if (!property) throw createHttpError(404, "Property not found");
  return property;
};

const updateProperty = async ({ companyId, propertyId, payload, actingUser }) => {
  if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid property id");
  const property = await CoworkingProperty.findOne({ _id: propertyId, companyId });
  if (!property) throw createHttpError(404, "Property not found");

  const safePayload = sanitizePropertyPayload(payload, { mode: "update" });
  if (Object.keys(safePayload).length === 0) {
    throw createHttpError(400, "No valid fields to update");
  }

  Object.assign(property, safePayload, { updatedBy: actingUser._id });
  await property.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "PROPERTY_UPDATED",
    entityType: "CoworkingProperty",
    entityId: property._id,
    metadata: { changes: safePayload },
  });

  return property;
};

const deleteProperty = async ({ companyId, propertyId, actingUser }) => {
  if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid property id");
  const property = await CoworkingProperty.findOne({ _id: propertyId, companyId });
  if (!property) throw createHttpError(404, "Property not found");

  const floorCount = await CoworkingFloor.countDocuments({ companyId, propertyId });
  if (floorCount > 0) {
    throw createHttpError(409, "Cannot delete a property that still has floors");
  }

  await property.deleteOne();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "PROPERTY_DELETED",
    entityType: "CoworkingProperty",
    entityId: propertyId,
    metadata: { name: property.name, propertyCode: property.propertyCode },
  });
};

module.exports = {
  generatePropertyCode,
  sanitizePropertyPayload,
  createProperty,
  listProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
};
