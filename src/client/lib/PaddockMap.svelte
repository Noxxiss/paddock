<script>
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet-draw';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-draw/dist/leaflet.draw.css';
  import { addBasemapControls } from './basemaps.js';

  let { paddocks: initialPaddocks = [], oncreate, onupdate, ondelete } = $props();

  let mapContainer = $state(null);
  let map;
  let drawnItems;

  function getColor(id) {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    return colors[id % colors.length];
  }

  function rebuild() {
    if (!map || !drawnItems) return;
    drawnItems.clearLayers();

    let bounds;
    for (const p of initialPaddocks) {
      const geometry = typeof p.geometry_geojson === 'string'
        ? JSON.parse(p.geometry_geojson)
        : p.geometry_geojson;

      const geoLayer = L.geoJSON(geometry, {
        style: {
          color: getColor(p.id),
          fillColor: getColor(p.id),
          fillOpacity: 0.2,
          weight: 2,
        },
      });

      geoLayer.eachLayer(layer => {
        layer._paddockId = p.id;
        layer.bindTooltip(p.name, { permanent: true, direction: 'center', className: 'paddock-label' });
        drawnItems.addLayer(layer);
      });

      if (!bounds) {
        bounds = geoLayer.getBounds();
      } else {
        bounds.extend(geoLayer.getBounds());
      }
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  $effect(() => {
    if (initialPaddocks && map) {
      rebuild();
    }
  });

  function layerToGeometry(layer) {
    if (layer.toGeoJSON) {
      return layer.toGeoJSON().geometry;
    }
    if (layer.getLatLngs) {
      const latlngs = layer.getLatLngs();
      const coords = latlngs[0] ? latlngs[0].map(ll => [ll.lng, ll.lat]) : latlngs.map(ll => [ll.lng, ll.lat]);
      return { type: 'Polygon', coordinates: [coords] };
    }
    return null;
  }

  function initMap() {
    map = L.map(mapContainer, {
      center: [-25.0, 135.0],
      zoom: 5,
    });

    addBasemapControls(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    rebuild();

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
      const geometry = e.layer.toGeoJSON().geometry;
      const name = prompt('Name this paddock:');
      if (name && name.trim()) {
        drawnItems.addLayer(e.layer);
        oncreate({ name: name.trim(), geometry_geojson: geometry });
      }
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      for (const layer of e.layers.getLayers()) {
        const id = layer._paddockId;
        if (id && onupdate) {
          const geometry = layerToGeometry(layer);
          if (geometry) {
            onupdate(id, { geometry_geojson: geometry });
          }
        }
      }
    });

    map.on(L.Draw.Event.DELETED, (e) => {
      for (const layer of e.layers.getLayers()) {
        const id = layer._paddockId;
        if (id && ondelete) {
          ondelete(id);
        }
      }
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

  :global(.paddock-label) {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.8rem;
    white-space: nowrap;
  }
</style>
