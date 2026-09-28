import * as FileSystem from "expo-file-system/legacy";
import type { ClientDocument } from "./boardReducer";

/*
 * What a client has to produce before they get keys - a port of
 * frontend/src/modules/coworking/booking/kycDocuments.js.
 *
 * The three lists are the ones The Office on Rent actually issues to clients,
 * reproduced exactly. Nothing has been added.
 *
 * The document *record* - which document, whose, when, what file, who verified
 * it - lives on the client in the board and syncs like everything else. The
 * *bytes* do not: web keeps them in the browser's IndexedDB, keyed by the
 * record's id, and the server has never seen them. The phone does the same in
 * its own document directory. A scan attached on the desktop is therefore
 * listed on the phone but not openable there, and the reverse - which is web's
 * own behaviour between two browsers, and what Backup / Restore exists for.
 */

export const CLIENT_KINDS = [
  { id: "company", label: "Company", hint: "Pvt Ltd / Ltd / OPC / LLP" },
  { id: "proprietorship", label: "Proprietorship", hint: "Sole proprietor firm" },
  { id: "individual", label: "Individual", hint: "Signing in their own name" },
];

export const ENTITY_TYPES = ["Private Limited", "Limited", "One Person Company", "LLP"];

export type DocumentSpec = { key: string; label: string; hint?: string; required: boolean };

const COMMON_TENANCY_DOCUMENTS: DocumentSpec[] = [
  { key: "rentAgreement", label: "Rent agreement", required: true },
  { key: "policeVerification", label: "Police verification", required: true },
];

export const DOCUMENT_SETS: Record<string, DocumentSpec[]> = {
  individual: [
    { key: "aadhaar", label: "Aadhaar card", required: true },
    { key: "pan", label: "PAN card", required: true },
    { key: "photo", label: "Passport size photo", required: true },
    ...COMMON_TENANCY_DOCUMENTS,
  ],
  proprietorship: [
    { key: "gumasta", label: "Gumasta", hint: "Shop and establishment licence", required: true },
    { key: "msme", label: "MSME certificate", required: true },
    { key: "aadhaar", label: "Aadhaar card", hint: "Of the proprietor", required: true },
    { key: "pan", label: "PAN card", hint: "Of the proprietor", required: true },
    { key: "photo", label: "Passport size photo", required: true },
    ...COMMON_TENANCY_DOCUMENTS,
  ],
  company: [
    { key: "coi", label: "COI", hint: "Certificate of incorporation", required: true },
    { key: "companyPan", label: "Company PAN card", required: true },
    { key: "gst", label: "GST certificate", hint: "If available", required: false },
    { key: "signatureAuthority", label: "Signature authority", required: true },
    { key: "signatureAuthorityAadhaar", label: "Signature authority Aadhaar card", required: true },
    { key: "photo", label: "Passport size photo", required: true },
    { key: "authorisationLetter", label: "Authorization letter", required: true },
    ...COMMON_TENANCY_DOCUMENTS,
  ],
};

/** Where the client is told to send their papers. Straight off the handout. */
export const DOCUMENT_SUBMISSION = {
  email: "theofficeonrent.ws@gmail.com",
  phone: "7909702003",
};

export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const DOC_STATES = { PENDING: "PENDING", VERIFIED: "VERIFIED" } as const;

export const documentsFor = (kind?: string) => DOCUMENT_SETS[String(kind || "")] || DOCUMENT_SETS.company;

export const labelForKind = (kind?: string) => CLIENT_KINDS.find((option) => option.id === kind)?.label || "";

/** Where a client stands, judged against their own document set. */
export const kycStatusOf = (client: { kind?: string; documents?: ClientDocument[] } | null | undefined) => {
  const set = documentsFor(client?.kind);
  const held = new Map((client?.documents || []).map((doc) => [doc.key, doc]));
  const required = set.filter((doc) => doc.required);

  const uploaded = required.filter((doc) => held.has(doc.key));
  const verified = required.filter((doc) => held.get(doc.key)?.status === DOC_STATES.VERIFIED);
  const awaitingReview = (client?.documents || []).filter((doc) => doc.status !== DOC_STATES.VERIFIED);

  return {
    required: required.length,
    uploaded: uploaded.length,
    verified: verified.length,
    missing: required.filter((doc) => !held.has(doc.key)),
    complete: uploaded.length === required.length,
    cleared: required.length > 0 && verified.length === required.length,
    awaitingReview: awaitingReview.length,
    total: set.length,
    totalUploaded: set.filter((doc) => held.has(doc.key)).length,
  };
};

