import AsyncStorage from "@react-native-async-storage/async-storage";

export const SYSTEM_SETTINGS_STORAGE_KEY = "@samvid/system_settings";

export type MobileSystemSettings = {
  appearance: {
    compactTables: boolean;
    reduceMotion: boolean;
    highContrast: boolean;
  };
  security: {
    sessionTimeoutMinutes: "15" | "30" | "60" | "120" | "240";
  };
  notifications: {
    leadAlerts: boolean;
    chatAlerts: boolean;
    inventoryAlerts: boolean;
  };
};

export const DEFAULT_SYSTEM_SETTINGS: MobileSystemSettings = {
  appearance: {
    compactTables: false,
    reduceMotion: false,
    highContrast: false,
  },
  security: {
    sessionTimeoutMinutes: "30",
  },
  notifications: {
    leadAlerts: true,
    chatAlerts: true,
    inventoryAlerts: true,
  },
};

export const normalizeSystemSettings = (
  input: Partial<MobileSystemSettings> | null | undefined,
): MobileSystemSettings => {
  const row = input || {};
  const timeout = String(row?.security?.sessionTimeoutMinutes || DEFAULT_SYSTEM_SETTINGS.security.sessionTimeoutMinutes);
  const allowedTimeouts = new Set(["15", "30", "60", "120", "240"]);
  return {
    appearance: {
      compactTables: Boolean(row?.appearance?.compactTables),
      reduceMotion: Boolean(row?.appearance?.reduceMotion),
      highContrast: Boolean(row?.appearance?.highContrast),
    },
    security: {
      sessionTimeoutMinutes: (allowedTimeouts.has(timeout) ? timeout : DEFAULT_SYSTEM_SETTINGS.security.sessionTimeoutMinutes) as MobileSystemSettings["security"]["sessionTimeoutMinutes"],
    },
    notifications: {
      leadAlerts: row?.notifications?.leadAlerts ?? DEFAULT_SYSTEM_SETTINGS.notifications.leadAlerts,
      chatAlerts: row?.notifications?.chatAlerts ?? DEFAULT_SYSTEM_SETTINGS.notifications.chatAlerts,
      inventoryAlerts: row?.notifications?.inventoryAlerts ?? DEFAULT_SYSTEM_SETTINGS.notifications.inventoryAlerts,
    },
  };
};

export const readSystemSettings = async (): Promise<MobileSystemSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    const parsed = JSON.parse(raw);
    return normalizeSystemSettings(parsed);
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
};

export const writeSystemSettings = async (
  settings: Partial<MobileSystemSettings>,
): Promise<MobileSystemSettings> => {
  const normalized = normalizeSystemSettings(settings);
  await AsyncStorage.setItem(SYSTEM_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const resetSystemSettings = async (): Promise<MobileSystemSettings> => {
  await AsyncStorage.setItem(SYSTEM_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
  return DEFAULT_SYSTEM_SETTINGS;
};

export const getSessionTimeoutMs = (minutesValue: string | number | null | undefined) => {
  const minutes = Number.parseInt(String(minutesValue || "30"), 10);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  return safeMinutes * 60 * 1000;
};
