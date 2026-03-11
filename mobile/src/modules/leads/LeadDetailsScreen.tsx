import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  addLeadDiaryEntry,
  addLeadRelatedProperty,
  assignLead,
  getAllLeads,
  getLeadActivity,
  getLeadDiary,
  getLeadStatusRequests,
  requestLeadStatusChange,
  removeLeadRelatedProperty,
  updateLeadBasics,
  updateLeadDiaryEntry,
  updateLeadStatus,
  type LeadDiaryEntry,
  type LeadStatusRequest,
} from "../../services/leadService";
import { uploadChatFile } from "../../services/chatService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import type { Lead } from "../../types";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { colors } from "../../theme/tokens";

const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "REQUESTED", "CLOSED", "LOST"];
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

const getInventoryLeadLabel = (inventory: any) =>
  [inventory?.projectName, inventory?.towerName, inventory?.unitNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
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
  const canManage = ["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"].includes(normalizedRole);
  const canLinkProperties = canManage || ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(normalizedRole);

  const [loading, setLoading] = useState(!initialRouteLead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lead, setLead] = useState<Lead | null>(initialRouteLead);
  const [activities, setActivities] = useState<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>>([]);
  const [diaryEntries, setDiaryEntries] = useState<LeadDiaryEntry[]>([]);
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
  const [editingDiaryEntryId, setEditingDiaryEntryId] = useState("");
  const [diaryEditDraft, setDiaryEditDraft] = useState("");
  const [updatingDiaryEntry, setUpdatingDiaryEntry] = useState(false);
  const [showAllDiaryEntries, setShowAllDiaryEntries] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const diaryRecognitionRef = useRef<any>(null);
  const lastDiaryTranscriptRef = useRef("");
  const currentUserId = String((user as any)?._id || (user as any)?.id || "");

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
        return status === "available";
      });
    },
    [inventoryOptions, selectedLeadRelatedInventories],
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

      const leadRowsResult = await getAllLeads();
      const [usersResult, inventoryRowsResult] = await Promise.allSettled([
        canManage ? getUsers() : Promise.resolve({ users: [] }),
        getInventoryAssets({ page: 1, limit: 200 }),
      ]);
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
      let currentLead = leadRows.find((row) => String((row as any)?._id || "") === leadId) || null;
      if (!currentLead && fallbackRouteLeadId) {
        currentLead = leadRows.find((row) => String((row as any)?._id || "") === fallbackRouteLeadId) || null;
      }
      if (!currentLead && leadRows.length > 0) {
        currentLead = leadRows[0];
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
      const [timelineResult, diaryResult, historyResult] = await Promise.allSettled([
        getLeadActivity(resolvedLeadId),
        getLeadDiary(resolvedLeadId),
        getLeadStatusRequests({ leadId: resolvedLeadId }),
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
    const win = globalThis as any;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsDiaryMicSupported(false);
      diaryRecognitionRef.current = null;
      return;
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
    } catch {
      setIsDiaryMicSupported(false);
      diaryRecognitionRef.current = null;
    }

    return () => {
      if (!diaryRecognitionRef.current) return;
      try {
        diaryRecognitionRef.current.stop();
      } catch {}
    };
  }, []);

  const assigneeName = useMemo(() => {
    if (!lead?.assignedTo?._id) return "Unassigned";
    return lead.assignedTo.name || "Assigned";
  }, [lead]);
  const teamLeaderName = useMemo(() => {
    const directParent = (lead as any)?.assignedTo?.parentId;
    const mappedManager = (lead as any)?.assignedManager;
    const parentRole = String(directParent?.role || "").toUpperCase();
    const mappedRole = String(mappedManager?.role || "").toUpperCase();

    if (parentRole === "TEAM_LEADER" || parentRole === "ASSISTANT_MANAGER") {
      return String(directParent?.name || "").trim() || "Not mapped";
    }
    if (mappedRole === "TEAM_LEADER" || mappedRole === "ASSISTANT_MANAGER") {
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

    const payload: any = { status: statusDraft };

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

  const buildProposalText = useCallback(() => {
    if (!lead) return "";
    const selectedRows = selectedProposalProperties.length > 0
      ? selectedProposalProperties
      : selectedLeadRelatedInventories;
    const today = formatProposalDate(new Date());
    const validity = Number.parseInt(proposalValidityDays, 10);
    const lines = [
      "SAMVID REALTY - PROPERTY PROPOSAL",
      `Date: ${today}`,
      "",
      `Dear ${String(lead.name || "Client")},`,
      "Thank you for your interest. Please find your selected property proposal below:",
      `Selected Properties: ${selectedRows.length}`,
      "",
    ];

    selectedRows.forEach((inventory: any, index) => {
      const label = getInventoryLeadLabel(inventory) || `Property ${index + 1}`;
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
    lines.push("", "Regards,", "Samvid Realty");

    return lines.join("\n");
  }, [lead, proposalSpecialNote, proposalValidityDays, selectedLeadRelatedInventories, selectedProposalProperties]);

  const buildProposalHtml = useCallback(() => {
    const proposalText = buildProposalText();
    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; line-height: 1.5; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px; }
            h1 { margin: 0 0 12px; font-size: 20px; }
          </style>
        </head>
        <body>
          <pre>${escapeHtml(proposalText)}</pre>
        </body>
      </html>
    `;
  }, [buildProposalText]);

  const copyProposalText = async () => {
    const message = buildProposalText();
    if (!selectedLeadRelatedInventories.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return;
    }
    if (!message.trim()) return;
    const nav = globalThis as any;
    if (nav?.navigator?.clipboard?.writeText) {
      await nav.navigator.clipboard.writeText(message).then(() => {
        setSuccess("Proposal copied");
      }).catch(() => {
        setError("Unable to copy proposal text");
      });
      return;
    }
    if (Platform.OS === "web") {
      try {
        const doc = (globalThis as any)?.document;
        if (!doc?.createElement || !doc?.body) {
          throw new Error("Document unavailable");
        }
        const textArea = doc.createElement("textarea");
        textArea.value = message;
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        doc.body.appendChild(textArea);
        textArea.select();
        doc.execCommand?.("copy");
        doc.body.removeChild(textArea);
        setSuccess("Proposal copied");
        return;
      } catch {
        // fall through
      }
    }
    if (Platform.OS !== "web") {
      await Share.share({ title: "Proposal Text", message }).catch(() => {
        setError("Unable to share/copy proposal text");
      });
      return;
    }
    Alert.alert("Copy unavailable", "Clipboard copy is not supported on this device/browser.");
  };

  const generateProposalPdf = async () => {
    if (!selectedLeadRelatedInventories.length) {
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

    const pdfUri = await generateProposalPdf();
    if (!pdfUri) return false;

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
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: options.title,
        UTI: "com.adobe.pdf",
      });
      return true;
    }

    await Share.share({
      title: options.title,
      message: options.message,
      url: pdfUri,
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

      if (!IS_WEB && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          dialogTitle: "Save/Download Proposal PDF",
          UTI: "com.adobe.pdf",
        });
        setSuccess("PDF ready to save/share");
        return;
      }

      await Share.share({
        title: "Property Proposal PDF",
        message: "Property proposal PDF generated",
        url: pdfUri,
      });
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
    if (!selectedLeadRelatedInventories.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return;
    }
    const phone = toWhatsAppPhone((lead as any)?.phone) || "";
    if (!phone) {
      Alert.alert("Invalid number", "Lead phone number is invalid. Last 10 digits are required.");
      return;
    }

    const text = encodeURIComponent(buildProposalText());
    const appUrlWithPhone = `whatsapp://send?phone=${phone}&text=${text}`;
    const appUrlGeneric = `whatsapp://send?text=${text}`;
    const webUrl = `https://wa.me/${phone}?text=${text}`;
    if (Platform.OS === "web") {
      await Linking.openURL(webUrl).catch(() => {
        Alert.alert("WhatsApp unavailable", "Unable to open WhatsApp Web.");
      });
      return;
    }
    const canAppWithPhone = await Linking.canOpenURL(appUrlWithPhone).catch(() => false);
    if (canAppWithPhone) {
      await Linking.openURL(appUrlWithPhone).catch(() => {
        Alert.alert("WhatsApp unavailable", "Unable to open WhatsApp.");
      });
      return;
    }
    const canAppGeneric = await Linking.canOpenURL(appUrlGeneric).catch(() => false);
    if (canAppGeneric) {
      await Linking.openURL(appUrlGeneric).catch(() => {
        Alert.alert("WhatsApp unavailable", "Unable to open WhatsApp.");
      });
      return;
    }
    await Linking.openURL(webUrl).catch(() => {
      Alert.alert("WhatsApp unavailable", "Unable to open WhatsApp.");
    });
  };

  const shareProposalEmail = async () => {
    if (!selectedLeadRelatedInventories.length) {
      Alert.alert("Select property", "Please select at least one property for proposal.");
      return;
    }
    const email = String((lead as any)?.email || "").trim();

    const subject = `Property Proposal - ${String((lead as any)?.name || "Client")}`;
    const body = buildProposalText();

    if (Platform.OS !== "web" && (await MailComposer.isAvailableAsync())) {
      await MailComposer.composeAsync({
        recipients: email ? [email] : [],
        subject,
        body,
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
        setSuccess("Status change request sent for admin approval");
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
    if (!isDiaryMicSupported || !diaryRecognitionRef.current) {
      setError("Speech to text is not supported on this device/browser.");
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
        <ActivityIndicator color="#0f172a" size="large" />
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
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.commandCenterBar}>
        <Text style={styles.commandCenterTitle}>Leads Command Center</Text>
        <View style={styles.commandMetaRow}>
          <Text style={styles.commandMetaChip}>PIPELINE</Text>
          <Text style={styles.commandMetaChip}>ROLE: {roleLabel}</Text>
          <Text style={styles.commandMetaChip}>{commandDateLabel}</Text>
        </View>
      </View>

      <AppCard style={styles.card as object}>
        <View style={styles.profileHeaderRow}>
          <Text style={styles.profileLabel}>Lead Profile</Text>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.meta}>{lead.projectInterested || "Project not tagged yet"}</Text>
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

        <View style={styles.quickActionRow}>
          <Pressable style={[styles.quickActionBtn, isCompact ? styles.quickActionBtnHalf : null]} onPress={() => openDialer(lead.phone)}>
            <Ionicons name="call-outline" size={16} color="#0f172a" />
            <Text style={styles.quickActionText}>Call</Text>
          </Pressable>
          <Pressable style={[styles.quickActionBtn, isCompact ? styles.quickActionBtnHalf : null]} onPress={() => openWhatsApp(lead.phone)}>
            <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
            <Text style={styles.quickActionText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={[styles.quickActionBtn, isCompact ? styles.quickActionBtnHalf : null]} onPress={() => openMail(lead.email)}>
            <Ionicons name="mail-outline" size={16} color="#2563eb" />
            <Text style={styles.quickActionText}>Mail</Text>
          </Pressable>
          <Pressable style={[styles.quickActionBtn, isCompact ? styles.quickActionBtnHalf : null]} onPress={openMaps}>
            <Ionicons name="location-outline" size={16} color="#0ea5e9" />
            <Text style={styles.quickActionText}>Maps</Text>
          </Pressable>
        </View>
        <Text style={styles.section}>Name</Text>
        <AppInput style={styles.input as object} value={leadNameDraft} onChangeText={setLeadNameDraft} placeholder="Lead name" />
        {isCompact ? (
          <>
            <Text style={styles.section}>Phone</Text>
            <AppInput style={styles.input as object} value={leadPhoneDraft} onChangeText={setLeadPhoneDraft} placeholder="Phone" keyboardType="phone-pad" />
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
        <Text style={styles.meta}>Team Leader: {teamLeaderName}</Text>
        <Text style={styles.meta}>Manager: {managerName}</Text>
        <AppButton
          title={saving ? "Saving..." : "Save Lead Update"}
          onPress={saveUpdate}
          disabled={saving}
          style={styles.profileSaveBtn as object}
        />
      </AppCard>

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
                    style={styles.propertyActionBtn}
                    onPress={() => onViewRelatedProperty(inventoryId)}
                    disabled={!inventoryId || propertyActionInventoryId === inventoryId}
                  >
                    <Ionicons name="eye-outline" size={13} color="#334155" />
                    <Text style={styles.propertyActionText}>View</Text>
                  </Pressable>
                  <Pressable
                    style={styles.propertyActionBtn}
                    onPress={() => onRemoveRelatedProperty(inventoryId)}
                    disabled={!inventoryId || propertyActionInventoryId === inventoryId}
                  >
                    <Ionicons name="trash-outline" size={13} color="#b91c1c" />
                    <Text style={[styles.propertyActionText, { color: "#b91c1c" }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {canLinkProperties ? (
          <>
            <Text style={styles.section}>Select property to link</Text>
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
              <Ionicons name={linkDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
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
              <Ionicons name={selected ? "checkbox-outline" : "square-outline"} size={16} color={selected ? "#0f766e" : "#64748b"} />
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
            <Ionicons name="copy-outline" size={13} color="#334155" />
            <Text style={styles.proposalBtnText}>Copy</Text>
          </Pressable>
          <Pressable style={[styles.proposalBtn, styles.proposalBtnPrimary]} onPress={downloadProposalPdf} disabled={proposalBusy}>
            <Ionicons name="download-outline" size={13} color="#0f766e" />
            <Text style={[styles.proposalBtnText, styles.proposalBtnPrimaryText]}>
              {proposalBusy ? "Generating..." : "PDF"}
            </Text>
          </Pressable>
          <Pressable style={styles.proposalBtn} onPress={shareProposalWhatsApp}>
            <Ionicons name="logo-whatsapp" size={13} color="#16a34a" />
            <Text style={styles.proposalBtnText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={styles.proposalBtn} onPress={shareProposalEmail}>
            <Ionicons name="mail-outline" size={13} color="#334155" />
            <Text style={styles.proposalBtnText}>Email</Text>
          </Pressable>
          <Pressable style={styles.proposalBtn} onPress={shareProposalPdf} disabled={proposalBusy}>
            <Ionicons name="paper-plane-outline" size={13} color="#334155" />
            <Text style={styles.proposalBtnText}>Share PDF</Text>
          </Pressable>
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
                <Ionicons name="eye-outline" size={14} color="#334155" />
              </Pressable>
              <Pressable style={styles.docIconBtn} onPress={() => removeClosureDocument(String(doc.url || ""))}>
                <Ionicons name="trash-outline" size={14} color="#b91c1c" />
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
            <Ionicons name="calendar-outline" size={16} color="#334155" />
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
              <Ionicons name={isDiaryListening ? "mic-off" : "mic"} size={14} color={saving || !isDiaryMicSupported ? "#94a3b8" : "#334155"} />
              <Text style={[styles.voiceBtnText, (saving || !isDiaryMicSupported) && styles.voiceBtnTextDisabled]}>
                {isDiaryListening ? "Stop" : "Voice"}
              </Text>
            </Pressable>
            <Pressable style={[styles.addNoteBtn, (!diaryNoteDraft.trim() || saving) && styles.addNoteBtnDisabled]} onPress={submitDiary} disabled={saving || !diaryNoteDraft.trim()}>
              <Ionicons name="document-text-outline" size={14} color="#fff" />
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

      {false ? (
      <AppCard style={styles.card as object}>
        <Text style={styles.section}>Lead Diary</Text>
        <TextInput
          style={[styles.diaryInput, { height: 84 }]}
          placeholder="Add conversation notes, visit details, objections, or next step context..."
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
              <Ionicons name={isDiaryListening ? "mic-off" : "mic"} size={14} color={saving || !isDiaryMicSupported ? "#94a3b8" : "#334155"} />
              <Text style={[styles.voiceBtnText, (saving || !isDiaryMicSupported) && styles.voiceBtnTextDisabled]}>
                {isDiaryListening ? "Stop" : "Voice"}
              </Text>
            </Pressable>
            <Pressable style={[styles.addNoteBtn, (!diaryNoteDraft.trim() || saving) && styles.addNoteBtnDisabled]} onPress={submitDiary} disabled={saving || !diaryNoteDraft.trim()}>
              <Ionicons name="document-text-outline" size={14} color="#fff" />
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
                  <Text style={[styles.meta, { color: "#b91c1c" }]}>Reject reason: {request.rejectionReason}</Text>
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

      <Modal visible={statusRequestOpen} animationType="fade" transparent onRequestClose={closeStatusRequestModal}>
        <Pressable style={styles.modalWrap} onPress={closeStatusRequestModal}>
          <Pressable style={[styles.modalCard, styles.modalCardWide]} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
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
                <Ionicons name="calendar-outline" size={14} color="#334155" />
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
                    <Ionicons name="calendar-outline" size={14} color="#334155" />
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
                    <Ionicons name="calendar-outline" size={14} color="#334155" />
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
                    <Ionicons name="calendar-outline" size={14} color="#334155" />
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
                    <Ionicons name="calendar-outline" size={14} color="#334155" />
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
                  <Ionicons name="close" size={16} color="#991b1b" />
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
        </Pressable>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
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
    color: "#f8fafc",
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
    color: "#bae6fd",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
    backgroundColor: "#1c3e61",
    overflow: "hidden",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  profileLabel: {
    color: "#0891b2",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  backBtnText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  profileMetaRow: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusTag: {
    borderWidth: 1,
    borderColor: "#67e8f9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: "#0e7490",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "#ecfeff",
    overflow: "hidden",
  },
  idTag: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: "#475569",
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "#f8fafc",
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
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
    fontWeight: "700",
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  section: { marginBottom: 8, color: "#334155", fontWeight: "700" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkText: {
    color: "#2563eb",
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
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  meta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", alignContent: "flex-start" },
  assignRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingBottom: 2 },
  chip: {},
  input: { marginBottom: 10 },
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
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  dateFieldActionRow: {
    marginTop: -2,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  dateFieldBtn: {
    height: 30,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateFieldBtnText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
  },
  selectInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    height: 42,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginBottom: 8,
  },
  selectInputText: {
    color: "#334155",
    fontSize: 13,
  },
  selectMenu: {
    maxHeight: 170,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  selectMenuScroll: {
    maxHeight: 170,
  },
  selectMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  selectMenuItemText: {
    color: "#334155",
    fontSize: 13,
  },
  emptySelectText: {
    color: "#64748b",
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
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
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
    color: "#334155",
  },
  propertyRow: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    marginBottom: 8,
  },
  propertyRowActive: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  propertyTitle: {
    color: "#0f172a",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  propertyStatusText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  propertyStatusMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  propertyStatusMenuItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ff",
  },
  propertyStatusMenuText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linkSelect: {
    flex: 1,
  },
  linkAddBtn: {
    width: 74,
    height: 40,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  linkAddBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  docUploadBtn: {
    marginTop: 8,
    marginBottom: 6,
    height: 34,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  docUploadBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  docRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docIconBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  liveLocationBtn: {
    marginTop: -2,
    marginBottom: 8,
    height: 32,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  liveLocationBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  profileSaveBtn: {
    marginTop: 10,
  },
  propertyActionBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  propertyActionText: {
    color: "#334155",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  smallTextBtnText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  propertyCheckboxRow: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  propertyCheckboxRowActive: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 10,
    marginBottom: 2,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#0f172a",
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
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    minWidth: 102,
    height: 34,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  proposalBtnPrimary: {
    borderColor: "#5eead4",
    backgroundColor: "#ecfeff",
  },
  proposalBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  proposalBtnPrimaryText: {
    color: "#0f766e",
  },
  activityCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
  diaryInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: "#0f172a",
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
    color: "#64748b",
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
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  voiceBtnTextDisabled: {
    color: "#94a3b8",
  },
  addNoteBtn: {
    height: 34,
    borderRadius: 10,
    backgroundColor: "#0f172a",
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
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  diaryHint: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 11,
  },
  diaryListWrap: {
    marginTop: 10,
    gap: 8,
  },
  diaryEntryCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  diaryLine: {
    color: "#334155",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  entryEditText: {
    color: "#334155",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
  },
  editSaveBtn: {
    borderRadius: 8,
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  requestCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
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
    color: "#0f766e",
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  reqApproved: {
    color: "#166534",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  reqRejected: {
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
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
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBtnText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
  },
  modalCardWide: {
    maxHeight: "88%",
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
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    height: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusAttachBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  statusAttachRemoveBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadStatusText: {
    marginBottom: 10,
    color: "#64748b",
    fontSize: 12,
  },
  attachmentLinkText: {
    marginTop: 6,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  reviewBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  reviewTitle: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 4,
  },
  reviewSubBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#fff",
  },
  reviewSubTitle: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "700",
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
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
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  modalPrimaryBtn: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  modalDangerBtn: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  modalPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  modalCancelText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  modalDangerText: {
    color: "#991b1b",
    fontWeight: "700",
    fontSize: 12,
  },
  error: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
  },
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    color: "#166534",
  },
});
