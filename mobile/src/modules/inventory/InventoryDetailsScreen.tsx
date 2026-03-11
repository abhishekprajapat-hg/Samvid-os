import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { addLeadDiaryEntry, getAllLeads } from "../../services/leadService";
import { uploadChatFile } from "../../services/chatService";
import { deleteInventoryAsset, getInventoryAssetActivity, getInventoryAssetById, requestInventoryStatusChange, updateInventoryAsset } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import type { InventoryActivity, InventoryAsset } from "../../types";

const STATUS_OPTIONS = ["Available", "Blocked", "Sold"];
const STATUS_MODAL_OPTIONS = new Set(["Available", "Blocked", "Sold"]);
const SOLD_PAYMENT_MODES = ["CASH", "CHECK", "NET_BANKING_NEFTRTGSIMPS", "UPI"];
const SOLD_PAYMENT_MODE_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Cheque",
  NET_BANKING_NEFTRTGSIMPS: "Bank Transfer",
  UPI: "UPI",
};
const SOLD_TRANSFER_TYPES = ["NEFT", "RTGS", "IMPS"];
type SoldDateField = "remainingDueDate" | "paymentDate" | "chequeDate";

const formatDateOnly = (value: Date) =>
  `${String(value.getDate()).padStart(2, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${value.getFullYear()}`;

const parseDateOnly = (value: string): Date | null => {
  const safe = String(value || "").trim();
  const match = safe.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) return null;
  return date;
};
const buildDefaultImageSet = (seed: string) => {
  const safeSeed = encodeURIComponent(seed || "asset");
  return Array.from({ length: 4 }, (_, index) => `https://picsum.photos/seed/${safeSeed}-${index + 1}/900/600`);
};

const resolveFileUrl = (url?: string) => {
  const safe = String(url || "").trim();
  if (!safe) return "";
  if (/^https?:\/\//i.test(safe)) return safe;

  const base = process.env.EXPO_PUBLIC_API_ORIGIN || process.env.EXPO_PUBLIC_SOCKET_URL || "";
  const cleanBase = String(base).replace(/\/$/, "");
  if (cleanBase) return `${cleanBase}${safe.startsWith("/") ? "" : "/"}${safe}`;
  return safe;
};

const pickUriString = (value: unknown) => String(value || "").trim();

const toObjectIdString = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id?: string })._id || "").trim();
  }
  return "";
};

const formatActionLabel = (activity: InventoryActivity) => {
  const rawAction = String((activity as any).action || "").trim();
  if (rawAction) return rawAction;

  const actionType = String((activity as any).actionType || "")
    .trim()
    .replaceAll("_", " ")
    .toLowerCase();

  const newValue = (activity as any).newValue || {};
  const oldValue = (activity as any).oldValue || {};

  if (newValue.status || oldValue.status) {
    const from = oldValue.status ? ` from ${oldValue.status}` : "";
    const to = newValue.status ? ` to ${newValue.status}` : "";
    return `Status updated${from}${to}`;
  }

  if (actionType) {
    return actionType.charAt(0).toUpperCase() + actionType.slice(1);
  }

  return "Inventory activity";
};

