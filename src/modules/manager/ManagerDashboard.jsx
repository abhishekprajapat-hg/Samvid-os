import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin, Building2, Zap, Activity, Handshake, Loader } from 'lucide-react';

// --- CONFIG ---
const ORBIT_RADIUS = 280;
const NODE_SIZE = 100;

// LIGHT MODE THEMES
const THEMES = {
    cyan: {
        gradient: "from-cyan-50 to-cyan-100",
        border: "border-cyan-200",
        icon: "text-cyan-600",
        glow: "shadow-[0_4px_20px_rgba(34,211,238,0.2)]",
        solid: "#0891b2"
    },
    gold: {
        gradient: "from-amber-50 to-amber-100",
        border: "border-amber-200",
        icon: "text-amber-600",
        glow: "shadow-[0_4px_20px_rgba(251,191,36,0.2)]",
        solid: "#d97706"
    },
    pink: {
        gradient: "from-pink-50 to-pink-100",
        border: "border-pink-200",
        icon: "text-pink-600",
        glow: "shadow-[0_4px_20px_rgba(244,114,182,0.2)]",
        solid: "#be185d"
    },
    violet: {
        gradient: "from-violet-50 to-violet-100",
        border: "border-violet-200",
        icon: "text-violet-600",
        glow: "shadow-[0_4px_20px_rgba(167,139,250,0.2)]",
        solid: "#7c3aed"
    },
    emerald: {
        gradient: "from-emerald-50 to-emerald-100",
        border: "border-emerald-200",
        icon: "text-emerald-600",
        glow: "shadow-[0_4px_20px_rgba(52,211,153,0.2)]",
        solid: "#059669"
    }
};

// --- VISUAL COMPONENTS ---

