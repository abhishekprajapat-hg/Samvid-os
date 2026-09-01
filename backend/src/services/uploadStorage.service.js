const crypto = require("crypto");

let testStorageAdapter = null;

const trim = (value) => String(value || "").trim();

const parseCloudinaryUrl = (value) => {
  const raw = trim(value);
  if (!raw) return {};

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "cloudinary:") return {};
    return {
      apiKey: decodeURIComponent(parsed.username || ""),
      apiSecret: decodeURIComponent(parsed.password || ""),
      cloudName: parsed.hostname,
    };
  } catch (_error) {
    return {};
  }
};

const resolveCloudinaryConfig = () => {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  return {
    cloudName: trim(process.env.CLOUDINARY_CLOUD_NAME) || fromUrl.cloudName || "",
    apiKey: trim(process.env.CLOUDINARY_API_KEY) || fromUrl.apiKey || "",
    apiSecret: trim(process.env.CLOUDINARY_API_SECRET) || fromUrl.apiSecret || "",
    folder: trim(process.env.CLOUDINARY_UPLOAD_FOLDER || process.env.UPLOAD_STORAGE_FOLDER)
      || "samvid-os/uploads",
  };
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizePublicIdPart = (value) =>
  trim(value)
    .replace(/[^A-Za-z0-9._/-]/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 180);

const resolveResourceType = (mimeType) => {
  const normalized = trim(mimeType).toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "video";
  return "raw";
};

const buildCloudinarySignature = ({ params, apiSecret }) => {
  const signable = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && trim(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${signable}${apiSecret}`)
    .digest("hex");
};

const uploadWithCloudinary = async ({
  buffer,
  fileName,
  mimeType,
  size,
  tenantId,
  userId,
}) => {
  const config = resolveCloudinaryConfig();
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw createHttpError(503, "Upload storage is not configured");
  }

  if (typeof fetch !== "function") {
    throw createHttpError(503, "Upload storage transport is not available");
  }

  const resourceType = resolveResourceType(mimeType);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicIdBase = normalizePublicIdPart(fileName.replace(/\.[^.]+$/, "")) || "attachment";
  const folder = [
    normalizePublicIdPart(config.folder),
    normalizePublicIdPart(tenantId),
    normalizePublicIdPart(userId),
  ].filter(Boolean).join("/");

  const params = {
    folder,
    public_id: `${Date.now()}-${publicIdBase}`,
    timestamp,
    use_filename: "false",
    unique_filename: "true",
  };
  const signature = buildCloudinarySignature({
    params,
    apiSecret: config.apiSecret,
  });

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("api_key", config.apiKey);
  formData.append("signature", signature);
  Object.entries(params).forEach(([key, value]) => formData.append(key, value));

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`;
  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = trim(payload?.error?.message || payload?.message)
      || "Upload storage provider rejected the file";
    throw createHttpError(response.status >= 500 ? 503 : 500, message);
  }

  const fileUrl = trim(payload.secure_url || payload.url);
  const storagePath = trim(payload.public_id);
  if (!fileUrl || !storagePath) {
    throw createHttpError(500, "Upload storage provider returned an invalid response");
  }

  return {
    fileName,
    fileUrl,
    mimeType,
    size: Number(payload.bytes || size) || size,
    storagePath,
  };
};

const getStorageAdapter = () => {
  if (testStorageAdapter) return testStorageAdapter;
  return {
    upload: uploadWithCloudinary,
  };
};

const uploadAttachment = async (input) => getStorageAdapter().upload(input);

const __setStorageAdapterForTests = (adapter) => {
  testStorageAdapter = adapter;
};

module.exports = {
  __setStorageAdapterForTests,
  uploadAttachment,
};
