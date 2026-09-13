import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig, MapHint, PlayerLocation } from "../src/lib/types";

contextBridge.exposeInMainWorld("tkf", {
  getConfig: () => ipcRenderer.invoke("config:get") as Promise<AppConfig>,
  setConfig: (config: Partial<AppConfig>) =>
    ipcRenderer.invoke("config:set", config) as Promise<AppConfig>,
  pickDirectory: (kind: "logs" | "screenshots") =>
    ipcRenderer.invoke("dialog:dir", kind) as Promise<string | null>,
  restartWatchers: () => ipcRenderer.invoke("watchers:restart") as Promise<{ logs?: string; shots?: string }>,
  onLocation: (cb: (loc: PlayerLocation) => void) => {
    const listener = (_: unknown, loc: PlayerLocation) => cb(loc);
    ipcRenderer.on("location", listener);
    return () => ipcRenderer.removeListener("location", listener);
  },
  onLog: (cb: (line: string) => void) => {
    const listener = (_: unknown, line: string) => cb(line);
    ipcRenderer.on("log-line", listener);
    return () => ipcRenderer.removeListener("log-line", listener);
  },
  onMapHint: (cb: (hint: MapHint) => void) => {
    const listener = (_: unknown, hint: MapHint) => cb(hint);
    ipcRenderer.on("map-hint", listener);
    return () => ipcRenderer.removeListener("map-hint", listener);
  },
  onStatus: (cb: (status: string) => void) => {
    const listener = (_: unknown, status: string) => cb(status);
    ipcRenderer.on("status", listener);
    return () => ipcRenderer.removeListener("status", listener);
  },
});
