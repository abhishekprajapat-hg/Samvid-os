const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { writeLimiter } = require("../middleware/rateLimit.middleware");

router.get(
  "/",
  authMiddleware.protect,
  userController.getUsers
);

router.post(
  "/create",
  writeLimiter,
  authMiddleware.protect,
  userController.createUserByRole
);

router.get(
  "/my-team",
  authMiddleware.protect,
  userController.getMyTeam
);

router.get(
  "/profile",
  authMiddleware.protect,
  userController.getMyProfile
);

router.get(
  "/:userId/profile",
  authMiddleware.protect,
  userController.getUserProfileForAdmin
);

router.patch(
  "/profile",
  writeLimiter,
  authMiddleware.protect,
  userController.updateMyProfile
);

router.patch(
  "/location",
  authMiddleware.protect,
  userController.updateMyLocation
);

router.get(
  "/field-locations",
  authMiddleware.protect,
  userController.getFieldExecutiveLocations
);

router.post(
  "/rebalance-executives",
  writeLimiter,
  authMiddleware.protect,
  userController.rebalanceExecutives
);

router.delete(
  "/:userId",
  writeLimiter,
  authMiddleware.protect,
  userController.deleteUser
);

module.exports = router;
