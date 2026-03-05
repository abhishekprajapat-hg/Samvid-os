import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  UserCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets, getPendingInventoryRequests } from "../../services/inventoryService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const MAX_PREVIEW_ROWS = 6;
const MAX_BREAKDOWN_ROWS = 6;
const MAX_STORED_MESSAGES = 120;
const ASSISTANT_HISTORY_STORAGE_PREFIX = "samvid.adminAssistant.history";
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
  "le chalo",
  "jao",
];

const normalizeText = (value) => String(value || "").trim().toLowerCase();

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

const getHistoryStorageKey = () => {
  if (typeof window === "undefined") return `${ASSISTANT_HISTORY_STORAGE_PREFIX}.default`;

  try {
    const parsedUser = JSON.parse(window.localStorage.getItem("user") || "{}");
    const userId = String(
      parsedUser?._id
        || parsedUser?.id
        || parsedUser?.email
        || "default",
    ).trim();

    return `${ASSISTANT_HISTORY_STORAGE_PREFIX}.${userId || "default"}`;
  } catch {
    return `${ASSISTANT_HISTORY_STORAGE_PREFIX}.default`;
  }
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

const buildOverviewReply = (data) => {
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

const buildPendingRequestsReply = (data) => {
  const rows = data.pendingRequests || [];
  if (!rows.length) {
    return "No pending approval requests right now.";
  }

  const visible = rows.slice(0, MAX_PREVIEW_ROWS);
  const lines = [`Pending approval requests: ${rows.length}`];
  visible.forEach((row, index) => {
    const requestedBy = resolveUserName(row?.requestedBy);
    const type = String(row?.type || row?.requestType || "update").toUpperCase();
    lines.push(`${index + 1}. ${type} | ${requestedBy}`);
  });
  if (rows.length > MAX_PREVIEW_ROWS) {
    lines.push(`+ ${rows.length - MAX_PREVIEW_ROWS} more requests`);
  }

  return lines.join("\n");
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

const buildHelpReply = () =>
  [
    "I can help you with natural language prompts.",
    "Examples:",
    "- Give me full system overview",
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
    "Try one of these:",
    "- overview",
    "- how many deals are closed",
    "- show me closed deals",
    "- show blocked inventory in noida",
    "- show users active",
    "- pending requests",
    "- take me to alerts",
  ].join("\n");

const initialMessages = () => ([
  {
    id: 1,
    role: "assistant",
    text: "Admin assistant is ready. Ask for overview, users, leads, inventory, approvals, search, or navigation.",
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
  const historyStorageKey = useMemo(() => getHistoryStorageKey(), []);

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const [messages, setMessages] = useState(
    () => loadStoredMessages(historyStorageKey) || initialMessages(),
  );
  const [snapshot, setSnapshot] = useState({
    users: [],
    leads: [],
    inventory: [],
    pendingRequests: [],
    loadedAt: null,
  });

  const snapshotLoaded = useMemo(() => !!snapshot.loadedAt, [snapshot.loadedAt]);

  const appendMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
  }, []);

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

      const nextSnapshot = {
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

  const handleAsk = useCallback(async (rawInput) => {
    const prompt = String(rawInput || "").trim();
    if (!prompt) return;

    const query = normalizeText(prompt);
    appendMessage("user", prompt);
    setInput("");

    if (query === "clear" || query === "clear chat" || query === "reset chat") {
      setMessages(initialMessages());
      return;
    }

    if (
      query === "help"
      || includesAny(query, ["what can you do", "how to use", "commands", "options"])
    ) {
      appendMessage("assistant", buildHelpReply());
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
        appendMessage("assistant", `Opening ${navTarget.label}.`);
        navigate(navTarget.path);
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

      appendMessage("assistant", buildFallbackReply());
    } catch (error) {
      appendMessage("assistant", toErrorMessage(error, "Sorry, request failed."));
    } finally {
      setRunning(false);
    }
  }, [appendMessage, loadSnapshot, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleAsk(input);
  };

  return (
    <div className="px-3 pb-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

        <div className="bg-slate-100/70">
          <div
            ref={chatRef}
            className="h-[58vh] space-y-3 overflow-y-auto px-3 py-4 custom-scrollbar sm:h-[62vh] sm:px-4"
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
            <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
              <ChevronRight size={14} className="text-cyan-600" />
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask anything about users, leads, inventory, approvals, or navigation..."
                disabled={running}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={running || !input.trim()}
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
              </button>
            </label>
          </form>
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Try Asking</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleAsk(prompt)}
                disabled={running}
                className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMessages(initialMessages())}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-400"
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
