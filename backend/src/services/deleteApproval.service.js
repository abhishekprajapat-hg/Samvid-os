const mongoose = require("mongoose");
const RecordDeleteRequest = require("../models/RecordDeleteRequest");
const { USER_ROLES } = require("../constants/role.constants");
const { createHttpError } = require("../utils/httpError");
const { writeAuditLog } = require("./auditLog.service");

/*
 * "A Manager can do everything an Admin can, except delete: every delete by a
 * Manager needs Admin approval." (business rule, 29 Sep 2026)
 *
 * How it works:
 *   1. A delete route adds requireAdminApprovalForDelete(type, config) just
 *      before its handler. That also registers the handler under `type`.
 *   2. When a Manager calls the route, the middleware stores the call as a
 *      RecordDeleteRequest and answers 202 { approvalRequired: true } instead
 *      of deleting anything.
 *   3. An Admin approves it from Alerts. The registered handler then runs with
 *      the Admin as the actor, so the delete behaves exactly as if the Admin
 *      had pressed Delete (same checks, audit entries and notifications).
 *
 * Everyone else is untouched: an Admin deletes directly, and other roles keep
 * whatever their route already allowed or refused.
 */

const DELETE_APPROVAL_ROLES = Object.freeze([USER_ROLES.MANAGER]);
const PROCESSING_STALE_MS = 2 * 60 * 1000;
const LIST_LIMIT = 200;

const registry = new Map();

const normalizeRole = (value) => String(value || "").trim().toUpperCase();
const isAdmin = (user) => normalizeRole(user?.role) === USER_ROLES.ADMIN;
const needsDeleteApproval = (user) => DELETE_APPROVAL_ROLES.includes(normalizeRole(user?.role));
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

/**
 * config:
 *   label     what the record is, for people ("Task")
 *   pageKey   CRM page the record belongs to, for grouping in Alerts
 *   idParam   route param holding the record id (default "id")
 *   handler   the route's final (req, res) handler, run on approval
 *   describe  async ({ id, companyId }) => the record's name, or null when it
 *             does not exist in this company (the request is then refused)
 */
const registerDeleteAction = (type, config = {}) => {
  if (!type || typeof config.handler !== "function") {
    throw new Error(`Delete action "${type}" needs a handler`);
  }
  registry.set(type, {
    type,
    label: config.label || type,
    pageKey: config.pageKey || "",
    idParam: config.idParam || "id",
    handler: config.handler,
    describe: typeof config.describe === "function" ? config.describe : null,
  });
  return registry.get(type);
};

const getDeleteAction = (type) => registry.get(type) || null;

/*
 * A describe() for the common case: the record is a document of `Model` with
 * a companyId. Returns the first non-empty of `fields` as its name, "" when
 * it has none, and null when there is no such record in this company.
 */
const describeByModel = (Model, fields = ["name"], extraFilter = {}) => async ({ id, companyId }) => {
  const row = await Model.findOne({ _id: id, companyId, ...extraFilter })
    .select(fields.join(" "))
    .lean();
  if (!row) return null;
  const value = fields
    .map((field) => row[field])
    .find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim());
  return value === undefined ? "" : String(value);
};

const plain = (value) => {
  if (!value || typeof value !== "object") return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
};

const toUserView = (user) => {
  if (!user) return null;
  if (typeof user !== "object" || !user._id) return { _id: user };
  return {
    _id: user._id,
    name: user.name || "",
    email: user.email || "",
    role: user.role || "",
    profileImageUrl: user.profileImageUrl || "",
  };
};

