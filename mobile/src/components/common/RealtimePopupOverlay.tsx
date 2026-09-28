import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "../ui/Icon";
import { useRealtimeAlerts, type RealtimePopup } from "../../context/RealtimeAlertsContext";
import {
  adminRequestContext,
  adminRequestTarget,
  adminRequestTitle,
  canReviewFromAlert,
  resolveLeadStatusForReview,
} from "../../context/realtimeEvents";
import { navigateFromAnywhere } from "../../navigation/navigationRef";
import { updateLeadStatus } from "../../services/leadService";
import { approveInventoryRequest, rejectInventoryRequest } from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";
import { themedStyles, themeColor } from "../../theme/themedStyles";

const iconForKind = (kind: RealtimePopup["kind"]) => {
  if (kind === "CALL") return "call";
  if (kind === "CHAT") return "chatbubble";
  if (kind === "TASK") return "checkbox";
  return "notifications";
};

const formatWhen = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

/*
 * An approval request as web's AdminRequestAlertToast draws it: what it is,
 * where it came from, and - for a payment approval or an inventory change -
 * Approve and Reject right on the alert. A rejection needs a reason, so Reject
 * opens a field for it rather than guessing one.
 */
const RequestCard = ({ item, onDone }: { item: RealtimePopup; onDone: () => void }) => {
  const request = item.request!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("Rejected from realtime alert");
  const reviewable = canReviewFromAlert(request);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onDone();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to process request"));
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    if (request.source === "inventory") {
      if (!request.requestId) return setError("Inventory request id missing in alert payload");
      return void run(() => approveInventoryRequest(request.requestId));
    }
    if (!request.leadId) return setError("Lead id missing in alert payload");
    return void run(() =>
      updateLeadStatus(request.leadId, {
        status: resolveLeadStatusForReview(request),
        dealPayment: { approvalStatus: "APPROVED", approvalNote: "Approved from realtime alert" },
      } as any),
    );
  };

  const reject = () => {
    const trimmed = reason.trim();
    if (!trimmed) return setError("Rejection reason is required");
    if (request.source === "inventory") {
      if (!request.requestId) return setError("Inventory request id missing in alert payload");
      return void run(() => rejectInventoryRequest(request.requestId, trimmed));
    }
    if (!request.leadId) return setError("Lead id missing in alert payload");
    return void run(() =>
      updateLeadStatus(request.leadId, {
        status: resolveLeadStatusForReview(request),
        dealPayment: { approvalStatus: "REJECTED", approvalNote: trimmed },
      } as any),
    );
  };

  const open = () => {
    const target = adminRequestTarget(request);
    navigateFromAnywhere(target.screen, target.params);
    onDone();
  };

  return (
    <View style={styles.body}>
      <Text style={styles.eyebrow}>{adminRequestTitle(request).toUpperCase()}</Text>
      <Text style={styles.title} numberOfLines={2}>{request.preview || "New request received"}</Text>
      <Text style={styles.meta}>
        {adminRequestContext(request)} | {formatWhen(request.createdAt)}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rejecting ? (
        <View style={styles.rejectBox}>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Rejection reason"
            placeholderTextColor={themeColor("#98a3b5")}
            autoFocus
          />
          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={reject} disabled={busy}>
              <Text style={styles.rejectText}>Confirm reject</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => setRejecting(false)} disabled={busy}>
              <Text style={styles.neutralText}>Back</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {reviewable ? (
            <>
              <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={approve} disabled={busy}>
                {busy ? <ActivityIndicator size="small" /> : <Text style={styles.approveText}>Approve</Text>}
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => setRejecting(true)} disabled={busy}>
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable style={styles.actionBtn} onPress={open} disabled={busy}>
            <Text style={styles.neutralText}>Open</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onDone} disabled={busy}>
            <Text style={styles.neutralText}>Later</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

export const RealtimePopupOverlay = () => {
  const { popupItems, dismissPopup, acceptCallPopup, rejectCallPopup } = useRealtimeAlerts();

  if (!popupItems.length) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {popupItems.map((item) => {
        const openTarget = () => {
          if (!item.target) return;
          dismissPopup(item.id);
          navigateFromAnywhere(item.target.screen, item.target.params);
        };

        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Icon name={iconForKind(item.kind)} size={14} color={themeColor("#161c24")} />
            </View>
            {item.kind === "REQUEST" && item.request ? (
              <RequestCard item={item} onDone={() => dismissPopup(item.id)} />
            ) : (
              <Pressable
                style={styles.body}
                onPress={item.target ? openTarget : undefined}
                accessibilityRole={item.target ? "button" : undefined}
              >
                {item.kind === "CHAT" || item.kind === "TASK" ? (
                  <Text style={styles.eyebrow}>{item.kind === "TASK" ? "TASK NOTIFICATION" : "NEW CHAT MESSAGE"}</Text>
                ) : null}
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                {item.kind === "CALL" ? (
                  <View style={styles.actions}>
                    <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => rejectCallPopup(item.id)}>
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => acceptCallPopup(item.id)}>
                      <Text style={styles.approveText}>Accept</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            )}
            <Pressable
              style={styles.closeBtn}
              onPress={() => (item.kind === "CALL" ? rejectCallPopup(item.id) : dismissPopup(item.id))}
              hitSlop={8}
              accessibilityLabel="Dismiss"
            >
              <Icon name="close" size={14} color={themeColor("#4e5867")} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 3000,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: c.surface,
    shadowColor: c.text,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 5,
  },
  iconWrap: {
    marginTop: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.border,
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eyebrow: {
    color: c.slate[500],
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: c.text,
    fontSize: 13,
    fontWeight: "700",
  },
  message: {
    color: c.slate[700],
    fontSize: 12,
    lineHeight: 16,
  },
  meta: {
    color: c.slate[500],
    fontSize: 11,
  },
  error: {
    marginTop: 4,
    color: c.rose[700],
    fontSize: 11,
    fontWeight: "600",
  },
  rejectBox: {
    gap: 6,
    marginTop: 6,
  },
  reasonInput: {
    height: 36,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: c.text,
    backgroundColor: c.bg,
  },
  actions: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  actionBtn: {
    minWidth: 64,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: c.surface,
  },
  rejectBtn: {
    borderColor: c.errorBorder,
    backgroundColor: c.errorBg,
  },
  approveBtn: {
    borderColor: c.emerald[300],
    backgroundColor: c.emerald[100],
  },
  rejectText: {
    color: c.rose[700],
    fontSize: 11,
    fontWeight: "700",
  },
  approveText: {
    color: c.emerald[800],
    fontSize: 11,
    fontWeight: "700",
  },
  neutralText: {
    color: c.slate[700],
    fontSize: 11,
    fontWeight: "700",
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
  },
}));
