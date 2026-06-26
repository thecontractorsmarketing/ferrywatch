import { useEffect, useMemo, useRef, useState } from "react";
import type { FerryRoute, LatLng, Terminal } from "../data/routes";
import type { VesselLocation } from "../types/wsdot";

type FerryMapProps = {
  route: FerryRoute;
  terminals: Record<number, Terminal>;
  vessels: VesselLocation[];
  activeVesselId?: number | null;
  userLocation: LatLng | null;
  departingTerminalId: number;
  arrivingTerminalId: number;
  onTerminalTravelTimeChange?: (travelTimes: TerminalTravelTimes | null) => void;
};

type GoogleMapsNamespace = typeof google.maps;
type GoogleMapLibrary = google.maps.MapsLibrary;
type GoogleMapsLoaderResult = {
  maps: GoogleMapsNamespace;
  mapLibrary: GoogleMapLibrary;
  apiKey: string;
};
type RouteApiResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
};
type TerminalRoute = {
  durationText: string | null;
  durationMinutes: number | null;
  path: google.maps.LatLngLiteral[];
};
export type TerminalTravelTimes = {
  driveText: string | null;
  driveMinutes: number | null;
  walkText: string | null;
  walkMinutes: number | null;
};
type CachedTerminalRoute = {
  driveRoute: TerminalRoute | null;
  walkRoute: TerminalRoute | null;
};

type RouteTravelMode = "DRIVE" | "WALK";

let mapsPromise: Promise<GoogleMapsLoaderResult> | null = null;
let mapsApiKeyPromise: Promise<string> | null = null;

function svgUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function vesselColor(vessel: VesselLocation, departingTerminalId: number, arrivingTerminalId: number) {
  if (vessel.DepartingTerminalID === departingTerminalId) {
    return "#0f766e";
  }

  if (vessel.DepartingTerminalID === arrivingTerminalId) {
    return "#e35d2f";
  }

  return "#0f3d37";
}

function vesselHeading(vessel: VesselLocation) {
  return Number.isFinite(vessel.Heading) ? Math.round(vessel.Heading || 0) : 0;
}

function vesselIconKey(vessel: VesselLocation, departingTerminalId: number, arrivingTerminalId: number) {
  return `${vesselHeading(vessel)}:${vesselColor(vessel, departingTerminalId, arrivingTerminalId)}`;
}

function vesselIcon(maps: GoogleMapsNamespace, vessel: VesselLocation, departingTerminalId: number, arrivingTerminalId: number) {
  const heading = vesselHeading(vessel);
  const fill = vesselColor(vessel, departingTerminalId, arrivingTerminalId);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <g transform="rotate(${heading} 11 11)" filter="drop-shadow(0 2px 4px rgba(6,25,22,.28))">
        <path d="M11 2 L19 20 L11 15 L3 20 Z" fill="${fill}"/>
      </g>
    </svg>
  `;

  return {
    url: svgUrl(svg),
    scaledSize: new maps.Size(22, 22),
    anchor: new maps.Point(11, 11)
  };
}

function userIcon(maps: GoogleMapsNamespace) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="10" fill="#2563eb" stroke="#fffef9" stroke-width="4"/>
    </svg>
  `;

  return {
    url: svgUrl(svg),
    scaledSize: new maps.Size(26, 26),
    anchor: new maps.Point(13, 13)
  };
}

async function loadMapLibrary(maps: GoogleMapsNamespace) {
  if (typeof maps.importLibrary === "function") {
    return (await maps.importLibrary("maps")) as GoogleMapLibrary;
  }

  return {
    Map: maps.Map
  } as GoogleMapLibrary;
}

async function loadGoogleMapsApiKey() {
  if (!mapsApiKeyPromise) {
    mapsApiKeyPromise = fetch("/api/maps/config").then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as { apiKey?: string; message?: string; error?: string };
      if (!response.ok || !body.apiKey) {
        throw new Error(body.message || body.error || "Google Maps is not configured.");
      }
      return body.apiKey;
    });
  }

  return mapsApiKeyPromise;
}

async function loadGoogleMaps() {
  const apiKey = await loadGoogleMapsApiKey();

  if (window.google?.maps) {
    return {
      maps: window.google.maps,
      mapLibrary: await loadMapLibrary(window.google.maps),
      apiKey
    };
  }

  if (!mapsPromise) {
    mapsPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps-loader]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsLoader = "true";
      script.addEventListener("load", () => resolve(window.google.maps), { once: true });
      script.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      document.head.appendChild(script);
    }).then(async (maps) => ({
        maps,
        mapLibrary: await loadMapLibrary(maps),
        apiKey
      }));
  }

  return mapsPromise;
}

