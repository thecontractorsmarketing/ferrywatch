export type VesselLocation = {
  VesselID: number;
  VesselName: string;
  Mmsi?: number | null;
  DepartingTerminalID: number;
  DepartingTerminalName?: string | null;
  DepartingTerminalAbbrev?: string | null;
  ArrivingTerminalID?: number | null;
  ArrivingTerminalName?: string | null;
  ArrivingTerminalAbbrev?: string | null;
  Latitude: number;
  Longitude: number;
  Speed?: number | null;
  Heading?: number | null;
  InService: boolean;
  AtDock: boolean;
  LeftDock?: string | null;
  Eta?: string | null;
  EtaBasis?: string | null;
  ScheduledDeparture?: string | null;
  OpRouteAbbrev?: string[] | null;
  VesselPositionNum?: number | null;
  TimeStamp?: string | null;
  VesselWatchStatus?: string | null;
  VesselWatchMsg?: string | null;
};

export type ScheduleTime = {
  DepartingTime: string;
  ArrivingTime?: string | null;
  LoadingRule?: number;
  VesselID?: number | null;
  VesselName?: string | null;
  VesselHandicapAccessible?: boolean;
  VesselPositionNum?: number | null;
  Routes?: number[] | null;
  AnnotationIndexes?: number[] | null;
};

export type ScheduleTerminalCombo = {
  DepartingTerminalID: number;
  DepartingTerminalName: string;
  ArrivingTerminalID: number;
  ArrivingTerminalName: string;
  SailingNotes?: string | null;
  Annotations?: string[] | null;
  Times: ScheduleTime[];
  AnnotationsIVR?: string[] | null;
};

export type ScheduleResponse = {
  ScheduleID: number;
  ScheduleName: string;
  ScheduleSeason: number | string;
  SchedulePDFUrl?: string;
  ScheduleStart?: string;
  ScheduleEnd?: string;
  AllRoutes?: number[];
  TerminalCombos?: ScheduleTerminalCombo[];
};

export type TerminalSailingSpaceArrival = {
  TerminalID: number;
  TerminalName: string;
  VesselID?: number | null;
  VesselName?: string | null;
  DisplayReservableSpace?: boolean;
  ReservableSpaceCount?: number | null;
  ReservableSpaceHexColor?: string | null;
  DisplayDriveUpSpace?: boolean;
  DriveUpSpaceCount?: number | null;
  DriveUpSpaceHexColor?: string | null;
  MaxSpaceCount?: number | null;
  ArrivalTerminalIDs?: number[] | string | null;
};

export type TerminalDepartingSpace = {
  Departure: string;
  IsCancelled?: boolean;
  VesselID?: number | null;
  VesselName?: string | null;
  MaxSpaceCount?: number | null;
  SpaceForArrivalTerminals?: TerminalSailingSpaceArrival[];
};

export type TerminalSailingSpaceResponse = {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  DepartingSpaces?: TerminalDepartingSpace[];
};

export type TerminalLocationResponse = {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  Latitude?: number | null;
  Longitude?: number | null;
};
