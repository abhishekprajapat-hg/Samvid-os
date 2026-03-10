import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Screen } from "../../components/common/Screen";
import {
  createInventoryAsset,
  deleteInventoryAsset,
  getInventoryAssets,
  requestInventoryStatusChange,
  updateInventoryAsset,
} from "../../services/inventoryService";
import { addLeadDiaryEntry, getAllLeads } from "../../services/leadService";
import { uploadChatFile } from "../../services/chatService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAuth } from "../../context/AuthContext";
import type { InventoryAsset } from "../../types";

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
const AMENITY_OPTIONS = [
  "Parking",
  "Lift",
  "Security",
  "Power Backup",
  "Club House",
  "Gym",
  "Swimming Pool",
  "Garden",
  "CCTV",
  "Visitor Parking",
];

type UploadInput = {
  uri: string;
  name: string;
  mimeType?: string;
};

const EMPTY_FORM = {
  title: "",
  location: "",
  category: "Apartment",
  type: "Sale",
  status: "Available",
  reservationReason: "",
  price: "",
  description: "",
  customAmenities: "",
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

const buildDefaultImageSet = (seed: string) => {
  const safeSeed = encodeURIComponent(seed || "asset");
  return Array.from({ length: 4 }, (_, index) => `https://picsum.photos/seed/${safeSeed}-${index + 1}/900/600`);
};

const toObjectIdString = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id?: string })._id || "").trim();
  }
  return "";
};

const pickUriString = (value: unknown) => String(value || "").trim();

