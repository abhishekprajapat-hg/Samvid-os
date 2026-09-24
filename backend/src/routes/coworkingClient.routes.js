const express = require("express");
const router = express.Router();

const clientController = require("../controllers/coworkingClient.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("clients.view"), clientController.listClients);
router.get("/birthdays", requirePermission("clients.view"), async (req, res) => {
 try {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const anchor = new Date(`${today}T12:00:00Z`);
  const dates = Array.from({ length: 8 }, (_, i) => new Date(anchor.getTime() + i * 86400000).toISOString().slice(5, 10));
  const clients = await require("../models/CoworkingClient").find({ companyId: req.user.companyId, dateOfBirth: { $ne: null }, $expr: { $in: [{ $dateToString: { format: "%m-%d", date: "$dateOfBirth", onNull: "" } }, dates] } }).select("_id companyName contactPerson dateOfBirth").limit(200).lean();
  res.json({ clients });
 } catch (error) { req.log?.error(error); res.status(500).json({ message: "Could not load birthdays" }); }
});
router.get("/:clientId", requirePermission("clients.view"), clientController.getClient);
router.get("/:clientId/assignments", requirePermission("clients.view"), clientController.getAssignments);
router.get("/:clientId/activity", requirePermission("clients.view"), clientController.getActivity);

router.post("/", writeLimiter, requirePermission("clients.create"), clientController.createClient);
router.patch("/:clientId", writeLimiter, requirePermission("clients.update"), clientController.updateClient);
router.delete("/:clientId", writeLimiter, requirePermission("clients.delete"), clientController.deleteClient);

router.post(
  "/:clientId/contacts",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.addContact,
);
router.delete(
  "/:clientId/contacts/:contactId",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.removeContact,
);

router.post(
  "/:clientId/documents",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.addDocument,
);
router.delete(
  "/:clientId/documents/:documentId",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.removeDocument,
);

// Client portal login management — separate credential system, see
// clientPortalAuth.service.js.
router.get(
  "/:clientId/portal-users",
  requirePermission("clients.update"),
  clientController.listPortalUsers,
);
router.post(
  "/:clientId/portal-users",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.createPortalUser,
);
router.patch(
  "/:clientId/portal-users/:portalUserId/active",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.setPortalUserActive,
);
router.post(
  "/:clientId/portal-users/:portalUserId/reset-password",
  writeLimiter,
  requirePermission("clients.update"),
  clientController.resetPortalUserPassword,
);

module.exports = router;
