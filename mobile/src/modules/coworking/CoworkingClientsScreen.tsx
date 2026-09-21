import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import {
  AppBadge,
  AppCard,
  AppEmptyState,
  AppSearchInput,
  AppSheet,
  AppSkeletonList,
} from "../../components/ui";
import { palette, spacing, typography } from "../../theme/tokens";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  getClientActivity,
  getClientAssignments,
  getClientById,
  getClients,
  type CoworkingClient,
} from "../../services/coworkingService";

/*
 * Mirrors modules/coworking/clients/ClientsPage.jsx and ClientProfile.jsx.
 *
 * Web puts the list and the profile side by side; a phone opens the profile as
 * a sheet over the list, which keeps the search results in place behind it.
 */

const statusVariant = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (value === "ACTIVE") return "emerald" as const;
  if (value === "PENDING" || value === "ONBOARDING") return "amber" as const;
  if (value === "CHURNED" || value === "TERMINATED") return "rose" as const;
  return "slate" as const;
};

const kycVariant = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (value === "VERIFIED" || value === "COMPLETE") return "emerald" as const;
  if (value === "REJECTED") return "rose" as const;
  return "amber" as const;
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const CoworkingClientsScreen = () => {
  const [clients, setClients] = useState<CoworkingClient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<CoworkingClient | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getClients(search ? { search } : {});
      setClients(data.clients);
      setTotal(data.total || data.clients.length);
      setError("");
    } catch (err) {
      setError(toErrorMessage(err, "Could not load clients"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  // Debounced: search is a server parameter, so a request per keystroke is real
  // traffic on a phone.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openClient = useCallback(async (client: CoworkingClient) => {
    setSelected(client);
    setAssignments([]);
    setActivity([]);
    setDetailLoading(true);

    const id = String(client._id || "");
    // Each part is independent - a missing activity feed should not hide the
    // cabins the client actually holds.
    const [full, held, history] = await Promise.allSettled([
      getClientById(id),
      getClientAssignments(id),
      getClientActivity(id),
    ]);

    if (full.status === "fulfilled" && full.value) setSelected(full.value);
    setAssignments(held.status === "fulfilled" ? held.value : []);
    setActivity(history.status === "fulfilled" ? history.value : []);
    setDetailLoading(false);
  }, []);

  return (
    <Screen
      title="Coworking Clients"
      subtitle={total ? `${total} on file` : "Members"}
      error={error}
      onRetry={load}
    >
      <AppSearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Name, company or phone"
        style={styles.search}
      />

      {loading ? (
        <AppSkeletonList rows={4} />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item, index) => String(item._id || index)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListEmptyComponent={
            <AppEmptyState
              title={search ? "No matches" : "No clients yet"}
              description={
                search ? "Try a different name or number." : "Clients onboarded here will appear in this list."
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openClient(item)}>
              <AppCard style={styles.card} interactive>
                <View style={styles.head}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name || item.companyName || "Unnamed client"}
                  </Text>
                  <AppBadge variant={statusVariant(item.status)}>
                    {String(item.status || "—").replace(/_/g, " ")}
                  </AppBadge>
                </View>
                {item.companyName && item.name ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.companyName}
                  </Text>
                ) : null}
                <Text style={styles.meta}>{item.phone || item.email || "—"}</Text>
              </AppCard>
            </Pressable>
          )}
        />
      )}

      <AppSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={String(selected?.name || selected?.companyName || "Client")}
        subtitle={selected?.companyName && selected?.name ? selected.companyName : undefined}
      >
        {detailLoading ? (
          <AppSkeletonList rows={2} />
        ) : selected ? (
          <>
            <AppCard>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <AppBadge variant={statusVariant(selected.status)}>
                  {String(selected.status || "—").replace(/_/g, " ")}
                </AppBadge>
              </View>
              {selected.kycStatus ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>KYC</Text>
                  <AppBadge variant={kycVariant(selected.kycStatus)}>
                    {String(selected.kycStatus).replace(/_/g, " ")}
                  </AppBadge>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{selected.phone || "—"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selected.email || "—"}</Text>
              </View>
              {selected.birthday ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Birthday</Text>
                  <Text style={styles.detailValue}>{formatDate(selected.birthday)}</Text>
                </View>
              ) : null}
            </AppCard>

            <Text style={styles.sectionTitle}>Holding</Text>
            {assignments.length === 0 ? (
              <Text style={styles.empty}>No cabins or seats assigned.</Text>
            ) : (
              assignments.map((assignment: any, index: number) => (
                <AppCard key={assignment?._id || index} style={styles.subCard}>
                  <Text style={styles.assignmentCode}>
                    {assignment?.cabinCode || assignment?.code || assignment?.seatCode || "Assignment"}
                  </Text>
                  <Text style={styles.meta}>
                    {[assignment?.startDate && formatDate(assignment.startDate), assignment?.endDate && formatDate(assignment.endDate)]
                      .filter(Boolean)
                      .join(" → ") || "—"}
                  </Text>
                </AppCard>
              ))
            )}

            <Text style={styles.sectionTitle}>Recent activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.empty}>Nothing recorded yet.</Text>
            ) : (
              activity.slice(0, 8).map((entry: any, index: number) => (
                <View key={entry?._id || index} style={styles.activityRow}>
                  <Text style={styles.activityText} numberOfLines={2}>
                    {entry?.action || entry?.message || "Activity"}
                  </Text>
                  <Text style={styles.activityWhen}>{formatDate(entry?.createdAt)}</Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </AppSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  search: { marginBottom: spacing.md },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.md },
  subCard: { marginBottom: spacing.md },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: { flex: 1, fontSize: typography.body, fontWeight: "600", color: palette.slate[900] },
  meta: { marginTop: 3, fontSize: typography.label, color: palette.slate[500] },
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
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    fontSize: typography.caption,
    fontWeight: "700",
    color: palette.slate[500],
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  assignmentCode: { fontSize: typography.body, fontWeight: "600", color: palette.slate[900] },
  empty: { fontSize: typography.label, color: palette.slate[500] },
  activityRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[200],
  },
  activityText: { fontSize: typography.label, color: palette.slate[700] },
  activityWhen: { marginTop: 2, fontSize: typography.caption, color: palette.slate[500] },
});