const LuminousNode = ({ icon: Icon, label, value, theme, angle }) => {
    const style = THEMES[theme];
    const radian = (angle * Math.PI) / 180;
    const x = Math.cos(radian) * ORBIT_RADIUS;
    const y = Math.sin(radian) * ORBIT_RADIUS;

    return (
        <div className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center pointer-events-auto" style={{ transform: `translate(${x}px, ${y}px)` }}>
            <div className="animate-[spin_120s_linear_infinite_reverse] group cursor-pointer">
                {/* Subtle Aura */}
                <div className="absolute inset-[-20px] rounded-full blur-[40px] opacity-10 group-hover:opacity-30 transition-opacity duration-700" style={{ backgroundColor: style.solid }}></div>

                {/* THE NODE */}
                <div className={`
          relative flex flex-col items-center justify-center 
          rounded-full backdrop-blur-md bg-white/80 
          border transition-all duration-500 ease-out
          group-hover:scale-110 group-hover:bg-white
          ${style.gradient} ${style.border} ${style.glow}
        `} style={{ width: NODE_SIZE, height: NODE_SIZE }}>

                    <Icon size={32} strokeWidth={1.5} className={`${style.icon} mb-1 transition-transform group-hover:-translate-y-1`} />
                    <span className="font-display font-bold text-2xl text-slate-800 tracking-wider leading-none drop-shadow-sm">{value}</span>

                    <div className="absolute -bottom-10 opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        <span className="text-[10px] font-sans font-bold tracking-[0.3em] uppercase" style={{ color: style.solid }}>{label}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RadiantSun = ({ revenue }) => {
    // Format Revenue: If > 1 Cr use Cr, else use Lakhs
    const displayRev = revenue > 10000000
        ? `${(revenue / 10000000).toFixed(2)}`
        : `${(revenue / 100000).toFixed(2)}`;

    const unit = revenue > 10000000 ? "Cr" : "L";

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto">
            <div className="relative w-96 h-96 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-sky-200/40 blur-[80px] animate-pulse"></div>
                <div className="absolute inset-20 rounded-full border border-sky-500/20 border-dashed animate-[spin_40s_linear_infinite]"></div>

                <motion.div whileHover={{ scale: 1.05 }} className="relative w-60 h-60 rounded-full flex flex-col items-center justify-center overflow-hidden z-30 cursor-pointer shadow-2xl shadow-sky-200" style={{ background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f0f9ff 40%, #bae6fd 100%)' }}>
                    <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                    <span className="font-sans text-[10px] tracking-[0.6em] text-slate-500 uppercase z-10 mb-3 font-bold">Revenue</span>

                    {/* REAL REVENUE NUMBER */}
                    <h1 className="font-display text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-sky-700 z-10 tracking-tighter drop-shadow-sm">
                        {displayRev}<span className="text-2xl text-sky-600 ml-1 align-top">{unit}</span>
                    </h1>

                    <div className="mt-4 px-5 py-2 rounded-full bg-white/60 border border-sky-200 text-sky-800 text-[10px] font-bold tracking-widest z-10 flex items-center gap-2 backdrop-blur-md shadow-sm">
                        <Activity size={12} className="text-sky-600" /> +100%
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD (CONNECTED) ---
const ManagerDashboard = ({ isFeedOpen }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        leads: 0,
        assets: 0,
        negotiation: 0,
        closed: 0,
        visits: 0
    });

    // --- FETCH REAL DATA ---
    useEffect(() => {
        const fetchRealData = async () => {
            try {
                // Fetch All 3 Modules
                const [resLeads, resFinance, resAssets] = await Promise.all([
                    fetch('http://localhost:5000/api/leads'),
                    fetch('http://localhost:5000/api/finance'),
                    fetch('http://localhost:5000/api/properties')
                ]);

                const leadsData = await resLeads.json();
                const financeData = await resFinance.json();
                const assetsData = await resAssets.json();

                // Calculate Stats
                const closedDeals = financeData.filter(d => d.status === 'Closed');
                const negotiationDeals = financeData.filter(d => d.status === 'Negotiation');

                const totalRevenue = closedDeals.reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

                setStats({
                    revenue: totalRevenue,
                    leads: leadsData.length,      // Real Lead Count
                    assets: assetsData.length,    // Real Property Count
                    negotiation: negotiationDeals.length,
                    closed: closedDeals.length,
                    visits: Math.floor(leadsData.length * 0.8) // Mocking visits based on active leads for now
                });

                setLoading(false);

            } catch (err) {
                console.error("Solar Core Error:", err);
                setLoading(false);
            }
        };

        fetchRealData();
    }, []);

    if (loading) return <div className="flex h-full w-full items-center justify-center text-slate-400 gap-2"><Loader className="animate-spin" /> System Initializing...</div>;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative w-full h-full flex justify-center items-center overflow-hidden bg-slate-50/50"
            style={{ x: isFeedOpen ? -150 : 0, transition: "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
        >
            {/* Background Rings */}
            <div className="absolute w-[560px] h-[560px] rounded-full border border-slate-300 opacity-40"></div>
            <div className="absolute w-[850px] h-[850px] rounded-full border border-slate-300 border-dashed opacity-30"></div>

            {/* THE SUN (Real Revenue) */}
            <RadiantSun revenue={stats.revenue} />

            {/* THE ORBITING NODES (Real Counts) */}
            <div className="absolute w-[560px] h-[560px] rounded-full animate-[spin_120s_linear_infinite] pointer-events-none z-40">

                {/* 1. Leads Node (Cyan) */}
                <LuminousNode angle={270} theme="cyan" icon={Users} label="Leads" value={stats.leads} />

                {/* 2. Negotiation Node (Gold) */}
                <LuminousNode angle={342} theme="gold" icon={Handshake} label="Negot." value={stats.negotiation} />

                {/* 3. Visits Node (Pink) */}
                <LuminousNode angle={54} theme="pink" icon={MapPin} label="Visits" value={stats.visits} />

                {/* 4. Closed Node (Violet) */}
                <LuminousNode angle={126} theme="violet" icon={Zap} label="Closed" value={stats.closed} />

                {/* 5. Assets Node (Emerald) */}
                <LuminousNode angle={198} theme="emerald" icon={Building2} label="Assets" value={stats.assets} />

            </div>
        </motion.div>
    );
};

export default ManagerDashboard;