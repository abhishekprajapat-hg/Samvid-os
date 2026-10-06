const express = require("express");
const router = express.Router();

const propertyController = require("../controllers/coworkingProperty.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const CoworkingProperty = require("../models/CoworkingProperty");
const { requireAdminApprovalForDelete, describeByModel } = require("../services/deleteApproval.service");

// Parent router (coworkingAccess.routes.js) already applies protect,
// checkRole(COWORKING_ACCESS_ROLES) and requireCompanyContext before this
// mounts — only permission checks are needed here.

router.get("/", requirePermission("properties.view"), propertyController.listProperties);
router.get("/:propertyId", requirePermission("properties.view"), propertyController.getProperty);
router.post("/", writeLimiter, requirePermission("properties.create"), propertyController.createProperty);
router.patch("/:propertyId", writeLimiter, requirePermission("properties.update"), propertyController.updateProperty);
router.delete(
  "/:propertyId",
  writeLimiter,
  requirePermission("properties.delete"),
  // A Manager's delete becomes a request an Admin approves.
  requireAdminApprovalForDelete("coworking_property", {
    label: "Coworking property",
    pageKey: "coworking_booking",
    idParam: "propertyId",
    handler: propertyController.deleteProperty,
    describe: describeByModel(CoworkingProperty, ["name"]),
  }),
  propertyController.deleteProperty,
);

module.exports = router;
