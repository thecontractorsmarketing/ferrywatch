import { AlertTriangle, ArrowLeftRight, Clock, Navigation, RefreshCw, Settings, Ship } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { FerryMap } from "./components/FerryMap";
import type { TerminalTravelTimes } from "./components/FerryMap";
import { SettingsSheet } from "./components/SettingsSheet";
import { ROUTES, TERMINALS, getRoute, getTerminal, type Terminal } from "./data/routes";
import { useFerryData, type FerryPrefs } from "./hooks/useFerryData";
import { useGeolocation } from "./hooks/useGeolocation";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { distanceMiles } from "./lib/geo";
import { formatTime, parseWsdotDate, relativeMinutes } from "./lib/time";
import type { ScheduleTime, TerminalSailingSpaceResponse, VesselLocation } from "./types/wsdot";

const DEFAULT_PREFS: FerryPrefs = {
  routeId: ROUTES[0].id,
  autoDirection: true,
  departureByRoute: {}
};

const PULL_REFRESH_THRESHOLD = 40;
const FERRY_REFRESH_MS = 15000;
const DEFAULT_TURNAROUND_MINUTES = 20;
const LAST_CHANCE_BUFFER_MINUTES = 5;
const MISSED_SCHEDULED_DEPARTURE_MESSAGE = "You'll probably miss the scheduled departure";
const MISSED_ESTIMATED_DEPARTURE_MESSAGE = "You'll probably miss the estimated departure";

function StatCard({
  label,
  value,
  detail,
  icon,
  valueClassName,
  detailClassName
}: {
  label: string;
  value?: string;
  detail?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
  detailClassName?: string;
}) {
  return (
    <article className={`stat-card ${icon ? "" : "stat-card-no-icon"}`}>
      {icon ? <div className="stat-icon">{icon}</div> : null}
      <div>
        <p>{label}</p>
        {value ? <strong className={valueClassName}>{value}</strong> : null}
        {detail ? <div className={`stat-detail ${detailClassName || ""}`}>{detail}</div> : null}
      </div>
    </article>
  );
}

function addMinutes(value: string | Date | null | undefined, minutes: number) {
  const date = value instanceof Date ? value : parseWsdotDate(value);
  return date ? new Date(date.getTime() + minutes * 60000) : null;
}

function toDate(value: string | Date | null | undefined) {
  return value instanceof Date ? value : parseWsdotDate(value);
}

