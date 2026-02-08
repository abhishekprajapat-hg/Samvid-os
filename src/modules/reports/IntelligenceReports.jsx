import React from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, PieChart, TrendingUp, Users,
    Target, ArrowUpRight, Award, Download
} from 'lucide-react';

// --- MOCK DATA ---
const KPI_DATA = [
    { title: "Total Revenue", value: "₹4.5 Cr", trend: "+12%", color: "text-emerald-600", icon: TrendingUp },
    { title: "Active Pipeline", value: "580", trend: "+5%", color: "text-blue-600", icon: Target },
    { title: "Conversion Rate", value: "3.2%", trend: "+0.4%", color: "text-purple-600", icon: PieChart },
];

const LEADERBOARD = [
    { rank: 1, name: "Arjun Gupta", revenue: "₹1.2 Cr", deals: 4, avatar: "AG", color: "bg-emerald-100 text-emerald-700" },
    { rank: 2, name: "Meera Nair", revenue: "₹85 L", deals: 3, avatar: "MN", color: "bg-blue-100 text-blue-700" },
    { rank: 3, name: "Rajesh K.", revenue: "₹45 L", deals: 2, avatar: "RK", color: "bg-amber-100 text-amber-700" },
];

const SALES_DATA = [65, 45, 75, 50, 85, 95]; // Heights for bar chart

const StatCard = ({ kpi, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-start justify-between"
    >
        <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.title}</div>
            <div className="text-3xl font-display text-slate-800 mt-2">{kpi.value}</div>
            <div className={`text-xs font-bold mt-2 flex items-center gap-1 ${kpi.color}`}>
                <ArrowUpRight size={14} /> {kpi.trend} <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </div>
        <div className={`p-3 rounded-xl bg-slate-50 ${kpi.color}`}>
            <kpi.icon size={20} />
        </div>
    </motion.div>
);

const IntelligenceReports = () => {
    return (
        <div className="w-full h-full p-8 pt-24 pl-32 pr-32 flex flex-col gap-8 overflow-hidden overflow-y-auto custom-scrollbar">

            {/* 1. HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display text-4xl text-slate-800 tracking-widest">INTELLIGENCE <span className="text-purple-600">REPORTS</span></h1>
                    <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
                        Data Analysis: <span className="text-slate-800 font-bold">February 2026</span>
                    </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:border-purple-500 hover:text-purple-700 transition-all shadow-sm">
                    <Download size={14} /> DOWNLOAD PDF
                </button>
            </div>

            {/* 2. KPI ROW */}
            <div className="grid grid-cols-3 gap-6">
                {KPI_DATA.map((kpi, i) => <StatCard key={i} kpi={kpi} index={i} />)}
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">

                {/* 3. SALES VELOCITY (Bar Chart) */}
                <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Sales Velocity</h3>
                        <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">LAST 6 MONTHS</div>
                    </div>

                    <div className="flex-1 flex items-end justify-between gap-4 px-4">
                        {SALES_DATA.map((height, i) => (
                            <div key={i} className="w-full flex flex-col justify-end gap-2 group cursor-pointer">
                                <div className="text-center opacity-0 group-hover:opacity-100 text-[10px] font-bold text-slate-600 transition-opacity">₹{height}L</div>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden group-hover:bg-purple-100 transition-colors"
                                >
                                    <div className="absolute bottom-0 w-full bg-purple-500 h-2"></div>
                                </motion.div>
                                <div className="text-center text-[10px] text-slate-400 font-mono">M{i + 1}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. LEADERBOARD */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Top Performers</h3>
                        <Award size={16} className="text-amber-500" />
                    </div>

                    <div className="flex-1 space-y-4">
                        {LEADERBOARD.map((agent, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${agent.color}`}>
                                    {agent.avatar}
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-800">{agent.name}</div>
                                    <div className="text-[10px] text-slate-400">{agent.deals} Deals Closed</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-800">{agent.revenue}</div>
                                    <div className="text-[10px] font-bold text-emerald-500">#{agent.rank}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* 5. INVENTORY MIX (Simple CSS Donut) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-8">
                <div className="relative w-32 h-32 rounded-full" style={{ background: 'conic-gradient(#10b981 0% 30%, #fbbf24 30% 50%, #f472b6 50% 100%)' }}>
                    <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                        <span className="text-2xl font-display text-slate-800">142</span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">Units</span>
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-600">Premium</span></div>
                        <div className="text-lg font-display text-slate-800">30%</div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-xs font-bold text-slate-600">Luxury</span></div>
                        <div className="text-lg font-display text-slate-800">20%</div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-pink-500"></div><span className="text-xs font-bold text-slate-600">Affordable</span></div>
                        <div className="text-lg font-display text-slate-800">50%</div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default IntelligenceReports;