const express = require("express");

const { protect } = require("../middleware/auth.middleware");
const clientController = require("../controllers/client.controller");

const router = express.Router();

// Centralized API namespace used by both web and mobile clients.
router.get("/health", clientController.health);
router.get("/bootstrap", protect, clientController.bootstrap);

router.use("/auth", require("./auth.routes"));
router.use("/leads", require("./lead.routes"));
router.use("/users", require("./user.routes"));
router.use("/attendance", require("./attendance.routes"));
router.use("/targets", require("./target.routes"));
router.use("/inventory", require("./inventory.routes"));
router.use("/inventory-request", require("./inventoryRequest.routes"));
router.use("/projects", require("./project.routes"));
router.use("/uploads", require("./upload.routes"));
router.use("/webhook", require("./webhook.routes"));
router.use("/chat", require("./chat.routes"));
router.use("/saas", require("./saas.routes"));
router.use("/contacts", require("./crmContact.routes"));
router.use("/push", require("./push.routes"));
router.use("/tasks", require("./task.routes"));
router.use("/coworking", require("./coworkingAccess.routes"));
router.use("/access", require("./accessControl.routes"));

module.exports = router;