export const kycSummaryOf = (client: { kind?: string; documents?: ClientDocument[] }) => {
  const status = kycStatusOf(client);
  if (status.cleared) return { ...status, label: "KYC verified", tone: "verified" as const };
  if (status.complete) return { ...status, label: `${status.awaitingReview} to review`, tone: "review" as const };
  return { ...status, label: `KYC ${status.uploaded}/${status.required}`, tone: "pending" as const };
};

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ------------------------------------------------------ device storage -- */

const DOCS_DIR = `${FileSystem.documentDirectory || ""}coworking-docs/`;

const extensionOf = (fileName: string) => {
  const match = /\.([a-z0-9]{1,5})$/i.exec(String(fileName || ""));
  return match ? `.${match[1].toLowerCase()}` : "";
};

/* Stored under the record id, with the original extension so a viewer app
   recognises the file when it is shared out. */
export const fileUriFor = (doc: Pick<ClientDocument, "id" | "fileName">) =>
  `${DOCS_DIR}${encodeURIComponent(doc.id)}${extensionOf(doc.fileName)}`;

const ensureDir = async () => {
  const info = await FileSystem.getInfoAsync(DOCS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true });
};

/** Resolves to a local URI when this device holds the file, else null. */
export const localFileFor = async (doc: Pick<ClientDocument, "id" | "fileName">) => {
  try {
    const uri = fileUriFor(doc);
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : null;
  } catch {
    return null;
  }
};

export type PickedFile = { uri: string; name: string; size: number; mimeType: string };

/*
 * Builds the record and copies the bytes into this device's store. The record
 * shape is web's attachFile() exactly, so the desktop reads it unchanged.
 */
export const attachFile = async (spec: DocumentSpec, file: PickedFile): Promise<ClientDocument> => {
  const id = `${spec.key}-${Date.now()}`;
  const record: ClientDocument = {
    id,
    key: spec.key,
    label: spec.label,
    fileName: file.name,
    size: file.size,
    type: file.mimeType,
    uploadedAt: new Date().toISOString(),
    // A fresh upload has not been looked at yet, whoever attached it.
    status: DOC_STATES.PENDING,
    verifiedAt: null,
  };
  try {
    await ensureDir();
    await FileSystem.copyAsync({ from: file.uri, to: fileUriFor(record) });
  } catch {
    // The record still lands; the file simply is not openable on this device.
  }
  return record;
};

export const markVerified = (doc: ClientDocument, verified: boolean): ClientDocument => ({
  ...doc,
  status: verified ? DOC_STATES.VERIFIED : DOC_STATES.PENDING,
  verifiedAt: verified ? new Date().toISOString() : null,
});

export const forgetFile = (doc: Pick<ClientDocument, "id" | "fileName">) => {
  FileSystem.deleteAsync(fileUriFor(doc), { idempotent: true }).catch(() => {});
};

/** Every stored file, for backup - web's listStoredFiles(). */
export const listStoredFiles = async () => {
  try {
    const info = await FileSystem.getInfoAsync(DOCS_DIR);
    if (!info.exists) return [];
    const names = await FileSystem.readDirectoryAsync(DOCS_DIR);
    return names.map((name) => ({
      id: decodeURIComponent(name.replace(/\.[a-z0-9]{1,5}$/i, "")),
      fileName: name,
      uri: `${DOCS_DIR}${name}`,
    }));
  } catch {
    return [];
  }
};

export const putStoredFileBase64 = async (id: string, fileName: string, base64: string) => {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(fileUriFor({ id, fileName }), base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return true;
  } catch {
    return false;
  }
};

/* ----------------------------------------------------- date of birth -- */

/*
 * Web reads a date of birth off an uploaded scan with OCR (tesseract.js) and
 * pdf.js. Neither runs inside React Native, so the phone asks for the date
 * instead - the same field web falls back to when extraction finds nothing.
 * The matcher itself is ported so a caller that does have text can use it.
 */
export const extractBirthDate = (text: string, now = new Date()) => {
  const candidates = new Set<string>();
  const pattern = /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)\s*[:-]?\s*(\d{1,4})[\s/.-](\d{1,2}|[A-Za-z]{3,9})[\s/.-](\d{2,4})/gi;
  const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  for (const match of String(text || "").matchAll(pattern)) {
    const [, first, middle, last] = match;
    const year = Number(first.length === 4 ? first : last);
    const day = Number(first.length === 4 ? last : first);
    const month = /^\d+$/.test(middle) ? Number(middle) : names.indexOf(middle.slice(0, 3).toLowerCase()) + 1;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      year >= 1900 && month >= 1 && month <= 12
      && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      && date <= now
    ) {
      candidates.add(date.toISOString().slice(0, 10));
    }
  }
  return candidates.size === 1 ? [...candidates][0] : "";
};
