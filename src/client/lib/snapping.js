function sqr(x) { return x * x; }

function distanceSquared(a, b) {
  return sqr(a.lat - b.lat) + sqr(a.lng - b.lng);
}

function closestPointOnSegment(p, a, b) {
  const ab = { lat: b.lat - a.lat, lng: b.lng - a.lng };
  const ap = { lat: p.lat - a.lat, lng: p.lng - a.lng };
  const ab2 = sqr(ab.lat) + sqr(ab.lng);
  if (ab2 === 0) return { point: a, t: 0 };
  let t = (ap.lat * ab.lat + ap.lng * ab.lng) / ab2;
  t = Math.max(0, Math.min(1, t));
  return {
    point: { lat: a.lat + t * ab.lat, lng: a.lng + t * ab.lng },
    t,
  };
}

function distanceToSegmentSquared(p, a, b) {
  const { point } = closestPointOnSegment(p, a, b);
  return distanceSquared(p, point);
}

function getSnapCandidates(paddocks) {
  const vertices = [];
  const edges = [];
  for (const p of paddocks) {
    const geometry = typeof p.geometry_geojson === 'string'
      ? JSON.parse(p.geometry_geojson)
      : p.geometry_geojson;
    if (!geometry || geometry.type !== 'Polygon') continue;
    for (const ring of geometry.coordinates) {
      for (let i = 0; i < ring.length - 1; i++) {
        const v = { lat: ring[i][1], lng: ring[i][0] };
        vertices.push(v);
        const next = { lat: ring[i + 1][1], lng: ring[i + 1][0] };
        edges.push({ a: v, b: next });
      }
    }
  }
  return { vertices, edges };
}

function pointToSegmentDistance(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return Math.sqrt(sqr(p.x - a.x) + sqr(p.y - a.y));
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  return Math.sqrt(sqr(p.x - cx) + sqr(p.y - cy));
}

function closestPointOnSegmentScreen(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return { point: { x: a.x, y: a.y }, t: 0 };
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return {
    point: { x: a.x + t * abx, y: a.y + t * aby },
    t,
  };
}

export {
  distanceSquared,
  closestPointOnSegment,
  distanceToSegmentSquared,
  getSnapCandidates,
  pointToSegmentDistance,
  closestPointOnSegmentScreen,
};
