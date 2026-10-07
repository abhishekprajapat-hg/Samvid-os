/*
 * Bulk lead upload parsing - a port of the helpers in
 * frontend/src/modules/leads/LeadsMatrix.jsx (normalizeCsvHeader through
 * parseBulkLeadCsvRows).
 *
 * The rules are web's, unchanged: the header aliases, the status guessed from
 * the sheet name and free-text columns, lakh / k amounts, dd/mm/yy dates, and
 * the commercial / residential requirement blocks. A spreadsheet uploaded from
 * a phone must create exactly the leads the same file creates from the desk.
 * Only annotations are added for strict TypeScript. The xlsx reading itself
 * lives with the screen, so this file stays testable without it; see
 * test/bulkLeadUpload.test.cjs.
 */

export const normalizeCsvHeader = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/-]+/g, "");

export const BULK_LEAD_SHEET_TYPES = {
  COMMERCIAL: "COMMERCIAL",
  RESIDENTIAL: "RESIDENTIAL",
} as const;

export type BulkSheetType = (typeof BULK_LEAD_SHEET_TYPES)[keyof typeof BULK_LEAD_SHEET_TYPES];

export const DEFAULT_BULK_LEAD_SHEET_TYPE: BulkSheetType = BULK_LEAD_SHEET_TYPES.COMMERCIAL;

type Row = Record<string, string>;

const normalizeBulkCellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
};

