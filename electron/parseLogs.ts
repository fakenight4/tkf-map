/** 游戏内部 location id -> tarkov.dev maps.json 的 normalizedName */

export const LOCATION_TO_MAP: Record<string, string> = {
  bigmap: "customs",
  woods: "woods",
  factory4: "factory",
  factory4_day: "factory",
  factory4_night: "factory",
  interchange: "interchange",
  shoreline: "shoreline",
  rezervbase: "reserve",
  rezerv_base: "reserve",
  lighthouse: "lighthouse",
  laboratory: "the-lab",
  tarkovstreets: "streets-of-tarkov",
  city: "streets-of-tarkov",
  sandbox: "ground-zero",
  sandbox_high: "ground-zero",
  labyrinth: "the-labyrinth",
  terminal: "terminal",
};

const LOCATION_RE = [
  /Load location\s+([A-Za-z0-9_]+)/i,
  /location[:\s'"=]+([A-Za-z0-9_]+)/i,
  /Location:\s*([A-Za-z0-9_]+)/,
];

export function detectLocationId(line: string): string | null {
  for (const re of LOCATION_RE) {
    const match = line.match(re);
    if (!match) continue;
    const id = match[1].toLowerCase();
    if (id === "id" || id === "true" || id === "false") continue;
    if (LOCATION_TO_MAP[id] || id.length > 3) return id;
  }
  return null;
}

export function locationToMapKey(locationId: string): string | null {
  return LOCATION_TO_MAP[locationId.toLowerCase()] ?? null;
}
