import React, { useMemo, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import {
  approveLeadStatusRequest,
  getLeadPaymentRequests,
  getLeadStatusRequests,
  getPendingLeadStatusRequests,
  rejectLeadStatusRequest,
  reviewLeadPaymentRequest,
  type LeadPaymentApprovalRequest,
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
  | { kind: "INVENTORY"; id: string; createdAt: string; request: InventoryRequest }
  | { kind: "PAYMENT"; id: string; createdAt: string; request: LeadPaymentApprovalRequest };

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

const isRouteMissingError = (error: unknown) => /route not found|404|not found/i.test(toErrorMessage(error, ""));

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
  const [paymentRequests, setPaymentRequests] = useState<LeadPaymentApprovalRequest[]>([]);
  const [paymentRequestHistory, setPaymentRequestHistory] = useState<LeadPaymentApprovalRequest[]>([]);

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

      const [leadRows, leadApprovedRows, leadRejectedRows, inventoryRows, paymentRows] = await Promise.all([
        getPendingLeadStatusRequests().catch((err) => {
          if (!isRouteMissingError(err)) throw err;
          return [];
        }),
        getLeadStatusRequests({ status: "approved" }).catch((err) => {
          if (!isRouteMissingError(err)) throw err;
          return [];
        }),
        getLeadStatusRequests({ status: "rejected" }).catch((err) => {
          if (!isRouteMissingError(err)) throw err;
          return [];
        }),
        getPendingInventoryRequests().catch((err) => {
          if (!isRouteMissingError(err)) throw err;
          return [];
        }),
        getLeadPaymentRequests({ approvalStatus: "ALL", limit: 300 }).catch((err) => {
          if (!isRouteMissingError(err)) throw err;
          return [];
        }),
      ]);

      setLeadRequests(Array.isArray(leadRows) ? leadRows : []);
      const historyMap = new Map<string, LeadStatusRequest>();
      const mergedRows = [
        ...(Array.isArray(leadApprovedRows) ? leadApprovedRows : []),
        ...(Array.isArray(leadRejectedRows) ? leadRejectedRows : []),
      ];
      mergedRows.forEach((row) => {
        const id = String(row?._id || "").trim();
        if (!id) return;
        historyMap.set(id, row);
      });
      const history = Array.from(historyMap.values())
        .sort((a, b) => (asDate(String(b?.reviewedAt || b?.createdAt || ""))?.getTime() || 0) - (asDate(String(a?.reviewedAt || a?.createdAt || ""))?.getTime() || 0))
        .slice(0, 80);
      setLeadRequestHistory(history);
      setInventoryRequests(Array.isArray(inventoryRows) ? (inventoryRows as InventoryRequest[]) : []);
      const paymentPending = Array.isArray(paymentRows)
        ? paymentRows.filter((row: any) => String(row?.dealPayment?.approvalStatus || "").toUpperCase() === "PENDING")
        : [];
      const paymentHistory = Array.isArray(paymentRows)
        ? paymentRows.filter((row: any) => ["APPROVED", "REJECTED"].includes(String(row?.dealPayment?.approvalStatus || "").toUpperCase())).slice(0, 80)
        : [];
      setPaymentRequests(paymentPending);
      setPaymentRequestHistory(paymentHistory);
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
    const paymentItems: NotificationItem[] = paymentRequests.map((row) => ({
      kind: "PAYMENT",
      id: String(row._id || ""),
      createdAt: String((row as any)?.dealPayment?.approvalRequestedAt || row.updatedAt || row.createdAt || ""),
      request: row,
    }));
    return [...leadItems, ...inventoryItems, ...paymentItems].sort((a, b) => {
      const ta = asDate(a.createdAt)?.getTime() || 0;
      const tb = asDate(b.createdAt)?.getTime() || 0;
      return tb - ta;
    });
  }, [leadRequests, inventoryRequests, paymentRequests]);

  const doApprove = async (item: NotificationItem) => {
    try {
      setActionLoadingId(item.id);
      setError("");
      if (item.kind === "LEAD") {
        await approveLeadStatusRequest(item.id);
      } else if (item.kind === "PAYMENT") {
        const leadId = String(item.request?._id || "").trim();
        const currentStatus = String((item.request as any)?.status || "CLOSED");
        if (!leadId) throw new Error("Lead id is missing");
        await reviewLeadPaymentRequest(leadId, {
          status: currentStatus,
          approvalStatus: "APPROVED",
        });
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
      } else if (item.kind === "PAYMENT") {
        const leadId = String(item.request?._id || "").trim();
        const currentStatus = String((item.request as any)?.status || "CLOSED");
        if (!leadId) throw new Error("Lead id is missing");
        await reviewLeadPaymentRequest(leadId, {
          status: currentStatus,
          approvalStatus: "REJECTED",
          approvalNote: reason,
        });
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
            <Text style={styles.summaryLabel}>Payment Requests</Text>
            <Text style={styles.summaryValue}>{paymentRequests.length}</Text>
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
          items.map((item) => {
            const requestedByName = item.kind === "PAYMENT"
              ? String(item.request?.dealPayment?.approvalRequestedBy?.name || "User")
              : String(item.request?.requestedBy?.name || "User");
            const requestedByRole = item.kind === "PAYMENT"
              ? String(item.request?.dealPayment?.approvalRequestedBy?.role || "-")
              : String(item.request?.requestedBy?.role || "-");

            return (
            <AppCard key={`${item.kind}-${item.id}`} style={styles.requestCard as object}>
              <View style={styles.rowBetween}>
                <Text style={styles.requestType}>
                  {item.kind === "LEAD" ? "Lead Status Request" : item.kind === "PAYMENT" ? "Lead Payment Approval" : "Inventory Request"}
                </Text>
                <Text style={styles.badge}>Pending</Text>
              </View>
              <Text style={styles.meta}>Requested by: {requestedByName} ({requestedByRole})</Text>
              <Text style={styles.meta}>Created: {formatDate(item.createdAt)}</Text>

                {item.kind === "LEAD" ? (
                  <>
                  <Text style={styles.meta}>Lead: {item.request.lead?.name || "-"} | Current: {item.request.lead?.status || "-"}</Text>
                  <Text style={styles.meta}>Proposed Status: {item.request.proposedStatus || "-"}</Text>
                  <Text style={styles.meta}>Note: {item.request.requestNote || "-"}</Text>
                </>
              ) : item.kind === "PAYMENT" ? (
                <>
                  <Text style={styles.meta}>Lead: {String(item.request.name || "-")} | Current: {String((item.request as any)?.status || "-")}</Text>
                  <Text style={styles.meta}>Payment: {String(item.request?.dealPayment?.mode || "-")} | {String(item.request?.dealPayment?.paymentType || "-")}</Text>
                  <Text style={styles.meta}>Reference: {String(item.request?.dealPayment?.paymentReference || "-")}</Text>
                  <Text style={styles.meta}>Note: {String(item.request?.dealPayment?.note || "-")}</Text>
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
            );
          })
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
        {isAdmin ? (
          <AppCard style={styles.historyCard as object}>
            <Text style={styles.summaryTitle}>Payment Approval History</Text>
            {paymentRequestHistory.length === 0 ? (
              <Text style={styles.meta}>No approved/rejected payment approvals yet.</Text>
            ) : (
              paymentRequestHistory.map((row) => {
                const status = String(row?.dealPayment?.approvalStatus || "-").toUpperCase();
                return (
                  <View key={`payment-history-${row._id}`} style={styles.historyRow}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.requestType}>{String(row?.name || "Lead")}</Text>
                      <Text style={status === "APPROVED" ? styles.historyApproved : styles.historyRejected}>{status}</Text>
                    </View>
                    <Text style={styles.meta}>Mode: {String(row?.dealPayment?.mode || "-")} | Type: {String(row?.dealPayment?.paymentType || "-")}</Text>
                    <Text style={styles.meta}>Requested By: {row?.dealPayment?.approvalRequestedBy?.name || "-"}</Text>
                    <Text style={styles.meta}>Reviewed By: {row?.dealPayment?.approvalReviewedBy?.name || "-"}</Text>
                    <Text style={styles.meta}>Requested At: {formatDate(row?.dealPayment?.approvalRequestedAt || row?.updatedAt || row?.createdAt)}</Text>
                    <Text style={styles.meta}>Reviewed At: {formatDate(row?.dealPayment?.approvalReviewedAt || row?.updatedAt || row?.createdAt)}</Text>
                    <Text style={styles.meta}>Review Note: {String(row?.dealPayment?.approvalNote || "-")}</Text>
                  </View>
                );
              })
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
                <Text style={styles.previewText}>
                  Requested By: {previewItem.kind === "PAYMENT" ? String(previewItem.request?.dealPayment?.approvalRequestedBy?.name || "-") : String(previewItem.request?.requestedBy?.name || "-")} (
                  {previewItem.kind === "PAYMENT" ? String(previewItem.request?.dealPayment?.approvalRequestedBy?.role || "-") : String(previewItem.request?.requestedBy?.role || "-")})
                </Text>
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
                ) : previewItem.kind === "PAYMENT" ? (
                  <>
                    <Text style={styles.previewText}>Lead: {String(previewItem.request.name || "-")}</Text>
                    <Text style={styles.previewText}>Current Status: {String((previewItem.request as any)?.status || "-")}</Text>
                    <Text style={styles.previewText}>Payment Mode: {String(previewItem.request?.dealPayment?.mode || "-")}</Text>
                    <Text style={styles.previewText}>Payment Type: {String(previewItem.request?.dealPayment?.paymentType || "-")}</Text>
                    <Text style={styles.previewText}>Remaining Amount: {String(previewItem.request?.dealPayment?.remainingAmount ?? "-")}</Text>
                    <Text style={styles.previewText}>Payment Reference: {String(previewItem.request?.dealPayment?.paymentReference || "-")}</Text>
                    <Text style={styles.previewText}>Request Note: {String(previewItem.request?.dealPayment?.note || "-")}</Text>
                    <Text style={styles.previewText}>Requested By: {previewItem.request?.dealPayment?.approvalRequestedBy?.name || "-"}</Text>
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
    flexWrap: "wrap",
    gap: 8,
  },
  summaryBox: {
    width: "31%",
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
