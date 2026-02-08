import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Search, Filter, Plus, X, User, Shield,
    Mail, Phone, Key, Check, Lock, Power,
    MoreHorizontal, BadgeCheck
} from 'lucide-react';

// --- MOCK DATA ---
const TEAM = [
    { id: 1, name: "Arjun Mehta", role: "Manager", email: "arjun.m@samvid.os", phone: "+91 98765 00001", status: "Active", access: "Level 5", avatar: "AM", color: "bg-purple-600" },
    { id: 2, name: "R. Sharma", role: "Field Agent", email: "r.sharma@samvid.os", phone: "+91 98765 00002", status: "Active", access: "Level 2", avatar: "RS", color: "bg-emerald-500" },
    { id: 3, name: "V. Singh", role: "Field Agent", email: "v.singh@samvid.os", phone: "+91 98765 00003", status: "Active", access: "Level 2", avatar: "VS", color: "bg-emerald-500" },
    { id: 4, name: "Meera K.", role: "Executive", email: "meera.k@samvid.os", phone: "+91 98765 00004", status: "On Leave", access: "Level 3", avatar: "MK", color: "bg-blue-500" },
    { id: 5, name: "System Admin", role: "Admin", email: "root@samvid.os", phone: "---", status: "Active", access: "Root", avatar: "OS", color: "bg-slate-900" },
];

// --- COMPONENT: USER FORM PANEL ---
const UserPanel = ({ isOpen, onClose }) => (
    <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isOpen ? "0%" : "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 h-full w-[450px] bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl z-50 flex flex-col"
    >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
                <h2 className="font-display text-xl text-slate-800 tracking-wide">NEW RECRUIT</h2>
                <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Create Access Profile</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={18} className="text-slate-500" />
            </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* 1. Identity */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><User size={12} /> Identity</div>
                <div className="space-y-3">
                    <input type="text" placeholder="Full Name" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="email" placeholder="Official Email" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
                        <input type="text" placeholder="Phone" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
                    </div>
                </div>
            </div>

            {/* 2. Role Assignment */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><Shield size={12} /> Clearance Level</div>
                <div className="grid grid-cols-1 gap-2">
                    {['Manager (Level 5)', 'Executive (Level 3)', 'Field Agent (Level 2)'].map(role => (
                        <label key={role} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                            <input type="radio" name="role" className="accent-purple-600" />
                            <span className="text-sm font-bold text-slate-700">{role}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* 3. Permission Matrix (Toggles) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><Key size={12} /> Access Matrix</div>
                <div className="space-y-3">
                    {[
                        { label: "Financial Core Access", desc: "Can view revenue & record transactions" },
                        { label: "Inventory Edit Rights", desc: "Can add/modify projects & units" },
                        { label: "Lead Database Export", desc: "Can download lead data (CSV/PDF)" }
                    ].map((perm, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <div className="text-xs font-bold text-slate-700">{perm.label}</div>
                                <div className="text-[10px] text-slate-400">{perm.desc}</div>
                            </div>
                            <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-300 cursor-pointer">
                                <span className="inline-block h-3 w-3 transform rounded-full bg-white transition translate-x-1" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
            <button className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl hover:bg-purple-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <BadgeCheck size={16} />
                <span className="text-xs tracking-widest uppercase">Grant Access</span>
            </button>
        </div>
    </motion.div>
);

const UserCard = ({ user, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-purple-200 transition-all relative overflow-hidden"
    >
        {/* Header Status */}
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {user.status}
            </div>
            <button className="text-slate-300 hover:text-purple-600 transition-colors"><MoreHorizontal size={16} /></button>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className={`w-12 h-12 rounded-xl ${user.color} flex items-center justify-center text-white font-display text-lg shadow-md`}>
                {user.avatar}
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-800">{user.name}</h3>
                <div className="text-xs text-slate-500 font-medium">{user.role}</div>
            </div>
        </div>

        {/* Details */}
        <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                <Mail size={12} className="text-slate-400" /> {user.email}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                <Phone size={12} className="text-slate-400" /> {user.phone}
            </div>
        </div>

        {/* Footer Security Level */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Lock size={10} /> {user.access}
            </div>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                <div className={`w-1.5 h-1.5 rounded-full ${user.role === 'Admin' || user.role === 'Manager' ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
            </div>
        </div>

        {/* Decorative Background */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:bg-purple-50 transition-colors z-0"></div>

    </motion.div>
);

const TeamManager = () => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    return (
        <div className="w-full h-full p-8 pt-24 pl-32 pr-32 flex flex-col gap-8 overflow-hidden overflow-y-auto custom-scrollbar">

            {/* 1. HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display text-4xl text-slate-800 tracking-widest">ACCESS <span className="text-purple-600">CONTROL</span></h1>
                    <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
                        System Users: <span className="text-slate-800 font-bold">5 Active</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={16} />
                        <input type="text" placeholder="Search Team..." className="bg-white/50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-300 focus:bg-white transition-all w-64 shadow-sm" />
                    </div>
                    <button onClick={() => setIsPanelOpen(true)} className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold tracking-widest hover:bg-purple-700 transition-colors shadow-lg flex items-center gap-2">
                        <Plus size={14} /> NEW USER
                    </button>
                </div>
            </div>

            {/* 2. USER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                {TEAM.map((user, i) => (
                    <UserCard key={user.id} user={user} index={i} />
                ))}

                {/* Ghost Card */}
                <motion.div
                    onClick={() => setIsPanelOpen(true)}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/10 cursor-pointer transition-all min-h-[250px]"
                >
                    <div className="p-4 rounded-full bg-slate-100 mb-4 group-hover:bg-white"><Plus size={24} /></div>
                    <span className="text-xs font-bold uppercase tracking-widest">Add New Recruit</span>
                </motion.div>
            </div>

            {/* 3. SLIDE PANEL */}
            <UserPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />

        </div>
    );
};

export default TeamManager;