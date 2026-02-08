import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Map as MapIcon, Navigation, User, Clock,
    Phone, Shield, Search, Filter, X, Zap,
    MapPin, Calendar, CheckCircle, AlertTriangle
} from 'lucide-react';

// --- MOCK DATA ---
const LIVE_AGENTS = [
    {
        id: 1, name: "R. Sharma", status: "On Site", location: "Skyline Towers", battery: "85%", color: "bg-emerald-500", x: 40, y: 30,
        route: ["HQ (09:00)", "Villa 42 (10:15)", "Skyline Towers (Current)"],
        next: "Lunch Break"
    },
    {
        id: 2, name: "V. Singh", status: "Transit", location: "Enroute -> Grand Villa", battery: "42%", color: "bg-amber-500", x: 65, y: 50,
        route: ["Eco City (09:30)", "Grand Villa (ETA 10m)"],
        next: "Client Meeting: Mr. Khan"
    },
    {
        id: 3, name: "A. Patel", status: "Idle", location: "Sector 42 HQ", battery: "90%", color: "bg-slate-400", x: 25, y: 70,
        route: ["HQ (Login 09:00)"],
        next: "Awaiting Dispatch"
    },
];

const SITE_VISITS = [
    { id: 101, agent: "R. Sharma", client: "Mrs. Gupta", property: "Skyline Towers", time: "10:30 AM", status: "In Progress" },
    { id: 102, agent: "V. Singh", client: "Mr. Khan", property: "Grand Villa", time: "11:00 AM", status: "Delayed" },
    { id: 103, agent: "M. Kholi", client: "Dr. Roy", property: "Eco City", time: "02:15 PM", status: "Scheduled" },
];

// --- COMPONENT: AGENT TELEMETRY PANEL ---
const AgentPanel = ({ isOpen, onClose, agent }) => (
    <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isOpen ? "0%" : "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 h-full w-[400px] bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl z-50 flex flex-col"
    >
        {/* Header */}
        {agent && (
            <>
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${agent.color}`}>
                            {agent.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-display text-lg text-slate-800 tracking-wide">{agent.name}</h2>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${agent.color} animate-pulse`}></span>
                                <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">{agent.status}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Battery & Signal Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Zap size={16} /></div>
                            <div>
                                <div className="text-[9px] text-slate-400 uppercase font-bold">Battery</div>
                                <div className="text-sm font-bold text-slate-700">{agent.battery}</div>
                            </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Navigation size={16} /></div>
                            <div>
                                <div className="text-[9px] text-slate-400 uppercase font-bold">GPS</div>
                                <div className="text-sm font-bold text-slate-700">Online</div>
                            </div>
                        </div>
                    </div>

                    {/* Current Location */}
                    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                            <MapPin size={12} /> Live Location
                        </div>
                        <div className="text-lg font-display text-slate-800">{agent.location}</div>
                        <div className="mt-4 h-32 bg-slate-100 rounded-lg overflow-hidden relative grayscale opacity-80">
                            <img src="https://img.freepik.com/free-vector/grey-city-map_1156-98.jpg" className="w-full h-full object-cover" alt="mini map" />
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg ${agent.color}`}></div>
                        </div>
                    </div>

                    {/* Route Timeline */}
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                            <Clock size={12} /> Today's Log
                        </div>
                        <div className="space-y-4 pl-2 relative border-l-2 border-slate-100 ml-2">
                            {agent.route.map((stop, i) => (
                                <div key={i} className="relative pl-6">
                                    <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white ${i === agent.route.length - 1 ? agent.color : 'bg-slate-300'}`}></div>
                                    <div className="text-xs font-bold text-slate-700">{stop}</div>
                                </div>
                            ))}
                            {/* Next Stop (Ghost) */}
                            <div className="relative pl-6 opacity-50">
                                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full border-2 border-slate-300 bg-white ring-4 ring-white"></div>
                                <div className="text-xs font-bold text-slate-700 italic">Next: {agent.next}</div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 grid grid-cols-2 gap-3">
                    <button className="py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs uppercase hover:bg-slate-100 flex items-center justify-center gap-2">
                        <Phone size={14} /> Contact
                    </button>
                    <button className="py-3 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase hover:bg-slate-800 flex items-center justify-center gap-2">
                        <Navigation size={14} /> Re-Route
                    </button>
                </div>
            </>
        )}
    </motion.div>
);

