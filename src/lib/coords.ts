import L from "leaflet";
import type { InteractiveMap } from "./maps";

function applyRotation(latLng: L.LatLng, rotation: number | undefined): L.LatLng {
  if (!rotation) return latLng;
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = latLng.lng;
  const y = latLng.lat;
  return L.latLng(x * sin + y * cos, x * cos - y * sin);
}

/** 与 tarkov.dev getCRS 一致：transform[2] 取反，并按 coordinateRotation 旋转。 */
export function createCrs(mapDef: InteractiveMap): L.CRS {
  const [scaleX, marginX, rawScaleY, marginY] = mapDef.transform;
  const scaleY = rawScaleY * -1;
  const rotation = mapDef.coordinateRotation ?? 0;
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scaleX, marginX, scaleY, marginY),
    projection: L.extend({}, L.Projection.LonLat, {
      project: (latLng: L.LatLng) =>
        L.Projection.LonLat.project(applyRotation(latLng, rotation)),
      unproject: (point: L.Point) =>
        applyRotation(L.Projection.LonLat.unproject(point), rotation * -1),
    }),
  });
}

/** 游戏坐标 -> Leaflet latlng。tarkov.dev 的 pos() 为 [z, x]。 */
export function gameToLatLng(x: number, z: number): L.LatLng {
  return L.latLng(z, x);
}

/** maps.json bounds 是 [[x,z],[x,z]]，网站用 getBounds 换成 [z,x]。 */
export function gameBoundsToLatLng(bounds: [number, number][]): L.LatLngBounds {
  return L.latLngBounds(
    [bounds[0][1], bounds[0][0]],
    [bounds[1][1], bounds[1][0]],
  );
}

export function boundsOf(mapDef: InteractiveMap): L.LatLngBounds {
  return gameBoundsToLatLng(mapDef.bounds);
}

export function svgBoundsOf(mapDef: InteractiveMap): L.LatLngBounds {
  return mapDef.svgBounds ? gameBoundsToLatLng(mapDef.svgBounds) : boundsOf(mapDef);
}
