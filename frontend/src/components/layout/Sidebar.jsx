import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutGrid, Users, Building2, Map, LogOut,
    PieChart, Settings, ClipboardList, Calendar,
    Navigation, ShieldCheck, Briefcase, Hexagon, Moon, Sun, MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';

// --- MENU CONFIGURATION ---
const MENU_CONFIG = {
    admin: [
        { name: 'Command', icon: LayoutGrid, path: '/' },
        { name: 'Pipeline', icon: Users, path: '/leads' },
        { name: 'Schedule', icon: Calendar, path: '/calendar' },
        { name: 'Finance', icon: PieChart, path: '/finance' },
        { name: 'Reports', icon: ClipboardList, path: '/reports' },
        { name: 'Empire', icon: Building2, path: '/inventory' },
        { name: 'Field Ops', icon: Map, path: '/map' },
        { name: 'Targets', icon: PieChart, path: '/targets' },
        { name: 'Access', icon: ShieldCheck, path: '/admin/users' },
        { name: 'System', icon: Settings, path: '/settings' },
    ],
    manager: [
        { name: 'Overview', icon: LayoutGrid, path: '/' },
        { name: 'Schedule', icon: Calendar, path: '/calendar' },
        { name: 'Finance', icon: PieChart, path: '/finance' },
        { name: 'Pipeline', icon: Users, path: '/leads' },
        { name: 'Inventory', icon: Building2, path: '/inventory' },
        { name: 'Field Ops', icon: Map, path: '/map' },
        { name: 'Reports', icon: ClipboardList, path: '/reports' },
        { name: 'System', icon: Settings, path: '/settings' },
    ],
    executive: [
        { name: 'My Desk', icon: Briefcase, path: '/' },
        { name: 'My Leads', icon: Users, path: '/my-leads' },
        { name: 'Inventory', icon: Building2, path: '/inventory' },
        { name: 'Chat', icon: MessageSquare, path: '/chat' },
        { name: 'Schedule', icon: Calendar, path: '/calendar' },
        { name: 'Targets', icon: PieChart, path: '/targets' },
    ],
    field_agent: [
        { name: 'Route', icon: Map, path: '/' },
        { name: 'My Leads', icon: Users, path: '/my-leads' },
        { name: 'Inventory', icon: Building2, path: '/inventory' },
        { name: 'Chat', icon: MessageSquare, path: '/chat' },
        { name: 'Field Ops', icon: Navigation, path: '/map' },
        { name: 'Schedule', icon: Calendar, path: '/calendar' },
    ]
};

