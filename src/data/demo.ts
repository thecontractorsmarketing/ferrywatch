import { TERMINALS } from "./routes";
import type { ScheduleResponse, VesselLocation } from "../types/wsdot";

const now = Date.now();
const depart = new Date(now + 18 * 60000);
const arrive = new Date(now + 53 * 60000);

function msDate(date: Date) {
  return `/Date(${date.getTime()}-0700)/`;
}

export const DEMO_VESSELS: VesselLocation[] = [
  {
    VesselID: 1,
    VesselName: "Wenatchee",
    DepartingTerminalID: 7,
    DepartingTerminalName: "Seattle",
    DepartingTerminalAbbrev: "SEA",
    ArrivingTerminalID: 3,
    ArrivingTerminalName: "Bainbridge Island",
    ArrivingTerminalAbbrev: "BI",
    Latitude: 47.611,
    Longitude: -122.4207,
    Speed: 15.4,
    Heading: 280,
    InService: true,
    AtDock: false,
    LeftDock: msDate(new Date(now - 7 * 60000)),
    Eta: msDate(arrive),
    EtaBasis: "AIS",
    ScheduledDeparture: msDate(depart),
    OpRouteAbbrev: ["sea-bi"],
    TimeStamp: msDate(new Date(now - 60000)),
    VesselWatchStatus: "In service"
  },
  {
    VesselID: 2,
    VesselName: "Tacoma",
    DepartingTerminalID: 3,
    DepartingTerminalName: "Bainbridge Island",
    DepartingTerminalAbbrev: "BI",
    ArrivingTerminalID: 7,
    ArrivingTerminalName: "Seattle",
    ArrivingTerminalAbbrev: "SEA",
    Latitude: 47.6142,
    Longitude: -122.4574,
    Speed: 14.1,
    Heading: 100,
    InService: true,
    AtDock: false,
    LeftDock: msDate(new Date(now - 12 * 60000)),
    Eta: msDate(new Date(now + 21 * 60000)),
    EtaBasis: "AIS",
    ScheduledDeparture: msDate(new Date(now - 13 * 60000)),
    OpRouteAbbrev: ["sea-bi"],
    TimeStamp: msDate(new Date(now - 60000)),
    VesselWatchStatus: "In service"
  }
];

export const DEMO_SCHEDULE: ScheduleResponse = {
  ScheduleID: 2026,
  ScheduleName: "Demo sailing day",
  ScheduleSeason: "Summer",
  AllRoutes: [1],
  TerminalCombos: [
    {
      DepartingTerminalID: 7,
      DepartingTerminalName: TERMINALS[7].name,
      ArrivingTerminalID: 3,
      ArrivingTerminalName: TERMINALS[3].name,
      Times: [
        {
          DepartingTime: msDate(depart),
          ArrivingTime: msDate(arrive),
          VesselID: 1,
          VesselName: "Wenatchee"
        },
        {
          DepartingTime: msDate(new Date(now + 63 * 60000)),
          ArrivingTime: msDate(new Date(now + 98 * 60000)),
          VesselID: 2,
          VesselName: "Tacoma"
        }
      ]
    }
  ]
};
