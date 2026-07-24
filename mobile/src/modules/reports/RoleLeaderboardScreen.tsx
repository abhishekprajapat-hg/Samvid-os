import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/common/Screen";
import { AppCard } from "../../components/common/ui";
import api from "../../services/api";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { Lead, User } from "../../types";

const roleLabel = (value?: string) => String(value || "User").replace(/_/g, " ");

export const RoleLeaderboardScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [leadRes, userRes] = await Promise.all([api.get("/leads"), getUsers()]);
      setLeads(Array.isArray(leadRes.data?.leads) ? leadRes.data.leads : []);
      setUsers(Array.isArray(userRes.users) ? userRes.users : []);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load leaderboard"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return users
      .filter((user) => user.isActive !== false)
      .map((user) => {
        const userId = String(user._id || user.id || "");
        const assigned = leads.filter((lead) => {
          const assignee = lead.assignedTo as any;
          return String(assignee?._id || assignee?.id || assignee || "") === userId;
        });
        const closed = assigned.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED").length;
        const visits = assigned.filter((lead) => String(lead.status || "").toUpperCase() === "SITE_VISIT").length;
        const score = assigned.length + closed * 3 + visits * 2;
        return { user, assigned: assigned.length, closed, visits, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
  }, [leads, users]);

  return (
    <Screen title="Leaderboard" subtitle="Role Performance" loading={loading} error={error}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <AppCard>
          {rows.length === 0 ? (
            <Text style={styles.meta}>No leaderboard data available.</Text>
          ) : (
            rows.map((row, index) => (
              <View key={String(row.user._id || row.user.id || index)} style={styles.row}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{row.user.name || "User"}</Text>
                  <Text style={styles.meta}>{roleLabel(row.user.role)}</Text>
                  <Text style={styles.meta}>
                    Leads {row.assigned} | Visits {row.visits} | Closed {row.closed}
                  </Text>
                </View>
                <Text style={styles.score}>{row.score}</Text>
              </View>
            ))
          )}
        </AppCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  rank: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rankText: {
    color: "#0369a1",
    fontSize: 11,
    fontWeight: "700",
  },
  info: {
    flex: 1,
  },
  name: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  meta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 11,
  },
  score: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
});
