import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { assignLead, getAllLeads, getLeadActivity, updateLeadStatus } from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import type { Lead } from "../../types";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { colors } from "../../theme/tokens";

const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "CLOSED", "LOST"];

const pad = (value: number) => String(value).padStart(2, "0");

const toDigits = (value?: string) => String(value || "").replace(/\D/g, "");

const toWhatsAppPhone = (value?: string) => {
  const digits = toDigits(value);
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return "";
};

const formatFollowUpInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

const parseFollowUpInput = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{2}):(\d{2})\s+(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const day = Number(match[3]);
  const month = Number(match[4]);
  const year = Number(match[5]);

  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
};

export const LeadDetailsScreen = () => {
  const route = useRoute<any>();
  const leadId = String(route.params?.leadId || "");
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>>([]);
  const [executives, setExecutives] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [assignDraft, setAssignDraft] = useState("");

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1500);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [leads, timeline, users] = await Promise.all([
          getAllLeads(),
          getLeadActivity(leadId),
          canManage ? getUsers() : Promise.resolve({ users: [] }),
        ]);

        const currentLead = (leads || []).find((row) => String(row._id) === leadId) || null;
        if (!currentLead) {
          setError("Lead not found");
          setLead(null);
          setActivities([]);
          return;
        }

        setLead(currentLead);
        setActivities(Array.isArray(timeline) ? timeline : []);
        setExecutives((users as any)?.users || []);

        setStatusDraft(currentLead.status || "NEW");
        setFollowUpDraft(formatFollowUpInput(currentLead.nextFollowUp));
        setAssignDraft(currentLead.assignedTo?._id || "");
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load lead details"));
      } finally {
        setLoading(false);
      }
    };

    if (leadId) {
      load();
    }
  }, [leadId, canManage]);

  const assigneeName = useMemo(() => {
    if (!lead?.assignedTo?._id) return "Unassigned";
    return lead.assignedTo.name || "Assigned";
  }, [lead]);

  const saveUpdate = async () => {
    if (!lead) return;

    const payload: Partial<Lead> = { status: statusDraft };

    if (followUpDraft.trim()) {
      const parsed = parseFollowUpInput(followUpDraft);
      if (!parsed) {
        setError("Invalid follow-up format. Use HH:mm DD-MM-YYYY");
        return;
      }
      payload.nextFollowUp = parsed.toISOString();
    }

    try {
      setSaving(true);
      const updated = await updateLeadStatus(lead._id, payload);
      setLead(updated);
      setSuccess("Lead updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update lead"));
    } finally {
      setSaving(false);
    }
  };

  const openDialer = async (phone?: string) => {
    const dialNumber = toDigits(phone);
    if (!dialNumber) {
      Alert.alert("Invalid number", "Phone number is missing for this lead.");
      return;
    }

    const url = `tel:${dialNumber}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Dialer unavailable", "Could not open the phone dialer on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Dial failed", "Unable to open dialer right now.");
    }
  };

  const openWhatsApp = async (phone?: string) => {
    const whatsappPhone = toWhatsAppPhone(phone);
    if (!whatsappPhone) {
      Alert.alert("Invalid number", "Use a valid phone number to open WhatsApp chat.");
      return;
    }

    const appUrl = `whatsapp://send?phone=${whatsappPhone}`;
    const webUrl = `https://wa.me/${whatsappPhone}`;
    try {
      const appSupported = await Linking.canOpenURL(appUrl);
      if (appSupported) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert("WhatsApp unavailable", "Could not open WhatsApp chat for this lead.");
    }
  };

  const openMail = async (email?: string) => {
    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      Alert.alert("No email", "Email is not available for this lead.");
      return;
    }

    const url = `mailto:${safeEmail}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Mail unavailable", "Could not open mail app on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Mail failed", "Unable to open mail app right now.");
    }
  };

  const saveAssignment = async () => {
    if (!lead || !assignDraft) return;

    try {
      setSaving(true);
      const updated = await assignLead(lead._id, assignDraft);
      setLead(updated);
      setSuccess("Lead assigned");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to assign lead"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0f172a" size="large" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Lead not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <AppCard style={styles.card as object}>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.meta}>{lead.phone} | {lead.email || "-"}</Text>
        <Text style={styles.meta}>City: {lead.city || "-"}</Text>
        <Text style={styles.meta}>Project: {lead.projectInterested || "-"}</Text>
        <Text style={styles.meta}>Assigned: {assigneeName}</Text>

        <View style={styles.quickActionRow}>
          <Pressable style={styles.quickActionBtn} onPress={() => openDialer(lead.phone)}>
            <Ionicons name="call-outline" size={16} color="#0f172a" />
            <Text style={styles.quickActionText}>Call</Text>
          </Pressable>
          <Pressable style={styles.quickActionBtn} onPress={() => openWhatsApp(lead.phone)}>
            <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
            <Text style={styles.quickActionText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={styles.quickActionBtn} onPress={() => openMail(lead.email)}>
            <Ionicons name="mail-outline" size={16} color="#2563eb" />
            <Text style={styles.quickActionText}>Mail</Text>
          </Pressable>
        </View>
      </AppCard>

      <AppCard style={styles.card as object}>
        <Text style={styles.section}>Status</Text>
        <View style={styles.statusWrap}>
          {STATUSES.map((status) => (
            <AppChip
              key={status}
              label={status}
              active={statusDraft === status}
              onPress={() => setStatusDraft(status)}
              style={styles.chip as object}
            />
          ))}
        </View>

        <Text style={styles.section}>Follow-up</Text>
        <AppInput
          style={styles.input as object}
          value={followUpDraft}
          onChangeText={setFollowUpDraft}
          placeholder="15:30 20-02-2026"
        />

        <AppButton title={saving ? "Saving..." : "Save Lead Update"} onPress={saveUpdate} disabled={saving} />
      </AppCard>

      {canManage ? (
        <AppCard style={styles.card as object}>
          <Text style={styles.section}>Assign Executive</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignRow}>
            {executives
              .filter((u) => u.isActive !== false && ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(String(u.role)))
              .map((user) => (
                <AppChip
                  key={String(user._id)}
                  label={user.name}
                  active={assignDraft === user._id}
                  onPress={() => setAssignDraft(String(user._id || ""))}
                  style={styles.chip as object}
                />
              ))}
          </ScrollView>

          <AppButton title={saving ? "Assigning..." : "Assign Lead"} onPress={saveAssignment} disabled={saving || !assignDraft} />
        </AppCard>
      ) : null}

      <Text style={styles.section}>Activity Timeline</Text>
      {activities.length === 0 ? (
        <Text style={styles.meta}>No activity yet</Text>
      ) : (
        activities.map((item) => (
          <View key={item._id} style={styles.activityCard}>
            <Text style={styles.meta}>{item.action}</Text>
            <Text style={styles.meta}>
              {formatDateTime(item.createdAt)} {item.performedBy?.name ? `| ${item.performedBy.name}` : ""}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  section: { marginBottom: 8, color: "#334155", fontWeight: "700" },
  meta: { marginTop: 4, fontSize: 12, color: "#64748b" },
  statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", alignContent: "flex-start" },
  assignRow: { flexDirection: "row", gap: 8, alignItems: "center", paddingBottom: 2 },
  chip: {},
  input: { marginBottom: 10 },
  quickActionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  activityCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
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
});
