const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const normalizeMessage = (value) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const combined = value
      .map((item) => normalizeMessage(item))
      .filter(Boolean)
      .join(", ");
    return combined || "";
  }

  if (value && typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;

    const serialized = safeStringify(value);
    return serialized || "";
  }

  try {
    return String(value ?? "");
  } catch {
    return "";
  }
};

export const toErrorMessage = (error, fallback = "Something went wrong") => {
  const apiMessage = error?.response?.data?.message;
  const directMessage = error?.message;
  const resolved = normalizeMessage(apiMessage) || normalizeMessage(directMessage);
  return resolved || fallback;
};

