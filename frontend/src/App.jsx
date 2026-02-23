import React, { useState, lazy, Suspense, useMemo, useEffect, useRef } from "react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "./services/api";
import ErrorBoundary from "./components/ErrorBoundary";
import { ChatNotificationProvider } from "./context/chatNotificationProvider";
import { updateMyLiveLocation } from "./services/userService";

/* =======================
   LAZY IMPORTS
======================= */
const Navbar = lazy(() => import("./components/layout/Navbar"));
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
const DataUseNotice = lazy(() => import("./modules/legal/DataUseNotice"));
const ServiceTermsNotice = lazy(() => import("./modules/legal/ServiceTermsNotice"));
const Performance = lazy(() => import("./modules/reports/Performance"));

const EARTH_RADIUS_METERS = 6371000;
const LOCATION_SYNC_MIN_INTERVAL_MS = 30000;
const LOCATION_SYNC_MIN_DISTANCE_METERS = 30;
const PUBLIC_ROUTE_PREFIXES = [
  "/privacy-policy",
  "/terms-and-conditions",
  "/data-use-notice",
  "/service-terms",
];
const FORCE_LIGHT_ROUTE_PREFIXES = [
  "/login",
  "/privacy-policy",
  "/terms-and-conditions",
  "/data-use-notice",
  "/service-terms",
];

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateDistanceMeters = (aLat, aLng, bLat, bLng) => {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_METERS * arc;
};

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
  const locationSyncStateRef = useRef({
    inFlight: false,
    lastSentAt: 0,
    lastLat: null,
    lastLng: null,
  });

  const location = useLocation();
  const navigate = useNavigate();

  const isPublicPage = PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );
  const isForcedLightPage = FORCE_LIGHT_ROUTE_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );
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
    root.classList.add(
      isForcedLightPage
        ? "theme-light"
        : theme === "dark"
          ? "theme-dark"
          : "theme-light",
    );
    localStorage.setItem("theme", theme);
  }, [isForcedLightPage, theme]);

  useEffect(() => {
    if (!isLoggedIn || userRole !== "FIELD_EXECUTIVE") return undefined;
    if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;

    let alive = true;
    const sendLocationUpdate = async (coords) => {
      if (!alive) return;

      const latitude = Number(coords?.latitude);
      const longitude = Number(coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const now = Date.now();
      const state = locationSyncStateRef.current;
      const hasPrevious = Number.isFinite(state.lastLat) && Number.isFinite(state.lastLng);

      let movedDistance = Number.POSITIVE_INFINITY;
      if (hasPrevious) {
        movedDistance = calculateDistanceMeters(
          state.lastLat,
          state.lastLng,
          latitude,
          longitude,
        );
      }

      const intervalSinceLastSend = now - Number(state.lastSentAt || 0);
      const shouldSend =
        !hasPrevious ||
        intervalSinceLastSend >= LOCATION_SYNC_MIN_INTERVAL_MS ||
        movedDistance >= LOCATION_SYNC_MIN_DISTANCE_METERS;

      if (!shouldSend || state.inFlight) return;

      state.inFlight = true;
      try {
        await updateMyLiveLocation({
          lat: latitude,
          lng: longitude,
          accuracy: Number.isFinite(coords?.accuracy) ? Number(coords.accuracy) : null,
          heading: Number.isFinite(coords?.heading) ? Number(coords.heading) : null,
          speed: Number.isFinite(coords?.speed) ? Number(coords.speed) : null,
        });

        state.lastLat = latitude;
        state.lastLng = longitude;
        state.lastSentAt = now;
      } catch {
        // Keep background sync silent to avoid blocking app flow.
      } finally {
        state.inFlight = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        sendLocationUpdate(position.coords);
      },
      () => {
        // Geolocation can be denied; keep app usable without location streaming.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      },
    );

    return () => {
      alive = false;
      if (watchId !== null && watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isLoggedIn, userRole]);

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
  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");

    try {
      await api.post("/auth/logout", {
        refreshToken: refreshToken || undefined,
      });
    } catch {
      // Logout should always clear local session, even if network call fails.
    }

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
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
    <div className={`flex relative bg-void overflow-x-hidden ${isChatPage ? "h-dvh overflow-hidden" : "min-h-screen"}`}>

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
                  className={`flex w-full ${isChatPage ? "h-dvh overflow-hidden" : "min-h-screen"}`}
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
                        ? "relative min-h-0 flex-1 overflow-hidden pt-16 app-page-bg"
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
                      <Route path="/privacy-policy" element={<DataUseNotice />} />
                      <Route path="/terms-and-conditions" element={<ServiceTermsNotice />} />
                      <Route path="/data-use-notice" element={<DataUseNotice />} />
                      <Route path="/service-terms" element={<ServiceTermsNotice />} />
                      <Route path="/portal/*" element={<Navigate to="/" replace />} />
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
