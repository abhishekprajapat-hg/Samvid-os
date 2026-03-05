import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Clock3,
  MapPin,
  RefreshCw,
  Route,
  Search,
  Signal,
  Users,
  X,
} from "lucide-react";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssetsWithMeta } from "../../services/inventoryService";
import { getFieldExecutiveLocations, getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import FieldOpsTaskQueueSection from "./components/FieldOpsTaskQueueSection";
import FieldOpsQuickLocateSection from "./components/FieldOpsQuickLocateSection";
import FieldOpsDispatchQueueSection from "./components/FieldOpsDispatchQueueSection";
import FieldOpsVisitsSection from "./components/FieldOpsVisitsSection";
import FieldOpsWorkloadSection from "./components/FieldOpsWorkloadSection";
import FieldOpsMapSection from "./components/FieldOpsMapSection";
import { StatCard } from "./components/FieldOpsShared";

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT", "REQUESTED"]);
const VISIT_STATUS = "SITE_VISIT";
const DEFAULT_MAP_CENTER = [28.6139, 77.209];
const LOCATION_STALE_MINUTES = 30;
const LIVE_LOCATION_REFRESH_INTERVAL_MS = 30000;
const CITY_COORDINATES = {
  noida: [28.5355, 77.391],
  gurgaon: [28.4595, 77.0266],
  gurugram: [28.4595, 77.0266],
  delhi: [28.6139, 77.209],
  ghaziabad: [28.6692, 77.4538],
  faridabad: [28.4089, 77.3178],
  indore: [22.7196, 75.8577],
  mumbai: [19.076, 72.8777],
  pune: [18.5204, 73.8567],
  jaipur: [26.9124, 75.7873],
  chandigarh: [30.7333, 76.7794],
};

const PROPERTY_MARKER_ICON = divIcon({
  className: "property-map-marker",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -12],
  html: `
    <div style="
      width:30px;
      height:30px;
      border-radius:9999px;
      background:#f59e0b;
      border:2px solid #b45309;
      box-shadow:0 2px 6px rgba(15,23,42,0.35);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 10.5L12 3l9 7.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 9.5V20h12V9.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M10 20v-5h4v5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
  `,
});

const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDateTime = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const hasValidCoordinates = (lat, lng) =>
  Number.isFinite(lat)
  && Number.isFinite(lng)
  && lat >= -90
  && lat <= 90
  && lng >= -180
  && lng <= 180;

const normalizePosition = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;

  const lat = Number(value[0]);
  const lng = Number(value[1]);

  if (!hasValidCoordinates(lat, lng)) return null;
  return [lat, lng];
};

