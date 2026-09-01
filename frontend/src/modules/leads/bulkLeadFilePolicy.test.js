import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertSupportedBulkLeadUploadFileName,
  BULK_LEAD_CSV_ONLY_MESSAGE,
  isSupportedBulkLeadUploadFileName,
} from "./bulkLeadFilePolicy";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("bulkLeadFilePolicy", () => {
  it("allows CSV files and rejects browser workbook parsing", () => {
    expect(isSupportedBulkLeadUploadFileName("PRE-SALES-LEADS.csv")).toBe(true);
    expect(isSupportedBulkLeadUploadFileName("PRE-SALES-LEADS.xlsx")).toBe(false);
    expect(isSupportedBulkLeadUploadFileName("legacy.xls")).toBe(false);

    expect(() => assertSupportedBulkLeadUploadFileName("legacy.xls")).toThrow(
      BULK_LEAD_CSV_ONLY_MESSAGE,
    );
    expect(() => assertSupportedBulkLeadUploadFileName("PRE-SALES-LEADS.xlsx")).toThrow(
      BULK_LEAD_CSV_ONLY_MESSAGE,
    );
  });

  it("keeps SheetJS out of active browser source imports", () => {
    const source = readFileSync(resolve(currentDir, "LeadsMatrix.jsx"), "utf8");

    expect(source).not.toMatch(/import\s*\(\s*["']xlsx["']\s*\)/);
    expect(source).not.toMatch(/from\s+["']xlsx["']/);
    expect(source).not.toMatch(/require\s*\(\s*["']xlsx["']\s*\)/);
  });
});
