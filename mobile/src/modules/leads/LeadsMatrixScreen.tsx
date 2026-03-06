import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import { Screen } from "../../components/common/Screen";
import {
  assignLead,
  createLead,
  getAllLeads,
  getLeadActivity,
  updateLeadStatus,
} from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { useAuth } from "../../context/AuthContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import type { InventoryAsset, Lead } from "../../types";
import { AppButton, AppCard, AppChip, AppInput } from "../../components/common/ui";
import { colors } from "../../theme/tokens";

const LEAD_STATUSES = ["ALL", "NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "CLOSED", "LOST"];
const EXECUTIVE_ROLES = new Set(["EXECUTIVE", "FIELD_EXECUTIVE"]);

const statusPillStyles = {
  NEW: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  CONTACTED: { bg: "#fffbeb", border: "#fde68a", text: "#a16207" },
  INTERESTED: { bg: "#ecfdf5", border: "#bbf7d0", text: "#15803d" },
  SITE_VISIT: { bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9" },
  CLOSED: { bg: "#0f172a", border: "#0f172a", text: "#ffffff" },
  LOST: { bg: "#fff1f2", border: "#fecdd3", text: "#be123c" },
} as const;

const toInputDateTime = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const resolveAssignedTo = (lead: Lead) => {
  if (!lead.assignedTo) return "Unassigned";
  if (typeof lead.assignedTo === "string") return "Unassigned";
  return lead.assignedTo.name || "Unassigned";
};

const toDigits = (value?: string) => String(value || "").replace(/\D/g, "");

const toLocalTenDigitPhone = (value?: string) => {
  const digits = toDigits(value);
  if (digits.length < 10) return "";
  return digits.slice(-10);
};

const toWhatsAppPhone = (value?: string) => {
  const localTenDigit = toLocalTenDigitPhone(value);
  if (!localTenDigit) return "";
  return localTenDigit;
};

const formatCurrency = (value: number) => `Rs ${Math.round(value).toLocaleString("en-IN")}`;
const escapeHtml = (value: string) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildInventoryLabel = (asset: InventoryAsset) =>
  String(
    asset.title
    || [asset.location, asset.category, asset.type].filter(Boolean).join(" - ")
    || "Inventory",
  ).trim();

const resolveMediaUrl = (url?: string) => {
  const safe = String(url || "").trim();
  if (!safe) return "";
  if (/^https?:\/\//i.test(safe)) return safe;
  const base = process.env.EXPO_PUBLIC_API_ORIGIN || process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "";
  const cleanBase = String(base).replace(/\/$/, "");
  if (!cleanBase) return safe;
  return `${cleanBase}${safe.startsWith("/") ? "" : "/"}${safe}`;
};

const getPendingPaymentRows = (lead: Lead) => {
  const merged: any[] = [];
  const seen = new Set<string>();
  const pushUnique = (row: any) => {
    const id = String(row?._id || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(row);
  };

  if (lead.inventoryId && typeof lead.inventoryId === "object") {
    pushUnique(lead.inventoryId);
  }
  if (Array.isArray(lead.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged
    .map((row: any) => ({
      label: [row?.projectName, row?.towerName, row?.unitNumber].filter(Boolean).join(" - ") || "Property",
      remainingAmount: Number(row?.saleMeta?.remainingAmount || 0),
      remainingDueDate: String(row?.saleMeta?.remainingDueDate || "").trim(),
    }))
    .filter((row) => Number.isFinite(row.remainingAmount) && row.remainingAmount > 0);
};

export const LeadsMatrixScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [projectInterested, setProjectInterested] = useState("");

  const [selected, setSelected] = useState<Lead | null>(null);
  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [assignDraft, setAssignDraft] = useState("");
  const [activities, setActivities] = useState<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>>([]);

  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalGenerating, setProposalGenerating] = useState(false);
  const [proposalLeadId, setProposalLeadId] = useState("");
  const [proposalLeadDropdownOpen, setProposalLeadDropdownOpen] = useState(false);
  const [proposalAssets, setProposalAssets] = useState<InventoryAsset[]>([]);
  const [proposalSelectedAssetIds, setProposalSelectedAssetIds] = useState<string[]>([]);
  const [lastGeneratedPdfUri, setLastGeneratedPdfUri] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const [leadRows, userPayload] = await Promise.all([getAllLeads(), getUsers()]);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setUsers(userPayload?.users || []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load leads"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = route.params || {};
    const initialStatus = String(params.initialStatus || "ALL").toUpperCase();
    const filterPreset = String(params.filterPreset || "").toUpperCase();
    const initialQuery = String(params.initialQuery || "");

    if (initialQuery) {
      setQuery(initialQuery);
    }

    if (filterPreset === "PIPELINE") {
      setStatusFilter("PIPELINE");
      return;
    }

    if (filterPreset === "DUE_FOLLOWUP") {
      setStatusFilter("DUE_FOLLOWUP");
      return;
    }

    if (LEAD_STATUSES.includes(initialStatus)) {
      setStatusFilter(initialStatus);
    }
  }, [route.params]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 1800);
    return () => clearTimeout(timer);
  }, [success]);

  const filtered = useMemo(() => {
    const key = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const status = String(lead.status || "");
      const dueFollowUp =
        !!lead.nextFollowUp && !Number.isNaN(new Date(lead.nextFollowUp).getTime()) && new Date(lead.nextFollowUp) <= new Date();
      const statusMatch =
        statusFilter === "ALL"
          ? true
          : statusFilter === "PIPELINE"
            ? !["CLOSED", "LOST"].includes(status)
            : statusFilter === "DUE_FOLLOWUP"
              ? dueFollowUp
            : status === statusFilter;
      const textMatch =
        !key ||
        [lead.name, lead.phone, lead.email, lead.city, lead.projectInterested, lead.source]
          .map((v) => String(v || "").toLowerCase())
          .some((v) => v.includes(key));

      return statusMatch && textMatch;
    });
  }, [leads, query, statusFilter]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const fresh = leads.filter((lead) => lead.status === "NEW").length;
    const interested = leads.filter((lead) => ["INTERESTED", "SITE_VISIT"].includes(String(lead.status))).length;
    const closed = leads.filter((lead) => lead.status === "CLOSED").length;
    const dueFollowUps = leads.filter((lead) => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length;
    return { total, fresh, interested, closed, dueFollowUps };
  }, [leads]);

  const showEstimatedRevenueContext = String(route.params?.highlightMetric || "") === "ESTIMATED_REVENUE";
  const estimatedRevenueValue = Number(route.params?.estimatedRevenue || 0);
  const estimatedRevenueClosedDeals = Number(route.params?.closedDeals || 0);

  const executiveUsers = useMemo(
    () => users.filter((u) => u.isActive !== false && EXECUTIVE_ROLES.has(String(u.role || ""))),
    [users],
  );
  const selectedProposalLead = useMemo(
    () => leads.find((row) => String(row._id) === proposalLeadId) || null,
    [leads, proposalLeadId],
  );
  const selectedProposalAssets = useMemo(
    () =>
      proposalAssets.filter((asset) => proposalSelectedAssetIds.includes(String(asset._id || ""))),
    [proposalAssets, proposalSelectedAssetIds],
  );

  const openLead = async (lead: Lead) => {
    setSelected(lead);
    setStatusDraft(lead.status || "NEW");
    setFollowUpDraft(toInputDateTime(lead.nextFollowUp));
    const assignedId = typeof lead.assignedTo === "object" ? lead.assignedTo?._id || "" : "";
    setAssignDraft(assignedId);

    try {
      setActivityLoading(true);
      const timeline = await getLeadActivity(lead._id);
      setActivities(timeline || []);
    } catch {
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const resetAddForm = () => {
    setName("");
    setPhone("");
    setCity("");
    setEmail("");
    setProjectInterested("");
  };

  const saveNewLead = async () => {
    const safeName = name.trim();
    const safePhone = phone.trim();

    if (!safeName || !safePhone) {
      setError("Name and phone are required");
      return;
    }

    if (!/^\d{8,15}$/.test(safePhone)) {
      setError("Phone should be 8 to 15 digits");
      return;
    }

    try {
      setSaving(true);
      const created = await createLead({
        name: safeName,
        phone: safePhone,
        city: city.trim(),
        email: email.trim(),
        projectInterested: projectInterested.trim(),
      });
      setLeads((prev) => [created, ...prev]);
      setSuccess("Lead created");
      setAddOpen(false);
      resetAddForm();
    } catch (e) {
      setError(toErrorMessage(e, "Failed to create lead"));
    } finally {
      setSaving(false);
    }
  };

  const saveLeadUpdate = async () => {
    if (!selected) return;

    const payload: Partial<Lead> = { status: statusDraft };
    if (followUpDraft.trim()) {
      const parsed = new Date(followUpDraft.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) {
        setError("Invalid follow-up format. Use YYYY-MM-DD HH:mm");
        return;
      }
      payload.nextFollowUp = parsed.toISOString();
    }

    try {
      setSaving(true);
      const updated = await updateLeadStatus(selected._id, payload);
      setLeads((prev) => prev.map((lead) => (lead._id === updated._id ? updated : lead)));
      setSelected(updated);
      setSuccess("Lead updated");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update lead"));
    } finally {
      setSaving(false);
    }
  };

  const saveAssignment = async () => {
    if (!selected || !assignDraft) return;
    try {
      setSaving(true);
      const updated = await assignLead(selected._id, assignDraft);
      setLeads((prev) => prev.map((lead) => (lead._id === updated._id ? updated : lead)));
      setSelected(updated);
      setSuccess("Lead assigned");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to assign lead"));
    } finally {
      setSaving(false);
    }
  };

  const openDialer = async (phone?: string) => {
    const dialNumber = toLocalTenDigitPhone(phone);
    if (!dialNumber) {
      Alert.alert("Invalid number", "Phone number must have at least 10 digits.");
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
      Alert.alert("Invalid number", "WhatsApp needs at least 10 digits.");
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

  const openProposalGenerator = async () => {
    try {
      setProposalOpen(true);
      setProposalLeadId("");
      setProposalLeadDropdownOpen(false);
      setProposalSelectedAssetIds([]);
      setLastGeneratedPdfUri("");
      setProposalLoading(true);
      const assets = await getInventoryAssets();
      setProposalAssets(Array.isArray(assets) ? assets : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load inventory for proposal"));
    } finally {
      setProposalLoading(false);
    }
  };

  const toggleProposalAsset = (assetId: string) => {
    setProposalSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const buildProposalHtml = (items: InventoryAsset[], lead: Lead | null) => {
    const generatedAt = new Date().toLocaleString("en-IN");
    const leadName = escapeHtml(String(lead?.name || "-"));
    const leadPhone = escapeHtml(String(lead?.phone || "-"));
    const blocks = items
      .map((asset, index) => {
        const name = escapeHtml(buildInventoryLabel(asset));
        const location = escapeHtml(String(asset.location || "-"));
        const category = escapeHtml(String(asset.category || "-"));
        const type = escapeHtml(String(asset.type || "-"));
        const status = escapeHtml(String(asset.status || "-"));
        const description = escapeHtml(String(asset.description || "-"));
        const price = Number(asset.price || 0);
        const formattedPrice = Number.isFinite(price) && price > 0 ? `Rs ${Math.round(price).toLocaleString("en-IN")}` : "-";
        const imageRows = (Array.isArray(asset.images) ? asset.images : [])
          .map((url) => resolveMediaUrl(String(url || "").trim()))
          .filter(Boolean)
          .slice(0, 6)
          .map((url) => `<img src="${escapeHtml(url)}" alt="Property" />`)
          .join("");

        return `
          <div class="card">
            <div class="title">${index + 1}. ${name}</div>
            <div class="line"><strong>Location:</strong> ${location}</div>
            <div class="line"><strong>Category:</strong> ${category}</div>
            <div class="line"><strong>Type:</strong> ${type}</div>
            <div class="line"><strong>Status:</strong> ${status}</div>
            <div class="line"><strong>Price:</strong> ${escapeHtml(formattedPrice)}</div>
            <div class="line"><strong>Description:</strong> ${description}</div>
            ${imageRows ? `<div class="imageGrid">${imageRows}</div>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 20px; }
            h1 { margin: 0 0 6px; font-size: 24px; }
            .meta { color: #475569; margin-bottom: 4px; font-size: 12px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 12px; }
            .title { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
            .line { font-size: 12px; margin-top: 2px; }
            .imageGrid { margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .imageGrid img { width: 100%; max-height: 180px; object-fit: cover; border: 1px solid #e2e8f0; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h1>Property Proposal</h1>
          <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
          <div class="meta">Lead: ${leadName}</div>
          <div class="meta">Phone: ${leadPhone}</div>
          ${blocks}
        </body>
      </html>
    `;
  };

  const generateProposalPdf = async () => {
    if (!selectedProposalLead) {
      Alert.alert("Select lead", "Please select lead first.");
      return "";
    }
    if (!selectedProposalAssets.length) {
      Alert.alert("Select inventory", "At least one inventory is required.");
      return "";
    }

    try {
      setProposalGenerating(true);
      const lead = selectedProposalLead;
      const safeLeadName = String(lead?.name || "lead").replace(/[^a-z0-9]/gi, "_").toLowerCase() || "lead";
      const fileName = `proposal_${safeLeadName}_${Date.now()}.pdf`;

      if (Platform.OS === "web") {
        const { jsPDF } = await import("jspdf");

        const loadImageForPdf = async (url: string): Promise<{ dataUrl: string; width: number; height: number } | null> =>
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  resolve(null);
                  return;
                }
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                resolve({
                  dataUrl,
                  width: img.naturalWidth || img.width || 1,
                  height: img.naturalHeight || img.height || 1,
                });
              } catch {
                resolve(null);
              }
            };
            img.onerror = () => resolve(null);
            img.src = url;
          });

        const doc = new jsPDF({ unit: "pt", format: "a4" });
        let y = 40;
        doc.setFontSize(18);
        doc.text("Property Proposal", 40, y);
        y += 22;
        doc.setFontSize(11);
        doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, y);
        y += 16;
        doc.text(`Lead: ${String(lead?.name || "-")}`, 40, y);
        y += 16;
        doc.text(`Phone: ${String(lead?.phone || "-")}`, 40, y);
        y += 20;
        doc.setFontSize(10);

        for (let index = 0; index < selectedProposalAssets.length; index += 1) {
          const asset = selectedProposalAssets[index];
          const rows = [
            `${index + 1}. ${buildInventoryLabel(asset)}`,
            `Location: ${asset.location || "-"}`,
            `Category: ${asset.category || "-"}`,
            `Type: ${asset.type || "-"}`,
            `Status: ${asset.status || "-"}`,
            `Price: ${formatCurrency(Number(asset.price || 0))}`,
            `Description: ${asset.description || "-"}`,
          ];
          rows.forEach((row) => {
            const lines = doc.splitTextToSize(row, 500);
            lines.forEach((line: string) => {
              if (y > 780) {
                doc.addPage();
                y = 40;
              }
              doc.text(line, 40, y);
              y += 14;
            });
          });

          const imageUrls = (Array.isArray(asset.images) ? asset.images : [])
            .map((raw) => resolveMediaUrl(String(raw || "").trim()))
            .filter(Boolean)
            .slice(0, 2);

          for (let imageIndex = 0; imageIndex < imageUrls.length; imageIndex += 1) {
            const loaded = await loadImageForPdf(imageUrls[imageIndex]);
            if (!loaded) continue;
            const maxWidth = 220;
            const maxHeight = 160;
            const ratio = Math.min(maxWidth / loaded.width, maxHeight / loaded.height);
            const drawWidth = Math.max(1, Math.round(loaded.width * ratio));
            const drawHeight = Math.max(1, Math.round(loaded.height * ratio));

            if (y + drawHeight + 12 > 790) {
              doc.addPage();
              y = 40;
            }
            doc.addImage(
              loaded.dataUrl,
              "JPEG",
              40 + (imageIndex % 2) * (maxWidth + 12),
              y,
              drawWidth,
              drawHeight,
            );
          }

          if (imageUrls.length) {
            y += 174;
          }

          y += 12;
          if (y > 790) {
            doc.addPage();
            y = 40;
          }
          doc.setDrawColor(203, 213, 225);
          doc.line(40, y, 555, y);
          y += 12;

          if (y > 790) {
            doc.addPage();
            y = 40;
          }
        }

        doc.save(fileName);
        setLastGeneratedPdfUri(fileName);
        setSuccess("Proposal PDF downloaded");
        return fileName;
      }

      const html = buildProposalHtml(selectedProposalAssets, lead);
      const printed = await Print.printToFileAsync({ html, base64: false });
      setLastGeneratedPdfUri(printed.uri);
      setSuccess("Proposal PDF ready");
      return printed.uri;
    } catch (e) {
      setError(toErrorMessage(e, "Failed to generate proposal PDF"));
      return "";
    } finally {
      setProposalGenerating(false);
    }
  };

  const ensurePdfUri = async () => {
    if (lastGeneratedPdfUri) return lastGeneratedPdfUri;
    return generateProposalPdf();
  };

  const shareProposalOnWhatsApp = async () => {
    if (!selectedProposalLead) {
      Alert.alert("Select lead", "Please select lead first.");
      return;
    }

    const phone = toWhatsAppPhone(selectedProposalLead.phone);
    if (!phone) {
      Alert.alert("Invalid number", "Lead phone number is invalid.");
      return;
    }
    const pdfUri = await ensurePdfUri();
    if (!pdfUri) return;

    const text = encodeURIComponent(`Hi ${selectedProposalLead.name}, proposal ready hai. Please check.`);
    const appUrl = `whatsapp://send?phone=${phone}&text=${text}`;
    const webUrl = `https://wa.me/${phone}?text=${text}`;
    const canApp = await Linking.canOpenURL(appUrl).catch(() => false);
    if (canApp) {
      await Linking.openURL(appUrl);
      return;
    }
    await Linking.openURL(webUrl);
  };

  const shareProposalByEmail = async () => {
    if (!selectedProposalLead) {
      Alert.alert("Select lead", "Please select lead first.");
      return;
    }
    const to = String(selectedProposalLead.email || "").trim();
    if (!to) {
      Alert.alert("Email missing", "Selected lead me email available nahi hai.");
      return;
    }

    const pdfUri = await ensurePdfUri();
    if (!pdfUri) return;

    const subject = `Proposal for ${selectedProposalLead.name}`;
    const body = `Dear ${selectedProposalLead.name},\n\nPlease find attached proposal PDF.\n\nRegards`;

    if (Platform.OS !== "web" && (await MailComposer.isAvailableAsync())) {
      await MailComposer.composeAsync({
        recipients: [to],
        subject,
        body,
        attachments: [pdfUri],
      });
      return;
    }

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(mailto).catch(() => {
      Alert.alert("Mail unavailable", "Unable to open mail client.");
    });
  };

  return (
    <Screen title="Lead Matrix" subtitle="Pipeline + Follow-ups" loading={loading} error={error}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>No leads found for current filter</Text>}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 64 + insets.bottom }}
        ListHeaderComponent={
          <>
            {success ? <Text style={styles.success}>{success}</Text> : null}

            {showEstimatedRevenueContext ? (
              <View style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>Estimated Revenue</Text>
                <Text style={styles.revenueValue}>{formatCurrency(estimatedRevenueValue)}</Text>
                <Text style={styles.revenueHelper}>{estimatedRevenueClosedDeals} closed x 75,000</Text>
              </View>
            ) : null}

            <View style={styles.topActions}>
              <View style={styles.topActionsLeft}>
                <AppButton title={refreshing ? "Refreshing..." : "Refresh"} variant="ghost" onPress={() => load(true)} />
                {canManage ? (
                  <AppButton title="+ Add Lead" onPress={() => setAddOpen(true)} />
                ) : null}
              </View>
              <Pressable style={styles.proposalBtn} onPress={openProposalGenerator}>
                <Ionicons name="document-text-outline" size={16} color="#0f172a" />
                <Text style={styles.proposalBtnText}>Proposal</Text>
              </Pressable>
            </View>

            <AppInput
              style={styles.search as object}
              placeholder="Search name, phone, city"
              value={query}
              onChangeText={setQuery}
            />

            <View style={styles.filtersWrap}>
              <ScrollView
                style={styles.filtersScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersRow}
              >
                {[...LEAD_STATUSES, "PIPELINE"].map((status) => (
                  <AppChip key={status} label={status} active={statusFilter === status} onPress={() => setStatusFilter(status)} />
                ))}
              </ScrollView>
            </View>

            <View style={styles.metricsWrap}>
              <Metric label="Total" value={metrics.total} active={statusFilter === "ALL"} onPress={() => setStatusFilter("ALL")} />
              <Metric label="New" value={metrics.fresh} active={statusFilter === "NEW"} onPress={() => setStatusFilter("NEW")} />
              <Metric
                label="Interested"
                value={metrics.interested}
                active={statusFilter === "INTERESTED" || statusFilter === "SITE_VISIT"}
                onPress={() => setStatusFilter("INTERESTED")}
              />
              <Metric label="Closed" value={metrics.closed} active={statusFilter === "CLOSED"} onPress={() => setStatusFilter("CLOSED")} />
              <Metric
                label="Due Followup"
                value={metrics.dueFollowUps}
                active={statusFilter === "DUE_FOLLOWUP"}
                onPress={() => setStatusFilter("DUE_FOLLOWUP")}
              />
            </View>
          </>
        }
        renderItem={({ item }) => {
          const statusStyle = statusPillStyles[(item.status || "NEW") as keyof typeof statusPillStyles] || statusPillStyles.NEW;
          return (
            <Pressable onPress={() => openLead(item)} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                  <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{item.status || "NEW"}</Text>
                </View>
              </View>
              <Text style={styles.meta}>{item.phone} | {item.city || "-"}</Text>
              <Text style={styles.meta}>Project: {item.projectInterested || "-"}</Text>
              <Text style={styles.meta}>Assigned: {resolveAssignedTo(item)}</Text>
              <Text style={styles.meta}>Next: {formatDateTime(item.nextFollowUp)}</Text>
              {getPendingPaymentRows(item).map((pending) => (
                <Text key={`${item._id}-${pending.label}`} style={styles.meta}>
                  Pending: {formatCurrency(pending.remainingAmount)} | Due: {pending.remainingDueDate || "-"} ({pending.label})
                </Text>
              ))}

              <View style={styles.quickActionRow}>
                <Pressable style={styles.quickActionBtn} onPress={() => openDialer(item.phone)}>
                  <Ionicons name="call-outline" size={16} color="#0f172a" />
                  <Text style={styles.quickActionText}>Call</Text>
                </Pressable>
                <Pressable style={styles.quickActionBtn} onPress={() => openWhatsApp(item.phone)}>
                  <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                  <Text style={styles.quickActionText}>WhatsApp</Text>
                </Pressable>
              </View>

              <AppButton
                title="Open Full Details"
                variant="ghost"
                style={styles.detailsBtn as object}
                onPress={() => navigation.navigate("LeadDetails", { leadId: item._id })}
              />
            </Pressable>
          );
        }}
      />

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalWrap}>
          <AppCard style={styles.modalCard as object}>
            <Text style={styles.modalTitle}>Create Lead</Text>
            <AppInput style={styles.input as object} placeholder="Name" value={name} onChangeText={setName} />
            <AppInput
              style={styles.input as object}
              placeholder="Phone"
              value={phone}
              keyboardType="phone-pad"
              onChangeText={setPhone}
            />
            <AppInput style={styles.input as object} placeholder="Email" value={email} onChangeText={setEmail} />
            <AppInput style={styles.input as object} placeholder="City" value={city} onChangeText={setCity} />
            <AppInput
              style={styles.input as object}
              placeholder="Project Interested"
              value={projectInterested}
              onChangeText={setProjectInterested}
            />
            <View style={styles.modalRow}>
              <AppButton title="Cancel" variant="ghost" onPress={() => setAddOpen(false)} disabled={saving} />
              <AppButton title={saving ? "Saving..." : "Save"} onPress={saveNewLead} disabled={saving} />
            </View>
          </AppCard>
        </View>
      </Modal>

      <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailRoot}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.meta}>{selected?.phone} | {selected?.email || "-"}</Text>
            <Text style={styles.meta}>Project: {selected?.projectInterested || "-"}</Text>

            <Text style={styles.section}>Status</Text>
            <View style={styles.statusRow}>
              {LEAD_STATUSES.filter((s) => s !== "ALL").map((status) => (
                <AppChip
                  key={status}
                  label={status}
                  active={statusDraft === status}
                  onPress={() => setStatusDraft(status)}
                />
              ))}
            </View>

            <Text style={styles.section}>Next Follow-up (YYYY-MM-DD HH:mm)</Text>
            <AppInput
              style={styles.input as object}
              placeholder="2026-02-19 18:30"
              value={followUpDraft}
              onChangeText={setFollowUpDraft}
            />

            <AppButton title={saving ? "Saving..." : "Save Lead Update"} onPress={saveLeadUpdate} disabled={saving} />

            {canManage ? (
              <>
                <Text style={styles.section}>Assign Executive</Text>
                <View style={styles.statusRow}>
                  {executiveUsers.map((user) => (
                    <AppChip
                      key={String(user._id)}
                      label={user.name}
                      active={assignDraft === user._id}
                      onPress={() => setAssignDraft(String(user._id || ""))}
                      style={styles.statusChip as object}
                    />
                  ))}
                </View>
                <AppButton title={saving ? "Assigning..." : "Assign Lead"} onPress={saveAssignment} disabled={saving || !assignDraft} />
              </>
            ) : null}

            <Text style={styles.section}>Activity Timeline</Text>
            {activityLoading ? (
              <ActivityIndicator color="#0f172a" />
            ) : activities.length === 0 ? (
              <Text style={styles.empty}>No activity yet</Text>
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

            <AppButton
              title="Close"
              variant="ghost"
              onPress={() => {
                if (saving) {
                  Alert.alert("Please wait", "A save operation is in progress.");
                  return;
                }
                setSelected(null);
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={proposalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setProposalOpen(false);
          setProposalLeadDropdownOpen(false);
        }}
      >
        <View style={styles.modalWrap}>
          <AppCard style={[styles.modalCard, styles.proposalModalCard] as object}>
            <View style={styles.proposalContentArea}>
              <Text style={styles.modalTitle}>Proposal Generator</Text>
              <Text style={styles.meta}>1. Select lead  2. Select inventory  3. Download/share PDF</Text>

              <Text style={styles.section}>Select Lead</Text>
              <Pressable style={styles.selectInput} onPress={() => setProposalLeadDropdownOpen((prev) => !prev)}>
                <Text style={styles.selectInputText}>{selectedProposalLead?.name || "Select lead"}</Text>
                <Ionicons name={proposalLeadDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
              </Pressable>
              {proposalLeadDropdownOpen ? (
                <ScrollView style={styles.selectDropdown}>
                  {leads.map((row) => {
                    const id = String(row._id || "");
                    const active = proposalLeadId === id;
                    return (
                      <Pressable
                        key={`proposal-lead-${id}`}
                        style={[styles.selectOption, active && styles.selectOptionActive]}
                        onPress={() => {
                          setProposalLeadId(id);
                          setProposalLeadDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]}>{row.name}</Text>
                        <Text style={styles.selectOptionMeta}>{row.phone || "-"}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <Text style={styles.section}>Select Inventory (Multiple)</Text>
              {proposalLoading ? (
                <ActivityIndicator color="#0f172a" />
              ) : proposalAssets.length === 0 ? (
                <Text style={styles.empty}>No inventory found</Text>
              ) : (
                <ScrollView style={styles.proposalList} contentContainerStyle={{ paddingBottom: 8 }}>
                  {proposalAssets.map((asset) => {
                    const id = String(asset._id || "");
                    const active = proposalSelectedAssetIds.includes(id);
                    return (
                      <Pressable key={`proposal-asset-${id}`} onPress={() => toggleProposalAsset(id)} style={[styles.proposalAssetRow, active && styles.proposalAssetRowActive]}>
                        <View style={styles.proposalAssetLeft}>
                          <Ionicons
                            name={active ? "checkbox-outline" : "square-outline"}
                            size={18}
                            color={active ? "#0f172a" : "#64748b"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.proposalAssetTitle}>{buildInventoryLabel(asset)}</Text>
                            <Text style={styles.meta}>Location: {asset.location || "-"}</Text>
                            <Text style={styles.meta}>Category: {asset.category || "-"}</Text>
                            <Text style={styles.meta}>Type: {asset.type || "-"}</Text>
                            <Text style={styles.meta}>Status: {asset.status || "-"}</Text>
                            <Text style={styles.meta}>Price: {formatCurrency(Number(asset.price || 0))}</Text>
                            <Text style={styles.meta}>Photos: {Array.isArray(asset.images) ? asset.images.length : 0}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.proposalFooter}>
              <Pressable
                style={[styles.actionBtn, (proposalGenerating || proposalSelectedAssetIds.length === 0) && styles.actionBtnDisabled]}
                onPress={generateProposalPdf}
                disabled={proposalGenerating || proposalSelectedAssetIds.length === 0}
              >
                <Ionicons name="download-outline" size={16} color="#0f172a" />
                <Text style={styles.actionBtnText}>Download</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, (proposalGenerating || proposalSelectedAssetIds.length === 0) && styles.actionBtnDisabled]}
                onPress={shareProposalOnWhatsApp}
                disabled={proposalGenerating || proposalSelectedAssetIds.length === 0}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, (proposalGenerating || proposalSelectedAssetIds.length === 0) && styles.actionBtnDisabled]}
                onPress={shareProposalByEmail}
                disabled={proposalGenerating || proposalSelectedAssetIds.length === 0}
              >
                <Ionicons name="mail-outline" size={16} color="#2563eb" />
                <Text style={styles.actionBtnText}>Mail</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  setProposalOpen(false);
                  setProposalLeadDropdownOpen(false);
                }}
                disabled={proposalGenerating}
              >
                <Ionicons name="close-outline" size={16} color="#475569" />
                <Text style={styles.actionBtnText}>Close</Text>
              </Pressable>
            </View>
          </AppCard>
        </View>
      </Modal>
    </Screen>
  );
};

const Metric = ({
  label,
  value,
  onPress,
  active = false,
}: {
  label: string;
  value: number;
  onPress?: () => void;
  active?: boolean;
}) => (
  <Pressable style={[styles.metricCard, active && styles.metricCardActive]} onPress={onPress}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  success: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    color: "#166534",
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  topActionsLeft: {
    flexDirection: "row",
    gap: 8,
  },
  proposalBtn: {
    height: 36,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  proposalBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  search: {
    height: 44,
    marginBottom: 8,
  },
  filtersRow: {
    gap: 8,
    paddingBottom: 2,
    alignItems: "center",
  },
  filtersWrap: {
    height: 44,
    justifyContent: "center",
    marginBottom: 8,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  metricsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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
    color: "#64748b",
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 4,
    fontWeight: "700",
    color: colors.text,
    fontSize: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  meta: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginVertical: 14,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  modalCard: { borderRadius: 14, padding: 14 },
  proposalModalCard: {
    maxHeight: "90%",
    width: "100%",
    padding: 0,
    overflow: "hidden",
  },
  proposalContentArea: {
    flex: 1,
    padding: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  input: { height: 42, marginBottom: 10 },
  modalRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailRoot: {
    flex: 1,
    padding: 14,
    paddingTop: 56,
    backgroundColor: "#f8fafc",
  },
  section: {
    marginTop: 14,
    marginBottom: 8,
    fontWeight: "700",
    color: "#334155",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    alignContent: "flex-start",
  },
  statusChip: {},
  activityCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  detailsBtn: { marginTop: 10, height: 36 },
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
  revenueCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  revenueLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  revenueValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  revenueHelper: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  proposalList: {
    flex: 1,
    minHeight: 200,
    maxHeight: 320,
    marginBottom: 6,
  },
  proposalAssetRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  proposalAssetRowActive: {
    borderColor: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  proposalAssetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proposalAssetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  selectInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  selectInputText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "500",
  },
  selectDropdown: {
    marginTop: 6,
    marginBottom: 8,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  selectOptionActive: {
    backgroundColor: "#f8fafc",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  selectOptionTextActive: {
    color: "#0f172a",
  },
  selectOptionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  proposalFooter: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
});
