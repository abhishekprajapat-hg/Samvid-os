const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventory.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");

router.use(authMiddleware.protect);
router.use(
  authMiddleware.checkRole(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]),
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
  "/",
  authMiddleware.checkRole(["ADMIN"]),
  inventoryController.createInventory,
);

router.post(
  "/bulk",
  authMiddleware.checkRole(["ADMIN"]),
  inventoryController.bulkUploadInventory,
);

router.patch(
  "/:id",
  authMiddleware.checkRole(["ADMIN"]),
  inventoryController.updateInventory,
);

router.delete(
  "/:id",
  authMiddleware.checkRole(["ADMIN"]),
  inventoryController.deleteInventory,
);

module.exports = router;
