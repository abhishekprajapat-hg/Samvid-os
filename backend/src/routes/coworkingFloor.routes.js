const express = require("express");
const router = express.Router();

const floorController = require("../controllers/coworkingFloor.controller");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const CoworkingFloor = require("../models/CoworkingFloor");
const { requireAdminApprovalForDelete, describeByModel } = require("../services/deleteApproval.service");

// No dedicated floors.* permission exists in the Phase 2 permission catalog —
// the coarse role check on the parent router (coworkingAccess.routes.js) is
// the only gate here, same as Phase 1's role-only /coworking/floors page.

router.get("/", floorController.listFloors);
router.get("/:floorId", floorController.getFloor);
router.post("/", writeLimiter, floorController.createFloor);
router.patch("/:floorId", writeLimiter, floorController.updateFloor);
// Removing a floor removes part of a property, so it needs the property delete
// permission, and a Manager's delete becomes a request an Admin approves.
router.delete(
  "/:floorId",
  writeLimiter,
  requirePermission("properties.delete"),
  requireAdminApprovalForDelete("coworking_floor", {
    label: "Coworking floor",
    pageKey: "coworking_booking",
    idParam: "floorId",
    handler: floorController.deleteFloor,
    describe: describeByModel(CoworkingFloor, ["name"]),
  }),
  floorController.deleteFloor,
);

module.exports = router;
