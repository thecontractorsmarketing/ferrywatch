export type LatLng = {
  lat: number;
  lng: number;
};

export type Terminal = LatLng & {
  id: number;
  name: string;
  shortName: string;
  abbrev: string;
};

export type TerminalDirectionsDestination = {
  location: LatLng;
  placeId?: string;
};

export type FerryRoute = {
  id: string;
  name: string;
  color: string;
  crossingMinutes: number;
  abbrevs: string[];
  terminalIds: number[];
  defaultDepartureTerminalId: number;
  mates: Record<number, number>;
};

export const TERMINALS: Record<number, Terminal> = {
  1: { id: 1, name: "Anacortes", shortName: "Anacortes", abbrev: "ANA", lat: 48.5073, lng: -122.6773 },
  3: { id: 3, name: "Bainbridge Island", shortName: "Bainbridge", abbrev: "BI", lat: 47.6226, lng: -122.5093 },
  4: { id: 4, name: "Bremerton", shortName: "Bremerton", abbrev: "BRE", lat: 47.5618, lng: -122.6251 },
  5: { id: 5, name: "Clinton", shortName: "Clinton", abbrev: "CLI", lat: 47.9754, lng: -122.3496 },
  7: { id: 7, name: "Seattle", shortName: "Seattle", abbrev: "SEA", lat: 47.6025, lng: -122.3398 },
  8: { id: 8, name: "Edmonds", shortName: "Edmonds", abbrev: "EDM", lat: 47.8134, lng: -122.3845 },
  9: { id: 9, name: "Fauntleroy", shortName: "Fauntleroy", abbrev: "FAU", lat: 47.5233, lng: -122.3958 },
  10: { id: 10, name: "Friday Harbor", shortName: "Friday Harbor", abbrev: "FRI", lat: 48.5357, lng: -123.0149 },
  11: { id: 11, name: "Coupeville", shortName: "Coupeville", abbrev: "COU", lat: 48.159, lng: -122.6726 },
  12: { id: 12, name: "Kingston", shortName: "Kingston", abbrev: "KIN", lat: 47.7956, lng: -122.4943 },
  13: { id: 13, name: "Lopez Island", shortName: "Lopez", abbrev: "LOP", lat: 48.5708, lng: -122.8839 },
  14: { id: 14, name: "Mukilteo", shortName: "Mukilteo", abbrev: "MUK", lat: 47.9507, lng: -122.3045 },
  15: { id: 15, name: "Orcas Island", shortName: "Orcas", abbrev: "ORC", lat: 48.5973, lng: -122.9438 },
  16: { id: 16, name: "Point Defiance", shortName: "Pt Defiance", abbrev: "PDE", lat: 47.3065, lng: -122.5146 },
  17: { id: 17, name: "Port Townsend", shortName: "Port Townsend", abbrev: "PTD", lat: 48.1111, lng: -122.759 },
  18: { id: 18, name: "Shaw Island", shortName: "Shaw", abbrev: "SHA", lat: 48.5848, lng: -122.928 },
  20: { id: 20, name: "Southworth", shortName: "Southworth", abbrev: "SOU", lat: 47.5133, lng: -122.4951 },
  21: { id: 21, name: "Tahlequah", shortName: "Tahlequah", abbrev: "TAH", lat: 47.3327, lng: -122.5076 },
  22: { id: 22, name: "Vashon Island", shortName: "Vashon", abbrev: "VAS", lat: 47.5108, lng: -122.4643 }
};

export const TERMINAL_DIRECTIONS_DESTINATIONS: Record<number, TerminalDirectionsDestination> = {
  // Google Maps' Winslow Ferry Terminal place routes to the drop-off area, not the drive-on ramp.
  3: {
    location: { lat: 47.623315, lng: -122.5107031 },
    placeId: "ChIJA4NIhsc-kFQRwHCDpjPEjlQ"
  }
};

function pairMates(a: number, b: number): Record<number, number> {
  return { [a]: b, [b]: a };
}

export const ROUTES: FerryRoute[] = [
  {
    id: "sea-bi",
    name: "Seattle / Bainbridge",
    color: "#2dd4bf",
    crossingMinutes: 35,
    abbrevs: ["sea-bi"],
    terminalIds: [7, 3],
    defaultDepartureTerminalId: 7,
    mates: pairMates(7, 3)
  },
  {
    id: "sea-br",
    name: "Seattle / Bremerton",
    color: "#60a5fa",
    crossingMinutes: 60,
    abbrevs: ["sea-br"],
    terminalIds: [7, 4],
    defaultDepartureTerminalId: 7,
    mates: pairMates(7, 4)
  },
  {
    id: "ed-king",
    name: "Edmonds / Kingston",
    color: "#a3e635",
    crossingMinutes: 30,
    abbrevs: ["ed-king", "edm-kin"],
    terminalIds: [8, 12],
    defaultDepartureTerminalId: 8,
    mates: pairMates(8, 12)
  },
  {
    id: "muk-cl",
    name: "Mukilteo / Clinton",
    color: "#facc15",
    crossingMinutes: 20,
    abbrevs: ["muk-cl"],
    terminalIds: [14, 5],
    defaultDepartureTerminalId: 14,
    mates: pairMates(14, 5)
  },
  {
    id: "pt-coup",
    name: "Port Townsend / Coupeville",
    color: "#fb923c",
    crossingMinutes: 30,
    abbrevs: ["pt-coup"],
    terminalIds: [17, 11],
    defaultDepartureTerminalId: 17,
    mates: pairMates(17, 11)
  },
  {
    id: "pd-tal",
    name: "Pt Defiance / Tahlequah",
    color: "#f472b6",
    crossingMinutes: 20,
    abbrevs: ["pd-tal"],
    terminalIds: [16, 21],
    defaultDepartureTerminalId: 16,
    mates: pairMates(16, 21)
  },
  {
    id: "f-v",
    name: "Fauntleroy / Vashon",
    color: "#c084fc",
    crossingMinutes: 20,
    abbrevs: ["f-v", "f-v-s"],
    terminalIds: [9, 22],
    defaultDepartureTerminalId: 9,
    mates: pairMates(9, 22)
  },
  {
    id: "f-s",
    name: "Fauntleroy / Southworth",
    color: "#38bdf8",
    crossingMinutes: 40,
    abbrevs: ["f-s", "f-v-s"],
    terminalIds: [9, 20],
    defaultDepartureTerminalId: 9,
    mates: pairMates(9, 20)
  },
  {
    id: "sw-v",
    name: "Southworth / Vashon",
    color: "#34d399",
    crossingMinutes: 20,
    abbrevs: ["sw-v", "f-v-s"],
    terminalIds: [20, 22],
    defaultDepartureTerminalId: 20,
    mates: pairMates(20, 22)
  },
  {
    id: "ana-fh",
    name: "Anacortes / Friday Harbor",
    color: "#f87171",
    crossingMinutes: 65,
    abbrevs: ["ana-sj", "san-juan"],
    terminalIds: [1, 10],
    defaultDepartureTerminalId: 1,
    mates: pairMates(1, 10)
  }
];

export function getRoute(routeId: string) {
  return ROUTES.find((route) => route.id === routeId) || ROUTES[0];
}

export function getTerminal(terminalId: number, terminals: Record<number, Terminal> = TERMINALS) {
  return terminals[terminalId] || TERMINALS[terminalId];
}

export function getTerminalDirectionsDestination(terminal: Terminal): TerminalDirectionsDestination {
  return TERMINAL_DIRECTIONS_DESTINATIONS[terminal.id] || { location: terminal };
}
