import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "../data/routes";

type LocationStatus = "idle" | "permission-required" | "requesting" | "ready" | "denied" | "unavailable";
type LocationPreference = "enabled" | "disabled";

const LOCATION_PREF_KEY = "ferrywatch:location-enabled";
const LOCATION_PROMPTED_KEY = "ferrywatch:location-prompted";
const LOCATION_REFRESH_MS = 15000;
const LOCATION_REQUEST_THROTTLE_MS = 1000;
const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 3000
};

function readLocationPreference(): LocationPreference {
  try {
    const stored = window.localStorage.getItem(LOCATION_PREF_KEY);
    return stored === "disabled" ? "disabled" : "enabled";
  } catch {
    return "enabled";
  }
}

function readLocationPrompted() {
  try {
    return window.localStorage.getItem(LOCATION_PROMPTED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeLocationPrompted() {
  try {
    window.localStorage.setItem(LOCATION_PROMPTED_KEY, "true");
  } catch {
    // Ignore storage failures; browser permission still controls location access.
  }
}

async function readLocationPermission() {
  if (!navigator.permissions?.query) {
    return "prompt" as PermissionState;
  }

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    return permission.state;
  } catch {
    return "prompt" as PermissionState;
  }
}

function writeLocationPreference(preference: LocationPreference) {
  try {
    window.localStorage.setItem(LOCATION_PREF_KEY, preference);
  } catch {
    // Ignore storage failures; browser permission still controls location access.
  }
}

export function useGeolocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [preference, setPreference] = useState<LocationPreference>(readLocationPreference);
  const lastRequestAt = useRef(0);
  const requestInFlight = useRef(false);
  const locationPrompted = useRef(readLocationPrompted());

  const locationEnabled = preference === "enabled";

  const savePreference = useCallback((nextPreference: LocationPreference) => {
    setPreference(nextPreference);
    writeLocationPreference(nextPreference);
  }, []);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    requestInFlight.current = false;
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude
    });
    setStatus("ready");
  }, []);

  const handleError = useCallback(
    (error: GeolocationPositionError) => {
      requestInFlight.current = false;
      if (error.code === error.PERMISSION_DENIED) {
        setLocation(null);
        setStatus("denied");
        savePreference("disabled");
        return;
      }

      setStatus((current) => (current === "ready" ? current : "unavailable"));
    },
    [savePreference]
  );

  const refreshLocation = useCallback(
    async (allowPermissionPrompt = false) => {
      if (!navigator.geolocation) {
        setStatus("unavailable");
        return;
      }

      if (requestInFlight.current) {
        return;
      }

      const permission = await readLocationPermission();
      if (requestInFlight.current) {
        return;
      }

      if (permission === "denied") {
        setLocation(null);
        setStatus("denied");
        savePreference("disabled");
        return;
      }

      if (permission !== "granted") {
        if (!allowPermissionPrompt && locationPrompted.current) {
          setStatus("permission-required");
          return;
        }

        locationPrompted.current = true;
        writeLocationPrompted();
      }

      const now = Date.now();
      if (!allowPermissionPrompt && now - lastRequestAt.current < LOCATION_REQUEST_THROTTLE_MS) {
        return;
      }

      lastRequestAt.current = now;
      requestInFlight.current = true;
      setStatus((current) => (current === "ready" ? current : "requesting"));
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, LOCATION_OPTIONS);
    },
    [handleError, handlePosition, savePreference]
  );

  const setLocationEnabled = useCallback(
    (enabled: boolean) => {
      if (!navigator.geolocation) {
        setStatus("unavailable");
        return;
      }

      if (!enabled) {
        savePreference("disabled");
        setLocation(null);
        setStatus("idle");
        return;
      }

      savePreference("enabled");
      refreshLocation(true);
    },
    [refreshLocation, savePreference]
  );

  const requestLocation = useCallback(() => {
    setLocationEnabled(true);
  }, [setLocationEnabled]);

  useEffect(() => {
    if (!locationEnabled) {
      return;
    }

    refreshLocation();

    const intervalId = window.setInterval(() => refreshLocation(), LOCATION_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshLocation();
      }
    };
    const handleFocus = () => refreshLocation();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [locationEnabled, refreshLocation]);

  return { location, status, locationEnabled, requestLocation, setLocationEnabled };
}
