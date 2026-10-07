import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import {
  getGoogleMapsMapId,
  getPlacesApiKey,
  loadGoogleMaps,
} from "../../utils/googlePlaces";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

const toCoordinate = (value, min, max) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

const getPosition = (latitude, longitude) => {
  const lat = toCoordinate(latitude, -90, 90);
  const lng = toCoordinate(longitude, -180, 180);
  return lat === null || lng === null ? null : { lat, lng };
};

const GoogleMapPicker = ({
  latitude,
  longitude,
  onChange,
  className = "",
  heightClass = "h-56",
  isDark = false,
  readOnly = false,
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapClickListenerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState(
    !getPlacesApiKey() ? "missing-key" : !getGoogleMapsMapId() ? "missing-map-id" : "loading",
  );
  const position = getPosition(latitude, longitude);
  const positionLat = position?.lat ?? null;
  const positionLng = position?.lng ?? null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    if (!getPlacesApiKey() || !getGoogleMapsMapId() || !containerRef.current) return undefined;

    loadGoogleMaps()
      .then(async (google) => {
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
        if (cancelled || !containerRef.current) return;

        const initialPosition = getPosition(latitude, longitude);
        const map = new google.maps.Map(containerRef.current, {
          center: initialPosition || DEFAULT_CENTER,
          zoom: initialPosition ? 16 : 10,
          mapId: getGoogleMapsMapId(),
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;

        const pin = new PinElement({
          background: "#0f766e",
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
        });
        const marker = new AdvancedMarkerElement({
          map: initialPosition ? map : null,
          position: initialPosition || DEFAULT_CENTER,
          title: "Selected location",
          gmpDraggable: !readOnly,
        });
        marker.append(pin);
        markerRef.current = marker;

        if (!readOnly) {
          mapClickListenerRef.current = map.addListener("click", (event) => {
            const lat = event.latLng?.lat();
            const lng = event.latLng?.lng();
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            marker.map = map;
            marker.position = { lat, lng };
            onChangeRef.current?.({ lat, lng });
          });

          marker.addEventListener("gmp-dragend", () => {
            const current = marker.position;
            const lat = typeof current?.lat === "function" ? current.lat() : current?.lat;
            const lng = typeof current?.lng === "function" ? current.lng() : current?.lng;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              onChangeRef.current?.({ lat, lng });
            }
          });
        }

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      mapClickListenerRef.current?.remove?.();
      mapClickListenerRef.current = null;
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      mapRef.current = null;
    };
    // The map is created once; coordinate changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (positionLat === null || positionLng === null) {
      marker.map = null;
      return;
    }

    const nextPosition = { lat: positionLat, lng: positionLng };
    marker.map = map;
    marker.position = nextPosition;
    map.panTo(nextPosition);
  }, [positionLat, positionLng, status]);

  if (status === "missing-key" || status === "missing-map-id" || status === "error") {
    return (
      <div className={`rounded-xl border p-3 ${isDark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50"} ${className}`}>
        <div className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          <span className="inline-flex items-center gap-2">
            <MapPin size={15} />
            {status === "missing-key" ? "Google Maps is not configured. Add the CRM browser API key." : null}
            {status === "missing-map-id" ? "Google Maps needs a Map ID to display location pins." : null}
            {status === "error" ? "Google Maps could not load. Check its key and allowed domains." : null}
            {position ? ` (${position.lat.toFixed(6)}, ${position.lng.toFixed(6)})` : null}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`}>
      <div ref={containerRef} className={`w-full ${heightClass}`} aria-label="Google Maps location picker" />
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/85 text-xs font-semibold text-slate-600">
          <Loader2 size={16} className="animate-spin" /> Loading Google Maps...
        </div>
      ) : null}
      {!readOnly && status === "ready" ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow">
          Click the map or drag the pin
        </div>
      ) : null}
    </div>
  );
};

export default GoogleMapPicker;
