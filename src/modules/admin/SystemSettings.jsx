import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, Save, Globe, Bell, Shield,
    CreditCard, Palette, Upload, ToggleLeft,
    ToggleRight, Check
} from 'lucide-react';

const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
            <div className="p-2 bg-slate-50 rounded-lg text-slate-600"><Icon size={18} /></div>
            <h3 className="font-display text-lg text-slate-800 tracking-wide">{title}</h3>
        </div>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

const SystemSettings = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);

    return (
        <div className="w-full h-full p-8 pt-24 pl-32 pr-32 flex flex-col gap-6 overflow-hidden overflow-y-auto custom-scrollbar">

            {/* 1. HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display text-4xl text-slate-800 tracking-widest">SYSTEM <span className="text-slate-400">CONFIG</span></h1>
                    <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
                        Control Panel: <span className="text-slate-800 font-bold">V 12.0</span>
                    </p>
                </div>
                <button className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold tracking-widest hover:bg-slate-800 transition-colors shadow-lg flex items-center gap-2">
                    <Save size={14} /> SAVE CHANGES
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">

                {/* 2. BRANDING & GLOBAL */}
                <div className="space-y-6">
                    <Section title="Organization Identity" icon={Globe}>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-gem-cyan cursor-pointer transition-colors">
                                <Upload size={20} className="mb-1" />
                                <span className="text-[9px] uppercase font-bold">Logo</span>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Name</label>
                                    <input type="text" defaultValue="Samvid Real Estate" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-slate-400 font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Support Email</label>
                                    <input type="text" defaultValue="admin@samvid.os" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-slate-400" />
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section title="Financial Parameters" icon={CreditCard}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Currency</label>
                                <select className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none text-slate-600">
                                    <option>INR (₹)</option>
                                    <option>USD ($)</option>
                                    <option>EUR (€)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Tax (GST)</label>
                                <div className="relative">
                                    <input type="text" defaultValue="18" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-slate-400" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                </div>
                            </div>
                        </div>
                    </Section>
                </div>

                {/* 3. PREFERENCES & SECURITY */}
                <div className="space-y-6">
                    <Section title="Appearance" icon={Palette}>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <div className="text-sm font-bold text-slate-700">Dark Mode</div>
                                <div className="text-[10px] text-slate-400">Switch to high-contrast dark theme</div>
                            </div>
                            <button onClick={() => setDarkMode(!darkMode)} className="text-slate-400 hover:text-gem-cyan transition-colors">
                                {darkMode ? <ToggleRight size={32} className="text-gem-cyan" /> : <ToggleLeft size={32} />}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 mt-3">
                            <div>
                                <div className="text-sm font-bold text-slate-700">Compact View</div>
                                <div className="text-[10px] text-slate-400">Reduce spacing in data tables</div>
                            </div>
                            <ToggleLeft size={32} className="text-slate-300" />
                        </div>
                    </Section>

                    <Section title="Notifications" icon={Bell}>
                        <div className="space-y-3">
                            {[
                                "Notify on New Lead Assignment",
                                "Notify on Payment Receipt",
                                "Daily Performance Digest"
                            ].map((item, i) => (
                                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${notifications ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-300'}`}>
                                        {notifications && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="text-sm text-slate-600 group-hover:text-slate-900">{item}</span>
                                </label>
                            ))}
                        </div>
                    </Section>

                    <Section title="Security" icon={Shield}>
                        <div className="flex justify-between items-center">
                            <div className="text-xs font-bold text-slate-600">Session Timeout</div>
                            <select className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500">
                                <option>15 Minutes</option>
                                <option>1 Hour</option>
                                <option>4 Hours</option>
                            </select>
                        </div>
                        <button className="w-full mt-4 py-2 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold uppercase hover:bg-rose-50 transition-colors">
                            Reset System Data
                        </button>
                    </Section>
                </div>

            </div>
        </div>
    );
};

export default SystemSettings;