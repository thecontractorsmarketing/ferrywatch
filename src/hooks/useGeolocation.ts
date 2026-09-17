import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "../data/routes";

type LocationStatus = "idle" | "permission-required" | "requesting" | "ready" | "denied" | "unavailable";

const LOCATION_REFRESH_MS = 15000;
const LOCATION_REQUEST_THROTTLE_MS = 1000;
const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 3000
};

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

export function useGeolocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const lastRequestAt = useRef(0);
  const requestInFlight = useRef(false);

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
        return;
      }

      setStatus((current) => (current === "ready" ? current : "unavailable"));
    },
    []
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
        return;
      }

      if (permission !== "granted") {
        if (!allowPermissionPrompt) {
          setStatus("permission-required");
          return;
        }
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
    [handleError, handlePosition]
  );

  const requestLocation = useCallback(() => {
    refreshLocation(true);
  }, [refreshLocation]);

  useEffect(() => {
    refreshLocation(true);

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
  }, [refreshLocation]);

  return { location, status, requestLocation };
}
