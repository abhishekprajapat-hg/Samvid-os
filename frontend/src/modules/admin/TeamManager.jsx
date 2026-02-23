import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  CalendarClock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  createUser,
  deleteUser,
  getUserProfileById,
  getUsers,
  rebalanceExecutives,
} from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Assistant Manager", value: "ASSISTANT_MANAGER" },
  { label: "Team Leader", value: "TEAM_LEADER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
];

const MANAGEMENT_ROLES = ["MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"];
const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];
const REPORTING_PARENT_ROLES = {
  MANAGER: ["ADMIN"],
  ASSISTANT_MANAGER: ["MANAGER"],
  TEAM_LEADER: ["ASSISTANT_MANAGER"],
  EXECUTIVE: ["TEAM_LEADER"],
  FIELD_EXECUTIVE: ["TEAM_LEADER"],
  CHANNEL_PARTNER: ["ADMIN"],
};
const LEAD_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "CLOSED", "LOST"];
const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT_MANAGER: "Assistant Manager",
  TEAM_LEADER: "Team Leader",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
};
const STATUS_LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  SITE_VISIT: "Site Visit",
  CLOSED: "Closed",
  LOST: "Lost",
};

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toSummaryCards = (role, summary = {}) => {
  if (role === "ADMIN") {
    return [
      { key: "users", label: "Active Users", value: summary.users ?? 0 },
      { key: "managers", label: "Managers", value: summary.managers ?? 0 },
      {
        key: "assistantManagers",
        label: "Assistant Managers",
        value: summary.assistantManagers ?? 0,
      },
      { key: "teamLeaders", label: "Team Leaders", value: summary.teamLeaders ?? 0 },
      { key: "executives", label: "Executives", value: summary.executives ?? 0 },
      { key: "fieldExecutives", label: "Field Team", value: summary.fieldExecutives ?? 0 },
      { key: "leads", label: "Leads", value: summary.leads ?? 0 },
      { key: "inventory", label: "Inventory", value: summary.inventory ?? 0 },
    ];
  }

  if (MANAGEMENT_ROLES.includes(role)) {
    return [
      { key: "teamMembers", label: "Team Members", value: summary.teamMembers ?? 0 },
      {
        key: "assistantManagers",
        label: "Assistant Managers",
        value: summary.assistantManagers ?? 0,
      },
      { key: "teamLeaders", label: "Team Leaders", value: summary.teamLeaders ?? 0 },
      { key: "executives", label: "Executives", value: summary.executives ?? 0 },
      { key: "fieldExecutives", label: "Field Team", value: summary.fieldExecutives ?? 0 },
      { key: "teamLeads", label: "Team Leads", value: summary.teamLeads ?? 0 },
      { key: "dueFollowUpsToday", label: "Follow-ups Today", value: summary.dueFollowUpsToday ?? 0 },
    ];
  }

  if (role === "EXECUTIVE" || role === "FIELD_EXECUTIVE") {
    return [
      { key: "assignedLeads", label: "Assigned Leads", value: summary.assignedLeads ?? 0 },
      { key: "openLeads", label: "Open Leads", value: summary.openLeads ?? 0 },
      { key: "closedLeads", label: "Closed Leads", value: summary.closedLeads ?? 0 },
      { key: "dueFollowUpsToday", label: "Follow-ups Today", value: summary.dueFollowUpsToday ?? 0 },
    ];
  }

  if (role === "CHANNEL_PARTNER") {
    return [
      { key: "createdLeads", label: "Created Leads", value: summary.createdLeads ?? 0 },
      { key: "closedLeads", label: "Closed Leads", value: summary.closedLeads ?? 0 },
    ];
  }

  return [];
};

