import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutGrid, Users, Building2, PieChart,
    Search, Bell, Menu, LogOut, CheckCircle, Clock
} from 'lucide-react';

// --- IMPORT THE REAL MODULES ---
import AssetVault from '../inventory/AssetVault';
import LeadsMatrix from '../leads/LeadsMatrix';
// We will build a mini-performance view inside here since FinancialCore is for managers

const ClientHome = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [agentName, setAgentName] = useState('Somil Jain'); // Placeholder until Auth is fully active

    // --- REAL DATA STATES ---
    const [stats, setStats] = useState({
        commission: 0,
        dealsClosed: 0,
        target: 15000000 // 1.5 Cr Target
    });

    // Fetch Agent Performance Data
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/finance');
                const deals = await response.json();

                // Calculate stats for "Closed" deals
                const myDeals = deals.filter(d => d.status === 'Closed');
                const totalComm = myDeals.reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

                setStats({
                    commission: totalComm,
                    dealsClosed: myDeals.length,
                    target: 15000000
                });
            } catch (err) {
                console.error("Stats Error", err);
            }
        };
        fetchStats();
    }, []);

    // --- RENDER CONTENT BASED ON TAB ---
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <AgentDashboard stats={stats} setTab={setActiveTab} />;
            case 'inventory':
                return <div className="h-full w-full"><AssetVault /></div>; // Reusing the Real Inventory
            case 'leads':
                return <div className="h-full w-full"><LeadsMatrix /></div>; // Reusing the Real Leads
            case 'performance':
                return <div className="flex items-center justify-center h-full text-slate-400">Performance Analytics Module (Coming Soon)</div>;
            default:
                return <AgentDashboard stats={stats} setTab={setActiveTab} />;
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">

            {/* 1. COMPACT SIDEBAR (The Navigation) */}
            <div className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 z-20 shadow-sm">
                <div className="mb-12">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xs">
                        OS
                    </div>
                </div>

                <nav className="flex-1 flex flex-col gap-6 w-full px-4">
                    <NavIcon icon={LayoutGrid} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} tooltip="Overview" />
                    <NavIcon icon={Users} active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} tooltip="My Leads" />
                    <NavIcon icon={Building2} active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} tooltip="Inventory" />
                    <NavIcon icon={PieChart} active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} tooltip="Performance" />
                </nav>

                <div className="mt-auto">
                    <button className="p-3 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
                </div>
            </div>

            {/* 2. MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col h-full relative">

                {/* TOP BAR (Command Center) */}
                <div className="h-20 border-b border-slate-100 bg-white/80 backdrop-blur-md flex justify-between items-center px-8 z-10 absolute top-0 w-full">
                    <div>
                        <h2 className="font-display text-xl text-slate-800">Welcome back, <span className="text-emerald-600">{agentName}</span></h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executive Terminal • Online</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input type="text" placeholder="Global Search..." className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs w-64 focus:outline-none focus:border-emerald-500" />
                        </div>
                        <button className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-emerald-600 relative">
                            <Bell size={18} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-slate-900 rounded-full"></div>
                    </div>
                </div>

                {/* DYNAMIC CONTENT STAGE */}
                <div className="flex-1 pt-20 overflow-hidden">
                    {renderContent()}
                </div>

            </div>
        </div>
    );
};

// --- SUB-COMPONENT: AGENT DASHBOARD ---
const AgentDashboard = ({ stats, setTab }) => (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
        {/* KPI CARDS */}
        <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Commission</div>
                    <div className="text-4xl font-display">₹ {(stats.commission / 100000).toFixed(1)} <span className="text-lg text-slate-500">Lakh</span></div>
                    <div className="mt-4 text-xs font-mono text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> {stats.dealsClosed} Deals Closed</div>
                </div>
                {/* Decorative BG */}
                <div className="absolute right-[-20px] bottom-[-20px] opacity-10"><PieChart size={120} /></div>
            </div>

            <div onClick={() => setTab('leads')} className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><Users size={24} /></div>
                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">Queue</span>
                </div>
                <div className="text-3xl font-display text-slate-800">12 <span className="text-sm text-slate-400 font-sans font-normal">Active Leads</span></div>
                <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest group-hover:text-blue-600">View Lead Matrix →</div>
            </div>

            <div onClick={() => setTab('inventory')} className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Building2 size={24} /></div>
                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">Vault</span>
                </div>
                <div className="text-3xl font-display text-slate-800">45 <span className="text-sm text-slate-400 font-sans font-normal">Properties</span></div>
                <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest group-hover:text-emerald-600">Open Inventory →</div>
            </div>
        </div>

        {/* RECENT ACTIVITY (Placeholder for visual completeness) */}
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Updates</h3>
        <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
            {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <div className="flex-1">
                        <div className="text-sm font-bold text-slate-700">New Lead Assigned: Rahul Sharma</div>
                        <div className="text-xs text-slate-400">Looking for 3BHK in Vijay Nagar • Budget 1.2 Cr</div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase">2m ago</div>
                </div>
            ))}
        </div>
    </div>
);

// --- HELPER COMPONENT: NAV ICON ---
const NavIcon = ({ icon: Icon, active, onClick, tooltip }) => (
    <button
        onClick={onClick}
        className={`w-full aspect-square flex items-center justify-center rounded-2xl transition-all duration-300 relative group
      ${active ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}
    `}
    >
        <Icon size={20} />
        {/* Tooltip */}
        <span className="absolute left-14 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {tooltip}
        </span>
    </button>
);

export default ClientHome;