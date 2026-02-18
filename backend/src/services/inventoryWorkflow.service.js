const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryRequest = require("../models/InventoryRequest");
const InventoryActivity = require("../models/InventoryActivity");
const User = require("../models/User");
const {
  INVENTORY_STATUSES,
  INVENTORY_ALLOWED_FIELDS,
  INVENTORY_REQUIRED_CREATE_FIELDS,
  INVENTORY_ACTIVITY_ACTIONS,
} = require("../constants/inventory.constants");
const {
  notifyRequestCreated,
  notifyRequestReviewed,
} = require("./inventoryNotification.service");

const USER_ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EXECUTIVE: "EXECUTIVE",
  FIELD_EXECUTIVE: "FIELD_EXECUTIVE",
};

const REQUEST_STATUS_PENDING = "pending";
const REQUEST_STATUS_APPROVED = "approved";
const REQUEST_STATUS_REJECTED = "rejected";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const isSafeKey = (key) =>
  typeof key === "string"
  && key.length > 0
  && !key.startsWith("$")
  && !key.includes(".");

const sanitizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const sanitizeFileList = (value) => {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => sanitizeString(item))
      .filter((item) => item.length > 0),
  )];
};

const sanitizePrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

const normalizeLegacyStatus = (status) => {
  const cleanStatus = sanitizeString(status);
  if (!cleanStatus) return cleanStatus;

  if (cleanStatus === "Reserved" || cleanStatus === "Rented") {
    return "Blocked";
  }

  return cleanStatus;
};

const deriveStructuredFieldsFromTitle = (title) => {
  const cleanTitle = sanitizeString(title);
  if (!cleanTitle) return {};

  const parts = cleanTitle
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      projectName: parts.slice(0, parts.length - 2).join(" - "),
      towerName: parts[parts.length - 2],
      unitNumber: parts[parts.length - 1],
    };
  }

  if (parts.length === 2) {
    return {
      projectName: parts[0],
      towerName: parts[1],
      unitNumber: parts[1],
    };
  }

  return {
    projectName: parts[0],
    towerName: "Main",
    unitNumber: `UNIT-${Date.now()}`,
  };
};

const normalizeLegacyInventoryPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...payload };

  if (!normalized.projectName || !normalized.towerName || !normalized.unitNumber) {
    const derived = deriveStructuredFieldsFromTitle(normalized.title);
    normalized.projectName = normalized.projectName || derived.projectName;
    normalized.towerName = normalized.towerName || derived.towerName;
    normalized.unitNumber = normalized.unitNumber || derived.unitNumber;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "status")) {
    normalized.status = normalizeLegacyStatus(normalized.status);
  }

  return normalized;
};

const getCompanyIdForUser = (user) => {
  const companyId = user?.companyId;
  if (!companyId || !isValidObjectId(companyId)) {
    throw createHttpError(403, "Company context is missing for this account");
  }
  return companyId;
};

const ensureManagerExistsInCompany = async ({ managerId, companyId }) => {
  if (!managerId) return null;
  if (!isValidObjectId(managerId)) {
    throw createHttpError(400, "Invalid manager id");
  }

  const manager = await User.findOne({
    _id: managerId,
    role: USER_ROLES.MANAGER,
    isActive: true,
    companyId,
  }).select("_id name role companyId");

  if (!manager) {
    throw createHttpError(403, "Manager is inactive or does not belong to your company");
  }

  return manager;
};

const getTeamIdForUser = (user) => {
  if (!user) return null;
  if (user.role === USER_ROLES.MANAGER) return user._id;
  if ([USER_ROLES.EXECUTIVE, USER_ROLES.FIELD_EXECUTIVE].includes(user.role)) {
    return user.parentId || null;
  }
  return null;
};

