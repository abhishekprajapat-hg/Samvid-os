const express = require("express");

const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { upload } = require("../config/uploadStorage");
const uploadController = require("../controllers/upload.controller");

router.use(protect);

router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message || "File upload failed." });
    }
    return next();
  });
}, uploadController.uploadFile);

module.exports = router;
