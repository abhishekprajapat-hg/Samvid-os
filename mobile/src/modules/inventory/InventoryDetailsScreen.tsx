import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRoute } from "@react-navigation/native";
import { getInventoryAssetActivity, getInventoryAssetById, updateInventoryAsset } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import type { InventoryActivity, InventoryAsset } from "../../types";

const STATUS_OPTIONS = ["Available", "Blocked", "Sold"];
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
  const route = useRoute<any>();
  const assetId = String(route.params?.assetId || "");
  const { role } = useAuth();
  const canManage = role === "ADMIN";
  const { width: windowWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [asset, setAsset] = useState<InventoryAsset | null>(null);
  const [activities, setActivities] = useState<InventoryActivity[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerListRef = useRef<FlatList<string>>(null);

  const galleryImages = useMemo(
    () => (asset?.images?.length ? asset.images : asset ? buildDefaultImageSet(asset.title || asset._id) : []),
    [asset],
  );
  const viewerWidth = Math.max(windowWidth - 32, 1);

  const loadDetails = async () => {
    try {
      setLoading(true);
      setError("");
      const [{ asset }, timeline] = await Promise.all([
        getInventoryAssetById(assetId),
        getInventoryAssetActivity(assetId, { limit: 60 }),
      ]);

      setAsset(asset);
      setActivities(Array.isArray(timeline) ? timeline : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load inventory details"));
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
    if (!viewerOpen) return;
    const timer = setTimeout(() => {
      viewerListRef.current?.scrollToIndex({ index: viewerIndex, animated: false });
    }, 30);
    return () => clearTimeout(timer);
  }, [viewerOpen, viewerIndex]);

  const updateStatus = async (status: string) => {
    if (!asset || !canManage) return;

    try {
      setSaving(true);
      const updated = await updateInventoryAsset(asset._id, { status });
      setAsset(updated);
      const latestTimeline = await getInventoryAssetActivity(asset._id, { limit: 60 });
      setActivities(Array.isArray(latestTimeline) ? latestTimeline : []);
      setSuccess("Status updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update status"));
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.name}>{asset.title}</Text>
        <Text style={styles.meta}>Location: {asset.location || "-"}</Text>
        <Text style={styles.meta}>Category: {asset.category || "-"}</Text>
        <Text style={styles.meta}>Type: {asset.type || "-"}</Text>
        <Text style={styles.meta}>Status: {asset.status || "-"}</Text>
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
                  <Image source={{ uri: resolveFileUrl(photo) }} style={styles.photoThumb} />
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

      {canManage ? (
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
        data={activities}
        keyExtractor={(item) => item._id}
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

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerOpen(false)}>
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>
          <FlatList
            ref={viewerListRef}
            data={galleryImages}
            keyExtractor={(item, index) => `${item}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: viewerWidth }}
            getItemLayout={(_, index) => ({ length: viewerWidth, offset: viewerWidth * index, index })}
            initialScrollIndex={viewerIndex}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(event) => {
              const page = Math.round(event.nativeEvent.contentOffset.x / viewerWidth);
              setViewerIndex(Math.max(0, Math.min(galleryImages.length - 1, page)));
            }}
            renderItem={({ item }) => (
              <View style={[styles.viewerSlide, { width: viewerWidth }]}>
                <Image source={{ uri: resolveFileUrl(item) }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            )}
          />

          {galleryImages.length > 1 ? (
            <>
              <Pressable
                style={[styles.viewerArrow, styles.viewerArrowLeft, viewerIndex <= 0 && styles.viewerArrowDisabled]}
                onPress={() => {
                  const nextIndex = Math.max(0, viewerIndex - 1);
                  setViewerIndex(nextIndex);
                  viewerListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                }}
                disabled={viewerIndex <= 0}
              >
                <Text style={styles.viewerArrowText}>{"<"}</Text>
              </Pressable>
              <Pressable
                style={[styles.viewerArrow, styles.viewerArrowRight, viewerIndex >= galleryImages.length - 1 && styles.viewerArrowDisabled]}
                onPress={() => {
                  const nextIndex = Math.min(galleryImages.length - 1, viewerIndex + 1);
                  setViewerIndex(nextIndex);
                  viewerListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                }}
                disabled={viewerIndex >= galleryImages.length - 1}
              >
                <Text style={styles.viewerArrowText}>{">"}</Text>
              </Pressable>
              <Text style={styles.viewerCounter}>{viewerIndex + 1} / {galleryImages.length}</Text>
            </>
          ) : null}
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
  name: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  section: { marginBottom: 8, color: "#334155", fontWeight: "700" },
  meta: { marginTop: 4, fontSize: 12, color: "#64748b" },
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
  viewerSlide: {
    justifyContent: "center",
    alignItems: "center",
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
  viewerArrowDisabled: {
    opacity: 0.2,
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
    textShadowColor: "rgba(15, 23, 42, 0.9)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  viewerCounter: {
    position: "absolute",
    bottom: 24,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
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
