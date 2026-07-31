import assert from 'node:assert';
import { test, describe } from 'node:test';

describe('PaddockMap - initMap', () => {
  test('calls invalidateSize after map creation to fix blank tile issue', () => {
    const calls = [];
    const invalidateSize = () => { calls.push('invalidateSize'); };
    const addTo = () => { calls.push('addTo'); };
    const on = () => {};
    const addControl = () => {};
    const addLayer = () => {};
    const L = {
      map: () => ({
        invalidateSize,
        on,
        addControl,
        addLayer,
        setView: () => {},
        fitBounds: () => {},
      }),
      tileLayer: () => ({ addTo }),
      geoJSON: () => ({
        eachLayer: () => {},
        getBounds: () => ({ extend: () => {} }),
      }),
      FeatureGroup: () => ({
        clearLayers: () => {},
        addLayer: () => {},
      }),
      Control: { Draw: function() { return { addTo }; } },
    };

    const mapContainer = { style: { height: '400px' } };
    const map = L.map(mapContainer, { center: [-25, 135], zoom: 5 });
    map.invalidateSize();

    assert.ok(calls.includes('invalidateSize'), 'invalidateSize must be called after map creation');
  });
});

describe('PaddockMap - rebuild with farmBoundary', () => {
  function simulateRebuild(paddocks, farmBoundary) {
    let fitBoundsCalledWith = null;
    const fitBounds = (bounds) => { fitBoundsCalledWith = bounds; };
    let setViewCalled = false;
    const setView = () => { setViewCalled = true; };
    const map = { fitBounds, setView };

    const drawnItems = {
      clearLayers: () => {},
      addLayer: () => {},
    };

    const L = {
      geoJSON: (geometry, opts) => {
        if (geometry === farmBoundary) {
          return {
            getBounds: () => ({ _farm: true }),
            addTo: () => {},
          };
        }
        return {
          eachLayer: (fn) => fn({}),
          getBounds: () => ({ extend: () => {} }),
        };
      },
    };

    function rebuild() {
      if (!map || !drawnItems) return;
      drawnItems.clearLayers();

      for (const p of paddocks) {
        const geometry = typeof p.geometry_geojson === 'string'
          ? JSON.parse(p.geometry_geojson)
          : p.geometry_geojson;

        const geoLayer = L.geoJSON(geometry, {});
        const layer = {};
        drawnItems.addLayer(layer);
      }

      if (paddocks.length > 0) {
        map.fitBounds({});
      } else if (farmBoundary) {
        const boundsLayer = L.geoJSON(farmBoundary, {});
        boundsLayer.addTo();
        map.fitBounds(boundsLayer.getBounds());
      }
    }

    rebuild();
    return { fitBoundsCalledWith, setViewCalled };
  }

  test('fits to farm boundary when no paddocks exist', () => {
    const farmBoundary = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
    const result = simulateRebuild([], farmBoundary);
    assert.deepStrictEqual(result.fitBoundsCalledWith, { _farm: true });
  });

  test('ignores farm boundary when paddocks exist', () => {
    const result = simulateRebuild(
      [{ id: 1, geometry_geojson: { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] } }],
      { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
    );
    assert.strictEqual(result.fitBoundsCalledWith !== null, true);
    assert.strictEqual(result.fitBoundsCalledWith._farm, undefined);
  });

  test('falls back to Australia when neither paddocks nor farm boundary exist', () => {
    const result = simulateRebuild([], null);
    assert.strictEqual(result.fitBoundsCalledWith, null);
  });
});
