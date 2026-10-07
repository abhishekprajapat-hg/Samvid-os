/* One Maps JavaScript loader shared by map views and Places search. */

const SCRIPT_ID = "office-on-rent-google-maps-places-script";
let scriptPromise = null;

export const getPlacesApiKey = () => String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
export const getGoogleMapsMapId = () => String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "").trim();

export const loadGoogleMaps = (apiKey = getPlacesApiKey()) => {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps is unavailable"));
  if (!apiKey) return Promise.reject(new Error("Google Maps API key is not configured"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const fail = (message) => {
      // Cleared so a later attempt can retry rather than inheriting a rejection.
      scriptPromise = null;
      reject(new Error(message));
    };

    const done = () => {
      if (window.google?.maps) resolve(window.google);
      else fail("Google Maps JavaScript API failed to load");
    };

    const existing = document.getElementById(SCRIPT_ID);
    const script = existing || document.createElement("script");
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => fail("Google Maps script failed to load"), { once: true });

    if (!existing) {
      const params = new URLSearchParams({
        key: apiKey,
        libraries: "places,marker",
        v: "weekly",
      });
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

export const loadPlaces = async (apiKey = getPlacesApiKey()) => {
  const google = await loadGoogleMaps(apiKey);
  if (!google.maps?.places && google.maps?.importLibrary) {
    await google.maps.importLibrary("places");
  }
  if (google.maps?.places) return google;
  throw new Error("Google Maps Places library failed to load");
};

/**
 * Place suggestions for a typed query. Resolves to [] rather than rejecting on
 * no results, so a caller can treat "nothing matched" as an ordinary outcome.
 */
export const createPlacesAutocompleteSession = () => {
  const places = window.google?.maps?.places;
  if (!places) return null;

  return {
    sessionToken: places.AutocompleteSessionToken
      ? new places.AutocompleteSessionToken()
      : null,
    legacyService: places.AutocompleteService
      ? new places.AutocompleteService()
      : null,
  };
};

export const fetchPlacePredictions = async (session, query, country = "in") => {
  const input = String(query || "").trim();
  const places = window.google?.maps?.places;
  if (!input || !session || !places) return [];

  if (places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    const { suggestions = [] } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      ...(country ? { includedRegionCodes: [country] } : {}),
      ...(session.sessionToken ? { sessionToken: session.sessionToken } : {}),
    });

    return suggestions
      .map((suggestion) => {
        const prediction = suggestion?.placePrediction;
        const label = String(prediction?.text?.toString?.() || "").trim();
        const placeId = String(prediction?.placeId || "").trim();
        return label && prediction
          ? { id: placeId || label, label, placeId, placePrediction: prediction }
          : null;
      })
      .filter(Boolean);
  }

  const service = session.legacyService || session;
  const status = places.PlacesServiceStatus;
  if (!service?.getPlacePredictions || !status) return [];

  return new Promise((resolve) => {
    service.getPlacePredictions(
      { input, types: ["geocode"], ...(country ? { componentRestrictions: { country } } : {}) },
      (predictions, responseStatus) => {
        if (responseStatus !== status.OK || !Array.isArray(predictions)) {
          resolve([]);
          return;
        }
        resolve(predictions
          .map((row) => ({
            id: row?.place_id || row?.description || "",
            label: String(row?.description || "").trim(),
            placeId: row?.place_id || "",
          }))
          .filter((row) => row.label));
      },
    );
  });
};

export const resolvePlaceSuggestion = async (suggestion) => {
  const prediction = suggestion?.placePrediction;
  if (prediction?.toPlace) {
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      const lat = place.location?.lat?.();
      const lng = place.location?.lng?.();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          label: String(place.formattedAddress || suggestion?.label || "").trim(),
          lat,
          lng,
        };
      }
    } catch {
      return null;
    }
  }

  const coordinates = await geocodePlaceId(suggestion?.placeId);
  return coordinates
    ? { label: String(suggestion?.label || "").trim(), ...coordinates }
    : null;
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

export const geocodeAddress = async (address, country = "in") => {
  const query = String(address || "").trim();
  if (!query) return null;
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { address: query, ...(country ? { componentRestrictions: { country } } : {}) },
      (results, status) => {
        if (status === "ZERO_RESULTS") return resolve(null);
        if (status !== "OK") return reject(new Error(`Google location lookup failed (${status})`));
        const result = results?.[0];
        const location = result?.geometry?.location;
        if (!location) return resolve(null);
        resolve({
          query: String(result.formatted_address || query),
          lat: location.lat(),
          lng: location.lng(),
        });
      },
    );
  });
};
