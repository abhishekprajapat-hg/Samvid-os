/*
 * Reading an owner or broker list off a spreadsheet somebody already keeps.
 *
 * Nobody maintains their contacts in our column order, so headers are matched
 * by meaning rather than position - "Mobile No.", "Contact Number" and "phone"
 * are the same column. Anything unrecognised is ignored rather than guessed at:
 * silently loading a wrong column into "notes" is worse than leaving it out.
 */

export const CONTACT_COLUMNS = ["name", "phone", "email", "company", "city", "propertyDetails", "notes"];

// The blank form, derived from the columns so the two cannot drift apart.
export const EMPTY_CONTACT = Object.freeze(Object.fromEntries(CONTACT_COLUMNS.map((column) => [column, ""])));

const HEADER_ALIASES = {
  name: ["name", "fullname", "contactname", "ownername", "brokername", "contactperson", "person"],
  phone: ["phone", "phoneno", "phonenumber", "mobile", "mobileno", "mobilenumber", "contact", "contactno", "contactnumber", "number", "whatsapp"],
  email: ["email", "emailid", "emailaddress", "mail"],
  company: ["company", "companyname", "firm", "firmname", "agency", "organisation", "organization", "brokerage"],
  city: ["city", "town", "location", "area"],
  propertyDetails: ["propertydetails", "property", "properties", "propertyinfo", "inventory", "inventorydetails", "unit", "units"],
  notes: ["notes", "note", "remarks", "remark", "comment", "comments", "description"],
};

const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const buildColumnMap = (headerRow) => {
  const map = new Map();
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    const field = CONTACT_COLUMNS.find((column) => HEADER_ALIASES[column].includes(normalized));
    // First matching column wins, so a stray duplicate later in the sheet
    // cannot overwrite the real one.
    if (field && !map.has(field)) map.set(field, index);
  });
  return map;
};

const rowsFromMatrix = (matrix) => {
  const headerIndex = matrix.findIndex((row) => buildColumnMap(row).size > 0);
  if (headerIndex === -1) {
    throw new Error("No recognisable columns. The sheet needs at least a name and a phone column.");
  }

  const columns = buildColumnMap(matrix[headerIndex]);
  if (!columns.has("name") || !columns.has("phone")) {
    throw new Error("The sheet needs both a name column and a phone column.");
  }

  const read = (row, field) => {
    const index = columns.get(field);
    return index === undefined ? "" : String(row[index] ?? "").trim();
  };

  return matrix
    .slice(headerIndex + 1)
    .map((row) => Object.fromEntries(CONTACT_COLUMNS.map((field) => [field, read(row, field)])))
    .filter((row) => row.name || row.phone);
};

// A CSV split that survives quoted fields containing commas and escaped quotes.
const splitCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(cell); cell = ""; continue; }
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

export const parseContactFile = async (file) => {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();

  if (["xlsx", "xls"].includes(extension)) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("The workbook has no sheets.");
    return rowsFromMatrix(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: false }));
  }

  return rowsFromMatrix(splitCsv(await file.text()));
};

export const CONTACT_TEMPLATE_CSV = `${CONTACT_COLUMNS.join(",")}\nRavi Sharma,9876543210,ravi@example.com,Sharma Realty,Indore,"2 shops on MG Road",Prefers calls after 6pm\n`;

export const downloadContactTemplate = (kind) => {
  const blob = new Blob([CONTACT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${kind.toLowerCase()}-import-template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
