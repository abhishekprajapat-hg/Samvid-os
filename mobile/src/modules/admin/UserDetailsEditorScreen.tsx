import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import { getUserProfileById, getUsers, updateUserByAdmin } from "../../services/userService";
import {
  getAdminLeaveRequests,
  getLeaveBalanceForAdmin,
  getUserAttendanceForAdmin,
} from "../../services/attendanceService";
import { getProjectsWithMeta } from "../../services/projectService";
import { getTasks } from "../../services/taskService";
import { toErrorMessage } from "../../utils/errorMessage";
import { themedStyles } from "../../theme/themedStyles";

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Production Executive", value: "PRODUCTION_EXECUTIVE" },
  { label: "Community Manager", value: "COMMUNITY_MANAGER" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
  { label: "Coworking admin", value: "COWORKING_ADMIN" },
];

const REPORTING_PARENT_ROLES: Record<string, string[]> = {
  MANAGER: ["ADMIN"],
  EXECUTIVE: ["MANAGER"],
  FIELD_EXECUTIVE: ["MANAGER"],
  PRODUCTION_EXECUTIVE: ["MANAGER"],
  COMMUNITY_MANAGER: ["MANAGER"],
  CHANNEL_PARTNER: ["MANAGER"],
  // Every role except Admin reports to a Manager.
  COWORKING_ADMIN: ["MANAGER"],
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  COMMUNITY_MANAGER: "Community Manager",
  CHANNEL_PARTNER: "Channel Partner",
  COWORKING_ADMIN: "Coworking admin",
};

const getEntityId = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const monthValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const shiftMonth = (value: string, delta: number) => {
  const [year, month] = value.split("-").map(Number);
  return monthValue(new Date(year, Math.max(1, month) - 1 + delta, 1));
};

const buildCalendar = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  const first = new Date(year, Math.max(1, month) - 1, 1);
  const days = new Date(year, Math.max(1, month), 0).getDate();
  const mondayOffset = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: mondayOffset }, (_, index) => ({ key: `blank-${index}`, day: 0, date: "" })),
    ...Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      return { key: String(day), day, date: `${value}-${String(day).padStart(2, "0")}` };
    }),
  ];
};

