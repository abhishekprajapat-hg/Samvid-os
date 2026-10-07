/*
 * Reading an owner or broker list off a spreadsheet - a port of
 * frontend/src/modules/inventory/contactBulkImport.js and the validation in
 * ContactFormDialog.jsx.
 *
 * Headers are matched by meaning rather than position - "Mobile No.", "Contact
 * Number" and "phone" are the same column - and anything unrecognised is
 * ignored rather than guessed at. The xlsx reading lives with the screen, so
 * this stays testable; see test/contactBulkImport.test.cjs.
 */

export const CONTACT_COLUMNS = ["name", "phone", "email", "company", "city", "propertyDetails", "notes"] as const;
type Column = (typeof CONTACT_COLUMNS)[number];

const HEADER_ALIASES: Record<Column, string[]> = {
  name: ["name", "fullname", "contactname", "ownername", "brokername", "contactperson", "person"],
  phone: ["phone", "phoneno", "phonenumber", "mobile", "mobileno", "mobilenumber", "contact", "contactno", "contactnumber", "number", "whatsapp"],
  email: ["email", "emailid", "emailaddress", "mail"],
  company: ["company", "companyname", "firm", "firmname", "agency", "organisation", "organization", "brokerage"],
  city: ["city", "town", "location", "area"],
  propertyDetails: ["propertydetails", "property", "properties", "propertyinfo", "inventory", "inventorydetails", "unit", "units"],
  notes: ["notes", "note", "remarks", "remark", "comment", "comments", "description"],
};

const normalizeHeader = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const buildColumnMap = (headerRow: unknown[]) => {
  const map = new Map<Column, number>();
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    const field = CONTACT_COLUMNS.find((column) => HEADER_ALIASES[column].includes(normalized));
    // First matching column wins, so a stray duplicate later cannot overwrite it.
    if (field && !map.has(field)) map.set(field, index);
  });
  return map;
};

export type ContactRow = Record<Column, string>;

export const rowsFromMatrix = (matrix: unknown[][]): ContactRow[] => {
  const headerIndex = matrix.findIndex((row) => buildColumnMap(row).size > 0);
  if (headerIndex === -1) {
    throw new Error("No recognisable columns. The sheet needs at least a name and a phone column.");
  }

  const columns = buildColumnMap(matrix[headerIndex]);
  if (!columns.has("name") || !columns.has("phone")) {
    throw new Error("The sheet needs both a name column and a phone column.");
  }

  const read = (row: unknown[], field: Column) => {
    const index = columns.get(field);
    return index === undefined ? "" : String(row[index] ?? "").trim();
  };

  return matrix
    .slice(headerIndex + 1)
    .map((row) => Object.fromEntries(CONTACT_COLUMNS.map((field) => [field, read(row, field)])) as ContactRow)
    .filter((row) => row.name || row.phone);
};

/* A CSV split that survives quoted fields containing commas and escaped quotes. */
export const splitCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((entry) => entry.some((value) => String(value || "").trim()));
};

export const parseContactCsv = (text: string) => rowsFromMatrix(splitCsv(text));

export const CONTACT_TEMPLATE_CSV = `${CONTACT_COLUMNS.join(",")}\nRavi Sharma,9876543210,ravi@example.com,Sharma Realty,Indore,"2 shops on MG Road",Prefers calls after 6pm\n`;

/* Mirrors normalizePhone on the server, so the form refuses what the API would. */
export const normalizeContactPhone = (value: unknown) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
};

export const validateContact = (draft: Record<string, unknown>) => {
  const errors: Record<string, string> = {};
  if (!String(draft.name || "").trim()) errors.name = "Name is required";
  if (!String(draft.phone || "").trim()) errors.phone = "Phone is required";
  else if (!normalizeContactPhone(draft.phone)) errors.phone = "Enter a valid phone number";
  const email = String(draft.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
  return errors;
};
