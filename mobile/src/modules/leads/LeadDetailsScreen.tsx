import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  addLeadDiaryEntry,
  assignLead,
  approveLeadStatusRequest,
  getAllLeads,
  getLeadActivity,
  getLeadDiary,
  getPendingLeadStatusRequests,
  rejectLeadStatusRequest,
  requestLeadStatusChange,
  updateLeadDiaryEntry,
  updateLeadStatus,
  type LeadDiaryEntry,
  type LeadStatusRequest,
} from "../../services/leadService";
import { uploadChatFile } from "../../services/chatService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import type { Lead } from "../../types";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { colors } from "../../theme/tokens";

const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "CLOSED", "LOST"];
const CLOSED_STATUS = "CLOSED";
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
  const localTen = toLocalTenDigitPhone(value);
  if (!localTen) return "";
  return localTen;
};

const formatFollowUpInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseFollowUpInput = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(trimmed);
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

const pickUriString = (value: unknown) => String(value || "").trim();

export const LeadDetailsScreen = () => {
  const route = useRoute<any>();
  const leadId = String(route.params?.leadId || "");
  const { role, user } = useAuth();
  const canManage = ["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"].includes(String(role || ""));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>>([]);
  const [diaryEntries, setDiaryEntries] = useState<LeadDiaryEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeadStatusRequest[]>([]);
  const [saleLeadOptions, setSaleLeadOptions] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);
  const [executives, setExecutives] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [assignDraft, setAssignDraft] = useState("");
  const [statusRequestOpen, setStatusRequestOpen] = useState(false);
  const [statusRequestReason, setStatusRequestReason] = useState("");
  const [statusRequestAttachment, setStatusRequestAttachment] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    size: number;
    file?: any;
  } | null>(null);
  const [pickingStatusAttachment, setPickingStatusAttachment] = useState(false);
  const [saleLeadDropdownOpen, setSaleLeadDropdownOpen] = useState(false);
  const [closedForm, setClosedForm] = useState(EMPTY_CLOSED_FORM);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<LeadStatusRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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

  useEffect(() => {
    setShowAllDiaryEntries(false);
    setShowAllActivities(false);
    setEditingDiaryEntryId("");
    setDiaryEditDraft("");
  }, [leadId]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [leads, timeline, diary, users, requests] = await Promise.all([
        getAllLeads(),
        getLeadActivity(leadId),
        getLeadDiary(leadId),
        canManage ? getUsers() : Promise.resolve({ users: [] }),
        canManage ? getPendingLeadStatusRequests({ leadId }) : Promise.resolve([]),
      ]);

      const currentLead = (leads || []).find((row) => String(row._id) === leadId) || null;
      if (!currentLead) {
        setError("Lead not found");
        setLead(null);
        setActivities([]);
        setDiaryEntries([]);
        setPendingRequests([]);
        return;
      }

      setLead(currentLead);
      setSaleLeadOptions(
        (Array.isArray(leads) ? leads : [])
          .map((row) => ({
            _id: String((row as any)?._id || ""),
            name: String((row as any)?.name || "").trim(),
            phone: String((row as any)?.phone || "").trim(),
          }))
          .filter((row) => row._id && row.name),
      );
      setActivities(Array.isArray(timeline) ? timeline : []);
      setDiaryEntries(Array.isArray(diary) ? diary : []);
      setPendingRequests(Array.isArray(requests) ? requests : []);
      setExecutives((users as any)?.users || []);

      setStatusDraft(currentLead.status || "NEW");
      setFollowUpDraft(formatFollowUpInput(currentLead.nextFollowUp));
      setAssignDraft(currentLead.assignedTo?._id || "");
      setClosedForm((prev) => ({ ...prev, saleLeadId: prev.saleLeadId || String(currentLead._id || "") }));
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load lead details"));
    } finally {
      setLoading(false);
    }
  }, [leadId, canManage]);

  useEffect(() => {
    if (leadId) {
      loadData();
    }
  }, [leadId, loadData]);

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

  const saveUpdate = async () => {
    if (!lead) return;

    const payload: Partial<Lead> = { status: statusDraft };

    if (followUpDraft.trim()) {
      const parsed = parseFollowUpInput(followUpDraft);
      if (!parsed) {
        setError("Invalid follow-up format. Use dd/mm/yyyy hh:mm");
        return;
      }
      payload.nextFollowUp = parsed.toISOString();
    }

    if (requiresClosedApproval) {
      setClosedForm({ ...EMPTY_CLOSED_FORM, saleLeadId: String(lead?._id || "") });
      setStatusRequestReason("");
      setStatusRequestOpen(true);
      return;
    }

    try {
      setSaving(true);
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

  const submitStatusRequest = async () => {
    if (!lead) return;
    if (!requiresClosedApproval) {
      setError("Approval is required only for CLOSED status");
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
    } = {
      status: statusDraft,
      requestNote: statusRequestReason.trim() || `Lead closed via ${paymentMode}`,
      saleMeta,
    };

    if (followUpDraft.trim()) {
      const parsed = parseFollowUpInput(followUpDraft);
      if (!parsed) {
        setError("Invalid follow-up format. Use dd/mm/yyyy hh:mm");
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
      await requestLeadStatusChange(lead._id, payload);
      setStatusRequestOpen(false);
      setStatusRequestReason("");
      setStatusRequestAttachment(null);
      setClosedForm({ ...EMPTY_CLOSED_FORM, saleLeadId: String(lead?._id || "") });
      setSuccess("Status change request sent for admin approval");
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

  const closeReviewModal = () => {
    setReviewOpen(false);
    setReviewTarget(null);
    setRejectReason("");
  };

  const handleStatusSelect = (nextStatus: string) => {
    setStatusDraft(nextStatus);
    if (!canManage && nextStatus === CLOSED_STATUS && String(lead?.status || "") !== CLOSED_STATUS) {
      setStatusRequestReason("");
      setStatusRequestAttachment(null);
      setSaleLeadDropdownOpen(false);
      setClosedForm({ ...EMPTY_CLOSED_FORM, saleLeadId: String(lead?._id || "") });
      setStatusRequestOpen(true);
    }
  };

  const openReviewModal = (request: LeadStatusRequest) => {
    setReviewTarget(request);
    setRejectReason("");
    setReviewOpen(true);
  };

  const approveRequest = async () => {
    if (!reviewTarget?._id) return;
    try {
      setSaving(true);
      await approveLeadStatusRequest(reviewTarget._id);
      setReviewOpen(false);
      setReviewTarget(null);
      setSuccess("Request approved");
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to approve request"));
    } finally {
      setSaving(false);
    }
  };

  const rejectRequest = async () => {
    if (!reviewTarget?._id) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Rejection reason is required");
      return;
    }

    try {
      setSaving(true);
      await rejectLeadStatusRequest(reviewTarget._id, reason);
      setReviewOpen(false);
      setReviewTarget(null);
      setRejectReason("");
      setSuccess("Request rejected with reason");
      await loadData();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to reject request"));
    } finally {
      setSaving(false);
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <AppCard style={styles.card as object}>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.meta}>{lead.phone} | {lead.email || "-"}</Text>
        <Text style={styles.meta}>City: {lead.city || "-"}</Text>
        <Text style={styles.meta}>Project: {lead.projectInterested || "-"}</Text>
        <Text style={styles.meta}>Assigned Executive: {assigneeName}</Text>
        <Text style={styles.meta}>Team Leader: {teamLeaderName}</Text>
        <Text style={styles.meta}>Manager: {managerName}</Text>

        <View style={styles.quickActionRow}>
          <Pressable style={styles.quickActionBtn} onPress={() => openDialer(lead.phone)}>
            <Ionicons name="call-outline" size={16} color="#0f172a" />
            <Text style={styles.quickActionText}>Call</Text>
          </Pressable>
          <Pressable style={styles.quickActionBtn} onPress={() => openWhatsApp(lead.phone)}>
            <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
            <Text style={styles.quickActionText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={styles.quickActionBtn} onPress={() => openMail(lead.email)}>
            <Ionicons name="mail-outline" size={16} color="#2563eb" />
            <Text style={styles.quickActionText}>Mail</Text>
          </Pressable>
        </View>
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
        <AppInput
          style={styles.input as object}
          value={followUpDraft}
          onChangeText={setFollowUpDraft}
          placeholder="dd/mm/yyyy hh:mm"
        />

        <AppButton title={saveButtonTitle} onPress={saveUpdate} disabled={saving} />
      </AppCard>

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

      {canManage ? (
        <AppCard style={styles.card as object}>
          <Text style={styles.section}>Pending Status Requests ({pendingRequests.length})</Text>
          {pendingRequests.length === 0 ? (
            <Text style={styles.meta}>No pending requests</Text>
          ) : (
            pendingRequests.map((request) => (
              <View key={request._id} style={styles.requestCard}>
                <Text style={styles.meta}>Requested: {request.proposedStatus}</Text>
                <Text style={styles.meta}>Reason: {request.requestNote}</Text>
                <Text style={styles.meta}>By: {request.requestedBy?.name || "-"}</Text>
                {request.proposedSaleMeta ? (
                  <>
                    <Text style={styles.meta}>Payment Mode: {String(request.proposedSaleMeta.paymentMode || "-")}</Text>
                    <Text style={styles.meta}>Total: {String(request.proposedSaleMeta.totalAmount || "-")}</Text>
                    <Text style={styles.meta}>Partial: {String(request.proposedSaleMeta.partialAmount || "-")}</Text>
                    <Text style={styles.meta}>Remaining: {String(request.proposedSaleMeta.remainingAmount || "-")}</Text>
                    <Text style={styles.meta}>Remaining Due Date: {String(request.proposedSaleMeta.remainingDueDate || "-")}</Text>
                    <Text style={styles.meta}>Payment Date: {String(request.proposedSaleMeta.paymentDate || "-")}</Text>
                  </>
                ) : null}
                {request.proposedNextFollowUp ? <Text style={styles.meta}>Follow-up: {formatFollowUpInput(request.proposedNextFollowUp)}</Text> : null}
                <Pressable style={styles.reviewBtn} onPress={() => openReviewModal(request)}>
                  <Text style={styles.reviewBtnText}>Review</Text>
                </Pressable>
              </View>
            ))
          )}
        </AppCard>
      ) : null}

      {canManage ? (
        <AppCard style={styles.card as object}>
          <Text style={styles.section}>Assign Executive</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignRow}>
            {executives
              .filter((u) => u.isActive !== false && ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(String(u.role)))
              .map((user) => (
                <AppChip
                  key={String(user._id)}
                  label={user.name}
                  active={assignDraft === user._id}
                  onPress={() => setAssignDraft(String(user._id || ""))}
                  style={styles.chip as object}
                />
              ))}
          </ScrollView>

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

            {closedForm.paymentMode === "Cash" ? (
              <AppInput
                style={styles.input as object}
                value={closedForm.paymentDate}
                onChangeText={(value: string) => setClosedForm((prev) => ({ ...prev, paymentDate: value }))}
                placeholder="Payment date (DD-MM-YYYY)"
              />
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
                <Text style={styles.modalPrimaryText}>Send for Approval</Text>
              </Pressable>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={reviewOpen} animationType="fade" transparent onRequestClose={closeReviewModal}>
        <Pressable style={styles.modalWrap} onPress={closeReviewModal}>
          <Pressable style={[styles.modalCard, styles.modalCardWide]} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Review Status Request</Text>
            <View style={styles.reviewBox}>
              <Text style={styles.reviewTitle}>Request Summary</Text>
              <Text style={styles.meta}>Requested status: {reviewTarget?.proposedStatus || "-"}</Text>
              <Text style={styles.meta}>Reason by executive: {reviewTarget?.requestNote || "-"}</Text>
              {reviewTarget?.attachment?.fileUrl ? (
                <Pressable
                  onPress={() =>
                    Linking.openURL(String(reviewTarget?.attachment?.fileUrl || "")).catch(() => {
                      setError("Unable to open attachment");
                    })
                  }
                >
                  <Text style={styles.attachmentLinkText}>
                    Attachment: {String(reviewTarget?.attachment?.fileName || "Open file")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {reviewTarget?.proposedSaleMeta ? (
              <View style={styles.reviewBox}>
                <Text style={styles.reviewTitle}>Payment Details</Text>
                <Text style={styles.meta}>Sold To: {String(reviewTarget.proposedSaleMeta.leadName || reviewTarget.proposedSaleMeta.leadId || "-")}</Text>
                <Text style={styles.meta}>Payment Mode: {String(reviewTarget.proposedSaleMeta.paymentMode || "-")}</Text>
                <Text style={styles.meta}>Total Amount: {String(reviewTarget.proposedSaleMeta.totalAmount || "-")}</Text>
                <Text style={styles.meta}>Partial Amount: {String(reviewTarget.proposedSaleMeta.partialAmount || "-")}</Text>
                <Text style={styles.meta}>Remaining Amount: {String(reviewTarget.proposedSaleMeta.remainingAmount || "-")}</Text>
                <Text style={styles.meta}>Remaining Due Date: {String(reviewTarget.proposedSaleMeta.remainingDueDate || "-")}</Text>
                <Text style={styles.meta}>Payment Date: {String(reviewTarget.proposedSaleMeta.paymentDate || "-")}</Text>
                {reviewTarget.proposedSaleMeta.cheque ? (
                  <View style={styles.reviewSubBox}>
                    <Text style={styles.reviewSubTitle}>Cheque Details</Text>
                    <Text style={styles.meta}>Cheque Date: {String(reviewTarget.proposedSaleMeta.cheque.chequeDate || "-")}</Text>
                    <Text style={styles.meta}>Cheque No: {String(reviewTarget.proposedSaleMeta.cheque.chequeNumber || "-")}</Text>
                    <Text style={styles.meta}>Bank Name: {String(reviewTarget.proposedSaleMeta.cheque.bankName || "-")}</Text>
                  </View>
                ) : null}
                {reviewTarget.proposedSaleMeta.upi ? (
                  <View style={styles.reviewSubBox}>
                    <Text style={styles.reviewSubTitle}>UPI Details</Text>
                    <Text style={styles.meta}>UPI Txn ID: {String(reviewTarget.proposedSaleMeta.upi.transactionId || "-")}</Text>
                  </View>
                ) : null}
                {reviewTarget.proposedSaleMeta.bankTransfer ? (
                  <View style={styles.reviewSubBox}>
                    <Text style={styles.reviewSubTitle}>Bank Transfer Details</Text>
                    <Text style={styles.meta}>Transfer Type: {String(reviewTarget.proposedSaleMeta.bankTransfer.transferType || "-")}</Text>
                    <Text style={styles.meta}>UTR Number: {String(reviewTarget.proposedSaleMeta.bankTransfer.utrNumber || "-")}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <TextInput
              style={[styles.diaryInput, { height: 82 }]}
              placeholder="Rejection reason (required for reject)"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalRow}>
              <Pressable style={[styles.modalBtn, styles.modalDangerBtn]} onPress={rejectRequest}>
                <Text style={styles.modalDangerText}>Reject</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalPrimaryBtn]} onPress={approveRequest}>
                <Text style={styles.modalPrimaryText}>Approve</Text>
              </Pressable>
            </View>
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
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
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
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
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
