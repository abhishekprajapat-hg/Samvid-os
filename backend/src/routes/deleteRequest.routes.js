const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const {
  listDeleteRequests,
  approveDeleteRequest,
  rejectDeleteRequest,
  cancelDeleteRequest,
} = require("../services/deleteApproval.service");

/*
 * Delete requests raised by Managers (see services/deleteApproval.service.js).
 *   GET  /                 Admin: every request in the company; others: their own
 *   POST /:id/approve      Admin only - runs the delete
 *   POST /:id/reject       Admin only
 *   POST /:id/cancel       the person who asked, while it is pending
 */
router.use(authMiddleware.protect);
router.use(companyMiddleware.requireCompanyContext);

const sendError = (req, res, error, fallback) => {
  if (!error.statusCode) req.log?.error?.({ error: error.message }, fallback);
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : fallback,
  });
};

router.get("/", async (req, res) => {
  try {
    const requests = await listDeleteRequests({ user: req.user, status: req.query.status || "PENDING" });
    return res.json({ count: requests.length, requests });
  } catch (error) {
    return sendError(req, res, error, "Unable to load delete requests");
  }
});

router.post("/:requestId/approve", writeLimiter, async (req, res) => {
  try {
    const request = await approveDeleteRequest({
      req,
      requestId: req.params.requestId,
      note: req.body?.note || req.body?.reviewNote,
    });
    return res.json({
      message: request.status === "APPROVED"
        ? `${request.entityLabel || "Record"} deleted`
        : "The record was already gone; request closed",
      request,
    });
  } catch (error) {
    return sendError(req, res, error, "Unable to approve the delete request");
  }
});

router.post("/:requestId/reject", writeLimiter, async (req, res) => {
  try {
    const request = await rejectDeleteRequest({
      req,
      requestId: req.params.requestId,
      note: req.body?.note || req.body?.reviewNote,
    });
    return res.json({ message: "Delete request rejected", request });
  } catch (error) {
    return sendError(req, res, error, "Unable to reject the delete request");
  }
});

router.post("/:requestId/cancel", writeLimiter, async (req, res) => {
  try {
    const request = await cancelDeleteRequest({ req, requestId: req.params.requestId });
    return res.json({ message: "Delete request cancelled", request });
  } catch (error) {
    return sendError(req, res, error, "Unable to cancel the delete request");
  }
});

module.exports = router;
