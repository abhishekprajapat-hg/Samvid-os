import React, { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Brain, Shield, Cpu, Construction } from 'lucide-react';

// --- IMPORTS ---
import Sidebar from './components/layout/Sidebar';
import WarpField from './components/background/WarpField';
import Login from './components/auth/Login';
import ManagerDashboard from './modules/manager/ManagerDashboard';
import ExecutiveDashboard from './modules/executive/ExecutiveDashboard';
import FieldDashboard from './modules/field/FieldDashboard';
import LeadsMatrix from './modules/leads/LeadsMatrix';
import AssetVault from './modules/inventory/AssetVault';
import FinancialCore from './modules/finance/FinancialCore';
import FieldOps from './modules/field/FieldOps';
import IntelligenceReports from './modules/reports/IntelligenceReports';
import MasterSchedule from './modules/calendar/MasterSchedule';
import TeamManager from './modules/admin/TeamManager';
import SystemSettings from './modules/admin/SystemSettings';
import ClientHome from './modules/portal/ClientHome';
import ClientListing from './modules/portal/ClientListing';
import Performance from './modules/reports/Performance';

// --- COMMAND PANEL COMPONENT ---
const SMART_FEED = [
  { id: 1, title: "High Value Prospect", sub: "A. Gupta (Skyline Penthouses)", meta: "AI Score: 98%", type: "ai" },
  { id: 2, title: "Negotiation Alert", sub: "Price Match Req: Villa 42", meta: "Urgent", type: "alert" },
  { id: 3, title: "Site Visit Confirmed", sub: "Tomorrow 10:00 AM", meta: "Verified", type: "event" },
];

