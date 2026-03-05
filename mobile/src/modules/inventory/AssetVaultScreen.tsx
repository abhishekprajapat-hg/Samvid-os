import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { Screen } from "../../components/common/Screen";
import {
  approveInventoryRequest,
  createInventoryAsset,
  createInventoryCreateRequest,
  deleteInventoryAsset,
  getInventoryAssets,
  getPendingInventoryRequests,
  rejectInventoryRequest,
  requestInventoryStatusChange,
  updateInventoryAsset,
} from "../../services/inventoryService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAuth } from "../../context/AuthContext";
import type { InventoryAsset } from "../../types";
import { createChatSocket } from "../../services/chatSocket";

const STATUS_OPTIONS = ["Available", "Blocked", "Sold"];
const MODE_FILTERS = ["All", "Sale", "Rent"] as const;
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
const PAYMENT_MODE_OPTIONS = ["Cash", "Cheque", "Bank Transfer", "UPI"] as const;
const TRANSFER_TYPE_OPTIONS = ["RTGS", "IMPS", "NEFT"] as const;
type PaymentMode = "" | (typeof PAYMENT_MODE_OPTIONS)[number];

const EMPTY_SOLD_FORM = {
  leadId: "",
  paymentMode: "" as PaymentMode,
  totalAmount: "",
  partialAmount: "",
  remainingDueDate: "",
  paymentDate: "",
  chequeBankName: "",
  chequeNumber: "",
  chequeDate: "",
  bankTransferType: "RTGS" as (typeof TRANSFER_TYPE_OPTIONS)[number],
  bankTransferUtrNumber: "",
  upiTransactionId: "",
};

type UploadInput = {
  uri: string;
  name: string;
  mimeType?: string;
};

type PendingRequest = {
  _id: string;
  inventoryId?: { title?: string };
  proposedData?: any;
  requestNote?: string;
  requestedBy?: { name?: string; role?: string };
  createdAt?: string;
};

const EMPTY_FORM = {
  title: "",
  location: "",
  category: "",
  type: "",
  status: "Available",
  price: "",
  description: "",
  customAmenities: "",
};

const CLOUDINARY_CLOUD_NAME = String(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "djfiq8kiy").trim();
const CLOUDINARY_UPLOAD_PRESET = String(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "samvid_upload").trim();

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

