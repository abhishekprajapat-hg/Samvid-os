import React from "react";
import { motion as Motion } from "framer-motion";
import { Trash2, UserCheck, Users } from "lucide-react";

export const TeamLeadOverviewCards = ({ globalStats, isDarkTheme }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
      <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        Total Leads
      </div>
      <div className={`mt-2 text-2xl font-display ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
        {globalStats.total}
      </div>
    </div>
    <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
      <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        Converted Leads
      </div>
      <div className={`mt-2 text-2xl font-display ${isDarkTheme ? "text-emerald-300" : "text-emerald-700"}`}>
        {globalStats.converted}
      </div>
    </div>
    <div className={`rounded-xl border p-4 ${isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"}`}>
      <div className={`text-[10px] uppercase tracking-widest font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        Unassigned Leads
      </div>
      <div className={`mt-2 text-2xl font-display ${isDarkTheme ? "text-amber-300" : "text-amber-700"}`}>
        {globalStats.unassigned}
      </div>
    </div>
  </div>
);

export const TeamUserGrid = ({
  users,
  loading,
  leadStats,
  isDarkTheme,
  profilePanelOpen,
  selectedUserId,
  deletingUserId,
  currentUserId,
  roleLabels,
  onOpenUserProfile,
  onDeleteUser,
  getLeadScopeLabel,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
    {loading ? (
      <div className={`text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        Loading users...
      </div>
    ) : users.length === 0 ? (
      <div className={`text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
        No users found.
      </div>
    ) : (
      users.map((user) => {
        const userStats = leadStats[String(user._id)] || { total: 0, converted: 0 };
        const conversionRate = userStats.total
          ? Math.round((userStats.converted / userStats.total) * 100)
          : 0;
        const isSelected = profilePanelOpen && String(selectedUserId) === String(user._id);

        return (
          <TeamUserCard
            key={user._id}
            user={user}
            userStats={userStats}
            conversionRate={conversionRate}
            isSelected={isSelected}
            isDarkTheme={isDarkTheme}
            deletingUserId={deletingUserId}
            currentUserId={currentUserId}
            roleLabels={roleLabels}
            onOpenUserProfile={onOpenUserProfile}
            onDeleteUser={onDeleteUser}
            leadScopeLabel={getLeadScopeLabel(user.role)}
          />
        );
      })
    )}
  </div>
);

const TeamUserCard = ({
  user,
  userStats,
  conversionRate,
  isSelected,
  isDarkTheme,
  deletingUserId,
  currentUserId,
  roleLabels,
  onOpenUserProfile,
  onDeleteUser,
  leadScopeLabel,
}) => (
  <Motion.div
    key={user._id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    role="button"
    tabIndex={0}
    onClick={() => onOpenUserProfile(user._id)}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpenUserProfile(user._id);
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
        <div className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
          {user.name}
        </div>
        <div className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
          {user.email}
        </div>
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
            onDeleteUser(user);
          }}
          disabled={deletingUserId === user._id || String(user._id) === String(currentUserId)}
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
        <span>{roleLabels[user.role] || user.role}</span>
      </div>
      <div className="flex items-center gap-2">
        <UserCheck size={13} />
        <span>Manager: {user.parentId?.name || "-"}</span>
      </div>
      <div>Phone: {user.phone || "-"}</div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-2">
      <div className={`rounded-lg border px-2 py-2 ${isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
        <div className={`text-[9px] uppercase tracking-wider font-bold ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
          {leadScopeLabel}
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
  </Motion.div>
);