const resolveDirectCreateTeamId = async ({ user, payload, companyId }) => {
  const requestedTeamId = payload?.teamId || null;
  if (requestedTeamId) {
    await ensureManagerExistsInCompany({
      managerId: requestedTeamId,
      companyId,
    });
    return requestedTeamId;
  }

  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(400, "teamId is required");
  }

  const manager = await User.findOne({
    role: USER_ROLES.MANAGER,
    isActive: true,
    companyId,
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  return manager?._id || null;
};

const pickInventoryDiff = (inventoryDoc, patch) => {
  const oldValue = {};
  const newValue = {};

  Object.keys(patch).forEach((key) => {
    oldValue[key] = inventoryDoc[key];
    newValue[key] = patch[key];
  });

  return { oldValue, newValue };
};

const sanitizeInventoryPayload = ({
  payload,
  mode = "create",
}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "proposedData must be an object");
  }

  const safePayload = {};

  INVENTORY_ALLOWED_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) return;
    if (!isSafeKey(field)) return;

    const value = payload[field];
    if (value === undefined || value === null) return;

    if (field === "projectName" || field === "towerName" || field === "unitNumber" || field === "location") {
      const cleanValue = sanitizeString(value);
      if (!cleanValue) {
        throw createHttpError(400, `${field} must be a non-empty string`);
      }
      safePayload[field] = cleanValue;
      return;
    }

    if (field === "price") {
      const parsedPrice = sanitizePrice(value);
      if (parsedPrice === null) {
        throw createHttpError(400, "price must be a valid positive number");
      }
      safePayload[field] = parsedPrice;
      return;
    }

    if (field === "status") {
      const cleanStatus = sanitizeString(value);
      if (!INVENTORY_STATUSES.includes(cleanStatus)) {
        throw createHttpError(400, "Invalid inventory status");
      }
      safePayload[field] = cleanStatus;
      return;
    }

    if (field === "images" || field === "documents") {
      safePayload[field] = sanitizeFileList(value);
    }
  });

  if (mode === "create") {
    INVENTORY_REQUIRED_CREATE_FIELDS.forEach((field) => {
      if (safePayload[field] === undefined) {
        throw createHttpError(400, `${field} is required`);
      }
    });

    if (!safePayload.status) {
      safePayload.status = "Available";
    }
  }

  if (mode === "update" && Object.keys(safePayload).length === 0) {
    throw createHttpError(400, "At least one valid field is required for update");
  }

  return safePayload;
};

const getInventoryScopeQueryForUser = (user) => {
  if (
    [
      USER_ROLES.ADMIN,
      USER_ROLES.MANAGER,
      USER_ROLES.EXECUTIVE,
      USER_ROLES.FIELD_EXECUTIVE,
    ].includes(user.role)
  ) {
    return { companyId: getCompanyIdForUser(user) };
  }

  throw createHttpError(403, "Access denied");
};

const logInventoryActivity = async ({
  companyId,
  inventoryId,
  changedBy,
  role,
  actionType,
  oldValue = null,
  newValue = null,
  requestId = null,
}) =>
  InventoryActivity.create({
    companyId,
    inventoryId,
    changedBy,
    role,
    actionType,
    oldValue,
    newValue,
    requestId,
    timestamp: new Date(),
  });

const applyInventoryPopulates = (query) =>
  query
    .populate("teamId", "name role companyId")
    .populate("createdBy", "name role companyId")
    .populate("approvedBy", "name role companyId")
    .populate("updatedBy", "name role companyId");

const applyRequestPopulates = (query) =>
  query
    .populate("requestedBy", "name role parentId companyId")
    .populate("reviewedBy", "name role companyId")
    .populate("teamId", "name role companyId")
    .populate("inventoryId");

const getInventoryList = async ({ user, filters = {} }) => {
  const scope = getInventoryScopeQueryForUser(user);
  const query = { ...scope };

  if (filters.status && INVENTORY_STATUSES.includes(filters.status)) {
    query.status = filters.status;
  }

  if (filters.search) {
    const safeSearch = sanitizeString(filters.search);
    if (safeSearch) {
      query.$or = [
        { projectName: { $regex: safeSearch, $options: "i" } },
        { towerName: { $regex: safeSearch, $options: "i" } },
        { unitNumber: { $regex: safeSearch, $options: "i" } },
        { location: { $regex: safeSearch, $options: "i" } },
      ];
    }
  }

  return applyInventoryPopulates(
    Inventory.find(query).sort({ updatedAt: -1, createdAt: -1 }),
  );
};

const getInventoryById = async ({ user, inventoryId }) => {
  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const scope = getInventoryScopeQueryForUser(user);
  const row = await applyInventoryPopulates(
    Inventory.findOne({
      _id: inventoryId,
      ...scope,
    }),
  );

  if (!row) {
    throw createHttpError(404, "Inventory not found");
  }

  return row;
};

