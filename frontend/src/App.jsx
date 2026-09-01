import React, { useState, lazy, Suspense, useMemo, useEffect, useRef, useCallback } from "react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import api from "./services/api";
import ErrorBoundary from "./components/ErrorBoundary";
import { ChatNotificationProvider } from "./context/chatNotificationProvider";
import { updateMyLiveLocation } from "./services/userService";
import RouteLoadingSkeleton from "./components/layout/RouteLoadingSkeleton";
import {
  applySystemSettingsToDocument,
  getSessionTimeoutMs,
  readSystemSettings,
  SYSTEM_SETTINGS_UPDATED_EVENT,
} from "./utils/systemSettings";

/* =======================
   LAZY IMPORTS
======================= */
const WorkbenchShell = lazy(() => import("./components/workbench/WorkbenchShell"));
const Login = lazy(() => import("./components/auth/Login"));
const AdminRequestAlertToast = lazy(() => import("./components/layout/AdminRequestAlertToast"));

const ManagerDashboard = lazy(() => import("./modules/manager/ManagerDashboard"));
const ExecutiveDashboard = lazy(() => import("./modules/executive/ExecutiveDashboard"));
const FieldDashboard = lazy(() => import("./modules/field/FieldDashboard"));
const ProductionExecutiveDashboard = lazy(() => import("./modules/production/ProductionExecutiveDashboard"));
const TeamManager = lazy(() => import("./modules/admin/TeamManager"));
const UserDetailsEditor = lazy(() => import("./modules/admin/UserDetailsEditor"));
const AdminNotifications = lazy(() => import("./modules/admin/AdminNotifications"));
const AdminCommandConsole = lazy(() => import("./modules/admin/AdminCommandConsole"));
const AdminMetaAdsPanel = lazy(() => import("./modules/admin/AdminMetaAdsPanel"));
const SuperAdminPanel = lazy(() => import("./modules/admin/SuperAdminPanel"));
const TeamChat = lazy(() => import("./modules/chat/TeamChat"));
const ChatMessageAlertToast = lazy(() => import("./components/layout/ChatMessageAlertToast"));
const FollowUpReminderToast = lazy(() => import("./components/layout/FollowUpReminderToast"));

const LeadsMatrix = lazy(() => import("./modules/leads/LeadsMatrix"));
const AssetVault = lazy(() => import("./modules/inventory/AssetVault"));
const InventoryDetails = lazy(() => import("./modules/inventory/InventoryDetails"));
const FinancialCore = lazy(() => import("./modules/finance/FinancialCore"));
const FieldOps = lazy(() => import("./modules/field/FieldOps"));
const IntelligenceReports = lazy(() => import("./modules/reports/IntelligenceReports"));
const RoleLeaderboard = lazy(() => import("./modules/reports/RoleLeaderboard"));
const MasterSchedule = lazy(() => import("./modules/calendar/MasterSchedule"));
const AttendanceHub = lazy(() => import("./modules/attendance/AttendanceHub"));
const SystemSettings = lazy(() => import("./modules/admin/SystemSettings"));
const DataUseNotice = lazy(() => import("./modules/legal/DataUseNotice"));
const ServiceTermsNotice = lazy(() => import("./modules/legal/ServiceTermsNotice"));
const Performance = lazy(() => import("./modules/reports/Performance"));
const UserProfile = lazy(() => import("./modules/profile/UserProfile"));
const SharedInventoryView = lazy(() => import("./modules/inventory/SharedInventoryView"));
const TaskManager = lazy(() => import("./modules/tasks/TaskManager"));

const EARTH_RADIUS_METERS = 6371000;
const LOCATION_SYNC_MIN_INTERVAL_MS = 30000;
const LOCATION_SYNC_MIN_DISTANCE_METERS = 30;
const PUBLIC_ROUTE_PREFIXES = [
  "/privacy-policy",
  "/terms-and-conditions",
  "/data-use-notice",
  "/service-terms",
  "/shared",
];
const E2E_SESSION_TIMEOUT_STORAGE_KEY = "samvid-os.e2e.sessionTimeoutMs";

