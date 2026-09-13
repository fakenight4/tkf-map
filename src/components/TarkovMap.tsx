import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { boundsOf, createCrs, gameToLatLng, svgBoundsOf } from "../lib/coords";
import { applySvgFloor, labelVisible, layerForPlayer, type InteractiveMap } from "../lib/maps";
import { placeName } from "../lib/placeNames";
import type { PlayerLocation } from "../lib/types";

type Props = {
  mapDef: InteractiveMap | null;
  location: PlayerLocation | null;
  follow: boolean;
  compact?: boolean;
  showLabels?: boolean;
};

function addPlaceLabels(
  map: L.Map,
  mapDef: InteractiveMap,
  height: number | undefined,
  compact: boolean,
): L.LayerGroup {
  const group = L.layerGroup();
  for (const label of mapDef.labels ?? []) {
    if (!labelVisible(label, height)) continue;
    const size = label.size ?? 100;
    if (compact && size < 70) continue;
    const [x, z] = label.position;
    const rotation = Number(label.rotation || 0);
    const fontPct = compact ? 100 : Math.min(110, Math.max(85, size));
    const icon = L.divIcon({
      className: compact ? "map-area-label map-area-label-compact" : "map-area-label",
      html: `<div class="label" style="font-size:${fontPct}%;transform:rotate(${rotation}deg)">${placeName(label.text)}</div>`,
      iconSize: compact ? [140, 18] : [200, 22],
      iconAnchor: compact ? [70, 9] : [100, 11],
    });
    L.marker(gameToLatLng(x, z), { icon, interactive: false, keyboard: false, zIndexOffset: -100000 }).addTo(group);
  }
  group.addTo(map);
  return group;
}

export function TarkovMap({ mapDef, location, follow, compact, showLabels = true }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const svgRef = useRef<SVGElement | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const mapKey = mapDef?.key ?? "";
  const locationRef = useRef(location);
  locationRef.current = location;

  const syncLabels = (map: L.Map, def: InteractiveMap) => {
    labelsRef.current?.remove();
    labelsRef.current = null;
    if (!showLabels) return;
    labelsRef.current = addPlaceLabels(map, def, locationRef.current?.y, Boolean(compact));
  };

  useEffect(() => {
    if (!elRef.current || !mapDef?.svgPath) return;
    let cancelled = false;
    const el = elRef.current;
    mapRef.current?.remove();
    mapRef.current = null;
    svgRef.current = null;
    markerRef.current = null;
    labelsRef.current = null;

    const map = L.map(el, {
      crs: createCrs(mapDef),
      minZoom: mapDef.minZoom ?? 1,
      maxZoom: mapDef.maxZoom ?? 6,
      zoomControl: !compact,
      attributionControl: false,
    });
    const bounds = boundsOf(mapDef);
    const svgBounds = svgBoundsOf(mapDef);
    map.fitBounds(bounds);
    mapRef.current = map;

    fetch(mapDef.svgPath)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => {
        if (cancelled || mapRef.current !== map) return;
        const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        wrapper.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        wrapper.innerHTML = text;
        const inner = wrapper.children[0] as SVGElement | undefined;
        const viewBox = inner?.getAttribute("viewBox");
        if (viewBox) wrapper.setAttribute("viewBox", viewBox);
        const floorRoot = (inner ?? wrapper) as SVGElement;
        applySvgFloor(floorRoot, mapDef, layerForPlayer(mapDef, locationRef.current));
        L.svgOverlay(wrapper, svgBounds, { interactive: false, className: "base-layer" }).addTo(map);
        svgRef.current = floorRoot;
        syncLabels(map, mapDef);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [mapKey, compact, mapDef?.svgPath, showLabels]);

  useEffect(() => {
    if (!mapDef || !svgRef.current) return;
    applySvgFloor(svgRef.current, mapDef, layerForPlayer(mapDef, location));
    if (mapRef.current) syncLabels(mapRef.current, mapDef);
  }, [mapDef, location, showLabels, compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location || !mapDef) return;
    const latlng = gameToLatLng(location.x, location.z);
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latlng, {
        radius: compact ? 6 : 8,
        color: "#ffcc33",
        weight: 2,
        fillColor: "#ff3333",
        fillOpacity: 0.95,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
    }
    if (follow) {
      map.setView(latlng, Math.max(map.getZoom(), compact ? (mapDef.minZoom ?? 1) + 2 : map.getZoom()));
    }
  }, [location, follow, compact, mapDef]);

  if (!mapDef) {
    return <div className="map-empty">没有本地 SVG 地图</div>;
  }

  return <div ref={elRef} className={compact ? "map-root map-root-compact" : "map-root"} />;
}
