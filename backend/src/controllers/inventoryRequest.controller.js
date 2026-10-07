const {
  createInventoryCreateRequest,
  createInventoryDeleteRequest,
  createInventoryUpdateRequest,
  getMyRequests,
} = require("../services/inventoryWorkflow.service");

// Channel Partners never see the owner's or key manager's contact details on
// an existing property, including the copy attached to their own requests.
const CHANNEL_PARTNER_ROLE = "CHANNEL_PARTNER";
const PARTNER_HIDDEN_INVENTORY_FIELDS = [
  "ownerName",
  "ownerNumber",
  "ownerWhatsappNumber",
  "ownerType",
  "ownerContactId",
  "keyManagerName",
  "keyManagerNumber",
];

const toPartnerRequestView = (request) => {
  if (!request || typeof request !== "object") return request;
  const row =
    typeof request.toObject === "function" ? request.toObject() : { ...request };
  if (row.inventoryId && typeof row.inventoryId === "object") {
    const inventory =
      typeof row.inventoryId.toObject === "function"
        ? row.inventoryId.toObject()
        : { ...row.inventoryId };
    PARTNER_HIDDEN_INVENTORY_FIELDS.forEach((field) => delete inventory[field]);
    row.inventoryId = inventory;
  }
  return row;
};

const toRoleBasedRequest = (user, request) =>
  user?.role === CHANNEL_PARTNER_ROLE ? toPartnerRequestView(request) : request;

const handleControllerError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

exports.createRequest = async (req, res) => {
  try {
    const request = await createInventoryCreateRequest({
      user: req.user,
      payload: req.body?.proposedData || req.body?.proposedChanges || req.body,
      io: req.app.get("io"),
    });

    return res.status(201).json({
      message: "Inventory create request submitted",
      request: toRoleBasedRequest(req.user, request),
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to submit create request");
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const request = await createInventoryUpdateRequest({
      user: req.user,
      inventoryId: req.params.inventoryId,
      payload: req.body?.proposedData || req.body?.proposedChanges || req.body,
      requestNote: req.body?.requestNote,
      relatedLeadId: req.body?.relatedLeadId || req.body?.leadId,
      io: req.app.get("io"),
    });

    return res.status(201).json({
      message: "Inventory update request submitted",
      request: toRoleBasedRequest(req.user, request),
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to submit update request");
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    const request = await createInventoryDeleteRequest({
      user: req.user,
      inventoryId: req.params.inventoryId,
      requestNote: req.body?.requestNote || req.body?.reason,
      io: req.app.get("io"),
    });

    return res.status(201).json({
      message: "Inventory delete request submitted",
      request: toRoleBasedRequest(req.user, request),
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to submit delete request");
  }
};

exports.getMyInventoryRequests = async (req, res) => {
  try {
    const requests = await getMyRequests({ user: req.user });
    return res.json({
      count: requests.length,
      requests: requests.map((request) => toRoleBasedRequest(req.user, request)),
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load your requests");
  }
};
