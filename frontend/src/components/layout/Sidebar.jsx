import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Building2,
  Map,
  LogOut,
  PieChart,
  Settings,
  ClipboardList,
  Calendar,
  Navigation,
  ShieldCheck,
  Briefcase,
  Moon,
  Sun,
  MessageSquare,
  UserCircle2,
  Trophy,
  Bell,
  Megaphone,
  TerminalSquare,
  UserCheck,
  Menu,
  X,
  CheckSquare,
} from "lucide-react";
import { motion as Motion } from "framer-motion";
import { useChatNotifications } from "../../context/useChatNotifications";
import BrandLogo from "../common/BrandLogo";

const MENU_CONFIG = {
  admin: [
    { name: "Home", icon: Home, path: "/dashboard" },
    { name: "Pipeline", icon: Users, path: "/leads" },
    { name: "Tasks", icon: CheckSquare, path: "/tasks" },
    { name: "Attendance", icon: UserCheck, path: "/attendance" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Reports", icon: ClipboardList, path: "/reports" },
    { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Alerts", icon: Bell, path: "/admin/notifications" },
    { name: "Meta Ads", icon: Megaphone, path: "/admin/meta-ads" },
    { name: "Console", icon: TerminalSquare, path: "/admin/console" },
    { name: "Empire", icon: Building2, path: "/inventory" },
    { name: "Field Ops", icon: Map, path: "/map" },
    { name: "Targets", icon: PieChart, path: "/targets" },
    { name: "Profile", icon: UserCircle2, path: "/profile" },
    { name: "Access", icon: ShieldCheck, path: "/admin/users" },
    { name: "System", icon: Settings, path: "/settings" },
  ],
  manager: [
    { name: "Home", icon: Home, path: "/dashboard" },
    { name: "Tasks", icon: CheckSquare, path: "/tasks" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Attendance", icon: UserCheck, path: "/attendance" },
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Pipeline", icon: Users, path: "/leads" },
    { name: "Inventory", icon: Building2, path: "/inventory" },
    { name: "Field Ops", icon: Map, path: "/map" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Alerts", icon: Bell, path: "/admin/notifications" },
    { name: "Reports", icon: ClipboardList, path: "/reports" },
    { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { name: "Targets", icon: PieChart, path: "/targets" },
    { name: "Access", icon: ShieldCheck, path: "/admin/users" },
    { name: "Profile", icon: UserCircle2, path: "/profile" },
    { name: "System", icon: Settings, path: "/settings" },
  ],
  executive: [
    { name: "My Desk", icon: Briefcase, path: "/dashboard" },
    { name: "Tasks", icon: CheckSquare, path: "/tasks" },
    { name: "My Leads", icon: Users, path: "/my-leads" },
    { name: "Attendance", icon: UserCheck, path: "/attendance" },
    { name: "Inventory", icon: Building2, path: "/inventory" },
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Targets", icon: PieChart, path: "/targets" },
    { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { name: "Profile", icon: UserCircle2, path: "/profile" },
  ],
  field_agent: [
    { name: "Route", icon: Map, path: "/dashboard" },
    { name: "Tasks", icon: CheckSquare, path: "/tasks" },
    { name: "My Leads", icon: Users, path: "/my-leads" },
    { name: "Attendance", icon: UserCheck, path: "/attendance" },
    { name: "Inventory", icon: Building2, path: "/inventory" },
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Field Ops", icon: Navigation, path: "/map" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Targets", icon: PieChart, path: "/targets" },
    { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { name: "Profile", icon: UserCircle2, path: "/profile" },
  ],
  partner: [{ name: "Profile", icon: UserCircle2, path: "/profile" }],
};

const getSectionLabel = (item, index) => {
  if (index === 0) return "Workspace";
  if (["/reports", "/leaderboard", "/targets"].includes(item.path)) return "Insights";
  if (["/chat", "/calendar"].includes(item.path)) return "Collaboration";
  if (item.path.startsWith("/admin")) return "Admin";
  if (["/inventory", "/map"].includes(item.path)) return "Assets";
  if (["/profile", "/settings"].includes(item.path)) return "Account";
  return null;
};

const Sidebar = ({ userRole = "manager", onLogout, theme = "light", onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === "dark";
  const { adminRequestUnread } = useChatNotifications();
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const canChannelPartnerViewInventory = Boolean(storedUser?.canViewInventory);
  const roleKeyMap = {
    ADMIN: "admin",
    MANAGER: "manager",
    EXECUTIVE: "executive",
    FIELD_EXECUTIVE: "field_agent",
    CHANNEL_PARTNER: "partner",
  };
  const normalizedRole = roleKeyMap[userRole] || "manager";
  const partnerMenu = [
    { name: "Pipeline", icon: Users, path: "/leads" },
    { name: "Attendance", icon: UserCheck, path: "/attendance" },
    ...(canChannelPartnerViewInventory
      ? [{ name: "Inventory", icon: Building2, path: "/inventory" }]
      : []),
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Leaderboard", icon: Trophy, path: "/leaderboard" },
    { name: "Profile", icon: UserCircle2, path: "/profile" },
  ];
  const currentMenu =
    normalizedRole === "partner"
      ? partnerMenu
      : (MENU_CONFIG[normalizedRole] || MENU_CONFIG.manager);
  const hasAdminAlerts = ["ADMIN", "MANAGER"].includes(userRole) && adminRequestUnread > 0;
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const handleLogout = () => {
    closeMobileMenu();
    onLogout?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        className={`fixed top-3 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur-xl transition-[left,background-color,color,border-color] duration-300 md:hidden ${
          mobileMenuOpen ? "left-[13.25rem]" : "left-3"
        } ${
          isDark
            ? "border-white/10 bg-slate-900/85 text-slate-100 shadow-lg"
            : "border-slate-200/80 bg-white/80 text-slate-700 shadow-lg"
        }`}
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-[55] bg-slate-950/45 backdrop-blur-[2px] md:hidden"
        />
      ) : null}

      <Motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className={`group/sidebar fixed left-0 top-0 z-[60] flex h-full w-64 flex-col overflow-x-hidden border-r backdrop-blur-2xl transition-[width,transform] duration-300 md:z-50 md:w-12 md:translate-x-0 md:hover:w-64 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isDark
            ? "border-white/10 bg-slate-950/88 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9)]"
            : "border-slate-200/80 bg-white/92 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.42)]"
        }`}
      >
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent ${
            isDark ? "from-blue-500/10" : "from-blue-50"
          }`}
        />
        <div
          className={`absolute -left-16 top-16 h-40 w-40 rounded-full blur-3xl ${
            isDark ? "bg-sky-400/10" : "bg-sky-200/35"
          }`}
        />
      </div>

      <div
        className={`relative z-10 m-2 mb-1.5 flex items-center gap-2.5 rounded-2xl border p-2 transition-all duration-300 md:mx-0 md:my-1.5 md:h-10 md:w-full md:justify-center md:rounded-none md:border-transparent md:bg-transparent md:p-0 md:group-hover/sidebar:m-2 md:group-hover/sidebar:mb-1.5 md:group-hover/sidebar:h-auto md:group-hover/sidebar:w-auto md:group-hover/sidebar:justify-start md:group-hover/sidebar:rounded-2xl md:group-hover/sidebar:border md:group-hover/sidebar:p-2 ${
          isDark
            ? "border-white/10 bg-white/[0.06]"
            : "border-slate-200/80 bg-white/80"
        }`}
      >
        <div
          className="brand-logo-frame flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm md:h-8 md:w-8 md:rounded-lg md:group-hover/sidebar:h-9 md:group-hover/sidebar:w-9 md:group-hover/sidebar:rounded-xl"
        >
          <BrandLogo className="h-full w-full" />
        </div>
        <div className="min-w-0 md:w-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-200 md:group-hover/sidebar:w-auto md:group-hover/sidebar:opacity-100">
          <p className="text-sm font-bold leading-tight text-[#009FA8]">
            Samvid OS
          </p>
          <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] ${isDark ? "text-sky-300/80" : "text-blue-700"}`}>
            Operations
          </p>
        </div>
      </div>

      <nav
        className="scrollbar-hide relative z-10 flex w-full flex-1 flex-col items-stretch gap-1 overflow-x-hidden overflow-y-auto px-2.5 pb-1 md:items-center md:gap-1 md:px-1 md:group-hover/sidebar:items-stretch md:group-hover/sidebar:px-2.5"
      >
        {currentMenu.map((item, index) => {
          const sectionLabel = getSectionLabel(item, index);

          return (
            <React.Fragment key={item.path}>
              {sectionLabel ? (
                <p
                  className={`sr-only ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {sectionLabel}
                </p>
              ) : null}

              <NavLink
                to={item.path}
                onClick={closeMobileMenu}
                className="group relative flex w-full items-center justify-start overflow-visible md:justify-center md:group-hover/sidebar:justify-start"
              >
                {({ isActive }) => (
                  <div
                    className={`relative flex h-8 w-full items-center justify-start gap-2.5 rounded-lg border px-2 transition-all duration-200 md:h-8 md:w-8 md:justify-center md:gap-0 md:px-0 md:group-hover/sidebar:w-full md:group-hover/sidebar:justify-start md:group-hover/sidebar:gap-2.5 md:group-hover/sidebar:px-2 ${
                      isActive
                        ? isDark
                          ? "border-sky-300/40 bg-sky-400/20 text-white shadow-[0_12px_28px_-18px_rgba(56,189,248,0.85)]"
                          : "border-blue-300 bg-blue-100 text-blue-950 shadow-[0_12px_28px_-18px_rgba(37,99,235,0.42)]"
                        : isDark
                          ? "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/10 hover:text-white"
                          : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    {isActive ? (
                      <Motion.div
                        layoutId="activeRail"
                        className={`absolute inset-0 rounded-xl border ${
                          isDark
                            ? "border-sky-300/40 bg-sky-400/20"
                            : "border-blue-300 bg-blue-100"
                        }`}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    ) : null}
                    {isActive ? (
                      <div
                        className={`absolute left-0 h-5 w-1 rounded-r-full ${
                          isDark ? "bg-sky-300" : "bg-blue-600"
                        }`}
                      />
                    ) : null}
                    <div
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
                        isActive
                          ? isDark
                            ? "bg-sky-300/20 text-sky-100 ring-1 ring-sky-200/20"
                            : "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                          : isDark
                            ? "text-slate-400 group-hover:scale-125 group-hover:bg-white/10 group-hover:text-slate-100 group-hover:shadow-md group-hover:ring-1 group-hover:ring-white/10"
                            : "text-slate-500 group-hover:scale-125 group-hover:bg-white group-hover:text-blue-700 group-hover:shadow-md group-hover:ring-1 group-hover:ring-blue-100"
                      }`}
                    >
                      <item.icon className={`transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} size={17} strokeWidth={isActive ? 2.25 : 1.9} />
                    </div>
                    <span
                      className={`relative z-10 min-w-0 origin-left truncate text-xs font-semibold md:block md:w-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-200 md:group-hover/sidebar:w-auto md:group-hover/sidebar:opacity-100 ${
                        isActive
                          ? isDark ? "text-slate-100" : "text-slate-950"
                          : isDark ? "text-slate-400 group-hover:scale-110 group-hover:text-slate-100" : "text-slate-700 group-hover:scale-110 group-hover:text-blue-800"
                      }`}
                    >
                      {item.name}
                    </span>
                    {item.path === "/admin/notifications" && hasAdminAlerts ? (
                      <span
                        className={`absolute -right-1 -top-1 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold md:right-0.5 md:top-0.5 md:group-hover/sidebar:-right-1 md:group-hover/sidebar:-top-1 ${
                          isDark ? "bg-rose-500 text-white" : "bg-rose-600 text-white"
                        }`}
                      >
                        {adminRequestUnread > 99 ? "99+" : adminRequestUnread}
                      </span>
                    ) : null}
                    <div className="pointer-events-none absolute left-full z-[70] ml-2.5 hidden translate-x-[-6px] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 md:block md:group-hover/sidebar:hidden">
                      <div
                        className={`rounded-lg border px-2.5 py-1.5 shadow-xl backdrop-blur-md ${
                          isDark
                            ? "border-slate-700 bg-slate-900 text-slate-200"
                            : "border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <span className="whitespace-nowrap text-[10px] font-semibold">
                          {item.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      <div
        className={`relative z-10 m-2 mt-1 flex flex-col items-center justify-center gap-1 overflow-x-hidden rounded-2xl border p-1.5 md:m-1 md:rounded-xl md:p-1 md:group-hover/sidebar:m-2 md:group-hover/sidebar:mt-1 md:group-hover/sidebar:rounded-2xl md:group-hover/sidebar:p-1.5 ${
          isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/80 bg-white/70"
        }`}
      >
        <button
          onClick={onToggleTheme}
          className={`flex h-8 w-full items-center justify-start gap-2.5 rounded-lg border px-2 transition-all duration-300 md:w-8 md:justify-center md:gap-0 md:border-transparent md:px-0 md:group-hover/sidebar:w-full md:group-hover/sidebar:justify-start md:group-hover/sidebar:gap-2.5 md:group-hover/sidebar:border md:group-hover/sidebar:px-2 ${
            isDark
              ? "border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
              : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
          }`}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} strokeWidth={1.9} /> : <Moon size={16} strokeWidth={1.9} />}
          <span className="truncate text-xs font-semibold md:block md:w-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-200 md:group-hover/sidebar:w-auto md:group-hover/sidebar:opacity-100">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>
        <button
          onClick={handleLogout}
          className={`flex h-8 w-full items-center justify-start gap-2.5 rounded-lg border px-2 transition-all duration-300 md:w-8 md:justify-center md:gap-0 md:border-transparent md:px-0 md:group-hover/sidebar:w-full md:group-hover/sidebar:justify-start md:group-hover/sidebar:gap-2.5 md:group-hover/sidebar:border md:group-hover/sidebar:px-2 ${
            isDark
              ? "text-slate-400 hover:bg-white/10 hover:text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
          }`}
          title="Disconnect System"
        >
          <LogOut size={16} strokeWidth={1.8} />
          <span className={`truncate text-xs font-semibold md:block md:w-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-200 md:group-hover/sidebar:w-auto md:group-hover/sidebar:opacity-100 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Logout
          </span>
        </button>
      </div>
      </Motion.aside>
    </>
  );
};

export default Sidebar;
