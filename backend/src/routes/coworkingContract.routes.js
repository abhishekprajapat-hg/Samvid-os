const express = require("express");
const router = express.Router();

const contractController = require("../controllers/coworkingContract.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("contracts.view"), contractController.listContracts);
router.get("/:contractId", requirePermission("contracts.view"), contractController.getContract);

router.post("/", writeLimiter, requirePermission("contracts.create"), contractController.createContract);
router.patch("/:contractId", writeLimiter, requirePermission("contracts.update"), contractController.updateContract);

router.post("/:contractId/activate", writeLimiter, requirePermission("contracts.update"), contractController.activateContract);
router.post("/:contractId/terminate", writeLimiter, requirePermission("contracts.update"), contractController.terminateContract);
router.post("/:contractId/renew", writeLimiter, requirePermission("contracts.renew"), contractController.renewContract);

router.post("/:contractId/documents", writeLimiter, requirePermission("contracts.update"), contractController.addDocument);
router.delete("/:contractId/documents/:documentId", writeLimiter, requirePermission("contracts.update"), contractController.removeDocument);

module.exports = router;
