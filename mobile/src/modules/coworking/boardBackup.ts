import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { shareTextFile } from "../../utils/shareFile";
import type { BoardState } from "./boardReducer";
import { listStoredFiles, putStoredFileBase64 } from "./kycDocuments";

/*
 * Getting the booking board off one device - web's boardBackup.js.
 *
 * The KYC scans exist only on the device they were attached on, so this writes
 * one self-contained file holding the board and every scan on this phone. The
 * format is web's exactly (`oor.coworking.board.backup/1`, the board as the raw
 * JSON string, each document as a data URL), so a backup taken on the phone
 * restores in the browser and the reverse.
 */

const BOARD_STORAGE_KEY = "oor.coworking.board.v3";
export const BACKUP_FORMAT = "oor.coworking.board.backup/1";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

type BackupDocument = { id: string; name: string; type: string; size: number; dataUrl: string };

export type BoardBackup = {
  format: string;
  takenAt: string;
  origin: string;
  counts: { cabinsLet: number; documents: number };
  board: { key: string; raw: string } | null;
  documents: BackupDocument[];
};

export const createBackup = async (board: BoardState): Promise<BoardBackup> => {
  const raw = JSON.stringify({ cabins: board.cabins, activity: board.activity.slice(0, 200) });
  const documents: BackupDocument[] = [];

  for (const stored of await listStoredFiles()) {
    try {
      const base64 = await FileSystem.readAsStringAsync(stored.uri, { encoding: FileSystem.EncodingType.Base64 });
      const ext = (/\.[a-z0-9]{1,5}$/i.exec(stored.fileName)?.[0] || "").toLowerCase();
      const type = MIME_BY_EXT[ext] || "application/octet-stream";
      documents.push({
        id: stored.id,
        name: stored.fileName,
        type,
        size: Math.round((base64.length * 3) / 4),
        dataUrl: `data:${type};base64,${base64}`,
      });
    } catch {
      // A file that cannot be read is skipped rather than failing the backup.
    }
  }

  return {
    format: BACKUP_FORMAT,
    takenAt: new Date().toISOString(),
    origin: "mobile",
    counts: { cabinsLet: board.cabins.filter((cabin) => cabin.client).length, documents: documents.length },
    board: { key: BOARD_STORAGE_KEY, raw },
    documents,
  };
};

export const shareBackup = async (board: BoardState) => {
  const backup = await createBackup(board);
  await shareTextFile(
    `coworking-board-backup-${backup.takenAt.slice(0, 10)}.json`,
    JSON.stringify(backup),
    "application/json",
    "Save the booking board backup",
  );
  return backup;
};

/** Picks a backup file and parses it; null when the person cancels. */
export const pickBackup = async (): Promise<BoardBackup | null> => {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
  return JSON.parse(text);
};

/*
 * Validates a backup and writes its scans to this device. Returns the board it
 * holds for the caller to apply - web writes it to localStorage and reloads; the
 * phone applies it through the store so it reaches the server like any change.
 */
export const restoreBackup = async (payload: BoardBackup) => {
  if (!payload || payload.format !== BACKUP_FORMAT) {
    throw new Error("That file is not a booking board backup.");
  }
  if (!payload.board?.raw) {
    throw new Error("This backup holds no board data.");
  }
  const board = JSON.parse(payload.board.raw) as BoardState;
  if (!Array.isArray(board?.cabins)) throw new Error("This backup holds no board data.");

  let restoredDocuments = 0;
  for (const doc of payload.documents || []) {
    const base64 = String(doc.dataUrl || "").split(",")[1];
    if (!base64) continue;
    // Web stores by id alone; keep its extension so the phone can open it.
    const ext = /\.[a-z0-9]{1,5}$/i.exec(String(doc.name || ""))?.[0]
      || Object.entries(MIME_BY_EXT).find(([, mime]) => mime === doc.type)?.[0]
      || "";
    if (await putStoredFileBase64(String(doc.id), `x${ext}`, base64)) restoredDocuments += 1;
  }

  return {
    board,
    cabinsLet: board.cabins.filter((cabin) => cabin?.client).length,
    restoredDocuments,
  };
};
