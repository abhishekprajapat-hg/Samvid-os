import React, { useMemo, useState } from "react";
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard, AppInput } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import { uploadChatFile } from "../../services/chatService";
import { getMyProfile, updateMyProfile } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const prettifyLabel = (value: string) =>
  String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const initials = (name: string) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

export const ProfileScreen = () => {
  const { updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState<any>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const data = await getMyProfile();
      const row = data.profile || {};
      setProfile(row);
      setSummary(data.summary || {});
      setName(String(row.name || ""));
      setPhone(String(row.phone || ""));
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load profile"));
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

  const summaryRows = useMemo(
    () =>
      Object.entries(summary || {})
        .filter(([, value]) => typeof value === "number")
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    [summary],
  );

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError("");
      const result = await updateMyProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      if (result.profile) {
        setProfile(result.profile);
        await updateUser({
          name: String(result.profile.name || ""),
          phone: String(result.profile.phone || ""),
          profileImageUrl: String(result.profile.profileImageUrl || ""),
        });
      }
      if (result.summary) {
        setSummary(result.summary);
      }
      setSuccess("Profile saved");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  };

  const uploadProfilePhoto = async () => {
    try {
      setUploading(true);
      setError("");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Media permission is required to upload profile image");
        return;
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
      });
      if (pick.canceled || !pick.assets?.length) return;
      const file = pick.assets[0];
      const uri = String(file.uri || "");
      if (!uri) return;

      const uploaded = await uploadChatFile({
        uri,
        name: file.fileName || `profile-${Date.now()}.jpg`,
        mimeType: file.mimeType || "image/jpeg",
      });
      const url = String(uploaded?.fileUrl || "").trim();
      if (!url) {
        setError("Upload failed");
        return;
      }

      const result = await updateMyProfile({
        name: (name || profile?.name || "").trim(),
        phone: (phone || profile?.phone || "").trim(),
        profileImageUrl: url,
      });
      if (result.profile) {
        setProfile(result.profile);
        await updateUser({
          profileImageUrl: String(result.profile.profileImageUrl || ""),
        });
      }
      setSuccess("Profile image updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to upload profile image"));
    } finally {
      setUploading(false);
    }
  };

  const deleteProfilePhoto = async () => {
    try {
      setUploading(true);
      setError("");
      const result = await updateMyProfile({
        name: (name || profile?.name || "").trim(),
        phone: (phone || profile?.phone || "").trim(),
        profileImageUrl: "",
      });
      if (result.profile) {
        setProfile(result.profile);
        await updateUser({
          profileImageUrl: "",
        });
      }
      setSuccess("Profile image deleted");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to delete profile image"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen title="User Profile" subtitle="Personal Account Details and Role Summary" loading={loading} error={error}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <AppCard style={styles.profileCard as object}>
          <View style={styles.profileTop}>
            <Pressable
              onPress={() => {
                if (profile?.profileImageUrl) setImagePreviewOpen(true);
              }}
              disabled={!profile?.profileImageUrl}
            >
              {profile?.profileImageUrl ? (
                <Image source={{ uri: String(profile.profileImageUrl) }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initials(name || profile?.name || "User")}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.profileActions}>
              <AppButton
                title={uploading ? "Uploading..." : "Upload Photo"}
                variant="ghost"
                onPress={uploadProfilePhoto}
                disabled={uploading}
                style={styles.photoBtn as object}
              />
              <AppButton
                title={uploading ? "Deleting..." : "Delete Photo"}
                variant="ghost"
                onPress={deleteProfilePhoto}
                disabled={uploading || !profile?.profileImageUrl}
                style={styles.photoBtn as object}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Name</Text>
              <AppInput value={name} onChangeText={setName} placeholder="Name" />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Phone</Text>
              <AppInput value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.readonly}>
                <Text style={styles.readonlyText}>{profile?.email || "-"}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Role</Text>
              <View style={styles.readonly}>
                <Text style={styles.readonlyText}>{profile?.role || "-"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.saveRow}>
            <AppButton title={saving ? "Saving..." : "Save Profile"} onPress={saveProfile} disabled={saving} />
          </View>
        </AppCard>

        <View style={styles.twoCol}>
          <AppCard style={styles.metaCard as object}>
            <Text style={styles.cardTitle}>Reporting</Text>
            {profile?.manager ? (
              <>
                <Text style={styles.meta}>Name: {profile.manager.name || "-"}</Text>
                <Text style={styles.meta}>Role: {profile.manager.role || "-"}</Text>
                <Text style={styles.meta}>Email: {profile.manager.email || "-"}</Text>
                <Text style={styles.meta}>Phone: {profile.manager.phone || "-"}</Text>
              </>
            ) : (
              <Text style={styles.meta}>No reporting manager mapped</Text>
            )}
          </AppCard>
          <AppCard style={styles.metaCard as object}>
            <Text style={styles.cardTitle}>Account Metadata</Text>
            <Text style={styles.meta}>Company Id: {String(profile?.companyId || "-")}</Text>
            <Text style={styles.meta}>Created: {formatDateTime(profile?.createdAt)}</Text>
            <Text style={styles.meta}>Updated: {formatDateTime(profile?.updatedAt)}</Text>
            <Text style={styles.meta}>Last Assigned: {formatDateTime(profile?.lastAssignedAt)}</Text>
          </AppCard>
        </View>

        <View style={styles.tiles}>
          {summaryRows.length === 0 ? (
            <AppCard style={styles.metaCard as object}>
              <Text style={styles.meta}>No summary data available.</Text>
            </AppCard>
          ) : (
            summaryRows.map(([key, value]) => (
              <View key={key} style={styles.tile}>
                <Text style={styles.tileLabel}>{prettifyLabel(key)}</Text>
                <Text style={styles.tileValue}>{Number(value || 0).toLocaleString("en-IN")}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        visible={imagePreviewOpen}
        transparent
        onRequestClose={() => setImagePreviewOpen(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setImagePreviewOpen(false)}>
          <View style={styles.previewCard}>
            {profile?.profileImageUrl ? (
              <Image source={{ uri: String(profile.profileImageUrl) }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
          </View>
        </Pressable>
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
  profileCard: {
    marginBottom: 10,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 20,
  },
  profileActions: {
    gap: 8,
  },
  photoBtn: {
    minWidth: 140,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  col: {
    flex: 1,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  readonly: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  readonlyText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  saveRow: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  twoCol: {
    gap: 8,
    marginBottom: 8,
  },
  metaCard: {
    marginBottom: 8,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meta: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 3,
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tile: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 10,
  },
  tileLabel: {
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tileValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  previewCard: {
    width: "100%",
    maxWidth: 600,
    height: "78%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#334155",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});
