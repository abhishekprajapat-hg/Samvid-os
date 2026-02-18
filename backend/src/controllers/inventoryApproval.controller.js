const {
  getPendingRequests,
  approveRequest,
  rejectRequest,
  preApproveRequestByManager,
} = require("../services/inventoryWorkflow.service");

const handleControllerError = (res, error, fallbackMessage) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    console.error(fallbackMessage, error);
  }

  return res.status(statusCode).json({ message });
};

exports.getPending = async (req, res) => {
  try {
    const requests = await getPendingRequests({ user: req.user });
    return res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to load pending requests");
  }
};

exports.preApprove = async (req, res) => {
  try {
    const request = await preApproveRequestByManager({
      user: req.user,
      requestId: req.params.id || req.params.requestId,
    });

    return res.json({
      message: "Request pre-approved by manager",
      request,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to pre-approve request");
  }
};

exports.approve = async (req, res) => {
  try {
    const result = await approveRequest({
      user: req.user,
      requestId: req.params.id || req.params.requestId,
      io: req.app.get("io"),
    });

    return res.json({
      message: "Request approved successfully",
      ...result,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to approve request");
  }
};

exports.reject = async (req, res) => {
  try {
    const request = await rejectRequest({
      user: req.user,
      requestId: req.params.id || req.params.requestId,
      rejectionReason: req.body?.rejectionReason,
      io: req.app.get("io"),
    });

    return res.json({
      message: "Request rejected successfully",
      request,
    });
  } catch (error) {
    return handleControllerError(res, error, "Failed to reject request");
  }
};