function clearMarkerMap(markers: Map<number, google.maps.Marker>) {
  for (const marker of markers.values()) {
    marker.setMap(null);
  }
  markers.clear();
}

function removeOverlay(overlay: google.maps.Marker | google.maps.Polyline | google.maps.TrafficLayer | null) {
  overlay?.setMap(null);
}

function decodePolyline(encoded: string) {
  const path: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return path;
}

function getRouteDurationMinutes(duration?: string) {
  const seconds = Number(duration?.replace(/s$/, ""));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.max(1, Math.round(seconds / 60));
}

function formatRouteDuration(duration?: string) {
  const minutes = getRouteDurationMinutes(duration);
  if (!minutes) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

async function fetchTerminalRoute(
  apiKey: string,
  origin: LatLng,
  destination: LatLng,
  travelMode: RouteTravelMode,
  signal: AbortSignal
): Promise<TerminalRoute | null> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng
          }
        }
      },
      travelMode,
      ...(travelMode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      units: "IMPERIAL"
    })
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => ({}))) as RouteApiResponse;
  const route = body.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline;

  return {
    durationText: formatRouteDuration(route?.duration),
    durationMinutes: getRouteDurationMinutes(route?.duration),
    path: encodedPolyline ? decodePolyline(encodedPolyline) : []
  };
}

