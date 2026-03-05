import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import {
  createUser,
  deleteUser,
  getUserProfileById,
  getUsers,
  rebalanceExecutives,
  updateChannelPartnerInventoryAccess,
} from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import {
  UserFormPanel,
  UserProfilePanel,
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
const LEAD_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "REQUESTED", "CLOSED", "LOST"];
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
  REQUESTED: "Requested",
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
  const [inventoryAccessUpdatingUserId, setInventoryAccessUpdatingUserId] = useState("");
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

  const selectedSummaryCards = useMemo(
    () => toSummaryCards(selectedProfile?.role, selectedSummary || {}),
    [selectedProfile?.role, selectedSummary],
  );

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

      if (String(selectedUserId) === String(updatedUser._id)) {
        setSelectedProfile((prev) => (prev ? { ...prev, ...updatedUser } : prev));
      }
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

  if (!isAdmin) {
    return (
      <div className={`w-full h-full overflow-x-hidden px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={`rounded-xl border p-4 text-sm ${isDarkTheme ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
          Access denied. Only ADMIN can manage users.
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-x-hidden px-4 sm:px-6 md:px-10 pt-20 md:pt-24 pb-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
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

      <TeamLeadOverviewCards globalStats={globalStats} isDarkTheme={isDarkTheme} />

      <div className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        Click any user card to open full profile, performance and recent lead activity.
      </div>

      <TeamUserGrid
        users={users}
        loading={loading}
        leadStats={leadStats}
        isDarkTheme={isDarkTheme}
        profilePanelOpen={profilePanelOpen}
        selectedUserId={selectedUserId}
        deletingUserId={deletingUserId}
        currentUserId={currentUserId}
        roleLabels={ROLE_LABELS}
        onOpenUserProfile={handleOpenUserProfile}
        onDeleteUser={handleDeleteUser}
        onToggleChannelPartnerInventoryAccess={handleToggleChannelPartnerInventoryAccess}
        inventoryAccessUpdatingUserId={inventoryAccessUpdatingUserId}
        getLeadScopeLabel={getLeadScopeLabel}
      />

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

      <UserProfilePanel
        isOpen={profilePanelOpen}
        onClose={resetProfilePanel}
        loading={profileLoading}
        error={profileError}
        profile={selectedProfile}
        performance={selectedPerformance}
        summaryCards={selectedSummaryCards}
        isDarkTheme={isDarkTheme}
        roleLabels={ROLE_LABELS}
        statusLabels={STATUS_LABELS}
        leadStatuses={LEAD_STATUSES}
        formatDate={formatDate}
      />
    </div>
  );
};

export default TeamManager;

