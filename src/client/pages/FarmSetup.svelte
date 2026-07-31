<script>
  import FarmMap from '../lib/FarmMap.svelte';

  let { oncreate } = $props();

  let farmName = $state('');
  let boundary = $state(null);
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
      error = 'Please draw the farm boundary on the map';
      return;
    }

    saving = true;
    error = '';

    try {
      const res = await fetch('/api/farms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name: farmName.trim(), boundary_geojson: boundary }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to create farm';
        return;
      }

      localStorage.setItem('token', data.token);
      showToast('Farm created', 'success');
      oncreate(data.farm);
    } catch (e) {
      error = 'Network error. Is the server running?';
    } finally {
      saving = false;
    }
  }
</script>

<div class="farm-setup">
  <h1>Set up your farm</h1>

  <form onsubmit={handleSubmit}>
    {#if error}
      <p class="error">{error}</p>
    {/if}

    <label>
      Farm name
      <input type="text" bind:value={farmName} placeholder="My Farm" required />
    </label>

    <div class="map-wrapper">
      <FarmMap onboundarychange={handleBoundaryChange} />
    </div>
    <p class="hint">Draw the farm boundary on the map using the polygon tool.</p>

    <button type="submit" disabled={saving}>
      {saving ? 'Saving...' : 'Create farm'}
    </button>
  </form>
</div>

<style>
  .farm-setup {
    max-width: 600px;
    margin: 0 auto;
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
    transition: background 0.15s ease, transform 0.12s ease, opacity 0.15s ease;
  }

  button[type="submit"]:hover:not(:disabled) {
    background: #357abd;
  }

  button[type="submit"]:active:not(:disabled) {
    background: #2a5f94;
    transform: scale(0.97);
  }

  button[type="submit"]:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .error {
    color: #d32f2f;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }
</style>
