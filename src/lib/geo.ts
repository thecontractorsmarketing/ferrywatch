import type { LatLng, Terminal } from "../data/routes";

const EARTH_RADIUS_MI = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(a: LatLng, b: LatLng) {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function nearestTerminal(location: LatLng, terminals: Terminal[]) {
  return terminals.reduce(
    (best, terminal) => {
      const distance = distanceMiles(location, terminal);
      return distance < best.distance ? { terminal, distance } : best;
    },
    { terminal: terminals[0], distance: Number.POSITIVE_INFINITY }
  );
}
