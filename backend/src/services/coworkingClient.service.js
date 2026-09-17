const mongoose = require("mongoose");
const CoworkingClient = require("../models/CoworkingClient");
const CoworkingCabin = require("../models/CoworkingCabin");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const {
  CLIENT_STATUSES,
  CLIENT_TYPES,
  KYC_STATUSES,
  DOCUMENT_CATEGORIES,
  GST_PATTERN,
  PAN_PATTERN,
  MOBILE_PATTERN,
  CLIENT_ALLOWED_FIELDS,
} = require("../constants/client.constants");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog, listAuditLogs } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generateClientCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "CLIENT" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `CLI-${String(counter.seq).padStart(4, "0")}`;
};

const sanitizeAddress = (address = {}) => ({
  line1: String(address.line1 || "").trim().slice(0, 200),
  line2: String(address.line2 || "").trim().slice(0, 200),
  city: String(address.city || "").trim().slice(0, 100),
  state: String(address.state || "").trim().slice(0, 100),
  pincode: String(address.pincode || "").trim().slice(0, 10),
  country: String(address.country || "India").trim().slice(0, 100),
});

const sanitizeClientPayload = (payload = {}, { mode }) => {
  const safe = {};

  for (const field of CLIENT_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    if (field === "dateOfBirth") {
      const date = payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;
      if (date && (!Number.isFinite(date.getTime()) || date > new Date() || date.getUTCFullYear() < 1900)) throw createHttpError(400, "Enter a valid date of birth");
      safe.dateOfBirth = date;
    } else if (field === "companyName") {
      const companyName = String(payload.companyName || "").trim();
      if (!companyName) throw createHttpError(400, "companyName is required");
      safe.companyName = companyName.slice(0, 200);
    } else if (field === "contactPerson") {
      safe.contactPerson = String(payload.contactPerson || "").trim().slice(0, 120);
    } else if (field === "phone" || field === "alternatePhone") {
      const value = String(payload[field] || "").trim();
      if (value && !MOBILE_PATTERN.test(value)) {
        throw createHttpError(400, `${field} must be a valid 10-digit mobile number`);
      }
      safe[field] = value;
    } else if (field === "email") {
      safe.email = String(payload.email || "").trim().toLowerCase().slice(0, 200);
    } else if (field === "address") {
      safe.address = sanitizeAddress(payload.address);
    } else if (field === "gstNumber") {
      const gst = String(payload.gstNumber || "").trim().toUpperCase();
      if (gst && !GST_PATTERN.test(gst)) throw createHttpError(400, "gstNumber is not a valid GSTIN");
      safe.gstNumber = gst;
    } else if (field === "panNumber") {
      const pan = String(payload.panNumber || "").trim().toUpperCase();
      if (pan && !PAN_PATTERN.test(pan)) throw createHttpError(400, "panNumber is not a valid PAN");
      safe.panNumber = pan;
    } else if (field === "kycStatus") {
      const kycStatus = String(payload.kycStatus || "").trim().toUpperCase();
      if (!KYC_STATUSES.includes(kycStatus)) throw createHttpError(400, "Invalid kycStatus");
      safe.kycStatus = kycStatus;
    } else if (field === "clientType") {
      const clientType = String(payload.clientType || "").trim().toUpperCase();
      if (!CLIENT_TYPES.includes(clientType)) throw createHttpError(400, "Invalid clientType");
      safe.clientType = clientType;
    } else if (field === "industry") {
      safe.industry = String(payload.industry || "").trim().slice(0, 120);
    } else if (field === "notes") {
      safe.notes = String(payload.notes || "").trim().slice(0, 2000);
    } else if (field === "status") {
      const status = String(payload.status || "").trim().toUpperCase();
      if (!CLIENT_STATUSES.includes(status)) throw createHttpError(400, "Invalid status");
      safe.status = status;
    }
  }

  if (mode === "create" && !safe.companyName) {
    throw createHttpError(400, "companyName is required");
  }

  return safe;
};

const createClient = async ({ companyId, actingUser, payload }) => {
  const safePayload = sanitizeClientPayload(payload, { mode: "create" });
  const clientCode = await generateClientCode(companyId);

  const client = await CoworkingClient.create({
    ...safePayload,
    companyId,
    clientCode,
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_CREATED",
    entityType: "CoworkingClient",
    entityId: client._id,
    metadata: { clientCode, companyName: client.companyName },
  });

  return client;
};

