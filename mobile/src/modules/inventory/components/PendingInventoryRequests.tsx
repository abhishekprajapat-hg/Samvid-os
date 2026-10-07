import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Glyph } from "../../../components/ui/Glyph";
import { AppSheet } from "../../../components/ui/Overlay";
import { Banner, BrandButton } from "../../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import {
  approveInventoryRequest,
  getPendingInventoryRequests,
  rejectInventoryRequest,
} from "../../../services/inventoryService";
import { toAbsoluteUrl } from "../../../services/uploadService";
import { formatCurrency, formatDateTime } from "../../../utils/format";
import { toErrorMessage } from "../../../utils/errorMessage";

/*
 * The review queue at the top of the vault - web's PendingInventoryRequestsPanel.
 *
 * Web lets a reviewer approve or reject a create, edit or delete request right
 * where the inventory lives; mobile could only do it from Notifications. The
 * card says what the request is, who raised it, the property's key facts and,
 * for an edit, exactly which fields change and to what. Rejecting asks for the
 * reason web asks for.
 */

/* Web's REQUEST_FIELD_LABELS - only these fields are shown as changes. */
const REQUEST_FIELD_LABELS: Record<string, string> = {
  propertyId: "Property ID",
  inventoryType: "Inventory Type",
  projectName: "Project",
  towerName: "Tower",
  unitNumber: "Unit",
  price: "Price",
  rent: "Rent",
  type: "Transaction Type",
  category: "Category",
  furnishingStatus: "Furnishing",
  status: "Status",
  reservationReason: "Reservation Reason",
  saleDetails: "Sold Details",
  location: "Location",
  city: "City",
  area: "Area",
  pincode: "Pincode",
  buildingName: "Building",
  floorNumber: "Floor",
  totalFloors: "Total Floors",
  totalArea: "Total Area",
  carpetArea: "Carpet Area",
  builtUpArea: "Built-up Area",
  superBuiltUpArea: "Super Built-up Area",
  length: "Length",
  width: "Width",
  height: "Height",
  maintenanceCharges: "Maintenance",
  deposit: "Deposit",
  depositMonths: "Security Deposit (Months)",
  agreementYears: "Agreement (Years)",
  lockInYears: "Lock-in (Years)",
  officeNumber: "Office Number",
  ownerName: "Owner Name",
  ownerNumber: "Owner Number",
  ownerWhatsappNumber: "Owner WhatsApp Number",
  ownerType: "Ownership",
  keyManagerName: "Key Manager Name",
  keyManagerNumber: "Key Manager Number",
  dealType: "Deal Type",
  propertyDate: "Property Date",
  gstApplicable: "GST Applicable",
  commercialDetails: "Commercial Details",
  residentialDetails: "Residential Details",
  siteLocation: "Coordinates",
  images: "Images",
  documents: "Documents",
  floorPlans: "Floor Plans",
  videoTours: "Video Tours",
};

const unitLabel = (source: any) =>
  [source?.projectName, source?.towerName, source?.unitNumber].filter(Boolean).join(" - ")
  || String(source?.propertyId || source?.buildingName || "Inventory");

