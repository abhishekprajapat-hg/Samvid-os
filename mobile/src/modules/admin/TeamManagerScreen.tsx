import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Screen } from "../../components/common/Screen";
import { useAuth } from "../../context/AuthContext";
import { createUser, deleteUser, getUsers, rebalanceExecutives, updateUserById } from "../../services/userService";
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

type TeamLead = {
  _id?: string;
  name?: string;
  phone?: string;
  email?: string;
  projectInterested?: string;
  status?: string;
  assignedTo?: { _id?: string; name?: string } | string | null;
  createdBy?: { _id?: string; name?: string } | string | null;
  nextFollowUp?: string;
};

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
];
const EDIT_ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Assistant Manager", value: "ASSISTANT_MANAGER" },
  { label: "Team Leader", value: "TEAM_LEADER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
];

const EXECUTIVE_ROLES = new Set(["EXECUTIVE", "FIELD_EXECUTIVE"]);
const MANAGEMENT_ROLES = new Set(["MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"]);
const getRefId = (value: { _id?: string } | string | null | undefined) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || "");
};

export const TeamManagerScreen = () => {
  const { role, user } = useAuth();
  const isAdmin = role === "ADMIN";
  const canManageUsers = isAdmin || MANAGEMENT_ROLES.has(String(role || ""));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [leads, setLeads] = useState<TeamLead[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<"USERS" | "MANAGERS" | "EXECUTIVES" | "LEADS" | "CLOSED" | "UNASSIGNED">("USERS");
  const [editOpen, setEditOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("EXECUTIVE");
  const [editManagerId, setEditManagerId] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [listAnchorY, setListAnchorY] = useState(0);
  const [slideAnim] = useState(() => new Animated.Value(320));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleDraft, setRoleDraft] = useState("MANAGER");
  const [managerId, setManagerId] = useState("");
  const currentUserId = String(user?._id || (user as any)?.id || "");

  const scrollRef = React.useRef<ScrollView | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [userPayload, leadRows] = await Promise.all([getUsers(), getAllLeads()]);
      setUsers((userPayload?.users || []) as TeamUser[]);
      setLeads((leadRows || []) as TeamLead[]);
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

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const managers = useMemo(
    () => users.filter((u) => u.role === "MANAGER" && u.isActive !== false),
    [users],
  );
  const editManagerOptions = useMemo(
    () =>
      users.filter((u) =>
        ["MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"].includes(String(u.role || "")) && u.isActive !== false,
      ),
    [users],
  );

  const workload = useMemo(() => {
    const map = new Map<string, { total: number; converted: number }>();
    leads.forEach((lead) => {
      const id = getRefId(lead.assignedTo);
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
    const unassigned = leads.filter((lead) => !getRefId(lead.assignedTo)).length;
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

  const metricOptions = useMemo(
    () => [
      { key: "USERS" as const, label: "Users", value: stats.totalUsers },
      { key: "MANAGERS" as const, label: "Managers", value: stats.managerCount },
      { key: "EXECUTIVES" as const, label: "Executives", value: stats.executiveCount },
      { key: "LEADS" as const, label: "Leads", value: stats.totalLeads },
      { key: "CLOSED" as const, label: "Closed", value: stats.converted },
      { key: "UNASSIGNED" as const, label: "Unassigned", value: stats.unassigned },
    ],
    [stats],
  );

  const filteredUsers = useMemo(() => {
    const activeUsers = users.filter((row) => row.isActive !== false);
    if (selectedMetric === "USERS") return activeUsers;
    if (selectedMetric === "MANAGERS") return activeUsers.filter((row) => row.role === "MANAGER");
    if (selectedMetric === "EXECUTIVES") return activeUsers.filter((row) => EXECUTIVE_ROLES.has(String(row.role || "")));
    return [];
  }, [selectedMetric, users]);

  const filteredLeads = useMemo(() => {
    if (selectedMetric === "LEADS") return leads;
    if (selectedMetric === "CLOSED") return leads.filter((row) => String(row.status || "").toUpperCase() === "CLOSED");
    if (selectedMetric === "UNASSIGNED") return leads.filter((row) => {
      const assignee = row.assignedTo;
      if (!assignee) return true;
      if (typeof assignee === "string") return !assignee;
      return !assignee._id;
    });
    return [];
  }, [leads, selectedMetric]);

  const editableUserIds = useMemo(() => {
    if (isAdmin) return new Set(users.map((u) => String(u._id || "")));
    if (!canManageUsers) return new Set<string>();

    const childrenByParent = new Map<string, string[]>();
    users.forEach((member) => {
      const parentId =
        typeof member.parentId === "object" ? String(member.parentId?._id || "") : String(member.parentId || "");
      const id = String(member._id || "");
      if (!parentId || !id) return;
      const rows = childrenByParent.get(parentId) || [];
      rows.push(id);
      childrenByParent.set(parentId, rows);
    });

    const allowed = new Set<string>();
    const queue = [...(childrenByParent.get(currentUserId) || [])];
    while (queue.length > 0) {
      const id = String(queue.shift() || "");
      if (!id || allowed.has(id)) continue;
      allowed.add(id);
      (childrenByParent.get(id) || []).forEach((next) => queue.push(next));
    }
    return allowed;
  }, [canManageUsers, currentUserId, isAdmin, users]);

  const openEditSheet = (target: TeamUser) => {
    const targetId = String(target._id || "");
    if (!targetId || !editableUserIds.has(targetId)) return;

    setEditingUserId(targetId);
    setEditName(String(target.name || ""));
    setEditPhone(String(target.phone || ""));
    setEditRole(String(target.role || "EXECUTIVE"));
    setEditManagerId(typeof target.parentId === "object" ? String(target.parentId?._id || "") : String(target.parentId || ""));
    setEditActive(target.isActive !== false);
    setEditOpen(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

  const closeEditSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 320,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setEditOpen(false);
      setEditingUserId("");
      setEditName("");
      setEditPhone("");
      setEditRole("EXECUTIVE");
      setEditManagerId("");
      setEditActive(true);
    });
  };

  const saveEditedUser = async () => {
    if (!editingUserId) return;
    try {
      setEditSaving(true);
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        isActive: editActive,
      };
      if (isAdmin) {
        payload.role = editRole;
        if (editManagerId) payload.managerId = editManagerId;
      }
      await updateUserById(editingUserId, payload as any);
      closeEditSheet();
      await load(true);
      setSuccess("User updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update user"));
    } finally {
      setEditSaving(false);
    }
  };

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

  if (!canManageUsers) {
    return (
      <Screen title="Team Manager" subtitle="Users + Workload" loading={loading} error={error}>
        <View style={styles.accessCard}>
          <Text style={styles.accessText}>Access denied. Only ADMIN/MANAGER/TEAM LEADERS can manage team users.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Team Manager" subtitle="Users + Workload" loading={loading} error={error}>
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.container}
      >
        <View style={styles.topRow}>
          <AppButton title={refreshing ? "Refreshing..." : "Refresh"} variant="ghost" onPress={() => load(true)} />
          {isAdmin ? (
            <AppButton
              title={rebalancing ? "Rebalancing..." : "Rebalance Executives"}
              variant="ghost"
              onPress={rebalance}
              disabled={rebalancing}
            />
          ) : null}
        </View>

        <View style={styles.metricsWrap}>
          {metricOptions.map((metric) => (
            <Metric
              key={metric.key}
              label={metric.label}
              value={metric.value}
              active={selectedMetric === metric.key}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSelectedMetric(metric.key);
                setTimeout(() => {
                  scrollRef.current?.scrollTo({ y: Math.max(0, listAnchorY - 16), animated: true });
                }, 60);
              }}
            />
          ))}
        </View>

        <Text style={styles.activeMetricText}>
          Showing: {metricOptions.find((row) => row.key === selectedMetric)?.label || "Users"}
        </Text>

        {isAdmin ? (
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
        ) : null}

        <View onLayout={(event) => setListAnchorY(event.nativeEvent.layout.y)}>
        {selectedMetric === "USERS" || selectedMetric === "MANAGERS" || selectedMetric === "EXECUTIVES" ? (
          <FlatList
            data={filteredUsers}
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
                  <Text style={styles.meta}>Phone: {item.phone || "-"}</Text>
                  <Text style={styles.meta}>Role: {item.role || "-"}</Text>
                  <Text style={styles.meta}>Manager: {managerName}</Text>
                  <Text style={styles.meta}>Assigned Leads: {itemWork.total}</Text>
                  <Text style={styles.meta}>Converted Leads: {itemWork.converted}</Text>

                  <AppButton
                    title="Edit"
                    variant="ghost"
                    style={styles.editBtn as object}
                    onPress={() => openEditSheet(item)}
                    disabled={!editableUserIds.has(userId)}
                  />
                  {isAdmin ? (
                    <AppButton
                      title={isSelf ? "Current User" : deletingId === userId ? "Deleting..." : "Delete"}
                      variant="ghost"
                      style={[styles.deleteBtn as object, (isSelf || deletingId === userId) && styles.deleteBtnDisabled]}
                      onPress={() => remove(userId, item.name)}
                      disabled={isSelf || deletingId === userId}
                    />
                  ) : null}
                </AppCard>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No users found for this filter.</Text>}
          />
        ) : (
          <FlatList
            data={filteredLeads}
            scrollEnabled={false}
            keyExtractor={(item) => String(item._id)}
            renderItem={({ item }) => {
              const assignedName =
                typeof item.assignedTo === "object"
                  ? item.assignedTo?.name || "-"
                  : item.assignedTo ? String(item.assignedTo) : "Unassigned";
              const createdByName =
                typeof item.createdBy === "object"
                  ? item.createdBy?.name || "-"
                  : item.createdBy ? String(item.createdBy) : "-";

              return (
                <AppCard style={styles.card as object}>
                  <Text style={styles.name}>{item.name || "Unnamed Lead"}</Text>
                  <Text style={styles.meta}>Phone: {item.phone || "-"}</Text>
                  <Text style={styles.meta}>Email: {item.email || "-"}</Text>
                  <Text style={styles.meta}>Project: {item.projectInterested || "-"}</Text>
                  <Text style={styles.meta}>Status: {item.status || "-"}</Text>
                  <Text style={styles.meta}>Assigned To: {assignedName || "Unassigned"}</Text>
                  <Text style={styles.meta}>Created By: {createdByName}</Text>
                  <Text style={styles.meta}>Next Follow-up: {item.nextFollowUp || "-"}</Text>
                </AppCard>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No leads found for this filter.</Text>}
          />
        )}
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="none" onRequestClose={closeEditSheet}>
        <Pressable style={styles.sheetBackdrop} onPress={closeEditSheet} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Animated.View style={[styles.sheetCard, { transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.sheetTitle}>Edit User</Text>
            <AppInput style={styles.input as object} value={editName} onChangeText={setEditName} placeholder="Name" />
            <AppInput style={styles.input as object} value={editPhone} onChangeText={setEditPhone} placeholder="Phone" keyboardType="phone-pad" />

            {isAdmin ? (
              <>
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleRow}>
                  {EDIT_ROLE_OPTIONS.map((opt) => (
                    <AppChip key={opt.value} label={opt.label} active={editRole === opt.value} onPress={() => setEditRole(opt.value)} />
                  ))}
                </View>
                {EXECUTIVE_ROLES.has(editRole) ? (
                  <>
                    <Text style={styles.label}>Manager</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
                      <AppChip label="No Change" active={editManagerId === ""} onPress={() => setEditManagerId("")} />
                      {editManagerOptions.map((manager) => (
                        <AppChip
                          key={String(manager._id)}
                          label={manager.name}
                          active={editManagerId === manager._id}
                          onPress={() => setEditManagerId(String(manager._id || ""))}
                        />
                      ))}
                    </ScrollView>
                  </>
                ) : null}
              </>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.meta}>Active</Text>
              <Switch value={editActive} onValueChange={setEditActive} />
            </View>
            <View style={styles.sheetActions}>
              <AppButton title="Cancel" variant="ghost" onPress={closeEditSheet} />
              <AppButton title={editSaving ? "Saving..." : "Save"} onPress={saveEditedUser} disabled={editSaving} />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
};

const Metric = ({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: number;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable style={[styles.metricCard, active && styles.metricCardActive]} onPress={onPress}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, active && styles.metricValueActive]}>{value}</Text>
  </Pressable>
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
  metricCardActive: {
    borderColor: "#0f172a",
    backgroundColor: "#f8fafc",
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
  metricValueActive: {
    color: "#0f172a",
  },
  activeMetricText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
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
  editBtn: { marginTop: 10, height: 36 },
  deleteBtnDisabled: {
    opacity: 0.6,
  },
  emptyText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheetCard: {
    marginTop: "auto",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  sheetTitle: {
    fontWeight: "700",
    color: "#0f172a",
    fontSize: 15,
    marginBottom: 6,
  },
  switchRow: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 8,
  },
});
