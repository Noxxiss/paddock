import L from 'leaflet';
import { pointToSegmentDistance, closestPointOnSegmentScreen } from './snapping.js';

export const SNAP_PX_TOLERANCE = 12;

function latLngToContainerPoint(map, latlng) {
  return map.latLngToContainerPoint(L.latLng(latlng.lat, latlng.lng));
}

function containerPointToLatLng(map, point) {
  const ll = map.containerPointToLatLng(point);
  return { lat: ll.lat, lng: ll.lng };
}

export function snapPoint(map, latlng, candidates, tolerancePx) {
  tolerancePx = tolerancePx || SNAP_PX_TOLERANCE;
  const point = latLngToContainerPoint(map, latlng);
  let bestDist = Infinity;
  let bestLatLng = null;

  for (const v of candidates.vertices) {
    const vp = latLngToContainerPoint(map, v);
    const d = point.distanceTo(vp);
    if (d < bestDist && d <= tolerancePx) {
      bestDist = d;
      bestLatLng = v;
    }
  }

  for (const e of candidates.edges) {
    const ea = latLngToContainerPoint(map, e.a);
    const eb = latLngToContainerPoint(map, e.b);
    const d = pointToSegmentDistance(point, ea, eb);
    if (d < bestDist && d <= tolerancePx) {
      bestDist = d;
      const { point: closest } = closestPointOnSegmentScreen(point, ea, eb);
      bestLatLng = containerPointToLatLng(map, closest);
    }
  }

  return bestLatLng;
}
