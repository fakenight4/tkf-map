import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

const BUFFER_SIZE = 8192;

function parseFolderTime(folderPath: string): number {
  const name = path.basename(folderPath);
  const match = name.match(/^log_(\d{4})\.(\d{2})\.(\d{2})_(\d{2})-(\d{2})-(\d{2})_/i);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const ts = Date.parse(`${y}-${m}-${d}T${h}:${min}:${s}`);
    if (Number.isFinite(ts)) return ts;
  }
  try {
    return fs.statSync(folderPath).mtimeMs;
  } catch {
    return 0;
  }
}

export class GameLogWatcher extends EventEmitter {
  private baseWatcher: FSWatcher | null = null;
  private fileWatchers = new Map<string, FSWatcher>();
  private positions = new Map<string, number>();
  private pending = new Map<string, string>();
  private pollTimers = new Map<string, NodeJS.Timeout>();
  private currentFolder: string | null = null;

  start(logsBasePath: string): string | null {
    this.stop();
    if (!logsBasePath || !fs.existsSync(logsBasePath)) {
      return `日志目录不存在: ${logsBasePath || "(空)"}`;
    }
    this.watchBase(logsBasePath);
    return null;
  }

  stop(): void {
    this.baseWatcher?.close();
    this.baseWatcher = null;
    for (const w of this.fileWatchers.values()) w.close();
    this.fileWatchers.clear();
    for (const t of this.pollTimers.values()) clearInterval(t);
    this.pollTimers.clear();
    this.positions.clear();
    this.pending.clear();
    this.currentFolder = null;
  }

  private watchBase(base: string): void {
    const pickLatest = () => {
      let latest: string | null = null;
      let latestTs = -1;
      try {
        for (const name of fs.readdirSync(base)) {
          const full = path.join(base, name);
          try {
            if (!fs.statSync(full).isDirectory()) continue;
          } catch {
            continue;
          }
          const ts = parseFolderTime(full);
          if (ts > latestTs) {
            latestTs = ts;
            latest = full;
          }
        }
      } catch {
        return;
      }
      if (latest) this.useFolder(latest);
    };

    pickLatest();
    this.baseWatcher = chokidar.watch(base, {
      persistent: true,
      depth: 1,
      ignoreInitial: true,
    });
    this.baseWatcher.on("addDir", pickLatest);
  }

  private useFolder(folder: string): void {
    if (this.currentFolder === folder) return;
    this.currentFolder = folder;
    for (const w of this.fileWatchers.values()) w.close();
    this.fileWatchers.clear();
    for (const t of this.pollTimers.values()) clearInterval(t);
    this.pollTimers.clear();
    this.scanFolder(folder);
    const folderWatcher = chokidar.watch(folder, {
      persistent: true,
      depth: 0,
      ignoreInitial: true,
    });
    folderWatcher.on("add", (filePath) => {
      if (this.currentFolder !== folder) return;
      this.maybeWatchLog(filePath);
    });
    this.fileWatchers.set(`folder:${folder}`, folderWatcher);
  }

  private scanFolder(folder: string): void {
    let files: string[] = [];
    try {
      files = fs.readdirSync(folder);
    } catch {
      return;
    }
    for (const name of files) {
      this.maybeWatchLog(path.join(folder, name));
    }
  }

  private maybeWatchLog(filePath: string): void {
    const name = path.basename(filePath).toLowerCase();
    if (!name.endsWith(".log")) return;
    const wanted =
      name.includes("application") ||
      name.includes("push-notifications") ||
      name.includes("network-connection");
    if (!wanted) return;
    this.tailFile(filePath);
  }

  private tailFile(filePath: string): void {
    if (this.fileWatchers.has(filePath)) return;
    let size = 0;
    try {
      size = fs.statSync(filePath).size;
    } catch {
      return;
    }
    this.positions.set(filePath, size);

    const readMore = () => {
      try {
        const stats = fs.statSync(filePath);
        const pos = this.positions.get(filePath) ?? 0;
        if (stats.size < pos) {
          this.positions.set(filePath, 0);
          this.readChunk(filePath, 0, stats.size);
          return;
        }
        if (stats.size > pos) this.readChunk(filePath, pos, stats.size - pos);
      } catch {
        /* ignore */
      }
    };

    const watcher = chokidar.watch(filePath, { persistent: true, ignoreInitial: true });
    watcher.on("change", readMore);
    this.fileWatchers.set(filePath, watcher);
    const timer = setInterval(readMore, 400);
    this.pollTimers.set(filePath, timer);
  }

  private readChunk(filePath: string, start: number, length: number): void {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(Math.min(length, BUFFER_SIZE * 8));
      let remaining = length;
      let offset = start;
      while (remaining > 0) {
        const toRead = Math.min(remaining, buf.length);
        const bytes = fs.readSync(fd, buf, 0, toRead, offset);
        if (bytes <= 0) break;
        const text = buf.subarray(0, bytes).toString("utf8");
        this.emitEntries(filePath, text);
        offset += bytes;
        remaining -= bytes;
        this.positions.set(filePath, offset);
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  private emitEntries(filePath: string, text: string): void {
    const content = `${this.pending.get(filePath) ?? ""}${text}`;
    const lines = content.split(/\r?\n/);
    const complete = content.endsWith("\n") || content.endsWith("\r\n");
    const leftover = complete ? "" : lines.pop() ?? "";
    this.pending.set(filePath, leftover);

    let timestamp = "";
    let body = "";
    const flush = () => {
      if (!timestamp || !body) return;
      const message = body.startsWith("|") ? body.slice(1) : body;
      this.emit("line", `${timestamp}|${message}`);
      timestamp = "";
      body = "";
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (timestamp) body += "\n";
        continue;
      }
      const ts = trimmed.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}(?: [+-]\d{2}:\d{2})?)/);
      if (ts) {
        flush();
        timestamp = ts[1];
        const rest = trimmed.slice(ts[0].length).trim();
        body = rest.startsWith("|") ? rest.slice(1) : rest;
      } else if (timestamp) {
        body += `\n${trimmed}`;
      }
    }
    flush();
  }
}
