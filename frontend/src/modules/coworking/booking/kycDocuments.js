/*
 * What a client has to produce before they get keys.
 *
 * These three lists are the ones The Office on Rent actually issues to clients
 * (documents handout, Sept 2026) - not a generic KYC checklist. They are
 * reproduced exactly, including "GST if available" being the one optional item
 * on the company list. Nothing has been added: asking for a document the firm
 * does not ask for invents a blocker at the desk.
 *
 * The three types are genuinely different filings, which is why they are three
 * lists and not one with exceptions. A proprietorship is not a small company -
 * it files a Gumasta and an MSME certificate against the proprietor's own
 * Aadhaar and PAN. A company signs through an authorised signatory, so the
 * signatory's identity and the letter authorising them are both required.
 */

export const CLIENT_KINDS = [
  { id: "company", label: "Company", hint: "Pvt Ltd / Ltd / OPC / LLP" },
  { id: "proprietorship", label: "Proprietorship", hint: "Sole proprietor firm" },
  { id: "individual", label: "Individual", hint: "Signing in their own name" },
];

export const ENTITY_TYPES = ["Private Limited", "Limited", "One Person Company", "LLP"];

/*
 * Two people (30 Sep 2026 requirements update).
 *
 * An agreement is often signed by two people - two partners, a couple, two
 * directors - so every client type has room for a second person's Aadhaar, PAN
 * and police verification, and a company for a second signing authority. Each
 * document carries a `group` so the checklist can show Person 1 and Person 2
 * (or Signing authority 1 and 2) as separate blocks.
 *
 * Keys of documents that already existed are unchanged, so files already on a
 * client still line up. Everything for the second person is optional: most
 * clients have one, and a required second person would mark every existing
 * client's KYC incomplete overnight.
 */
const personDocuments = (person, { panRequired = true, aadhaarHint, panHint } = {}) => {
  const second = person === 2;
  const suffix = second ? "2" : "";
  const group = `Person ${person}`;
  return [
    { key: `aadhaar${suffix}`, label: `Aadhaar card - Person ${person}`, hint: aadhaarHint, required: !second, group },
    { key: `pan${suffix}`, label: `PAN card - Person ${person}`, hint: panHint, required: !second && panRequired, group },
    { key: `policeVerification${suffix}`, label: `Police verification - Person ${person}`, required: !second, group },
  ];
};

const RENT_AGREEMENT = { key: "rentAgreement", label: "Rent agreement", required: true, group: "Agreement" };

export const DOCUMENT_SETS = {
  individual: [
    ...personDocuments(1),
    { key: "photo", label: "Passport size photo", required: true, group: "Person 1" },
    ...personDocuments(2),
    RENT_AGREEMENT,
  ],
  proprietorship: [
    { key: "gumasta", label: "Gumasta", hint: "Shop and establishment licence", required: true, group: "Business" },
    { key: "msme", label: "MSME certificate", required: true, group: "Business" },
    ...personDocuments(1, { aadhaarHint: "Of the proprietor", panHint: "Of the proprietor" }),
    { key: "photo", label: "Passport size photo", required: true, group: "Person 1" },
    ...personDocuments(2, { aadhaarHint: "Partner or co-signatory, if any" }),
    RENT_AGREEMENT,
  ],
  company: [
    { key: "coi", label: "COI", hint: "Certificate of incorporation", required: true, group: "Company" },
    { key: "companyPan", label: "Company PAN card", required: true, group: "Company" },
    { key: "gst", label: "GST certificate", hint: "If available", required: false, group: "Company" },
    { key: "authorisationLetter", label: "Authorization letter", required: true, group: "Company" },
    { key: "signatureAuthority", label: "Signing authority 1 - proof", hint: "Board resolution or authority document", required: true, group: "Signing authority 1" },
    { key: "signatureAuthorityAadhaar", label: "Aadhaar card - Signing authority 1", required: true, group: "Signing authority 1" },
    { key: "signatoryPan", label: "PAN card - Signing authority 1", required: false, group: "Signing authority 1" },
    { key: "policeVerification", label: "Police verification - Signing authority 1", required: true, group: "Signing authority 1" },
    { key: "photo", label: "Passport size photo", required: true, group: "Signing authority 1" },
    { key: "signatureAuthority2", label: "Signing authority 2 - proof", hint: "Only if a second person signs", required: false, group: "Signing authority 2" },
    { key: "signatureAuthorityAadhaar2", label: "Aadhaar card - Signing authority 2", required: false, group: "Signing authority 2" },
    { key: "signatoryPan2", label: "PAN card - Signing authority 2", required: false, group: "Signing authority 2" },
    { key: "policeVerification2", label: "Police verification - Signing authority 2", required: false, group: "Signing authority 2" },
    RENT_AGREEMENT,
  ],
};

/** Where the client is told to send their papers. Straight off the handout. */
export const DOCUMENT_SUBMISSION = {
  email: "theofficeonrent.ws@gmail.com",
  phone: "7909702003",
};

export const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const DOC_STATES = { PENDING: "PENDING", VERIFIED: "VERIFIED" };

export const documentsFor = (kind) => DOCUMENT_SETS[kind] || DOCUMENT_SETS.company;

export const labelForKind = (kind) => CLIENT_KINDS.find((option) => option.id === kind)?.label || "";

