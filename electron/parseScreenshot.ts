/** 塔科夫截图文件名里带世界坐标：时间戳 + x, y, z */

const PATTERNS = [
  /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
];

export function parseScreenshotName(filename: string): { x: number; y: number; z: number } | null {
  const name = filename.replace(/\.[^.]+$/, "");
  for (const pattern of PATTERNS) {
    const match = name.match(pattern);
    if (!match) continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    const z = Number(match[3]);
    if ([x, y, z].every(Number.isFinite)) {
      return { x, y, z };
    }
  }
  return null;
}
