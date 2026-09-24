import React, { useEffect } from "react";
import { Route } from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import { EmptyState } from "./FieldOpsShared";

const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_TILE_ATTRIBUTION = "&copy; OpenStreetMap contributors";

const MapViewportController = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(target?.center) || target.center.length !== 2) return;
    const nextZoom = Number.isFinite(target.zoom) ? target.zoom : map.getZoom();
    map.flyTo(target.center, nextZoom, { duration: 0.6 });
  }, [map, target]);

  return null;
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
  propertyMarkerIcon,
  formatDateTime,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-700">
          Executive Coverage Map
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Tap markers to inspect live coverage and property access points.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-cyan-700">
          {mapExecutives.length} Executives
        </span>
        <span className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-amber-700">
          {mapProperties.length} Properties
        </span>
      </div>
    </div>

    {mapExecutives.length === 0 && mapProperties.length === 0 ? (
      <EmptyState text="No live executives or property coordinates found for your access scope." />
    ) : (
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="field-ops-map h-[270px] overflow-hidden sm:h-[330px] lg:h-[390px]">
          <MapContainer
            center={mapCenter}
            zoom={9}
            zoomControl={false}
            scrollWheelZoom
            className="h-full w-full"
            attributionControl
          >
            <TileLayer
              url={MAP_TILE_URL}
              attribution={MAP_TILE_ATTRIBUTION}
              maxZoom={19}
            />
            <ZoomControl position="topright" />
            <MapViewportController target={mapFocusTarget} />

            {mapExecutives.map((row) => {
              const id = String(row.executive._id);
              const active = id === String(selectedExecutiveId);
              if (!row.markerPosition) return null;

              return (
                <CircleMarker
                  key={id}
                  center={row.markerPosition}
                  radius={active ? 11 : 8}
                  pathOptions={{
                    color: active ? "#083344" : "#ffffff",
                    fillColor: active ? "#0891b2" : "#06b6d4",
                    fillOpacity: active ? 0.98 : 0.88,
                    opacity: 1,
                    weight: active ? 4 : 3,
                  }}
                  eventHandlers={{
                    click: () => onExecutiveSelect(row),
                  }}
                >
                  <Popup>
                    <div className="min-w-[170px]">
                      <p className="text-sm font-semibold text-slate-900">
                        {row.executive.name || "Executive"}
                      </p>
                      <p className="text-xs text-slate-600">
                        {row.markerMode === "live"
                          ? `Live location${row.markerIsFresh ? "" : " (stale)"}`
                          : `Estimated city: ${row.markerCity}`}
                      </p>
                      {row.markerMode === "live" && (
                        <p className="text-xs text-slate-500">
                          Updated: {formatDateTime(row.markerUpdatedAt)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-700">
                        {row.activeAssigned} active | {row.siteVisits} visits
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {mapProperties.map((asset) => {
              const propertyId = String(asset._id || "");

              return (
                <Marker
                  key={`property-${propertyId}`}
                  position={asset.markerPosition}
                  icon={propertyMarkerIcon}
                  eventHandlers={{
                    click: () => {
                      if (!asset.markerPosition) return;
                      onPropertySelect(asset);
                    },
                  }}
                >
                  <Popup>
                    <div className="min-w-[190px]">
                      <p className="text-sm font-semibold text-slate-900">
                        {asset.title || "Property"}
                      </p>
                      <p className="text-xs text-slate-600">
                        {asset.location || "Location unavailable"}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        Status: {asset.status || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {asset.markerMode === "exact"
                          ? "Exact property location"
                          : "Estimated from location text"}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenDirections(asset)}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Route size={12} />
                        Directions
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            Executive markers
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Property markers
          </span>
        </div>
      </div>
    )}
  </section>
);

export default FieldOpsMapSection;
