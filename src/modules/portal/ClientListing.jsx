import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    MapPin, Calendar, ArrowLeft, Star,
    CheckCircle, Shield, Share2, Heart,
    BedDouble, Bath, Maximize, Home
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ClientListing = () => {
    const navigate = useNavigate();
    const [booked, setBooked] = useState(false);

    // MOCK DATA (Simulating a specific property)
    const PROPERTY = {
        title: "Skyline Lux Penthouse",
        price: "₹ 3.5 Cr",
        location: "Green Avenue, Sector 42",
        specs: { beds: 4, baths: 5, area: "3,200 Sq.Ft" },
        desc: "Experience the pinnacle of luxury living. This north-facing penthouse features a private terrace, Italian marble flooring, and smart-home automation. Located in a secure, gated community with 24/7 power backup.",
        images: [
            "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&q=80&w=600",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=600",
            "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=600",
        ]
    };

    return (
        <div className="w-full min-h-screen bg-white font-sans text-slate-900 pb-20">

            {/* 1. NAVIGATION */}
            <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
                    <button onClick={() => navigate('/portal')} className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors">
                        <ArrowLeft size={16} /> Back to Search
                    </button>
                    <div className="flex gap-4">
                        <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><Heart size={20} /></button>
                        <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-emerald-600 transition-colors"><Share2 size={20} /></button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 pt-8">

                {/* 2. IMAGE GALLERY (BENTO GRID) */}
                <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[500px] rounded-3xl overflow-hidden mb-10">
                    <div className="col-span-2 row-span-2 relative group">
                        <img src={PROPERTY.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Verified Asset</div>
                    </div>
                    <div className="col-span-1 row-span-1 relative group"><img src={PROPERTY.images[1]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
                    <div className="col-span-1 row-span-1 relative group"><img src={PROPERTY.images[2]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
                    <div className="col-span-2 row-span-1 relative group">
                        <img src={PROPERTY.images[3]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <button className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-slate-900 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors">View All Photos</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* 3. PROPERTY DETAILS (LEFT) */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-widest mb-2"><Star size={12} fill="currentColor" /> Premium Collection</div>
                            <h1 className="text-4xl font-display text-slate-900 mb-2">{PROPERTY.title}</h1>
                            <p className="text-slate-500 flex items-center gap-2 text-lg"><MapPin size={18} /> {PROPERTY.location}</p>
                        </div>

                        {/* Specs Bar */}
                        <div className="flex gap-8 py-6 border-y border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-50 rounded-full text-slate-400"><BedDouble size={20} /></div>
                                <div><div className="font-bold text-slate-900">{PROPERTY.specs.beds} Beds</div><div className="text-xs text-slate-400">Bedroom</div></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-50 rounded-full text-slate-400"><Bath size={20} /></div>
                                <div><div className="font-bold text-slate-900">{PROPERTY.specs.baths} Baths</div><div className="text-xs text-slate-400">Bathroom</div></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-50 rounded-full text-slate-400"><Maximize size={20} /></div>
                                <div><div className="font-bold text-slate-900">{PROPERTY.specs.area}</div><div className="text-xs text-slate-400">Super Area</div></div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4">About this home</h3>
                            <p className="text-slate-600 leading-relaxed">{PROPERTY.desc}</p>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Amenities</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {['Power Backup', 'Gated Security', 'Swimming Pool', 'Gymnasium', 'Private Terrace', 'Smart Home'].map(amenity => (
                                    <div key={amenity} className="flex items-center gap-2 text-slate-600 text-sm">
                                        <CheckCircle size={14} className="text-emerald-500" /> {amenity}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4. BOOKING CARD (RIGHT STICKY) */}
                    <div className="relative">
                        <div className="sticky top-24 border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/50 bg-white">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Asking Price</div>
                                    <div className="text-3xl font-display text-slate-900">{PROPERTY.price}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-emerald-600 font-bold uppercase bg-emerald-50 px-2 py-1 rounded">Available</div>
                                </div>
                            </div>

                            {!booked ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Schedule a Tour</div>
                                        <div className="flex gap-2 mb-2">
                                            <button className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:border-emerald-500 transition-colors">Today</button>
                                            <button className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:border-emerald-500 transition-colors">Tomorrow</button>
                                        </div>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input type="text" placeholder="Select Date" className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 text-xs font-bold focus:outline-none focus:border-emerald-500" />
                                        </div>
                                    </div>
                                    <button onClick={() => setBooked(true)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-lg">
                                        Request Site Visit
                                    </button>
                                    <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                                        <Shield size={10} /> Zero-Spam Guarantee
                                    </p>
                                </div>
                            ) : (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="font-display text-xl text-slate-900">Request Sent!</h3>
                                    <p className="text-xs text-slate-500 mt-2">Agent <span className="font-bold">R. Sharma</span> will contact you shortly to confirm the slot.</p>
                                    <button onClick={() => setBooked(false)} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">Book Another</button>
                                </motion.div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ClientListing;