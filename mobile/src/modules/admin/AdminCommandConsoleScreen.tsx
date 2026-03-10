import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard } from "../../components/common/ui";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets, getPendingInventoryRequests } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const MAX_PREVIEW_ROWS = 6;
const COUNT_INTENT_TERMS = ["how many", "count", "number of", "total", "kitne", "kitni", "kitna"];
const LEAD_INTENT_TERMS = ["lead", "leads", "deal", "deals", "opportunity", "pipeline", "follow up", "site visit"];
const SUGGESTED_PROMPTS = [
  "Give me full system overview",
  "Show blocked inventory in noida",
  "Show unassigned leads",
  "How many deals are closed?",
  "How many field executives are active?",
  "Any pending approval requests?",
];

const NAV_ITEMS = [
  { screen: "MainTabs", tab: "Dashboard", aliases: ["home", "dashboard"] },
  { screen: "MainTabs", tab: "Leads", aliases: ["lead", "leads", "pipeline"] },
  { screen: "MainTabs", tab: "Inventory", aliases: ["inventory", "empire", "asset", "property"] },
  { screen: "MainTabs", tab: "Reports", aliases: ["reports", "report"] },
  { screen: "MainTabs", tab: "Calendar", aliases: ["schedule", "calendar"] },
  { screen: "MainTabs", tab: "Finance", aliases: ["finance"] },
  { screen: "Field Ops", aliases: ["field", "field ops", "fieldops", "map"] },
  { screen: "MainTabs", tab: "Chat", aliases: ["chat"] },
  { screen: "Notifications", aliases: ["alert", "alerts", "notification", "notifications"] },
  { screen: "Users", aliases: ["access", "team access", "users", "team"] },
  { screen: "Settings", aliases: ["system", "settings"] },
  { screen: "MainTabs", tab: "Targets", aliases: ["target", "targets"] },
  { screen: "Profile", aliases: ["profile"] },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT_MANAGER: "Assistant Manager",
  TEAM_LEADER: "Team Leader",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
};

const ROLE_PATTERNS = [
  { role: "ASSISTANT_MANAGER", aliases: ["assistant manager", "assistant_manager"] },
  { role: "TEAM_LEADER", aliases: ["team leader", "team_leader", "tl"] },
  { role: "FIELD_EXECUTIVE", aliases: ["field executive", "field agent", "field_exec", "fe"] },
  { role: "CHANNEL_PARTNER", aliases: ["channel partner", "partner"] },
  { role: "EXECUTIVE", aliases: ["executive"] },
  { role: "MANAGER", aliases: ["manager"] },
  { role: "ADMIN", aliases: ["admin"] },
];

const LEAD_STATUS_PATTERNS = [
  { status: "SITE_VISIT", aliases: ["site visit", "site_visit"] },
  { status: "CONTACTED", aliases: ["contacted"] },
  { status: "INTERESTED", aliases: ["interested"] },
  { status: "REQUESTED", aliases: ["requested"] },
  { status: "CLOSED", aliases: ["closed", "won", "converted"] },
  { status: "LOST", aliases: ["lost"] },
  { status: "NEW", aliases: ["new"] },
];

const INVENTORY_STATUS_PATTERNS = [
  { status: "AVAILABLE", aliases: ["available"] },
  { status: "BLOCKED", aliases: ["blocked"] },
  { status: "SOLD", aliases: ["sold"] },
];

const NAV_INTENT_WORDS = ["open", "go to", "take me", "navigate", "move to", "khol", "le chalo", "jao"];

type SnapshotState = {
  users: any[];
  leads: any[];
  inventory: any[];
  pendingRequests: any[];
  loadedAt: Date | null;
};

type Message = { id: number; role: "assistant" | "user"; text: string };

const normalizeText = (value: unknown) => String(value || "").trim().toLowerCase();
const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const toLeadName = (lead: any) =>
  String(lead?.name || lead?.fullName || lead?.customerName || lead?.contactName || lead?.phone || "Untitled lead");
