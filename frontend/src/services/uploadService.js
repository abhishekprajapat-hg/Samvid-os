import api from "./api";

const UPLOAD_TIMEOUT_MS = 45000;

export const uploadFile = async (file, category) => {
  const data = new FormData();
  data.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await api.post("/uploads", data, {
      params: { category },
      signal: controller.signal,
    });
    return res.data;
  } catch (error) {
    if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
      throw new Error(`Upload timed out for "${file.name}"`);
    }
    throw new Error(
      error.response?.data?.message || error.message || `Upload failed for "${file.name}"`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

export default { uploadFile };
