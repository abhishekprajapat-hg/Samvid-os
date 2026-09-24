const mongoose = require("mongoose");
const CoworkingContract = require("../models/CoworkingContract");
const CoworkingClient = require("../models/CoworkingClient");
const CoworkingFloor = require("../models/CoworkingFloor");
const CoworkingCabin = require("../models/CoworkingCabin");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  DOCUMENT_CATEGORIES,
  EXPIRING_WINDOW_DAYS,
  CONTRACT_ALLOWED_CREATE_FIELDS,
  CONTRACT_ALLOWED_UPDATE_FIELDS,
} = require("../constants/contract.constants");
const { assignSeat, releaseSeat } = require("./coworkingOccupancy.service");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generateContractCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "CONTRACT" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `CTR-${String(counter.seq).padStart(4, "0")}`;
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createHttpError(400, `${fieldName} is not a valid date`);
  return date;
};

const sanitizeSecurityCheque = (value = {}) => {
 const amount = Number(value.amount || 0);
 if (!Number.isFinite(amount) || amount < 0) throw createHttpError(400, "Security cheque amount must be non-negative");
 return { number: String(value.number || "").trim().slice(0, 80), bank: String(value.bank || "").trim().slice(0, 200), amount, date: value.date ? parseDate(value.date, "cheque date") : null, notes: String(value.notes || "").slice(0, 1000) };
};
const sanitizeCreatePayload = async (companyId, payload = {}) => {
  const clientId = String(payload.clientId || "").trim();
  const propertyId = String(payload.propertyId || "").trim();
  const floorId = String(payload.floorId || "").trim();
  const cabinId = String(payload.cabinId || "").trim();
  const contractType = String(payload.contractType || "").trim().toUpperCase();
  const seatCode = String(payload.seatCode || "").trim();

  for (const [label, value] of Object.entries({ clientId, propertyId, floorId, cabinId })) {
    if (!isValidObjectId(value)) throw createHttpError(400, `Invalid ${label}`);
  }
  if (!CONTRACT_TYPES.includes(contractType)) throw createHttpError(400, "Invalid contractType");
  if (contractType === "SEAT" && !seatCode) throw createHttpError(400, "seatCode is required for a SEAT contract");

  const [client, floor, cabin] = await Promise.all([
    CoworkingClient.findOne({ _id: clientId, companyId }).select("_id").lean(),
    CoworkingFloor.findOne({ _id: floorId, companyId }).select("propertyId").lean(),
    CoworkingCabin.findOne({ _id: cabinId, companyId }).select("propertyId floorId seats cabinCode").lean(),
  ]);
  if (!client) throw createHttpError(400, "Client not found for this company");
  if (!floor) throw createHttpError(400, "Floor not found for this company");
  if (!cabin) throw createHttpError(400, "Cabin not found for this company");
  if (String(floor.propertyId) !== propertyId) throw createHttpError(400, "floorId does not belong to propertyId");
  if (String(cabin.propertyId) !== propertyId || String(cabin.floorId) !== floorId) {
    throw createHttpError(400, "cabinId does not belong to the given property/floor");
  }
  if (contractType === "SEAT" && !cabin.seats.some((seat) => seat.seatCode === seatCode)) {
    throw createHttpError(400, `Seat ${seatCode} does not exist on cabin ${cabin.cabinCode}`);
  }

  const startDate = parseDate(payload.startDate, "startDate");
  const endDate = parseDate(payload.endDate, "endDate");
  if (endDate <= startDate) throw createHttpError(400, "endDate must be after startDate");

  const rent = Number(payload.rent);
  if (!Number.isFinite(rent) || rent < 0) throw createHttpError(400, "rent must be a non-negative number");
  const tokenAmount = Number(payload.tokenAmount || 0);
  if (!Number.isFinite(tokenAmount) || tokenAmount < 0) throw createHttpError(400, "Token amount must be non-negative");
  const deposit = Number(payload.deposit) || 0;
  if (deposit < 0) throw createHttpError(400, "deposit cannot be negative");
  const lockInPeriodMonths = Number(payload.lockInPeriodMonths) || 0;
  const noticePeriodDays = payload.noticePeriodDays === undefined ? 30 : Number(payload.noticePeriodDays);
  if (lockInPeriodMonths < 0 || noticePeriodDays < 0) {
    throw createHttpError(400, "lockInPeriodMonths/noticePeriodDays cannot be negative");
  }

  return {
    clientId,
    propertyId,
    floorId,
    cabinId,
    seatCode: contractType === "SEAT" ? seatCode : "",
    contractType,
    startDate,
    endDate,
    rent,
    deposit,
    lockInPeriodMonths,
    noticePeriodDays,
    tokenAmount,
    securityCheque: sanitizeSecurityCheque(payload.securityCheque),
    notes: String(payload.notes || "").trim().slice(0, 2000),
  };
};

