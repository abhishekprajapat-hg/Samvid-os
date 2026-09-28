import { Platform } from "react-native";

/*
 * Address search, as web does it.
 *
 * Web's property form looks addresses up in OpenStreetMap (Nominatim) unless
 * VITE_LOCATION_PROVIDER is "google" and a Maps key is set; its lead form's
 * locality box uses Google Places only, and is plain typing without a key.
 * The phone reads the same switches under EXPO_PUBLIC_ names:
 *
 *   EXPO_PUBLIC_LOCATION_PROVIDER      "osm" (default) or "google"
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY    enables Google
 *   EXPO_PUBLIC_GOOGLE_MAPS_PLACES_COUNTRY  default "in"
 *
 * Suggestions are an aid, never a gate: every failure resolves to an empty
 * list or null, so a field keeps working as a text box when the network or a
 * key does not. Coordinates come only from a picked or looked-up place - a
 * typed name has none, and inventing one would put a wrong pin on a map.
 */

export type PlaceSuggestion = {
  id: string;
  label: string;
  lat?: number;
  lng?: number;
  placeId?: string;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const SUGGESTION_LIMIT = 6;

/* Read by literal name: Expo inlines EXPO_PUBLIC_ variables only when the
   member access is written out, never through a computed key. */
const googleKey = () => String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
const country = () => (String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_PLACES_COUNTRY || "").trim() || "in").toLowerCase();
const provider = () => String(process.env.EXPO_PUBLIC_LOCATION_PROVIDER || "osm").trim().toLowerCase();

/* Google needs both the provider switch and a key, as on web. */
export const usesGooglePlaces = () => provider() === "google" && Boolean(googleKey());
/* The lead locality box only needs the key - web's PlaceAutocompleteInput. */
export const hasGooglePlacesKey = () => Boolean(googleKey());

const toCoordinate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/*
 * Nominatim's usage policy asks each application to identify itself. A browser
 * sends a Referer; an app sends this. (Browsers refuse to set User-Agent, which
 * is why the web build leaves it out.)
 */
const nominatimHeaders = (): Record<string, string> => ({
  Accept: "application/json",
  ...(Platform.OS === "web" ? {} : { "User-Agent": "OfficeOnRent-Mobile/1.0 (property CRM)" }),
});

const nominatim = async (query: string, limit: number, details: boolean) => {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: String(limit),
    addressdetails: details ? "1" : "0",
    countrycodes: "in",
  });
  const response = await fetch(`${NOMINATIM}?${params.toString()}`, { headers: nominatimHeaders() });
  if (!response.ok) throw new Error("Location lookup failed");
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
};

/** Web's lookupCoordinatesByLocation: the first OpenStreetMap match, or null. */
export const geocodeAddress = async (rawQuery: string): Promise<{ query: string; lat: number; lng: number } | null> => {
  const query = String(rawQuery || "").trim();
  if (!query) return null;
  const rows = await nominatim(query, 1, false);
  const lat = toCoordinate(rows[0]?.lat);
  const lng = toCoordinate(rows[0]?.lon);
  if (lat === null || lng === null) return null;
  return { query, lat, lng };
};

const osmSuggestions = async (query: string): Promise<PlaceSuggestion[]> => {
  const rows = await nominatim(query, SUGGESTION_LIMIT, true);
  const seen = new Set<string>();
  return rows
    .map((row: any) => {
      const label = String(row?.display_name || row?.name || "").trim();
      const lat = toCoordinate(row?.lat);
      const lng = toCoordinate(row?.lon);
      if (!label || lat === null || lng === null) return null;
      const key = `${label}:${lat}:${lng}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { id: String(row?.place_id || key), label, lat, lng };
    })
    .filter(Boolean) as PlaceSuggestion[];
};

const googleSuggestions = async (query: string): Promise<PlaceSuggestion[]> => {
  const params = new URLSearchParams({ input: query, types: "geocode", key: googleKey() });
  if (country()) params.set("components", `country:${country()}`);
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
  if (!response.ok) throw new Error("Google location suggestions lookup failed");
  const data = await response.json();
  if (data?.status === "ZERO_RESULTS") return [];
  if (data?.status !== "OK" || !Array.isArray(data?.predictions)) throw new Error("Google location suggestions lookup failed");
  return data.predictions
    .map((row: any) => {
      const label = String(row?.description || "").trim();
      const placeId = String(row?.place_id || "").trim();
      return label && placeId ? { id: placeId, label, placeId } : null;
    })
    .filter(Boolean) as PlaceSuggestion[];
};

/**
 * Suggestions for a typed query. `google-only` is the lead locality box, which
 * web leaves as plain text without a key; `auto` is the property address box.
 */
export const searchPlaces = async (
  rawQuery: string,
  mode: "auto" | "google-only" = "auto",
): Promise<PlaceSuggestion[]> => {
  const query = String(rawQuery || "").trim();
  if (query.length < 3) return [];
  try {
    if (mode === "google-only") return hasGooglePlacesKey() ? await googleSuggestions(query) : [];
    if (usesGooglePlaces()) {
      try {
        return await googleSuggestions(query);
      } catch {
        return await osmSuggestions(query);
      }
    }
    return await osmSuggestions(query);
  } catch {
    return [];
  }
};

/**
 * Coordinates for a picked suggestion. A Google pick is resolved through Place
 * Details; if that fails, OpenStreetMap is asked for the label, as on web.
 */
export const resolvePlace = async (suggestion: PlaceSuggestion): Promise<PlaceSuggestion | null> => {
  if (!suggestion) return null;
  if (suggestion.lat !== undefined && suggestion.lng !== undefined) return suggestion;
  if (suggestion.placeId && googleKey()) {
    try {
      const params = new URLSearchParams({
        place_id: suggestion.placeId,
        fields: "geometry,formatted_address",
        key: googleKey(),
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
      const data = await response.json();
      const lat = toCoordinate(data?.result?.geometry?.location?.lat);
      const lng = toCoordinate(data?.result?.geometry?.location?.lng);
      if (data?.status === "OK" && lat !== null && lng !== null) {
        return { ...suggestion, label: String(data.result.formatted_address || suggestion.label).trim(), lat, lng };
      }
    } catch {
      /* fall through to OpenStreetMap */
    }
  }
  try {
    const fallback = await geocodeAddress(suggestion.label);
    return fallback ? { ...suggestion, lat: fallback.lat, lng: fallback.lng } : null;
  } catch {
    return null;
  }
};