export const InventoryDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const routeAsset = route.params?.asset || null;
  const derivedRouteAssetId = String(
    route.params?.assetId
    || route.params?.inventoryId
    || route.params?.id
    || routeAsset?._id
    || "",
  );
  const assetId = derivedRouteAssetId;
  const { role } = useAuth();
  const normalizedRole = String(role || "").toUpperCase();
  const isAdmin = normalizedRole === "ADMIN";
  const canManage = ["ADMIN", "MANAGER", "CHANNEL_PARTNER"].includes(normalizedRole);
  const canRequestStatusChange = ["FIELD_EXECUTIVE", "EXECUTIVE", "TEAM_LEADER", "ASSISTANT_MANAGER"].includes(normalizedRole);
  const canEditAsset = canManage || canRequestStatusChange;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [asset, setAsset] = useState<InventoryAsset | null>(routeAsset || null);
  const [activities, setActivities] = useState<InventoryActivity[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [leadDiaryDraft, setLeadDiaryDraft] = useState("");
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [leadOptions, setLeadOptions] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);
  const [blockedLeadIdDraft, setBlockedLeadIdDraft] = useState("");
  const [blockedLeadDropdownOpen, setBlockedLeadDropdownOpen] = useState(false);
  const [soldDateField, setSoldDateField] = useState<SoldDateField | null>(null);
  const [webDatePickerField, setWebDatePickerField] = useState<SoldDateField | null>(null);
  const [webDatePickerValue, setWebDatePickerValue] = useState("");
  const [soldForm, setSoldForm] = useState({
    leadId: "",
    paymentMode: "CASH",
    totalAmount: "",
    partialAmount: "",
    remainingAmount: "",
    remainingDueDate: "",
    paymentDate: "",
    chequeNumber: "",
    chequeBankName: "",
    chequeDate: "",
    bankTransferType: "NEFT",
    bankTransferUtrNumber: "",
    upiTransactionId: "",
    paymentReference: "",
    note: "",
  });
  const [statusAttachment, setStatusAttachment] = useState<{
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
    file?: any;
  } | null>(null);
  const [pickingStatusAttachment, setPickingStatusAttachment] = useState(false);
  const webDateInputRef = useRef<any>(null);
  const viewerListRef = useRef<FlatList<string> | null>(null);
  const { width: viewportWidth } = useWindowDimensions();
  const viewerWidth = Math.max(220, viewportWidth - 32);

  const galleryImages = useMemo(
    () => (asset?.images?.length ? asset.images : asset ? buildDefaultImageSet(asset.title || asset._id) : []),
    [asset],
  );
  const selectedBlockedLeadLabel = useMemo(() => {
    const selected = leadOptions.find((row) => row._id === blockedLeadIdDraft);
    if (!selected) return "Select lead";
    return selected.phone ? `${selected.name} (${selected.phone})` : selected.name;
  }, [blockedLeadIdDraft, leadOptions]);
  const visibleActivities = useMemo(
    () => (showAllActivities ? activities : activities.slice(0, 5)),
    [activities, showAllActivities],
  );

  const loadDetails = async () => {
    let hasHardError = false;
    try {
      setLoading(true);
      setError("");

      try {
        const details = await getInventoryAssetById(assetId);
        const resolvedAsset = (details?.asset as any) || (details?.inventory as any) || null;
        setAsset(resolvedAsset || routeAsset || null);
      } catch (e) {
        hasHardError = true;
        const detailError = toErrorMessage(e, "Failed to load inventory details");
        if (!routeAsset || !/access denied|forbidden/i.test(detailError)) {
          setError(detailError);
        }
      }

      const [timeline, leads] = await Promise.all([
        getInventoryAssetActivity(assetId, { limit: 60 })
          .then((rows) => ({ rows, error: "" }))
          .catch((e) => ({
            rows: [],
            error: toErrorMessage(e, "Failed to load inventory activity"),
          })),
        getAllLeads().catch(() => []),
      ]);

      if (timeline.error && !/access denied|forbidden/i.test(timeline.error)) {
        setError((prev) => prev || timeline.error);
      }
      setActivities(Array.isArray(timeline.rows) ? timeline.rows : []);
      setLeadOptions(
        (Array.isArray(leads) ? leads : [])
          .map((row: any) => ({
            _id: String(row?._id || ""),
            name: String(row?.name || "").trim(),
            phone: String(row?.phone || "").trim(),
          }))
          .filter((row: any) => row._id && row.name),
      );
    } catch (e) {
      if (!hasHardError) {
        setError(toErrorMessage(e, "Failed to load inventory details"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1500);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (assetId) {
      loadDetails();
    }
  }, [assetId]);

  useEffect(() => {
    if (!webDatePickerField || Platform.OS !== "web") return;
    const timer = setTimeout(() => {
      const node = webDateInputRef.current as any;
      try {
        if (node?.showPicker) node.showPicker();
        else node?.focus?.();
      } catch {
        node?.focus?.();
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [webDatePickerField]);

  useEffect(() => {
    if (!viewerOpen || !galleryImages.length) return;
    const safeIndex = Math.min(viewerIndex, Math.max(galleryImages.length - 1, 0));
    const timer = setTimeout(() => {
      viewerListRef.current?.scrollToIndex({ index: safeIndex, animated: false });
    }, 40);
    return () => clearTimeout(timer);
  }, [viewerOpen, galleryImages.length, viewerWidth]);

  useEffect(() => {
    if (!galleryImages.length && viewerOpen) {
      setViewerOpen(false);
      setViewerIndex(0);
      return;
    }
    if (viewerIndex > Math.max(galleryImages.length - 1, 0)) {
      setViewerIndex(Math.max(galleryImages.length - 1, 0));
    }
  }, [galleryImages.length, viewerIndex, viewerOpen]);

  const applyStatusUpdate = async (
    status: string,
    options: { leadDiaryNote?: string; leadId?: string; saleDetails?: Record<string, unknown> | null } = {},
  ) => {
    if (!asset || (!canManage && !canRequestStatusChange)) return;
    const leadDiaryNote = String(options.leadDiaryNote || "");
    const leadId = String(options.leadId || "");
    const saleDetails = options.saleDetails && typeof options.saleDetails === "object" ? options.saleDetails : null;

    try {
      setSaving(true);
      if (canManage) {
        const updated = await updateInventoryAsset(asset._id, {
          status,
          reservationReason: status === "Blocked" ? leadDiaryNote : "",
          reservationLeadId: status === "Blocked" ? leadId : "",
          saleDetails: status === "Sold" ? saleDetails : null,
        });
        if (leadId && leadDiaryNote && status !== "Blocked") {
          await addLeadDiaryEntry(leadId, {
            note: `Inventory ${status.toLowerCase()} update: ${updated?.title || asset.title || "Inventory Unit"}\n${leadDiaryNote}`,
          }).catch(() => null);
        }
        setAsset(updated);
        const latestTimeline = await getInventoryAssetActivity(asset._id, { limit: 60 }).catch(() => []);
        setActivities(Array.isArray(latestTimeline) ? latestTimeline : []);
        setSuccess("Status updated");
      } else {
        await requestInventoryStatusChange(asset._id, status, {
          leadId: status === "Blocked" || status === "Available"
            ? leadId
            : status === "Sold"
              ? String((saleDetails as any)?.leadId || "")
              : "",
          requestNote: leadDiaryNote,
          saleDetails: status === "Sold" ? saleDetails : null,
        });
        setSuccess("Status change request sent for admin approval");
      }
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update status"));
    } finally {
      setSaving(false);
    }
  };

  const closeReasonModal = () => {
    setReasonModalOpen(false);
    setPendingStatus(null);
    setLeadDiaryDraft("");
    setBlockedLeadIdDraft("");
    setBlockedLeadDropdownOpen(false);
    setSoldForm({
      leadId: "",
      paymentMode: "CASH",
      totalAmount: "",
      partialAmount: "",
      remainingAmount: "",
      remainingDueDate: "",
      paymentDate: "",
      chequeNumber: "",
      chequeBankName: "",
      chequeDate: "",
      bankTransferType: "NEFT",
      bankTransferUtrNumber: "",
      upiTransactionId: "",
      paymentReference: "",
      note: "",
    });
    setStatusAttachment(null);
    setSoldDateField(null);
    setWebDatePickerField(null);
    setWebDatePickerValue("");
  };

  const openSoldDatePicker = (field: SoldDateField) => {
    if (Platform.OS === "web") {
      const initialDate = parseDateOnly((soldForm as any)[field]) || new Date();
      const webValue = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")}`;
      setWebDatePickerValue(webValue);
      setWebDatePickerField(field);
      return;
    }
    setSoldDateField(field);
  };

  const onNativeSoldDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === "dismissed") {
      setSoldDateField(null);
      return;
    }
    const field = soldDateField;
    if (field && picked) {
      setSoldForm((prev) => ({ ...prev, [field]: formatDateOnly(picked) }));
    }
    setSoldDateField(null);
  };

  const pickStatusAttachment = async () => {
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
      setStatusAttachment({
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

  const updateStatus = async (status: string, reasonHint = "") => {
    if (!asset || (!canManage && !canRequestStatusChange)) return;

    if (String(asset.status || "") === status) return;
    if (STATUS_MODAL_OPTIONS.has(status)) {
      setPendingStatus(status);
      const trimmedReasonHint = String(reasonHint || "").trim();
      setLeadDiaryDraft(trimmedReasonHint || (status === "Blocked" ? String(asset.reservationReason || "").trim() : ""));
      setBlockedLeadIdDraft(toObjectIdString(asset.reservationLeadId || asset.reservationLead));
      setBlockedLeadDropdownOpen(false);
      setStatusAttachment(null);
      const existingSale: any = asset.saleDetails || {};
      setSoldForm({
        leadId: toObjectIdString(existingSale?.leadId),
        paymentMode: String(existingSale?.paymentMode || "CASH").toUpperCase(),
        totalAmount: existingSale?.totalAmount ? String(existingSale.totalAmount) : String(asset.price || ""),
        partialAmount: "0",
        remainingAmount: existingSale?.remainingAmount !== undefined && existingSale?.remainingAmount !== null
          ? String(existingSale.remainingAmount)
          : "",
        remainingDueDate: "",
        paymentDate: "",
        chequeNumber: existingSale?.paymentMode === "CHECK" ? String(existingSale?.paymentReference || "") : "",
        chequeBankName: "",
        chequeDate: "",
        bankTransferType: "NEFT",
        bankTransferUtrNumber: existingSale?.paymentMode === "NET_BANKING_NEFTRTGSIMPS" ? String(existingSale?.paymentReference || "") : "",
        upiTransactionId: existingSale?.paymentMode === "UPI" ? String(existingSale?.paymentReference || "") : "",
        paymentReference: String(existingSale?.paymentReference || ""),
        note: trimmedReasonHint || String(existingSale?.note || ""),
      });
      setReasonModalOpen(true);
      return;
    }

    await applyStatusUpdate(status, { leadDiaryNote: String(reasonHint || "").trim() });
  };

  const submitPendingStatus = async () => {
    const status = pendingStatus;
    if (!status) return;

    if (status === "Sold") {
      const leadId = soldForm.leadId.trim();
      const paymentMode = String(soldForm.paymentMode || "").toUpperCase();
      const totalAmount = Number(soldForm.totalAmount);
      const partialAmount = Number(soldForm.partialAmount);
      if (!leadId) {
        setError("Please select lead for sold inventory");
        return;
      }
      if (!SOLD_PAYMENT_MODES.includes(paymentMode)) {
        setError("Please select valid payment mode");
        return;
      }
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        setError("Total amount must be greater than 0");
        return;
      }
      if (!Number.isFinite(partialAmount) || partialAmount < 0 || partialAmount > totalAmount) {
        setError("Partial amount should be between 0 and total amount");
        return;
      }
      const remainingAmountInput = soldForm.remainingAmount.trim();
      const fallbackRemaining = Number((totalAmount - partialAmount).toFixed(2));
      const remainingAmount = remainingAmountInput ? Number(remainingAmountInput) : fallbackRemaining;
      if (!Number.isFinite(remainingAmount) || remainingAmount < 0) {
        setError("Remaining amount should be a valid non-negative number");
        return;
      }
      const paymentType = remainingAmount > 0 ? "PARTIAL" : "FULL";
      const remainingDueDate = soldForm.remainingDueDate.trim();
      if (remainingAmount > 0 && !remainingDueDate) {
        setError("Remaining amount due date is required");
        return;
      }

      const paymentDate = soldForm.paymentDate.trim();
      const chequeDate = soldForm.chequeDate.trim();
      const chequeNumber = soldForm.chequeNumber.trim();
      const chequeBankName = soldForm.chequeBankName.trim();
      const upiTransactionId = soldForm.upiTransactionId.trim();
      const bankTransferType = soldForm.bankTransferType.trim();
      const bankTransferUtrNumber = soldForm.bankTransferUtrNumber.trim();

      let paymentReference = "";
      if (paymentMode === "CASH") {
        if (!paymentDate) {
          setError("Payment date is required for cash");
          return;
        }
      } else if (paymentMode === "UPI") {
        if (!upiTransactionId || !paymentDate) {
          setError("Please fill transaction id and payment date for UPI");
          return;
        }
        paymentReference = upiTransactionId;
      } else if (paymentMode === "CHECK") {
        if (!chequeBankName || !chequeNumber || !chequeDate) {
          setError("Please fill all required cheque details");
          return;
        }
        paymentReference = chequeNumber;
      } else if (paymentMode === "NET_BANKING_NEFTRTGSIMPS") {
        if (!bankTransferType || !bankTransferUtrNumber || !paymentDate) {
          setError("Please fill transfer type, UTR number and payment date");
          return;
        }
        paymentReference = bankTransferUtrNumber;
      }

      let attachmentUrl = "";
      if (statusAttachment) {
        try {
          setSaving(true);
          const uploaded = await uploadChatFile({
            uri: statusAttachment.uri,
            name: statusAttachment.name,
            mimeType: statusAttachment.mimeType || "application/octet-stream",
            file: statusAttachment.file,
          });
          if (!uploaded?.fileUrl) {
            throw new Error("Attachment upload failed");
          }
          attachmentUrl = String(uploaded.fileUrl || "").trim();
        } catch (e) {
          setError(toErrorMessage(e, "Failed to upload attachment"));
          setSaving(false);
          return;
        }
      }

      const extraNote = [
        soldForm.note.trim(),
        remainingAmount > 0 ? `Remaining due: ${remainingDueDate}` : "",
        paymentDate ? `Payment date: ${paymentDate}` : "",
        paymentMode === "CHECK" && chequeBankName ? `Cheque bank: ${chequeBankName}` : "",
        paymentMode === "CHECK" && chequeDate ? `Cheque date: ${chequeDate}` : "",
        paymentMode === "NET_BANKING_NEFTRTGSIMPS" && bankTransferType ? `Bank transfer type: ${bankTransferType}` : "",
        attachmentUrl ? `Attachment: ${attachmentUrl}` : "",
      ].filter(Boolean).join("\n");

      const saleDetails = {
        leadId,
        paymentMode,
        paymentType,
        totalAmount,
        remainingAmount,
        paymentReference: paymentMode === "CASH" ? "" : paymentReference,
        note: extraNote,
        soldAt: new Date().toISOString(),
      };
      closeReasonModal();
      await applyStatusUpdate(status, {
        leadDiaryNote: extraNote,
        leadId,
        saleDetails,
      });
      return;
    }

    const trimmedLeadId = blockedLeadIdDraft.trim();
    const trimmedNote = leadDiaryDraft.trim();
    if (status === "Blocked" || status === "Available") {
      if (!trimmedLeadId) {
        setError(`Please select lead for this ${status.toLowerCase()} inventory`);
        return;
      }
      if (!trimmedNote) {
        setError(`Lead diary note is required when status is ${status}`);
        return;
      }
    } else if (!trimmedNote && !canManage) {
      setError("Please add a note for this status request");
      return;
    }

    closeReasonModal();
    await applyStatusUpdate(status, {
      leadDiaryNote: trimmedNote,
      leadId: status === "Blocked" || status === "Available" ? trimmedLeadId : "",
      saleDetails: null,
    });
  };

  const openFile = async (url?: string) => {
    const resolved = resolveFileUrl(url);
    if (!resolved) return;
    try {
      await Linking.openURL(resolved);
    } catch {
      setError("Failed to open file");
    }
  };

  const handleShareAsset = async () => {
    if (!asset) return;
    try {
      await Share.share({
        message: `Inventory: ${asset.title}\nLocation: ${asset.location || "-"}\nType: ${asset.type || "-"}\nPrice: Rs ${Number(asset.price || 0).toLocaleString("en-IN")}`,
      });
    } catch (e) {
      setError(toErrorMessage(e, "Failed to share asset"));
    }
  };

  const handleEditAsset = () => {
    if (!asset || !canEditAsset) return;
    navigation.navigate("MainTabs", {
      screen: "Inventory",
      params: {
        editAssetId: asset._id,
        editAsset: asset,
        editAt: Date.now(),
      },
    });
  };

  const handleDeleteAsset = async () => {
    if (!asset || !isAdmin) return;
    const proceed = async () => {
      try {
        await deleteInventoryAsset(asset._id);
        setSuccess("Asset deleted");
        navigation.goBack();
      } catch (e) {
        setError(toErrorMessage(e, "Failed to delete asset"));
      }
    };

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined"
        ? window.confirm("Delete this asset from inventory?")
        : true;
      if (confirmed) {
        await proceed();
      }
      return;
    }

    Alert.alert("Confirm Delete", "Delete this asset from inventory?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "OK",
        style: "destructive",
        onPress: () => {
          void proceed();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0f172a" size="large" />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Asset not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{asset.title}</Text>
          <View style={styles.detailActions}>
            {canEditAsset ? (
              <Pressable style={styles.detailIconBtn} onPress={handleEditAsset}>
                <Ionicons name="create-outline" size={15} color="#64748b" />
              </Pressable>
            ) : null}
            <Pressable style={styles.detailIconBtn} onPress={() => void handleShareAsset()}>
              <Ionicons name="share-social-outline" size={15} color="#0891b2" />
            </Pressable>
            {isAdmin ? (
              <Pressable style={[styles.detailIconBtn, styles.detailIconDanger]} onPress={() => void handleDeleteAsset()}>
                <Ionicons name="trash-outline" size={15} color="#ef4444" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Text style={styles.meta}>Location: {asset.location || "-"}</Text>
        <Text style={styles.meta}>Category: {asset.category || "-"}</Text>
        <Text style={styles.meta}>Type: {asset.type || "-"}</Text>
        <Text style={styles.meta}>Status: {asset.status || "-"}</Text>
        {(asset.status === "Blocked" || asset.status === "Reserved") && asset.reservationReason ? (
          <Text style={styles.reasonMeta}>Reserved reason: {asset.reservationReason}</Text>
        ) : null}
        {(asset.status === "Blocked" || asset.status === "Reserved") && asset.reservationLead?.name ? (
          <Text style={styles.meta}>
            Blocked For Lead: {asset.reservationLead.name}{asset.reservationLead.phone ? ` (${asset.reservationLead.phone})` : ""}
          </Text>
        ) : null}
        <Text style={styles.meta}>Price: Rs {Number(asset.price || 0).toLocaleString("en-IN")}</Text>
        <Text style={styles.meta}>Description: {asset.description || "-"}</Text>

        {!!asset.amenities?.length ? (
          <>
            <Text style={styles.sectionInline}>Amenities</Text>
            <View style={styles.amenityWrap}>
              {asset.amenities.map((amenity) => (
                <View key={amenity} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!!(asset.images?.length || 4) ? (
          <>
            <Text style={styles.sectionInline}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {galleryImages.map((photo, index) => (
                <Pressable
                  key={`photo-${index}`}
                  onPress={() => {
                    setViewerIndex(index);
                    setViewerOpen(true);
                  }}
                >
                  <Image source={{ uri: resolveFileUrl(photo) }} style={styles.photoThumb as any} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {!!asset.documents?.length ? (
          <>
            <Text style={styles.sectionInline}>Documents</Text>
            {asset.documents.map((doc, index) => (
              <Pressable key={`doc-${index}`} style={styles.docLink} onPress={() => openFile(doc)}>
                <Text style={styles.docLinkText}>Open File {index + 1}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </View>

      {canManage || canRequestStatusChange ? (
        <View style={styles.card}>
          <Text style={styles.section}>Update Status</Text>
          <View style={styles.rowWrap}>
            {STATUS_OPTIONS.map((status) => (
              <Pressable
                key={status}
                style={[styles.chip, asset.status === status && styles.chipActive]}
                onPress={() => updateStatus(status)}
                disabled={saving}
              >
                <Text style={[styles.chipText, asset.status === status && styles.chipTextActive]}>{status}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.section}>Activity Timeline</Text>
      <FlatList
        data={visibleActivities}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.timelineListContent}
        ListEmptyComponent={<Text style={styles.meta}>No activity yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.activityCard}>
            <Text style={styles.actionText}>{formatActionLabel(item)}</Text>
            <Text style={styles.meta}>
              {formatDateTime((item as any).timestamp || item.createdAt)}{" "}
              {(item as any).changedBy?.name || item.performedBy?.name
                ? `| ${(item as any).changedBy?.name || item.performedBy?.name}`
                : ""}
            </Text>
          </View>
        )}
      />
      {activities.length > 5 ? (
        <Pressable style={styles.timelineToggleBtn} onPress={() => setShowAllActivities((prev) => !prev)}>
          <Text style={styles.timelineToggleText}>{showAllActivities ? "Show Less" : "Show More"}</Text>
        </Pressable>
      ) : null}

      <Modal visible={reasonModalOpen} animationType="fade" transparent onRequestClose={closeReasonModal}>
        <View style={styles.viewerOverlay}>
          <View style={styles.reasonModalCard}>
            <ScrollView contentContainerStyle={styles.reasonModalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>
              {pendingStatus === "Sold" ? "Sold Approval" : pendingStatus === "Available" ? "Available Approval" : "Lead Diary"}
            </Text>
            <Text style={styles.meta}>
              {pendingStatus === "Sold"
                ? "Select lead and enter sale details."
                : pendingStatus === "Available"
                  ? "Add note for marking this inventory available."
                  : "Select lead and add diary note for blocked inventory."}
            </Text>
            {pendingStatus === "Sold" ? (
              <>
                <Pressable style={styles.selectInput} onPress={() => setBlockedLeadDropdownOpen((prev) => !prev)}>
                  <Text style={styles.selectInputText}>
                    {(() => {
                      const selected = leadOptions.find((row) => row._id === soldForm.leadId);
                      if (!selected) return "Select lead";
                      return selected.phone ? `${selected.name} (${selected.phone})` : selected.name;
                    })()}
                  </Text>
                </Pressable>
                {blockedLeadDropdownOpen ? (
                  <View style={styles.selectMenu}>
                    <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                      {leadOptions.length === 0 ? (
                        <Text style={styles.meta}>No leads available</Text>
                      ) : (
                        leadOptions.map((lead) => (
                          <Pressable
                            key={lead._id}
                            style={styles.selectMenuItem}
                            onPress={() => {
                              setSoldForm((prev) => ({ ...prev, leadId: lead._id }));
                              setBlockedLeadDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.selectMenuItemText}>
                              {lead.phone ? `${lead.name} (${lead.phone})` : lead.name}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </ScrollView>
                  </View>
                ) : null}
                <Text style={styles.sectionInline}>Payment Mode</Text>
                <View style={styles.rowWrap}>
                  {SOLD_PAYMENT_MODES.map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.chip, soldForm.paymentMode === mode && styles.chipActive]}
                      onPress={() => setSoldForm((prev) => ({ ...prev, paymentMode: mode }))}
                    >
                      <Text style={[styles.chipText, soldForm.paymentMode === mode && styles.chipTextActive]}>{SOLD_PAYMENT_MODE_LABEL[mode] || mode}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.selectInput}
                  placeholder="Total Amount"
                  keyboardType="number-pad"
                  value={soldForm.totalAmount}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, totalAmount: value }))}
                />
                <TextInput
                  style={styles.selectInput}
                  placeholder="Partial Amount"
                  keyboardType="number-pad"
                  value={soldForm.partialAmount}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, partialAmount: value }))}
                />
                <TextInput
                  style={styles.selectInput}
                  placeholder="Remaining Amount"
                  keyboardType="number-pad"
                  value={soldForm.remainingAmount}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, remainingAmount: value }))}
                />
                <TextInput
                  style={styles.selectInput}
                  placeholder="Remaining amount due date (DD-MM-YYYY)"
                  value={soldForm.remainingDueDate}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, remainingDueDate: value }))}
                />
                <View style={styles.dateFieldActionRow}>
                  <Pressable style={styles.dateFieldBtn} onPress={() => openSoldDatePicker("remainingDueDate")}>
                    <Ionicons name="calendar-outline" size={14} color="#334155" />
                    <Text style={styles.dateFieldBtnText}>Pick due date</Text>
                  </Pressable>
                </View>
                {soldForm.paymentMode === "CASH" ? (
                  <>
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Payment date (DD-MM-YYYY)"
                      value={soldForm.paymentDate}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, paymentDate: value }))}
                    />
                    <View style={styles.dateFieldActionRow}>
                      <Pressable style={styles.dateFieldBtn} onPress={() => openSoldDatePicker("paymentDate")}>
                        <Ionicons name="calendar-outline" size={14} color="#334155" />
                        <Text style={styles.dateFieldBtnText}>Pick payment date</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
                {soldForm.paymentMode === "UPI" ? (
                  <>
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Transaction id"
                      value={soldForm.upiTransactionId}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, upiTransactionId: value }))}
                    />
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Payment date (DD-MM-YYYY)"
                      value={soldForm.paymentDate}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, paymentDate: value }))}
                    />
                    <View style={styles.dateFieldActionRow}>
                      <Pressable style={styles.dateFieldBtn} onPress={() => openSoldDatePicker("paymentDate")}>
                        <Ionicons name="calendar-outline" size={14} color="#334155" />
                        <Text style={styles.dateFieldBtnText}>Pick payment date</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
                {soldForm.paymentMode === "CHECK" ? (
                  <>
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Cheque date (DD-MM-YYYY)"
                      value={soldForm.chequeDate}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeDate: value }))}
                    />
                    <View style={styles.dateFieldActionRow}>
                      <Pressable style={styles.dateFieldBtn} onPress={() => openSoldDatePicker("chequeDate")}>
                        <Ionicons name="calendar-outline" size={14} color="#334155" />
                        <Text style={styles.dateFieldBtnText}>Pick cheque date</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Cheque number"
                      value={soldForm.chequeNumber}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeNumber: value }))}
                    />
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Cheque bank name"
                      value={soldForm.chequeBankName}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeBankName: value }))}
                    />
                  </>
                ) : null}
                {soldForm.paymentMode === "NET_BANKING_NEFTRTGSIMPS" ? (
                  <>
                    <Text style={styles.sectionInline}>Transfer Type</Text>
                    <View style={styles.rowWrap}>
                      {SOLD_TRANSFER_TYPES.map((type) => (
                        <Pressable
                          key={type}
                          style={[styles.chip, soldForm.bankTransferType === type && styles.chipActive]}
                          onPress={() => setSoldForm((prev) => ({ ...prev, bankTransferType: type }))}
                        >
                          <Text style={[styles.chipText, soldForm.bankTransferType === type && styles.chipTextActive]}>{type}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Bank transfer UTR number"
                      value={soldForm.bankTransferUtrNumber}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, bankTransferUtrNumber: value }))}
                    />
                    <TextInput
                      style={styles.selectInput}
                      placeholder="Payment date (DD-MM-YYYY)"
                      value={soldForm.paymentDate}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, paymentDate: value }))}
                    />
                    <View style={styles.dateFieldActionRow}>
                      <Pressable style={styles.dateFieldBtn} onPress={() => openSoldDatePicker("paymentDate")}>
                        <Ionicons name="calendar-outline" size={14} color="#334155" />
                        <Text style={styles.dateFieldBtnText}>Pick payment date</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
                <TextInput
                  style={[styles.reasonInput]}
                  placeholder="Note for admin"
                  value={soldForm.note}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, note: value }))}
                  multiline
                />
                <View style={styles.statusAttachmentRow}>
                  <Pressable
                    style={styles.statusAttachBtn}
                    onPress={pickStatusAttachment}
                    disabled={saving || pickingStatusAttachment}
                  >
                    <Text style={styles.statusAttachBtnText}>
                      {pickingStatusAttachment ? "Attaching..." : "+ Attach file"}
                    </Text>
                  </Pressable>
                  {statusAttachment ? (
                    <Pressable
                      style={styles.statusAttachRemoveBtn}
                      onPress={() => setStatusAttachment(null)}
                      disabled={saving}
                    >
                      <Ionicons name="close" size={16} color="#991b1b" />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.uploadStatusText}>{statusAttachment?.name || "No file attached"}</Text>
              </>
            ) : pendingStatus === "Blocked" || pendingStatus === "Available" ? (
              <>
                <Pressable style={styles.selectInput} onPress={() => setBlockedLeadDropdownOpen((prev) => !prev)}>
                  <Text style={styles.selectInputText}>{selectedBlockedLeadLabel}</Text>
                </Pressable>
                {blockedLeadDropdownOpen ? (
                  <View style={styles.selectMenu}>
                    <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                      {leadOptions.length === 0 ? (
                        <Text style={styles.meta}>No leads available</Text>
                      ) : (
                        leadOptions.map((lead) => (
                          <Pressable
                            key={lead._id}
                            style={styles.selectMenuItem}
                            onPress={() => {
                              setBlockedLeadIdDraft(lead._id);
                              setBlockedLeadDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.selectMenuItemText}>
                              {lead.phone ? `${lead.name} (${lead.phone})` : lead.name}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </ScrollView>
                  </View>
                ) : null}
                <TextInput
                  style={[styles.reasonInput]}
                  placeholder={pendingStatus === "Available" ? "Write lead diary note for available request" : "Write lead diary note"}
                  value={leadDiaryDraft}
                  onChangeText={setLeadDiaryDraft}
                  multiline
                />
              </>
            ) : (
              <TextInput
                style={[styles.reasonInput]}
                placeholder="Write request note"
                value={leadDiaryDraft}
                onChangeText={setLeadDiaryDraft}
                multiline
              />
            )}
            <View style={styles.modalActionRow}>
              <Pressable style={[styles.modalActionBtn, styles.modalActionGhost]} onPress={closeReasonModal}>
                <Text style={styles.modalActionGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalActionBtn, styles.modalActionPrimary]} onPress={submitPendingStatus}>
                <Text style={styles.modalActionPrimaryText}>
                  {pendingStatus === "Sold"
                    ? (canManage ? "Save Closed Details" : "Send for Approval")
                    : (canManage ? "Submit" : "Send for Approval")}
                </Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerOpen(false)}>
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>
          {galleryImages.length ? (
            <View style={[styles.viewerFrame, { width: viewerWidth }]}>
              <FlatList
                ref={viewerListRef}
                style={styles.viewerList}
                data={galleryImages}
                keyExtractor={(item, index) => `${item}-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({
                  length: viewerWidth,
                  offset: viewerWidth * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const offsetX = Number(event.nativeEvent.contentOffset.x || 0);
                  const nextIndex = Math.round(offsetX / viewerWidth);
                  setViewerIndex(Math.max(0, Math.min(nextIndex, galleryImages.length - 1)));
                }}
                onScrollToIndexFailed={(info) => {
                  const fallback = Math.max(0, Math.min(info.index, galleryImages.length - 1));
                  setTimeout(() => {
                    viewerListRef.current?.scrollToIndex({ index: fallback, animated: false });
                  }, 40);
                }}
                renderItem={({ item }) => (
                  <View style={[styles.viewerSlide, { width: viewerWidth }]}>
                    <Image source={{ uri: resolveFileUrl(item) }} style={styles.viewerImage as any} resizeMode="contain" />
                  </View>
                )}
              />
            </View>
          ) : null}
          {galleryImages.length > 1 ? (
            <Text style={styles.viewerCounter}>{viewerIndex + 1} / {galleryImages.length}</Text>
          ) : null}
        </View>
      </Modal>

      {soldDateField ? (
        <DateTimePicker
          value={parseDateOnly((soldForm as any)[soldDateField]) || new Date()}
          mode="date"
          onChange={onNativeSoldDateChange}
        />
      ) : null}
      <Modal visible={Boolean(webDatePickerField)} transparent animationType="fade" onRequestClose={() => setWebDatePickerField(null)}>
        <View style={styles.webDateModalOverlay}>
          <View style={styles.webDateModalCard}>
            <Text style={styles.section}>Pick Date</Text>
            <input
              ref={webDateInputRef}
              type="date"
              value={webDatePickerValue}
              onChange={(event: any) => {
                const value = String(event?.target?.value || "");
                setWebDatePickerValue(value);
                const date = value ? new Date(`${value}T00:00:00`) : null;
                if (date && !Number.isNaN(date.getTime()) && webDatePickerField) {
                  setSoldForm((prev) => ({ ...prev, [webDatePickerField]: formatDateOnly(date) }));
                }
                setWebDatePickerField(null);
              }}
              onBlur={() => setWebDatePickerField(null)}
              style={styles.webDateInput as any}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { flex: 1, fontSize: 18, fontWeight: "700", color: "#0f172a" },
  detailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  detailIconDanger: {
    borderColor: "#fecaca",
  },
  section: { marginBottom: 8, color: "#334155", fontWeight: "700" },
  meta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  reasonMeta: { marginTop: 5, fontSize: 12, color: "#b45309", fontWeight: "600" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionInline: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  amenityWrap: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amenityChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  amenityText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
  },
  photoRow: {
    marginTop: 6,
    gap: 8,
  },
  photoThumb: {
    width: 120,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  docLink: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
  },
  docLinkText: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  chipText: { color: "#334155", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  activityCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  reasonModalCard: {
    width: "100%",
    maxHeight: "88%",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
  },
  reasonModalContent: {
    paddingBottom: 8,
  },
  reasonInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 92,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  selectInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#fff",
    marginTop: 10,
  },
  selectInputText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  dateFieldActionRow: {
    marginTop: 4,
    marginBottom: 10,
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
    justifyContent: "center",
    gap: 6,
  },
  dateFieldBtnText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
  },
  selectMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    maxHeight: 180,
    overflow: "hidden",
  },
  selectMenuScroll: {
    maxHeight: 180,
  },
  selectMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  selectMenuItemText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
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
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    flexWrap: "nowrap",
  },
  modalActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalActionGhost: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  modalActionPrimary: {
    borderWidth: 1,
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  modalActionGhostText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  modalActionPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  timelineToggleBtn: {
    marginTop: 6,
    marginBottom: 8,
    alignSelf: "flex-end",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  timelineToggleText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  timelineListContent: {
    paddingBottom: 92,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  viewerClose: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 2,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewerCloseText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  viewerImage: {
    width: "100%",
    height: "82%",
  },
  viewerFrame: {
    height: "82%",
    minHeight: 280,
    maxHeight: 620,
  },
  viewerList: {
    flex: 1,
  },
  viewerSlide: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 24,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  webDateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  webDateModalCard: {
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
  },
  webDateInput: {
    marginTop: 10,
    width: "100%",
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fff",
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
