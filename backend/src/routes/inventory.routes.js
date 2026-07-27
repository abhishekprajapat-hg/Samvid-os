const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventory.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.use(authMiddleware.protect);
router.use(
  authMiddleware.checkRole([
    "ADMIN",
    "MANAGER",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ]),
);
router.use(companyMiddleware.requireCompanyContext);

router.get("/", inventoryController.getInventory);
router.get(
  "/:id/activity",
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  inventoryController.getInventoryActivity,
);
router.get("/:id", inventoryController.getInventoryById);

router.post(
  "/:id/share",
  writeLimiter,
  inventoryController.createShareLink,
);

router.post(
  "/",
  writeLimiter,
  authMiddleware.checkRole([
    "ADMIN",
    "MANAGER",
    "INSIDE_EXECUTIVE",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ]),
  inventoryController.createInventory,
);

router.post(
  "/bulk",
  writeLimiter,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  inventoryController.bulkUploadInventory,
);

router.patch(
  "/:id",
  writeLimiter,
  authMiddleware.checkRole(["ADMIN", "MANAGER"]),
  inventoryController.updateInventory,
);

router.delete(
  "/:id",
  writeLimiter,
  authMiddleware.checkRole(["ADMIN"]),
  inventoryController.deleteInventory,
);

module.exports = router;
