const multer = require("multer");

const maxFileSize =
  Number.parseInt(process.env.CHAT_UPLOAD_MAX_BYTES, 10) || 25 * 1024 * 1024;

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: maxFileSize,
  },
});

module.exports = {
  chatUpload,
};