const formatRequestValue = (key: string, value: any) => {
  if (["price", "rent", "maintenanceCharges", "deposit"].includes(key)) return formatCurrency(value);
  if (key === "siteLocation") {
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat}, ${lng}` : "-";
  }
  if (key === "saleDetails") {
    const lead = typeof value?.leadId === "object" ? value.leadId?.name : value?.leadId;
    const partial = String(value?.paymentType || "").toUpperCase() === "PARTIAL";
    return [
      lead || "-",
      String(value?.paymentMode || "-").replace(/_/g, " "),
      String(value?.paymentType || "-").replace(/_/g, " "),
      `Total: ${formatCurrency(value?.totalAmount)}`,
      `Remaining: ${formatCurrency(partial ? value?.remainingAmount : 0)}`,
    ].join(" | ");
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === "object") return "Updated";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export const PendingInventoryRequests = ({
  refreshKey,
  onReviewed,
  onViewInventory,
}: {
  refreshKey?: number;
  onReviewed: () => void;
  onViewInventory: (inventoryId: string) => void;
}) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [open, setOpen] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "alert"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await getPendingInventoryRequests();
      setRequests(Array.isArray(rows) ? rows : []);
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const approve = async (requestId: string) => {
    setReviewingId(requestId);
    setMessage(null);
    try {
      await approveInventoryRequest(requestId);
      setMessage({ tone: "success", text: "Request approved and inventory updated" });
      await load();
      onReviewed();
    } catch (error) {
      setMessage({ tone: "alert", text: toErrorMessage(error, "Failed to approve request") });
    } finally {
      setReviewingId("");
    }
  };

  const reject = async () => {
    const requestId = String(rejecting?._id || "");
    if (!requestId || !reason.trim()) return;
    setReviewingId(requestId);
    setMessage(null);
    try {
      await rejectInventoryRequest(requestId, reason.trim());
      setMessage({ tone: "success", text: "Request rejected" });
      setRejecting(null);
      setReason("");
      await load();
      onReviewed();
    } catch (error) {
      setMessage({ tone: "alert", text: toErrorMessage(error, "Failed to reject request") });
    } finally {
      setReviewingId("");
    }
  };

  if (!requests.length && !message) return null;

  return (
    <View style={styles.panel}>
      <Pressable style={styles.head} onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Glyph name="git-pull-request-outline" size={17} color={brand.warnInk} />
        <Text style={styles.title}>Pending requests</Text>
        <Text style={styles.count}>{requests.length}</Text>
        <Glyph name={open ? "chevron-up" : "chevron-down"} size={16} color={brand.textMuted} />
      </Pressable>

      {message ? <Banner tone={message.tone} message={message.text} action="Dismiss" onAction={() => setMessage(null)} /> : null}

      {open
        ? requests.map((request) => {
            const requestId = String(request._id || "");
            const isCreate = request.type === "create";
            const isDelete = request.type === "delete";
            const proposed = request.proposedData || {};
            const current = request.inventoryId || {};
            const source = isCreate || isDelete ? proposed : current;
            const label = isCreate ? unitLabel(proposed) : unitLabel(current);
            const requestedStatus = proposed?.status || "Available";
            const changes = !isCreate && !isDelete
              ? Object.entries(proposed).filter(([key]) => REQUEST_FIELD_LABELS[key])
              : [];
            const firstImage = Array.isArray(source?.images) ? source.images[0] : "";
            const linkedId = String(current?._id || "");
            const busy = reviewingId === requestId;

            return (
              <View key={requestId} style={styles.card}>
                <View style={styles.cardHead}>
                  {firstImage ? (
                    <Image source={{ uri: toAbsoluteUrl(String(firstImage)) }} style={styles.thumb} />
                  ) : null}
                  <View style={styles.flex}>
                    <Text style={styles.label} numberOfLines={2}>{label}</Text>
                    <Text style={styles.meta}>
                      By: {request.requestedBy?.name || "Unknown"} ({request.requestedBy?.role || "-"})
                    </Text>
                    <Text style={styles.kind}>
                      {isDelete
                        ? "Delete inventory request"
                        : isCreate
                          ? `New inventory request (${requestedStatus})`
                          : `${current?.status || "-"} to ${requestedStatus}`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.meta}>Location: {source?.location || "-"}</Text>
                <Text style={styles.meta}>Price: {formatCurrency(source?.price)}</Text>
                {String(source?.type || "").toUpperCase() === "RENT" ? (
                  <Text style={styles.meta}>Deposit: {formatCurrency(source?.deposit)}</Text>
                ) : null}
                <Text style={styles.meta}>Submitted: {formatDateTime(request.createdAt)}</Text>

                {changes.length ? (
                  <View style={styles.changes}>
                    <Text style={styles.changesTitle}>Requested Changes</Text>
                    {changes.map(([key, value]) => (
                      <Text key={key} style={styles.change}>
                        <Text style={styles.changeKey}>{REQUEST_FIELD_LABELS[key]}: </Text>
                        {formatRequestValue(key, value)}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {request.requestNote ? <Text style={styles.note}>Reason: {request.requestNote}</Text> : null}

                <View style={styles.actions}>
                  {!isCreate && linkedId ? (
                    <BrandButton title="View property" icon="open-outline" size="sm" variant="ghost" onPress={() => onViewInventory(linkedId)} />
                  ) : null}
                  <View style={styles.flex} />
                  <BrandButton title="Reject" size="sm" variant="dangerSoft" disabled={busy} onPress={() => setRejecting(request)} />
                  <BrandButton title={busy ? "..." : "Approve"} size="sm" disabled={busy} loading={busy} onPress={() => approve(requestId)} />
                </View>
              </View>
            );
          })
        : null}

      <AppSheet
        visible={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject request"
        subtitle={rejecting ? unitLabel(rejecting.type === "create" ? rejecting.proposedData : rejecting.inventoryId) : undefined}
        footer={
          <View style={styles.actions}>
            <BrandButton title="Cancel" variant="secondary" style={styles.flex} onPress={() => setRejecting(null)} />
            <BrandButton
              title="Reject"
              variant="danger"
              style={styles.flex}
              disabled={!reason.trim() || Boolean(reviewingId)}
              onPress={reject}
            />
          </View>
        }
      >
        <Text style={styles.fieldLabel}>Reject reason</Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder="Why is this being rejected?"
          placeholderTextColor={brand.placeholder}
          multiline
        />
      </AppSheet>
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    panel: {
      gap: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: b.warnChip,
      borderRadius: round.panel,
      backgroundColor: b.warnTint,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { flex: 1, fontSize: t.sectionTitle, fontWeight: "700", color: b.text },
    count: {
      paddingHorizontal: 8,
      paddingVertical: 1,
      borderRadius: round.pill,
      overflow: "hidden",
      backgroundColor: b.warnChip,
      fontSize: t.label,
      fontWeight: "800",
      color: b.warnInk,
    },
    card: {
      gap: 4,
      padding: 12,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    cardHead: { flexDirection: "row", gap: 10, marginBottom: 4 },
    thumb: { width: 56, height: 56, borderRadius: round.field, backgroundColor: b.fieldMuted },
    label: { fontSize: t.rowTitle, fontWeight: "700", color: b.text },
    meta: { fontSize: t.label, color: b.textSecondary },
    kind: { marginTop: 2, fontSize: t.label, fontWeight: "700", color: b.warnInk },
    changes: { marginTop: 6, padding: 8, gap: 2, borderRadius: round.field, backgroundColor: b.fieldMuted },
    changesTitle: { fontSize: t.label, fontWeight: "800", color: b.text, marginBottom: 2 },
    change: { fontSize: t.label, color: b.textSecondary },
    changeKey: { fontWeight: "700", color: b.text },
    note: { marginTop: 4, fontSize: t.label, fontStyle: "italic", color: b.textSecondary },
    actions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    fieldLabel: { marginBottom: 6, fontSize: t.fieldLabel, fontWeight: "600", color: b.text },
    input: {
      minHeight: 90,
      padding: 10,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      fontSize: t.field,
      color: b.text,
      backgroundColor: b.surface,
      textAlignVertical: "top",
    },
  }),
);
