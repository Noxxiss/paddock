<script>
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet-draw';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-draw/dist/leaflet.draw.css';
  import { addBasemapControls } from '../lib/basemaps.js';

  let { farm, onback, oncreated } = $props();

  let title = $state('');
  let priority = $state('medium');
  let locationType = $state('drawing');
  let paddocks = $state([]);
  let selectedPaddockId = $state('');
  let workers = $state([]);
  let assignedTo = $state('');
  let saving = $state(false);
  let error = $state('');
  import Spinner from '../lib/Spinner.svelte';
  import { showToast } from '../lib/toast.js';
  let loading = $state(true);
  let drawnGeometry = $state(null);
  let mapContainer = $state(null);
  let map;
  let drawnItems;
  let farmId = $derived(farm.id);

  function getToken() {
    return localStorage.getItem('token');
  }

  async function loadPaddocks() {
    try {
      const res = await fetch('/api/paddocks', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        paddocks = data.paddocks;
      }
    } catch {
      error = 'Failed to load paddocks';
    }
  }

  async function loadWorkers() {
    try {
      const res = await fetch(`/api/farms/${farmId}/workers`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        workers = data.workers;
      }
    } catch {
      error = 'Failed to load workers';
    }
  }

  function initMap() {
    map = L.map(mapContainer, {
      center: [-25.0, 135.0],
      zoom: 5,
    });

    addBasemapControls(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: true,
        circle: false,
        rectangle: false,
        marker: true,
        circlemarker: false,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      drawnGeometry = e.layer.toGeoJSON().geometry;
    });

    map.on(L.Draw.Event.EDITED, () => {
      const layers = drawnItems.toGeoJSON();
      if (layers.features.length > 0) {
        drawnGeometry = layers.features[0].geometry;
      }
    });

    map.on(L.Draw.Event.DELETED, () => {
      drawnGeometry = null;
    });

    if (farm.boundary_geojson) {
      try {
        const boundary = typeof farm.boundary_geojson === 'string'
          ? JSON.parse(farm.boundary_geojson)
          : farm.boundary_geojson;
        const boundaryLayer = L.geoJSON(boundary, {
          style: { color: '#999', fillColor: '#ccc', fillOpacity: 0.1, weight: 1, dashArray: '5, 5' },
        });
        boundaryLayer.addTo(map);
        map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] });
      } catch {}
    }
  }

  function switchToDrawing() {
    locationType = 'drawing';
    drawnGeometry = null;
    if (drawnItems) {
      drawnItems.clearLayers();
    }
  }

  function switchToPaddock() {
    locationType = 'paddock';
    selectedPaddockId = '';
    drawnGeometry = null;
    if (drawnItems) {
      drawnItems.clearLayers();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }

    if (locationType === 'drawing' && !drawnGeometry) {
      error = 'Please draw a location on the map';
      return;
    }

    if (locationType === 'paddock' && !selectedPaddockId) {
      error = 'Please select a paddock';
      return;
    }

    saving = true;
    error = '';

    const body = {
      title: title.trim(),
      priority,
      location_type: locationType,
    };

    if (locationType === 'drawing') {
      body.location_geojson = drawnGeometry;
    } else {
      body.paddock_id = parseInt(selectedPaddockId);
    }

    if (assignedTo) {
      body.assigned_to = parseInt(assignedTo);
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to create task';
        return;
      }

      showToast('Task created', 'success');
      if (oncreated) oncreated(data.task);
    } catch {
      error = 'Network error. Is the server running?';
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    if (mapContainer && !map) {
      initMap();
    }
  });

  onMount(() => {
    Promise.all([loadPaddocks(), loadWorkers()]).then(() => { loading = false; });
  });

  onDestroy(() => {
    if (map) {
      try { map.remove(); } catch {}
      map = null;
    }
  });
</script>

<div class="task-create">
  <h1>New task</h1>

  <button class="back" onclick={onback}>&larr; Back</button>

  {#if loading}
    <Spinner message="Loading..." />
  {:else}
  <form onsubmit={handleSubmit}>
    {#if error}
      <p class="error">{error}</p>
    {/if}

    <label>
      Title
      <input type="text" bind:value={title} placeholder="e.g. Fix fence near creek" required />
    </label>

    <label>
      Priority
      <select bind:value={priority}>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>

    <fieldset class="location-type">
      <legend>Location type</legend>
      <label class="radio-label">
        <input type="radio" name="location_type" checked={locationType === 'drawing'} onchange={switchToDrawing} />
        Draw on map
      </label>
      <label class="radio-label">
        <input type="radio" name="location_type" checked={locationType === 'paddock'} onchange={switchToPaddock} />
        Select paddock
      </label>
    </fieldset>

    {#if locationType === 'drawing'}
      <div class="map-wrapper">
        <div bind:this={mapContainer} class="map"></div>
      </div>
      <p class="hint">Draw a point, line, or polygon to mark the task location.</p>
    {:else}
      <label>
        Paddock
        <select bind:value={selectedPaddockId}>
          <option value="">-- Select a paddock --</option>
          {#each paddocks as paddock}
            <option value={paddock.id}>{paddock.name}</option>
          {/each}
        </select>
      </label>
      {#if paddocks.length === 0}
        <p class="empty-hint">No paddocks available. Ask a manager to create paddocks first.</p>
      {/if}
    {/if}

    <label>
      Assign to (optional)
      <select bind:value={assignedTo}>
        <option value="">-- Unassigned --</option>
        {#each workers as worker}
          <option value={worker.id}>{worker.name}</option>
        {/each}
      </select>
    </label>

    <button type="submit" disabled={saving}>
      {saving ? 'Creating...' : 'Create task'}
    </button>
  </form>
  {/if}
</div>

<style>
  .task-create {
    max-width: 600px;
    margin: 0 auto;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 1.5rem;
  }

  .back {
    margin-bottom: 16px;
    padding: 6px 12px;
    background: transparent;
    color: #4a90d9;
    border: 1px solid #4a90d9;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  form {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  label {
    display: block;
    margin-bottom: 12px;
    font-size: 0.875rem;
    color: #555;
  }

  input[type="text"], select {
    display: block;
    width: 100%;
    padding: 8px;
    margin-top: 4px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  fieldset.location-type {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 12px;
  }

  fieldset.location-type legend {
    font-size: 0.875rem;
    color: #555;
    padding: 0 4px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 0.9rem;
    color: #333;
    cursor: pointer;
  }

  .map-wrapper {
    margin-bottom: 12px;
  }

  .map {
    height: 400px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .hint {
    font-size: 0.8rem;
    color: #777;
    margin: -8px 0 16px;
  }

  .empty-hint {
    font-size: 0.85rem;
    color: #999;
    font-style: italic;
    margin: -8px 0 16px;
  }

  button[type="submit"] {
    width: 100%;
    padding: 10px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
  }

  button[type="submit"]:disabled {
    opacity: 0.6;
  }

  .error {
    color: #d32f2f;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }
</style>
