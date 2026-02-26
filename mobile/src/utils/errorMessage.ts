const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const normalizeMessage = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const merged = value.map((item) => normalizeMessage(item)).filter(Boolean).join(", ");
    return merged || "";
  }

  if (value && typeof value === "object") {
    const maybeMessage = (value as { message?: string }).message;
    const maybeError = (value as { error?: string }).error;

    if (typeof maybeMessage === "string") return maybeMessage;
    if (typeof maybeError === "string") return maybeError;

    return safeStringify(value);
  }

  try {
    return String(value ?? "");
  } catch {
    return "";
  }
};

export const toErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  const apiMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  const directMessage = (error as { message?: unknown })?.message;
  const resolved = normalizeMessage(apiMessage) || normalizeMessage(directMessage);
  return resolved || fallback;
};