export const UserDetailsEditorScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const userId = String(route.params?.userId || "");
  const currentUserId = String(user?._id || (user as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(monthValue());
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState("");
  const [attendanceData, setAttendanceData] = useState<any>({ summary: {}, attendance: [] });
  const [tasks, setTasks] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [leaveRows, setLeaveRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "MANAGER",
    reportingToId: "",
    isActive: true,
    canViewInventory: false,
    password: "",
  });

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      const [profileData, usersData] = await Promise.all([getUserProfileById(userId), getUsers()]);
      const resolvedProfile = profileData?.profile || null;
      const rows = Array.isArray(usersData?.users) ? usersData.users : [];
      if (!resolvedProfile) {
        setProfile(null);
        setUsers(rows);
        return;
      }
      setProfile(resolvedProfile);
      setUsers(rows);
      setFormData({
        name: String(resolvedProfile.name || ""),
        email: String(resolvedProfile.email || ""),
        phone: String(resolvedProfile.phone || ""),
        role: String(resolvedProfile.role || "MANAGER"),
        reportingToId: getEntityId(resolvedProfile.parentId),
        isActive: Boolean(resolvedProfile.isActive),
        canViewInventory: Boolean(resolvedProfile.canViewInventory),
        password: "",
      });
    } catch (loadError) {
      setError(toErrorMessage(loadError, "Failed to load user details"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadInsights = useCallback(async () => {
    if (!userId) return;
    try {
      setInsightsLoading(true);
      setInsightsError("");
      const [attendance, taskRows, balance, approvedLeave, projectPayload] = await Promise.all([
        getUserAttendanceForAdmin(userId, { month: attendanceMonth }).catch(() => ({ summary: {}, attendance: [] })),
        getTasks({ assignedTo: userId }).catch(() => []),
        profile?.role === "ADMIN"
          ? Promise.resolve(null)
          : getLeaveBalanceForAdmin(userId, { month: attendanceMonth }).catch(() => null),
        profile?.role === "ADMIN"
          ? Promise.resolve([])
          : getAdminLeaveRequests({ userId, status: "APPROVED" }).catch(() => []),
        getProjectsWithMeta({ createdBy: userId, limit: 200 }).catch(() => ({ projects: [] })),
      ]);
      setAttendanceData(attendance);
      setTasks(Array.isArray(taskRows) ? taskRows : []);
      setLeaveBalance(balance);
      setLeaveRows(Array.isArray(approvedLeave) ? approvedLeave : []);
      setProjects(Array.isArray(projectPayload?.projects) ? projectPayload.projects : []);
    } catch (insightError) {
      setInsightsError(toErrorMessage(insightError, "Failed to load activity details"));
    } finally {
      setInsightsLoading(false);
    }
  }, [attendanceMonth, profile?.role, userId]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const allowedParentRoles = useMemo(() => REPORTING_PARENT_ROLES[formData.role] || [], [formData.role]);
  const needsReporting = allowedParentRoles.length > 0;
  const isEditingSelf = String(currentUserId || "") === String(userId || "");

  const reportingCandidates = useMemo(() => {
    if (!allowedParentRoles.length) return [];
    return users.filter((row) => {
      const candidateId = String(row?._id || "");
      return row?.isActive && allowedParentRoles.includes(String(row?.role || "")) && candidateId !== userId;
    });
  }, [allowedParentRoles, userId, users]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of attendanceData?.attendance || []) {
      const date = String(row?.attendanceDate || row?.date || "").slice(0, 10);
      if (date) map.set(date, row);
    }
    return map;
  }, [attendanceData]);
  const calendarDays = useMemo(() => buildCalendar(attendanceMonth), [attendanceMonth]);
  const taskStats = useMemo(() => {
    const completed = tasks.filter((task) => String(task.status || "") === "COMPLETED").length;
    const inProgress = tasks.filter((task) => String(task.status || "") === "IN_PROGRESS").length;
    const overdue = tasks.filter((task) => {
      if (!task.dueDate || String(task.status || "") === "COMPLETED") return false;
      return new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
    }).length;
    return { total: tasks.length, completed, inProgress, overdue };
  }, [tasks]);
  const leaveTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of leaveRows) {
      const key = String(row?.leaveType || "OTHER").replaceAll("_", " ");
      counts.set(key, (counts.get(key) || 0) + Number(row?.days || 0));
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [leaveRows]);
  const projectStats = useMemo(() => {
    const result = { total: projects.length, active: 0, completed: 0, upcoming: 0 };
    for (const project of projects) {
      const status = String(project?.status || "").toUpperCase();
      if (["COMPLETED", "DELIVERED", "SOLD_OUT"].includes(status)) result.completed += 1;
      else if (["UPCOMING", "PLANNED", "DRAFT"].includes(status)) result.upcoming += 1;
      else result.active += 1;
    }
    return result;
  }, [projects]);

  useEffect(() => {
    if (!needsReporting) {
      if (formData.reportingToId !== "") {
        setFormData((prev) => ({ ...prev, reportingToId: "" }));
      }
      return;
    }
    const hasSelectedParent = reportingCandidates.some(
      (candidate) => String(candidate?._id || "") === String(formData.reportingToId || ""),
    );
    if (!hasSelectedParent) {
      setFormData((prev) => ({ ...prev, reportingToId: "" }));
    }
  }, [formData.reportingToId, needsReporting, reportingCandidates]);

  const handleSave = async () => {
    if (!profile || !userId) return;
    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim().toLowerCase();
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }
    const payload: Record<string, any> = {
      name,
      email,
      phone: String(formData.phone || "").trim(),
      role: formData.role,
      reportingToId: needsReporting ? formData.reportingToId : null,
      isActive: Boolean(formData.isActive),
      canViewInventory: formData.role === "CHANNEL_PARTNER" ? Boolean(formData.canViewInventory) : false,
    };
    const password = String(formData.password || "").trim();
    if (password) payload.password = password;
    try {
      setSaving(true);
      setError("");
      const updated = await updateUserByAdmin(userId, payload as any);
      if (!updated) {
        await loadData();
      } else {
        setProfile(updated);
        setFormData((prev) => ({
          ...prev,
          name: updated.name || "",
          email: updated.email || "",
          phone: updated.phone || "",
          role: updated.role || prev.role,
          reportingToId: getEntityId(updated.parentId),
          isActive: Boolean(updated.isActive),
          canViewInventory: Boolean(updated.canViewInventory),
          password: "",
        }));
      }
      setSuccess("User updated");
    } catch (saveError) {
      setError(toErrorMessage(saveError, "Failed to update user"));
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <Screen title="User Editor" subtitle="Admin User Details" error="Missing userId">
        <AppButton title="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen title="User Editor" subtitle="Admin User Details" loading={loading} error={error}>
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <AppButton title="Back to Users" variant="ghost" onPress={() => navigation.goBack()} />

      {!profile ? (
        <AppCard style={styles.sectionCard as object}>
          <Text style={styles.meta}>User not found or inaccessible.</Text>
        </AppCard>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {isEditingSelf ? (
            <AppCard style={styles.warningCard as object}>
              <Text style={styles.warningText}>Editing your own account is blocked here. Please update your account from the profile page.</Text>
            </AppCard>
          ) : null}

          <AppCard style={styles.sectionCard as object}>
            <Text style={styles.sectionTitle}>{profile.name || "User"}</Text>
            <Text style={styles.meta}>{ROLE_LABELS[profile.role] || profile.role || "-"}</Text>

            <Text style={styles.label}>Name</Text>
            <AppInput value={formData.name} onChangeText={(value) => setFormData((prev) => ({ ...prev, name: value }))} />

            <Text style={styles.label}>Email</Text>
            <AppInput
              value={formData.email}
              onChangeText={(value) => setFormData((prev) => ({ ...prev, email: value }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Phone</Text>
            <AppInput value={formData.phone} onChangeText={(value) => setFormData((prev) => ({ ...prev, phone: value }))} keyboardType="phone-pad" />

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((option) => (
                <AppChip
                  key={option.value}
                  label={option.label}
                  active={formData.role === option.value}
                  onPress={() => {
                    setFormData((prev) => ({
                      ...prev,
                      role: option.value,
                      reportingToId: "",
                      canViewInventory: option.value === "CHANNEL_PARTNER" ? prev.canViewInventory : false,
                    }));
                  }}
                />
              ))}
            </View>

            {needsReporting ? (
              <>
                <Text style={styles.label}>Reporting To ({allowedParentRoles.map((row) => ROLE_LABELS[row] || row).join(" / ")})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
                  <AppChip
                    label="Auto Assign"
                    active={formData.reportingToId === ""}
                    onPress={() => setFormData((prev) => ({ ...prev, reportingToId: "" }))}
                  />
                  {reportingCandidates.map((candidate) => {
                    const candidateId = String(candidate?._id || "");
                    return (
                      <AppChip
                        key={candidateId}
                        label={`${candidate.name} (${ROLE_LABELS[candidate.role] || candidate.role})`}
                        active={formData.reportingToId === candidateId}
                        onPress={() => setFormData((prev) => ({ ...prev, reportingToId: candidateId }))}
                      />
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.label}>Reset Password</Text>
            <AppInput
              value={formData.password}
              onChangeText={(value) => setFormData((prev) => ({ ...prev, password: value }))}
              placeholder="Leave blank to keep current password"
              secureTextEntry
            />

            <View style={styles.switchRow}>
              <Text style={styles.meta}>Active User</Text>
              <Switch value={formData.isActive} onValueChange={(value) => setFormData((prev) => ({ ...prev, isActive: value }))} />
            </View>

            {formData.role === "CHANNEL_PARTNER" ? (
              <View style={styles.switchRow}>
                <Text style={styles.meta}>Can View Inventory</Text>
                <Switch value={formData.canViewInventory} onValueChange={(value) => setFormData((prev) => ({ ...prev, canViewInventory: value }))} />
              </View>
            ) : null}

            <AppButton title={saving ? "Saving..." : "Save Changes"} onPress={handleSave} disabled={saving || isEditingSelf} />
          </AppCard>

          {insightsError ? (
            <Pressable style={styles.warningCard} onPress={() => loadInsights()} accessibilityRole="button">
              <Text style={styles.warningText}>{insightsError} Tap to retry.</Text>
            </Pressable>
          ) : null}

          <AppCard style={styles.sectionCard as object}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Attendance Calendar</Text>
                <Text style={styles.meta}>{attendanceMonth} {insightsLoading ? "· Loading…" : ""}</Text>
              </View>
              <View style={styles.monthActions}>
                <AppButton title="‹" variant="ghost" onPress={() => setAttendanceMonth((value) => shiftMonth(value, -1))} />
                <AppButton title="Today" variant="ghost" onPress={() => setAttendanceMonth(monthValue())} />
                <AppButton title="›" variant="ghost" onPress={() => setAttendanceMonth((value) => shiftMonth(value, 1))} />
              </View>
            </View>

            <View style={styles.statsGrid}>
              {[
                ["Present", attendanceData?.summary?.presentDays || attendanceData?.summary?.present || 0],
                ["Half days", attendanceData?.summary?.halfDays || 0],
                ["Leave", attendanceData?.summary?.leaveDays || 0],
                ["Absent", attendanceData?.summary?.absentDays || attendanceData?.summary?.absent || 0],
                ["Late", attendanceData?.summary?.lateDays || 0],
                ["Hours", Math.round(Number(attendanceData?.summary?.workedMinutes || 0) / 60)],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.statTile}>
                  <Text style={styles.statValue}>{String(value)}</Text>
                  <Text style={styles.statLabel}>{String(label)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.weekHeader}>
              {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.weekLabel}>{label}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day) => {
                const row = day.date ? attendanceByDate.get(day.date) : null;
                const status = String(row?.status || "").replaceAll("_", " ");
                return (
                  <View key={day.key} style={[styles.dayCell, !day.date && styles.dayCellBlank]}>
                    {day.date ? (
                      <>
                        <Text style={styles.dayNumber}>{day.day}</Text>
                        <Text style={styles.dayStatus} numberOfLines={1}>{status ? status.slice(0, 3) : "—"}</Text>
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </AppCard>

          <AppCard style={styles.sectionCard as object}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Task History</Text>
                <Text style={styles.meta}>{taskStats.total} assigned tasks</Text>
              </View>
              <AppButton title="Refresh" variant="ghost" onPress={() => loadInsights()} disabled={insightsLoading} />
            </View>
            <View style={styles.statsGrid}>
              {[
                ["Total", taskStats.total],
                ["Completed", taskStats.completed],
                ["In progress", taskStats.inProgress],
                ["Overdue", taskStats.overdue],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.statTile}>
                  <Text style={styles.statValue}>{String(value)}</Text>
                  <Text style={styles.statLabel}>{String(label)}</Text>
                </View>
              ))}
            </View>
            {tasks.length === 0 ? <Text style={styles.meta}>No tasks assigned to this user yet.</Text> : null}
            {tasks.slice(0, 12).map((task) => (
              <Pressable
                key={task._id}
                style={styles.detailRow}
                onPress={() => navigation.navigate("TaskDetails", { taskId: task._id })}
                accessibilityRole="button"
              >
                <View style={styles.detailCopy}>
                  <Text style={styles.detailTitle} numberOfLines={1}>{task.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {task.status || "TODO"} · {task.priority || "MEDIUM"} · Due {formatDate(task.dueDate)}
                  </Text>
                </View>
                <Text style={styles.linkText}>Open</Text>
              </Pressable>
            ))}
          </AppCard>

          <AppCard style={styles.sectionCard as object}>
            <Text style={styles.sectionTitle}>Leave Summary</Text>
            {profile.role === "ADMIN" ? (
              <Text style={styles.meta}>Admin users do not accrue leave.</Text>
            ) : (
              <>
                <View style={styles.statsGrid}>
                  {[
                    ["Accrued", leaveBalance?.accrued || 0],
                    ["Used", leaveBalance?.used || 0],
                    ["Pending", leaveBalance?.pending || 0],
                    ["Available", leaveBalance?.available || 0],
                    ["Carry forward", leaveBalance?.carryForward || 0],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={styles.statTile}>
                      <Text style={styles.statValue}>{String(value)}</Text>
                      <Text style={styles.statLabel}>{String(label)}</Text>
                    </View>
                  ))}
                </View>
                {leaveTypes.length ? (
                  leaveTypes.map(([label, days]) => (
                    <View key={label} style={styles.simpleRow}>
                      <Text style={styles.detailTitle}>{label}</Text>
                      <Text style={styles.meta}>{days} day{days === 1 ? "" : "s"}</Text>
                    </View>
                  ))
                ) : <Text style={styles.meta}>No approved leave in the selected history.</Text>}
              </>
            )}
          </AppCard>

          <AppCard style={styles.sectionCard as object}>
            <Text style={styles.sectionTitle}>Project Assignment</Text>
            <View style={styles.statsGrid}>
              {[
                ["Total", projectStats.total],
                ["Active", projectStats.active],
                ["Completed", projectStats.completed],
                ["Upcoming", projectStats.upcoming],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.statTile}>
                  <Text style={styles.statValue}>{String(value)}</Text>
                  <Text style={styles.statLabel}>{String(label)}</Text>
                </View>
              ))}
            </View>
            {projects.slice(0, 8).map((project) => (
              <Pressable
                key={String(project._id || project.projectId)}
                style={styles.detailRow}
                onPress={() => navigation.navigate("ProjectDetails", { projectId: project._id })}
                accessibilityRole="button"
              >
                <View style={styles.detailCopy}>
                  <Text style={styles.detailTitle} numberOfLines={1}>{project.projectName || project.title || "Project"}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{project.status || "—"} · {project.location || "Location not set"}</Text>
                </View>
                <Text style={styles.linkText}>Open</Text>
              </Pressable>
            ))}
          </AppCard>

          <AppCard style={styles.sectionCard as object}>
            <Text style={styles.sectionTitle}>Metadata</Text>
            <Text style={styles.meta}>User ID: {String(profile._id || "-")}</Text>
            <Text style={styles.meta}>Company ID: {String(profile.companyId || "-")}</Text>
            <Text style={styles.meta}>Partner Code: {String(profile.partnerCode || "-")}</Text>
            <Text style={styles.meta}>Manager: {String(profile.manager?.name || "-")}</Text>
            <Text style={styles.meta}>Created: {formatDate(profile.createdAt)}</Text>
            <Text style={styles.meta}>Updated: {formatDate(profile.updatedAt)}</Text>
            <Text style={styles.meta}>Last Assigned: {formatDate(profile.lastAssignedAt)}</Text>
            <Text style={styles.meta}>Location Updated: {formatDate(profile.liveLocation?.updatedAt)}</Text>
          </AppCard>
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  success: {
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: c.emerald[300],
    borderRadius: 10,
    backgroundColor: c.successBg,
    color: c.emerald[800],
  },
  warningCard: {
    marginTop: 10,
    marginBottom: 10,
    borderColor: c.warningBorder,
    backgroundColor: c.warningBg,
  },
  warningText: {
    color: c.amber[800],
    fontWeight: "600",
    fontSize: 12,
  },
  sectionCard: {
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  monthActions: {
    flexDirection: "row",
    gap: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  statTile: {
    minWidth: "30%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 9,
    backgroundColor: c.surfaceMuted,
    padding: 9,
  },
  statValue: {
    color: c.text,
    fontSize: 17,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 2,
    color: c.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  weekHeader: {
    flexDirection: "row",
    marginTop: 2,
  },
  weekLabel: {
    width: "14.2857%",
    textAlign: "center",
    color: c.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: c.border,
  },
  dayCell: {
    width: "14.2857%",
    minHeight: 46,
    padding: 5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  dayCellBlank: {
    backgroundColor: c.surfaceMuted,
  },
  dayNumber: {
    color: c.text,
    fontSize: 10,
    fontWeight: "700",
  },
  dayStatus: {
    marginTop: 5,
    color: c.primary,
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    color: c.text,
    fontSize: 12,
    fontWeight: "700",
  },
  linkText: {
    color: c.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  label: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 2,
  },
  meta: {
    color: c.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  switchRow: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
}));
