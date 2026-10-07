import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/ui/Icon";
import { Glyph } from "../../components/ui/Glyph";
import { brand, brandStyles, layout, round, type as bt } from "../../theme/brand";
import { BrokerPhoneHint } from "./components/BrokerPhoneHint";
import { LeadOverview } from "./components/LeadOverview";
import { AppSheet } from "../../components/ui/Overlay";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import {
  addLeadDiaryEntry,
  addLeadRelatedProperty,
  assignLead,
  getAllLeads,
  getLeadById,
  getLeadActivity,
  getLeadDiary,
  getLeadStatusRequests,
  clearLeadFollowUp,
  requestLeadStatusChange,
  removeLeadRelatedProperty,
  selectLeadRelatedProperty,
  updateLeadBasics,
  updateLeadDiaryEntry,
  updateLeadStatus,
  type LeadDiaryEntry,
  type LeadStatusRequest,
} from "../../services/leadService";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  type Task,
} from "../../services/taskService";
import { uploadChatFile } from "../../services/chatService";
import api from "../../services/api";
import { toAbsoluteUrl } from "../../services/uploadService";
import { sessionStorage } from "../../storage/sessionStorage";
import { getInventoryAssets } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import type { Lead } from "../../types";
import {
  buildLeadRequirementsPayloadFromDraft,
  createDefaultLeadRequirementsDraft,
  mapLeadRequirementsToDraft,
  validateLeadRequirementDraft,
  withSubtypeField,
  type CoworkingDraft,
} from "./leadRequirements";
import { getPropertySubtypeConfig, getPropertySubtypeOptions } from "../../config/propertyRequirementConfig";
import { SubtypeFieldsEditor } from "../../components/common/SubtypeFieldsEditor";
import { CoworkingRequirementEditor } from "../../components/common/CoworkingRequirementEditor";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { AppSegmentedTabs } from "../../components/ui";
import { colors } from "../../theme/tokens";
import { themedStyles, themeColor } from "../../theme/themedStyles";

const STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT",
  "SITE_VISIT_OVERDUE",
  "MISSING_IN_ACTION",
  "NOT_PICKING_CALLS",
  "INVALID",
  "OWNER",
  "BROKER",
  "REQUESTED",
  "CLOSED",
  "LOST",
];
const CLOSED_STATUS = "CLOSED";
const DEAL_PAYMENT_MODES = [
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "NET_BANKING_NEFTRTGSIMPS", label: "Net Banking (NEFT/RTGS/IMPS)" },
] as const;
const DEAL_PAYMENT_TYPES = [
  { value: "FULL", label: "Full" },
  { value: "PARTIAL", label: "Partial" },
] as const;
const PAYMENT_MODE_OPTIONS = ["Cash", "Cheque", "Bank Transfer", "UPI"] as const;
const TRANSFER_TYPE_OPTIONS = ["RTGS", "IMPS", "NEFT"] as const;
const LINK_PROPERTY_TYPE_OPTIONS = ["ALL", "SALE", "RENT"] as const;
const EMPTY_CLOSED_FORM = {
  saleLeadId: "",
  paymentMode: "Cash" as (typeof PAYMENT_MODE_OPTIONS)[number],
  totalAmount: "",
  partialAmount: "",
  remainingAmount: "",
  remainingDueDate: "",
  paymentDate: "",
  chequeBankName: "",
  chequeNumber: "",
  chequeDate: "",
  bankTransferType: "RTGS" as (typeof TRANSFER_TYPE_OPTIONS)[number],
  bankTransferUtrNumber: "",
  upiTransactionId: "",
};

const pad = (value: number) => String(value).padStart(2, "0");

const toDigits = (value?: string) => String(value || "").replace(/\D/g, "");

const toLocalTenDigitPhone = (value?: string) => {
  const digits = toDigits(value);
  if (digits.length < 10) return "";
  return digits.slice(-10);
};

const toWhatsAppPhone = (value?: string) => {
  const digits = toDigits(value);
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11) return digits.slice(0, 15);
  return "";
};
const IS_WEB = Platform.OS === ("web" as any);

const formatFollowUpInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseFollowUpInput = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{2})[-\/](\d{2})[-\/](\d{4})\s+(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
};

const formatFollowUpDate = (date: Date) =>
  `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
const formatDateOnly = (date: Date) =>
  `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
const parseDateOnly = (value?: string) => {
  const match = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(String(value || "").trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

const formatProposalDate = (date = new Date()) => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

const pickUriString = (value: unknown) => String(value || "").trim();
const toObjectIdString = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id?: string })._id || "");
  }
  return String(value || "");
};

const LEAD_REQUIREMENT_FURNISHING_OPTIONS = [
  { value: "", label: "Any Furnishing" },
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI_FURNISHED", label: "Semi Furnished" },
  { value: "FULLY_FURNISHED", label: "Fully Furnished" },
  { value: "BARE_SHELL", label: "Bare Shell" },
  { value: "WARM_SHELL", label: "Warm Shell" },
  { value: "MANAGED_OFFICE", label: "Managed Office" },
  { value: "COWORKING", label: "Coworking" },
  { value: "SHOPS", label: "Shops" },
  { value: "SHOWROOMS", label: "Showrooms" },
  { value: "CAFES", label: "Cafes" },
  { value: "ROOFTOP", label: "Rooftop" },
];

const COMMERCIAL_ONLY_FURNISHING_VALUES = new Set([
  "BARE_SHELL",
  "WARM_SHELL",
  "MANAGED_OFFICE",
  "COWORKING",
  "SHOPS",
  "SHOWROOMS",
  "CAFES",
  "ROOFTOP",
]);

const getRequirementFurnishingOptions = (inventoryType = "") => {
  if (String(inventoryType).trim().toUpperCase() !== "RESIDENTIAL") {
    return LEAD_REQUIREMENT_FURNISHING_OPTIONS;
  }
  return LEAD_REQUIREMENT_FURNISHING_OPTIONS.filter(
    (option) => !COMMERCIAL_ONLY_FURNISHING_VALUES.has(option.value),
  );
};

const LEAD_REQUIREMENT_BHK_OPTIONS = [
  { value: "", label: "Any BHK" },
  { value: "1BHK", label: "1 BHK" },
  { value: "2BHK", label: "2 BHK" },
  { value: "3BHK", label: "3 BHK" },
  { value: "4BHK", label: "4 BHK" },
  { value: "5BHK", label: "5 BHK" },
  { value: "STUDIO", label: "Studio" },
  { value: "OTHER", label: "Other" },
];

const LEAD_REQUIREMENT_RESIDENTIAL_AMENITY_FIELDS = [
  { key: "lift", label: "Lift" },
  { key: "security", label: "Security" },
  { key: "gym", label: "Gym" },
  { key: "swimmingPool", label: "Swimming Pool" },
  { key: "clubhouse", label: "Clubhouse" },
  { key: "powerBackup", label: "Power Backup" },
  { key: "parking", label: "Parking" },
];

