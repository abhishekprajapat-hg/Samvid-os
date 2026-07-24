import React from "react";
import { motion as Motion } from "framer-motion";
import { createInventoryShareLink } from "../../../services/inventoryService";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  History,
  Image,
  Loader,
  Mail,
  MapPin,
  Mic,
  MicOff,
  Phone,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  getTasks as apiGetTasks,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
} from "../../../services/taskService";
import {
  FURNISHING_OPTIONS,
  getPropertySubtypeConfig,
  getPropertySubtypeLabel,
  getPropertySubtypeOptions,
} from "../../../config/propertyRequirementConfig";

const CUSTOM_NUMBER_OPTION_VALUE = "__CUSTOM_NUMBER__";

const RequirementAdornedInput = ({
  adornment,
  adornmentPosition = "left",
  inputClassName,
  isDark,
  ...inputProps
}) => (
  <div className="relative">
    <input
      {...inputProps}
      className={`${inputClassName} ${adornmentPosition === "left" ? "pl-8" : "pr-10"}`}
    />
    <span
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-bold ${
        adornmentPosition === "left" ? "left-2.5" : "right-2.5"
      } ${isDark ? "text-slate-400" : "text-slate-500"}`}
    >
      {adornment}
    </span>
  </div>
);

const approvalLabel = (status) => {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
};

const statusLabel = (status) =>
  String(status || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getUserDisplayName = (user, fallback = "-") => {
  if (!user) return fallback;
  if (typeof user === "string") return user || fallback;
  const name = String(user?.name || "").trim();
  const role = String(user?.role || "").trim();
  if (name && role) return `${name} (${statusLabel(role)})`;
  return name || role || fallback;
};

const getAssignmentActionLabel = (action) => {
  const normalized = String(action || "").trim().toUpperCase();
  if (normalized === "LEAD_CREATED") return "Lead Created";
  if (normalized === "AUTO_ASSIGNED") return "Auto Assigned";
  if (normalized === "QUALIFIED") return "Qualified";
  if (normalized === "MANUAL_TRANSFER") return "Manual Transfer";
  if (normalized === "REASSIGNED") return "Reassigned";
  if (normalized === "CLOSED") return "Closed";
  return statusLabel(normalized || "UPDATE");
};

const getAssignmentEventTime = (event) => {
  const date = new Date(event?.createdAt || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const buildAssignmentHistoryEvents = (lead = {}) => {
  const events = [];

  if (lead?.createdAt) {
    events.push({
      _id: `${lead?._id || "lead"}-created`,
      action: "LEAD_CREATED",
      toUser: lead?.assignedTo || null,
      reason: "",
      statusAtTransfer: "NEW",
      createdAt: lead.createdAt,
      createdBy: lead?.createdBy || null,
      synthetic: true,
    });
  }

  if (Array.isArray(lead?.assignmentHistory)) {
    lead.assignmentHistory.forEach((event, index) => {
      if (!event || typeof event !== "object") return;
      events.push({
        _id: event._id || `${lead?._id || "lead"}-assignment-${index}`,
        action: event.action || "REASSIGNED",
        fromUser: event.fromUser || null,
        toUser: event.toUser || null,
        reason: event.reason || "",
        statusAtTransfer: event.statusAtTransfer || "",
        createdAt: event.createdAt || lead.updatedAt || lead.createdAt,
        createdBy: event.createdBy || null,
      });
    });
  }

  const isClosed = String(lead?.status || "").trim().toUpperCase() === "CLOSED";
  if (isClosed) {
    events.push({
      _id: `${lead?._id || "lead"}-closed`,
      action: "CLOSED",
      fromUser: lead?.assignedTo || null,
      toUser: lead?.assignedTo || null,
      reason: lead?.dealPayment?.note || "",
      statusAtTransfer: "CLOSED",
      createdAt: lead?.brokerageClosedAt || lead?.updatedAt || lead?.createdAt,
      createdBy: lead?.brokerageClosedBy || lead?.dealPayment?.approvalReviewedBy || null,
      synthetic: true,
    });
  }

  return events
    .filter((event) => event?.createdAt || event?.action)
    .sort((a, b) => getAssignmentEventTime(b) - getAssignmentEventTime(a));
};

const INR_CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatCurrencyInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "On request";
  return INR_CURRENCY_FORMATTER.format(amount);
};

const toTitleCaseLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getInventoryLocationLabel = (inventory = {}) => {
  const parts = [inventory?.city, inventory?.area, inventory?.pincode]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(", ");
  return String(inventory?.location || "").trim();
};

const getInventorySubtypeLabel = (inventory = {}) => {
  const inventoryType = String(inventory?.inventoryType || "").trim().toUpperCase();
  if (inventoryType === "COMMERCIAL") {
    return toTitleCaseLabel(inventory?.commercialDetails?.officeType);
  }
  if (inventoryType === "RESIDENTIAL") {
    return toTitleCaseLabel(
      inventory?.residentialDetails?.bhkType
      || inventory?.residentialDetails?.propertyType,
    );
  }
  return "";
};

const getInventoryAreaLabel = (inventory = {}) => {
  const totalArea = Number(inventory?.totalArea);
  if (!Number.isFinite(totalArea) || totalArea <= 0) return "";
  const areaUnit =
    String(inventory?.areaUnit || "SQ_FT").trim().toUpperCase() === "SQ_M"
      ? "sq m"
      : "sq ft";
  return `${totalArea.toLocaleString("en-IN")} ${areaUnit}`;
};

const getInventoryQuickInfo = (inventory = {}) =>
  [
    toTitleCaseLabel(inventory?.inventoryType),
    getInventorySubtypeLabel(inventory),
    toTitleCaseLabel(inventory?.furnishingStatus),
    getInventoryAreaLabel(inventory),
  ]
    .filter(Boolean)
    .join(" | ");

const toDateTimeInputValue = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildDefaultCollectionFollowUp = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(11, 0, 0, 0);
  return toDateTimeInputValue(date);
};

const resolveImageExtension = (url, mimeType = "") => {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";

  const fromUrl = String(url || "")
    .split("?")[0]
    .split("#")[0]
    .split(".")
    .pop();
  const normalized = String(fromUrl || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(normalized)) {
    return normalized === "jpeg" ? "jpg" : normalized;
  }
  return "jpg";
};

const PROPOSAL_MAX_IMAGES_PER_PROPERTY = 4;
const PDF_IMAGE_MAX_DIMENSION = 1400;
const PDF_IMAGE_QUALITY = 0.82;
const INITIAL_PROPERTIES_RENDER_COUNT = 18;
const INITIAL_PROPOSAL_OPTIONS_RENDER_COUNT = 24;
const INITIAL_DIARY_RENDER_COUNT = 20;
const INITIAL_ACTIVITY_RENDER_COUNT = 20;
const RENDER_STEP_COUNT = 20;
const CLOUDINARY_CLOUD_NAME = "djfiq8kiy";
const CLOUDINARY_UPLOAD_PRESET = "office_on_rent_upload";
const MAX_CLOSURE_DOCUMENTS = 20;
const MAX_CLOSURE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const CLOSURE_DOCUMENT_ACCEPT = "image/*,application/pdf";
const detectClosureDocumentKind = (mimeType = "") => {
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
  if (normalizedMimeType.startsWith("image/")) return "image";
  if (normalizedMimeType === "application/pdf") return "pdf";
  return "file";
};

const sanitizeClosureDocument = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const url = String(value.url || value.secure_url || "").trim();
  if (!url) return null;

  const mimeType = String(value.mimeType || value.type || "").trim().slice(0, 120);
  const normalizedKind = String(value.kind || "").trim().toLowerCase();
  const fallbackKind = detectClosureDocumentKind(mimeType);

  return {
    url: url.slice(0, 2048),
    kind: ["image", "pdf", "file"].includes(normalizedKind) ? normalizedKind : fallbackKind,
    mimeType,
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

const formatFileSize = (size) => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read file data"));
    reader.readAsDataURL(blob);
  });

const blobToPdfImageSource = async (blob) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      dataUrl: await blobToDataUrl(blob),
      format: "JPEG",
    };
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const previewImage = new window.Image();
    previewImage.onload = () => {
      try {
        const originalWidth = previewImage.naturalWidth || previewImage.width || PDF_IMAGE_MAX_DIMENSION;
        const originalHeight = previewImage.naturalHeight || previewImage.height || PDF_IMAGE_MAX_DIMENSION;
        const maxSide = Math.max(originalWidth, originalHeight, 1);
        const scale = Math.min(1, PDF_IMAGE_MAX_DIMENSION / maxSide);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(originalWidth * scale));
        canvas.height = Math.max(1, Math.round(originalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Canvas unavailable"));
          return;
        }
        context.drawImage(previewImage, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", PDF_IMAGE_QUALITY);
        URL.revokeObjectURL(objectUrl);
        resolve({ dataUrl, format: "JPEG" });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    previewImage.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to decode image"));
    };
    previewImage.src = objectUrl;
  });
};

const copyTextToClipboard = async (text) => {
  const normalizedText = String(text || "");
  if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalizedText);
    return true;
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = normalizedText;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    let copied = false;
    try {
      textarea.select();
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
    return copied;
  }

  return false;
};

const LeadDetailsRebuiltContent = ({
  isDark,
  selectedLead,
  onClose,
  selectedLeadDialerHref,
  selectedLeadWhatsAppHref,
  selectedLeadMailHref,
  selectedLeadMapsHref,
  selectedLeadRelatedInventories,
  selectedLeadActiveInventoryId,
  propertyActionType,
  propertyActionInventoryId,
  canManageLeadProperties,
  toInventoryApiStatus,
  toInventoryStatusLabel,
  onSelectRelatedProperty,
  onOpenRelatedProperty,
  onRemoveRelatedProperty,
  availableRelatedInventoryOptions,
  relatedInventoryDraft,
  setRelatedInventoryDraft,
  linkingProperty,
  onLinkPropertyToLead,
  leadStatuses,
  nameDraft,
  setNameDraft,
  phoneDraft,
  setPhoneDraft,
  emailDraft,
  setEmailDraft,
  cityDraft,
  setCityDraft,
  projectInterestedDraft,
  setProjectInterestedDraft,
  statusDraft,
  setStatusDraft,
  requirementsDraft,
  setRequirementsDraft,
  followUpDraft,
  setFollowUpDraft,
  dealPaymentModes,
  dealPaymentTypes,
  dealPaymentAdminDecisions,
  paymentModeDraft,
  setPaymentModeDraft,
  paymentTypeDraft,
  setPaymentTypeDraft,
  paymentRemainingDraft,
  setPaymentRemainingDraft,
  paymentReferenceDraft,
  setPaymentReferenceDraft,
  paymentNoteDraft,
  setPaymentNoteDraft,
  paymentApprovalStatusDraft,
  setPaymentApprovalStatusDraft,
  paymentApprovalNoteDraft,
  setPaymentApprovalNoteDraft,
  brokerageReceivedDraft,
  setBrokerageReceivedDraft,
  brokerageDistributedDraft,
  setBrokerageDistributedDraft,
  closureDocumentsDraft,
  setClosureDocumentsDraft,
  canReviewDealPayment,
  siteLatDraft,
  setSiteLatDraft,
  siteLngDraft,
  setSiteLngDraft,
  canConfigureSiteLocation,
  selectedLeadSiteLat,
  selectedLeadSiteLng,
  siteVisitRadiusMeters,
  userRole,
  onUpdateLead,
  savingUpdates,
  canAssignLead,
  executiveDraft,
  setExecutiveDraft,
  executives,
  transferReasonDraft,
  setTransferReasonDraft,
  assigneeSearchDraft,
  setAssigneeSearchDraft,
  onAssignLead,
  assigning,
  diaryDraft,
  setDiaryDraft,
  onDiaryVoiceToggle,
  savingDiary,
  isDiaryMicSupported,
  isDiaryListening,
  onAddDiary,
  diaryLoading,
  diaryEntries,
  activityLoading,
  activities,
  formatDate,
  getInventoryLeadLabel,
  toObjectIdString,
  WhatsAppIcon,
}) => {
  const card = isDark
    ? "ui-soft-panel border-slate-700/85 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]"
    : "ui-soft-panel border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(148,163,184,0.2)]";
  const softCard = isDark
    ? "ui-soft-panel border-slate-700/90 bg-slate-900/80"
    : "ui-soft-panel border-slate-200 bg-slate-50/85";
  const input = isDark
    ? "border-slate-700 bg-slate-950/90 text-slate-100 placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400";
  const button = isDark
    ? "border-slate-600 bg-slate-900 text-slate-100 hover:border-sky-300/55 hover:bg-slate-800 hover:text-sky-100"
    : "border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700";
  const primaryBtn = isDark
    ? "bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500"
    : "bg-gradient-to-r from-slate-900 to-sky-700 hover:from-slate-800 hover:to-sky-600";

  const isClosedDealFlow =
    ["CLOSED", "REQUESTED"].includes(statusDraft)
    || ["CLOSED", "REQUESTED"].includes(String(selectedLead?.status || ""));
  const currentApprovalStatus = String(
    paymentApprovalStatusDraft || selectedLead?.dealPayment?.approvalStatus || "PENDING",
  ).toUpperCase();
  const showRemainingAmountField = paymentTypeDraft === "PARTIAL";
  const requiresPaymentReference = Boolean(paymentModeDraft) && paymentModeDraft !== "CASH";
  const normalizedPaymentType = String(
    paymentTypeDraft || selectedLead?.dealPayment?.paymentType || "",
  ).trim().toUpperCase();
  const rawRemainingAmountValue = Number(
    paymentRemainingDraft !== ""
      ? paymentRemainingDraft
      : selectedLead?.dealPayment?.remainingAmount,
  );
  const remainingAmountForCollection =
    Number.isFinite(rawRemainingAmountValue) && rawRemainingAmountValue > 0
      ? rawRemainingAmountValue
      : null;
  const requiresRemainingPaymentFollowUp =
    isClosedDealFlow && normalizedPaymentType === "PARTIAL";
  const hasFollowUpDraft = String(followUpDraft || "").trim().length > 0;
  const isClosedStatusSelected =
    statusDraft === "CLOSED" || String(selectedLead?.status || "").toUpperCase() === "CLOSED";
  const normalizedActiveInventoryId = String(selectedLeadActiveInventoryId || "").trim();
  const proposalShareBaseWhatsappHref = String(selectedLeadWhatsAppHref || "").trim();
  const normalizedClosureDocuments = React.useMemo(
    () => sanitizeClosureDocumentList(closureDocumentsDraft),
    [closureDocumentsDraft],
  );
  const remainingClosureSlots = Math.max(0, MAX_CLOSURE_DOCUMENTS - normalizedClosureDocuments.length);
  const [proposalValidityDays, setProposalValidityDays] = React.useState("7");
  const [proposalSpecialNote, setProposalSpecialNote] = React.useState("");
  const [proposalActionMessage, setProposalActionMessage] = React.useState("");
  const [shareLinks, setShareLinks] = React.useState({});

  const [leadTasks, setLeadTasks] = React.useState([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDueDate, setNewTaskDueDate] = React.useState("");
  const [newTaskPriority, setNewTaskPriority] = React.useState("MEDIUM");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = React.useState("");
  const [addingTask, setAddingTask] = React.useState(false);

  const fetchLeadTasks = React.useCallback(async () => {
    if (!selectedLead?._id) return;
    setLoadingTasks(true);
    try {
      const data = await apiGetTasks({ leadId: selectedLead._id });
      setLeadTasks(data || []);
    } catch (err) {
      console.error("Failed to load lead tasks", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedLead?._id]);

  React.useEffect(() => {
    fetchLeadTasks();
  }, [fetchLeadTasks]);

  const handleAddLeadTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const payload = {
        title: newTaskTitle.trim(),
        status: "TODO",
        priority: newTaskPriority,
        dueDate: newTaskDueDate || null,
        assignedTo: newTaskAssignedTo || null,
        leadId: selectedLead._id
      };
      const created = await apiCreateTask(payload);
      if (created) {
        setNewTaskTitle("");
        setNewTaskDueDate("");
        setNewTaskPriority("MEDIUM");
        setNewTaskAssignedTo("");
        fetchLeadTasks();
      }
    } catch (err) {
      console.error("Failed to create lead task", err);
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleLeadTaskStatus = async (task) => {
    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      setLeadTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
      await apiUpdateTask(task._id, { status: newStatus });
      fetchLeadTasks();
    } catch (err) {
      console.error("Failed to toggle task status", err);
      fetchLeadTasks();
    }
  };

  const handleDeleteLeadTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      setLeadTasks(prev => prev.filter(t => t._id !== taskId));
      await apiDeleteTask(taskId);
      fetchLeadTasks();
    } catch (err) {
      console.error("Failed to delete task", err);
      fetchLeadTasks();
    }
  };

  React.useEffect(() => {
    if (!Array.isArray(selectedLeadRelatedInventories) || !selectedLeadRelatedInventories.length) {
      setShareLinks({});
      return;
    }

    let isMounted = true;

    const fetchLinks = async () => {
      const links = {};
      const origin = window.location.origin;

      try {
        await Promise.all(
          selectedLeadRelatedInventories.map(async (inventory) => {
            const inventoryId = String(inventory?._id || "").trim();
            if (!inventoryId) return;

            try {
              const { shareToken } = await createInventoryShareLink(inventoryId);
              if (shareToken && isMounted) {
                links[inventoryId] = `${origin}/shared/inventory/${shareToken}`;
              }
            } catch (err) {
              console.error(`Failed to fetch share link for inventory ${inventoryId}:`, err);
            }
          })
        );

        if (isMounted) {
          setShareLinks(links);
        }
      } catch (err) {
        console.error("Failed to fetch share links:", err);
      }
    };

    fetchLinks();

    return () => {
      isMounted = false;
    };
  }, [selectedLeadRelatedInventories]);
  const [closureUploadMessage, setClosureUploadMessage] = React.useState("");
  const [uploadingClosureDocuments, setUploadingClosureDocuments] = React.useState(false);
  const [proposalSelectedPropertyIds, setProposalSelectedPropertyIds] = React.useState([]);
  const [isGeneratingProposalPdf, setIsGeneratingProposalPdf] = React.useState(false);
  const [linkableInventoryTypeFilter, setLinkableInventoryTypeFilter] = React.useState("ALL");
  const [visiblePropertiesCount, setVisiblePropertiesCount] = React.useState(INITIAL_PROPERTIES_RENDER_COUNT);
  const [visibleProposalOptionsCount, setVisibleProposalOptionsCount] = React.useState(
    INITIAL_PROPOSAL_OPTIONS_RENDER_COUNT,
  );
  const [visibleDiaryCount, setVisibleDiaryCount] = React.useState(INITIAL_DIARY_RENDER_COUNT);
  const [visibleActivityCount, setVisibleActivityCount] = React.useState(INITIAL_ACTIVITY_RENDER_COUNT);
  const [customNumberFields, setCustomNumberFields] = React.useState({});
  const proposalMessageTimerRef = React.useRef(null);
  const pdfImageSourceCacheRef = React.useRef(new Map());
  const normalizedRequirementInventoryType = String(
    requirementsDraft?.inventoryType || "",
  ).trim().toUpperCase();
  const normalizedRequirementPropertySubtype = String(
    requirementsDraft?.propertySubtype || "",
  ).trim().toUpperCase();
  const propertySubtypeOptions = getPropertySubtypeOptions(normalizedRequirementInventoryType);
  const propertySubtypeConfig = getPropertySubtypeConfig(
    normalizedRequirementInventoryType,
    normalizedRequirementPropertySubtype,
  );
  const showFurnishing = !propertySubtypeConfig || propertySubtypeConfig.showFurnishing !== false;
  const furnishingOptions = showFurnishing ? FURNISHING_OPTIONS : [];
  const furnishingValue = furnishingOptions.some((option) => option.value === requirementsDraft?.furnishingStatus)
    ? requirementsDraft?.furnishingStatus
    : "";

  const updateRequirementRootField = React.useCallback(
    (field, value) => {
      setRequirementsDraft((prev) => ({
        ...(prev || {}),
        [field]: value,
      }));
    },
    [setRequirementsDraft],
  );

  const updateRequirementInventoryType = React.useCallback(
    (value) => {
      setRequirementsDraft((prev) => {
        return {
          ...(prev || {}),
          inventoryType: value,
          propertySubtype: "",
          subtypeData: {},
          furnishingStatus: FURNISHING_OPTIONS.some((option) => option.value === prev?.furnishingStatus)
            ? prev?.furnishingStatus
            : "",
        };
      });
    },
    [setRequirementsDraft],
  );

  const updateRequirementPropertySubtype = React.useCallback(
    (value) => {
      const nextConfig = getPropertySubtypeConfig(normalizedRequirementInventoryType, value);
      setRequirementsDraft((prev) => ({
        ...(prev || {}),
        propertySubtype: value,
        subtypeData: {},
        furnishingStatus: nextConfig?.showFurnishing === false
          ? ""
          : prev?.furnishingStatus || "",
        areaMin: "",
        areaMax: "",
        areaUnit: "SQ_FT",
      }));
    },
    [normalizedRequirementInventoryType, setRequirementsDraft],
  );

  const updateRequirementSubtypeField = React.useCallback(
    (field, value) => {
      setRequirementsDraft((prev) => ({
        ...(prev || {}),
        subtypeData: {
          ...(prev?.subtypeData || {}),
          [field]: value,
        },
      }));
    },
    [setRequirementsDraft],
  );

  const updateCustomNumberField = React.useCallback((fieldKey, isCustom) => {
    setCustomNumberFields((prev) => ({ ...prev, [fieldKey]: isCustom }));
  }, []);

  const renderSubtypeField = React.useCallback(
    (field) => {
      const value = requirementsDraft?.subtypeData?.[field.key] ?? "";
      const selectOptions = field.options || [];
      const normalizedValue = String(value || "");
      const isCustomNumberValue = field.allowCustomNumber
        && normalizedValue
        && !selectOptions.includes(normalizedValue);
      const isCustomNumberMode = Boolean(customNumberFields[field.key] || isCustomNumberValue);
      const selectValue = isCustomNumberMode ? CUSTOM_NUMBER_OPTION_VALUE : normalizedValue;
      const labelClass = `text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`;
      const inputClassName = `h-9 w-full rounded-lg border px-2.5 text-sm ${input}`;

      if (field.type === "checkbox") {
        return (
          <label key={field.key} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${isDark ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-300 bg-white text-slate-700"}`}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => updateRequirementSubtypeField(field.key, event.target.checked)}
            />
            {field.label}
          </label>
        );
      }

      return (
        <label key={field.key} className={`space-y-1 ${field.fullWidth ? "sm:col-span-2" : ""}`}>
          <span className={labelClass}>{field.label}</span>
          {field.type === "select" ? (
            <>
              <select
                value={selectValue}
                onChange={(event) => {
                  if (event.target.value === CUSTOM_NUMBER_OPTION_VALUE) {
                    updateCustomNumberField(field.key, true);
                    updateRequirementSubtypeField(field.key, "");
                    return;
                  }
                  updateCustomNumberField(field.key, false);
                  updateRequirementSubtypeField(field.key, event.target.value);
                }}
                className={inputClassName}
              >
                <option value="">{field.label}</option>
                {selectOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                {field.allowCustomNumber ? (
                  <option value={CUSTOM_NUMBER_OPTION_VALUE}>Custom Number</option>
                ) : null}
              </select>
              {field.allowCustomNumber && isCustomNumberMode ? (
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={normalizedValue === CUSTOM_NUMBER_OPTION_VALUE ? "" : normalizedValue}
                  onChange={(event) => updateRequirementSubtypeField(field.key, event.target.value)}
                  placeholder="Enter custom number"
                  className={`${inputClassName} mt-2`}
                />
              ) : null}
            </>
          ) : field.type === "textarea" ? (
            <textarea
              value={value}
              onChange={(event) => updateRequirementSubtypeField(field.key, event.target.value)}
              placeholder={field.placeholder || field.label}
              rows={3}
              className={`min-h-24 w-full rounded-lg border px-2.5 py-2 text-sm ${input}`}
            />
          ) : (
            <input
              type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
              min={field.min}
              max={field.max}
              step={field.step || (field.type === "number" ? "any" : undefined)}
              value={value}
              onChange={(event) => updateRequirementSubtypeField(field.key, event.target.value)}
              placeholder={field.placeholder || field.label}
              className={inputClassName}
            />
          )}
        </label>
      );
    },
    [customNumberFields, input, isDark, requirementsDraft?.subtypeData, updateCustomNumberField, updateRequirementSubtypeField],
  );

  const relatedInventoryRows = React.useMemo(
    () =>
      selectedLeadRelatedInventories.map((inventory) => {
        const inventoryId = String(toObjectIdString(inventory) || "").trim();
        const imageUrls = Array.isArray(inventory?.images)
          ? inventory.images.map((url) => String(url || "").trim()).filter(Boolean)
          : [];
        return {
          id: inventoryId,
          inventory,
          label: getInventoryLeadLabel(inventory),
          location: getInventoryLocationLabel(inventory),
          quickInfo: getInventoryQuickInfo(inventory),
          status: toInventoryApiStatus(inventory?.status),
          statusLabel: toInventoryStatusLabel(inventory?.status),
          imageUrls,
        };
      }),
    [getInventoryLeadLabel, selectedLeadRelatedInventories, toInventoryApiStatus, toInventoryStatusLabel, toObjectIdString],
  );

  const activeRelatedPropertyRow = React.useMemo(
    () => relatedInventoryRows.find((row) => row.id === normalizedActiveInventoryId),
    [normalizedActiveInventoryId, relatedInventoryRows],
  );
  const activePropertyLabel = activeRelatedPropertyRow?.label || "Not selected";

  const proposalPropertyOptions = React.useMemo(
    () =>
      relatedInventoryRows
        .filter((row) => row.id)
        .map((row) => ({
          id: row.id,
          inventory: row.inventory,
          label: row.label || `Property ${row.id.slice(-6).toUpperCase()}`,
          statusLabel: row.statusLabel,
          imageUrls: row.imageUrls,
        })),
    [relatedInventoryRows],
  );
  const proposalPropertyIds = React.useMemo(
    () => proposalPropertyOptions.map((row) => row.id),
    [proposalPropertyOptions],
  );
  const proposalPropertyIdSet = React.useMemo(
    () => new Set(proposalPropertyIds),
    [proposalPropertyIds],
  );

  React.useEffect(() => {
    setProposalValidityDays("7");
    setProposalSpecialNote("");
    setProposalActionMessage("");
    setIsGeneratingProposalPdf(false);
    setClosureUploadMessage("");
    setUploadingClosureDocuments(false);
    setLinkableInventoryTypeFilter("ALL");
    setVisiblePropertiesCount(INITIAL_PROPERTIES_RENDER_COUNT);
    setVisibleProposalOptionsCount(INITIAL_PROPOSAL_OPTIONS_RENDER_COUNT);
    setVisibleDiaryCount(INITIAL_DIARY_RENDER_COUNT);
    setVisibleActivityCount(INITIAL_ACTIVITY_RENDER_COUNT);
    pdfImageSourceCacheRef.current.clear();
  }, [selectedLead?._id]);

  React.useEffect(() => {
    if (!proposalPropertyIds.length) {
      setProposalSelectedPropertyIds([]);
      return;
    }

    setProposalSelectedPropertyIds((previous) => {
      const validSelection = previous.filter((id) => proposalPropertyIdSet.has(id));
      if (validSelection.length) {
        const sameSelection = validSelection.length === previous.length
          && validSelection.every((id, index) => id === previous[index]);
        return sameSelection ? previous : validSelection;
      }
      if (normalizedActiveInventoryId && proposalPropertyIdSet.has(normalizedActiveInventoryId)) {
        return [normalizedActiveInventoryId];
      }
      const fallbackId = proposalPropertyIds[0];
      if (previous.length === 1 && previous[0] === fallbackId) {
        return previous;
      }
      return [fallbackId];
    });
  }, [normalizedActiveInventoryId, proposalPropertyIdSet, proposalPropertyIds]);

  React.useEffect(() => () => {
    if (proposalMessageTimerRef.current) {
      clearTimeout(proposalMessageTimerRef.current);
    }
  }, []);

  const handleCreateRemainingPaymentFollowUp = React.useCallback(() => {
    setFollowUpDraft(buildDefaultCollectionFollowUp());
  }, [setFollowUpDraft]);

  const showProposalActionMessage = React.useCallback((message) => {
    setProposalActionMessage(message);
    if (proposalMessageTimerRef.current) {
      clearTimeout(proposalMessageTimerRef.current);
    }
    proposalMessageTimerRef.current = setTimeout(() => {
      setProposalActionMessage("");
      proposalMessageTimerRef.current = null;
    }, 2200);
  }, []);

  const uploadClosureDocumentFile = React.useCallback(async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    data.append("cloud_name", CLOUDINARY_CLOUD_NAME);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      {
        method: "POST",
        body: data,
      },
    );

    const payload = await response.json();
    if (!response.ok || !payload?.secure_url) {
      throw new Error(payload?.error?.message || "Failed to upload document");
    }

    const uploaded = sanitizeClosureDocument({
      url: payload.secure_url,
      mimeType: file.type,
      name: file.name,
      size: file.size,
      kind: detectClosureDocumentKind(file.type),
    });

    if (!uploaded) {
      throw new Error("Invalid upload response");
    }

    return uploaded;
  }, []);

  const handleClosureDocumentsInput = React.useCallback(async (event) => {
    const selectedFiles = Array.from(event?.target?.files || []);
    if (event?.target) {
      event.target.value = "";
    }
    if (!selectedFiles.length) return;

    if (remainingClosureSlots <= 0) {
      setClosureUploadMessage(`Only ${MAX_CLOSURE_DOCUMENTS} documents are allowed`);
      return;
    }

    const allowedFiles = selectedFiles.slice(0, remainingClosureSlots);
    const validFiles = [];
    const skippedNames = [];

    allowedFiles.forEach((file) => {
      const mimeType = String(file?.type || "").trim().toLowerCase();
      const isAllowedType = mimeType.startsWith("image/") || mimeType === "application/pdf";
      if (!isAllowedType) {
        skippedNames.push(file?.name || "Unknown file");
        return;
      }
      if ((Number(file?.size) || 0) > MAX_CLOSURE_FILE_SIZE_BYTES) {
        skippedNames.push(file?.name || "Unknown file");
        return;
      }
      validFiles.push(file);
    });

    if (!validFiles.length) {
      setClosureUploadMessage("Please select JPG/PNG/WebP images or PDF files (max 25MB each)");
      return;
    }

    setUploadingClosureDocuments(true);
    setClosureUploadMessage("Uploading documents...");

    const uploadedRows = [];
    const failedNames = [];

    for (const file of validFiles) {
      try {
        const uploaded = await uploadClosureDocumentFile(file);
        uploadedRows.push(uploaded);
      } catch {
        failedNames.push(file.name || "Unknown file");
      }
    }

    if (uploadedRows.length > 0) {
      setClosureDocumentsDraft((previous) => {
        const merged = sanitizeClosureDocumentList([
          ...(Array.isArray(previous) ? previous : []),
          ...uploadedRows,
        ]);
        return merged;
      });
    }

    setUploadingClosureDocuments(false);

    const uploadedCount = uploadedRows.length;
    if (uploadedCount > 0 && failedNames.length === 0 && skippedNames.length === 0) {
      setClosureUploadMessage(`${uploadedCount} document${uploadedCount === 1 ? "" : "s"} uploaded`);
      return;
    }

    const messageParts = [];
    if (uploadedCount > 0) {
      messageParts.push(`${uploadedCount} uploaded`);
    }
    const rejectedCount = failedNames.length + skippedNames.length;
    if (rejectedCount > 0) {
      messageParts.push(`${rejectedCount} skipped`);
    }
    setClosureUploadMessage(messageParts.join(", "));
  }, [remainingClosureSlots, setClosureDocumentsDraft, uploadClosureDocumentFile]);

  const handleRemoveClosureDocument = React.useCallback((urlToRemove) => {
    setClosureDocumentsDraft((previous) => sanitizeClosureDocumentList(
      (Array.isArray(previous) ? previous : []).filter(
        (row) => String(row?.url || "") !== String(urlToRemove || ""),
      ),
    ));
  }, [setClosureDocumentsDraft]);

  const selectedProposalPropertyIdSet = React.useMemo(
    () => new Set(proposalSelectedPropertyIds),
    [proposalSelectedPropertyIds],
  );
  const selectedProposalProperties = React.useMemo(() => {
    if (!proposalPropertyOptions.length || !selectedProposalPropertyIdSet.size) return [];
    return proposalPropertyOptions.filter((row) => selectedProposalPropertyIdSet.has(row.id));
  }, [proposalPropertyOptions, selectedProposalPropertyIdSet]);

  const visibleProposalPropertyOptions = React.useMemo(
    () => proposalPropertyOptions.slice(0, visibleProposalOptionsCount),
    [proposalPropertyOptions, visibleProposalOptionsCount],
  );
  const hasMoreProposalPropertyOptions =
    proposalPropertyOptions.length > visibleProposalPropertyOptions.length;
  const visibleRelatedInventoryRows = React.useMemo(
    () => relatedInventoryRows.slice(0, visiblePropertiesCount),
    [relatedInventoryRows, visiblePropertiesCount],
  );
  const hasMoreRelatedInventories =
    relatedInventoryRows.length > visibleRelatedInventoryRows.length;
  const normalizedDiaryEntries = React.useMemo(
    () => (Array.isArray(diaryEntries) ? diaryEntries : []),
    [diaryEntries],
  );
  const normalizedActivities = React.useMemo(
    () => (Array.isArray(activities) ? activities : []),
    [activities],
  );
  const visibleDiaryEntries = React.useMemo(
    () => normalizedDiaryEntries.slice(0, visibleDiaryCount),
    [normalizedDiaryEntries, visibleDiaryCount],
  );
  const visibleActivities = React.useMemo(
    () => normalizedActivities.slice(0, visibleActivityCount),
    [normalizedActivities, visibleActivityCount],
  );
  const hasMoreDiaryEntries = normalizedDiaryEntries.length > visibleDiaryEntries.length;
  const hasMoreActivities = normalizedActivities.length > visibleActivities.length;
  const normalizedLeadStatus = String(statusDraft || selectedLead?.status || "").trim().toUpperCase();
  const showQualifiedTransferHelper =
    normalizedLeadStatus === "QUALIFIED_LEAD" || normalizedLeadStatus === "SITE_VISIT_REQUIRED";
  const currentOwnerName = selectedLead?.assignedTo?.name || "Unassigned";
  const currentOwnerRole = selectedLead?.assignedTo?.role || "";
  const assignmentHistoryEvents = React.useMemo(
    () => buildAssignmentHistoryEvents(selectedLead),
    [selectedLead],
  );
  const assigneeSearch = String(assigneeSearchDraft || "").trim().toLowerCase();
  const filteredAssignees = React.useMemo(() => {
    const rows = Array.isArray(executives) ? executives : [];
    if (!assigneeSearch) return rows;
    return rows.filter((user) => {
      const haystack = [
        user?.name,
        user?.role,
        user?.email,
        user?.phone,
      ].map((value) => String(value || "").toLowerCase()).join(" ");
      return haystack.includes(assigneeSearch);
    });
  }, [assigneeSearch, executives]);
  const sortedLinkableInventoryOptions = React.useMemo(
    () =>
      [...(Array.isArray(availableRelatedInventoryOptions) ? availableRelatedInventoryOptions : [])]
        .filter((inventory) => toInventoryApiStatus(inventory?.status) === "Available")
        .filter((inventory) => {
          const inventoryType = String(inventory?.type || "").trim().toUpperCase();
          if (linkableInventoryTypeFilter === "SALE") return inventoryType === "SALE";
          if (linkableInventoryTypeFilter === "RENT") return inventoryType === "RENT";
          return true;
        })
        .sort((a, b) => {
          const aLabel = String(getInventoryLeadLabel(a) || a?.title || a?._id || "").toLowerCase();
          const bLabel = String(getInventoryLeadLabel(b) || b?.title || b?._id || "").toLowerCase();
          const aText = `${aLabel} ${getInventoryLocationLabel(a).toLowerCase()}`;
          const bText = `${bLabel} ${getInventoryLocationLabel(b).toLowerCase()}`;
          return aText.localeCompare(bText);
        }),
    [
      availableRelatedInventoryOptions,
      getInventoryLeadLabel,
      linkableInventoryTypeFilter,
      toInventoryApiStatus,
    ],
  );

  React.useEffect(() => {
    if (!relatedInventoryDraft) return;
    const exists = sortedLinkableInventoryOptions.some(
      (inventory) => String(inventory?._id || "") === String(relatedInventoryDraft || ""),
    );
    if (!exists) {
      setRelatedInventoryDraft("");
    }
  }, [relatedInventoryDraft, setRelatedInventoryDraft, sortedLinkableInventoryOptions]);

  const selectedPropertyCount = selectedProposalProperties.length;
  const proposalSubjectPropertyLabel = React.useMemo(() => {
    if (selectedPropertyCount === 1) return selectedProposalProperties[0]?.label || activePropertyLabel;
    if (selectedPropertyCount > 1) return `${selectedPropertyCount} Properties`;
    return activePropertyLabel;
  }, [activePropertyLabel, selectedPropertyCount, selectedProposalProperties]);

  const proposalSubject = React.useMemo(
    () => `Property Proposal | ${proposalSubjectPropertyLabel}`,
    [proposalSubjectPropertyLabel],
  );
  const proposalFileBaseName = React.useMemo(
    () =>
      String(selectedLead?.name || "client")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "client",
    [selectedLead?.name],
  );
  const proposalImageEntries = React.useMemo(
    () =>
      selectedProposalProperties.flatMap((property) =>
        property.imageUrls.slice(0, PROPOSAL_MAX_IMAGES_PER_PROPERTY).map((url, index) => ({
          url,
          propertyId: property.id,
          propertyLabel: property.label,
          imageIndex: index + 1,
        })),
      ),
    [selectedProposalProperties],
  );
  const proposalPreviewImageEntries = React.useMemo(
    () => proposalImageEntries.slice(0, 8),
    [proposalImageEntries],
  );

  const proposalImageLinksText = React.useMemo(
    () => {
      if (!selectedProposalProperties.length) return "";
      const lines = [];
      selectedProposalProperties.forEach((property, propertyIndex) => {
        lines.push(`${propertyIndex + 1}. ${property.label}`);
        if (!property.imageUrls.length) {
          lines.push("   - No images");
          lines.push("");
          return;
        }
        property.imageUrls.forEach((url, imageIndex) => {
          lines.push(`   - ${imageIndex + 1}. ${url}`);
        });
        lines.push("");
      });
      return lines.join("\n").trim();
    },
    [selectedProposalProperties],
  );

  const proposalText = React.useMemo(() => {
    const now = new Date();
    const proposalDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    const validityDays = String(proposalValidityDays || "7").trim() || "7";
    const clientName = String(selectedLead?.name || "Client").trim();

    const lines = [
      "THE OFFICE ON RENT - PROPERTY PROPOSAL",
      `Date: ${proposalDate}`,
      "",
      `Dear ${clientName},`,
      "Thank you for your interest. Please find your selected property proposal below:",
      `Selected Properties: ${selectedPropertyCount}`,
    ];

    selectedProposalProperties.forEach((property, index) => {
      const inventory = property.inventory || {};
      lines.push("");
      lines.push(`Property ${index + 1}: ${property.label}`);
      lines.push(`Project: ${String(inventory?.projectName || selectedLead?.projectInterested || "-").trim() || "-"}`);
      lines.push(`Location: ${getInventoryLocationLabel(inventory) || String(selectedLead?.city || "-").trim() || "-"}`);
      lines.push(`Property Type: ${String(inventory?.type || "Sale").trim() || "-"}`);
      lines.push(`Inventory Category: ${toTitleCaseLabel(inventory?.inventoryType) || "-"}`);
      lines.push(`Category: ${String(inventory?.category || "Apartment").trim() || "-"}`);
      lines.push(`Price: ${formatCurrencyInr(inventory?.price)}`);
      if (shareLinks[property.id]) {
        lines.push(`Details Link: ${shareLinks[property.id]}`);
      }
    });

    lines.push("");
    lines.push(`Validity: ${validityDays} day(s)`);
    if (proposalSpecialNote) lines.push(`Special Note: ${proposalSpecialNote}`);
    lines.push("", "Regards,", "Samvid OS");

    if (!selectedProposalProperties.length) {
      return [
        "THE OFFICE ON RENT - PROPERTY PROPOSAL",
        "",
        "Select at least one linked property to generate the proposal.",
      ].join("\n");
    }

    return lines.filter(Boolean).join("\n");
  }, [
    proposalSpecialNote,
    proposalValidityDays,
    selectedLead?.assignedTo?.name,
    selectedLead?.city,
    selectedLead?.name,
    selectedLead?.phone,
    selectedLead?.projectInterested,
    selectedPropertyCount,
    selectedProposalProperties,
    shareLinks,
  ]);

  const proposalWhatsAppHref = React.useMemo(() => {
    if (!proposalShareBaseWhatsappHref || !selectedProposalProperties.length) return "";
    const separator = proposalShareBaseWhatsappHref.includes("?") ? "&" : "?";
    return `${proposalShareBaseWhatsappHref}${separator}text=${encodeURIComponent(proposalText)}`;
  }, [proposalShareBaseWhatsappHref, proposalText, selectedProposalProperties.length]);

  const proposalMailHref = React.useMemo(() => {
    const emailAddress = String(selectedLead?.email || "").trim();
    const subject = encodeURIComponent(proposalSubject);
    const body = encodeURIComponent(proposalText);
    return emailAddress
      ? `mailto:${emailAddress}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
  }, [proposalSubject, proposalText, selectedLead?.email]);

  const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const hasProposalImages = proposalImageEntries.length > 0;

  const toggleProposalProperty = (propertyId) => {
    const normalizedId = String(propertyId || "");
    if (!normalizedId) return;
    setProposalSelectedPropertyIds((previous) => {
      if (previous.includes(normalizedId)) {
        if (previous.length === 1) return previous;
        return previous.filter((id) => id !== normalizedId);
      }
      return [...previous, normalizedId];
    });
  };

  const handleSelectAllProposalProperties = () => {
    setProposalSelectedPropertyIds((previous) => {
      if (
        previous.length === proposalPropertyIds.length
        && previous.every((id, index) => id === proposalPropertyIds[index])
      ) {
        return previous;
      }
      return proposalPropertyIds;
    });
  };

  const handleResetProposalSelection = () => {
    if (!proposalPropertyIds.length) {
      setProposalSelectedPropertyIds([]);
      return;
    }
    if (normalizedActiveInventoryId && proposalPropertyIdSet.has(normalizedActiveInventoryId)) {
      setProposalSelectedPropertyIds([normalizedActiveInventoryId]);
      return;
    }
    setProposalSelectedPropertyIds([proposalPropertyIds[0]]);
  };

  const handleCopyProposal = async () => {
    try {
      const copied = await copyTextToClipboard(proposalText);
      if (copied) {
        showProposalActionMessage("Proposal copied");
        return;
      }
      showProposalActionMessage("Copy is not supported on this browser");
    } catch {
      showProposalActionMessage("Unable to copy proposal");
    }
  };

  const fetchPdfImageSource = async (imageUrl) => {
    const normalizedUrl = String(imageUrl || "").trim();
    if (!normalizedUrl) {
      throw new Error("Invalid image url");
    }

    const cached = pdfImageSourceCacheRef.current.get(normalizedUrl);
    if (cached) {
      return cached;
    }

    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch image for PDF");
    }
    const blob = await response.blob();
    const source = await blobToPdfImageSource(blob);
    pdfImageSourceCacheRef.current.set(normalizedUrl, source);
    return source;
  };

  const buildProposalPdfBlob = async () => {
    if (!selectedProposalProperties.length) return null;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    let cursorY = margin;

    const validityDays = String(proposalValidityDays || "7").trim() || "7";
    const clientName = String(selectedLead?.name || "Client").trim();
    const now = new Date();
    const proposalDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const formatCurrencyPdf = (value) => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) return "On request";
      return `Rs. ${amount.toLocaleString("en-IN")}`;
    };

    // Page 1 Header
    doc.setFillColor(15, 118, 110); // Teal primary color
    doc.rect(0, 0, 595, 100, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("THE OFFICE ON RENT", 36, 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(204, 251, 241); // Light teal text
    doc.text("PROPERTY PROPOSAL SUMMARY", 36, 68);

    // Client & Metadata details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate 500
    doc.text("PREPARED FOR:", 36, 135);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate 900
    doc.text(clientName.toUpperCase(), 36, 153);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("PROPOSAL DATE:", 360, 135);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(proposalDate, 360, 153);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("VALIDITY:", 470, 135);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${validityDays} Days`, 470, 153);

    // Separator line
    doc.setDrawColor(226, 232, 240); // slate 200
    doc.setLineWidth(1);
    doc.line(36, 175, 559, 175);

    cursorY = 200;

    for (let i = 0; i < selectedProposalProperties.length; i++) {
      const property = selectedProposalProperties[i];
      const inventory = property.inventory || {};
      const hasImages = property.imageUrls.length > 0;
      const spaceNeeded = hasImages ? 280 : 130;

      // Add a page break if details + photos won't fit on this page
      if (cursorY + spaceNeeded > pageHeight - margin) {
        doc.addPage();
        // Page header on subsequent pages
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 0, 595, 35, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`PROPERTY PROPOSAL FOR ${clientName.toUpperCase()}`, 36, 22);
        cursorY = 60;
      }

      // Property title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 118, 110); // Teal accent
      doc.text(`PROPERTY ${i + 1}: ${property.label.toUpperCase()}`, 36, cursorY);

      // Property card boundary box
      const cardStart = cursorY + 10;
      doc.setDrawColor(241, 245, 249); // slate 100
      doc.setFillColor(248, 250, 252); // slate 50
      doc.rect(36, cardStart, 523, 90, "FD");

      // Key details column 1 (x=50)
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("Project:", 50, cardStart + 22);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(String(inventory?.projectName || selectedLead?.projectInterested || "-").trim(), 125, cardStart + 22);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("Location:", 50, cardStart + 42);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(String(getInventoryLocationLabel(inventory) || selectedLead?.city || "-").trim(), 125, cardStart + 42);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("Type:", 50, cardStart + 62);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(String(inventory?.type || "Sale").trim(), 125, cardStart + 62);

      // Key details column 2 (x=300)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("Category:", 300, cardStart + 22);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(String(inventory?.category || "Apartment").trim(), 370, cardStart + 22);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("Asking Price:", 300, cardStart + 42);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // Emerald price tag
      doc.text(formatCurrencyPdf(inventory?.price), 370, cardStart + 42);

      // Clickable detail link inside PDF
      const shareUrl = shareLinks[property.id];
      if (shareUrl) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(3, 102, 214); // Blue link color
        doc.text("CLICK TO VIEW DETAILS ONLINE", 300, cardStart + 62);
        const linkWidth = doc.getTextWidth("CLICK TO VIEW DETAILS ONLINE");
        // Draw underline
        doc.setDrawColor(3, 102, 214);
        doc.setLineWidth(0.5);
        doc.line(300, cardStart + 64, 300 + linkWidth, cardStart + 64);
        // Create actual PDF click link
        doc.link(300, cardStart + 52, linkWidth, 12, { url: shareUrl });
      }

      cursorY = cardStart + 105;

      // Draw property images if available
      const images = property.imageUrls.slice(0, 2); // limit to 2 inline images side-by-side
      if (images.length > 0) {
        const imgWidth = 250;
        const imgHeight = 140;

        for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
          const imgUrl = images[imgIdx];
          const imgX = 36 + (imgIdx * (imgWidth + 23)); // 23pt gutter gap

          try {
            const source = await fetchPdfImageSource(imgUrl);
            doc.addImage(
              source.dataUrl,
              source.format || "JPEG",
              imgX,
              cursorY,
              imgWidth,
              imgHeight,
              undefined,
              "FAST"
            );
          } catch {
            // Draw placeholder card if load fails
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.rect(imgX, cursorY, imgWidth, imgHeight, "FD");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("Photo preview unavailable", imgX + 70, cursorY + 75);
          }
        }
        cursorY += imgHeight + 25;
      } else {
        cursorY += 15;
      }
    }

    // Special Note and Footer
    const footerNeededSpace = proposalSpecialNote ? 100 : 50;
    if (cursorY + footerNeededSpace > pageHeight - margin) {
      doc.addPage();
      doc.setFillColor(15, 118, 110);
      doc.rect(0, 0, 595, 35, "F");
      cursorY = 60;
    }

    if (proposalSpecialNote) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("SPECIAL NOTE:", 36, cursorY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const noteLines = doc.splitTextToSize(proposalSpecialNote, 523);
      doc.text(noteLines, 36, cursorY + 15);
      cursorY += (noteLines.length * 12) + 25;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Regards,", 36, cursorY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 118, 110);
    doc.text("Samvid OS", 36, cursorY + 15);

    // Apply Page Numbers on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${p} of ${totalPages}`, 500, 815);
      doc.text("Generated by Samvid OS", 36, 815);
    }

    return doc.output("blob");
  };

  const buildProposalPdfFile = async () => {
    const pdfBlob = await buildProposalPdfBlob();
    if (!pdfBlob) return null;
    const fileName = `proposal-${proposalFileBaseName}-${Date.now()}.pdf`;
    if (typeof File !== "undefined") {
      return new File([pdfBlob], fileName, { type: "application/pdf" });
    }
    return { blob: pdfBlob, fileName };
  };

  const triggerDownloadBlob = (blob, fileName) => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const toPdfDownloadPayload = (pdfFileLike) => {
    if (!pdfFileLike) return null;
    if (pdfFileLike instanceof File) {
      return { blob: pdfFileLike, fileName: pdfFileLike.name };
    }
    if (pdfFileLike?.blob && pdfFileLike?.fileName) {
      return { blob: pdfFileLike.blob, fileName: pdfFileLike.fileName };
    }
    return null;
  };

  const shareFilesWithNativeFallback = async (files, options = {}) => {
    if (!canUseNativeShare || !Array.isArray(files) || !files.length) return false;
    const title = String(options?.title || "").trim();
    const text = String(options?.text || "").trim();
    const payloads = [
      { title, text, files },
      { title, files },
      { text, files },
      { files },
    ];

    for (let i = 0; i < payloads.length; i += 1) {
      const payload = payloads[i];
      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return Boolean(value);
        }),
      );

      try {
        if (sanitizedPayload.files && typeof navigator.canShare === "function") {
          const canShareFiles = navigator.canShare({ files: sanitizedPayload.files });
          if (!canShareFiles) continue;
        }
        await navigator.share(sanitizedPayload);
        return true;
      } catch (shareError) {
        if (String(shareError?.name || "") === "AbortError") {
          throw shareError;
        }
      }
    }
    return false;
  };

  const handleDownloadProposal = async () => {
    if (!selectedProposalProperties.length) {
      showProposalActionMessage("Select at least one property");
      return;
    }

    setIsGeneratingProposalPdf(true);
    try {
      const pdfFile = await buildProposalPdfFile();
      if (!pdfFile) {
        showProposalActionMessage("Unable to generate proposal PDF");
        return;
      }

      if (pdfFile instanceof File) {
        triggerDownloadBlob(pdfFile, pdfFile.name);
      } else {
        triggerDownloadBlob(pdfFile.blob, pdfFile.fileName);
      }
      showProposalActionMessage("Proposal PDF downloaded");
    } catch {
      showProposalActionMessage("Unable to generate proposal PDF");
    } finally {
      setIsGeneratingProposalPdf(false);
    }
  };

  const handleCopyImageLinks = async () => {
    if (!hasProposalImages) {
      showProposalActionMessage("No property images found");
      return;
    }

    try {
      const copied = await copyTextToClipboard(proposalImageLinksText);
      if (copied) {
        showProposalActionMessage("Image links copied");
        return;
      }
      showProposalActionMessage("Copy is not supported on this browser");
    } catch {
      showProposalActionMessage("Unable to copy image links");
    }
  };

  const fetchShareableImageFile = async (imageEntry, index) => {
    const response = await fetch(imageEntry.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image ${index + 1}`);
    }

    const blob = await response.blob();
    const extension = resolveImageExtension(imageEntry.url, blob.type);
    const propertySlug = String(imageEntry.propertyLabel || "property")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return new File(
      [blob],
      `${propertySlug || "property"}-image-${imageEntry.imageIndex}.${extension}`,
      { type: blob.type || `image/${extension}` },
    );
  };

  const buildShareableImageFiles = async () => {
    const settled = await Promise.allSettled(
      proposalPreviewImageEntries.map((entry, index) => fetchShareableImageFile(entry, index)),
    );
    return settled
      .filter((row) => row.status === "fulfilled")
      .map((row) => row.value);
  };

  const handleNativeShareImages = async () => {
    if (!hasProposalImages) {
      showProposalActionMessage("No property images found");
      return;
    }

    if (!canUseNativeShare) {
      showProposalActionMessage("Direct image sharing is not supported in this browser");
      return;
    }

    try {
      const files = await buildShareableImageFiles();

      if (!files.length) {
        showProposalActionMessage("Images could not be prepared for attachment sharing");
        return;
      }

      if (typeof navigator.canShare === "function" && !navigator.canShare({ files })) {
        showProposalActionMessage("Attachment sharing is not supported on this device");
        return;
      }

      await navigator.share({
        title: `${proposalSubject} - Images`,
        text: `Property images for ${proposalSubjectPropertyLabel}`,
        files,
      });
      showProposalActionMessage(`Shared ${files.length} image(s)`);
    } catch (error) {
      if (String(error?.name || "") === "AbortError") return;
      showProposalActionMessage("Image share failed. Try using mobile share sheet.");
    }
  };

  const handleShareToWhatsApp = async () => {
    if (!selectedProposalProperties.length) {
      showProposalActionMessage("Select at least one property");
      return;
    }

    setIsGeneratingProposalPdf(true);
    try {
      const pdfFile = await buildProposalPdfFile();
      if (pdfFile instanceof File && canUseNativeShare) {
        const shared = await shareFilesWithNativeFallback([pdfFile], {
          title: proposalSubject,
          text: proposalText,
        });
        if (shared) {
          showProposalActionMessage("Proposal ready. Choose WhatsApp in share options.");
          return;
        }
      }
    } catch {
      // fallback handled below
    } finally {
      setIsGeneratingProposalPdf(false);
    }

    if (proposalWhatsAppHref && typeof window !== "undefined") {
      window.open(proposalWhatsAppHref, "_blank", "noopener,noreferrer");
      showProposalActionMessage("Opening WhatsApp chat");
      return;
    }

    await handleCopyProposal();
    showProposalActionMessage("WhatsApp unavailable. Proposal copied.");
  };

  const handleShareByEmail = () => {
    if (!selectedProposalProperties.length) {
      showProposalActionMessage("Select at least one property");
      return;
    }
    if (typeof window === "undefined") return;
    window.location.href = proposalMailHref;
  };

  const handleNativeShareProposal = async () => {
    if (!selectedProposalProperties.length) {
      showProposalActionMessage("Select at least one property");
      return;
    }

    let generatedPdfFile = null;
    setIsGeneratingProposalPdf(true);
    try {
      generatedPdfFile = await buildProposalPdfFile();
      if (!generatedPdfFile) {
        showProposalActionMessage("Unable to generate proposal PDF");
        return;
      }

      if (generatedPdfFile instanceof File && canUseNativeShare) {
        const shared = await shareFilesWithNativeFallback([generatedPdfFile], {
          title: proposalSubject,
          text: proposalText,
        });
        if (shared) {
          showProposalActionMessage("Proposal PDF shared");
          return;
        }
      }

      const fallbackDownload = toPdfDownloadPayload(generatedPdfFile);
      if (fallbackDownload) {
        triggerDownloadBlob(fallbackDownload.blob, fallbackDownload.fileName);
        showProposalActionMessage("PDF share unsupported. PDF downloaded.");
        return;
      }
    } catch (error) {
      if (String(error?.name || "") === "AbortError") return;
      console.error("Proposal PDF share failed", error);
      showProposalActionMessage("PDF share failed. Downloading instead.");
      const generatedFallback = toPdfDownloadPayload(generatedPdfFile);
      if (generatedFallback) {
        triggerDownloadBlob(generatedFallback.blob, generatedFallback.fileName);
        return;
      }
      try {
        const regeneratedPdfFile = await buildProposalPdfFile();
        const fallbackDownload = toPdfDownloadPayload(regeneratedPdfFile);
        if (fallbackDownload) {
          triggerDownloadBlob(fallbackDownload.blob, fallbackDownload.fileName);
        }
      } catch {
        // Ignore fallback failure.
      }
    } finally {
      setIsGeneratingProposalPdf(false);
    }
  };

  return (
    <Motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className={`ui-soft-panel relative z-10 w-full overflow-x-hidden rounded-[26px] shadow-[0_28px_90px_-56px_rgba(15,23,42,0.75)] sm:rounded-[30px] ${
        isDark ? "border-slate-700 bg-slate-900/95" : "border-slate-200 bg-white/95"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className={`absolute -left-10 top-0 h-36 w-36 rounded-full blur-3xl ${
          isDark ? "bg-sky-500/20" : "bg-sky-300/45"
        }`} />
        <div className={`absolute right-0 top-6 h-40 w-40 rounded-full blur-3xl ${
          isDark ? "bg-emerald-500/15" : "bg-emerald-300/35"
        }`} />
      </div>
      <div
        className={`ui-hero-card relative border-b px-3 py-3 sm:px-6 sm:py-5 ${
          isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-slate-50/95"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
              isDark ? "text-sky-200" : "text-sky-700"
            }`}>
              Lead Profile
            </p>
            <h2 className={`truncate text-2xl font-bold tracking-tight sm:text-3xl ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              {String(nameDraft || "").trim() || selectedLead?.name || "Lead"}
            </h2>
            <p className={`mt-1 truncate text-xs sm:text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {String(projectInterestedDraft || "").trim() || selectedLead?.projectInterested || "Project not tagged yet"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] sm:px-2.5 sm:text-[10px] ${
                isDark ? "border-sky-300/45 bg-sky-500/15 text-sky-100" : "border-sky-300 bg-sky-50 text-sky-700"
              }`}>
                {statusLabel(statusDraft || selectedLead?.status || "NEW")}
              </span>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold sm:px-2.5 sm:text-[10px] ${
                isDark ? "border-slate-700 bg-slate-800 text-slate-300" : "border-slate-300 bg-white text-slate-600"
              }`}>
                ID: {String(selectedLead?._id || "").slice(-6).toUpperCase()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.1em] sm:px-3.5 sm:text-xs sm:tracking-[0.12em] ${button}`}
          >
            <ArrowLeft size={12} />
            Back
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-3">
          <div className={`rounded-2xl border px-2.5 py-2 sm:px-3 sm:py-2.5 ${card}`}>
            <p className={`text-[9px] uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Assigned</p>
            <p className={`mt-0.5 truncate text-[11px] font-semibold sm:mt-1 sm:text-xs ${isDark ? "text-slate-100" : "text-slate-800"}`}>
              {selectedLead?.assignedTo?.name || "Unassigned"}
            </p>
          </div>
          <div className={`rounded-2xl border px-2.5 py-2 sm:px-3 sm:py-2.5 ${card}`}>
            <p className={`text-[9px] uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Follow-up</p>
            <p className={`mt-0.5 truncate text-[11px] font-semibold sm:mt-1 sm:text-xs ${isDark ? "text-slate-100" : "text-slate-800"}`}>
              {formatDate(followUpDraft || selectedLead?.nextFollowUp)}
            </p>
          </div>
          <div className={`rounded-2xl border px-2.5 py-2 sm:px-3 sm:py-2.5 ${card}`}>
            <p className={`text-[9px] uppercase tracking-[0.1em] sm:text-[10px] sm:tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Primary Property</p>
            <p className={`mt-0.5 truncate text-[11px] font-semibold sm:mt-1 sm:text-xs ${isDark ? "text-slate-100" : "text-slate-800"}`}>
              {activePropertyLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-3 p-2.5 sm:gap-4 sm:p-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <section
            className={`rounded-3xl border p-4 ${card}`}
            style={{ contentVisibility: "auto", containIntrinsicSize: "320px" }}
          >
            <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Contact</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {selectedLeadDialerHref ? (
                <a href={selectedLeadDialerHref} className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}>
                  <Phone size={13} /> Call
                </a>
              ) : <button type="button" disabled className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${input}`}>Call</button>}
              {selectedLeadWhatsAppHref ? (
                <a href={selectedLeadWhatsAppHref} target="_blank" rel="noreferrer" className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}>
                  {WhatsAppIcon ? <WhatsAppIcon size={12} /> : null} WhatsApp
                </a>
              ) : <button type="button" disabled className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${input}`}>WhatsApp</button>}
              {selectedLeadMailHref ? (
                <a href={selectedLeadMailHref} className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}>
                  <Mail size={13} /> Email
                </a>
              ) : <button type="button" disabled className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${input}`}>Email</button>}
              {selectedLeadMapsHref ? (
                <a href={selectedLeadMapsHref} target="_blank" rel="noreferrer" className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}>
                  <MapPin size={13} /> Maps
                </a>
              ) : <button type="button" disabled className={`h-9 rounded-lg border text-xs font-semibold opacity-50 ${input}`}>Maps</button>}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Name
                </span>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder="Lead name"
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Phone
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneDraft}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                  placeholder="Phone"
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Email
                </span>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  placeholder="Email"
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  City
                </span>
                <input
                  type="text"
                  value={cityDraft}
                  onChange={(event) => setCityDraft(event.target.value)}
                  placeholder="City"
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Project
                </span>
                <input
                  type="text"
                  value={projectInterestedDraft}
                  onChange={(event) => setProjectInterestedDraft(event.target.value)}
                  placeholder="Project interested"
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                />
              </label>
            </div>
          </section>

          <section className={`rounded-3xl border p-4 ${card}`}>
            <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Lead Requirements
            </div>
            {normalizedRequirementPropertySubtype ? (
              <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDark ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
                {getPropertySubtypeLabel(normalizedRequirementInventoryType, normalizedRequirementPropertySubtype) || normalizedRequirementPropertySubtype}
              </div>
            ) : null}
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Inventory Type
                </span>
                <select
                  value={requirementsDraft?.inventoryType || ""}
                  onChange={(event) => updateRequirementInventoryType(event.target.value)}
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                >
                  <option value="">Any</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="RESIDENTIAL">Residential</option>
                </select>
              </label>
              {normalizedRequirementInventoryType ? (
                <label className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {normalizedRequirementInventoryType === "COMMERCIAL" ? "Commercial Property Type" : "Residential Property Type"}
                  </span>
                  <select
                    value={requirementsDraft?.propertySubtype || ""}
                    onChange={(event) => updateRequirementPropertySubtype(event.target.value)}
                    className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                  >
                    <option value="">Any</option>
                    {propertySubtypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Deal Type
                </span>
                <select
                  value={requirementsDraft?.transactionType || ""}
                  onChange={(event) => updateRequirementRootField("transactionType", event.target.value)}
                  className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                >
                  <option value="">Any</option>
                  <option value="SALE">Purchase</option>
                  <option value="LEASE">Lease</option>
                  <option value="RENT">Rent</option>
                </select>
              </label>
              {showFurnishing ? (
                <label className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Furnishing
                  </span>
                  <select
                    value={furnishingValue}
                    onChange={(event) => updateRequirementRootField("furnishingStatus", event.target.value)}
                    className={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                  >
                    {furnishingOptions.map((option) => (
                      <option key={option.value || "any-furnishing"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Budget Min
                </span>
                <RequirementAdornedInput
                  type="number"
                  step="any"
                  adornment="₹"
                  inputClassName={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                  isDark={isDark}
                  value={requirementsDraft?.budgetMin || ""}
                  onChange={(event) => updateRequirementRootField("budgetMin", event.target.value)}
                  placeholder="Minimum budget"
                />
              </label>
              <label className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Budget Max
                </span>
                <RequirementAdornedInput
                  type="number"
                  step="any"
                  adornment="₹"
                  inputClassName={`h-9 w-full rounded-lg border px-2.5 text-sm ${input}`}
                  isDark={isDark}
                  value={requirementsDraft?.budgetMax || ""}
                  onChange={(event) => updateRequirementRootField("budgetMax", event.target.value)}
                  placeholder="Maximum budget"
                />
              </label>
            </div>

            {propertySubtypeConfig ? (
              <div className={`mt-3 rounded-xl border p-2.5 ${softCard}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {propertySubtypeConfig.label} Preferences
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(propertySubtypeConfig.fields || [])
                    .filter((field) => field.type !== "checkbox")
                    .map(renderSubtypeField)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(propertySubtypeConfig.fields || [])
                    .filter((field) => field.type === "checkbox")
                    .map(renderSubtypeField)}
                </div>
              </div>
            ) : null}
          </section>

          <section className={`rounded-3xl border p-4 ${card}`}>
            <div className="flex items-center justify-between">
              <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Properties</div>
              <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{relatedInventoryRows.length} linked</span>
            </div>
            {relatedInventoryRows.length === 0 ? (
              <p className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>No linked property.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {visibleRelatedInventoryRows.map((inventoryRow, rowIndex) => {
                  const inventoryId = inventoryRow.id;
                  const inventoryLabel = inventoryRow.label;
                  const inventoryLocation = inventoryRow.location;
                  const inventoryQuickInfo = inventoryRow.quickInfo;
                  const inventoryStatusLabel = inventoryRow.statusLabel;
                  const inventoryPriceLabel = formatCurrencyInr(inventoryRow?.inventory?.price);
                  const isActiveProperty = normalizedActiveInventoryId === inventoryId;
                  const isSelectingThisProperty = propertyActionType === "select" && String(propertyActionInventoryId || "") === String(inventoryId || "");
                  const isRemovingThisProperty = propertyActionType === "remove" && String(propertyActionInventoryId || "") === String(inventoryId || "");
                  return (
                    <div
                      key={inventoryId || `${inventoryLabel || "inventory"}-${rowIndex}`}
                      onClick={() => {
                        if (!inventoryId || isSelectingThisProperty || isRemovingThisProperty) return;
                        onSelectRelatedProperty(inventoryId);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-xs ${
                        isActiveProperty
                          ? isDark ? "border-emerald-400/45 bg-emerald-500/12" : "border-emerald-300 bg-emerald-50/60"
                          : isDark ? "border-slate-700 bg-slate-900 hover:border-emerald-400/35" : "border-slate-200 bg-white hover:border-emerald-200"
                      } ${inventoryId && !isSelectingThisProperty && !isRemovingThisProperty ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`break-words font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                            {inventoryLabel || "Inventory"}{inventoryLocation ? ` (${inventoryLocation})` : ""}
                          </div>
                          <div className={`mt-0.5 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Status: {inventoryStatusLabel || "-"}</div>
                          {inventoryQuickInfo ? (
                            <div className={`mt-0.5 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {inventoryQuickInfo}
                            </div>
                          ) : null}
                          <div className={`mt-0.5 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Price: {inventoryPriceLabel}</div>
                        </div>
                        {canManageLeadProperties && inventoryId ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenRelatedProperty(inventoryId); }} className={`inline-flex h-7 w-7 items-center justify-center rounded border ${button}`}>
                              {isSelectingThisProperty ? <Loader size={12} className="animate-spin" /> : <Eye size={12} />}
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveRelatedProperty(inventoryId); }} className={`inline-flex h-7 w-7 items-center justify-center rounded border ${button}`}>
                              {isRemovingThisProperty ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {hasMoreRelatedInventories ? (
                  <button
                    type="button"
                    onClick={() => setVisiblePropertiesCount((previous) => previous + RENDER_STEP_COUNT)}
                    className={`h-8 rounded-lg border px-3 text-[11px] font-semibold ${button}`}
                  >
                    Show More Properties ({relatedInventoryRows.length - visibleRelatedInventoryRows.length} left)
                  </button>
                ) : null}
              </div>
            )}
            {canManageLeadProperties ? (
              <div className={`mt-3 rounded-xl border p-2.5 ${softCard}`}>
                <div className="mb-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLinkableInventoryTypeFilter("ALL")}
                    className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-semibold ${
                      linkableInventoryTypeFilter === "ALL"
                        ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-500"
                        : button
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkableInventoryTypeFilter("SALE")}
                    className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-semibold ${
                      linkableInventoryTypeFilter === "SALE"
                        ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-500"
                        : button
                    }`}
                  >
                    For Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkableInventoryTypeFilter("RENT")}
                    className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-semibold ${
                      linkableInventoryTypeFilter === "RENT"
                        ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-500"
                        : button
                    }`}
                  >
                    Rental
                  </button>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={relatedInventoryDraft}
                    onChange={(event) => setRelatedInventoryDraft(String(event.target.value || ""))}
                    className={`h-9 min-w-0 flex-1 rounded-lg border px-2 text-xs ${input}`}
                  >
                    <option value="">
                      {sortedLinkableInventoryOptions.length
                        ? "Select property to link"
                        : "No properties found"}
                    </option>
                    {sortedLinkableInventoryOptions.map((inventory) => {
                      const inventoryId = String(inventory?._id || "");
                      const inventoryLabel = getInventoryLeadLabel(inventory)
                        || String(inventory?.title || "").trim()
                        || inventoryId;
                      const inventoryLocation = getInventoryLocationLabel(inventory);
                      const inventoryQuickInfo = getInventoryQuickInfo(inventory);
                      const inventoryPriceLabel = formatCurrencyInr(inventory?.price);
                      const inventoryTypeLabel =
                        String(inventory?.type || "").trim().toUpperCase() === "RENT"
                          ? "Rental"
                          : "For Sale";

                      return (
                        <option key={inventoryId} value={inventoryId}>
                          {[
                            inventoryLabel,
                            inventoryLocation ? `(${inventoryLocation})` : "",
                            inventoryQuickInfo,
                            `Type: ${inventoryTypeLabel}`,
                            `Price: ${inventoryPriceLabel}`,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => onLinkPropertyToLead(relatedInventoryDraft)}
                    disabled={!relatedInventoryDraft || linkingProperty}
                    className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-[11px] font-semibold text-white disabled:opacity-60 ${primaryBtn}`}
                  >
                    {linkingProperty ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                    Add
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={`rounded-3xl border p-4 ${card}`}>
            <div className="flex items-center justify-between gap-2">
              <div className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <FileText size={12} />
                Proposal Generator
              </div>
              <span className={`min-w-0 text-right text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Single or multiple properties
              </span>
            </div>

            {proposalPropertyOptions.length === 0 ? (
              <p className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Link at least one property first to generate proposal.
              </p>
            ) : (
              <>
                <div className={`mt-2 rounded-xl border p-2.5 ${softCard}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Select Properties ({selectedPropertyCount}/{proposalPropertyOptions.length})
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSelectAllProposalProperties}
                        disabled={selectedPropertyCount === proposalPropertyOptions.length}
                        className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-semibold disabled:opacity-55 ${button}`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={handleResetProposalSelection}
                        className={`inline-flex h-7 items-center rounded border px-2 text-[10px] font-semibold ${button}`}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto custom-scrollbar pr-1">
                    {visibleProposalPropertyOptions.map((property) => {
                      const checked = selectedProposalPropertyIdSet.has(property.id);
                      return (
                        <label
                          key={property.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 text-[11px] ${
                            checked
                              ? isDark ? "border-emerald-400/45 bg-emerald-500/12" : "border-emerald-300 bg-emerald-50/70"
                              : isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggleProposalProperty(property.id)}
                          />
                          <div className="min-w-0">
                            <div className={`truncate font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                              {property.label}
                            </div>
                            <div className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {property.statusLabel || "-"} | {property.imageUrls.length} image(s)
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {hasMoreProposalPropertyOptions ? (
                    <button
                      type="button"
                      onClick={() => setVisibleProposalOptionsCount((previous) => previous + RENDER_STEP_COUNT)}
                      className={`mt-2 h-7 rounded-lg border px-2.5 text-[10px] font-semibold ${button}`}
                    >
                      Show More Options ({proposalPropertyOptions.length - visibleProposalPropertyOptions.length} left)
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className={`rounded-lg border px-2.5 py-2 text-xs ${softCard}`}>
                    <div className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>Selected Properties</div>
                    <div className={`mt-0.5 font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                      {selectedPropertyCount}
                    </div>
                  </div>
                  <div className={`rounded-lg border px-2.5 py-2 text-xs ${softCard}`}>
                    <div className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>Images Included</div>
                    <div className={`mt-0.5 font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                      {proposalImageEntries.length}
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-[11px]">
                    <span className={`font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Validity (Days)</span>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={proposalValidityDays}
                      onChange={(event) => setProposalValidityDays(event.target.value)}
                      className={`mt-1 h-9 w-full rounded-lg border px-3 text-sm ${input}`}
                    />
                  </label>
                  <label className="text-[11px]">
                    <span className={`font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Special Note</span>
                    <input
                      type="text"
                      value={proposalSpecialNote}
                      onChange={(event) => setProposalSpecialNote(event.target.value)}
                      placeholder="Optional client note"
                      className={`mt-1 h-9 w-full rounded-lg border px-3 text-sm ${input}`}
                    />
                  </label>
                </div>

                <div className={`mt-2 rounded-xl border p-2.5 ${softCard}`}>
                  <div className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <Image size={12} />
                    Property Images ({proposalImageEntries.length})
                  </div>
                  {proposalImageEntries.length ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {proposalPreviewImageEntries.map((entry, index) => (
                        <a
                          key={`${entry.propertyId}-${entry.url}-${index}`}
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`group relative overflow-hidden rounded-lg border ${isDark ? "border-slate-700" : "border-slate-200"}`}
                        >
                          <img
                            src={entry.url}
                            alt={`Property ${index + 1}`}
                            className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                          <div className={`absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-0.5 text-[10px] text-white`}>
                            {entry.propertyLabel}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      No images attached for selected properties.
                    </p>
                  )}
                </div>

                <textarea
                  value={proposalText}
                  readOnly
                  className={`mt-2 min-h-[220px] w-full rounded-xl border px-3 py-2 text-xs leading-5 ${input}`}
                />

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleCopyProposal}
                    disabled={!selectedPropertyCount}
                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadProposal}
                    disabled={isGeneratingProposalPdf || !selectedPropertyCount}
                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                      isGeneratingProposalPdf || !selectedPropertyCount
                        ? `${input} cursor-not-allowed opacity-60`
                        : button
                    }`}
                  >
                    {isGeneratingProposalPdf ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                    PDF
                  </button>
                  {proposalImageEntries.length ? (
                    <button
                      type="button"
                      onClick={handleCopyImageLinks}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}
                    >
                      <Copy size={12} />
                      Img Links
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleShareToWhatsApp}
                    disabled={isGeneratingProposalPdf || (!proposalWhatsAppHref && !canUseNativeShare) || !selectedPropertyCount}
                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                      !isGeneratingProposalPdf && selectedPropertyCount && (proposalWhatsAppHref || canUseNativeShare)
                        ? button
                        : `${input} cursor-not-allowed opacity-60`
                    }`}
                  >
                    {WhatsAppIcon ? <WhatsAppIcon size={12} /> : null}
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleShareByEmail}
                    disabled={!selectedPropertyCount}
                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                      selectedPropertyCount ? button : `${input} cursor-not-allowed opacity-60`
                    }`}
                  >
                    <Mail size={12} />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeShareProposal}
                    disabled={isGeneratingProposalPdf || !selectedPropertyCount}
                    className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                      isGeneratingProposalPdf || !selectedPropertyCount
                        ? `${input} cursor-not-allowed opacity-60`
                        : button
                    }`}
                  >
                    {isGeneratingProposalPdf ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                    Share PDF
                  </button>
                  {canUseNativeShare && proposalImageEntries.length ? (
                    <button
                      type="button"
                      onClick={handleNativeShareImages}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${button}`}
                    >
                      <Image size={12} />
                      Share Images
                    </button>
                  ) : null}
                </div>

                {isGeneratingProposalPdf ? (
                  <div className={`mt-2 text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Generating PDF with property images...
                  </div>
                ) : null}
                {proposalActionMessage ? (
                  <div className={`mt-2 text-[11px] font-semibold ${isDark ? "text-emerald-200" : "text-emerald-700"}`}>
                    {proposalActionMessage}
                  </div>
                ) : null}
              </>
            )}
          </section>

          {canAssignLead ? (
            <section className={`rounded-3xl border p-4 ${card}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Assign / Transfer Lead</div>
                  <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Current owner: <span className={isDark ? "font-semibold text-slate-100" : "font-semibold text-slate-800"}>{currentOwnerName}</span>
                    {currentOwnerRole ? ` (${statusLabel(currentOwnerRole)})` : ""}
                  </p>
                </div>
              </div>
              {showQualifiedTransferHelper ? (
                <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs font-medium ${
                  isDark ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}>
                  This lead is qualified. You can assign it to a Field Executive for site visit or deal handling.
                </div>
              ) : null}
              <input
                type="search"
                value={assigneeSearchDraft}
                onChange={(event) => setAssigneeSearchDraft(event.target.value)}
                placeholder="Search by name or role"
                className={`mt-3 h-11 w-full rounded-xl border px-3 text-sm ${input}`}
              />
              <select
                value={executiveDraft}
                onChange={(event) => setExecutiveDraft(event.target.value)}
                className={`mt-2 h-11 w-full rounded-xl border px-3 text-sm ${input}`}
              >
                <option value="">Select user</option>
                {filteredAssignees.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({statusLabel(user.role)})
                    {user.lastAssignedAt ? ` - last ${formatDate(user.lastAssignedAt)}` : ""}
                  </option>
                ))}
              </select>
              <textarea
                value={transferReasonDraft}
                onChange={(event) => setTransferReasonDraft(event.target.value)}
                placeholder="Transfer reason (optional)"
                rows={3}
                className={`mt-2 min-h-24 w-full resize-y rounded-xl border px-3 py-2 text-sm ${input}`}
              />
              <div className="sticky bottom-0 -mx-1 mt-3 flex gap-2 bg-inherit pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setExecutiveDraft(selectedLead?.assignedTo?._id || "");
                    setTransferReasonDraft("");
                    setAssigneeSearchDraft("");
                  }}
                  className={`h-11 flex-1 rounded-xl border text-sm font-semibold ${button}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onAssignLead}
                  disabled={!executiveDraft || assigning}
                  className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-60 ${button}`}
                >
                  {assigning ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                  {assigning ? "Transferring..." : "Save Transfer"}
                </button>
              </div>
            </section>
          ) : null}

          <section className={`rounded-3xl border p-4 ${card}`}>
            <div className={`mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <History size={12} /> Assignment History
            </div>
            {assignmentHistoryEvents.length === 0 ? (
              <div className={`rounded-2xl border border-dashed px-3 py-4 text-sm ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
                No assignment history yet
              </div>
            ) : (
              <div className="space-y-0">
                {assignmentHistoryEvents.map((event, index) => {
                  const hasConnector = index < assignmentHistoryEvents.length - 1;
                  const fromUser = getUserDisplayName(event.fromUser);
                  const toUser = getUserDisplayName(event.toUser);
                  const createdBy = getUserDisplayName(event.createdBy, event.synthetic ? "System" : "-");
                  const reason = String(event.reason || "").trim();
                  const statusAtTransfer = String(event.statusAtTransfer || "").trim();

                  return (
                    <div key={event._id || `${event.action}-${index}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1 h-3 w-3 rounded-full border-2 ${
                          isDark ? "border-cyan-300 bg-slate-950" : "border-cyan-600 bg-white"
                        }`} />
                        {hasConnector ? (
                          <span className={`mt-1 h-full min-h-12 w-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                        ) : null}
                      </div>

                      <div className={`min-w-0 pb-3 ${hasConnector ? "" : "pb-0"}`}>
                        <div className={`rounded-2xl border p-3 ${softCard}`}>
                          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                                {getAssignmentActionLabel(event.action)}
                              </div>
                              <div className={`mt-0.5 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {formatDate(event.createdAt)}
                              </div>
                            </div>
                            {statusAtTransfer ? (
                              <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                                isDark ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-600"
                              }`}>
                                {statusLabel(statusAtTransfer)}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 grid min-w-0 grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
                            <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                              From: <span className={isDark ? "font-semibold text-slate-200" : "font-semibold text-slate-700"}>{fromUser}</span>
                            </div>
                            <div className={isDark ? "text-slate-400" : "text-slate-500"}>
                              To: <span className={isDark ? "font-semibold text-slate-200" : "font-semibold text-slate-700"}>{toUser}</span>
                            </div>
                            <div className={`min-w-0 sm:col-span-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              Created by: <span className={isDark ? "font-semibold text-slate-200" : "font-semibold text-slate-700"}>{createdBy}</span>
                            </div>
                            {reason ? (
                              <div className={`min-w-0 break-words sm:col-span-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                Reason: {reason}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4 xl:col-span-7">
          <section className={`rounded-3xl border p-4 ${card}`}>
            <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Lead Controls</div>
            <div className="mt-2">
              <label className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <CalendarClock size={12} />
                {requiresRemainingPaymentFollowUp ? "Remaining Payment Follow-up" : "Next Follow-up"}
                {requiresRemainingPaymentFollowUp ? (
                  <span className={isDark ? "text-amber-200" : "text-amber-700"}>*</span>
                ) : null}
              </label>
              <input type="datetime-local" value={followUpDraft} onChange={(event) => setFollowUpDraft(event.target.value)} className={`mt-1 h-10 w-full rounded-xl border px-3 text-sm ${input}`} />
              {requiresRemainingPaymentFollowUp ? (
                <div className={`mt-1 text-[10px] ${isDark ? "text-amber-200" : "text-amber-700"}`}>
                  Required for collection of pending amount
                  {remainingAmountForCollection ? ` (${formatCurrencyInr(remainingAmountForCollection)})` : ""}.
                </div>
              ) : null}
              {requiresRemainingPaymentFollowUp ? (
                <button
                  type="button"
                  onClick={handleCreateRemainingPaymentFollowUp}
                  className={`mt-2 inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[11px] font-semibold ${button}`}
                >
                  <CalendarClock size={12} />
                  {hasFollowUpDraft ? "Recreate Follow-up" : "Create Follow-up"}
                  {remainingAmountForCollection ? ` (${formatCurrencyInr(remainingAmountForCollection)})` : ""}
                </button>
              ) : null}
            </div>

            <div className={`mt-3 rounded-xl border p-3 ${softCard}`}>
              <div className={`mb-2 text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Lead Diary</div>
              <textarea
                value={diaryDraft}
                onChange={(event) => setDiaryDraft(event.target.value)}
                placeholder="Add conversation notes, visit details, objections, or next steps..."
                className={`min-h-[120px] w-full resize-y rounded-xl border px-3 py-2 text-sm ${input}`}
                maxLength={2000}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{diaryDraft.length}/2000</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onDiaryVoiceToggle} disabled={savingDiary || !isDiaryMicSupported} className={`inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-60 ${button}`}>
                    {isDiaryListening ? <MicOff size={13} /> : <Mic size={13} />} {isDiaryListening ? "Stop Mic" : "Voice"}
                  </button>
                  <button type="button" onClick={onAddDiary} disabled={savingDiary || !diaryDraft.trim()} className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60 ${primaryBtn}`}>
                    {savingDiary ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} Add Note
                  </button>
                </div>
              </div>
              {!isDiaryMicSupported ? (
                <div className={`mt-2 text-[10px] ${isDark ? "text-amber-200" : "text-amber-700"}`}>Voice input not supported in this browser.</div>
              ) : null}
              <div className="mt-3">
                {diaryLoading ? (
                  <div className={`flex h-16 items-center justify-center gap-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <Loader size={14} className="animate-spin" /> Loading diary...
                  </div>
                ) : normalizedDiaryEntries.length === 0 ? (
                  <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>No diary notes yet</div>
                ) : (
                  <div className="space-y-2">
                    {visibleDiaryEntries.map((entry) => (
                      <div key={entry._id} className={`rounded-lg border p-2 ${softCard}`}>
                        <div className={`whitespace-pre-wrap break-words text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>{entry.note}</div>
                        <div className={`mt-1 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {formatDate(entry.createdAt)}{entry.createdBy?.name ? ` - ${entry.createdBy.name}` : ""}
                        </div>
                      </div>
                    ))}
                    {hasMoreDiaryEntries ? (
                      <button
                        type="button"
                        onClick={() => setVisibleDiaryCount((previous) => previous + RENDER_STEP_COUNT)}
                        className={`h-8 rounded-lg border px-3 text-[11px] font-semibold ${button}`}
                      >
                        Show More Notes ({normalizedDiaryEntries.length - visibleDiaryEntries.length} left)
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3">
              <label className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Status</label>
              <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} className={`mt-1 h-10 w-full rounded-xl border px-3 text-sm ${input}`}>
                {leadStatuses.map((status) => (
                  <option key={status} value={status} disabled={!canReviewDealPayment && status === "REQUESTED"}>
                    {String(status).replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            {isClosedStatusSelected ? (
              <div className={`mt-3 rounded-xl border p-3 space-y-3 ${softCard}`}>
                <div className={`flex items-center justify-between gap-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  <div className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Document Submission</div>
                  <div className="text-[10px]">
                    {normalizedClosureDocuments.length}/{MAX_CLOSURE_DOCUMENTS}
                  </div>
                </div>
                <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Upload closing proof documents (photos or PDF).
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border px-3 text-xs font-semibold ${
                      uploadingClosureDocuments || remainingClosureSlots <= 0 ? `${input} cursor-not-allowed opacity-60` : button
                    }`}
                  >
                    {uploadingClosureDocuments ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                    {uploadingClosureDocuments ? "Uploading..." : "Add Photos / PDFs"}
                    <input
                      type="file"
                      accept={CLOSURE_DOCUMENT_ACCEPT}
                      multiple
                      disabled={uploadingClosureDocuments || remainingClosureSlots <= 0}
                      onChange={handleClosureDocumentsInput}
                      className="hidden"
                    />
                  </label>
                  <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Max file size: 25MB each
                  </div>
                </div>
                {closureUploadMessage ? (
                  <div className={`text-[11px] font-semibold ${isDark ? "text-emerald-200" : "text-emerald-700"}`}>
                    {closureUploadMessage}
                  </div>
                ) : null}

                {normalizedClosureDocuments.length === 0 ? (
                  <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                    No documents uploaded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {normalizedClosureDocuments.map((doc, index) => (
                      <div key={doc.url || `${doc.name}-${index}`} className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-2 ${input}`}>
                        <div className="min-w-0">
                          <div className={`truncate text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                            {doc.name || `Document ${index + 1}`}
                          </div>
                          <div className={`text-[10px] uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {doc.kind || "file"} - {formatFileSize(doc.size)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${button}`}
                            title="View document"
                          >
                            <Eye size={13} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveClosureDocument(doc.url)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${button}`}
                            title="Remove document"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {isClosedDealFlow ? (
              <div className={`mt-3 rounded-xl border p-3 space-y-3 ${softCard}`}>
                <div className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Deal Payment & Approval</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={paymentModeDraft}
                    onChange={(event) => { const nextMode = String(event.target.value || ""); setPaymentModeDraft(nextMode); if (nextMode === "CASH") setPaymentReferenceDraft(""); }}
                    className={`h-9 w-full rounded-lg border px-2 text-xs ${input}`}
                  >
                    <option value="">Payment mode</option>
                    {dealPaymentModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                  </select>
                  <select
                    value={paymentTypeDraft}
                    onChange={(event) => {
                      const nextPaymentType = String(event.target.value || "");
                      setPaymentTypeDraft(nextPaymentType);
                      if (nextPaymentType === "PARTIAL" && !String(followUpDraft || "").trim()) {
                        setFollowUpDraft(buildDefaultCollectionFollowUp());
                      }
                    }}
                    className={`h-9 w-full rounded-lg border px-2 text-xs ${input}`}
                  >
                    <option value="">Payment type</option>
                    {dealPaymentTypes.map((paymentType) => <option key={paymentType.value} value={paymentType.value}>{paymentType.label}</option>)}
                  </select>
                </div>
                {requiresPaymentReference ? (
                  <input type="text" value={paymentReferenceDraft} onChange={(event) => setPaymentReferenceDraft(event.target.value)} placeholder="UTR / Txn / Cheque no." className={`h-9 w-full rounded-lg border px-3 text-sm ${input}`} />
                ) : null}
                {showRemainingAmountField ? (
                  <input type="number" min="0" step="0.01" value={paymentRemainingDraft} onChange={(event) => setPaymentRemainingDraft(event.target.value)} placeholder="Remaining amount" className={`h-9 w-full rounded-lg border px-3 text-sm ${input}`} />
                ) : null}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Brokerage Received *
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={brokerageReceivedDraft}
                      onChange={(event) => setBrokerageReceivedDraft(event.target.value)}
                      placeholder="Company brokerage received"
                      className={`h-9 w-full rounded-lg border px-3 text-sm ${input}`}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Brokerage Distributed
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={brokerageDistributedDraft}
                      onChange={(event) => setBrokerageDistributedDraft(event.target.value)}
                      placeholder="0"
                      className={`h-9 w-full rounded-lg border px-3 text-sm ${input}`}
                    />
                  </label>
                </div>
                <div className={`rounded-lg border px-2 py-1.5 text-[11px] ${isDark ? "border-sky-500/30 bg-sky-500/10 text-sky-100" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
                  Only Brokerage Received will be counted as company revenue.
                </div>
                <textarea value={paymentNoteDraft} onChange={(event) => setPaymentNoteDraft(event.target.value)} placeholder="Executive payment note..." maxLength={1000} className={`min-h-[68px] w-full rounded-lg border px-3 py-2 text-xs ${input}`} />
                <div className={`rounded-lg border px-2 py-1.5 text-xs ${
                  currentApprovalStatus === "APPROVED"
                    ? isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : currentApprovalStatus === "REJECTED"
                      ? isDark ? "border-rose-500/40 bg-rose-500/10 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-700"
                      : isDark ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  Payment Approval Status: {approvalLabel(currentApprovalStatus)}
                </div>
                {canReviewDealPayment ? (
                  <div className="space-y-2">
                    <select value={paymentApprovalStatusDraft} onChange={(event) => setPaymentApprovalStatusDraft(event.target.value)} className={`h-9 w-full rounded-lg border px-2 text-xs ${input}`}>
                      <option value="">Keep current status</option>
                      {dealPaymentAdminDecisions.map((decision) => <option key={decision.value} value={decision.value}>{decision.label}</option>)}
                    </select>
                    <textarea value={paymentApprovalNoteDraft} onChange={(event) => setPaymentApprovalNoteDraft(event.target.value)} placeholder="Admin note..." maxLength={1000} className={`min-h-[60px] w-full rounded-lg border px-3 py-2 text-xs ${input}`} />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={`mt-3 rounded-xl border p-3 ${softCard}`}>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Site Location</div>
              {canConfigureSiteLocation ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input type="number" step="any" value={siteLatDraft} onChange={(event) => setSiteLatDraft(event.target.value)} placeholder="Latitude" className={`h-9 rounded-lg border px-3 text-sm ${input}`} />
                  <input type="number" step="any" value={siteLngDraft} onChange={(event) => setSiteLngDraft(event.target.value)} placeholder="Longitude" className={`h-9 rounded-lg border px-3 text-sm ${input}`} />
                </div>
              ) : (
                <div className={`mt-2 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {selectedLeadSiteLat !== null && selectedLeadSiteLng !== null ? `${selectedLeadSiteLat}, ${selectedLeadSiteLng}` : "Not configured by admin/manager"}
                </div>
              )}
              <div className={`mt-2 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Site visit status is verified within {siteVisitRadiusMeters} meters.</div>
            </div>

            {userRole === "FIELD_EXECUTIVE" && statusDraft === "SITE_VISIT" ? (
              <div className={`mt-2 rounded-lg border p-2 text-[11px] ${
                isDark ? "border-amber-500/35 bg-amber-500/15 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                SITE_VISIT requires your live location within {siteVisitRadiusMeters} meters.
              </div>
            ) : null}

            <button type="button" onClick={onUpdateLead} disabled={savingUpdates} className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 ${primaryBtn}`}>
              {savingUpdates ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save Lead Update
            </button>
          </section>

          {/* Lead Tasks integration */}
          <section className={`rounded-3xl border p-4 ${card}`}>
            <div className="flex items-center justify-between">
              <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>Lead Tasks</div>
              <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{leadTasks.filter(t => t.status !== "COMPLETED").length} pending</span>
            </div>

            {/* Quick add task form */}
            <form onSubmit={handleAddLeadTask} className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a new task for this lead..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className={`h-9 flex-1 rounded-lg border px-3 text-xs ${input}`}
                />
                <button
                  type="submit"
                  disabled={addingTask || !newTaskTitle.trim()}
                  className={`inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-55 ${primaryBtn}`}
                >
                  {addingTask ? "Adding..." : "Add"}
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className={`h-8 rounded-lg border px-2 text-[10px] font-semibold ${input}`}
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Med Priority</option>
                  <option value="HIGH">High Priority</option>
                </select>

                <select
                  value={newTaskAssignedTo}
                  onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                  className={`h-8 rounded-lg border px-2 text-[10px] font-semibold ${input}`}
                >
                  <option value="">Unassigned</option>
                  {executives.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className={`h-8 rounded-lg border px-2 text-[10px] font-semibold ${input}`}
                />
              </div>
            </form>

            {/* Tasks list */}
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {loadingTasks ? (
                <div className={`text-xs py-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Loading tasks...
                </div>
              ) : leadTasks.length === 0 ? (
                <div className={`text-xs py-4 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  No tasks linked to this lead.
                </div>
              ) : (
                leadTasks.map((task) => {
                  const isCompleted = task.status === "COMPLETED";
                  const expired = !isCompleted && task.dueDate && new Date(task.dueDate) < new Date().setHours(0,0,0,0);
                  
                  return (
                    <div 
                      key={task._id} 
                      className={`flex items-start justify-between gap-2.5 rounded-lg border p-2.5 text-xs transition-all ${
                        isCompleted
                          ? isDark ? "border-slate-800 bg-slate-950/35 opacity-60" : "border-slate-100 bg-slate-50/60 opacity-60"
                          : isDark ? "border-slate-700 bg-slate-900/60 hover:border-slate-600" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleLeadTaskStatus(task)}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isCompleted
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isDark ? "border-slate-700 hover:border-sky-400" : "border-slate-350 hover:border-sky-500"
                          }`}
                        >
                          {isCompleted && <Check size={11} strokeWidth={3} />}
                        </button>

                        <div className="min-w-0">
                          <p className={`font-semibold leading-normal break-words ${
                            isCompleted ? "line-through text-slate-500" : isDark ? "text-slate-100" : "text-slate-800"
                          }`}>
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold">
                            <span className={`px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              task.priority === "HIGH"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : task.priority === "MEDIUM"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}>
                              {task.priority}
                            </span>

                            {task.assignedTo && (
                              <span className={`px-1.5 py-0.5 rounded border ${
                                isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                Assigned: {task.assignedTo.name}
                              </span>
                            )}

                            {task.dueDate && (
                              <span className={`px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                                expired 
                                  ? "bg-rose-500/15 text-rose-500 border-rose-500/20 font-bold" 
                                  : isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                <Calendar size={8} />
                                {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                {expired && " (Overdue)"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteLeadTask(task._id)}
                        className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 border-transparent text-rose-550 hover:bg-rose-500/10`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section
            className={`rounded-3xl border p-4 ${card}`}
            style={{ contentVisibility: "auto", containIntrinsicSize: "280px" }}
          >
            <div className={`mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <History size={12} /> Activity Timeline
            </div>
            {activityLoading ? (
              <div className={`flex h-24 items-center justify-center gap-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Loader size={14} className="animate-spin" /> Loading timeline...
              </div>
            ) : normalizedActivities.length === 0 ? (
              <div className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>No activity yet</div>
            ) : (
              <div className="space-y-2">
                {visibleActivities.map((activity) => (
                  <div key={activity._id} className={`rounded-lg border p-2 ${softCard}`}>
                    <div className={`text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>{activity.action}</div>
                    <div className={`mt-1 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {formatDate(activity.createdAt)}{activity.performedBy?.name ? ` - ${activity.performedBy.name}` : ""}
                    </div>
                  </div>
                ))}
                {hasMoreActivities ? (
                  <button
                    type="button"
                    onClick={() => setVisibleActivityCount((previous) => previous + RENDER_STEP_COUNT)}
                    className={`h-8 rounded-lg border px-3 text-[11px] font-semibold ${button}`}
                  >
                    Show More Activity ({normalizedActivities.length - visibleActivities.length} left)
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </Motion.section>
  );
};

export const LeadDetailsRebuilt = (props) => {
  if (!props.selectedLead) return null;
  return <LeadDetailsRebuiltContent {...props} />;
};