export const AssetVaultScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { role, token } = useAuth();
  const canManage = role === "ADMIN";
  const canCreateAsset = role === "ADMIN" || role === "EXECUTIVE" || role === "FIELD_EXECUTIVE";
  const canRequestStatusChange = role !== "ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<(typeof MODE_FILTERS)[number]>("All");
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [leadOptions, setLeadOptions] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<PendingRequest | null>(null);
  const [reviewRejectReason, setReviewRejectReason] = useState("");
  const [reviewError, setReviewError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [pickedImages, setPickedImages] = useState<UploadInput[]>([]);
  const [pickedFiles, setPickedFiles] = useState<UploadInput[]>([]);
  const [statusRequestOpen, setStatusRequestOpen] = useState(false);
  const [statusRequestAssetId, setStatusRequestAssetId] = useState("");
  const [statusRequestStatus, setStatusRequestStatus] = useState("");
  const [statusRequestNote, setStatusRequestNote] = useState("");
  const [modalError, setModalError] = useState("");
  const [soldForm, setSoldForm] = useState(EMPTY_SOLD_FORM);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [paymentModeDropdownOpen, setPaymentModeDropdownOpen] = useState(false);
  const [saleVoiceNote, setSaleVoiceNote] = useState<UploadInput | null>(null);
  const [voiceRecording, setVoiceRecording] = useState<Audio.Recording | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceSound, setVoiceSound] = useState<Audio.Sound | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [carouselTick, setCarouselTick] = useState(0);
  const [activeCarouselAssetId, setActiveCarouselAssetId] = useState("");
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoDeleteConfirmOpen, setPhotoDeleteConfirmOpen] = useState(false);
  const [photoMenuAssetId, setPhotoMenuAssetId] = useState("");
  const [photoMenuImageIndex, setPhotoMenuImageIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item?: InventoryAsset }> }) => {
    const firstVisible = viewableItems.find((entry) => entry?.item?._id)?.item?._id || "";
    setActiveCarouselAssetId(firstVisible);
  });

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const [list, pending, leads] = await Promise.all([
        getInventoryAssets(),
        canManage ? getPendingInventoryRequests() : Promise.resolve([]),
        getAllLeads().catch(() => []),
      ]);
      setAssets(Array.isArray(list) ? list : []);
      setRequests(Array.isArray(pending) ? pending : []);
      const mappedLeads = Array.isArray(leads)
        ? leads
            .filter((row) => row?._id && row?.name)
            .map((row) => ({ _id: String(row._id), name: String(row.name), phone: String(row.phone || "") }))
        : [];
      setLeadOptions(mappedLeads);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load inventory"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1600);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => () => {
    if (voiceRecording) {
      voiceRecording.stopAndUnloadAsync().catch(() => {});
    }
    if (voiceSound) {
      voiceSound.unloadAsync().catch(() => {});
    }
  }, [voiceRecording, voiceSound]);

  useEffect(() => {
    if (!token) return;
    const socket = createChatSocket(token);
    socket.on("inventory:request:reviewed", (payload: any) => {
      if (!payload?.requestId) return;
      const status = String(payload?.status || "").toLowerCase();
      if (status === "approved") {
        setSuccess("Inventory request approved by admin");
        load(true);
      } else if (status === "rejected") {
        setError("Inventory request rejected by admin");
        load(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, load]);

  useEffect(() => {
    const initialSearch = String(route.params?.initialSearch || "").trim();
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [route.params]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselTick((prev) => prev + 1);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const key = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const modeMatch = modeFilter === "All" || String(asset.type || "").toLowerCase() === modeFilter.toLowerCase();
      if (!modeMatch) return false;
      if (!key) return true;
      return (
      [asset.title, asset.location, asset.category, asset.status, ...(asset.amenities || [])].some((v) =>
        String(v || "").toLowerCase().includes(key),
      )
      );
    });
  }, [assets, search, modeFilter]);

  const selectedLeadLabel = useMemo(() => {
    if (!soldForm.leadId) return "Select lead";
    const matched = leadOptions.find((row) => row._id === soldForm.leadId);
    if (!matched) return "Select lead";
    return `${matched.name}${matched.phone ? ` (${matched.phone})` : ""}`;
  }, [leadOptions, soldForm.leadId]);
  const remainingAmountValue = useMemo(() => {
    const totalAmount = Number(soldForm.totalAmount);
    const partialAmount = Number(soldForm.partialAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return "";
    if (!Number.isFinite(partialAmount) || partialAmount < 0) return "";
    return String(Math.max(0, Number((totalAmount - partialAmount).toFixed(2))));
  }, [soldForm.partialAmount, soldForm.totalAmount]);

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

  const resetSoldForm = () => {
    setSoldForm(EMPTY_SOLD_FORM);
    setLeadDropdownOpen(false);
    setPaymentModeDropdownOpen(false);
    setSaleVoiceNote(null);
    setVoiceRecording(null);
    setIsVoiceRecording(false);
    if (voiceSound) {
      voiceSound.unloadAsync().catch(() => {});
      setVoiceSound(null);
      setIsVoicePlaying(false);
    }
    setModalError("");
  };

  const startMicRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setModalError("Microphone permission is required");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      setVoiceRecording(recording);
      setIsVoiceRecording(true);
      setModalError("");
    } catch {
      setModalError("Failed to start mic recording");
      setVoiceRecording(null);
      setIsVoiceRecording(false);
    }
  };

  const stopMicRecording = async (attachFile = true) => {
    if (!voiceRecording) return;
    try {
      await voiceRecording.stopAndUnloadAsync();
      const uri = voiceRecording.getURI();
      if (attachFile && uri) {
        setSaleVoiceNote({
          uri,
          name: `voice-note-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
        });
      }
    } catch {
      setModalError("Failed to stop mic recording");
    } finally {
      setVoiceRecording(null);
      setIsVoiceRecording(false);
    }
  };

  const canPlayVoiceNote = (file?: UploadInput | null) => {
    const mime = String(file?.mimeType || "").toLowerCase();
    const name = String(file?.name || "").toLowerCase();
    return mime.startsWith("audio/") || [".m4a", ".mp3", ".wav", ".aac", ".ogg", ".mp4"].some((ext) => name.endsWith(ext));
  };

  const toggleVoicePreview = async () => {
    if (!saleVoiceNote || !canPlayVoiceNote(saleVoiceNote)) return;

    if (voiceSound && isVoicePlaying) {
      await voiceSound.stopAsync().catch(() => {});
      await voiceSound.unloadAsync().catch(() => {});
      setVoiceSound(null);
      setIsVoicePlaying(false);
      return;
    }

    if (voiceSound) {
      await voiceSound.unloadAsync().catch(() => {});
      setVoiceSound(null);
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: saleVoiceNote.uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) {
            setIsVoicePlaying(false);
            return;
          }
          if (status.didJustFinish) {
            setIsVoicePlaying(false);
          } else {
            setIsVoicePlaying(Boolean(status.isPlaying));
          }
        },
      );
      setVoiceSound(sound);
      setIsVoicePlaying(true);
    } catch {
      setModalError("Unable to play recorded voice note");
    }
  };

  const removeVoiceAttachment = async () => {
    if (voiceSound) {
      await voiceSound.unloadAsync().catch(() => {});
      setVoiceSound(null);
      setIsVoicePlaying(false);
    }
    setSaleVoiceNote(null);
  };

  const pickVoiceNote = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (result.canceled || !result.assets?.length) return;
      const selected = result.assets[0];
      setSaleVoiceNote({
        uri: selected.uri,
        name: selected.name || `voice-note-${Date.now()}.m4a`,
        mimeType: selected.mimeType || "application/octet-stream",
      });
    } catch {
      setModalError("Failed to pick file");
    }
  };

  const buildSaleMetaPayload = async () => {
    const totalAmount = Number(soldForm.totalAmount);
    const partialAmount = Number(soldForm.partialAmount);
    const paymentMode = soldForm.paymentMode;

    if (!soldForm.leadId) {
      throw new Error("Please select the lead for this sold property");
    }
    if (!paymentMode) {
      throw new Error("Please select payment mode");
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new Error("Total amount should be greater than 0");
    }
    if (!soldForm.partialAmount.trim()) {
      throw new Error("Partial amount is required");
    }
    if (!Number.isFinite(partialAmount) || partialAmount < 0 || partialAmount > totalAmount) {
      throw new Error("Partial amount should be between 0 and total amount");
    }
    const remainingAmount = Number((totalAmount - partialAmount).toFixed(2));
    if (remainingAmount > 0 && !soldForm.remainingDueDate.trim()) {
      throw new Error("Remaining amount due date is required");
    }

    if (paymentMode === "Cheque") {
      if (!soldForm.chequeBankName.trim() || !soldForm.chequeNumber.trim() || !soldForm.chequeDate.trim()) {
        throw new Error("Please fill all required cheque details");
      }
    }

    if (paymentMode === "Bank Transfer") {
      if (
        !soldForm.bankTransferType.trim()
        || !soldForm.bankTransferUtrNumber.trim()
        || !soldForm.paymentDate.trim()
      ) {
        throw new Error("Please fill transfer type, UTR number and payment date");
      }
    }

    if (paymentMode === "UPI") {
      if (!soldForm.upiTransactionId.trim() || !soldForm.paymentDate.trim()) {
        throw new Error("Please fill transaction id and payment date for UPI");
      }
    }
    if (paymentMode === "Cash" && !soldForm.paymentDate.trim()) {
      throw new Error("Payment date is required for cash");
    }

    let voiceNoteUrl = "";
    if (saleVoiceNote) {
      const uploaded = await uploadToCloudinary(saleVoiceNote);
      voiceNoteUrl = resolveFileUrl(uploaded);
    }

    return {
      leadId: soldForm.leadId,
      paymentMode,
      totalAmount,
      partialAmount,
      remainingAmount,
      remainingDueDate: soldForm.remainingDueDate.trim() || undefined,
      paymentDate:
        paymentMode === "Cash" || paymentMode === "UPI" || paymentMode === "Bank Transfer"
          ? soldForm.paymentDate.trim()
          : undefined,
      voiceNoteUrl: voiceNoteUrl || undefined,
      voiceNoteName: saleVoiceNote?.name || undefined,
      cheque:
        paymentMode === "Cheque"
          ? {
              bankName: soldForm.chequeBankName.trim(),
              chequeNumber: soldForm.chequeNumber.trim(),
              chequeDate: soldForm.chequeDate.trim(),
            }
          : undefined,
      bankTransfer:
        paymentMode === "Bank Transfer"
          ? {
              transferType: soldForm.bankTransferType.trim(),
              utrNumber: soldForm.bankTransferUtrNumber.trim(),
            }
          : undefined,
      upi:
        paymentMode === "UPI"
          ? {
              transactionId: soldForm.upiTransactionId.trim(),
            }
          : undefined,
    };
  };

  const uploadToCloudinary = async (file: UploadInput) => {
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as any);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: formData as any,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.secure_url) {
      throw new Error(String(payload?.error?.message || payload?.message || "Upload failed"));
    }

    return String(payload.secure_url);
  };

  const createAsset = async () => {
    const title = form.title.trim();
    const location = form.location.trim();
    const price = Number(form.price);

    if (!title || !location || !Number.isFinite(price) || price <= 0) {
      setError("Title, location and valid price are required");
      return;
    }

    try {
      setSaving(true);

      const [uploadedImages, uploadedFiles] = await Promise.all([
        Promise.all(pickedImages.map((row) => uploadToCloudinary(row))),
        Promise.all(pickedFiles.map((row) => uploadToCloudinary(row))),
      ]);

      const imageUrls = uploadedImages.map((url) => resolveFileUrl(url)).filter(Boolean);

      const documentUrls = uploadedFiles.map((url) => resolveFileUrl(url)).filter(Boolean);

      const customAmenities = form.customAmenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const amenities = [...new Set([...selectedAmenities, ...customAmenities])];

      const fallbackImages = imageUrls.length > 0 ? imageUrls : buildDefaultImageSet(`${title}-${location}`);

      const payload = {
        ...form,
        title,
        location,
        category: form.category.trim(),
        type: form.type.trim(),
        price,
        description: form.description.trim(),
        images: fallbackImages,
        documents: documentUrls,
        amenities,
      };

      if (canManage) {
        const created = await createInventoryAsset(payload);
        setAssets((prev) => [created, ...prev]);
        setSuccess("Asset created");
      } else {
        await createInventoryCreateRequest(payload);
        setSuccess("Asset request sent for admin approval");
      }

      setFormOpen(false);
      resetForm();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to create asset"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (assetId: string, status: string) => {
    try {
      if (status === "Sold") {
        setStatusRequestAssetId(assetId);
        setStatusRequestStatus(status);
        setStatusRequestNote("");
        setModalError("");
        resetSoldForm();
        setStatusRequestOpen(true);
        return;
      }

      if (canManage) {
        const updated = await updateInventoryAsset(assetId, { status });
        setAssets((prev) => prev.map((asset) => (asset._id === updated._id ? updated : asset)));
        setSuccess("Status updated");
      } else if (canRequestStatusChange) {
        setStatusRequestAssetId(assetId);
        setStatusRequestStatus(status);
        setStatusRequestNote("");
        setModalError("");
        setStatusRequestOpen(true);
      }
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update status"));
    }
  };

  const closeStatusRequestModal = () => {
    if (isVoiceRecording) {
      stopMicRecording(false).catch(() => {});
    }
    setStatusRequestOpen(false);
    setStatusRequestAssetId("");
    setStatusRequestStatus("");
    setStatusRequestNote("");
    setModalError("");
    resetSoldForm();
  };

  const submitStatusRequest = async () => {
    if (!statusRequestAssetId || !statusRequestStatus) return;

    try {
      setSaving(true);
      setModalError("");
      const saleMeta =
        statusRequestStatus === "Sold"
          ? (await buildSaleMetaPayload()) as InventoryAsset["saleMeta"]
          : undefined;
      if (!canManage && statusRequestStatus !== "Sold" && !statusRequestNote.trim()) {
        throw new Error("Reason / note for admin review is required");
      }
      const requestNote = statusRequestStatus === "Sold"
        ? `Sold request via ${soldForm.paymentMode}`
        : statusRequestNote.trim();

      if (canManage) {
        const updated = await updateInventoryAsset(statusRequestAssetId, {
          status: statusRequestStatus,
          ...(saleMeta ? { saleMeta } : {}),
        });
        setAssets((prev) => prev.map((asset) => (asset._id === updated._id ? updated : asset)));
        setSuccess("Status updated");
      } else {
        await requestInventoryStatusChange(statusRequestAssetId, statusRequestStatus, requestNote, saleMeta);
        setSuccess("Status change request sent for admin approval");
      }
      closeStatusRequestModal();
    } catch (e) {
      setModalError(toErrorMessage(e, "Failed to submit status change request"));
    } finally {
      setSaving(false);
    }
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

  const approveRequest = async (requestId: string) => {
    try {
      await approveInventoryRequest(requestId);
      setSuccess("Request approved");
      load(true);
      return true;
    } catch (e) {
      setError(toErrorMessage(e, "Failed to approve request"));
      return false;
    }
  };

  const addPhotosToAsset = async (asset: InventoryAsset) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Media permission is required to upload photos");
        return;
      }

      setSaving(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 10,
      });

      if (result.canceled) return;

      const rows = (result.assets || []).map((picked, index) => ({
        uri: picked.uri,
        name: picked.fileName || `photo-${Date.now()}-${index + 1}.jpg`,
        mimeType: picked.mimeType || "image/jpeg",
      }));

      if (!rows.length) return;

      const uploaded = await Promise.all(rows.map((row) => uploadToCloudinary(row)));
      const currentImages = Array.isArray(asset.images) ? asset.images : [];
      const nextImages = [...currentImages, ...uploaded.map((url) => resolveFileUrl(url)).filter(Boolean)];
      const updated = await updateInventoryAsset(asset._id, { images: nextImages });
      setAssets((prev) => prev.map((row) => (row._id === updated._id ? updated : row)));
      setSuccess("Photos added");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to add photos"));
    } finally {
      setSaving(false);
    }
  };

  const deletePhotoFromAsset = async (asset: InventoryAsset, imageIndex: number) => {
    const currentImages = Array.isArray(asset.images) ? asset.images : [];
    if (!currentImages.length) {
      setError("No uploaded photo available to delete");
      return;
    }
    if (imageIndex < 0 || imageIndex >= currentImages.length) {
      setError("Selected photo cannot be deleted");
      return;
    }

    try {
      setSaving(true);
      const nextImages = currentImages.filter((_, index) => index !== imageIndex);
      const updated = await updateInventoryAsset(asset._id, { images: nextImages });
      setAssets((prev) => prev.map((row) => (row._id === updated._id ? updated : row)));
      setSuccess("Photo deleted");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to delete photo"));
    } finally {
      setSaving(false);
    }
  };

  const openPhotoMenu = (asset: InventoryAsset, imageIndex: number) => {
    setPhotoMenuAssetId(asset._id);
    setPhotoMenuImageIndex(imageIndex);
    setPhotoDeleteConfirmOpen(false);
    setPhotoMenuOpen(true);
  };

  const closePhotoMenu = () => {
    if (saving) return;
    setPhotoMenuOpen(false);
    setPhotoDeleteConfirmOpen(false);
    setPhotoMenuAssetId("");
    setPhotoMenuImageIndex(0);
  };

  const addPhotoFromMenu = async () => {
    const selectedAsset = assets.find((row) => row._id === photoMenuAssetId);
    if (!selectedAsset) return;
    setPhotoMenuOpen(false);
    await addPhotosToAsset(selectedAsset);
  };

  const deletePhotoFromMenu = async () => {
    const selectedAsset = assets.find((row) => row._id === photoMenuAssetId);
    if (!selectedAsset) return;
    setPhotoDeleteConfirmOpen(false);
    setPhotoMenuOpen(false);
    await deletePhotoFromAsset(selectedAsset, photoMenuImageIndex);
  };

  const rejectRequest = async (requestId: string, rejectionReason = "Rejected from mobile app") => {
    try {
      await rejectInventoryRequest(requestId, rejectionReason);
      setSuccess("Request rejected");
      load(true);
      return true;
    } catch (e) {
      setError(toErrorMessage(e, "Failed to reject request"));
      return false;
    }
  };

  const openReviewModal = (request: PendingRequest) => {
    setReviewTarget(request);
    setReviewRejectReason("");
    setReviewError("");
    setReviewOpen(true);
  };

  const closeReviewModal = () => {
    if (saving) return;
    setReviewOpen(false);
    setReviewTarget(null);
    setReviewRejectReason("");
    setReviewError("");
  };

  const approveFromReview = async () => {
    if (!reviewTarget?._id) return;
    try {
      setSaving(true);
      setReviewError("");
      const ok = await approveRequest(reviewTarget._id);
      if (ok) closeReviewModal();
    } catch (e) {
      setReviewError(toErrorMessage(e, "Failed to approve request"));
    } finally {
      setSaving(false);
    }
  };

  const rejectFromReview = async () => {
    if (!reviewTarget?._id) return;
    const reason = reviewRejectReason.trim();
    if (!reason) {
      setReviewError("Rejection reason is required");
      return;
    }
    try {
      setSaving(true);
      setReviewError("");
      const ok = await rejectRequest(reviewTarget._id, reason);
      if (ok) closeReviewModal();
    } catch (e) {
      setReviewError(toErrorMessage(e, "Failed to reject request"));
    } finally {
      setSaving(false);
    }
  };

  const openVoiceNote = async (url?: string) => {
    const safeUrl = String(url || "").trim();
    if (!safeUrl) return;
    try {
      const supported = await Linking.canOpenURL(safeUrl);
      if (!supported) {
        setReviewError("Unable to open voice note on this device");
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      setReviewError("Unable to open voice note");
    }
  };

  return (
    <Screen title="Asset Vault" subtitle="Inventory + Requests" loading={loading} error={error}>
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListHeaderComponent={
          <>
            <TextInput
              style={styles.search}
              placeholder="Search title, location, status"
              value={search}
              onChangeText={setSearch}
            />

            <View style={styles.modeToggleRow}>
              {MODE_FILTERS.map((mode) => (
                <Pressable
                  key={mode}
                  style={[styles.modeToggleChip, modeFilter === mode && styles.modeToggleChipActive]}
                  onPress={() => setModeFilter(mode)}
                >
                  <Text style={[styles.modeToggleText, modeFilter === mode && styles.modeToggleTextActive]}>{mode}</Text>
                </Pressable>
              ))}
            </View>

            {canCreateAsset ? (
              <Pressable style={styles.primaryBtn} onPress={() => setFormOpen(true)}>
                <Text style={styles.primaryText}>+ Add Asset</Text>
              </Pressable>
            ) : null}

            {canManage && requests.length > 0 ? (
              <View style={styles.requestBox}>
                <Text style={styles.requestTitle}>Pending Requests ({requests.length})</Text>
                {requests.map((request) => (
                  <View style={styles.requestRow} key={request._id}>
                    <Text style={styles.meta}>
                      {request.inventoryId?.title || "Inventory"} to {request.proposedData?.status || "-"}
                    </Text>
                    {!!request.requestNote ? <Text style={styles.meta}>Note: {request.requestNote}</Text> : null}
                    <View style={styles.requestActions}>
                      <Pressable style={styles.chip} onPress={() => openReviewModal(request)}>
                        <Text style={styles.chipText}>Review & Approve</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No assets found</Text>}
        renderItem={({ item }) => {
          const displayImages = item.images?.length ? item.images : buildDefaultImageSet(item.title || item._id);
          const shouldAnimate = activeCarouselAssetId === item._id;
          const currentIndex = displayImages.length > 0 && shouldAnimate ? carouselTick % displayImages.length : 0;
          const cover = resolveFileUrl(displayImages[currentIndex] || displayImages[0]);
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate("InventoryDetails", { assetId: item._id })}>
              {cover ? (
                <View style={styles.cardImageWrap}>
                  <Image source={{ uri: cover }} style={styles.cardImage} resizeMode="cover" />
                  <Pressable
                    style={styles.photoMenuBtn}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      openPhotoMenu(item, currentIndex);
                    }}
                    disabled={saving}
                  >
                    <Ionicons name="ellipsis-vertical" size={14} color="#ffffff" />
                  </Pressable>
                  {displayImages.length > 1 ? (
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountText}>{currentIndex + 1}/{displayImages.length}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.meta}>{item.location || "-"} | {item.category || "-"}</Text>
              <Text style={styles.meta}>Rs {Number(item.price || 0).toLocaleString("en-IN")}</Text>
              <Text style={styles.meta}>Photos: {displayImages.length}</Text>

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
                    onPress={(event) => {
                      event.stopPropagation?.();
                      updateStatus(item._id, status);
                    }}
                  >
                    <Text style={[styles.chipText, item.status === status && styles.activeText]}>{status}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={styles.detailsBtn}
                onPress={(event) => {
                  event.stopPropagation?.();
                  navigation.navigate("InventoryDetails", { assetId: item._id });
                }}
              >
                <Text style={styles.detailsText}>Open Details</Text>
              </Pressable>

              {canManage ? (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    removeAsset(item._id);
                  }}
                >
                  <Text style={styles.deleteText}>Delete Asset</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Modal visible={photoMenuOpen} animationType="fade" transparent onRequestClose={closePhotoMenu}>
        <Pressable style={styles.actionSheetBackdrop} onPress={closePhotoMenu}>
          <View style={styles.actionSheetCard}>
            {!photoDeleteConfirmOpen ? (
              <>
                <Pressable style={styles.actionSheetBtn} onPress={addPhotoFromMenu} disabled={saving}>
                  <Text style={styles.actionSheetText}>Add Photo</Text>
                </Pressable>
                <Pressable style={[styles.actionSheetBtn, styles.actionSheetDangerBtn]} onPress={() => setPhotoDeleteConfirmOpen(true)} disabled={saving}>
                  <Text style={[styles.actionSheetText, styles.actionSheetDangerText]}>Delete Photo</Text>
                </Pressable>
                <Pressable style={styles.actionSheetBtn} onPress={closePhotoMenu} disabled={saving}>
                  <Text style={styles.actionSheetMutedText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.actionSheetTitle}>Delete this photo?</Text>
                <View style={styles.actionSheetRow}>
                  <Pressable style={styles.actionSheetRowBtn} onPress={() => setPhotoDeleteConfirmOpen(false)} disabled={saving}>
                    <Text style={styles.actionSheetMutedText}>No</Text>
                  </Pressable>
                  <Pressable style={[styles.actionSheetRowBtn, styles.actionSheetDangerBtn]} onPress={deletePhotoFromMenu} disabled={saving}>
                    <Text style={[styles.actionSheetText, styles.actionSheetDangerText]}>Yes, Delete</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

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
                placeholder="Property type (Apartment, Farmhouse, Land, etc)"
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
                <Pressable style={[styles.ghostBtn, styles.modalRowBtn]} onPress={() => { setFormOpen(false); resetForm(); }} disabled={saving}>
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, styles.modalRowBtn]} onPress={createAsset} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewOpen} animationType="slide" transparent onRequestClose={closeReviewModal}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Review & Approve Request</Text>
              {reviewError ? <Text style={styles.modalError}>{reviewError}</Text> : null}

              <View style={styles.reviewBox}>
                <Text style={styles.reviewTitle}>Request Summary</Text>
                <Text style={styles.meta}>Asset: {String(reviewTarget?.inventoryId?.title || "Inventory")}</Text>
                <Text style={styles.meta}>Status Change: {String(reviewTarget?.proposedData?.status || "-")}</Text>
                <Text style={styles.meta}>Requested By: {String(reviewTarget?.requestedBy?.name || "-")}</Text>
                <Text style={styles.meta}>Role: {String(reviewTarget?.requestedBy?.role || "-")}</Text>
                <Text style={styles.meta}>Created At: {String(reviewTarget?.createdAt || "-")}</Text>
                <Text style={styles.meta}>Admin Review Note: {String(reviewTarget?.requestNote || "-")}</Text>
              </View>

              {reviewTarget?.proposedData?.saleMeta ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.reviewTitle}>Sale Details</Text>
                  <Text style={styles.meta}>Lead ID: {String(reviewTarget.proposedData.saleMeta.leadId || "-")}</Text>
                  <Text style={styles.meta}>Payment Mode: {String(reviewTarget.proposedData.saleMeta.paymentMode || "-")}</Text>
                  <Text style={styles.meta}>Total Amount: {String(reviewTarget.proposedData.saleMeta.totalAmount || "-")}</Text>
                  <Text style={styles.meta}>Partial Amount: {String(reviewTarget.proposedData.saleMeta.partialAmount || "-")}</Text>
                  <Text style={styles.meta}>Remaining Amount: {String(reviewTarget.proposedData.saleMeta.remainingAmount || "-")}</Text>
                  <Text style={styles.meta}>Remaining Due Date: {String(reviewTarget.proposedData.saleMeta.remainingDueDate || "-")}</Text>
                  <Text style={styles.meta}>Payment Date: {String(reviewTarget.proposedData.saleMeta.paymentDate || "-")}</Text>

                  <View style={styles.requestActions}>
                    <Pressable
                      style={styles.chip}
                      onPress={() => openVoiceNote(reviewTarget?.proposedData?.saleMeta?.voiceNoteUrl)}
                      disabled={!reviewTarget?.proposedData?.saleMeta?.voiceNoteUrl}
                    >
                      <Text style={styles.chipText}>
                        {reviewTarget?.proposedData?.saleMeta?.voiceNoteUrl ? "Open Voice Note" : "Voice Note Missing"}
                      </Text>
                    </Pressable>
                  </View>

                  {reviewTarget.proposedData.saleMeta.cheque ? (
                    <View style={styles.reviewSubBox}>
                      <Text style={styles.reviewSubTitle}>Cheque Details</Text>
                      <Text style={styles.meta}>Bank: {String(reviewTarget.proposedData.saleMeta.cheque.bankName || "-")}</Text>
                      <Text style={styles.meta}>Cheque No: {String(reviewTarget.proposedData.saleMeta.cheque.chequeNumber || "-")}</Text>
                      <Text style={styles.meta}>Cheque Date: {String(reviewTarget.proposedData.saleMeta.cheque.chequeDate || "-")}</Text>
                    </View>
                  ) : null}

                  {reviewTarget.proposedData.saleMeta.bankTransfer || reviewTarget.proposedData.saleMeta.netBanking ? (
                    <View style={styles.reviewSubBox}>
                      <Text style={styles.reviewSubTitle}>Bank Transfer Details</Text>
                      <Text style={styles.meta}>
                        Transfer Type: {String(reviewTarget.proposedData.saleMeta.bankTransfer?.transferType || "-")}
                      </Text>
                      <Text style={styles.meta}>
                        UTR Number: {String(reviewTarget.proposedData.saleMeta.bankTransfer?.utrNumber || reviewTarget.proposedData.saleMeta.netBanking?.transactionId || "-")}
                      </Text>
                    </View>
                  ) : null}

                  {reviewTarget.proposedData.saleMeta.upi ? (
                    <View style={styles.reviewSubBox}>
                      <Text style={styles.reviewSubTitle}>UPI Details</Text>
                      <Text style={styles.meta}>Txn ID: {String(reviewTarget.proposedData.saleMeta.upi.transactionId || "-")}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Rejection Reason (required for reject)</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Enter rejection reason"
                multiline
                value={reviewRejectReason}
                onChangeText={setReviewRejectReason}
              />

              <View style={styles.modalRow}>
                <Pressable style={[styles.ghostBtn, styles.modalRowBtn]} onPress={closeReviewModal} disabled={saving}>
                  <Text>Close</Text>
                </Pressable>
                <Pressable style={[styles.rejectBtn, styles.modalRowBtn]} onPress={rejectFromReview} disabled={saving}>
                  {saving ? <ActivityIndicator color="#991b1b" /> : <Text style={styles.rejectBtnText}>Reject</Text>}
                </Pressable>
                <Pressable style={[styles.primaryBtn, styles.modalRowBtn]} onPress={approveFromReview} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Approve</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={statusRequestOpen} animationType="fade" transparent onRequestClose={closeStatusRequestModal}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{canManage ? "Update Status" : "Request Status Change"}</Text>
              <Text style={styles.meta}>Requested status: {statusRequestStatus}</Text>
              {modalError ? <Text style={styles.modalError}>{modalError}</Text> : null}

              {statusRequestStatus === "Sold" ? (
                <>
                  <Text style={styles.sectionLabel}>Lead Linked With Sale</Text>
                  <Pressable
                    style={styles.selectInput}
                    onPress={() => {
                      setLeadDropdownOpen((prev) => !prev);
                      setPaymentModeDropdownOpen(false);
                    }}
                  >
                    <Text numberOfLines={1} style={styles.selectInputText}>{selectedLeadLabel}</Text>
                  </Pressable>
                  {leadDropdownOpen ? (
                    <View style={styles.selectMenu}>
                      <ScrollView style={styles.selectMenuScroll} nestedScrollEnabled>
                        {leadOptions.length > 0 ? (
                          leadOptions.map((lead) => (
                            <Pressable
                              key={lead._id}
                              style={styles.selectMenuItem}
                              onPress={() => {
                                setSoldForm((prev) => ({ ...prev, leadId: lead._id }));
                                setLeadDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.selectMenuItemText}>
                                {lead.name}{lead.phone ? ` (${lead.phone})` : ""}
                              </Text>
                            </Pressable>
                          ))
                        ) : (
                          <Text style={styles.emptySelectText}>No leads available</Text>
                        )}
                      </ScrollView>
                    </View>
                  ) : null}

                  <Text style={styles.sectionLabel}>Payment Mode</Text>
                  <Pressable
                    style={styles.selectInput}
                    onPress={() => {
                      setPaymentModeDropdownOpen((prev) => !prev);
                      setLeadDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.selectInputText}>{soldForm.paymentMode || "Select payment mode"}</Text>
                  </Pressable>
                  {paymentModeDropdownOpen ? (
                    <View style={styles.selectMenu}>
                      {PAYMENT_MODE_OPTIONS.map((mode) => (
                        <Pressable
                          key={mode}
                          style={styles.selectMenuItem}
                          onPress={() => {
                            setSoldForm((prev) => ({ ...prev, paymentMode: mode }));
                            setPaymentModeDropdownOpen(false);
                          }}
                        >
                          <Text style={styles.selectMenuItemText}>{mode}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <TextInput
                    style={styles.input}
                    placeholder="Total amount"
                    keyboardType="number-pad"
                    value={soldForm.totalAmount}
                    onChangeText={(value) => setSoldForm((prev) => ({ ...prev, totalAmount: value }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Partial amount"
                    keyboardType="number-pad"
                    value={soldForm.partialAmount}
                    onChangeText={(value) => setSoldForm((prev) => ({ ...prev, partialAmount: value }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Remaining amount"
                    value={remainingAmountValue}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Remaining amount due date (DD-MM-YYYY)"
                    value={soldForm.remainingDueDate}
                    onChangeText={(value) => setSoldForm((prev) => ({ ...prev, remainingDueDate: value }))}
                  />

                  {soldForm.paymentMode === "Cheque" ? (
                    <>
                      <TextInput style={styles.input} placeholder="Bank name" value={soldForm.chequeBankName} onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeBankName: value }))} />
                      <TextInput style={styles.input} placeholder="Cheque number" value={soldForm.chequeNumber} onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeNumber: value }))} />
                      <TextInput style={styles.input} placeholder="Cheque date (DD-MM-YYYY)" value={soldForm.chequeDate} onChangeText={(value) => setSoldForm((prev) => ({ ...prev, chequeDate: value }))} />
                    </>
                  ) : null}

                  {soldForm.paymentMode === "Bank Transfer" ? (
                    <>
                      <Text style={styles.sectionLabel}>Transfer Type</Text>
                      <View style={styles.transferTypeRow}>
                        {TRANSFER_TYPE_OPTIONS.map((transferType) => (
                          <Pressable
                            key={transferType}
                            style={[styles.transferTypeChip, soldForm.bankTransferType === transferType && styles.transferTypeChipActive]}
                            onPress={() => setSoldForm((prev) => ({ ...prev, bankTransferType: transferType }))}
                          >
                            <Text style={[styles.transferTypeText, soldForm.bankTransferType === transferType && styles.transferTypeTextActive]}>
                              {transferType}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="UTR number"
                        value={soldForm.bankTransferUtrNumber}
                        onChangeText={(value) => setSoldForm((prev) => ({ ...prev, bankTransferUtrNumber: value }))}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Payment date (DD-MM-YYYY)"
                        value={soldForm.paymentDate}
                        onChangeText={(value) => setSoldForm((prev) => ({ ...prev, paymentDate: value }))}
                      />
                    </>
                  ) : null}

                  {soldForm.paymentMode === "UPI" ? (
                    <>
                      <TextInput style={styles.input} placeholder="Transaction id" value={soldForm.upiTransactionId} onChangeText={(value) => setSoldForm((prev) => ({ ...prev, upiTransactionId: value }))} />
                      <TextInput
                        style={styles.input}
                        placeholder="Payment date (DD-MM-YYYY)"
                        value={soldForm.paymentDate}
                        onChangeText={(value) => setSoldForm((prev) => ({ ...prev, paymentDate: value }))}
                      />
                    </>
                  ) : null}

                  {soldForm.paymentMode === "Cash" ? (
                    <TextInput
                      style={styles.input}
                      placeholder="Payment date (DD-MM-YYYY)"
                      value={soldForm.paymentDate}
                      onChangeText={(value) => setSoldForm((prev) => ({ ...prev, paymentDate: value }))}
                    />
                  ) : null}
                  <View style={styles.uploadRow}>
                    <Pressable style={styles.ghostBtn} onPress={pickVoiceNote}>
                      <Text>+ Attach File</Text>
                    </Pressable>
                    <View style={styles.attachmentActions}>
                      <Pressable
                        style={[styles.roundIconBtn, isVoiceRecording && styles.roundIconBtnActive]}
                        onPress={isVoiceRecording ? () => stopMicRecording(true) : startMicRecording}
                      >
                        <Ionicons name={isVoiceRecording ? "stop" : "mic"} size={16} color={isVoiceRecording ? "#991b1b" : "#334155"} />
                      </Pressable>
                      {saleVoiceNote ? (
                        <>
                          <Pressable
                            style={styles.roundIconBtn}
                            onPress={toggleVoicePreview}
                            disabled={!canPlayVoiceNote(saleVoiceNote)}
                          >
                            <Ionicons
                              name={isVoicePlaying ? "pause" : "play"}
                              size={16}
                              color={canPlayVoiceNote(saleVoiceNote) ? "#334155" : "#94a3b8"}
                            />
                          </Pressable>
                          <Pressable style={styles.roundIconBtn} onPress={removeVoiceAttachment}>
                            <Ionicons name="close" size={16} color="#991b1b" />
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.uploadCount}>{saleVoiceNote?.name || "Not attached"}</Text>
                </>
              ) : null}

              {!canManage && statusRequestStatus !== "Sold" ? (
                <TextInput
                  style={[styles.input, { height: 90 }]}
                  placeholder="Reason / note for admin review"
                  multiline
                  value={statusRequestNote}
                  onChangeText={setStatusRequestNote}
                />
              ) : null}

              <View style={styles.modalRow}>
                <Pressable style={[styles.ghostBtn, styles.modalRowBtn]} onPress={closeStatusRequestModal} disabled={saving}>
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, styles.modalRowBtn]} onPress={submitStatusRequest} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>{canManage ? "Save Status" : "Send for Approval"}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
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
  modeToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeToggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  modeToggleChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  modeToggleText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  modeToggleTextActive: {
    color: "#fff",
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
  detailsBtn: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
  },
  detailsText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
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
  requestBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  requestTitle: {
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  requestRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
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
    backgroundColor: "#ffffff",
  },
  reviewSubTitle: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "700",
    marginBottom: 2,
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 24,
    marginBottom: 14,
  },
  listContent: {
    paddingBottom: 14,
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
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  modalError: {
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "600",
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
  modalRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalRowBtn: {
    flex: 1,
  },
  ghostBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rejectBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rejectBtnText: {
    color: "#991b1b",
    fontWeight: "700",
  },
  selectInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  selectInputText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    maxHeight: 180,
    marginTop: -4,
    marginBottom: 10,
  },
  selectMenuScroll: {
    maxHeight: 160,
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
  emptySelectText: {
    color: "#94a3b8",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  transferTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  transferTypeChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  transferTypeChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  transferTypeText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  transferTypeTextActive: {
    color: "#fff",
  },
  photoCountBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
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
  photoMenuBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
    padding: 14,
  },
  actionSheetCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 8,
    gap: 6,
  },
  actionSheetTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  actionSheetBtn: {
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  actionSheetRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionSheetRowBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  actionSheetDangerBtn: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  actionSheetText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  actionSheetDangerText: {
    color: "#991b1b",
  },
  actionSheetMutedText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  attachmentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roundIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  roundIconBtnActive: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
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
});
