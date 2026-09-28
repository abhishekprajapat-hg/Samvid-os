import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { updateMyLiveLocation } from "./userService";
import {
  initialLocationSyncState,
  shouldSendLocation,
} from "../utils/liveLocationRules";

/*
 * Streams a Field Executive's position to the server while the app is open.
 *
 * Web has done this since Field Ops was built - App.jsx watches the browser's
 * geolocation for FIELD_EXECUTIVE and PATCHes /users/location - and Field Ops'
 * map draws every executive from that. The phone is the device a field
 * executive actually carries, and it never sent anything, so on a phone-only
 * day the map showed them wherever their laptop had last been.
 *
 * Foreground only, like web: a closed browser tab stops sending too. Tracking
 * with the app closed would need "Always" location and a background task, which
 * is a different privacy promise than the one the purpose string makes.
 *
 * Silent by design. A refusal or a failed send changes nothing on screen; the
 * app stays usable without location, exactly as web's catch-and-ignore does.
 */
export const useLiveLocationSync = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return undefined;

    let alive = true;
    let subscription: Location.LocationSubscription | null = null;
    const state = initialLocationSyncState();

    const send = async (coords: Location.LocationObjectCoords) => {
      if (!alive) return;
      const latitude = Number(coords.latitude);
      const longitude = Number(coords.longitude);
      const now = Date.now();
      if (!shouldSendLocation(state, latitude, longitude, now)) return;

      state.inFlight = true;
      try {
        await updateMyLiveLocation({
          lat: latitude,
          lng: longitude,
          accuracy: Number.isFinite(coords.accuracy) ? Number(coords.accuracy) : null,
          heading: Number.isFinite(coords.heading) ? Number(coords.heading) : null,
          speed: Number.isFinite(coords.speed) ? Number(coords.speed) : null,
        });
        state.lastLat = latitude;
        state.lastLng = longitude;
        state.lastSentAt = now;
      } catch {
        // Keep background sync silent, as web does.
      } finally {
        state.inFlight = false;
      }
    };

    const start = async () => {
      if (subscription) return;
      const enabledOnDevice = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!enabledOnDevice || !alive) return;

      const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({
        status: Location.PermissionStatus.DENIED,
      }));
      if (status !== Location.PermissionStatus.GRANTED || !alive) return;

      try {
        const next = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            // Ask the OS for no more than the throttle will use anyway.
            timeInterval: 15000,
            distanceInterval: 10,
          },
          (position) => {
            void send(position.coords);
          },
        );
        if (!alive) {
          next.remove();
          return;
        }
        subscription = next;
      } catch {
        // No fix available; try again next time the app comes to the front.
      }
    };

    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") void start();
      else stop();
    };

    if (AppState.currentState === "active") void start();
    const appStateSub = AppState.addEventListener("change", onAppState);

    return () => {
      alive = false;
      appStateSub.remove();
      stop();
    };
  }, [enabled]);
};
