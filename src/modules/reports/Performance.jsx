import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Target, TrendingUp, Award, Calendar,
    ArrowUpRight, ChevronDown, CheckCircle, X
} from 'lucide-react';

const Performance = () => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        dealsClosed: 0,
        conversionRate: 0,
        targetProgress: 0
    });

    // TARGET SETTINGS (You can make these dynamic later)
    const MONTHLY_TARGET = 500000; // 5 Lakhs Commission Target
    const LEADS_TARGET = 20;

    useEffect(() => {
        fetchPerformanceData();
    }, []);

    const fetchPerformanceData = async () => {
        try {
            // 1. Fetch Finance & Leads
            const [resFinance, resLeads] = await Promise.all([
                fetch('http://localhost:5000/api/finance'),
                fetch('http://localhost:5000/api/leads')
            ]);

            const deals = await resFinance.json();
            const leads = await resLeads.json();

            // 2. Calculate Real Metrics
            const closedDeals = deals.filter(d => d.status === 'Closed');
            const totalCommission = closedDeals.reduce((acc, curr) => acc + (curr.commissionAmount || 0), 0);

            // Calculate Conversion %
            const conversion = leads.length > 0 ? ((closedDeals.length / leads.length) * 100).toFixed(1) : 0;

            // Calculate Target Progress %
            const progress = Math.min(((totalCommission / MONTHLY_TARGET) * 100).toFixed(1), 100);

            setMetrics({
                totalRevenue: totalCommission,
                dealsClosed: closedDeals.length,
                conversionRate: conversion,
                targetProgress: progress,
                totalLeads: leads.length
            });

            setLoading(false);
        } catch (error) {
            console.error("Error loading performance:", error);
            setLoading(false);
        }
    };

    return (
        <div className="p-8 pt-24 pl-32 pr-12 w-full h-full overflow-hidden flex flex-col bg-slate-50/50">

            {/* HEADER */}
            <div className="mb-10">
                <h1 className="font-display text-4xl text-slate-900 tracking-tight">PERFORMANCE <span className="text-emerald-600">INSIGHTS</span></h1>
                <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">Real-time Agent Analytics</p>
            </div>

            <div className="grid grid-cols-12 gap-8 h-full pb-10">

                {/* LEFT COLUMN: MAIN TARGETS */}
                <div className="col-span-8 flex flex-col gap-8">

                    {/* 1. REVENUE TARGET CARD */}
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Monthly Commission Goal</h3>
                                <div className="text-5xl font-display text-slate-900">
                                    ₹ {metrics.totalRevenue.toLocaleString()} <span className="text-xl text-slate-300">/ {MONTHLY_TARGET.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                <Target size={32} />
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${metrics.targetProgress}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            />
                        </div>
                        <p className="text-right text-xs font-bold text-emerald-600">{metrics.targetProgress}% Achieved</p>
                    </motion.div>

                    {/* 2. STATS GRID */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
                            <div className="flex items-center gap-3 text-slate-400 mb-2">
                                <TrendingUp size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Conversion Rate</span>
                            </div>
                            <div className="text-4xl font-display text-slate-800">{metrics.conversionRate}%</div>
                            <div className="text-xs text-slate-400">Based on {metrics.totalLeads} total leads</div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-40">
                            <div className="flex items-center gap-3 text-slate-400 mb-2">
                                <Award size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Deals Closed</span>
                            </div>
                            <div className="text-4xl font-display text-emerald-600">{metrics.dealsClosed}</div>
                            <div className="text-xs text-slate-400">Transactions Completed</div>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: MOTIVATION / FEED */}
                <div className="col-span-4 flex flex-col h-full">
                    <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl flex-1 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">System Analysis</h3>

                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="mt-1"><CheckCircle className="text-emerald-400" size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">On Track</h4>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">You are currently performing within the top 15% of agents for this quarter.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="mt-1"><ArrowUpRight className="text-cyan-400" size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">Recommendation</h4>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">Focus on closing the "Sharma - Apollo" deal to hit your 5L target.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Decorative Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Performance;