const toInventoryLabel = (asset: any) => {
  const project = String(asset?.projectName || "").trim();
  const tower = String(asset?.towerName || "").trim();
  const unit = String(asset?.unitNumber || "").trim();
  return [project, tower, unit].filter(Boolean).join(" | ") || String(asset?._id || "Untitled asset");
};
const resolveUserName = (user: any) => String(user?.name || user?.fullName || user?.email || user?._id || "Unknown user");
const formatDateTime = (value: Date | string | null | undefined) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const buildBreakdown = (rows: any[], fieldName: string, maxRows = MAX_PREVIEW_ROWS) => {
  const counter = rows.reduce((acc: Record<string, number>, row) => {
    const key = String(row?.[fieldName] || "UNKNOWN").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counter)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, maxRows)
    .map(([key, value]) => `${key}: ${value}`);
};

const detectRole = (query: string) => {
  for (let i = 0; i < ROLE_PATTERNS.length; i += 1) {
    const entry = ROLE_PATTERNS[i];
    if (entry.aliases.some((alias) => query.includes(alias))) return entry.role;
  }
  return "";
};

const detectLeadStatus = (query: string) => {
  for (let i = 0; i < LEAD_STATUS_PATTERNS.length; i += 1) {
    const entry = LEAD_STATUS_PATTERNS[i];
    if (entry.aliases.some((alias) => query.includes(alias))) return entry.status;
  }
  return "";
};

const detectInventoryStatus = (query: string) => {
  for (let i = 0; i < INVENTORY_STATUS_PATTERNS.length; i += 1) {
    const entry = INVENTORY_STATUS_PATTERNS[i];
    if (entry.aliases.some((alias) => query.includes(alias))) return entry.status;
  }
  return "";
};

const extractLocation = (query: string) => {
  const inMatch = query.match(/\b(?:in|at|from)\s+([a-z][a-z0-9\s-]{1,30})/i);
  if (inMatch?.[1]) return normalizeText(inMatch[1]).trim();
  return "";
};

const matchNavigationTarget = (query: string) =>
  NAV_ITEMS.find((item) => item.aliases.some((alias) => query.includes(alias))) || null;

const initialMessages = (): Message[] => [
  {
    id: 1,
    role: "assistant",
    text: "Admin assistant is ready. Ask for overview, users, leads, inventory, approvals, search, or navigation.",
  },
  {
    id: 2,
    role: "assistant",
    text: "Try: Give me full system overview",
  },
];