const formatCoordinates = (siteLocation) => {
  const lat = Number(siteLocation?.lat);
  const lng = Number(siteLocation?.lng);
  if (!hasValidCoordinates(lat, lng)) return "";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const buildDirectionsUrl = ({ destination, origin = null }) => {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination[0]},${destination[1]}`,
    travelmode: "driving",
  });

  if (origin) {
    params.set("origin", `${origin[0]},${origin[1]}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const getLeadLocationLabel = (lead) => {
  const city = String(lead?.city || "").trim();
  const coordinates = formatCoordinates(lead?.siteLocation);

  if (city && coordinates) return `${city} (${coordinates})`;
  if (city) return city;
  if (coordinates) return coordinates;
  return "Location unavailable";
};

const getInventoryCoordinates = (asset) => {
  const lat = Number(asset?.siteLocation?.lat);
  const lng = Number(asset?.siteLocation?.lng);

  if (hasValidCoordinates(lat, lng)) {
    return {
      position: [lat, lng],
      mode: "exact",
    };
  }

  const locationText = String(asset?.location || "").trim().toLowerCase();
  if (!locationText) return null;

  const matchedCityKey = Object.keys(CITY_COORDINATES).find((key) => locationText.includes(key));
  const base = matchedCityKey ? CITY_COORDINATES[matchedCityKey] : DEFAULT_MAP_CENTER;
  const hash = Math.abs(hashText(`${asset?._id || asset?.title || "property"}:${locationText}`));
  const latJitter = ((hash % 2001) - 1000) / 50000;
  const lngJitter = ((Math.floor(hash / 2001) % 2001) - 1000) / 50000;

  return {
    position: [base[0] + latJitter, base[1] + lngJitter],
    mode: matchedCityKey ? "estimated-city" : "estimated",
  };
};

const getExecutiveFromLead = (lead) => {
  if (lead?.assignedFieldExecutive?._id) {
    return lead.assignedFieldExecutive;
  }
  if (lead?.assignedTo?.role === "FIELD_EXECUTIVE") {
    return lead.assignedTo;
  }
  return null;
};

const hashText = (value) => {
  const text = String(value || "0");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
};

const getCityCoordinates = (cityName) => {
  const key = String(cityName || "").trim().toLowerCase();
  return CITY_COORDINATES[key] || DEFAULT_MAP_CENTER;
};

const getLiveCoordinates = (executive) => {
  const lat = Number(executive?.liveLocation?.lat);
  const lng = Number(executive?.liveLocation?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return [lat, lng];
};

const buildExecutiveCoordinates = (row) => {
  const livePosition = getLiveCoordinates(row.executive);
  if (livePosition) {
    return {
      position: livePosition,
      city: "Live",
      mode: "live",
      isFresh: row.executive?.isLocationFresh !== false,
      updatedAt: row.executive?.liveLocation?.updatedAt || null,
    };
  }

  const leadWithCity = row.assignedRows.find((lead) => String(lead.city || "").trim());
  const city = String(leadWithCity?.city || "").trim();
  const base = getCityCoordinates(city);

  const hash = Math.abs(hashText(`${row.executive._id}:${city || "default"}`));
  const latJitter = ((hash % 2001) - 1000) / 45000;
  const lngJitter = ((Math.floor(hash / 2001) % 2001) - 1000) / 45000;

  return {
    position: [base[0] + latJitter, base[1] + lngJitter],
    city: city || "Unknown",
    mode: "estimated",
    isFresh: false,
    updatedAt: null,
  };
};

const mergeUsersWithLocationRows = (users, locationRows) => {
  if (!Array.isArray(users) || !users.length) return [];
  if (!Array.isArray(locationRows) || !locationRows.length) return users;

  const locationMap = new Map(
    locationRows
      .filter((row) => row?._id)
      .map((row) => [String(row._id), row]),
  );

  return users.map((user) => {
    const locationRow = locationMap.get(String(user?._id || ""));
    if (!locationRow) {
      return user;
    }

    return {
      ...user,
      liveLocation: locationRow.liveLocation || null,
      isLocationFresh:
        typeof locationRow.isLocationFresh === "boolean"
          ? locationRow.isLocationFresh
          : user.isLocationFresh,
      lastAssignedAt: locationRow.lastAssignedAt || user.lastAssignedAt || null,
    };
  });
};

const FieldOps = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [inventoryAssets, setInventoryAssets] = useState([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);

  const focusMapOnPosition = useCallback((position, zoom = 15) => {
    const center = normalizePosition(position);
    if (!center) return;

    setMapFocusTarget({
      center,
      zoom,
      key: `${center[0]}:${center[1]}:${Date.now()}`,
    });
  }, []);

  const openDirectionsForProperty = useCallback(async (asset) => {
    const destination = normalizePosition(asset?.markerPosition);
    if (!destination) {
      setError("Directions unavailable for this property location");
      return;
    }

    let origin = null;

    const activeExecutive = users.find(
      (user) => String(user?._id || "") === String(selectedExecutiveId),
    ) || null;
    const executiveLive = getLiveCoordinates(activeExecutive);
    if (executiveLive) {
      origin = executiveLive;
    } else if (typeof navigator !== "undefined" && navigator.geolocation) {
      origin = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const current = normalizePosition([
              position?.coords?.latitude,
              position?.coords?.longitude,
            ]);
            resolve(current);
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
        );
      });
    }

    const url = buildDirectionsUrl({ destination, origin });
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [selectedExecutiveId, users]);

  const refreshLiveLocations = useCallback(async () => {
    try {
      const locationRows = await getFieldExecutiveLocations({
        staleMinutes: LOCATION_STALE_MINUTES,
      });
      setUsers((previous) => mergeUsersWithLocationRows(previous, locationRows));
      setLastSyncedAt(new Date().toISOString());
    } catch {
      // Keep map usable even if live location endpoint is unavailable.
    }
  }, []);

  const loadFieldOps = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const [leadRows, userPayload, inventoryPayload] = await Promise.all([
        getAllLeads(),
        getUsers(),
        getInventoryAssetsWithMeta(),
      ]);
      const userRows = userPayload?.users || [];
      const inventoryRows = inventoryPayload?.assets || [];
      let locationRows = [];

      try {
        locationRows = await getFieldExecutiveLocations({
          staleMinutes: LOCATION_STALE_MINUTES,
        });
      } catch {
        locationRows = [];
      }

      const mergedUsers = mergeUsersWithLocationRows(userRows, locationRows);

      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setUsers(Array.isArray(mergedUsers) ? mergedUsers : []);
      setInventoryAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
      setLastSyncedAt(new Date().toISOString());
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, "Failed to load field operations"));
      setLeads([]);
      setUsers([]);
      setInventoryAssets([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFieldOps(false);
  }, [loadFieldOps]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshLiveLocations();
    }, LIVE_LOCATION_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [refreshLiveLocations]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const fieldExecutives = users.filter(
      (user) => user.role === "FIELD_EXECUTIVE" && user.isActive !== false,
    );

    const activeLeads = leads.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "")));
    const siteVisitLeads = activeLeads.filter((lead) => String(lead.status || "") === VISIT_STATUS);
    const unassignedQueue = activeLeads.filter((lead) => !lead.assignedTo?._id);

    const overdueFollowUps = activeLeads.filter((lead) => {
      const followUp = toDate(lead.nextFollowUp);
      return followUp && followUp < now;
    });

    const leadRowsByExecutive = new Map();
    activeLeads.forEach((lead) => {
      const executive = getExecutiveFromLead(lead);
      if (!executive?._id) return;

      const key = String(executive._id);
      if (!leadRowsByExecutive.has(key)) {
        leadRowsByExecutive.set(key, []);
      }
      leadRowsByExecutive.get(key).push(lead);
    });

    const executiveStats = fieldExecutives
      .map((executive) => {
        const assignedRows = leadRowsByExecutive.get(String(executive._id)) || [];

        const siteVisits = assignedRows.filter(
          (lead) => String(lead.status || "") === VISIT_STATUS,
        ).length;

        const overdue = assignedRows.filter((lead) => {
          const followUp = toDate(lead.nextFollowUp);
          return followUp && followUp < now;
        }).length;

        const todaysVisits = assignedRows.filter((lead) => {
          if (String(lead.status || "") !== VISIT_STATUS) return false;
          const followUp = toDate(lead.nextFollowUp);
          return followUp ? isSameDay(followUp, now) : false;
        }).length;

        return {
          executive,
          activeAssigned: assignedRows.length,
          siteVisits,
          overdue,
          todaysVisits,
          assignedRows: assignedRows.sort((a, b) => {
            const aDate = toDate(a.nextFollowUp) || toDate(a.createdAt) || new Date(0);
            const bDate = toDate(b.nextFollowUp) || toDate(b.createdAt) || new Date(0);
            return aDate - bDate;
          }),
        };
      })
      .sort((a, b) => b.siteVisits - a.siteVisits || b.activeAssigned - a.activeAssigned);

    const visitsTimeline = siteVisitLeads
      .map((lead) => ({
        ...lead,
        followUpDate: toDate(lead.nextFollowUp),
      }))
      .sort((a, b) => {
        const aDate = a.followUpDate || toDate(a.createdAt) || new Date(0);
        const bDate = b.followUpDate || toDate(b.createdAt) || new Date(0);
        return aDate - bDate;
      })
      .slice(0, 10);

    return {
      fieldExecutives,
      activeLeads,
      siteVisitLeads,
      unassignedQueue,
      overdueFollowUps,
      executiveStats,
      visitsTimeline,
    };
  }, [leads, users]);

  useEffect(() => {
    if (!dashboard.executiveStats.length) {
      setSelectedExecutiveId("");
      return;
    }

    const exists = dashboard.executiveStats.some(
      (item) => String(item.executive._id) === String(selectedExecutiveId),
    );

    if (!exists) {
      setSelectedExecutiveId(String(dashboard.executiveStats[0].executive._id));
    }
  }, [dashboard.executiveStats, selectedExecutiveId]);

  const selectedExecutive = useMemo(
    () =>
      dashboard.executiveStats.find(
        (item) => String(item.executive._id) === String(selectedExecutiveId),
      ) || null,
    [dashboard.executiveStats, selectedExecutiveId],
  );

  const mapExecutives = useMemo(
    () =>
      dashboard.executiveStats.map((row) => {
        const location = buildExecutiveCoordinates(row);
        return {
          ...row,
          markerPosition: normalizePosition(location.position),
          markerCity: location.city,
          markerMode: location.mode,
          markerIsFresh: location.isFresh,
          markerUpdatedAt: location.updatedAt,
        };
      }),
    [dashboard.executiveStats],
  );

  const mapProperties = useMemo(
    () =>
      inventoryAssets
        .map((asset) => {
          const markerLocation = getInventoryCoordinates(asset);
          if (!markerLocation) return null;

          return {
            ...asset,
            markerPosition: normalizePosition(markerLocation.position),
            markerMode: markerLocation.mode,
          };
        })
        .filter((row) => Boolean(row && row.markerPosition)),
    [inventoryAssets],
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const visibleExecutiveStats = useMemo(() => {
    if (!trimmedQuery) return dashboard.executiveStats;

    return dashboard.executiveStats.filter((row) => {
      const executiveText = [
        row?.executive?.name,
        row?.executive?.email,
        row?.executive?.phone,
      ]
        .join(" ")
        .toLowerCase();

      if (executiveText.includes(trimmedQuery)) return true;

      return row.assignedRows.some((lead) => {
        const leadText = [
          lead?.name,
          lead?.projectInterested,
          lead?.city,
          lead?.phone,
        ]
          .join(" ")
          .toLowerCase();
        return leadText.includes(trimmedQuery);
      });
    });
  }, [dashboard.executiveStats, trimmedQuery]);

  const visibleMapExecutives = useMemo(() => {
    const locatable = mapExecutives.filter((row) => Boolean(row.markerPosition));
    if (!trimmedQuery) return locatable;

    return locatable.filter((row) => {
      const rowText = [
        row?.executive?.name,
        row?.executive?.email,
        row?.executive?.phone,
        row?.markerCity,
      ]
        .join(" ")
        .toLowerCase();
      return rowText.includes(trimmedQuery);
    });
  }, [mapExecutives, trimmedQuery]);

  const visibleMapProperties = useMemo(() => {
    if (!trimmedQuery) return mapProperties;

    return mapProperties.filter((asset) => {
      const assetText = [
        asset?.title,
        asset?.location,
        asset?.status,
      ]
        .join(" ")
        .toLowerCase();
      return assetText.includes(trimmedQuery);
    });
  }, [mapProperties, trimmedQuery]);

  const visibleDispatchQueue = useMemo(() => {
    if (!trimmedQuery) return dashboard.unassignedQueue;

    return dashboard.unassignedQueue.filter((lead) => {
      const leadText = [
        lead?.name,
        lead?.projectInterested,
        lead?.city,
        lead?.phone,
      ]
        .join(" ")
        .toLowerCase();
      return leadText.includes(trimmedQuery);
    });
  }, [dashboard.unassignedQueue, trimmedQuery]);

  const visibleVisitsTimeline = useMemo(() => {
    if (!trimmedQuery) return dashboard.visitsTimeline;

    return dashboard.visitsTimeline.filter((lead) => {
      const leadText = [
        lead?.name,
        lead?.projectInterested,
        lead?.city,
        lead?.assignedTo?.name,
      ]
        .join(" ")
        .toLowerCase();
      return leadText.includes(trimmedQuery);
    });
  }, [dashboard.visitsTimeline, trimmedQuery]);

  const locatableExecutives = useMemo(
    () => visibleMapExecutives.filter((row) => Boolean(row.markerPosition)),
    [visibleMapExecutives],
  );

  const mapCenter = useMemo(() => {
    const applyFilteredMarkers = Boolean(trimmedQuery);
    const executivesForCenter = applyFilteredMarkers
      ? visibleMapExecutives
      : mapExecutives.filter((row) => Boolean(row.markerPosition));
    const propertiesForCenter = applyFilteredMarkers ? visibleMapProperties : mapProperties;

    const allMarkerPositions = [
      ...executivesForCenter.map((row) => row.markerPosition),
      ...propertiesForCenter.map((row) => row.markerPosition),
    ].filter(Boolean);

    if (!allMarkerPositions.length) {
      return DEFAULT_MAP_CENTER;
    }

    const total = allMarkerPositions.reduce(
      (acc, row) => ({
        lat: acc.lat + row[0],
        lng: acc.lng + row[1],
      }),
      { lat: 0, lng: 0 },
    );

    return [
      total.lat / allMarkerPositions.length,
      total.lng / allMarkerPositions.length,
    ];
  }, [mapExecutives, mapProperties, trimmedQuery, visibleMapExecutives, visibleMapProperties]);

  const liveTrackedExecutives = useMemo(
    () =>
      mapExecutives.filter(
        (row) => row.markerMode === "live" && row.markerIsFresh !== false,
      ).length,
    [mapExecutives],
  );

  const staleTrackedExecutives = useMemo(
    () =>
      mapExecutives.filter(
        (row) => row.markerMode === "live" && row.markerIsFresh === false,
      ).length,
    [mapExecutives],
  );

  const averageLoad = useMemo(() => {
    const totalExecutives = dashboard.executiveStats.length;
    if (!totalExecutives) return 0;
    const totalAssigned = dashboard.executiveStats.reduce(
      (sum, row) => sum + Number(row.activeAssigned || 0),
      0,
    );
    return Math.round((totalAssigned / totalExecutives) * 10) / 10;
  }, [dashboard.executiveStats]);

  const coveragePercent = dashboard.fieldExecutives.length
    ? Math.round((liveTrackedExecutives / dashboard.fieldExecutives.length) * 100)
    : 0;

  const visitShare = dashboard.activeLeads.length
    ? Math.round((dashboard.siteVisitLeads.length / dashboard.activeLeads.length) * 100)
    : 0;

  const handleExecutiveFocus = useCallback((row) => {
    const executiveId = String(row?.executive?._id || "");
    if (!executiveId) return;

    setSelectedExecutiveId(executiveId);
    setSelectedPropertyId("");
    focusMapOnPosition(row?.markerPosition, 14);
  }, [focusMapOnPosition]);

  const handlePropertyFocus = useCallback((asset) => {
    const propertyId = String(asset?._id || "");
    if (!propertyId) return;

    setSelectedPropertyId(propertyId);
    focusMapOnPosition(asset?.markerPosition, 15);
  }, [focusMapOnPosition]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center gap-2 text-sm text-slate-500">
        <RefreshCw size={16} className="animate-spin" />
        Loading field operations...
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-3 py-5 sm:px-6 sm:py-6 lg:px-8 custom-scrollbar">
      <div className="space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white sm:text-2xl">Field Ops Command Center</h1>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-100/80">
                  Live coordination for visit teams, dispatch load, and ground coverage
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => loadFieldOps(true)}
                  disabled={refreshing}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 text-xs font-semibold text-white backdrop-blur hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/leads")}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Open Leads
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] sm:flex-wrap sm:overflow-visible sm:pb-0">
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-cyan-100">
                <Signal size={12} />
                Live tracked: {liveTrackedExecutives}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-cyan-100">
                Coverage: {coveragePercent}%
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-cyan-100">
                Visit share: {visitShare}%
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-cyan-100">
                Last sync: {formatDateTime(lastSyncedAt)}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search executive, lead, project, city, or property..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1">
                  {trimmedQuery
                    ? `${visibleMapExecutives.length + visibleMapProperties.length + visibleDispatchQueue.length} matched records`
                    : "Showing full field scope"}
                </span>
                {staleTrackedExecutives > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                    {staleTrackedExecutives} stale live locations
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            title="Active Executives"
            value={dashboard.fieldExecutives.length}
            helper="Available for assignments"
            icon={Users}
          />
          <StatCard
            title="Live Tracked"
            value={liveTrackedExecutives}
            helper={`${coveragePercent}% tracking coverage`}
            icon={Signal}
          />
          <StatCard
            title="Site Visits"
            value={dashboard.siteVisitLeads.length}
            helper={`${visitShare}% of active pipeline`}
            icon={MapPin}
          />
          <StatCard
            title="Overdue Follow-ups"
            value={dashboard.overdueFollowUps.length}
            helper="Requires immediate intervention"
            icon={Clock3}
          />
          <StatCard
            title="Dispatch Queue"
            value={dashboard.unassignedQueue.length}
            helper="Unassigned active leads"
            icon={Route}
          />
          <StatCard
            title="Average Load"
            value={averageLoad}
            helper="Active leads per executive"
            icon={Activity}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
          <FieldOpsMapSection
            mapCenter={mapCenter}
            mapFocusTarget={mapFocusTarget}
            mapExecutives={visibleMapExecutives}
            mapProperties={visibleMapProperties}
            selectedExecutiveId={selectedExecutiveId}
            onExecutiveSelect={handleExecutiveFocus}
            onPropertySelect={handlePropertyFocus}
            onOpenDirections={openDirectionsForProperty}
            propertyMarkerIcon={PROPERTY_MARKER_ICON}
            formatDateTime={formatDateTime}
          />

          <div className="space-y-5">
            <FieldOpsQuickLocateSection
              locatableExecutives={locatableExecutives}
              selectedExecutiveId={selectedExecutiveId}
              selectedPropertyId={selectedPropertyId}
              mapProperties={visibleMapProperties}
              onExecutiveSelect={handleExecutiveFocus}
              onPropertySelect={handlePropertyFocus}
            />
            <FieldOpsTaskQueueSection
              selectedExecutive={selectedExecutive}
              formatDateTime={formatDateTime}
              getLeadLocationLabel={getLeadLocationLabel}
              getLiveCoordinates={getLiveCoordinates}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <FieldOpsDispatchQueueSection
            unassignedQueue={visibleDispatchQueue}
            formatDateTime={formatDateTime}
            getLeadLocationLabel={getLeadLocationLabel}
          />

          <FieldOpsVisitsSection
            visitsTimeline={visibleVisitsTimeline}
            formatDateTime={formatDateTime}
            getLeadLocationLabel={getLeadLocationLabel}
          />
        </div>

        <FieldOpsWorkloadSection
          executiveStats={visibleExecutiveStats}
          selectedExecutiveId={selectedExecutiveId}
          onExecutiveSelect={handleExecutiveFocus}
          formatDateTime={formatDateTime}
        />
      </div>
    </div>
  );
};

export default FieldOps;
