import assert from 'node:assert';
import { test, describe } from 'node:test';

import {
  pointInPolygon,
  isGeometryOutsideBoundary,
} from '../src/client/lib/geometry.js';

describe('pointInPolygon', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

  test('returns true for point inside', () => {
    assert.strictEqual(pointInPolygon(5, 5, square), true);
  });

  test('returns false for point outside (left)', () => {
    assert.strictEqual(pointInPolygon(-1, 5, square), false);
  });

  test('returns false for point outside (right)', () => {
    assert.strictEqual(pointInPolygon(11, 5, square), false);
  });

  test('returns false for point outside (above)', () => {
    assert.strictEqual(pointInPolygon(5, -1, square), false);
  });

  test('returns false for point outside (below)', () => {
    assert.strictEqual(pointInPolygon(5, 11, square), false);
  });

  test('returns true for point on boundary', () => {
    assert.strictEqual(pointInPolygon(5, 0, square), true);
  });

  test('handles triangle', () => {
    const triangle = [[0, 0], [10, 0], [5, 10], [0, 0]];
    assert.strictEqual(pointInPolygon(5, 5, triangle), true);
    assert.strictEqual(pointInPolygon(5, -1, triangle), false);
    assert.strictEqual(pointInPolygon(12, 5, triangle), false);
  });
});

describe('isGeometryOutsideBoundary', () => {
  const boundary = {
    type: 'Polygon',
    coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
  };

  test('returns false for polygon fully inside', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[2, 2], [5, 2], [5, 5], [2, 5], [2, 2]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), false);
  });

  test('returns true for polygon partially outside', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[5, 5], [12, 5], [12, 12], [5, 12], [5, 5]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), true);
  });

  test('returns true for polygon fully outside', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), true);
  });

  test('returns true for polygon matching boundary exactly (vertices on the boundary edge are ambiguous in ray-cast)', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), true);
  });

  test('returns false for polygon with no boundary', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[2, 2], [5, 2], [5, 5], [2, 5], [2, 2]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, null), false);
  });

  test('handles MultiPolygon', () => {
    const geometry = {
      type: 'MultiPolygon',
      coordinates: [[[[2, 2], [5, 2], [5, 5], [2, 5], [2, 2]]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), false);
  });

  test('returns true for non-Polygon/MultiPolygon type', () => {
    const geometry = { type: 'Point', coordinates: [5, 5] };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), true);
  });

  test('returns true for degenerate polygon with < 3 coords', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[1, 1], [2, 2]]],
    };
    assert.strictEqual(isGeometryOutsideBoundary(geometry, boundary), true);
  });
});
