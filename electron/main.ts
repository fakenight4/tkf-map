import { app, BrowserWindow, dialog, ipcMain, screen } from "electron";
import fs from "node:fs";
import path from "node:path";
import { defaultLogsPath, defaultScreenshotsPath } from "./paths";
import { detectLocationId, locationToMapKey } from "./parseLogs";
import { GameLogWatcher } from "./watchers/logs";
import { ScreenshotWatcher } from "./watchers/screenshots";
import type { AppConfig } from "../src/lib/types";

let mainWindow: BrowserWindow | null = null;
let radarWindow: BrowserWindow | null = null;
const logs = new GameLogWatcher();
const shots = new ScreenshotWatcher();

function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

function loadConfig(): AppConfig {
  const fallback: AppConfig = {
    logsPath: defaultLogsPath(),
    screenshotsPath: defaultScreenshotsPath(),
    autoDeleteScreenshots: false,
    watchLogs: true,
    watchScreenshots: true,
  };
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function saveConfig(config: AppConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

let config: AppConfig;

function sendAll(channel: string, payload: unknown): void {
  for (const win of [mainWindow, radarWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function startWatchers(): { logs?: string; shots?: string } {
  const errors: { logs?: string; shots?: string } = {};
  logs.stop();
  shots.stop();
  if (config.watchLogs) {
    const err = logs.start(config.logsPath);
    if (err) errors.logs = err;
    sendAll("status", err ? `日志: ${err}` : `日志监听中: ${config.logsPath}`);
  }
  if (config.watchScreenshots) {
    const err = shots.start(config.screenshotsPath, config.autoDeleteScreenshots, (loc) => {
      sendAll("location", { ...loc, at: Date.now() });
    });
    if (err) errors.shots = err;
    sendAll("status", err ? `截图: ${err}` : `截图监听中: ${config.screenshotsPath}`);
  }
  return errors;
}

logs.on("line", (line: string) => {
  sendAll("log-line", line);
  const locationId = detectLocationId(line);
  if (locationId) {
    sendAll("map-hint", {
      locationId,
      mapKey: locationToMapKey(locationId),
      raw: line,
    });
  }
});

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0b0d10",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function createRadarWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  radarWindow = new BrowserWindow({
    width: 360,
    height: 360,
    x: width - 380,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  radarWindow.setAlwaysOnTop(true, "screen-saver");
  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) radarWindow.loadURL(`${url}#/radar`);
  else radarWindow.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "/radar" });
}

app.whenReady().then(() => {
  config = loadConfig();
  saveConfig(config);
  ipcMain.handle("config:get", () => config);
  ipcMain.handle("config:set", (_e, patch: Partial<AppConfig>) => {
    config = { ...config, ...patch };
    saveConfig(config);
    startWatchers();
    return config;
  });
  ipcMain.handle("dialog:dir", async (_e, kind: "logs" | "screenshots") => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: kind === "logs" ? "选择塔科夫 logs 目录" : "选择截图目录",
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("watchers:restart", () => startWatchers());

  createMainWindow();
  createRadarWindow();
  startWatchers();
});

app.on("window-all-closed", () => {
  logs.stop();
  shots.stop();
  if (process.platform !== "darwin") app.quit();
});
