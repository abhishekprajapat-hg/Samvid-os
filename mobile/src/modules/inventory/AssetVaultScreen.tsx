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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Screen } from "../../components/common/Screen";
import {
  approveInventoryRequest,
  createInventoryAsset,
  deleteInventoryAsset,
  getInventoryAssets,
  getPendingInventoryRequests,
  rejectInventoryRequest,
  requestInventoryStatusChange,
  updateInventoryAsset,
} from "../../services/inventoryService";
import { uploadChatFile } from "../../services/chatService";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAuth } from "../../context/AuthContext";
import type { InventoryAsset } from "../../types";

const STATUS_OPTIONS = ["Available", "Blocked", "Sold"];
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

export const AssetVaultScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { role } = useAuth();
  const canManage = role === "ADMIN";
  const canRequestStatusChange = role === "FIELD_EXECUTIVE";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [requests, setRequests] = useState<Array<{ _id: string; inventoryId?: { title?: string }; proposedData?: { status?: string } }>>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
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
      const [list, pending] = await Promise.all([
        getInventoryAssets(),
        canManage ? getPendingInventoryRequests() : Promise.resolve([]),
      ]);
      setAssets(Array.isArray(list) ? list : []);
      setRequests(Array.isArray(pending) ? pending : []);
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

  const updateStatus = async (assetId: string, status: string) => {
    try {
      if (canManage) {
        const updated = await updateInventoryAsset(assetId, { status });
        setAssets((prev) => prev.map((asset) => (asset._id === updated._id ? updated : asset)));
        setSuccess("Status updated");
      } else if (canRequestStatusChange) {
        await requestInventoryStatusChange(assetId, status);
        setSuccess("Status change request sent");
      }
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update status"));
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
    } catch (e) {
      setError(toErrorMessage(e, "Failed to approve request"));
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await rejectInventoryRequest(requestId, "Rejected from mobile app");
      setSuccess("Request rejected");
      load(true);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to reject request"));
    }
  };

  return (
    <Screen title="Asset Vault" subtitle="Inventory + Requests" loading={loading} error={error}>
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

      {canManage && requests.length > 0 ? (
        <View style={styles.requestBox}>
          <Text style={styles.requestTitle}>Pending Requests ({requests.length})</Text>
          {requests.map((request) => (
            <View style={styles.requestRow} key={request._id}>
              <Text style={styles.meta}>
                {request.inventoryId?.title || "Inventory"} to {request.proposedData?.status || "-"}
              </Text>
              <View style={styles.requestActions}>
                <Pressable style={styles.chip} onPress={() => approveRequest(request._id)}>
                  <Text style={styles.chipText}>Approve</Text>
                </Pressable>
                <Pressable style={styles.chip} onPress={() => rejectRequest(request._id)}>
                  <Text style={styles.chipText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>No assets found</Text>}
        renderItem={({ item }) => {
          const displayImages = item.images?.length ? item.images : buildDefaultImageSet(item.title || item._id);
          const cover = resolveFileUrl(displayImages[0]);
          const remainingPhotos = Math.max(displayImages.length - 1, 0);
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate("InventoryDetails", { assetId: item._id })}>
              {cover ? (
                <View style={styles.cardImageWrap}>
                  <Image source={{ uri: cover }} style={styles.cardImage} resizeMode="cover" />
                  {remainingPhotos > 0 ? (
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountText}>+{remainingPhotos}</Text>
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
                    onPress={() => updateStatus(item._id, status)}
                  >
                    <Text style={[styles.chipText, item.status === status && styles.activeText]}>{status}</Text>
                  </Pressable>
                ))}
              </View>

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
                <Pressable style={styles.ghostBtn} onPress={() => { setFormOpen(false); resetForm(); }} disabled={saving}>
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={createAsset} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
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
    marginVertical: 10,
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
  modalRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
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
});
