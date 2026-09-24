const mongoose = require("mongoose");
const CoworkingCabin = require("../models/CoworkingCabin");
const CoworkingFloor = require("../models/CoworkingFloor");
const CoworkingIdCounter = require("../models/CoworkingIdCounter");
const CoworkingClient = require("../models/CoworkingClient");
const {
  CABIN_STATUSES,
  CABIN_TYPES,
  CABIN_AMENITIES,
  CABIN_CAPACITY_PRESETS,
  MIN_CABIN_CAPACITY,
  MAX_CABIN_CAPACITY,
  CABIN_CREATE_ALLOWED_FIELDS,
  CABIN_UPDATE_ALLOWED_FIELDS,
  resolveCabinCapacity,
} = require("../constants/coworking.constants");
const {
  generateSeatsForCabin,
  assignSeat,
  releaseSeat,
  setSeatStatus,
  setCabinManualOverride,
} = require("./coworkingOccupancy.service");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const generateCabinCode = async (companyId) => {
  const counter = await CoworkingIdCounter.findOneAndUpdate(
    { companyId, category: "CABIN" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `CAB-${String(counter.seq).padStart(3, "0")}`;
};

const sanitizeCreatePayload = async (companyId, payload = {}) => {
  const safe = {};

  for (const field of CABIN_CREATE_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    if (field === "propertyId") {
      const propertyId = String(payload.propertyId || "").trim();
      if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid propertyId");
      safe.propertyId = propertyId;
    } else if (field === "floorId") {
      const floorId = String(payload.floorId || "").trim();
      if (!isValidObjectId(floorId)) throw createHttpError(400, "Invalid floorId");
      safe.floorId = floorId;
    } else if (field === "name") {
      safe.name = String(payload.name || "").trim().slice(0, 120);
    } else if (field === "cabinType") {
      const cabinType = String(payload.cabinType || "PRIVATE").trim().toUpperCase();
      if (!CABIN_TYPES.includes(cabinType)) throw createHttpError(400, "Invalid cabinType");
      safe.cabinType = cabinType;
    } else if (field === "capacityPreset") {
      const raw = payload.capacityPreset;
      const preset = raw === "CUSTOM" ? "CUSTOM" : Number(raw);
      if (!CABIN_CAPACITY_PRESETS.includes(preset)) {
        throw createHttpError(400, `capacityPreset must be one of ${CABIN_CAPACITY_PRESETS.join(", ")}`);
      }
      safe.capacityPreset = preset;
    } else if (field === "customCapacity") {
      safe.customCapacity = payload.customCapacity;
    } else if (field === "monthlyRent") {
      const monthlyRent = Number(payload.monthlyRent);
      if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
        throw createHttpError(400, "monthlyRent must be a non-negative number");
      }
      safe.monthlyRent = monthlyRent;
    } else if (field === "securityDeposit") {
      const securityDeposit = Number(payload.securityDeposit);
      if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
        throw createHttpError(400, "securityDeposit must be a non-negative number");
      }
      safe.securityDeposit = securityDeposit;
    } else if (field === "description") {
      safe.description = String(payload.description || "").trim().slice(0, 2000);
    } else if (field === "amenities") {
      const amenities = Array.isArray(payload.amenities) ? payload.amenities : [];
      if (!amenities.every((amenity) => CABIN_AMENITIES.includes(amenity))) {
        throw createHttpError(400, "One or more amenities are not recognized");
      }
      safe.amenities = [...new Set(amenities)];
    }
  }

  if (!safe.propertyId) throw createHttpError(400, "propertyId is required");
  if (!safe.floorId) throw createHttpError(400, "floorId is required");
  if (safe.capacityPreset === undefined) throw createHttpError(400, "capacityPreset is required");

  const floor = await CoworkingFloor.findOne({ _id: safe.floorId, companyId }).select("propertyId").lean();
  if (!floor) throw createHttpError(400, "Floor not found for this company");
  if (String(floor.propertyId) !== String(safe.propertyId)) {
    throw createHttpError(400, "floorId does not belong to the given propertyId");
  }

  const capacity = resolveCabinCapacity(safe.capacityPreset, safe.customCapacity);
  if (!Number.isInteger(capacity) || capacity < MIN_CABIN_CAPACITY || capacity > MAX_CABIN_CAPACITY) {
    throw createHttpError(
      400,
      `capacity must be a whole number between ${MIN_CABIN_CAPACITY} and ${MAX_CABIN_CAPACITY}`,
    );
  }
  safe.capacity = capacity;
  delete safe.customCapacity;

  return safe;
};

