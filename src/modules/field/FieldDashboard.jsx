import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin, Navigation, Calendar, CheckCircle,
    Phone, User, Clock, ChevronRight, Menu
} from 'lucide-react';

const FieldDashboard = () => {
    const [activeTab, setActiveTab] = useState('tasks');
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- MOCK DATA FOR FIELD OPS (Since we don't have GPS yet) ---
    // In a real app, this would fetch from /api/visits
    useEffect(() => {
        setTimeout(() => {
            setVisits([
                { id: 1, type: 'visit', client: 'Amit Gupta', time: '10:00 AM', location: 'Skyline Towers', status: 'pending', lat: 22.7196, lng: 75.8577 },
                { id: 2, type: 'meeting', client: 'Rohan Mehta', time: '02:30 PM', location: 'Grand Villa 42', status: 'pending', lat: 22.7533, lng: 75.8937 },
                { id: 3, type: 'key_pickup', client: 'Office HQ', time: '05:00 PM', location: 'Vijay Nagar', status: 'done', lat: 22.7441, lng: 75.8724 }
            ]);
            setLoading(false);
        }, 1000);
    }, []);

    const completeTask = (id) => {
        setVisits(visits.map(v => v.id === id ? { ...v, status: 'done' } : v));
    };

    return (
        <div className="h-full w-full bg-slate-100 flex justify-center overflow-hidden">

            {/* MOBILE CONTAINER SIMULATION */}
            {/* In a real phone, this div fills the screen. On desktop, it looks like a phone app. */}
            <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col relative overflow-hidden">

                {/* APP HEADER */}
                <div className="h-20 bg-slate-900 text-white p-6 flex justify-between items-center z-10 shrink-0">
                    <div>
                        <h2 className="font-display text-lg tracking-wider">FIELD <span className="text-emerald-400">OPS</span></h2>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            GPS Active
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                        <User size={20} />
                    </div>
                </div>

                {/* MAP PLACEHOLDER AREA */}
                <div className="h-48 bg-emerald-50 relative border-b border-emerald-100">
                    {/* Decorative Map Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>

                    <div className="absolute inset-0 flex items-center justify-center flex-col text-emerald-800/50">
                        <Navigation size={48} className="mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Live Tracking Enabled</span>
                    </div>

                    {/* Floating 'Next Stop' Card */}
                    <div className="absolute -bottom-6 left-6 right-6 bg-white p-4 rounded-xl shadow-lg border border-slate-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Next Stop • 15 mins</div>
                            <div className="text-sm font-bold text-slate-800">Skyline Towers</div>
                        </div>
                        <button className="ml-auto bg-blue-600 text-white p-2 rounded-lg text-xs font-bold shadow-md shadow-blue-200">
                            NAV
                        </button>
                    </div>
                </div>

                {/* TASK LIST SCROLL AREA */}
                <div className="flex-1 overflow-y-auto pt-10 pb-20 px-6 bg-slate-50">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Today's Route</h3>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center text-slate-400 py-10 text-xs">Loading Route...</div>
                        ) : (
                            visits.map((task) => (
                                <motion.div
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    key={task.id}
                                    className={`bg-white p-4 rounded-2xl border transition-all ${task.status === 'done' ? 'border-emerald-200 opacity-60' : 'border-slate-200 shadow-sm'}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${task.type === 'visit' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                                                {task.type.replace('_', ' ')}
                                            </span>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                                <Clock size={10} /> {task.time}
                                            </div>
                                        </div>
                                        {task.status === 'done' && <CheckCircle size={16} className="text-emerald-500" />}
                                    </div>

                                    <h4 className="font-bold text-slate-800 text-sm mb-1">{task.client}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                                        <MapPin size={10} /> {task.location}
                                    </p>

                                    {task.status !== 'done' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button className="py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-200 flex items-center justify-center gap-2">
                                                <Phone size={12} /> Call
                                            </button>
                                            <button
                                                onClick={() => completeTask(task.id)}
                                                className="py-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-600 transition-colors shadow-lg"
                                            >
                                                Check In
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* BOTTOM NAV BAR */}
                <div className="h-16 bg-white border-t border-slate-100 flex justify-around items-center absolute bottom-0 w-full z-20">
                    <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center gap-1 ${activeTab === 'tasks' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <CheckCircle size={20} />
                        <span className="text-[9px] font-bold uppercase">Tasks</span>
                    </button>
                    <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-1 ${activeTab === 'map' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <MapPin size={20} />
                        <span className="text-[9px] font-bold uppercase">Map</span>
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`flex flex-col items-center gap-1 ${activeTab === 'schedule' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <Calendar size={20} />
                        <span className="text-[9px] font-bold uppercase">Plan</span>
                    </button>
                </div>

            </div>
        </div>
    );
};

export default FieldDashboard;