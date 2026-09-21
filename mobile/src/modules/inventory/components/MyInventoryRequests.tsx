import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { AppBadge, AppCard } from "../../../components/ui";
import { palette, spacing, typography } from "../../../theme/tokens";
import { getMyInventoryRequests } from "../../../services/inventoryService";

/*
 * What happened to the requests this user raised.
 *
 * Web shows this in AssetVault for anyone who is not a reviewer:
 *   canReviewInventoryRequests ? getPendingInventoryRequests() : getMyInventoryRequests()
 *
 * Mobile only ever called the reviewer branch, so an executive who requested a
 * delete or an edit had no way to find out whether it was approved - the
 * request just vanished. Reviewers keep using the Notifications screen, which
 * is where mobile puts approvals.
 */

type InventoryRequest = {
  _id?: string;
  type?: string;
  status?: string;
  requestNote?: string;
  rejectionReason?: string;
  createdAt?: string;
  inventory?: { _id?: string; title?: string } | null;
  proposedData?: { title?: string } | null;
};

const statusVariant = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (value === "APPROVED") return "emerald" as const;
  if (value === "REJECTED") return "rose" as const;
  return "amber" as const;
};

const describeType = (type?: string) =>
  String(type || "request").replace(/_/g, " ").toLowerCase();

const titleOf = (request: InventoryRequest) =>
  request.inventory?.title || request.proposedData?.title || "Untitled asset";

const formatWhen = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export const MyInventoryRequests = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await getMyInventoryRequests());
    } catch {
      // Supporting information on someone else's screen - if it cannot load,
      // the inventory list itself should carry on without an error banner.
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (requests.length === 0) return null;

  const pending = requests.filter((row) => String(row.status || "").toUpperCase() === "PENDING");
  const visible = expanded ? requests : requests.slice(0, 2);

  return (
    <AppCard style={styles.card}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        style={styles.header}
      >
        <Text style={styles.title}>My requests</Text>
        {pending.length > 0 ? <AppBadge variant="amber">{pending.length} pending</AppBadge> : null}
        <View style={styles.spacer} />
        {expanded ? (
          <ChevronUp size={16} color={palette.slate[500]} />
        ) : (
          <ChevronDown size={16} color={palette.slate[500]} />
        )}
      </Pressable>

      {visible.map((request, index) => (
        <View key={request._id || index} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {titleOf(request)}
            </Text>
            <Text style={styles.rowMeta}>
              {describeType(request.type)}
              {formatWhen(request.createdAt) ? ` · ${formatWhen(request.createdAt)}` : ""}
            </Text>
            {request.rejectionReason ? (
              <Text style={styles.reason}>Reason: {request.rejectionReason}</Text>
            ) : null}
          </View>
          <AppBadge variant={statusVariant(request.status)}>
            {String(request.status || "PENDING")}
          </AppBadge>
        </View>
      ))}

      {!expanded && requests.length > 2 ? (
        <Text style={styles.more}>+{requests.length - 2} more</Text>
      ) : null}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { fontSize: typography.cardTitle, fontWeight: "600", color: palette.slate[900] },
  spacer: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.slate[200],
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: typography.body, fontWeight: "600", color: palette.slate[800] },
  rowMeta: {
    marginTop: 2,
    fontSize: typography.caption,
    color: palette.slate[500],
    textTransform: "capitalize",
  },
  reason: { marginTop: 4, fontSize: typography.caption, color: palette.rose[700] },
  more: {
    marginTop: spacing.lg,
    fontSize: typography.caption,
    color: palette.slate[500],
    textAlign: "center",
  },
});