const createInventoryDirect = async ({ user, payload }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can create inventory directly");
  }

  const companyId = getCompanyIdForUser(user);
  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const proposed = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "create",
  });

  const teamId = await resolveDirectCreateTeamId({
    user,
    payload: normalizedPayload,
    companyId,
  });

  const created = await Inventory.create({
    ...proposed,
    companyId,
    teamId,
    createdBy: user._id,
    approvedBy: user._id,
    updatedBy: user._id,
  });

  await logInventoryActivity({
    companyId,
    inventoryId: created._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.DIRECT_CREATE,
    oldValue: null,
    newValue: proposed,
  });

  return applyInventoryPopulates(Inventory.findById(created._id));
};

const updateInventoryDirect = async ({ user, inventoryId, payload }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can update inventory directly");
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await Inventory.findOne({
    _id: inventoryId,
    companyId,
  });

  if (!inventory) {
    throw createHttpError(404, "Inventory not found");
  }

  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const patch = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "update",
  });

  const diff = pickInventoryDiff(inventory, patch);

  Object.assign(inventory, patch);
  inventory.updatedBy = user._id;
  inventory.approvedBy = user._id;
  await inventory.save();

  await logInventoryActivity({
    companyId,
    inventoryId: inventory._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.DIRECT_UPDATE,
    oldValue: diff.oldValue,
    newValue: diff.newValue,
  });

  return applyInventoryPopulates(Inventory.findById(inventory._id));
};

const deleteInventoryDirect = async ({ user, inventoryId }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can delete inventory directly");
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await Inventory.findOne({
    _id: inventoryId,
    companyId,
  });

  if (!inventory) {
    throw createHttpError(404, "Inventory not found");
  }

  const snapshot = inventory.toObject();
  await Inventory.deleteOne({ _id: inventory._id, companyId });

  await logInventoryActivity({
    companyId,
    inventoryId: inventory._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.DIRECT_DELETE,
    oldValue: snapshot,
    newValue: null,
  });
};

const bulkCreateInventoryDirect = async ({ user, payload = [] }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can bulk upload inventory");
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    throw createHttpError(400, "rows array is required");
  }

  if (payload.length > 500) {
    throw createHttpError(400, "Bulk upload limit exceeded (max 500 rows)");
  }

  const companyId = getCompanyIdForUser(user);
  const createdRows = [];
  const failedRows = [];

  for (let index = 0; index < payload.length; index += 1) {
    const row = payload[index];
    try {
      const normalizedRow = normalizeLegacyInventoryPayload(row);
      const proposed = sanitizeInventoryPayload({
        payload: normalizedRow,
        mode: "create",
      });

      const teamId = row?.teamId || null;
      if (teamId) {
        await ensureManagerExistsInCompany({
          managerId: teamId,
          companyId,
        });
      }

      const created = await Inventory.create({
        ...proposed,
        companyId,
        teamId: teamId || null,
        createdBy: user._id,
        approvedBy: user._id,
        updatedBy: user._id,
      });

      await logInventoryActivity({
        companyId,
        inventoryId: created._id,
        changedBy: user._id,
        role: user.role,
        actionType: INVENTORY_ACTIVITY_ACTIONS.BULK_CREATE,
        oldValue: null,
        newValue: proposed,
      });

      createdRows.push(created._id);
    } catch (error) {
      failedRows.push({
        row: index,
        message: error.message,
      });
    }
  }

  return {
    createdCount: createdRows.length,
    failedCount: failedRows.length,
    createdIds: createdRows,
    failures: failedRows,
  };
};