const toDeleteRequestView = (request) => {
  if (!request) return null;
  const row = typeof request.toObject === "function" ? request.toObject() : request;
  return {
    _id: row._id,
    actionType: row.actionType,
    entityLabel: row.entityLabel || "",
    entityId: row.entityId,
    entityName: row.entityName || "",
    pageKey: row.pageKey || "",
    reason: row.reason || "",
    status: row.status,
    requestedBy: toUserView(row.requestedBy),
    reviewedBy: toUserView(row.reviewedBy),
    reviewedAt: row.reviewedAt || null,
    reviewNote: row.reviewNote || "",
    result: row.result || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
};

const populateRequest = (query) => query
  .populate("requestedBy", "_id name email role profileImageUrl")
  .populate("reviewedBy", "_id name email role profileImageUrl");

const emitToAdmins = (io, companyId, event, payload) => {
  if (!io || !companyId) return;
  io.to(`company:${companyId}:role:${USER_ROLES.ADMIN}`).emit(event, payload);
};

const emitCreated = (io, request) => {
  const view = toDeleteRequestView(request);
  const payload = {
    eventId: `record-delete:${view._id}`,
    source: "record-delete",
    requestType: "RECORD_DELETE",
    requestId: view._id,
    status: view.status,
    companyId: String(request.companyId),
    entityLabel: view.entityLabel,
    entityName: view.entityName,
    requestedBy: view.requestedBy,
    createdAt: view.createdAt,
    message: "New delete request",
  };
  emitToAdmins(io, String(request.companyId), "admin:request:new", payload);
  emitToAdmins(io, String(request.companyId), "delete-request:created", payload);
};

const emitReviewed = (io, request) => {
  if (!io) return;
  const view = toDeleteRequestView(request);
  const requesterId = view.requestedBy?._id;
  const payload = { request: view, status: view.status };
  if (requesterId) io.to(`user:${requesterId}`).emit("delete-request:reviewed", payload);
  emitToAdmins(io, String(request.companyId), "delete-request:reviewed", payload);
};

/*
 * The part of the call worth keeping. Only the route's own id param, the query
 * and a small body are stored, never headers or tokens.
 */
const captureCall = (req) => ({
  params: plain(req.params),
  query: plain(req.query),
  body: plain(req.body),
  path: String(req.originalUrl || req.url || "").slice(0, 500),
});

const createDeleteRequest = async ({ type, req }) => {
  const action = getDeleteAction(type);
  if (!action) throw createHttpError(500, "This delete is not set up for approval");

  const user = req.user;
  const companyId = user?.companyId;
  if (!companyId) throw createHttpError(403, "Company context is required");

  const entityId = String(req.params?.[action.idParam] || "").trim();
  if (!entityId) throw createHttpError(400, `${action.label} id is required`);
  if (!isValidObjectId(entityId)) throw createHttpError(400, `Invalid ${action.label.toLowerCase()} id`);

  let entityName = "";
  if (action.describe) {
    const described = await action.describe({ id: entityId, companyId, user });
    if (described === null || described === undefined) {
      throw createHttpError(404, `${action.label} not found`);
    }
    entityName = String(described || "").slice(0, 300);
  }

  const existing = await populateRequest(RecordDeleteRequest.findOne({
    companyId,
    actionType: type,
    entityId,
    status: "PENDING",
  }));
  if (existing) return { request: existing, created: false };

  const reason = String(req.body?.reason || req.query?.reason || "").trim().slice(0, 500);

  let request;
  try {
    request = await RecordDeleteRequest.create({
      companyId,
      actionType: type,
      entityLabel: action.label,
      entityId,
      entityName,
      pageKey: action.pageKey,
      ...captureCall(req),
      reason,
      requestedBy: user._id,
      status: "PENDING",
    });
  } catch (error) {
    // Two clicks at once: the unique index let one through.
    if (error?.code === 11000) {
      const first = await populateRequest(RecordDeleteRequest.findOne({
        companyId, actionType: type, entityId, status: "PENDING",
      }));
      if (first) return { request: first, created: false };
    }
    throw error;
  }

  await writeAuditLog({
    companyId,
    actor: user,
    action: "DELETE_REQUESTED",
    entityType: action.label,
    entityId,
    metadata: { requestId: request._id, actionType: type, entityName, reason },
    req,
  });

  const populated = await populateRequest(RecordDeleteRequest.findById(request._id));
  emitCreated(req.app?.get?.("io"), populated || request);
  return { request: populated || request, created: true };
};

/*
 * Route middleware. Put it right before the handler, after the route's own
 * access checks, so a Manager can only ask to delete what they could reach.
 */
const requireAdminApprovalForDelete = (type, config) => {
  registerDeleteAction(type, config);

  return async (req, res, next) => {
    if (!needsDeleteApproval(req.user)) return next();

    try {
      const { request, created } = await createDeleteRequest({ type, req });
      return res.status(202).json({
        message: created
          ? "Delete request sent to Admin for approval"
          : "A delete request for this is already waiting for Admin approval",
        approvalRequired: true,
        deleteRequest: toDeleteRequestView(request),
      });
    } catch (error) {
      if (!error.statusCode) {
        req.log?.error?.({ error: error.message, type }, "Delete request failed");
      }
      return res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : "Unable to send the delete request",
      });
    }
  };
};

