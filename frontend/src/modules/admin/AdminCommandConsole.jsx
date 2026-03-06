import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Languages,
  MessageSquare,
  Mic,
  MicOff,
  RefreshCw,
  UserCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAllLeads,
  getLeadPaymentRequests,
  updateLeadStatus,
} from "../../services/leadService";
import {
  approveInventoryRequest,
  getInventoryAssets,
  getPendingInventoryRequests,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const MAX_PREVIEW_ROWS = 6;
const MAX_BREAKDOWN_ROWS = 6;
const MAX_STORED_MESSAGES = 120;
const MAX_STORED_WORKFLOWS = 40;
const MAX_STORED_SUBSCRIPTIONS = 80;
const MAX_AUDIT_LOG_ROWS = 200;
const ASSISTANT_HISTORY_STORAGE_PREFIX = "samvid.adminAssistant.history";
const ASSISTANT_WORKFLOW_STORAGE_PREFIX = "samvid.adminAssistant.workflows";
const ASSISTANT_SUBSCRIPTION_STORAGE_PREFIX = "samvid.adminAssistant.subscriptions";
const ASSISTANT_AUDIT_STORAGE_PREFIX = "samvid.adminAssistant.audit";
const COUNT_INTENT_TERMS = ["how many", "count", "number of", "total", "kitne", "kitni", "kitna"];
const LEAD_INTENT_TERMS = [
  "lead",
  "leads",
  "deal",
  "deals",
  "opportunity",
  "opportunities",
  "pipeline",
  "follow up",
  "site visit",
];
const SUGGESTED_PROMPTS = [
  "Give me full system overview",
  "How many deals are closed this month?",
  "Who is the best manager?",
  "Top 5 executives by performance",
  "Open #2 leads",
  "Approve payment request for lead Rahul",
  "Open lead by phone 9876543210",
  "Show latest 10 hot leads",
  "Total sell by project this month",
  "Remaining amount this month by manager",
  "Export closed deals last month csv",
  "Notify me when pending approvals > 10",
  "Show audit log",
  "Save this as weekly review",
  "Run weekly review",
  "Show blocked inventory in noida",
  "Show unassigned leads",
  "How many deals are closed?",
  "How many field executives are active?",
  "Any pending approval requests?",
  "Take me to reports",
];

const NAV_ITEMS = [
  { path: "/", label: "Home", aliases: ["home", "dashboard"] },
  { path: "/leads", label: "Leads", aliases: ["lead", "leads", "pipeline"] },
  { path: "/inventory", label: "Inventory", aliases: ["inventory", "empire", "asset", "property"] },
  { path: "/reports", label: "Reports", aliases: ["reports", "report"] },
  { path: "/calendar", label: "Schedule", aliases: ["schedule", "calendar"] },
  { path: "/finance", label: "Finance", aliases: ["finance"] },
  { path: "/map", label: "Field Ops", aliases: ["field", "field ops", "fieldops", "map"] },
  { path: "/chat", label: "Chat", aliases: ["chat"] },
  { path: "/admin/notifications", label: "Alerts", aliases: ["alert", "alerts", "notification", "notifications"] },
  { path: "/admin/users", label: "Access", aliases: ["access", "team access", "users", "team"] },
  { path: "/settings", label: "System", aliases: ["system", "settings"] },
  { path: "/targets", label: "Targets", aliases: ["target", "targets"] },
  { path: "/profile", label: "Profile", aliases: ["profile"] },
];

const ROLE_LABELS = {
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

const NAV_INTENT_WORDS = [
  "open",
  "go to",
  "take me",
  "navigate",
  "move to",
  "khol",
  "khol do",
  "dikhao",
  "dikha do",
  "le chalo",
  "jao",
];

const CONFIRM_INTENT_TERMS = ["confirm", "yes confirm", "proceed", "yes proceed", "ok confirm"];
const CANCEL_INTENT_TERMS = ["cancel", "stop", "abort", "dismiss"];
const APPROVE_ACTION_TERMS = ["approve", "accept", "manzoor", "approve karo", "ok karo", "pass karo"];
const REJECT_ACTION_TERMS = ["reject", "decline", "mana", "reject karo", "deny"];
const LEAD_QUICK_OPEN_TERMS = [
  "open lead",
  "open leads",
  "lead details",
  "lead by phone",
  "hot lead",
  "hot leads",
  "lead kholo",
  "lead khol",
  "phone se lead",
];
const FINANCE_INTENT_TERMS = [
  "finance",
  "sell",
  "sale",
  "sales",
  "revenue",
  "remaining amount",
  "pending amount",
  "pending collection",
  "collected",
  "collection",
  "amount",
  "commission",
  "project wise",
  "manager wise",
  "bikri",
  "baaki amount",
  "bacha amount",
  "kitna remaining",
  "kitna collection",
];

const SUBSCRIPTION_METRICS = {
  TOTAL_PENDING_APPROVALS: "TOTAL_PENDING_APPROVALS",
  PENDING_PAYMENT_APPROVALS: "PENDING_PAYMENT_APPROVALS",
  PENDING_INVENTORY_APPROVALS: "PENDING_INVENTORY_APPROVALS",
};

const MUTATION_ALLOWED_ROLES = new Set(["ADMIN"]);
const EXPORT_ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"]);

const PERFORMANCE_INTENT_TERMS = [
  "best",
  "top",
  "performer",
  "performance",
  "leaderboard",
  "rank",
  "ranking",
  "highest",
  "most closed",
  "champion",
  "no 1",
  "number 1",
  "sabse best",
  "sabse acha",
  "sabse accha",
];

const PERFORMANCE_ALL_ROLE_TERMS = [
  "any role",
  "all roles",
  "role wise",
  "role-wise",
  "across roles",
  "by role",
];

const PERFORMANCE_ROLE_ORDER = [
  "MANAGER",
  "ASSISTANT_MANAGER",
  "TEAM_LEADER",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "CHANNEL_PARTNER",
];

const PERFORMANCE_FIELD_BY_ROLE = {
  MANAGER: "assignedManager",
  EXECUTIVE: "assignedExecutive",
  FIELD_EXECUTIVE: "assignedFieldExecutive",
  CHANNEL_PARTNER: "createdBy",
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const HINDI_INTENT_REPLACEMENTS = [
  [/।/g, " "],
  [/आज/g, "today"],
  [/इस\s+हफ्ते|इस\s+सप्ताह/g, "this week"],
  [/पिछले\s+हफ्ते|पिछले\s+सप्ताह/g, "last week"],
  [/इस\s+महीने|इस\s+माह/g, "this month"],
  [/पिछले\s+महीने|पिछले\s+माह/g, "last month"],
  [/लीड्स?|ग्राहक/g, "lead"],
  [/फॉलो\s*अप/g, "follow up"],
  [/खोलो|खोलिये|खोलिए|खोले|खोल/g, "open"],
  [/दिखाओ|दिखाइए|दिखाओगे|दिखा\s+दो/g, "show"],
  [/कितने|कितनी|कितना/g, "how many"],
  [/सबसे\s+अच्छा|सबसे\s+बेहतर|बेहतरीन/g, "best"],
  [/टॉप/g, "top"],
  [/मैनेजर/g, "manager"],
  [/एक्जीक्यूटिव|एग्जीक्यूटिव/g, "executive"],
  [/कैलेंडर/g, "calendar"],
  [/रिपोर्ट्स?|रिपोर्ट/g, "reports"],
  [/फाइनेंस|वित्त/g, "finance"],
  [/बिक्री/g, "sell"],
  [/बाकी\s+राशि|शेष\s+राशि|बाकी\s+पैसे/g, "remaining amount"],
  [/पेंडिंग/g, "pending"],
  [/अप्रूव|मंजूर|मंज़ूर/g, "approve"],
  [/रिजेक्ट|अस्वीकार/g, "reject"],
  [/निर्यात/g, "export"],
  [/ऑडिट\s+लॉग/g, "audit log"],
  [/सब्सक्रिप्शन/g, "subscriptions"],
];

const normalizeIntentText = (value) => {
  let normalized = normalizeText(value).replace(/\s+/g, " ");
  HINDI_INTENT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, ` ${replacement} `);
  });
  return normalized.replace(/\s+/g, " ").trim();
};

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const toLeadName = (lead) =>
  String(
    lead?.name
      || lead?.fullName
      || lead?.customerName
      || lead?.contactName
      || lead?.phone
      || "Untitled lead",
  );

const toInventoryLabel = (asset) => {
  const project = String(asset?.projectName || "").trim();
  const tower = String(asset?.towerName || "").trim();
  const unit = String(asset?.unitNumber || "").trim();
  return [project, tower, unit].filter(Boolean).join(" | ") || String(asset?._id || "Untitled asset");
};

const resolveUserName = (user) =>
  String(user?.name || user?.fullName || user?.email || user?._id || "Unknown user");

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const getAssistantStorageUserKey = () => {
  if (typeof window === "undefined") return "default";

  try {
    const parsedUser = JSON.parse(window.localStorage.getItem("user") || "{}");
    return String(
      parsedUser?._id
      || parsedUser?.id
      || parsedUser?.email
      || "default",
    ).trim() || "default";
  } catch {
    return "default";
  }
};

const getAssistantActorRole = () => {
  if (typeof window === "undefined") return "ADMIN";
  try {
    const directRole = String(window.localStorage.getItem("role") || "").trim().toUpperCase();
    if (directRole) return directRole;
    const parsedUser = JSON.parse(window.localStorage.getItem("user") || "{}");
    return String(parsedUser?.role || "ADMIN").trim().toUpperCase() || "ADMIN";
  } catch {
    return "ADMIN";
  }
};

const getHistoryStorageKey = () => {
  const userId = getAssistantStorageUserKey();
  return `${ASSISTANT_HISTORY_STORAGE_PREFIX}.${userId}`;
};

const getWorkflowStorageKey = () => {
  const userId = getAssistantStorageUserKey();
  return `${ASSISTANT_WORKFLOW_STORAGE_PREFIX}.${userId}`;
};

const getSubscriptionStorageKey = () => {
  const userId = getAssistantStorageUserKey();
  return `${ASSISTANT_SUBSCRIPTION_STORAGE_PREFIX}.${userId}`;
};

const getAuditStorageKey = () => {
  const userId = getAssistantStorageUserKey();
  return `${ASSISTANT_AUDIT_STORAGE_PREFIX}.${userId}`;
};

const loadStoredMessages = (storageKey) => {
  if (typeof window === "undefined" || !storageKey) return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;

    const normalized = parsed
      .map((row) => ({
        id: Number(row?.id) || Date.now() + Math.random(),
        role: row?.role === "user" ? "user" : "assistant",
        text: String(row?.text || "").trim(),
      }))
      .filter((row) => row.text);

    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
};

const toStoredMessages = (messages) => {
  if (!Array.isArray(messages) || !messages.length) return [];

  return messages
    .slice(-MAX_STORED_MESSAGES)
    .map((row) => ({
      id: Number(row?.id) || Date.now() + Math.random(),
      role: row?.role === "user" ? "user" : "assistant",
      text: String(row?.text || ""),
    }));
};

const normalizeWorkflowName = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const loadStoredWorkflows = (storageKey) => {
  if (typeof window === "undefined" || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => ({
        name: String(row?.name || "").trim(),
        key: normalizeWorkflowName(row?.name),
        prompt: String(row?.prompt || "").trim(),
        createdAt: row?.createdAt || null,
        updatedAt: row?.updatedAt || null,
        lastRunAt: row?.lastRunAt || null,
        runCount: Number(row?.runCount || 0),
      }))
      .filter((row) => row.name && row.prompt)
      .slice(0, MAX_STORED_WORKFLOWS);
  } catch {
    return [];
  }
};

const toStoredWorkflows = (workflows) => {
  if (!Array.isArray(workflows) || !workflows.length) return [];

  return workflows
    .slice(0, MAX_STORED_WORKFLOWS)
    .map((row) => ({
      name: String(row?.name || "").trim(),
      prompt: String(row?.prompt || "").trim(),
      createdAt: row?.createdAt || null,
      updatedAt: row?.updatedAt || null,
      lastRunAt: row?.lastRunAt || null,
      runCount: Number(row?.runCount || 0),
    }))
    .filter((row) => row.name && row.prompt);
};

const normalizeComparisonOperator = (value) => {
  const token = String(value || "").trim();
  if (token === ">=" || token === "=>") return ">=";
  if (token === "<=" || token === "=<") return "<=";
  if (token === ">" || token === "<" || token === "=" || token === "==") {
    return token === "==" ? "=" : token;
  }
  return "";
};

const loadStoredSubscriptions = (storageKey) => {
  if (typeof window === "undefined" || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => ({
        id: String(row?.id || "").trim() || `${Date.now()}-${Math.random()}`,
        metric: String(row?.metric || "").trim(),
        operator: normalizeComparisonOperator(row?.operator),
        threshold: Number(row?.threshold || 0),
        label: String(row?.label || "").trim(),
        active: row?.active !== false,
        createdAt: row?.createdAt || null,
        updatedAt: row?.updatedAt || null,
        lastTriggeredAt: row?.lastTriggeredAt || null,
        lastState: Boolean(row?.lastState),
      }))
      .filter((row) => row.metric && row.operator && Number.isFinite(row.threshold));
  } catch {
    return [];
  }
};

const toStoredSubscriptions = (subscriptions) => {
  if (!Array.isArray(subscriptions) || !subscriptions.length) return [];

  return subscriptions.map((row) => ({
    id: String(row?.id || "").trim() || `${Date.now()}-${Math.random()}`,
    metric: String(row?.metric || "").trim(),
    operator: normalizeComparisonOperator(row?.operator),
    threshold: Number(row?.threshold || 0),
    label: String(row?.label || "").trim(),
    active: row?.active !== false,
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
    lastTriggeredAt: row?.lastTriggeredAt || null,
    lastState: Boolean(row?.lastState),
  }));
};

