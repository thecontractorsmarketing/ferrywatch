import { useEffect, useMemo, useState } from "react";
import { TERMINALS, type FerryRoute, type Terminal } from "../data/routes";
import { chooseTravelPlan, loadFerryData, type FerryData, type TravelPlan } from "../lib/wsdot";
import type { LatLng } from "../data/routes";

type FerryPrefs = {
  routeId: string;
  autoDirection: boolean;
  departureByRoute: Record<string, number>;
};

type FerryDataState = {
  data: FerryData | null;
  loading: boolean;
  plan: TravelPlan;
  terminals: Record<number, Terminal>;
};

export function useFerryData(route: FerryRoute, prefs: FerryPrefs, userLocation: LatLng | null, refreshKey: number) {
  const [state, setState] = useState<FerryDataState>(() => {
    const plan = chooseTravelPlan(
      route,
      TERMINALS,
      userLocation,
      prefs.autoDirection,
      prefs.departureByRoute[route.id]
    );

    return {
      data: null,
      loading: true,
      plan,
      terminals: TERMINALS
    };
  });

  const plan = useMemo(
    () =>
      chooseTravelPlan(
        route,
        TERMINALS,
        userLocation,
        prefs.autoDirection,
        prefs.departureByRoute[route.id]
      ),
    [prefs.autoDirection, prefs.departureByRoute, route, userLocation]
  );

  useEffect(() => {
    const controller = new AbortController();

    setState((current) => ({
      ...current,
      loading: true,
      plan
    }));

    loadFerryData(route, plan, controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        setState({
          data,
          loading: false,
          plan,
          terminals: data.terminals
        });
      }
    });

    return () => controller.abort();
  }, [plan.departingTerminalId, plan.arrivingTerminalId, refreshKey, route]);

  return state;
}

export type { FerryPrefs };
