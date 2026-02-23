import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
  Hexagon,
  Moon,
  Sun,
  Menu,
  X,
  MessageSquare,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "framer-motion";

const MENU_CONFIG = {
  admin: [
    { name: "Home", icon: Home, path: "/" },
    { name: "Pipeline", icon: Users, path: "/leads" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Reports", icon: ClipboardList, path: "/reports" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Empire", icon: Building2, path: "/inventory" },
    { name: "Field Ops", icon: Map, path: "/map" },
    { name: "Targets", icon: PieChart, path: "/targets" },
    { name: "Access", icon: ShieldCheck, path: "/admin/users" },
    { name: "System", icon: Settings, path: "/settings" },
  ],
  manager: [
    { name: "Home", icon: Home, path: "/" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Finance", icon: PieChart, path: "/finance" },
    { name: "Pipeline", icon: Users, path: "/leads" },
    { name: "Inventory", icon: Building2, path: "/inventory" },
    { name: "Field Ops", icon: Map, path: "/map" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Reports", icon: ClipboardList, path: "/reports" },
    { name: "System", icon: Settings, path: "/settings" },
  ],
  executive: [
    { name: "My Desk", icon: Briefcase, path: "/" },
    { name: "My Leads", icon: Users, path: "/my-leads" },
    { name: "Inventory", icon: Building2, path: "/inventory" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
    { name: "Targets", icon: PieChart, path: "/targets" },
  ],
  field_agent: [
    { name: "Route", icon: Map, path: "/" },
    { name: "My Leads", icon: Users, path: "/my-leads" },
    { name: "Inventory", icon: Building2, path: "/inventory" },
    { name: "Chat", icon: MessageSquare, path: "/chat" },
    { name: "Field Ops", icon: Navigation, path: "/map" },
    { name: "Schedule", icon: Calendar, path: "/calendar" },
  ],
};

const Navbar = ({ userRole = "manager", onLogout, theme = "light", onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const roleKeyMap = {
    ADMIN: "admin",
    MANAGER: "manager",
    EXECUTIVE: "executive",
    FIELD_EXECUTIVE: "field_agent",
  };

  const normalizedRole = roleKeyMap[userRole] || "manager";
  const currentMenu = MENU_CONFIG[normalizedRole] || MENU_CONFIG.manager;

  const handleCloseMenus = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <Motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className={`fixed top-0 left-0 right-0 h-16 z-50 border-b backdrop-blur-xl overflow-visible ${
          isDark ? "bg-slate-950/85 border-cyan-200/20" : "bg-white/90 border-slate-300/70"
        }`}
      >
        <div className="h-full flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
          <div className="relative flex-none flex items-center justify-center w-10 h-10">
            <div
              className={`absolute inset-[-6px] rounded-xl border border-dashed animate-[spin_10s_linear_infinite] ${
                isDark ? "border-cyan-200/35" : "border-sky-400/45"
              }`}
            />
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                isDark
                  ? "bg-slate-900/90 border-cyan-200/30 text-cyan-300"
                  : "bg-white border-slate-300/80 text-sky-600"
              }`}
            >
              <Hexagon size={20} />
            </div>
          </div>

          <nav className="hidden md:flex flex-1 items-center justify-center gap-4 lg:gap-5 py-1">
            {currentMenu.map((item) => (
              <NavLink key={item.path} to={item.path} onClick={handleCloseMenus}>
                {({ isActive }) => (
                  <div
                    className={`group relative h-11 w-11 rounded-xl border text-xs font-semibold tracking-wide whitespace-nowrap flex items-center justify-center transition-all ${
                      isActive
                        ? isDark
                          ? "bg-cyan-300/15 border-cyan-200/40 text-cyan-100"
                          : "bg-sky-100 border-sky-300/70 text-sky-700"
                        : isDark
                          ? "bg-slate-900/40 border-slate-700 text-slate-300 hover:border-cyan-200/40"
                          : "bg-white border-slate-300 text-slate-700 hover:border-sky-300"
                    }`}
                  >
                    <item.icon size={18} />
                    <span
                      className={`pointer-events-none absolute z-[70] left-1/2 top-[calc(100%+8px)] -translate-x-1/2 px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 ${
                        isDark
                          ? "bg-slate-900 text-slate-100 border border-slate-700 shadow-[0_8px_20px_rgba(2,6,23,0.45)]"
                          : "bg-white text-slate-700 border border-slate-300 shadow-[0_8px_20px_rgba(15,23,42,0.2)]"
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1 md:hidden" />

          <div className="flex-none flex items-center justify-end gap-2">
            <button
              onClick={onToggleTheme}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                isDark
                  ? "text-slate-300 border-cyan-200/20 hover:bg-cyan-300/10 hover:text-cyan-200"
                  : "text-slate-700 border-slate-300 hover:bg-sky-100 hover:text-sky-700"
              }`}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={onLogout}
              className={`hidden md:flex h-10 px-3 rounded-xl border items-center justify-center gap-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                isDark
                  ? "text-slate-300 border-slate-700 hover:bg-rose-400/10 hover:text-rose-300"
                  : "text-slate-700 border-slate-300 hover:bg-rose-100 hover:text-rose-600"
              }`}
              title="Logout"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`md:hidden w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                isDark
                  ? "text-slate-300 border-cyan-200/20 hover:bg-cyan-300/10 hover:text-cyan-200"
                  : "text-slate-700 border-slate-300 hover:bg-sky-100 hover:text-sky-700"
              }`}
              title="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </Motion.header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 top-16 z-40 bg-black/30 md:hidden"
            />
            <Motion.div
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              className={`fixed top-16 left-0 right-0 z-50 border-b shadow-xl md:hidden ${
                isDark ? "bg-slate-950 border-cyan-200/20" : "bg-white border-slate-200"
              }`}
            >
              <div className="p-3 grid grid-cols-1 gap-2">
                {currentMenu.map((item) => (
                  <NavLink key={item.path} to={item.path} onClick={handleCloseMenus}>
                    {({ isActive }) => (
                      <div
                        className={`h-10 px-3 rounded-xl border text-xs font-semibold tracking-wide flex items-center gap-3 transition-all ${
                          isActive
                            ? isDark
                              ? "bg-cyan-300/15 border-cyan-200/40 text-cyan-100"
                              : "bg-sky-100 border-sky-300/70 text-sky-700"
                            : isDark
                              ? "bg-slate-900/40 border-slate-700 text-slate-300"
                              : "bg-white border-slate-300 text-slate-700"
                        }`}
                      >
                        <item.icon size={14} />
                        <span>{item.name}</span>
                      </div>
                    )}
                  </NavLink>
                ))}
                <button
                  onClick={onLogout}
                  className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-colors ${
                    isDark
                      ? "text-slate-300 border-slate-700 hover:bg-rose-400/10 hover:text-rose-300"
                      : "text-slate-700 border-slate-300 hover:bg-rose-100 hover:text-rose-600"
                  }`}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