const sanitizeUpdatePayload = (payload = {}) => {
  const safe = {};

  for (const field of CABIN_UPDATE_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    if (field === "name") {
      safe.name = String(payload.name || "").trim().slice(0, 120);
    } else if (field === "cabinType") {
      const cabinType = String(payload.cabinType || "").trim().toUpperCase();
      if (!CABIN_TYPES.includes(cabinType)) throw createHttpError(400, "Invalid cabinType");
      safe.cabinType = cabinType;
    } else if (field === "monthlyRent") {
      const monthlyRent = Number(payload.monthlyRent);
      if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
        throw createHttpError(400, "monthlyRent must be a non-negative number");
      }
      safe.monthlyRent = monthlyRent;
    } else if (field === "securityDeposit") {
      const securityDeposit = Number(payload.securityDeposit);
      if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
        throw createHttpError(400, "securityDeposit must be a non-negative number");
      }
      safe.securityDeposit = securityDeposit;
    } else if (field === "description") {
      safe.description = String(payload.description || "").trim().slice(0, 2000);
    } else if (field === "amenities") {
      const amenities = Array.isArray(payload.amenities) ? payload.amenities : [];
      if (!amenities.every((amenity) => CABIN_AMENITIES.includes(amenity))) {
        throw createHttpError(400, "One or more amenities are not recognized");
      }
      safe.amenities = [...new Set(amenities)];
    }
  }

  return safe;
};

const createCabin = async ({ companyId, actingUser, payload }) => {
  const safePayload = await sanitizeCreatePayload(companyId, payload);
  const cabinCode = await generateCabinCode(companyId);
  const seats = generateSeatsForCabin(cabinCode, safePayload.capacity);

  const cabin = await CoworkingCabin.create({
    ...safePayload,
    companyId,
    cabinCode,
    seats,
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CABIN_CREATED",
    entityType: "CoworkingCabin",
    entityId: cabin._id,
    metadata: { cabinCode, capacity: safePayload.capacity, floorId: safePayload.floorId },
  });

  return cabin;
};

const listCabins = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });
  const filter = { companyId };

  if (query.propertyId) {
    if (!isValidObjectId(query.propertyId)) throw createHttpError(400, "Invalid propertyId");
    filter.propertyId = query.propertyId;
  }
  if (query.floorId) {
    if (!isValidObjectId(query.floorId)) throw createHttpError(400, "Invalid floorId");
    filter.floorId = query.floorId;
  }
  if (query.status) {
    const status = String(query.status).trim().toUpperCase();
    if (!CABIN_STATUSES.includes(status)) throw createHttpError(400, "Invalid status filter");
    filter.status = status;
  }
  if (query.capacity) {
    const capacity = Number(query.capacity);
    if (Number.isFinite(capacity)) filter.capacity = capacity;
  }
  if (query.search) {
    const search = String(query.search).trim();
    filter.$or = [
      { cabinCode: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const [rows, totalCount] = await Promise.all([
    CoworkingCabin.find(filter)
      .populate("propertyId", "name propertyCode")
      .populate("floorId", "floorNumber name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingCabin.countDocuments(filter),
  ]);

  return { cabins: rows, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

// Flat, paginated view across every cabin's embedded seats — reads only
// (the Cabin documents + their embedded seats remain the single source of
// truth; this never writes, and never duplicates seat state anywhere).
const listSeatsAcrossCabins = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });

  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  if (query.propertyId) {
    if (!isValidObjectId(query.propertyId)) throw createHttpError(400, "Invalid propertyId");
    match.propertyId = new mongoose.Types.ObjectId(query.propertyId);
  }
  if (query.floorId) {
    if (!isValidObjectId(query.floorId)) throw createHttpError(400, "Invalid floorId");
    match.floorId = new mongoose.Types.ObjectId(query.floorId);
  }

  const seatMatch = {};
  if (query.status) {
    seatMatch["seats.status"] = String(query.status).trim().toUpperCase();
  }
  if (query.search) {
    seatMatch["seats.seatCode"] = { $regex: String(query.search).trim(), $options: "i" };
  }

  const pipeline = [
    { $match: match },
    { $unwind: "$seats" },
    ...(Object.keys(seatMatch).length ? [{ $match: seatMatch }] : []),
    {
      $project: {
        _id: 0,
        cabinId: "$_id",
        cabinCode: 1,
        propertyId: 1,
        floorId: 1,
        seatCode: "$seats.seatCode",
        seatNumber: "$seats.seatNumber",
        status: "$seats.status",
        assignedTo: "$seats.assignedTo",
      },
    },
    { $sort: { cabinCode: 1, seatNumber: 1 } },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await CoworkingCabin.aggregate(pipeline);
  const rows = result?.rows || [];
  const totalCount = result?.totalCount?.[0]?.count || 0;

  const [properties, floors] = await Promise.all([
    mongoose.model("CoworkingProperty").find({ companyId }).select("name").lean(),
    mongoose.model("CoworkingFloor").find({ companyId }).select("floorNumber name").lean(),
  ]);
  const propertyById = new Map(properties.map((p) => [String(p._id), p]));
  const floorById = new Map(floors.map((f) => [String(f._id), f]));

  const seats = rows.map((row) => ({
    ...row,
    property: propertyById.get(String(row.propertyId)) || null,
    floor: floorById.get(String(row.floorId)) || null,
  }));

  return { seats, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getCabinDoc = async (companyId, cabinId) => {
  if (!isValidObjectId(cabinId)) throw createHttpError(400, "Invalid cabin id");
  const cabin = await CoworkingCabin.findOne({ _id: cabinId, companyId });
  if (!cabin) throw createHttpError(404, "Cabin not found");
  return cabin;
};

const getCabinById = async ({ companyId, cabinId }) => {
  if (!isValidObjectId(cabinId)) throw createHttpError(400, "Invalid cabin id");
  const cabin = await CoworkingCabin.findOne({ _id: cabinId, companyId })
    .populate("propertyId", "name propertyCode")
    .populate("floorId", "floorNumber name")
    .lean();
  if (!cabin) throw createHttpError(404, "Cabin not found");
  return cabin;
};

const updateCabin = async ({ companyId, cabinId, payload, actingUser }) => {
  const cabin = await getCabinDoc(companyId, cabinId);
  const safePayload = sanitizeUpdatePayload(payload);
  if (Object.keys(safePayload).length === 0) {
    throw createHttpError(400, "No valid fields to update");
  }

  Object.assign(cabin, safePayload, { updatedBy: actingUser._id });
  await cabin.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CABIN_UPDATED",
    entityType: "CoworkingCabin",
    entityId: cabin._id,
    metadata: { changes: safePayload },
  });

  return cabin;
};

const deleteCabin = async ({ companyId, cabinId, actingUser }) => {
  const cabin = await getCabinDoc(companyId, cabinId);

  const hasActiveSeats = cabin.seats.some((seat) => ["OCCUPIED", "RESERVED"].includes(seat.status));
  if (hasActiveSeats) {
    throw createHttpError(409, "Cannot delete a cabin with occupied or reserved seats");
  }

  await cabin.deleteOne();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "CABIN_DELETED",
    entityType: "CoworkingCabin",
    entityId: cabinId,
    metadata: { cabinCode: cabin.cabinCode },
  });
};

const withCabinMutation = (mutateFn, auditAction) => async ({ companyId, cabinId, actingUser, ...rest }) => {
  const cabin = await getCabinDoc(companyId, cabinId);
  const result = await mutateFn(cabin, rest, actingUser, companyId);
  await cabin.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: auditAction,
    entityType: "CoworkingCabin",
    entityId: cabin._id,
    metadata: { seatCode: rest.seatCode || null, cabinCode: cabin.cabinCode },
  });

  return { cabin, result };
};

