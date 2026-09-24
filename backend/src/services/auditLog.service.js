const AuditLog = require("../models/AuditLog");
const { parsePagination, buildPaginationMeta } = require("../utils/queryOptions");

const writeAuditLog = async ({ companyId, actor, action, entityType, entityId, metadata, req }) => {
  try {
    await AuditLog.create({
      companyId,
      actorId: actor._id,
      actorRole: actor.role,
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      metadata,
      ip: req?.ip || "",
    });
  } catch (error) {
    // Auditing must never block the primary action it is recording.
    req?.log?.error({
      requestId: req?.requestId || null,
      error: error.message,
      message: "writeAuditLog failed",
    });
  }
};

const listAuditLogs = async ({ companyId, query = {} }) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { companyId };

  if (query.entityType) filter.entityType = String(query.entityType).trim();
  if (query.entityId) filter.entityId = String(query.entityId).trim();
  if (query.action) filter.action = String(query.action).trim();
  if (query.actorId) filter.actorId = query.actorId;

  const [rows, totalCount] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorId", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs: rows,
    pagination: buildPaginationMeta({ page, limit, totalCount }),
  };
};

module.exports = { writeAuditLog, listAuditLogs };