const createContract = async ({ companyId, actingUser, payload }) => {
  const safe = await sanitizeCreatePayload(companyId, payload);
  const contractCode = await generateContractCode(companyId);

  const contract = await CoworkingContract.create({
    ...safe,
    companyId,
    contractCode,
    status: "DRAFT",
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_CREATED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { contractCode, clientId: safe.clientId },
  });

  return contract;
};

const listContracts = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { companyId };

  if (query.status) {
    const status = String(query.status).trim().toUpperCase();
    if (!CONTRACT_STATUSES.includes(status)) throw createHttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (query.clientId) filter.clientId = query.clientId;

  const [rows, totalCount] = await Promise.all([
    CoworkingContract.find(filter)
      .select("-documents")
      .populate("clientId", "companyName")
      .populate("cabinId", "cabinCode")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingContract.countDocuments(filter),
  ]);

  return { contracts: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getContractDoc = async (companyId, contractId) => {
  if (!isValidObjectId(contractId)) throw createHttpError(400, "Invalid contract id");
  const contract = await CoworkingContract.findOne({ _id: contractId, companyId });
  if (!contract) throw createHttpError(404, "Contract not found");
  return contract;
};

const getContractById = async ({ companyId, contractId }) => {
  if (!isValidObjectId(contractId)) throw createHttpError(400, "Invalid contract id");
  const contract = await CoworkingContract.findOne({ _id: contractId, companyId })
    .populate("clientId", "companyName contactPerson phone email")
    .populate("propertyId", "name")
    .populate("floorId", "floorNumber name")
    .populate("cabinId", "cabinCode")
    .populate("renewalOf", "contractCode")
    .populate("supersededBy", "contractCode")
    .lean();
  if (!contract) throw createHttpError(404, "Contract not found");
  return contract;
};

const updateContract = async ({ companyId, contractId, payload, actingUser }) => {
  const contract = await getContractDoc(companyId, contractId);
  const safe = {};

  for (const field of CONTRACT_ALLOWED_UPDATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
    if (field === "securityCheque") {
      safe.securityCheque = sanitizeSecurityCheque(payload.securityCheque);
    } else if (field === "notes") {
      safe.notes = String(payload.notes || "").trim().slice(0, 2000);
    } else {
      const value = Number(payload[field]);
      if (!Number.isFinite(value) || value < 0) throw createHttpError(400, `${field} must be a non-negative number`);
      safe[field] = value;
    }
  }
  if (Object.keys(safe).length === 0) throw createHttpError(400, "No valid fields to update");

  Object.assign(contract, safe, { updatedBy: actingUser._id });
  await contract.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_UPDATED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { changes: safe },
  });

  return contract;
};

const seatCodesForContract = (contract, cabin) =>
  contract.contractType === "CABIN" ? cabin.seats.map((s) => s.seatCode) : [contract.seatCode];

const activateContract = async ({ companyId, contractId, actingUser }) => {
  const contract = await getContractDoc(companyId, contractId);
  if (contract.status !== "DRAFT") {
    throw createHttpError(409, `Contract is ${contract.status}, expected DRAFT`);
  }

  await require("./coworkingAvailability.service").assertAvailable({
    companyId, cabinId: contract.cabinId, seatCode: contract.seatCode,
    bookingType: contract.contractType, startDate: contract.startDate, endDate: contract.endDate,
  });

  const cabin = await CoworkingCabin.findOne({ _id: contract.cabinId, companyId });
  if (!cabin) throw createHttpError(404, "Cabin not found");

  for (const seatCode of seatCodesForContract(contract, cabin)) {
    assignSeat(cabin, seatCode, { clientId: contract.clientId, label: "", assignedBy: actingUser._id });
  }
  await cabin.save();

  contract.status = "ACTIVE";
  contract.updatedBy = actingUser._id;
  await contract.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_ACTIVATED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { contractCode: contract.contractCode },
  });

  return contract;
};

const releaseContractSeats = async (companyId, contract) => {
  const cabin = await CoworkingCabin.findOne({ _id: contract.cabinId, companyId });
  if (!cabin) return;

  let changed = false;
  for (const seatCode of seatCodesForContract(contract, cabin)) {
    const seat = cabin.seats.find((row) => row.seatCode === seatCode);
    if (seat && ["OCCUPIED", "RESERVED"].includes(seat.status) && String(seat.assignedTo?.clientId || "") === String(contract.clientId)) {
      releaseSeat(cabin, seatCode);
      changed = true;
    }
  }
  if (changed) await cabin.save();
};

const terminateContract = async ({ companyId, contractId, actingUser, reason }) => {
  const contract = await getContractDoc(companyId, contractId);
  if (!["ACTIVE", "EXPIRING"].includes(contract.status)) {
    throw createHttpError(409, `Contract is ${contract.status}, expected ACTIVE or EXPIRING`);
  }
  // A superseded (already-renewed) contract's seat is actually held by its
  // renewal now — releasing it here would rip the seat out from under a
  // still-active tenancy that just happens to share the same clientId (the
  // ownership check in releaseContractSeats can't tell them apart). Whoever
  // wants to end the tenancy must terminate the renewal, not this record.
  if (contract.supersededBy) {
    throw createHttpError(409, "This contract has been renewed — terminate the renewal contract instead");
  }

  await releaseContractSeats(companyId, contract);

  contract.status = "TERMINATED";
  contract.terminatedAt = new Date();
  contract.terminationReason = String(reason || "").trim().slice(0, 500);
  contract.terminatedBy = actingUser._id;
  contract.updatedBy = actingUser._id;
  await contract.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_TERMINATED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { contractCode: contract.contractCode, reason },
  });

  return contract;
};

