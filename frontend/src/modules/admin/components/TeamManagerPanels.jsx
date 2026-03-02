import React from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  Briefcase,
  CalendarClock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  X,
} from "lucide-react";

export const UserFormPanel = ({
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
  roleOptions,
  reportingParentRoles,
}) => {
  const needsReporting = Boolean(reportingParentRoles[formData.role]?.length);

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/45 z-50 flex justify-end"
        >
          <Motion.div
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
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />
              <input
                type="text"
                placeholder="Phone"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              />

              <select
                value={formData.role}
                onChange={(event) =>
                  setFormData({ ...formData, role: event.target.value, reportingToId: "" })
                }
                className={`w-full border rounded-lg px-3 py-2 ${isDarkTheme ? "bg-slate-900 border-slate-700 text-slate-100" : ""}`}
              >
                {roleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>

              {needsReporting && (
                <select
                  value={formData.reportingToId}
                  onChange={(event) => setFormData({ ...formData, reportingToId: event.target.value })}
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
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export const UserProfilePanel = ({
  isOpen,
  onClose,
  loading,
  error,
  profile,
  performance,
  summaryCards,
  isDarkTheme,
  roleLabels,
  statusLabels,
  leadStatuses,
  formatDate,
}) => {
  const statusBreakdown = performance?.statusBreakdown || {};
  const recentLeads = Array.isArray(performance?.recentLeads)
    ? performance.recentLeads
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/45 z-50 flex justify-end"
        >
          <Motion.div
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
                      {roleLabels[profile.role] || profile.role || "-"}
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
                    {leadStatuses.map((status) => (
                      <div
                        key={status}
                        className={`rounded-lg border px-3 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                          {statusLabels[status] || status}
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
                            Status: {statusLabels[lead.status] || lead.status || "-"}
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
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