const blockCabin = withCabinMutation((cabin, { reason }) => {
  setCabinManualOverride(cabin, "BLOCKED");
  cabin.blockReason = String(reason || "").trim().slice(0, 500);
}, "CABIN_BLOCKED");

const unblockCabin = withCabinMutation((cabin) => {
  setCabinManualOverride(cabin, "NONE");
  cabin.blockReason = "";
}, "CABIN_UNBLOCKED");

const setCabinMaintenance = withCabinMutation((cabin) => {
  setCabinManualOverride(cabin, "MAINTENANCE");
}, "CABIN_MAINTENANCE_SET");

const clearCabinMaintenance = withCabinMutation((cabin) => {
  setCabinManualOverride(cabin, "NONE");
}, "CABIN_MAINTENANCE_CLEARED");

const assignCabinSeat = withCabinMutation(async (cabin, { seatCode, clientId, label }, actingUser, companyId) => {
  let resolvedLabel = String(label || "").trim();

  if (clientId) {
    if (!isValidObjectId(clientId)) throw createHttpError(400, "Invalid clientId");
    const client = await CoworkingClient.findOne({ _id: clientId, companyId }).select("companyName").lean();
    if (!client) throw createHttpError(400, "Client not found for this company");
    resolvedLabel = client.companyName;
  }

  if (!resolvedLabel) {
    throw createHttpError(400, "Either clientId or label is required to assign a seat");
  }

  return assignSeat(cabin, seatCode, { clientId: clientId || null, label: resolvedLabel, assignedBy: actingUser._id });
}, "SEAT_ASSIGNED");

const releaseCabinSeat = withCabinMutation((cabin, { seatCode }) =>
  releaseSeat(cabin, seatCode), "SEAT_RELEASED");

const blockCabinSeat = withCabinMutation((cabin, { seatCode }) =>
  setSeatStatus(cabin, seatCode, "BLOCKED"), "SEAT_BLOCKED");

const unblockCabinSeat = withCabinMutation((cabin, { seatCode }) =>
  setSeatStatus(cabin, seatCode, "AVAILABLE"), "SEAT_UNBLOCKED");

const setCabinSeatMaintenance = withCabinMutation((cabin, { seatCode }) =>
  setSeatStatus(cabin, seatCode, "MAINTENANCE"), "SEAT_MAINTENANCE_SET");

const clearCabinSeatMaintenance = withCabinMutation((cabin, { seatCode }) =>
  setSeatStatus(cabin, seatCode, "AVAILABLE"), "SEAT_MAINTENANCE_CLEARED");

module.exports = {
  generateCabinCode,
  createCabin,
  listCabins,
  listSeatsAcrossCabins,
  getCabinById,
  updateCabin,
  deleteCabin,
  blockCabin,
  unblockCabin,
  setCabinMaintenance,
  clearCabinMaintenance,
  assignCabinSeat,
  releaseCabinSeat,
  blockCabinSeat,
  unblockCabinSeat,
  setCabinSeatMaintenance,
  clearCabinSeatMaintenance,
};
