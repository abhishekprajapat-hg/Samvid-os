import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppSearchInput,
  AppSheet,
  AppSkeletonList,
} from "../../components/ui";
import { usePermissions } from "../../context/PermissionContext";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  blockCabin,
  getFloorView,
  unblockCabin,
  type CoworkingCabin,
} from "../../services/coworkingService";
import {
  STATUS_ORDER,
  WINGS,
  seatsFor,
  statusMetaFor,
  summariseByStatus,
  wingOf,
} from "./cabinData";

/*
 * The booking board.
 *
 * Web draws a scaled floor plan: cabins absolutely positioned to the architect's
 * drawing, with the temple, lift, waiting area and passage band placed around
 * them so a reader can tell which way up the floor is. That works at 1440px.
 *
 * At 390px it does not. A 65-cabin plan scaled to a phone gives tiles roughly
 * 20px across - too small to read a label, let alone tap one - and pinch-zoom
 * on a board people scan rather than study is a poor trade. So the phone gets
 * the same cabins grouped by wing, in a legible grid, with the same status
 * colours and the same legend. The floor plan stays on web, which is where the
 * spatial question ("which cabin is next to the lift?") actually gets asked.
 *
 * The legend is not optional: the colours read from the landlord's side, so red
 * is an empty cabin and green is a let one. See cabinData.ts.
 */

const Legend = () => (
  <View style={styles.legend}>
    {STATUS_ORDER.map((status) => {
      const meta = statusMetaFor(status);
      return (
        <View key={status} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: meta.dot }]} />
          <Text style={styles.legendLabel}>{meta.label}</Text>
        </View>
      );
    })}
  </View>
);

