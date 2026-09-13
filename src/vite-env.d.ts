/// <reference types="vite/client" />

import type { AppConfig, MapHint, PlayerLocation } from "./lib/types";

declare global {
  interface Window {
    tkf: {
      getConfig: () => Promise<AppConfig>;
      setConfig: (config: Partial<AppConfig>) => Promise<AppConfig>;
      pickDirectory: (kind: "logs" | "screenshots") => Promise<string | null>;
      restartWatchers: () => Promise<{ logs?: string; shots?: string }>;
      onLocation: (cb: (loc: PlayerLocation) => void) => () => void;
      onLog: (cb: (line: string) => void) => () => void;
      onMapHint: (cb: (hint: MapHint) => void) => () => void;
      onStatus: (cb: (status: string) => void) => () => void;
    };
  }
}

export {};
