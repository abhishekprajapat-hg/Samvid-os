import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, MapPin, Home, Plus,
    DollarSign, X, Loader, CheckCircle, Image as ImageIcon, UploadCloud, Trash2
} from 'lucide-react';

const AssetVault = () => {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modeType, setModeType] = useState('sale');

    // --- IMAGE UPLOAD STATE ---
    const [uploading, setUploading] = useState(false);

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        title: '', location: '', price: '', type: 'Sale', category: 'Apartment', status: 'Available',
        images: [] // Stores an array of Cloudinary URLs
    });

    // --- 1. FETCH DATA ---
    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchProperties = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/properties');
            const data = await response.json();
            setProperties(data);
            setLoading(false);
        } catch (error) {
            console.error("Error loading inventory:", error);
            setLoading(false);
        }
    };

    // --- 2. MULTI-IMAGE UPLOAD HANDLER ---
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        const newImageUrls = [];

        try {
            // Loop through each selected file and upload it
            for (const file of files) {
                const data = new FormData();
                data.append("file", file);
                data.append("upload_preset", "samvid_upload");
                data.append("cloud_name", "djfiq8kiy");

                const res = await fetch("https://api.cloudinary.com/v1_1/djfiq8kiy/image/upload", {
                    method: "POST",
                    body: data,
                });

                const cloudData = await res.json();
                if (cloudData.secure_url) {
                    newImageUrls.push(cloudData.secure_url);
                    console.log("Uploaded:", cloudData.secure_url);
                }
            }

            // Add new URLs to existing list
            setFormData(prev => ({ ...prev, images: [...prev.images, ...newImageUrls] }));

        } catch (error) {
            console.error("Upload Error:", error);
            alert("Error uploading one or more images");
        } finally {
            setUploading(false);
            // Reset file input so you can select the same file again if needed
            e.target.value = null;
        }
    };

    // Helper to remove an image from the preview list before saving
    const removeImage = (urlToRemove) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter(url => url !== urlToRemove)
        }));
    };

    // --- 3. SAVE PROPERTY ---
    const handleSaveProperty = async () => {
        if (!formData.title || !formData.price) return alert("Title & Price required");

        try {
            const response = await fetch('http://localhost:5000/api/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const newProp = await response.json();
                setProperties([newProp, ...properties]);
                setIsAddModalOpen(false);
                // Reset Form
                setFormData({ title: '', location: '', price: '', type: 'Sale', category: 'Apartment', status: 'Available', images: [] });
            }
        } catch (error) {
            alert("Failed to save property.");
        }
    };

    return (
        <div className="w-full h-full p-8 pt-24 pl-32 pr-32 flex flex-col gap-8 overflow-hidden overflow-y-auto custom-scrollbar relative bg-slate-50/50">

            {/* HEADER & GRID (Same as before) */}
            <div className="flex justify-between items-end z-10">
                <div>
                    <h1 className="font-display text-4xl text-slate-800 tracking-widest">ASSET <span className="text-emerald-600">VAULT</span></h1>
                    <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">Live Inventory Database</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="bg-slate-200 p-1 rounded-full flex gap-1">
                        <button onClick={() => setModeType('sale')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${modeType === 'sale' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>For Sale</button>
                        <button onClick={() => setModeType('rent')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${modeType === 'rent' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>Rentals</button>
                    </div>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg">
                        <Plus size={16} /> Add Asset
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-400 gap-2"><Loader className="animate-spin" size={24} /> Accessing Vault...</div>
            ) : properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl"><Home size={48} className="mb-4 opacity-20" /><p className="text-sm font-bold">Vault Empty</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8 z-0">
                    {properties.filter(p => (modeType === 'sale' ? p.type === 'Sale' : p.type === 'Rent')).map((prop) => (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={prop._id} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 cursor-pointer flex flex-col h-[320px]">
                            <div className="relative h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
                                {prop.images && prop.images.length > 0 ? (
                                    <img src={prop.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={prop.title} />
                                ) : (
                                    <div className="text-slate-300 flex flex-col items-center"><ImageIcon size={32} /><span className="text-[10px] font-bold uppercase mt-2 tracking-widest">No Image</span></div>
                                )}
                                {prop.images && prop.images.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-slate-900/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">+{prop.images.length - 1} more</div>
                                )}
                                <div className={`absolute top-3 right-3 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${prop.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white'}`}>{prop.status}</div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col justify-between">
                                <div><h3 className="font-display text-lg tracking-wide text-slate-800 truncate">{prop.title}</h3><div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1"><MapPin size={12} /> {prop.location}</div></div>
                                <div><div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-2"><span className="text-xs font-bold text-slate-500 uppercase">{prop.category}</span><span className="font-mono text-lg font-bold text-slate-900">{prop.type === 'Rent' ? `₹${prop.price}/mo` : `₹${(prop.price / 10000000).toFixed(2)} Cr`}</span></div></div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ADD PROPERTY MODAL */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                                <h3 className="font-display text-lg text-slate-900">New Inventory Asset</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={18} /></button>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                                {/* MULTI-IMAGE UPLOAD FIELD */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Property Images</label>

                                    {/* Preview Gallery */}
                                    {formData.images.length > 0 && (
                                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                            {formData.images.map((url, index) => (
                                                <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 group">
                                                    <img src={url} className="w-full h-full object-cover" />
                                                    <button onClick={() => removeImage(url)} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-center w-full">
                                        <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                {uploading ? <Loader className="animate-spin text-slate-400 mb-2" size={24} /> : <UploadCloud className="text-slate-400 mb-2" size={24} />}
                                                <p className="text-xs text-slate-500 font-bold">{uploading ? "Uploading..." : "Click to upload photos"}</p>
                                                <p className="text-[10px] text-slate-400">SVG, PNG, JPG (Max 5MB)</p>
                                            </div>
                                            <input type="file" multiple accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                                        </label>
                                    </div>
                                </div>

                                {/* REST OF FORM FIELDS (Same as before) */}
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset Title</label><input type="text" placeholder="e.g. Sunset Villa 402" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Price (₹)</label><input type="number" placeholder="12500000" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</label><input type="text" placeholder="Sector 42" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1" /></div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label><select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"><option value="Sale">For Sale</option><option value="Rent">For Rent</option></select></div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label><select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"><option value="Apartment">Apartment</option><option value="Villa">Villa</option><option value="Office">Office</option><option value="Plot">Plot</option></select></div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                                <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
                                <button onClick={handleSaveProperty} disabled={uploading} className={`flex-1 py-3 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all ${uploading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{uploading ? 'Uploading...' : 'Save Asset'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AssetVault;