export const AdminCommandConsoleScreen = () => {
  const navigation = useNavigation<any>();
  const chatRef = useRef<ScrollView | null>(null);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [snapshot, setSnapshot] = useState<SnapshotState>({
    users: [],
    leads: [],
    inventory: [],
    pendingRequests: [],
    loadedAt: null,
  });

  const snapshotLoaded = useMemo(() => !!snapshot.loadedAt, [snapshot.loadedAt]);

  const appendMessage = useCallback((role: "assistant" | "user", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollToEnd({ animated: true });
  }, [messages, running]);

  const loadSnapshot = useCallback(async (force = false) => {
    if (!force && snapshot.loadedAt) return snapshot;
    setLoadingSnapshot(true);
    setRuntimeError("");
    try {
      const [usersData, leadsData, inventoryData, requestData] = await Promise.all([
        getUsers(),
        getAllLeads(),
        getInventoryAssets(),
        getPendingInventoryRequests(),
      ]);
      const nextSnapshot: SnapshotState = {
        users: Array.isArray(usersData?.users) ? usersData.users : [],
        leads: Array.isArray(leadsData) ? leadsData : [],
        inventory: Array.isArray(inventoryData) ? inventoryData : [],
        pendingRequests: Array.isArray(requestData) ? requestData : [],
        loadedAt: new Date(),
      };
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      const message = toErrorMessage(error, "Failed to load admin snapshot");
      setRuntimeError(message);
      throw new Error(message);
    } finally {
      setLoadingSnapshot(false);
    }
  }, [snapshot]);

  useEffect(() => {
    loadSnapshot(false).catch(() => {});
  }, [loadSnapshot]);

  const navigateToTarget = (target: any) => {
    if (!target) return;
    if (target.tab) {
      navigation.navigate(target.screen, { screen: target.tab });
      return;
    }
    navigation.navigate(target.screen);
  };

  const buildOverviewReply = (data: SnapshotState) => {
    const activeUsers = data.users.filter((row) => row?.isActive !== false).length;
    const closedLeads = data.leads.filter((row) => String(row?.status || "").toUpperCase() === "CLOSED").length;
    const unassignedLeads = data.leads.filter((row) => !row?.assignedTo?._id && !row?.assignedTo).length;
    const soldInventory = data.inventory.filter((row) => String(row?.status || "").toUpperCase() === "SOLD").length;
    return [
      `Snapshot: ${formatDateTime(data.loadedAt)}`,
      `Users: ${data.users.length} total | ${activeUsers} active`,
      `Leads: ${data.leads.length} total | ${closedLeads} closed | ${unassignedLeads} unassigned`,
      `Inventory: ${data.inventory.length} total | ${soldInventory} sold`,
      `Pending approvals: ${data.pendingRequests.length}`,
      "",
      "Top role split:",
      ...buildBreakdown(data.users, "role").map((line) => `- ${line}`),
      "",
      "Top lead status split:",
      ...buildBreakdown(data.leads, "status").map((line) => `- ${line}`),
      "",
      "Top inventory status split:",
      ...buildBreakdown(data.inventory, "status").map((line) => `- ${line}`),
    ].join("\n");
  };

  const buildUsersReply = (data: SnapshotState, query: string) => {
    const role = detectRole(query);
    const wantInactive = includesAny(query, ["inactive", "disabled"]);
    const wantActiveOnly = includesAny(query, ["active", "working"]) && !wantInactive;
    let rows = data.users;
    if (role) rows = rows.filter((row) => String(row?.role || "").toUpperCase() === role);
    if (wantInactive) rows = rows.filter((row) => row?.isActive === false);
    else if (wantActiveOnly) rows = rows.filter((row) => row?.isActive !== false);
    if (!rows.length) return "No users matched this filter.";
    const visible = rows.slice(0, MAX_PREVIEW_ROWS);
    const lines = [`Found ${rows.length} user(s).`];
    visible.forEach((row, index) => {
      const status = row?.isActive === false ? "INACTIVE" : "ACTIVE";
      lines.push(`${index + 1}. ${resolveUserName(row)} | ${ROLE_LABELS[row?.role] || row?.role || "-"} | ${status}`);
    });
    if (rows.length > MAX_PREVIEW_ROWS) lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more users`);
    return lines.join("\n");
  };

  const buildLeadsReply = (data: SnapshotState, query: string) => {
    const status = detectLeadStatus(query);
    const location = extractLocation(query);
    const wantsUnassigned = includesAny(query, ["unassigned", "not assigned", "without assignee"]);
    const wantsAssigned = includesAny(query, ["assigned"]) && !wantsUnassigned;
    const wantsCount = includesAny(query, COUNT_INTENT_TERMS);
    let rows = data.leads;
    if (status) rows = rows.filter((row) => String(row?.status || "").toUpperCase() === status);
    if (location) {
      rows = rows.filter((row) => {
        const city = normalizeText(row?.city);
        const locality = normalizeText((row as any)?.location);
        return city.includes(location) || locality.includes(location);
      });
    }
    if (wantsUnassigned) rows = rows.filter((row) => !row?.assignedTo?._id && !row?.assignedTo);
    else if (wantsAssigned) rows = rows.filter((row) => !!(row?.assignedTo?._id || row?.assignedTo));
    if (!rows.length) return "No leads matched this filter.";
    if (wantsCount) return `Lead count: ${rows.length}`;
    const visible = rows.slice(0, MAX_PREVIEW_ROWS);
    const lines = [`Found ${rows.length} lead(s).`];
    visible.forEach((row, index) => {
      const city = String(row?.city || (row as any)?.location || "-");
      const assignee = resolveUserName((row as any)?.assignedTo);
      lines.push(`${index + 1}. ${toLeadName(row)} | ${row?.status || "-"} | ${city} | ${assignee}`);
    });
    if (rows.length > MAX_PREVIEW_ROWS) lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more leads`);
    return lines.join("\n");
  };

  const buildInventoryReply = (data: SnapshotState, query: string) => {
    const status = detectInventoryStatus(query);
    const location = extractLocation(query);
    let rows = data.inventory;
    if (status) rows = rows.filter((row) => String(row?.status || "").toUpperCase() === status);
    if (location) rows = rows.filter((row) => normalizeText(row?.location).includes(location));
    if (!rows.length) return "No inventory matched this filter.";
    const visible = rows.slice(0, MAX_PREVIEW_ROWS);
    const lines = [`Found ${rows.length} inventory unit(s).`];
    visible.forEach((row, index) => {
      lines.push(`${index + 1}. ${toInventoryLabel(row)} | ${row?.status || "-"} | ${row?.location || "-"}`);
    });
    if (rows.length > MAX_PREVIEW_ROWS) lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more inventory rows`);
    return lines.join("\n");
  };

  const buildPendingRequestsReply = (data: SnapshotState) => {
    const rows = data.pendingRequests || [];
    if (!rows.length) return "No pending approval requests right now.";
    const visible = rows.slice(0, MAX_PREVIEW_ROWS);
    const lines = [`Pending approval requests: ${rows.length}`];
    visible.forEach((row, index) => {
      const requestedBy = resolveUserName(row?.requestedBy);
      const type = String(row?.type || row?.requestType || "update").toUpperCase();
      lines.push(`${index + 1}. ${type} | ${requestedBy}`);
    });
    return lines.join("\n");
  };

  const buildSearchReply = (data: SnapshotState, query: string) => {
    const term = normalizeText(query.replace(/^find\s+/i, "").replace(/^search\s+/i, "").replace(/^look\s*up\s+/i, ""));
    if (!term) return "Please provide a keyword to search. Example: find ravi";
    const userHits = data.users.filter((row) =>
      [row?.name, row?.email, row?.phone, row?.role].map((item) => normalizeText(item)).join(" ").includes(term));
    const leadHits = data.leads.filter((row) =>
      [toLeadName(row), row?.city, (row as any)?.location, row?.phone, row?.status].map((item) => normalizeText(item)).join(" ").includes(term));
    const inventoryHits = data.inventory.filter((row) =>
      [row?.projectName, row?.towerName, row?.unitNumber, row?.location, row?.status].map((item) => normalizeText(item)).join(" ").includes(term));
    return [
      `Search results for "${term}"`,
      `Users: ${userHits.length}`,
      `Leads: ${leadHits.length}`,
      `Inventory: ${inventoryHits.length}`,
    ].join("\n");
  };

  const handleAsk = useCallback(async (rawInput: string) => {
    const prompt = String(rawInput || "").trim();
    if (!prompt) return;
    const query = normalizeText(prompt);
    appendMessage("user", prompt);
    setInput("");
    if (query === "clear" || query === "clear chat" || query === "reset chat") {
      setMessages(initialMessages());
      return;
    }
    setRunning(true);
    try {
      if (includesAny(query, ["refresh", "reload", "sync latest", "update data"])) {
        const refreshed = await loadSnapshot(true);
        appendMessage("assistant", `Data refreshed.\nSnapshot time: ${formatDateTime(refreshed.loadedAt)}`);
        return;
      }
      const navTarget = matchNavigationTarget(query);
      if (navTarget && includesAny(query, NAV_INTENT_WORDS)) {
        appendMessage("assistant", `Opening ${navTarget.tab || navTarget.screen}.`);
        navigateToTarget(navTarget);
        return;
      }
      const data = await loadSnapshot(false);
      if (includesAny(query, ["overview", "everything", "all data", "snapshot", "full system"])) {
        appendMessage("assistant", buildOverviewReply(data));
        return;
      }
      if (includesAny(query, ["pending request", "approval request", "approvals", "pending approvals"])) {
        appendMessage("assistant", buildPendingRequestsReply(data));
        return;
      }
      if (includesAny(query, ["user", "team", "executive", "manager", "field executive"])) {
        appendMessage("assistant", buildUsersReply(data, query));
        return;
      }
      if (includesAny(query, LEAD_INTENT_TERMS)) {
        appendMessage("assistant", buildLeadsReply(data, query));
        return;
      }
      if (includesAny(query, ["inventory", "property", "asset", "blocked", "sold", "available"])) {
        appendMessage("assistant", buildInventoryReply(data, query));
        return;
      }
      if (includesAny(query, ["find ", "search ", "look up "])) {
        appendMessage("assistant", buildSearchReply(data, query));
        return;
      }
      appendMessage("assistant", "I could not map that request yet. Try: overview, blocked inventory, unassigned leads, pending approvals.");
    } catch (error) {
      appendMessage("assistant", toErrorMessage(error, "Sorry, request failed."));
    } finally {
      setRunning(false);
    }
  }, [appendMessage, loadSnapshot]);

  return (
    <Screen title="Admin Console" subtitle="Natural Language Ops Console" error={runtimeError}>
      <AppCard style={styles.headerCard as object}>
        <View style={styles.headerRow}>
          <Text style={styles.metaLabel}>{snapshotLoaded ? `Snapshot ${formatDateTime(snapshot.loadedAt)}` : "Snapshot loading..."}</Text>
          <AppButton
            title={loadingSnapshot ? "Refreshing..." : "Refresh"}
            variant="ghost"
            onPress={() => handleAsk("refresh")}
            disabled={running || loadingSnapshot}
          />
        </View>
      </AppCard>

      <ScrollView ref={chatRef} style={styles.chatPanel} contentContainerStyle={styles.chatContent}>
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <View key={message.id} style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.roleText, isUser ? styles.userRoleText : styles.assistantRoleText]}>
                  {isUser ? "ADMIN" : "ASSISTANT"}
                </Text>
                <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>{message.text}</Text>
              </View>
            </View>
          );
        })}
        {running ? <Text style={styles.thinking}>Assistant is thinking...</Text> : null}
      </ScrollView>

      <View style={styles.inputPanel}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about users, leads, inventory, approvals, navigation..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          editable={!running}
          onSubmitEditing={() => handleAsk(input)}
        />
        <View style={styles.actionRow}>
          <AppButton title="Send" onPress={() => handleAsk(input)} disabled={running || !input.trim()} />
          <AppButton title="Clear Chat" variant="ghost" onPress={() => setMessages(initialMessages())} disabled={running} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Pressable key={prompt} style={styles.suggestionChip} onPress={() => handleAsk(prompt)} disabled={running}>
            <Text style={styles.suggestionText}>{prompt}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerCard: { marginBottom: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  metaLabel: { color: "#475569", fontSize: 11, fontWeight: "600", flex: 1 },
  chatPanel: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#f8fafc" },
  chatContent: { padding: 10, gap: 8 },
  bubbleWrap: { flexDirection: "row" },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "92%", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1 },
  assistantBubble: { borderColor: "#e2e8f0", backgroundColor: "#fff" },
  userBubble: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  roleText: { fontSize: 10, fontWeight: "700", marginBottom: 4 },
  assistantRoleText: { color: "#0f172a" },
  userRoleText: { color: "#cbd5e1" },
  messageText: { fontSize: 12, lineHeight: 18 },
  assistantMessageText: { color: "#334155" },
  userMessageText: { color: "#fff" },
  thinking: { color: "#64748b", fontSize: 12, marginTop: 4 },
  inputPanel: { marginTop: 10, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#0f172a",
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  actionRow: { flexDirection: "row", gap: 8 },
  suggestionRow: { gap: 8, paddingBottom: 2 },
  suggestionChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionText: { color: "#334155", fontSize: 11, fontWeight: "600" },
});
