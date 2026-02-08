import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutGrid, Users, Building2, Map, LogOut,
    PieChart, Settings, ClipboardList, Calendar,
    Navigation, ShieldCheck, Briefcase, Hexagon
} from 'lucide-react';
import { motion } from 'framer-motion';

// --- MENU CONFIGURATION ---
const MENU_CONFIG = {
    admin: [
        { name: 'Command', icon: LayoutGrid, path: '/' },
        { name: 'Finance', icon: PieChart, path: '/finance' },
        { name: 'Empire', icon: Building2, path: '/inventory' },
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
        { name: 'Team', icon: ShieldCheck, path: '/admin/users' },
        { name: 'Reports', icon: ClipboardList, path: '/reports' },
        { name: 'System', icon: Settings, path: '/settings' }, // <--- ADDED THIS LINE
    ],
    executive: [
        { name: 'My Desk', icon: Briefcase, path: '/' },
        { name: 'My Leads', icon: Users, path: '/my-leads' },
        { name: 'Schedule', icon: Calendar, path: '/calendar' },
        { name: 'Targets', icon: PieChart, path: '/targets' },
    ],
    field_agent: [
        { name: 'Route', icon: Map, path: '/' },
        { name: 'Visits', icon: Navigation, path: '/visits' },
        { name: 'Entry', icon: ClipboardList, path: '/data-entry' },
    ]
};

const Sidebar = ({ userRole = 'manager', onLogout }) => {
    const currentMenu = MENU_CONFIG[userRole] || MENU_CONFIG.manager;

    return (
        <motion.aside
            initial={{ x: -100 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="fixed left-0 top-0 h-full w-24 z-50 flex flex-col justify-between items-center py-8 bg-white/60 backdrop-blur-xl border-r border-slate-200 shadow-glass-light"
        >
            {/* 1. TOP: SYSTEM CORE */}
            <div className="relative group cursor-pointer">
                <div className="absolute inset-[-8px] rounded-full border border-gem-cyan/30 border-dashed animate-[spin_10s_linear_infinite] group-hover:border-gem-cyan/60"></div>
                <div className="w-12 h-12 rounded-xl bg-white/80 border border-white/50 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-500">
                    <Hexagon size={24} className="text-gem-cyan" strokeWidth={1.5} />
                </div>
            </div>

            {/* 2. CENTER: NAVIGATION STACK */}
            <nav className="flex flex-col gap-4 w-full px-4 overflow-y-auto custom-scrollbar no-scrollbar" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                {currentMenu.map((item) => (
                    <NavLink key={item.path} to={item.path} className="group relative flex items-center justify-center w-full shrink-0">
                        {({ isActive }) => (
                            <div className="relative flex items-center justify-center w-12 h-12">
                                {isActive && (
                                    <motion.div
                                        layoutId="activeRail"
                                        className="absolute inset-0 bg-gem-cyan/10 rounded-xl border border-gem-cyan/20"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                {isActive && (
                                    <div className="absolute -left-6 w-1 h-8 bg-gem-cyan rounded-r-full"></div>
                                )}
                                <div className={`relative z-10 transition-all duration-300 ${isActive ? 'text-gem-cyan scale-110' : 'text-text-tertiary group-hover:text-text-primary group-hover:scale-110'}`}>
                                    <item.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                                </div>
                                <div className="absolute left-14 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-[-10px] group-hover:translate-x-2 pointer-events-none z-50">
                                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-lg backdrop-blur-md">
                                        <span className="text-[10px] font-display tracking-[0.2em] text-text-primary uppercase whitespace-nowrap">
                                            {item.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* 3. BOTTOM: DISCONNECT */}
            <div className="w-full flex justify-center pt-2">
                <button
                    onClick={onLogout}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-text-tertiary hover:text-gem-pink hover:bg-gem-pink/10 transition-all duration-300 group"
                    title="Disconnect System"
                >
                    <LogOut size={20} strokeWidth={1.5} />
                </button>
            </div>

        </motion.aside>
    );
};

export default Sidebar;