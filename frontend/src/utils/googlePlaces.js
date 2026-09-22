/*
 * The Google Places loader, shared.
 *
 * Inventory already loaded this script for its own location box; a second copy
 * would mean two <script> tags racing for the same global and two places for a
 * key change to be missed. One module owns the tag, and everything that needs
 * a location suggestion asks it.
 *
 * Without VITE_GOOGLE_MAPS_API_KEY set, every function here reports
 * unavailability rather than throwing: a location field that falls back to
 * plain typing is a working field, and a CRM that cannot save a lead because
 * an API key is missing is not.
 */

const SCRIPT_ID = "office-on-rent-google-maps-places-script";
let scriptPromise = null;

export const getPlacesApiKey = () => String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();

export const loadPlaces = (apiKey = getPlacesApiKey()) => {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps is unavailable"));
  if (!apiKey) return Promise.reject(new Error("Google Maps API key is not configured"));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const fail = (message) => {
      // Cleared so a later attempt can retry rather than inheriting a rejection.
      scriptPromise = null;
      reject(new Error(message));
    };

    const done = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else fail("Google Maps Places library failed to load");
    };

    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement("script");
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => fail("Google Maps script failed to load"), { once: true });

    if (!existing) {
      const params = new URLSearchParams({ key: apiKey, libraries: "places", v: "weekly" });
      script.id = SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.google?.maps) {
      done();
    }
  });

  return scriptPromise;
};

/**
 * Place suggestions for a typed query. Resolves to [] rather than rejecting on
 * no results, so a caller can treat "nothing matched" as an ordinary outcome.
 */
export const fetchPlacePredictions = (service, query, country = "in") => {
  const input = String(query || "").trim();
  const status = window.google?.maps?.places?.PlacesServiceStatus;
  if (!input || !service || !status) return Promise.resolve([]);

  return new Promise((resolve) => {
    service.getPlacePredictions(
      { input, types: ["geocode"], ...(country ? { componentRestrictions: { country } } : {}) },
      (predictions, responseStatus) => {
        if (responseStatus !== status.OK || !Array.isArray(predictions)) {
          resolve([]);
          return;
        }
        resolve(predictions
          .map((row) => ({ label: String(row?.description || "").trim(), placeId: row?.place_id || "" }))
          .filter((row) => row.label));
      },
    );
  });
};

/** Latitude and longitude for a chosen suggestion, or null if it cannot be resolved. */
export const geocodePlaceId = async (placeId) => {
  if (!placeId || !window.google?.maps) return null;
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ placeId }, (results, status) => {
      const location = status === "OK" ? results?.[0]?.geometry?.location : null;
      resolve(location ? { lat: location.lat(), lng: location.lng() } : null);
    });
  });
};
