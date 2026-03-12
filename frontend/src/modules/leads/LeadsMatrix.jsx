import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getAllLeads,
  createLead,
  bulkUploadLeads,
  updateLeadStatus,
  assignLead,
  addLeadRelatedProperty,
  selectLeadRelatedProperty,
  removeLeadRelatedProperty,
  getLeadActivity,
  getLeadDiary,
  addLeadDiaryEntry,
} from "../../services/leadService";
import {
  getInventoryAssets,
} from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  AddLeadModal,
  BulkLeadUploadModal,
  LeadsMatrixAlerts,
  LeadsMatrixFilters,
  LeadsMatrixMetrics,
  LeadsMatrixTable,
  LeadsMatrixToolbar,
} from "./components/LeadsMatrixSections";
import { LeadDetailsRebuilt } from "./components/LeadDetailsRebuilt";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT",
  "REQUESTED",
  "CLOSED",
  "LOST",
];
const LEAD_STATUS_SET = new Set(["ALL", ...LEAD_STATUSES]);

const LEAD_SORT_OPTIONS = {
  RECENT: "RECENT",
  FOLLOW_UP: "FOLLOW_UP",
  NAME: "NAME",
};

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];
const MANAGEMENT_ROLES = ["MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"];
const SITE_VISIT_RADIUS_METERS = 200;
const DEAL_PAYMENT_MODES = [
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check / Cheque" },
  { value: "NET_BANKING_NEFTRTGSIMPS", label: "Net Banking (NEFT/RTGS/IMPS)" },
];
const DEAL_PAYMENT_TYPES = [
  { value: "FULL", label: "Full Payment" },
  { value: "PARTIAL", label: "Partial Payment" },
];
const DEAL_PAYMENT_ADMIN_DECISIONS = [
  { value: "APPROVED", label: "Approve Payment" },
  { value: "REJECTED", label: "Reject Payment" },
];
const MAX_PAYMENT_NOTE_LENGTH = 1000;
const MAX_CLOSURE_DOCUMENTS = 20;

const defaultFormData = {
  inventoryId: "",
  name: "",
  phone: "",
  email: "",
  city: "",
  projectInterested: "",
  siteLat: "",
  siteLng: "",
};

const getInventoryLeadLabel = (inventoryLike = {}) =>
  [inventoryLike.projectName, inventoryLike.towerName, inventoryLike.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const sanitizeClosureDocument = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const url = String(value.url || value.secure_url || "").trim();
  if (!url) return null;

  const mimeType = String(value.mimeType || value.type || "").trim();
  const normalizedKind = String(value.kind || "").trim().toLowerCase();
  const derivedKind = mimeType.startsWith("image/")
    ? "image"
    : mimeType === "application/pdf"
      ? "pdf"
      : "file";

  return {
    url: url.slice(0, 2048),
    kind: ["image", "pdf", "file"].includes(normalizedKind) ? normalizedKind : derivedKind,
    mimeType: mimeType.slice(0, 120),
    name: String(value.name || value.original_filename || "").trim().slice(0, 180),
    size: Math.max(0, Math.round(Number(value.size) || 0)),
    uploadedAt: value.uploadedAt || new Date().toISOString(),
    uploadedBy: value.uploadedBy || null,
  };
};

const sanitizeClosureDocumentList = (value) => {
  if (!Array.isArray(value)) return [];

  const dedupe = new Set();
  const rows = [];

  value.forEach((item) => {
    const doc = sanitizeClosureDocument(item);
    if (!doc || dedupe.has(doc.url)) return;
    dedupe.add(doc.url);
    rows.push(doc);
  });

  return rows.slice(0, MAX_CLOSURE_DOCUMENTS);
};

const getLeadRelatedInventories = (lead = {}) => {
  const merged = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged;
};

const getStatusColor = (status) => {
  switch (status) {
    case "NEW":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "CONTACTED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "INTERESTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "SITE_VISIT":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "REQUESTED":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "CLOSED":
      return "bg-slate-900 text-white border-slate-900";
    case "LOST":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const getStatusLabel = (status) =>
  String(status || "")
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const getDateMs = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateTimeInput = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toAmountNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInventoryApiStatus = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Available";
  if (normalized === "Reserved") return "Blocked";
  return normalized;
};

const toInventoryStatusLabel = (value) => {
  const normalized = toInventoryApiStatus(value);
  if (normalized === "Blocked") return "Reserved";
  return normalized;
};

const normalizePhoneDigits = (value) =>
  String(value || "").replace(/\D/g, "");

const getDialerHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  return digits ? `tel:${digits}` : "";
};

