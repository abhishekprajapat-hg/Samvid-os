const path = require("path");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_UPLOAD_SIZE_BYTES =
  Number.parseInt(process.env.CHAT_UPLOAD_MAX_BYTES, 10) || 25 * 1024 * 1024;

const sanitizeFileName = (value) => {
  const baseName = path.basename(String(value || "upload"));
  return baseName
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "upload";
};

const hasDangerousSignature = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  const head = buffer.subarray(0, 256);
  const asciiHead = head.toString("utf8").toLowerCase();
  return (
    head[0] === 0x4d && head[1] === 0x5a
  ) || (
    head[0] === 0x23 && head[1] === 0x21
  ) || asciiHead.includes("<script") || asciiHead.includes("<?php");
};

exports.handleChatUpload = async (req, res) => {
  const file = req.file || null;
  if (!file) {
    return res.status(400).json({ message: "File is required" });
  }

  if (!ALLOWED_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
    return res.status(400).json({ message: "Unsupported file type" });
  }

  if (Number(file.size || 0) <= 0 || Number(file.size || 0) > MAX_UPLOAD_SIZE_BYTES) {
    return res.status(400).json({ message: "File size is invalid" });
  }

  if (hasDangerousSignature(file.buffer)) {
    return res.status(400).json({ message: "File signature is not allowed" });
  }

  const publicBaseUrl = String(process.env.UPLOAD_PUBLIC_BASE_URL || "").trim();
  if (!publicBaseUrl) {
    return res.status(501).json({
      message: "Durable upload storage is not configured",
      storageConfigured: false,
    });
  }

  return res.status(501).json({
    message: "Durable upload storage adapter is not configured",
    storageConfigured: false,
    fileName: sanitizeFileName(file.originalname),
  });
};
