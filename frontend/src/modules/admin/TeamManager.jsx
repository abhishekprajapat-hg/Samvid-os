import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  createUserDeleteRequest,
  createUser,
  deleteUser,
  getAdminUserDeleteRequests,
  getUsers,
  rebalanceExecutives,
  updateChannelPartnerInventoryAccess,
} from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";
import EmployeePageAccess from "./components/EmployeePageAccess";
import {
  UserFormPanel,
} from "./components/TeamManagerPanels";

const MANAGEMENT_ROLES = ["MANAGER"];
const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];
const REPORTING_PARENT_ROLES = {
  ADMIN: ["SUPER_ADMIN"],
  MANAGER: ["ADMIN"],
  EXECUTIVE: ["MANAGER"],
  FIELD_EXECUTIVE: ["MANAGER"],
  PRODUCTION_EXECUTIVE: ["MANAGER"],
  COMMUNITY_MANAGER: ["MANAGER"],
  CHANNEL_PARTNER: ["MANAGER"],
  COWORKING_ADMIN: ["ADMIN"],
};
const ROLE_LABELS = {
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
const DEFAULT_BROKERAGE_VALUE = 50000;
const ROLE_HIERARCHY = [
  { role: "SUPER_ADMIN", reportsTo: "Platform Owner", scope: "Platform controls" },
  { role: "ADMIN", reportsTo: "Super Admin", scope: "Tenant controls" },
  { role: "MANAGER", reportsTo: "Admin", scope: "Team and portfolio controls" },
  { role: "EXECUTIVE", reportsTo: "Manager", scope: "Assigned leads" },
  { role: "FIELD_EXECUTIVE", reportsTo: "Manager", scope: "Field visits" },
  { role: "PRODUCTION_EXECUTIVE", reportsTo: "Manager", scope: "Production tasks" },
  { role: "COMMUNITY_MANAGER", reportsTo: "Manager", scope: "Production tasks" },
  { role: "CHANNEL_PARTNER", reportsTo: "Manager", scope: "Partner-created leads" },
  { role: "COWORKING_ADMIN", reportsTo: "Admin", scope: "Coworking workspace controls" },
];

const normalizeBrokerageMode = (value) =>
  String(value || "").trim().toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FLAT";

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
};

const getUserInitials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    || "U";

const formatRoleType = (value) =>
  String(value || "").trim().toUpperCase() === "BOTH" ? "Both" :
  String(value || "").trim().toUpperCase() === "RESIDENTIAL"
    ? "Residential"
    : "Commercial";

