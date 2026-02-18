import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Building2,
  Clock3,
  Handshake,
  Loader,
  MapPin,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

const ManagerDashboard = ({ theme = "dark" }) => {
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    revenue: 0,
    leads: 0,
    assets: 0,
    negotiation: 0,
    closed: 0,
    visits: 0,
  });

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setError("");

        const [leadsRes, inventoryRes] = await Promise.all([
          api.get("/leads"),
          api.get("/inventory"),
        ]);

        const leadsData = leadsRes?.data?.leads || [];
        const inventoryAssets = inventoryRes?.data?.assets || [];

        const closedLeadCount = leadsData.filter((lead) => lead.status === "CLOSED").length;
        const siteVisitCount = leadsData.filter((lead) => lead.status === "SITE_VISIT").length;
        const negotiationCount = leadsData.filter((lead) =>
          ["CONTACTED", "INTERESTED", "SITE_VISIT"].includes(lead.status),
        ).length;

        const totalRevenue = closedLeadCount * 75000;

        setStats({
          revenue: totalRevenue,
          leads: leadsData.length,
          assets: Array.isArray(inventoryAssets) ? inventoryAssets.length : 0,
          negotiation: negotiationCount,
          closed: closedLeadCount,
          visits: siteVisitCount,
        });
      } catch (err) {
        const message = toErrorMessage(err);
        console.error("Dashboard fetch error:", message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, []);

  const derived = useMemo(() => {
    const conversionPercent = stats.leads ? Math.round((stats.closed / stats.leads) * 100) : 0;
    const activePipeline = Math.max(stats.leads - stats.closed, 0);
    const avgTicket = stats.closed ? Math.round(stats.revenue / stats.closed) : 0;
    const visitShare = stats.leads ? Math.round((stats.visits / stats.leads) * 100) : 0;
    const negotiationShare = stats.leads ? Math.round((stats.negotiation / stats.leads) * 100) : 0;

    return {
      conversionPercent,
      activePipeline,
      avgTicket,
      visitShare,
      negotiationShare,
    };
  }, [stats]);

  const kpiCards = useMemo(
    () => [
      {
        label: "Estimated Revenue",
        value: `Rs ${(stats.revenue / 100000).toFixed(2)}L`,
        helper: `${stats.closed} closed x Rs 75k`,
        icon: Activity,
        tone: isDark ? "text-cyan-200" : "text-cyan-700",
        accent: isDark
          ? "border-cyan-400/30 from-cyan-500/20 to-slate-900/0"
          : "border-cyan-200 from-cyan-100 to-white",
      },
      {
        label: "Total Leads",
        value: stats.leads,
        helper: `${derived.activePipeline} still in pipeline`,
        icon: Users,
        tone: isDark ? "text-violet-200" : "text-violet-700",
        accent: isDark
          ? "border-violet-400/30 from-violet-500/20 to-slate-900/0"
          : "border-violet-200 from-violet-100 to-white",
      },
      {
        label: "Inventory Assets",
        value: stats.assets,
        helper: `${derived.conversionPercent}% close efficiency`,
        icon: Building2,
        tone: isDark ? "text-emerald-200" : "text-emerald-700",
        accent: isDark
          ? "border-emerald-400/30 from-emerald-500/20 to-slate-900/0"
          : "border-emerald-200 from-emerald-100 to-white",
      },
    ],
    [derived.activePipeline, derived.conversionPercent, isDark, stats],
  );

  const pipelineCards = useMemo(
    () => [
      {
        label: "Negotiation",
        value: stats.negotiation,
        progress: derived.negotiationShare,
        icon: Handshake,
        bar: "from-cyan-500 to-blue-500",
      },
      {
        label: "Site Visits",
        value: stats.visits,
        progress: derived.visitShare,
        icon: MapPin,
        bar: "from-violet-500 to-pink-500",
      },
      {
        label: "Closed Deals",
        value: stats.closed,
        progress: derived.conversionPercent,
        icon: Zap,
        bar: "from-emerald-500 to-teal-500",
      },
      {
        label: "Conversion",
        value: `${derived.conversionPercent}%`,
        progress: derived.conversionPercent,
        icon: Target,
        bar: "from-amber-500 to-orange-500",
      },
    ],
    [derived.conversionPercent, derived.negotiationShare, derived.visitShare, stats],
  );

  const deckChips = useMemo(
    () => [
      {
        label: "Active Pipeline",
        value: derived.activePipeline,
      },
      {
        label: "Visit Intensity",
        value: `${derived.visitShare}%`,
      },
      {
        label: "Avg Closed Ticket",
        value: derived.avgTicket ? `Rs ${(derived.avgTicket / 1000).toFixed(1)}k` : "Rs 0",
      },
    ],
    [derived.activePipeline, derived.avgTicket, derived.visitShare],
  );

  const funnelSignals = useMemo(
    () => [
      {
        label: "Negotiation Load",
        value: `${stats.negotiation}/${stats.leads || 0}`,
        progress: derived.negotiationShare,
        bar: "from-cyan-500 to-blue-500",
      },
      {
        label: "Visit Momentum",
        value: `${stats.visits}/${stats.leads || 0}`,
        progress: derived.visitShare,
        bar: "from-violet-500 to-pink-500",
      },
      {
        label: "Close Momentum",
        value: `${stats.closed}/${stats.leads || 0}`,
        progress: derived.conversionPercent,
        bar: "from-emerald-500 to-teal-500",
      },
    ],
    [derived.conversionPercent, derived.negotiationShare, derived.visitShare, stats.closed, stats.leads, stats.negotiation, stats.visits],
  );

  const containerMotion = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.42, ease: "easeOut", staggerChildren: 0.08 },
    },
  };

  const itemMotion = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
  };

  if (loading) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center gap-2 ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <Loader className="animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerMotion}
      className={`relative h-full w-full overflow-y-auto px-4 pt-20 pb-10 sm:px-6 md:pt-24 lg:px-10 ${
        isDark ? "bg-slate-950/40" : "bg-slate-50/70"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className={`absolute -left-12 top-2 h-56 w-56 rounded-full blur-3xl ${isDark ? "bg-cyan-500/20" : "bg-cyan-300/35"}`} />
        <div className={`absolute right-0 top-24 h-64 w-64 rounded-full blur-3xl ${isDark ? "bg-violet-500/20" : "bg-violet-300/30"}`} />
      </div>

      <motion.section
        variants={itemMotion}
        className={`rounded-3xl border px-5 py-6 sm:px-7 ${
          isDark
            ? "border-slate-700/70 bg-slate-900/75 shadow-[0_30px_80px_-55px_rgba(56,189,248,0.65)]"
            : "border-slate-200 bg-white/90 shadow-[0_30px_80px_-55px_rgba(8,145,178,0.55)]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
              isDark
                ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                : "border-cyan-200 bg-cyan-50 text-cyan-700"
            }`}>
              <Sparkles size={12} />
              Command Deck
            </div>
            <h1 className={`mt-4 font-display text-2xl sm:text-4xl ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Control Home
            </h1>
            <p className={`mt-2 text-xs uppercase tracking-[0.24em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Clean real-time snapshot
            </p>
          </div>

          <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
              isDark
                ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-200"
                : "border-cyan-200 bg-cyan-50 text-cyan-700"
            }`}>
              <BarChart3 size={14} />
              Auto refreshed from leads and inventory
            </div>
            <div className={`flex items-center justify-end gap-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <Clock3 size={12} />
              Live sync active
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {deckChips.map((chip) => (
            <div
              key={chip.label}
              className={`rounded-2xl border px-4 py-3 ${
                isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50/80"
              }`}
            >
              <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {chip.label}
              </p>
              <p className={`mt-2 text-2xl font-display ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {chip.value}
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      {error && (
        <motion.div
          variants={itemMotion}
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            isDark
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-amber-300 bg-amber-50 text-amber-700"
          }`}
        >
          {error}
        </motion.div>
      )}

      <motion.section variants={itemMotion} className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${
              isDark ? "bg-slate-900/85" : "bg-white"
            } ${card.accent}`}
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl ${
              isDark ? "bg-white/10" : "bg-white/60"
            }`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                  {card.label}
                </p>
                <card.icon size={16} className={card.tone} />
              </div>
              <p className={`mt-3 text-3xl font-display ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                {card.value}
              </p>
              <p className={`mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {card.helper}
              </p>
            </div>
          </div>
        ))}
      </motion.section>

      <motion.section variants={itemMotion} className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div
          className={`rounded-2xl border p-4 sm:p-5 ${
            isDark ? "border-slate-700/80 bg-slate-900/70" : "border-slate-200 bg-white/90"
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Pipeline Snapshot
            </h2>
            <span className={`text-xs uppercase tracking-[0.16em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Status-wise distribution
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pipelineCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border p-4 ${
                  isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {card.label}
                  </p>
                  <card.icon size={14} className={isDark ? "text-cyan-300" : "text-cyan-700"} />
                </div>
                <p className={`mt-2 text-2xl font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                  {card.value}
                </p>
                <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${card.bar}`}
                    style={{ width: `${Math.min(card.progress, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 sm:p-5 ${
            isDark ? "border-slate-700/80 bg-slate-900/70" : "border-slate-200 bg-white/90"
          }`}
        >
          <div className="mb-4">
            <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Conversion Engine
            </p>
            <h3 className={`mt-1 text-2xl font-display ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              {derived.conversionPercent}%
            </h3>
          </div>

          <div className="space-y-4">
            {funnelSignals.map((signal) => (
              <div key={signal.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className={isDark ? "text-slate-300" : "text-slate-600"}>{signal.label}</span>
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>{signal.value}</span>
                </div>
                <div className={`h-2 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${signal.bar}`}
                    style={{ width: `${Math.min(signal.progress, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default ManagerDashboard;
