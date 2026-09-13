export type MapLayer = {
  name: string;
  svgLayer?: string;
  tilePath?: string;
  show?: boolean;
  extents?: { height: [number, number]; bounds?: unknown[] }[];
};

export type PlaceLabel = {
  position: [number, number];
  text: string;
  rotation?: number | string;
  size?: number;
  top?: number;
  bottom?: number;
};

export type InteractiveMap = {
  key: string;
  projection?: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  transform: [number, number, number, number];
  bounds: [number, number][];
  svgBounds?: [number, number][];
  coordinateRotation?: number;
  svgPath?: string;
  svgLayer?: string;
  tilePath?: string;
  layers?: MapLayer[];
  labels?: PlaceLabel[];
};

export type MapGroup = {
  normalizedName: string;
  maps: InteractiveMap[];
};

export const MAP_LABELS: Record<string, string> = {
  customs: "海关",
  woods: "森林",
  factory: "工厂",
  interchange: "立交桥",
  shoreline: "海岸线",
  reserve: "储备站",
  lighthouse: "灯塔",
  "the-lab": "实验室",
  "streets-of-tarkov": "街区",
  "ground-zero": "零号地带",
  "the-labyrinth": "迷宫",
  terminal: "码头",
  icebreaker: "破冰者",
};

const LOCAL_SVG: Record<string, { file: string; svgLayer?: string }> = {
  "the-lab": { file: "Labs.svg", svgLayer: "First_Level" },
};

const LAYER_SVG_ID: Record<string, string> = {
  "Second Level": "Second_Level",
  Technical: "Technical_Level",
};

export function toLocalSvgPath(remoteOrFile?: string): string | undefined {
  if (!remoteOrFile) return undefined;
  const file = remoteOrFile.split("/").pop();
  if (!file?.toLowerCase().endsWith(".svg")) return undefined;
  return `/maps/svg/${file}`;
}

export function localizeGroup(group: MapGroup): MapGroup {
  return {
    ...group,
    maps: group.maps.map((map) => {
      const extra = LOCAL_SVG[map.key];
      const svgPath = toLocalSvgPath(map.svgPath) ?? (extra ? `/maps/svg/${extra.file}` : undefined);
      return {
        ...map,
        svgPath,
        svgLayer: map.svgLayer ?? extra?.svgLayer,
        tilePath: undefined,
        layers: map.layers?.map((layer) => ({
          ...layer,
          tilePath: undefined,
          svgLayer: layer.svgLayer ?? LAYER_SVG_ID[layer.name],
        })),
      };
    }),
  };
}

export function pickInteractive(group: MapGroup): InteractiveMap | null {
  return group.maps.find((m) => m.projection === "interactive" && m.svgPath) ?? null;
}

function pointInRects(x: number, z: number, bounds: unknown[] | undefined): boolean {
  if (!bounds?.length) return true;
  for (const item of bounds) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const a = item[0];
    const b = item[1];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const minX = Math.min(Number(a[0]), Number(b[0]));
    const maxX = Math.max(Number(a[0]), Number(b[0]));
    const minZ = Math.min(Number(a[1]), Number(b[1]));
    const maxZ = Math.max(Number(a[1]), Number(b[1]));
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
  }
  return false;
}

export function layerForPlayer(
  map: InteractiveMap,
  pos: { x: number; y: number; z: number } | null,
): MapLayer | null {
  if (!pos || !map.layers?.length) return null;
  let found: MapLayer | null = null;
  for (const layer of map.layers) {
    for (const ext of layer.extents ?? []) {
      const [lo, hi] = ext.height ?? [-Infinity, Infinity];
      if (pos.y < lo || pos.y >= hi) continue;
      if (!pointInRects(pos.x, pos.z, ext.bounds)) continue;
      found = layer;
    }
  }
  return found;
}

const FLOOR_IDS = new Set([
  "Ground_Level",
  "Ground_Floor",
  "First_Floor",
  "First_Level",
  "Second_Floor",
  "Second_Level",
  "Third_Floor",
  "Fourth_Floor",
  "Fifth_Floor",
  "Basement",
  "Underground_Level",
  "Technical_Level",
]);

export function labelVisible(label: PlaceLabel, height: number | undefined): boolean {
  if (height === undefined) return true;
  if (label.bottom !== undefined && height < label.bottom) return false;
  if (label.top !== undefined && height > label.top) return false;
  return true;
}

export function applySvgFloor(svg: SVGElement, map: InteractiveMap, layer: MapLayer | null): void {
  const baseId = map.svgLayer || "Ground_Level";
  const extraId = layer?.svgLayer;
  const underground = Boolean(extraId && /underground|basement|technical/i.test(extraId));
  const visible = new Set<string>();
  if (underground && extraId) {
    visible.add(extraId);
  } else {
    visible.add(baseId);
    if (baseId === "Ground_Level") visible.add("First_Floor");
    if (extraId) visible.add(extraId);
  }
  svg.querySelectorAll("g[id]").forEach((node) => {
    const id = node.getAttribute("id");
    if (!id || !FLOOR_IDS.has(id)) return;
    if (visible.has(id)) node.classList.remove("hidden-layer");
    else node.classList.add("hidden-layer");
  });
}