/*
 * Runs a registered handler outside Express and collects what it answered.
 * The request inherits everything from the approving Admin's own request
 * (user, company, io, logger), with the stored params/query/body on top.
 */
const defineOwn = (target, key, value) => Object.defineProperty(target, key, {
  value, writable: true, configurable: true, enumerable: true,
});

const runHandler = (handler, execReq) => new Promise((resolve) => {
  let settled = false;
  const finish = (outcome) => {
    if (settled) return;
    settled = true;
    resolve(outcome);
  };

  const res = {
    statusCode: 200,
    headersSent: false,
    locals: {},
    status(code) { this.statusCode = code; return this; },
    set() { return this; },
    setHeader() { return this; },
    header() { return this; },
    type() { return this; },
    get() { return undefined; },
    json(body) { this.headersSent = true; finish({ statusCode: this.statusCode, body }); return this; },
    send(body) { this.headersSent = true; finish({ statusCode: this.statusCode, body }); return this; },
    sendStatus(code) { this.statusCode = code; this.headersSent = true; finish({ statusCode: code, body: null }); return this; },
    end() { this.headersSent = true; finish({ statusCode: this.statusCode, body: null }); return this; },
  };

  const next = (error) => finish({
    statusCode: error?.statusCode || error?.status || 500,
    body: { message: error?.message || "The delete did not complete" },
  });

  Promise.resolve()
    .then(() => handler(execReq, res, next))
    .then(() => setTimeout(() => finish({
      statusCode: 500,
      body: { message: "The delete did not complete" },
    }), 0))
    .catch((error) => finish({
      statusCode: error?.statusCode || 500,
      body: { message: error?.message || "The delete did not complete" },
    }));
});

const executeDeleteRequest = async ({ request, req }) => {
  const action = getDeleteAction(request.actionType);
  if (!action) {
    throw createHttpError(400, "This kind of delete can no longer be approved");
  }

  const execReq = Object.create(req);
  defineOwn(execReq, "method", "DELETE");
  defineOwn(execReq, "params", { ...(request.params || {}) });
  defineOwn(execReq, "query", { ...(request.query || {}) });
  defineOwn(execReq, "body", { ...(request.body || {}) });
  defineOwn(execReq, "originalUrl", request.path || req.originalUrl);
  defineOwn(execReq, "url", request.path || req.url);
  defineOwn(execReq, "deleteRequest", { _id: request._id, requestedBy: request.requestedBy });

  return runHandler(action.handler, execReq);
};

const assertAdmin = (user) => {
  if (!isAdmin(user)) throw createHttpError(403, "Only an Admin can review delete requests");
};

const listDeleteRequests = async ({ user, status = "PENDING" }) => {
  const companyId = user?.companyId;
  if (!companyId) throw createHttpError(403, "Company context is required");

  const query = { companyId };
  const wanted = String(status || "").trim().toUpperCase();
  if (wanted && wanted !== "ALL") query.status = wanted;

  // Admins review everybody's requests; anyone else sees only their own.
  if (!isAdmin(user)) query.requestedBy = user._id;

  const rows = await populateRequest(
    RecordDeleteRequest.find(query).sort({ createdAt: -1 }).limit(LIST_LIMIT),
  ).lean();
  return rows.map(toDeleteRequestView);
};

const findRequestForReview = async ({ user, requestId }) => {
  if (!isValidObjectId(requestId)) throw createHttpError(400, "Invalid request id");
  const request = await RecordDeleteRequest.findOne({ _id: requestId, companyId: user.companyId });
  if (!request) throw createHttpError(404, "Delete request not found");
  if (request.status !== "PENDING") {
    throw createHttpError(409, `This request is already ${request.status.toLowerCase()}`);
  }
  return request;
};