const CommandPanel = ({ isOpen, toggle }) => (
  <motion.div
    initial={{ width: 60 }} animate={{ width: isOpen ? 320 : 60 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className="fixed right-0 top-0 h-full z-50 flex"
  >
    <div className={`h-full w-full bg-white/80 backdrop-blur-xl border-l border-slate-200 flex flex-col transition-all duration-500 overflow-hidden ${isOpen ? 'shadow-2xl' : ''}`}>
      <div className="h-24 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 pt-8">
        {isOpen && <span className="font-display text-sm tracking-widest text-slate-800 uppercase animate-pulse">Command Stream</span>}
        <button onClick={toggle} className="p-2 rounded-full hover:bg-slate-100 transition-colors text-gem-cyanDark">
          {isOpen ? <ChevronRight /> : <Brain className="animate-pulse" />}
        </button>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3 px-2"><Brain size={14} className="text-gem-violet" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Samvid Intelligence</span></div>
              <div className="space-y-3">
                {SMART_FEED.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md hover:border-gem-cyan/30 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-1"><span className={`text-xs font-bold ${item.type === 'ai' ? 'text-gem-cyanDark' : 'text-gem-goldDark'}`}>{item.title}</span>{item.type === 'ai' && <Cpu size={12} className="text-gem-cyan animate-pulse" />}</div>
                    <div className="text-[11px] text-slate-500 mb-2">{item.sub}</div>
                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider w-max ${item.type === 'ai' ? 'bg-cyan-50 text-gem-cyanDark' : 'bg-slate-50 text-slate-500'}`}>{item.meta}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3 px-2"><Shield size={14} className="text-gem-emerald" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Health</span></div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-end mb-2"><span className="text-2xl font-display font-bold text-slate-800">98%</span><span className="text-[10px] text-gem-emeraldDark font-bold tracking-widest">OPTIMAL</span></div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden"><div className="w-[98%] h-full bg-gem-emerald shadow-[0_0_10px_#34d399]"></div></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </motion.div>
);

const ConstructionPage = ({ title }) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-slate-300">
    <Construction size={48} className="mb-4 opacity-50" />
    <h1 className="font-display text-4xl text-slate-800 tracking-widest uppercase">{title}</h1>
    <p className="font-mono text-xs mt-2 text-gem-cyanDark tracking-[0.3em] uppercase">Module Under Construction</p>
  </motion.div>
);

// --- MAIN APP COMPONENT ---
function App() {
  // 1. STATE & HOOKS
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('manager');
  const [isFeedOpen, setIsFeedOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // 2. DETECT PUBLIC PORTAL
  // If the URL contains '/portal', we hide the admin UI
  const isPublicPage = location.pathname.startsWith('/portal');

  const handleLogin = (role) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  return (
    <div className="flex h-screen text-slate-800 overflow-hidden relative bg-void font-sans selection:bg-gem-cyan selection:text-white">

      {/* BACKGROUND (Only for Admin) */}
      {!isPublicPage && <WarpField />}

      <AnimatePresence mode="wait">

        {/* SCENARIO A: LOGIN SCREEN */}
        {/* Show if NOT logged in AND NOT viewing the public portal */}
        {!isLoggedIn && !isPublicPage && (
          <motion.div
            key="login"
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-50"
          >
            <Login onLogin={handleLogin} />
          </motion.div>
        )}

        {/* SCENARIO B: MAIN INTERFACE */}
        {(isLoggedIn || isPublicPage) && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute inset-0 z-10 flex w-full h-full"
          >
            {/* ADMIN UI ELEMENTS (Sidebar, Headers) - Hide on Portal */}
            {!isPublicPage && (
              <>
                <Sidebar userRole={userRole} onLogout={() => setIsLoggedIn(false)} />
                <CommandPanel isOpen={isFeedOpen} toggle={() => setIsFeedOpen(!isFeedOpen)} />

                {/* Role Switcher Header */}
                <div className={`fixed top-8 z-40 flex items-center gap-8 pointer-events-auto transition-all duration-500 ${isFeedOpen ? 'right-[340px]' : 'right-24'}`}>
                  <div className="text-right hidden md:block">
                    <div className="font-sans text-[10px] tracking-[0.3em] text-slate-400 uppercase">System Architect</div>
                    <div className="font-display text-xl text-slate-800 tracking-widest">SAMVID <span className="text-sky-500">OS</span></div>
                  </div>
                  <div className="px-1 py-1 rounded bg-white/50 border border-slate-200 backdrop-blur-md shadow-sm">
                    <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="bg-transparent text-slate-600 text-[10px] font-bold px-4 py-2 outline-none cursor-pointer uppercase font-sans tracking-widest hover:text-slate-900 transition-colors">
                      <option value="manager">Manager</option>
                      <option value="executive">Executive</option>
                      <option value="field_agent">Field Agent</option>
                    </select>
                  </div>
                </div>

                <div className="fixed bottom-8 left-24 font-mono text-[10px] text-slate-400 tracking-[0.5em] z-0 pointer-events-none">V 12.0 SYSTEM ONLINE</div>
              </>
            )}

            {/* PORTAL NAVIGATION BUTTON (To Go Back to Admin) */}
            {isPublicPage && (
              <button
                onClick={() => navigate('/')}
                className="fixed top-6 right-6 z-[60] p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-slate-900 hover:bg-emerald-600 hover:text-white transition-all shadow-lg group"
                title="Return to Command Center"
              >
                <Brain size={20} className="group-hover:animate-pulse" />
              </button>
            )}

            {/* ROUTER CONTENT AREA */}
            <main className={`flex-1 relative w-full h-full transition-all duration-300 ${isPublicPage ? 'pl-0' : ''}`}>
              <Routes>
                {/* 1. ADMIN DASHBOARDS */}
                <Route path="/" element={
                  <AnimatePresence mode="wait">
                    {userRole === 'manager' && <ManagerDashboard key="manager" isFeedOpen={isFeedOpen} />}
                    {userRole === 'executive' && <ExecutiveDashboard key="executive" />}
                    {userRole === 'field_agent' && <FieldDashboard key="field" />}
                  </AnimatePresence>
                } />

                {/* 2. CORE MODULES */}
                <Route path="/leads" element={<LeadsMatrix />} />
                <Route path="/inventory" element={<AssetVault />} />
                <Route path="/finance" element={<FinancialCore />} />
                <Route path="/map" element={<FieldOps />} />
                <Route path="/reports" element={<IntelligenceReports />} />

                {/* 3. UTILITIES & ADMIN */}
                <Route path="/admin/users" element={<TeamManager />} />
                <Route path="/settings" element={<SystemSettings />} />
                <Route path="/calendar" element={<MasterSchedule />} />

                {/* 4. PLACEHOLDERS */}
                <Route path="/my-leads" element={<LeadsMatrix />} />
                <Route path="/targets" element={<Performance />} />
                <Route path="/visits" element={<ConstructionPage title="Site Visits" />} />
                <Route path="/data-entry" element={<ConstructionPage title="Log Entry" />} />

                {/* 5. PUBLIC PORTAL */}
                <Route path="/portal" element={<ClientHome />} />
                <Route path="/portal/listing" element={<ClientListing />} />
              </Routes>
            </main>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;