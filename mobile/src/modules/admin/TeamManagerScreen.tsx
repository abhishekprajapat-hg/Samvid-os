import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../../components/common/Screen";
import { useAuth } from "../../context/AuthContext";
import { createUser, deleteUser, getUsers, rebalanceExecutives } from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { colors } from "../../theme/tokens";

type TeamUser = {
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  parentId?: { _id?: string; name?: string; role?: string } | string | null;
};

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
];

const EXECUTIVE_ROLES = new Set(["EXECUTIVE", "FIELD_EXECUTIVE"]);

export const TeamManagerScreen = () => {
  const { role, user } = useAuth();
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [leads, setLeads] = useState<Array<{ _id: string; status?: string; assignedTo?: { _id?: string } }>>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleDraft, setRoleDraft] = useState("MANAGER");
  const [managerId, setManagerId] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [userPayload, leadRows] = await Promise.all([getUsers(), getAllLeads()]);
      setUsers((userPayload?.users || []) as TeamUser[]);
      setLeads(leadRows || []);
      setError("");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load team"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const managers = useMemo(
    () => users.filter((u) => u.role === "MANAGER" && u.isActive !== false),
    [users],
  );

  const workload = useMemo(() => {
    const map = new Map<string, { total: number; converted: number }>();
    leads.forEach((lead) => {
      const id = lead.assignedTo?._id;
      if (!id) return;
      const current = map.get(String(id)) || { total: 0, converted: 0 };
      current.total += 1;
      if (lead.status === "CLOSED") {
        current.converted += 1;
      }
      map.set(String(id), current);
    });
    return map;
  }, [leads]);

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.isActive !== false);
    const managerCount = activeUsers.filter((u) => u.role === "MANAGER").length;
    const executiveCount = activeUsers.filter((u) => EXECUTIVE_ROLES.has(String(u.role || ""))).length;
    const unassigned = leads.filter((lead) => !lead.assignedTo?._id).length;
    const converted = leads.filter((lead) => lead.status === "CLOSED").length;

    return {
      totalUsers: activeUsers.length,
      managerCount,
      executiveCount,
      totalLeads: leads.length,
      converted,
      unassigned,
    };
  }, [leads, users]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRoleDraft("MANAGER");
    setManagerId("");
  };

  const addUser = async () => {
    if (!isAdmin) return;
    const safeName = name.trim();
    const safeEmail = email.trim().toLowerCase();

    if (!safeName || !safeEmail || !password.trim()) {
      setError("Name, email and password are required");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload: Record<string, string> = {
        name: safeName,
        email: safeEmail,
        phone: phone.trim(),
        password: password.trim(),
        role: roleDraft,
      };

      if (EXECUTIVE_ROLES.has(roleDraft) && managerId) {
        payload.managerId = managerId;
      }

      await createUser(payload);
      resetForm();
      await load(true);
      setSuccess("User created");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to create user"));
    } finally {
      setSaving(false);
    }
  };

  const rebalance = async () => {
    if (!isAdmin) return;
    try {
      setRebalancing(true);
      await rebalanceExecutives();
      await load(true);
      setSuccess("Executives rebalanced");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to rebalance"));
    } finally {
      setRebalancing(false);
    }
  };

  const remove = async (userId: string, userName: string) => {
    if (!isAdmin || !userId) return;
    if (String(user?._id || user?.id || "") === String(userId)) {
      setError("You cannot delete your own account");
      return;
    }

    Alert.alert("Delete user", `Delete "${userName}"? Assigned leads will be unassigned.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingId(userId);
            await deleteUser(userId);
            await load(true);
            setSuccess("User deleted");
          } catch (e) {
            setError(toErrorMessage(e, "Failed to delete user"));
          } finally {
            setDeletingId("");
          }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <Screen title="Team Manager" subtitle="Users + Workload" loading={loading} error={error}>
        <View style={styles.accessCard}>
          <Text style={styles.accessText}>Access denied. Only ADMIN can manage users.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Team Manager" subtitle="Users + Workload" loading={loading} error={error}>
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.container}
      >
        <View style={styles.topRow}>
          <AppButton title={refreshing ? "Refreshing..." : "Refresh"} variant="ghost" onPress={() => load(true)} />
          <AppButton
            title={rebalancing ? "Rebalancing..." : "Rebalance Executives"}
            variant="ghost"
            onPress={rebalance}
            disabled={rebalancing}
          />
        </View>

        <View style={styles.metricsWrap}>
          <Metric label="Users" value={stats.totalUsers} />
          <Metric label="Managers" value={stats.managerCount} />
          <Metric label="Executives" value={stats.executiveCount} />
          <Metric label="Leads" value={stats.totalLeads} />
          <Metric label="Closed" value={stats.converted} />
          <Metric label="Unassigned" value={stats.unassigned} />
        </View>

        <AppCard style={styles.form as object}>
          <Text style={styles.formTitle}>Create User</Text>
          <AppInput style={styles.input as object} value={name} onChangeText={setName} placeholder="Name" />
          <AppInput style={styles.input as object} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
          <AppInput style={styles.input as object} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
          <AppInput style={styles.input as object} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />

          <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((opt) => (
                <AppChip
                  key={opt.value}
                  label={opt.label}
                  active={roleDraft === opt.value}
                  onPress={() => {
                    setRoleDraft(opt.value);
                    setManagerId("");
                  }}
                />
              ))}
            </View>

          {EXECUTIVE_ROLES.has(roleDraft) ? (
            <>
              <Text style={styles.label}>Manager (optional, auto if empty)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
                <AppChip label="Auto Assign" active={managerId === ""} onPress={() => setManagerId("")} />
                {managers.map((manager) => (
                  <AppChip
                    key={String(manager._id)}
                    label={manager.name}
                    active={managerId === manager._id}
                    onPress={() => setManagerId(String(manager._id || ""))}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          <AppButton title={saving ? "Creating..." : "Create User"} onPress={addUser} disabled={saving} />
        </AppCard>

        <FlatList
          data={users}
          scrollEnabled={false}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => {
            const userId = String(item._id || "");
            const itemWork = workload.get(userId) || { total: 0, converted: 0 };
            const isSelf = String(user?._id || user?.id || "") === userId;

            const managerName =
              typeof item.parentId === "object"
                ? item.parentId?.name || "-"
                : "-";

            return (
              <AppCard style={styles.card as object}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.email || "-"}</Text>
                <Text style={styles.meta}>Role: {item.role || "-"}</Text>
                <Text style={styles.meta}>Manager: {managerName}</Text>
                <Text style={styles.meta}>Assigned Leads: {itemWork.total}</Text>
                <Text style={styles.meta}>Converted Leads: {itemWork.converted}</Text>

                <AppButton
                  title={isSelf ? "Current User" : deletingId === userId ? "Deleting..." : "Delete"}
                  variant="ghost"
                  style={[styles.deleteBtn as object, (isSelf || deletingId === userId) && styles.deleteBtnDisabled]}
                  onPress={() => remove(userId, item.name)}
                  disabled={isSelf || deletingId === userId}
                />
              </AppCard>
            );
          }}
        />
      </ScrollView>
    </Screen>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 14,
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
  accessCard: {
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    padding: 12,
  },
  accessText: {
    color: "#92400e",
    fontWeight: "600",
  },
  topRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "31%",
    minWidth: 95,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 8,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: "#64748b",
  },
  metricValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  form: {},
  formTitle: {
    marginBottom: 10,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  label: {
    marginBottom: 6,
    marginTop: 2,
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  input: { marginBottom: 8 },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 2,
  },
  card: { marginBottom: 8 },
  name: {
    fontWeight: "700",
    color: colors.text,
    fontSize: 15,
  },
  meta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
  },
  deleteBtn: { marginTop: 10, height: 36, borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  deleteBtnDisabled: {
    opacity: 0.6,
  },
});
