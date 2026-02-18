import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Phone,
  Mail,
  User,
  X,
  Loader,
  Search,
  RefreshCw,
  CalendarClock,
  CheckCircle2,
  History,
  Save,
  ArrowUpRight,
} from "lucide-react";
import {
  getAllLeads,
  createLead,
  updateLeadStatus,
  assignLead,
  getLeadActivity,
} from "../../services/leadService";
import { getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "SITE_VISIT",
  "CLOSED",
  "LOST",
];

const EXECUTIVE_ROLES = ["EXECUTIVE", "FIELD_EXECUTIVE"];

const defaultFormData = {
  name: "",
  phone: "",
  email: "",
  city: "",
  projectInterested: "",
};

const getStatusColor = (status) => {
  switch (status) {
    case "NEW":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "CONTACTED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "INTERESTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "SITE_VISIT":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "CLOSED":
      return "bg-slate-900 text-white border-slate-900";
    case "LOST":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const toDateTimeInput = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

const LeadsMatrix = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedLead, setSelectedLead] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [executiveDraft, setExecutiveDraft] = useState("");

  const [executives, setExecutives] = useState([]);

  const userRole = localStorage.getItem("role") || "";
  const canAddLead = userRole === "ADMIN" || userRole === "MANAGER";
  const canAssignLead = userRole === "ADMIN" || userRole === "MANAGER";

  const fetchLeads = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const list = await getAllLeads();
      setLeads(Array.isArray(list) ? list : []);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load leads");
      console.error(`Load leads failed: ${message}`);
      setError(message);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchExecutives = useCallback(async () => {
    if (!canAssignLead) return;

    try {
      const response = await getUsers();
      const users = response?.users || [];
      const list = users.filter(
        (user) => user.isActive && EXECUTIVE_ROLES.includes(user.role),
      );
      setExecutives(list);
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load executives");
      console.error(`Load executives failed: ${message}`);
      setExecutives([]);
    }
  }, [canAssignLead]);

  useEffect(() => {
    fetchLeads();
    fetchExecutives();
  }, [fetchLeads, fetchExecutives]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 1600);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const leadRowClass = isDark
    ? "w-full text-left grid grid-cols-12 gap-4 p-4 rounded-xl border border-slate-700/60 hover:border-cyan-300/35 hover:bg-slate-800/70 items-center transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
    : "w-full text-left grid grid-cols-12 gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 items-center transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300";

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return leads.filter((lead) => {
      const statusMatch = statusFilter === "ALL" || lead.status === statusFilter;

      const searchMatch =
        !normalized ||
        [lead.name, lead.phone, lead.email, lead.city, lead.projectInterested]
          .map((value) => String(value || "").toLowerCase())
          .some((value) => value.includes(normalized));

      return statusMatch && searchMatch;
    });
  }, [leads, query, statusFilter]);

  const metrics = useMemo(() => {
    const closed = leads.filter((lead) => lead.status === "CLOSED").length;
    const interested = leads.filter((lead) => lead.status === "INTERESTED").length;
    const fresh = leads.filter((lead) => lead.status === "NEW").length;
    const dueFollowUps = leads.filter((lead) => {
      if (!lead.nextFollowUp) return false;
      return new Date(lead.nextFollowUp) <= new Date();
    }).length;

    return {
      total: leads.length,
      new: fresh,
      interested,
      closed,
      dueFollowUps,
    };
  }, [leads]);

  const openLeadDetails = async (lead) => {
    setSelectedLead(lead);
    setStatusDraft(lead.status || "NEW");
    setFollowUpDraft(toDateTimeInput(lead.nextFollowUp));
    setExecutiveDraft(
      typeof lead.assignedTo === "string"
        ? lead.assignedTo
        : lead.assignedTo?._id || "",
    );
    setIsDetailsOpen(true);

    try {
      setActivityLoading(true);
      const timeline = await getLeadActivity(lead._id);
      setActivities(Array.isArray(timeline) ? timeline : []);
    } catch (activityError) {
      const message = toErrorMessage(activityError, "Failed to load activity");
      console.error(`Load lead activity failed: ${message}`);
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedLead(null);
    setActivities([]);
  };

  const handleSaveLead = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    try {
      setSavingLead(true);
      setError("");

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        city: formData.city.trim(),
        projectInterested: formData.projectInterested.trim(),
      };

      const created = await createLead(payload);

      if (created) {
        setLeads((prev) => [created, ...prev]);
      } else {
        await fetchLeads(true);
      }

      setIsAddModalOpen(false);
      setFormData(defaultFormData);
      setSuccess("Lead created successfully");
    } catch (saveError) {
      const message = toErrorMessage(saveError, "Failed to save lead");
      console.error(`Create lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingLead(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    try {
      setSavingUpdates(true);
      setError("");

      const payload = {
        status: statusDraft,
      };

      if (followUpDraft) {
        payload.nextFollowUp = followUpDraft;
      }

      const updatedLead = await updateLeadStatus(selectedLead._id, payload);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead updated");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
      );
      setSelectedLead(updatedLead);
      setSuccess("Lead updated");
    } catch (updateError) {
      const message = toErrorMessage(updateError, "Failed to update lead");
      console.error(`Update lead failed: ${message}`);
      setError(message);
    } finally {
      setSavingUpdates(false);
    }
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !executiveDraft) return;

    try {
      setAssigning(true);
      setError("");

      const updatedLead = await assignLead(selectedLead._id, executiveDraft);

      if (!updatedLead) {
        await fetchLeads(true);
        setSuccess("Lead assigned");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead)),
      );
      setSelectedLead(updatedLead);
      setSuccess("Lead assigned");
    } catch (assignError) {
      const message = toErrorMessage(assignError, "Failed to assign lead");
      console.error(`Assign lead failed: ${message}`);
      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-6 flex flex-col bg-slate-50/50 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-slate-900 tracking-tight">
            Lead Matrix
          </h1>
          <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">
            Click any lead to open full detail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads(true)}
            className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold uppercase tracking-wide flex items-center gap-2"
          >
            {refreshing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>

          {canAddLead && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-emerald-600"
            >
              <Plus size={15} /> Add Lead
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2 mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total</div>
          <div className="text-2xl font-display text-slate-900 mt-1">{metrics.total}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">New</div>
          <div className="text-2xl font-display text-blue-700 mt-1">{metrics.new}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Interested</div>
          <div className="text-2xl font-display text-emerald-700 mt-1">{metrics.interested}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Closed</div>
          <div className="text-2xl font-display text-slate-900 mt-1">{metrics.closed}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Due Followups</div>
          <div className="text-2xl font-display text-amber-700 mt-1">{metrics.dueFollowUps}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email, city"
            className="h-10 w-full pl-9 pr-3 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
        >
          <option value="ALL">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[420px]">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-3">Client</div>
              <div className="col-span-3">Contact</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Next Follow-up</div>
              <div className="col-span-2">Action</div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
                  <Loader className="animate-spin" size={20} /> Loading leads...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <User size={42} className="mb-3 opacity-30" />
                  <p>No leads found for current filters</p>
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <motion.button
                    type="button"
                    key={lead._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => openLeadDetails(lead)}
                    className={leadRowClass}
                  >
                    <div className="col-span-3 font-bold text-slate-800">
                      {lead.name}
                      <div className="text-xs text-slate-400 mt-1">{lead.city || "-"}</div>
                    </div>

                    <div className="col-span-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone size={12} /> {lead.phone}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Mail size={12} /> {lead.email || "-"}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span className={`px-2 py-1 text-xs font-bold border rounded ${getStatusColor(lead.status)}`}>
                        {lead.status || "-"}
                      </span>
                    </div>

                    <div className="col-span-2 text-sm text-slate-600">
                      {formatDate(lead.nextFollowUp)}
                    </div>

                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Open <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && canAddLead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="bg-white w-full max-w-md rounded-2xl border shadow-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-slate-900">Add New Lead</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                {[
                  ["name", "Name"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["city", "City"],
                  ["projectInterested", "Project Interested"],
                ].map(([field, label]) => (
                  <input
                    key={field}
                    placeholder={label}
                    value={formData[field]}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLead}
                  disabled={savingLead}
                  className="flex-1 h-10 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-60"
                >
                  {savingLead ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsOpen && selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetails}
              className="fixed inset-0 z-50 bg-slate-900/45"
            />

            <motion.aside
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white border-l border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Lead Details</div>
                  <div className="text-[11px] text-slate-500">{selectedLead.name}</div>
                </div>
                <button onClick={closeDetails} className="p-1 rounded hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Contact</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <div className="flex items-center gap-2"><Phone size={13} /> {selectedLead.phone || "-"}</div>
                    <div className="flex items-center gap-2"><Mail size={13} /> {selectedLead.email || "-"}</div>
                    <div className="flex items-center gap-2"><User size={13} /> {selectedLead.city || "-"}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Lead Controls</div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</label>
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    >
                      {LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                      <CalendarClock size={12} /> Next Follow-up
                    </label>
                    <input
                      type="datetime-local"
                      value={followUpDraft}
                      onChange={(e) => setFollowUpDraft(e.target.value)}
                      className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </div>

                  <button
                    onClick={handleUpdateLead}
                    disabled={savingUpdates}
                    className="w-full h-10 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {savingUpdates ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Lead Update
                  </button>
                </div>

                {canAssignLead && (
                  <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Assignment</div>

                    <select
                      value={executiveDraft}
                      onChange={(e) => setExecutiveDraft(e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    >
                      <option value="">Select executive</option>
                      {executives.map((executive) => (
                        <option key={executive._id} value={executive._id}>
                          {executive.name} ({executive.role})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAssignLead}
                      disabled={!executiveDraft || assigning}
                      className="w-full h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-60"
                    >
                      {assigning ? "Assigning..." : "Assign Lead"}
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1 mb-2">
                    <History size={12} /> Activity Timeline
                  </div>

                  {activityLoading ? (
                    <div className="h-24 flex items-center justify-center text-slate-400 text-sm gap-2">
                      <Loader size={14} className="animate-spin" /> Loading timeline...
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-sm text-slate-500">No activity yet</div>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((activity) => (
                        <div key={activity._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                          <div className="text-sm text-slate-800">{activity.action}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {formatDate(activity.createdAt)}
                            {activity.performedBy?.name ? ` - ${activity.performedBy.name}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadsMatrix;