/**
 * Where a client stands, judged against their own document set.
 *
 * Uploaded and verified are deliberately separate numbers. A scan that has
 * arrived is not a scan anybody has looked at, and treating the two as one is
 * how an unreadable Aadhaar sits in a file for six months counted as done.
 */
export const kycStatusOf = (client) => {
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
    // Everything asked for has arrived.
    complete: uploaded.length === required.length,
    // Everything asked for has arrived and been checked.
    cleared: required.length > 0 && verified.length === required.length,
    awaitingReview: awaitingReview.length,
    total: set.length,
    totalUploaded: set.filter((doc) => held.has(doc.key)).length,
  };
};

/** One short phrase for a badge, and the tone it should carry. */
export const kycSummaryOf = (client) => {
  const status = kycStatusOf(client);
  if (status.cleared) return { ...status, label: "KYC verified", tone: "verified" };
  if (status.complete) return { ...status, label: `${status.awaitingReview} to review`, tone: "review" };
  return { ...status, label: `KYC ${status.uploaded}/${status.required}`, tone: "pending" };
};

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/*
 * Uploaded files are held for the session only.
 *
 * The record that matters - which document, whose, when, what file, and who
 * verified it - is on the client and persists. The bytes are not: localStorage
 * is a ~5MB budget and a few Aadhaar scans would blow it, and KYC scans have no
 * business sitting in a browser store anyway. The file lives in this Map until
 * the tab closes, which is enough to check what was just attached, and the
 * upload endpoint takes over when the API is wired.
 */
const sessionFiles = new Map();
const DOCUMENT_DB_NAME = "oor-coworking-documents";
const DOCUMENT_STORE_NAME = "files";

const openDocumentDb = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") {
    reject(new Error("IndexedDB is unavailable"));
    return;
  }
  const request = indexedDB.open(DOCUMENT_DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
      request.result.createObjectStore(DOCUMENT_STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const storeFile = async (docId, file) => {
  const db = await openDocumentDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DOCUMENT_STORE_NAME, "readwrite");
    transaction.objectStore(DOCUMENT_STORE_NAME).put(file, docId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

export const keepFile = (docId, file) => {
  const url = URL.createObjectURL(file);
  sessionFiles.set(docId, url);
  storeFile(docId, file).catch(() => {});
  return url;
};

export const fileUrl = (docId) => sessionFiles.get(docId) || null;

export const loadFileUrl = async (docId) => {
  const current = fileUrl(docId);
  if (current) return current;
  try {
    const db = await openDocumentDb();
    const file = await new Promise((resolve, reject) => {
      const request = db.transaction(DOCUMENT_STORE_NAME, "readonly")
        .objectStore(DOCUMENT_STORE_NAME)
        .get(docId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!file) return null;
    const url = URL.createObjectURL(file);
    sessionFiles.set(docId, url);
    return url;
  } catch {
    return null;
  }
};

/*
 * Every stored file, for backup.
 *
 * These scans exist in exactly one browser on one machine and nowhere else, so
 * something has to be able to read the whole store out. Kept here rather than
 * in the backup module because the database name and store name are this
 * file's business, and two places knowing them is how they drift apart.
 */
export const listStoredFiles = async () => {
  try {
    const db = await openDocumentDb();
    const entries = await new Promise((resolve, reject) => {
      const store = db.transaction(DOCUMENT_STORE_NAME, "readonly").objectStore(DOCUMENT_STORE_NAME);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      let keys = null;
      let values = null;
      const settle = () => { if (keys && values) resolve(keys.map((id, index) => ({ id, file: values[index] }))); };
      keysRequest.onsuccess = () => { keys = keysRequest.result || []; settle(); };
      valuesRequest.onsuccess = () => { values = valuesRequest.result || []; settle(); };
      keysRequest.onerror = () => reject(keysRequest.error);
      valuesRequest.onerror = () => reject(valuesRequest.error);
    });
    db.close();
    return entries.filter((entry) => entry.file);
  } catch {
    return [];
  }
};

export const putStoredFile = async (docId, file) => {
  try {
    await storeFile(docId, file);
    return true;
  } catch {
    return false;
  }
};

/*
 * Building the record - id, timestamp - lives here rather than in the
 * component. Both read the clock, and the purity rule rightly refuses that
 * inside a component body even when only an event handler calls it.
 */
export const attachFile = (doc, file) => {
  const id = `${doc.key}-${Date.now()}`;
  keepFile(id, file);
  return {
    id,
    key: doc.key,
    label: doc.label,
    url: null,
    fileName: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
    // A fresh upload has not been looked at yet, whoever attached it.
    status: DOC_STATES.PENDING,
    verifiedAt: null,
  };
};

export const markVerified = (doc, verified) => ({
  ...doc,
  status: verified ? DOC_STATES.VERIFIED : DOC_STATES.PENDING,
  verifiedAt: verified ? new Date().toISOString() : null,
});

export const forgetFile = (docId) => {
  const url = sessionFiles.get(docId);
  if (url) URL.revokeObjectURL(url);
  sessionFiles.delete(docId);
  openDocumentDb()
    .then((db) => {
      const transaction = db.transaction(DOCUMENT_STORE_NAME, "readwrite");
      transaction.objectStore(DOCUMENT_STORE_NAME).delete(docId);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    })
    .catch(() => {});
};
