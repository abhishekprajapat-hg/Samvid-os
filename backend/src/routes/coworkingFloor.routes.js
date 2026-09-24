const express = require("express");
const router = express.Router();

const floorController = require("../controllers/coworkingFloor.controller");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

// No dedicated floors.* permission exists in the Phase 2 permission catalog —
// the coarse role check on the parent router (coworkingAccess.routes.js) is
// the only gate here, same as Phase 1's role-only /coworking/floors page.

router.get("/", floorController.listFloors);
router.get("/:floorId", floorController.getFloor);
router.post("/", writeLimiter, floorController.createFloor);
router.patch("/:floorId", writeLimiter, floorController.updateFloor);
router.delete("/:floorId", writeLimiter, floorController.deleteFloor);

module.exports = router;