const resolveSessionTimeoutMs = () => {
  const configuredTimeout = getSessionTimeoutMs(readSystemSettings().security.sessionTimeoutMinutes);
  if (import.meta.env.MODE !== "e2e") return configuredTimeout;

  const overrideMs = Number.parseInt(localStorage.getItem(E2E_SESSION_TIMEOUT_STORAGE_KEY) || "", 10);
  return Number.isFinite(overrideMs) && overrideMs > 0 ? overrideMs : configuredTimeout;
};
const FORCE_LIGHT_ROUTE_PREFIXES = [
  "/login",
  "/privacy-policy",
  "/terms-and-conditions",
  "/data-use-notice",
  "/service-terms",
  "/shared",
];
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
const ADMIN_ROLES = [SUPER_ADMIN_ROLE, "ADMIN"];
const MANAGEMENT_ROLES = ["MANAGER"];
const ADMIN_TOOL_ROLES = [SUPER_ADMIN_ROLE, "ADMIN", "MANAGER"];
const CHAT_REFRESH_FALLBACK_ROLES = ["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE"];
const TENANT_ROUTE_FIRST_SEGMENTS = new Set([
  "dashboard",
  "login",
  "leads",
  "my-leads",
  "inventory",
  "finance",
  "map",
  "reports",
  "leaderboard",
  "calendar",
  "tasks",
  "attendance",
  "admin",
  "settings",
  "targets",
  "chat",
  "profile",
]);
const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  INSIDE_EXECUTIVE: "Inside Executive",
  EXECUTIVE: "Executive",
  FIELD_EXECUTIVE: "Field Executive",
  PRODUCTION_EXECUTIVE: "Production Executive",
  CHANNEL_PARTNER: "Channel Partner",
};

const sanitizeTenantSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

const stripTenantPathPrefix = (pathname = "") => {
  const path = pathname || "/";
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2 && TENANT_ROUTE_FIRST_SEGMENTS.has(segments[1])) {
    return `/${segments.slice(1).join("/")}`;
  }
  return path;
};

const getLoginPathForLocation = (pathname = "") => {
  const segments = String(pathname || "").split("/").filter(Boolean);
  if (segments.length >= 2 && TENANT_ROUTE_FIRST_SEGMENTS.has(segments[1])) {
    return `/${segments[0]}/login`;
  }
  return "/login";
};

const resolveHomeHeader = (userRole) => {
  switch (userRole) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return {
        title: "Admin Command Center",
        subtitle: "System visibility, alerts and operational controls",
        scopeLabel: "Home",
      };
    case "MANAGER":
      return {
        title: "Management Command Center",
        subtitle: "Portfolio progress, team activity and execution signals",
        scopeLabel: "Home",
      };
    case "INSIDE_EXECUTIVE":
      return {
        title: "Inside Executive Command Center",
        subtitle: "Lead priorities, follow-up discipline and conversion flow",
        scopeLabel: "My Desk",
      };
    case "EXECUTIVE":
      return {
        title: "Executive Command Center",
        subtitle: "Lead priorities, pending actions and daily delivery focus",
        scopeLabel: "My Desk",
      };
    case "FIELD_EXECUTIVE":
      return {
        title: "Field Command Center",
        subtitle: "Ground movement, follow-up tasks and site visit execution",
        scopeLabel: "Route Desk",
      };
    case "PRODUCTION_EXECUTIVE":
      return {
        title: "Production Command Center",
        subtitle: "Tasks, deadlines, attendance and internal collaboration",
        scopeLabel: "Production Desk",
      };
    default:
      return {
        title: "Workspace Command Center",
        subtitle: "Operational overview and daily execution snapshot",
        scopeLabel: "Home",
      };
  }
};

