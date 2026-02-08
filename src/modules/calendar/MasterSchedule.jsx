import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Calendar as CalIcon,
    Clock, MapPin, User, CheckCircle, AlertCircle,
    Filter, Plus
} from 'lucide-react';

// --- MOCK DATA ---
const EVENTS = [
    { id: 1, title: "Site Visit: Skyline Towers", client: "Arjun Gupta", time: "10:00 AM", type: "visit", status: "confirmed", day: 7 },
    { id: 2, title: "Token Payment Due", client: "Meera Nair", time: "02:00 PM", type: "finance", status: "pending", day: 7 },
    { id: 3, title: "Team Strategy Meet", client: "Internal", time: "09:00 AM", type: "internal", status: "done", day: 7 },
    { id: 4, title: "Key Handover: Unit 402", client: "Mr. Sharma", time: "11:30 AM", type: "handover", status: "upcoming", day: 8 },
    { id: 5, title: "New Project Launch", client: "Grand Villa", time: "All Day", type: "event", status: "confirmed", day: 10 },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATES = Array.from({ length: 35 }, (_, i) => i + 1); // Simple 1-35 grid for demo

const EventCard = ({ event }) => {
    const colors = {
        visit: "bg-emerald-100 text-emerald-700 border-emerald-200",
        finance: "bg-amber-100 text-amber-700 border-amber-200",
        internal: "bg-slate-100 text-slate-700 border-slate-200",
        handover: "bg-purple-100 text-purple-700 border-purple-200",
        event: "bg-blue-100 text-blue-700 border-blue-200",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-2 rounded-lg border text-[10px] font-bold mb-1 cursor-pointer hover:brightness-95 transition-all ${colors[event.type]}`}
        >
            <div className="flex justify-between items-center">
                <span className="truncate">{event.title}</span>
                {event.status === 'done' && <CheckCircle size={8} />}
            </div>
            <div className="font-mono opacity-80 mt-0.5">{event.time}</div>
        </motion.div>
    );
};

const MasterSchedule = () => {
    const [selectedDay, setSelectedDay] = useState(7); // Default to "Today"

    // Filter events for the selected day panel
    const daysEvents = EVENTS.filter(e => e.day === selectedDay);

    return (
        <div className="w-full h-full p-8 pt-24 pl-32 pr-32 flex flex-col gap-6 overflow-hidden">

            {/* 1. HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display text-4xl text-slate-800 tracking-widest">MASTER <span className="text-blue-500">SCHEDULE</span></h1>
                    <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
                        Timeline: <span className="text-slate-800 font-bold">February 2026</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-white border border-slate-200 rounded-full p-1">
                        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={16} /></button>
                        <button className="px-4 py-2 text-xs font-bold text-slate-700">TODAY</button>
                        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={16} /></button>
                    </div>
                    <button className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold tracking-widest hover:bg-blue-600 transition-colors shadow-lg flex items-center gap-2">
                        <Plus size={14} /> NEW EVENT
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">

                {/* 2. CALENDAR GRID (Left) */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                    {/* Days Header */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                        {DAYS.map(day => (
                            <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Date Grid */}
                    <div className="flex-1 grid grid-cols-7 grid-rows-5">
                        {DATES.map((date, i) => {
                            // Adjust logic for "real" calendar month later
                            const dayNum = i + 1;
                            const dayEvents = EVENTS.filter(e => e.day === dayNum);
                            const isSelected = selectedDay === dayNum;
                            const isToday = dayNum === 7; // Mock Today

                            if (dayNum > 30) return null; // Cap at 30 days

                            return (
                                <div
                                    key={dayNum}
                                    onClick={() => setSelectedDay(dayNum)}
                                    className={`border-r border-b border-slate-100 p-2 relative group cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                                >
                                    <div className={`text-xs font-bold mb-2 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : 'text-slate-400 group-hover:text-slate-800'}`}>
                                        {dayNum}
                                    </div>

                                    <div className="space-y-1">
                                        {dayEvents.map(event => (
                                            <div key={event.id} className={`h-1.5 w-full rounded-full ${event.type === 'visit' ? 'bg-emerald-400' : event.type === 'finance' ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. DAY AGENDA PANEL (Right) */}
                <div className="w-80 flex flex-col gap-4">

                    {/* Selected Day Header */}
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                        <div className="text-4xl font-display text-slate-800">
                            0{selectedDay} <span className="text-lg text-slate-400">Feb</span>
                        </div>
                        <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
                            {daysEvents.length} Events Scheduled
                        </div>
                    </div>

                    {/* Event Stream */}
                    <div className="flex-1 bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-4 overflow-y-auto custom-scrollbar space-y-3">
                        {daysEvents.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <CalIcon size={32} className="mb-2 opacity-20" />
                                <span className="text-xs uppercase tracking-widest">No Events</span>
                            </div>
                        ) : (
                            daysEvents.map((event, i) => (
                                <motion.div
                                    key={event.id}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${event.type === 'visit' ? 'bg-emerald-50 text-emerald-600' : event.type === 'finance' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                                            {event.type}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">{event.time}</span>
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm mb-1">{event.title}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                        <User size={10} /> {event.client}
                                    </div>

                                    {event.status === 'confirmed' && (
                                        <div className="mt-3 pt-3 border-t border-slate-50 flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button className="flex-1 py-1.5 bg-slate-50 rounded text-[10px] font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-600">Start</button>
                                            <button className="flex-1 py-1.5 bg-slate-50 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200">Reschedule</button>
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};

export default MasterSchedule;