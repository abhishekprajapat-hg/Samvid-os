/*
 * When a Field Executive's position is worth sending.
 *
 * A straight port of the throttle in frontend/src/App.jsx: send the first fix,
 * then again once 30 seconds have passed or the person has moved 30 metres,
 * whichever comes first - and never while a send is still in flight. Kept free
 * of React and expo-location so the rule can be tested without a device; see
 * test/liveLocationRules.test.cjs.
 */

export const LOCATION_SYNC_MIN_INTERVAL_MS = 30000;
export const LOCATION_SYNC_MIN_DISTANCE_METERS = 30;

export type LocationSyncState = {
  inFlight: boolean;
  lastSentAt: number;
  lastLat: number | null;
  lastLng: number | null;
};

export const initialLocationSyncState = (): LocationSyncState => ({
  inFlight: false,
  lastSentAt: 0,
  lastLat: null,
  lastLng: null,
});

const toRadians = (value: number) => (value * Math.PI) / 180;

/** Great-circle distance, as web computes it. */
export const calculateDistanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const shouldSendLocation = (
  state: LocationSyncState,
  latitude: number,
  longitude: number,
  now: number,
) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (state.inFlight) return false;

  const hasPrevious = Number.isFinite(state.lastLat) && Number.isFinite(state.lastLng);
  if (!hasPrevious) return true;

  const moved = calculateDistanceMeters(
    Number(state.lastLat),
    Number(state.lastLng),
    latitude,
    longitude,
  );
  return (
    now - Number(state.lastSentAt || 0) >= LOCATION_SYNC_MIN_INTERVAL_MS
    || moved >= LOCATION_SYNC_MIN_DISTANCE_METERS
  );
};
