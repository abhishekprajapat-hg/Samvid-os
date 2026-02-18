const {
  createInventoryCreateRequest,
  createInventoryUpdateRequest,
  getMyRequests,
} = require("../services/inventoryWorkflow.service");

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
      request,
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
      io: req.app.get("io"),
    });

    return res.status(201).json({
      message: "Inventory status change request submitted",
      request,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to submit update request");
  }
};

exports.getMyInventoryRequests = async (req, res) => {
  try {
    const requests = await getMyRequests({ user: req.user });
    return res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load your requests");
  }
};