const renewContract = async ({ companyId, contractId, actingUser, newEndDate, newRent }) => {
  const contract = await getContractDoc(companyId, contractId);
  if (!["ACTIVE", "EXPIRING"].includes(contract.status)) {
    throw createHttpError(409, "Only an ACTIVE or EXPIRING contract can be renewed");
  }
  if (contract.supersededBy) throw createHttpError(409, "This contract has already been renewed");

  const parsedEndDate = parseDate(newEndDate, "newEndDate");
  if (parsedEndDate <= contract.endDate) throw createHttpError(400, "newEndDate must be after the current contract's endDate");

  const rent = newRent === undefined ? contract.rent : Number(newRent);
  if (!Number.isFinite(rent) || rent < 0) throw createHttpError(400, "newRent must be a non-negative number");

  const contractCode = await generateContractCode(companyId);
  const renewed = await CoworkingContract.create({
    companyId,
    contractCode,
    clientId: contract.clientId,
    propertyId: contract.propertyId,
    floorId: contract.floorId,
    cabinId: contract.cabinId,
    seatCode: contract.seatCode,
    contractType: contract.contractType,
    startDate: contract.endDate,
    endDate: parsedEndDate,
    rent,
    deposit: contract.deposit,
    lockInPeriodMonths: contract.lockInPeriodMonths,
    noticePeriodDays: contract.noticePeriodDays,
    status: "ACTIVE",
    renewalOf: contract._id,
    createdBy: actingUser._id,
  });

  contract.supersededBy = renewed._id;
  contract.updatedBy = actingUser._id;
  await contract.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_RENEWED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { renewedAs: renewed.contractCode },
  });

  return renewed;
};

const addDocument = async ({ companyId, contractId, payload, actingUser }) => {
  const contract = await getContractDoc(companyId, contractId);
  const name = String(payload?.name || "").trim();
  const fileUrl = String(payload?.fileUrl || "").trim();
  if (!name || !fileUrl) throw createHttpError(400, "Document name and fileUrl are required");

  const category = String(payload?.category || "OTHER").trim().toUpperCase();
  if (!DOCUMENT_CATEGORIES.includes(category)) throw createHttpError(400, "Invalid document category");

  contract.documents.push({
    name: name.slice(0, 200),
    category,
    fileUrl,
    fileType: String(payload?.fileType || "").trim(),
    uploadedBy: actingUser._id,
    uploadedAt: new Date(),
  });
  await contract.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_DOCUMENT_ADDED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { name, category },
  });

  return contract;
};

const removeDocument = async ({ companyId, contractId, documentId, actingUser }) => {
  const contract = await getContractDoc(companyId, contractId);
  const before = contract.documents.length;
  contract.documents = contract.documents.filter((doc) => String(doc._id) !== String(documentId));
  if (contract.documents.length === before) throw createHttpError(404, "Document not found");
  await contract.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CONTRACT_DOCUMENT_REMOVED",
    entityType: "CoworkingContract",
    entityId: contract._id,
    metadata: { documentId },
  });

  return contract;
};

// Mirrors attendance/booking sweep pattern: ACTIVE contracts within
// EXPIRING_WINDOW_DAYS of endDate move to EXPIRING; ACTIVE/EXPIRING
// contracts past endDate move to EXPIRED and release their seat(s).
const runContractLifecycleSweep = async () => {
  const now = new Date();
  const expiringThreshold = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const toExpiringResult = await CoworkingContract.updateMany(
    { status: "ACTIVE", endDate: { $lte: expiringThreshold, $gt: now } },
    { $set: { status: "EXPIRING" } },
  );

  const expiredContracts = await CoworkingContract.find({
    status: { $in: ["ACTIVE", "EXPIRING"] },
    endDate: { $lte: now },
  });

  let expiredCount = 0;
  for (const contract of expiredContracts) {
    // eslint-disable-next-line no-await-in-loop
    await releaseContractSeats(contract.companyId, contract);
    contract.status = "EXPIRED";
    // eslint-disable-next-line no-await-in-loop
    await contract.save();
    expiredCount += 1;
  }

  return { toExpiring: toExpiringResult.modifiedCount || 0, expired: expiredCount };
};

module.exports = {
  generateContractCode,
  createContract,
  listContracts,
  getContractById,
  updateContract,
  activateContract,
  terminateContract,
  renewContract,
  addDocument,
  removeDocument,
  runContractLifecycleSweep,
};
