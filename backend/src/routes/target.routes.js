const express = require("express");

const router = express.Router();
const targetController = require("../controllers/target.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");
const { requirePageAccess, requirePageActionForMethod } = require("../middleware/pageAccess.middleware");

router.use(authMiddleware.protect);
router.use(requirePageAccess("targets"));
router.use(requirePageActionForMethod("targets"));

router.get(
  "/my",
  targetController.getMyTargets,
);

router.post(
  "/assign",
  writeLimiter,
  targetController.assignTarget,
);

module.exports = router;
