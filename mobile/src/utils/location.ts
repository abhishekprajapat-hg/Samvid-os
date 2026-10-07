import * as Location from "expo-location";

/*
 * Location for attendance check-in / check-out.
 *
 * The backend geofences these when policy.geofenceEnabled is on: it parses
 * { latitude, longitude, accuracy } and rejects a check-in outside
 * policy.officeRadiusMeters, using the reported accuracy as a buffer. So
 * accuracy is not decoration - a coarse fix makes the geofence *more*
 * forgiving, and a missing fix is a hard 400 when the policy is on.
 *
 * Nothing here throws. A refusal, a timeout or a device with location off all
 * resolve to a reason the caller can show, because the alternative is a
 * check-in button that crashes rather than explains itself.
 */

export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type LocationResult =
  | { ok: true; location: AttendanceLocation }
  | { ok: false; reason: "denied" | "disabled" | "unavailable"; message: string };

const DENIED_MESSAGE =
  "Location permission is off. Turn it on in Settings so attendance can confirm you are at the office.";
const DISABLED_MESSAGE =
  "Location services are switched off on this device. Turn them on to check in.";
const UNAVAILABLE_MESSAGE =
  "Could not get a location fix. Move somewhere with a clearer signal and try again.";

/** Asks once, and reports why rather than throwing. */
export const requestLocationPermission = async (): Promise<
  { ok: true } | { ok: false; reason: "denied" | "disabled"; message: string }
> => {
  const enabled = await Location.hasServicesEnabledAsync().catch(() => false);
  if (!enabled) return { ok: false, reason: "disabled", message: DISABLED_MESSAGE };

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    return { ok: false, reason: "denied", message: DENIED_MESSAGE };
  }
  return { ok: true };
};

/*
 * Balanced accuracy, not Highest.
 *
 * Highest waits on GPS, which indoors - where someone checking in almost always
 * is - can hang for tens of seconds or never resolve. Balanced returns a
 * network fix in about a second with an accuracy figure the geofence already
 * knows how to account for.
 */
export const getAttendanceLocation = async (
  timeoutMs = 10000,
): Promise<LocationResult> => {
  const permission = await requestLocationPermission();
  if (!permission.ok) return permission;

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!position) {
      // Last resort: a recent cached fix beats failing the check-in outright.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
      if (!last) return { ok: false, reason: "unavailable", message: UNAVAILABLE_MESSAGE };
      return { ok: true, location: toAttendanceLocation(last) };
    }

    return { ok: true, location: toAttendanceLocation(position) };
  } catch {
    return { ok: false, reason: "unavailable", message: UNAVAILABLE_MESSAGE };
  }
};

const toAttendanceLocation = (position: Location.LocationObject): AttendanceLocation => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: Number.isFinite(position.coords.accuracy)
    ? Math.round(Number(position.coords.accuracy))
    : null,
});

export const openLocationSettings = () => Location.enableNetworkProviderAsync().catch(() => {});
