import React, { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createUser,
  deleteUser,
  getUsers,
  rebalanceExecutives,
  updateChannelPartnerInventoryAccess,
} from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  UserFormPanel,
} from "./components/TeamManagerPanels";
import {
  TeamLeadOverviewCards,
  TeamUserGrid,
} from "./components/TeamManagerCards";

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
const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT_MANAGER: "Assistant Manager",
  TEAM_LEADER: "Team Leader",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  CHANNEL_PARTNER: "Channel Partner",
};
const DEFAULT_BROKERAGE_VALUE = 50000;

const normalizeBrokerageMode = (value) =>
  String(value || "").trim().toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
};


const TeamManager = ({ theme = "light" }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [inventoryAccessUpdatingUserId, setInventoryAccessUpdatingUserId] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "MANAGER",
    reportingToId: "",
    canViewInventory: false,
    brokerageMode: "FLAT",
    brokerageValue: String(DEFAULT_BROKERAGE_VALUE),
    brokerageNotes: "",
  });

  const currentRole = localStorage.getItem("role");
  const isAdmin = currentRole === "ADMIN";
  const canViewTeamAccess = isAdmin || MANAGEMENT_ROLES.includes(currentRole);
  const isDarkTheme = theme === "dark";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = currentUser?.id || currentUser?._id || "";

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

  const roleFilterOptions = useMemo(() => {
    const visibleRoleSet = new Set(
      users
        .map((user) => String(user.role || "").trim())
        .filter(Boolean),
    );
    const orderedKnownRoles = Object.keys(ROLE_LABELS).filter((role) =>
      visibleRoleSet.has(role));
    const unknownRoles = [...visibleRoleSet]
      .filter((role) => !ROLE_LABELS[role])
      .sort();

    return [
      { label: "All Roles", value: "ALL" },
      ...orderedKnownRoles.map((role) => ({
        label: ROLE_LABELS[role] || role,
        value: role,
      })),
      ...unknownRoles.map((role) => ({
        label: role,
        value: role,
      })),
    ];
  }, [users]);

  const normalizedSearchQuery = String(searchQuery || "").trim().toLowerCase();

  const roleBreakdown = useMemo(() => {
    const breakdown = {};
    users.forEach((user) => {
      const role = String(user?.role || "").trim();
      if (!role) return;
      breakdown[role] = Number(breakdown[role] || 0) + 1;
    });
    return breakdown;
  }, [users]);

  const activeUsersCount = useMemo(
    () => users.filter((user) => user?.isActive).length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const roleMatch =
        roleFilter === "ALL" || String(user.role || "").trim() === roleFilter;

      if (!roleMatch) return false;
      if (!normalizedSearchQuery) return true;

      const searchableText = [
        user?.name,
        user?.email,
        user?.phone,
        user?.parentId?.name,
        user?.partnerCode,
        ROLE_LABELS[user?.role] || user?.role,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, roleFilter, users]);

  const hasActiveFilters =
    roleFilter !== "ALL" || Boolean(normalizedSearchQuery);

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

  useEffect(() => {
    if (roleFilter === "ALL") return;
    const hasFilterValue = roleFilterOptions.some((option) => option.value === roleFilter);
    if (!hasFilterValue) {
      setRoleFilter("ALL");
    }
  }, [roleFilter, roleFilterOptions]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "MANAGER",
      reportingToId: "",
      canViewInventory: false,
      brokerageMode: "FLAT",
      brokerageValue: String(DEFAULT_BROKERAGE_VALUE),
      brokerageNotes: "",
    });
    setFormError("");
  };

  const handleOpenUserProfile = (userId) => {
    if (!isAdmin) return;
    if (!userId) return;
    navigate(`/admin/users/${userId}`);
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

      if (formData.role === "CHANNEL_PARTNER") {
        const brokerageMode = normalizeBrokerageMode(formData.brokerageMode);
        const brokerageValue = Number(formData.brokerageValue);
        if (!Number.isFinite(brokerageValue) || brokerageValue < 0) {
          setFormError("Brokerage value must be 0 or more.");
          return;
        }
        if (brokerageMode === "PERCENTAGE" && brokerageValue > 100) {
          setFormError("Brokerage percentage cannot be more than 100.");
          return;
        }

        payload.canViewInventory = Boolean(formData.canViewInventory);
        payload.brokerageConfig = {
          mode: brokerageMode,
          value: brokerageValue,
          notes: String(formData.brokerageNotes || "").trim(),
        };
      }

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
      await loadData();
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete user"));
    } finally {
      setDeletingUserId("");
    }
  };

  const handleToggleChannelPartnerInventoryAccess = async (user) => {
    if (!isAdmin || user?.role !== "CHANNEL_PARTNER") return;

    try {
      setError("");
      setInventoryAccessUpdatingUserId(String(user._id));

      const updatedUser = await updateChannelPartnerInventoryAccess(
        user._id,
        !user.canViewInventory,
      );

      if (!updatedUser) {
        await loadData();
        return;
      }

      setUsers((prev) =>
        prev.map((row) =>
          String(row._id) === String(updatedUser._id)
            ? { ...row, ...updatedUser }
            : row,
        ),
      );

    } catch (err) {
      setError(toErrorMessage(err, "Failed to update channel partner inventory access"));
    } finally {
      setInventoryAccessUpdatingUserId("");
    }
  };

  const getLeadScopeLabel = (role) => {
    if (role === "ADMIN") return "Global Leads";
    if (MANAGEMENT_ROLES.includes(role)) return "Team Leads";
    if (EXECUTIVE_ROLES.includes(role)) return "Assigned Leads";
    return "Owned Leads";
  };

  if (!canViewTeamAccess) {
    return (
      <div className={`w-full h-full overflow-x-hidden px-4 sm:px-6 md:px-10 pt-4 md:pt-6 pb-8 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={`rounded-xl border p-4 text-sm ${isDarkTheme ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
          Access denied. You do not have permission to view team access.
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-x-hidden px-4 sm:px-6 md:px-10 pt-4 md:pt-6 pb-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar ${
      isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"
    }`}>
      <section className={`rounded-2xl border p-4 ${
        isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"
      }`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              isAdmin
                ? isDarkTheme
                  ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                  : "border-cyan-200 bg-cyan-50 text-cyan-700"
                : isDarkTheme
                  ? "border-slate-600 bg-slate-800/80 text-slate-200"
                  : "border-slate-300 bg-slate-100 text-slate-700"
            }`}>
              <Sparkles size={13} />
              {isAdmin ? "Admin Command Mode" : "Leadership View Mode"}
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${
              isDarkTheme ? "border-slate-700 bg-slate-950/70 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              Users: <span className="font-semibold">{users.length}</span>
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs ${
              isDarkTheme ? "border-slate-700 bg-slate-950/70 text-emerald-300" : "border-slate-200 bg-slate-50 text-emerald-700"
            }`}>
              Active: <span className="font-semibold">{activeUsersCount}</span>
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs ${
              isDarkTheme ? "border-slate-700 bg-slate-950/70 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              Leads: <span className="font-semibold">{globalStats.total}</span>
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs ${
              isDarkTheme ? "border-slate-700 bg-slate-950/70 text-cyan-300" : "border-slate-200 bg-slate-50 text-cyan-700"
            }`}>
              Closed: <span className="font-semibold">{globalStats.converted}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadData}
              className={`h-10 rounded-xl border px-4 text-sm font-semibold inline-flex items-center gap-2 ${
                isDarkTheme
                  ? "border-slate-700 text-slate-200 bg-slate-950/70 hover:border-cyan-300/45"
                  : "border-slate-300 text-slate-700 bg-white hover:border-cyan-300"
              }`}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            {isAdmin ? (
              <>
                <button
                  onClick={handleRebalance}
                  disabled={rebalancing}
                  className={`h-10 rounded-xl border px-4 text-sm font-semibold ${
                    isDarkTheme
                      ? "border-slate-700 text-slate-200 bg-slate-950/70 hover:border-cyan-300/45"
                      : "border-slate-300 text-slate-700 bg-white hover:border-cyan-300"
                  } disabled:opacity-60`}
                >
                  {rebalancing ? "Rebalancing..." : "Rebalance Executives"}
                </button>
                <button
                  onClick={() => setPanelOpen(true)}
                  className="h-10 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 inline-flex items-center gap-2"
                >
                  <Plus size={15} />
                  New User
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div className={`rounded-xl border p-3 text-sm ${
          isDarkTheme ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {error}
        </div>
      ) : null}

      <section className={`rounded-2xl border p-4 ${
        isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"
      }`}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_280px]">
          <label className={`relative block ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
            <Search size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
              isDarkTheme ? "text-slate-500" : "text-slate-400"
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, email, phone, partner code, manager or role..."
              className={`h-11 w-full rounded-xl border pl-9 pr-3 text-sm ${
                isDarkTheme
                  ? "border-slate-700 bg-slate-950 text-slate-200"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            />
          </label>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className={`h-11 w-full rounded-xl border px-3 text-sm ${
                isDarkTheme
                  ? "border-slate-700 bg-slate-950 text-slate-200"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {roleFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setRoleFilter("ALL");
                  setSearchQuery("");
                }}
                className={`h-11 rounded-xl border px-3 text-xs font-semibold ${
                  isDarkTheme
                    ? "border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-300/45"
                    : "border-slate-300 bg-white text-slate-700 hover:border-cyan-300"
                }`}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {roleFilterOptions
            .filter((option) => option.value !== "ALL")
            .map((option) => (
              <button
                key={`chip-${option.value}`}
                type="button"
                onClick={() => setRoleFilter(option.value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  roleFilter === option.value
                    ? isDarkTheme
                      ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                      : "border-cyan-200 bg-cyan-50 text-cyan-700"
                    : isDarkTheme
                      ? "border-slate-700 bg-slate-950/70 text-slate-300"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {option.label} ({Number(roleBreakdown[option.value] || 0)})
              </button>
            ))}
          <span className={`ml-auto text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Showing {filteredUsers.length} of {users.length} user(s)
          </span>
        </div>
      </section>

      <TeamLeadOverviewCards
        globalStats={globalStats}
        roleBreakdown={roleBreakdown}
        totalUsers={users.length}
        activeUsers={activeUsersCount}
        isDarkTheme={isDarkTheme}
      />

      <div className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        {isAdmin
          ? "Admin mode: full user controls and profile edit navigation are enabled."
          : "Leadership mode: view-only visibility for your hierarchy team details."}
      </div>

      <TeamUserGrid
        users={filteredUsers}
        loading={loading}
        leadStats={leadStats}
        isDarkTheme={isDarkTheme}
        deletingUserId={deletingUserId}
        currentUserId={currentUserId}
        roleLabels={ROLE_LABELS}
        canManageUsers={isAdmin}
        canOpenUserProfile={isAdmin}
        onOpenUserProfile={handleOpenUserProfile}
        onDeleteUser={handleDeleteUser}
        onToggleChannelPartnerInventoryAccess={handleToggleChannelPartnerInventoryAccess}
        inventoryAccessUpdatingUserId={inventoryAccessUpdatingUserId}
        getLeadScopeLabel={getLeadScopeLabel}
      />

      {isAdmin ? (
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
          roleOptions={ROLE_OPTIONS}
          reportingParentRoles={REPORTING_PARENT_ROLES}
        />
      ) : null}
    </div>
  );
};

export default TeamManager;