function formatCountdownMs(value: number) {
  const totalSeconds = Math.ceil(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

function getLastChanceCountdown(
  departure: string | Date | null | undefined,
  driveMinutes: number | null | undefined,
  nowMs: number,
  missedMessage: string
) {
  const departureDate = toDate(departure);
  if (!departureDate) {
    return { label: "No scheduled departure", status: "unavailable" };
  }

  if (typeof driveMinutes !== "number" || !Number.isFinite(driveMinutes) || driveMinutes < 0) {
    return { label: "--", status: "waiting" };
  }

  const leaveByMs = departureDate.getTime() - (LAST_CHANCE_BUFFER_MINUTES + driveMinutes) * 60000;
  const remainingMs = leaveByMs - nowMs;
  if (remainingMs <= 0) {
    return { label: missedMessage, status: "missed" };
  }

  return { label: formatCountdownMs(remainingMs), status: "countdown" };
}

function LastChanceBar({
  departure,
  driveMinutes,
  label,
  missedMessage,
  variant = "scheduled"
}: {
  departure: string | Date | null | undefined;
  driveMinutes: number | null | undefined;
  label: string;
  missedMessage: string;
  variant?: "scheduled" | "estimated";
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const countdown = getLastChanceCountdown(departure, driveMinutes, nowMs, missedMessage);

  return (
    <div className={`last-chance-bar is-${variant} is-${countdown.status}`}>
      {countdown.status !== "missed" ? <span className="last-chance-label">{label}</span> : null}
      <strong className="last-chance-value">{countdown.label}</strong>
    </div>
  );
}

function getDisplayTerminalAbbrev(terminal: Pick<Terminal, "id" | "abbrev" | "shortName">) {
  if (terminal.id === 7) {
    return "SEA";
  }

  if (terminal.id === 3) {
    return "BBI";
  }

  return terminal.abbrev || terminal.shortName;
}

function vesselHasDeparted(vessel: VesselLocation) {
  return Boolean(parseWsdotDate(vessel.LeftDock)) || (vessel.Speed || 0) > 0.5;
}

function isPastScheduledDeparture(vessel: VesselLocation) {
  const scheduledDeparture = parseWsdotDate(vessel.ScheduledDeparture);
  return scheduledDeparture ? Date.now() > scheduledDeparture.getTime() : false;
}

function getVesselStatus(vessel: VesselLocation | null) {
  if (!vessel) {
    return "Docked";
  }

  if (isPastScheduledDeparture(vessel) && !vesselHasDeparted(vessel)) {
    return "Late";
  }

  const status = vessel.VesselWatchStatus?.trim();
  if (status && !/^\d+$/.test(status)) {
    return status;
  }

  if (vessel.AtDock) {
    return "Docked";
  }

  if ((vessel.Speed || 0) > 0.5) {
    return "Underway";
  }

  return "Docked";
}

function getTravelStatusClass(travelMinutes: number | null | undefined, departure: string | Date | null | undefined) {
  const departureDate = toDate(departure);
  if (!travelMinutes || !departureDate) {
    return undefined;
  }

  const minutesUntilDeparture = (departureDate.getTime() - Date.now()) / 60000;
  return minutesUntilDeparture - travelMinutes >= 5 ? "is-travel-safe" : "is-travel-tight";
}

function vesselMatchesSailingTime(vessel: VesselLocation, sailingDeparture: Date | null) {
  if (!sailingDeparture) {
    return false;
  }

  const vesselDeparture = parseWsdotDate(vessel.ScheduledDeparture) || parseWsdotDate(vessel.LeftDock);
  if (!vesselDeparture) {
    return false;
  }

  return Math.abs(vesselDeparture.getTime() - sailingDeparture.getTime()) <= 15 * 60000;
}

function arrivalTerminalIdsInclude(value: number[] | string | null | undefined, terminalId: number) {
  if (Array.isArray(value)) {
    return value.includes(terminalId);
  }

  if (typeof value === "string") {
    return value
      .split(/\s+/)
      .map(Number)
      .includes(terminalId);
  }

  return false;
}

function getDriveUpSpacesForSailing(
  terminalSailingSpace: TerminalSailingSpaceResponse | null | undefined,
  sailing: ScheduleTime,
  arrivingTerminalId: number
) {
  const sailingDeparture = parseWsdotDate(sailing.DepartingTime);
  if (!terminalSailingSpace || !sailingDeparture) {
    return null;
  }

  const departingSpace = terminalSailingSpace.DepartingSpaces?.find((space) => {
    const spaceDeparture = parseWsdotDate(space.Departure);
    if (!spaceDeparture || Math.abs(spaceDeparture.getTime() - sailingDeparture.getTime()) > 15 * 60000) {
      return false;
    }

    return !sailing.VesselID || !space.VesselID || sailing.VesselID === space.VesselID;
  });

  const arrivalSpace = departingSpace?.SpaceForArrivalTerminals?.find(
    (space) => space.TerminalID === arrivingTerminalId || arrivalTerminalIdsInclude(space.ArrivalTerminalIDs, arrivingTerminalId)
  );

  if (!arrivalSpace || arrivalSpace.DisplayDriveUpSpace === false || typeof arrivalSpace.DriveUpSpaceCount !== "number") {
    return null;
  }

  return arrivalSpace.DriveUpSpaceCount;
}

function getEstimatedOutgoingDeparture(
  nextSailing: ScheduleTime | null,
  routeVessels: VesselLocation[] | undefined,
  plan: { departingTerminalId: number; arrivingTerminalId: number }
) {
  const scheduledDeparture = toDate(nextSailing?.DepartingTime);
  if (!scheduledDeparture) {
    return null;
  }

  const assignedIncomingVessel = nextSailing?.VesselID
    ? routeVessels?.find(
        (vessel) =>
          vessel.VesselID === nextSailing.VesselID &&
          vessel.DepartingTerminalID === plan.arrivingTerminalId &&
          vessel.ArrivingTerminalID === plan.departingTerminalId &&
          Boolean(toDate(vessel.Eta))
      )
    : null;
  const turnaroundDeparture = addMinutes(assignedIncomingVessel?.Eta, DEFAULT_TURNAROUND_MINUTES);

  if (turnaroundDeparture && turnaroundDeparture.getTime() > scheduledDeparture.getTime()) {
    return turnaroundDeparture;
  }

  return scheduledDeparture;
}

export function App() {
  const [prefs, setPrefs] = useLocalStorage<FerryPrefs>("ferrywatch:prefs", DEFAULT_PREFS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [terminalTravelTimes, setTerminalTravelTimes] = useState<TerminalTravelTimes | null>(null);
  const pullActive = useRef(false);
  const pullDistanceValue = useRef(0);
  const pullStartY = useRef<number | null>(null);
  const { location, status: locationStatus, locationEnabled, requestLocation, setLocationEnabled } = useGeolocation();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshKey((current) => current + 1);
    }, FERRY_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const route = getRoute(prefs.routeId);
  const { data, plan, terminals } = useFerryData(route, prefs, location, refreshKey);
  const departingTerminal = getTerminal(plan.departingTerminalId, terminals) || TERMINALS[route.defaultDepartureTerminalId];
  const arrivingTerminal = getTerminal(plan.arrivingTerminalId, terminals) || TERMINALS[route.terminalIds[1]];
  const departingTerminalLabel = getDisplayTerminalAbbrev(departingTerminal);
  const activeVessel = data?.activeVessel || null;
  const incomingSailing = data?.incomingSailing || null;
  const nextSailing = data?.nextSailing || null;

  const upcomingSailings = useMemo(
    () => {
      const now = Date.now();
      const rows = (data?.schedule.TerminalCombos || [])
        .flatMap((combo) => combo.Times || [])
        .map((sailing) => {
          const departing = parseWsdotDate(sailing.DepartingTime);
          const sailingVessel = data?.routeVessels.find(
            (vessel) =>
              vessel.VesselID === sailing.VesselID &&
              vessel.DepartingTerminalID === plan.departingTerminalId &&
              vessel.ArrivingTerminalID === plan.arrivingTerminalId &&
              vesselMatchesSailingTime(vessel, departing)
          );
          const arrival = toDate(sailingVessel?.Eta) || toDate(sailing.ArrivingTime) || addMinutes(sailing.DepartingTime, route.crossingMinutes);
          const departed = departing ? departing.getTime() <= now : false;
          return {
            sailing,
            arrival,
            departed,
            driveUpSpaces: getDriveUpSpacesForSailing(data?.terminalSailingSpace, sailing, plan.arrivingTerminalId),
            stillPendingDeparture: departed && Boolean(sailingVessel && !vesselHasDeparted(sailingVessel)),
            departureTime: departing?.getTime() || Number.POSITIVE_INFINITY,
            arrivalTime: arrival?.getTime() || Number.NEGATIVE_INFINITY
          };
        })
        .filter((row) => {
          if (row.departureTime === Number.POSITIVE_INFINITY) {
            return false;
          }
          return row.departureTime > now || row.arrivalTime > now || row.stillPendingDeparture;
        })
        .sort((a, b) => {
          return a.departureTime - b.departureTime;
        });

      const nextDepartureIndex = rows.findIndex((row) => !row.departed);
      return rows.map((row, index) => ({
        ...row,
        isNextDeparture: index === nextDepartureIndex
      }));
    },
    [
      data?.routeVessels,
      data?.schedule.TerminalCombos,
      data?.terminalSailingSpace,
      plan.arrivingTerminalId,
      plan.departingTerminalId,
      route.crossingMinutes
    ]
  );

  const hasTerminalTravelTimes = Boolean(terminalTravelTimes?.driveText || terminalTravelTimes?.walkText);
  const outgoingDeparture = nextSailing?.DepartingTime;
  const estimatedOutgoingDeparture = getEstimatedOutgoingDeparture(nextSailing, data?.routeVessels, plan);
  const driveTravelClass = getTravelStatusClass(terminalTravelTimes?.driveMinutes, outgoingDeparture);
  const walkTravelClass = getTravelStatusClass(terminalTravelTimes?.walkMinutes, outgoingDeparture);
  const locationDetail =
    location && departingTerminal
      ? hasTerminalTravelTimes
        ? (
            <>
              {terminalTravelTimes?.driveText ? <span className={driveTravelClass}>{terminalTravelTimes.driveText} drive</span> : null}
              {terminalTravelTimes?.walkText ? <span className={walkTravelClass}>{terminalTravelTimes.walkText} walk</span> : null}
            </>
          )
        : <span>{distanceMiles(location, departingTerminal).toFixed(1)} mi away</span>
      : locationStatus === "requesting"
        ? <span>Locating</span>
        : <span>Location off</span>;
  const departureDetail = (
    <>
      {estimatedOutgoingDeparture ? (
        <span className="departure-estimate">Estimated {formatTime(estimatedOutgoingDeparture)}</span>
      ) : null}
      {locationDetail}
    </>
  );

  useEffect(() => {
    setTerminalTravelTimes(null);
  }, [departingTerminal.id]);

  const handleTerminalTravelTimeChange = useCallback((travelTimes: TerminalTravelTimes | null) => {
    setTerminalTravelTimes(travelTimes);
  }, []);

  const activeVesselDeparted = activeVessel ? vesselHasDeparted(activeVessel) : false;
  const estimatedArrival =
    activeVessel?.Eta ||
    (activeVesselDeparted
      ? addMinutes(activeVessel?.LeftDock || incomingSailing?.DepartingTime || activeVessel?.ScheduledDeparture, route.crossingMinutes)
      : null);
  const scheduledArrival =
    incomingSailing?.ArrivingTime ||
    (activeVesselDeparted
      ? addMinutes(activeVessel?.ScheduledDeparture || incomingSailing?.DepartingTime, route.crossingMinutes)
      : null);
  const estimatedArrivalDate = toDate(estimatedArrival);
  const scheduledArrivalDate = toDate(scheduledArrival);
  const estimatedArrivalIsLate =
    Boolean(estimatedArrivalDate && scheduledArrivalDate) &&
    estimatedArrivalDate!.getTime() - scheduledArrivalDate!.getTime() >= 10 * 60000;
  const refreshData = () => setRefreshKey((current) => current + 1);
  const reverseDirection = () => {
    setPrefs((current) => ({
      ...current,
      autoDirection: false,
      departureByRoute: {
        ...current.departureByRoute,
        [route.id]: arrivingTerminal.id
      }
    }));
  };
  const pullReady = pullDistance >= PULL_REFRESH_THRESHOLD;
  const pullIndicatorStyle = {
    opacity: pulling || pullDistance > 0 ? 1 : 0,
    transform: `translate(-50%, ${pullDistance > 0 ? Math.min(12, pullDistance - 30) : -34}px)`
  };

  const pageIsAtTop = () =>
    window.scrollY <= 1 && (document.scrollingElement?.scrollTop || document.documentElement.scrollTop || 0) <= 1;

  const shouldSkipPull = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(target.closest(".route-map, .settings-sheet, button, input, select, textarea, a"));

  const handlePullStart = (event: TouchEvent<HTMLElement>) => {
    if (settingsOpen || shouldSkipPull(event.target) || !pageIsAtTop()) {
      return;
    }

    pullStartY.current = event.touches[0]?.clientY ?? null;
    pullActive.current = pullStartY.current !== null;
  };

  const handlePullMove = (event: TouchEvent<HTMLElement>) => {
    if (!pullActive.current || pullStartY.current === null) {
      return;
    }

    const delta = (event.touches[0]?.clientY ?? pullStartY.current) - pullStartY.current;
    if (delta <= 0 || !pageIsAtTop()) {
      pullDistanceValue.current = 0;
      setPullDistance(0);
      setPulling(false);
      return;
    }

    const nextDistance = Math.min(72, Math.max(0, (delta - 8) * 0.42));
    pullDistanceValue.current = nextDistance;

    if (nextDistance > 0) {
      setPulling(true);
      setPullDistance(nextDistance);
      if (event.cancelable) {
        event.preventDefault();
      }
    }
  };

  const handlePullEnd = () => {
    if (pullActive.current && pullDistanceValue.current >= PULL_REFRESH_THRESHOLD) {
      refreshData();
    }

    pullActive.current = false;
    pullDistanceValue.current = 0;
    pullStartY.current = null;
    setPulling(false);
    setPullDistance(0);
  };

  return (
    <main className="app-shell">
      <section
        className="phone-canvas"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        onTouchCancel={handlePullEnd}
      >
        <div className={`pull-refresh-indicator ${pullReady ? "is-ready" : ""}`} style={pullIndicatorStyle} aria-hidden="true">
          <RefreshCw size={15} className={pullReady ? "spin" : ""} />
        </div>
        <section className="route-card">
          <div className="route-line">
            <span className="terminal-pill">{departingTerminal.shortName}</span>
            <button
              className="route-swap-button"
              type="button"
              title="Reverse direction"
              aria-label={`Reverse direction. Depart from ${arrivingTerminal.shortName} instead`}
              onClick={reverseDirection}
            >
              <ArrowLeftRight size={18} />
            </button>
            <span className="terminal-pill">{arrivingTerminal.shortName}</span>
          </div>

          {data?.error ? (
            <div className="notice-row">
              <AlertTriangle size={16} />
              <span>{data.error}</span>
            </div>
          ) : null}
        </section>

        <section className="map-panel">
          <FerryMap
            route={route}
            terminals={terminals}
            vessels={data?.routeVessels || []}
            activeVesselId={activeVessel?.VesselID}
            userLocation={location}
            departingTerminalId={departingTerminal.id}
            arrivingTerminalId={arrivingTerminal.id}
            onTerminalTravelTimeChange={handleTerminalTravelTimeChange}
          />
          <button
            className="map-glass"
            type="button"
            onClick={refreshData}
            aria-label={`Refresh ferry data. Last updated ${data ? formatTime(data.updatedAt) : "now"}`}
          >
            <span className="map-status-left">
              <Ship size={14} />
              <strong>{getVesselStatus(activeVessel)}</strong>
            </span>
          </button>
          <LastChanceBar
            departure={outgoingDeparture}
            driveMinutes={location ? terminalTravelTimes?.driveMinutes : null}
            label="Last chance to make the scheduled departure"
            missedMessage={MISSED_SCHEDULED_DEPARTURE_MESSAGE}
          />
          <LastChanceBar
            departure={estimatedOutgoingDeparture}
            driveMinutes={location ? terminalTravelTimes?.driveMinutes : null}
            label="Last chance to make the estimated departure"
            missedMessage={MISSED_ESTIMATED_DEPARTURE_MESSAGE}
            variant="estimated"
          />
        </section>

        <section className="stats-grid" aria-label="Ferry timing">
          <StatCard
            label="Estimated arrival"
            value={formatTime(estimatedArrival)}
            detail={relativeMinutes(estimatedArrival)}
            icon={<Ship size={19} />}
            valueClassName={estimatedArrivalIsLate ? "is-late-arrival" : undefined}
          />
          <StatCard
            label="Scheduled arrival"
            value={formatTime(scheduledArrival)}
            detail={relativeMinutes(scheduledArrival)}
            icon={<Clock size={19} />}
          />
          <StatCard
            label="Scheduled departure"
            value={formatTime(outgoingDeparture)}
            detail={relativeMinutes(outgoingDeparture)}
            icon={<Navigation size={19} />}
          />
          <StatCard
            label={`Departing ${departingTerminalLabel}`}
            detail={departureDetail}
            detailClassName="travel-stack"
          />
        </section>

        <section className="schedule-panel">
          <div className="panel-heading">
            <h2>Next sailings</h2>
          </div>

          <div className="sailing-list">
            {upcomingSailings.map(({ sailing, arrival, departed, driveUpSpaces, isNextDeparture }, index) => (
              <div className={`sailing-row ${departed ? "is-previous" : ""}`} key={`${sailing.DepartingTime}-${index}`}>
                <div>
                  <div className="sailing-departure">
                    <strong>{formatTime(sailing.DepartingTime)}</strong>
                    <span>{relativeMinutes(sailing.DepartingTime)}</span>
                    {isNextDeparture && driveUpSpaces !== null ? <span>{driveUpSpaces} spaces</span> : null}
                  </div>
                </div>
                <div>
                  <strong>{formatTime(arrival)}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="app-footer">
          <div className="footer-route">
            <span>Route</span>
            <strong>{route.name}</strong>
          </div>
          <div className="footer-updated">
            <span>Last updated</span>
            <strong>{data ? formatTime(data.updatedAt) : "Updating"}</strong>
          </div>
          <button
            className="icon-button"
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={22} />
          </button>
        </footer>

        <SettingsSheet
          open={settingsOpen}
          prefs={prefs}
          route={route}
          locationEnabled={locationEnabled}
          locationStatus={locationStatus}
          onClose={() => setSettingsOpen(false)}
          onRequestLocation={requestLocation}
          onLocationEnabledChange={setLocationEnabled}
          onPrefsChange={setPrefs}
        />
      </section>
    </main>
  );
}
