<script>
  import FarmMap from '../lib/FarmMap.svelte';

  let { farm: initialFarm, onupdate, onmanagepaddocks, onmanageworkers, onback } = $props();

  let farmName = $state('');
  let boundary = $state(null);

  $effect(() => {
    farmName = initialFarm.name;
    boundary = initialFarm.boundary_geojson ? JSON.parse(initialFarm.boundary_geojson) : null;
  });
  import { showToast } from '../lib/toast.js';
  let saving = $state(false);
  let error = $state('');

  function handleBoundaryChange(geometry) {
    boundary = geometry;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!farmName.trim()) {
      error = 'Farm name is required';
      return;
    }
    if (!boundary) {
      error = 'Farm boundary is required';
      return;
    }

    saving = true;
    error = '';

    try {
      const res = await fetch(`/api/farms/${initialFarm.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name: farmName.trim(), boundary_geojson: boundary }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to update farm';
        return;
      }

      showToast('Farm settings saved', 'success');
      onupdate(data.farm);
    } catch (e) {
      error = 'Network error. Is the server running?';
    } finally {
      saving = false;
    }
  }
</script>

<div class="farm-settings">
  <button class="back-btn" onclick={onback}>&larr; Back to map</button>
  <h1>Farm settings</h1>

  <form onsubmit={handleSubmit}>
    {#if error}
      <p class="error">{error}</p>
    {/if}

    <label>
      Farm name
      <input type="text" bind:value={farmName} required />
    </label>

    <div class="map-wrapper">
      <FarmMap initialBoundary={boundary} onboundarychange={handleBoundaryChange} />
    </div>
    <p class="hint">Edit the farm boundary using the polygon tool.</p>

    <button type="submit" disabled={saving}>
      {saving ? 'Saving...' : 'Save changes'}
    </button>
  </form>

  <div class="section">
    <h2>Paddocks</h2>
    <p class="section-desc">Manage named sub-areas within the farm.</p>
    <button onclick={onmanagepaddocks}>Manage paddocks</button>
  </div>

  <div class="section">
    <h2>Workers</h2>
    <p class="section-desc">Invite workers and manage the team.</p>
    <button onclick={onmanageworkers}>Manage workers</button>
  </div>
</div>

<style>
  .farm-settings {
    max-width: 600px;
    margin: 0 auto;
  }

  .back-btn {
    background: none;
    border: none;
    color: #4a90d9;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0;
    margin: 0 0 8px;
    display: inline-block;
  }

  .back-btn:hover {
    text-decoration: underline;
  }

  h1 {
    margin: 0 0 16px;
    font-size: 1.5rem;
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

  input {
    display: block;
    width: 100%;
    padding: 8px;
    margin-top: 4px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .map-wrapper {
    margin-bottom: 12px;
  }

  .hint {
    font-size: 0.8rem;
    color: #777;
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

  .section {
    margin-top: 24px;
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .section h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
  }

  .section-desc {
    margin: 0 0 12px;
    font-size: 0.85rem;
    color: #777;
  }

  .section button {
    padding: 8px 16px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }
</style>
