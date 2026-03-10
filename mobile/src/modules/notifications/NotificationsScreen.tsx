import React, { useMemo, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import {
  approveLeadStatusRequest,
  getLeadStatusRequests,
  getPendingLeadStatusRequests,
  rejectLeadStatusRequest,
  type LeadStatusRequest,
} from "../../services/leadService";
import {
  approveInventoryRequest,
  getPendingInventoryRequests,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";

type InventoryRequest = {
  _id: string;
  type?: "create" | "update" | string;
  status?: "pending" | "approved" | "rejected" | string;
  requestNote?: string;
  rejectionReason?: string;
  createdAt?: string;
  requestedBy?: { _id?: string; name?: string; role?: string };
  inventoryId?: { _id?: string; projectName?: string; towerName?: string; unitNumber?: string; status?: string } | null;
  proposedData?: Record<string, unknown>;
};

type NotificationItem =
  | { kind: "LEAD"; id: string; createdAt: string; request: LeadStatusRequest }
  | { kind: "INVENTORY"; id: string; createdAt: string; request: InventoryRequest };

const asDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value?: string) => {
  const d = asDate(value);
  if (!d) return "-";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const NotificationsScreen = () => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  const [leadRequests, setLeadRequests] = useState<LeadStatusRequest[]>([]);
  const [leadRequestHistory, setLeadRequestHistory] = useState<LeadStatusRequest[]>([]);
  const [inventoryRequests, setInventoryRequests] = useState<InventoryRequest[]>([]);

  const [previewItem, setPreviewItem] = useState<NotificationItem | null>(null);
  const [rejectItem, setRejectItem] = useState<NotificationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const downloadFile = async (url: string, fileName = "document") => {
    const safeUrl = String(url || "").trim();
    if (!safeUrl) {
      setError("Document URL is missing");
      return;
    }
    if (Platform.OS !== "web") {
      await Linking.openURL(safeUrl).catch(() => {
        Alert.alert("Open failed", "Unable to open/download document.");
      });
      return;
    }
    try {
      const response = await fetch(safeUrl);
      if (!response.ok) {
        throw new Error("Download failed");
      }
      const blob = await response.blob();
      const doc = (globalThis as any)?.document;
      if (!doc?.createElement || !doc?.body) {
        throw new Error("Document unavailable");
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = doc.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName || "document";
      doc.body.appendChild(anchor);
      anchor.click();
      doc.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch {
      await Linking.openURL(safeUrl).catch(() => {
        setError("Unable to download document");
      });
    }
  };

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [leadRows, leadHistoryRows, inventoryRows] = await Promise.all([
        getPendingLeadStatusRequests(),
        getLeadStatusRequests(),
        getPendingInventoryRequests(),
      ]);

      setLeadRequests(Array.isArray(leadRows) ? leadRows : []);
      const history = Array.isArray(leadHistoryRows)
        ? leadHistoryRows.filter((row) => String(row?.status || "") !== "pending").slice(0, 50)
        : [];
      setLeadRequestHistory(history);
      setInventoryRequests(Array.isArray(inventoryRows) ? (inventoryRows as InventoryRequest[]) : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load notifications"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const items = useMemo<NotificationItem[]>(() => {
    const leadItems: NotificationItem[] = leadRequests.map((row) => ({
      kind: "LEAD",
      id: String(row._id),
      createdAt: String(row.createdAt || ""),
      request: row,
    }));
    const inventoryItems: NotificationItem[] = inventoryRequests.map((row) => ({
      kind: "INVENTORY",
      id: String(row._id),
      createdAt: String(row.createdAt || ""),
      request: row,
    }));
    return [...leadItems, ...inventoryItems].sort((a, b) => {
      const ta = asDate(a.createdAt)?.getTime() || 0;
      const tb = asDate(b.createdAt)?.getTime() || 0;
      return tb - ta;
    });
  }, [leadRequests, inventoryRequests]);

  const doApprove = async (item: NotificationItem) => {
    try {
      setActionLoadingId(item.id);
      setError("");
      if (item.kind === "LEAD") {
        await approveLeadStatusRequest(item.id);
      } else {
        await approveInventoryRequest(item.id);
      }
      setSuccess("Request approved");
      setPreviewItem(null);
      await load(true);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to approve request"));
    } finally {
      setActionLoadingId("");
    }
  };

  const doReject = async (item: NotificationItem) => {
    const reason = rejectionReason.trim();
    if (!reason) {
      setError("Rejection reason is required");
      return;
    }
    try {
      setActionLoadingId(item.id);
      setError("");
      if (item.kind === "LEAD") {
        await rejectLeadStatusRequest(item.id, reason);
      } else {
        await rejectInventoryRequest(item.id, reason);
      }
      setSuccess("Request rejected");
      setRejectItem(null);
      setRejectionReason("");
      setPreviewItem(null);
      await load(true);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to reject request"));
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <Screen title="Notifications" subtitle="Approval Requests + Reviews" loading={loading} error={error}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <AppCard style={styles.summaryCard as object}>
        <Text style={styles.summaryTitle}>Pending Requests</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Lead Requests</Text>
            <Text style={styles.summaryValue}>{leadRequests.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Lead Reviews</Text>
            <Text style={styles.summaryValue}>{leadRequestHistory.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Inventory Requests</Text>
            <Text style={styles.summaryValue}>{inventoryRequests.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{items.length}</Text>
          </View>
        </View>
      </AppCard>

      {!isAdmin ? (
        <AppCard style={styles.readOnlyCard as object}>
          <Text style={styles.meta}>You can submit approval requests from Leads/Inventory. Admin will review them in this Notifications panel.</Text>
        </AppCard>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {items.length === 0 ? (
          <AppCard style={styles.emptyCard as object}>
            <Text style={styles.meta}>No pending approval requests.</Text>
          </AppCard>
        ) : (
          items.map((item) => (
            <AppCard key={`${item.kind}-${item.id}`} style={styles.requestCard as object}>
              <View style={styles.rowBetween}>
                <Text style={styles.requestType}>{item.kind === "LEAD" ? "Lead Status Request" : "Inventory Request"}</Text>
                <Text style={styles.badge}>Pending</Text>
              </View>
              <Text style={styles.meta}>Requested by: {item.request.requestedBy?.name || "User"} ({item.request.requestedBy?.role || "-"})</Text>
              <Text style={styles.meta}>Created: {formatDate(item.createdAt)}</Text>

                {item.kind === "LEAD" ? (
                  <>
                  <Text style={styles.meta}>Lead: {item.request.lead?.name || "-"} | Current: {item.request.lead?.status || "-"}</Text>
                  <Text style={styles.meta}>Proposed Status: {item.request.proposedStatus || "-"}</Text>
                  <Text style={styles.meta}>Note: {item.request.requestNote || "-"}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.meta}>
                    Type: {String(item.request.type || "-").toUpperCase()} | Asset: {item.request.inventoryId?.projectName || "-"} {item.request.inventoryId?.unitNumber || ""}
                  </Text>
                  <Text style={styles.meta}>Note: {item.request.requestNote || "-"}</Text>
                </>
              )}

              <View style={styles.actionRow}>
                <AppButton title="Preview" variant="ghost" onPress={() => setPreviewItem(item)} style={styles.actionBtn as object} />
                {isAdmin ? (
                  <>
                    <AppButton
                      title={actionLoadingId === item.id ? "Approving..." : "Approve"}
                      onPress={() => doApprove(item)}
                      disabled={actionLoadingId === item.id}
                      style={styles.actionBtn as object}
                    />
                    <AppButton title="Reject" variant="ghost" onPress={() => { setRejectItem(item); setRejectionReason(""); }} style={styles.actionBtn as object} />
                  </>
                ) : null}
              </View>
            </AppCard>
          ))
        )}
        {isAdmin ? (
          <AppCard style={styles.historyCard as object}>
            <Text style={styles.summaryTitle}>Lead Review History</Text>
            {leadRequestHistory.length === 0 ? (
              <Text style={styles.meta}>No approved/rejected lead reviews yet.</Text>
            ) : (
              leadRequestHistory.map((row) => (
                <View key={`history-${row._id}`} style={styles.historyRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.requestType}>{row.lead?.name || "Lead"}</Text>
                    <Text style={String(row.status || "") === "approved" ? styles.historyApproved : styles.historyRejected}>
                      {String(row.status || "-").toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.meta}>Requested: {String(row.proposedStatus || "-")}</Text>
                  <Text style={styles.meta}>By: {row.requestedBy?.name || "-"} | Reviewed by: {row.reviewedBy?.name || "-"}</Text>
                  <Text style={styles.meta}>At: {formatDate(row.reviewedAt || row.createdAt)}</Text>
                  <Text style={styles.meta}>Reason: {row.requestNote || "-"}</Text>
                  {row.rejectionReason ? <Text style={styles.meta}>Reject reason: {row.rejectionReason}</Text> : null}
                  {Array.isArray(row.closureDocuments) && row.closureDocuments.length > 0 ? (
                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.meta}>Documents: {row.closureDocuments.length}</Text>
                      {row.closureDocuments.map((doc, index) => (
                        <View key={`history-doc-${row._id}-${index}`} style={styles.fileRow}>
                          <Text style={[styles.meta, { flex: 1 }]}>{String(doc?.name || `Document ${index + 1}`)}</Text>
                          <Pressable
                            style={styles.fileBtn}
                            onPress={() => {
                              const url = String(doc?.url || "");
                              if (!url) return;
                              void Linking.openURL(url);
                            }}
                          >
                            <Text style={styles.fileBtnText}>Open</Text>
                          </Pressable>
                          <Pressable
                            style={styles.fileBtn}
                            onPress={() =>
                              void downloadFile(
                                String(doc?.url || ""),
                                String(doc?.name || `document-${index + 1}`),
                              )
                            }
                          >
                            <Text style={styles.fileBtnText}>Download</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </AppCard>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(previewItem)} transparent animationType="slide" onRequestClose={() => setPreviewItem(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Preview</Text>
            {previewItem ? (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.previewText}>Type: {previewItem.kind}</Text>
                <Text style={styles.previewText}>Requested By: {previewItem.request.requestedBy?.name || "-"} ({previewItem.request.requestedBy?.role || "-"})</Text>
                <Text style={styles.previewText}>Created: {formatDate(previewItem.createdAt)}</Text>
                {previewItem.kind === "LEAD" ? (
                  <>
                    <Text style={styles.previewText}>Lead: {previewItem.request.lead?.name || "-"}</Text>
                    <Text style={styles.previewText}>Current Status: {previewItem.request.lead?.status || "-"}</Text>
                    <Text style={styles.previewText}>Proposed Status: {previewItem.request.proposedStatus || "-"}</Text>
                    <Text style={styles.previewText}>Request Note: {previewItem.request.requestNote || "-"}</Text>
                    <Text style={styles.previewText}>Payment Mode: {previewItem.request.proposedSaleMeta?.paymentMode || "-"}</Text>
                    <Text style={styles.previewText}>Total Amount: {previewItem.request.proposedSaleMeta?.totalAmount ?? "-"}</Text>
                    <Text style={styles.previewText}>Partial Amount: {previewItem.request.proposedSaleMeta?.partialAmount ?? "-"}</Text>
                    <Text style={styles.previewText}>Remaining Amount: {previewItem.request.proposedSaleMeta?.remainingAmount ?? "-"}</Text>
                    {previewItem.request.attachment?.fileUrl ? (
                      <View style={styles.fileRow}>
                        <Text style={[styles.previewText, { flex: 1 }]}>
                          Attachment: {String(previewItem.request.attachment?.fileName || "file")}
                        </Text>
                        <Pressable
                          style={styles.fileBtn}
                          onPress={() => {
                            const url = String(previewItem.request.attachment?.fileUrl || "");
                            if (!url) return;
                            void Linking.openURL(url);
                          }}
                        >
                          <Text style={styles.fileBtnText}>Open</Text>
                        </Pressable>
                        <Pressable
                          style={styles.fileBtn}
                          onPress={() =>
                            void downloadFile(
                              String(previewItem.request.attachment?.fileUrl || ""),
                              String(previewItem.request.attachment?.fileName || "attachment"),
                            )
                          }
                        >
                          <Text style={styles.fileBtnText}>Download</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {Array.isArray(previewItem.request.closureDocuments) && previewItem.request.closureDocuments.length > 0 ? (
                      <>
                        <Text style={styles.previewText}>Closure Documents ({previewItem.request.closureDocuments.length})</Text>
                        {previewItem.request.closureDocuments.map((doc, index) => (
                          <View key={`preview-closure-doc-${index}-${String(doc?.url || "")}`} style={styles.fileRow}>
                            <Text style={[styles.previewText, { flex: 1 }]}>
                              {String(doc?.name || `Document ${index + 1}`)}
                            </Text>
                            <Pressable
                              style={styles.fileBtn}
                              onPress={() => {
                                const url = String(doc?.url || "");
                                if (!url) return;
                                void Linking.openURL(url);
                              }}
                            >
                              <Text style={styles.fileBtnText}>Open</Text>
                            </Pressable>
                            <Pressable
                              style={styles.fileBtn}
                              onPress={() =>
                                void downloadFile(
                                  String(doc?.url || ""),
                                  String(doc?.name || `document-${index + 1}`),
                                )
                              }
                            >
                              <Text style={styles.fileBtnText}>Download</Text>
                            </Pressable>
                          </View>
                        ))}
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text style={styles.previewText}>Request Type: {String(previewItem.request.type || "-").toUpperCase()}</Text>
                    <Text style={styles.previewText}>Inventory: {previewItem.request.inventoryId?.projectName || "-"} {previewItem.request.inventoryId?.towerName || ""} {previewItem.request.inventoryId?.unitNumber || ""}</Text>
                    <Text style={styles.previewText}>Request Note: {previewItem.request.requestNote || "-"}</Text>
                    <Text style={styles.previewText}>Proposed Changes:</Text>
                    <Text style={styles.previewData}>{JSON.stringify(previewItem.request.proposedData || {}, null, 2)}</Text>
                  </>
                )}
              </ScrollView>
            ) : null}
            <View style={styles.modalActionRow}>
              <AppButton title="Close" variant="ghost" onPress={() => setPreviewItem(null)} style={styles.modalBtn as object} />
              {isAdmin && previewItem ? (
                <>
                  <AppButton
                    title={actionLoadingId === previewItem.id ? "Approving..." : "Approve"}
                    onPress={() => doApprove(previewItem)}
                    disabled={actionLoadingId === previewItem.id}
                    style={styles.modalBtn as object}
                  />
                  <AppButton title="Reject" variant="ghost" onPress={() => { setRejectItem(previewItem); setRejectionReason(""); }} style={styles.modalBtn as object} />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(rejectItem)} transparent animationType="fade" onRequestClose={() => setRejectItem(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.rejectCard}>
            <Text style={styles.modalTitle}>Reject Request</Text>
            <AppInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter rejection reason"
              style={styles.rejectInput as object}
            />
            <View style={styles.modalActionRow}>
              <AppButton title="Cancel" variant="ghost" onPress={() => setRejectItem(null)} style={styles.modalBtn as object} />
              <AppButton
                title={rejectItem && actionLoadingId === rejectItem.id ? "Rejecting..." : "Reject"}
                onPress={() => rejectItem && doReject(rejectItem)}
                disabled={Boolean(rejectItem && actionLoadingId === rejectItem.id)}
                style={styles.modalBtn as object}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
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
  summaryCard: {
    marginBottom: 10,
  },
  summaryTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 11,
  },
  summaryValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
  },
  readOnlyCard: {
    marginBottom: 10,
  },
  historyCard: {
    marginTop: 10,
    marginBottom: 10,
  },
  historyRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginTop: 8,
  },
  historyApproved: {
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
  historyRejected: {
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
  emptyCard: {
    marginBottom: 10,
  },
  requestCard: {
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  requestType: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 12,
  },
  badge: {
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
  meta: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 3,
  },
  actionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "80%",
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  rejectCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalScroll: {
    maxHeight: 380,
    marginBottom: 10,
  },
  previewText: {
    color: "#334155",
    fontSize: 12,
    marginBottom: 6,
  },
  previewData: {
    fontSize: 11,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
  },
  fileRow: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fileBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    height: 28,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fileBtnText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  modalBtn: {
    minWidth: 92,
  },
  rejectInput: {
    marginBottom: 8,
  },
});