export const AssetVaultScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { role } = useAuth();
  const canManage = role === "ADMIN";
  const canRequestStatusChange = ["FIELD_EXECUTIVE", "EXECUTIVE", "TEAM_LEADER", "ASSISTANT_MANAGER", "MANAGER"].includes(String(role || ""));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [leadOptions, setLeadOptions] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [leadDiaryDraft, setLeadDiaryDraft] = useState("");
  const [blockedLeadIdDraft, setBlockedLeadIdDraft] = useState("");
  const [blockedLeadDropdownOpen, setBlockedLeadDropdownOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    assetId: string;
    status: string;
  } | null>(null);
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
  const [cardImageIndexMap, setCardImageIndexMap] = useState<Record<string, number>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [pickedImages, setPickedImages] = useState<UploadInput[]>([]);
  const [pickedFiles, setPickedFiles] = useState<UploadInput[]>([]);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const [list, leads] = await Promise.all([
        getInventoryAssets(),
        getAllLeads().catch(() => []),
      ]);
      setAssets(Array.isArray(list) ? list : []);
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
      setError(toErrorMessage(e, "Failed to load inventory"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1600);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    const initialSearch = String(route.params?.initialSearch || "").trim();
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [route.params]);

  const filtered = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return assets;
    return assets.filter((asset) =>
      [asset.title, asset.location, asset.category, asset.status, ...(asset.amenities || [])].some((v) =>
        String(v || "").toLowerCase().includes(key),
      ),
    );
  }, [assets, search]);
  const selectedBlockedLeadLabel = useMemo(() => {
    const selected = leadOptions.find((row) => row._id === blockedLeadIdDraft);
    if (!selected) return "Select lead";
    return selected.phone ? `${selected.name} (${selected.phone})` : selected.name;
  }, [blockedLeadIdDraft, leadOptions]);

  useEffect(() => {
    if (!filtered.length) return undefined;
    const timer = setInterval(() => {
      setCardImageIndexMap((prev) => {
        const next: Record<string, number> = { ...prev };
        filtered.forEach((item) => {
          const displayImages = item.images?.length ? item.images : buildDefaultImageSet(item.title || item._id);
          if (displayImages.length <= 1) {
            next[item._id] = 0;
            return;
          }
          const current = next[item._id] || 0;
          next[item._id] = (current + 1) % displayImages.length;
        });
        return next;
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [filtered]);

  const pickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Media permission is required to upload photos");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 10,
      });

      if (result.canceled) return;

      const rows = (result.assets || []).map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}-${index + 1}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      }));

      setPickedImages((prev) => [...prev, ...rows]);
    } catch {
      setError("Failed to pick photos");
    }
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (result.canceled) return;

      const rows = (result.assets || []).map((asset, index) => ({
        uri: asset.uri,
        name: asset.name || `file-${Date.now()}-${index + 1}`,
        mimeType: asset.mimeType || "application/octet-stream",
      }));

      setPickedFiles((prev) => [...prev, ...rows]);
    } catch {
      setError("Failed to pick files");
    }
  };

  const removePickedImage = (name: string) => {
    setPickedImages((prev) => prev.filter((row) => row.name !== name));
  };

  const removePickedFile = (name: string) => {
    setPickedFiles((prev) => prev.filter((row) => row.name !== name));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity],
    );
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedAmenities([]);
    setPickedImages([]);
    setPickedFiles([]);
  };

  const resetPendingStatusChange = () => {
    setPendingStatusChange(null);
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
    setReasonModalOpen(false);
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

  const createAsset = async () => {
    const title = form.title.trim();
    const location = form.location.trim();
    const price = Number(form.price);
    const reservationReason = String(form.reservationReason || "").trim();

    if (!title || !location || !Number.isFinite(price) || price <= 0) {
      setError("Title, location and valid price are required");
      return;
    }

    if (form.status === "Blocked" && !reservationReason) {
      setError("Reservation reason is required when status is Reserved");
      return;
    }

    try {
      setSaving(true);

      const [uploadedImages, uploadedFiles] = await Promise.all([
        Promise.all(pickedImages.map((row) => uploadChatFile(row))),
        Promise.all(pickedFiles.map((row) => uploadChatFile(row))),
      ]);

      const imageUrls = uploadedImages
        .map((row) => resolveFileUrl(row?.fileUrl))
        .filter(Boolean);

      const documentUrls = uploadedFiles
        .map((row) => resolveFileUrl(row?.fileUrl))
        .filter(Boolean);

      const customAmenities = form.customAmenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const amenities = [...new Set([...selectedAmenities, ...customAmenities])];

      const fallbackImages = imageUrls.length > 0 ? imageUrls : buildDefaultImageSet(`${title}-${location}`);

      const created = await createInventoryAsset({
        ...form,
        title,
        location,
        price,
        reservationReason: form.status === "Blocked" ? reservationReason : "",
        description: form.description.trim(),
        images: fallbackImages,
        documents: documentUrls,
        amenities,
      });

      setAssets((prev) => [created, ...prev]);
      setFormOpen(false);
      resetForm();
      setSuccess("Asset created");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to create asset"));
    } finally {
      setSaving(false);
    }
  };

  const applyStatusChange = async (
    assetId: string,
    status: string,
    options: { leadDiaryNote?: string; leadId?: string; saleDetails?: Record<string, unknown> | null } = {},
  ) => {
    const leadDiaryNote = String(options.leadDiaryNote || "");
    const leadId = String(options.leadId || "");
    const saleDetails = options.saleDetails && typeof options.saleDetails === "object" ? options.saleDetails : null;
    try {
      if (canManage) {
        const updated = await updateInventoryAsset(assetId, {
          status,
          reservationReason: status === "Blocked" ? leadDiaryNote : "",
          reservationLeadId: status === "Blocked" ? leadId : "",
          saleDetails: status === "Sold" ? saleDetails : null,
        });
        if (leadId && leadDiaryNote && status !== "Blocked") {
          await addLeadDiaryEntry(leadId, {
            note: `Inventory ${status.toLowerCase()} update: ${updated?.title || "Inventory Unit"}\n${leadDiaryNote}`,
          }).catch(() => null);
        }
        setAssets((prev) => prev.map((asset) => (asset._id === updated._id ? updated : asset)));
        setSuccess("Status updated");
      } else if (canRequestStatusChange) {
        await requestInventoryStatusChange(
          assetId,
          status,
          {
            leadId: status === "Blocked" || status === "Available"
              ? leadId
              : status === "Sold"
                ? String((saleDetails as any)?.leadId || "")
                : "",
            requestNote: leadDiaryNote,
            saleDetails: status === "Sold" ? saleDetails : null,
          },
        );
        setSuccess("Status change request sent for admin approval");
      }
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update status"));
    }
  };

  const updateStatus = async (assetId: string, status: string, reasonHint = "") => {
    if (!assetId || !status) return;
    const targetAsset = assets.find((row) => row._id === assetId);
    if (!targetAsset || String(targetAsset.status || "") === status) return;

    if (STATUS_MODAL_OPTIONS.has(status)) {
      setPendingStatusChange({
        assetId,
        status,
      });
      const trimmedReasonHint = String(reasonHint || "").trim();
      setLeadDiaryDraft(trimmedReasonHint || (status === "Blocked" ? String(targetAsset?.reservationReason || "").trim() : ""));
      setBlockedLeadIdDraft(
        toObjectIdString((targetAsset as any)?.reservationLeadId || (targetAsset as any)?.reservationLead),
      );
      setBlockedLeadDropdownOpen(false);
      setStatusAttachment(null);
      const existingSale: any = targetAsset?.saleDetails || {};
      setSoldForm({
        leadId: toObjectIdString(existingSale?.leadId),
        paymentMode: String(existingSale?.paymentMode || "CASH").toUpperCase(),
        totalAmount: existingSale?.totalAmount ? String(existingSale.totalAmount) : String(targetAsset?.price || ""),
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

    await applyStatusChange(assetId, status, { leadDiaryNote: String(reasonHint || "").trim() });
  };

  const submitPendingStatusChange = async () => {
    const queued = pendingStatusChange;
    if (!queued) return;

    if (queued.status === "Sold") {
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
      resetPendingStatusChange();
      await applyStatusChange(queued.assetId, queued.status, {
        leadDiaryNote: extraNote,
        leadId,
        saleDetails,
      });
      return;
    }

    const trimmedNote = leadDiaryDraft.trim();
    const trimmedLeadId = blockedLeadIdDraft.trim();
    if (queued.status === "Blocked" || queued.status === "Available") {
      if (!trimmedLeadId) {
        setError(`Please select lead for this ${queued.status.toLowerCase()} inventory`);
        return;
      }
      if (!trimmedNote) {
        setError(`Lead diary note is required when status is ${queued.status}`);
        return;
      }
    } else if (!trimmedNote && !canManage) {
      setError("Please add a note for this status request");
      return;
    }

    resetPendingStatusChange();
    await applyStatusChange(queued.assetId, queued.status, {
      leadDiaryNote: trimmedNote,
      leadId: queued.status === "Blocked" || queued.status === "Available" ? trimmedLeadId : "",
      saleDetails: null,
    });
  };

  const removeAsset = async (assetId: string) => {
    Alert.alert("Delete asset", "Are you sure you want to delete this asset?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteInventoryAsset(assetId);
            setAssets((prev) => prev.filter((asset) => asset._id !== assetId));
            setSuccess("Asset deleted");
          } catch (e) {
            setError(toErrorMessage(e, "Failed to delete asset"));
          }
        },
      },
    ]);
  };

  return (
    <Screen title="Asset Vault" subtitle="Inventory" loading={loading} error={error}>
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TextInput
        style={styles.search}
        placeholder="Search title, location, status"
        value={search}
        onChangeText={setSearch}
      />

      {canManage ? (
        <Pressable style={styles.primaryBtn} onPress={() => setFormOpen(true)}>
          <Text style={styles.primaryText}>+ Add Asset</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>No assets found</Text>}
        renderItem={({ item }) => {
          const displayImages = item.images?.length ? item.images : buildDefaultImageSet(item.title || item._id);
          const imageIndex = Math.min(cardImageIndexMap[item._id] || 0, Math.max(displayImages.length - 1, 0));
          const cover = resolveFileUrl(displayImages[imageIndex]);
          const remainingPhotos = Math.max(displayImages.length - 1, 0);
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate("InventoryDetails", { assetId: item._id, asset: item })}>
              {cover ? (
                <View style={styles.cardImageWrap}>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      setViewerImages(displayImages);
                      setViewerIndex(imageIndex);
                      setViewerOpen(true);
                    }}
                  >
                    <Image source={{ uri: cover }} style={styles.cardImage} resizeMode="cover" />
                  </Pressable>
                  {displayImages.length > 1 ? (
                    <>
                      <Pressable
                        style={[styles.cardNavBtn, styles.cardNavLeft]}
                        onPress={(event) => {
                          event.stopPropagation();
                          setCardImageIndexMap((prev) => {
                            const current = prev[item._id] || 0;
                            const next = current <= 0 ? displayImages.length - 1 : current - 1;
                            return { ...prev, [item._id]: next };
                          });
                        }}
                      >
                        <Text style={styles.cardNavText}>{"<"}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.cardNavBtn, styles.cardNavRight]}
                        onPress={(event) => {
                          event.stopPropagation();
                          setCardImageIndexMap((prev) => {
                            const current = prev[item._id] || 0;
                            const next = (current + 1) % displayImages.length;
                            return { ...prev, [item._id]: next };
                          });
                        }}
                      >
                        <Text style={styles.cardNavText}>{">"}</Text>
                      </Pressable>
                    </>
                  ) : null}
                  {remainingPhotos > 0 ? (
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountText}>{imageIndex + 1}/{displayImages.length}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.meta}>{item.location || "-"} | {item.category || "-"}</Text>
              <Text style={styles.meta}>Rs {Number(item.price || 0).toLocaleString("en-IN")}</Text>
              <Text style={styles.meta}>Photos: {displayImages.length}</Text>
              {(item.status === "Blocked" || item.status === "Reserved") && item.reservationReason ? (
                <Text style={styles.reasonMeta}>Reserved reason: {item.reservationReason}</Text>
              ) : null}
              {(item.status === "Blocked" || item.status === "Reserved")
              && ((item as any)?.reservationLead?.name || (item as any)?.reservationLeadId?.name) ? (
                <Text style={styles.meta}>
                  Blocked For Lead: {String((item as any)?.reservationLead?.name || (item as any)?.reservationLeadId?.name || "-")}
                  {String((item as any)?.reservationLead?.phone || (item as any)?.reservationLeadId?.phone || "").trim()
                    ? ` (${String((item as any)?.reservationLead?.phone || (item as any)?.reservationLeadId?.phone || "").trim()})`
                    : ""}
                </Text>
              ) : null}

              {!!item.amenities?.length ? (
                <View style={styles.amenityWrap}>
                  {item.amenities.slice(0, 4).map((amenity) => (
                    <View key={`${item._id}-${amenity}`} style={styles.amenityChip}>
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.row}>
                {STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.statusChip, item.status === status && styles.statusActive]}
                    onPress={() => updateStatus(item._id, status)}
                  >
                    <Text style={[styles.chipText, item.status === status && styles.activeText]}>{status}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={styles.openDetailsBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  navigation.navigate("InventoryDetails", { assetId: item._id, asset: item });
                }}
              >
                <Text style={styles.openDetailsText}>Open Details</Text>
              </Pressable>

              {canManage ? (
                <Pressable style={styles.deleteBtn} onPress={() => removeAsset(item._id)}>
                  <Text style={styles.deleteText}>Delete Asset</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Asset</Text>
              <TextInput
                style={styles.input}
                placeholder="Title"
                value={form.title}
                onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={form.location}
                onChangeText={(value) => setForm((prev) => ({ ...prev, location: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Category"
                value={form.category}
                onChangeText={(value) => setForm((prev) => ({ ...prev, category: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Type (Sale/Rent)"
                value={form.type}
                onChangeText={(value) => setForm((prev) => ({ ...prev, type: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Price"
                value={form.price}
                keyboardType="number-pad"
                onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
              />
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Description"
                multiline
                value={form.description}
                onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
              />

              <Text style={styles.sectionLabel}>Amenities</Text>
              <View style={styles.amenityWrap}>
                {AMENITY_OPTIONS.map((amenity) => (
                  <Pressable
                    key={amenity}
                    style={[styles.amenityChip, selectedAmenities.includes(amenity) && styles.amenityChipActive]}
                    onPress={() => toggleAmenity(amenity)}
                  >
                    <Text style={[styles.amenityText, selectedAmenities.includes(amenity) && styles.amenityTextActive]}>{amenity}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Custom amenities (comma separated)"
                value={form.customAmenities}
                onChangeText={(value) => setForm((prev) => ({ ...prev, customAmenities: value }))}
              />

              <Text style={styles.sectionLabel}>Photos</Text>
              <View style={styles.uploadRow}>
                <Pressable style={styles.ghostBtn} onPress={pickImages}>
                  <Text>+ Upload Photos</Text>
                </Pressable>
                <Text style={styles.uploadCount}>{pickedImages.length} selected</Text>
              </View>
              {pickedImages.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                  {pickedImages.map((image) => (
                    <View key={image.name} style={styles.previewPill}>
                      <Text style={styles.previewText} numberOfLines={1}>{image.name}</Text>
                      <Pressable onPress={() => removePickedImage(image.name)}>
                        <Text style={styles.removeText}>X</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              <Text style={styles.sectionLabel}>Files</Text>
              <View style={styles.uploadRow}>
                <Pressable style={styles.ghostBtn} onPress={pickFiles}>
                  <Text>+ Upload Files</Text>
                </Pressable>
                <Text style={styles.uploadCount}>{pickedFiles.length} selected</Text>
              </View>
              {pickedFiles.length > 0 ? (
                <View style={styles.fileList}>
                  {pickedFiles.map((file) => (
                    <View key={file.name} style={styles.fileRow}>
                      <Text style={styles.meta} numberOfLines={1}>{file.name}</Text>
                      <Pressable onPress={() => removePickedFile(file.name)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.modalRow}>
                <Pressable style={[styles.modalActionBtn, styles.modalActionGhost]} onPress={() => { setFormOpen(false); resetForm(); }} disabled={saving}>
                  <Text style={styles.modalActionGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalActionBtn, styles.modalActionPrimary]} onPress={createAsset} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionPrimaryText}>Save</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reasonModalOpen}
        animationType="fade"
        transparent
        onRequestClose={resetPendingStatusChange}
      >
        <View style={styles.modalWrap}>
          <View style={styles.reasonModalCard}>
            <ScrollView contentContainerStyle={styles.reasonModalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>
              {pendingStatusChange?.status === "Sold" ? "Sold Approval" : pendingStatusChange?.status === "Available" ? "Available Approval" : "Lead Diary"}
            </Text>
            <Text style={styles.meta}>
              {pendingStatusChange?.status === "Sold"
                ? "Select lead and enter sale details."
                : pendingStatusChange?.status === "Available"
                  ? "Add note for marking this inventory available."
                  : "Select lead and add diary note for blocked inventory."}
            </Text>

            {pendingStatusChange?.status === "Sold" ? (
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
                <Text style={styles.sectionLabel}>Payment Mode</Text>
                <View style={styles.row}>
                  {SOLD_PAYMENT_MODES.map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.statusChip, soldForm.paymentMode === mode && styles.statusActive]}
                      onPress={() => setSoldForm((prev) => ({ ...prev, paymentMode: mode }))}
                    >
                      <Text style={[styles.chipText, soldForm.paymentMode === mode && styles.activeText]}>{SOLD_PAYMENT_MODE_LABEL[mode] || mode}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Total Amount"
                  keyboardType="number-pad"
                  value={soldForm.totalAmount}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, totalAmount: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Partial Amount"
                  keyboardType="number-pad"
                  value={soldForm.partialAmount}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, partialAmount: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Remaining Amount"
                  keyboardType="number-pad"
                  value={soldForm.remainingAmount}
                  onChangeText={(value) => setSoldForm((prev) => ({ ...prev, remainingAmount: value }))}
                />
                <TextInput
                  style={styles.input}
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
                      style={styles.input}
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
                      style={styles.input}
                      placeholder="Transaction id"
                      value={soldForm.upiTransactionId}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, upiTransactionId: value }))}
                    />
                    <TextInput
                      style={styles.input}
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
                      style={styles.input}
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
                      style={styles.input}
                      placeholder="Cheque number"
                      value={soldForm.chequeNumber}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeNumber: value }))}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Cheque bank name"
                      value={soldForm.chequeBankName}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeBankName: value }))}
                    />
                  </>
                ) : null}
                {soldForm.paymentMode === "NET_BANKING_NEFTRTGSIMPS" ? (
                  <>
                    <Text style={styles.sectionLabel}>Transfer Type</Text>
                    <View style={styles.row}>
                      {SOLD_TRANSFER_TYPES.map((type) => (
                        <Pressable
                          key={type}
                          style={[styles.statusChip, soldForm.bankTransferType === type && styles.statusActive]}
                          onPress={() => setSoldForm((prev) => ({ ...prev, bankTransferType: type }))}
                        >
                          <Text style={[styles.chipText, soldForm.bankTransferType === type && styles.activeText]}>{type}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Bank transfer UTR number"
                      value={soldForm.bankTransferUtrNumber}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, bankTransferUtrNumber: value }))}
                    />
                    <TextInput
                      style={styles.input}
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
                  style={[styles.input, styles.reasonInput]}
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
            ) : pendingStatusChange?.status === "Blocked" || pendingStatusChange?.status === "Available" ? (
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
                  style={[styles.input, styles.reasonInput]}
                  placeholder={pendingStatusChange?.status === "Available" ? "Write lead diary note for available request" : "Write lead diary note"}
                  value={leadDiaryDraft}
                  onChangeText={setLeadDiaryDraft}
                  multiline
                />
              </>
            ) : (
              <TextInput
                style={[styles.input, styles.reasonInput]}
                placeholder="Write request note"
                value={leadDiaryDraft}
                onChangeText={setLeadDiaryDraft}
                multiline
              />
            )}
            <View style={styles.modalRow}>
              <Pressable style={[styles.modalActionBtn, styles.modalActionGhost]} onPress={resetPendingStatusChange}>
                <Text style={styles.modalActionGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalActionBtn, styles.modalActionPrimary]} onPress={submitPendingStatusChange}>
                <Text style={styles.modalActionPrimaryText}>
                  {pendingStatusChange?.status === "Sold"
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
          {viewerImages.length ? (
            <Image source={{ uri: resolveFileUrl(viewerImages[viewerIndex]) }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
          {viewerImages.length > 1 ? (
            <>
              <Pressable
                style={[styles.viewerArrow, styles.viewerArrowLeft]}
                onPress={() => setViewerIndex((prev) => (prev <= 0 ? viewerImages.length - 1 : prev - 1))}
              >
                <Text style={styles.viewerArrowText}>{"<"}</Text>
              </Pressable>
              <Pressable
                style={[styles.viewerArrow, styles.viewerArrowRight]}
                onPress={() => setViewerIndex((prev) => (prev + 1) % viewerImages.length)}
              >
                <Text style={styles.viewerArrowText}>{">"}</Text>
              </Pressable>
              <Text style={styles.viewerCounter}>{viewerIndex + 1} / {viewerImages.length}</Text>
            </>
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
            <Text style={styles.sectionLabel}>Pick Date</Text>
            <input
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

    </Screen>
  );
};

const styles = StyleSheet.create({
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    color: "#166534",
  },
  search: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  primaryBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#e2e8f0",
  },
  cardImageWrap: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  cardNavBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardNavLeft: {
    left: 8,
  },
  cardNavRight: {
    right: 8,
  },
  cardNavText: {
    color: "#fff",
    fontWeight: "700",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "#475569",
  },
  reasonMeta: {
    marginTop: 5,
    fontSize: 12,
    color: "#b45309",
    fontWeight: "600",
  },
  row: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  statusActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  chipText: {
    fontSize: 12,
    color: "#334155",
  },
  activeText: {
    color: "#fff",
  },
  deleteBtn: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
  },
  deleteText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginVertical: 14,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    maxHeight: "92%",
  },
  reasonModalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    maxHeight: "90%",
    padding: 14,
  },
  reasonModalContent: {
    paddingBottom: 8,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  reasonInput: {
    height: 88,
    marginTop: 10,
  },
  openDetailsBtn: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
  },
  openDetailsText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 12,
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
  modalRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    flexWrap: "nowrap",
  },
  modalActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
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
  },
  modalActionPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  section: {
    marginBottom: 8,
    fontWeight: "700",
    color: "#334155",
  },
  sectionLabel: {
    marginBottom: 6,
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  photoCountBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCountText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 11,
  },
  amenityWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  amenityChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  amenityChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  amenityText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
  },
  amenityTextActive: {
    color: "#fff",
  },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  uploadCount: {
    fontSize: 12,
    color: "#64748b",
  },
  previewRow: {
    gap: 8,
    paddingBottom: 4,
  },
  previewPill: {
    maxWidth: 220,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewText: {
    fontSize: 11,
    color: "#334155",
    maxWidth: 160,
  },
  removeText: {
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "700",
  },
  fileList: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 8,
    gap: 6,
  },
  fileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
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
  viewerArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -36,
    width: 34,
    height: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerArrowLeft: {
    left: 6,
  },
  viewerArrowRight: {
    right: 6,
  },
  viewerArrowText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "700",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 26,
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
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
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "8px 10px",
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
});
