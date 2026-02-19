const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get(
  "/",
  authMiddleware.protect,
  userController.getUsers
);

router.post(
  "/create",
  authMiddleware.protect,
  userController.createUserByRole
);

router.get(
  "/my-team",
  authMiddleware.protect,
  userController.getMyTeam
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
  authMiddleware.protect,
  userController.rebalanceExecutives
);

router.delete(
  "/:userId",
  authMiddleware.protect,
  userController.deleteUser
);

module.exports = router;
