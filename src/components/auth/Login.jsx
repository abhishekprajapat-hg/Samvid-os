import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, ChevronRight, Lock, ShieldCheck, ScanFace } from 'lucide-react';

const ROLES = [
    { id: 'manager', label: 'Manager', sub: 'Strategic Command' },
    { id: 'executive', label: 'Executive', sub: 'Tactical Ops' },
    { id: 'field_agent', label: 'Field Agent', sub: 'Ground Logistics' }
];

const Login = ({ onLogin }) => {
    const [selectedRole, setSelectedRole] = useState('manager');
    const [passcode, setPasscode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate system boot-up time
        setTimeout(() => {
            onLogin(selectedRole);
        }, 1500);
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center z-50">

            {/* GLASS MONOLITH CARD */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className="w-[400px] bg-white/70 backdrop-blur-2xl border border-slate-200 shadow-2xl rounded-3xl overflow-hidden relative"
            >
                {/* DECORATIVE ELEMENTS */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gem-cyan via-gem-violet to-gem-pink"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl"></div>

                <div className="p-8 relative z-10">

                    {/* HEADER */}
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 relative group">
                            <div className="absolute inset-0 border border-gem-cyan/30 rounded-2xl animate-ping opacity-20"></div>
                            <Hexagon size={32} className="text-gem-cyanDark" strokeWidth={1.5} />
                        </div>
                        <h1 className="font-display text-2xl text-slate-800 tracking-widest">SAMVID <span className="text-gem-cyanDark">OS</span></h1>
                        <p className="font-mono text-[10px] text-slate-400 tracking-[0.3em] mt-2 uppercase">Secure Access Terminal</p>
                    </div>

                    {/* FORM */}
                    <form onSubmit={handleLogin} className="space-y-6">

                        {/* ROLE SELECTOR */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Identity Protocol</label>
                            <div className="grid grid-cols-1 gap-2">
                                {ROLES.map((role) => (
                                    <div
                                        key={role.id}
                                        onClick={() => setSelectedRole(role.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${selectedRole === role.id ? 'bg-slate-800 border-slate-800 text-white shadow-lg scale-[1.02]' : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${selectedRole === role.id ? 'bg-gem-cyan animate-pulse' : 'bg-slate-300'}`}></div>
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wide">{role.label}</div>
                                            <div className={`text-[9px] font-mono ${selectedRole === role.id ? 'text-slate-400' : 'text-slate-400'}`}>{role.sub}</div>
                                        </div>
                                        {selectedRole === role.id && <ShieldCheck size={14} className="ml-auto text-gem-cyan" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PASSCODE */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Security Token</label>
                            <div className="relative">
                                <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="password"
                                    value={passcode}
                                    onChange={(e) => setPasscode(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-slate-800 focus:outline-none focus:border-gem-cyan focus:bg-white transition-all tracking-widest"
                                />
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
                        >
                            {isLoading ? (
                                <>
                                    <ScanFace className="animate-spin" size={18} />
                                    <span className="text-xs tracking-widest uppercase">Verifying Biometrics...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-xs tracking-widest uppercase">Initialize System</span>
                                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                    </form>

                </div>

                {/* FOOTER */}
                <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                    <p className="text-[9px] text-slate-400 font-mono">ENCRYPTION: AES-256 • V 12.0</p>
                </div>

            </motion.div>
        </div>
    );
};

export default Login;