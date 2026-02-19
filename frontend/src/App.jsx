import React, { useState, lazy, Suspense, useMemo, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "./services/api";
import ErrorBoundary from "./components/ErrorBoundary";
import { ChatNotificationProvider } from "./context/chatNotificationProvider";

/* =======================
   LAZY IMPORTS
======================= */
const Navbar = lazy(() => import("./components/layout/Navbar"));
const WarpField = lazy(() => import("./components/background/WarpField"));
const Login = lazy(() => import("./components/auth/Login"));

const ManagerDashboard = lazy(() => import("./modules/manager/ManagerDashboard"));
const ExecutiveDashboard = lazy(() => import("./modules/executive/ExecutiveDashboard"));
const FieldDashboard = lazy(() => import("./modules/field/FieldDashboard"));
const TeamManager = lazy(() => import("./modules/admin/TeamManager"));
const TeamChat = lazy(() => import("./modules/chat/TeamChat"));

const LeadsMatrix = lazy(() => import("./modules/leads/LeadsMatrix"));
const AssetVault = lazy(() => import("./modules/inventory/AssetVault"));
const InventoryDetails = lazy(() => import("./modules/inventory/InventoryDetails"));
const FinancialCore = lazy(() => import("./modules/finance/FinancialCore"));
const FieldOps = lazy(() => import("./modules/field/FieldOps"));
const IntelligenceReports = lazy(() => import("./modules/reports/IntelligenceReports"));
const MasterSchedule = lazy(() => import("./modules/calendar/MasterSchedule"));
const SystemSettings = lazy(() => import("./modules/admin/SystemSettings"));
const ClientHome = lazy(() => import("./modules/portal/ClientHome"));
const ClientListing = lazy(() => import("./modules/portal/ClientListing"));
const Performance = lazy(() => import("./modules/reports/Performance"));

/* =======================
   MAIN APP
======================= */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "dark" ? "dark" : "light";
  });

  const location = useLocation();
  const navigate = useNavigate();

  const isPublicPage = location.pathname.startsWith("/portal");
  const showWarpField = !isPublicPage && location.pathname !== "/";
  const isChatPage = location.pathname === "/chat";

  useEffect(() => {
    if (!isChatPage) {
      document.body.style.overflowY = "";
      document.documentElement.style.overflowY = "";
      return undefined;
    }

    const previousBodyOverflowY = document.body.style.overflowY;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";

    return () => {
      document.body.style.overflowY = previousBodyOverflowY;
      document.documentElement.style.overflowY = previousHtmlOverflowY;
    };
  }, [isChatPage]);

  /* 🔥 Restore session after refresh */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (token && role) {
      // api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setIsLoggedIn(true);
      setUserRole(role);
    }

    setSessionReady(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* 🔥 Dashboard by role */
  const DashboardByRole = useMemo(() => {
    switch (userRole) {
      case "ADMIN":
        return <ManagerDashboard theme={theme} />;
      case "MANAGER":
        return <ManagerDashboard theme={theme} />;
      case "EXECUTIVE":
        return <ExecutiveDashboard />;
      case "FIELD_EXECUTIVE":
        return <FieldDashboard />;
      default:
        return <Navigate to="/login" />;
    }
  }, [userRole, theme]);

  /* 🔥 Logout */
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    delete api.defaults.headers.common["Authorization"];
    setIsLoggedIn(false);
    setUserRole(null);
    navigate("/login");
  };

  const canAccess = (allowedRoles) =>
    userRole === "ADMIN" || allowedRoles.includes(userRole);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  if (!sessionReady && !isPublicPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void text-slate-400 text-sm">
        Restoring session...
      </div>
    );
  }

  return (
    <div className={`flex relative bg-void overflow-x-hidden ${isChatPage ? "h-screen overflow-hidden" : "min-h-screen"}`}>

      {showWarpField && (
        <Suspense fallback={null}>
          <WarpField />
        </Suspense>
      )}

      <ChatNotificationProvider enabled={isLoggedIn && !isPublicPage}>
        <ErrorBoundary>
          <Suspense fallback={<div className="p-8">Loading...</div>}>
            <Routes>

          {/* ================= LOGIN ROUTES ================= */}

          <Route
            path="/login"
            element={
              !sessionReady
                ? <div className="p-8 text-slate-400">Loading...</div>
                : isLoggedIn
                ? <Navigate to="/" />
                : <Login portal="GENERAL" onLogin={(role) => {
                    setUserRole(role);
                    setIsLoggedIn(true);
                  }} />
            }
          />

          <Route
            path="/login/admin"
            element={
              !sessionReady
                ? <div className="p-8 text-slate-400">Loading...</div>
                : isLoggedIn
                ? <Navigate to="/" />
                : <Login portal="ADMIN" onLogin={(role) => {
                    setUserRole(role);
                    setIsLoggedIn(true);
                  }} />
            }
          />

          {/* ================= PROTECTED APP ================= */}

          <Route
            path="/*"
            element={
              isLoggedIn || isPublicPage ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex w-full ${isChatPage ? "h-screen overflow-hidden" : "min-h-screen"}`}
                >
                  {!isPublicPage && (
                    <>
                      <Navbar
                        userRole={userRole}
                        onLogout={handleLogout}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                      />
                    </>
                  )}

                  <main
                    className={
                      isChatPage
                        ? "relative h-full min-h-0 flex-1 overflow-hidden pt-16 app-page-bg"
                        : "relative min-h-0 flex-1 pt-16 overflow-y-auto app-page-bg"
                    }
                  >
                    <Routes>
                      <Route path="/" element={DashboardByRole} />
                      <Route
                        path="/leads"
                        element={canAccess(["ADMIN", "MANAGER", "EXECUTIVE"]) ? <LeadsMatrix /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/my-leads"
                        element={canAccess(["EXECUTIVE"]) ? <LeadsMatrix /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/inventory"
                        element={canAccess(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <AssetVault /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/inventory/:id"
                        element={canAccess(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <InventoryDetails /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/finance"
                        element={canAccess(["ADMIN", "MANAGER"]) ? <FinancialCore /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/map"
                        element={canAccess(["ADMIN", "MANAGER", "FIELD_EXECUTIVE"]) ? <FieldOps /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/reports"
                        element={canAccess(["ADMIN", "MANAGER"]) ? <IntelligenceReports /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/calendar"
                        element={canAccess(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <MasterSchedule /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/admin/users"
                        element={userRole === "ADMIN" ? <TeamManager theme={theme} /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/settings"
                        element={canAccess(["ADMIN", "MANAGER"]) ? <SystemSettings /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/targets"
                        element={canAccess(["ADMIN", "EXECUTIVE"]) ? <Performance /> : <Navigate to="/" />}
                      />
                      <Route
                        path="/chat"
                        element={
                          canAccess(["ADMIN", "MANAGER", "EXECUTIVE", "FIELD_EXECUTIVE"])
                            ? <TeamChat theme={theme} />
                            : <Navigate to="/" />
                        }
                      />
                      <Route path="/portal" element={<ClientHome />} />
                      <Route path="/portal/listing" element={<ClientListing />} />
                    </Routes>
                  </main>
                </motion.div>
              ) : (
                <Navigate to="/login" />
              )
            }
          />

            </Routes>
          </Suspense>
        </ErrorBoundary>
      </ChatNotificationProvider>
    </div>
  );
}
