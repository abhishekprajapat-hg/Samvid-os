export const SYSTEM_SETTINGS_STORAGE_KEY = "samvid.system.settings.v1";
export const SYSTEM_SETTINGS_UPDATED_EVENT = "samvid:system-settings-updated";

export const DEFAULT_SYSTEM_SETTINGS = {
  appearance: {
    compactTables: false,
    reduceMotion: false,
    highContrast: false,
  },
  security: {
    sessionTimeoutMinutes: "60",
  },
};

const sanitizeSessionTimeout = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SYSTEM_SETTINGS.security.sessionTimeoutMinutes;
  }
  return String(parsed);
};

export const normalizeSystemSettings = (raw = {}) => ({
  appearance: {
    compactTables: Boolean(raw?.appearance?.compactTables),
    reduceMotion: Boolean(raw?.appearance?.reduceMotion),
    highContrast: Boolean(raw?.appearance?.highContrast),
  },
  security: {
    sessionTimeoutMinutes: sanitizeSessionTimeout(raw?.security?.sessionTimeoutMinutes),
  },
});

export const readSystemSettings = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY) || "{}");
    return normalizeSystemSettings(raw);
  } catch {
    return normalizeSystemSettings();
  }
};

export const writeSystemSettings = (settings) => {
  const normalized = normalizeSystemSettings(settings);
  localStorage.setItem(SYSTEM_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYSTEM_SETTINGS_UPDATED_EVENT));
  }

  return normalized;
};

export const applySystemSettingsToDocument = (settingsLike) => {
  if (typeof document === "undefined") return;
  const settings = normalizeSystemSettings(settingsLike);
  const root = document.documentElement;

  root.classList.toggle("ui-compact-tables", settings.appearance.compactTables);
  root.classList.toggle("ui-reduce-motion", settings.appearance.reduceMotion);
  root.classList.toggle("ui-high-contrast", settings.appearance.highContrast);
};

export const getSessionTimeoutMs = (sessionTimeoutMinutes) => {
  const normalized = sanitizeSessionTimeout(sessionTimeoutMinutes);
  return Number.parseInt(normalized, 10) * 60 * 1000;
};
