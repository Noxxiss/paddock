export function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isGeometryOutsideBoundary(geometry, boundary) {
  if (!boundary) return false;

  let coords;
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.flatMap(p => p[0]);
  } else {
    return true;
  }

  if (!Array.isArray(coords) || coords.length < 3) return true;

  const boundaryRing = boundary.coordinates[0];
  return !coords.every(([lng, lat]) => pointInPolygon(lng, lat, boundaryRing));
}
