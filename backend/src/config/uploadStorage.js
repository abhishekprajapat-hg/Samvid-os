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

/*
 * "application/octet-stream" used to sit in this set. Because the MIME type
 * comes from the client, that one entry made the whole allowlist advisory: an
 * .html or .exe declared as octet-stream was accepted and then served back
 * under its own extension. Both the declared type and the file extension now
 * have to be recognised, and SVG is gone - it is a script-bearing document
 * dressed as an image.
 */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
  ".mp4", ".mov", ".webm",
  ".mp3", ".m4a", ".wav", ".aac", ".ogg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
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
  const mimeType = String(file.mimetype || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    callback(new Error(`Unsupported file type: ${file.mimetype}`));
    return;
  }

  // The extension is what the file is finally served as, so it has to be
  // allowed in its own right - "invoice.pdf.html" keeps only ".html".
  const ext = path.extname(String(file.originalname || "")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    callback(new Error(`Unsupported file extension: ${ext || "(none)"}`));
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