const formatLastActive = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} min ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hour${diffMs >= 2 * hour ? "s" : ""} ago`;
  if (diffMs < 2 * day) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const getRolePillClass = (role) => {
  if (role === "EXECUTIVE") return "t-open";
  if (role === "FIELD_EXECUTIVE") return "t-sched";
  if (role === "PRODUCTION_EXECUTIVE" || role === "COMMUNITY_MANAGER") return "t-warm";
  if (role === "CHANNEL_PARTNER") return "t-party";
  if (role === "COWORKING_ADMIN") return "t-dead";
  if (role === "ADMIN" || role === "MANAGER") return "t-won";
  return "t-risk";
};


const TeamManager = ({ theme = "light" }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [accessEmployee, setAccessEmployee] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [inventoryAccessUpdatingUserId, setInventoryAccessUpdatingUserId] = useState("");
  const [deleteRequestsCount, setDeleteRequestsCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [roleTypeFilter, setRoleTypeFilter] = useState("ALL");
  const [reportingFilter, setReportingFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    roleType: "COMMERCIAL",
    password: "",
    role: "EXECUTIVE",
    reportingToId: "",
    canViewInventory: false,
    brokerageMode: "FLAT",
    brokerageValue: String(DEFAULT_BROKERAGE_VALUE),
    brokerageNotes: "",
  });
  const currentRole = localStorage.getItem("role");
  const isAdmin = currentRole === "ADMIN" || currentRole === "SUPER_ADMIN";
  const canUseAdminTools = isAdmin || currentRole === "MANAGER";
  const canViewTeamAccess = canUseAdminTools || MANAGEMENT_ROLES.includes(currentRole);
  const isDarkTheme = theme === "dark";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = currentUser?.id || currentUser?._id || "";

  const selectedBaseRole = formData.role;
  const roleOptions = Object.entries(ROLE_LABELS)
    .filter(([value]) => value !== "ADMIN")
    .map(([value, label]) => ({ value, label }));

  const reportingCandidates = useMemo(() => {
    const allowedParentRoles = REPORTING_PARENT_ROLES[selectedBaseRole] || [];
    if (!allowedParentRoles.length) return [];

    return users.filter(
      (user) =>
        user.isActive &&
        allowedParentRoles.includes(user.role),
    );
  }, [selectedBaseRole, users]);

  const reportingLabel = useMemo(() => {
    const allowedParentRoles = REPORTING_PARENT_ROLES[selectedBaseRole] || [];
    if (!allowedParentRoles.length) return "";
    return allowedParentRoles
      .map((role) => ROLE_LABELS[role] || role)
      .join(" / ");
  }, [selectedBaseRole]);

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

  const reportingFilterOptions = useMemo(() => {
    const parents = new Map();
    users.forEach((user) => {
      const parentId = getEntityId(user.parentId);
      if (!parentId) return;
      parents.set(parentId, user.parentId?.name || "Unknown");
    });

    return [
      { label: "All reporting", value: "ALL" },
      ...[...parents.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ label, value })),
    ];
  }, [users]);

  const normalizedSearchQuery = String(searchQuery || "").trim().toLowerCase();

  const activeUsersCount = useMemo(
    () => users.filter((user) => user?.isActive).length,
    [users],
  );

  const inactiveUsersCount = useMemo(
    () => users.filter((user) => !user?.isActive).length,
    [users],
  );

  const invitedUsersCount = useMemo(
    () => users.filter((user) => !user?.isActive && !user?.lastLoginAt).length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const statusMatch =
        statusFilter === "ALL"
        || (statusFilter === "ACTIVE" && user?.isActive)
        || (statusFilter === "INVITED" && !user?.isActive && !user?.lastLoginAt)
        || (statusFilter === "DISABLED" && !user?.isActive);
      const roleMatch =
        roleFilter === "ALL" || String(user.role || "").trim() === roleFilter;
      const roleTypeMatch =
        roleTypeFilter === "ALL"
        || String(user.roleType || "COMMERCIAL").trim().toUpperCase() === roleTypeFilter;
      const reportingMatch =
        reportingFilter === "ALL" || getEntityId(user.parentId) === reportingFilter;

      if (!statusMatch || !roleMatch || !roleTypeMatch || !reportingMatch) return false;
      if (!normalizedSearchQuery) return true;

      const searchableText = [
        user?.name,
        user?.email,
        user?.phone,
        user?.roleType === "BOTH" ? "Both" : user?.roleType === "RESIDENTIAL" ? "Residential" : "Commercial",
        user?.parentId?.name,
        user?.partnerCode,
        ROLE_LABELS[user?.role] || user?.role,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, reportingFilter, roleFilter, roleTypeFilter, statusFilter, users]);

  const hasActiveFilters =
    statusFilter !== "ACTIVE"
    || roleFilter !== "ALL"
    || roleTypeFilter !== "ALL"
    || reportingFilter !== "ALL"
    || Boolean(normalizedSearchQuery);

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const requestPromise = isAdmin
        ? getAdminUserDeleteRequests({ status: "PENDING" }).catch(() => [])
        : Promise.resolve([]);
      const [userData, leadData, deleteRequests] = await Promise.all([
        getUsers(),
        getAllLeads(),
        requestPromise,
      ]);
      setUsers(userData.users || []);
      setLeads(Array.isArray(leadData) ? leadData : []);
      setDeleteRequestsCount(Array.isArray(deleteRequests) ? deleteRequests.length : 0);
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
      roleType: "COMMERCIAL",
      password: "",
      role: "EXECUTIVE",
      reportingToId: "",
      canViewInventory: false,
      brokerageMode: "FLAT",
      brokerageValue: String(DEFAULT_BROKERAGE_VALUE),
      brokerageNotes: "",
    });
    setFormError("");
  };

  const handleOpenUserProfile = (userId) => {
    if (!canUseAdminTools) return;
    if (!userId) return;
    navigate(`/admin/users/${userId}`);
  };

  const handleCreateUser = async () => {
    if (!canUseAdminTools) return;

    if (!formData.name || !formData.email || !formData.password) {
      setFormError("Name, email and password are required.");
      return;
    }

    if (!formData.role) {
      setFormError("Select a role.");
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
        roleType: formData.roleType,
        role: formData.role,
      };

      if (selectedBaseRole === "CHANNEL_PARTNER") {
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
    if (!canUseAdminTools) return;
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
    if (!canUseAdminTools) return;
    if (String(user._id) === String(currentUserId)) return;

    const confirmed = window.confirm(
      isAdmin
        ? `Delete user "${user.name}" (${user.role})? This will unassign their leads.`
        : `Send delete request for "${user.name}" (${user.role}) to Admin?`,
    );
    if (!confirmed) return;

    try {
      setDeletingUserId(user._id);
      if (isAdmin) {
        await deleteUser(user._id);
        await loadData();
      } else {
        await createUserDeleteRequest(user._id, {
          reason: "Delete requested from team access workspace",
        });
        setError("Delete request sent to Admin for approval.");
      }
    } catch (err) {
      setError(toErrorMessage(err, isAdmin ? "Failed to delete user" : "Failed to send delete request"));
    } finally {
      setDeletingUserId("");
    }
  };

  const handleToggleChannelPartnerInventoryAccess = async (user) => {
    if (!canUseAdminTools || user?.role !== "CHANNEL_PARTNER") return;

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

  if (!canViewTeamAccess) {
    return (
      <div className={`ui-page-shell custom-scrollbar ${isDarkTheme ? "bg-slate-950/40" : "bg-slate-50/70"}`}>
        <div className={`rounded-xl border p-4 text-sm ${isDarkTheme ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
          Access denied. You do not have permission to view team access.
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page-shell team-doc-screen custom-scrollbar">
      <ToastNotice message={error} type="error" />

      <div className="team-toolbar">
        <div className="team-seg">
          <button
            type="button"
            className={statusFilter === "ACTIVE" ? "on" : ""}
            onClick={() => setStatusFilter("ACTIVE")}
          >
            Active <span className="team-muted">{activeUsersCount}</span>
          </button>
          <button
            type="button"
            className={statusFilter === "INVITED" ? "on" : ""}
            onClick={() => setStatusFilter("INVITED")}
          >
            Invited <span className="team-muted">{invitedUsersCount}</span>
          </button>
          <button
            type="button"
            className={statusFilter === "DISABLED" ? "on" : ""}
            onClick={() => setStatusFilter("DISABLED")}
          >
            Disabled <span className="team-muted">{inactiveUsersCount}</span>
          </button>
        </div>

        <label className="team-chip">
          <SlidersHorizontal size={13} />
          Role
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            {roleFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="team-chip">
          <SlidersHorizontal size={13} />
          Branch
          <select value={roleTypeFilter} onChange={(event) => setRoleTypeFilter(event.target.value)}>
            <option value="ALL">All branches</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="BOTH">Both</option>
          </select>
        </label>
        <label className="team-chip">
          <SlidersHorizontal size={13} />
          Reports to
          <select value={reportingFilter} onChange={(event) => setReportingFilter(event.target.value)}>
            {reportingFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="team-search">
          <Search size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, email, role..."
          />
        </label>

        {hasActiveFilters ? (
          <button
            type="button"
            className="team-btn team-btn-sec team-btn-sm"
            onClick={() => {
              setStatusFilter("ACTIVE");
              setRoleFilter("ALL");
              setRoleTypeFilter("ALL");
              setReportingFilter("ALL");
              setSearchQuery("");
            }}
          >
            <X size={13} />
            Clear
          </button>
        ) : null}

        {isAdmin ? (
          <button type="button" className="team-btn team-btn-sec team-btn-sm team-push">
            Delete requests
            <span className="team-pill t-warm">
              <i />
              {deleteRequestsCount}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRebalance}
            disabled={rebalancing}
            className="team-btn team-btn-sec team-btn-sm team-push"
          >
            <RefreshCw size={13} className={rebalancing ? "animate-spin" : ""} />
            Rebalance
          </button>
        )}

        {canUseAdminTools ? (
          <button type="button" onClick={() => setPanelOpen(true)} className="team-btn team-btn-pri team-btn-sm">
            <Plus size={13} />
            Add user
          </button>
        ) : null}
      </div>

      <div className="team-card">
        <div className="team-table-wrap">
          <table className="team-tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Reports to</th>
                <th>Branch</th>
                <th>Leads</th>
                <th>Last active</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="team-empty-row">Loading team...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="team-empty-row">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const userStats = leadStats[String(user._id)] || { total: 0, converted: 0 };
                  const isSelf = String(user._id) === String(currentUserId);
                  const cannotUseRoute = ![
                    "ADMIN",
                    "MANAGER",
                    "EXECUTIVE",
                    "FIELD_EXECUTIVE",
                    "PRODUCTION_EXECUTIVE",
                    "COMMUNITY_MANAGER",
                    "CHANNEL_PARTNER",
                    "COWORKING_ADMIN",
                  ].includes(user.role);

                  return (
                    <tr
                      key={user._id}
                      className={`${isSelf ? "is-self" : ""} ${canUseAdminTools ? "is-clickable" : ""}`.trim()}
                      onClick={() => handleOpenUserProfile(user._id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleOpenUserProfile(user._id);
                        }
                      }}
                      tabIndex={canUseAdminTools ? 0 : undefined}
                      role={canUseAdminTools ? "button" : undefined}
                      title={canUseAdminTools ? "Open user access profile" : undefined}
                    >
                      <td>
                        <div className="team-cellname">
                          <div className="team-avatar">{getUserInitials(user.name)}</div>
                          <div>
                            <b>{user.name || "-"}</b>
                            <small>{user.email || "-"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`team-pill ${cannotUseRoute ? "t-risk" : getRolePillClass(user.role)}`}>
                          {getRolePillClass(user.role) !== "t-party" ? <i /> : null}
                          {ROLE_LABELS[user.role] || user.role || "-"}
                        </span>
                      </td>
                      <td className="team-muted">{user.parentId?.name || "-"}</td>
                      <td className="team-muted">
                        {user.role === "CHANNEL_PARTNER" ? "External" : formatRoleType(user.roleType)}
                      </td>
                      <td className="team-num">{userStats.total}</td>
                      <td className="team-muted">{formatLastActive(user.lastLoginAt || user.updatedAt || user.createdAt)}</td>
                      <td>
                        <span className={`team-pill ${cannotUseRoute ? "t-risk" : user.isActive ? "t-won" : "t-risk"}`}>
                          <i />
                          {cannotUseRoute ? "Cannot log in" : user.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        <div className="team-rowacts">
                          {isAdmin && user.role !== "ADMIN" && <button type="button" className="team-mini-toggle" onClick={(event) => { event.stopPropagation(); setAccessEmployee(user); }} title={`Manage page access for ${user.name}`}>Page access</button>}
                          {canUseAdminTools ? (
                            <button
                              type="button"
                              className="team-iconbtn"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenUserProfile(user._id);
                              }}
                              title="Edit user"
                            >
                              <Edit2 size={13} />
                            </button>
                          ) : null}
                          {user.role === "CHANNEL_PARTNER" && canUseAdminTools ? (
                            <button
                              type="button"
                              className={`team-mini-toggle ${user.canViewInventory ? "on" : ""}`}
                              disabled={String(inventoryAccessUpdatingUserId) === String(user._id)}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleChannelPartnerInventoryAccess(user);
                              }}
                              title="Toggle inventory access"
                            >
                              Inv.
                            </button>
                          ) : null}
                          {canUseAdminTools ? (
                            <button
                              type="button"
                              className="team-iconbtn danger"
                              disabled={deletingUserId === user._id || isSelf}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteUser(user);
                              }}
                              title={isAdmin ? "Delete user" : "Request delete"}
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="team-notebox">
        <b>Flagged in this table:</b>
        <span>
          Accounts whose role is outside the route gates are shown as Cannot log in. Reporting To mirrors the hierarchy rules used by user creation and edit flows.
        </span>
      </div>

      {canUseAdminTools ? (
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
          roleOptions={roleOptions}
          selectedBaseRole={selectedBaseRole}
          reportingParentRoles={REPORTING_PARENT_ROLES}
        />
      ) : null}
      {accessEmployee && <EmployeePageAccess key={accessEmployee._id} user={accessEmployee} onClose={() => setAccessEmployee(null)} />}
    </div>
  );
};

export default TeamManager;