const UserFormPanel = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  reportingCandidates,
  reportingLabel,
  submitting,
  error,
  isDarkTheme,
}) => {
  const needsReporting = Boolean(REPORTING_PARENT_ROLES[formData.role]?.length);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/45 z-50 flex justify-end"
        >
          <motion.div
            initial={{ x: 500 }}
            animate={{ x: 0 }}
            exit={{ x: 500 }}
            className={`h-full w-full max-w-md border-l shadow-2xl p-6 flex flex-col gap-4 ${
              isDarkTheme
                ? "bg-slate-950 border-slate-700"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-800"}`}>
                Create User
              </h2>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg ${isDarkTheme ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100"}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />
              <input
                type="text"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />

              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value, reportingToId: "" })
                }
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>

              {needsReporting && (
                <select
                  value={formData.reportingToId}
                  onChange={(e) => setFormData({ ...formData, reportingToId: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
                >
                  <option value="">
                    Auto assign {reportingLabel || "reporting manager"} (least-loaded)
                  </option>
                  {reportingCandidates.map((manager) => (
                    <option key={manager._id} value={manager._id}>
                      {manager.name} ({manager.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <button
              onClick={onSubmit}
              disabled={submitting}
              className="mt-auto w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create User"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const UserProfilePanel = ({
  isOpen,
  onClose,
  loading,
  error,
  profile,
  summary,
  performance,
  isDarkTheme,
}) => {
  const summaryCards = toSummaryCards(profile?.role, summary || {});
  const statusBreakdown = performance?.statusBreakdown || {};
  const recentLeads = Array.isArray(performance?.recentLeads)
    ? performance.recentLeads
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/45 z-50 flex justify-end"
        >
          <motion.div
            initial={{ x: 600 }}
            animate={{ x: 0 }}
            exit={{ x: 600 }}
            className={`h-full w-full max-w-2xl border-l shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto ${
              isDarkTheme
                ? "bg-slate-950 border-slate-700"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-800"}`}>
                  User Profile
                </h2>
                {profile?.name && (
                  <p className={`text-xs mt-1 ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    {profile.name}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg ${isDarkTheme ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100"}`}
              >
                <X size={18} />
              </button>
            </div>

            {loading ? (
              <div className={`h-52 rounded-xl border flex items-center justify-center gap-2 text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900/80 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                <Loader2 size={16} className="animate-spin" />
                Loading profile...
              </div>
            ) : error ? (
              <div className={`rounded-xl border p-3 text-sm ${isDarkTheme ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
                {error}
              </div>
            ) : !profile ? (
              <div className={`h-52 rounded-xl border flex items-center justify-center text-sm ${isDarkTheme ? "border-slate-700 bg-slate-900/80 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                Profile data not available.
              </div>
            ) : (
              <>
                <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                      {profile.name || "-"}
                    </span>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                      profile.isActive
                        ? "bg-emerald-200 text-emerald-800"
                        : isDarkTheme
                          ? "bg-slate-700 text-slate-200"
                          : "bg-slate-100 text-slate-500"
                    }`}>
                      {profile.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${isDarkTheme ? "bg-cyan-500/20 text-cyan-200" : "bg-cyan-100 text-cyan-700"}`}>
                      {ROLE_LABELS[profile.role] || profile.role || "-"}
                    </span>
                  </div>

                  <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                    <div className="flex items-center gap-2">
                      <Mail size={13} />
                      <span>{profile.email || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={13} />
                      <span>{profile.phone || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} />
                      <span>Manager: {profile.manager?.name || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={13} />
                      <span>
                        Location:{" "}
                        {profile.liveLocation?.lat != null && profile.liveLocation?.lng != null
                          ? `${profile.liveLocation.lat}, ${profile.liveLocation.lng}`
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
                  <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Account Metadata
                  </div>
                  <div className={`mt-2 space-y-1 text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                    <div>Company Id: {String(profile.companyId || "-")}</div>
                    <div>Created: {formatDate(profile.createdAt)}</div>
                    <div>Updated: {formatDate(profile.updatedAt)}</div>
                    <div>Last Assigned: {formatDate(profile.lastAssignedAt)}</div>
                    <div>Live Location Updated: {formatDate(profile.liveLocation?.updatedAt)}</div>
                  </div>
                </div>

                {summaryCards.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {summaryCards.map((card) => (
                      <div
                        key={card.key}
                        className={`rounded-xl border px-3 py-3 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                          {card.label}
                        </div>
                        <div className={`mt-1 text-lg font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {card.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
                  <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Performance Snapshot
                  </div>
                  <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-2">
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Scope
                      </div>
                      <div className={`text-xs font-semibold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {performance?.leadScope || "-"}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Total Leads
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {performance?.totalLeads ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Closed
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-emerald-300" : "text-emerald-700"}`}>
                        {performance?.closedLeads ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Conversion
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-cyan-300" : "text-cyan-700"}`}>
                        {performance?.conversionRate ?? 0}%
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Direct Reports
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {performance?.directReports ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 lg:grid-cols-5 gap-2">
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Follow-ups Today
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-amber-300" : "text-amber-700"}`}>
                        {performance?.dueFollowUpsToday ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Overdue
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-red-300" : "text-red-700"}`}>
                        {performance?.overdueFollowUps ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Site Visits
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {performance?.siteVisits ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Activities
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {performance?.activitiesPerformed ?? 0}
                      </div>
                    </div>
                    <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                        Diary Notes
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {performance?.diaryEntriesCreated ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
                  <div className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    <CalendarClock size={12} />
                    Lead Status Breakdown
                  </div>
                  <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {LEAD_STATUSES.map((status) => (
                      <div
                        key={status}
                        className={`rounded-lg border px-3 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                          {STATUS_LABELS[status] || status}
                        </div>
                        <div className={`text-base font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {statusBreakdown[status] ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
                  <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Recent Leads
                  </div>
                  {recentLeads.length === 0 ? (
                    <div className={`mt-2 text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                      No recent leads in this scope.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {recentLeads.map((lead) => (
                        <div
                          key={lead._id}
                          className={`rounded-lg border px-3 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}
                        >
                          <div className={`text-xs font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            {lead.name || "-"} ({lead.phone || "-"})
                          </div>
                          <div className={`mt-1 text-[11px] ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                            Status: {STATUS_LABELS[lead.status] || lead.status || "-"}
                          </div>
                          <div className={`text-[11px] ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                            Updated: {formatDate(lead.updatedAt)}
                          </div>
                          <div className={`text-[11px] ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                            Next Follow-up: {formatDate(lead.nextFollowUp)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TeamManager = ({ theme = "light" }) => {
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "MANAGER",
    reportingToId: "",
  });
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState({});
  const [selectedPerformance, setSelectedPerformance] = useState({});
  const profileRequestRef = useRef(0);

  const currentRole = localStorage.getItem("role");
  const isAdmin = currentRole === "ADMIN";
  const isDarkTheme = theme === "dark";
  const currentUserId = JSON.parse(localStorage.getItem("user") || "{}")?.id;

  const reportingCandidates = useMemo(() => {
    const allowedParentRoles = REPORTING_PARENT_ROLES[formData.role] || [];
    if (!allowedParentRoles.length) return [];

    return users.filter(
      (user) =>
        user.isActive &&
        allowedParentRoles.includes(user.role),
    );
  }, [formData.role, users]);

  const reportingLabel = useMemo(() => {
    const allowedParentRoles = REPORTING_PARENT_ROLES[formData.role] || [];
    if (!allowedParentRoles.length) return "";
    return allowedParentRoles
      .map((role) => ROLE_LABELS[role] || role)
      .join(" / ");
  }, [formData.role]);

  const leadStats = useMemo(() => {
    const childrenByParent = new Map();
    users.forEach((user) => {
      const parentId = getEntityId(user.parentId);
      if (!parentId) return;

      const current = childrenByParent.get(parentId) || [];
      current.push(user);
      childrenByParent.set(parentId, current);
    });

    const executiveIdsByLeader = new Map();
    const getExecutiveIdsForLeader = (leaderId) => {
      if (!leaderId) return [];
      if (executiveIdsByLeader.has(leaderId)) {
        return executiveIdsByLeader.get(leaderId);
      }

      const queue = [leaderId];
      const visited = new Set();
      const executiveIds = [];

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId || visited.has(currentId)) continue;
        visited.add(currentId);

        const children = childrenByParent.get(currentId) || [];
        children.forEach((child) => {
          const childId = String(child._id);
          if (EXECUTIVE_ROLES.includes(child.role)) {
            executiveIds.push(childId);
            return;
          }

          if (MANAGEMENT_ROLES.includes(child.role)) {
            queue.push(childId);
          }
        });
      }

      executiveIdsByLeader.set(leaderId, executiveIds);
      return executiveIds;
    };

    const statsByUserId = {};

    users.forEach((user) => {
      const userId = String(user._id);
      let relevantLeads = [];

      if (EXECUTIVE_ROLES.includes(user.role)) {
        relevantLeads = leads.filter(
          (lead) => getEntityId(lead.assignedTo) === userId,
        );
      } else if (MANAGEMENT_ROLES.includes(user.role)) {
        const teamExecIds = getExecutiveIdsForLeader(userId);
        relevantLeads = leads.filter((lead) =>
          teamExecIds.includes(getEntityId(lead.assignedTo)),
        );
      } else if (user.role === "ADMIN") {
        relevantLeads = leads;
      } else {
        relevantLeads = leads.filter(
          (lead) => getEntityId(lead.createdBy) === userId,
        );
      }

      const converted = relevantLeads.filter(
        (lead) => lead.status === "CLOSED",
      ).length;

      statsByUserId[userId] = {
        total: relevantLeads.length,
        converted,
      };
    });

    return statsByUserId;
  }, [users, leads]);

  const globalStats = useMemo(() => {
    const converted = leads.filter((lead) => lead.status === "CLOSED").length;
    const unassigned = leads.filter((lead) => !getEntityId(lead.assignedTo)).length;

    return {
      total: leads.length,
      converted,
      unassigned,
    };
  }, [leads]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [userData, leadData] = await Promise.all([getUsers(), getAllLeads()]);
      setUsers(userData.users || []);
      setLeads(Array.isArray(leadData) ? leadData : []);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "MANAGER",
      reportingToId: "",
    });
    setFormError("");
  };

  const resetProfilePanel = () => {
    profileRequestRef.current += 1;
    setProfilePanelOpen(false);
    setSelectedUserId("");
    setProfileLoading(false);
    setProfileError("");
    setSelectedProfile(null);
    setSelectedSummary({});
    setSelectedPerformance({});
  };

  const handleOpenUserProfile = async (userId) => {
    if (!userId) return;

    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    setSelectedUserId(String(userId));
    setProfilePanelOpen(true);
    setProfileLoading(true);
    setProfileError("");
    setSelectedProfile(null);
    setSelectedSummary({});
    setSelectedPerformance({});

    try {
      const response = await getUserProfileById(userId);
      if (profileRequestRef.current !== requestId) return;

      setSelectedProfile(response.profile || null);
      setSelectedSummary(response.summary || {});
      setSelectedPerformance(response.performance || {});
    } catch (err) {
      if (profileRequestRef.current !== requestId) return;
      setProfileError(toErrorMessage(err, "Failed to load user profile"));
    } finally {
      if (profileRequestRef.current === requestId) {
        setProfileLoading(false);
      }
    }
  };

  const handleCreateUser = async () => {
    if (!isAdmin) return;

    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      setFormError("Name, email, password and role are required.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        role: formData.role,
      };

      if (formData.reportingToId) {
        payload.reportingToId = formData.reportingToId;
      }

      await createUser(payload);
      setPanelOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      setFormError(toErrorMessage(err, "Failed to create user"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRebalance = async () => {
    if (!isAdmin) return;
    try {
      setRebalancing(true);
      await rebalanceExecutives();
      await loadData();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to rebalance executives"));
    } finally {
      setRebalancing(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!isAdmin) return;
    if (String(user._id) === String(currentUserId)) return;

    const confirmed = window.confirm(
      `Delete user "${user.name}" (${user.role})? This will unassign their leads.`,
    );
    if (!confirmed) return;

    try {
      setDeletingUserId(user._id);
      await deleteUser(user._id);
      if (String(selectedUserId) === String(user._id)) {
        resetProfilePanel();
      }
      await loadData();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete user"));
    } finally {
      setDeletingUserId("");
    }
  };

  const getLeadScopeLabel = (role) => {
    if (role === "ADMIN") return "Global Leads";
    if (MANAGEMENT_ROLES.includes(role)) return "Team Leads";
    if (EXECUTIVE_ROLES.includes(role)) return "Assigned Leads";
    return "Owned Leads";
  };

  if (!isAdmin) {
    return (
      <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={`rounded-xl border p-4 text-sm ${isDarkTheme ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
          Access denied. Only ADMIN can manage users.
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 flex flex-col gap-6 overflow-y-auto ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>Team Access</h1>
          <p className={`text-xs uppercase tracking-widest mt-1 ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Total Users: {users.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
              isDarkTheme
                ? "border-slate-700 text-slate-200 bg-slate-900/60"
                : "border-slate-300 text-slate-700 bg-white"
            }`}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={handleRebalance}
            disabled={rebalancing}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
              isDarkTheme
                ? "border-slate-700 text-slate-200 bg-slate-900/60"
                : "border-slate-300 text-slate-700 bg-white"
            }`}
          >
            {rebalancing ? "Rebalancing..." : "Rebalance Executives"}
          </button>
          <button
            onClick={() => setPanelOpen(true)}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold flex items-center gap-2"
          >
            <Plus size={15} />
            New User
          </button>
        </div>
      </div>

      {error && (
        <div className={`rounded-xl border p-3 text-sm ${isDarkTheme ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"}`}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
          <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Total Leads</div>
          <div className={`mt-2 text-2xl font-display ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{globalStats.total}</div>
        </div>
        <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
          <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Converted Leads</div>
          <div className={`mt-2 text-2xl font-display ${isDarkTheme ? "text-emerald-300" : "text-emerald-700"}`}>{globalStats.converted}</div>
        </div>
        <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
          <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Unassigned Leads</div>
          <div className={`mt-2 text-2xl font-display ${isDarkTheme ? "text-amber-300" : "text-amber-700"}`}>{globalStats.unassigned}</div>
        </div>
      </div>

      <div className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        Click any user card to open full profile, performance and recent lead activity.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
        {loading ? (
          <div className={`text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Loading users...</div>
        ) : users.length === 0 ? (
          <div className={`text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>No users found.</div>
        ) : (
          users.map((user) => {
            const userStats = leadStats[String(user._id)] || { total: 0, converted: 0 };
            const conversionRate = userStats.total
              ? Math.round((userStats.converted / userStats.total) * 100)
              : 0;
            const isSelected =
              profilePanelOpen && String(selectedUserId) === String(user._id);

            return (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenUserProfile(user._id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenUserProfile(user._id);
                }
              }}
              className={`rounded-xl border p-4 ${
                isDarkTheme
                  ? "border-slate-700 bg-slate-900/80 shadow-[0_10px_30px_rgba(2,6,23,0.4)]"
                  : "border-slate-200 bg-white shadow-sm"
              } ${
                isSelected
                  ? isDarkTheme
                    ? "ring-2 ring-cyan-400/70 border-cyan-400/60"
                    : "ring-2 ring-cyan-500/40 border-cyan-400"
                  : ""
              } ${
                isDarkTheme
                  ? "hover:border-slate-500 cursor-pointer"
                  : "hover:border-slate-300 cursor-pointer"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{user.name}</div>
                  <div className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                      user.isActive
                        ? "bg-emerald-200 text-emerald-800"
                        : isDarkTheme
                          ? "bg-slate-700 text-slate-200"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {user.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteUser(user);
                    }}
                    disabled={
                      deletingUserId === user._id || String(user._id) === String(currentUserId)
                    }
                    className={`p-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDarkTheme
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                    title={
                      String(user._id) === String(currentUserId)
                        ? "You cannot delete your own account"
                        : "Delete user"
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className={`mt-4 space-y-1 text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                <div className="flex items-center gap-2">
                  <Users size={13} />
                  <span>{ROLE_LABELS[user.role] || user.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck size={13} />
                  <span>
                    Manager: {user.parentId?.name || "-"}
                  </span>
                </div>
                <div>Phone: {user.phone || "-"}</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                  <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    {getLeadScopeLabel(user.role)}
                  </div>
                  <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                    {userStats.total}
                  </div>
                </div>
                <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                  <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Converted
                  </div>
                  <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-emerald-300" : "text-emerald-700"}`}>
                    {userStats.converted}
                  </div>
                </div>
                <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                  <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Conv. Rate
                  </div>
                  <div className={`text-sm font-bold mt-1 ${isDarkTheme ? "text-cyan-300" : "text-cyan-700"}`}>
                    {conversionRate}%
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })
        )}
      </div>

      <UserFormPanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          resetForm();
        }}
        onSubmit={handleCreateUser}
        formData={formData}
        setFormData={setFormData}
        reportingCandidates={reportingCandidates}
        reportingLabel={reportingLabel}
        submitting={submitting}
        error={formError}
        isDarkTheme={isDarkTheme}
      />

      <UserProfilePanel
        isOpen={profilePanelOpen}
        onClose={resetProfilePanel}
        loading={profileLoading}
        error={profileError}
        profile={selectedProfile}
        summary={selectedSummary}
        performance={selectedPerformance}
        isDarkTheme={isDarkTheme}
      />
    </div>
  );
};

export default TeamManager;