const AgentPin = ({ agent, delay, onClick }) => (
    <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay, type: "spring" }}
        onClick={() => onClick(agent)}
        className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
        style={{ left: `${agent.x}%`, top: `${agent.y}%` }}
    >
        <div className={`absolute inset-0 rounded-full animate-ping opacity-50 ${agent.color}`}></div>
        <div className="relative w-10 h-10 rounded-full border-2 border-white shadow-xl bg-slate-800 flex items-center justify-center overflow-hidden z-10 transition-transform hover:scale-110">
            <span className="text-[10px] font-bold text-white">{agent.name.charAt(0)}</span>
        </div>
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-max bg-white rounded-lg shadow-xl px-2 py-1 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-20">
            <div className="text-[10px] font-bold text-slate-800">{agent.name}</div>
        </div>
    </motion.div>
);

const FieldOps = () => {
    const [selectedAgent, setSelectedAgent] = useState(null);

    return (
        <div className="w-full h-full p-8 pt-24 pl-32 pr-32 flex flex-col gap-6 overflow-hidden relative">

            {/* 1. HEADER */}
            <div className="flex justify-between items-end z-10">
                <div>
                    <h1 className="font-display text-4xl text-slate-800 tracking-widest">FIELD <span className="text-amber-500">OPS</span></h1>
                    <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
                        Live Monitoring: <span className="text-slate-800 font-bold">3 Agents Active</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white border border-slate-200 rounded-full px-4 py-2 flex items-center gap-2 text-xs font-bold text-slate-600 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        GPS SATELLITE LIVE
                    </div>
                    <button className="bg-slate-900 text-white rounded-full px-6 py-2 text-xs font-bold tracking-widest shadow-lg hover:bg-slate-800 transition-colors">
                        + DISPATCH AGENT
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden z-0">

                {/* 2. THE MAP */}
                <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner group">
                    <div className="absolute inset-0 z-0 opacity-60 grayscale contrast-125 mix-blend-multiply">
                        <img src="https://img.freepik.com/free-vector/grey-city-map_1156-98.jpg" alt="City Map" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>

                    {/* Pins */}
                    <div className="absolute inset-0 z-10">
                        {LIVE_AGENTS.map((agent, i) => (
                            <AgentPin key={agent.id} agent={agent} delay={i * 0.2} onClick={setSelectedAgent} />
                        ))}
                    </div>

                    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
                        <button className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 text-slate-600"><Navigation size={18} /></button>
                        <button className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 text-slate-600"><Search size={18} /></button>
                    </div>
                </div>

                {/* 3. SIDE PANEL: ACTIVE VISITS */}
                <div className="w-80 bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl flex flex-col shadow-sm">
                    <div className="p-4 border-b border-slate-200 bg-white/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Visits</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                        {SITE_VISITS.map((visit) => (
                            <div key={visit.id} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">{visit.agent.charAt(0)}</div>
                                        <span className="text-xs font-bold text-slate-800">{visit.agent}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${visit.status === 'Delayed' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{visit.status}</span>
                                </div>
                                <div className="pl-8 border-l-2 border-slate-100 ml-3">
                                    <div className="text-xs font-bold text-slate-700">{visit.property}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1"><User size={10} /> {visit.client}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} /> {visit.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* 4. AGENT TELEMETRY PANEL */}
            <AgentPanel
                isOpen={!!selectedAgent}
                onClose={() => setSelectedAgent(null)}
                agent={selectedAgent}
            />

        </div>
    );
};

export default FieldOps;