const getInventoryLeadLabel = (inventory: any) =>
  [inventory?.projectName, inventory?.towerName, inventory?.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

// Client-facing name for a property in proposals: its ID and listing name only.
// Building, tower (filled from the building name) and unit/office number stay internal.
const getInventoryClientLabel = (inventory: any) =>
  [inventory?.propertyId, inventory?.projectName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" - ");

const getLeadRelatedInventories = (lead: any) => {
  if (!lead) return [];
  const merged: any[] = [];
  const seen = new Set<string>();
  const pushUnique = (value: any) => {
    const id = toObjectIdString(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((value: any) => pushUnique(value));
  }

  return merged;
};

const toCoordinateNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const escapeHtml = (value: string) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const resolveMediaUrl = (rawUrl?: string) => {
  const safe = String(rawUrl || "").trim();
  if (!safe) return "";
  if (/^https?:\/\//i.test(safe)) return safe;
  const base = String(process.env.EXPO_PUBLIC_API_ORIGIN || process.env.EXPO_PUBLIC_SOCKET_URL || "").trim().replace(/\/$/, "");
  if (!base) return safe;
  return `${base}${safe.startsWith("/") ? "" : "/"}${safe}`;
};

/*
 * The five tabs the comps give this screen. The sections underneath were
 * already here as one long scroll; the tabs group them rather than replacing
 * them, which is why the guards wrap existing cards instead of new ones.
 */
type DetailTab = "overview" | "requirements" | "notes" | "tasks" | "activity";

const DETAIL_TABS = [
  /* The comp's summary is the overview now; this tab is the linked properties
     and the proposal generator that used to sit under that name. */
  { key: "overview", label: "Properties" },
  { key: "requirements", label: "Requirements" },
  { key: "notes", label: "Notes" },
  { key: "tasks", label: "Tasks" },
  { key: "activity", label: "Activity" },
];

export const LeadDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const leadId = String(
    route.params?.leadId
    || route.params?.id
    || route.params?.lead?._id
    || "",
  ).trim();
  const fallbackRouteLeadId = String(route.params?.lead?._id || "").trim();
  const initialRouteLead = ((route.params?.lead && typeof route.params.lead === "object")
    ? route.params.lead
    : null) as Lead | null;
  const { role, user } = useAuth();
  const normalizedRole = String(role || "").toUpperCase();
  const canManage = ["ADMIN", "MANAGER"].includes(normalizedRole);
  const canLinkProperties = canManage || ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(normalizedRole);

  const [loading, setLoading] = useState(!initialRouteLead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lead, setLead] = useState<Lead | null>(initialRouteLead);
  const [activities, setActivities] = useState<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>>([]);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [diaryEntries, setDiaryEntries] = useState<LeadDiaryEntry[]>([]);
  /* The comp's kebab: the contact shortcuts the command-center strip used to hold. */
  const [overviewSheet, setOverviewSheet] = useState(false);
  /*
   * The profile card below predates the comp and holds the editable contact
   * fields. The comp's summary already shows all of it read-only, so it stays
   * closed until someone actually wants to edit - otherwise the screen reads
   * as two different apps stacked on top of each other.
   */
  const [editOpen, setEditOpen] = useState(false);
  const [statusRequestHistory, setStatusRequestHistory] = useState<LeadStatusRequest[]>([]);
  const [saleLeadOptions, setSaleLeadOptions] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);
  const [executives, setExecutives] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);
  const [inventoryOptions, setInventoryOptions] = useState<any[]>([]);

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [followUpPickerMode, setFollowUpPickerMode] = useState<"date" | "time">("date");
  const [followUpPickerSeed, setFollowUpPickerSeed] = useState<Date>(new Date());
  const [followUpPickerDatePart, setFollowUpPickerDatePart] = useState<Date>(new Date());
  const webFollowUpPickerRef = useRef<any>(null);
  const [leadNameDraft, setLeadNameDraft] = useState("");
  const [leadPhoneDraft, setLeadPhoneDraft] = useState("");
  const [leadEmailDraft, setLeadEmailDraft] = useState("");
  const [leadCityDraft, setLeadCityDraft] = useState("");
  const [leadProjectDraft, setLeadProjectDraft] = useState("");
  const [assignDraft, setAssignDraft] = useState("");
  const [siteLatDraft, setSiteLatDraft] = useState("");
  const [siteLngDraft, setSiteLngDraft] = useState("");
  const [relatedInventoryTypeFilter, setRelatedInventoryTypeFilter] = useState<(typeof LINK_PROPERTY_TYPE_OPTIONS)[number]>("ALL");
  const [relatedInventoryDraft, setRelatedInventoryDraft] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [linkingProperty, setLinkingProperty] = useState(false);
  const [propertyActionInventoryId, setPropertyActionInventoryId] = useState("");
  const [proposalSelectedPropertyIds, setProposalSelectedPropertyIds] = useState<string[]>([]);
  const [proposalValidityDays, setProposalValidityDays] = useState("7");
  const [proposalSpecialNote, setProposalSpecialNote] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);
  const [paymentModeDraft, setPaymentModeDraft] = useState("");
  const [paymentTypeDraft, setPaymentTypeDraft] = useState("");
  const [paymentRemainingDraft, setPaymentRemainingDraft] = useState("");
  const [paymentReferenceDraft, setPaymentReferenceDraft] = useState("");
  const [paymentNoteDraft, setPaymentNoteDraft] = useState("");
  const [closureDocumentsDraft, setClosureDocumentsDraft] = useState<Array<{
    url: string;
    name?: string;
    mimeType?: string;
    size?: number;
    kind?: string;
  }>>([]);
  const [uploadingClosureDocs, setUploadingClosureDocs] = useState(false);
  const [statusRequestOpen, setStatusRequestOpen] = useState(false);
  const [statusRequestReason, setStatusRequestReason] = useState("");
  const [statusRequestAttachment, setStatusRequestAttachment] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    size: number;
    file?: any;
  } | null>(null);
  const [showClosedDatePicker, setShowClosedDatePicker] = useState(false);
  const [closedDatePickerSeed, setClosedDatePickerSeed] = useState<Date>(new Date());
  const [closedDatePickerField, setClosedDatePickerField] = useState<"remainingDueDate" | "paymentDate" | "chequeDate" | null>(null);
  const webClosedDatePickerRef = useRef<any>(null);
  const webClosedDateFieldRef = useRef<"remainingDueDate" | "paymentDate" | "chequeDate" | null>(null);
  const [pickingStatusAttachment, setPickingStatusAttachment] = useState(false);
  const [saleLeadDropdownOpen, setSaleLeadDropdownOpen] = useState(false);
  const [closedForm, setClosedForm] = useState(EMPTY_CLOSED_FORM);
  const [diaryNoteDraft, setDiaryNoteDraft] = useState("");
  const [isDiaryListening, setIsDiaryListening] = useState(false);
  const [isDiaryMicSupported, setIsDiaryMicSupported] = useState(false);
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(false);
  const [editingDiaryEntryId, setEditingDiaryEntryId] = useState("");
  const [diaryEditDraft, setDiaryEditDraft] = useState("");
  const [updatingDiaryEntry, setUpdatingDiaryEntry] = useState(false);
  const [showAllDiaryEntries, setShowAllDiaryEntries] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const diaryRecognitionRef = useRef<any>(null);
  const lastDiaryTranscriptRef = useRef("");
  const currentUserId = String((user as any)?._id || (user as any)?.id || "");

  // Requirements States
  const [requirementsDraft, setRequirementsDraft] = useState<any>(
    createDefaultLeadRequirementsDraft(),
  );

  const updateRequirementRootField = useCallback((field: string, value: any) => {
    setRequirementsDraft((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const updateRequirementInventoryType = useCallback((value: string) => {
    const nextType = String(value || "").trim().toUpperCase();
    setRequirementsDraft((prev: any) => {
      const nextFurnishingOptions = getRequirementFurnishingOptions(nextType);
      const nextFurnishingStatus = nextFurnishingOptions.some(
        (option) => option.value === prev?.furnishingStatus,
      )
        ? prev?.furnishingStatus
        : "";
      return {
        ...prev,
        inventoryType: value,
        propertySubtype: "",
        subtypeData: {},
        furnishingStatus: nextFurnishingStatus,
      };
    });
  }, []);

  /* Web's updateRequirementPropertySubtype: a new subtype starts its
     preferences empty and drops furnishing where the subtype has none. */
  const updateRequirementPropertySubtype = useCallback((value: string) => {
    setRequirementsDraft((prev: any) => {
      const nextConfig = getPropertySubtypeConfig(String(prev?.inventoryType || ""), value);
      return {
        ...prev,
        propertySubtype: value,
        subtypeData: {},
        furnishingStatus: (nextConfig as any)?.showFurnishing === false ? "" : prev?.furnishingStatus || "",
        areaMin: "",
        areaMax: "",
        areaUnit: "SQ_FT",
      };
    });
  }, []);

  const updateRequirementSubtypeField = useCallback((field: string, value: unknown) => {
    setRequirementsDraft((prev: any) => ({
      ...prev,
      subtypeData: withSubtypeField(prev?.subtypeData || {}, field, value),
    }));
  }, []);

  const updateRequirementCoworking = useCallback((next: CoworkingDraft) => {
    setRequirementsDraft((prev: any) => ({ ...prev, coworking: next }));
  }, []);

  const updateRequirementCommercialField = useCallback((field: string, value: any) => {
    setRequirementsDraft((prev: any) => ({
      ...prev,
      commercial: {
        seats: "",
        cabins: "",
        conferenceRooms: "",
        parkingAvailable: false,
        pantry: false,
        ...prev.commercial,
        [field]: value,
      },
    }));
  }, []);

  const updateRequirementResidentialField = useCallback((field: string, value: any) => {
    setRequirementsDraft((prev: any) => ({
      ...prev,
      residential: {
        bhkType: "",
        floor: "",
        amenities: {
          lift: false,
          security: false,
          gym: false,
          swimmingPool: false,
          clubhouse: false,
          powerBackup: false,
          parking: false,
        },
        ...prev.residential,
        [field]: value,
      },
    }));
  }, []);

  const updateRequirementResidentialAmenity = useCallback((field: string, value: any) => {
    setRequirementsDraft((prev: any) => ({
      ...prev,
      residential: {
        bhkType: "",
        floor: "",
        ...prev.residential,
        amenities: {
          lift: false,
          security: false,
          gym: false,
          swimmingPool: false,
          clubhouse: false,
          powerBackup: false,
          parking: false,
          ...prev.residential?.amenities,
          [field]: value,
        },
      },
    }));
  }, []);

  // Tasks States
  const [leadTasks, setLeadTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [taskAssigneeDropdownOpen, setTaskAssigneeDropdownOpen] = useState(false);
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [taskDatePickerSeed, setTaskDatePickerSeed] = useState<Date>(new Date());

  const visibleDiaryEntries = useMemo(
    () => (showAllDiaryEntries ? diaryEntries : diaryEntries.slice(0, 2)),
    [diaryEntries, showAllDiaryEntries],
  );
  const visibleActivities = useMemo(
    () => (showAllActivities ? activities : activities.slice(0, 2)),
    [activities, showAllActivities],
  );
  const selectedLeadRelatedInventories = useMemo(() => getLeadRelatedInventories(lead as any), [lead]);
  const selectedLeadActiveInventoryId = useMemo(
    () => toObjectIdString((lead as any)?.inventoryId),
    [lead],
  );
  const selectedLeadSiteLat = useMemo(
    () => toCoordinateNumber((lead as any)?.siteLocation?.lat),
    [lead],
  );
  const selectedLeadSiteLng = useMemo(
    () => toCoordinateNumber((lead as any)?.siteLocation?.lng),
    [lead],
  );
  const siteVisitRadiusMeters = useMemo(() => {
    const raw = Number((lead as any)?.siteLocation?.radiusMeters);
    if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
    return 200;
  }, [lead]);
  const availableRelatedInventoryOptions = useMemo(
    () => {
      const linkedIds = new Set(
        selectedLeadRelatedInventories.map((row: any) => toObjectIdString(row)).filter(Boolean),
      );
      return (Array.isArray(inventoryOptions) ? inventoryOptions : []).filter((item: any) => {
        const id = toObjectIdString(item);
        if (!id || linkedIds.has(id)) return false;
        const status = String(item?.status || "").trim().toLowerCase();
        if (status !== "available") return false;

        if (relatedInventoryTypeFilter === "ALL") return true;
        const itemType = String(item?.type || "").trim().toLowerCase();
        const normalizedType = itemType === "rent" || itemType === "rental" ? "RENT" : "SALE";
        return normalizedType === relatedInventoryTypeFilter;
      });
    },
    [inventoryOptions, selectedLeadRelatedInventories, relatedInventoryTypeFilter],
  );
  const selectedProposalPropertySet = useMemo(
    () => new Set(proposalSelectedPropertyIds),
    [proposalSelectedPropertyIds],
  );
  const selectedProposalProperties = useMemo(
    () => selectedLeadRelatedInventories.filter((row: any) => selectedProposalPropertySet.has(toObjectIdString(row))),
    [selectedLeadRelatedInventories, selectedProposalPropertySet],
  );

  useEffect(() => {
    setShowAllDiaryEntries(false);
    setShowAllActivities(false);
    setEditingDiaryEntryId("");
    setDiaryEditDraft("");
  }, [leadId]);

  useEffect(() => {
    if (!lead) return;
    setLeadNameDraft(String((lead as any)?.name || ""));
    setLeadPhoneDraft(String((lead as any)?.phone || ""));
    setLeadEmailDraft(String((lead as any)?.email || ""));
    setLeadCityDraft(String((lead as any)?.city || ""));
    setLeadProjectDraft(String((lead as any)?.projectInterested || ""));
  }, [lead?._id]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      /*
       * The lead itself comes from GET /leads/:id, not from filtering the full
       * list. That endpoint scopes through findAccessibleLeadById and 404s a
       * lead this user is not entitled to, so it is both the cheap answer and
       * the correct one - fetching every lead to render one was a real cost on
       * mobile data, and the "not found" path used to fall through to showing
       * somebody else's record.
       *
       * The list is still fetched, but only to populate the sale-lead picker,
       * and a failure there must not stop the lead from rendering.
       */
      const [leadResult, leadRowsResultSettled, usersResult, inventoryRowsResult] =
        await Promise.allSettled([
          getLeadById(leadId || fallbackRouteLeadId),
          getAllLeads(),
          canManage ? getUsers() : Promise.resolve({ users: [] }),
          getInventoryAssets({ page: 1, limit: 200 }),
        ]);

      const leadRowsResult =
        leadRowsResultSettled.status === "fulfilled" ? leadRowsResultSettled.value : [];
      let resolvedInventoryRows: any[] =
        inventoryRowsResult.status === "fulfilled" && Array.isArray(inventoryRowsResult.value)
          ? inventoryRowsResult.value
          : [];
      if (resolvedInventoryRows.length === 0) {
        const fallbackInventoryResult = await Promise.allSettled([
          getInventoryAssets(),
        ]);
        const fallbackRows = fallbackInventoryResult[0];
        if (fallbackRows.status === "fulfilled" && Array.isArray(fallbackRows.value)) {
          resolvedInventoryRows = fallbackRows.value;
        }
      }

      const leadRows = Array.isArray(leadRowsResult) ? leadRowsResult : [];

      let currentLead =
        leadResult.status === "fulfilled" && leadResult.value ? (leadResult.value as any) : null;

      /*
       * The route can carry the lead object itself (pushed from the pipeline
       * list), which is a legitimate fallback if the fetch failed. The list is
       * the last resort - and only ever matched by id.
       */
      if (!currentLead && initialRouteLead) currentLead = initialRouteLead;
      if (!currentLead) {
        const wanted = leadId || fallbackRouteLeadId;
        currentLead = leadRows.find((row) => String((row as any)?._id || "") === wanted) || null;
      }

      if (!currentLead) {
        setError("Lead not found");
        setLead(null);
        setActivities([]);
        setDiaryEntries([]);
        setStatusRequestHistory([]);
        return;
      }

      setLead(currentLead);
      setSaleLeadOptions(
        leadRows
          .map((row) => ({
            _id: String((row as any)?._id || ""),
            name: String((row as any)?.name || "").trim(),
            phone: String((row as any)?.phone || "").trim(),
          }))
          .filter((row) => row._id && row.name),
      );
      setExecutives(usersResult.status === "fulfilled" ? ((usersResult.value as any)?.users || []) : []);
      setInventoryOptions(resolvedInventoryRows);

      const resolvedLeadId = String((currentLead as any)?._id || "");
      setLoadingTasks(true);
      const [timelineResult, diaryResult, historyResult, tasksResult] = await Promise.allSettled([
        getLeadActivity(resolvedLeadId),
        getLeadDiary(resolvedLeadId),
        getLeadStatusRequests({ leadId: resolvedLeadId }),
        getTasks({ leadId: resolvedLeadId }),
      ]);
      setActivities(
        timelineResult.status === "fulfilled" && Array.isArray(timelineResult.value)
          ? timelineResult.value
          : [],
      );
      setDiaryEntries(
        diaryResult.status === "fulfilled" && Array.isArray(diaryResult.value)
          ? diaryResult.value
          : [],
      );
      setStatusRequestHistory(
        historyResult.status === "fulfilled" && Array.isArray(historyResult.value)
          ? historyResult.value
          : [],
      );
      setLeadTasks(
        tasksResult.status === "fulfilled" && Array.isArray(tasksResult.value)
          ? tasksResult.value
          : [],
      );
      setLoadingTasks(false);

      setStatusDraft(currentLead.status || "NEW");
      setFollowUpDraft(formatFollowUpInput(currentLead.nextFollowUp));
      setLeadNameDraft(String((currentLead as any)?.name || ""));
      setLeadPhoneDraft(String((currentLead as any)?.phone || ""));
      setLeadEmailDraft(String((currentLead as any)?.email || ""));
      setLeadCityDraft(String((currentLead as any)?.city || ""));
      setLeadProjectDraft(String((currentLead as any)?.projectInterested || ""));
      setAssignDraft(currentLead.assignedTo?._id || "");
      setSiteLatDraft(String((currentLead as any)?.siteLocation?.lat ?? ""));
      setSiteLngDraft(String((currentLead as any)?.siteLocation?.lng ?? ""));
      setPaymentModeDraft(String((currentLead as any)?.dealPayment?.mode || ""));
      setPaymentTypeDraft(String((currentLead as any)?.dealPayment?.paymentType || ""));
      setPaymentRemainingDraft(String((currentLead as any)?.dealPayment?.remainingAmount ?? ""));
      setPaymentReferenceDraft(String((currentLead as any)?.dealPayment?.paymentReference || ""));
      setPaymentNoteDraft(String((currentLead as any)?.dealPayment?.note || ""));
      setClosureDocumentsDraft(Array.isArray((currentLead as any)?.closureDocuments) ? (currentLead as any).closureDocuments : []);
      if ((currentLead as any).requirements) {
        setRequirementsDraft(mapLeadRequirementsToDraft((currentLead as any).requirements));
      } else {
        setRequirementsDraft(createDefaultLeadRequirementsDraft());
      }
      setClosedForm((prev) => ({ ...prev, saleLeadId: prev.saleLeadId || String(currentLead._id || "") }));
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load lead details"));
    } finally {
      setLoading(false);
    }
  }, [leadId, canManage, fallbackRouteLeadId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const firstInventoryId =
      toObjectIdString((lead as any)?.inventoryId)
      || toObjectIdString((selectedLeadRelatedInventories[0] as any)?._id);
    if (!firstInventoryId) {
      setProposalSelectedPropertyIds([]);
      return;
    }

    setProposalSelectedPropertyIds((previous) => {
      const validIds = previous.filter((id) =>
        selectedLeadRelatedInventories.some((row: any) => toObjectIdString(row) === id),
      );
      if (validIds.length > 0) return validIds;
      return [firstInventoryId];
    });
  }, [lead, selectedLeadRelatedInventories]);

  useEffect(() => {
    let active = true;

    const setupNativeSpeech = async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        if (!active) return;
        if (!available) {
          setIsDiaryMicSupported(false);
          setSpeechPermissionGranted(false);
          return;
        }
        const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (!active) return;
        setSpeechPermissionGranted(Boolean(permission?.granted));
        setIsDiaryMicSupported(true);
      } catch {
        if (!active) return;
        setIsDiaryMicSupported(false);
        setSpeechPermissionGranted(false);
      }
    };

    if (Platform.OS !== "web") {
      diaryRecognitionRef.current = null;
      void setupNativeSpeech();
      return () => {
        active = false;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {}
      };
    }

    const win = globalThis as any;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsDiaryMicSupported(false);
      setSpeechPermissionGranted(false);
      diaryRecognitionRef.current = null;
      return () => {
        active = false;
      };
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        lastDiaryTranscriptRef.current = "";
        setIsDiaryListening(true);
      };
      recognition.onend = () => {
        setIsDiaryListening(false);
      };
      recognition.onerror = () => {
        setIsDiaryListening(false);
      };
      recognition.onresult = (event: any) => {
        const chunks = [];
        for (let index = event?.resultIndex || 0; index < (event?.results?.length || 0); index += 1) {
          if (!event.results[index]?.isFinal) continue;
          const transcript = String(event.results[index]?.[0]?.transcript || "").trim();
          if (transcript) chunks.push(transcript);
        }

        const incomingText = chunks.join(" ").replace(/\s+/g, " ").trim();
        if (!incomingText) return;

        setDiaryNoteDraft((prev) => {
          const normalizedPrev = String(prev || "").trimEnd();
          if (!normalizedPrev) {
            lastDiaryTranscriptRef.current = incomingText;
            return incomingText;
          }

          const lastIncoming = lastDiaryTranscriptRef.current;
          if (incomingText === lastIncoming || normalizedPrev.endsWith(incomingText)) {
            return normalizedPrev;
          }

          lastDiaryTranscriptRef.current = incomingText;
          return `${normalizedPrev} ${incomingText}`;
        });
      };

      diaryRecognitionRef.current = recognition;
      setIsDiaryMicSupported(true);
      setSpeechPermissionGranted(true);
    } catch {
      setIsDiaryMicSupported(false);
      setSpeechPermissionGranted(false);
      diaryRecognitionRef.current = null;
    }

    return () => {
      active = false;
      if (!diaryRecognitionRef.current) return;
      try {
        diaryRecognitionRef.current.stop();
      } catch {}
    };
  }, []);

  useSpeechRecognitionEvent("start", () => {
    if (Platform.OS === "web") return;
    lastDiaryTranscriptRef.current = "";
    setIsDiaryListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    if (Platform.OS === "web") return;
    setIsDiaryListening(false);
    lastDiaryTranscriptRef.current = "";
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (Platform.OS === "web") return;
    setIsDiaryListening(false);
    const message = String((event as any)?.message || "").trim() || "Unable to start voice input. Try again.";
    setError(message);
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (Platform.OS === "web") return;
    const results = Array.isArray((event as any)?.results) ? (event as any).results : [];
    const first = results[0] || null;
    const transcript = String(first?.transcript || "").replace(/\s+/g, " ").trim();
    if (!transcript) return;
    if (!(event as any)?.isFinal && transcript === lastDiaryTranscriptRef.current) return;
    lastDiaryTranscriptRef.current = transcript;
    if (!(event as any)?.isFinal) return;
    setDiaryNoteDraft((prev) => `${String(prev || "").trim()} ${transcript}`.trim());
  });

  const assigneeName = useMemo(() => {
    if (!lead?.assignedTo?._id) return "Unassigned";
    return lead.assignedTo.name || "Assigned";
  }, [lead]);
  const reportingManagerName = useMemo(() => {
    const directParent = (lead as any)?.assignedTo?.parentId;
    const mappedManager = (lead as any)?.assignedManager;
    const parentRole = String(directParent?.role || "").toUpperCase();
    const mappedRole = String(mappedManager?.role || "").toUpperCase();

    if (parentRole === "MANAGER") {
      return String(directParent?.name || "").trim() || "Not mapped";
    }
    if (mappedRole === "MANAGER") {
      return String(mappedManager?.name || "").trim() || "Not mapped";
    }
    return "Not mapped";
  }, [lead]);
  const managerName = useMemo(() => {
    const mappedManager = (lead as any)?.assignedManager;
    const mappedRole = String(mappedManager?.role || "").toUpperCase();
    if (mappedRole === "MANAGER") {
      return String(mappedManager?.name || "").trim() || "Not mapped";
    }

    const mappedManagerParent = (lead as any)?.assignedManager?.parentId;
    const mappedParentRole = String(mappedManagerParent?.role || "").toUpperCase();
    if (mappedParentRole === "MANAGER") {
      return String(mappedManagerParent?.name || "").trim() || "Not mapped";
    }

    const directParent = (lead as any)?.assignedTo?.parentId;
    const parentRole = String(directParent?.role || "").toUpperCase();
    if (parentRole === "MANAGER") {
      return String(directParent?.name || "").trim() || "Not mapped";
    }

    const grandParent = (lead as any)?.assignedTo?.parentId?.parentId;
    const grandParentRole = String(grandParent?.role || "").toUpperCase();
    if (grandParentRole === "MANAGER") {
      return String(grandParent?.name || "").trim() || "Not mapped";
    }

    return "Not mapped";
  }, [lead]);
  const requiresClosedApproval = useMemo(
    () => !canManage && statusDraft === CLOSED_STATUS && statusDraft !== String(lead?.status || ""),
    [canManage, lead?.status, statusDraft],
  );
  const saveButtonTitle = useMemo(() => {
    if (saving) return "Saving...";
    return requiresClosedApproval ? "Send for Approval" : "Save Details";
  }, [requiresClosedApproval, saving]);
  const suggestedRemainingAmountValue = useMemo(() => {
    const totalAmount = Number(closedForm.totalAmount);
    const partialAmount = Number(closedForm.partialAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return "";
    if (!Number.isFinite(partialAmount) || partialAmount < 0) return "";
    return String(Math.max(0, Number((totalAmount - partialAmount).toFixed(2))));
  }, [closedForm.partialAmount, closedForm.totalAmount]);
  const selectedSaleLeadLabel = useMemo(() => {
    const selected = saleLeadOptions.find((row) => row._id === closedForm.saleLeadId);
    if (!selected) return "Select lead";
    return selected.phone ? `${selected.name} (${selected.phone})` : selected.name;
  }, [closedForm.saleLeadId, saleLeadOptions]);
  const assignableExecutives = useMemo(
    () =>
      executives.filter(
        (u) => u.isActive !== false && ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(String(u.role)),
      ),
    [executives],
  );
  const selectedAssigneeLabel = useMemo(() => {
    const selected = assignableExecutives.find((u) => String(u._id || "") === String(assignDraft || ""));
    return selected?.name || "Select executive";
  }, [assignDraft, assignableExecutives]);

  const saveUpdate = async () => {
    if (!lead) return;
    const requirementError = validateLeadRequirementDraft(requirementsDraft);
    if (requirementError) {
      setError(requirementError);
      return;
    }

    const payload: any = {
      status: statusDraft,
      requirements: buildLeadRequirementsPayloadFromDraft(requirementsDraft),
    };

    if (followUpDraft.trim()) {
      const parsed = parseFollowUpInput(followUpDraft);
      if (!parsed) {
        setError("Invalid follow-up format. Use dd-mm-yyyy hh:mm");
        return;
      }
      payload.nextFollowUp = parsed.toISOString();
    }

    if (statusDraft === CLOSED_STATUS) {
      openClosedStatusForm();
      return;
    }

    const statusForPayment = String(statusDraft || "").toUpperCase();
    const canUpdatePayment = statusForPayment === "REQUESTED" || statusForPayment === "CLOSED";
    if (canUpdatePayment && paymentModeDraft && paymentTypeDraft) {
      payload.dealPayment = {
        mode: paymentModeDraft,
        paymentType: paymentTypeDraft,
        remainingAmount: paymentTypeDraft === "PARTIAL"
          ? Number(paymentRemainingDraft || 0)
          : 0,
        paymentReference: paymentReferenceDraft.trim(),
        note: paymentNoteDraft.trim(),
      };
    }

    if (closureDocumentsDraft.length > 0) {
      payload.closureDocuments = closureDocumentsDraft;
    }

    if (canManage) {
      const lat = Number(siteLatDraft);
      const lng = Number(siteLngDraft);
      if (siteLatDraft.trim() && siteLngDraft.trim() && Number.isFinite(lat) && Number.isFinite(lng)) {
        payload.siteLocation = {
          lat,
          lng,
          radiusMeters: siteVisitRadiusMeters,
        };
      }
    }

    try {
      setSaving(true);
      const sanitizedPhone = toDigits(leadPhoneDraft).slice(0, 15);
      await updateLeadBasics(lead._id, {
        name: leadNameDraft.trim(),
        phone: sanitizedPhone,
        email: leadEmailDraft.trim(),
        city: leadCityDraft.trim(),
        projectInterested: leadProjectDraft.trim(),
      });
      await updateLeadStatus(lead._id, payload);
      setSuccess("Lead updated");
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update lead"));
    } finally {
      setSaving(false);
    }
  };

  const fetchLeadTasks = useCallback(async () => {
    if (!leadId) return;
    setLoadingTasks(true);
    try {
      const data = await getTasks({ leadId });
      setLeadTasks(data || []);
    } catch (err) {
      console.error("Failed to load lead tasks", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [leadId]);

  const handleAddLeadTask = async () => {
    if (!newTaskTitle.trim() || !lead?._id) return;
    setAddingTask(true);
    try {
      const payload = {
        title: newTaskTitle.trim(),
        status: "TODO",
        priority: newTaskPriority,
        dueDate: newTaskDueDate || null,
        assignedTo: (newTaskAssignedTo || null) as any,
        leadId: lead._id,
      };
      const created = await createTask(payload);
      if (created) {
        setNewTaskTitle("");
        setNewTaskDueDate("");
        setNewTaskPriority("MEDIUM");
        setNewTaskAssignedTo("");
        setSuccess("Task created");
        await fetchLeadTasks();
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create lead task"));
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleLeadTaskStatus = async (task: Task) => {
    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      setLeadTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t)));
      await updateTask(task._id, { status: newStatus });
      setSuccess("Task updated");
      await fetchLeadTasks();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to update task status"));
      await fetchLeadTasks();
    }
  };

  const handleDeleteLeadTask = async (taskId: string) => {
    const performDelete = async () => {
      try {
        setLeadTasks((prev) => prev.filter((t) => t._id !== taskId));
        await deleteTask(taskId);
        setSuccess("Task deleted");
        await fetchLeadTasks();
      } catch (err) {
        setError(toErrorMessage(err, "Failed to delete task"));
        await fetchLeadTasks();
      }
    };

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" ? window.confirm("Delete this task?") : false;
      if (confirmed) await performDelete();
      return;
    }

    Alert.alert(
      "Delete task",
      "Are you sure you want to delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ],
    );
  };

  const openTaskDatePicker = () => {
    const seed = newTaskDueDate ? new Date(newTaskDueDate) : new Date();

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: seed,
        mode: "date",
        onChange: (event: any, pickedDate?: Date) => {
          if (event.type !== "set" || !pickedDate) return;
          setNewTaskDueDate(pickedDate.toISOString().split("T")[0]);
        },
      });
      return;
    }

    if (Platform.OS === "web") {
      return;
    }

    setTaskDatePickerSeed(seed);
    setShowTaskDatePicker(true);
  };

  const onTaskDatePickerChange = (event: any, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      setShowTaskDatePicker(false);
      return;
    }
    if (selectedDate) {
      setNewTaskDueDate(selectedDate.toISOString().split("T")[0]);
    }
    setShowTaskDatePicker(false);
  };

  /*
   * "Mark done" on the comp's follow-up card. It clears `nextFollowUp` rather
   * than moving the status - the stage is the stepper's job, and clearing is
   * exactly what the endpoint the web app uses for this does.
   */
  const markFollowUpDone = async () => {
    if (!lead?._id) return;
    try {
      setSaving(true);
      const updated = await clearLeadFollowUp(lead._id, lead.status || "NEW");
      if (updated) setLead(updated);
      setSuccess("Follow-up marked done");
    } catch (e) {
      setError(toErrorMessage(e, "Could not clear the follow-up"));
    } finally {
      setSaving(false);
    }
  };

  const openDialer = async (phone?: string) => {
    const dialNumber = toLocalTenDigitPhone(phone);
    if (!dialNumber) {
      Alert.alert("Invalid number", "Phone number must have at least 10 digits.");
      return;
    }

    const url = `tel:${dialNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Dialer unavailable", "Could not open the phone dialer on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Dial failed", "Unable to open dialer right now.");
    }
  };

  const openWhatsApp = async (phone?: string) => {
    const whatsappPhone = toWhatsAppPhone(phone);
    if (!whatsappPhone) {
      Alert.alert("Invalid number", "WhatsApp needs at least 10 digits.");
      return;
    }

    const appUrl = `whatsapp://send?phone=${whatsappPhone}`;
    const webUrl = `https://wa.me/${whatsappPhone}`;
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(webUrl);
        return;
      }
      const appSupported = await Linking.canOpenURL(appUrl);
      if (appSupported) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert("WhatsApp unavailable", "Could not open WhatsApp chat for this lead.");
    }
  };

  const openMail = async (email?: string) => {
    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      Alert.alert("No email", "Email is not available for this lead.");
      return;
    }

    const url = `mailto:${safeEmail}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Mail unavailable", "Could not open mail app on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Mail failed", "Unable to open mail app right now.");
    }
  };

  const saveAssignment = async () => {
    if (!lead || !assignDraft) return;

    try {
      setSaving(true);
      await assignLead(lead._id, assignDraft);
      setSuccess("Lead assigned");
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to assign lead"));
    } finally {
      setSaving(false);
    }
  };

  const openMaps = async () => {
    const locationLabel = String((lead as any)?.city || "").trim();
    const fallbackQuery = [locationLabel, String((lead as any)?.projectInterested || "").trim()]
      .filter(Boolean)
      .join(", ");
    const lat = toCoordinateNumber(siteLatDraft);
    const lng = toCoordinateNumber(siteLngDraft);
    const query = lat !== null && lng !== null ? `${lat},${lng}` : fallbackQuery;
    if (!query) {
      Alert.alert("Location missing", "Lead location is not available.");
      return;
    }
    const url = `https://maps.google.com/?q=${encodeURIComponent(query)}`;
    await Linking.openURL(url).catch(() => {
      Alert.alert("Maps unavailable", "Unable to open maps right now.");
    });
  };

  const fillWithLiveLocation = async () => {
    const nav: any = globalThis?.navigator;
    if (!nav?.geolocation?.getCurrentPosition) {
      Alert.alert("Location unavailable", "Geolocation is not supported on this device/browser.");
      return;
    }

    nav.geolocation.getCurrentPosition(
      (position: any) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setError("Unable to read live location coordinates");
          return;
        }
        setSiteLatDraft(String(latitude));
        setSiteLngDraft(String(longitude));
      },
      () => {
        setError("Unable to fetch live location");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const pickClosureDocuments = async () => {
    if (uploadingClosureDocs) return;
    try {
      setUploadingClosureDocs(true);
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: ["image/*", "application/pdf"],
      });
      if (picked.canceled || !picked.assets?.length) return;

      const uploadedRows: Array<{
        url: string;
        name?: string;
        mimeType?: string;
        size?: number;
        kind?: string;
      }> = [];

      for (const asset of picked.assets as any[]) {
        const uploaded = await uploadChatFile({
          uri: pickUriString(asset?.uri),
          name: String(asset?.name || "document"),
          mimeType: String(asset?.mimeType || "application/octet-stream"),
          file: asset?.file,
        });
        if (!uploaded?.fileUrl) continue;
        uploadedRows.push({
          url: uploaded.fileUrl,
          name: uploaded.fileName || asset?.name || "document",
          mimeType: uploaded.mimeType || asset?.mimeType || "application/octet-stream",
          size: Number(uploaded.size || asset?.size || 0),
          kind: String(uploaded.mimeType || asset?.mimeType || "").includes("pdf") ? "pdf" : "image",
        });
      }

      if (uploadedRows.length === 0) {
        setError("No document uploaded");
        return;
      }
      setClosureDocumentsDraft((previous) => [...previous, ...uploadedRows].slice(0, 20));
      setSuccess(`${uploadedRows.length} document uploaded`);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to upload documents"));
    } finally {
      setUploadingClosureDocs(false);
    }
  };

  const removeClosureDocument = (url: string) => {
    setClosureDocumentsDraft((previous) => previous.filter((row) => String(row?.url || "") !== String(url || "")));
  };

  const toggleProposalProperty = (propertyId: string) => {
    if (!propertyId) return;
    setProposalSelectedPropertyIds((previous) => {
      if (previous.includes(propertyId)) {
        return previous.filter((row) => row !== propertyId);
      }
      return [...previous, propertyId];
    });
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "On request";
    return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
  };

  const selectedProposalRows = useMemo(
    () => (selectedProposalProperties.length > 0 ? selectedProposalProperties : selectedLeadRelatedInventories),
    [selectedLeadRelatedInventories, selectedProposalProperties],
  );

  const proposalImageUrls = useMemo(
    () =>
      selectedProposalRows
        .flatMap((row: any) => (Array.isArray(row?.images) ? row.images : []))
        .map((url: string) => resolveMediaUrl(String(url || "").trim()))
        .filter(Boolean)
        .slice(0, 12),
    [selectedProposalRows],
  );

  const buildProposalText = useCallback(() => {
    if (!lead) return "";
    const selectedRows = selectedProposalRows;
    const today = formatProposalDate(new Date());
    const validity = Number.parseInt(proposalValidityDays, 10);
    const lines = [
      "SAMVID OS - PROPERTY PROPOSAL",
      `Date: ${today}`,
      "",
      `Dear ${String(lead.name || "Client")},`,
      "Thank you for your interest. Please find your selected property proposal below:",
      `Selected Properties: ${selectedRows.length}`,
      "",
    ];

    selectedRows.forEach((inventory: any, index) => {
      const label = getInventoryClientLabel(inventory) || `Property ${index + 1}`;
      lines.push(`Property ${index + 1}: ${label}`);
      lines.push(`Project: ${String(inventory?.projectName || (lead as any)?.projectInterested || "-")}`);
      lines.push(`Location: ${String(inventory?.location || (lead as any)?.city || "-")}`);
      lines.push(`Property Type: ${String(inventory?.type || "-")}`);
      lines.push(`Category: ${String(inventory?.category || "-")}`);
      lines.push(`Price: ${formatCurrency(Number(inventory?.price || 0))}`);
      lines.push("");
    });

    lines.push(`Validity: ${Number.isFinite(validity) && validity > 0 ? validity : 7} day(s)`);
    if (proposalSpecialNote.trim()) {
      lines.push(`Special Note: ${proposalSpecialNote.trim()}`);
    }
    lines.push("", "Regards,", "Samvid OS");

    return lines.join("\n");
  }, [lead, proposalSpecialNote, proposalValidityDays, selectedProposalRows]);

  const buildProposalHtml = useCallback(() => {
    const proposalText = buildProposalText();
    const imageGrid = proposalImageUrls
      .map((url) => `<img src="${escapeHtml(url)}" alt="Property image" />`)
      .join("");
    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #161c24; padding: 24px; line-height: 1.5; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px; }
            h1 { margin: 0 0 12px; font-size: 20px; }
            .imageGrid { margin-top: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .imageGrid img { width: 100%; max-height: 220px; object-fit: cover; border: 1px solid #e0e5ed; border-radius: 6px; }
          </style>
        </head>
        <body>
          <pre>${escapeHtml(proposalText)}</pre>
          ${imageGrid ? `<div class="imageGrid">${imageGrid}</div>` : ""}
        </body>
      </html>
    `;
  }, [buildProposalText, proposalImageUrls]);

  const copyProposalText = async () => {
    const message = buildProposalText();
    if (!selectedProposalRows.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return;
    }
    if (!message.trim()) return;
    try {
      await Clipboard.setStringAsync(message);
      setSuccess("Proposal copied");
    } catch {
      setError("Unable to copy proposal text");
    }
  };

  /*
   * Web's "Img Links" and "Share Images". Web lists every image of each
   * selected property and attaches the first four of each, eight at most.
   */
  const proposalImageEntries = useMemo(
    () =>
      selectedProposalRows
        .flatMap((row: any, rowIndex: number) => {
          const label = getInventoryClientLabel(row) || `Property ${rowIndex + 1}`;
          const urls: string[] = (Array.isArray(row?.images) ? row.images : [])
            .map((url: string) => toAbsoluteUrl(String(url || "").trim()))
            .filter(Boolean);
          return urls.slice(0, 4).map((url, imageIndex) => ({ url, label, imageIndex: imageIndex + 1 }));
        })
        .slice(0, 8),
    [selectedProposalRows],
  );

  const proposalImageLinksText = useMemo(() => {
    const lines: string[] = [];
    selectedProposalRows.forEach((row: any, rowIndex: number) => {
      lines.push(`${rowIndex + 1}. ${getInventoryClientLabel(row) || `Property ${rowIndex + 1}`}`);
      const urls: string[] = (Array.isArray(row?.images) ? row.images : [])
        .map((url: string) => toAbsoluteUrl(String(url || "").trim()))
        .filter(Boolean);
      if (!urls.length) lines.push("   - No images");
      urls.forEach((url, imageIndex) => lines.push(`   - ${imageIndex + 1}. ${url}`));
      lines.push("");
    });
    return lines.join("\n").trim();
  }, [selectedProposalRows]);

  const copyProposalImageLinks = async () => {
    if (!proposalImageEntries.length) {
      setError("No property images found");
      return;
    }
    try {
      await Clipboard.setStringAsync(proposalImageLinksText);
      setSuccess("Image links copied");
    } catch {
      setError("Unable to copy image links");
    }
  };

  const askToContinue = (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: "Stop", style: "cancel", onPress: () => resolve(false) },
        { text: "Next image", onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });

  const shareProposalImages = async () => {
    if (!proposalImageEntries.length) {
      setError("No property images found");
      return;
    }
    setProposalBusy(true);
    const files: Array<{ uri: string; mimeType: string }> = [];
    try {
      /*
       * Uploaded files are released only to a signed-in caller, so each image
       * is fetched with this session's token - but only from this app's own
       * server; an image hosted elsewhere is fetched without it.
       */
      const token = await sessionStorage.getToken();
      const ownOrigin = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
      for (const entry of proposalImageEntries) {
        const extension = (/\.(jpe?g|png|webp|gif|heic)(?:\?|$)/i.exec(entry.url)?.[1] || "jpg").toLowerCase();
        const slug = entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "property";
        const target = `${FileSystem.cacheDirectory}${slug}-image-${entry.imageIndex}.${extension}`;
        const ownFile = Boolean(ownOrigin) && entry.url.startsWith(ownOrigin);
        try {
          const result = await FileSystem.downloadAsync(entry.url, target, {
            headers: ownFile && token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (result.status >= 200 && result.status < 300) {
            files.push({ uri: result.uri, mimeType: extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}` });
          }
        } catch {
          /* One image failing should not stop the rest. */
        }
      }
    } finally {
      setProposalBusy(false);
    }

    if (!files.length) {
      setError("Images could not be prepared for sharing");
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      setError("Sharing is not available on this device");
      return;
    }

    /*
     * The phone's share sheet takes one file at a time, where a browser's
     * takes a list. Each image gets its own sheet, with a chance to stop
     * between them.
     */
    for (let index = 0; index < files.length; index += 1) {
      try {
        await Sharing.shareAsync(files[index].uri, {
          mimeType: files[index].mimeType,
          dialogTitle: `Property image ${index + 1} of ${files.length}`,
        });
      } catch {
        setError("Image share failed");
        return;
      }
      if (index < files.length - 1) {
        const next = await askToContinue(`Shared ${index + 1} of ${files.length}`, "Share the next image?");
        if (!next) return;
      }
    }
    setSuccess(`Shared ${files.length} image(s)`);
  };

  const generateProposalPdf = async () => {
    if (!selectedProposalRows.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return "";
    }
    if (Platform.OS === "web") {
      // Web uses jsPDF blob generation to avoid browser print preview/page capture.
      return "";
    }
    const html = buildProposalHtml();
    setProposalBusy(true);
    try {
      const printed = await Print.printToFileAsync({ html, base64: false });
      return printed.uri;
    } finally {
      setProposalBusy(false);
    }
  };

  const buildProposalPdfName = () =>
    `proposal-${String((lead as any)?.name || "lead")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lead"}-${Date.now()}.pdf`;

  const buildWebProposalPdfBlob = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageWidth - (margin * 2);
    let cursorY = margin;

    const ensureSpace = (requiredHeight = 20) => {
      if (cursorY + requiredHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    const addLine = (line: string) => {
      const text = String(line || "");
      const lines = doc.splitTextToSize(text, contentWidth);
      const lineHeight = 15;
      ensureSpace((lines.length * lineHeight) + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(lines, margin, cursorY);
      cursorY += (lines.length * lineHeight) + 5;
    };

    String(buildProposalText() || "")
      .split("\n")
      .forEach((line) => addLine(line));

    const loadImageForPdf = async (url: string): Promise<{ dataUrl: string; width: number; height: number } | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(img, 0, 0);
            resolve({
              dataUrl: canvas.toDataURL("image/jpeg", 0.9),
              width: img.naturalWidth || img.width || 1,
              height: img.naturalHeight || img.height || 1,
            });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

    if (proposalImageUrls.length > 0) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Property Images", margin, cursorY);
      cursorY += 14;

      for (let index = 0; index < proposalImageUrls.length; index += 1) {
        const loaded = await loadImageForPdf(proposalImageUrls[index]);
        if (!loaded) continue;
        const maxWidth = contentWidth;
        const maxHeight = 240;
        const ratio = Math.min(maxWidth / loaded.width, maxHeight / loaded.height);
        const drawWidth = Math.max(1, Math.round(loaded.width * ratio));
        const drawHeight = Math.max(1, Math.round(loaded.height * ratio));
        ensureSpace(drawHeight + 12);
        doc.addImage(loaded.dataUrl, "JPEG", margin, cursorY, drawWidth, drawHeight);
        cursorY += drawHeight + 10;
      }
    }

    return doc.output("blob");
  };

  const buildWebShareFile = async (fileName: string) => {
    const blob = await buildWebProposalPdfBlob();
    const hasFileCtor = typeof File !== "undefined";
    const file = hasFileCtor ? new File([blob], fileName, { type: "application/pdf" }) : null;
    return { file, blob };
  };

  const downloadWebProposalBlob = (blob: Blob, fileName: string) => {
    const doc = (globalThis as any)?.document;
    if (!doc?.createElement || !doc?.body) {
      throw new Error("Document unavailable");
    }
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = fileName;
    doc.body.appendChild(anchor);
    anchor.click();
    doc.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  };

  const openSystemPdfShare = async (options: {
    title: string;
    message: string;
    fileName?: string;
    preferNativeShareOnWeb?: boolean;
  }) => {
    const fileName = options.fileName || buildProposalPdfName();
    const nav = globalThis as any;

    if (Platform.OS === "web") {
      try {
        const { file, blob } = await buildWebShareFile(fileName);
        if (options.preferNativeShareOnWeb && file && nav?.navigator?.share) {
          await nav.navigator.share({
            title: options.title,
            text: options.message,
            files: [file],
          });
          return true;
        }
        downloadWebProposalBlob(blob, fileName);
        return true;
      } catch {
        // fall through
      }
      return false;
    }

    const tempPdfUri = await generateProposalPdf();
    if (!tempPdfUri) return false;
    const localPdfUri = await (async () => {
      try {
        const localUri = `${FileSystem.documentDirectory || ""}${fileName}`;
        if (!localUri) return tempPdfUri;
        await FileSystem.copyAsync({ from: tempPdfUri, to: localUri });
        return localUri;
      } catch {
        return tempPdfUri;
      }
    })();

    if (!IS_WEB && options.preferNativeShareOnWeb && nav?.navigator?.share) {
      try {
        const { file } = await buildWebShareFile(fileName);
        await nav.navigator.share({
          title: options.title,
          text: options.message,
          files: [file],
        });
        return true;
      } catch {
        // fall through to generic share
      }
    }

    if (!IS_WEB && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localPdfUri, {
        mimeType: "application/pdf",
        dialogTitle: options.title,
        UTI: "com.adobe.pdf",
      });
      return true;
    }

    await Share.share({
      title: options.title,
      message: options.message,
      url: localPdfUri,
    });
    return true;
  };

  const downloadProposalPdf = async () => {
    try {
      const fileName = buildProposalPdfName();

      if (Platform.OS === "web") {
        setProposalBusy(true);
        const { blob } = await buildWebShareFile(fileName);
        downloadWebProposalBlob(blob, fileName);
        setSuccess("PDF downloaded");
        setProposalBusy(false);
        return;
      }

      const pdfUri = await generateProposalPdf();
      if (!pdfUri) return;
      const localUri = `${FileSystem.documentDirectory || ""}${fileName}`;
      if (!localUri) throw new Error("Local storage unavailable");
      await FileSystem.copyAsync({ from: pdfUri, to: localUri });
      setSuccess("PDF downloaded in local storage");
    } catch {
      Alert.alert("PDF failed", "Unable to generate or download proposal PDF.");
    } finally {
      if (Platform.OS === "web") {
        setProposalBusy(false);
      }
    }
  };

  const shareProposalPdf = async () => {
    try {
      await openSystemPdfShare({
        title: "Share Proposal PDF",
        message: "Property proposal PDF",
        preferNativeShareOnWeb: true,
      });
    } catch {
      Alert.alert("Share failed", "Unable to open sharing options.");
    }
  };

  const shareProposalWhatsApp = async () => {
    if (!selectedProposalRows.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return;
    }
    try {
      if (Platform.OS === "web") {
        await openSystemPdfShare({
          title: "Share Proposal PDF",
          message: "Share on WhatsApp",
          preferNativeShareOnWeb: true,
        });
        return;
      }

      const canOpenWhatsApp = await Linking.canOpenURL("whatsapp://send").catch(() => false);
      if (!canOpenWhatsApp) {
        Alert.alert("WhatsApp unavailable", "WhatsApp is not installed on this device.");
        return;
      }
      const ok = await openSystemPdfShare({
        title: "Share Proposal PDF",
        message: "Share on WhatsApp",
      });
      if (!ok) throw new Error("Share not available");
    } catch {
      Alert.alert("WhatsApp unavailable", "Unable to open WhatsApp share for PDF.");
    }
  };

  const shareProposalEmail = async () => {
    if (!selectedProposalRows.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return;
    }
    const email = String((lead as any)?.email || "").trim();

    const subject = `Property Proposal - ${String((lead as any)?.name || "Client")}`;
    const body = buildProposalText();

    if (Platform.OS !== "web" && (await MailComposer.isAvailableAsync())) {
      const pdfUri = await generateProposalPdf();
      const fileName = buildProposalPdfName();
      let localUri = pdfUri;
      if (pdfUri) {
        try {
          const preferredUri = `${FileSystem.documentDirectory || ""}${fileName}`;
          if (preferredUri) {
            await FileSystem.copyAsync({ from: pdfUri, to: preferredUri });
            localUri = preferredUri;
          }
        } catch {}
      }
      await MailComposer.composeAsync({
        recipients: email ? [email] : [],
        subject,
        body,
        attachments: localUri ? [localUri] : [],
      });
      return;
    }

    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(mailto).catch(() => {
      Alert.alert("Mail unavailable", "Unable to open mail client.");
    });
  };

  const onLinkPropertyToLead = async () => {
    if (!lead || !relatedInventoryDraft) return;
    try {
      setLinkingProperty(true);
      setPropertyActionInventoryId(relatedInventoryDraft);
      const updatedLead = await addLeadRelatedProperty(lead._id, relatedInventoryDraft);
      if (updatedLead?._id) {
        setLead(updatedLead);
        setRelatedInventoryDraft("");
        setSuccess("Property linked");
      }
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to link property"));
    } finally {
      setPropertyActionInventoryId("");
      setLinkingProperty(false);
    }
  };

  /*
   * Makes one of the linked properties the lead's active one - web's
   * handleSelectRelatedProperty, which it runs when a property card is
   * clicked. The active property is what the proposal and the deal close use.
   */
  const onSelectRelatedProperty = async (inventoryId: string) => {
    if (!lead || !inventoryId || inventoryId === selectedLeadActiveInventoryId) return;
    try {
      setPropertyActionInventoryId(inventoryId);
      setError("");
      const updatedLead = await selectLeadRelatedProperty(lead._id, inventoryId);
      if (updatedLead?._id) setLead(updatedLead);
      else await loadData();
      setSuccess("Property selected");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to select property"));
    } finally {
      setPropertyActionInventoryId("");
    }
  };

  const onViewRelatedProperty = (inventoryId: string) => {
    if (!inventoryId) return;
    navigation.navigate("InventoryDetails", { assetId: inventoryId });
  };

  const onRemoveRelatedProperty = async (inventoryId: string) => {
    if (!lead || !inventoryId) return;
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined"
        ? window.confirm("Are you sure you want to delete this property?")
        : false;
      if (!confirmed) return;

      try {
        setPropertyActionInventoryId(inventoryId);
        const updatedLead = await removeLeadRelatedProperty(lead._id, inventoryId);
        if (updatedLead?._id) {
          setLead(updatedLead);
          setSuccess("Property removed");
        }
        await loadData();
      } catch (e) {
        setError(toErrorMessage(e, "Failed to remove property"));
      } finally {
        setPropertyActionInventoryId("");
      }
      return;
    }

    Alert.alert(
      "Delete property",
      "Are you sure you want to delete this property?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              setPropertyActionInventoryId(inventoryId);
              const updatedLead = await removeLeadRelatedProperty(lead._id, inventoryId);
              if (updatedLead?._id) {
                setLead(updatedLead);
                setSuccess("Property removed");
              }
              await loadData();
            } catch (e) {
              setError(toErrorMessage(e, "Failed to remove property"));
            } finally {
              setPropertyActionInventoryId("");
            }
          },
        },
      ],
    );
  };

  const submitStatusRequest = async () => {
    if (!lead) return;
    if (statusDraft !== CLOSED_STATUS) {
      setError("Closed details form is only for CLOSED status");
      setStatusRequestOpen(false);
      return;
    }
    const totalAmount = Number(closedForm.totalAmount);
    const partialAmount = Number(closedForm.partialAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setError("Total amount should be greater than 0");
      return;
    }
    if (!Number.isFinite(partialAmount) || partialAmount < 0 || partialAmount > totalAmount) {
      setError("Partial amount should be between 0 and total amount");
      return;
    }
    if (!closedForm.saleLeadId.trim()) {
      setError("Please select lead");
      return;
    }
    const remainingAmountInput = closedForm.remainingAmount.trim();
    const fallbackRemaining = Number((totalAmount - partialAmount).toFixed(2));
    const remainingAmount = remainingAmountInput ? Number(remainingAmountInput) : fallbackRemaining;
    if (!Number.isFinite(remainingAmount) || remainingAmount < 0) {
      setError("Remaining amount should be a valid non-negative number");
      return;
    }
    const remainingDueDate = closedForm.remainingDueDate.trim();
    if (remainingAmount > 0 && !remainingDueDate) {
      setError("Remaining amount due date is required");
      return;
    }
    const paymentMode = closedForm.paymentMode;
    const paymentDate = closedForm.paymentDate.trim();
    const selectedSaleLead = saleLeadOptions.find((row) => row._id === closedForm.saleLeadId);

    const saleMeta: {
      leadId?: string;
      leadName?: string;
      paymentMode: string;
      totalAmount: number;
      partialAmount: number;
      remainingAmount: number;
      remainingDueDate?: string;
      paymentDate?: string;
      cheque?: { bankName: string; chequeNumber: string; chequeDate: string };
      bankTransfer?: { transferType: string; utrNumber: string };
      upi?: { transactionId: string };
    } = {
      leadId: closedForm.saleLeadId,
      leadName: selectedSaleLead?.name || "",
      paymentMode,
      totalAmount,
      partialAmount,
      remainingAmount,
      remainingDueDate,
      paymentDate: paymentMode === "Cash" || paymentMode === "UPI" || paymentMode === "Bank Transfer" ? paymentDate : undefined,
    };

    if (paymentMode === "Cash" && !paymentDate) {
      setError("Payment date is required for cash");
      return;
    }
    if (paymentMode === "Cheque") {
      if (!closedForm.chequeBankName.trim() || !closedForm.chequeNumber.trim() || !closedForm.chequeDate.trim()) {
        setError("Please fill all required cheque details");
        return;
      }
      saleMeta.cheque = {
        bankName: closedForm.chequeBankName.trim(),
        chequeNumber: closedForm.chequeNumber.trim(),
        chequeDate: closedForm.chequeDate.trim(),
      };
    }
    if (paymentMode === "UPI") {
      if (!closedForm.upiTransactionId.trim() || !paymentDate) {
        setError("Please fill transaction id and payment date for UPI");
        return;
      }
      saleMeta.upi = {
        transactionId: closedForm.upiTransactionId.trim(),
      };
    }
    if (paymentMode === "Bank Transfer") {
      if (!closedForm.bankTransferType.trim() || !closedForm.bankTransferUtrNumber.trim() || !paymentDate) {
        setError("Please fill transfer type, UTR number and payment date");
        return;
      }
      saleMeta.bankTransfer = {
        transferType: closedForm.bankTransferType.trim(),
        utrNumber: closedForm.bankTransferUtrNumber.trim(),
      };
    }

    const payload: {
      status: string;
      requestNote?: string;
      nextFollowUp?: string;
      saleMeta?: typeof saleMeta;
      attachment?: {
        fileName?: string;
        fileUrl?: string;
        mimeType?: string;
        size?: number;
        storagePath?: string;
      };
      closureDocuments?: Array<{
        url: string;
        kind?: string;
        mimeType?: string;
        name?: string;
        size?: number;
      }>;
    } = {
      status: statusDraft,
      requestNote: statusRequestReason.trim() || `Lead closed via ${paymentMode}`,
      saleMeta,
    };
    if (Array.isArray(closureDocumentsDraft) && closureDocumentsDraft.length > 0) {
      payload.closureDocuments = closureDocumentsDraft
        .map((doc) => ({
          url: String(doc?.url || "").trim(),
          kind: String(doc?.kind || "file").trim().toLowerCase(),
          mimeType: String(doc?.mimeType || "").trim(),
          name: String(doc?.name || "").trim(),
          size: Number(doc?.size || 0),
        }))
        .filter((doc) => Boolean(doc.url));
    }

    if (followUpDraft.trim()) {
      const parsed = parseFollowUpInput(followUpDraft);
      if (!parsed) {
        setError("Invalid follow-up format. Use dd-mm-yyyy hh:mm");
        return;
      }
      payload.nextFollowUp = parsed.toISOString();
    }

    try {
      setSaving(true);
      if (statusRequestAttachment) {
        const uploaded = await uploadChatFile({
          uri: statusRequestAttachment.uri,
          name: statusRequestAttachment.name,
          mimeType: statusRequestAttachment.mimeType || "application/octet-stream",
          file: statusRequestAttachment.file,
        });
        if (!uploaded?.fileUrl) {
          throw new Error("Attachment upload failed");
        }
        payload.attachment = {
          fileName: uploaded.fileName || statusRequestAttachment.name,
          fileUrl: uploaded.fileUrl,
          mimeType: uploaded.mimeType || statusRequestAttachment.mimeType,
          size: uploaded.size || statusRequestAttachment.size || 0,
          storagePath: uploaded.storagePath || "",
        };
      }
      if (requiresClosedApproval) {
        await requestLeadStatusChange(lead._id, payload);
        setSuccess("Status change request sent for admin or manager approval");
      } else {
        const paymentModeMap: Record<string, string> = {
          Cash: "CASH",
          Cheque: "CHECK",
          "Bank Transfer": "NET_BANKING_NEFTRTGSIMPS",
          UPI: "UPI",
        };
        const mode = paymentModeMap[paymentMode] || "CASH";
        const paymentType = remainingAmount > 0 ? "PARTIAL" : "FULL";
        const paymentReference =
          paymentMode === "UPI"
            ? closedForm.upiTransactionId.trim()
            : paymentMode === "Cheque"
              ? closedForm.chequeNumber.trim()
              : paymentMode === "Bank Transfer"
                ? closedForm.bankTransferUtrNumber.trim()
                : "";
        const noteParts = [
          `Close details via ${paymentMode}`,
          remainingDueDate ? `Remaining due: ${remainingDueDate}` : "",
          paymentDate ? `Payment date: ${paymentDate}` : "",
        ].filter(Boolean);

        await updateLeadStatus(lead._id, {
          status: CLOSED_STATUS,
          dealPayment: {
            mode,
            paymentType,
            remainingAmount,
            paymentReference,
            note: noteParts.join(" | "),
          },
        } as any);
        setSuccess("Lead closed with required details");
      }
      setStatusRequestOpen(false);
      setStatusRequestReason("");
      setStatusRequestAttachment(null);
      setClosedForm({ ...EMPTY_CLOSED_FORM, saleLeadId: String(lead?._id || "") });
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to send request"));
    } finally {
      setSaving(false);
    }
  };

  const closeStatusRequestModal = () => {
    setStatusRequestOpen(false);
    setStatusRequestReason("");
    setStatusRequestAttachment(null);
    setSaleLeadDropdownOpen(false);
    setClosedForm({ ...EMPTY_CLOSED_FORM, saleLeadId: String(lead?._id || "") });
  };

  const openClosedStatusForm = () => {
    setStatusRequestReason("");
    setStatusRequestAttachment(null);
    setSaleLeadDropdownOpen(false);
    setClosedForm({ ...EMPTY_CLOSED_FORM, saleLeadId: String(lead?._id || "") });
    setStatusRequestOpen(true);
  };

  const openClosedDatePicker = (field: "remainingDueDate" | "paymentDate" | "chequeDate") => {
    const seed = parseDateOnly(closedForm[field]) || new Date();

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: seed,
        mode: "date",
        is24Hour: true,
        onChange: (event, pickedDate) => {
          if (event.type !== "set" || !pickedDate) return;
          setClosedForm((prev) => ({ ...prev, [field]: formatDateOnly(pickedDate) }));
        },
      });
      return;
    }

    if (Platform.OS === "web") {
      const input = webClosedDatePickerRef.current;
      webClosedDateFieldRef.current = field;
      if (input) {
        input.value = `${seed.getFullYear()}-${pad(seed.getMonth() + 1)}-${pad(seed.getDate())}`;
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.focus?.();
          input.click?.();
        }
      }
      return;
    }

    setClosedDatePickerField(field);
    setClosedDatePickerSeed(seed);
    setShowClosedDatePicker(true);
  };

  const onClosedDatePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      setShowClosedDatePicker(false);
      return;
    }
    if (!selectedDate || !closedDatePickerField) return;
    setClosedForm((prev) => ({ ...prev, [closedDatePickerField]: formatDateOnly(selectedDate) }));
    setShowClosedDatePicker(false);
  };

  const onWebClosedDateChange = (rawValue: string) => {
    const field = webClosedDateFieldRef.current;
    if (!field) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rawValue || "").trim());
    if (!match) return;
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(parsed.getTime())) return;
    setClosedForm((prev) => ({ ...prev, [field]: formatDateOnly(parsed) }));
  };

  const pickStatusRequestAttachment = async () => {
    if (saving || pickingStatusAttachment) return;
    try {
      setPickingStatusAttachment(true);
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["image/*", "application/pdf"],
      });
      if (picked.canceled || !picked.assets?.length) return;

      const asset: any = picked.assets[0];
      const file = asset?.file || null;
      const uri = pickUriString(asset?.uri);
      if (!uri && !file) {
        setError("Unable to read selected file");
        return;
      }
      const fallbackName = typeof file?.name === "string" ? file.name : "attachment";
      setStatusRequestAttachment({
        uri,
        name: String(asset?.name || fallbackName || "attachment"),
        mimeType: String(asset?.mimeType || file?.type || "application/octet-stream"),
        size: Number(asset?.size || file?.size || 0) || 0,
        file: file || undefined,
      });
    } catch (e) {
      setError(toErrorMessage(e, "Failed to select attachment"));
    } finally {
      setPickingStatusAttachment(false);
    }
  };

  const openFollowUpPicker = () => {
    const parsedFromDraft = followUpDraft.trim() ? parseFollowUpInput(followUpDraft) : null;
    const parsedFromLead = (lead as any)?.nextFollowUp ? new Date((lead as any).nextFollowUp) : null;
    const seedDate = parsedFromDraft
      || (parsedFromLead && !Number.isNaN(parsedFromLead.getTime()) ? parsedFromLead : null)
      || new Date();

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: seedDate,
        mode: "date",
        is24Hour: true,
        onChange: (dateEvent, pickedDate) => {
          if (dateEvent.type !== "set" || !pickedDate) return;
          DateTimePickerAndroid.open({
            value: pickedDate,
            mode: "time",
            is24Hour: true,
            onChange: (timeEvent, pickedTime) => {
              if (timeEvent.type !== "set" || !pickedTime) return;
              const finalDate = new Date(pickedDate);
              finalDate.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
              setFollowUpDraft(formatFollowUpDate(finalDate));
            },
          });
        },
      });
      return;
    }

    if (Platform.OS === "web") {
      const input = webFollowUpPickerRef.current;
      if (input) {
        const localDateTimeValue = `${seedDate.getFullYear()}-${pad(seedDate.getMonth() + 1)}-${pad(seedDate.getDate())}T${pad(seedDate.getHours())}:${pad(seedDate.getMinutes())}`;
        input.value = localDateTimeValue;
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.focus?.();
          input.click?.();
        }
      }
      return;
    }

    setFollowUpPickerDatePart(seedDate);
    setFollowUpPickerSeed(seedDate);
    setFollowUpPickerMode("date");
    setShowFollowUpPicker(true);
  };

  const onWebFollowUpChange = (rawValue: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(rawValue || "").trim());
    if (!match) return;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(parsed.getTime())) return;
    setFollowUpDraft(formatFollowUpDate(parsed));
  };

  const onFollowUpPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      setShowFollowUpPicker(false);
      setFollowUpPickerMode("date");
      return;
    }

    if (!selectedDate) return;

    if (followUpPickerMode === "date") {
      const pickedDate = new Date(selectedDate);
      setFollowUpPickerDatePart(pickedDate);
      setFollowUpPickerSeed(pickedDate);
      setShowFollowUpPicker(false);
      setTimeout(() => {
        setFollowUpPickerMode("time");
        setShowFollowUpPicker(true);
      }, 10);
      return;
    }

    const finalDate = new Date(followUpPickerDatePart);
    finalDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setFollowUpDraft(formatFollowUpDate(finalDate));
    setShowFollowUpPicker(false);
    setFollowUpPickerMode("date");
  };

  const handleStatusSelect = (nextStatus: string) => {
    setStatusDraft(nextStatus);
    if (nextStatus === CLOSED_STATUS) {
      openClosedStatusForm();
    }
  };

  const handleDiaryVoiceToggle = () => {
    if (!isDiaryMicSupported) {
      setError("Speech to text is not supported on this device/browser.");
      return;
    }

    setError("");
    if (Platform.OS !== "web") {
      const startNative = async () => {
        try {
          if (!speechPermissionGranted) {
            const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            const granted = Boolean(permission?.granted);
            setSpeechPermissionGranted(granted);
            if (!granted) {
              setError("Microphone permission is required for voice input.");
              return;
            }
          }
          if (isDiaryListening) {
            ExpoSpeechRecognitionModule.stop();
            return;
          }
          ExpoSpeechRecognitionModule.start({
            lang: "en-IN",
            interimResults: true,
            maxAlternatives: 1,
            addsPunctuation: true,
            continuous: false,
          });
        } catch {
          setError("Unable to start voice input. Try again.");
          setIsDiaryListening(false);
        }
      };
      void startNative();
      return;
    }

    if (!diaryRecognitionRef.current) {
      setError("Speech to text is not supported on this device/browser.");
      return;
    }

    try {
      if (isDiaryListening) {
        diaryRecognitionRef.current.stop();
        return;
      }
      diaryRecognitionRef.current.start();
    } catch {
      setError("Unable to start voice input. Try again.");
    }
  };

  const submitDiary = async () => {
    if (!lead) return;
    const note = diaryNoteDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setSaving(true);
      await addLeadDiaryEntry(lead._id, {
        note,
      });

      setDiaryNoteDraft("");
      setSuccess("Lead diary saved");
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save lead diary"));
    } finally {
      setSaving(false);
    }
  };

  const canEditDiaryEntry = useCallback(
    (entry: LeadDiaryEntry) => {
      if (!entry?._id) return false;
      if (String(role || "") === "ADMIN") return true;
      const entryOwnerId = String((entry?.createdBy as any)?._id || (entry?.createdBy as any)?.id || "");
      if (entryOwnerId && currentUserId) {
        return entryOwnerId === currentUserId;
      }
      return true;
    },
    [currentUserId, role],
  );

  const startDiaryEdit = (entry: LeadDiaryEntry) => {
    if (!canEditDiaryEntry(entry)) return;
    setEditingDiaryEntryId(String(entry._id || ""));
    setDiaryEditDraft(String(entry?.note || entry?.conversation || entry?.visitDetails || entry?.nextStep || entry?.conversionDetails || ""));
  };

  const cancelDiaryEdit = () => {
    setEditingDiaryEntryId("");
    setDiaryEditDraft("");
  };

  const saveDiaryEdit = async () => {
    if (!lead || !editingDiaryEntryId) return;
    const note = diaryEditDraft.trim();
    if (!note) {
      setError("Diary note cannot be empty");
      return;
    }

    try {
      setUpdatingDiaryEntry(true);
      const updated = await updateLeadDiaryEntry(lead._id, editingDiaryEntryId, { note });
      if (updated?._id) {
        setDiaryEntries((prev) =>
          prev.map((entry) => (String(entry._id) === String(updated._id) ? updated : entry)),
        );
      } else {
        await loadData();
      }
      setSuccess("Diary note updated");
      cancelDiaryEdit();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update diary note"));
    } finally {
      setUpdatingDiaryEntry(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={themeColor("#161c24")} size="large" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Lead not found.</Text>
      </View>
    );
  }

  const commandDateLabel = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const roleLabel = String(role || "USER").replace(/_/g, " ");

  return (
    <SafeAreaView style={comp.root} edges={["top", "left", "right"]}>
      {/*
       * The comp's bar. The pencil opens Update Lead - the stage, the
       * interaction and the follow-up all live there - and the kebab keeps the
       * contact shortcuts the old command-center strip used to carry.
       */}
      <View style={comp.bar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Glyph name="chevron-back" size={25} color={brand.text} />
        </Pressable>
        <Text style={comp.barTitle} numberOfLines={1}>Lead Details</Text>
        <Pressable
          onPress={() => navigation.navigate("UpdateLead", { leadId: lead._id, lead })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Update lead"
        >
          <Glyph name="pencil" size={20} color={brand.text} />
        </Pressable>
        <Pressable
          onPress={() => setOverviewSheet(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Lead actions"
        >
          <Glyph name="ellipsis-horizontal" size={21} color={brand.text} />
        </Pressable>
      </View>

    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <LeadOverview
        lead={lead}
        assigneeName={assigneeName}
        matches={selectedLeadRelatedInventories as any}
        notes={diaryEntries}
        activities={activities}
        onCall={() => openDialer(lead.phone)}
        onWhatsApp={() => openWhatsApp(lead.phone)}
        onEmail={() => openMail(lead.email)}
        onUpdate={() => navigation.navigate("UpdateLead", { leadId: lead._id, lead })}
        onReschedule={() => navigation.navigate("UpdateLead", { leadId: lead._id, lead })}
        onMarkDone={markFollowUpDone}
        onAddNote={() => setTab("notes")}
        onOpenMatch={(asset: any) =>
          navigation.navigate("InventoryDetails", { assetId: asset?._id, asset })
        }
        onSeeAllMatches={() => setTab("overview")}
      />

      {editOpen ? (
      <AppCard style={styles.card as object}>
        <View style={comp.editHead}>
          <Text style={comp.editTitle}>Edit lead</Text>
          <Pressable
            style={comp.editDone}
            onPress={() => setEditOpen(false)}
            accessibilityRole="button"
          >
            <Glyph name="close" size={19} color={brand.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.profileMetaRow}>
          <Text style={styles.statusTag}>{statusDraft || lead.status || "NEW"}</Text>
          <Text style={styles.idTag}>ID: {String(lead._id || "").slice(-6).toUpperCase()}</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Assigned</Text>
            <Text style={styles.summaryValue}>{assigneeName}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Follow-up</Text>
            <Text style={styles.summaryValue}>{followUpDraft || formatFollowUpInput((lead as any)?.nextFollowUp) || "-"}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Approval</Text>
            <Text style={styles.summaryValue}>{String((lead as any)?.dealPayment?.approvalStatus || "PENDING")}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Primary Property</Text>
            <Text style={styles.summaryValue}>
              {getInventoryLeadLabel((lead as any)?.inventoryId) || lead.projectInterested || "-"}
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Name</Text>
        <AppInput style={styles.input as object} value={leadNameDraft} onChangeText={setLeadNameDraft} placeholder="Lead name" />
        {isCompact ? (
          <>
            <Text style={styles.section}>Phone</Text>
            <AppInput style={styles.input as object} value={leadPhoneDraft} onChangeText={setLeadPhoneDraft} placeholder="Phone" keyboardType="phone-pad" />
            <BrokerPhoneHint phone={leadPhoneDraft} />
            <Text style={styles.section}>Email</Text>
            <AppInput style={styles.input as object} value={leadEmailDraft} onChangeText={setLeadEmailDraft} placeholder="Email" />
            <Text style={styles.section}>City</Text>
            <AppInput style={styles.input as object} value={leadCityDraft} onChangeText={setLeadCityDraft} placeholder="City" />
            <Text style={styles.section}>Project</Text>
            <AppInput style={styles.input as object} value={leadProjectDraft} onChangeText={setLeadProjectDraft} placeholder="Project" />
          </>
        ) : (
          <>
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.section}>Phone</Text>
                <AppInput style={styles.input as object} value={leadPhoneDraft} onChangeText={setLeadPhoneDraft} placeholder="Phone" keyboardType="phone-pad" />
                <BrokerPhoneHint phone={leadPhoneDraft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.section}>Email</Text>
                <AppInput style={styles.input as object} value={leadEmailDraft} onChangeText={setLeadEmailDraft} placeholder="Email" />
              </View>
            </View>
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.section}>City</Text>
                <AppInput style={styles.input as object} value={leadCityDraft} onChangeText={setLeadCityDraft} placeholder="City" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.section}>Project</Text>
                <AppInput style={styles.input as object} value={leadProjectDraft} onChangeText={setLeadProjectDraft} placeholder="Project" />
              </View>
            </View>
          </>
        )}
        <Text style={styles.meta}>Reporting Manager: {reportingManagerName}</Text>
        <Text style={styles.meta}>Manager: {managerName}</Text>
        <AppButton
          title={saving ? "Saving..." : "Save Lead Update"}
          onPress={saveUpdate}
          disabled={saving}
          style={styles.profileSaveBtn as object}
        />
      </AppCard>
      ) : null}

      {/*
       * The section switcher, in the comp's language rather than the web
       * kit's. The bodies below it are still the ported web screens; this at
       * least stops the strip reading as a different app from the cards above.
       */}
      <View style={comp.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={comp.tabsRow}>
          {DETAIL_TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <Pressable
                key={entry.key}
                style={[comp.tabChip, active && comp.tabChipOn]}
                onPress={() => setTab(entry.key as DetailTab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[comp.tabLabel, active && comp.tabLabelOn]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>


      {tab === "requirements" ? (
        <>
      <AppCard style={styles.card as object}>
        <Text style={styles.section}>Lead Requirements</Text>
        
        <Text style={styles.metricLabel}>Inventory Type</Text>
        <View style={styles.modalChipWrap}>
          {[
            { value: "", label: "Any" },
            { value: "COMMERCIAL", label: "Commercial" },
            { value: "RESIDENTIAL", label: "Residential" },
            { value: "COWORKING", label: "Coworking" },
          ].map((item) => (
            <AppChip
              key={`req-inv-${item.value}`}
              label={item.label}
              active={requirementsDraft?.inventoryType === item.value}
              onPress={() => updateRequirementInventoryType(item.value)}
              style={styles.modalChip as object}
            />
          ))}
        </View>

        {getPropertySubtypeOptions(requirementsDraft?.inventoryType).length ? (
          <>
            <Text style={styles.metricLabel}>
              {requirementsDraft?.inventoryType === "RESIDENTIAL" ? "Residential Property Type" : "Commercial Property Type"}
            </Text>
            <View style={styles.modalChipWrap}>
              {[{ value: "", label: "Any" }, ...getPropertySubtypeOptions(requirementsDraft?.inventoryType)].map((item) => (
                <AppChip
                  key={`req-sub-${item.value}`}
                  label={item.label}
                  active={String(requirementsDraft?.propertySubtype || "") === item.value}
                  onPress={() => updateRequirementPropertySubtype(item.value)}
                  style={styles.modalChip as object}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.metricLabel}>Deal Type</Text>
        <View style={styles.modalChipWrap}>
          {[
            { value: "", label: "Any" },
            { value: "SALE", label: "Purchase" },
            { value: "LEASE", label: "Lease" },
            { value: "RENT", label: "Rent" },
          ].map((item) => (
            <AppChip
              key={`req-tx-${item.value}`}
              label={item.label}
              active={requirementsDraft?.transactionType === item.value}
              onPress={() => updateRequirementRootField("transactionType", item.value)}
              style={styles.modalChip as object}
            />
          ))}
        </View>

        {(getPropertySubtypeConfig(requirementsDraft?.inventoryType, requirementsDraft?.propertySubtype) as any)?.showFurnishing === false ? null : (
          <>
            <Text style={styles.metricLabel}>Furnishing Status</Text>
            <View style={styles.modalChipWrap}>
              {getRequirementFurnishingOptions(requirementsDraft?.inventoryType).map((item) => (
                <AppChip
                  key={`req-furn-${item.value}`}
                  label={item.label}
                  active={requirementsDraft?.furnishingStatus === item.value}
                  onPress={() => updateRequirementRootField("furnishingStatus", item.value)}
                  style={styles.modalChip as object}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.twoColRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricLabel}>Budget Min</Text>
            <AppInput
              style={[styles.input as object, styles.twoColInput as object]}
              value={requirementsDraft?.budgetMin || ""}
              onChangeText={(val: string) => updateRequirementRootField("budgetMin", val)}
              placeholder="Min budget"
              keyboardType="phone-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricLabel}>Budget Max</Text>
            <AppInput
              style={[styles.input as object, styles.twoColInput as object]}
              value={requirementsDraft?.budgetMax || ""}
              onChangeText={(val: string) => updateRequirementRootField("budgetMax", val)}
              placeholder="Max budget"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {requirementsDraft?.inventoryType === "COWORKING" ? (
          <CoworkingRequirementEditor value={requirementsDraft?.coworking} onChange={updateRequirementCoworking} />
        ) : null}

        <SubtypeFieldsEditor
          config={getPropertySubtypeConfig(requirementsDraft?.inventoryType, requirementsDraft?.propertySubtype)}
          value={requirementsDraft?.subtypeData || {}}
          onChange={updateRequirementSubtypeField}
        />

        {/* The older fixed blocks are what a lead without a subtype carries;
            with a subtype chosen, its preferences above replace them, as on web. */}
        {requirementsDraft?.inventoryType === "COMMERCIAL" && !requirementsDraft?.propertySubtype ? (
          <View style={{ marginTop: 10, padding: 10, borderWidth: 1, borderColor: themeColor("#c8d0dd"), borderRadius: 10, backgroundColor: themeColor("#f5f7fa") }}>
            <Text style={[styles.section, { fontSize: 13, marginBottom: 6 }]}>Commercial Preferences</Text>
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricLabel}>Seats</Text>
                <AppInput
                  style={[styles.input as object, styles.twoColInput as object]}
                  value={requirementsDraft?.commercial?.seats || ""}
                  onChangeText={(val: string) => updateRequirementCommercialField("seats", val)}
                  placeholder="Workstations"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricLabel}>Cabins</Text>
                <AppInput
                  style={[styles.input as object, styles.twoColInput as object]}
                  value={requirementsDraft?.commercial?.cabins || ""}
                  onChangeText={(val: string) => updateRequirementCommercialField("cabins", val)}
                  placeholder="Cabins"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metricLabel}>Conference Room</Text>
                <AppInput
                  style={[styles.input as object, styles.twoColInput as object]}
                  value={requirementsDraft?.commercial?.conferenceRooms || ""}
                  onChangeText={(val: string) => updateRequirementCommercialField("conferenceRooms", val)}
                  placeholder="Conference Room"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            
            <View style={styles.checkboxGrid}>
              <Pressable
                style={[styles.checkboxItem, requirementsDraft?.commercial?.parkingAvailable && styles.checkboxItemActive]}
                onPress={() => updateRequirementCommercialField("parkingAvailable", !requirementsDraft?.commercial?.parkingAvailable)}
              >
                <Icon
                  name={requirementsDraft?.commercial?.parkingAvailable ? "checkbox" : "square-outline"}
                  size={14}
                  color={requirementsDraft?.commercial?.parkingAvailable ? themeColor("#12a06a") : themeColor("#4e5867")}
                />
                <Text style={styles.checkboxLabel}>Parking Available</Text>
              </Pressable>

              <Pressable
                style={[styles.checkboxItem, requirementsDraft?.commercial?.pantry && styles.checkboxItemActive]}
                onPress={() => updateRequirementCommercialField("pantry", !requirementsDraft?.commercial?.pantry)}
              >
                <Icon
                  name={requirementsDraft?.commercial?.pantry ? "checkbox" : "square-outline"}
                  size={14}
                  color={requirementsDraft?.commercial?.pantry ? themeColor("#12a06a") : themeColor("#4e5867")}
                />
                <Text style={styles.checkboxLabel}>Pantry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {requirementsDraft?.inventoryType === "RESIDENTIAL" && !requirementsDraft?.propertySubtype ? (
          <View style={{ marginTop: 10, padding: 10, borderWidth: 1, borderColor: themeColor("#c8d0dd"), borderRadius: 10, backgroundColor: themeColor("#f5f7fa") }}>
            <Text style={[styles.section, { fontSize: 13, marginBottom: 6 }]}>Residential Preferences</Text>
            
            <Text style={styles.metricLabel}>BHK Type</Text>
            <View style={styles.modalChipWrap}>
              {LEAD_REQUIREMENT_BHK_OPTIONS.map((item) => (
                <AppChip
                  key={`req-bhk-${item.value}`}
                  label={item.label}
                  active={requirementsDraft?.residential?.bhkType === item.value}
                  onPress={() => updateRequirementResidentialField("bhkType", item.value)}
                  style={styles.modalChip as object}
                />
              ))}
            </View>

            <Text style={styles.metricLabel}>Preferred Floor</Text>
            <AppInput
              style={styles.input as object}
              value={requirementsDraft?.residential?.floor || ""}
              onChangeText={(val: string) => updateRequirementResidentialField("floor", val)}
              placeholder="Floor number"
              keyboardType="phone-pad"
            />

            <Text style={styles.metricLabel}>Amenities</Text>
            <View style={styles.checkboxGrid}>
              {LEAD_REQUIREMENT_RESIDENTIAL_AMENITY_FIELDS.map((field) => {
                const checked = Boolean(requirementsDraft?.residential?.amenities?.[field.key]);
                return (
                  <Pressable
                    key={`amenity-${field.key}`}
                    style={[styles.checkboxItem, checked && styles.checkboxItemActive]}
                    onPress={() => updateRequirementResidentialAmenity(field.key, !checked)}
                  >
                    <Icon
                      name={checked ? "checkbox" : "square-outline"}
                      size={14}
                      color={checked ? themeColor("#12a06a") : themeColor("#4e5867")}
                    />
                    <Text style={styles.checkboxLabel}>{field.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </AppCard>
        </>
      ) : null}

      {tab === "overview" ? (
        <>
      <AppCard style={styles.card as object}>
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Properties</Text>
          <Text style={styles.meta}>{selectedLeadRelatedInventories.length} linked</Text>
        </View>
        {selectedLeadRelatedInventories.length === 0 ? (
          <Text style={styles.meta}>No linked properties yet</Text>
        ) : (
          selectedLeadRelatedInventories.map((inventory: any, inventoryIndex: number) => {
            const inventoryId = toObjectIdString(inventory);
            const isPrimary = inventoryId && inventoryId === selectedLeadActiveInventoryId;
            return (
              <View key={inventoryId || `row-${inventoryIndex}`} style={[styles.propertyRow, isPrimary && styles.propertyRowActive]}>
                <Text style={styles.propertyTitle}>
                  {getInventoryLeadLabel(inventory) || "Property"}
                </Text>
                <Text style={styles.meta}>{String(inventory?.location || "").trim() || "-"}</Text>
                <View style={styles.propertyActionRow}>
                  <Pressable
                    style={[styles.propertyActionBtn, isPrimary && styles.propertyActionBtnActive]}
                    onPress={() => onSelectRelatedProperty(inventoryId)}
                    disabled={!inventoryId || isPrimary || propertyActionInventoryId === inventoryId}
                    accessibilityState={{ selected: Boolean(isPrimary) }}
                  >
                    <Icon name={isPrimary ? "checkmark-circle-outline" : "checkmark"} size={13} color={themeColor(isPrimary ? "#0a6544" : "#39424f")} />
                    <Text style={[styles.propertyActionText, isPrimary && { color: themeColor("#0a6544") }]}>
                      {isPrimary ? "Active" : "Make active"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.propertyActionBtn}
                    onPress={() => onViewRelatedProperty(inventoryId)}
                    disabled={!inventoryId || propertyActionInventoryId === inventoryId}
                  >
                    <Icon name="eye-outline" size={13} color={themeColor("#39424f")} />
                    <Text style={styles.propertyActionText}>View</Text>
                  </Pressable>
                  <Pressable
                    style={styles.propertyActionBtn}
                    onPress={() => onRemoveRelatedProperty(inventoryId)}
                    disabled={!inventoryId || propertyActionInventoryId === inventoryId}
                  >
                    <Icon name="trash-outline" size={13} color={themeColor("#942626")} />
                    <Text style={[styles.propertyActionText, { color: themeColor("#942626") }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {canLinkProperties ? (
          <>
            <Text style={styles.section}>Select property to link</Text>
            <View style={styles.linkFilterRow}>
              {LINK_PROPERTY_TYPE_OPTIONS.map((typeOption) => (
                <AppChip
                  key={`link-filter-${typeOption}`}
                  label={typeOption}
                  active={relatedInventoryTypeFilter === typeOption}
                  onPress={() => setRelatedInventoryTypeFilter(typeOption)}
                />
              ))}
            </View>
            <View style={styles.linkRow}>
            <Pressable style={[styles.selectInput, styles.linkSelect]} onPress={() => setLinkDropdownOpen((previous) => !previous)}>
              <Text style={styles.selectInputText}>
                {availableRelatedInventoryOptions.find((item: any) => String(item?._id) === relatedInventoryDraft)
                  ? (
                    getInventoryLeadLabel(availableRelatedInventoryOptions.find((item: any) => String(item?._id) === relatedInventoryDraft))
                    || "Select property to link"
                  )
                  : "Select property to link"}
              </Text>
              <Icon name={linkDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={themeColor("#4e5867")} />
            </Pressable>
            <Pressable style={styles.linkAddBtn} onPress={onLinkPropertyToLead} disabled={linkingProperty || !relatedInventoryDraft}>
              <Text style={styles.linkAddBtnText}>{linkingProperty ? "Adding..." : "+ Add"}</Text>
            </Pressable>
            </View>
            {linkDropdownOpen ? (
              <View style={styles.selectMenu}>
                <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                  {availableRelatedInventoryOptions.length > 0 ? (
                    availableRelatedInventoryOptions.map((inventory: any) => (
                      <Pressable
                        key={String(inventory?._id)}
                        style={styles.selectMenuItem}
                        onPress={() => {
                          setRelatedInventoryDraft(String(inventory?._id || ""));
                          setLinkDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.selectMenuItemText}>
                          {getInventoryLeadLabel(inventory) || String(inventory?.title || "").trim() || "Property"}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptySelectText}>No properties found</Text>
                  )}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : null}
      </AppCard>

      <AppCard style={styles.card as object}>
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Proposal Generator</Text>
          <Text style={styles.meta}>Single or multiple properties</Text>
        </View>
        <View style={styles.inlineActionRow}>
          <Text style={styles.meta}>Select Properties ({proposalSelectedPropertyIds.length}/{selectedLeadRelatedInventories.length})</Text>
          <View style={styles.proposalTopActions}>
            <Pressable
              style={styles.smallTextBtn}
              onPress={() =>
                setProposalSelectedPropertyIds(
                  selectedLeadRelatedInventories.map((row: any) => toObjectIdString(row)).filter(Boolean),
                )
              }
            >
              <Text style={styles.smallTextBtnText}>All</Text>
            </Pressable>
            <Pressable style={styles.smallTextBtn} onPress={() => setProposalSelectedPropertyIds([])}>
              <Text style={styles.smallTextBtnText}>Reset</Text>
            </Pressable>
          </View>
        </View>
        {selectedLeadRelatedInventories.map((inventory: any) => {
          const inventoryId = toObjectIdString(inventory);
          const selected = selectedProposalPropertySet.has(inventoryId);
          return (
            <Pressable
              key={`proposal-${inventoryId}`}
              onPress={() => toggleProposalProperty(inventoryId)}
              style={[styles.propertyCheckboxRow, selected && styles.propertyCheckboxRowActive]}
            >
              <Icon name={selected ? "checkbox-outline" : "square-outline"} size={16} color={selected ? themeColor("#0a6544") : themeColor("#6c7789")} />
              <View style={{ flex: 1 }}>
                <Text style={styles.propertyTitle}>{getInventoryLeadLabel(inventory) || "Property"}</Text>
                <Text style={styles.meta}>{String(inventory?.status || "Available")} | {(Array.isArray(inventory?.images) ? inventory.images.length : 0)} image(s)</Text>
              </View>
            </Pressable>
          );
        })}
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Selected Properties</Text>
            <Text style={styles.metricValue}>{proposalSelectedPropertyIds.length}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Images Included</Text>
            <Text style={styles.metricValue}>
              {selectedProposalProperties.reduce((sum: number, row: any) => sum + (Array.isArray(row?.images) ? row.images.length : 0), 0)}
            </Text>
          </View>
        </View>
        <View style={styles.twoColRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricLabel}>Validity Days</Text>
            <AppInput
              style={[styles.input as object, styles.twoColInput as object]}
              value={proposalValidityDays}
              onChangeText={setProposalValidityDays}
              placeholder="7"
              keyboardType="phone-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricLabel}>Client Note</Text>
            <AppInput
              style={[styles.input as object, styles.twoColInput as object]}
              value={proposalSpecialNote}
              onChangeText={setProposalSpecialNote}
              placeholder="Optional note"
            />
          </View>
        </View>
        <Text style={styles.section}>Property Images ({selectedProposalProperties.reduce((sum: number, row: any) => sum + (Array.isArray(row?.images) ? row.images.length : 0), 0)})</Text>
        {selectedProposalProperties.length === 0 ? (
          <Text style={styles.meta}>No images attached for selected properties.</Text>
        ) : (
          selectedProposalProperties.map((row: any) => (
            <Text key={`img-${toObjectIdString(row)}`} style={styles.meta}>
              {getInventoryLeadLabel(row) || "Property"}: {(Array.isArray(row?.images) ? row.images.length : 0)} image(s)
            </Text>
          ))
        )}
        <TextInput
          style={[styles.diaryInput, { minHeight: 120, maxHeight: 220 }]}
          value={buildProposalText()}
          editable={false}
          multiline
        />
        <View style={styles.proposalActionGrid}>
          <Pressable style={styles.proposalBtn} onPress={copyProposalText}>
            <Icon name="copy-outline" size={13} color={themeColor("#39424f")} />
            <Text style={styles.proposalBtnText}>Copy</Text>
          </Pressable>
          <Pressable style={[styles.proposalBtn, styles.proposalBtnPrimary]} onPress={downloadProposalPdf} disabled={proposalBusy}>
            <Icon name="download-outline" size={13} color={themeColor("#0a6544")} />
            <Text style={[styles.proposalBtnText, styles.proposalBtnPrimaryText]}>
              {proposalBusy ? "Generating..." : "PDF"}
            </Text>
          </Pressable>
          <Pressable style={styles.proposalBtn} onPress={shareProposalWhatsApp}>
            <Icon name="logo-whatsapp" size={13} color={themeColor("#0d8055")} />
            <Text style={styles.proposalBtnText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={styles.proposalBtn} onPress={shareProposalEmail}>
            <Icon name="mail-outline" size={13} color={themeColor("#39424f")} />
            <Text style={styles.proposalBtnText}>Email</Text>
          </Pressable>
          <Pressable style={styles.proposalBtn} onPress={shareProposalPdf} disabled={proposalBusy}>
            <Icon name="paper-plane-outline" size={13} color={themeColor("#39424f")} />
            <Text style={styles.proposalBtnText}>Share PDF</Text>
          </Pressable>
          {proposalImageEntries.length ? (
            <Pressable style={styles.proposalBtn} onPress={copyProposalImageLinks}>
              <Glyph name="link-outline" size={13} color={themeColor("#39424f")} />
              <Text style={styles.proposalBtnText}>Img Links</Text>
            </Pressable>
          ) : null}
          {proposalImageEntries.length && Platform.OS !== "web" ? (
            <Pressable style={styles.proposalBtn} onPress={shareProposalImages} disabled={proposalBusy}>
              <Glyph name="images-outline" size={13} color={themeColor("#39424f")} />
              <Text style={styles.proposalBtnText}>Share Images</Text>
            </Pressable>
          ) : null}
        </View>
      </AppCard>

      <AppCard style={styles.card as object}>
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Document Submission</Text>
          <Text style={styles.meta}>{closureDocumentsDraft.length}/20</Text>
        </View>
        <Text style={styles.meta}>Upload closing proof documents (photos or PDF).</Text>
        <Pressable style={styles.docUploadBtn} onPress={pickClosureDocuments} disabled={uploadingClosureDocs || closureDocumentsDraft.length >= 20}>
          <Text style={styles.docUploadBtnText}>{uploadingClosureDocs ? "Uploading..." : "+ Add Photos / PDFs"}</Text>
        </Pressable>
        <Text style={styles.meta}>Max file size: 25MB each</Text>
        {closureDocumentsDraft.length === 0 ? (
          <Text style={styles.meta}>No documents uploaded yet</Text>
        ) : (
          closureDocumentsDraft.map((doc, index) => (
            <View key={`${doc.url}-${index}`} style={styles.docRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.propertyTitle}>{doc.name || `Document ${index + 1}`}</Text>
                <Text style={styles.meta}>{doc.kind || "file"} | {Math.max(0, Number(doc.size || 0))} bytes</Text>
              </View>
              <Pressable style={styles.docIconBtn} onPress={() => Linking.openURL(String(doc.url || "")).catch(() => setError("Unable to open document"))}>
                <Icon name="eye-outline" size={14} color={themeColor("#39424f")} />
              </Pressable>
              <Pressable style={styles.docIconBtn} onPress={() => removeClosureDocument(String(doc.url || ""))}>
                <Icon name="trash-outline" size={14} color={themeColor("#942626")} />
              </Pressable>
            </View>
          ))
        )}
      </AppCard>

      <AppCard style={styles.card as object}>
        <Text style={styles.section}>Status</Text>
        <View style={styles.statusWrap}>
          {STATUSES.map((status) => (
            <AppChip
              key={status}
              label={status}
              active={statusDraft === status}
              onPress={() => handleStatusSelect(status)}
              style={styles.chip as object}
            />
          ))}
        </View>

        <Text style={styles.section}>Follow-up</Text>
        <View style={styles.followUpInputRow}>
          <AppInput
            style={[styles.input as object, styles.followUpInput as object]}
            value={followUpDraft}
            onChangeText={setFollowUpDraft}
            placeholder="dd-mm-yyyy hh:mm"
          />
          <Pressable style={styles.followUpCalendarBtn} onPress={openFollowUpPicker}>
            <Icon name="calendar-outline" size={16} color={themeColor("#39424f")} />
          </Pressable>
        </View>
        {showFollowUpPicker && Platform.OS === "ios" ? (
          <DateTimePicker
            value={followUpPickerSeed}
            mode={followUpPickerMode}
            is24Hour
            display="spinner"
            onChange={onFollowUpPickerChange}
          />
        ) : null}
        {Platform.OS === "web" ? (
          <input
            ref={webFollowUpPickerRef}
            type="datetime-local"
            aria-label="Follow-up datetime"
            onChange={(event) => onWebFollowUpChange(event.target.value)}
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        ) : null}

        <Text style={styles.section}>Lead Diary</Text>
        <TextInput
          style={[styles.diaryInput, { height: 84 }]}
          placeholder="Add conversation notes, visit details, objections, or next steps..."
          placeholderTextColor={themeColor("#98a3b5")}
          value={diaryNoteDraft}
          onChangeText={setDiaryNoteDraft}
          multiline
          maxLength={2000}
          contextMenuHidden={false}
          selectTextOnFocus={false}
        />
        <View style={styles.diaryBottomRow}>
          <Text style={styles.diaryCounterText}>{diaryNoteDraft.length}/2000</Text>
          <View style={styles.diaryActionRow}>
            <Pressable style={styles.voiceBtn} onPress={handleDiaryVoiceToggle} disabled={saving || !isDiaryMicSupported}>
              <Icon name={isDiaryListening ? "mic-off" : "mic"} size={14} color={saving || !isDiaryMicSupported ? themeColor("#98a3b5") : themeColor("#39424f")} />
              <Text style={[styles.voiceBtnText, (saving || !isDiaryMicSupported) && styles.voiceBtnTextDisabled]}>
                {isDiaryListening ? "Stop" : "Voice"}
              </Text>
            </Pressable>
            <Pressable style={[styles.addNoteBtn, saving && styles.addNoteBtnDisabled]} onPress={submitDiary} disabled={saving}>
              <Icon name="document-text-outline" size={14} color={themeColor("#ffffff")} />
              <Text style={styles.addNoteText}>{saving ? "Saving..." : "Add Note"}</Text>
            </Pressable>
          </View>
        </View>
        {diaryEntries.length === 0 ? (
          <Text style={styles.meta}>No diary notes yet</Text>
        ) : (
          <View style={styles.diaryListWrap}>
            {visibleDiaryEntries.map((entry) => (
              <View key={`top-${entry._id}`} style={styles.diaryEntryCard}>
                <Text style={styles.diaryLine}>{String(entry.note || entry.conversation || entry.visitDetails || entry.nextStep || entry.conversionDetails || "-")}</Text>
                <Text style={styles.meta}>{formatDateTime(entry.createdAt)} {entry.createdBy?.name ? `| ${entry.createdBy.name}` : ""}</Text>
              </View>
            ))}
          </View>
        )}

        {(statusDraft === "REQUESTED" || statusDraft === "CLOSED") ? (
          <>
            <Text style={styles.section}>Deal Payment & Approval</Text>
            <View style={styles.modalChipWrap}>
              {DEAL_PAYMENT_MODES.map((mode) => (
                <AppChip
                  key={mode.value}
                  label={mode.label}
                  active={paymentModeDraft === mode.value}
                  onPress={() => {
                    setPaymentModeDraft(mode.value);
                    if (mode.value === "CASH") setPaymentReferenceDraft("");
                  }}
                  style={styles.modalChip as object}
                />
              ))}
            </View>
            <View style={styles.modalChipWrap}>
              {DEAL_PAYMENT_TYPES.map((type) => (
                <AppChip
                  key={type.value}
                  label={type.label}
                  active={paymentTypeDraft === type.value}
                  onPress={() => setPaymentTypeDraft(type.value)}
                  style={styles.modalChip as object}
                />
              ))}
            </View>
            {paymentModeDraft && paymentModeDraft !== "CASH" ? (
              <AppInput
                style={styles.input as object}
                value={paymentReferenceDraft}
                onChangeText={setPaymentReferenceDraft}
                placeholder="UTR / Txn / Cheque no."
              />
            ) : null}
            {paymentTypeDraft === "PARTIAL" ? (
              <AppInput
                style={styles.input as object}
                value={paymentRemainingDraft}
                onChangeText={setPaymentRemainingDraft}
                placeholder="Remaining amount"
                keyboardType="phone-pad"
              />
            ) : null}
            <TextInput
              style={[styles.diaryInput, { height: 66 }]}
              placeholder="Executive payment note..."
              value={paymentNoteDraft}
              onChangeText={setPaymentNoteDraft}
              multiline
              maxLength={1000}
            />
          </>
        ) : null}

        <Text style={styles.section}>Site Location</Text>
        {canManage ? (
          <>
          <View style={styles.twoColRow}>
            <AppInput
              style={[styles.input as object, styles.twoColInput as object]}
              value={siteLatDraft}
              onChangeText={setSiteLatDraft}
              placeholder="Latitude"
              keyboardType="phone-pad"
            />
            <AppInput
              style={[styles.input as object, styles.twoColInput as object]}
              value={siteLngDraft}
              onChangeText={setSiteLngDraft}
              placeholder="Longitude"
              keyboardType="phone-pad"
            />
          </View>
          <Pressable style={styles.liveLocationBtn} onPress={fillWithLiveLocation}>
            <Text style={styles.liveLocationBtnText}>Use Live Location</Text>
          </Pressable>
          </>
        ) : (
          <Text style={styles.meta}>
            {selectedLeadSiteLat !== null && selectedLeadSiteLng !== null
              ? `${selectedLeadSiteLat}, ${selectedLeadSiteLng}`
              : "Not configured by admin/manager"}
          </Text>
        )}
        <Text style={styles.meta}>Site visit status is verified within {siteVisitRadiusMeters} meters.</Text>

        <AppButton title={saving ? "Saving..." : saveButtonTitle.replace("Save Details", "Save Lead Update")} onPress={saveUpdate} disabled={saving} />
      </AppCard>
        </>
      ) : null}

      {false ? (
      <AppCard style={styles.card as object}>
        <Text style={styles.section}>Lead Diary</Text>
        <TextInput
          style={[styles.diaryInput, { height: 84 }]}
          placeholder="Add conversation notes, visit details, objections, or next step context..."
          placeholderTextColor={themeColor("#98a3b5")}
          value={diaryNoteDraft}
          onChangeText={setDiaryNoteDraft}
          multiline
          maxLength={2000}
          contextMenuHidden={false}
          selectTextOnFocus={false}
        />
        <View style={styles.diaryBottomRow}>
          <Text style={styles.diaryCounterText}>{diaryNoteDraft.length}/2000</Text>
          <View style={styles.diaryActionRow}>
            <Pressable style={styles.voiceBtn} onPress={handleDiaryVoiceToggle} disabled={saving || !isDiaryMicSupported}>
              <Icon name={isDiaryListening ? "mic-off" : "mic"} size={14} color={saving || !isDiaryMicSupported ? themeColor("#98a3b5") : themeColor("#39424f")} />
              <Text style={[styles.voiceBtnText, (saving || !isDiaryMicSupported) && styles.voiceBtnTextDisabled]}>
                {isDiaryListening ? "Stop" : "Voice"}
              </Text>
            </Pressable>
            <Pressable style={[styles.addNoteBtn, saving && styles.addNoteBtnDisabled]} onPress={submitDiary} disabled={saving}>
              <Icon name="document-text-outline" size={14} color={themeColor("#ffffff")} />
              <Text style={styles.addNoteText}>{saving ? "Saving..." : "Add Note"}</Text>
            </Pressable>
          </View>
        </View>
        {!isDiaryMicSupported ? (
          <Text style={styles.diaryHint}>Voice input not supported here. You can use keyboard mic (Google Keyboard) directly in this box.</Text>
        ) : null}

        <View style={styles.diaryListWrap}>
          {diaryEntries.length > 2 ? (
            <View style={styles.inlineActionRow}>
              <View />
              <Pressable onPress={() => setShowAllDiaryEntries((prev) => !prev)}>
                <Text style={styles.linkTextCompact}>{showAllDiaryEntries ? "Show less" : "See more"}</Text>
              </Pressable>
            </View>
          ) : null}
          {diaryEntries.length === 0 ? (
            <Text style={styles.meta}>No diary notes yet</Text>
          ) : (
            visibleDiaryEntries.map((entry) => (
              <View key={entry._id} style={styles.diaryEntryCard}>
                {String(editingDiaryEntryId) === String(entry._id) ? (
                  <>
                    <TextInput
                      style={[styles.diaryInput, { height: 72, marginBottom: 4 }]}
                      value={diaryEditDraft}
                      onChangeText={setDiaryEditDraft}
                      multiline
                      maxLength={2000}
                      contextMenuHidden={false}
                      selectTextOnFocus={false}
                    />
                    <View style={styles.editActionRow}>
                      <Pressable style={styles.editCancelBtn} onPress={cancelDiaryEdit} disabled={updatingDiaryEntry}>
                        <Text style={styles.editCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={[styles.editSaveBtn, (!diaryEditDraft.trim() || updatingDiaryEntry) && styles.addNoteBtnDisabled]} onPress={saveDiaryEdit} disabled={updatingDiaryEntry || !diaryEditDraft.trim()}>
                        <Text style={styles.editSaveText}>{updatingDiaryEntry ? "Saving..." : "Save"}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.diaryLine}>{String(entry.note || entry.conversation || entry.visitDetails || entry.nextStep || entry.conversionDetails || "-")}</Text>
                    <View style={styles.diaryEntryMetaRow}>
                      <Text style={[styles.meta, { flex: 1 }]}>
                        {formatDateTime(entry.createdAt)} {entry.createdBy?.name ? `| ${entry.createdBy.name}` : ""}
                        {entry.isEdited ? " | Edited" : ""}
                      </Text>
                      {canEditDiaryEntry(entry) ? (
                        <Pressable style={styles.entryEditBtn} onPress={() => startDiaryEdit(entry)}>
                          <Text style={styles.entryEditText}>Edit</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            ))
          )}
        </View>
      </AppCard>
      ) : null}

      {tab === "activity" ? (
        <>
      <AppCard style={styles.card as object}>
        <Text style={styles.section}>Status Request History ({statusRequestHistory.length})</Text>
        {statusRequestHistory.length === 0 ? (
          <Text style={styles.meta}>No status request history</Text>
        ) : (
          statusRequestHistory.map((request) => {
            const status = String(request.status || "pending").toLowerCase();
            const statusStyle =
              status === "approved"
                ? styles.reqApproved
                : status === "rejected"
                  ? styles.reqRejected
                  : styles.reqPending;
            return (
              <View key={`history-${request._id}`} style={styles.requestCard}>
                <View style={styles.requestHeadRow}>
                  <Text style={styles.meta}>Requested: {request.proposedStatus || "-"}</Text>
                  <Text style={statusStyle}>{status.toUpperCase()}</Text>
                </View>
                <Text style={styles.meta}>Reason: {request.requestNote || "-"}</Text>
                <Text style={styles.meta}>By: {request.requestedBy?.name || "-"}</Text>
                <Text style={styles.meta}>At: {formatDateTime(request.createdAt)}</Text>
                {request.reviewedBy?.name ? (
                  <Text style={styles.meta}>Reviewed by: {request.reviewedBy.name}</Text>
                ) : null}
                {request.reviewedAt ? (
                  <Text style={styles.meta}>Reviewed at: {formatDateTime(request.reviewedAt)}</Text>
                ) : null}
                {request.rejectionReason ? (
                  <Text style={[styles.meta, { color: themeColor("#942626") }]}>Reject reason: {request.rejectionReason}</Text>
                ) : null}
                {request.attachment?.fileUrl ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(String(request.attachment?.fileUrl || "")).catch(() => {
                        setError("Unable to open attachment");
                      })
                    }
                  >
                    <Text style={styles.attachmentLinkText}>
                      Attachment: {String(request.attachment?.fileName || "Open file")}
                    </Text>
                  </Pressable>
                ) : null}
                {Array.isArray(request.closureDocuments) && request.closureDocuments.length > 0 ? (
                  <Text style={styles.meta}>Documents: {request.closureDocuments.length}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </AppCard>
        </>
      ) : null}

      {tab === "notes" ? (
        <AppCard style={styles.card as object}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Notes</Text>
            <Text style={styles.meta}>{diaryEntries.length} total</Text>
          </View>

          <TextInput
            style={[styles.diaryInput, { height: 96 }]}
            placeholder="Add conversation notes, visit details, objections, or next steps..."
            placeholderTextColor={themeColor("#98a3b5")}
            value={diaryNoteDraft}
            onChangeText={setDiaryNoteDraft}
            multiline
            maxLength={2000}
          />
          <View style={styles.sectionRow}>
            <Text style={styles.diaryCounterText}>{diaryNoteDraft.length}/2000</Text>
            <AppButton
              title={saving ? "Saving..." : "Add Note"}
              onPress={submitDiary}
              disabled={saving || !diaryNoteDraft.trim()}
            />
          </View>

          {diaryEntries.length === 0 ? (
            <Text style={styles.meta}>No notes yet. The first one goes above.</Text>
          ) : (
            visibleDiaryEntries.map((entry) => (
              <View key={entry._id} style={styles.diaryEntryCard}>
                <Text style={styles.diaryLine}>{entry.note || "-"}</Text>
                <Text style={styles.diaryEntryMetaRow}>
                  {formatDateTime(entry.createdAt)}
                  {entry.createdBy?.name ? ` · ${entry.createdBy.name}` : ""}
                </Text>
              </View>
            ))
          )}

          {diaryEntries.length > 2 ? (
            <View style={styles.inlineActionRow}>
              <View />
              <Pressable onPress={() => setShowAllDiaryEntries((prev) => !prev)}>
                <Text style={styles.linkTextCompact}>
                  {showAllDiaryEntries ? "Show less" : "See more"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </AppCard>
      ) : null}

      {tab === "tasks" ? (
        <>
      {canManage ? (
        <AppCard style={styles.card as object}>
          <Text style={styles.section}>Assign Executive</Text>
          <Pressable style={styles.selectInput} onPress={() => setAssignDropdownOpen((prev) => !prev)}>
            <Text style={styles.selectInputText}>{selectedAssigneeLabel}</Text>
          </Pressable>
          {assignDropdownOpen ? (
            <View style={styles.selectMenu}>
              <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                {assignableExecutives.length > 0 ? (
                  assignableExecutives.map((assignee) => (
                    <Pressable
                      key={`assign-${String(assignee._id || "")}`}
                      style={styles.selectMenuItem}
                      onPress={() => {
                        setAssignDraft(String(assignee._id || ""));
                        setAssignDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.selectMenuItemText}>{assignee.name}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptySelectText}>No active executives available</Text>
                )}
              </ScrollView>
            </View>
          ) : null}

          <AppButton title={saving ? "Assigning..." : "Assign Lead"} onPress={saveAssignment} disabled={saving || !assignDraft} />
        </AppCard>
      ) : null}

      <AppCard style={styles.card as object}>
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Lead Tasks</Text>
          <Text style={styles.meta}>
            {leadTasks.filter((t) => t.status !== "COMPLETED").length} pending
          </Text>
        </View>

        {/* Quick add task form */}
        <View style={styles.taskForm}>
          <AppInput
            style={styles.input as object}
            placeholder="Add a new task for this lead..."
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
          />

          <Text style={styles.metricLabel}>Priority</Text>
          <View style={styles.modalChipWrap}>
            {["LOW", "MEDIUM", "HIGH"].map((pri) => (
              <AppChip
                key={`task-pri-${pri}`}
                label={pri}
                active={newTaskPriority === pri}
                onPress={() => setNewTaskPriority(pri)}
                style={styles.modalChip as object}
              />
            ))}
          </View>

          <Text style={styles.metricLabel}>Assignee</Text>
          <Pressable
            style={styles.selectInput}
            onPress={() => setTaskAssigneeDropdownOpen((prev) => !prev)}
          >
            <Text style={styles.selectInputText}>
              {executives.find((u) => u._id === newTaskAssignedTo)?.name || "Unassigned"}
            </Text>
          </Pressable>
          {taskAssigneeDropdownOpen ? (
            <View style={styles.selectMenu}>
              <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                <Pressable
                  style={styles.selectMenuItem}
                  onPress={() => {
                    setNewTaskAssignedTo("");
                    setTaskAssigneeDropdownOpen(false);
                  }}
                >
                  <Text style={styles.selectMenuItemText}>Unassigned</Text>
                </Pressable>
                {executives.map((u) => (
                  <Pressable
                    key={`task-assign-${u._id}`}
                    style={styles.selectMenuItem}
                    onPress={() => {
                      setNewTaskAssignedTo(u._id || "");
                      setTaskAssigneeDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.selectMenuItemText}>{u.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={styles.metricLabel}>Due Date</Text>
          <View style={styles.followUpInputRow}>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                style={{
                  flex: 1,
                  height: 38,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: themeColor("#c8d0dd"),
                  fontSize: 12,
                  backgroundColor: themeColor("#ffffff"),
                  color: themeColor("#39424f"),
                  outlineStyle: "none"
                } as any}
              />
            ) : (
              <>
                <AppInput
                  style={[styles.input as object, styles.followUpInput as object]}
                  value={newTaskDueDate}
                  onChangeText={setNewTaskDueDate}
                  placeholder="YYYY-MM-DD"
                  editable={false}
                />
                <Pressable style={styles.followUpCalendarBtn} onPress={openTaskDatePicker}>
                  <Icon name="calendar-outline" size={16} color={themeColor("#39424f")} />
                </Pressable>
              </>
            )}
          </View>
          {showTaskDatePicker && Platform.OS === "ios" ? (
            <DateTimePicker
              value={taskDatePickerSeed}
              mode="date"
              display="spinner"
              onChange={onTaskDatePickerChange}
            />
          ) : null}

          <AppButton
            title={addingTask ? "Adding..." : "Add Task"}
            onPress={handleAddLeadTask}
            disabled={addingTask || !newTaskTitle.trim()}
          />
        </View>

        {/* Tasks list */}
        <View style={{ marginTop: 14 }}>
          {loadingTasks ? (
            <ActivityIndicator color={themeColor("#161c24")} style={{ marginVertical: 12 }} />
          ) : leadTasks.length === 0 ? (
            <Text style={styles.meta}>No tasks linked to this lead.</Text>
          ) : (
            leadTasks.map((task) => {
              const isCompleted = task.status === "COMPLETED";
              const parsedDueDate = task.dueDate ? new Date(task.dueDate) : null;
              const expired =
                !isCompleted &&
                parsedDueDate &&
                parsedDueDate.getTime() < new Date().setHours(0, 0, 0, 0);

              return (
                <View
                  key={task._id}
                  style={[
                    styles.taskRow,
                    isCompleted && styles.taskRowCompleted,
                  ]}
                >
                  <Pressable
                    style={[
                      styles.taskCheckbox,
                      isCompleted && styles.taskCheckboxCompleted,
                    ]}
                    onPress={() => handleToggleLeadTaskStatus(task)}
                  >
                    {isCompleted ? (
                      <Icon name="checkmark" size={12} color={themeColor("#ffffff")} />
                    ) : null}
                  </Pressable>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.taskTitle,
                        isCompleted && styles.taskTitleCompleted,
                      ]}
                    >
                      {task.title}
                    </Text>

                    <View style={styles.taskMetaRow}>
                      <Text
                        style={[
                          styles.taskBadge,
                          {
                            color:
                              task.priority === "HIGH"
                                ? themeColor("#942626")
                                : task.priority === "MEDIUM"
                                ? themeColor("#a26f06")
                                : themeColor("#2549d6"),
                            backgroundColor:
                              task.priority === "HIGH"
                                ? themeColor("#fdedec")
                                : task.priority === "MEDIUM"
                                ? themeColor("#fbe9c4")
                                : themeColor("#eef3ff"),
                            borderColor:
                              task.priority === "HIGH"
                                ? themeColor("#f6b8b5")
                                : task.priority === "MEDIUM"
                                ? themeColor("#f6d68c")
                                : themeColor("#bcd0ff"),
                          },
                        ]}
                      >
                        {task.priority}
                      </Text>

                      {task.assignedTo?.name ? (
                        <Text
                          style={[
                            styles.taskBadge,
                            {
                              color: themeColor("#4e5867"),
                              backgroundColor: themeColor("#edf0f5"),
                              borderColor: themeColor("#c8d0dd"),
                            },
                          ]}
                        >
                          Assigned: {task.assignedTo.name}
                        </Text>
                      ) : null}

                      {task.dueDate ? (
                        <Text
                          style={[
                            styles.taskBadge,
                            {
                              color: expired ? themeColor("#942626") : themeColor("#4e5867"),
                              backgroundColor: expired ? themeColor("#fdedec") : themeColor("#edf0f5"),
                              borderColor: expired ? themeColor("#f6b8b5") : themeColor("#c8d0dd"),
                              fontWeight: expired ? "700" : "600",
                            },
                          ]}
                        >
                          Due: {task.dueDate.split("T")[0]}{" "}
                          {expired ? "(Overdue)" : ""}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <Pressable
                    style={styles.taskDeleteBtn}
                    onPress={() => handleDeleteLeadTask(task._id)}
                  >
                    <Icon name="trash-outline" size={14} color={themeColor("#942626")} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </AppCard>
        </>
      ) : null}

      {tab === "activity" ? (
        <>
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Activity Timeline</Text>
      </View>
      {activities.length > 2 ? (
        <View style={styles.inlineActionRow}>
          <View />
          <Pressable onPress={() => setShowAllActivities((prev) => !prev)}>
            <Text style={styles.linkTextCompact}>{showAllActivities ? "Show less" : "See more"}</Text>
          </Pressable>
        </View>
      ) : null}
      {activities.length === 0 ? (
        <Text style={styles.meta}>No activity yet</Text>
      ) : (
        visibleActivities.map((item) => (
          <View key={item._id} style={styles.activityCard}>
            <Text style={styles.meta}>{item.action}</Text>
            <Text style={styles.meta}>
              {formatDateTime(item.createdAt)} {item.performedBy?.name ? `| ${item.performedBy.name}` : ""}
            </Text>
          </View>
        ))
      )}

        </>
      ) : null}
      <Modal visible={statusRequestOpen} animationType="fade" transparent onRequestClose={closeStatusRequestModal}>
        <Pressable style={styles.modalWrap} onPress={closeStatusRequestModal}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 84 : 18}
          >
          <Pressable style={[styles.modalCard, styles.modalCardWide]} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.statusRequestModalContent}>
            <Text style={styles.modalTitle}>Request Status Change</Text>
            <Text style={styles.meta}>Requested status: {statusDraft}</Text>
            <Text style={styles.section}>Payment Mode</Text>
            <View style={styles.modalChipWrap}>
              {PAYMENT_MODE_OPTIONS.map((mode) => (
                <AppChip
                  key={mode}
                  label={mode}
                  active={closedForm.paymentMode === mode}
                  onPress={() => setClosedForm((prev) => ({ ...prev, paymentMode: mode }))}
                  style={styles.modalChip as object}
                />
              ))}
            </View>
            <Text style={styles.section}>Select lead</Text>
            <Pressable style={styles.selectInput} onPress={() => setSaleLeadDropdownOpen((prev) => !prev)}>
              <Text style={styles.selectInputText}>{selectedSaleLeadLabel}</Text>
            </Pressable>
            {saleLeadDropdownOpen ? (
              <View style={styles.selectMenu}>
                <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                  {saleLeadOptions.length > 0 ? (
                    saleLeadOptions.map((saleLead) => (
                      <Pressable
                        key={saleLead._id}
                        style={styles.selectMenuItem}
                        onPress={() => {
                          setClosedForm((prev) => ({ ...prev, saleLeadId: saleLead._id }));
                          setSaleLeadDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.selectMenuItemText}>
                          {saleLead.name}{saleLead.phone ? ` (${saleLead.phone})` : ""}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptySelectText}>No leads available</Text>
                  )}
                </ScrollView>
              </View>
            ) : null}
            <AppInput
              style={styles.input as object}
              value={closedForm.totalAmount}
              onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, totalAmount: value }))}
              placeholder="Total amount"
              keyboardType="phone-pad"
            />
            <AppInput
              style={styles.input as object}
              value={closedForm.partialAmount}
              onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, partialAmount: value }))}
              placeholder="Partial amount"
              keyboardType="phone-pad"
            />
            <AppInput
              style={styles.input as object}
              value={closedForm.remainingAmount}
              onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, remainingAmount: value }))}
              placeholder={suggestedRemainingAmountValue ? `Remaining amount (${suggestedRemainingAmountValue})` : "Remaining amount"}
              keyboardType="phone-pad"
            />
            <AppInput
              style={styles.input as object}
              value={closedForm.remainingDueDate}
              onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, remainingDueDate: value }))}
              placeholder="Remaining amount due date (DD-MM-YYYY)"
            />
            <View style={styles.dateFieldActionRow}>
              <Pressable style={styles.dateFieldBtn} onPress={() => openClosedDatePicker("remainingDueDate")}>
                <Icon name="calendar-outline" size={14} color={themeColor("#39424f")} />
                <Text style={styles.dateFieldBtnText}>Pick due date</Text>
              </Pressable>
            </View>

            {closedForm.paymentMode === "Cash" ? (
              <>
                <AppInput
                  style={styles.input as object}
                  value={closedForm.paymentDate}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, paymentDate: value }))}
                  placeholder="Payment date (DD-MM-YYYY)"
                />
                <View style={styles.dateFieldActionRow}>
                  <Pressable style={styles.dateFieldBtn} onPress={() => openClosedDatePicker("paymentDate")}>
                    <Icon name="calendar-outline" size={14} color={themeColor("#39424f")} />
                    <Text style={styles.dateFieldBtnText}>Pick payment date</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {closedForm.paymentMode === "UPI" ? (
              <>
                <AppInput
                  style={styles.input as object}
                  value={closedForm.upiTransactionId}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, upiTransactionId: value }))}
                  placeholder="Transaction id"
                />
                <AppInput
                  style={styles.input as object}
                  value={closedForm.paymentDate}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, paymentDate: value }))}
                  placeholder="Payment date (DD-MM-YYYY)"
                />
                <View style={styles.dateFieldActionRow}>
                  <Pressable style={styles.dateFieldBtn} onPress={() => openClosedDatePicker("paymentDate")}>
                    <Icon name="calendar-outline" size={14} color={themeColor("#39424f")} />
                    <Text style={styles.dateFieldBtnText}>Pick payment date</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {closedForm.paymentMode === "Cheque" ? (
              <>
                <AppInput
                  style={styles.input as object}
                  value={closedForm.chequeDate}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, chequeDate: value }))}
                  placeholder="Cheque date (DD-MM-YYYY)"
                />
                <View style={styles.dateFieldActionRow}>
                  <Pressable style={styles.dateFieldBtn} onPress={() => openClosedDatePicker("chequeDate")}>
                    <Icon name="calendar-outline" size={14} color={themeColor("#39424f")} />
                    <Text style={styles.dateFieldBtnText}>Pick cheque date</Text>
                  </Pressable>
                </View>
                <AppInput
                  style={styles.input as object}
                  value={closedForm.chequeNumber}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, chequeNumber: value }))}
                  placeholder="Cheque number"
                />
                <AppInput
                  style={styles.input as object}
                  value={closedForm.chequeBankName}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, chequeBankName: value }))}
                  placeholder="Bank name"
                />
              </>
            ) : null}

            {closedForm.paymentMode === "Bank Transfer" ? (
              <>
                <Text style={styles.section}>Transfer Type</Text>
                <View style={styles.modalChipWrap}>
                  {TRANSFER_TYPE_OPTIONS.map((transferType) => (
                    <AppChip
                      key={transferType}
                      label={transferType}
                      active={closedForm.bankTransferType === transferType}
                      onPress={() => setClosedForm((prev) => ({ ...prev, bankTransferType: transferType }))}
                      style={styles.modalChip as object}
                    />
                  ))}
                </View>
                <AppInput
                  style={styles.input as object}
                  value={closedForm.bankTransferUtrNumber}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, bankTransferUtrNumber: value }))}
                  placeholder="UTR number"
                />
                <AppInput
                  style={styles.input as object}
                  value={closedForm.paymentDate}
                  onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, paymentDate: value }))}
                  placeholder="Payment date (DD-MM-YYYY)"
                />
                <View style={styles.dateFieldActionRow}>
                  <Pressable style={styles.dateFieldBtn} onPress={() => openClosedDatePicker("paymentDate")}>
                    <Icon name="calendar-outline" size={14} color={themeColor("#39424f")} />
                    <Text style={styles.dateFieldBtnText}>Pick payment date</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <TextInput
              style={[styles.diaryInput, { height: 62 }]}
              placeholder="Note for admin"
              value={statusRequestReason}
              onChangeText={setStatusRequestReason}
              multiline
            />
            <View style={styles.statusAttachmentRow}>
              <Pressable
                style={styles.statusAttachBtn}
                onPress={pickStatusRequestAttachment}
                disabled={saving || pickingStatusAttachment}
              >
                <Text style={styles.statusAttachBtnText}>
                  {pickingStatusAttachment ? "Attaching..." : "+ Attach file"}
                </Text>
              </Pressable>
              {statusRequestAttachment ? (
                <Pressable
                  style={styles.statusAttachRemoveBtn}
                  onPress={() => setStatusRequestAttachment(null)}
                  disabled={saving}
                >
                  <Icon name="close" size={16} color={themeColor("#741f1f")} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.uploadStatusText}>{statusRequestAttachment?.name || "No file attached"}</Text>
            <View style={styles.modalRow}>
              <Pressable style={[styles.modalBtn, styles.modalCancelBtn]} onPress={closeStatusRequestModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalPrimaryBtn]} onPress={submitStatusRequest}>
                <Text style={styles.modalPrimaryText}>{requiresClosedApproval ? "Send for Approval" : "Save Closed Details"}</Text>
              </Pressable>
            </View>
            {showClosedDatePicker && Platform.OS === "ios" ? (
              <DateTimePicker
                value={closedDatePickerSeed}
                mode="date"
                display="spinner"
                onChange={onClosedDatePickerChange}
              />
            ) : null}
            {Platform.OS === "web" ? (
              <input
                ref={webClosedDatePickerRef}
                type="date"
                aria-label="Closed form date picker"
                onChange={(event) => onWebClosedDateChange(event.target.value)}
                style={{
                  position: "absolute",
                  width: 0,
                  height: 0,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
            ) : null}
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

    </ScrollView>

      <AppSheet
        visible={overviewSheet}
        onClose={() => setOverviewSheet(false)}
        title={lead.name || "Lead"}
        subtitle={lead.phone || undefined}
      >
        {[
          { id: "call", label: "Call", icon: "call-outline" },
          { id: "whatsapp", label: "WhatsApp", icon: "logo-whatsapp" },
          { id: "email", label: "Email", icon: "mail-outline" },
          { id: "maps", label: "Open in Maps", icon: "navigate-outline" },
          { id: "edit", label: "Edit contact details", icon: "create-outline" },
        ].map((entry) => (
          <Pressable
            key={entry.id}
            style={comp.sheetRow}
            accessibilityRole="button"
            onPress={() => {
              setOverviewSheet(false);
              if (entry.id === "call") openDialer(lead.phone);
              else if (entry.id === "whatsapp") openWhatsApp(lead.phone);
              else if (entry.id === "email") openMail(lead.email);
              else if (entry.id === "maps") openMaps();
              else setEditOpen(true);
            }}
          >
            <Glyph name={entry.icon as any} size={18} color={brand.textSecondary} />
            <Text style={comp.sheetLabel}>{entry.label}</Text>
          </Pressable>
        ))}
      </AppSheet>
    </SafeAreaView>
  );
};

/* The comp's chrome, kept apart from the web-parity sheet the tabs still use. */
const comp = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: layout.gutter,
      paddingTop: 6,
      paddingBottom: 10,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: bt.hero,
      lineHeight: 25,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    tabsWrap: {
      marginTop: 14,
      marginBottom: 4,
      marginHorizontal: -layout.gutter,
    },
    tabsRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: layout.gutter,
    },
    tabChip: {
      height: 34,
      justifyContent: "center",
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    tabChipOn: {
      borderColor: b.greenBright,
      backgroundColor: "#dff2e8",
    },
    tabLabel: {
      fontSize: bt.cardTitle,
      fontWeight: "500",
      color: b.textSecondary,
    },
    tabLabelOn: {
      fontWeight: "700",
      color: b.text,
    },
    editHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
    },
    editTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: bt.barTitle,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: b.text,
    },
    editDone: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    sheetLabel: {
      fontSize: bt.field,
      color: b.text,
    },
  }),
);

const styles = themedStyles((c) => StyleSheet.create({
  detailTabs: { marginBottom: 12 },
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
  commandCenterBar: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#10233d",
    borderWidth: 1,
    borderColor: "#1d3557",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  commandCenterTitle: {
    color: c.bg,
    fontSize: 16,
    fontWeight: "700",
  },
  commandMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  commandMetaChip: {
    borderWidth: 1,
    borderColor: "#2d547f",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: c.infoBorder,
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    backgroundColor: "#1c3e61",
    overflow: "hidden",
  },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    padding: 12,
    marginBottom: 10,
  },
  profileLabel: {
    color: c.info,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 10,
    marginBottom: 4,
    fontWeight: "700",
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  backBtn: {
    minWidth: 54,
    height: 28,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  backBtnText: {
    color: c.slate[700],
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  name: { fontSize: 18, fontWeight: "700", color: c.text },
  profileMetaRow: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusTag: {
    borderWidth: 1,
    borderColor: c.cyan[300],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: c.cyan[700],
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: c.infoBg,
    overflow: "hidden",
  },
  idTag: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: c.slate[600],
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: c.bg,
    overflow: "hidden",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  summaryItem: {
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.bg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryLabel: {
    color: c.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
    fontWeight: "700",
  },
  summaryValue: {
    color: c.text,
    fontSize: 12,
    fontWeight: "600",
  },
  section: { marginBottom: 8, color: c.slate[700], fontWeight: "700" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkText: {
    color: c.primary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  linkTextCompact: {
    color: c.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  meta: { marginTop: 4, fontSize: 12, color: c.textMuted },
  statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", alignContent: "flex-start" },
  assignRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingBottom: 2 },
  chip: {},
  input: { marginBottom: 12 },
  followUpInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  followUpInput: {
    flex: 1,
    marginBottom: 0,
  },
  followUpCalendarBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dateFieldActionRow: {
    marginTop: 0,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  dateFieldBtn: {
    height: 30,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateFieldBtnText: {
    color: c.slate[700],
    fontSize: 11,
    fontWeight: "600",
  },
  selectInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    height: 42,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginBottom: 12,
  },
  selectInputText: {
    color: c.slate[700],
    fontSize: 13,
  },
  selectMenu: {
    maxHeight: 170,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    marginBottom: 10,
  },
  selectMenuScroll: {
    maxHeight: 170,
  },
  selectMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  selectMenuItemText: {
    color: c.slate[700],
    fontSize: 13,
  },
  emptySelectText: {
    color: c.textMuted,
    fontSize: 12,
    padding: 12,
  },
  quickActionRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  quickActionBtnHalf: {
    minWidth: "48%",
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.slate[700],
  },
  propertyRow: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 8,
  },
  propertyRowActive: {
    borderColor: c.emerald[300],
    backgroundColor: c.successBg,
  },
  propertyTitle: {
    color: c.text,
    fontSize: 12,
    fontWeight: "700",
  },
  propertyActionRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  propertyStatusWrap: {
    marginTop: 6,
    marginBottom: 2,
  },
  propertyStatusDropdown: {
    height: 32,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  propertyStatusText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "600",
  },
  propertyStatusMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  propertyStatusMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.violet[50],
  },
  propertyStatusMenuText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linkFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  linkSelect: {
    flex: 1,
  },
  linkAddBtn: {
    width: 74,
    height: 40,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  linkAddBtnText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "700",
  },
  docUploadBtn: {
    marginTop: 8,
    marginBottom: 6,
    height: 34,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  docUploadBtnText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "700",
  },
  docRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docIconBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  liveLocationBtn: {
    marginTop: -2,
    marginBottom: 8,
    height: 32,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  liveLocationBtnText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "700",
  },
  profileSaveBtn: {
    marginTop: 10,
  },
  propertyActionBtnActive: { borderColor: c.emerald[300], backgroundColor: c.emerald[50] },
  propertyActionBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  propertyActionText: {
    color: c.slate[700],
    fontSize: 11,
    fontWeight: "600",
  },
  proposalTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallTextBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  smallTextBtnText: {
    color: c.slate[600],
    fontSize: 11,
    fontWeight: "700",
  },
  propertyCheckboxRow: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  propertyCheckboxRowActive: {
    borderColor: c.emerald[300],
    backgroundColor: c.successBg,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.bg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricLabel: {
    color: c.textMuted,
    fontSize: 10,
    marginBottom: 2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    color: c.text,
    fontSize: 14,
    fontWeight: "700",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 8,
  },
  twoColInput: {
    flex: 1,
  },
  proposalActionGrid: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  proposalBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    minWidth: 102,
    height: 34,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  proposalBtnPrimary: {
    borderColor: c.emerald[300],
    backgroundColor: c.infoBg,
  },
  proposalBtnText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "700",
  },
  proposalBtnPrimaryText: {
    color: c.emerald[700],
  },
  activityCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 8,
  },
  diaryInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: c.text,
    fontSize: 12,
    textAlignVertical: "top",
  },
  diarySaveBtn: {
    marginTop: 4,
  },
  diaryBottomRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  diaryCounterText: {
    color: c.textMuted,
    fontSize: 11,
  },
  diaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceBtn: {
    height: 34,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.slate[700],
  },
  voiceBtnTextDisabled: {
    color: c.textTertiary,
  },
  addNoteBtn: {
    height: 34,
    borderRadius: 10,
    backgroundColor: c.text,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
  },
  addNoteBtnDisabled: {
    opacity: 0.6,
  },
  addNoteText: {
    color: c.surface,
    fontSize: 12,
    fontWeight: "700",
  },
  diaryHint: {
    marginTop: 8,
    color: c.textMuted,
    fontSize: 11,
  },
  diaryListWrap: {
    marginTop: 10,
    gap: 8,
  },
  diaryEntryCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.bg,
    padding: 10,
  },
  diaryLine: {
    color: c.slate[700],
    fontSize: 12,
    marginBottom: 3,
  },
  diaryEntryMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryEditBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  entryEditText: {
    color: c.slate[700],
    fontSize: 11,
    fontWeight: "700",
  },
  editActionRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editCancelBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelText: {
    color: c.slate[700],
    fontSize: 11,
    fontWeight: "600",
  },
  editSaveBtn: {
    borderRadius: 8,
    backgroundColor: c.text,
    paddingHorizontal: 12,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveText: {
    color: c.surface,
    fontSize: 11,
    fontWeight: "700",
  },
  requestCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.bg,
    padding: 10,
    marginBottom: 8,
  },
  requestHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reqPending: {
    color: c.emerald[700],
    backgroundColor: c.infoBg,
    borderWidth: 1,
    borderColor: c.successBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  reqApproved: {
    color: c.emerald[800],
    backgroundColor: c.successBg,
    borderWidth: 1,
    borderColor: c.emerald[300],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  reqRejected: {
    color: c.rose[700],
    backgroundColor: c.errorBg,
    borderWidth: 1,
    borderColor: c.errorBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  reviewBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    backgroundColor: c.surface,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBtnText: {
    color: c.text,
    fontSize: 12,
    fontWeight: "700",
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalKeyboardWrap: {
    width: "100%",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
  },
  modalCardWide: {
    maxHeight: "88%",
  },
  statusRequestModalContent: {
    paddingBottom: 12,
  },
  modalChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 6,
  },
  modalChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  statusAttachmentRow: {
    marginTop: 2,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusAttachBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    height: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusAttachBtnText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "600",
  },
  statusAttachRemoveBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: c.errorBorder,
    borderRadius: 10,
    backgroundColor: c.errorBg,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadStatusText: {
    marginBottom: 10,
    color: c.textMuted,
    fontSize: 12,
  },
  attachmentLinkText: {
    marginTop: 6,
    color: c.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  reviewBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: c.bg,
  },
  reviewTitle: {
    fontSize: 12,
    color: c.text,
    fontWeight: "700",
    marginBottom: 4,
  },
  reviewSubBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 8,
    backgroundColor: c.surface,
  },
  reviewSubTitle: {
    fontSize: 11,
    color: c.slate[700],
    fontWeight: "700",
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: c.text,
    marginBottom: 6,
  },
  modalRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalCancelBtn: {
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  modalPrimaryBtn: {
    borderColor: c.text,
    backgroundColor: c.text,
  },
  modalDangerBtn: {
    borderColor: c.errorBorder,
    backgroundColor: c.errorBg,
  },
  modalPrimaryText: {
    color: c.surface,
    fontWeight: "700",
    fontSize: 12,
  },
  modalCancelText: {
    color: c.slate[700],
    fontWeight: "600",
    fontSize: 12,
  },
  modalDangerText: {
    color: c.rose[800],
    fontWeight: "700",
    fontSize: 12,
  },
  error: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: c.errorBorder,
    borderRadius: 10,
    backgroundColor: c.errorBg,
    color: c.rose[700],
  },
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: c.emerald[300],
    borderRadius: 10,
    backgroundColor: c.successBg,
    color: c.emerald[800],
  },
  taskRow: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  taskRowCompleted: {
    opacity: 0.6,
    backgroundColor: c.bg,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginTop: 2,
  },
  taskCheckboxCompleted: {
    backgroundColor: c.emerald[500],
    borderColor: c.emerald[500],
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: c.text,
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: c.textMuted,
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  taskBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  taskDeleteBtn: {
    padding: 4,
  },
  taskForm: {
    marginTop: 10,
    gap: 8,
  },
  taskFormRow: {
    flexDirection: "row",
    gap: 8,
  },
  taskFormSelect: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  taskFormSelectText: {
    fontSize: 11,
    color: c.slate[700],
  },
  taskAddBtn: {
    height: 36,
    borderRadius: 8,
    backgroundColor: c.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  taskAddBtnText: {
    color: c.surface,
    fontSize: 12,
    fontWeight: "700",
  },
  checkboxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: c.surface,
  },
  checkboxItemActive: {
    borderColor: c.emerald[500],
    backgroundColor: c.successBg,
  },
  checkboxLabel: {
    fontSize: 11,
    color: c.slate[700],
  },
}));
