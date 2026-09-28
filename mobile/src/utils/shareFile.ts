import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/*
 * Web downloads a generated file by clicking a blob link. A phone has no
 * downloads folder to drop it in, so the file is written to the cache and
 * handed to the share sheet - which reaches Drive, WhatsApp, mail or Files,
 * wherever the person actually wanted it. The web build of this app (used for
 * screenshots and quick checks) keeps web's blob download.
 */
export const shareTextFile = async (
  fileName: string,
  content: string,
  mimeType = "text/csv",
  dialogTitle?: string,
) => {
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(path, {
    mimeType,
    dialogTitle: dialogTitle || fileName,
    UTI: mimeType === "application/json" ? "public.json" : mimeType === "text/csv" ? "public.comma-separated-values-text" : undefined,
  });
  return true;
};

/** Opens a file already on the device in whatever app handles its type. */
export const openLocalFile = async (uri: string, mimeType?: string) => {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, mimeType ? { mimeType } : undefined);
  return true;
};
