const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_CATEGORIES = Object.freeze([
  "inventory-images",
  "inventory-floorplans",
  "inventory-documents",
  "chat",
  "lead-documents",
  "profile-images",
]);
const DEFAULT_CATEGORY = "chat";

const uploadsRootDir = path.isAbsolute(process.env.UPLOAD_DIR || "")
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, "..", "..", String(process.env.UPLOAD_DIR || "uploads"));

const maxFileSizeBytes = Number.parseInt(process.env.UPLOAD_MAX_FILE_SIZE_BYTES, 10) || 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/aac",
  "audio/ogg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const sanitizeCategory = (value) => {
  const category = String(value || "").trim().toLowerCase();
  return UPLOAD_CATEGORIES.includes(category) ? category : DEFAULT_CATEGORY;
};

const sanitizeExtension = (originalName) => {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
};

const ensureCategoryDirs = () => {
  UPLOAD_CATEGORIES.forEach((category) => {
    fs.mkdirSync(path.join(uploadsRootDir, category), { recursive: true });
  });
};

ensureCategoryDirs();

const storage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const category = sanitizeCategory(req.query.category || req.body?.category);
    req.uploadCategory = category;
    callback(null, path.join(uploadsRootDir, category));
  },
  filename: (_req, file, callback) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${sanitizeExtension(file.originalname)}`;
    callback(null, uniqueName);
  },
});

const fileFilter = (_req, file, callback) => {
  if (!ALLOWED_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
    callback(new Error(`Unsupported file type: ${file.mimetype}`));
    return;
  }
  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxFileSizeBytes },
});

module.exports = {
  upload,
  uploadsRootDir,
  UPLOAD_CATEGORIES,
  maxFileSizeBytes,
};
