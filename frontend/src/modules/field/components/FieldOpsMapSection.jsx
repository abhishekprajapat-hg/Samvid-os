import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getGoogleMapsMapId, getPlacesApiKey, loadGoogleMaps } from "../../../utils/googlePlaces";

const toGooglePosition = ([lat, lng]) => ({ lat: Number(lat), lng: Number(lng) });

const addText = (parent, tag, text, className = "") => {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  parent.appendChild(element);
  return element;
};

const createMarkerNode = (type, active = false, stale = false) => {
  const node = document.createElement("div");
  const color = type === "property" ? "#f59e0b" : stale ? "#64748b" : active ? "#0e7490" : "#06b6d4";
  const size = active ? 36 : 31;
  node.style.cssText = `width:${size}px;height:${size}px;border-radius:50% 50% 50% 8px;background:${color};border:3px solid white;box-shadow:0 8px 20px rgba(15,23,42,.28);color:white;display:flex;align-items:center;justify-content:center;font:700 11px system-ui;transform:rotate(-45deg)`;
  const label = document.createElement("span");
  label.style.transform = "rotate(45deg)";
  label.textContent = type === "property" ? "P" : "E";
  node.appendChild(label);
  return node;
};

const FieldOpsMapSection = ({
  mapCenter,
  mapFocusTarget,
  mapExecutives,
  mapProperties,
  selectedExecutiveId,
  onExecutiveSelect,
  onPropertySelect,
  onOpenDirections,
  formatDateTime,
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const markerClassRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const fittedRef = useRef(false);
  const [status, setStatus] = useState(
    !getPlacesApiKey() ? "missing-key" : !getGoogleMapsMapId() ? "missing-map-id" : "loading",
  );

  useEffect(() => {
    if (!getPlacesApiKey() || !getGoogleMapsMapId()) return undefined;
    let cancelled = false;

    loadGoogleMaps()
      .then(async (google) => {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        if (cancelled || !containerRef.current) return;

        googleRef.current = google;
        markerClassRef.current = AdvancedMarkerElement;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: toGooglePosition(mapCenter),
          zoom: 9,
          mapId: getGoogleMapsMapId(),
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => { marker.map = null; });
      markersRef.current = [];
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
      googleRef.current = null;
      markerClassRef.current = null;
    };
    // The map is created once. The effects below update its markers and viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const map = mapRef.current;
    const google = googleRef.current;
    const Marker = markerClassRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !google || !Marker || !infoWindow) return;

    markersRef.current.forEach((marker) => { marker.map = null; });
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();

    mapExecutives.forEach((row) => {
      if (!row.markerPosition) return;
      const position = toGooglePosition(row.markerPosition);
      const marker = new Marker({
        map,
        position,
        title: row.executive.name || "Executive",
        gmpClickable: true,
      });
      marker.append(createMarkerNode("executive", String(row.executive._id) === String(selectedExecutiveId), row.markerMode === "live" && !row.markerIsFresh));
      marker.addEventListener("gmp-click", () => {
        const content = document.createElement("div");
        content.className = "min-w-[170px] space-y-1 py-1";
        addText(content, "p", row.executive.name || "Executive", "text-sm font-semibold text-slate-900");
        addText(content, "p", row.markerMode === "live"
          ? `Live location${row.markerIsFresh ? "" : " (stale)"}`
          : `Estimated city: ${row.markerCity}`, "text-xs text-slate-600");
        if (row.markerMode === "live") {
          addText(content, "p", `Updated: ${formatDateTime(row.markerUpdatedAt)}`, "text-xs text-slate-500");
        }
        addText(content, "p", `${row.activeAssigned} active | ${row.siteVisits} visits`, "text-xs text-slate-700");
        infoWindow.setContent(content);
        infoWindow.setPosition(position);
        infoWindow.open({ map });
        onExecutiveSelect(row);
      });
      bounds.extend(position);
      markersRef.current.push(marker);
    });

    mapProperties.forEach((asset) => {
      if (!asset.markerPosition) return;
      const position = toGooglePosition(asset.markerPosition);
      const marker = new Marker({
        map,
        position,
        title: asset.title || "Property",
        gmpClickable: true,
      });
      marker.append(createMarkerNode("property"));
      marker.addEventListener("gmp-click", () => {
        const content = document.createElement("div");
        content.className = "min-w-[190px] space-y-1 py-1";
        addText(content, "p", asset.title || "Property", "text-sm font-semibold text-slate-900");
        addText(content, "p", asset.location || "Location unavailable", "text-xs text-slate-600");
        addText(content, "p", `Status: ${asset.status || "Unknown"}`, "text-xs text-slate-700");
        addText(content, "p", asset.markerMode === "exact" ? "Exact property location" : "Estimated from location text", "text-xs text-slate-500");
        const button = addText(content, "button", "Directions", "mt-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700");
        button.type = "button";
        button.addEventListener("click", () => onOpenDirections(asset));
        infoWindow.setContent(content);
        infoWindow.setPosition(position);
        infoWindow.open({ map });
        onPropertySelect(asset);
      });
      bounds.extend(position);
      markersRef.current.push(marker);
    });

    if (!fittedRef.current && !bounds.isEmpty()) {
      fittedRef.current = true;
      map.fitBounds(bounds, 48);
      google.maps.event.addListenerOnce(map, "idle", () => {
        if (map.getZoom() > 16) map.setZoom(16);
      });
    }
  }, [status, mapExecutives, mapProperties, selectedExecutiveId, onExecutiveSelect, onPropertySelect, onOpenDirections, formatDateTime]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    if (Array.isArray(mapFocusTarget?.center)) {
      map.panTo(toGooglePosition(mapFocusTarget.center));
      map.setZoom(Number.isFinite(mapFocusTarget.zoom) ? mapFocusTarget.zoom : 15);
    }
  }, [status, mapFocusTarget]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-700">Executive Coverage Map</h2>
          <p className="mt-1 text-xs text-slate-500">Tap markers to inspect live coverage and property access points.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <span className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-cyan-700">{mapExecutives.length} Executives</span>
          <span className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-amber-700">{mapProperties.length} Properties</span>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <div ref={containerRef} className="field-ops-map h-[270px] w-full sm:h-[330px] lg:h-[390px]" aria-label="Google map of field executives and properties" />
        {status !== "ready" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/95 px-5 text-center text-sm text-slate-600">
            {status === "loading" ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading Google Maps...</span> : null}
            {status === "missing-key" ? "Google Maps is not configured. Add the CRM browser API key to show the live map." : null}
            {status === "missing-map-id" ? "Google Maps needs a Map ID to show property and executive pins." : null}
            {status === "error" ? "Google Maps could not load. Check the browser API key and allowed domains." : null}
          </div>
        ) : null}
        {status === "ready" && mapExecutives.length === 0 && mapProperties.length === 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">No locations in your access scope yet.</div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded-lg bg-slate-100 px-2 py-1">Cyan: executives</span>
        <span className="rounded-lg bg-slate-100 px-2 py-1">Amber: properties</span>
      </div>
    </section>
  );
};

export default FieldOpsMapSection;
