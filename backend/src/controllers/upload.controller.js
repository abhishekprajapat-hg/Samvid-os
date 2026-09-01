const path = require("path");
const { uploadAttachment } = require("../services/uploadStorage.service");

const MAX_UPLOAD_SIZE_BYTES =
  Number.parseInt(process.env.CHAT_UPLOAD_MAX_BYTES, 10) || 25 * 1024 * 1024;

const DANGEROUS_EXTENSIONS = new Set([
  ".app",
  ".bat",
  ".cmd",
  ".com",
  ".dll",
  ".exe",
  ".hta",
  ".jar",
  ".js",
  ".mjs",
  ".msi",
  ".php",
  ".ps1",
  ".scr",
  ".sh",
  ".vb",
  ".vbs",
  ".wsf",
]);

const ALLOWED_TYPES = new Map([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/webp", new Set([".webp"])],
  ["image/heic", new Set([".heic", ".heif"])],
  ["image/heif", new Set([".heic", ".heif"])],
  ["application/pdf", new Set([".pdf"])],
  ["audio/mpeg", new Set([".mp3"])],
  ["audio/mp3", new Set([".mp3"])],
  ["audio/mp4", new Set([".m4a", ".mp4"])],
  ["audio/m4a", new Set([".m4a"])],
  ["audio/aac", new Set([".aac"])],
  ["audio/ogg", new Set([".ogg"])],
  ["audio/wav", new Set([".wav"])],
  ["audio/x-wav", new Set([".wav"])],
  ["video/mp4", new Set([".mp4"])],
]);

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sanitizeFileName = (value) => {
  const baseName = path.basename(String(value || "attachment"));
  const cleaned = baseName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return cleaned || "attachment";
};

const getExtension = (fileName) => path.extname(fileName).toLowerCase();

const hasDangerousContent = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  const head = buffer.subarray(0, 1024);
  const asciiHead = head.toString("utf8").toLowerCase();
  return (
    (head[0] === 0x4d && head[1] === 0x5a)
    || (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46)
    || (head[0] === 0x23 && head[1] === 0x21)
    || asciiHead.includes("<script")
    || asciiHead.includes("<?php")
    || asciiHead.includes("<html")
  );
};

const hasBoxBrand = (buffer, brands) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const brandWindow = buffer.subarray(8, Math.min(buffer.length, 48)).toString("ascii");
  return brands.some((brand) => brandWindow.includes(brand));
};

const matchesMagicBytes = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "image/png") {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer.toString("ascii", 1, 4) === "PNG"
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a;
  }
  if (mime === "image/webp") {
    return buffer.length >= 12
      && buffer.toString("ascii", 0, 4) === "RIFF"
      && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  if (mime === "image/heic" || mime === "image/heif") {
    return hasBoxBrand(buffer, ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
  }
  if (mime === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mime === "video/mp4" || mime === "audio/mp4" || mime === "audio/m4a") {
    return hasBoxBrand(buffer, ["isom", "iso2", "mp41", "mp42", "M4A ", "M4B ", "mp4"]);
  }
  if (mime === "audio/mpeg" || mime === "audio/mp3") {
    return buffer.subarray(0, 3).toString("ascii") === "ID3"
      || (buffer[0] === 0xff && [0xfb, 0xf3, 0xf2].includes(buffer[1]));
  }
  if (mime === "audio/aac") {
    return buffer[0] === 0xff && [0xf1, 0xf9].includes(buffer[1]);
  }
  if (mime === "audio/ogg") {
    return buffer.subarray(0, 4).toString("ascii") === "OggS";
  }
  if (mime === "audio/wav" || mime === "audio/x-wav") {
    return buffer.length >= 12
      && buffer.toString("ascii", 0, 4) === "RIFF"
      && buffer.toString("ascii", 8, 12) === "WAVE";
  }
  return false;
};

const validateUploadFile = (file) => {
  if (!file) {
    throw createHttpError(400, "File is required");
  }

  const size = Number(file.size || 0);
  if (!Number.isFinite(size) || size <= 0 || !Buffer.isBuffer(file.buffer) || file.buffer.length <= 0) {
    throw createHttpError(400, "File is empty");
  }
  if (size > MAX_UPLOAD_SIZE_BYTES) {
    throw createHttpError(413, "File size exceeds the upload limit");
  }

  const fileName = sanitizeFileName(file.originalname);
  const extension = getExtension(fileName);
  if (!extension || DANGEROUS_EXTENSIONS.has(extension)) {
    throw createHttpError(415, "Unsupported file extension");
  }

  const mimeType = String(file.mimetype || "").trim().toLowerCase();
  const allowedExtensions = ALLOWED_TYPES.get(mimeType);
  if (!allowedExtensions || !allowedExtensions.has(extension)) {
    throw createHttpError(415, "Unsupported file type");
  }

  if (hasDangerousContent(file.buffer)) {
    throw createHttpError(415, "File signature is not allowed");
  }

  if (!matchesMagicBytes(file.buffer, mimeType)) {
    throw createHttpError(415, "File contents do not match the declared type");
  }

  return {
    buffer: file.buffer,
    fileName,
    mimeType,
    size,
  };
};

exports.handleChatUpload = async (req, res) => {
  try {
    const validated = validateUploadFile(req.file || null);
    const tenantId = String(req.user?.companyId || req.user?._id || "").trim();
    const userId = String(req.user?._id || "").trim();

    if (!tenantId || !userId) {
      return res.status(403).json({ message: "Tenant context is required for uploads" });
    }

    const uploaded = await uploadAttachment({
      ...validated,
      tenantId,
      userId,
    });

    return res.status(201).json({
      attachment: {
        fileName: String(uploaded.fileName || validated.fileName),
        fileUrl: String(uploaded.fileUrl || ""),
        mimeType: String(uploaded.mimeType || validated.mimeType),
        size: Number(uploaded.size || validated.size) || validated.size,
        storagePath: String(uploaded.storagePath || ""),
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.status || 500);
    const controlledStatus = [400, 413, 415, 500, 503].includes(statusCode)
      ? statusCode
      : 500;
    return res.status(controlledStatus).json({
      message: controlledStatus === 500 ? "File upload failed" : error.message,
      requestId: req.requestId || null,
    });
  }
};

exports._private = {
  sanitizeFileName,
  validateUploadFile,
};
