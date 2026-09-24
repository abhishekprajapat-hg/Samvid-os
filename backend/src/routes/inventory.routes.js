const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventory.controller");
const authMiddleware = require("../middleware/auth.middleware");
const companyMiddleware = require("../middleware/company.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const {
  requirePageAccess,
  requirePageActionForMethod,
  checkRoleOrPageAccess,
  checkRoleOrPageAction,
} = require("../middleware/pageAccess.middleware");

router.use(authMiddleware.protect);
router.use(
  checkRoleOrPageAccess(
    ["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"],
    "inventory",
  ),
);
router.use(companyMiddleware.requireCompanyContext);
router.use(requirePageAccess("inventory"));
router.use(requirePageActionForMethod("inventory"));

router.get("/", inventoryController.getInventory);
router.get(
  "/:id/activity",
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "view", "inventory"),
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
  checkRoleOrPageAction([
    "ADMIN",
    "MANAGER",
    "EXECUTIVE",
    "FIELD_EXECUTIVE",
    "CHANNEL_PARTNER",
  ], "create", "inventory"),
  inventoryController.createInventory,
);

router.post(
  "/bulk",
  writeLimiter,
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "create", "inventory"),
  inventoryController.bulkUploadInventory,
);

router.patch(
  "/:id",
  writeLimiter,
  checkRoleOrPageAction(["ADMIN", "MANAGER"], "edit", "inventory"),
  inventoryController.updateInventory,
);

router.delete(
  "/:id",
  writeLimiter,
  checkRoleOrPageAction(["ADMIN"], "delete", "inventory"),
  inventoryController.deleteInventory,
);

module.exports = router;
