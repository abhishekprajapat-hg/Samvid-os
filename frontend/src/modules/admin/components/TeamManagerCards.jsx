import React from "react";
import { motion as Motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Users2,
} from "lucide-react";

const getUserInitials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    || "U";

const roleBadgeTone = (role, isDarkTheme) => {
  if (role === "MANAGER") {
    return isDarkTheme
      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";
  }
  if (role === "ASSISTANT_MANAGER") {
    return isDarkTheme
      ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-100"
      : "border-indigo-200 bg-indigo-50 text-indigo-700";
  }
  if (role === "TEAM_LEADER") {
    return isDarkTheme
      ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
      : "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (role === "CHANNEL_PARTNER") {
    return isDarkTheme
      ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (role === "EXECUTIVE" || role === "FIELD_EXECUTIVE") {
    return isDarkTheme
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return isDarkTheme
    ? "border-slate-500/40 bg-slate-500/20 text-slate-100"
    : "border-slate-200 bg-slate-100 text-slate-700";
};

const statusTone = (isActive, isDarkTheme) => {
  if (isActive) {
    return isDarkTheme
      ? "bg-emerald-500/20 text-emerald-200"
      : "bg-emerald-100 text-emerald-700";
  }
  return isDarkTheme
    ? "bg-slate-700 text-slate-200"
    : "bg-slate-200 text-slate-600";
};

export const TeamLeadOverviewCards = ({
  globalStats,
  roleBreakdown,
  isDarkTheme,
  totalUsers,
  activeUsers,
}) => {
  const cards = [
    {
      key: "teamUsers",
      label: "Team Users",
      value: totalUsers,
      helper: `${activeUsers} active`,
      icon: Users2,
      valueTone: isDarkTheme ? "text-slate-100" : "text-slate-900",
    },
    {
      key: "totalLeads",
      label: "Total Leads",
      value: globalStats.total,
      helper: "all in scope",
      icon: Activity,
      valueTone: isDarkTheme ? "text-slate-100" : "text-slate-900",
    },
    {
      key: "converted",
      label: "Converted",
      value: globalStats.converted,
      helper: "closed wins",
      icon: CheckCircle2,
      valueTone: isDarkTheme ? "text-emerald-200" : "text-emerald-700",
    },
    {
      key: "unassigned",
      label: "Unassigned",
      value: globalStats.unassigned,
      helper: "needs assignment",
      icon: ShieldCheck,
      valueTone: isDarkTheme ? "text-amber-200" : "text-amber-700",
    },
  ];

  const mixRows = [
    { key: "MANAGER", label: "Managers" },
    { key: "ASSISTANT_MANAGER", label: "Assistant Managers" },
    { key: "TEAM_LEADER", label: "Team Leaders" },
    { key: "EXECUTIVE", label: "Executives" },
    { key: "FIELD_EXECUTIVE", label: "Field Executives" },
    { key: "CHANNEL_PARTNER", label: "Channel Partners" },
  ];

  return (
    <div className={`rounded-2xl border p-4 ${
      isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"
    }`}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className={`rounded-xl border p-4 ${
              isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className={`text-[10px] font-bold uppercase tracking-widest ${
                isDarkTheme ? "text-slate-400" : "text-slate-500"
              }`}>
                {card.label}
              </div>
              <card.icon size={14} className={isDarkTheme ? "text-slate-400" : "text-slate-500"} />
            </div>
            <div className={`mt-2 text-3xl font-display ${card.valueTone}`}>
              {card.value}
            </div>
            <div className={`mt-1 text-[11px] ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
              {card.helper}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mixRows.map((row) => (
          <div
            key={row.key}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              isDarkTheme ? "border-slate-700 bg-slate-950/70 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {row.label}: <span className="font-semibold">{Number(roleBreakdown?.[row.key] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamUserGrid = ({
  users,
  loading,
  leadStats,
  isDarkTheme,
  deletingUserId,
  currentUserId,
  roleLabels,
  canManageUsers,
  canOpenUserProfile,
  onOpenUserProfile,
  onDeleteUser,
  onToggleChannelPartnerInventoryAccess,
  inventoryAccessUpdatingUserId,
  getLeadScopeLabel,
}) => {
  if (loading) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-4 pb-8 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className={`h-56 animate-pulse rounded-xl border ${
              isDarkTheme ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white"
            }`}
          />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={`rounded-xl border p-6 text-sm ${
        isDarkTheme ? "border-slate-700 bg-slate-900/70 text-slate-400" : "border-slate-200 bg-white text-slate-500"
      }`}>
        No users found for current filters.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 pb-8 md:grid-cols-2 xl:grid-cols-3">
      {users.map((user) => {
        const userStats = leadStats[String(user._id)] || { total: 0, converted: 0 };
        const conversionRate = userStats.total
          ? Math.round((userStats.converted / userStats.total) * 100)
          : 0;

        return (
          <TeamUserCard
            key={user._id}
            user={user}
            userStats={userStats}
            conversionRate={conversionRate}
            isDarkTheme={isDarkTheme}
            deletingUserId={deletingUserId}
            currentUserId={currentUserId}
            roleLabels={roleLabels}
            canManageUsers={canManageUsers}
            canOpenUserProfile={canOpenUserProfile}
            onOpenUserProfile={onOpenUserProfile}
            onDeleteUser={onDeleteUser}
            onToggleChannelPartnerInventoryAccess={onToggleChannelPartnerInventoryAccess}
            inventoryAccessUpdatingUserId={inventoryAccessUpdatingUserId}
            leadScopeLabel={getLeadScopeLabel(user.role)}
          />
        );
      })}
    </div>
  );
};

const TeamUserCard = ({
  user,
  userStats,
  conversionRate,
  isDarkTheme,
  deletingUserId,
  currentUserId,
  roleLabels,
  canManageUsers,
  canOpenUserProfile,
  onOpenUserProfile,
  onDeleteUser,
  onToggleChannelPartnerInventoryAccess,
  inventoryAccessUpdatingUserId,
  leadScopeLabel,
}) => {
  const isChannelPartner = user.role === "CHANNEL_PARTNER";
  const isUpdatingInventoryAccess =
    String(inventoryAccessUpdatingUserId || "") === String(user._id);
  const initials = getUserInitials(user.name);

  return (
    <Motion.div
      key={user._id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      role={canOpenUserProfile ? "button" : undefined}
      tabIndex={canOpenUserProfile ? 0 : -1}
      onClick={() => {
        if (!canOpenUserProfile) return;
        onOpenUserProfile(user._id);
      }}
      onKeyDown={(event) => {
        if (!canOpenUserProfile) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenUserProfile(user._id);
        }
      }}
      className={`group min-w-0 rounded-2xl border p-4 transition ${
        isDarkTheme
          ? "border-slate-700 bg-slate-900/80 shadow-[0_10px_30px_rgba(2,6,23,0.4)]"
          : "border-slate-200 bg-white shadow-sm"
      } ${
        canOpenUserProfile
          ? isDarkTheme
            ? "hover:border-cyan-400/45"
            : "hover:border-cyan-300"
          : "cursor-default"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${
            isDarkTheme
              ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
              : "border-cyan-200 bg-cyan-50 text-cyan-700"
          }`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className={`truncate text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
              {user.name}
            </div>
            <div className={`truncate text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
              {user.email || "-"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(user.isActive, isDarkTheme)}`}>
            {user.isActive ? "ACTIVE" : "INACTIVE"}
          </span>
          {canManageUsers ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteUser(user);
              }}
              disabled={deletingUserId === user._id || String(user._id) === String(currentUserId)}
              className={`rounded-md p-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                isDarkTheme ? "text-rose-300 hover:bg-rose-500/10" : "text-rose-600 hover:bg-rose-50"
              }`}
              title={
                String(user._id) === String(currentUserId)
                  ? "You cannot delete your own account"
                  : "Delete user"
              }
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${roleBadgeTone(user.role, isDarkTheme)}`}>
          {roleLabels[user.role] || user.role}
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] ${
          isDarkTheme ? "text-slate-400" : "text-slate-500"
        }`}>
          <UserCheck size={12} />
          Reports to {user.parentId?.name || "-"}
        </span>
      </div>

      <div className={`mt-3 space-y-1.5 rounded-xl border p-2.5 text-xs ${
        isDarkTheme ? "border-slate-700 bg-slate-950/70 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
      }`}>
        <div className="flex items-center gap-2">
          <Phone size={12} />
          <span>{user.phone || "-"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail size={12} />
          <span className="truncate">{user.email || "-"}</span>
        </div>
      </div>

      {isChannelPartner && canManageUsers ? (
        <div className={`mt-3 flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${
          isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
        }`}>
          <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
            isDarkTheme ? "text-slate-400" : "text-slate-500"
          }`}>
            Inventory Access
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleChannelPartnerInventoryAccess(user);
            }}
            disabled={isUpdatingInventoryAccess}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] disabled:opacity-60 ${
              user.canViewInventory
                ? "bg-emerald-100 text-emerald-700"
                : isDarkTheme
                  ? "bg-slate-800 text-slate-200"
                  : "bg-white text-slate-700"
            }`}
          >
            {isUpdatingInventoryAccess
              ? "Updating..."
              : user.canViewInventory
                ? "Enabled"
                : "Disabled"}
          </button>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className={`rounded-lg border px-2 py-2 ${
          isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
        }`}>
          <div className={`text-[9px] font-bold uppercase tracking-wider ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            {leadScopeLabel}
          </div>
          <div className={`mt-1 text-sm font-bold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
            {userStats.total}
          </div>
        </div>
        <div className={`rounded-lg border px-2 py-2 ${
          isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
        }`}>
          <div className={`text-[9px] font-bold uppercase tracking-wider ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Converted
          </div>
          <div className={`mt-1 text-sm font-bold ${isDarkTheme ? "text-emerald-300" : "text-emerald-700"}`}>
            {userStats.converted}
          </div>
        </div>
        <div className={`rounded-lg border px-2 py-2 ${
          isDarkTheme ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
        }`}>
          <div className={`text-[9px] font-bold uppercase tracking-wider ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Conv. Rate
          </div>
          <div className={`mt-1 text-sm font-bold ${isDarkTheme ? "text-cyan-300" : "text-cyan-700"}`}>
            {conversionRate}%
          </div>
        </div>
      </div>

      <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${
        isDarkTheme ? "bg-slate-800" : "bg-slate-200"
      }`}>
        <div
          className={`h-full rounded-full ${
            conversionRate >= 60
              ? "bg-emerald-500"
              : conversionRate >= 30
                ? "bg-amber-500"
                : "bg-slate-400"
          }`}
          style={{ width: `${Math.max(4, Math.min(100, conversionRate || 0))}%` }}
        />
      </div>

      {canOpenUserProfile ? (
        <div className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold ${
          isDarkTheme ? "text-cyan-200" : "text-cyan-700"
        }`}>
          Open details <ChevronRight size={13} />
        </div>
      ) : null}
    </Motion.div>
  );
};
