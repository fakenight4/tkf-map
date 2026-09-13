import { parseScreenshotName } from "../parseScreenshot";
import fs from "node:fs";
import path from "node:path";

type ShotHandler = (payload: {
  filename: string;
  x: number;
  y: number;
  z: number;
}) => void;

export class ScreenshotWatcher {
  private watcher: fs.FSWatcher | null = null;
  private autoDelete = false;
  private onShot: ShotHandler | null = null;

  start(dir: string, autoDelete: boolean, onShot: ShotHandler): string | null {
    this.stop();
    this.autoDelete = autoDelete;
    this.onShot = onShot;
    if (!dir || !fs.existsSync(dir)) {
      return `截图目录不存在: ${dir || "(空)"}`;
    }
    this.watcher = fs.watch(dir, (eventType, filename) => {
      if (!filename) return;
      if (eventType !== "change" && eventType !== "rename") return;
      const coords = parseScreenshotName(filename);
      if (!coords) return;
      this.onShot?.({ filename, ...coords });
      if (this.autoDelete) {
        fs.promises.unlink(path.join(dir, filename)).catch(() => undefined);
      }
    });
    return null;
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