const approveDeleteRequest = async ({ req, requestId, note = "" }) => {
  const user = req.user;
  assertAdmin(user);
  await findRequestForReview({ user, requestId });

  // Claim it, so a double click cannot run the delete twice.
  const staleBefore = new Date(Date.now() - PROCESSING_STALE_MS);
  const claimed = await RecordDeleteRequest.findOneAndUpdate(
    {
      _id: requestId,
      companyId: user.companyId,
      status: "PENDING",
      $or: [{ processingAt: null }, { processingAt: { $lt: staleBefore } }],
    },
    { $set: { processingAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!claimed) throw createHttpError(409, "This request is already being approved");

  let outcome;
  try {
    outcome = await executeDeleteRequest({ request: claimed, req });
  } catch (error) {
    await RecordDeleteRequest.updateOne({ _id: claimed._id }, { $set: { processingAt: null } });
    throw error;
  }

  const statusCode = Number(outcome?.statusCode) || 500;
  const message = String(outcome?.body?.message || "").slice(0, 500);
  const reviewNote = String(note || "").trim().slice(0, 500);

  if (statusCode >= 200 && statusCode < 300) {
    claimed.status = "APPROVED";
  } else if (statusCode === 404) {
    // Already gone - nothing left to approve, so close the request.
    claimed.status = "FAILED";
  } else {
    // Refused for a reason the Admin can act on (e.g. a role still has
    // holders). Leave it pending and pass the reason on.
    await RecordDeleteRequest.updateOne({ _id: claimed._id }, { $set: { processingAt: null } });
    throw createHttpError(statusCode >= 400 && statusCode < 500 ? statusCode : 500,
      message || "The delete could not be completed");
  }

  claimed.processingAt = null;
  claimed.reviewedBy = user._id;
  claimed.reviewedAt = new Date();
  claimed.reviewNote = reviewNote;
  claimed.result = { statusCode, message };
  await claimed.save();

  await writeAuditLog({
    companyId: user.companyId,
    actor: user,
    action: claimed.status === "APPROVED" ? "DELETE_REQUEST_APPROVED" : "DELETE_REQUEST_FAILED",
    entityType: claimed.entityLabel || claimed.actionType,
    entityId: claimed.entityId,
    metadata: {
      requestId: claimed._id,
      actionType: claimed.actionType,
      entityName: claimed.entityName,
      requestedBy: claimed.requestedBy,
      result: claimed.result,
    },
    req,
  });

  const populated = await populateRequest(RecordDeleteRequest.findById(claimed._id));
  emitReviewed(req.app?.get?.("io"), populated || claimed);
  return toDeleteRequestView(populated || claimed);
};

const rejectDeleteRequest = async ({ req, requestId, note = "" }) => {
  const user = req.user;
  assertAdmin(user);
  const request = await findRequestForReview({ user, requestId });
  if (request.processingAt && request.processingAt > new Date(Date.now() - PROCESSING_STALE_MS)) {
    throw createHttpError(409, "This request is being approved right now");
  }

  request.status = "REJECTED";
  request.reviewedBy = user._id;
  request.reviewedAt = new Date();
  request.reviewNote = String(note || "").trim().slice(0, 500);
  await request.save();

  await writeAuditLog({
    companyId: user.companyId,
    actor: user,
    action: "DELETE_REQUEST_REJECTED",
    entityType: request.entityLabel || request.actionType,
    entityId: request.entityId,
    metadata: { requestId: request._id, actionType: request.actionType, note: request.reviewNote },
    req,
  });

  const populated = await populateRequest(RecordDeleteRequest.findById(request._id));
  emitReviewed(req.app?.get?.("io"), populated || request);
  return toDeleteRequestView(populated || request);
};

// The Manager who asked can take the request back while it is pending.
const cancelDeleteRequest = async ({ req, requestId }) => {
  const user = req.user;
  if (!isValidObjectId(requestId)) throw createHttpError(400, "Invalid request id");
  const request = await RecordDeleteRequest.findOne({ _id: requestId, companyId: user.companyId });
  if (!request) throw createHttpError(404, "Delete request not found");
  if (String(request.requestedBy) !== String(user._id) && !isAdmin(user)) {
    throw createHttpError(403, "Only the person who asked can cancel this request");
  }
  if (request.status !== "PENDING") {
    throw createHttpError(409, `This request is already ${request.status.toLowerCase()}`);
  }
  request.status = "CANCELLED";
  await request.save();
  const populated = await populateRequest(RecordDeleteRequest.findById(request._id));
  emitReviewed(req.app?.get?.("io"), populated || request);
  return toDeleteRequestView(populated || request);
};

module.exports = {
  DELETE_APPROVAL_ROLES,
  needsDeleteApproval,
  registerDeleteAction,
  getDeleteAction,
  describeByModel,
  requireAdminApprovalForDelete,
  createDeleteRequest,
  executeDeleteRequest,
  listDeleteRequests,
  approveDeleteRequest,
  rejectDeleteRequest,
  cancelDeleteRequest,
  toDeleteRequestView,
};
