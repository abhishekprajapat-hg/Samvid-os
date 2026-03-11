import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../components/common/Screen";
import { getAllLeads } from "../../services/leadService";
import { getInventoryAssets } from "../../services/inventoryService";
import { getFieldExecutiveLocations, getUsers } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import type { InventoryAsset, Lead } from "../../types";

const ACTIVE_STATUSES = new Set(["NEW", "CONTACTED", "INTERESTED", "SITE_VISIT"]);
const LOCATION_REFRESH_INTERVAL_MS = 30000;
const LOCATION_STALE_MINUTES = 30;
const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const INDIA_BOUNDS: [[number, number], [number, number]] = [[6.4, 67.5], [37.6, 97.4]];

type FieldExecutive = {
  _id?: string;
  role?: string;
  name?: string;
  email?: string;
  isActive?: boolean;
  isLocationFresh?: boolean;
  liveLocation?: { lat?: number; lng?: number; updatedAt?: string } | null;
};

type PropertyMarker = {
  id: string;
  title: string;
  status: string;
  location: string;
  lat: number;
  lng: number;
  updatedAt: string;
  price: number;
  projectName: string;
  towerName: string;
  unitNumber: string;
};

const toFinite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasValidCoords = (lat: unknown, lng: unknown) => {
  const a = toFinite(lat);
  const b = toFinite(lng);
  return a !== null && b !== null && a >= -90 && a <= 90 && b >= -180 && b <= 180;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const getInventoryTitle = (asset: any) => {
  const composed = [asset?.projectName, asset?.towerName, asset?.unitNumber]
    .map((row) => String(row || "").trim())
    .filter(Boolean)
    .join(" - ");
  return composed || String(asset?.title || "Property");
};

const getExecutiveFromLead = (lead: Lead) => {
  const assignedFieldExecutive = (lead as any)?.assignedFieldExecutive;
  if (assignedFieldExecutive?._id) return assignedFieldExecutive;
  if (lead.assignedTo?._id && String(lead.assignedTo?.role || "").toUpperCase() === "FIELD_EXECUTIVE") return lead.assignedTo;
  return null;
};

const getLeadStatusLabel = (status?: string) => {
  const normalized = String(status || "NEW").toUpperCase();
  if (normalized === "SITE_VISIT") return "Site Visit";
  if (normalized === "INTERESTED") return "Interested";
  if (normalized === "CONTACTED") return "Contacted";
  if (normalized === "CLOSED") return "Closed";
  if (normalized === "LOST") return "Lost";
  return "New";
};

const getStatusStyle = (status?: string) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "SITE_VISIT") return styles.badgeVisit;
  if (normalized === "INTERESTED") return styles.badgeInterested;
  if (normalized === "CONTACTED") return styles.badgeContacted;
  if (normalized === "CLOSED") return styles.badgeClosed;
  if (normalized === "LOST") return styles.badgeLost;
  return styles.badgeDefault;
};

const mergeUsersWithLocations = (users: FieldExecutive[], locations: any[]) => {
  const byId = new Map((locations || []).filter((row) => row?._id).map((row) => [String(row._id), row]));
  return users.map((user) => {
    const location = byId.get(String(user?._id || ""));
    if (!location) return user;
    return {
      ...user,
      liveLocation: location.liveLocation || null,
      isLocationFresh: typeof location.isLocationFresh === "boolean" ? location.isLocationFresh : true,
    };
  });
};

