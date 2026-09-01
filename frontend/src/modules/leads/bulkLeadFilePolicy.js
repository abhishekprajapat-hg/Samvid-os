export const BULK_LEAD_CSV_ONLY_MESSAGE =
  "Bulk lead upload only supports CSV files in the browser. Convert Excel workbooks to CSV before uploading.";

const getExtension = (fileName = "") => {
  const parts = String(fileName || "").trim().toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
};

export const isSupportedBulkLeadUploadFileName = (fileName = "") => getExtension(fileName) === "csv";

export const assertSupportedBulkLeadUploadFileName = (fileName = "") => {
  if (!isSupportedBulkLeadUploadFileName(fileName)) {
    throw new Error(BULK_LEAD_CSV_ONLY_MESSAGE);
  }
};