const loadStoredAuditLog = (storageKey) => {
  if (typeof window === "undefined" || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => ({
        id: String(row?.id || "").trim() || `${Date.now()}-${Math.random()}`,
        at: row?.at || null,
        actorRole: String(row?.actorRole || "").trim(),
        type: String(row?.type || "").trim(),
        status: String(row?.status || "").trim(),
        command: String(row?.command || "").trim(),
        details: String(row?.details || "").trim(),
      }))
      .filter((row) => row.type)
      .slice(0, MAX_AUDIT_LOG_ROWS);
  } catch {
    return [];
  }
};

const toStoredAuditLog = (auditRows) => {
  if (!Array.isArray(auditRows) || !auditRows.length) return [];
  return auditRows
    .slice(0, MAX_AUDIT_LOG_ROWS)
    .map((row) => ({
      id: String(row?.id || "").trim() || `${Date.now()}-${Math.random()}`,
      at: row?.at || null,
      actorRole: String(row?.actorRole || "").trim(),
      type: String(row?.type || "").trim(),
      status: String(row?.status || "").trim(),
      command: String(row?.command || "").trim(),
      details: String(row?.details || "").trim(),
    }))
    .filter((row) => row.type);
};

const buildBreakdown = (rows, fieldName, maxRows = MAX_BREAKDOWN_ROWS) => {
  const counter = rows.reduce((acc, row) => {
    const key = String(row?.[fieldName] || "UNKNOWN").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxRows)
    .map(([key, value]) => `${key}: ${value}`);
};

const detectRole = (query) => {
  for (let i = 0; i < ROLE_PATTERNS.length; i += 1) {
    const entry = ROLE_PATTERNS[i];
    if (entry.aliases.some((alias) => query.includes(alias))) {
      return entry.role;
    }
  }
  return "";
};

const detectLeadStatus = (query) => {
  for (let i = 0; i < LEAD_STATUS_PATTERNS.length; i += 1) {
    const entry = LEAD_STATUS_PATTERNS[i];
    if (entry.aliases.some((alias) => query.includes(alias))) {
      return entry.status;
    }
  }
  return "";
};

const detectInventoryStatus = (query) => {
  for (let i = 0; i < INVENTORY_STATUS_PATTERNS.length; i += 1) {
    const entry = INVENTORY_STATUS_PATTERNS[i];
    if (entry.aliases.some((alias) => query.includes(alias))) {
      return entry.status;
    }
  }
  return "";
};

const extractLocation = (query) => {
  const inMatch = query.match(/\b(?:in|at|from)\s+([a-z][a-z0-9\s-]{1,30})/i);
  if (inMatch?.[1]) return normalizeText(inMatch[1]).trim();
  return "";
};

const matchNavigationTarget = (query) =>
  NAV_ITEMS.find((item) => item.aliases.some((alias) => query.includes(alias))) || null;

const toValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getStartOfDay = (value) => {
  const date = toValidDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getEndOfDay = (value) => {
  const date = toValidDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const addDays = (value, days) => {
  const date = toValidDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};

const parseNaturalDateToken = (rawToken) => {
  const token = String(rawToken || "")
    .trim()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!token) return null;

  if (token === "today" || token === "aaj") return new Date();
  if (token === "yesterday" || token === "beeta kal" || token === "bita kal") {
    return addDays(new Date(), -1);
  }
  if (token === "tomorrow" || token === "aane wala kal" || token === "agla din") {
    return addDays(new Date(), 1);
  }

  const yyyyMmDdMatch = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDdMatch) {
    const parsed = new Date(
      Number(yyyyMmDdMatch[1]),
      Number(yyyyMmDdMatch[2]) - 1,
      Number(yyyyMmDdMatch[3]),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const ddMmYyyyMatch = token.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (ddMmYyyyMatch) {
    const year = Number(ddMmYyyyMatch[3].length === 2 ? `20${ddMmYyyyMatch[3]}` : ddMmYyyyMatch[3]);
    const parsed = new Date(year, Number(ddMmYyyyMatch[2]) - 1, Number(ddMmYyyyMatch[1]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(token);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const start = getStartOfDay(now);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  const end = getEndOfDay(addDays(start, 6));
  return { start, end };
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = getEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { start, end };
};

const parseDateRangeFromQuery = (query) => {
  const normalized = normalizeText(query);
  const now = new Date();

  const betweenMatch = normalized.match(
    /\b(?:between|from)\s+([a-z0-9\-\/\s,]+?)\s+(?:and|to)\s+([a-z0-9\-\/\s,]+?)(?:\b|$)/i,
  );
  if (betweenMatch?.[1] && betweenMatch?.[2]) {
    const startRaw = parseNaturalDateToken(betweenMatch[1]);
    const endRaw = parseNaturalDateToken(betweenMatch[2]);
    if (startRaw && endRaw) {
      const start = getStartOfDay(startRaw);
      const end = getEndOfDay(endRaw);
      if (start <= end) {
        return {
          start,
          end,
          label: `${start.toLocaleDateString("en-IN")} - ${end.toLocaleDateString("en-IN")}`,
        };
      }
    }
  }

  if (normalized.includes("today") || normalized.includes("aaj")) {
    const start = getStartOfDay(now);
    const end = getEndOfDay(now);
    return { start, end, label: "Today" };
  }

  if (
    normalized.includes("yesterday")
    || normalized.includes("beeta kal")
    || normalized.includes("bita kal")
  ) {
    const target = addDays(now, -1);
    return {
      start: getStartOfDay(target),
      end: getEndOfDay(target),
      label: "Yesterday",
    };
  }

  if (normalized.includes("this week") || normalized.includes("is hafte") || normalized.includes("iss hafte")) {
    const range = getCurrentWeekRange();
    return { ...range, label: "This Week" };
  }

  if (normalized.includes("last week") || normalized.includes("pichle hafte")) {
    const thisWeek = getCurrentWeekRange();
    const start = getStartOfDay(addDays(thisWeek.start, -7));
    const end = getEndOfDay(addDays(thisWeek.start, -1));
    return { start, end, label: "Last Week" };
  }

  if (normalized.includes("this month") || normalized.includes("is mahine") || normalized.includes("iss mahine")) {
    const range = getCurrentMonthRange();
    return { ...range, label: "This Month" };
  }

  if (normalized.includes("last month") || normalized.includes("pichle mahine")) {
    const nowDate = new Date();
    const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
    const end = getEndOfDay(new Date(nowDate.getFullYear(), nowDate.getMonth(), 0));
    return { start, end, label: "Last Month" };
  }

  const lastDaysMatch = normalized.match(/\b(?:last|past)\s+(\d{1,3})\s+day[s]?\b/i);
  if (lastDaysMatch?.[1]) {
    const days = Math.max(1, Math.min(Number(lastDaysMatch[1]), 365));
    const start = getStartOfDay(addDays(now, -(days - 1)));
    const end = getEndOfDay(now);
    return { start, end, label: `Last ${days} Days` };
  }

  return null;
};

const getLeadRangeDate = (lead) => {
  const status = String(lead?.status || "").toUpperCase();
  if (status === "CLOSED" || status === "LOST") {
    return toValidDate(lead?.updatedAt || lead?.createdAt);
  }
  return toValidDate(lead?.createdAt);
};

const inDateRange = (value, range) => {
  if (!range?.start || !range?.end) return true;
  const date = toValidDate(value);
  if (!date) return false;
  return date >= range.start && date <= range.end;
};

const applyDateScopeToSnapshot = (data, query) => {
  const range = parseDateRangeFromQuery(query);
  if (!range?.start || !range?.end) {
    return {
      scopedData: data,
      dateRange: null,
    };
  }

  const scopedLeads = (data?.leads || []).filter((lead) => inDateRange(getLeadRangeDate(lead), range));
  const scopedInventory = (data?.inventory || []).filter((asset) =>
    inDateRange(asset?.createdAt || asset?.updatedAt, range));
  const scopedInventoryRequests = (data?.pendingRequests || []).filter((row) =>
    inDateRange(row?.createdAt || row?.updatedAt, range));
  const scopedLeadPaymentRequests = (data?.leadPaymentRequests || []).filter((row) =>
    inDateRange(row?.dealPayment?.approvalRequestedAt || row?.updatedAt || row?.createdAt, range));

  return {
    scopedData: {
      ...data,
      leads: scopedLeads,
      inventory: scopedInventory,
      pendingRequests: scopedInventoryRequests,
      leadPaymentRequests: scopedLeadPaymentRequests,
    },
    dateRange: range,
  };
};

const buildOverviewReply = (data, dateRange = null) => {
  const activeUsers = data.users.filter((row) => row?.isActive !== false).length;
  const closedLeads = data.leads.filter(
    (row) => String(row?.status || "").toUpperCase() === "CLOSED",
  ).length;
  const unassignedLeads = data.leads.filter((row) => !row?.assignedTo?._id && !row?.assignedTo).length;
  const soldInventory = data.inventory.filter(
    (row) => String(row?.status || "").toUpperCase() === "SOLD",
  ).length;

  const lines = [
    `Snapshot: ${formatDateTime(data.loadedAt)}`,
    dateRange?.label ? `Date scope: ${dateRange.label}` : "Date scope: All Time",
    `Users: ${data.users.length} total | ${activeUsers} active`,
    `Leads: ${data.leads.length} total | ${closedLeads} closed | ${unassignedLeads} unassigned`,
    `Inventory: ${data.inventory.length} total | ${soldInventory} sold`,
    `Pending approvals: ${(data.leadPaymentRequests || []).length} payment | ${(data.pendingRequests || []).length} inventory`,
    "",
    "Top role split:",
    ...buildBreakdown(data.users, "role").map((line) => `- ${line}`),
    "",
    "Top lead status split:",
    ...buildBreakdown(data.leads, "status").map((line) => `- ${line}`),
    "",
    "Top inventory status split:",
    ...buildBreakdown(data.inventory, "status").map((line) => `- ${line}`),
  ];

  return lines.join("\n");
};

const buildUsersReply = (data, query) => {
  const role = detectRole(query);
  const wantInactive = includesAny(query, ["inactive", "disabled"]);
  const wantActiveOnly = includesAny(query, ["active", "working"]) && !wantInactive;

  let rows = data.users;
  if (role) {
    rows = rows.filter((row) => String(row?.role || "").toUpperCase() === role);
  }
  if (wantInactive) {
    rows = rows.filter((row) => row?.isActive === false);
  } else if (wantActiveOnly) {
    rows = rows.filter((row) => row?.isActive !== false);
  }

  if (!rows.length) {
    return "No users matched this filter.";
  }

  const visible = rows.slice(0, MAX_PREVIEW_ROWS);
  const lines = [`Found ${rows.length} user(s).`];
  visible.forEach((row, index) => {
    const status = row?.isActive === false ? "INACTIVE" : "ACTIVE";
    lines.push(`${index + 1}. ${resolveUserName(row)} | ${ROLE_LABELS[row?.role] || row?.role || "-"} | ${status}`);
  });
  if (rows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more users`);
  }

  return lines.join("\n");
};

const buildLeadsReply = (data, query) => {
  const status = detectLeadStatus(query);
  const location = extractLocation(query);
  const wantsUnassigned = includesAny(query, ["unassigned", "not assigned", "without assignee"]);
  const wantsAssigned = includesAny(query, ["assigned"]) && !wantsUnassigned;
  const wantsCount = includesAny(query, COUNT_INTENT_TERMS);

  let rows = data.leads;
  if (status) {
    rows = rows.filter((row) => String(row?.status || "").toUpperCase() === status);
  }
  if (location) {
    rows = rows.filter((row) => {
      const city = normalizeText(row?.city);
      const locality = normalizeText(row?.location);
      return city.includes(location) || locality.includes(location);
    });
  }
  if (wantsUnassigned) {
    rows = rows.filter((row) => !row?.assignedTo?._id && !row?.assignedTo);
  } else if (wantsAssigned) {
    rows = rows.filter((row) => !!(row?.assignedTo?._id || row?.assignedTo));
  }

  if (!rows.length) {
    return "No leads matched this filter.";
  }

  if (wantsCount) {
    const filterNotes = [];
    if (status) filterNotes.push(status);
    if (location) filterNotes.push(location);
    if (wantsUnassigned) filterNotes.push("UNASSIGNED");
    if (wantsAssigned) filterNotes.push("ASSIGNED");

    const suffix = filterNotes.length ? ` (${filterNotes.join(", ")})` : "";
    return `Lead count${suffix}: ${rows.length}`;
  }

  const visible = rows.slice(0, MAX_PREVIEW_ROWS);
  const lines = [`Found ${rows.length} lead(s).`];
  visible.forEach((row, index) => {
    const city = String(row?.city || row?.location || "-");
    const assignee = resolveUserName(row?.assignedTo);
    lines.push(`${index + 1}. ${toLeadName(row)} | ${row?.status || "-"} | ${city} | ${assignee}`);
  });
  if (rows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more leads`);
  }

  return lines.join("\n");
};

const buildInventoryReply = (data, query) => {
  const status = detectInventoryStatus(query);
  const location = extractLocation(query);

  let rows = data.inventory;
  if (status) {
    rows = rows.filter((row) => String(row?.status || "").toUpperCase() === status);
  }
  if (location) {
    rows = rows.filter((row) => normalizeText(row?.location).includes(location));
  }

  if (!rows.length) {
    return "No inventory matched this filter.";
  }

  const visible = rows.slice(0, MAX_PREVIEW_ROWS);
  const lines = [`Found ${rows.length} inventory unit(s).`];
  visible.forEach((row, index) => {
    lines.push(`${index + 1}. ${toInventoryLabel(row)} | ${row?.status || "-"} | ${row?.location || "-"}`);
  });
  if (rows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more inventory rows`);
  }

  return lines.join("\n");
};

const buildPendingRequestsReply = (data, dateRange = null) => {
  const inventoryRows = data.pendingRequests || [];
  const paymentRows = (data.leadPaymentRequests || []).filter(
    (row) => String(row?.dealPayment?.approvalStatus || "PENDING").toUpperCase() === "PENDING",
  );

  if (!inventoryRows.length && !paymentRows.length) {
    return "No pending approval requests right now.";
  }

  const lines = [
    dateRange?.label ? `Pending approvals (${dateRange.label})` : "Pending approvals (All Time)",
    `Payment approvals: ${paymentRows.length}`,
    `Inventory approvals: ${inventoryRows.length}`,
  ];

  if (paymentRows.length) {
    lines.push("");
    lines.push("Top payment requests:");
    paymentRows.slice(0, MAX_PREVIEW_ROWS).forEach((row, index) => {
      const status = String(row?.status || "-").toUpperCase();
      lines.push(
        `${index + 1}. ${toLeadName(row)} | ${row?.phone || "-"} | ${status} | Ref ${row?.dealPayment?.paymentReference || "-"}`,
      );
    });
  }

  if (inventoryRows.length) {
    lines.push("");
    lines.push("Top inventory requests:");
    inventoryRows.slice(0, MAX_PREVIEW_ROWS).forEach((row, index) => {
      const requestedBy = resolveUserName(row?.requestedBy);
      const type = String(row?.type || row?.requestType || "update").toUpperCase();
      lines.push(`${index + 1}. ${type} | ${requestedBy}`);
    });
  }

  if (paymentRows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${paymentRows.length - MAX_PREVIEW_ROWS} more payment requests`);
  }
  if (inventoryRows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${inventoryRows.length - MAX_PREVIEW_ROWS} more inventory requests`);
  }

  return lines.join("\n");
};

const findLeadPaymentRequestMatches = (leadPaymentRequests, term) => {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return [];

  return (leadPaymentRequests || [])
    .filter((lead) => String(lead?.dealPayment?.approvalStatus || "PENDING").toUpperCase() === "PENDING")
    .filter((lead) => {
      const searchableText = [
        lead?._id,
        toLeadName(lead),
        lead?.phone,
        lead?.projectInterested,
        lead?.dealPayment?.paymentReference,
      ]
        .map((item) => normalizeText(item))
        .join(" ");
      return searchableText.includes(normalizedTerm);
    });
};

const findInventoryRequestMatches = (pendingRequests, term) => {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return [];

  return (pendingRequests || []).filter((request) => {
    const searchableText = [
      request?._id,
      request?.type,
      request?.requestedBy?.name,
      request?.inventoryId?.projectName,
      request?.inventoryId?.towerName,
      request?.inventoryId?.unitNumber,
      request?.proposedData?.projectName,
      request?.proposedData?.towerName,
      request?.proposedData?.unitNumber,
    ]
      .map((item) => normalizeText(item))
      .join(" ");
    return searchableText.includes(normalizedTerm);
  });
};

const summarizeLeadPaymentMatch = (lead) => {
  const status = String(lead?.status || "-").toUpperCase();
  return `${toLeadName(lead)} | ${lead?.phone || "-"} | ${status} | Ref ${lead?.dealPayment?.paymentReference || "-"}`;
};

const summarizeInventoryRequestMatch = (request) => {
  const requestedBy = resolveUserName(request?.requestedBy);
  const type = String(request?.type || request?.requestType || "update").toUpperCase();
  const label = toInventoryLabel(request?.inventoryId || request?.proposedData || {});
  return `${type} | ${requestedBy} | ${label}`;
};

const extractLimitFromQuery = (query, fallback = 5, max = 20) => {
  const match = query.match(/\b(?:top|latest|last|show)\s+(\d{1,2})\b/i)
    || query.match(/\b(\d{1,2})\s+(?:top|latest|last)\b/i);
  if (!match?.[1]) return fallback;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
};

const toDigitToken = (value) => String(value || "").replace(/\D/g, "");

const findLeadMatchesByTerm = (leads, term) => {
  const normalizedTerm = normalizeText(term);
  const digitTerm = toDigitToken(term);
  if (!normalizedTerm && !digitTerm) return [];

  return (leads || []).filter((lead) => {
    const leadId = String(lead?._id || "").trim();
    const leadName = normalizeText(toLeadName(lead));
    const leadPhoneRaw = String(lead?.phone || "");
    const leadPhoneDigits = toDigitToken(leadPhoneRaw);
    const leadProject = normalizeText(lead?.projectInterested);

    if (normalizedTerm && isLikelyObjectId(normalizedTerm)) {
      return leadId.toLowerCase() === normalizedTerm.toLowerCase();
    }

    return (
      (normalizedTerm && (
        leadName.includes(normalizedTerm)
        || leadProject.includes(normalizedTerm)
        || leadId.toLowerCase().includes(normalizedTerm)
      ))
      || (digitTerm && leadPhoneDigits.includes(digitTerm))
    );
  });
};

const isSpecificLeadOpenQuery = (query) =>
  (query.includes("open lead") && !query.includes("open leads"))
  || query.includes("lead by phone")
  || query.includes("lead details");

const parseLeadQuickOpenTarget = (query) => {
  const idMatch = query.match(/\b([a-f0-9]{24})\b/i);
  if (idMatch?.[1]) return idMatch[1];

  const phoneMatch = query.match(/\b(?:phone|mobile)\s+([\d+\-\s]{6,})/i);
  if (phoneMatch?.[1]) return toDigitToken(phoneMatch[1]);

  const leadOpenMatch = query.match(/\bopen\s+lead(?:\s+by)?\s+(.+)$/i);
  if (leadOpenMatch?.[1]) {
    return String(leadOpenMatch[1])
      .replace(/\b(?:phone|details?)\b/gi, "")
      .trim();
  }

  const leadDetailsMatch = query.match(/\blead\s+details?\s+(.+)$/i);
  if (leadDetailsMatch?.[1]) return String(leadDetailsMatch[1]).trim();

  return "";
};

const getHotLeadScore = (lead) => {
  const status = String(lead?.status || "").toUpperCase();
  const statusWeight = {
    REQUESTED: 8,
    SITE_VISIT: 6,
    INTERESTED: 5,
    CONTACTED: 3,
    NEW: 2,
  }[status] || 0;

  const followUpDate = toValidDate(lead?.nextFollowUp);
  const now = new Date();
  let followUpWeight = 0;
  if (followUpDate) {
    if (followUpDate < now) followUpWeight = 4;
    else if (followUpDate <= addDays(now, 2)) followUpWeight = 3;
    else if (followUpDate <= addDays(now, 7)) followUpWeight = 1;
  }

  const updatedDate = toValidDate(lead?.updatedAt || lead?.createdAt);
  let freshnessWeight = 0;
  if (updatedDate) {
    const diffDays = Math.max(
      0,
      Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (diffDays <= 2) freshnessWeight = 2;
    else if (diffDays <= 7) freshnessWeight = 1;
  }

  return statusWeight + followUpWeight + freshnessWeight;
};

const buildHotLeadRows = (leads, limit) =>
  (leads || [])
    .filter((lead) => !["CLOSED", "LOST"].includes(String(lead?.status || "").toUpperCase()))
    .map((lead) => ({
      lead,
      score: getHotLeadScore(lead),
      updatedAt: toValidDate(lead?.updatedAt || lead?.createdAt),
    }))
    .sort((a, b) => b.score - a.score || (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
    .slice(0, Math.max(1, limit || 10));

const buildHotLeadsReply = ({ rows, dateRange }) => {
  if (!rows.length) {
    return dateRange?.label
      ? `No hot leads found in ${dateRange.label}.`
      : "No hot leads found right now.";
  }

  const lines = [
    dateRange?.label ? `Latest hot leads (${dateRange.label})` : "Latest hot leads",
  ];
  rows.forEach((item, index) => {
    const lead = item.lead;
    lines.push(
      `${index + 1}. ${toLeadName(lead)} | ${lead?.status || "-"} | ${lead?.phone || "-"} | Score ${item.score} | LeadId ${lead?._id || "-"}`,
    );
  });
  lines.push("Use `open lead <LeadId>` to open any row directly.");
  return lines.join("\n");
};

const handleLeadQuickOpenQuery = ({ query, data, scopedData, dateRange, navigate }) => {
  if (includesAny(query, ["hot lead", "hot leads"])) {
    const limit = extractLimitFromQuery(query, 10, 20);
    const sourceRows = (scopedData?.leads || []).length
      ? scopedData.leads
      : (data?.leads || []);
    const hotRows = buildHotLeadRows(sourceRows, limit);
    return {
      handled: true,
      reply: buildHotLeadsReply({ rows: hotRows, dateRange }),
    };
  }

  if (!isSpecificLeadOpenQuery(query)) {
    return { handled: false };
  }

  const targetTerm = parseLeadQuickOpenTarget(query);
  if (!targetTerm) {
    return {
      handled: true,
      reply: "Please specify lead identifier. Example: `open lead by phone 9876543210` or `open lead 67b...`",
    };
  }

  const matches = findLeadMatchesByTerm(data?.leads || [], targetTerm);
  if (!matches.length) {
    return {
      handled: true,
      reply: `No lead matched "${targetTerm}".`,
    };
  }

  if (matches.length > 1) {
    const lines = [
      `Multiple leads matched "${targetTerm}". Please open using LeadId:`,
      ...matches.slice(0, MAX_PREVIEW_ROWS).map(
        (lead, index) =>
          `${index + 1}. ${toLeadName(lead)} | ${lead?.phone || "-"} | ${lead?.status || "-"} | LeadId ${lead?._id || "-"}`,
      ),
    ];
    if (matches.length > MAX_PREVIEW_ROWS) {
      lines.push(`+ ${matches.length - MAX_PREVIEW_ROWS} more leads`);
    }
    return { handled: true, reply: lines.join("\n") };
  }

  const selected = matches[0];
  const leadId = String(selected?._id || "").trim();
  if (!leadId) {
    return { handled: true, reply: "Selected lead has no id; cannot open details." };
  }

  navigate(`/leads/${leadId}`);
  return {
    handled: true,
    reply: `Opening lead details for ${toLeadName(selected)} (${selected?.phone || "-"})`,
  };
};

const toAmountNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getLeadRelatedInventoriesForFinance = (lead = {}) => {
  const merged = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const id = toEntityId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(value);
  };

  pushUnique(lead?.inventoryId);
  if (Array.isArray(lead?.relatedInventoryIds)) {
    lead.relatedInventoryIds.forEach((row) => pushUnique(row));
  }

  return merged;
};

const getLeadSaleEntriesForFinance = (lead = {}) => {
  const leadId = toEntityId(lead?._id) || "lead";
  const leadStatus = String(lead?.status || "").trim().toUpperCase();
  const isClosedContext = ["CLOSED", "REQUESTED"].includes(leadStatus);
  const linkedInventories = getLeadRelatedInventoriesForFinance(lead);
  const saleEntries = [];

  linkedInventories.forEach((inventory, index) => {
    if (!inventory || typeof inventory !== "object") return;

    const saleTotalAmount = toAmountNumber(inventory?.saleDetails?.totalAmount);
    const inventoryPrice = toAmountNumber(inventory?.price);
    const totalAmount =
      saleTotalAmount !== null && saleTotalAmount > 0
        ? saleTotalAmount
        : inventoryPrice;

    if (totalAmount === null || totalAmount <= 0) return;

    const inventoryStatus = String(inventory?.status || "").trim().toUpperCase();
    const hasSaleDetails = saleTotalAmount !== null && saleTotalAmount > 0;
    const isSoldInventory = inventoryStatus === "SOLD" || hasSaleDetails;
    if (!isClosedContext && !isSoldInventory) return;

    const remainingRaw = toAmountNumber(inventory?.saleDetails?.remainingAmount);
    const remainingAmount =
      remainingRaw === null
        ? 0
        : Math.max(0, Math.min(remainingRaw, totalAmount));
    const entryKey = toEntityId(inventory) || `${leadId}:${index}`;

    saleEntries.push({
      entryKey,
      lead,
      inventory,
      totalAmount,
      remainingAmount,
    });
  });

  if (saleEntries.length > 0 || !isClosedContext) return saleEntries;

  const fallbackInventory = linkedInventories.find((inventory) => {
    if (!inventory || typeof inventory !== "object") return false;
    const amount = toAmountNumber(inventory?.price);
    return amount !== null && amount > 0;
  });
  const fallbackTotalAmount = toAmountNumber(fallbackInventory?.price);
  if (fallbackTotalAmount === null || fallbackTotalAmount <= 0) return saleEntries;

  const paymentType = String(lead?.dealPayment?.paymentType || "").trim().toUpperCase();
  const dealRemainingRaw = toAmountNumber(lead?.dealPayment?.remainingAmount);
  const fallbackRemainingAmount =
    paymentType === "PARTIAL" && dealRemainingRaw !== null
      ? Math.max(0, Math.min(dealRemainingRaw, fallbackTotalAmount))
      : 0;

  saleEntries.push({
    entryKey: `${leadId}:fallback`,
    lead,
    inventory: fallbackInventory || null,
    totalAmount: fallbackTotalAmount,
    remainingAmount: fallbackRemainingAmount,
  });

  return saleEntries;
};

const buildFinanceSaleRows = (data) => {
  const rows = [];
  const seenKeys = new Set();

  (data?.leads || []).forEach((lead) => {
    getLeadSaleEntriesForFinance(lead).forEach((entry) => {
      if (seenKeys.has(entry.entryKey)) return;
      seenKeys.add(entry.entryKey);

      const project = String(
        entry?.inventory?.projectName
        || lead?.projectInterested
        || "Unspecified",
      ).trim() || "Unspecified";

      rows.push({
        ...entry,
        project,
        collectedAmount: Math.max(0, (Number(entry.totalAmount) || 0) - (Number(entry.remainingAmount) || 0)),
      });
    });
  });

  return rows;
};

const aggregateFinanceRows = (rows, labelResolver) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const label = String(labelResolver(row) || "Unspecified").trim() || "Unspecified";
    if (!map.has(label)) {
      map.set(label, {
        label,
        totalAmount: 0,
        remainingAmount: 0,
        collectedAmount: 0,
        deals: 0,
      });
    }
    const bucket = map.get(label);
    bucket.totalAmount += Number(row?.totalAmount || 0);
    bucket.remainingAmount += Number(row?.remainingAmount || 0);
    bucket.collectedAmount += Number(row?.collectedAmount || 0);
    bucket.deals += 1;
  });

  return [...map.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount || b.remainingAmount - a.remainingAmount || b.deals - a.deals,
  );
};

const isFinanceQuery = (query) =>
  includesAny(query, FINANCE_INTENT_TERMS)
  && includesAny(query, ["sell", "sale", "sales", "revenue", "finance", "remaining", "collection", "amount", "commission"]);

const buildFinanceReply = (data, query, dateRange = null) => {
  const saleRows = buildFinanceSaleRows(data);
  if (!saleRows.length) {
    return dateRange?.label
      ? `No finance sale rows found in ${dateRange.label}.`
      : "No finance sale rows found in current snapshot.";
  }

  const totals = saleRows.reduce((acc, row) => ({
    totalAmount: acc.totalAmount + Number(row?.totalAmount || 0),
    remainingAmount: acc.remainingAmount + Number(row?.remainingAmount || 0),
    collectedAmount: acc.collectedAmount + Number(row?.collectedAmount || 0),
  }), { totalAmount: 0, remainingAmount: 0, collectedAmount: 0 });

  const userLookup = buildUserLookup(data?.users || []);
  const requestedRole = detectRole(query);
  const topLimit = extractLimitFromQuery(query, 6, 15);
  const wantsByProject = includesAny(query, ["by project", "project wise", "project-wise"]);
  const wantsByManager = includesAny(query, ["by manager", "manager wise", "manager-wise"]);
  const wantsRemainingFocus = includesAny(query, ["remaining", "pending amount", "pending collection"]);

  const lines = [
    dateRange?.label ? `Finance snapshot (${dateRange.label})` : "Finance snapshot (All Time)",
    `Total Sell: ${formatCurrency(totals.totalAmount)}`,
    `Collected: ${formatCurrency(totals.collectedAmount)}`,
    `Remaining: ${formatCurrency(totals.remainingAmount)}`,
    `Counted Sale Rows: ${saleRows.length}`,
  ];

  if (requestedRole) {
    const roleLabel = ROLE_LABELS[requestedRole] || requestedRole;
    const grouped = aggregateFinanceRows(saleRows, (row) => {
      const owner = resolveLeadPerformanceOwnerForRole({
        lead: row?.lead,
        role: requestedRole,
        userLookup,
      });
      return owner?.name || `Unassigned ${roleLabel}`;
    }).slice(0, topLimit);

    lines.push("");
    lines.push(`Top ${grouped.length} ${roleLabel} finance rows:`);
    grouped.forEach((row, index) => {
      lines.push(
        `${index + 1}. ${row.label} | Sell ${formatCurrency(row.totalAmount)} | Remaining ${formatCurrency(row.remainingAmount)} | Deals ${row.deals}`,
      );
    });
    return lines.join("\n");
  }

  if (wantsByManager) {
    const grouped = aggregateFinanceRows(saleRows, (row) => {
      const owner = resolveLeadPerformanceOwnerForRole({
        lead: row?.lead,
        role: "MANAGER",
        userLookup,
      });
      return owner?.name || "Unassigned Manager";
    }).slice(0, topLimit);

    lines.push("");
    lines.push(`Top ${grouped.length} managers by sell value:`);
    grouped.forEach((row, index) => {
      lines.push(
        `${index + 1}. ${row.label} | Sell ${formatCurrency(row.totalAmount)} | Remaining ${formatCurrency(row.remainingAmount)} | Deals ${row.deals}`,
      );
    });
    return lines.join("\n");
  }

  if (wantsByProject || includesAny(query, ["project", "projects"])) {
    const grouped = aggregateFinanceRows(saleRows, (row) => row?.project || "Unspecified")
      .slice(0, topLimit);

    lines.push("");
    lines.push(`Top ${grouped.length} projects by sell value:`);
    grouped.forEach((row, index) => {
      lines.push(
        `${index + 1}. ${row.label} | Sell ${formatCurrency(row.totalAmount)} | Remaining ${formatCurrency(row.remainingAmount)} | Deals ${row.deals}`,
      );
    });
    return lines.join("\n");
  }

  const topProjects = aggregateFinanceRows(saleRows, (row) => row?.project || "Unspecified")
    .slice(0, Math.min(5, topLimit));
  lines.push("");
  lines.push(wantsRemainingFocus ? "Top projects by remaining amount:" : "Top projects by sell value:");
  topProjects
    .sort((a, b) =>
      wantsRemainingFocus
        ? b.remainingAmount - a.remainingAmount || b.totalAmount - a.totalAmount
        : b.totalAmount - a.totalAmount || b.remainingAmount - a.remainingAmount)
    .forEach((row, index) => {
      lines.push(
        `${index + 1}. ${row.label} | Sell ${formatCurrency(row.totalAmount)} | Remaining ${formatCurrency(row.remainingAmount)} | Deals ${row.deals}`,
      );
    });

  return lines.join("\n");
};

const isLikelyObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || "").trim());

const extractRejectReason = (query) => {
  const match = query.match(/\b(?:because|reason|kyunki|kyo ki|kyonki)\s+(.+)$/i);
  return String(match?.[1] || "").trim();
};

const extractLeadTargetTerm = (query) => {
  const forLeadMatch = query.match(/\b(?:for|of)\s+lead\s+(.+?)(?:\s+(?:because|reason|kyunki|kyo ki|kyonki)\s+.+)?$/i);
  if (forLeadMatch?.[1]) return String(forLeadMatch[1]).trim();

  const leadMatch = query.match(/\blead\s+(.+?)(?:\s+(?:because|reason|kyunki|kyo ki|kyonki)\s+.+)?$/i);
  if (leadMatch?.[1]) return String(leadMatch[1]).trim();

  return "";
};

const extractInventoryTargetTerm = (query) => {
  const idMatch = query.match(/\b([a-f0-9]{24})\b/i);
  if (idMatch?.[1]) return idMatch[1];

  const forMatch = query.match(/\b(?:inventory request|request)\s+(?:for\s+)?(.+?)(?:\s+(?:because|reason|kyunki|kyo ki|kyonki)\s+.+)?$/i);
  if (forMatch?.[1]) return String(forMatch[1]).trim();

  return "";
};

const buildPendingActionPrompt = (action) => {
  if (!action) return "";

  if (action.kind === "APPROVE_LEAD_PAYMENT") {
    return [
      `Confirm action: Approve payment request for ${action.leadName}.`,
      `Lead: ${action.leadSummary}`,
      "Type `confirm` to proceed or `cancel` to abort.",
    ].join("\n");
  }

  if (action.kind === "REJECT_LEAD_PAYMENT") {
    return [
      `Confirm action: Reject payment request for ${action.leadName}.`,
      `Lead: ${action.leadSummary}`,
      `Reason: ${action.reason}`,
      "Type `confirm` to proceed or `cancel` to abort.",
    ].join("\n");
  }

  if (action.kind === "APPROVE_INVENTORY_REQUEST") {
    return [
      "Confirm action: Approve inventory request.",
      `Request: ${action.requestSummary}`,
      "Type `confirm` to proceed or `cancel` to abort.",
    ].join("\n");
  }

  if (action.kind === "REJECT_INVENTORY_REQUEST") {
    return [
      "Confirm action: Reject inventory request.",
      `Request: ${action.requestSummary}`,
      `Reason: ${action.reason}`,
      "Type `confirm` to proceed or `cancel` to abort.",
    ].join("\n");
  }

  return "";
};

const parseActionCommand = (query, data) => {
  const wantsApprove = includesAny(query, APPROVE_ACTION_TERMS);
  const wantsReject = includesAny(query, REJECT_ACTION_TERMS);
  if (!wantsApprove && !wantsReject) return null;

  const isPaymentAction = includesAny(query, ["payment request", "payment approval", "payment"]);
  if (isPaymentAction) {
    const targetTerm = extractLeadTargetTerm(query);
    if (!targetTerm) {
      return { error: "Please specify the lead for payment action. Example: approve payment request for lead Rahul" };
    }

    const matches = findLeadPaymentRequestMatches(data?.leadPaymentRequests, targetTerm);
    if (!matches.length) {
      return { error: `No pending payment request matched "${targetTerm}".` };
    }
    if (matches.length > 1) {
      const options = matches
        .slice(0, MAX_PREVIEW_ROWS)
        .map((lead, index) => `${index + 1}. ${summarizeLeadPaymentMatch(lead)}`);
      return {
        error: [
          `Multiple leads matched "${targetTerm}". Please be more specific:`,
          ...options,
        ].join("\n"),
      };
    }

    const lead = matches[0];
    const leadId = String(lead?._id || "");
    if (!leadId) {
      return { error: "Lead id missing in payment request payload." };
    }

    if (wantsApprove) {
      return {
        action: {
          kind: "APPROVE_LEAD_PAYMENT",
          leadId,
          leadName: toLeadName(lead),
          leadSummary: summarizeLeadPaymentMatch(lead),
          currentStatus: String(lead?.status || "REQUESTED").trim().toUpperCase() || "REQUESTED",
        },
      };
    }

    const reason = extractRejectReason(query) || "Rejected from admin assistant";
    return {
      action: {
        kind: "REJECT_LEAD_PAYMENT",
        leadId,
        leadName: toLeadName(lead),
        leadSummary: summarizeLeadPaymentMatch(lead),
        currentStatus: String(lead?.status || "REQUESTED").trim().toUpperCase() || "REQUESTED",
        reason,
      },
    };
  }

  const isInventoryAction = includesAny(query, ["inventory request", "inventory approval"]);
  if (isInventoryAction) {
    const targetTerm = extractInventoryTargetTerm(query);
    if (!targetTerm) {
      return { error: "Please specify inventory request id/name. Example: approve inventory request 67b..." };
    }

    const matches = isLikelyObjectId(targetTerm)
      ? (data?.pendingRequests || []).filter(
        (row) => String(row?._id || "").toLowerCase() === targetTerm.toLowerCase(),
      )
      : findInventoryRequestMatches(data?.pendingRequests, targetTerm);

    if (!matches.length) {
      return { error: `No pending inventory request matched "${targetTerm}".` };
    }
    if (matches.length > 1) {
      const options = matches
        .slice(0, MAX_PREVIEW_ROWS)
        .map((request, index) => `${index + 1}. ${summarizeInventoryRequestMatch(request)}`);
      return {
        error: [
          `Multiple inventory requests matched "${targetTerm}". Please be more specific (prefer request id):`,
          ...options,
        ].join("\n"),
      };
    }

    const request = matches[0];
    const requestId = String(request?._id || "");
    if (!requestId) {
      return { error: "Inventory request id missing in payload." };
    }

    if (wantsApprove) {
      return {
        action: {
          kind: "APPROVE_INVENTORY_REQUEST",
          requestId,
          requestSummary: summarizeInventoryRequestMatch(request),
        },
      };
    }

    const reason = extractRejectReason(query) || "Rejected from admin assistant";
    return {
      action: {
        kind: "REJECT_INVENTORY_REQUEST",
        requestId,
        requestSummary: summarizeInventoryRequestMatch(request),
        reason,
      },
    };
  }

  return null;
};

const toEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value?._id || value?.id || "").trim();
  }
  return String(value).trim();
};

const toParentEntityId = (user) =>
  toEntityId(user?.parentId?._id || user?.parentId?.id || user?.parentId);

const normalizeRoleValue = (value) => String(value || "").trim().toUpperCase();

const roundPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10) / 10;
};

const buildUserLookup = (users = []) => {
  const map = new Map();

  users.forEach((row) => {
    const id = toEntityId(row?._id || row?.id || row);
    if (!id) return;

    map.set(id, {
      id,
      name: resolveUserName(row),
      role: normalizeRoleValue(row?.role),
      parentId: toParentEntityId(row),
    });
  });

  return map;
};

const resolveUserCandidate = (userLike, userLookup) => {
  const id = toEntityId(userLike);
  if (id && userLookup.has(id)) {
    return userLookup.get(id);
  }

  if (!userLike || typeof userLike !== "object") {
    if (!id) return null;
    return {
      id,
      name: id,
      role: "",
      parentId: "",
    };
  }

  const fallbackName = resolveUserName(userLike);
  return {
    id: id || `anon:${fallbackName}`,
    name: fallbackName,
    role: normalizeRoleValue(userLike?.role),
    parentId: toParentEntityId(userLike),
  };
};

const findAncestorCandidateByRole = (startUserId, expectedRole, userLookup) => {
  const visited = new Set();
  let cursorId = toEntityId(startUserId);

  for (let depth = 0; depth < 8; depth += 1) {
    if (!cursorId || visited.has(cursorId)) break;
    visited.add(cursorId);

    const candidate = userLookup.get(cursorId);
    if (!candidate) return null;
    if (candidate.role === expectedRole) return candidate;

    cursorId = candidate.parentId;
  }

  return null;
};

const resolveLeadPerformanceOwnerForRole = ({ lead, role, userLookup }) => {
  const normalizedRole = normalizeRoleValue(role);
  if (!normalizedRole) return null;

  const directField = PERFORMANCE_FIELD_BY_ROLE[normalizedRole];
  if (directField) {
    const directCandidate = resolveUserCandidate(lead?.[directField], userLookup);
    if (directCandidate && (!directCandidate.role || directCandidate.role === normalizedRole)) {
      return {
        ...directCandidate,
        role: directCandidate.role || normalizedRole,
      };
    }
  }

  const assignedToCandidate = resolveUserCandidate(lead?.assignedTo, userLookup);
  if (assignedToCandidate?.role === normalizedRole) {
    return assignedToCandidate;
  }

  const candidateChainStartIds = [
    toEntityId(lead?.assignedTo),
    toEntityId(lead?.assignedExecutive),
    toEntityId(lead?.assignedFieldExecutive),
    toEntityId(lead?.assignedManager),
  ].filter(Boolean);

  for (let i = 0; i < candidateChainStartIds.length; i += 1) {
    const matchedAncestor = findAncestorCandidateByRole(
      candidateChainStartIds[i],
      normalizedRole,
      userLookup,
    );
    if (matchedAncestor) return matchedAncestor;
  }

  if (normalizedRole === "CHANNEL_PARTNER") {
    const creatorCandidate = resolveUserCandidate(lead?.createdBy, userLookup);
    if (creatorCandidate?.role === normalizedRole) {
      return creatorCandidate;
    }
  }

  return null;
};

const buildRolePerformanceRows = (data, role) => {
  const normalizedRole = normalizeRoleValue(role);
  if (!normalizedRole) return [];

  const userLookup = buildUserLookup(data?.users || []);
  const counter = new Map();

  (data?.leads || []).forEach((lead) => {
    const owner = resolveLeadPerformanceOwnerForRole({
      lead,
      role: normalizedRole,
      userLookup,
    });

    if (!owner) return;

    const key = String(owner.id || owner.name || "").trim();
    if (!key) return;

    if (!counter.has(key)) {
      counter.set(key, {
        id: key,
        name: owner.name || "Unknown user",
        role: normalizedRole,
        total: 0,
        closed: 0,
        lost: 0,
        active: 0,
      });
    }

    const row = counter.get(key);
    row.total += 1;

    const leadStatus = String(lead?.status || "").toUpperCase();
    if (leadStatus === "CLOSED") row.closed += 1;
    else if (leadStatus === "LOST") row.lost += 1;
    else row.active += 1;
  });

  return [...counter.values()]
    .map((row) => ({
      ...row,
      conversion: row.total > 0 ? roundPercent((row.closed / row.total) * 100) : 0,
    }))
    .sort((a, b) =>
      b.closed - a.closed
      || b.conversion - a.conversion
      || b.active - a.active
      || b.total - a.total
      || a.name.localeCompare(b.name));
};

const extractTopCountFromPerformanceQuery = (query, fallbackCount = 3) => {
  const match = query.match(/\b(?:top|best)\s+(\d{1,2})\b/i)
    || query.match(/\b(\d{1,2})\s+(?:top|best)\b/i);
  if (!match?.[1]) return fallbackCount;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return fallbackCount;
  return Math.min(Math.max(Math.floor(parsed), 1), 10);
};

const wantsSingleTopPerformer = (query) => {
  if (/\btop\s+\d+\b/i.test(query) || /\bbest\s+\d+\b/i.test(query)) {
    return false;
  }

  if (includesAny(query, ["performers", "leaderboard", "ranking", "list"])) {
    return false;
  }

  if (includesAny(query, ["who is", "who's", "no 1", "number 1"])) {
    return true;
  }

  if (includesAny(query, ["best"])) {
    return true;
  }

  return false;
};

const isPerformanceQuery = (query) => {
  if (!includesAny(query, PERFORMANCE_INTENT_TERMS)) return false;

  return (
    includesAny(query, LEAD_INTENT_TERMS)
    || Boolean(detectRole(query))
    || includesAny(query, ["team", "role", "manager", "executive", "leader"])
  );
};

const buildRolePerformanceResult = (data, query) => {
  const role = detectRole(query);
  const includeAllRoles = !role || includesAny(query, PERFORMANCE_ALL_ROLE_TERMS);

  if (includeAllRoles) {
    const lines = ["Best performers by role (current snapshot):"];
    const summaries = PERFORMANCE_ROLE_ORDER
      .map((roleKey) => {
        const topRow = buildRolePerformanceRows(data, roleKey)[0];
        if (!topRow) return "";
        return `- ${ROLE_LABELS[roleKey] || roleKey}: ${topRow.name} | Closed ${topRow.closed} | Conversion ${topRow.conversion}% | Total ${topRow.total}`;
      })
      .filter(Boolean);

    if (!summaries.length) {
      return {
        reply: "No role-wise performance data is available right now.",
        drillContext: null,
      };
    }

    lines.push(...summaries);
    lines.push("");
    lines.push("Try: `who is the best manager` or `top 5 executives by performance`");
    return {
      reply: lines.join("\n"),
      drillContext: null,
    };
  }

  const rows = buildRolePerformanceRows(data, role);
  const roleLabel = ROLE_LABELS[role] || role || "Role";

  if (!rows.length) {
    return {
      reply: `No performance rows found for ${roleLabel}.`,
      drillContext: null,
    };
  }

  const topCount = wantsSingleTopPerformer(query)
    ? 1
    : extractTopCountFromPerformanceQuery(
      query,
      includesAny(query, ["top"]) ? 5 : 3,
    );
  const visibleRows = rows.slice(0, topCount);

  if (visibleRows.length === 1) {
    const top = visibleRows[0];
    return {
      reply: [
        `Top ${roleLabel}: ${top.name}`,
        `Closed ${top.closed} | Conversion ${top.conversion}% | Active ${top.active} | Lost ${top.lost} | Total ${top.total}`,
        "Ranking priority: closed deals, then conversion, then active pipeline.",
      ].join("\n"),
      drillContext: {
        type: "ROLE_RANKING",
        role,
        items: visibleRows.map((row, index) => ({
          rank: index + 1,
          userId: row.id,
          userName: row.name,
          role,
          total: row.total,
          closed: row.closed,
          conversion: row.conversion,
        })),
      },
    };
  }

  const lines = [`Top ${visibleRows.length} ${roleLabel} performers:`];
  visibleRows.forEach((row, index) => {
    lines.push(
      `${index + 1}. ${row.name} | Closed ${row.closed} | Conversion ${row.conversion}% | Active ${row.active} | Total ${row.total}`,
    );
  });
  if (rows.length > visibleRows.length) {
    lines.push(`+ ${rows.length - visibleRows.length} more ${roleLabel.toLowerCase()} user(s)`);
  }
  lines.push("Ranking priority: closed deals, then conversion, then active pipeline.");
  return {
    reply: lines.join("\n"),
    drillContext: {
      type: "ROLE_RANKING",
      role,
      items: visibleRows.map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        userName: row.name,
        role,
        total: row.total,
        closed: row.closed,
        conversion: row.conversion,
      })),
    },
  };
};

const extractSearchTerm = (query) =>
  normalizeText(
    query
      .replace(/^find\s+/i, "")
      .replace(/^search\s+/i, "")
      .replace(/^look\s*up\s+/i, ""),
  );

const buildSearchReply = (data, query) => {
  const term = extractSearchTerm(query);
  if (!term) {
    return "Please provide a keyword to search. Example: `find ravi`.";
  }

  const userHits = data.users.filter((row) =>
    [row?.name, row?.email, row?.phone, row?.role]
      .map((item) => normalizeText(item))
      .join(" ")
      .includes(term));

  const leadHits = data.leads.filter((row) =>
    [toLeadName(row), row?.city, row?.location, row?.phone, row?.status]
      .map((item) => normalizeText(item))
      .join(" ")
      .includes(term));

  const inventoryHits = data.inventory.filter((row) =>
    [row?.projectName, row?.towerName, row?.unitNumber, row?.location, row?.status]
      .map((item) => normalizeText(item))
      .join(" ")
      .includes(term));

  const lines = [
    `Search results for "${term}"`,
    `Users: ${userHits.length}`,
    `Leads: ${leadHits.length}`,
    `Inventory: ${inventoryHits.length}`,
  ];

  if (userHits.length) {
    lines.push("");
    lines.push("Top users:");
    userHits.slice(0, 3).forEach((row, index) => {
      lines.push(`${index + 1}. ${resolveUserName(row)} | ${ROLE_LABELS[row?.role] || row?.role || "-"}`);
    });
  }
  if (leadHits.length) {
    lines.push("");
    lines.push("Top leads:");
    leadHits.slice(0, 3).forEach((row, index) => {
      lines.push(`${index + 1}. ${toLeadName(row)} | ${row?.status || "-"}`);
    });
  }
  if (inventoryHits.length) {
    lines.push("");
    lines.push("Top inventory:");
    inventoryHits.slice(0, 3).forEach((row, index) => {
      lines.push(`${index + 1}. ${toInventoryLabel(row)} | ${row?.status || "-"}`);
    });
  }

  return lines.join("\n");
};

const parseDrillDownCommand = (query) => {
  const match = query.match(/\b(?:open|show|drill|go to)\s+#?(\d{1,2})\s+(?:lead|leads|pipeline)\b/i)
    || query.match(/\b#(\d{1,2})\s+(?:lead|leads|pipeline)\b/i);
  if (!match?.[1]) return null;

  const rank = Number(match[1]);
  if (!Number.isFinite(rank) || rank <= 0) return null;
  return rank;
};

const getLeadsForRankedUser = ({
  data,
  role,
  userId,
  dateRange,
}) => {
  const userLookup = buildUserLookup(data?.users || []);
  return (data?.leads || [])
    .filter((lead) => {
      if (dateRange?.start && dateRange?.end && !inDateRange(getLeadRangeDate(lead), dateRange)) {
        return false;
      }
      const owner = resolveLeadPerformanceOwnerForRole({
        lead,
        role,
        userLookup,
      });
      return String(owner?.id || "") === String(userId || "");
    })
    .sort((a, b) => (toValidDate(b?.updatedAt || b?.createdAt)?.getTime() || 0) - (toValidDate(a?.updatedAt || a?.createdAt)?.getTime() || 0));
};

const buildDrillDownLeadsReply = ({ item, leads }) => {
  const lines = [
    `Drill-down for #${item.rank} ${item.userName} (${ROLE_LABELS[item.role] || item.role}): ${leads.length} lead(s)`,
  ];
  leads.slice(0, MAX_PREVIEW_ROWS).forEach((lead, index) => {
    lines.push(
      `${index + 1}. ${toLeadName(lead)} | ${lead?.status || "-"} | ${lead?.phone || "-"} | LeadId ${lead?._id || "-"}`,
    );
  });
  if (leads.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${leads.length - MAX_PREVIEW_ROWS} more leads`);
  }
  return lines.join("\n");
};

const escapeCsvValue = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;

const downloadCsvFile = (filename, rows) => {
  if (typeof window === "undefined") return;
  const csv = rows.map((row) => row.map((col) => escapeCsvValue(col)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const sanitizeFilenameToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  || "all";

const isExportCsvQuery = (query) =>
  includesAny(query, ["export", "download", "nikalo", "nikaalo"])
  && includesAny(query, ["csv", "sheet"]);

const buildClosedDealsExportRows = (data) => {
  const rows = [
    [
      "Lead ID",
      "Lead Name",
      "Phone",
      "Project",
      "Status",
      "Assigned To",
      "Created At",
      "Updated At",
      "Remaining Amount",
      "Payment Reference",
    ],
  ];

  (data?.leads || [])
    .filter((lead) => String(lead?.status || "").toUpperCase() === "CLOSED")
    .forEach((lead) => {
      rows.push([
        lead?._id || "",
        toLeadName(lead),
        lead?.phone || "",
        lead?.projectInterested || "",
        lead?.status || "",
        resolveUserName(lead?.assignedTo),
        formatDateTime(lead?.createdAt),
        formatDateTime(lead?.updatedAt || lead?.createdAt),
        Number(lead?.dealPayment?.remainingAmount || 0),
        lead?.dealPayment?.paymentReference || "",
      ]);
    });

  return rows;
};

const buildFinanceExportRows = (data) => {
  const rows = [
    [
      "Lead ID",
      "Lead Name",
      "Phone",
      "Project",
      "Total Sell",
      "Remaining",
      "Collected",
      "Lead Status",
      "Assigned To",
    ],
  ];

  buildFinanceSaleRows(data).forEach((row) => {
    rows.push([
      row?.lead?._id || "",
      toLeadName(row?.lead),
      row?.lead?.phone || "",
      row?.project || "",
      Number(row?.totalAmount || 0),
      Number(row?.remainingAmount || 0),
      Number(row?.collectedAmount || 0),
      row?.lead?.status || "",
      resolveUserName(row?.lead?.assignedTo),
    ]);
  });

  return rows;
};

const buildApprovalExportRows = (data) => {
  const rows = [["Type", "ID", "Name/Requested By", "Status/Request", "Reference", "Created At"]];

  (data?.leadPaymentRequests || []).forEach((lead) => {
    rows.push([
      "PAYMENT",
      lead?._id || "",
      toLeadName(lead),
      String(lead?.dealPayment?.approvalStatus || "PENDING").toUpperCase(),
      lead?.dealPayment?.paymentReference || "",
      formatDateTime(lead?.dealPayment?.approvalRequestedAt || lead?.createdAt),
    ]);
  });

  (data?.pendingRequests || []).forEach((request) => {
    rows.push([
      "INVENTORY",
      request?._id || "",
      resolveUserName(request?.requestedBy),
      String(request?.type || request?.requestType || "UPDATE").toUpperCase(),
      toInventoryLabel(request?.inventoryId || request?.proposedData || {}),
      formatDateTime(request?.createdAt),
    ]);
  });

  return rows;
};

const handleExportQuery = ({ query, data, dateRange }) => {
  if (!isExportCsvQuery(query)) return { handled: false };

  const dateToken = sanitizeFilenameToken(dateRange?.label || "all_time");

  if (includesAny(query, ["closed", "deal", "deals", "lead", "leads"])) {
    const rows = buildClosedDealsExportRows(data);
    if (rows.length <= 1) {
      return { handled: true, reply: "No closed deals found for export in current scope." };
    }
    const filename = `closed_deals_${dateToken}.csv`;
    downloadCsvFile(filename, rows);
    return {
      handled: true,
      reply: `Exported ${rows.length - 1} closed deal row(s) to ${filename}`,
      auditType: "EXPORT_CLOSED_DEALS",
      auditDetails: `${rows.length - 1} rows`,
    };
  }

  if (includesAny(query, ["approval", "approvals", "pending"])) {
    const rows = buildApprovalExportRows(data);
    if (rows.length <= 1) {
      return { handled: true, reply: "No approval rows found for export in current scope." };
    }
    const filename = `approvals_${dateToken}.csv`;
    downloadCsvFile(filename, rows);
    return {
      handled: true,
      reply: `Exported ${rows.length - 1} approval row(s) to ${filename}`,
      auditType: "EXPORT_APPROVALS",
      auditDetails: `${rows.length - 1} rows`,
    };
  }

  if (includesAny(query, ["finance", "sell", "sales", "revenue", "collection", "remaining", "amount"])) {
    const rows = buildFinanceExportRows(data);
    if (rows.length <= 1) {
      return { handled: true, reply: "No finance rows found for export in current scope." };
    }
    const filename = `finance_${dateToken}.csv`;
    downloadCsvFile(filename, rows);
    return {
      handled: true,
      reply: `Exported ${rows.length - 1} finance row(s) to ${filename}`,
      auditType: "EXPORT_FINANCE",
      auditDetails: `${rows.length - 1} rows`,
    };
  }

  return {
    handled: true,
    reply: "Please specify export type: closed deals, approvals, or finance. Example: `export closed deals last month csv`",
  };
};

const getSubscriptionMetricLabel = (metric) => {
  if (metric === SUBSCRIPTION_METRICS.PENDING_PAYMENT_APPROVALS) return "Pending Payment Approvals";
  if (metric === SUBSCRIPTION_METRICS.PENDING_INVENTORY_APPROVALS) return "Pending Inventory Approvals";
  return "Total Pending Approvals";
};

const resolveSubscriptionMetric = (sourceText) => {
  const source = normalizeText(sourceText);
  if (!source) return "";
  if (includesAny(source, ["payment", "pay"])) return SUBSCRIPTION_METRICS.PENDING_PAYMENT_APPROVALS;
  if (includesAny(source, ["inventory", "asset"])) return SUBSCRIPTION_METRICS.PENDING_INVENTORY_APPROVALS;
  if (includesAny(source, ["approval", "request", "pending"])) return SUBSCRIPTION_METRICS.TOTAL_PENDING_APPROVALS;
  return "";
};

const parseSubscriptionCommand = (query) => {
  if (includesAny(query, ["list subscriptions", "show subscriptions", "my subscriptions", "subscription list", "alerts list", "show alerts"])) {
    return { mode: "LIST" };
  }

  const removeAllMatch = query.match(/\b(?:remove|delete|cancel|stop)\s+(?:all\s+)?(?:subscriptions|alerts)\b/i);
  if (removeAllMatch) {
    return { mode: "REMOVE_ALL" };
  }

  const removeSingleMatch = query.match(/\b(?:remove|delete|cancel|stop)\s+(?:subscription|alert)\s+#?(\d{1,2})\b/i);
  if (removeSingleMatch?.[1]) {
    return {
      mode: "REMOVE_INDEX",
      index: Number(removeSingleMatch[1]),
    };
  }

  const createMatch = query.match(
    /\b(?:notify|alert)\s+me\s+when\s+(.+?)\s*(>=|=>|<=|=<|>|<|=|==)\s*(\d{1,5})\b/i,
  );
  if (createMatch?.[1] && createMatch?.[2] && createMatch?.[3]) {
    const metric = resolveSubscriptionMetric(createMatch[1]);
    const operator = normalizeComparisonOperator(createMatch[2]);
    const threshold = Number(createMatch[3]);
    if (!metric || !operator || !Number.isFinite(threshold)) {
      return {
        mode: "INVALID",
        error: "Could not parse subscription. Example: `notify me when pending approvals > 10`",
      };
    }
    return {
      mode: "CREATE",
      metric,
      operator,
      threshold,
    };
  }

  return null;
};

const getSubscriptionMetricValue = (snapshot, metric) => {
  const paymentCount = (snapshot?.leadPaymentRequests || []).filter(
    (row) => String(row?.dealPayment?.approvalStatus || "PENDING").toUpperCase() === "PENDING",
  ).length;
  const inventoryCount = (snapshot?.pendingRequests || []).length;

  if (metric === SUBSCRIPTION_METRICS.PENDING_PAYMENT_APPROVALS) return paymentCount;
  if (metric === SUBSCRIPTION_METRICS.PENDING_INVENTORY_APPROVALS) return inventoryCount;
  return paymentCount + inventoryCount;
};

const evaluateThresholdCondition = (value, operator, threshold) => {
  if (operator === ">") return value > threshold;
  if (operator === ">=") return value >= threshold;
  if (operator === "<") return value < threshold;
  if (operator === "<=") return value <= threshold;
  if (operator === "=") return value === threshold;
  return false;
};

const buildSubscriptionsListReply = (subscriptions, snapshot) => {
  const rows = Array.isArray(subscriptions) ? subscriptions.filter((row) => row.active !== false) : [];
  if (!rows.length) {
    return "No active subscriptions. Example: `notify me when pending approvals > 10`";
  }

  const lines = [`Active subscriptions: ${rows.length}`];
  rows.forEach((row, index) => {
    const currentValue = getSubscriptionMetricValue(snapshot, row.metric);
    lines.push(
      `${index + 1}. ${getSubscriptionMetricLabel(row.metric)} ${row.operator} ${row.threshold} | Current ${currentValue}`,
    );
  });
  return lines.join("\n");
};

const isAuditLogQuery = (query) =>
  includesAny(query, ["audit log", "action log", "security log", "show audit", "show action log", "recent actions"]);

const buildAuditLogReply = (rows) => {
  const auditRows = Array.isArray(rows) ? rows : [];
  if (!auditRows.length) {
    return "No audit entries yet.";
  }

  const lines = [`Recent audit entries: ${auditRows.length}`];
  auditRows.slice(0, 12).forEach((row, index) => {
    lines.push(
      `${index + 1}. [${row.status || "INFO"}] ${row.type} | ${formatDateTime(row.at)} | ${row.details || "-"}`,
    );
  });
  return lines.join("\n");
};

const buildHelpReply = () =>
  [
    "I can help you with natural language prompts.",
    "Voice input:",
    "- Select `Hindi (India)` and click `Start Mic`",
    "- Say commands like `सबसे अच्छा मैनेजर कौन है` or `इस महीने के closed deals`",
    "Examples:",
    "- Give me full system overview",
    "- How many deals are closed this month?",
    "- Show blocked inventory last 30 days",
    "- Show leads between 01-03-2026 and 06-03-2026",
    "- Who is the best manager?",
    "- Top 5 executives by performance",
    "- Open #2 leads",
    "- Best performers by role",
    "- Approve payment request for lead Rahul",
    "- Reject inventory request 67b... because duplicate",
    "- Open lead by phone 9876543210",
    "- Show latest 10 hot leads",
    "- Total sell by project this month",
    "- Remaining amount this month by manager",
    "- Export closed deals last month csv",
    "- Notify me when pending approvals > 10",
    "- List subscriptions",
    "- Remove subscription #1",
    "- Show audit log",
    "- save this as weekly review",
    "- run weekly review",
    "- list workflows",
    "- Show leads in noida",
    "- Show unassigned leads",
    "- Show blocked inventory",
    "- Any pending approval requests?",
    "- Search ravi",
    "- Take me to reports",
  ].join("\n");

const buildFallbackReply = () =>
  [
    "I could not map that request yet.",
    "Tip: mic use karke Hindi bol sakte ho (Hindi speech mode).",
    "Try one of these:",
    "- overview",
    "- how many deals are closed this month",
    "- show leads between 1 mar 2026 and 6 mar 2026",
    "- who is the best manager",
    "- top 5 executives by performance",
    "- open #2 leads",
    "- approve payment request for lead Rahul",
    "- open lead by phone 9876543210",
    "- show latest 10 hot leads",
    "- total sell by project this month",
    "- remaining amount this month by manager",
    "- export closed deals last month csv",
    "- notify me when pending approvals > 10",
    "- show audit log",
    "- save this as weekly review",
    "- run weekly review",
    "- how many deals are closed",
    "- show me closed deals",
    "- show blocked inventory in noida",
    "- show users active",
    "- pending requests",
    "- take me to alerts",
  ].join("\n");

const parseSaveWorkflowCommand = (prompt) => {
  const raw = String(prompt || "").trim();
  if (!raw) return null;

  const saveThisMatch = raw.match(/^save\s+(?:this|last|current)(?:\s+command)?\s+as\s+(.+)$/i);
  if (saveThisMatch?.[1]) {
    return {
      mode: "LAST",
      name: String(saveThisMatch[1]).trim(),
      prompt: "",
    };
  }

  const saveExplicitMatch = raw.match(/^save\s+command\s+(.+?)\s+as\s+(.+)$/i);
  if (saveExplicitMatch?.[1] && saveExplicitMatch?.[2]) {
    return {
      mode: "EXPLICIT",
      name: String(saveExplicitMatch[2]).trim(),
      prompt: String(saveExplicitMatch[1]).trim(),
    };
  }

  return null;
};

const parseRunWorkflowCommand = (prompt) => {
  const raw = String(prompt || "").trim();
  const match = raw.match(/^(?:run|execute)\s+(.+)$/i);
  if (!match?.[1]) return null;
  return String(match[1]).replace(/^workflow\s+/i, "").trim();
};

const isListWorkflowCommand = (query) =>
  includesAny(query, [
    "list workflows",
    "show workflows",
    "show saved workflows",
    "show saved commands",
    "list saved commands",
    "my workflows",
  ]);

const buildWorkflowsListReply = (workflows) => {
  const rows = Array.isArray(workflows) ? workflows : [];
  if (!rows.length) {
    return "No saved workflows yet. Use `save this as weekly review`.";
  }

  const lines = [`Saved workflows: ${rows.length}`];
  rows.slice(0, MAX_PREVIEW_ROWS).forEach((row, index) => {
    lines.push(
      `${index + 1}. ${row.name} | Runs ${Number(row.runCount || 0)} | Last run ${formatDateTime(row.lastRunAt || row.updatedAt || row.createdAt)}`,
    );
    lines.push(`   -> ${row.prompt}`);
  });
  if (rows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more workflows`);
  }
  return lines.join("\n");
};

const initialMessages = () => ([
  {
    id: 1,
    role: "assistant",
    text: "Admin assistant is ready. Ask for date-scoped analytics, performance ranks, drill-down, approvals, exports, subscriptions, audit log, saved workflows, users, leads, inventory, search, navigation, or use voice input (Hindi/English).",
  },
  {
    id: 2,
    role: "assistant",
    text: "Try: `Give me full system overview`",
  },
]);

const AdminCommandConsole = () => {
  const navigate = useNavigate();
  const chatRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechRetryRef = useRef(0);
  const handleAskRef = useRef(null);
  const historyStorageKey = useMemo(() => getHistoryStorageKey(), []);
  const workflowStorageKey = useMemo(() => getWorkflowStorageKey(), []);
  const subscriptionStorageKey = useMemo(() => getSubscriptionStorageKey(), []);
  const auditStorageKey = useMemo(() => getAuditStorageKey(), []);
  const lastActionablePromptRef = useRef("");
  const lastDrillContextRef = useRef(null);
  const actorRole = useMemo(() => getAssistantActorRole(), []);

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLocale, setSpeechLocale] = useState("hi-IN");
  const [speechError, setSpeechError] = useState("");
  const [runtimeError, setRuntimeError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [messages, setMessages] = useState(
    () => loadStoredMessages(historyStorageKey) || initialMessages(),
  );
  const [workflows, setWorkflows] = useState(
    () => loadStoredWorkflows(workflowStorageKey),
  );
  const [subscriptions, setSubscriptions] = useState(
    () => loadStoredSubscriptions(subscriptionStorageKey),
  );
  const [auditLog, setAuditLog] = useState(
    () => loadStoredAuditLog(auditStorageKey),
  );
  const [snapshot, setSnapshot] = useState({
    users: [],
    leads: [],
    inventory: [],
    pendingRequests: [],
    leadPaymentRequests: [],
    loadedAt: null,
  });

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const snapshotLoaded = useMemo(() => !!snapshot.loadedAt, [snapshot.loadedAt]);

  const appendMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
  }, []);

  const appendAuditEntry = useCallback((payload = {}) => {
    setAuditLog((prev) => {
      const nextEntry = {
        id: `${Date.now()}-${Math.random()}`,
        at: new Date().toISOString(),
        actorRole,
        type: String(payload?.type || "INFO"),
        status: String(payload?.status || "SUCCESS"),
        command: String(payload?.command || "").trim(),
        details: String(payload?.details || "").trim(),
      };
      return [nextEntry, ...(Array.isArray(prev) ? prev : [])].slice(0, MAX_AUDIT_LOG_ROWS);
    });
  }, [actorRole]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = speechLocale;

    recognition.onstart = () => {
      speechRetryRef.current = 0;
      setSpeechError("");
      setIsListening(true);
    };

    recognition.onerror = (event) => {
      const errorCode = String(event?.error || "unknown");
      if (errorCode === "no-speech" && speechRetryRef.current < 1) {
        speechRetryRef.current += 1;
        setSpeechError("No speech detected, retrying once...");
        try {
          recognition.stop();
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Retry start failed.
            }
          }, 160);
          return;
        } catch {
          // Fall through to readable error.
        }
      }

      let readable = "Voice capture failed. Please try again.";
      if (errorCode === "not-allowed") readable = "Microphone permission denied. Please allow mic access in browser settings.";
      if (errorCode === "no-speech") readable = "No speech detected. Please speak clearly and try again.";
      if (errorCode === "audio-capture") readable = "No microphone detected on this device.";
      if (errorCode === "language-not-supported") readable = "Selected speech language is not supported in this browser.";
      setSpeechError(readable);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = String(event.results?.[i]?.[0]?.transcript || "").trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      if (interimTranscript) {
        setInput(interimTranscript);
      }

      if (finalTranscript) {
        setInput(finalTranscript);
        const ask = handleAskRef.current;
        if (ask) {
          Promise.resolve(ask(finalTranscript)).catch(() => {});
        }
        try {
          recognition.stop();
        } catch {
          // Ignore stop errors after final transcript.
        }
      }
    };

    speechRecognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // Ignore abort errors during cleanup.
      }
      recognition.onstart = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onresult = null;
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null;
      }
    };
  }, [speechLocale]);

  const toggleVoiceCapture = useCallback(() => {
    if (!speechSupported) {
      const unsupported = "Voice input is not supported in this browser. Please use Chrome/Edge latest version.";
      setSpeechError(unsupported);
      appendMessage("assistant", unsupported);
      return;
    }

    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      const unavailable = "Speech recognition is unavailable right now. Refresh and try again.";
      setSpeechError(unavailable);
      appendMessage("assistant", unavailable);
      return;
    }

    if (isListening) {
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors.
      }
      return;
    }

    setSpeechError("");
    try {
      recognition.lang = speechLocale;
      recognition.start();
    } catch (error) {
      setSpeechError(toErrorMessage(error, "Unable to start voice input."));
    }
  }, [appendMessage, isListening, speechLocale, speechSupported]);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, running]);

  useEffect(() => {
    if (typeof window === "undefined" || !historyStorageKey) return;

    try {
      const payload = JSON.stringify(toStoredMessages(messages));
      window.localStorage.setItem(historyStorageKey, payload);
    } catch {
      // Keep the assistant functional even if storage quota is unavailable.
    }
  }, [historyStorageKey, messages]);

  useEffect(() => {
    if (typeof window === "undefined" || !workflowStorageKey) return;

    try {
      const payload = JSON.stringify(toStoredWorkflows(workflows));
      window.localStorage.setItem(workflowStorageKey, payload);
    } catch {
      // Ignore storage failure to keep runtime chat usable.
    }
  }, [workflowStorageKey, workflows]);

  useEffect(() => {
    if (typeof window === "undefined" || !subscriptionStorageKey) return;

    try {
      const payload = JSON.stringify(toStoredSubscriptions(subscriptions));
      window.localStorage.setItem(subscriptionStorageKey, payload);
    } catch {
      // Ignore storage failure for subscriptions.
    }
  }, [subscriptionStorageKey, subscriptions]);

  useEffect(() => {
    if (typeof window === "undefined" || !auditStorageKey) return;

    try {
      const payload = JSON.stringify(toStoredAuditLog(auditLog));
      window.localStorage.setItem(auditStorageKey, payload);
    } catch {
      // Ignore storage failure for audit log.
    }
  }, [auditStorageKey, auditLog]);

  const loadSnapshot = useCallback(async (force = false) => {
    if (!force && snapshot.loadedAt) return snapshot;

    setLoadingSnapshot(true);
    setRuntimeError("");
    try {
      const [usersData, leadsData, inventoryData, requestData, leadPaymentData] = await Promise.all([
        getUsers(),
        getAllLeads(),
        getInventoryAssets(),
        getPendingInventoryRequests(),
        getLeadPaymentRequests({ approvalStatus: "PENDING", limit: 300 }),
      ]);

      const nextSnapshot = {
        users: Array.isArray(usersData?.users) ? usersData.users : [],
        leads: Array.isArray(leadsData) ? leadsData : [],
        inventory: Array.isArray(inventoryData) ? inventoryData : [],
        pendingRequests: Array.isArray(requestData) ? requestData : [],
        leadPaymentRequests: Array.isArray(leadPaymentData) ? leadPaymentData : [],
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

  useEffect(() => {
    const activeCount = (subscriptions || []).filter((row) => row.active !== false).length;
    if (activeCount === 0) return undefined;

    const intervalId = setInterval(() => {
      loadSnapshot(true).catch(() => {});
    }, 60000);

    return () => clearInterval(intervalId);
  }, [loadSnapshot, subscriptions]);

  useEffect(() => {
    if (!snapshot?.loadedAt) return;
    if (!Array.isArray(subscriptions) || !subscriptions.length) return;

    let hasMutations = false;
    const triggeredMessages = [];

    const nextRows = subscriptions.map((row) => {
      if (row.active === false) return row;
      const currentValue = getSubscriptionMetricValue(snapshot, row.metric);
      const currentState = evaluateThresholdCondition(currentValue, row.operator, row.threshold);
      const previousState = Boolean(row.lastState);

      if (currentState && !previousState) {
        hasMutations = true;
        triggeredMessages.push(
          `${getSubscriptionMetricLabel(row.metric)} ${row.operator} ${row.threshold} matched (current ${currentValue}).`,
        );
        return {
          ...row,
          lastState: true,
          lastTriggeredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      if (!currentState && previousState) {
        hasMutations = true;
        return {
          ...row,
          lastState: false,
          updatedAt: new Date().toISOString(),
        };
      }

      return row;
    });

    if (triggeredMessages.length) {
      appendMessage(
        "assistant",
        [
          "Subscription alert:",
          ...triggeredMessages.map((line, index) => `${index + 1}. ${line}`),
        ].join("\n"),
      );
      appendAuditEntry({
        type: "SUBSCRIPTION_TRIGGER",
        status: "SUCCESS",
        details: triggeredMessages.join(" | "),
      });
    }

    if (hasMutations) {
      setSubscriptions(nextRows);
    }
  }, [appendAuditEntry, appendMessage, snapshot, subscriptions]);

  const executePendingAction = useCallback(async (action) => {
    if (!action?.kind) {
      throw new Error("No pending action found.");
    }

    if (action.kind === "APPROVE_LEAD_PAYMENT") {
      await updateLeadStatus(action.leadId, {
        status: action.currentStatus || "REQUESTED",
        dealPayment: {
          approvalStatus: "APPROVED",
          approvalNote: "Approved from admin assistant",
        },
      });
      await loadSnapshot(true);
      return `Payment request approved for ${action.leadName}.`;
    }

    if (action.kind === "REJECT_LEAD_PAYMENT") {
      await updateLeadStatus(action.leadId, {
        status: action.currentStatus || "REQUESTED",
        dealPayment: {
          approvalStatus: "REJECTED",
          approvalNote: action.reason || "Rejected from admin assistant",
        },
      });
      await loadSnapshot(true);
      return `Payment request rejected for ${action.leadName}.`;
    }

    if (action.kind === "APPROVE_INVENTORY_REQUEST") {
      await approveInventoryRequest(action.requestId);
      await loadSnapshot(true);
      return "Inventory request approved.";
    }

    if (action.kind === "REJECT_INVENTORY_REQUEST") {
      await rejectInventoryRequest(action.requestId, action.reason || "Rejected from admin assistant");
      await loadSnapshot(true);
      return "Inventory request rejected.";
    }

    throw new Error("Unsupported action type.");
  }, [loadSnapshot]);

  const findWorkflowByName = useCallback((name) => {
    const normalized = normalizeWorkflowName(name);
    if (!normalized) return null;

    const exact = workflows.find((row) => row.key === normalized);
    if (exact) return exact;

    return workflows.find((row) => row.key.includes(normalized) || normalized.includes(row.key)) || null;
  }, [workflows]);

  const runSemanticPrompt = useCallback(async (prompt, options = {}) => {
    const query = normalizeIntentText(prompt);
    const shouldTrackPrompt = options.trackPrompt !== false;
    const allowNavigation = options.allowNavigation !== false;
    const hasLeadQuickIntent = includesAny(query, LEAD_QUICK_OPEN_TERMS);
    const drillDownRank = parseDrillDownCommand(query);

    if (includesAny(query, ["refresh", "reload", "sync latest", "update data"])) {
      const refreshed = await loadSnapshot(true);
      appendMessage("assistant", `Data refreshed.\nSnapshot time: ${formatDateTime(refreshed.loadedAt)}`);
      appendAuditEntry({
        type: "SNAPSHOT_REFRESH",
        status: "SUCCESS",
        command: prompt,
        details: `Snapshot ${formatDateTime(refreshed.loadedAt)}`,
      });
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (allowNavigation && !hasLeadQuickIntent && !drillDownRank) {
      const navTarget = matchNavigationTarget(query);
      if (navTarget && includesAny(query, NAV_INTENT_WORDS)) {
        appendMessage("assistant", `Opening ${navTarget.label}.`);
        appendAuditEntry({
          type: "NAVIGATE",
          status: "SUCCESS",
          command: prompt,
          details: `Navigated to ${navTarget.path}`,
        });
        navigate(navTarget.path);
        if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
        return;
      }
    }

    const data = await loadSnapshot(false);
    const actionIntent = parseActionCommand(query, data);
    if (actionIntent?.error) {
      appendMessage("assistant", actionIntent.error);
      return;
    }
    if (actionIntent?.action) {
      if (!MUTATION_ALLOWED_ROLES.has(actorRole)) {
        const roleLabel = ROLE_LABELS[actorRole] || actorRole;
        appendMessage(
          "assistant",
          `This action is restricted. ${roleLabel} cannot approve or reject requests from console.`,
        );
        appendAuditEntry({
          type: actionIntent.action.kind,
          status: "BLOCKED",
          command: prompt,
          details: `Role ${actorRole} blocked from mutation`,
        });
        return;
      }

      setPendingAction(actionIntent.action);
      appendMessage("assistant", buildPendingActionPrompt(actionIntent.action));
      appendAuditEntry({
        type: actionIntent.action.kind,
        status: "PENDING",
        command: prompt,
        details: "Queued and waiting for confirm",
      });
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    const { scopedData, dateRange } = applyDateScopeToSnapshot(data, query);
    const withScopePrefix = (text) =>
      dateRange?.label ? `Date scope: ${dateRange.label}\n${text}` : text;

    if (drillDownRank) {
      const drillContext = lastDrillContextRef.current;
      if (!drillContext?.items?.length) {
        appendMessage(
          "assistant",
          "No ranking context found. Run a ranking query first, for example: `top 5 executives by performance`.",
        );
        return;
      }

      const item = drillContext.items.find((row) => Number(row.rank) === drillDownRank);
      if (!item) {
        const available = drillContext.items
          .map((row) => `#${row.rank} ${row.userName}`)
          .join(", ");
        appendMessage(
          "assistant",
          `Rank #${drillDownRank} is not available in last ranking.\nAvailable ranks: ${available || "none"}`,
        );
        return;
      }

      const effectiveRange = dateRange || drillContext.dateRange || null;
      const leads = getLeadsForRankedUser({
        data,
        role: item.role,
        userId: item.userId,
        dateRange: effectiveRange,
      });
      const scopeLabel = effectiveRange?.label ? `Date scope: ${effectiveRange.label}\n` : "";
      appendMessage("assistant", `${scopeLabel}${buildDrillDownLeadsReply({ item, leads })}`);
      appendAuditEntry({
        type: "DRILLDOWN_ROLE_PIPELINE",
        status: "SUCCESS",
        command: prompt,
        details: `${item.userName} rank #${item.rank} | ${leads.length} lead(s)`,
      });
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (isAuditLogQuery(query)) {
      appendMessage("assistant", buildAuditLogReply(auditLog));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (isExportCsvQuery(query)) {
      if (!EXPORT_ALLOWED_ROLES.has(actorRole)) {
        const roleLabel = ROLE_LABELS[actorRole] || actorRole;
        appendMessage(
          "assistant",
          `CSV export is restricted for ${roleLabel}. Please contact admin for export access.`,
        );
        appendAuditEntry({
          type: "EXPORT_BLOCKED",
          status: "BLOCKED",
          command: prompt,
          details: `Role ${actorRole} blocked from CSV export`,
        });
        return;
      }

      const exportResult = handleExportQuery({
        query,
        data: scopedData,
        dateRange,
      });

      if (exportResult?.handled) {
        appendMessage("assistant", withScopePrefix(exportResult.reply));
        if (exportResult.auditType) {
          appendAuditEntry({
            type: exportResult.auditType,
            status: "SUCCESS",
            command: prompt,
            details: exportResult.auditDetails || "",
          });
        }
        if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
        return;
      }
    }

    const leadQuickResult = handleLeadQuickOpenQuery({
      query,
      data,
      scopedData,
      dateRange,
      navigate,
    });
    if (leadQuickResult?.handled) {
      if (leadQuickResult.reply) {
        appendMessage("assistant", leadQuickResult.reply);
      }
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (includesAny(query, ["overview", "everything", "all data", "snapshot", "full system"])) {
      appendMessage("assistant", buildOverviewReply(scopedData, dateRange));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (includesAny(query, [
      "pending request",
      "approval request",
      "approvals",
      "pending approvals",
      "pending payment",
      "payment approvals",
      "pending inventory",
      "inventory approvals",
    ])) {
      appendMessage("assistant", buildPendingRequestsReply(scopedData, dateRange));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (isPerformanceQuery(query)) {
      const performanceResult = buildRolePerformanceResult(scopedData, query);
      lastDrillContextRef.current = performanceResult.drillContext
        ? {
          ...performanceResult.drillContext,
          dateRange,
        }
        : null;

      const reply = performanceResult.drillContext?.items?.length
        ? `${performanceResult.reply}\nTry: \`open #1 leads\``
        : performanceResult.reply;
      appendMessage("assistant", withScopePrefix(reply));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (isFinanceQuery(query)) {
      appendMessage("assistant", withScopePrefix(buildFinanceReply(scopedData, query, dateRange)));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (includesAny(query, ["user", "team", "executive", "manager", "field executive"])) {
      appendMessage("assistant", buildUsersReply(scopedData, query));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (includesAny(query, LEAD_INTENT_TERMS)) {
      appendMessage("assistant", withScopePrefix(buildLeadsReply(scopedData, query)));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (includesAny(query, ["inventory", "property", "asset", "blocked", "sold", "available"])) {
      appendMessage("assistant", withScopePrefix(buildInventoryReply(scopedData, query)));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    if (includesAny(query, ["find ", "search ", "look up "])) {
      appendMessage("assistant", buildSearchReply(scopedData, query));
      if (shouldTrackPrompt) lastActionablePromptRef.current = prompt;
      return;
    }

    appendMessage("assistant", buildFallbackReply());
  }, [actorRole, appendAuditEntry, appendMessage, auditLog, loadSnapshot, navigate]);

  const handleAsk = useCallback(async (rawInput) => {
    const prompt = String(rawInput || "").trim();
    if (!prompt) return;

    const query = normalizeIntentText(prompt);
    appendMessage("user", prompt);
    setInput("");

    if (query === "clear" || query === "clear chat" || query === "reset chat") {
      setMessages(initialMessages());
      setPendingAction(null);
      return;
    }

    if (
      query === "help"
      || includesAny(query, ["what can you do", "how to use", "commands", "options"])
    ) {
      appendMessage("assistant", buildHelpReply());
      return;
    }

    if (isAuditLogQuery(query)) {
      appendMessage("assistant", buildAuditLogReply(auditLog));
      appendAuditEntry({
        type: "AUDIT_VIEW",
        status: "SUCCESS",
        command: prompt,
        details: `Rows ${Array.isArray(auditLog) ? auditLog.length : 0}`,
      });
      return;
    }

    const subscriptionIntent = parseSubscriptionCommand(query);
    if (subscriptionIntent) {
      if (subscriptionIntent.mode === "INVALID") {
        appendMessage("assistant", subscriptionIntent.error || "Unable to parse subscription command.");
        appendAuditEntry({
          type: "SUBSCRIPTION_CREATE",
          status: "FAILED",
          command: prompt,
          details: subscriptionIntent.error || "Invalid subscription command",
        });
        return;
      }

      if (subscriptionIntent.mode === "LIST") {
        setRunning(true);
        try {
          const currentSnapshot = await loadSnapshot(false);
          appendMessage("assistant", buildSubscriptionsListReply(subscriptions, currentSnapshot));
          appendAuditEntry({
            type: "SUBSCRIPTION_LIST",
            status: "SUCCESS",
            command: prompt,
            details: `Active ${(subscriptions || []).filter((row) => row.active !== false).length}`,
          });
        } catch (error) {
          appendMessage("assistant", toErrorMessage(error, "Could not load subscriptions."));
        } finally {
          setRunning(false);
        }
        return;
      }

      if (subscriptionIntent.mode === "REMOVE_ALL") {
        const removedCount = (subscriptions || []).filter((row) => row.active !== false).length;
        if (!removedCount) {
          appendMessage("assistant", "No active subscriptions to remove.");
          return;
        }

        setSubscriptions([]);
        appendMessage("assistant", `Removed ${removedCount} subscription(s).`);
        appendAuditEntry({
          type: "SUBSCRIPTION_REMOVE_ALL",
          status: "SUCCESS",
          command: prompt,
          details: `Removed ${removedCount}`,
        });
        return;
      }

      if (subscriptionIntent.mode === "REMOVE_INDEX") {
        const index = Number(subscriptionIntent.index || 0);
        if (!Number.isFinite(index) || index <= 0) {
          appendMessage("assistant", "Please provide a valid subscription index. Example: `remove subscription #1`");
          return;
        }

        let removedRow = null;
        setSubscriptions((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const activeRows = safePrev.filter((row) => row.active !== false);
          if (index > activeRows.length) {
            return safePrev;
          }
          removedRow = activeRows[index - 1];
          return safePrev.filter((row) => String(row.id || "") !== String(removedRow?.id || ""));
        });

        if (!removedRow) {
          appendMessage("assistant", `Subscription #${index} not found.`);
          appendAuditEntry({
            type: "SUBSCRIPTION_REMOVE",
            status: "FAILED",
            command: prompt,
            details: `Index #${index} not found`,
          });
          return;
        }

        appendMessage(
          "assistant",
          `Removed subscription #${index}: ${getSubscriptionMetricLabel(removedRow.metric)} ${removedRow.operator} ${removedRow.threshold}`,
        );
        appendAuditEntry({
          type: "SUBSCRIPTION_REMOVE",
          status: "SUCCESS",
          command: prompt,
          details: `${getSubscriptionMetricLabel(removedRow.metric)} ${removedRow.operator} ${removedRow.threshold}`,
        });
        return;
      }

      if (subscriptionIntent.mode === "CREATE") {
        setRunning(true);
        try {
          const currentSnapshot = await loadSnapshot(false);
          const metricLabel = getSubscriptionMetricLabel(subscriptionIntent.metric);
          const currentValue = getSubscriptionMetricValue(currentSnapshot, subscriptionIntent.metric);
          const initialState = evaluateThresholdCondition(
            currentValue,
            subscriptionIntent.operator,
            subscriptionIntent.threshold,
          );

          let duplicate = false;
          setSubscriptions((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const exists = safePrev.some(
              (row) =>
                row.active !== false
                && row.metric === subscriptionIntent.metric
                && row.operator === subscriptionIntent.operator
                && Number(row.threshold) === Number(subscriptionIntent.threshold),
            );
            if (exists) {
              duplicate = true;
              return safePrev;
            }

            const nowIso = new Date().toISOString();
            const nextRow = {
              id: `${Date.now()}-${Math.random()}`,
              metric: subscriptionIntent.metric,
              operator: subscriptionIntent.operator,
              threshold: Number(subscriptionIntent.threshold),
              label: metricLabel,
              active: true,
              createdAt: nowIso,
              updatedAt: nowIso,
              lastTriggeredAt: initialState ? nowIso : null,
              lastState: initialState,
            };
            return [nextRow, ...safePrev].slice(0, MAX_STORED_SUBSCRIPTIONS);
          });

          if (duplicate) {
            appendMessage("assistant", "This subscription is already active.");
            appendAuditEntry({
              type: "SUBSCRIPTION_CREATE",
              status: "INFO",
              command: prompt,
              details: "Duplicate subscription ignored",
            });
            return;
          }

          appendMessage(
            "assistant",
            [
              `Subscription created: ${metricLabel} ${subscriptionIntent.operator} ${subscriptionIntent.threshold}`,
              `Current value: ${currentValue}${initialState ? " (already matching)" : ""}`,
            ].join("\n"),
          );
          appendAuditEntry({
            type: "SUBSCRIPTION_CREATE",
            status: "SUCCESS",
            command: prompt,
            details: `${metricLabel} ${subscriptionIntent.operator} ${subscriptionIntent.threshold}`,
          });
        } catch (error) {
          appendMessage("assistant", toErrorMessage(error, "Failed to create subscription."));
          appendAuditEntry({
            type: "SUBSCRIPTION_CREATE",
            status: "FAILED",
            command: prompt,
            details: toErrorMessage(error, "Subscription create failed"),
          });
        } finally {
          setRunning(false);
        }
        return;
      }
    }

    if (isListWorkflowCommand(query)) {
      appendMessage("assistant", buildWorkflowsListReply(workflows));
      return;
    }

    const saveWorkflowIntent = parseSaveWorkflowCommand(prompt);
    if (saveWorkflowIntent) {
      const workflowName = String(saveWorkflowIntent.name || "").trim();
      if (!workflowName) {
        appendMessage("assistant", "Please provide workflow name. Example: save this as weekly review");
        return;
      }

      const commandToSave = saveWorkflowIntent.mode === "EXPLICIT"
        ? String(saveWorkflowIntent.prompt || "").trim()
        : String(lastActionablePromptRef.current || "").trim();

      if (!commandToSave) {
        appendMessage("assistant", "No previous command found to save. Run a command first, then use `save this as ...`.");
        return;
      }

      const normalizedKey = normalizeWorkflowName(workflowName);
      const nowIso = new Date().toISOString();
      setWorkflows((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const existingIndex = safePrev.findIndex((row) => row.key === normalizedKey);
        const nextRow = {
          name: workflowName,
          key: normalizedKey,
          prompt: commandToSave,
          createdAt: existingIndex >= 0 ? safePrev[existingIndex].createdAt || nowIso : nowIso,
          updatedAt: nowIso,
          lastRunAt: existingIndex >= 0 ? safePrev[existingIndex].lastRunAt || null : null,
          runCount: existingIndex >= 0 ? Number(safePrev[existingIndex].runCount || 0) : 0,
        };
        if (existingIndex >= 0) {
          const copy = [...safePrev];
          copy[existingIndex] = nextRow;
          return copy;
        }
        return [nextRow, ...safePrev].slice(0, MAX_STORED_WORKFLOWS);
      });
      appendMessage("assistant", `Workflow saved: ${workflowName}\nCommand: ${commandToSave}`);
      appendAuditEntry({
        type: "WORKFLOW_SAVE",
        status: "SUCCESS",
        command: prompt,
        details: workflowName,
      });
      return;
    }

    const isConfirmCommand = CONFIRM_INTENT_TERMS.some((term) => query === term);
    if (isConfirmCommand) {
      if (!pendingAction) {
        appendMessage("assistant", "No pending action to confirm.");
        return;
      }

      if (!MUTATION_ALLOWED_ROLES.has(actorRole)) {
        const roleLabel = ROLE_LABELS[actorRole] || actorRole;
        appendMessage(
          "assistant",
          `This action is restricted. ${roleLabel} cannot confirm approvals from console.`,
        );
        appendAuditEntry({
          type: pendingAction.kind,
          status: "BLOCKED",
          command: prompt,
          details: `Role ${actorRole} blocked from confirm`,
        });
        setPendingAction(null);
        return;
      }

      const actionToExecute = pendingAction;
      setRunning(true);
      try {
        const doneMessage = await executePendingAction(actionToExecute);
        setPendingAction(null);
        appendMessage("assistant", doneMessage);
        appendAuditEntry({
          type: actionToExecute.kind,
          status: "SUCCESS",
          command: prompt,
          details: doneMessage,
        });
      } catch (error) {
        const errorMessage = toErrorMessage(error, "Action execution failed");
        appendMessage("assistant", errorMessage);
        appendAuditEntry({
          type: actionToExecute?.kind || "ACTION_EXECUTION",
          status: "FAILED",
          command: prompt,
          details: errorMessage,
        });
      } finally {
        setRunning(false);
      }
      return;
    }

    const isCancelCommand = CANCEL_INTENT_TERMS.some((term) => query === term);
    if (isCancelCommand) {
      if (pendingAction) {
        const cancelledAction = pendingAction;
        setPendingAction(null);
        appendMessage("assistant", "Pending action cancelled.");
        appendAuditEntry({
          type: cancelledAction.kind,
          status: "CANCELLED",
          command: prompt,
          details: "User cancelled pending action",
        });
      } else {
        appendMessage("assistant", "No pending action to cancel.");
      }
      return;
    }

    const runWorkflowName = parseRunWorkflowCommand(prompt);
    if (runWorkflowName) {
      const workflow = findWorkflowByName(runWorkflowName);
      if (workflow) {
        setRunning(true);
        try {
          appendMessage("assistant", `Running workflow: ${workflow.name}\nCommand: ${workflow.prompt}`);
          await runSemanticPrompt(workflow.prompt, { trackPrompt: true });
          setWorkflows((prev) =>
            prev.map((row) => (
              row.key === workflow.key
                ? {
                  ...row,
                  lastRunAt: new Date().toISOString(),
                  runCount: Number(row.runCount || 0) + 1,
                  updatedAt: new Date().toISOString(),
                }
                : row
            )));
          appendAuditEntry({
            type: "WORKFLOW_RUN",
            status: "SUCCESS",
            command: prompt,
            details: workflow.name,
          });
        } catch (error) {
          const errorMessage = toErrorMessage(error, "Failed to run workflow");
          appendMessage("assistant", errorMessage);
          appendAuditEntry({
            type: "WORKFLOW_RUN",
            status: "FAILED",
            command: prompt,
            details: `${workflow.name}: ${errorMessage}`,
          });
        } finally {
          setRunning(false);
        }
        return;
      }

      if (query.startsWith("run workflow") || query.startsWith("execute workflow")) {
        appendMessage("assistant", `Workflow not found: ${runWorkflowName}`);
        return;
      }
    }

    setRunning(true);
    try {
      await runSemanticPrompt(prompt, { trackPrompt: true });
    } catch (error) {
      appendMessage("assistant", toErrorMessage(error, "Sorry, request failed."));
    } finally {
      setRunning(false);
    }
  }, [
    actorRole,
    appendAuditEntry,
    appendMessage,
    auditLog,
    executePendingAction,
    findWorkflowByName,
    loadSnapshot,
    pendingAction,
    runSemanticPrompt,
    subscriptions,
    workflows,
  ]);

  useEffect(() => {
    handleAskRef.current = handleAsk;
  }, [handleAsk]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleAsk(input);
  };

  return (
    <div className="px-3 pb-6 sm:px-6 lg:px-8">
      <section className="flex max-h-[calc(100dvh-210px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MessageSquare size={16} className="text-cyan-600" />
              Admin Assistant
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${snapshotLoaded ? "bg-emerald-500" : "bg-amber-500"}`} />
              {snapshotLoaded ? `Snapshot ${formatDateTime(snapshot.loadedAt)}` : "Snapshot loading..."}
              <button
                type="button"
                onClick={() => handleAsk("refresh")}
                disabled={running || loadingSnapshot}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={12} className={loadingSnapshot ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex flex-1 flex-col bg-slate-100/70">
          <div
            ref={chatRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 custom-scrollbar sm:px-4"
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap sm:max-w-[80%] ${
                      isUser
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      {isUser ? <UserCircle2 size={12} /> : <MessageSquare size={12} />}
                      {isUser ? "Admin" : "Assistant"}
                    </div>
                    <div>{message.text}</div>
                  </div>
                </div>
              );
            })}

            {running ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  Assistant is thinking...
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="space-y-1.5">
              <label className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
                <ChevronRight size={14} className="text-cyan-600" />
                <input
                  autoFocus
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Type or use mic (Hindi/English) for commands..."
                  disabled={running}
                  className="min-w-[180px] flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                  <Languages size={12} />
                  Speech
                </span>
                <select
                  value={speechLocale}
                  onChange={(event) => setSpeechLocale(event.target.value)}
                  className="h-8 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="hi-IN">Hindi</option>
                  <option value="en-IN">English</option>
                  <option value="en-US">English US</option>
                </select>
                <button
                  type="button"
                  onClick={toggleVoiceCapture}
                  disabled={running || !speechSupported}
                  className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isListening
                      ? "border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400"
                      : "border-cyan-300 bg-cyan-50 text-cyan-700 hover:border-cyan-400"
                  }`}
                >
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  {isListening ? "Stop" : "Mic"}
                </button>
                <button
                  type="submit"
                  disabled={running || !input.trim()}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </label>

              {isListening ? <p className="text-[11px] text-cyan-700">Listening... Hindi ya English me command boliye.</p> : null}
              {speechSupported ? null : <p className="text-[11px] text-amber-700">Voice input browser me available nahi hai. Chrome/Edge use karein.</p>}
              {speechError ? <p className="text-[11px] text-rose-700">{speechError}</p> : null}
            </div>
          </form>

          {pendingAction ? (
            <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Pending action ready. Type `confirm` / `cancel` or use buttons.
                </span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAsk("confirm")}
                    disabled={running}
                    className="h-7 rounded-md border border-emerald-300 bg-white px-2 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-400 disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAsk("cancel")}
                    disabled={running}
                    className="h-7 rounded-md border border-rose-300 bg-white px-2 text-[11px] font-semibold text-rose-700 transition hover:border-rose-400 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Try Asking</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleAsk(prompt)}
                disabled={running}
                className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMessages(initialMessages());
                setPendingAction(null);
              }}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-400"
            >
              Clear Chat
            </button>
          </div>
        </div>
      </section>

      {runtimeError ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {runtimeError}
        </div>
      ) : null}
    </div>
  );
};

export default AdminCommandConsole;
