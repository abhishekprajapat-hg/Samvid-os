import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Search, MapPin, ArrowRight, Star,
    Heart, Home, Key, Shield, Menu, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // <--- Added Import

// --- MOCK DATA ---
const FEATURED = [
    {
        id: 1, title: "Skyline Penthouse", location: "Sector 42, Green Avenue",
        price: "₹ 3.5 Cr", type: "Sale", rating: 4.8,
        image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=500"
    },
    {
        id: 2, title: "Urban Loft", location: "Financial District",
        price: "₹ 85k /mo", type: "Rent", rating: 4.5,
        image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&q=80&w=500"
    },
    {
        id: 3, title: "Grand Villa", location: "North Hills",
        price: "₹ 8.0 Cr", type: "Sale", rating: 5.0,
        image: "https://images.unsplash.com/photo-1600596542815-2495db9dc2c3?auto=format&fit=crop&q=80&w=500"
    },
];

const ClientHome = () => {
    const [mode, setMode] = useState('buy');
    const navigate = useNavigate(); // <--- Initialize Hook

    return (
        <div className="w-full min-h-screen bg-slate-50 font-sans text-slate-900">

            {/* 1. NAVIGATION BAR */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/portal')}>
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">S</div>
                        <span className="font-display text-xl tracking-wide text-slate-900">SAMVID <span className="text-emerald-600">ESTATES</span></span>
                    </div>
                    <div className="hidden md:flex gap-8 text-sm font-bold text-slate-500 uppercase tracking-widest">
                        <a href="#" className="hover:text-emerald-600 transition-colors">Buy</a>
                        <a href="#" className="hover:text-emerald-600 transition-colors">Rent</a>
                        <a href="#" className="hover:text-emerald-600 transition-colors">Sell</a>
                        <a href="#" className="hover:text-emerald-600 transition-colors">Agents</a>
                    </div>
                    <button className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors">
                        Client Login
                    </button>
                </div>
            </nav>

            {/* 2. HERO SECTION */}
            <div className="relative pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Left Content */}
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <h1 className="font-display text-5xl md:text-7xl text-slate-900 leading-tight">
                            Find your <br />
                            <span className="text-emerald-600 italic">Sanctuary.</span>
                        </h1>
                        <p className="mt-6 text-slate-500 text-lg max-w-md leading-relaxed">
                            Exclusive properties. Transparent dealings.
                            Direct access to the city's finest real estate inventory.
                        </p>

                        {/* Search Interface */}
                        <div className="mt-10 bg-white p-2 rounded-2xl shadow-xl border border-slate-100 max-w-lg">
                            <div className="flex gap-2 mb-2 p-2">
                                <button onClick={() => setMode('buy')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${mode === 'buy' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Buy</button>
                                <button onClick={() => setMode('rent')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${mode === 'rent' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Rent</button>
                            </div>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input type="text" placeholder="Search by Location, Project, or ID..." className="w-full bg-slate-50 rounded-xl py-4 pl-12 pr-12 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                                    <Search size={20} />
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Image */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative hidden lg:block"
                    >
                        <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl relative cursor-pointer group" onClick={() => navigate('/portal/listing')}>
                            <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                            <div className="absolute bottom-8 left-8 text-white">
                                <div className="text-xs font-bold uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full inline-block mb-2">Featured Asset</div>
                                <div className="text-2xl font-display"> The Onyx Tower</div>
                                <div className="opacity-80 text-sm mt-1">Starting from ₹ 2.5 Cr</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* 3. FEATURED COLLECTION */}
            <div className="py-20 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex justify-between items-end mb-10">
                        <div>
                            <h2 className="text-3xl font-display text-slate-900">Curated Collection</h2>
                            <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest">Handpicked for Excellence</p>
                        </div>
                        <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 hover:gap-4 transition-all">View All <ArrowRight size={14} /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {FEATURED.map((item, i) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                onClick={() => navigate('/portal/listing')} // <--- CLICK ACTION ADDED
                                className="group cursor-pointer"
                            >
                                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-4">
                                    <img src={item.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <button className="absolute top-4 right-4 p-2 bg-white/90 rounded-full text-slate-400 hover:text-rose-500 transition-colors shadow-sm"><Heart size={18} /></button>
                                    <div className="absolute bottom-4 left-4 px-3 py-1 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">
                                        {item.type}
                                    </div>
                                </div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{item.title}</h3>
                                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1"><MapPin size={12} /> {item.location}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-display text-slate-900">{item.price}</div>
                                        <div className="text-[10px] text-amber-500 font-bold flex items-center justify-end gap-1 mt-1"><Star size={10} fill="currentColor" /> {item.rating}</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ClientHome;