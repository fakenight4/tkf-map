export type AppConfig = {
  logsPath: string;
  screenshotsPath: string;
  autoDeleteScreenshots: boolean;
  watchLogs: boolean;
  watchScreenshots: boolean;
};

export type PlayerLocation = {
  filename: string;
  x: number;
  y: number;
  z: number;
  at: number;
};

export type LogLine = {
  text: string;
  at: number;
};

export type MapHint = {
  locationId: string;
  mapKey: string | null;
  raw: string;
};
