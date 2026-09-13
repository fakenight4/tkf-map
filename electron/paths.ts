import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REG_KEY =
  "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EscapeFromTarkov";

export function getGamePath(): string | null {
  try {
    const result = execSync(`reg query "${REG_KEY}" /v UninstallString`, {
      encoding: "utf8",
    });
    const match = result.match(/UninstallString\s+REG_SZ\s+(.+)/);
    if (!match) return null;
    const raw = match[1].trim();
    const parsed = /(.*)[\\/]Uninstall\.exe$/i.exec(raw);
    return parsed ? parsed[1].trim() : null;
  } catch {
    return null;
  }
}

export function defaultLogsPath(): string {
  const game = getGamePath();
  if (game) return path.join(game, "logs");
  return "";
}

export function defaultScreenshotsPath(): string {
  return path.join(os.homedir(), "Documents", "Escape from Tarkov", "Screenshots");
}

export function ensureDir(dir: string): boolean {
  try {
    return Boolean(dir) && fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
