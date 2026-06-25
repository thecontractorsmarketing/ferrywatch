import { DEMO_SCHEDULE, DEMO_VESSELS } from "../data/demo";
import { TERMINALS, type FerryRoute, type Terminal } from "../data/routes";
import { distanceMiles } from "./geo";
import { parseWsdotDate } from "./time";
import type {
  ScheduleResponse,
  ScheduleTime,
  TerminalLocationResponse,
  TerminalSailingSpaceResponse,
  VesselLocation
} from "../types/wsdot";

export type DataMode = "live" | "demo";

export type FerryData = {
  mode: DataMode;
  vessels: VesselLocation[];
  routeVessels: VesselLocation[];
  activeVessel: VesselLocation | null;
  schedule: ScheduleResponse;
  terminalSailingSpace: TerminalSailingSpaceResponse | null;
  nextSailing: ScheduleTime | null;
  incomingPlan: TravelPlan;
  incomingSchedule: ScheduleResponse;
  incomingSailing: ScheduleTime | null;
  terminals: Record<number, Terminal>;
  updatedAt: Date;
  error?: string;
};

export type TravelPlan = {
  departingTerminalId: number;
  arrivingTerminalId: number;
};

async function fetchJson<T>(path: string, signal?: AbortSignal) {
  const response = await fetch(`/api/wsdot/${path}`, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    },
    signal
  });

  if (!response.ok) {
    let message = `WSDOT request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.message || body.error || message;
    } catch {
      // Keep the HTTP status message when the body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function fetchOptionalJson<T>(path: string, signal?: AbortSignal) {
  try {
    return await fetchJson<T>(path, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

function normalizeRouteAbbrev(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function vesselMatchesRoute(route: FerryRoute, vessel: VesselLocation) {
  const arrivingId = vessel.ArrivingTerminalID ?? 0;
  const exactPair =
    route.terminalIds.includes(vessel.DepartingTerminalID) && route.terminalIds.includes(arrivingId);

  if (exactPair) {
    return true;
  }

  const vesselAbbrevs = (vessel.OpRouteAbbrev || []).map(normalizeRouteAbbrev);
  return route.abbrevs.some((abbrev) => vesselAbbrevs.includes(normalizeRouteAbbrev(abbrev)));
}

function vesselMatchesDirection(vessel: VesselLocation, plan: TravelPlan) {
  return (
    vessel.DepartingTerminalID === plan.departingTerminalId &&
    vessel.ArrivingTerminalID === plan.arrivingTerminalId
  );
}

function vesselMatchesPlanTerminals(vessel: VesselLocation, plan: TravelPlan) {
  const arrivingId = vessel.ArrivingTerminalID ?? 0;
  const planTerminalIds = [plan.departingTerminalId, plan.arrivingTerminalId];
  return planTerminalIds.includes(vessel.DepartingTerminalID) && (!arrivingId || planTerminalIds.includes(arrivingId));
}

function isUsefulVessel(vessel: VesselLocation) {
  return (
    vessel.InService &&
    Number.isFinite(vessel.Latitude) &&
    Number.isFinite(vessel.Longitude) &&
    Math.abs(vessel.Latitude) <= 90 &&
    Math.abs(vessel.Longitude) <= 180
  );
}

function mergeTerminalLocations(apiTerminals: TerminalLocationResponse[]) {
  const terminals = { ...TERMINALS };

  for (const terminal of apiTerminals) {
    if (!terminal.Latitude || !terminal.Longitude) {
      continue;
    }

    terminals[terminal.TerminalID] = {
      ...(terminals[terminal.TerminalID] || {
        id: terminal.TerminalID,
        shortName: terminal.TerminalName,
        name: terminal.TerminalName,
        abbrev: terminal.TerminalAbbrev
      }),
      id: terminal.TerminalID,
      name: terminal.TerminalName,
      shortName: terminals[terminal.TerminalID]?.shortName || terminal.TerminalName,
      abbrev: terminal.TerminalAbbrev,
      lat: terminal.Latitude,
      lng: terminal.Longitude
    };
  }

  return terminals;
}

function getScheduleTimes(schedule: ScheduleResponse) {
  return schedule.TerminalCombos?.flatMap((combo) => combo.Times || []) || [];
}

function chooseNextSailing(schedule: ScheduleResponse) {
  const now = Date.now();
  return (
    getScheduleTimes(schedule)
      .filter((time) => {
        const departing = parseWsdotDate(time.DepartingTime);
        return departing ? departing.getTime() > now - 2 * 60000 : false;
      })
      .sort((a, b) => {
        const aTime = parseWsdotDate(a.DepartingTime)?.getTime() || Number.POSITIVE_INFINITY;
        const bTime = parseWsdotDate(b.DepartingTime)?.getTime() || Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })[0] || null
  );
}

function reverseTravelPlan(plan: TravelPlan): TravelPlan {
  return {
    departingTerminalId: plan.arrivingTerminalId,
    arrivingTerminalId: plan.departingTerminalId
  };
}

function vesselHasArrivalSignal(vessel: VesselLocation) {
  return (
    Boolean(parseWsdotDate(vessel.Eta) || parseWsdotDate(vessel.LeftDock)) ||
    (vessel.Speed || 0) > 0.5 ||
    vessel.AtDock === false
  );
}

function getVesselTiming(vessel: VesselLocation) {
  return (
    parseWsdotDate(vessel.Eta)?.getTime() ||
    parseWsdotDate(vessel.ScheduledDeparture)?.getTime() ||
    parseWsdotDate(vessel.TimeStamp)?.getTime() ||
    Number.POSITIVE_INFINITY
  );
}

function sortVesselsByTiming(vessels: VesselLocation[]) {
  return [...vessels].sort((a, b) => getVesselTiming(a) - getVesselTiming(b));
}

function chooseActiveVessel(
  routeVessels: VesselLocation[],
  plan: TravelPlan,
  nextSailing: ScheduleTime | null
) {
  const directionalVessels = routeVessels.filter((vessel) => vesselMatchesDirection(vessel, plan));
  const activeDirectionalVessel = sortVesselsByTiming(directionalVessels.filter(vesselHasArrivalSignal))[0];
  if (activeDirectionalVessel) {
    return activeDirectionalVessel;
  }

  if (nextSailing?.VesselID) {
    const scheduledVessel = directionalVessels.find((vessel) => vessel.VesselID === nextSailing.VesselID);
    if (scheduledVessel) {
      return scheduledVessel;
    }

    const scheduledRouteVessel = routeVessels.find(
      (vessel) => vessel.VesselID === nextSailing.VesselID && vesselMatchesPlanTerminals(vessel, plan)
    );
    if (scheduledRouteVessel) {
      return scheduledRouteVessel;
    }
  }

  if (!directionalVessels.length) {
    return null;
  }

  return sortVesselsByTiming(directionalVessels)[0] || null;
}

function adaptDemoSchedule(plan: TravelPlan): ScheduleResponse {
  return {
    ...DEMO_SCHEDULE,
    TerminalCombos: (DEMO_SCHEDULE.TerminalCombos || []).map((combo) => ({
      ...combo,
      DepartingTerminalID: plan.departingTerminalId,
      DepartingTerminalName: TERMINALS[plan.departingTerminalId]?.name || combo.DepartingTerminalName,
      ArrivingTerminalID: plan.arrivingTerminalId,
      ArrivingTerminalName: TERMINALS[plan.arrivingTerminalId]?.name || combo.ArrivingTerminalName
    }))
  };
}

function adaptDemoVessels(route: FerryRoute, plan: TravelPlan) {
  const from = TERMINALS[plan.departingTerminalId];
  const to = TERMINALS[plan.arrivingTerminalId];

  if (!from || !to) {
    return DEMO_VESSELS;
  }

  return DEMO_VESSELS.map((vessel, index) => {
    const progress = index === 0 ? 0.55 : 0.3;
    const departing = index === 0 ? from : to;
    const arriving = index === 0 ? to : from;
    return {
      ...vessel,
      DepartingTerminalID: departing.id,
      DepartingTerminalName: departing.name,
      DepartingTerminalAbbrev: departing.abbrev,
      ArrivingTerminalID: arriving.id,
      ArrivingTerminalName: arriving.name,
      ArrivingTerminalAbbrev: arriving.abbrev,
      Latitude: departing.lat + (arriving.lat - departing.lat) * progress,
      Longitude: departing.lng + (arriving.lng - departing.lng) * progress,
      OpRouteAbbrev: [route.id]
    };
  });
}

export function chooseTravelPlan(
  route: FerryRoute,
  terminals: Record<number, Terminal>,
  userLocation: { lat: number; lng: number } | null,
  autoDirection: boolean,
  manualDepartureTerminalId?: number
): TravelPlan {
  const routeTerminals = route.terminalIds.map((id) => terminals[id]).filter(Boolean);
  const fallbackDeparture = manualDepartureTerminalId || route.defaultDepartureTerminalId;

  const departingTerminalId =
    autoDirection && userLocation && routeTerminals.length
      ? routeTerminals
          .map((terminal) => ({
            id: terminal.id,
            distance: distanceMiles(userLocation, terminal)
          }))
          .sort((a, b) => a.distance - b.distance)[0].id
      : fallbackDeparture;

  return {
    departingTerminalId,
    arrivingTerminalId:
      route.mates[departingTerminalId] ||
      route.terminalIds.find((terminalId) => terminalId !== departingTerminalId) ||
      route.defaultDepartureTerminalId
  };
}

export async function loadFerryData(route: FerryRoute, plan: TravelPlan, signal?: AbortSignal): Promise<FerryData> {
  const incomingPlan = reverseTravelPlan(plan);

  try {
    const [vessels, terminalLocations, schedule, incomingSchedule, terminalSailingSpace] = await Promise.all([
      fetchJson<VesselLocation[]>("vessels/vessellocations", signal),
      fetchJson<TerminalLocationResponse[]>("terminals/terminallocations", signal),
      fetchJson<ScheduleResponse>(
        `schedule/scheduletoday/${plan.departingTerminalId}/${plan.arrivingTerminalId}/false`,
        signal
      ),
      fetchJson<ScheduleResponse>(
        `schedule/scheduletoday/${incomingPlan.departingTerminalId}/${incomingPlan.arrivingTerminalId}/false`,
        signal
      ),
      fetchOptionalJson<TerminalSailingSpaceResponse>(`terminals/terminalsailingspace/${plan.departingTerminalId}`, signal)
    ]);

    const terminals = mergeTerminalLocations(terminalLocations);
    const routeVessels = vessels.filter(isUsefulVessel).filter((vessel) => vesselMatchesRoute(route, vessel));
    const nextSailing = chooseNextSailing(schedule);
    const incomingSailing = chooseNextSailing(incomingSchedule);

    return {
      mode: "live",
      vessels,
      routeVessels,
      activeVessel: chooseActiveVessel(routeVessels, incomingPlan, incomingSailing),
      schedule,
      terminalSailingSpace,
      nextSailing,
      incomingPlan,
      incomingSchedule,
      incomingSailing,
      terminals,
      updatedAt: new Date()
    };
  } catch (error) {
    const rawError = error instanceof Error ? error.message : "Live WSDOT data unavailable";
    const friendlyError = rawError.includes("404")
      ? "Live WSDOT data is not connected in this local view."
      : rawError.includes("WSDOT_API_KEY")
        ? "Add the WSDOT API key in Cloudflare to enable live data."
        : "Live WSDOT data is unavailable right now.";
    const schedule = adaptDemoSchedule(plan);
    const incomingSchedule = adaptDemoSchedule(incomingPlan);
    const vessels = adaptDemoVessels(route, plan);
    const routeVessels = vessels.filter((vessel) => vesselMatchesRoute(route, vessel));
    const nextSailing = chooseNextSailing(schedule);
    const incomingSailing = chooseNextSailing(incomingSchedule);

    return {
      mode: "demo",
      vessels,
      routeVessels,
      activeVessel: chooseActiveVessel(routeVessels, incomingPlan, incomingSailing),
      schedule,
      terminalSailingSpace: null,
      nextSailing,
      incomingPlan,
      incomingSchedule,
      incomingSailing,
      terminals: TERMINALS,
      updatedAt: new Date(),
      error: friendlyError
    };
  }
}
