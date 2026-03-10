import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import { getUserProfileById, getUsers, updateUserByAdmin } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Assistant Manager", value: "ASSISTANT_MANAGER" },
  { label: "Team Leader", value: "TEAM_LEADER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
];

const REPORTING_PARENT_ROLES: Record<string, string[]> = {
  MANAGER: ["ADMIN"],
  ASSISTANT_MANAGER: ["MANAGER"],
  TEAM_LEADER: ["ASSISTANT_MANAGER"],
  EXECUTIVE: ["TEAM_LEADER"],
  FIELD_EXECUTIVE: ["TEAM_LEADER"],
  CHANNEL_PARTNER: ["ADMIN"],
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT_MANAGER: "Assistant Manager",
  TEAM_LEADER: "Team Leader",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
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
              <Text style={styles.warningText}>Own account edit yahan se blocked hai. Profile page se update karo.</Text>
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

const styles = StyleSheet.create({
  success: {
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    color: "#166534",
  },
  warningCard: {
    marginTop: 10,
    marginBottom: 10,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
  },
  warningText: {
    color: "#92400e",
    fontWeight: "600",
    fontSize: 12,
  },
  sectionCard: {
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 2,
  },
  meta: {
    color: "#64748b",
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
});
