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

const handleUploadError = (error, req, res, next) => {
  if (!error) return next();

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "File size exceeds the upload limit",
        requestId: req.requestId || null,
      });
    }
    return res.status(400).json({
      message: "Invalid file upload request",
      requestId: req.requestId || null,
    });
  }

  return next(error);
};

module.exports = {
  chatUpload,
  handleUploadError,
};