const resolvePageHeader = (pathname, userRole) => {
  if (!pathname) return null;
  const normalizedPathname = stripTenantPathPrefix(pathname);
  if (normalizedPathname === "/" || normalizedPathname === "/dashboard") return resolveHomeHeader(userRole);

  if (normalizedPathname.startsWith("/leads") || normalizedPathname.startsWith("/my-leads")) {
    return {
      title: "Leads Command Center",
      subtitle: "Pipeline tracking, follow-up discipline and conversion flow",
      scopeLabel: "Pipeline",
    };
  }

  if (normalizedPathname.startsWith("/inventory")) {
    return normalizedPathname === "/inventory"
      ? {
          title: "Inventory Command Center",
          subtitle: "Asset health, approval flow and portfolio readiness",
          scopeLabel: "Empire",
        }
      : {
          title: "Property Command Center",
          subtitle: "Detailed property context, status and execution actions",
          scopeLabel: "Property Detail",
        };
  }

  if (normalizedPathname.startsWith("/finance")) {
    return {
      title: "Finance Command Center",
      subtitle: "Revenue posture, collections and financial performance",
      scopeLabel: "Finance",
    };
  }

  if (normalizedPathname.startsWith("/reports")) {
    return {
      title: "Reports Command Center",
      subtitle: "Funnel analytics, team performance and business intelligence",
      scopeLabel: "Reports",
    };
  }

  if (normalizedPathname.startsWith("/leaderboard")) {
    return {
      title: "Leaderboard Command Center",
      subtitle: "Role-level ranking, peer comparison and conversion momentum",
      scopeLabel: "Leaderboard",
    };
  }

  if (normalizedPathname.startsWith("/calendar")) {
    return {
      title: "Schedule Command Center",
      subtitle: "Meetings, reminders and execution timeline visibility",
      scopeLabel: "Schedule",
    };
  }

  if (normalizedPathname.startsWith("/attendance")) {
    return {
      title: "Attendance Command Center",
      subtitle: "Daily check-in, work-hour tracking and team attendance visibility",
      scopeLabel: "Attendance",
    };
  }

  if (normalizedPathname.startsWith("/admin/notifications")) {
    return {
      title: "Alerts Command Center",
      subtitle: "Pending approvals, escalation signals and manager actions",
      scopeLabel: "Alerts",
    };
  }

  if (normalizedPathname.startsWith("/admin/users")) {
    return {
      title: "Access Command Center",
      subtitle: "Team permissions, role governance and account controls",
      scopeLabel: "Access",
    };
  }

  if (normalizedPathname.startsWith("/admin/console")) {
    return {
      title: "Console Command Center",
      subtitle: "Run commands to inspect platform data and jump across modules",
      scopeLabel: "Console",
    };
  }

  if (normalizedPathname.startsWith("/admin/meta-ads")) {
    return {
      title: "Meta Ads Command Center",
      subtitle: "Configure page integration and monitor lead subscription sync",
      scopeLabel: "Meta Ads",
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      title: "System Command Center",
      subtitle: "Platform policy, session controls and runtime configuration",
      scopeLabel: "System",
    };
  }

  if (pathname.startsWith("/targets")) {
    if (userRole === "PRODUCTION_EXECUTIVE") {
      return {
        title: "Performance Command Center",
        subtitle: "Task completion, pending work and productivity signals",
        scopeLabel: "Performance",
      };
    }

    return {
      title: "Targets Command Center",
      subtitle: "Goal pacing, conversion momentum and ownership tracking",
      scopeLabel: "Targets",
    };
  }

  if (pathname.startsWith("/profile")) {
    return {
      title: "Profile Command Center",
      subtitle: "Identity details, account metadata and personal settings",
      scopeLabel: "Profile",
    };
  }

  return null;
};

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
  const [, setAuthVersion] = useState(0);
  const [systemSettingsVersion, setSystemSettingsVersion] = useState(0);
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "dark" ? "dark" : "light";
  });
  const inactivityTimerRef = useRef(null);
  const sessionTimeoutMsRef = useRef(resolveSessionTimeoutMs());
  const locationSyncStateRef = useRef({
    inFlight: false,
    lastSentAt: 0,
    lastLat: null,
    lastLng: null,
  });
  const chatRefreshGuardHandledRef = useRef(false);

  const location = useLocation();
  const navigate = useNavigate();
  const authUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const authTenant = (() => {
    try {
      return JSON.parse(localStorage.getItem("tenant") || "null") || null;
    } catch {
      return null;
    }
  })();
  const tenantSlug = sanitizeTenantSlug(authTenant?.subdomain);
  const tenantBasePath = userRole !== SUPER_ADMIN_ROLE && tenantSlug ? `/${tenantSlug}` : "";
  const normalizedPathname = stripTenantPathPrefix(location.pathname);

  const isPublicPage = PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    normalizedPathname.startsWith(prefix),
  );
  const isForcedLightPage = FORCE_LIGHT_ROUTE_PREFIXES.some((prefix) =>
    normalizedPathname.startsWith(prefix),
  );
  const isChatPage = normalizedPathname === "/chat";
  const canChannelPartnerViewInventory =
    userRole === "CHANNEL_PARTNER" && Boolean(authUser?.canViewInventory);
  const shouldLockDocumentScroll = isLoggedIn && !isPublicPage;
  const routeViewportClass = shouldLockDocumentScroll
    ? "min-h-0 flex-1 overflow-hidden"
    : "";

  useEffect(() => {
    if (!shouldLockDocumentScroll) {
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
  }, [shouldLockDocumentScroll]);

  useEffect(() => {
    if (!sessionReady || !isLoggedIn || !tenantBasePath || isPublicPage) return;
    if (location.pathname === tenantBasePath || location.pathname.startsWith(`${tenantBasePath}/`)) return;

    if (location.pathname === "/" || normalizedPathname === "/") {
      navigate(`${tenantBasePath}/dashboard`, { replace: true });
      return;
    }

    const segments = normalizedPathname.split("/").filter(Boolean);
    if (segments.length && TENANT_ROUTE_FIRST_SEGMENTS.has(segments[0])) {
      navigate(`${tenantBasePath}${normalizedPathname}`, { replace: true });
    }
  }, [
    isLoggedIn,
    isPublicPage,
    location.pathname,
    navigate,
    normalizedPathname,
    sessionReady,
    tenantBasePath,
  ]);

  /* 🔥 Restore session after refresh */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (token && role) {
      // api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setIsLoggedIn(true);
      setUserRole(role);
      setAuthVersion((prev) => prev + 1);
    }

    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady || !isLoggedIn || userRole === SUPER_ADMIN_ROLE) return undefined;
    if (localStorage.getItem("tenant")) return undefined;

    let alive = true;
    api.get("/auth/me", { cache: false })
      .then((res) => {
        if (!alive) return;
        if (res.data?.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
        if (res.data?.tenant) {
          localStorage.setItem("tenant", JSON.stringify(res.data.tenant));
        }
        setAuthVersion((prev) => prev + 1);
      })
      .catch(() => {
        // Keep the current session usable if tenant backfill fails.
      });

    return () => {
      alive = false;
    };
  }, [isLoggedIn, sessionReady, userRole]);

  useEffect(() => {
    const root = document.documentElement;
    const activeTheme = isForcedLightPage ? "light" : theme;

    if (isForcedLightPage && theme !== "light") {
      setTheme("light");
    }

    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(activeTheme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", activeTheme);
  }, [isForcedLightPage, theme]);

  const performInactivityLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("tenant");
    delete api.defaults.headers.common.Authorization;
    setIsLoggedIn(false);
    setUserRole(null);
    setAuthVersion((prev) => prev + 1);
    navigate("/login");
  }, [navigate]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (!isLoggedIn || isPublicPage) return;

    inactivityTimerRef.current = setTimeout(() => {
      performInactivityLogout();
    }, sessionTimeoutMsRef.current);
  }, [isLoggedIn, isPublicPage, performInactivityLogout]);

  useEffect(() => {
    const applyRuntimeSystemSettings = () => {
      const settings = readSystemSettings();
      sessionTimeoutMsRef.current = resolveSessionTimeoutMs();
      applySystemSettingsToDocument(settings);
      setSystemSettingsVersion((prev) => prev + 1);
    };

    applyRuntimeSystemSettings();
    window.addEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, applyRuntimeSystemSettings);
    window.addEventListener("storage", applyRuntimeSystemSettings);

    return () => {
      window.removeEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, applyRuntimeSystemSettings);
      window.removeEventListener("storage", applyRuntimeSystemSettings);
    };
  }, []);

  useEffect(() => {
    if (chatRefreshGuardHandledRef.current) return;
    if (!sessionReady || !isLoggedIn) return;
    if (normalizedPathname !== "/chat") return;
    if (!CHAT_REFRESH_FALLBACK_ROLES.includes(String(userRole || ""))) return;
    if (typeof window === "undefined") return;

    const navigationEntry = window.performance
      ?.getEntriesByType?.("navigation")
      ?.find?.((entry) => entry && typeof entry.type === "string");
    const legacyNavigationType = window.performance?.navigation?.type;
    const isReloadNavigation =
      navigationEntry?.type === "reload" || legacyNavigationType === 1;
    if (!isReloadNavigation) return;

    const isMobileViewport =
      window.matchMedia?.("(max-width: 767px)")?.matches
      ?? window.innerWidth <= 767;
    if (!isMobileViewport) return;

    chatRefreshGuardHandledRef.current = true;
    navigate("/", { replace: true });
  }, [isLoggedIn, navigate, normalizedPathname, sessionReady, userRole]);

  useEffect(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer, systemSettingsVersion]);

  useEffect(() => {
    if (!isLoggedIn || isPublicPage) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return undefined;
    }

    const activityEvents = [
      "click",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];

    const onActivity = () => {
      if (document.visibilityState && document.visibilityState === "hidden") return;
      resetInactivityTimer();
    };

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, onActivity, { passive: true }));

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [isLoggedIn, isPublicPage, resetInactivityTimer]);

  useEffect(() => {
    if (!isLoggedIn || userRole !== "FIELD_EXECUTIVE") return undefined;
    if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;

    let alive = true;
    locationSyncStateRef.current = {
      inFlight: false,
      lastSentAt: 0,
      lastLat: null,
      lastLng: null,
    };

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

    const locationOptions = {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 20000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendLocationUpdate(position.coords);
      },
      () => {
        // Geolocation can be denied; keep app usable without location streaming.
      },
      locationOptions,
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        sendLocationUpdate(position.coords);
      },
      () => {
        // Geolocation can be denied; keep app usable without location streaming.
      },
      locationOptions,
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
      case "SUPER_ADMIN":
        return <SuperAdminPanel theme={theme} />;
      case "ADMIN":
        return <ManagerDashboard theme={theme} />;
      case "MANAGER":
        return <ManagerDashboard theme={theme} />;
      case "INSIDE_EXECUTIVE":
        return <ExecutiveDashboard />;
      case "EXECUTIVE":
        return <ExecutiveDashboard />;
      case "FIELD_EXECUTIVE":
        return <FieldDashboard />;
      case "PRODUCTION_EXECUTIVE":
        return <ProductionExecutiveDashboard />;
      case "CHANNEL_PARTNER":
        return <Navigate to="/leads" />;
      default:
        return <Navigate to={getLoginPathForLocation(location.pathname)} />;
    }
  }, [location.pathname, userRole, theme]);

  /* 🔥 Logout */
  const handleLogout = useCallback(async () => {
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
    setAuthVersion((prev) => prev + 1);
    navigate("/login");
  }, [navigate]);

  const canAccess = useCallback(
    (allowedRoles) => allowedRoles.includes(userRole),
    [userRole],
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const pageHeader = useMemo(
    () => resolvePageHeader(location.pathname, userRole),
    [location.pathname, userRole],
  );
  const roleLabel = ROLE_LABELS[userRole] || userRole || "Workspace";
  const appRoutes = useMemo(() => (
    <Routes>
      <Route path="/" element={DashboardByRole} />
      <Route path="/dashboard" element={DashboardByRole} />
      <Route path="/:tenantSlug" element={DashboardByRole} />
      <Route path="/:tenantSlug/dashboard" element={DashboardByRole} />
      <Route
        path="/super-admin"
        element={userRole === "SUPER_ADMIN" ? <SuperAdminPanel theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/leads"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "CHANNEL_PARTNER"]) ? <LeadsMatrix /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/leads"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "CHANNEL_PARTNER"]) ? <LeadsMatrix /> : <Navigate to="/" />}
      />
      <Route
        path="/leads/:leadId"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]) ? <LeadsMatrix /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/leads/:leadId"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]) ? <LeadsMatrix /> : <Navigate to="/" />}
      />
      <Route
        path="/my-leads"
        element={
          canAccess(["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <LeadsMatrix /> : <Navigate to="/" />
        }
      />
      <Route
        path="/:tenantSlug/my-leads"
        element={
          canAccess(["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <LeadsMatrix /> : <Navigate to="/" />
        }
      />
      <Route
        path="/my-leads/:leadId"
        element={canAccess(["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <LeadsMatrix /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/my-leads/:leadId"
        element={canAccess(["INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <LeadsMatrix /> : <Navigate to="/" />}
      />
      <Route
        path="/inventory"
        element={(
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"])
          && (userRole !== "CHANNEL_PARTNER" || canChannelPartnerViewInventory)
        ) ? <AssetVault /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/inventory"
        element={(
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"])
          && (userRole !== "CHANNEL_PARTNER" || canChannelPartnerViewInventory)
        ) ? <AssetVault /> : <Navigate to="/" />}
      />
      <Route
        path="/inventory/:id"
        element={(
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"])
          && (userRole !== "CHANNEL_PARTNER" || canChannelPartnerViewInventory)
        ) ? <InventoryDetails /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/inventory/:id"
        element={(
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"])
          && (userRole !== "CHANNEL_PARTNER" || canChannelPartnerViewInventory)
        ) ? <InventoryDetails /> : <Navigate to="/" />}
      />
      <Route
        path="/finance"
        element={canAccess([
          ...MANAGEMENT_ROLES,
          "INSIDE_EXECUTIVE",
          "EXECUTIVE",
          "FIELD_EXECUTIVE",
          "CHANNEL_PARTNER",
        ]) ? <FinancialCore /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/finance"
        element={canAccess([
          ...MANAGEMENT_ROLES,
          "INSIDE_EXECUTIVE",
          "EXECUTIVE",
          "FIELD_EXECUTIVE",
          "CHANNEL_PARTNER",
        ]) ? <FinancialCore /> : <Navigate to="/" />}
      />
      <Route
        path="/map"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "FIELD_EXECUTIVE"]) ? <FieldOps /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/map"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "FIELD_EXECUTIVE"]) ? <FieldOps /> : <Navigate to="/" />}
      />
      <Route
        path="/reports"
        element={canAccess(["ADMIN", "MANAGER"]) ? <IntelligenceReports /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/reports"
        element={canAccess(["ADMIN", "MANAGER"]) ? <IntelligenceReports /> : <Navigate to="/" />}
      />
      <Route
        path="/leaderboard"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]) ? <RoleLeaderboard /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/leaderboard"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "CHANNEL_PARTNER"]) ? <RoleLeaderboard /> : <Navigate to="/" />}
      />
      <Route
        path="/calendar"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <MasterSchedule /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/calendar"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"]) ? <MasterSchedule /> : <Navigate to="/" />}
      />
      <Route
        path="/tasks"
        element={
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE"])
            ? <TaskManager theme={theme} />
            : <Navigate to="/" />
        }
      />
      <Route
        path="/:tenantSlug/tasks"
        element={
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE"])
            ? <TaskManager theme={theme} />
            : <Navigate to="/" />
        }
      />
      <Route
        path="/attendance"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE", "CHANNEL_PARTNER"]) ? <AttendanceHub /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/attendance"
        element={canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE", "CHANNEL_PARTNER"]) ? <AttendanceHub /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/notifications"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <AdminNotifications /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/admin/notifications"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <AdminNotifications /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/users"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <TeamManager theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/admin/users"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <TeamManager theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/users/:userId"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <UserDetailsEditor theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/admin/users/:userId"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <UserDetailsEditor theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/console"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <AdminCommandConsole /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/admin/console"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <AdminCommandConsole /> : <Navigate to="/" />}
      />
      <Route
        path="/admin/meta-ads"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <AdminMetaAdsPanel theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/admin/meta-ads"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <AdminMetaAdsPanel theme={theme} /> : <Navigate to="/" />}
      />
      <Route
        path="/settings"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <SystemSettings /> : <Navigate to="/" />}
      />
      <Route
        path="/:tenantSlug/settings"
        element={ADMIN_TOOL_ROLES.includes(userRole) ? <SystemSettings /> : <Navigate to="/" />}
      />
      <Route
        path="/targets"
        element={
          userRole === "PRODUCTION_EXECUTIVE"
            ? <ProductionExecutiveDashboard mode="performance" />
            : canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"])
              ? <Performance />
              : <Navigate to="/" />
        }
      />
      <Route
        path="/:tenantSlug/targets"
        element={
          userRole === "PRODUCTION_EXECUTIVE"
            ? <ProductionExecutiveDashboard mode="performance" />
            : canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE"])
              ? <Performance />
              : <Navigate to="/" />
        }
      />
      <Route
        path="/chat"
        element={
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE"])
            ? <TeamChat theme={theme} />
            : <Navigate to="/" />
        }
      />
      <Route
        path="/:tenantSlug/chat"
        element={
          canAccess(["ADMIN", ...MANAGEMENT_ROLES, "INSIDE_EXECUTIVE", "EXECUTIVE", "FIELD_EXECUTIVE", "PRODUCTION_EXECUTIVE"])
            ? <TeamChat theme={theme} />
            : <Navigate to="/" />
        }
      />
      <Route
        path="/profile"
        element={
          canAccess([
            "ADMIN",
            "SUPER_ADMIN",
            ...MANAGEMENT_ROLES,
            "INSIDE_EXECUTIVE",
            "EXECUTIVE",
            "FIELD_EXECUTIVE",
            "PRODUCTION_EXECUTIVE",
            "CHANNEL_PARTNER",
          ])
            ? <UserProfile />
            : <Navigate to="/" />
        }
      />
      <Route
        path="/:tenantSlug/profile"
        element={
          canAccess([
            "ADMIN",
            "SUPER_ADMIN",
            ...MANAGEMENT_ROLES,
            "INSIDE_EXECUTIVE",
            "EXECUTIVE",
            "FIELD_EXECUTIVE",
            "PRODUCTION_EXECUTIVE",
            "CHANNEL_PARTNER",
          ])
            ? <UserProfile />
            : <Navigate to="/" />
        }
      />
      <Route path="/privacy-policy" element={<DataUseNotice />} />
      <Route path="/terms-and-conditions" element={<ServiceTermsNotice />} />
      <Route path="/data-use-notice" element={<DataUseNotice />} />
      <Route path="/service-terms" element={<ServiceTermsNotice />} />
      <Route path="/shared/inventory/:shareToken" element={<SharedInventoryView />} />
      <Route path="/portal/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ), [
    DashboardByRole,
    canAccess,
    canChannelPartnerViewInventory,
    theme,
    userRole,
  ]);

  if (!sessionReady && !isPublicPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void text-slate-400 text-sm">
        Restoring session...
      </div>
    );
  }

  return (
    <div
      className={`workspace-app flex relative bg-void overflow-x-hidden ${
        isChatPage ? "h-dvh overflow-hidden" : "min-h-screen"
      }`}
    >

      <ChatNotificationProvider enabled={isLoggedIn && !isPublicPage}>
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingSkeleton compact={isPublicPage} />}>
            <Routes>

          {/* ================= LOGIN ROUTES ================= */}

          <Route
            path="/login"
            element={
              !sessionReady
                ? <div className="p-8 text-slate-400">Loading...</div>
                : isLoggedIn
                ? <Navigate to="/" />
                : <Login portal="SUPER_ADMIN" portalLabel="GENERAL" onLogin={(role) => {
                    setUserRole(role);
                    setIsLoggedIn(true);
                    setAuthVersion((prev) => prev + 1);
                  }} />
            }
          />

          <Route
            path="/:tenantSlug/login"
            element={
              !sessionReady
                ? <div className="p-8 text-slate-400">Loading...</div>
                : isLoggedIn
                ? <Navigate to="/" />
                : <Login portal="GENERAL" onLogin={(role) => {
                    setUserRole(role);
                    setIsLoggedIn(true);
                    setAuthVersion((prev) => prev + 1);
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
                : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/:tenantSlug/login/admin"
            element={
              !sessionReady
                ? <div className="p-8 text-slate-400">Loading...</div>
                : isLoggedIn
                ? <Navigate to="/" />
                : <Login portal="ADMIN" onLogin={(role) => {
                    setUserRole(role);
                    setIsLoggedIn(true);
                    setAuthVersion((prev) => prev + 1);
                  }} />
            }
          />

          <Route
            path="/login/super-admin"
            element={
              !sessionReady
                ? <div className="p-8 text-slate-400">Loading...</div>
                : isLoggedIn
                ? <Navigate to="/" />
                : <Navigate to="/login" replace />
            }
          />

          {/* ================= PROTECTED APP ================= */}

          <Route
            path="/*"
            element={
              isLoggedIn || isPublicPage ? (
                isPublicPage ? (
                  <main className="workspace-main relative min-h-0 flex flex-1 flex-col overflow-hidden app-page-bg">
                    <div className={routeViewportClass}>
                      {appRoutes}
                    </div>
                  </main>
                ) : (
                  <>
                    <WorkbenchShell
                      userRole={userRole}
                      user={authUser}
                      roleLabel={roleLabel}
                      theme={theme}
                      onToggleTheme={toggleTheme}
                      onLogout={handleLogout}
                      pageHeader={pageHeader}
                      isChatPage={isChatPage}
                      shouldLockDocumentScroll={shouldLockDocumentScroll}
                    >
                      {appRoutes}
                    </WorkbenchShell>
                    <ChatMessageAlertToast />
                    <FollowUpReminderToast enabled={isLoggedIn && !isPublicPage} />
                    {["ADMIN", "MANAGER"].includes(userRole) ? (
                      <AdminRequestAlertToast userRole={userRole} />
                    ) : null}
                  </>
                )
              ) : (
                <Navigate to={getLoginPathForLocation(location.pathname)} />
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