const buildMapHtml = ({
  executives,
  properties,
  selectedExecutiveId,
  selectedPropertyId,
}: {
  executives: any[];
  properties: PropertyMarker[];
  selectedExecutiveId: string;
  selectedPropertyId: string;
}) => {
  const payload = JSON.stringify({ executives, properties, selectedExecutiveId, selectedPropertyId }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#f8fafc; }
    .property-pin { width:24px; height:24px; border-radius:999px; border:2px solid #92400e; background:#fbbf24; color:#7c2d12; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; }
    .property-pin-active { width:28px; height:28px; border-width:3px; background:#f59e0b; }
    .popup-btn { margin-top:8px; border:1px solid #cbd5e1; border-radius:7px; background:#fff; color:#0f172a; font-size:11px; font-weight:700; padding:5px 8px; cursor:pointer; }
  </style>
  </head><body><div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    const input = ${payload};
    const indiaBounds = L.latLngBounds([${INDIA_BOUNDS[0][0]}, ${INDIA_BOUNDS[0][1]}], [${INDIA_BOUNDS[1][0]}, ${INDIA_BOUNDS[1][1]}]);
    const map = L.map("map", {
      zoomControl:true,
      attributionControl:false,
      maxBounds: indiaBounds,
      maxBoundsViscosity: 1,
      minZoom: 4,
      maxZoom: 18,
      zoomSnap: 0.5
    }).setView([${INDIA_CENTER[0]},${INDIA_CENTER[1]}],5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19 }).addTo(map);
    const bounds = [];
    const postNative = (payload) => {
      const text = JSON.stringify(payload);
      try { if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(text); } catch (_) {}
      try { if (window.parent && window.parent !== window) window.parent.postMessage(text, "*"); } catch (_) {}
    };
    (input.executives || []).forEach((row) => {
      const selected = String(row.id || "") === String(input.selectedExecutiveId || "");
      const marker = L.circleMarker([row.lat, row.lng], { radius:selected ? 9 : 7, weight:selected ? 3 : 2, color:"#0f172a", fillColor:selected ? "#0f172a" : "#0ea5e9", fillOpacity:selected ? 0.95 : 0.78 }).addTo(map);
      marker.on("click", () => postNative({ type:"select-executive", id: row.id }));
      bounds.push([row.lat, row.lng]);
    });
    (input.properties || []).forEach((row) => {
      const selected = String(row.id || "") === String(input.selectedPropertyId || "");
      const marker = L.marker([row.lat, row.lng], {
        icon: L.divIcon({ className:"", html:'<div class="' + (selected ? "property-pin property-pin-active" : "property-pin") + '">&#8962;</div>', iconSize: selected ? [28,28] : [24,24], iconAnchor: selected ? [14,14] : [12,12], popupAnchor:[0,-10] })
      }).addTo(map);
      marker.bindPopup('<div><b>' + (row.title || "Property") + '</b><br/>' + (row.location || "") + '<br/>Status: ' + (row.status || "-") + '<br/><button class="popup-btn" onclick="window.__goDirection(\\'' + row.id + '\\')">Direction</button></div>');
      marker.on("click", () => postNative({ type:"select-property", id: row.id }));
      bounds.push([row.lat, row.lng]);
    });
    window.__goDirection = (id) => {
      const row = (input.properties || []).find((item) => String(item.id || "") === String(id || ""));
      if (!row) return;
      postNative({ type:"open-direction", lat: row.lat, lng: row.lng, id: row.id });
    };
    if (bounds.length) map.fitBounds(bounds, { padding:[24,24] });
    map.panInsideBounds(indiaBounds, { animate: false });
  </script></body></html>`;
};

const WebMapCanvas = ({ html, onMessage }: { html: string; onMessage: (event: any) => void }) => {
  const frameRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const handler = (event: MessageEvent) => {
      const frameWindow = frameRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;
      onMessage({ nativeEvent: { data: event.data } });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  if (Platform.OS === "web") {
    // @ts-ignore web-only
    return <iframe ref={frameRef} srcDoc={html} style={{ width: "100%", height: "100%", border: "0", display: "block" }} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />;
  }

  return <WebView originWhitelist={["*"]} source={{ html }} style={styles.mapView} onMessage={onMessage} javaScriptEnabled domStorageEnabled />;
};

export const FieldOpsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<FieldExecutive[]>([]);
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertyDetailVisible, setPropertyDetailVisible] = useState(false);
  const [activeLeadsVisible, setActiveLeadsVisible] = useState(false);
  const [siteVisitsVisible, setSiteVisitsVisible] = useState(false);
  const [allPropertiesVisible, setAllPropertiesVisible] = useState(false);
  const [leadQueueFilter, setLeadQueueFilter] = useState<"ALL" | "VISIT" | "OVERDUE">("ALL");

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      setError("");
      const [leadRows, userPayload, locationRows, inventoryRows] = await Promise.all([
        getAllLeads(),
        getUsers(),
        getFieldExecutiveLocations({ staleMinutes: LOCATION_STALE_MINUTES }).catch(() => []),
        getInventoryAssets().catch(() => []),
      ]);
      const baseUsers = Array.isArray(userPayload?.users) ? (userPayload.users as FieldExecutive[]) : [];
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setUsers(mergeUsersWithLocations(baseUsers, locationRows || []));
      setAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load field ops"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      getFieldExecutiveLocations({ staleMinutes: LOCATION_STALE_MINUTES })
        .then((rows) => setUsers((prev) => mergeUsersWithLocations(prev, rows || [])))
        .catch(() => {});
    }, LOCATION_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const dashboard = useMemo(() => {
    const now = new Date();
    const active = leads.filter((lead) => ACTIVE_STATUSES.has(String(lead.status || "").toUpperCase()));
    const fieldExec = users.filter((row) => String(row.role || "").toUpperCase() === "FIELD_EXECUTIVE" && row.isActive !== false);
    const byExec = new Map<string, Lead[]>();
    active.forEach((lead) => {
      const exec = getExecutiveFromLead(lead);
      const key = String(exec?._id || "");
      if (!key) return;
      if (!byExec.has(key)) byExec.set(key, []);
      byExec.get(key)!.push(lead);
    });
    const executiveStats = fieldExec.map((executive) => {
      const assignedRows = byExec.get(String(executive._id || "")) || [];
      const visits = assignedRows.filter((lead) => String(lead.status || "") === "SITE_VISIT").length;
      const overdue = assignedRows.filter((lead) => {
        if (!lead.nextFollowUp) return false;
        const d = new Date(lead.nextFollowUp);
        return !Number.isNaN(d.getTime()) && d < now;
      }).length;
      return { executive, assignedRows, activeAssigned: assignedRows.length, visits, overdue };
    });
    const siteVisits = active.filter((lead) => String(lead.status || "") === "SITE_VISIT").length;
    const overdue = active.filter((lead) => {
      if (!lead.nextFollowUp) return false;
      const d = new Date(lead.nextFollowUp);
      return !Number.isNaN(d.getTime()) && d < now;
    }).length;
    return { fieldExec, active, executiveStats, siteVisits, overdue };
  }, [leads, users]);

  const mapExecutives = useMemo(
    () =>
      dashboard.executiveStats
        .map((row) => {
          const lat = toFinite(row.executive.liveLocation?.lat);
          const lng = toFinite(row.executive.liveLocation?.lng);
          if (!hasValidCoords(lat, lng)) return null;
          return {
            id: String(row.executive._id || ""),
            name: String(row.executive.name || "Executive"),
            lat: Number(lat),
            lng: Number(lng),
            isFresh: row.executive.isLocationFresh !== false,
            activeAssigned: row.activeAssigned,
            visits: row.visits,
          };
        })
        .filter(Boolean) as any[],
    [dashboard.executiveStats],
  );

  const mapProperties = useMemo(
    () =>
      assets
        .map((asset: any) => {
          const lat = toFinite(asset?.siteLocation?.lat);
          const lng = toFinite(asset?.siteLocation?.lng);
          if (!hasValidCoords(lat, lng)) return null;
          return {
            id: String(asset?._id || ""),
            title: getInventoryTitle(asset),
            status: String(asset?.status || ""),
            location: String(asset?.location || ""),
            lat: Number(lat),
            lng: Number(lng),
            updatedAt: String(asset?.updatedAt || ""),
            price: Number(asset?.price || 0),
            projectName: String(asset?.projectName || ""),
            towerName: String(asset?.towerName || ""),
            unitNumber: String(asset?.unitNumber || ""),
          };
        })
        .filter(Boolean) as PropertyMarker[],
    [assets],
  );

  useEffect(() => {
    if (!dashboard.executiveStats.length) return setSelectedExecutiveId("");
    if (!dashboard.executiveStats.some((row) => String(row.executive._id || "") === String(selectedExecutiveId))) {
      setSelectedExecutiveId(String(dashboard.executiveStats[0].executive._id || ""));
    }
  }, [dashboard.executiveStats, selectedExecutiveId]);

  useEffect(() => {
    if (!mapProperties.length) return setSelectedPropertyId("");
    if (!mapProperties.some((row) => String(row.id) === String(selectedPropertyId))) {
      setSelectedPropertyId(String(mapProperties[0].id));
    }
  }, [mapProperties, selectedPropertyId]);

  const selectedExecutive = useMemo(
    () => dashboard.executiveStats.find((row) => String(row.executive._id || "") === String(selectedExecutiveId)) || null,
    [dashboard.executiveStats, selectedExecutiveId],
  );
  const selectedProperty = useMemo(
    () => mapProperties.find((row) => String(row.id) === String(selectedPropertyId)) || null,
    [mapProperties, selectedPropertyId],
  );
  const activeKpi = useMemo(() => {
    if (leadQueueFilter === "VISIT") return "SITE_VISITS";
    if (leadQueueFilter === "OVERDUE") return "OVERDUE";
    return "ACTIVE_LEADS";
  }, [leadQueueFilter]);

  const visibleLeadRows = useMemo(() => {
    const rows = selectedExecutive?.assignedRows || [];
    if (leadQueueFilter === "VISIT") {
      return rows.filter((lead) => String(lead.status || "").toUpperCase() === "SITE_VISIT");
    }
    if (leadQueueFilter === "OVERDUE") {
      return rows.filter((lead) => {
        if (!lead.nextFollowUp) return false;
        const d = new Date(lead.nextFollowUp);
        return !Number.isNaN(d.getTime()) && d < new Date();
      });
    }
    return rows;
  }, [selectedExecutive, leadQueueFilter]);
  const allActiveLeads = useMemo(
    () =>
      [...dashboard.active].sort((a, b) => {
        const da = new Date(a.nextFollowUp || a.updatedAt || a.createdAt || "").getTime();
        const db = new Date(b.nextFollowUp || b.updatedAt || b.createdAt || "").getTime();
        return (Number.isFinite(da) ? da : Number.MAX_SAFE_INTEGER) - (Number.isFinite(db) ? db : Number.MAX_SAFE_INTEGER);
      }),
    [dashboard.active],
  );
  const allSiteVisitLeads = useMemo(
    () =>
      leads
        .filter((lead) => String(lead.status || "").toUpperCase() === "SITE_VISIT")
        .sort((a, b) => {
          const da = new Date(a.updatedAt || a.nextFollowUp || a.createdAt || "").getTime();
          const db = new Date(b.updatedAt || b.nextFollowUp || b.createdAt || "").getTime();
          return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
        }),
    [leads],
  );

  const mapHtml = useMemo(
    () => buildMapHtml({ executives: mapExecutives, properties: mapProperties, selectedExecutiveId, selectedPropertyId }),
    [mapExecutives, mapProperties, selectedExecutiveId, selectedPropertyId],
  );

  const openDirections = async (lat?: number, lng?: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${lat},${lng}&travelmode=driving`;
    const can = await Linking.canOpenURL(url).catch(() => false);
    if (can) Linking.openURL(url).catch(() => {});
  };

  const openMap = async (lat?: number, lng?: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const can = await Linking.canOpenURL(url).catch(() => false);
    if (can) Linking.openURL(url).catch(() => {});
  };

  const onMapMessage = (event: any) => {
    try {
      const payload = JSON.parse(String(event?.nativeEvent?.data || "{}"));
      if (payload?.type === "select-executive" && payload?.id) setSelectedExecutiveId(String(payload.id));
      if (payload?.type === "select-property" && payload?.id) {
        setSelectedPropertyId(String(payload.id));
        setPropertyDetailVisible(true);
      }
      if (payload?.type === "open-direction") openDirections(Number(payload?.lat), Number(payload?.lng));
    } catch {}
  };

  return (
    <Screen title="Field Operations" subtitle="Live Map + Dispatch" loading={loading} error={error}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} showsVerticalScrollIndicator={false}>
        <View style={styles.kpis}>
          <Kpi
            label="Field Executives"
            value={dashboard.fieldExec.length}
            active={Boolean(selectedExecutiveId)}
            onPress={() => {
              setLeadQueueFilter("ALL");
              if (!selectedExecutiveId && dashboard.executiveStats[0]?.executive?._id) {
                setSelectedExecutiveId(String(dashboard.executiveStats[0].executive._id));
              }
            }}
          />
          <Kpi
            label="Active Leads"
            value={dashboard.active.length}
            active={activeKpi === "ACTIVE_LEADS"}
            onPress={() => {
              setLeadQueueFilter("ALL");
              setActiveLeadsVisible(true);
            }}
          />
          <Kpi
            label="Site Visits"
            value={dashboard.siteVisits}
            active={activeKpi === "SITE_VISITS"}
            onPress={() => {
              setLeadQueueFilter("VISIT");
              setSiteVisitsVisible(true);
            }}
          />
          <Kpi label="Overdue" value={dashboard.overdue} active={activeKpi === "OVERDUE"} onPress={() => setLeadQueueFilter("OVERDUE")} />
          <Kpi
            label="Properties on Map"
            value={mapProperties.length}
            active={Boolean(selectedPropertyId)}
            onPress={() => {
              setAllPropertiesVisible(true);
            }}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Executive Coverage Map</Text>
            <Text style={styles.sectionMeta}>{mapExecutives.length} executives | {mapProperties.length} properties</Text>
          </View>
          <View style={styles.mapContainer}>
            <WebMapCanvas html={mapHtml} onMessage={onMapMessage} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.section}>Executive Task Queue</Text>
          {dashboard.executiveStats.length === 0 ? (
            <Text style={styles.meta}>No field executives found.</Text>
          ) : (
            dashboard.executiveStats.map((row) => {
              const active = String(row.executive._id || "") === String(selectedExecutiveId);
              const lat = toFinite(row.executive.liveLocation?.lat);
              const lng = toFinite(row.executive.liveLocation?.lng);
              const hasLive = hasValidCoords(lat, lng);
              return (
                <Pressable
                  key={String(row.executive._id || Math.random())}
                  style={styles.card}
                  onPress={() => setSelectedExecutiveId(String(row.executive._id || ""))}
                >
                  <Text style={styles.title}>{row.executive.name || "Executive"}</Text>
                  <Text style={styles.meta}>{row.activeAssigned} active | {row.visits} visits | {row.overdue} overdue</Text>
                  <Text style={styles.meta}>
                    {hasLive ? `Live: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : "Live location unavailable"}
                  </Text>
                  {hasLive ? (
                    <View style={styles.actionRow}>
                      <Pressable style={styles.smallBtn} onPress={() => openMap(Number(lat), Number(lng))}>
                        <Text style={styles.smallBtnText}>Open Map</Text>
                      </Pressable>
                      <Pressable style={styles.smallBtn} onPress={() => openDirections(Number(lat), Number(lng))}>
                        <Text style={styles.smallBtnText}>Direction</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.section}>Properties</Text>
          {mapProperties.slice(0, 60).map((property) => {
            return (
              <Pressable key={property.id} style={styles.card} onPress={() => { setSelectedPropertyId(property.id); setPropertyDetailVisible(true); }}>
                <Text style={styles.title}>{property.title}</Text>
                <Text style={styles.meta}>{property.location}</Text>
                <Text style={styles.meta}>Status: {property.status || "-"} | Price: Rs {Number(property.price || 0).toLocaleString("en-IN")}</Text>
                <View style={styles.actionRow}>
                  <Pressable style={styles.smallBtn} onPress={() => openDirections(property.lat, property.lng)}>
                    <Text style={styles.smallBtnText}>Direction</Text>
                  </Pressable>
                  <Pressable style={styles.smallBtn} onPress={() => navigation.navigate("InventoryDetails", { assetId: property.id })}>
                    <Text style={styles.smallBtnText}>Details</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.section}>Lead Queue</Text>
          {!selectedExecutive ? <Text style={styles.meta}>Select executive on map or queue</Text> : visibleLeadRows.slice(0, 10).map((lead) => (
            <Pressable key={lead._id} style={styles.card} onPress={() => navigation.navigate("LeadDetails", { leadId: lead._id })}>
              <View style={styles.row}>
                <Text style={styles.title}>{lead.name || "-"}</Text>
                <Text style={[styles.badge, getStatusStyle(lead.status)]}>{getLeadStatusLabel(lead.status)}</Text>
              </View>
              <Text style={styles.meta}>{lead.projectInterested || "-"}</Text>
              <Text style={styles.meta}>Next follow-up: {formatDate(lead.nextFollowUp)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={propertyDetailVisible && Boolean(selectedProperty)} transparent animationType="slide" onRequestClose={() => setPropertyDetailVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: 12 + Math.max(insets.bottom, 10) }]}>
            {!selectedProperty ? null : (
              <>
                <Text style={styles.section}>Property Details</Text>
                <Text style={styles.title}>{selectedProperty.title}</Text>
                <Text style={styles.meta}>{selectedProperty.location}</Text>
                <Text style={styles.meta}>Status: {selectedProperty.status || "-"}</Text>
                <Text style={styles.meta}>Coordinates: {selectedProperty.lat.toFixed(6)}, {selectedProperty.lng.toFixed(6)}</Text>
                <View style={styles.modalActionRow}>
                  <Pressable style={styles.smallBtn} onPress={() => openMap(selectedProperty.lat, selectedProperty.lng)}>
                    <Text style={styles.smallBtnText}>Open Map</Text>
                  </Pressable>
                  <Pressable style={styles.smallBtn} onPress={() => openDirections(selectedProperty.lat, selectedProperty.lng)}>
                    <Text style={styles.smallBtnText}>Direction</Text>
                  </Pressable>
                  <Pressable style={styles.smallBtn} onPress={() => navigation.navigate("InventoryDetails", { assetId: selectedProperty.id })}>
                    <Text style={styles.smallBtnText}>Open Details</Text>
                  </Pressable>
                </View>
              </>
            )}
            <Pressable style={[styles.smallBtn, styles.modalCloseBtn]} onPress={() => setPropertyDetailVisible(false)}>
              <Text style={styles.smallBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={activeLeadsVisible} transparent animationType="slide" onRequestClose={() => setActiveLeadsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardLarge, { paddingBottom: 12 + Math.max(insets.bottom, 10) }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.section}>Active Leads</Text>
              <Text style={styles.sectionMeta}>{allActiveLeads.length} leads</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {allActiveLeads.length === 0 ? (
                <Text style={styles.meta}>No active leads found.</Text>
              ) : allActiveLeads.map((lead) => (
                <Pressable
                  key={lead._id}
                  style={styles.card}
                  onPress={() => {
                    setActiveLeadsVisible(false);
                    navigation.navigate("LeadDetails", { leadId: lead._id });
                  }}
                >
                  <View style={styles.row}>
                    <Text style={styles.title}>{lead.name || "-"}</Text>
                    <Text style={[styles.badge, getStatusStyle(lead.status)]}>{getLeadStatusLabel(lead.status)}</Text>
                  </View>
                  <Text style={styles.meta}>{lead.phone || "-"} | {lead.city || "-"}</Text>
                  <Text style={styles.meta}>{lead.projectInterested || "-"}</Text>
                  <Text style={styles.meta}>Next follow-up: {formatDate(lead.nextFollowUp)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[styles.smallBtn, styles.modalCloseBtn]} onPress={() => setActiveLeadsVisible(false)}>
              <Text style={styles.smallBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={allPropertiesVisible} transparent animationType="slide" onRequestClose={() => setAllPropertiesVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardLarge, { paddingBottom: 12 + Math.max(insets.bottom, 10) }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.section}>All Properties</Text>
              <Text style={styles.sectionMeta}>{mapProperties.length} properties</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {mapProperties.length === 0 ? (
                <Text style={styles.meta}>No properties with coordinates found.</Text>
              ) : mapProperties.map((property) => (
                <Pressable
                  key={property.id}
                  style={styles.card}
                  onPress={() => {
                    setAllPropertiesVisible(false);
                    setSelectedPropertyId(String(property.id));
                    setPropertyDetailVisible(true);
                  }}
                >
                  <Text style={styles.title}>{property.title}</Text>
                  <Text style={styles.meta}>{property.location || "-"}</Text>
                  <Text style={styles.meta}>Status: {property.status || "-"} | Price: Rs {Number(property.price || 0).toLocaleString("en-IN")}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[styles.smallBtn, styles.modalCloseBtn]} onPress={() => setAllPropertiesVisible(false)}>
              <Text style={styles.smallBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={siteVisitsVisible} transparent animationType="slide" onRequestClose={() => setSiteVisitsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCardLarge, { paddingBottom: 12 + Math.max(insets.bottom, 10) }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.section}>Visited Sites</Text>
              <Text style={styles.sectionMeta}>{allSiteVisitLeads.length} visits</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
              {allSiteVisitLeads.length === 0 ? (
                <Text style={styles.meta}>No site visits found.</Text>
              ) : allSiteVisitLeads.map((lead) => (
                <Pressable
                  key={lead._id}
                  style={styles.card}
                  onPress={() => {
                    setSiteVisitsVisible(false);
                    navigation.navigate("LeadDetails", { leadId: lead._id });
                  }}
                >
                  <View style={styles.row}>
                    <Text style={styles.title}>{lead.name || "-"}</Text>
                    <Text style={[styles.badge, styles.badgeVisit]}>Site Visit</Text>
                  </View>
                  <Text style={styles.meta}>{lead.projectInterested || "-"}</Text>
                  <Text style={styles.meta}>{lead.city || "-"} | {lead.phone || "-"}</Text>
                  <Text style={styles.meta}>Visited on: {formatDate(lead.updatedAt || lead.nextFollowUp)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[styles.smallBtn, styles.modalCloseBtn]} onPress={() => setSiteVisitsVisible(false)}>
              <Text style={styles.smallBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const Kpi = ({ label, value, onPress }: { label: string; value: number; onPress?: () => void; active?: boolean }) => (
  <Pressable style={styles.kpiCard} onPress={onPress}>
    <Text style={styles.meta}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  kpis: { gap: 8, marginBottom: 10 },
  kpiCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 10 },
  value: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  sectionCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 10, marginBottom: 10 },
  section: { marginBottom: 8, textTransform: "uppercase", fontSize: 12, letterSpacing: 1, fontWeight: "700", color: "#334155" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 },
  sectionMeta: { fontSize: 11, color: "#64748b" },
  mapContainer: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, overflow: "hidden", height: 320, backgroundColor: "#f8fafc" },
  mapView: { flex: 1, backgroundColor: "#f8fafc" },
  card: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 10, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontWeight: "700", color: "#0f172a", flex: 1 },
  meta: { marginTop: 2, color: "#64748b", fontSize: 12 },
  badge: { fontSize: 10, textTransform: "uppercase", fontWeight: "700", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  badgeDefault: { backgroundColor: "#f1f5f9", color: "#334155" },
  badgeVisit: { backgroundColor: "#e0e7ff", color: "#4338ca" },
  badgeInterested: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeContacted: { backgroundColor: "#cffafe", color: "#155e75" },
  badgeClosed: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeLost: { backgroundColor: "#ffe4e6", color: "#be123c" },
  actionRow: { marginTop: 8, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modalActionRow: { marginTop: 8, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  smallBtn: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  smallBtnText: { color: "#334155", fontSize: 11, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end", padding: 12 },
  modalCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#fff", padding: 12 },
  modalCardLarge: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#fff", padding: 12, maxHeight: "84%" },
  modalCloseBtn: { marginTop: 10, alignSelf: "flex-end" },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalList: { maxHeight: 440 },
});