const getWhatsAppHref = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";

  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${waNumber}`;
};

const getMailHref = (email) => {
  const trimmed = String(email || "").trim();
  return trimmed ? `mailto:${trimmed}` : "";
};

const getMapsHref = (city) => {
  const trimmed = String(city || "").trim();
  return trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : "";
};

const normalizeCsvHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const resolveLeadCsvHeaderKey = (rawHeader) => {
  const normalized = normalizeCsvHeader(rawHeader);
  if (!normalized) return "";

  if (["name", "leadname", "fullname"].includes(normalized)) return "name";
  if (["phone", "mobile", "mobileno", "phonenumber"].includes(normalized)) return "phone";
  if (["email", "emailid"].includes(normalized)) return "email";
  if (["city", "location"].includes(normalized)) return "city";
  if (["project", "projectinterested", "projectname", "interestedproject"].includes(normalized)) {
    return "projectInterested";
  }
  if (["inventoryid", "propertyid", "unitid", "assetid"].includes(normalized)) {
    return "inventoryId";
  }
  if (["sitelat", "latitude", "lat"].includes(normalized)) return "siteLat";
  if (["sitelng", "longitude", "long", "lng"].includes(normalized)) return "siteLng";
  if (["siteradiusmeters", "radiusmeters", "radius", "siteradius"].includes(normalized)) {
    return "siteRadiusMeters";
  }

  return "";
};

const parseCsvLine = (line) => {
  const values = [];
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

const parseBulkLeadCsvRows = (csvText) => {
  const normalizedText = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .trim();

  if (!normalizedText) {
    throw new Error("CSV data is required");
  }

  const rawLines = normalizedText.split(/\r?\n/);
  const lines = rawLines.map((line) => String(line || "").trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include header and at least one data row");
  }

  const headerCells = parseCsvLine(lines[0]);
  const mappedHeaders = headerCells.map((header) => resolveLeadCsvHeaderKey(header));

  if (!mappedHeaders.includes("name") || !mappedHeaders.includes("phone")) {
    throw new Error("CSV header must include at least name and phone columns");
  }

  const rows = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    const row = {};

    mappedHeaders.forEach((key, cellIndex) => {
      if (!key) return;
      const value = String(cells[cellIndex] || "").trim();
      if (value) {
        row[key] = value;
      }
    });

    if (Object.keys(row).length === 0) {
      continue;
    }

    rows.push(row);
  }

  if (!rows.length) {
    throw new Error("No valid lead rows found in CSV");
  }

  return rows;
};

const WhatsAppIcon = ({ size = 13, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M13.601 2.326A7.854 7.854 0 0 0 8.005 0C3.58 0 0 3.577 0 8a7.9 7.9 0 0 0 1.153 4.095L0 16l4.01-1.127A7.9 7.9 0 0 0 8.005 16C12.425 16 16 12.423 16 8a7.85 7.85 0 0 0-2.399-5.674m-5.595 12.34a6.57 6.57 0 0 1-3.335-.908l-.24-.144-2.38.668.672-2.32-.157-.245a6.57 6.57 0 0 1-1.007-3.508c0-3.626 2.957-6.585 6.59-6.585a6.59 6.59 0 0 1 4.659 1.931A6.6 6.6 0 0 1 14.466 8c0 3.626-2.958 6.666-6.46 6.666m3.615-4.955c-.197-.1-1.17-.578-1.353-.645-.182-.065-.315-.1-.448.1-.132.197-.513.645-.627.776-.115.132-.23.149-.428.05-.197-.1-.833-.306-1.587-.977-.586-.52-.982-1.164-1.097-1.361-.115-.198-.012-.305.087-.404.09-.089.197-.23.296-.347.1-.115.132-.197.198-.33.065-.132.033-.248-.017-.347-.05-.1-.448-1.08-.613-1.48-.161-.387-.325-.334-.448-.34q-.182-.007-.396-.007a.76.76 0 0 0-.545.258c-.182.198-.694.678-.694 1.653s.71 1.92.81 2.052c.098.132 1.393 2.124 3.376 2.977.472.203.84.325 1.128.416.474.15.904.129 1.246.078.38-.057 1.17-.48 1.336-.944.164-.463.164-.86.115-.944-.05-.084-.182-.132-.38-.231" />
  </svg>
);

const LeadsMatrix = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { leadId: routeLeadId = "" } = useParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkUploadText, setBulkUploadText] = useState("");
  const [bulkUploadFileName, setBulkUploadFileName] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState(LEAD_SORT_OPTIONS.RECENT);
  const [showDueOnly, setShowDueOnly] = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [savingDiary, setSavingDiary] = useState(false);
  const [isDiaryMicSupported, setIsDiaryMicSupported] = useState(false);
  const [isDiaryListening, setIsDiaryListening] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [linkingProperty, setLinkingProperty] = useState(false);
  const [propertyActionInventoryId, setPropertyActionInventoryId] = useState("");
  const [propertyActionType, setPropertyActionType] = useState("");

  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [projectInterestedDraft, setProjectInterestedDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [executiveDraft, setExecutiveDraft] = useState("");
  const [siteLatDraft, setSiteLatDraft] = useState("");
  const [siteLngDraft, setSiteLngDraft] = useState("");
  const [relatedInventoryDraft, setRelatedInventoryDraft] = useState("");
  const [paymentModeDraft, setPaymentModeDraft] = useState("");
  const [paymentTypeDraft, setPaymentTypeDraft] = useState("");
  const [paymentRemainingDraft, setPaymentRemainingDraft] = useState("");
  const [paymentReferenceDraft, setPaymentReferenceDraft] = useState("");
  const [paymentNoteDraft, setPaymentNoteDraft] = useState("");
  const [paymentApprovalStatusDraft, setPaymentApprovalStatusDraft] = useState("");
  const [paymentApprovalNoteDraft, setPaymentApprovalNoteDraft] = useState("");
  const [closureDocumentsDraft, setClosureDocumentsDraft] = useState([]);

  const [executives, setExecutives] = useState([]);
  const diaryRecognitionRef = useRef(null);

  const normalizedRouteLeadId = String(routeLeadId || "").trim();
  const isRouteDetailsView = Boolean(normalizedRouteLeadId);
  const currentLeadRouteBase = location.pathname.startsWith("/my-leads")
    ? "/my-leads"
    : "/leads";

  const userRole = localStorage.getItem("role") || "";
  const isExecutiveUser = EXECUTIVE_ROLES.includes(userRole);
  const canAddLead =
    userRole === "ADMIN"
    || MANAGEMENT_ROLES.includes(userRole)
    || userRole === "CHANNEL_PARTNER";
  const canBulkUploadLeads = userRole === "ADMIN";
  const canAssignLead = userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole);
  const canManageLeadProperties = userRole !== "CHANNEL_PARTNER";
  const canConfigureSiteLocation =
    userRole === "ADMIN" || MANAGEMENT_ROLES.includes(userRole);
  const canReviewDealPayment = userRole === "ADMIN";

  const fetchLeads = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const list = await getAllLeads();
      setLeads(Array.isArray(list) ? list : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load leads");
      console.error(`Load leads failed: ${message}`);
      setError(message);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchExecutives = useCallback(async () => {
    if (!canAssignLead) return;

    try {
      const response = await getUsers();
      const users = response?.users || [];
      const list = users.filter(
        (user) => user.isActive && EXECUTIVE_ROLES.includes(user.role),
      );
      setExecutives(list);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load executives");
      console.error(`Load executives failed: ${message}`);
      setExecutives([]);
    }
  }, [canAssignLead]);

  const fetchInventoryOptions = useCallback(async () => {
    if (!canManageLeadProperties) return;

    try {
      const rows = await getInventoryAssets({ page: 1, limit: 200 });
      setInventoryOptions(Array.isArray(rows) ? rows : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load inventory");
      console.error(`Load inventory for leads failed: ${message}`);
      setInventoryOptions([]);
    }
  }, [canManageLeadProperties]);

  useEffect(() => {
    fetchLeads();
    fetchExecutives();
    fetchInventoryOptions();
  }, [fetchLeads, fetchExecutives, fetchInventoryOptions]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 1600);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      if (relatedInventoryDraft !== "") {
        setRelatedInventoryDraft("");
      }
      return;
    }

    const linkedIds = new Set(
      getLeadRelatedInventories(selectedLead).map((row) => toObjectIdString(row)),
    );
    const available = inventoryOptions.filter(
      (inventory) => !linkedIds.has(String(inventory?._id || "")),
    );

    const draftExists = available.some(
      (inventory) => String(inventory?._id || "") === String(relatedInventoryDraft || ""),
    );

    if (!draftExists && relatedInventoryDraft !== "") {
      setRelatedInventoryDraft("");
    }
  }, [selectedLead, inventoryOptions, relatedInventoryDraft]);

  useEffect(() => {
    if (isRouteDetailsView) return;

    const search = new URLSearchParams(location.search || "");
    const statusParam = String(search.get("status") || "").trim().toUpperCase();
    const queryParam = search.get("q");
    const dueParam = String(search.get("due") || "").trim().toLowerCase();

    if (statusParam && LEAD_STATUS_SET.has(statusParam)) {
      setStatusFilter(statusParam);
    } else {
      setStatusFilter("ALL");
    }

    if (queryParam !== null) {
      setQuery(String(queryParam || ""));
    } else {
      setQuery("");
    }

    setShowDueOnly(["1", "true", "yes"].includes(dueParam));
  }, [isRouteDetailsView, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsDiaryMicSupported(false);
      return undefined;
    }

    setIsDiaryMicSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsDiaryListening(true);
    };

    recognition.onend = () => {
      setIsDiaryListening(false);
    };

    recognition.onerror = (event) => {
      const speechError = String(event?.error || "");
      setIsDiaryListening(false);

      if (speechError === "not-allowed" || speechError === "service-not-allowed") {
        setError("Microphone permission denied. Please allow mic access in browser.");
        return;
      }

      if (speechError === "no-speech") {
        setError("No speech detected. Try speaking again.");
        return;
      }

      setError("Voice-to-text failed. Please try again.");
    };

    recognition.onresult = (event) => {
      const chunks = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index]?.[0]?.transcript || "").trim();
        if (transcript) {
          chunks.push(transcript);
        }
      }

      if (!chunks.length) return;

      const incomingText = chunks.join(" ");
      setDiaryDraft((prev) => {
        const normalizedPrev = String(prev || "").trimEnd();
        return normalizedPrev ? `${normalizedPrev} ${incomingText}` : incomingText;
      });
    };

    diaryRecognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
      diaryRecognitionRef.current = null;
    };
  }, []);

  const statusBreakdown = useMemo(
    () =>
      LEAD_STATUSES.reduce(
        (acc, status) => ({ ...acc, [status]: leads.filter((lead) => lead.status === status).length }),
        {},
      ),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const now = Date.now();

    const filtered = leads.filter((lead) => {
      const statusMatch = statusFilter === "ALL" || lead.status === statusFilter;
      const relatedInventorySearchValue = getLeadRelatedInventories(lead)
        .map((inventory) => {
          const inventoryLabel = getInventoryLeadLabel(inventory);
          const inventoryLocation = String(inventory?.location || "").trim();
          return `${inventoryLabel} ${inventoryLocation}`.trim();
        })
        .join(" ");

      const searchMatch =
        !normalized ||
        [
          lead.name,
          lead.phone,
          lead.email,
          lead.city,
          lead.projectInterested,
          lead.assignedTo?.name,
          relatedInventorySearchValue,
        ]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(normalized));

      const followUpMs = getDateMs(lead.nextFollowUp);
      const dueMatch = !showDueOnly || (followUpMs > 0 && followUpMs <= now && !["REQUESTED", "CLOSED", "LOST"].includes(String(lead.status || "")));

      return statusMatch && searchMatch && dueMatch;
    });

    const sorted = [...filtered];
    if (sortBy === LEAD_SORT_OPTIONS.NAME) {
      sorted.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
      return sorted;
    }

    if (sortBy === LEAD_SORT_OPTIONS.FOLLOW_UP) {
      sorted.sort((a, b) => {
        const aMs = getDateMs(a?.nextFollowUp);
        const bMs = getDateMs(b?.nextFollowUp);
        if (!aMs && !bMs) return 0;
        if (!aMs) return 1;
        if (!bMs) return -1;
        return aMs - bMs;
      });
      return sorted;
    }

    sorted.sort((a, b) => {
      const aMs = getDateMs(a?.updatedAt || a?.createdAt);
      const bMs = getDateMs(b?.updatedAt || b?.createdAt);
      return bMs - aMs;
    });
    return sorted;
  }, [leads, query, showDueOnly, sortBy, statusFilter]);

  const metrics = useMemo(() => {
    const closed = statusBreakdown.CLOSED || 0;
    const contacted = statusBreakdown.CONTACTED || 0;
    const interested = statusBreakdown.INTERESTED || 0;
    const fresh = statusBreakdown.NEW || 0;
    const dueFollowUps = leads.filter((lead) => {
      const followUpMs = getDateMs(lead.nextFollowUp);
      return followUpMs > 0 && followUpMs <= Date.now() && !["REQUESTED", "CLOSED", "LOST"].includes(String(lead.status || ""));
    }).length;

    const total = leads.length;
    const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    return {
      total,
      new: fresh,
      contacted,
      interested,
      closed,
      dueFollowUps,
      conversionRate,
    };
  }, [leads, statusBreakdown]);

  const handleMetricSelect = useCallback((metricKey) => {
    switch (metricKey) {
      case "due":
        setShowDueOnly(true);
        setStatusFilter("ALL");
        break;
      case "conversion":
      case "closed":
        setStatusFilter("CLOSED");
        setShowDueOnly(false);
        break;
      case "interested":
        setStatusFilter("INTERESTED");
        setShowDueOnly(false);
        break;
      case "contacted":
        setStatusFilter("CONTACTED");
        setShowDueOnly(false);
        break;
      case "new":
        setStatusFilter("NEW");
        setShowDueOnly(false);
        break;
      default:
        setStatusFilter("ALL");
        setShowDueOnly(false);
        break;
    }
  }, []);

  const openLeadDetails = useCallback(async (lead) => {
    const resolvedLeadId = String(lead?._id || "").trim();
    if (!resolvedLeadId) return;

    const leadSiteLat = toCoordinateNumber(lead?.siteLocation?.lat);
    const leadSiteLng = toCoordinateNumber(lead?.siteLocation?.lng);

    setSelectedLead(lead);
    setNameDraft(String(lead?.name || ""));
    setPhoneDraft(String(lead?.phone || ""));
    setEmailDraft(String(lead?.email || ""));
    setCityDraft(String(lead?.city || ""));
    setProjectInterestedDraft(String(lead?.projectInterested || ""));
    setStatusDraft(lead.status || "NEW");
    setFollowUpDraft(toDateTimeInput(lead.nextFollowUp));
    setSiteLatDraft(leadSiteLat === null ? "" : String(leadSiteLat));
    setSiteLngDraft(leadSiteLng === null ? "" : String(leadSiteLng));
    setExecutiveDraft(
      typeof lead.assignedTo === "string"
        ? lead.assignedTo
        : lead.assignedTo?._id || "",
    );
    setRelatedInventoryDraft("");
    setPaymentModeDraft(String(lead?.dealPayment?.mode || ""));
    setPaymentTypeDraft(String(lead?.dealPayment?.paymentType || ""));
    setPaymentRemainingDraft(
      lead?.dealPayment?.remainingAmount === null || lead?.dealPayment?.remainingAmount === undefined
        ? ""
        : String(lead.dealPayment.remainingAmount),
    );
    setPaymentReferenceDraft(String(lead?.dealPayment?.paymentReference || ""));
    setPaymentNoteDraft(String(lead?.dealPayment?.note || ""));
    setPaymentApprovalStatusDraft("");
    setPaymentApprovalNoteDraft(String(lead?.dealPayment?.approvalNote || ""));
    setClosureDocumentsDraft(sanitizeClosureDocumentList(lead?.closureDocuments));
    setDiaryDraft("");
    setIsDetailsOpen(true);

    setActivityLoading(true);
    setDiaryLoading(true);
    const [timelineResult, diaryResult] = await Promise.allSettled([
      getLeadActivity(resolvedLeadId),
      getLeadDiary(resolvedLeadId),
    ]);

    if (timelineResult.status === "fulfilled") {
      setActivities(Array.isArray(timelineResult.value) ? timelineResult.value : []);
    } else {
      const message = toErrorMessage(timelineResult.reason, "Failed to load activity");
      console.error(`Load lead activity failed: ${message}`);
      setActivities([]);
    }

    if (diaryResult.status === "fulfilled") {
      setDiaryEntries(Array.isArray(diaryResult.value) ? diaryResult.value : []);
    } else {
      const message = toErrorMessage(diaryResult.reason, "Failed to load lead diary");
      console.error(`Load lead diary failed: ${message}`);
      setDiaryEntries([]);
    }

    setActivityLoading(false);
    setDiaryLoading(false);
  }, []);

  const closeDetails = useCallback(() => {
    if (diaryRecognitionRef.current && isDiaryListening) {
      try {
        diaryRecognitionRef.current.stop();
      } catch {
        // no-op
      }
    }
    setIsDetailsOpen(false);
    setSelectedLead(null);
    setActivities([]);
    setDiaryEntries([]);
    setDiaryDraft("");
    setNameDraft("");
    setPhoneDraft("");
    setEmailDraft("");
    setCityDraft("");
    setProjectInterestedDraft("");
    setSiteLatDraft("");
    setSiteLngDraft("");
    setRelatedInventoryDraft("");
    setPaymentModeDraft("");
    setPaymentTypeDraft("");
    setPaymentRemainingDraft("");
    setPaymentReferenceDraft("");
    setPaymentNoteDraft("");
    setPaymentApprovalStatusDraft("");
    setPaymentApprovalNoteDraft("");
    setClosureDocumentsDraft([]);
    if (normalizedRouteLeadId) {
      navigate(currentLeadRouteBase);
    }
  }, [currentLeadRouteBase, isDiaryListening, navigate, normalizedRouteLeadId]);

  const handleOpenLeadDetailsPage = useCallback((lead) => {
    const resolvedLeadId = String(lead?._id || "").trim();
    if (!resolvedLeadId) return;
    navigate(`${currentLeadRouteBase}/${resolvedLeadId}`);
  }, [currentLeadRouteBase, navigate]);

  useEffect(() => {
    if (!isRouteDetailsView) {
      if (isDetailsOpen) {
        closeDetails();
      }
      return;
    }

    if (loading) return;

    const selectedId = String(selectedLead?._id || "").trim();
    if (selectedId && selectedId === normalizedRouteLeadId && isDetailsOpen) {
      return;
    }

    const targetLead = leads.find(
      (lead) => String(lead?._id || "").trim() === normalizedRouteLeadId,
    );

    if (!targetLead) {
      setError("Lead not found or you do not have access to this lead");
      setSelectedLead(null);
      setIsDetailsOpen(false);
      setActivities([]);
      setDiaryEntries([]);
      return;
    }

    openLeadDetails(targetLead);
  }, [
    closeDetails,
    isDetailsOpen,
    isRouteDetailsView,
    leads,
    loading,
    normalizedRouteLeadId,
    openLeadDetails,
    selectedLead?._id,
  ]);

  const applyUpdatedLeadState = (updatedLead) => {
    if (!updatedLead) return;

    setLeads((prev) =>
      prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
    );
    setSelectedLead(updatedLead);
    setNameDraft(String(updatedLead?.name || ""));
    setPhoneDraft(String(updatedLead?.phone || ""));
    setEmailDraft(String(updatedLead?.email || ""));
    setCityDraft(String(updatedLead?.city || ""));
    setProjectInterestedDraft(String(updatedLead?.projectInterested || ""));
    setStatusDraft(String(updatedLead.status || "NEW"));
    setFollowUpDraft(toDateTimeInput(updatedLead?.nextFollowUp));

    const nextSiteLat = toCoordinateNumber(updatedLead?.siteLocation?.lat);
    const nextSiteLng = toCoordinateNumber(updatedLead?.siteLocation?.lng);
    setSiteLatDraft(nextSiteLat === null ? "" : String(nextSiteLat));
    setSiteLngDraft(nextSiteLng === null ? "" : String(nextSiteLng));
    setPaymentModeDraft(String(updatedLead?.dealPayment?.mode || ""));
    setPaymentTypeDraft(String(updatedLead?.dealPayment?.paymentType || ""));
    setPaymentRemainingDraft(
      updatedLead?.dealPayment?.remainingAmount === null
      || updatedLead?.dealPayment?.remainingAmount === undefined
        ? ""
        : String(updatedLead.dealPayment.remainingAmount),
    );
    setPaymentReferenceDraft(String(updatedLead?.dealPayment?.paymentReference || ""));
    setPaymentNoteDraft(String(updatedLead?.dealPayment?.note || ""));
    setPaymentApprovalStatusDraft("");
    setPaymentApprovalNoteDraft(String(updatedLead?.dealPayment?.approvalNote || ""));
    setClosureDocumentsDraft(sanitizeClosureDocumentList(updatedLead?.closureDocuments));
  };

  const handleInventorySelection = (inventoryId) => {
    setFormData((prev) => {
      const selectedInventory = inventoryOptions.find((item) => item._id === inventoryId);
      if (!selectedInventory) {
        return {
          ...prev,
          inventoryId,
        };
      }

      const inventoryProjectLabel = getInventoryLeadLabel(selectedInventory);
      const inventorySiteLat = toCoordinateNumber(selectedInventory?.siteLocation?.lat);
      const inventorySiteLng = toCoordinateNumber(selectedInventory?.siteLocation?.lng);

      return {
        ...prev,
        inventoryId,
        projectInterested: inventoryProjectLabel || prev.projectInterested,
        city: String(selectedInventory.location || "").trim() || prev.city,
        siteLat: inventorySiteLat === null ? "" : String(inventorySiteLat),
        siteLng: inventorySiteLng === null ? "" : String(inventorySiteLng),
      };
    });
  };

  const handleSaveLead = async () => {
    if (!canAddLead) return;

    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    const parsedSiteLat = toCoordinateNumber(formData.siteLat);
    const parsedSiteLng = toCoordinateNumber(formData.siteLng);
    const hasAnySiteCoordinate =
      parsedSiteLat !== null || parsedSiteLng !== null;

    if (
      hasAnySiteCoordinate
      && (parsedSiteLat === null || parsedSiteLng === null)
    ) {
      setError("Enter valid site latitude and longitude");
      return;
    }

    try {
      setSavingLead(true);
      setError("");

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        projectInterested: formData.projectInterested.trim(),
      };

      if (formData.inventoryId) {
        payload.inventoryId = formData.inventoryId;
      }

      if (hasAnySiteCoordinate) {
        payload.siteLocation = {
          lat: parsedSiteLat,
          lng: parsedSiteLng,
          radiusMeters: SITE_VISIT_RADIUS_METERS,
        };
      }

      const created = await createLead(payload);

      if (created) {
        setLeads((prev) => [created, ...prev]);
      } else {
        await fetchLeads(true);
      }

      setIsAddModalOpen(false);
      setFormData(defaultFormData);
      setSuccess("Lead created successfully");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save lead");
      console.error(`Create lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingLead(false);
    }
  };

  const handleBulkUploadFileSelect = async (file) => {
    if (!file) return;

    try {
      const csvText = await file.text();
      setBulkUploadText(String(csvText || ""));
      setBulkUploadFileName(String(file.name || ""));
      setError("");
    } catch {
      setError("Unable to read selected CSV file");
    }
  };

  const handleBulkUploadLeads = async () => {
    if (!canBulkUploadLeads) return;

    try {
      setBulkUploading(true);
      setError("");

      const rows = parseBulkLeadCsvRows(bulkUploadText);
      const result = await bulkUploadLeads(rows);
      await fetchLeads(true);

      const createdCount = Number(result?.createdCount || 0);
      const failedCount = Number(result?.failedCount || 0);
      setSuccess(`Bulk upload complete: ${createdCount} created, ${failedCount} failed`);

      const failures = Array.isArray(result?.failures) ? result.failures : [];
      if (failedCount > 0 && failures.length) {
        const preview = failures
          .slice(0, 5)
          .map((failure) => `Row ${failure.row}: ${failure.message}`)
          .join(" | ");
        setError(
          failures.length > 5
            ? `Some rows failed. ${preview} | ...`
            : `Some rows failed. ${preview}`,
        );
      } else {
        setIsBulkUploadModalOpen(false);
        setBulkUploadText("");
        setBulkUploadFileName("");
      }
    } catch (uploadError) {
      const message = toErrorMessage(uploadError, "Failed to bulk upload leads");
      console.error(`Bulk upload leads failed: ${message}`);
      setError(message);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      setSavingUpdates(true);
      setError("");

      const parsedSiteLat = toCoordinateNumber(siteLatDraft);
      const parsedSiteLng = toCoordinateNumber(siteLngDraft);
      const hasAnySiteCoordinate =
        parsedSiteLat !== null || parsedSiteLng !== null;
      const normalizedStatusDraft = String(statusDraft || "").trim().toUpperCase();
      const normalizedLeadStatus = String(selectedLead?.status || "").trim().toUpperCase();
      const normalizedNameDraft = String(nameDraft || "").trim();
      const normalizedPhoneDraft = String(phoneDraft || "").trim();
      const normalizedExistingPhone = String(selectedLead?.phone || "").trim();
      const normalizedEmailDraft = String(emailDraft || "").trim();
      const normalizedCityDraft = String(cityDraft || "").trim();
      const normalizedProjectInterestedDraft = String(projectInterestedDraft || "").trim();
      const normalizedFollowUpDraft = String(followUpDraft || "").trim();
      const hasFollowUpDraft = normalizedFollowUpDraft.length > 0;
      const parsedFollowUpDate = hasFollowUpDraft ? new Date(normalizedFollowUpDraft) : null;
      const parsedPaymentRemaining = toAmountNumber(paymentRemainingDraft);
      const existingPaymentRemaining = toAmountNumber(selectedLead?.dealPayment?.remainingAmount);
      const normalizedPaymentMode = String(paymentModeDraft || "").trim().toUpperCase();
      const normalizedPaymentType = String(paymentTypeDraft || "").trim().toUpperCase();
      const existingPaymentType = String(selectedLead?.dealPayment?.paymentType || "").trim().toUpperCase();
      const effectivePaymentType = normalizedPaymentType || existingPaymentType;
      const effectiveRemainingAmount =
        effectivePaymentType === "PARTIAL"
          ? (paymentRemainingDraft !== "" ? parsedPaymentRemaining : existingPaymentRemaining)
          : 0;
      const normalizedApprovalStatus = String(paymentApprovalStatusDraft || "")
        .trim()
        .toUpperCase();
      const trimmedPaymentReference = String(paymentReferenceDraft || "").trim();
      const trimmedPaymentNote = String(paymentNoteDraft || "").trim();
      const trimmedApprovalNote = String(paymentApprovalNoteDraft || "").trim();
      const isClosedFlow =
        ["CLOSED", "REQUESTED"].includes(normalizedStatusDraft)
        || ["CLOSED", "REQUESTED"].includes(normalizedLeadStatus);
      const isExecutiveClosingDeal =
        isExecutiveUser
        && normalizedStatusDraft === "CLOSED"
        && normalizedLeadStatus !== "CLOSED";
      const requiresRemainingPaymentFollowUp =
        isClosedFlow
        && effectivePaymentType === "PARTIAL"
        && Number.isFinite(effectiveRemainingAmount)
        && effectiveRemainingAmount > 0;

      if (
        canConfigureSiteLocation
        && hasAnySiteCoordinate
        && (parsedSiteLat === null || parsedSiteLng === null)
      ) {
        setError("Enter valid site latitude and longitude");
        setSavingUpdates(false);
        return;
      }

      if (!normalizedNameDraft) {
        setError("Name is required");
        setSavingUpdates(false);
        return;
      }

      if (
        normalizedPhoneDraft !== normalizedExistingPhone
        && (!normalizedPhoneDraft || !/^\d{8,15}$/.test(normalizedPhoneDraft))
      ) {
        setError("Phone should be 8 to 15 digits");
        setSavingUpdates(false);
        return;
      }

      if (hasFollowUpDraft && Number.isNaN(parsedFollowUpDate?.getTime())) {
        setError("Enter a valid follow-up date and time");
        setSavingUpdates(false);
        return;
      }

      if (trimmedPaymentNote.length > MAX_PAYMENT_NOTE_LENGTH) {
        setError(`Payment note can be up to ${MAX_PAYMENT_NOTE_LENGTH} characters only`);
        setSavingUpdates(false);
        return;
      }

      if (trimmedApprovalNote.length > MAX_PAYMENT_NOTE_LENGTH) {
        setError(`Approval note can be up to ${MAX_PAYMENT_NOTE_LENGTH} characters only`);
        setSavingUpdates(false);
        return;
      }

      if (isExecutiveClosingDeal) {
        if (!normalizedPaymentMode) {
          setError("Payment mode is required when closing the deal");
          setSavingUpdates(false);
          return;
        }
        if (!normalizedPaymentType) {
          setError("Payment type is required when closing the deal");
          setSavingUpdates(false);
          return;
        }
      }

      if (
        isClosedFlow
        && effectivePaymentType === "PARTIAL"
        && (effectiveRemainingAmount === null || effectiveRemainingAmount <= 0)
      ) {
        setError("Enter remaining amount greater than 0 for partial payment");
        setSavingUpdates(false);
        return;
      }

      if (requiresRemainingPaymentFollowUp && !hasFollowUpDraft) {
        setError("Set follow-up date/time for remaining payment collection");
        setSavingUpdates(false);
        return;
      }

      if (
        isExecutiveUser
        && isClosedFlow
        && normalizedPaymentMode
        && normalizedPaymentMode !== "CASH"
        && !trimmedPaymentReference
      ) {
        setError("UTR / transaction / cheque number is required for non-cash payment");
        setSavingUpdates(false);
        return;
      }

      if (
        canReviewDealPayment
        && normalizedApprovalStatus
        && !["APPROVED", "REJECTED"].includes(normalizedApprovalStatus)
      ) {
        setError("Admin decision must be Approve or Reject");
        setSavingUpdates(false);
        return;
      }

      const payload = {
        name: normalizedNameDraft,
        phone: normalizedPhoneDraft,
        email: normalizedEmailDraft,
        city: normalizedCityDraft,
        projectInterested: normalizedProjectInterestedDraft,
        status: statusDraft,
      };

      if (hasFollowUpDraft) {
        payload.nextFollowUp = normalizedFollowUpDraft;
      }

      if (canConfigureSiteLocation && hasAnySiteCoordinate) {
        payload.siteLocation = {
          lat: parsedSiteLat,
          lng: parsedSiteLng,
          radiusMeters: SITE_VISIT_RADIUS_METERS,
        };
      }

      if (isClosedFlow) {
        const dealPaymentPayload = {};

        if (normalizedPaymentMode) {
          dealPaymentPayload.mode = normalizedPaymentMode;
        }

        if (normalizedPaymentType) {
          dealPaymentPayload.paymentType = normalizedPaymentType;
        }

        if (effectivePaymentType === "FULL") {
          dealPaymentPayload.remainingAmount = 0;
        } else if (effectivePaymentType === "PARTIAL" && effectiveRemainingAmount !== null) {
          dealPaymentPayload.remainingAmount = effectiveRemainingAmount;
        }

        if (normalizedPaymentMode === "CASH") {
          dealPaymentPayload.paymentReference = "";
        } else if (trimmedPaymentReference) {
          dealPaymentPayload.paymentReference = trimmedPaymentReference;
        }

        if (trimmedPaymentNote) {
          dealPaymentPayload.note = trimmedPaymentNote;
        }

        if (canReviewDealPayment) {
          if (normalizedApprovalStatus) {
            dealPaymentPayload.approvalStatus = normalizedApprovalStatus;
          }
          if (trimmedApprovalNote) {
            dealPaymentPayload.approvalNote = trimmedApprovalNote;
          }
        }

        if (Object.keys(dealPaymentPayload).length > 0) {
          payload.dealPayment = dealPaymentPayload;
        }
      }

      if (String(statusDraft || "").toUpperCase() === "CLOSED") {
        payload.closureDocuments = sanitizeClosureDocumentList(closureDocumentsDraft);
      }

      const updatedLead = await updateLeadStatus(selectedLead._id, payload);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead updated");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setSuccess("Lead updated");
    } catch (updateError) {
      const message = toErrorMessage(updateError, "Failed to update lead");
      console.error(`Update lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingUpdates(false);
    }
  };

  const handleAssignLead = async () => {
    if (!canAssignLead || !selectedLead || !executiveDraft) return;

    try {
      setAssigning(true);
      setError("");

      const updatedLead = await assignLead(selectedLead._id, executiveDraft);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead assigned");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
      );
      setSelectedLead(updatedLead);
      setSuccess("Lead assigned");
    } catch (assignError) {
      const message = toErrorMessage(assignError, "Failed to assign lead");
      console.error(`Assign lead failed: ${message}`);
      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleLinkPropertyToLead = async (inventoryIdOverride = "") => {
    const inventoryId = String(inventoryIdOverride || relatedInventoryDraft || "").trim();
    if (!selectedLead || !inventoryId) return;

    try {
      setLinkingProperty(true);
      setError("");

      const updatedLead = await addLeadRelatedProperty(
        selectedLead._id,
        inventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Property linked");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setRelatedInventoryDraft("");
      setSuccess("Property linked");
    } catch (linkError) {
      const message = toErrorMessage(linkError, "Failed to link property");
      console.error(`Link property failed: ${message}`);
      setError(message);
    } finally {
      setLinkingProperty(false);
    }
  };

  const handleSelectRelatedProperty = async (
    inventoryId,
    options = {},
  ) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!selectedLead || !resolvedInventoryId) return false;
    const { showSuccess = true } = options;

    try {
      setPropertyActionType("select");
      setPropertyActionInventoryId(resolvedInventoryId);
      setError("");

      const updatedLead = await selectLeadRelatedProperty(
        selectedLead._id,
        resolvedInventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        if (showSuccess) {
          setSuccess("Property selected");
        }
        return false;
      }

      applyUpdatedLeadState(updatedLead);
      if (showSuccess) {
        setSuccess("Property selected");
      }
      return true;
    } catch (selectError) {
      const message = toErrorMessage(selectError, "Failed to select property");
      console.error(`Select related property failed: ${message}`);
      setError(message);
      return false;
    } finally {
      setPropertyActionType("");
      setPropertyActionInventoryId("");
    }
  };

  const handleOpenRelatedProperty = async (inventoryId) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!resolvedInventoryId) return;

    await handleSelectRelatedProperty(resolvedInventoryId, {
      showSuccess: false,
    });

    navigate(`/inventory/${resolvedInventoryId}`);
  };

  const handleRemoveRelatedProperty = async (inventoryId) => {
    const resolvedInventoryId = String(inventoryId || "").trim();
    if (!selectedLead || !resolvedInventoryId) return;

    const confirmed = window.confirm("Remove this property from lead?");
    if (!confirmed) return;

    try {
      setPropertyActionType("remove");
      setPropertyActionInventoryId(resolvedInventoryId);
      setError("");

      const updatedLead = await removeLeadRelatedProperty(
        selectedLead._id,
        resolvedInventoryId,
      );

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Property removed");
        return;
      }

      applyUpdatedLeadState(updatedLead);
      setRelatedInventoryDraft("");
      setSuccess("Property removed");
    } catch (removeError) {
      const message = toErrorMessage(removeError, "Failed to remove property");
      console.error(`Remove related property failed: ${message}`);
      setError(message);
    } finally {
      setPropertyActionType("");
      setPropertyActionInventoryId("");
    }
  };

  const handleAddDiary = async () => {
    if (!selectedLead) return;

    const note = diaryDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setSavingDiary(true);
      setError("");

      const createdEntry = await addLeadDiaryEntry(selectedLead._id, note);
      if (createdEntry) {
        setDiaryEntries((prev) => [createdEntry, ...prev]);
      } else {
        const diary = await getLeadDiary(selectedLead._id);
        setDiaryEntries(Array.isArray(diary) ? diary : []);
      }

      const timeline = await getLeadActivity(selectedLead._id);
      setActivities(Array.isArray(timeline) ? timeline : []);
      setDiaryDraft("");
      setSuccess("Diary note added");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save diary note");
      console.error(`Save lead diary failed: ${message}`);
      setError(message);
    } finally {
      setSavingDiary(false);
    }
  };

  const handleDiaryVoiceToggle = () => {
    if (!isDiaryMicSupported || !diaryRecognitionRef.current) {
      setError("Voice-to-text is not supported in this browser.");
      return;
    }

    setError("");

    try {
      if (isDiaryListening) {
        diaryRecognitionRef.current.stop();
        return;
      }
      diaryRecognitionRef.current.start();
    } catch {
      setError("Unable to start microphone. Try again.");
    }
  };

  const selectedLeadDialerHref = getDialerHref(selectedLead?.phone);
  const selectedLeadWhatsAppHref = getWhatsAppHref(selectedLead?.phone);
  const selectedLeadMailHref = getMailHref(selectedLead?.email);
  const selectedLeadMapsHref = getMapsHref(selectedLead?.city);
  const selectedLeadSiteLat = toCoordinateNumber(selectedLead?.siteLocation?.lat);
  const selectedLeadSiteLng = toCoordinateNumber(selectedLead?.siteLocation?.lng);
  const selectedLeadRelatedInventories = getLeadRelatedInventories(selectedLead);
  const selectedLeadActiveInventoryId = toObjectIdString(selectedLead?.inventoryId);
  const availableRelatedInventoryOptions = inventoryOptions;

  return (
    <div
      className={`relative w-full h-full px-2.5 sm:px-6 lg:px-10 pt-2 sm:pt-8 md:pt-10 pb-6 flex flex-col overflow-x-hidden overflow-y-auto custom-scrollbar ${
        isDark ? "bg-slate-950" : "bg-slate-50/80"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 ${
        isDark
          ? "bg-[radial-gradient(circle_at_10%_10%,rgba(6,182,212,0.14),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.1),transparent_32%)]"
          : "bg-[radial-gradient(circle_at_12%_8%,rgba(14,165,233,0.1),transparent_40%),radial-gradient(circle_at_86%_10%,rgba(16,185,129,0.12),transparent_34%)]"
      }`} />
      <div className={`relative z-10 flex flex-col ${isRouteDetailsView ? "" : "flex-1"}`}>
        {isRouteDetailsView ? (
          <>
            <LeadsMatrixAlerts isDark={isDark} error={error} success={success} />

            {loading && !selectedLead ? (
              <div className={`flex min-h-[220px] items-center justify-center rounded-2xl border text-sm ${
                isDark
                  ? "border-slate-700 bg-slate-900/75 text-slate-400"
                  : "border-slate-200 bg-white text-slate-500"
              }`}>
                Loading lead details...
              </div>
            ) : null}

            {!loading && !selectedLead ? (
              <div className={`rounded-2xl border p-4 text-sm ${
                isDark
                  ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}>
                Lead details unavailable. The lead may be deleted or not accessible in your scope.
              </div>
            ) : null}
          </>
        ) : (
          <>
            <LeadsMatrixToolbar
              isDark={isDark}
              refreshing={refreshing}
              canAddLead={canAddLead}
              canBulkUploadLeads={canBulkUploadLeads}
              onRefresh={() => fetchLeads(true)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenBulkUploadModal={() => setIsBulkUploadModalOpen(true)}
              totalLeads={metrics.total}
              filteredLeads={filteredLeads.length}
              dueFollowUps={metrics.dueFollowUps}
            />

            <LeadsMatrixAlerts isDark={isDark} error={error} success={success} />

            <LeadsMatrixMetrics
              isDark={isDark}
              metrics={metrics}
              statusFilter={statusFilter}
              showDueOnly={showDueOnly}
              onMetricSelect={handleMetricSelect}
            />

            <LeadsMatrixFilters
              isDark={isDark}
              query={query}
              onQueryChange={setQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              leadStatuses={LEAD_STATUSES}
              statusBreakdown={statusBreakdown}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              showDueOnly={showDueOnly}
              onShowDueOnlyChange={setShowDueOnly}
              getStatusLabel={getStatusLabel}
            />

            <LeadsMatrixTable
              isDark={isDark}
              loading={loading}
              filteredLeads={filteredLeads}
              onOpenLeadDetails={handleOpenLeadDetailsPage}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              formatDate={formatDate}
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {isAddModalOpen && canAddLead && (
          <AddLeadModal
            isDark={isDark}
            formData={formData}
            setFormData={setFormData}
            inventoryOptions={inventoryOptions}
            getInventoryLeadLabel={getInventoryLeadLabel}
            onInventorySelection={handleInventorySelection}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleSaveLead}
            savingLead={savingLead}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkUploadModalOpen && canBulkUploadLeads && (
          <BulkLeadUploadModal
            isDark={isDark}
            csvText={bulkUploadText}
            onCsvTextChange={setBulkUploadText}
            selectedFileName={bulkUploadFileName}
            onFileSelect={handleBulkUploadFileSelect}
            onClose={() => setIsBulkUploadModalOpen(false)}
            onUpload={handleBulkUploadLeads}
            uploading={bulkUploading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRouteDetailsView && isDetailsOpen && selectedLead && (
          <LeadDetailsRebuilt
            isDark={isDark}
            selectedLead={selectedLead}
            onClose={closeDetails}
            selectedLeadDialerHref={selectedLeadDialerHref}
            selectedLeadWhatsAppHref={selectedLeadWhatsAppHref}
            selectedLeadMailHref={selectedLeadMailHref}
            selectedLeadMapsHref={selectedLeadMapsHref}
            selectedLeadRelatedInventories={selectedLeadRelatedInventories}
            selectedLeadActiveInventoryId={selectedLeadActiveInventoryId}
            propertyActionType={propertyActionType}
            propertyActionInventoryId={propertyActionInventoryId}
            canManageLeadProperties={canManageLeadProperties}
            toInventoryApiStatus={toInventoryApiStatus}
            toInventoryStatusLabel={toInventoryStatusLabel}
            onSelectRelatedProperty={handleSelectRelatedProperty}
            onOpenRelatedProperty={handleOpenRelatedProperty}
            onRemoveRelatedProperty={handleRemoveRelatedProperty}
            availableRelatedInventoryOptions={availableRelatedInventoryOptions}
            relatedInventoryDraft={relatedInventoryDraft}
            setRelatedInventoryDraft={setRelatedInventoryDraft}
            linkingProperty={linkingProperty}
            onLinkPropertyToLead={handleLinkPropertyToLead}
            leadStatuses={LEAD_STATUSES}
            nameDraft={nameDraft}
            setNameDraft={setNameDraft}
            phoneDraft={phoneDraft}
            setPhoneDraft={setPhoneDraft}
            emailDraft={emailDraft}
            setEmailDraft={setEmailDraft}
            cityDraft={cityDraft}
            setCityDraft={setCityDraft}
            projectInterestedDraft={projectInterestedDraft}
            setProjectInterestedDraft={setProjectInterestedDraft}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            followUpDraft={followUpDraft}
            setFollowUpDraft={setFollowUpDraft}
            dealPaymentModes={DEAL_PAYMENT_MODES}
            dealPaymentTypes={DEAL_PAYMENT_TYPES}
            dealPaymentAdminDecisions={DEAL_PAYMENT_ADMIN_DECISIONS}
            paymentModeDraft={paymentModeDraft}
            setPaymentModeDraft={setPaymentModeDraft}
            paymentTypeDraft={paymentTypeDraft}
            setPaymentTypeDraft={setPaymentTypeDraft}
            paymentRemainingDraft={paymentRemainingDraft}
            setPaymentRemainingDraft={setPaymentRemainingDraft}
            paymentReferenceDraft={paymentReferenceDraft}
            setPaymentReferenceDraft={setPaymentReferenceDraft}
            paymentNoteDraft={paymentNoteDraft}
            setPaymentNoteDraft={setPaymentNoteDraft}
            paymentApprovalStatusDraft={paymentApprovalStatusDraft}
            setPaymentApprovalStatusDraft={setPaymentApprovalStatusDraft}
            paymentApprovalNoteDraft={paymentApprovalNoteDraft}
            setPaymentApprovalNoteDraft={setPaymentApprovalNoteDraft}
            closureDocumentsDraft={closureDocumentsDraft}
            setClosureDocumentsDraft={setClosureDocumentsDraft}
            canReviewDealPayment={canReviewDealPayment}
            siteLatDraft={siteLatDraft}
            setSiteLatDraft={setSiteLatDraft}
            siteLngDraft={siteLngDraft}
            setSiteLngDraft={setSiteLngDraft}
            canConfigureSiteLocation={canConfigureSiteLocation}
            selectedLeadSiteLat={selectedLeadSiteLat}
            selectedLeadSiteLng={selectedLeadSiteLng}
            siteVisitRadiusMeters={SITE_VISIT_RADIUS_METERS}
            userRole={userRole}
            onUpdateLead={handleUpdateLead}
            savingUpdates={savingUpdates}
            canAssignLead={canAssignLead}
            executiveDraft={executiveDraft}
            setExecutiveDraft={setExecutiveDraft}
            executives={executives}
            onAssignLead={handleAssignLead}
            assigning={assigning}
            diaryDraft={diaryDraft}
            setDiaryDraft={setDiaryDraft}
            onDiaryVoiceToggle={handleDiaryVoiceToggle}
            savingDiary={savingDiary}
            isDiaryMicSupported={isDiaryMicSupported}
            isDiaryListening={isDiaryListening}
            onAddDiary={handleAddDiary}
            diaryLoading={diaryLoading}
            diaryEntries={diaryEntries}
            activityLoading={activityLoading}
            activities={activities}
            formatDate={formatDate}
            getInventoryLeadLabel={getInventoryLeadLabel}
            toObjectIdString={toObjectIdString}
            WhatsAppIcon={WhatsAppIcon}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadsMatrix;

