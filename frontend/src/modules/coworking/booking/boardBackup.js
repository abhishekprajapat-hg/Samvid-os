import { listStoredFiles, putStoredFile } from "./kycDocuments";

/*
 * Getting the booking board out of one browser.
 *
 * The board keeps its cabins in localStorage and its KYC scans in IndexedDB,
 * both of which live in a single browser profile on a single machine. That
 * makes the office PC the only copy of real client bookings: clear the site
 * data and they are gone, and no server has ever seen them.
 *
 * This writes one self-contained file holding both stores, so the data survives
 * the browser it was typed into and can be moved to another machine, or read by
 * an importer once the board is wired to the API.
 *
 * It copies the raw payload rather than a tidied-up shape on purpose. A rescue
 * that reinterprets what it is rescuing can lose the thing nobody thought to
 * map, and this runs once, against data that cannot be recreated.
 */

const BOARD_STORAGE_KEY = "oor.coworking.board.v3";
// Older keys are read too: a machine that has not opened the board since an
// upgrade may still be holding the only copy under a previous name.
const LEGACY_BOARD_KEYS = ["oor.coworking.board.v2", "oor.coworking.board.v1"];
export const BACKUP_FORMAT = "oor.coworking.board.backup/1";

const fileToDataUrl = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => resolve("");
  reader.readAsDataURL(file);
});

const dataUrlToBlob = async (dataUrl) => {
  try {
    return await (await fetch(dataUrl)).blob();
  } catch {
    return null;
  }
};

const readStorage = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { key, raw } : null;
  } catch {
    return null;
  }
};

export const createBackup = async () => {
  const board = readStorage(BOARD_STORAGE_KEY)
    || LEGACY_BOARD_KEYS.map(readStorage).find(Boolean)
    || null;

  const stored = await listStoredFiles();
  const documents = [];
  for (const entry of stored) {
    const dataUrl = await fileToDataUrl(entry.file);
    if (!dataUrl) continue;
    documents.push({
      id: entry.id,
      name: entry.file.name || String(entry.id),
      type: entry.file.type || "application/octet-stream",
      size: Number(entry.file.size || 0),
      dataUrl,
    });
  }

  let cabinsLet = 0;
  try {
    cabinsLet = (JSON.parse(board?.raw || "{}").cabins || []).filter((cabin) => cabin?.client).length;
  } catch {
    cabinsLet = 0;
  }

  return {
    format: BACKUP_FORMAT,
    takenAt: new Date().toISOString(),
    origin: typeof window !== "undefined" ? window.location.origin : "",
    // Reported back to the operator so a backup that silently caught nothing is
    // obvious before they rely on it.
    counts: { cabinsLet, documents: documents.length },
    board,
    documents,
  };
};

export const downloadBackup = async () => {
  const backup = await createBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `coworking-board-backup-${backup.takenAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return backup;
};

export const restoreBackup = async (payload) => {
  if (!payload || payload.format !== BACKUP_FORMAT) {
    throw new Error("That file is not a booking board backup.");
  }
  if (!payload.board?.raw) {
    throw new Error("This backup holds no board data.");
  }

  // The board is restored under the current key whatever key it was saved from,
  // so a file taken off an older build still lands where the board looks.
  window.localStorage.setItem(BOARD_STORAGE_KEY, payload.board.raw);

  let restoredDocuments = 0;
  for (const doc of payload.documents || []) {
    const blob = await dataUrlToBlob(doc.dataUrl);
    if (!blob) continue;
    const file = new File([blob], doc.name || String(doc.id), { type: doc.type || blob.type });
    if (await putStoredFile(doc.id, file)) restoredDocuments += 1;
  }

  return { ...payload.counts, restoredDocuments };
};

export const readBackupFile = async (file) => JSON.parse(await file.text());
