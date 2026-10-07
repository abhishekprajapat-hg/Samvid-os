import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Screen } from "../../components/common/Screen";
import { AppButton, AppCard } from "../../components/common/ui";
import { useAuth } from "../../context/AuthContext";
import {
  approveLeadStatusRequest,
  getAllLeads,
  rejectLeadStatusRequest,
} from "../../services/leadService";
import {
  approveInventoryRequest,
  getInventoryAssets,
  getPendingInventoryRequests,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { getUsers, reviewUserDeleteRequest } from "../../services/userService";
import { getFinanceOverview, getFinanceTransactions } from "../../services/financeService";
import { shareTextFile } from "../../utils/shareFile";
import { toErrorMessage } from "../../utils/errorMessage";
import { themedStyles, themeColor } from "../../theme/themedStyles";
import {
  MAX_AUDIT_ROWS,
  appendAudit,
  buildAuditReply,
  buildConfirmPrompt,
  describeAction,
  isCancelCommand,
  isConfirmCommand,
  parseActionIntent,
  type AuditEntry,
  type PendingAction,
} from "./consoleActions";

const AUDIT_STORAGE_KEY = "officeOnRent.adminAssistant.audit";
const WORKFLOW_STORAGE_KEY = "officeOnRent.adminAssistant.workflows";
const SUBSCRIPTION_STORAGE_KEY = "officeOnRent.adminAssistant.subscriptions";

const MAX_PREVIEW_ROWS = 6;
const COUNT_INTENT_TERMS = ["how many", "count", "number of", "total", "kitne", "kitni", "kitna"];
const LEAD_INTENT_TERMS = ["lead", "leads", "deal", "deals", "opportunity", "pipeline", "follow up", "site visit"];
const SUGGESTED_PROMPTS = [
  "Give me full system overview",
  "Top 5 executives by performance",
  "Show latest 10 hot leads",
  "Finance this month",
  "Export closed deals this month csv",
  "Notify me when pending approvals > 10",
  "Save this as weekly review",
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
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  COMMUNITY_MANAGER: "Community Manager",
  CHANNEL_PARTNER: "Channel Partner",
  COWORKING_ADMIN: "Coworking admin",
};

const ROLE_PATTERNS = [
  { role: "COMMUNITY_MANAGER", aliases: ["community manager", "community_manager", "cm"] },
  { role: "PRODUCTION_EXECUTIVE", aliases: ["production executive", "production_exec", "pe"] },
  { role: "FIELD_EXECUTIVE", aliases: ["field executive", "field agent", "field_exec", "fe"] },
  { role: "CHANNEL_PARTNER", aliases: ["channel partner", "partner"] },
  { role: "COWORKING_ADMIN", aliases: ["coworking admin", "coworking_admin"] },
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
  financeSummary: any | null;
  financeTransactions: any[];
  loadedAt: Date | null;
};

type Message = { id: number; role: "assistant" | "user"; text: string };
type DateRange = { start: Date; end: Date; label: string };
type RankingItem = { rank: number; userId: string; userName: string; role: string };
type Workflow = { name: string; key: string; prompt: string; runCount: number; updatedAt: string };
type Subscription = {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  active: boolean;
  lastState?: boolean;
  lastTriggeredAt?: string | null;
};

const normalizeText = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizeIntentText = (value: unknown) => {
  let text = normalizeText(value).replace(/\s+/g, " ");
  const replacements: Array<[RegExp, string]> = [
    [/आज/g, "today"],
    [/इस\s+(?:हफ्ते|सप्ताह)/g, "this week"],
    [/पिछले\s+(?:हफ्ते|सप्ताह)/g, "last week"],
    [/इस\s+(?:महीने|माह)/g, "this month"],
    [/पिछले\s+(?:महीने|माह)/g, "last month"],
    [/लीड्स?|ग्राहक/g, "lead"],
    [/फॉलो\s*अप/g, "follow up"],
    [/खोलो|खोलिए|खोल/g, "open"],
    [/दिखाओ|दिखाइए|दिखा\s+दो/g, "show"],
    [/कितने|कितनी|कितना/g, "how many"],
    [/सबसे\s+(?:अच्छा|बेहतर)|बेहतरीन/g, "best"],
    [/टॉप/g, "top"],
    [/मैनेजर/g, "manager"],
    [/एक्जीक्यूटिव|एग्जीक्यूटिव/g, "executive"],
    [/फाइनेंस|वित्त/g, "finance"],
    [/पेंडिंग/g, "pending"],
    [/अप्रूव|मंजूर|मंज़ूर/g, "approve"],
    [/रिजेक्ट|अस्वीकार/g, "reject"],
    [/निर्यात/g, "export"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, ` ${replacement} `);
  return text.replace(/\s+/g, " ").trim();
};
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

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(value) || 0);

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const parseDateToken = (value: string, end = false) => {
  const token = String(value || "").trim();
  const iso = token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = token.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : dmy
      ? { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) }
      : null;
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  if (date.getFullYear() !== parts.year || date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) return null;
  return date;
};
const parseDateRange = (query: string): DateRange | null => {
  const now = new Date();
  if (query.includes("today")) return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
  if (query.includes("yesterday")) {
    const day = addDays(now, -1);
    return { start: startOfDay(day), end: endOfDay(day), label: "Yesterday" };
  }
  if (query.includes("this month")) {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: "This Month" };
  }
  if (query.includes("last month")) {
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)), label: "Last Month" };
  }
  if (query.includes("this week")) {
    const start = startOfDay(now);
    start.setDate(start.getDate() + (start.getDay() === 0 ? -6 : 1 - start.getDay()));
    return { start, end: endOfDay(addDays(start, 6)), label: "This Week" };
  }
  if (query.includes("last week")) {
    const thisWeek = startOfDay(now);
    thisWeek.setDate(thisWeek.getDate() + (thisWeek.getDay() === 0 ? -6 : 1 - thisWeek.getDay()));
    return { start: addDays(thisWeek, -7), end: endOfDay(addDays(thisWeek, -1)), label: "Last Week" };
  }
  const lastDays = query.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/i);
  if (lastDays) {
    const days = Math.max(1, Math.min(365, Number(lastDays[1])));
    return { start: startOfDay(addDays(now, -(days - 1))), end: endOfDay(now), label: `Last ${days} Days` };
  }
  const between = query.match(/\b(?:between|from)\s+(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\s+(?:and|to)\s+(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\b/i);
  if (between) {
    const start = parseDateToken(between[1]);
    const end = parseDateToken(between[2], true);
    if (start && end && start <= end) {
      return { start, end, label: `${between[1]} to ${between[2]}` };
    }
  }
  return null;
};
const inRange = (value: unknown, range: DateRange | null) => {
  if (!range) return true;
  const date = new Date(String(value || ""));
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
};

const scopeSnapshot = (data: SnapshotState, range: DateRange | null): SnapshotState => {
  if (!range) return data;
  return {
    ...data,
    leads: data.leads.filter((row) => inRange(row?.updatedAt || row?.createdAt, range)),
    inventory: data.inventory.filter((row) => inRange(row?.updatedAt || row?.createdAt, range)),
    pendingRequests: data.pendingRequests.filter((row) => inRange(row?.updatedAt || row?.createdAt, range)),
    financeTransactions: data.financeTransactions.filter((row) => inRange(row?.date || row?.createdAt, range)),
  };
};

const entityId = (value: any) => String(typeof value === "string" ? value : value?._id || value?.id || "");
const performanceOwner = (lead: any, role: string, users: any[]) => {
  const direct = role === "FIELD_EXECUTIVE" ? lead?.assignedFieldExecutive : role === "MANAGER" ? lead?.assignedManager : lead?.assignedTo;
  if (direct && (!direct.role || String(direct.role).toUpperCase() === role)) return { id: entityId(direct), name: resolveUserName(direct) };
  let cursor = entityId(lead?.assignedTo);
  const lookup = new Map(users.map((row) => [entityId(row), row]));
  for (let depth = 0; depth < 8 && cursor; depth += 1) {
    const row = lookup.get(cursor);
    if (!row) break;
    if (String(row.role || "").toUpperCase() === role) return { id: cursor, name: resolveUserName(row) };
    cursor = entityId(row.parentId);
  }
  return null;
};
const performanceRows = (data: SnapshotState, role: string) => {
  const rows = new Map<string, any>();
  for (const lead of data.leads) {
    const owner = performanceOwner(lead, role, data.users);
    if (!owner?.id) continue;
    if (!rows.has(owner.id)) rows.set(owner.id, { ...owner, total: 0, closed: 0, lost: 0, active: 0 });
    const row = rows.get(owner.id);
    row.total += 1;
    const status = String(lead.status || "").toUpperCase();
    if (status === "CLOSED") row.closed += 1;
    else if (status === "LOST") row.lost += 1;
    else row.active += 1;
  }
  return [...rows.values()]
    .map((row) => ({ ...row, conversion: row.total ? Math.round((row.closed / row.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.closed - a.closed || b.conversion - a.conversion || b.active - a.active || b.total - a.total);
};
const hotLeadScore = (lead: any) => {
  const status = String(lead?.status || "").toUpperCase();
  const statusScore: Record<string, number> = { SITE_VISIT: 55, INTERESTED: 45, CONTACTED: 28, NEW: 16, REQUESTED: 50 };
  let score = statusScore[status] || 8;
  if (lead?.hotClient || String(lead?.temperature || "").toUpperCase() === "HOT") score += 35;
  if (lead?.nextFollowUp) {
    const diff = new Date(lead.nextFollowUp).getTime() - Date.now();
    if (diff < 0) score += 18;
    else if (diff < 24 * 60 * 60 * 1000) score += 12;
  }
  const freshness = Date.now() - new Date(lead?.updatedAt || lead?.createdAt || 0).getTime();
  if (freshness < 2 * 24 * 60 * 60 * 1000) score += 8;
  return score;
};
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const toCsv = (headers: string[], rows: unknown[][]) => [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

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
  const { user } = useAuth();
  const chatRef = useRef<ScrollView | null>(null);
  const lastPromptRef = useRef("");
  const micTranscriptRef = useRef("");
  const rankingRef = useRef<{ role: string; items: RankingItem[] } | null>(null);
  /*
   * The console can act, not just answer - but never in one step. An action is
   * parked here, confirmed in a second turn, and recorded afterwards. A
   * natural-language surface guesses at intent, so the one thing it must not do
   * is guess its way into an irreversible change.
   */
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(false);
  const [speechLocale, setSpeechLocale] = useState<"en-IN" | "hi-IN">("en-IN");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [snapshot, setSnapshot] = useState<SnapshotState>({
    users: [],
    leads: [],
    inventory: [],
    pendingRequests: [],
    financeSummary: null,
    financeTransactions: [],
    loadedAt: null,
  });

  const snapshotLoaded = useMemo(() => !!snapshot.loadedAt, [snapshot.loadedAt]);

  const appendMessage = useCallback((role: "assistant" | "user", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollToEnd({ animated: true });
  }, [messages, running]);

  useEffect(() => {
    let active = true;
    const setupSpeech = async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        if (!available) return;
        const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (active) {
          setIsMicSupported(true);
          setSpeechPermissionGranted(Boolean(permission.granted));
        }
      } catch {
        if (active) setIsMicSupported(false);
      }
    };
    void setupSpeech();
    return () => {
      active = false;
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  useSpeechRecognitionEvent("start", () => {
    micTranscriptRef.current = "";
    setIsListening(true);
  });
  useSpeechRecognitionEvent("end", () => {
    micTranscriptRef.current = "";
    setIsListening(false);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    setRuntimeError(String(event?.message || "Voice input could not start. Please try again."));
  });
  useSpeechRecognitionEvent("result", (event) => {
    const result = Array.isArray(event?.results) ? event.results[0] : null;
    const transcript = String(result?.transcript || "").replace(/\s+/g, " ").trim();
    if (!transcript || (!event?.isFinal && transcript === micTranscriptRef.current)) return;
    micTranscriptRef.current = transcript;
    if (event?.isFinal) setInput((current) => `${current.trim()} ${transcript}`.trim());
  });

  const toggleVoice = async () => {
    if (!isMicSupported) {
      setRuntimeError("Voice input is not supported on this device.");
      return;
    }
    try {
      setRuntimeError("");
      if (!speechPermissionGranted) {
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        setSpeechPermissionGranted(Boolean(permission.granted));
        if (!permission.granted) {
          setRuntimeError("Microphone permission is required for voice input.");
          return;
        }
      }
      if (isListening) {
        ExpoSpeechRecognitionModule.stop();
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale,
        interimResults: true,
        maxAlternatives: 1,
        addsPunctuation: true,
        continuous: false,
      });
    } catch {
      setIsListening(false);
      setRuntimeError("Voice input could not start. Please try again.");
    }
  };

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(WORKFLOW_STORAGE_KEY),
      AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY),
    ]).then(([savedWorkflows, savedSubscriptions]) => {
      try {
        const rows = savedWorkflows ? JSON.parse(savedWorkflows) : [];
        if (Array.isArray(rows)) setWorkflows(rows.slice(0, 40));
      } catch {}
      try {
        const rows = savedSubscriptions ? JSON.parse(savedSubscriptions) : [];
        if (Array.isArray(rows)) {
          setSubscriptions(rows.slice(0, 80).map((row, index) => ({
            ...row,
            id: String(row?.id || `saved-${index}-${row?.metric || "metric"}`),
          })));
        }
      } catch {}
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflows.slice(0, 40))).catch(() => {});
  }, [workflows]);

  useEffect(() => {
    AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subscriptions.slice(0, 80))).catch(() => {});
  }, [subscriptions]);

  const loadSnapshot = useCallback(async (force = false) => {
    if (!force && snapshot.loadedAt) return snapshot;
    setLoadingSnapshot(true);
    setRuntimeError("");
    try {
      const [usersData, leadsData, inventoryData, requestData, financeData, transactionData] = await Promise.all([
        getUsers(),
        getAllLeads(),
        getInventoryAssets(),
        getPendingInventoryRequests(),
        getFinanceOverview({ months: 6 }).catch(() => ({ summary: null, series: [] })),
        getFinanceTransactions({ limit: 500 }).catch(() => ({ transactions: [], totals: { in: 0, out: 0, net: 0 }, count: 0 })),
      ]);
      const nextSnapshot: SnapshotState = {
        users: Array.isArray(usersData?.users) ? usersData.users : [],
        leads: Array.isArray(leadsData) ? leadsData : [],
        inventory: Array.isArray(inventoryData) ? inventoryData : [],
        pendingRequests: Array.isArray(requestData) ? requestData : [],
        financeSummary: financeData?.summary || null,
        financeTransactions: Array.isArray(transactionData?.transactions) ? transactionData.transactions : [],
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

  const buildHotLeadsReply = (data: SnapshotState, query: string, range: DateRange | null) => {
    const match = query.match(/\b(?:top|latest|show)\s+(\d{1,2})\b/i);
    const limit = Math.max(1, Math.min(20, Number(match?.[1] || 10)));
    const rows = data.leads
      .filter((lead) => !["CLOSED", "LOST"].includes(String(lead?.status || "").toUpperCase()))
      .map((lead) => ({ lead, score: hotLeadScore(lead) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    if (!rows.length) return `No hot leads found${range ? ` in ${range.label}` : ""}.`;
    return [
      `Latest hot leads${range ? ` (${range.label})` : ""}`,
      ...rows.map(({ lead, score }, index) => `${index + 1}. ${toLeadName(lead)} | ${lead.status || "-"} | ${lead.phone || "-"} | Score ${score} | LeadId ${lead._id || "-"}`),
      "Open a row with: open lead <LeadId>",
    ].join("\n");
  };

  const buildPerformanceReply = (data: SnapshotState, query: string) => {
    const role = detectRole(query) || "EXECUTIVE";
    const rows = performanceRows(data, role);
    if (!rows.length) return `No performance rows found for ${ROLE_LABELS[role] || role}.`;
    const match = query.match(/\b(?:top|best)\s+(\d{1,2})\b/i);
    const wantsOne = query.includes("who is") || (query.includes("best") && !match);
    const limit = wantsOne ? 1 : Math.max(1, Math.min(10, Number(match?.[1] || 5)));
    const visible = rows.slice(0, limit);
    const items = visible.map((row, index) => ({ rank: index + 1, userId: row.id, userName: row.name, role }));
    rankingRef.current = { role, items };
    return [
      visible.length === 1 ? `Top ${ROLE_LABELS[role] || role}: ${visible[0].name}` : `Top ${visible.length} ${ROLE_LABELS[role] || role} performers:`,
      ...visible.map((row, index) => `${index + 1}. ${row.name} | Closed ${row.closed} | Conversion ${row.conversion}% | Active ${row.active} | Total ${row.total}`),
      "Ranking priority: closed deals, then conversion, then active pipeline.",
      "Try: open #1 leads",
    ].join("\n");
  };

  const buildDrillDownReply = (data: SnapshotState, rank: number) => {
    const context = rankingRef.current;
    if (!context) return "No ranking context found. Run a performance ranking first.";
    const item = context.items.find((row) => row.rank === rank);
    if (!item) return `Rank #${rank} is not available in the last ranking.`;
    const leads = data.leads.filter((lead) => performanceOwner(lead, context.role, data.users)?.id === item.userId);
    return [
      `Drill-down for #${rank} ${item.userName}: ${leads.length} lead(s)`,
      ...leads.slice(0, 12).map((lead, index) => `${index + 1}. ${toLeadName(lead)} | ${lead.status || "-"} | ${lead.phone || "-"} | LeadId ${lead._id || "-"}`),
      leads.length > 12 ? `+ ${leads.length - 12} more leads` : "",
    ].filter(Boolean).join("\n");
  };

  const buildFinanceReply = (data: SnapshotState, range: DateRange | null) => {
    const rows = data.financeTransactions;
    const income = rows.filter((row) => row.kind === "INCOME").reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const expenses = rows.filter((row) => row.kind === "EXPENSE").reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const summary = range ? null : data.financeSummary;
    const totalIncome = summary?.income ?? income;
    const totalExpenses = summary?.expenses ?? expenses;
    const categories = new Map<string, number>();
    rows.forEach((row) => categories.set(String(row.category || "Uncategorised"), (categories.get(String(row.category || "Uncategorised")) || 0) + Math.abs(Number(row.amount || 0))));
    const top = [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return [
      `Finance snapshot${range ? ` (${range.label})` : summary?.month ? ` (${summary.month})` : ""}`,
      `Income: ${formatCurrency(totalIncome)}`,
      `Expenses: ${formatCurrency(totalExpenses)}`,
      `Net cash flow: ${formatCurrency(Number(summary?.net ?? totalIncome - totalExpenses))}`,
      `Collected: ${formatCurrency(summary?.collected ?? income)}`,
      `Receivables: ${formatCurrency(summary?.receivables ?? 0)}`,
      `Transactions: ${rows.length}`,
      ...(top.length ? ["", "Top categories:", ...top.map(([label, amount], index) => `${index + 1}. ${label}: ${formatCurrency(amount)}`)] : []),
    ].join("\n");
  };

  const exportQuery = async (data: SnapshotState, query: string, range: DateRange | null) => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (includesAny(query, ["closed deal", "closed deals"])) {
      const rows = data.leads.filter((lead) => String(lead.status || "").toUpperCase() === "CLOSED");
      if (!rows.length) return "No closed deals found for export in this scope.";
      await shareTextFile(`closed-deals-${stamp}.csv`, toCsv(["Lead", "Phone", "City", "Project", "Assignee", "Closed At"], rows.map((lead) => [toLeadName(lead), lead.phone, lead.city, lead.projectInterested, resolveUserName(lead.assignedTo), lead.updatedAt])));
      return `Exported ${rows.length} closed deal(s)${range ? ` from ${range.label}` : ""}.`;
    }
    if (includesAny(query, ["approval", "approvals"])) {
      const rows = data.pendingRequests;
      if (!rows.length) return "No approval rows found for export in this scope.";
      await shareTextFile(`approvals-${stamp}.csv`, toCsv(["Type", "Requested By", "Created At", "Status"], rows.map((row) => [row.type || row.requestType, resolveUserName(row.requestedBy), row.createdAt, row.status || "PENDING"])));
      return `Exported ${rows.length} approval row(s).`;
    }
    if (includesAny(query, ["finance", "revenue", "transaction", "transactions"])) {
      const rows = data.financeTransactions;
      if (!rows.length) return "No finance rows found for export in this scope.";
      await shareTextFile(`finance-${stamp}.csv`, toCsv(["Date", "Kind", "Title", "Party", "Category", "Amount", "Status", "Reference"], rows.map((row) => [row.date, row.kind, row.title, row.party, row.category, row.amount, row.status, row.reference])));
      return `Exported ${rows.length} finance row(s).`;
    }
    return "Specify export type: closed deals, approvals, or finance.";
  };

  const subscriptionValue = (metric: string, data: SnapshotState) => {
    if (metric === "pending_approvals") return data.pendingRequests.length;
    if (metric === "unassigned_leads") return data.leads.filter((lead) => !entityId(lead.assignedTo)).length;
    if (metric === "hot_leads") return data.leads.filter((lead) => !["CLOSED", "LOST"].includes(String(lead.status || "").toUpperCase()) && hotLeadScore(lead) >= 60).length;
    if (metric === "overdue_followups") return data.leads.filter((lead) => lead.nextFollowUp && new Date(lead.nextFollowUp).getTime() < Date.now()).length;
    return 0;
  };

  const subscriptionLabel = (metric: string) => ({
    pending_approvals: "pending approvals",
    unassigned_leads: "unassigned leads",
    hot_leads: "hot leads",
    overdue_followups: "overdue follow-ups",
  } as Record<string, string>)[metric] || metric;

  const subscriptionMatches = (subscription: Subscription, data: SnapshotState) => {
    const value = subscriptionValue(subscription.metric, data);
    if (subscription.operator === ">") return value > subscription.threshold;
    if (subscription.operator === ">=") return value >= subscription.threshold;
    if (subscription.operator === "<") return value < subscription.threshold;
    if (subscription.operator === "<=") return value <= subscription.threshold;
    return value === subscription.threshold;
  };

  const buildSubscriptionAlerts = (data: SnapshotState) => subscriptions
    .filter((row) => row.active && subscriptionMatches(row, data))
    .map((row) => `- ${subscriptionLabel(row.metric)} is ${subscriptionValue(row.metric, data)} (${row.operator} ${row.threshold})`);

  useEffect(() => {
    if (!subscriptions.some((row) => row.active)) return undefined;
    const timer = setInterval(() => {
      loadSnapshot(true).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [loadSnapshot, subscriptions]);

  useEffect(() => {
    if (!snapshot.loadedAt || !subscriptions.length) return;
    const triggered: string[] = [];
    let changed = false;
    const next = subscriptions.map((row) => {
      if (!row.active) return row;
      const current = subscriptionMatches(row, snapshot);
      const previous = Boolean(row.lastState);
      if (current === previous) return row;
      changed = true;
      if (current) {
        triggered.push(`${subscriptionLabel(row.metric)} ${row.operator} ${row.threshold} matched (current ${subscriptionValue(row.metric, snapshot)}).`);
      }
      return {
        ...row,
        lastState: current,
        lastTriggeredAt: current ? new Date().toISOString() : row.lastTriggeredAt || null,
      };
    });
    if (triggered.length) {
      appendMessage("assistant", ["Subscription alert:", ...triggered.map((row, index) => `${index + 1}. ${row}`)].join("\n"));
    }
    if (changed) setSubscriptions(next);
  }, [appendMessage, snapshot, subscriptions]);

  // Device-local, and bounded: this is a record of what was done from THIS
  // phone, not a substitute for the server's own audit.
  useEffect(() => {
    AsyncStorage.getItem(AUDIT_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setAuditLog(parsed.slice(0, MAX_AUDIT_ROWS));
      })
      .catch(() => {});
  }, []);

  const recordAudit = useCallback((entry: AuditEntry) => {
    setAuditLog((current) => {
      const next = appendAudit(current, entry);
      AsyncStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** Runs a parked action against whichever service owns that request kind. */
  const executeAction = useCallback(
    async (action: PendingAction) => {
      if (action.target === "INVENTORY") {
        if (action.kind === "APPROVE") await approveInventoryRequest(action.id);
        else await rejectInventoryRequest(action.id, "Rejected from the admin console");
        return;
      }
      if (action.target === "LEAD_STATUS") {
        if (action.kind === "APPROVE") await approveLeadStatusRequest(action.id);
        else await rejectLeadStatusRequest(action.id, "Rejected from the admin console");
        return;
      }
      await reviewUserDeleteRequest(action.id, {
        status: action.kind === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewNote: "Reviewed from the admin console",
      });
    },
    [],
  );

  const handleAsk = useCallback(async (rawInput: string) => {
    const requestedPrompt = String(rawInput || "").trim();
    if (!requestedPrompt) return;
    let prompt = requestedPrompt;
    let query = normalizeIntentText(prompt);
    appendMessage("user", requestedPrompt);
    setInput("");
    if (query === "clear" || query === "clear chat" || query === "reset chat") {
      setMessages(initialMessages());
      return;
    }

    if (includesAny(query, ["list workflows", "show workflows", "saved workflows"])) {
      appendMessage("assistant", workflows.length
        ? ["Saved workflows:", ...workflows.map((row, index) => `${index + 1}. ${row.name} | ${row.prompt} | run ${row.runCount} time(s)`)].join("\n")
        : "No workflows are saved on this device yet.");
      return;
    }

    const deleteWorkflowMatch = query.match(/^(?:delete|remove)\s+workflow\s+(.+)$/i);
    if (deleteWorkflowMatch) {
      const key = normalizeText(deleteWorkflowMatch[1]);
      const exists = workflows.some((row) => row.key === key);
      if (exists) setWorkflows((current) => current.filter((row) => row.key !== key));
      appendMessage("assistant", exists ? `Deleted workflow "${deleteWorkflowMatch[1].trim()}".` : "That workflow was not found.");
      return;
    }

    const saveWorkflowMatch = query.match(/^save\s+(?:this|last(?:\s+command)?|last\s+query)\s+as\s+(.+)$/i);
    if (saveWorkflowMatch) {
      const workflowPrompt = lastPromptRef.current;
      if (!workflowPrompt) {
        appendMessage("assistant", "Run a command first, then save it as a workflow.");
        return;
      }
      const name = saveWorkflowMatch[1].trim();
      const key = normalizeText(name);
      const next: Workflow = { name, key, prompt: workflowPrompt, runCount: 0, updatedAt: new Date().toISOString() };
      setWorkflows((current) => [next, ...current.filter((row) => row.key !== key)].slice(0, 40));
      appendMessage("assistant", `Saved workflow "${name}": ${workflowPrompt}`);
      return;
    }

    const runWorkflowMatch = query.match(/^(?:run|start|execute)\s+(?:workflow\s+)?(.+)$/i);
    if (runWorkflowMatch) {
      const key = normalizeText(runWorkflowMatch[1]);
      const workflow = workflows.find((row) => row.key === key);
      if (!workflow) {
        appendMessage("assistant", `Workflow "${runWorkflowMatch[1].trim()}" was not found.`);
        return;
      }
      prompt = workflow.prompt;
      query = normalizeIntentText(prompt);
      setWorkflows((current) => current.map((row) => row.key === key
        ? { ...row, runCount: row.runCount + 1, updatedAt: new Date().toISOString() }
        : row));
      appendMessage("assistant", `Running "${workflow.name}": ${workflow.prompt}`);
    }

    if (includesAny(query, ["list subscriptions", "show subscriptions", "my notifications", "threshold alerts"])) {
      appendMessage("assistant", subscriptions.length
        ? ["Threshold subscriptions:", ...subscriptions.map((row, index) => `${index + 1}. ${subscriptionLabel(row.metric)} ${row.operator} ${row.threshold} | Current ${subscriptionValue(row.metric, snapshot)}`)].join("\n")
        : "No threshold subscriptions are saved on this device.");
      return;
    }

    const removeSubscriptionMatch = query.match(/^(?:remove|delete|cancel|stop)\s+(?:subscription|alert)\s+#?(\d{1,2})$/i);
    if (removeSubscriptionMatch) {
      const index = Number(removeSubscriptionMatch[1]);
      const row = subscriptions[index - 1];
      if (!row) {
        appendMessage("assistant", `Subscription #${index} was not found.`);
        return;
      }
      setSubscriptions((current) => current.filter((entry) => entry.id !== row.id));
      appendMessage("assistant", `Removed subscription #${index}: ${subscriptionLabel(row.metric)} ${row.operator} ${row.threshold}.`);
      return;
    }

    const clearSubscriptions = /^(?:clear|remove|delete)\s+(?:all\s+)?(?:subscriptions|threshold alerts|alerts)$/i.test(query);
    if (clearSubscriptions) {
      setSubscriptions([]);
      appendMessage("assistant", "All threshold subscriptions were removed.");
      return;
    }

    const subscriptionMatch = query.match(/(?:notify|alert)\s+me\s+when\s+(pending approvals|unassigned leads|hot leads|overdue follow[ -]?ups?)\s*(>=|<=|>|<|=|is above|exceeds|is below|drops below|equals?)\s*(\d+)/i);
    if (subscriptionMatch) {
      const metricKey = normalizeText(subscriptionMatch[1]).replace(/[ -]/g, "_").replace(/follow_?ups?/, "followups");
      const metric = metricKey === "overdue_followups" ? metricKey : metricKey.replace(/s$/, "s");
      const rawOperator = normalizeText(subscriptionMatch[2]);
      const operator = includesAny(rawOperator, ["above", "exceed"]) ? ">" : includesAny(rawOperator, ["below", "drop"]) ? "<" : rawOperator.startsWith("equal") ? "=" : rawOperator;
      const threshold = Number(subscriptionMatch[3]);
      const next: Subscription = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        metric,
        operator,
        threshold,
        active: true,
        lastState: false,
        lastTriggeredAt: null,
      };
      setSubscriptions((current) => [next, ...current.filter((row) => !(row.metric === metric && row.operator === operator && row.threshold === threshold))].slice(0, 80));
      appendMessage("assistant", `Subscribed on this device: alert when ${subscriptionLabel(metric)} ${operator} ${threshold}.`);
      return;
    }

    // A parked action is settled before anything else is considered, so
    // "confirm" cannot be read as a fresh query.
    if (isCancelCommand(query, Boolean(pendingAction))) {
      setPendingAction(null);
      appendMessage("assistant", "Dropped. Nothing was changed.");
      return;
    }

    if (isConfirmCommand(query, Boolean(pendingAction)) && pendingAction) {
      setRunning(true);
      try {
        await executeAction(pendingAction);
        recordAudit({
          at: new Date().toISOString(),
          actor: String(user?.name || "Admin"),
          action: describeAction(pendingAction),
          details: pendingAction.label,
        });
        appendMessage("assistant", `Done. ${describeAction(pendingAction)}.`);
        setPendingAction(null);
        await loadSnapshot(true);
      } catch (error) {
        appendMessage("assistant", toErrorMessage(error, "That action did not go through."));
      } finally {
        setRunning(false);
      }
      return;
    }

    setRunning(true);
    try {
      if (includesAny(query, ["audit", "what did i do", "action log", "history of actions"])) {
        appendMessage("assistant", buildAuditReply(auditLog));
        return;
      }
      if (includesAny(query, ["refresh", "reload", "sync latest", "update data"])) {
        const refreshed = await loadSnapshot(true);
        const alerts = buildSubscriptionAlerts(refreshed);
        appendMessage("assistant", [
          "Data refreshed.",
          `Snapshot time: ${formatDateTime(refreshed.loadedAt)}`,
          ...(alerts.length ? ["", "Triggered threshold alerts:", ...alerts] : []),
        ].join("\n"));
        return;
      }
      const navTarget = matchNavigationTarget(query);
      if (navTarget && includesAny(query, NAV_INTENT_WORDS)) {
        appendMessage("assistant", `Opening ${navTarget.tab || navTarget.screen}.`);
        navigateToTarget(navTarget);
        return;
      }
      lastPromptRef.current = prompt;
      const rawData = await loadSnapshot(false);
      const range = parseDateRange(query);
      const data = scopeSnapshot(rawData, range);

      /*
       * Mutations are resolved before read-only lead/inventory queries. An
       * instruction such as "approve lead request" contains the word lead,
       * but must park a confirmable action rather than render a lead list.
       */
      const intent = parseActionIntent(query);
      if (intent) {
        const queue = (data.pendingRequests || []).filter((row: any) => {
          const type = String(row?.type || row?.requestType || "").toUpperCase();
          if (intent.target === "INVENTORY") return !type.includes("LEAD") && !type.includes("USER");
          if (intent.target === "LEAD_STATUS") return type.includes("LEAD");
          return type.includes("USER");
        });
        if (!queue.length) {
          appendMessage("assistant", "Nothing is waiting in that queue right now.");
          return;
        }
        const oldest = queue[queue.length - 1];
        const action: PendingAction = {
          kind: intent.kind,
          target: intent.target,
          id: String(oldest?._id || ""),
          label: `${String(oldest?.type || oldest?.requestType || "request").toLowerCase()} from ${resolveUserName(oldest?.requestedBy)}`,
        };
        if (!action.id) {
          appendMessage("assistant", "I found a request but it has no id I can act on.");
          return;
        }
        setPendingAction(action);
        appendMessage("assistant", buildConfirmPrompt(action));
        return;
      }

      const leadOpenMatch = query.match(/\bopen\s+(?:lead\s+)?([a-f0-9]{24})\b/i);
      if (leadOpenMatch) {
        appendMessage("assistant", `Opening lead ${leadOpenMatch[1]}.`);
        navigation.navigate("LeadDetails", { leadId: leadOpenMatch[1] });
        return;
      }
      const phoneOpenMatch = query.match(/\bopen\s+lead(?:\s+by\s+phone)?\s+(\+?[\d\s-]{7,18})\b/i);
      if (phoneOpenMatch) {
        const phone = phoneOpenMatch[1].replace(/\D/g, "");
        const lead = data.leads.find((row) => String(row?.phone || "").replace(/\D/g, "").endsWith(phone.slice(-10)));
        if (!lead?._id) {
          appendMessage("assistant", `No lead was found for phone ${phoneOpenMatch[1].trim()}.`);
          return;
        }
        appendMessage("assistant", `Opening ${toLeadName(lead)}.`);
        navigation.navigate("LeadDetails", { leadId: lead._id });
        return;
      }
      const rankMatch = query.match(/\bopen\s+#?(\d{1,2})\s+(?:lead|leads|pipeline|details?)\b/i);
      if (rankMatch) {
        appendMessage("assistant", buildDrillDownReply(data, Number(rankMatch[1])));
        return;
      }
      if (includesAny(query, ["export", "download", "csv"])) {
        appendMessage("assistant", await exportQuery(data, query, range));
        return;
      }
      if (includesAny(query, ["hot lead", "hot leads", "priority lead", "priority leads"])) {
        appendMessage("assistant", buildHotLeadsReply(data, query, range));
        return;
      }
      if (includesAny(query, ["performance", "performer", "performers", "best executive", "top executive", "best manager", "top manager", "best field executive", "top field executive"])) {
        appendMessage("assistant", buildPerformanceReply(data, query));
        return;
      }
      if (includesAny(query, ["finance", "cash flow", "income", "expense", "expenses", "receivable", "revenue"])) {
        appendMessage("assistant", buildFinanceReply(data, range));
        return;
      }
      if (includesAny(query, ["overview", "everything", "all data", "snapshot", "full system"])) {
        appendMessage("assistant", `${range ? `${range.label}\n` : ""}${buildOverviewReply(data)}`);
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
  }, [appendMessage, auditLog, executeAction, loadSnapshot, navigation, pendingAction, recordAudit, subscriptions, user?.name, workflows]);

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
          placeholderTextColor={themeColor("#98a3b5")}
          style={styles.input}
          editable={!running}
          onSubmitEditing={() => handleAsk(input)}
        />
        <View style={styles.voiceRow}>
          <View style={styles.languageRow}>
            {([[
              "en-IN", "English",
            ], [
              "hi-IN", "Hindi",
            ]] as const).map(([locale, label]) => (
              <Pressable
                key={locale}
                style={[styles.languageChip, speechLocale === locale && styles.languageChipActive]}
                onPress={() => setSpeechLocale(locale)}
                disabled={running || isListening}
                accessibilityRole="radio"
                accessibilityState={{ selected: speechLocale === locale }}
              >
                <Text style={[styles.languageText, speechLocale === locale && styles.languageTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.micButton, isListening && styles.micButtonActive, (!isMicSupported || running) && styles.disabledButton]}
            onPress={() => void toggleVoice()}
            disabled={!isMicSupported || running}
            accessibilityRole="button"
            accessibilityLabel={isListening ? "Stop voice input" : "Start voice input"}
          >
            <Text style={[styles.micText, isListening && styles.micTextActive]}>{isListening ? "Stop mic" : "Start mic"}</Text>
          </Pressable>
        </View>
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

const styles = themedStyles((c) => StyleSheet.create({
  headerCard: { marginBottom: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  metaLabel: { color: c.slate[600], fontSize: 11, fontWeight: "600", flex: 1 },
  chatPanel: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.bg },
  chatContent: { padding: 10, gap: 8 },
  bubbleWrap: { flexDirection: "row" },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "92%", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1 },
  assistantBubble: { borderColor: c.border, backgroundColor: c.surface },
  userBubble: { borderColor: c.text, backgroundColor: c.text },
  roleText: { fontSize: 10, fontWeight: "700", marginBottom: 4 },
  assistantRoleText: { color: c.text },
  userRoleText: { color: c.borderStrong },
  messageText: { fontSize: 12, lineHeight: 18 },
  assistantMessageText: { color: c.slate[700] },
  userMessageText: { color: c.surface },
  thinking: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  inputPanel: { marginTop: 10, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    color: c.text,
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  voiceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  languageRow: { flexDirection: "row", gap: 6 },
  languageChip: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: c.surface },
  languageChipActive: { borderColor: c.primary, backgroundColor: c.blue[50] },
  languageText: { color: c.slate[600], fontSize: 11, fontWeight: "700" },
  languageTextActive: { color: c.primary },
  micButton: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: c.surface },
  micButtonActive: { borderColor: c.rose[500], backgroundColor: c.rose[50] },
  micText: { color: c.slate[700], fontSize: 11, fontWeight: "700" },
  micTextActive: { color: c.rose[700] },
  disabledButton: { opacity: 0.45 },
  actionRow: { flexDirection: "row", gap: 8 },
  suggestionRow: { gap: 8, paddingBottom: 2 },
  suggestionChip: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 999,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionText: { color: c.slate[700], fontSize: 11, fontWeight: "600" },
}));
