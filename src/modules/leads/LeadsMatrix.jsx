import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, Plus, Phone, Mail,
    MoreHorizontal, Calendar, ArrowUpRight,
    User, CheckCircle, Clock, X, Loader
} from 'lucide-react';

const LeadsMatrix = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        name: '', phone: '', email: '', budget: '', status: 'New', type: 'Buyer'
    });

    // --- 1. FETCH REAL DATA FROM SERVER ---
    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            // Talking to your new Node.js Server
            const response = await fetch('http://localhost:5000/api/leads');
            const data = await response.json();
            setLeads(data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            setLoading(false);
        }
    };

    // --- 2. SEND NEW DATA TO SERVER ---
    const handleSaveLead = async () => {
        if (!formData.name || !formData.phone) return alert("Name & Phone required");

        try {
            const response = await fetch('http://localhost:5000/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const newLead = await response.json();
                setLeads([newLead, ...leads]); // Add to top of list instantly
                setIsAddModalOpen(false);
                setFormData({ name: '', phone: '', email: '', budget: '', status: 'New', type: 'Buyer' }); // Reset form
            }
        } catch (error) {
            alert("Failed to save lead to database.");
        }
    };

    // --- HELPERS ---
    const getStatusColor = (status) => {
        switch (status) {
            case 'New': return 'bg-blue-50 text-blue-600 border-blue-200';
            case 'Contacted': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'Qualified': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'Closed': return 'bg-slate-900 text-white border-slate-900';
            default: return 'bg-slate-50 text-slate-500 border-slate-200';
        }
    };

    return (
        <div className="p-8 pt-24 pl-32 pr-12 w-full h-full overflow-hidden flex flex-col bg-slate-50/50">

            {/* HEADER */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="font-display text-4xl text-slate-900 tracking-tight">Lead Matrix</h1>
                    <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">CRM • Pipeline • Conversion</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Search leads..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 w-64 shadow-sm" />
                    </div>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/20">
                        <Plus size={16} /> Add Lead
                    </button>
                </div>
            </div>

            {/* METRICS ROW */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {['Total Leads', 'New Today', 'Pending Visits', 'Conversion %'].map((label, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                        <span className="text-2xl font-display text-slate-900">{i === 0 ? leads.length : i === 3 ? '12%' : '0'}</span>
                    </div>
                ))}
            </div>

            {/* MAIN DATA TABLE */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="col-span-3">Client Name</div>
                    <div className="col-span-2">Contact</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Budget</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-1 text-center">Action</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
                            <Loader className="animate-spin" size={20} /> Loading Database...
                        </div>
                    ) : leads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <User size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-bold">No Leads Found</p>
                            <p className="text-xs mt-1">Add your first client to start.</p>
                        </div>
                    ) : (
                        leads.map((lead) => (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={lead._id} className="grid grid-cols-12 gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors items-center border border-transparent hover:border-slate-200 group">
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                        {lead.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{lead.name}</div>
                                        <div className="text-[10px] text-slate-400">Added {new Date(lead.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 font-mono flex flex-col gap-1">
                                    <span className="flex items-center gap-1"><Phone size={10} /> {lead.phone}</span>
                                    {lead.email && <span className="flex items-center gap-1"><Mail size={10} /> {lead.email}</span>}
                                </div>
                                <div className="col-span-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(lead.status)}`}>
                                        {lead.status}
                                    </span>
                                </div>
                                <div className="col-span-2 font-mono text-xs text-slate-700">
                                    {lead.budget ? `₹ ${Number(lead.budget).toLocaleString()}` : '-'}
                                </div>
                                <div className="col-span-2 text-xs font-bold text-slate-600 uppercase">
                                    {lead.type}
                                </div>
                                <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><MoreHorizontal size={16} /></button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* ADD LEAD MODAL */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-display text-lg text-slate-900">Add New Client</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={18} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name *</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone *</label>
                                        <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Budget</label>
                                        <input type="number" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label>
                                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                                        <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1">
                                            <option value="Buyer">Buyer</option>
                                            <option value="Renter">Renter</option>
                                            <option value="Investor">Investor</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1">
                                            <option value="New">New Lead</option>
                                            <option value="Contacted">Contacted</option>
                                            <option value="Qualified">Qualified</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
                                <button onClick={handleSaveLead} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 shadow-lg">Save to Database</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LeadsMatrix;