export function FerryMap({
  route,
  terminals,
  vessels,
  activeVesselId,
  userLocation,
  departingTerminalId,
  arrivingTerminalId,
  onTerminalTravelTimeChange
}: FerryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const apiKeyRef = useRef("");
  const vesselMarkersRef = useRef(new Map<number, google.maps.Marker>());
  const vesselIconKeysRef = useRef(new Map<number, string>());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const viewportKeyRef = useRef("");
  const terminalRouteCache = useRef(new Map<string, CachedTerminalRoute>());
  const routeRequestId = useRef(0);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  const routeTerminals = useMemo(
    () => route.terminalIds.map((id) => terminals[id]).filter(Boolean),
    [route.terminalIds, terminals]
  );

  useEffect(() => {
    let cancelled = false;

    if (!containerRef.current || mapRef.current) {
      return;
    }

    loadGoogleMaps()
      .then(({ maps, mapLibrary, apiKey }) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        mapsRef.current = maps;
        apiKeyRef.current = apiKey;
        mapRef.current = new mapLibrary.Map(containerRef.current, {
          center: { lat: 47.6062, lng: -122.3321 },
          zoom: 10,
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          keyboardShortcuts: false,
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }]
            },
            {
              featureType: "transit",
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }]
            }
          ]
        });
        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "Google Maps is not configured.");
        }
      });

    return () => {
      cancelled = true;
      clearMarkerMap(vesselMarkersRef.current);
      vesselIconKeysRef.current.clear();
      removeOverlay(userMarkerRef.current);
      removeOverlay(routeLineRef.current);
      removeOverlay(trafficLayerRef.current);
      userMarkerRef.current = null;
      routeLineRef.current = null;
      trafficLayerRef.current = null;
      viewportKeyRef.current = "";
      apiKeyRef.current = "";
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const maps = mapsRef.current;
    const apiKey = apiKeyRef.current;
    const map = mapRef.current;

    if (!maps || !map || !mapReady) {
      return;
    }

    routeRequestId.current += 1;
    const requestId = routeRequestId.current;
    const abortController = new AbortController();

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new maps.TrafficLayer();
      trafficLayerRef.current.setMap(map);
    }

    const bounds = new maps.LatLngBounds();
    const departingTerminal = terminals[departingTerminalId];
    const visibleVesselIds = new Set<number>();
    const viewportKey = `${departingTerminalId}:${arrivingTerminalId}:${userLocation ? "with-user" : "no-user"}`;
    const shouldFitViewport = viewportKeyRef.current !== viewportKey;

    for (const terminal of routeTerminals) {
      const position = { lat: terminal.lat, lng: terminal.lng };
      bounds.extend(position);
    }

    for (const vessel of vessels) {
      if (!Number.isFinite(vessel.Latitude) || !Number.isFinite(vessel.Longitude)) {
        continue;
      }

      const position = { lat: vessel.Latitude, lng: vessel.Longitude };
      const zIndex = vessel.VesselID === activeVesselId ? 50 : 40;
      const iconKey = vesselIconKey(vessel, departingTerminalId, arrivingTerminalId);
      bounds.extend(position);
      visibleVesselIds.add(vessel.VesselID);

      const marker = vesselMarkersRef.current.get(vessel.VesselID);
      if (marker) {
        marker.setPosition(position);
        marker.setTitle(vessel.VesselName);
        if (vesselIconKeysRef.current.get(vessel.VesselID) !== iconKey) {
          marker.setIcon(vesselIcon(maps, vessel, departingTerminalId, arrivingTerminalId));
          vesselIconKeysRef.current.set(vessel.VesselID, iconKey);
        }
        marker.setZIndex(zIndex);
        if (!marker.getMap()) {
          marker.setMap(map);
        }
      } else {
        vesselMarkersRef.current.set(
          vessel.VesselID,
          new maps.Marker({
            map,
            position,
            title: vessel.VesselName,
            icon: vesselIcon(maps, vessel, departingTerminalId, arrivingTerminalId),
            zIndex
          })
        );
        vesselIconKeysRef.current.set(vessel.VesselID, iconKey);
      }
    }

    for (const [vesselId, marker] of vesselMarkersRef.current) {
      if (!visibleVesselIds.has(vesselId)) {
        marker.setMap(null);
        vesselMarkersRef.current.delete(vesselId);
        vesselIconKeysRef.current.delete(vesselId);
      }
    }

    if (userLocation) {
      const position = { lat: userLocation.lat, lng: userLocation.lng };
      bounds.extend(position);

      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition(position);
        if (!userMarkerRef.current.getMap()) {
          userMarkerRef.current.setMap(map);
        }
      } else {
        userMarkerRef.current = new maps.Marker({
          map,
          position,
          title: "You",
          icon: userIcon(maps),
          zIndex: 60
        });
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    if (shouldFitViewport && !bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 28, right: 28, bottom: 28, left: 28 });
      viewportKeyRef.current = viewportKey;
      maps.event.addListenerOnce(map, "idle", () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 12) {
          map.setZoom(12);
        }
      });
    }

    if (!userLocation || !departingTerminal || !apiKey) {
      removeOverlay(routeLineRef.current);
      routeLineRef.current = null;
      onTerminalTravelTimeChange?.(null);
      return () => abortController.abort();
    }

    const cacheKey = [
      userLocation.lat.toFixed(4),
      userLocation.lng.toFixed(4),
      departingTerminal.id,
      departingTerminal.lat.toFixed(4),
      departingTerminal.lng.toFixed(4)
    ].join(":");

    const applyTerminalRoutes = ({ driveRoute, walkRoute }: CachedTerminalRoute) => {
      if (requestId !== routeRequestId.current || abortController.signal.aborted) {
        return;
      }

      const terminalRoute = driveRoute || walkRoute;

      if (!terminalRoute) {
        onTerminalTravelTimeChange?.(null);
        return;
      }

      onTerminalTravelTimeChange?.({
        driveText: driveRoute?.durationText || null,
        driveMinutes: driveRoute?.durationMinutes || null,
        walkText: walkRoute?.durationText || null,
        walkMinutes: walkRoute?.durationMinutes || null
      });

      if (terminalRoute.path.length < 2) {
        removeOverlay(routeLineRef.current);
        routeLineRef.current = null;
        return;
      }

      if (routeLineRef.current) {
        routeLineRef.current.setPath(terminalRoute.path);
      } else {
        routeLineRef.current = new maps.Polyline({
          map,
          path: terminalRoute.path,
          strokeColor: "#2563eb",
          strokeOpacity: 0.48,
          strokeWeight: 3
        });
      }

    };

    const cachedRoute = terminalRouteCache.current.get(cacheKey);
    if (cachedRoute) {
      applyTerminalRoutes(cachedRoute);
      return () => abortController.abort();
    }

    Promise.all([
      fetchTerminalRoute(apiKey, userLocation, departingTerminal, "DRIVE", abortController.signal),
      fetchTerminalRoute(apiKey, userLocation, departingTerminal, "WALK", abortController.signal)
    ])
      .then(([driveRoute, walkRoute]) => {
        const terminalRoutes = { driveRoute, walkRoute };
        if (driveRoute || walkRoute) {
          terminalRouteCache.current.set(cacheKey, terminalRoutes);
        }
        applyTerminalRoutes(terminalRoutes);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        console.warn("Google Routes API request failed", error);
      });

    return () => abortController.abort();
  }, [
    activeVesselId,
    arrivingTerminalId,
    departingTerminalId,
    onTerminalTravelTimeChange,
    mapReady,
    routeTerminals,
    terminals,
    userLocation,
    vessels
  ]);

  return (
    <div className="route-map" aria-label="Ferry map">
      <div ref={containerRef} className="google-map-canvas" />
      {mapError ? <div className="map-error">{mapError}</div> : null}
    </div>
  );
}