const createInventoryCreateRequest = async ({ user, payload, io }) => {
  if (user.role !== USER_ROLES.FIELD_EXECUTIVE) {
    throw createHttpError(403, "Only FIELD_EXECUTIVE can submit create requests");
  }

  const companyId = getCompanyIdForUser(user);
  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const proposed = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "create",
  });

  const teamId = getTeamIdForUser(user);
  if (teamId) {
    await ensureManagerExistsInCompany({
      managerId: teamId,
      companyId,
    });
  }

  const request = await InventoryRequest.create({
    companyId,
    requestedBy: user._id,
    type: "create",
    proposedData: proposed,
    status: REQUEST_STATUS_PENDING,
    teamId: teamId || null,
  });

  notifyRequestCreated({
    io,
    request,
    companyId,
    teamId: teamId || null,
  });

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const createInventoryUpdateRequest = async ({ user, inventoryId, payload, io }) => {
  if (user.role !== USER_ROLES.FIELD_EXECUTIVE) {
    throw createHttpError(
      403,
      "Only FIELD_EXECUTIVE can submit status change requests",
    );
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await Inventory.findOne({
    _id: inventoryId,
    companyId,
  }).select("_id status");

  if (!inventory) {
    throw createHttpError(404, "Inventory not found");
  }

  const normalizedPayload = normalizeLegacyInventoryPayload(payload);
  const proposed = sanitizeInventoryPayload({
    payload: normalizedPayload,
    mode: "update",
  });

  const changedKeys = Object.keys(proposed);
  const isStatusOnly = changedKeys.length === 1 && changedKeys[0] === "status";
  if (!isStatusOnly) {
    throw createHttpError(
      403,
      "Field Executive can request only status change",
    );
  }

  if (proposed.status === inventory.status) {
    throw createHttpError(400, "Requested status is same as current status");
  }

  const teamId = getTeamIdForUser(user);
  if (teamId) {
    await ensureManagerExistsInCompany({
      managerId: teamId,
      companyId,
    });
  }

  const request = await InventoryRequest.create({
    companyId,
    requestedBy: user._id,
    inventoryId: inventory._id,
    type: "update",
    proposedData: proposed,
    status: REQUEST_STATUS_PENDING,
    teamId: teamId || null,
  });

  await logInventoryActivity({
    companyId,
    inventoryId: inventory._id,
    changedBy: user._id,
    role: user.role,
    actionType: INVENTORY_ACTIVITY_ACTIONS.REQUEST_CREATED,
    oldValue: { status: inventory.status },
    newValue: proposed,
    requestId: request._id,
  });

  notifyRequestCreated({
    io,
    request,
    companyId,
    teamId: teamId || null,
  });

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const getPendingRequests = async ({ user }) => {
  if (![USER_ROLES.ADMIN, USER_ROLES.MANAGER].includes(user.role)) {
    throw createHttpError(403, "Access denied");
  }

  const companyId = getCompanyIdForUser(user);
  const query = {
    status: REQUEST_STATUS_PENDING,
    companyId,
  };

  if (user.role === USER_ROLES.MANAGER) {
    query.teamId = user._id;
  }

  return applyRequestPopulates(
    InventoryRequest.find(query).sort({ createdAt: -1 }),
  );
};

const preApproveRequestByManager = async ({ user, requestId }) => {
  if (user.role !== USER_ROLES.MANAGER) {
    throw createHttpError(403, "Only MANAGER can pre-approve requests");
  }

  if (!isValidObjectId(requestId)) {
    throw createHttpError(400, "Invalid request id");
  }

  const companyId = getCompanyIdForUser(user);
  const request = await InventoryRequest.findOne({
    _id: requestId,
    companyId,
    status: REQUEST_STATUS_PENDING,
    teamId: user._id,
  });

  if (!request) {
    throw createHttpError(404, "Pending request not found for this manager");
  }

  request.managerPreApprovedBy = user._id;
  request.managerPreApprovedAt = new Date();
  await request.save();

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const approveRequest = async ({ user, requestId, io }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can approve requests");
  }

  if (!isValidObjectId(requestId)) {
    throw createHttpError(400, "Invalid request id");
  }

  const companyId = getCompanyIdForUser(user);
  const request = await InventoryRequest.findOne({
    _id: requestId,
    companyId,
    status: REQUEST_STATUS_PENDING,
  }).populate("requestedBy", "_id role parentId companyId");

  if (!request) {
    throw createHttpError(404, "Pending request not found");
  }

  let inventory = null;

  if (request.type === "create") {
    const proposed = sanitizeInventoryPayload({
      payload: request.proposedData || request.proposedChanges || {},
      mode: "create",
    });

    inventory = await Inventory.create({
      ...proposed,
      companyId,
      teamId: request.teamId || null,
      createdBy: request.requestedBy?._id || request.requestedBy,
      approvedBy: user._id,
      updatedBy: user._id,
    });

    await logInventoryActivity({
      companyId,
      inventoryId: inventory._id,
      changedBy: user._id,
      role: user.role,
      actionType: INVENTORY_ACTIVITY_ACTIONS.REQUEST_APPROVED_CREATE,
      oldValue: null,
      newValue: proposed,
      requestId: request._id,
    });

    request.inventoryId = inventory._id;
  } else if (request.type === "update") {
    if (!request.inventoryId) {
      throw createHttpError(400, "Inventory reference is required for update request");
    }

    inventory = await Inventory.findOne({
      _id: request.inventoryId,
      companyId,
    });

    if (!inventory) {
      throw createHttpError(404, "Inventory not found for update request");
    }

    const proposed = sanitizeInventoryPayload({
      payload: request.proposedData || request.proposedChanges || {},
      mode: "update",
    });

    if (request.requestedBy?.role === USER_ROLES.FIELD_EXECUTIVE) {
      const changedKeys = Object.keys(proposed);
      const isStatusOnly = changedKeys.length === 1 && changedKeys[0] === "status";
      if (!isStatusOnly) {
        throw createHttpError(
          403,
          "Field Executive requests can update only status",
        );
      }
    }

    const diff = pickInventoryDiff(inventory, proposed);
    Object.assign(inventory, proposed);
    inventory.updatedBy = user._id;
    inventory.approvedBy = user._id;
    await inventory.save();

    await logInventoryActivity({
      companyId,
      inventoryId: inventory._id,
      changedBy: user._id,
      role: user.role,
      actionType: INVENTORY_ACTIVITY_ACTIONS.REQUEST_APPROVED_UPDATE,
      oldValue: diff.oldValue,
      newValue: diff.newValue,
      requestId: request._id,
    });
  } else {
    throw createHttpError(400, "Unsupported request type");
  }

  request.status = REQUEST_STATUS_APPROVED;
  request.reviewedBy = user._id;
  request.reviewedAt = new Date();
  request.rejectionReason = "";
  await request.save();

  notifyRequestReviewed({
    io,
    request,
    inventory,
  });

  return {
    request: await applyRequestPopulates(InventoryRequest.findById(request._id)),
    inventory: inventory
      ? await applyInventoryPopulates(Inventory.findById(inventory._id))
      : null,
  };
};

const rejectRequest = async ({ user, requestId, rejectionReason, io }) => {
  if (user.role !== USER_ROLES.ADMIN) {
    throw createHttpError(403, "Only ADMIN can reject requests");
  }

  if (!isValidObjectId(requestId)) {
    throw createHttpError(400, "Invalid request id");
  }

  const reason = sanitizeString(rejectionReason);
  if (!reason) {
    throw createHttpError(400, "rejectionReason is required");
  }

  const companyId = getCompanyIdForUser(user);
  const request = await InventoryRequest.findOne({
    _id: requestId,
    companyId,
    status: REQUEST_STATUS_PENDING,
  });

  if (!request) {
    throw createHttpError(404, "Pending request not found");
  }

  request.status = REQUEST_STATUS_REJECTED;
  request.reviewedBy = user._id;
  request.reviewedAt = new Date();
  request.rejectionReason = reason;
  await request.save();

  notifyRequestReviewed({
    io,
    request,
    inventory: null,
  });

  return applyRequestPopulates(InventoryRequest.findById(request._id));
};

const getMyRequests = async ({ user }) => {
  const companyId = getCompanyIdForUser(user);
  return applyRequestPopulates(
    InventoryRequest.find({
      requestedBy: user._id,
      companyId,
    }).sort({ createdAt: -1 }),
  );
};

const getInventoryActivities = async ({ user, inventoryId, limit = 100 }) => {
  if (![USER_ROLES.ADMIN, USER_ROLES.MANAGER].includes(user.role)) {
    throw createHttpError(403, "Only ADMIN/MANAGER can view activity logs");
  }

  if (!isValidObjectId(inventoryId)) {
    throw createHttpError(400, "Invalid inventory id");
  }

  const companyId = getCompanyIdForUser(user);
  const inventory = await getInventoryById({ user, inventoryId });

  const parsedLimit = Number.parseInt(limit, 10);
  const resolvedLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 500)
      : 100;

  return InventoryActivity.find({
    companyId,
    inventoryId: inventory._id,
  })
    .sort({ timestamp: -1 })
    .limit(resolvedLimit)
    .populate("changedBy", "name role")
    .lean();
};

module.exports = {
  createHttpError,
  getInventoryList,
  getInventoryById,
  createInventoryDirect,
  updateInventoryDirect,
  deleteInventoryDirect,
  bulkCreateInventoryDirect,
  createInventoryCreateRequest,
  createInventoryUpdateRequest,
  getPendingRequests,
  preApproveRequestByManager,
  approveRequest,
  rejectRequest,
  getMyRequests,
  getInventoryActivities,
};