const CabinTile = ({
  cabin,
  onPress,
}: {
  cabin: CoworkingCabin;
  onPress: () => void;
}) => {
  const meta = statusMetaFor(cabin.status);
  const code = String(cabin.code || cabin.name || "?");
  const seats = seatsFor(code, cabin.seats as number);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Cabin ${code}, ${meta.label}`}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: meta.tileBackground, borderColor: meta.tileBorder },
        pressed && styles.tilePressed,
      ]}
    >
      <Text style={[styles.tileCode, { color: meta.tileText }]} numberOfLines={1}>
        {code}
      </Text>
      {seats ? <Text style={[styles.tileSeats, { color: meta.tileText }]}>{seats} seats</Text> : null}
    </Pressable>
  );
};

export const BookingBoardScreen = () => {
  const { can } = usePermissions();
  const canBlock = can("cabins.block");

  const [cabins, setCabins] = useState<CoworkingCabin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<CoworkingCabin | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getFloorView();
      setCabins(data.cabins);
      setError("");
    } catch (err) {
      setError(toErrorMessage(err, "Could not load the board"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summariseByStatus(cabins), [cabins]);

  const visible = useMemo(() => {
    const key = search.trim().toLowerCase();
    return cabins.filter((cabin) => {
      if (statusFilter && String(cabin.status || "").toUpperCase() !== statusFilter) return false;
      if (!key) return true;
      const client =
        typeof cabin.clientId === "object" && cabin.clientId ? cabin.clientId.name || "" : "";
      return [cabin.code, cabin.name, client]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(key));
    });
  }, [cabins, search, statusFilter]);

  const byWing = useMemo(() => {
    const groups = new Map<string, CoworkingCabin[]>();
    for (const cabin of visible) {
      const wing = wingOf(String(cabin.code || cabin.name || ""));
      if (!groups.has(wing)) groups.set(wing, []);
      groups.get(wing)!.push(cabin);
    }
    // Known wings in plan order first, then anything the data adds.
    const ordered: Array<{ id: string; label: string; hint?: string; cabins: CoworkingCabin[] }> = [];
    for (const wing of WINGS) {
      const rows = groups.get(wing.id);
      if (rows?.length) ordered.push({ ...wing, cabins: rows });
      groups.delete(wing.id);
    }
    for (const [id, rows] of groups) {
      ordered.push({ id, label: id ? `Wing ${id}` : "Other", cabins: rows });
    }
    return ordered;
  }, [visible]);

  const applyBlock = useCallback(async () => {
    if (!selected?._id) return;
    setBusy(true);
    try {
      if (selected.isBlocked) {
        await unblockCabin(String(selected._id));
      } else {
        if (!blockReason.trim()) {
          Alert.alert("Block cabin", "Give a reason so the board explains itself later.");
          return;
        }
        await blockCabin(String(selected._id), { reason: blockReason.trim() });
      }
      setSelected(null);
      setBlockReason("");
      await load();
    } catch (err) {
      Alert.alert("Cabin", toErrorMessage(err, "That did not go through"));
    } finally {
      setBusy(false);
    }
  }, [selected, blockReason, load]);

  const selectedMeta = selected ? statusMetaFor(selected.status) : null;
  const selectedClient =
    selected && typeof selected.clientId === "object" && selected.clientId
      ? selected.clientId.name
      : null;

  return (
    <Screen
      title="Booking Board"
      subtitle={cabins.length ? `${cabins.length} cabins` : "Coworking"}
      error={error}
      onRetry={load}
    >
      {loading ? (
        <AppSkeletonList rows={4} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          <Legend />

          <AppSearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cabin or client"
            style={styles.search}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              onPress={() => setStatusFilter("")}
              style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, !statusFilter && styles.filterLabelActive]}>
                All {cabins.length}
              </Text>
            </Pressable>
            {STATUS_ORDER.map((status) => {
              const meta = statusMetaFor(status);
              const active = statusFilter === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => setStatusFilter(active ? "" : status)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <View style={[styles.legendDot, { backgroundColor: meta.dot }]} />
                  <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                    {meta.short} {summary[status] || 0}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {byWing.length === 0 ? (
            <AppEmptyState
              title={search || statusFilter ? "No cabins match" : "No cabins yet"}
              description={
                search || statusFilter
                  ? "Clear the filter to see the whole floor."
                  : "Cabins added on the web app appear here."
              }
            />
          ) : (
            byWing.map((wing) => (
              <View key={wing.id} style={styles.wing}>
                <View style={styles.wingHead}>
                  <Text style={styles.wingLabel}>{wing.label}</Text>
                  {wing.hint ? <Text style={styles.wingHint}>{wing.hint}</Text> : null}
                  <View style={styles.spacer} />
                  <Text style={styles.wingCount}>{wing.cabins.length}</Text>
                </View>
                <View style={styles.grid}>
                  {wing.cabins.map((cabin, index) => (
                    <CabinTile
                      key={String(cabin._id || index)}
                      cabin={cabin}
                      onPress={() => {
                        setSelected(cabin);
                        setBlockReason(String(cabin.blockReason || ""));
                      }}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <AppSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={String(selected?.code || selected?.name || "Cabin")}
        subtitle={selectedMeta?.label}
        footer={
          canBlock && selected ? (
            <AppButton
              title={selected.isBlocked ? "Unblock cabin" : "Block cabin"}
              variant={selected.isBlocked ? "secondary" : "danger"}
              onPress={applyBlock}
              loading={busy}
              fullWidth
            />
          ) : null
        }
      >
        {selected ? (
          <AppCard>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <AppBadge
                variant={
                  selected.status === "BOOKED"
                    ? "emerald"
                    : selected.status === "VACANT"
                      ? "rose"
                      : selected.status === "RESERVED"
                        ? "amber"
                        : selected.status === "BLOCKED"
                          ? "violet"
                          : "slate"
                }
              >
                {selectedMeta?.label || "—"}
              </AppBadge>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Seats</Text>
              <Text style={styles.detailValue}>
                {seatsFor(String(selected.code || ""), selected.seats as number) || "—"}
              </Text>
            </View>
            {selectedClient ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Client</Text>
                <Text style={styles.detailValue}>{selectedClient}</Text>
              </View>
            ) : null}
            {selected.blockReason ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Block reason</Text>
                <Text style={styles.detailValue}>{selected.blockReason}</Text>
              </View>
            ) : null}
          </AppCard>
        ) : null}

        {canBlock && selected && !selected.isBlocked ? (
          <AppInput
            label="Reason for blocking"
            value={blockReason}
            onChangeText={setBlockReason}
            placeholder="Why is this cabin off the market?"
            multiline
          />
        ) : null}
      </AppSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingBottom: spacing.xxl },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: typography.caption, color: palette.slate[600] },
  search: { marginBottom: spacing.md },
  filterRow: { gap: spacing.md, paddingBottom: spacing.lg },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.slate[300],
    backgroundColor: "#ffffff",
  },
  filterChipActive: { borderColor: palette.blue[600], backgroundColor: palette.blue[50] },
  filterLabel: { fontSize: typography.label, fontWeight: "600", color: palette.slate[700] },
  filterLabelActive: { color: palette.blue[700] },
  wing: { marginBottom: spacing.xl },
  wingHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  wingLabel: { fontSize: typography.cardTitle, fontWeight: "600", color: palette.slate[900] },
  wingHint: { fontSize: typography.caption, color: palette.slate[500] },
  spacer: { flex: 1 },
  wingCount: { fontSize: typography.caption, fontWeight: "600", color: palette.slate[500] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: {
    width: 78,
    height: 62,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tilePressed: { opacity: 0.7 },
  tileCode: { fontSize: typography.body, fontWeight: "700" },
  tileSeats: { marginTop: 2, fontSize: 10, fontWeight: "600", opacity: 0.8 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailLabel: { fontSize: typography.label, color: palette.slate[500] },
  detailValue: {
    flex: 1,
    fontSize: typography.label,
    fontWeight: "600",
    color: palette.slate[800],
    textAlign: "right",
  },
});
