import React, { useState, useEffect } from 'react';
import {
    Users, Building2, CheckCircle, Brain,
    MessageSquare, ChevronRight, ChevronLeft, X
} from 'lucide-react';

// --- IMPORT REAL MODULES ---
import AssetVault from '../inventory/AssetVault';
import LeadsMatrix from '../leads/LeadsMatrix'; // <--- This is the key import

const ExecutiveDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [agentName] = useState('Somil Jain');

    const [stats, setStats] = useState({ commission: 0, dealsClosed: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/finance');
                const deals = await response.json();
                const myDeals = deals.filter(d => d.status === 'Closed');
                const totalComm = myDeals.reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);
                setStats({ commission: totalComm, dealsClosed: myDeals.length });
            } catch (err) { console.error("Stats Error", err); }
        };
        fetchStats();
    }, []);

    // --- THE ROUTER LOGIC ---
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <AgentDashboard stats={stats} setTab={setActiveTab} />;

            case 'inventory':
                // This connects the Building Icon to the Asset Vault
                return <div className="h-full w-full overflow-hidden"><AssetVault /></div>;

            case 'leads':
                // This connects the Users Icon to the Leads Matrix
                return <div className="h-full w-full overflow-hidden"><LeadsMatrix /></div>;

            default:
                return <AgentDashboard stats={stats} setTab={setActiveTab} />;
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 overflow-hidden relative pl-24">

            {/* MIDDLE CONTENT AREA */}
            <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300">

                {/* HEADER */}
                <div className="h-20 border-b border-slate-100 bg-white flex justify-between items-center px-8 shrink-0">
                    <div>
                        <h2 className="font-display text-xl text-slate-800">Welcome back, <span className="text-emerald-600">{agentName}</span></h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executive Terminal • Online</p>
                    </div>

                    {/* Tab Indicator */}
                    {activeTab !== 'dashboard' && (
                        <div className="px-4 py-1.5 bg-slate-100 rounded-full text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Currently Viewing: <span className="text-slate-900">{activeTab}</span>
                        </div>
                    )}
                </div>

                {/* CONTENT STAGE */}
                <div className="flex-1 overflow-hidden relative">
                    {activeTab !== 'dashboard' && (
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-full text-slate-500 hover:text-slate-900 shadow-sm flex items-center gap-2 pr-4 text-xs font-bold"
                        >
                            <ChevronLeft size={16} /> Back to Dashboard
                        </button>
                    )}
                    {renderContent()}
                </div>
            </div>

            {/* RIGHT SIDEBAR (Command Stream) */}
            <div
                className={`bg-white border-l border-slate-200 h-full flex flex-col transition-all duration-300 ease-in-out z-20 shadow-xl
        ${isCommandOpen ? 'w-80' : 'w-16 items-center'}
        `}
            >
                <div className={`h-20 border-b border-slate-100 flex items-center ${isCommandOpen ? 'justify-between px-6' : 'justify-center'}`}>
                    {isCommandOpen ? (
                        <>
                            <span className="font-display text-slate-900">Stream</span>
                            <button onClick={() => setIsCommandOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
                        </>
                    ) : (
                        <button onClick={() => setIsCommandOpen(true)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                            <Brain size={20} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                    {isCommandOpen ? (
                        <div className="p-4 space-y-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <Brain size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">System Architect</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    You have active leads pending action.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- DASHBOARD SUB-COMPONENT ---
const AgentDashboard = ({ stats, setTab }) => (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">

            {/* Commission Card */}
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48">
                <div className="relative z-10">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Commission</div>
                    <div className="text-3xl font-display mt-2">₹ {(stats.commission / 100000).toFixed(1)} <span className="text-lg text-slate-500">Lakh</span></div>
                </div>
                <div className="text-xs font-mono text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> {stats.dealsClosed} Deals Closed</div>
            </div>

            {/* Queue Card */}
            <div onClick={() => setTab('leads')} className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all group h-48 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><Users size={24} /></div>
                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">Queue</span>
                </div>
                <div>
                    <div className="text-3xl font-display text-slate-800">12 <span className="text-sm text-slate-400 font-sans font-normal">Active Leads</span></div>
                    <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest group-hover:text-blue-600 flex items-center gap-1">View Matrix <ChevronRight size={10} /></div>
                </div>
            </div>

            {/* Vault Card */}
            <div onClick={() => setTab('inventory')} className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all group h-48 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Building2 size={24} /></div>
                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">Vault</span>
                </div>
                <div>
                    <div className="text-3xl font-display text-slate-800">45 <span className="text-sm text-slate-400 font-sans font-normal">Properties</span></div>
                    <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest group-hover:text-emerald-600 flex items-center gap-1">Open Inventory <ChevronRight size={10} /></div>
                </div>
            </div>
        </div>
    </div>
);

export default ExecutiveDashboard;