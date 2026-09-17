import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Eye, Paperclip, Upload, X } from "lucide-react";
import { readDocumentBirthDate } from "../../../../utils/documentBirthDate";
import { cn } from "../../../../components/ui";
import {
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  attachFile,
  documentsFor,
  fileUrl,
  forgetFile,
  formatBytes,
  kycStatusOf,
  loadFileUrl,
} from "../kycDocuments";

/*
 * The KYC checklist, used both while onboarding and afterwards on the client's
 * profile.
 *
 * It never blocks. A desk that cannot let a cabin until the last scan arrives
 * will simply take the documents on paper and stop using the screen, and then
 * nobody knows what is missing. So the list states what is outstanding, the
 * client carries that state, and chasing it is a visible job rather than a
 * forgotten one.
 */

const DocumentRow = ({ doc, uploaded, onUpload, onRemove, readOnly }) => {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [url, setUrl] = useState(() => uploaded ? fileUrl(uploaded.id) : null);
  const isImage = Boolean(uploaded && (
    String(uploaded.type || "").startsWith("image/")
    || /\.(png|jpe?g)$/i.test(String(uploaded.fileName || ""))
  ));

  useEffect(() => {
    if (!uploaded?.id || url) return undefined;
    let active = true;
    loadFileUrl(uploaded.id).then((storedUrl) => {
      if (active && storedUrl) setUrl(storedUrl);
    });
    return () => {
      active = false;
    };
  }, [uploaded?.id, url]);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`${formatBytes(file.size)} is over the ${formatBytes(MAX_FILE_BYTES)} limit.`);
      return;
    }
    setError("");
    onUpload(doc, file);
  };

  return (
    <li
      className={cn(
        "rounded-lg border p-2.5 transition",
        uploaded
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5"
          : doc.required
            ? "border-slate-200 dark:border-slate-700"
            : "border-dashed border-slate-200 dark:border-slate-700",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            uploaded
              ? "bg-emerald-600 text-white"
              : "border border-slate-300 text-slate-400 dark:border-slate-600",
          )}
        >
          {uploaded ? <Check aria-hidden="true" size={12} strokeWidth={3} /> : <Paperclip aria-hidden="true" size={11} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-slate-900 dark:text-slate-100">
            {doc.label}
            {doc.required ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Required
              </span>
            ) : (
              <span className="text-[10.5px] text-slate-400 dark:text-slate-500">Optional</span>
            )}
          </p>
          {doc.hint ? (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{doc.hint}</p>
          ) : null}

          {uploaded ? (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="truncate font-medium">{uploaded.fileName}</span>
                <span className="text-slate-400 dark:text-slate-500">{formatBytes(uploaded.size)}</span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <Eye aria-hidden="true" size={11} />
                    Open full preview
                  </a>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">Loading preview...</span>
                )}
              </p>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  aria-label={`Preview ${uploaded.fileName}`}
                >
                  {isImage ? (
                    <img src={url} alt={`Preview of ${uploaded.fileName}`} className="h-36 w-full object-contain" />
                  ) : (
                    <iframe
                      src={`${url}#toolbar=0&navpanes=0`}
                      title={`Preview of ${uploaded.fileName}`}
                      className="pointer-events-none h-44 w-full bg-white"
                    />
                  )}
                </a>
              ) : null}
            </>
          ) : null}

          {error ? <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}
        </div>

        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-1">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="sr-only"
              onChange={handleFile}
              aria-label={`Upload ${doc.label}`}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 outline-none transition hover:border-slate-300 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:text-slate-300"
            >
              <Upload aria-hidden="true" size={11} />
              {uploaded ? "Replace" : "Upload"}
            </button>
            {uploaded ? (
              <button
                type="button"
                aria-label={`Remove ${doc.label}`}
                onClick={() => onRemove(doc)}
                className="rounded-lg p-1 text-slate-400 outline-none transition hover:bg-slate-100 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800"
              >
                <X aria-hidden="true" size={13} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
};

const DocumentChecklist = ({ kind, documents = [], onChange, onDateOfBirth, readOnly = false, className }) => {
  const [extracting, setExtracting] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState("");
  const set = documentsFor(kind);
  const status = kycStatusOf({ kind, documents });
  const byKey = new Map(documents.map((doc) => [doc.key, doc]));

  const upload = async (doc, file) => {
    if (extracting) return;
    setExtracting(true);
    setExtractionMessage("Reading document for date of birth...");
    const attached = attachFile(doc, file);
    try {
      const date = await readDocumentBirthDate(file);
      if (date) { attached.extractedDateOfBirth = date; onDateOfBirth?.(date); }
      setExtractionMessage(date ? `Date of birth found: ${date}. Please verify it against the document.` : "No unambiguous date of birth found. You can enter it manually.");
    } catch { setExtractionMessage("Document attached; automatic date extraction was unavailable. Enter the date of birth manually."); }
    const existing = byKey.get(doc.key);
    if (existing) forgetFile(existing.id);
    onChange([...documents.filter((item) => item.key !== doc.key), attached]);
    setExtracting(false);
  };

  const remove = (doc) => {
    const existing = byKey.get(doc.key);
    if (existing) forgetFile(existing.id);
    onChange(documents.filter((item) => item.key !== doc.key));
  };

  return (
    <div className={className}>
      {extractionMessage && <p role="status" className="mb-3 text-xs text-blue-600">{extractionMessage}</p>}
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2.5",
          status.complete
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full",
            status.complete ? "bg-emerald-600 text-white" : "bg-amber-500 text-white",
          )}
        >
          {status.complete ? (
            <Check aria-hidden="true" size={13} strokeWidth={3} />
          ) : (
            <AlertTriangle aria-hidden="true" size={12} />
          )}
        </span>
        <p
          className={cn(
            "text-[12.5px] font-semibold",
            status.complete ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300",
          )}
        >
          {status.complete
            ? "KYC complete"
            : `${status.uploaded} of ${status.required} required documents`}
        </p>
        {!status.complete ? (
          <p className="w-full text-[11.5px] text-amber-700 dark:text-amber-300/80">
            Still needed: {status.missing.map((doc) => doc.label).join(", ")}.
          </p>
        ) : null}
      </div>

      <ul className="space-y-1.5">
        {set.map((doc) => (
          <DocumentRow
            key={`${doc.key}:${byKey.get(doc.key)?.id || "missing"}`}
            doc={doc}
            uploaded={byKey.get(doc.key)}
            onUpload={upload}
            onRemove={remove}
            readOnly={readOnly || extracting}
          />
        ))}
      </ul>
    </div>
  );
};

export default DocumentChecklist;