const listClients = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { companyId };

  if (query.status) filter.status = String(query.status).trim().toUpperCase();
  if (query.clientType) filter.clientType = String(query.clientType).trim().toUpperCase();
  if (query.search) {
    const search = String(query.search).trim();
    filter.$or = [
      { companyName: { $regex: search, $options: "i" } },
      { clientCode: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [rows, totalCount] = await Promise.all([
    CoworkingClient.find(filter)
      .select("-documents")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingClient.countDocuments(filter),
  ]);

  return { clients: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getClientDoc = async (companyId, clientId) => {
  if (!isValidObjectId(clientId)) throw createHttpError(400, "Invalid client id");
  const client = await CoworkingClient.findOne({ _id: clientId, companyId });
  if (!client) throw createHttpError(404, "Client not found");
  return client;
};

const getClientById = async ({ companyId, clientId }) => {
  const client = await getClientDoc(companyId, clientId);
  return client.toObject();
};

const updateClient = async ({ companyId, clientId, payload, actingUser }) => {
  const client = await getClientDoc(companyId, clientId);
  const safePayload = sanitizeClientPayload(payload, { mode: "update" });
  if (Object.keys(safePayload).length === 0) {
    throw createHttpError(400, "No valid fields to update");
  }

  Object.assign(client, safePayload, { updatedBy: actingUser._id });
  await client.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_UPDATED",
    entityType: "CoworkingClient",
    entityId: client._id,
    metadata: { changes: safePayload },
  });

  return client;
};

const deleteClient = async ({ companyId, clientId, actingUser }) => {
  const client = await getClientDoc(companyId, clientId);

  const hasAssignedSeats = await CoworkingCabin.exists({
    companyId,
    "seats.assignedTo.clientId": client._id,
  });
  if (hasAssignedSeats) {
    throw createHttpError(409, "Cannot delete a client that still has assigned seats");
  }

  await client.deleteOne();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_DELETED",
    entityType: "CoworkingClient",
    entityId: clientId,
    metadata: { companyName: client.companyName, clientCode: client.clientCode },
  });
};

const addContact = async ({ companyId, clientId, payload, actingUser }) => {
  const client = await getClientDoc(companyId, clientId);
  const name = String(payload?.name || "").trim();
  if (!name) throw createHttpError(400, "Contact name is required");

  const phone = String(payload?.phone || "").trim();
  if (phone && !MOBILE_PATTERN.test(phone)) {
    throw createHttpError(400, "Contact phone must be a valid 10-digit mobile number");
  }

  client.contacts.push({
    name: name.slice(0, 120),
    designation: String(payload?.designation || "").trim().slice(0, 120),
    phone,
    email: String(payload?.email || "").trim().toLowerCase().slice(0, 200),
  });
  await client.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_CONTACT_ADDED",
    entityType: "CoworkingClient",
    entityId: client._id,
    metadata: { name },
  });

  return client;
};

const removeContact = async ({ companyId, clientId, contactId, actingUser }) => {
  const client = await getClientDoc(companyId, clientId);
  const before = client.contacts.length;
  client.contacts = client.contacts.filter((contact) => String(contact._id) !== String(contactId));
  if (client.contacts.length === before) {
    throw createHttpError(404, "Contact not found");
  }
  await client.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_CONTACT_REMOVED",
    entityType: "CoworkingClient",
    entityId: client._id,
    metadata: { contactId },
  });

  return client;
};

const addDocument = async ({ companyId, clientId, payload, actingUser }) => {
  const client = await getClientDoc(companyId, clientId);
  const name = String(payload?.name || "").trim();
  const fileUrl = String(payload?.fileUrl || "").trim();
  if (!name || !fileUrl) throw createHttpError(400, "Document name and fileUrl are required");

  const category = String(payload?.category || "OTHER").trim().toUpperCase();
  if (!DOCUMENT_CATEGORIES.includes(category)) throw createHttpError(400, "Invalid document category");

  client.documents.push({
    name: name.slice(0, 200),
    category,
    fileUrl,
    fileType: String(payload?.fileType || "").trim(),
    uploadedBy: actingUser._id,
    uploadedAt: new Date(),
  });
  await client.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_DOCUMENT_ADDED",
    entityType: "CoworkingClient",
    entityId: client._id,
    metadata: { name, category },
  });

  return client;
};

const removeDocument = async ({ companyId, clientId, documentId, actingUser }) => {
  const client = await getClientDoc(companyId, clientId);
  const before = client.documents.length;
  client.documents = client.documents.filter((doc) => String(doc._id) !== String(documentId));
  if (client.documents.length === before) {
    throw createHttpError(404, "Document not found");
  }
  await client.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CLIENT_DOCUMENT_REMOVED",
    entityType: "CoworkingClient",
    entityId: client._id,
    metadata: { documentId },
  });

  return client;
};

// Relationship integrity: assignments are read live from CoworkingCabin
// (the single source of truth for occupancy) — never cached/duplicated onto
// the client document, so this can never drift from actual seat state.
const getClientAssignments = async ({ companyId, clientId }) => {
  if (!isValidObjectId(clientId)) throw createHttpError(400, "Invalid client id");

  const cabins = await CoworkingCabin.find({
    companyId,
    "seats.assignedTo.clientId": clientId,
  })
    .populate("propertyId", "name propertyCode")
    .populate("floorId", "floorNumber name")
    .lean();

  const assignments = [];
  for (const cabin of cabins) {
    for (const seat of cabin.seats) {
      if (String(seat.assignedTo?.clientId || "") === String(clientId)) {
        assignments.push({
          cabinId: cabin._id,
          cabinCode: cabin.cabinCode,
          property: cabin.propertyId,
          floor: cabin.floorId,
          seatCode: seat.seatCode,
          assignedAt: seat.assignedTo.assignedAt,
        });
      }
    }
  }

  return assignments;
};

const getClientActivity = async ({ companyId, clientId, query = {} }) =>
  listAuditLogs({
    companyId,
    query: { ...query, entityType: "CoworkingClient", entityId: clientId },
  });

module.exports = {
  generateClientCode,
  sanitizeClientPayload,
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
  addContact,
  removeContact,
  addDocument,
  removeDocument,
  getClientAssignments,
  getClientActivity,
};
