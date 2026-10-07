import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import api from "./api";

/*
 * Mirrors frontend/src/services/uploadService.js, but the picking half has no
 * web counterpart: a browser hands you a File, Expo hands you a URI, and RN's
 * FormData needs { uri, name, type } instead.
 *
 * The allowlist below is the client-side half of
 * backend/src/config/uploadStorage.js. The server checks the declared MIME type
 * *and* the extension and is the real gate; checking here just means a 25 MB
 * video fails in a dialog instead of after a two-minute upload on mobile data.
 */

export const UPLOAD_CATEGORIES = [
  "inventory-images",
  "inventory-floorplans",
  "inventory-documents",
  "chat",
  "lead-documents",
  "profile-images",
  /* Web uploads project photos under this name. The server has no such
     category and files them under its default, exactly as it does for web. */
  "project-images",
] as const;

export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

// backend/src/config/uploadStorage.js: UPLOAD_MAX_FILE_SIZE_BYTES, default 25 MB.
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
  ".mp4", ".mov", ".webm",
  ".mp3", ".m4a", ".wav", ".aac", ".ogg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
]);

const EXTENSION_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic", ".heif": "image/heif",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
  ".aac": "audio/aac", ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
};

export type UploadedFile = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const extensionOf = (name: string) => {
  const match = /\.[a-z0-9]+$/i.exec(String(name || "").trim());
  return match ? match[0].toLowerCase() : "";
};

/*
 * Android content:// URIs frequently arrive with no usable filename, and the
 * server rejects anything whose extension it does not recognise - so an
 * extension is derived from the MIME type rather than letting the upload fail.
 */
const ensureFileName = (name: string, mimeType: string) => {
  const trimmed = String(name || "").trim();
  if (trimmed && extensionOf(trimmed)) return trimmed;

  const fallbackExtension =
    Object.entries(EXTENSION_MIME).find(([, type]) => type === mimeType)?.[0] || ".jpg";
  return `${trimmed || `upload-${Date.now()}`}${fallbackExtension}`;
};

export const validateFile = (file: PickedFile): string | null => {
  const extension = extensionOf(file.name);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return "That file type is not supported.";
  }
  if (typeof file.size === "number" && file.size > MAX_FILE_SIZE_BYTES) {
    const limitMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return `That file is larger than the ${limitMb} MB limit.`;
  }
  return null;
};

/* ---------------------------------------------------------------- pickers -- */

export const pickImageFromLibrary = async (): Promise<PickedFile | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  return toPickedFile(result.assets[0]);
};

export const takePhoto = async (): Promise<PickedFile | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false });
  if (result.canceled || !result.assets?.length) return null;

  return toPickedFile(result.assets[0]);
};

export const pickDocument = async (): Promise<PickedFile | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType || EXTENSION_MIME[extensionOf(asset.name)] || "application/octet-stream";
  return {
    uri: asset.uri,
    name: ensureFileName(asset.name, mimeType),
    mimeType,
    size: asset.size ?? null,
  };
};

const toPickedFile = (asset: ImagePicker.ImagePickerAsset): PickedFile => {
  const mimeType = asset.mimeType || EXTENSION_MIME[extensionOf(asset.fileName || "")] || "image/jpeg";
  return {
    uri: asset.uri,
    name: ensureFileName(asset.fileName || "", mimeType),
    mimeType,
    size: asset.fileSize ?? null,
  };
};

/* ---------------------------------------------------------------- upload -- */

export const uploadFile = async (
  file: PickedFile,
  category: UploadCategory = "chat",
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> => {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const form = new FormData();
  // RN's FormData takes this shape, not a Blob. The cast is required because
  // the DOM lib's typing does not describe it.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const res = await api.post("/uploads", form, {
    params: { category },
    headers: { "Content-Type": "multipart/form-data" },
    // A photo over mobile data can legitimately outlast the default timeout.
    timeout: 120000,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.min(1, event.loaded / event.total));
    },
  });

  return {
    url: String(res.data?.url || ""),
    fileName: String(res.data?.fileName || file.name),
    mimeType: String(res.data?.mimeType || file.mimeType),
    size: Number(res.data?.size || file.size || 0),
  };
};

export const uploadFiles = async (
  files: PickedFile[],
  category: UploadCategory = "chat",
): Promise<UploadedFile[]> => {
  const uploaded: UploadedFile[] = [];
  // Sequential on purpose: several large uploads in parallel over mobile data
  // stall each other and make progress meaningless.
  for (const file of files) {
    uploaded.push(await uploadFile(file, category));
  }
  return uploaded;
};

/*
 * The API stores relative URLs so they stay portable across environments, which
 * a browser resolves for free and a native app does not.
 */
export const toAbsoluteUrl = (url: string): string => {
  const value = String(url || "").trim();
  if (!value || /^https?:\/\//i.test(value)) return value;

  const base = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};
