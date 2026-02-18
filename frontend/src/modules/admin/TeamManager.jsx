import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, Users, UserCheck, X, Trash2 } from "lucide-react";
import {
  createUser,
  deleteUser,
  getUsers,
  rebalanceExecutives,
} from "../../services/userService";
import { getAllLeads } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";

const ROLE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Executive", value: "EXECUTIVE" },
  { label: "Field Executive", value: "FIELD_EXECUTIVE" },
  { label: "Channel Partner", value: "CHANNEL_PARTNER" },
];

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
};

const UserFormPanel = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  managers,
  submitting,
  error,
  isDarkTheme,
}) => {
  const needsManager = ["EXECUTIVE", "FIELD_EXECUTIVE"].includes(formData.role);

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
                  setFormData({ ...formData, role: e.target.value, managerId: "" })
                }
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>

              {needsManager && (
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
                >
                  <option value="">Auto assign manager (least-loaded)</option>
                  {managers.map((manager) => (
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

const TeamManager = ({ theme = "dark" }) => {
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
    managerId: "",
  });

  const currentRole = localStorage.getItem("role");
  const isAdmin = currentRole === "ADMIN";
  const isDarkTheme = theme === "dark";
  const currentUserId = JSON.parse(localStorage.getItem("user") || "{}")?.id;

  const managers = useMemo(
    () => users.filter((u) => u.role === "MANAGER" && u.isActive),
    [users],
  );

  const leadStats = useMemo(() => {
    const managerTeams = new Map();

    users.forEach((user) => {
      if (!EXECUTIVE_ROLES.includes(user.role)) return;

      const managerId = getEntityId(user.parentId);
      if (!managerId) return;

      const current = managerTeams.get(managerId) || [];
      current.push(String(user._id));
      managerTeams.set(managerId, current);
    });

    const statsByUserId = {};

    users.forEach((user) => {
      const userId = String(user._id);
      let relevantLeads = [];

      if (EXECUTIVE_ROLES.includes(user.role)) {
        relevantLeads = leads.filter(
          (lead) => getEntityId(lead.assignedTo) === userId,
        );
      } else if (user.role === "MANAGER") {
        const teamExecIds = managerTeams.get(userId) || [];
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
      managerId: "",
    });
    setFormError("");
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

      if (formData.managerId) {
        payload.managerId = formData.managerId;
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

  const getLeadScopeLabel = (role) => {
    if (role === "ADMIN") return "Global Leads";
    if (role === "MANAGER") return "Team Leads";
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

            return (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border p-4 ${
                isDarkTheme
                  ? "border-slate-700 bg-slate-900/80 shadow-[0_10px_30px_rgba(2,6,23,0.4)]"
                  : "border-slate-200 bg-white shadow-sm"
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
                    onClick={() => handleDeleteUser(user)}
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
                  <span>{user.role}</span>
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
        managers={managers}
        submitting={submitting}
        error={formError}
        isDarkTheme={isDarkTheme}
      />
    </div>
  );
};

export default TeamManager;
