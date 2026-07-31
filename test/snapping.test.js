import assert from 'node:assert';
import { test, describe } from 'node:test';

import {
  distanceSquared,
  closestPointOnSegment,
  distanceToSegmentSquared,
  getSnapCandidates,
  pointToSegmentDistance,
  closestPointOnSegmentScreen,
} from '../src/client/lib/snapping.js';

describe('distanceSquared', () => {
  test('returns 0 for same point', () => {
    assert.strictEqual(distanceSquared({ lat: 1, lng: 2 }, { lat: 1, lng: 2 }), 0);
  });

  test('returns squared distance', () => {
    assert.strictEqual(distanceSquared({ lat: 0, lng: 0 }, { lat: 3, lng: 4 }), 25);
  });
});

describe('closestPointOnSegment', () => {
  test('returns a when t=0', () => {
    const result = closestPointOnSegment({ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, { lat: 20, lng: 20 });
    assert.deepStrictEqual(result.point, { lat: 10, lng: 10 });
    assert.strictEqual(result.t, 0);
  });

  test('returns b when t=1', () => {
    const result = closestPointOnSegment({ lat: 30, lng: 30 }, { lat: 10, lng: 10 }, { lat: 20, lng: 20 });
    assert.deepStrictEqual(result.point, { lat: 20, lng: 20 });
    assert.strictEqual(result.t, 1);
  });

  test('returns midpoint for perpendicular projection', () => {
    const result = closestPointOnSegment({ lat: 0, lng: 10 }, { lat: 0, lng: 0 }, { lat: 0, lng: 20 });
    assert.deepStrictEqual(result.point, { lat: 0, lng: 10 });
    assert.strictEqual(result.t, 0.5);
  });

  test('handles zero-length segment', () => {
    const result = closestPointOnSegment({ lat: 5, lng: 5 }, { lat: 3, lng: 3 }, { lat: 3, lng: 3 });
    assert.deepStrictEqual(result.point, { lat: 3, lng: 3 });
  });
});

describe('distanceToSegmentSquared', () => {
  test('returns 0 when point is on segment', () => {
    const d = distanceToSegmentSquared({ lat: 0, lng: 5 }, { lat: 0, lng: 0 }, { lat: 0, lng: 10 });
    assert.strictEqual(d, 0);
  });

  test('returns squared distance to endpoint for off-segment point', () => {
    const d = distanceToSegmentSquared({ lat: 0, lng: 15 }, { lat: 0, lng: 0 }, { lat: 0, lng: 10 });
    assert.strictEqual(d, 25);
  });
});

describe('getSnapCandidates', () => {
  test('extracts vertices and edges from paddock geometries', () => {
    const paddocks = [
      {
        id: 1,
        geometry_geojson: {
          type: 'Polygon',
          coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
        },
      },
    ];

    const result = getSnapCandidates(paddocks);
    assert.strictEqual(result.vertices.length, 4);
    assert.strictEqual(result.edges.length, 4);
    assert.deepStrictEqual(result.vertices[0], { lat: 0, lng: 0 });
    assert.deepStrictEqual(result.vertices[1], { lat: 0, lng: 10 });
  });

  test('returns empty for no paddocks', () => {
    const result = getSnapCandidates([]);
    assert.strictEqual(result.vertices.length, 0);
    assert.strictEqual(result.edges.length, 0);
  });

  test('handles string geometry_geojson', () => {
    const paddocks = [
      {
        id: 1,
        geometry_geojson: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
        }),
      },
    ];

    const result = getSnapCandidates(paddocks);
    assert.strictEqual(result.vertices.length, 4);
  });

  test('skips non-Polygon geometries', () => {
    const paddocks = [
      {
        id: 1,
        geometry_geojson: { type: 'Point', coordinates: [1, 2] },
      },
    ];

    const result = getSnapCandidates(paddocks);
    assert.strictEqual(result.vertices.length, 0);
    assert.strictEqual(result.edges.length, 0);
  });
});

describe('pointToSegmentDistance', () => {
  test('returns 0 for point on segment', () => {
    const d = pointToSegmentDistance({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 });
    assert.strictEqual(d, 0);
  });

  test('calculates perpendicular distance', () => {
    const d = pointToSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    assert.strictEqual(d, 5);
  });
});

describe('closestPointOnSegmentScreen', () => {
  test('returns midpoint', () => {
    const result = closestPointOnSegmentScreen({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 });
    assert.deepStrictEqual(result.point, { x: 0, y: 5 });
    assert.strictEqual(result.t, 0.5);
  });
});
