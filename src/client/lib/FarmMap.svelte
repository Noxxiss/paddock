<script>
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet-draw';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-draw/dist/leaflet.draw.css';
  import { addBasemapControls } from './basemaps.js';

  let { initialBoundary = null, onboundarychange } = $props();

  let mapContainer = $state(null);
  let map;
  let drawnItems;

  function renderBoundary() {
    if (!drawnItems) return;
    drawnItems.clearLayers();
    if (initialBoundary) {
      const geoLayer = L.geoJSON(initialBoundary);
      geoLayer.eachLayer(layer => {
        drawnItems.addLayer(layer);
      });
      map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
    }
  }

  $effect(() => {
    if (initialBoundary && map) {
      renderBoundary();
    }
  });

  function initMap() {
    map = L.map(mapContainer, {
      center: [-25.0, 135.0],
      zoom: 5,
    });

    addBasemapControls(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    renderBoundary();

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      onboundarychange(e.layer.toGeoJSON().geometry);
    });

    map.on(L.Draw.Event.EDITED, () => {
      const layers = drawnItems.toGeoJSON();
      if (layers.features.length > 0) {
        onboundarychange(layers.features[0].geometry);
      }
    });

    map.on(L.Draw.Event.DELETED, () => {
      onboundarychange(null);
    });
  }

  onMount(() => {
    if (mapContainer && !map) {
      initMap();
    }
  });

  onDestroy(() => {
    if (map) {
      try { map.remove(); } catch {}
      map = null;
    }
  });
</script>

<div bind:this={mapContainer} class="map"></div>

<style>
  .map {
    height: 400px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
