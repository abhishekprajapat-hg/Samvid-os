const express = require("express");
const router = express.Router();

const cabinController = require("../controllers/coworkingCabin.controller");
const { requirePermission } = require("../middleware/permission.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get("/", requirePermission("cabins.view"), cabinController.listCabins);
router.get("/floor-view", requirePermission("cabins.view"), cabinController.getFloorView);
router.get("/:cabinId", requirePermission("cabins.view"), cabinController.getCabin);
router.post("/", writeLimiter, requirePermission("cabins.create"), cabinController.createCabin);
router.patch("/:cabinId", writeLimiter, requirePermission("cabins.update"), cabinController.updateCabin);
router.delete("/:cabinId", writeLimiter, requirePermission("cabins.delete"), cabinController.deleteCabin);

router.post("/:cabinId/block", writeLimiter, requirePermission("cabins.block"), cabinController.blockCabin);
router.post("/:cabinId/unblock", writeLimiter, requirePermission("cabins.block"), cabinController.unblockCabin);
router.post(
  "/:cabinId/maintenance",
  writeLimiter,
  requirePermission("cabins.update"),
  cabinController.setCabinMaintenance,
);
router.post(
  "/:cabinId/maintenance/clear",
  writeLimiter,
  requirePermission("cabins.update"),
  cabinController.clearCabinMaintenance,
);

// Seat sub-resource — the permission catalog only defines seats.view/assign/
// release; blocking/maintenance on a seat reuses cabins.block since it's the
// same operator-level capability and no dedicated permission was specified.
router.post(
  "/:cabinId/seats/:seatCode/assign",
  writeLimiter,
  requirePermission("seats.assign"),
  cabinController.assignSeat,
);
router.post(
  "/:cabinId/seats/:seatCode/release",
  writeLimiter,
  requirePermission("seats.release"),
  cabinController.releaseSeat,
);
router.post(
  "/:cabinId/seats/:seatCode/block",
  writeLimiter,
  requirePermission("cabins.block"),
  cabinController.blockSeat,
);
router.post(
  "/:cabinId/seats/:seatCode/unblock",
  writeLimiter,
  requirePermission("cabins.block"),
  cabinController.unblockSeat,
);
router.post(
  "/:cabinId/seats/:seatCode/maintenance",
  writeLimiter,
  requirePermission("cabins.block"),
  cabinController.setSeatMaintenance,
);
router.post(
  "/:cabinId/seats/:seatCode/maintenance/clear",
  writeLimiter,
  requirePermission("cabins.block"),
  cabinController.clearSeatMaintenance,
);

module.exports = router;
