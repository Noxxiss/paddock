<script>
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { addBasemapControls } from '../lib/basemaps.js';

  let { farm, user, onlogout, ongotocreatetask, ongotosettings, ongotolist } = $props();

  let mapContainer = $state(null);
  let map;
  let taskLayerGroup;
  let tasks = $state([]);
  let loading = $state(true);
  let pollInterval;
  let declutterActive = $state(false);
  let inViewCount = $state(0);
  let shownCount = $state(0);
  import { showToast } from '../lib/toast.js';
  let completing = $state(null);
  let completeError = $state('');

  const DECLUTTER_THRESHOLD = 20;
  const PRIORITY_COLORS = {
    high: '#e74c3c',
    medium: '#f39c12',
    low: '#95a5a6',
  };

  function getToken() {
    return localStorage.getItem('token');
  }

  async function loadTasks() {
    try {
      const res = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        tasks = (await res.json()).tasks;
      } else if (res.status === 401) {
        onlogout();
      }
    } catch {
      // silent fail for polling
    } finally {
      loading = false;
    }
  }

  async function markComplete(taskId) {
    completing = taskId;
    completeError = '';
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        showToast('Task marked as complete', 'success');
        map.closePopup();
      } else {
        const data = await res.json();
        completeError = data.error || 'Failed to complete task';
      }
      await loadTasks();
      if (map) renderTasks();
    } catch {
      completeError = 'Network error';
      await loadTasks();
      if (map) renderTasks();
    } finally {
      completing = null;
    }
  }

  function isCoordInBounds(lng, lat, bounds) {
    return bounds.contains([lat, lng]);
  }

  function geometryInBounds(geometry, bounds) {
    if (!geometry || !geometry.coordinates) return false;
    if (geometry.type === 'Point') {
      const [lng, lat] = geometry.coordinates;
      return isCoordInBounds(lng, lat, bounds);
    }
    if (geometry.type === 'MultiPoint') {
      return geometry.coordinates.some(([lng, lat]) => isCoordInBounds(lng, lat, bounds));
    }
    if (geometry.type === 'LineString') {
      return geometry.coordinates.some(([lng, lat]) => isCoordInBounds(lng, lat, bounds));
    }
    if (geometry.type === 'MultiLineString') {
      return geometry.coordinates.some(line => line.some(([lng, lat]) => isCoordInBounds(lng, lat, bounds)));
    }
    if (geometry.type === 'Polygon') {
      return geometry.coordinates[0].some(([lng, lat]) => isCoordInBounds(lng, lat, bounds));
    }
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some(poly => poly[0].some(([lng, lat]) => isCoordInBounds(lng, lat, bounds)));
    }
    if (geometry.type === 'GeometryCollection') {
      return geometry.geometries.some(g => geometryInBounds(g, bounds));
    }
    return false;
  }

  function resolveGeometry(task) {
    try {
      if (task.location_type === 'paddock' && task.paddock_geometry_geojson) {
        return typeof task.paddock_geometry_geojson === 'string'
          ? JSON.parse(task.paddock_geometry_geojson)
          : task.paddock_geometry_geojson;
      }
      if (task.location_geojson) {
        return typeof task.location_geojson === 'string'
          ? JSON.parse(task.location_geojson)
          : task.location_geojson;
      }
    } catch {}
    return null;
  }

  function renderTasks() {
    if (!map || !taskLayerGroup) return;
    taskLayerGroup.clearLayers();

    const mapBounds = map.getBounds();

    const inViewTasks = [];
    for (const task of tasks) {
      const geometry = resolveGeometry(task);
      if (!geometry || !geometryInBounds(geometry, mapBounds)) continue;
      inViewTasks.push({ ...task, _geometry: geometry });
    }

    inViewCount = inViewTasks.length;
    let visibleTasks = inViewTasks;
    if (inViewTasks.length > DECLUTTER_THRESHOLD) {
      visibleTasks = inViewTasks.filter(t => t.priority !== 'low');
      declutterActive = true;
    } else {
      declutterActive = false;
    }
    shownCount = visibleTasks.length;

    for (const task of visibleTasks) {
      const geometry = task._geometry;
      const color = PRIORITY_COLORS[task.priority] || '#3498db';
      let layer;

      if (geometry.type === 'Point') {
        layer = L.circleMarker([geometry.coordinates[1], geometry.coordinates[0]], {
          radius: 10,
          color: '#fff',
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2.5,
        });
      } else {
        layer = L.geoJSON(geometry, {
          style: {
            color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 2.5,
          },
        });
      }

      layer._taskId = task.id;

      const assigneeInfo = task.assigned_to_name
        ? `<br>Assigned to: ${task.assigned_to_name}`
        : '';
      const locationInfo = task.location_type === 'paddock' && task.paddock_name
        ? `<br>Paddock: ${task.paddock_name}`
        : '';

      layer.bindPopup(`
        <div class="task-popup" data-task-id="${task.id}">
          <strong>${task.title}</strong><br>
          Priority: <span class="priority-${task.priority}">${task.priority}</span><br>
          Status: ${task.status}${assigneeInfo}${locationInfo}
          <br>
          <button class="complete-btn" data-task-id="${task.id}">Mark Complete</button>
        </div>
      `);

      taskLayerGroup.addLayer(layer);
    }
  }

  function initMap() {
    map = L.map(mapContainer, {
      center: [-25.0, 135.0],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });

    addBasemapControls(map);

    taskLayerGroup = L.featureGroup();
    map.addLayer(taskLayerGroup);

    if (farm?.boundary_geojson) {
      try {
        const boundary = typeof farm.boundary_geojson === 'string'
          ? JSON.parse(farm.boundary_geojson)
          : farm.boundary_geojson;
        const boundaryLayer = L.geoJSON(boundary, {
          style: {
            color: '#999',
            fillColor: '#ccc',
            fillOpacity: 0.04,
            weight: 1,
            dashArray: '5, 5',
          },
        });
        boundaryLayer.addTo(map);
        map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] });
      } catch {}
    }

    renderTasks();

    map.on('moveend', () => {
      renderTasks();
    });

    map.on('popupopen', () => {
      setTimeout(() => {
        const btn = document.querySelector('.complete-btn');
        if (btn) {
          btn.onclick = () => {
            const taskId = Number(btn.dataset.taskId);
            if (taskId && !completing) {
              btn.disabled = true;
              btn.textContent = 'Completing...';
              markComplete(taskId);
            }
          };
        }
      }, 0);
    });
  }

  $effect(() => {
    if (tasks && map) {
      renderTasks();
    }
  });

  onMount(() => {
    if (mapContainer && !map) {
      initMap();
    }
    loadTasks().then(() => {
      if (map) renderTasks();
    });
    pollInterval = setInterval(() => {
      loadTasks().then(() => {
        if (map) renderTasks();
      });
    }, 30000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (map) {
      map.off('moveend', renderTasks);
      try { map.remove(); } catch {}
      map = null;
    }
  });
</script>

<div class="map-view">
  <div class="header">
    <div class="header-left">
      <h1>{farm?.name || 'Paddock'}</h1>
      {#if user}
        <span class="user-badge">{user.role}: {user.name}</span>
      {/if}
    </div>
    <div class="header-right">
      {#if declutterActive}
        <span class="declutter-badge" title="Low-priority tasks hidden due to high count">
          {inViewCount} in view ({shownCount} shown)
        </span>
      {/if}
      <button class="header-btn" onclick={ongotocreatetask}>+ Task</button>
      <button class="header-btn secondary" onclick={ongotolist}>List view</button>
      <button class="header-btn secondary" onclick={ongotosettings}>Settings</button>
      <button class="header-btn secondary" onclick={onlogout}>Log out</button>
    </div>
  </div>

  {#if loading}
    <div class="loading-overlay">
      <p>Loading tasks...</p>
    </div>
  {/if}

  {#if completeError}
    <div class="error-bar">{completeError}</div>
  {/if}

  <div bind:this={mapContainer} class="map-container"></div>
</div>

<style>
  .map-view {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #2c3e50;
    color: white;
    z-index: 1000;
    flex-shrink: 0;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .header-left h1 {
    margin: 0;
    font-size: 1.1rem;
    white-space: nowrap;
  }

  .user-badge {
    font-size: 0.75rem;
    opacity: 0.7;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .declutter-badge {
    font-size: 0.7rem;
    background: rgba(255,255,255,0.15);
    padding: 3px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .header-btn {
    padding: 6px 12px;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    background: rgba(255,255,255,0.1);
    color: white;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .header-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  .header-btn.secondary {
    background: transparent;
    border-color: transparent;
    opacity: 0.7;
  }

  .header-btn.secondary:hover {
    opacity: 1;
    background: rgba(255,255,255,0.1);
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.3);
    z-index: 999;
    color: white;
    font-size: 1rem;
  }

  .map-container {
    flex: 1;
    min-height: 0;
  }

  :global(.priority-high) {
    color: #e74c3c;
    font-weight: bold;
  }

  :global(.priority-medium) {
    color: #f39c12;
    font-weight: bold;
  }

  :global(.priority-low) {
    color: #95a5a6;
  }

  :global(.leaflet-popup-content) {
    font-size: 0.85rem;
    line-height: 1.5;
  }

  :global(.leaflet-popup-content strong) {
    font-size: 0.95rem;
  }

  .error-bar {
    position: absolute;
    top: 50px;
    left: 0;
    right: 0;
    background: #e74c3c;
    color: white;
    padding: 8px 12px;
    text-align: center;
    font-size: 0.85rem;
    z-index: 1001;
  }

  :global(.complete-btn) {
    margin-top: 6px;
    padding: 4px 10px;
    font-size: 0.75rem;
    background: #27ae60;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  :global(.complete-btn:hover) {
    background: #219a52;
  }
</style>