const Sidebar = ({ userRole = 'manager', onLogout, theme = "light", onToggleTheme }) => {
    const isDark = theme === "dark";
    const roleKeyMap = {
        ADMIN: "admin",
        MANAGER: "manager",
        EXECUTIVE: "executive",
        FIELD_EXECUTIVE: "field_agent",
    };
    const normalizedRole = roleKeyMap[userRole] || "manager";
    const currentMenu = MENU_CONFIG[normalizedRole] || MENU_CONFIG.manager;

    return (
        <motion.aside
            initial={{ x: -140, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: "circOut" }}
            className={`fixed left-0 top-0 h-full w-36 z-50 flex flex-col justify-between items-center py-8 backdrop-blur-2xl border-r transition-colors ${
                isDark
                    ? "bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 border-cyan-300/20 shadow-[0_0_80px_rgba(34,211,238,0.12)]"
                    : "bg-gradient-to-b from-white/95 via-slate-100/90 to-white/95 border-slate-300/60 shadow-[0_0_40px_rgba(15,23,42,0.08)]"
            }`}
        >
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b to-transparent ${isDark ? "from-cyan-300/10" : "from-sky-200/40"}`} />
                <div className={`absolute top-0 bottom-0 left-[50%] w-px bg-gradient-to-b from-transparent to-transparent ${isDark ? "via-cyan-200/20" : "via-slate-300/70"}`} />
            </div>

            {/* 1. TOP: SYSTEM CORE */}
            <div className="relative group cursor-pointer mt-2">
                <div className={`absolute inset-[-10px] rounded-2xl border border-dashed animate-[spin_14s_linear_infinite] transition-colors ${isDark ? "border-cyan-300/25 group-hover:border-cyan-200/70" : "border-slate-300/70 group-hover:border-sky-400/70"}`}></div>
                <div className={`absolute inset-0 rounded-2xl blur-xl transition-all duration-500 ${isDark ? "bg-cyan-300/20 group-hover:bg-cyan-300/35" : "bg-sky-300/20 group-hover:bg-sky-300/35"}`} />
                <div className={`relative w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-500 ${isDark ? "bg-slate-900/80 border-cyan-200/40 shadow-[0_0_30px_rgba(34,211,238,0.25)]" : "bg-white/90 border-slate-300/80 shadow-[0_6px_18px_rgba(15,23,42,0.12)]"}`}>
                    <Hexagon size={30} className={isDark ? "text-cyan-300" : "text-sky-500"} strokeWidth={1.8} />
                </div>
            </div>

            {/* 2. CENTER: NAVIGATION STACK */}
            <nav className="flex flex-col gap-4 w-full px-6 overflow-y-auto overflow-x-visible custom-scrollbar no-scrollbar" style={{ maxHeight: 'calc(100vh - 170px)' }}>
                {currentMenu.map((item) => (
                    <NavLink key={item.path} to={item.path} className="group relative flex items-center justify-center w-full shrink-0 overflow-visible">
                        {({ isActive }) => (
                            <div className="relative flex items-center justify-center w-16 h-16">
                                {isActive && (
                                    <motion.div
                                        layoutId="activeRail"
                                        className={`absolute inset-0 rounded-2xl border ${isDark ? "bg-cyan-300/15 border-cyan-200/40 shadow-[0_0_24px_rgba(34,211,238,0.35)]" : "bg-sky-100 border-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.35)]"}`}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                {isActive && (
                                    <div className={`absolute -left-6 w-1.5 h-10 rounded-r-full ${isDark ? "bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.7)]" : "bg-sky-500 shadow-[0_0_16px_rgba(14,165,233,0.55)]"}`}></div>
                                )}
                                <div className={`relative z-10 transition-all duration-300 ${isActive ? (isDark ? 'text-cyan-200 scale-110' : 'text-sky-600 scale-110') : (isDark ? 'text-slate-400 group-hover:text-cyan-100 group-hover:scale-110' : 'text-slate-500 group-hover:text-sky-500 group-hover:scale-110')}`}>
                                    <item.icon size={26} strokeWidth={isActive ? 2.1 : 1.8} />
                                </div>
                                <div className="absolute left-full ml-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-[-6px] group-hover:translate-x-0 pointer-events-none z-[70]">
                                    <div className={`px-3 py-1.5 rounded-md shadow-xl backdrop-blur-md border ${isDark ? "bg-slate-900/95 border-cyan-200/30" : "bg-white/95 border-slate-300/70"}`}>
                                        <span className={`text-[10px] font-display tracking-[0.2em] uppercase whitespace-nowrap ${isDark ? "text-cyan-100" : "text-slate-700"}`}>
                                            {item.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* 3. BOTTOM: ACTIONS */}
            <div className="w-full flex flex-col items-center gap-3 pt-2 pb-1">
                <button
                    onClick={onToggleTheme}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center border transition-all duration-300 ${isDark ? "text-slate-300 hover:text-cyan-200 hover:bg-cyan-300/10 border-cyan-200/20 hover:border-cyan-200/40" : "text-slate-600 hover:text-sky-600 hover:bg-sky-200/40 border-slate-300/70 hover:border-sky-300/80"}`}
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                    {theme === "dark" ? <Sun size={23} strokeWidth={1.9} /> : <Moon size={23} strokeWidth={1.9} />}
                </button>
                <button
                    onClick={onLogout}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center border transition-all duration-300 group ${isDark ? "text-slate-400 hover:text-rose-300 hover:bg-rose-400/10 border-transparent hover:border-rose-300/30" : "text-slate-500 hover:text-rose-500 hover:bg-rose-100 border-transparent hover:border-rose-300/70"}`}
                    title="Disconnect System"
                >
                    <LogOut size={24} strokeWidth={1.8} />
                </button>
            </div>

        </motion.aside>
    );
};

export default Sidebar;