const normalizeBulkPhone = (value: unknown) => {
  const raw = normalizeBulkCellText(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.slice(-10);
};

export const normalizeBulkAmount = (value: unknown) => {
  const raw = normalizeBulkCellText(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (/\blac\b|\blakh\b|\bl\b/.test(lower)) return Math.round(numeric * 100000);
  if (/\bk\b/.test(lower)) return Math.round(numeric * 1000);
  return Math.round(numeric);
};

const normalizeBulkNumber = (value: unknown) => {
  const raw = normalizeBulkCellText(value);
  if (!raw) return null;
  const numeric = Number.parseFloat(raw.replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeBulkBoolean = (value: unknown) => {
  const raw = normalizeBulkCellText(value).toLowerCase();
  if (!raw) return false;
  return ["yes", "y", "true", "1", "available", "required", "required hai", "hai"].includes(raw);
};

export const normalizeBulkDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const raw = normalizeBulkCellText(value);
  if (!raw) return "";

  const dateMatch = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dateMatch) {
    const day = Number.parseInt(dateMatch[1], 10);
    const month = Number.parseInt(dateMatch[2], 10) - 1;
    const rawYear = Number.parseInt(dateMatch[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(year, month, day, 12);
    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) {
      return parsed.toISOString();
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const normalizeBulkTransactionType = (value: unknown) => {
  const normalized = normalizeBulkCellText(value).toLowerCase();
  if (!normalized) return "";
  if (/\blease\b/.test(normalized)) return "LEASE";
  if (/\brent\b/.test(normalized)) return "RENT";
  if (/\b(purchase|sale|buy|sell)\b/.test(normalized)) return "SALE";
  return "";
};

export const resolveLeadCsvHeaderKey = (rawHeader: unknown) => {
  const normalized = normalizeCsvHeader(rawHeader);
  if (!normalized) return "";

  if (["name", "leadname", "fullname", "clientname"].includes(normalized)) return "name";
  if (["phone", "mobile", "mobileno", "phonenumber", "number", "contact"].includes(normalized)) return "phone";
  if (["email", "emailid"].includes(normalized)) return "email";
  if (["city", "location"].includes(normalized)) return "city";
  if (["project", "projectinterested", "interestedproject"].includes(normalized)) return "projectInterested";
  if (["requirement", "requirment", "requiremnt", "requiremewnt"].includes(normalized)) return "requirement";
  if (["projectname"].includes(normalized)) return "projectName";
  if (["comment", "comments", "remark", "remarks", "feedback"].includes(normalized)) return "comment";
  if (["workprofile", "profession", "occupation", "clientprofession"].includes(normalized)) return "workProfile";
  if (["company", "companyname", "working", "business"].includes(normalized)) return "company";
  if (["status", "leadstatus", "leadstutas", "leadstutus"].includes(normalized)) return "status";
  if (["date", "leaddate"].includes(normalized)) return "date";
  if (["followup", "followup2", "followupdate", "followupdate2"].includes(normalized)) return "followUp";
  if (["callupdate", "callstatus"].includes(normalized)) return "callUpdate";
  if (["propertytype", "type"].includes(normalized)) return "propertyType";
  if (["bhk", "bhktype", "bedroom", "bedrooms", "configuration"].includes(normalized)) return "bhkType";
  if (["floor", "floornumber"].includes(normalized)) return "floor";
  if (["amenities", "amenity"].includes(normalized)) return "amenities";
  if (["lift", "elevator"].includes(normalized)) return "lift";
  if (["security"].includes(normalized)) return "security";
  if (["gym"].includes(normalized)) return "gym";
  if (["swimmingpool", "pool"].includes(normalized)) return "swimmingPool";
  if (["clubhouse", "club"].includes(normalized)) return "clubhouse";
  if (["powerbackup", "electricitybackup", "backup"].includes(normalized)) return "powerBackup";
  if (["parking", "carparking"].includes(normalized)) return "parking";
  if (["studyroom", "study"].includes(normalized)) return "studyRoom";
  if (["servantroom", "servant"].includes(normalized)) return "servantRoom";
  if (["modularkitchen", "kitchen"].includes(normalized)) return "modularKitchen";
  if (["gaspipeline", "gas"].includes(normalized)) return "gasPipeline";
  if (["seats", "seat", "workstations", "workstation"].includes(normalized)) return "seats";
  if (["cabins", "cabin", "privatecabins"].includes(normalized)) return "cabins";
  if (["conferencerooms", "meetingrooms", "meetingroom"].includes(normalized)) return "conferenceRooms";
  if (["conferenceseats", "meetingseats"].includes(normalized)) return "conferenceSeats";
  if (["pantry"].includes(normalized)) return "pantry";
  if (["reception", "receptionarea"].includes(normalized)) return "receptionArea";
  if (["waiting", "waitingarea"].includes(normalized)) return "waitingArea";
  if (["cafeteria", "cafe"].includes(normalized)) return "cafeteria";
  if (["serverroom", "server"].includes(normalized)) return "serverRoom";
  if (["storageroom", "storage"].includes(normalized)) return "storageRoom";
  if (["breakoutarea", "breakout"].includes(normalized)) return "breakoutArea";
  if (["centralac", "ac"].includes(normalized)) return "centralAC";
  if (["firesafety", "fire"].includes(normalized)) return "fireSafety";
  if (["readytomove", "ready"].includes(normalized)) return "readyToMove";
  if (["underconstruction", "construction"].includes(normalized)) return "underConstruction";
  if (["budget"].includes(normalized)) return "budget";
  if (["visit", "visitupdate"].includes(normalized)) return "visit";
  if (["handle", "handledby", "owner"].includes(normalized)) return "handle";
  if (["optionshare", "optionsshared", "optionsshare"].includes(normalized)) return "optionShare";
  if (["timeline", "timeLine"].includes(normalized)) return "timeline";
  if (["leadsource", "source"].includes(normalized)) return "source";
  if (["inventoryid", "propertyid", "unitid", "assetid"].includes(normalized)) return "inventoryId";
  if (["sitelat", "latitude", "lat"].includes(normalized)) return "siteLat";
  if (["sitelng", "longitude", "long", "lng"].includes(normalized)) return "siteLng";
  if (["siteradiusmeters", "radiusmeters", "radius", "siteradius"].includes(normalized)) return "siteRadiusMeters";

  return "";
};

export const resolveBulkLeadStatus = ({ sheetName = "", row = {} as Row }) => {
  const haystack = [sheetName, row.status, row.visit, row.comment, row.callUpdate, row.followUp, row.projectInterested]
    .map((value) => normalizeBulkCellText(value).toLowerCase())
    .join(" ");

  if (/\b(close|closed|token)\b/.test(haystack)) return "CLOSED";
  if (/\b(site\s*visit\s*(scheduled|schedule)|visit\s*(scheduled|schedule))\b/.test(haystack)) return "SITE_VISIT_SCHEDULED";
  if (/\b(site\s*visit\s*(overdue|over\s*due|over\s*deu)|visit\s*(overdue|over\s*due|over\s*deu))\b/.test(haystack)) return "SITE_VISIT_OVERDUE";
  if (/\b(missing\s*in\s*action|mia)\b/.test(haystack)) return "MISSING_IN_ACTION";
  if (/\b(not\s*picking|not\s*pick|call\s*not\s*picked|no\s*answer)\b/.test(haystack)) return "NOT_PICKING_CALLS";
  if (/\b(invalid|invaild|wrong\s*number)\b/.test(haystack)) return "INVALID";
  if (/\b(owner)\b/.test(haystack)) return "OWNER";
  if (/\b(broker)\b/.test(haystack)) return "BROKER";
  if (/\bvisit|visited|revisit\b/.test(haystack)) return "SITE_VISIT";
  if (/\binterested|interest\b/.test(haystack)) return "INTERESTED";
  if (/\btransfer|contacted|follow\s*up|callback|call back\b/.test(haystack)) return "CONTACTED";
  if (/\blost|not\s*interested|notint|cna\b/.test(haystack)) return "LOST";
  return "NEW";
};

const buildBulkLeadProjectSummary = (row: Row) => {
  const transactionType = normalizeBulkTransactionType(row.projectName);
  const projectName = normalizeBulkCellText(row.projectName);
  const parts = [
    row.projectInterested,
    row.requirement ? `Requirement: ${row.requirement}` : "",
    row.propertyType ? `Property Type: ${row.propertyType}` : "",
    projectName && !transactionType ? `Project: ${projectName}` : "",
    transactionType ? `Transaction: ${transactionType}` : "",
    row.city ? `Location: ${row.city}` : "",
    row.budget ? `Budget: ${row.budget}` : "",
    row.company ? `Company: ${row.company}` : "",
    row.callUpdate ? `Call Update: ${row.callUpdate}` : "",
    row.comment ? `Comment: ${row.comment}` : "",
    row.visit ? `Visit: ${row.visit}` : "",
    row.handle ? `Handle: ${row.handle}` : "",
    row.optionShare ? `Option Share: ${row.optionShare}` : "",
    row.timeline ? `Timeline: ${row.timeline}` : "",
  ]
    .map(normalizeBulkCellText)
    .filter(Boolean);

  return parts.join(" | ").slice(0, 500);
};

export const buildBulkLeadRequirements = (row: Row, sheetType: string = DEFAULT_BULK_LEAD_SHEET_TYPE) => {
  const budget = normalizeBulkAmount(row.budget);
  const requirementText = [row.projectInterested, row.requirement].map(normalizeBulkCellText).filter(Boolean).join(" ");
  const propertyType = normalizeBulkCellText(row.propertyType).toUpperCase();
  const transactionType = normalizeBulkTransactionType(row.projectName || row.projectInterested);
  const requirements: Record<string, any> = {};

  if (budget !== null) {
    requirements.budgetMin = budget;
    requirements.budgetMax = budget;
  }

  const selectedSheetType = (Object.values(BULK_LEAD_SHEET_TYPES) as string[]).includes(sheetType)
    ? sheetType
    : DEFAULT_BULK_LEAD_SHEET_TYPE;

  if (["COMMERCIAL", "RESIDENTIAL"].includes(propertyType)) {
    requirements.inventoryType = propertyType;
  } else {
    requirements.inventoryType = selectedSheetType;
  }
  if (transactionType) {
    requirements.transactionType = transactionType;
  } else {
    requirements.transactionType = selectedSheetType === BULK_LEAD_SHEET_TYPES.COMMERCIAL ? "RENT" : "";
  }

  const seatsMatch = requirementText.match(/(\d+)\s*(?:seat|seater|seats)\b/i);
  const cabinMatch = requirementText.match(/(\d+)\s*(?:cabin|cabins)\b/i);
  const conferenceSeatsMatch = requirementText.match(/(\d+)\s*(?:conference\s*seat|conference\s*seater|conference\s*seats)\b/i);
  const areaMatch = requirementText.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sqfit|sft)\b/i);
  if (selectedSheetType === BULK_LEAD_SHEET_TYPES.COMMERCIAL || seatsMatch || cabinMatch || conferenceSeatsMatch) {
    requirements.inventoryType = "COMMERCIAL";
    requirements.transactionType = transactionType || "RENT";
    requirements.commercial = {};
    const seats = normalizeBulkNumber(row.seats);
    const cabins = normalizeBulkNumber(row.cabins);
    const conferenceRooms = normalizeBulkNumber(row.conferenceRooms);
    const conferenceSeats = normalizeBulkNumber(row.conferenceSeats);
    if (seats !== null) requirements.commercial.seats = Math.round(seats);
    if (cabins !== null) requirements.commercial.cabins = Math.round(cabins);
    if (conferenceRooms !== null) requirements.commercial.conferenceRooms = Math.round(conferenceRooms);
    if (conferenceSeats !== null) requirements.commercial.conferenceSeats = Math.round(conferenceSeats);
    if (seatsMatch && requirements.commercial.seats === undefined) {
      requirements.commercial.seats = Number.parseInt(seatsMatch[1], 10);
    }
    if (cabinMatch && requirements.commercial.cabins === undefined) {
      requirements.commercial.cabins = Number.parseInt(cabinMatch[1], 10);
    }
    if (conferenceSeatsMatch) {
      requirements.commercial.conferenceSeats = Number.parseInt(conferenceSeatsMatch[1], 10);
    }
    [
      "parking",
      "pantry",
      "receptionArea",
      "waitingArea",
      "cafeteria",
      "serverRoom",
      "storageRoom",
      "breakoutArea",
      "lift",
      "powerBackup",
      "centralAC",
      "fireSafety",
      "readyToMove",
      "underConstruction",
    ].forEach((key) => {
      if (!row[key]) return;
      const targetKey = key === "parking" ? "parkingAvailable" : key === "lift" ? "liftAvailable" : key;
      requirements.commercial[targetKey] = normalizeBulkBoolean(row[key]);
    });
  }

  if (selectedSheetType === BULK_LEAD_SHEET_TYPES.RESIDENTIAL) {
    requirements.inventoryType = "RESIDENTIAL";
    const floor = normalizeBulkNumber(row.floor);
    const amenitiesText = normalizeBulkCellText(row.amenities).toLowerCase();
    const hasAmenity = (key: string, aliases: string[] = []) =>
      normalizeBulkBoolean(row[key]) || aliases.some((alias) => amenitiesText.includes(alias));

    requirements.residential = {
      bhkType: normalizeBulkCellText(row.bhkType).toUpperCase(),
      floor: floor === null ? null : Math.round(floor),
      amenities: {
        lift: hasAmenity("lift", ["lift", "elevator"]),
        security: hasAmenity("security", ["security"]),
        gym: hasAmenity("gym", ["gym"]),
        swimmingPool: hasAmenity("swimmingPool", ["pool", "swimming"]),
        clubhouse: hasAmenity("clubhouse", ["club"]),
        powerBackup: hasAmenity("powerBackup", ["power backup", "electricity backup", "backup"]),
        parking: hasAmenity("parking", ["parking"]),
        studyRoom: hasAmenity("studyRoom", ["study"]),
        servantRoom: hasAmenity("servantRoom", ["servant"]),
        modularKitchen: hasAmenity("modularKitchen", ["modular kitchen"]),
        electricityBackup: hasAmenity("powerBackup", ["electricity backup"]),
        gasPipeline: hasAmenity("gasPipeline", ["gas"]),
      },
    };
  }
  if (areaMatch) {
    const area = Number.parseFloat(areaMatch[1]);
    if (Number.isFinite(area)) {
      requirements.areaMin = area;
      requirements.areaMax = area;
      requirements.areaUnit = "SQ_FT";
    }
  }

  return Object.keys(requirements).length ? requirements : undefined;
};

export type BulkLeadRow = {
  name: string;
  phone: string;
  email: string;
  city: string;
  projectInterested: string;
  clientProfession?: string;
  requirements?: Record<string, any>;
  source: "META" | "MANUAL";
  status: string;
  nextFollowUp: string;
  lastContactedAt: string;
};

const normalizeBulkLeadRow = ({
  rawRow,
  mappedHeaders,
  sheetName = "",
  sheetType = DEFAULT_BULK_LEAD_SHEET_TYPE as string,
}: {
  rawRow: unknown[];
  mappedHeaders: string[];
  sheetName?: string;
  sheetType?: string;
}): BulkLeadRow | null => {
  const row: Row = {};
  const allCellValues: string[] = [];

  mappedHeaders.forEach((key, cellIndex) => {
    const value = normalizeBulkCellText(rawRow[cellIndex]);
    if (value) allCellValues.push(value);
    if (!key || !value) return;
    if (!row[key]) row[key] = value;
  });

  const phone = normalizeBulkPhone(row.phone) || allCellValues.map(normalizeBulkPhone).find(Boolean) || "";
  if (!phone) return null;

  const name = normalizeBulkCellText(row.name);
  const safeName = name && !normalizeBulkPhone(name) ? name : `Lead ${phone}`;
  const sourceText = normalizeBulkCellText(row.source).toUpperCase();

  return {
    name: safeName,
    phone,
    email: row.email || "",
    city: row.city || "",
    clientProfession: normalizeBulkCellText(row.workProfile).slice(0, 120),
    projectInterested: buildBulkLeadProjectSummary(row),
    requirements: buildBulkLeadRequirements(row, sheetType),
    source: sourceText.includes("META") ? "META" : "MANUAL",
    status: resolveBulkLeadStatus({ sheetName, row }),
    nextFollowUp: normalizeBulkDate(row.followUp),
    lastContactedAt: normalizeBulkDate(row.date),
  };
};

export const parseBulkLeadRowsFromMatrix = ({
  matrix,
  sheetName = "",
  sheetType = DEFAULT_BULK_LEAD_SHEET_TYPE as string,
}: {
  matrix: unknown[][];
  sheetName?: string;
  sheetType?: string;
}) => {
  const headerIndex = matrix.findIndex((rawRow) => {
    const mappedHeaders = rawRow.map((cell) => resolveLeadCsvHeaderKey(cell));
    const mappedCount = mappedHeaders.filter(Boolean).length;
    return mappedCount >= 2 && (mappedHeaders.includes("phone") || mappedHeaders.includes("name"));
  });

  if (headerIndex < 0) return [];

  const mappedHeaders = matrix[headerIndex].map((header) => resolveLeadCsvHeaderKey(header));
  const hasName = mappedHeaders.includes("name");
  const rows: BulkLeadRow[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = normalizeBulkLeadRow({ rawRow: matrix[rowIndex], mappedHeaders, sheetName, sheetType });
    if (!row) continue;
    if (!hasName && !row.name) continue;
    rows.push(row);
  }

  return rows;
};

export const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
};

export const parseBulkLeadCsvRows = (csvText: string, sheetType: string = DEFAULT_BULK_LEAD_SHEET_TYPE) => {
  const normalizedText = String(csvText || "").replace(/^﻿/, "").trim();
  if (!normalizedText) {
    throw new Error("CSV data is required");
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV must include header and at least one data row");
  }

  const mappedHeaders = parseCsvLine(lines[0]).map((header) => resolveLeadCsvHeaderKey(header));
  if (!mappedHeaders.includes("name") || !mappedHeaders.includes("phone")) {
    throw new Error("CSV header must include at least name and phone columns");
  }

  const rows = parseBulkLeadRowsFromMatrix({ matrix: lines.map(parseCsvLine), sheetName: "CSV", sheetType });
  if (!rows.length) {
    throw new Error("No valid lead rows found in CSV");
  }
  return rows;
};

/* Workbook sheets web skips: performance tabs and the broker / owner / deal lists. */
export const shouldSkipWorkbookSheet = (sheetName: string) => {
  const normalized = normalizeCsvHeader(sheetName);
  return normalized.includes("performance") || normalized.includes("perfomance") || ["broker", "owners", "dealclose"].includes(normalized);
};

/* Export of the selected pipeline rows - web's handleExportSelectedLeads. */
export const buildLeadExportCsv = (
  rows: Array<{
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
    city?: string;
    assignedTo?: { name?: string } | string | null;
    nextFollowUp?: string | null;
  }>,
  statusLabel: (status?: string) => string,
  formatDate: (value?: string | null) => string,
) => {
  const escape = (value: unknown) => JSON.stringify(String(value ?? ""));
  const header = ["Name", "Phone", "Email", "Status", "City", "Assigned to", "Next follow-up"];
  return [
    header.map(escape).join(","),
    ...rows.map((lead) =>
      [
        lead?.name,
        lead?.phone,
        lead?.email,
        statusLabel(lead?.status),
        lead?.city,
        typeof lead?.assignedTo === "object" ? lead?.assignedTo?.name : "",
        lead?.nextFollowUp ? formatDate(lead.nextFollowUp) : "",
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");
};
