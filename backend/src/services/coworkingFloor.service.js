const mongoose = require("mongoose");
const CoworkingFloor = require("../models/CoworkingFloor");
const CoworkingProperty = require("../models/CoworkingProperty");
const CoworkingCabin = require("../models/CoworkingCabin");
const { FLOOR_STATUSES, FLOOR_ALLOWED_FIELDS } = require("../constants/coworking.constants");
const { createHttpError } = require("../utils/httpError");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");
const { writeAuditLog } = require("./auditLog.service");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const assertPropertyExists = async (companyId, propertyId) => {
  if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid propertyId");
  const exists = await CoworkingProperty.exists({ _id: propertyId, companyId });
  if (!exists) throw createHttpError(400, "Property not found for this company");
};

const sanitizeFloorPayload = (payload = {}, { mode }) => {
  const safe = {};

  for (const field of FLOOR_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;

    if (field === "propertyId") {
      const propertyId = String(payload.propertyId || "").trim();
      if (!isValidObjectId(propertyId)) throw createHttpError(400, "Invalid propertyId");
      safe.propertyId = propertyId;
    } else if (field === "floorNumber") {
      const floorNumber = Number(payload.floorNumber);
      if (!Number.isFinite(floorNumber)) throw createHttpError(400, "floorNumber must be a number");
      safe.floorNumber = floorNumber;
    } else if (field === "name") {
      safe.name = String(payload.name || "").trim().slice(0, 120);
    } else if (field === "status") {
      const status = String(payload.status || "").trim().toUpperCase();
      if (!FLOOR_STATUSES.includes(status)) throw createHttpError(400, "Invalid status");
      safe.status = status;
    }
  }

  if (mode === "create") {
    if (!safe.propertyId) throw createHttpError(400, "propertyId is required");
    if (safe.floorNumber === undefined) throw createHttpError(400, "floorNumber is required");
  }

  return safe;
};

const createFloor = async ({ companyId, actingUser, payload }) => {
  const safePayload = sanitizeFloorPayload(payload, { mode: "create" });
  await assertPropertyExists(companyId, safePayload.propertyId);

  const floor = await CoworkingFloor.create({
    ...safePayload,
    companyId,
    createdBy: actingUser._id,
  });

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "FLOOR_CREATED",
    entityType: "CoworkingFloor",
    entityId: floor._id,
    metadata: { propertyId: safePayload.propertyId, floorNumber: safePayload.floorNumber },
  });

  return floor;
};

const attachFloorStatistics = async (companyId, floors) => {
  if (floors.length === 0) return floors;

  const floorIds = floors.map((floor) => floor._id);
  const cabins = await CoworkingCabin.find({ companyId, floorId: { $in: floorIds } })
    .select("floorId status seats.status")
    .lean();

  const statsByFloor = new Map();
  for (const cabin of cabins) {
    const key = String(cabin.floorId);
    const stats = statsByFloor.get(key) || {
      cabinCount: 0,
      seatCount: 0,
      occupiedSeatCount: 0,
      availableSeatCount: 0,
    };
    stats.cabinCount += 1;
    stats.seatCount += cabin.seats.length;
    stats.occupiedSeatCount += cabin.seats.filter((seat) =>
      ["OCCUPIED", "RESERVED"].includes(seat.status),
    ).length;
    stats.availableSeatCount += cabin.seats.filter((seat) => seat.status === "AVAILABLE").length;
    statsByFloor.set(key, stats);
  }

  return floors.map((floor) => ({
    ...floor,
    statistics: statsByFloor.get(String(floor._id)) || {
      cabinCount: 0,
      seatCount: 0,
      occupiedSeatCount: 0,
      availableSeatCount: 0,
    },
  }));
};

const listFloors = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 200 });
  const filter = { companyId };

  if (query.propertyId) {
    if (!isValidObjectId(query.propertyId)) throw createHttpError(400, "Invalid propertyId");
    filter.propertyId = query.propertyId;
  }
  if (query.status) filter.status = String(query.status).trim().toUpperCase();

  const [rows, totalCount] = await Promise.all([
    CoworkingFloor.find(filter)
      .populate("propertyId", "name propertyCode")
      .sort({ propertyId: 1, floorNumber: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CoworkingFloor.countDocuments(filter),
  ]);

  const floors = await attachFloorStatistics(companyId, rows);

  return { floors, pagination: buildPaginationMeta({ page, limit, totalCount }) };
};

const getFloorById = async ({ companyId, floorId }) => {
  if (!isValidObjectId(floorId)) throw createHttpError(400, "Invalid floor id");
  const floor = await CoworkingFloor.findOne({ _id: floorId, companyId })
    .populate("propertyId", "name propertyCode")
    .lean();
  if (!floor) throw createHttpError(404, "Floor not found");
  const [withStats] = await attachFloorStatistics(companyId, [floor]);
  return withStats;
};

const updateFloor = async ({ companyId, floorId, payload, actingUser }) => {
  if (!isValidObjectId(floorId)) throw createHttpError(400, "Invalid floor id");
  const floor = await CoworkingFloor.findOne({ _id: floorId, companyId });
  if (!floor) throw createHttpError(404, "Floor not found");

  const safePayload = sanitizeFloorPayload(payload, { mode: "update" });
  if (safePayload.propertyId) {
    await assertPropertyExists(companyId, safePayload.propertyId);
  }
  if (Object.keys(safePayload).length === 0) {
    throw createHttpError(400, "No valid fields to update");
  }

  Object.assign(floor, safePayload, { updatedBy: actingUser._id });
  await floor.save();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "FLOOR_UPDATED",
    entityType: "CoworkingFloor",
    entityId: floor._id,
    metadata: { changes: safePayload },
  });

  return floor;
};

const deleteFloor = async ({ companyId, floorId, actingUser }) => {
  if (!isValidObjectId(floorId)) throw createHttpError(400, "Invalid floor id");
  const floor = await CoworkingFloor.findOne({ _id: floorId, companyId });
  if (!floor) throw createHttpError(404, "Floor not found");

  const cabinCount = await CoworkingCabin.countDocuments({ companyId, floorId });
  if (cabinCount > 0) {
    throw createHttpError(409, "Cannot delete a floor that still has cabins");
  }

  await floor.deleteOne();

  await writeAuditLog({
    companyId,
    actor: actingUser,
    action: "FLOOR_DELETED",
    entityType: "CoworkingFloor",
    entityId: floorId,
    metadata: { floorNumber: floor.floorNumber, propertyId: floor.propertyId },
  });
};

module.exports = {
  sanitizeFloorPayload,
  createFloor,
  listFloors,
  getFloorById,
  updateFloor,
  deleteFloor,
};
