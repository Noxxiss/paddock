<script>
  import { onMount } from 'svelte';
  import PaddockMap from '../lib/PaddockMap.svelte';
  import Spinner from '../lib/Spinner.svelte';
  import ConfirmDialog from '../lib/ConfirmDialog.svelte';
  import { showToast } from '../lib/toast.js';

  let { onback, farmBoundary = null } = $props();

  let paddocks = $state([]);
  let loading = $state(true);
  let error = $state('');
  let editingPaddock = $state(null);
  let editName = $state('');
  let saving = $state(null);
  let deleting = $state(null);
  let confirmDelete = $state(null);
  let savingName = $state(null);

  function getToken() {
    return localStorage.getItem('token');
  }

  async function loadPaddocks() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/paddocks', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data = await res.json();
        error = data.error || 'Failed to load paddocks';
        return;
      }
      const data = await res.json();
      paddocks = data.paddocks;
    } catch {
      error = 'Network error. Is the server running?';
    } finally {
      loading = false;
    }
  }

  async function handleCreate({ name, geometry_geojson }) {
    error = '';
    try {
      const res = await fetch('/api/paddocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name, geometry_geojson }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to create paddock';
        return;
      }

      showToast('Paddock created', 'success');
      await loadPaddocks();
    } catch {
      error = 'Network error. Is the server running?';
    }
  }

  async function handleUpdate(id, updates) {
    error = '';
    try {
      const res = await fetch(`/api/paddocks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to update paddock';
        return;
      }

      showToast('Paddock updated', 'success');
      await loadPaddocks();
    } catch {
      error = 'Network error. Is the server running?';
    }
  }

  async function handleDelete(id) {
    confirmDelete = null;
    deleting = id;
    error = '';
    try {
      const res = await fetch(`/api/paddocks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to delete paddock';
        showToast(error, 'error');
        return;
      }

      showToast('Paddock deleted', 'success');
      await loadPaddocks();
    } catch {
      error = 'Network error. Is the server running?';
    } finally {
      deleting = null;
    }
  }

  function startEdit(paddock) {
    editingPaddock = paddock.id;
    editName = paddock.name;
  }

  function cancelEdit() {
    editingPaddock = null;
    editName = '';
  }

  async function saveEdit(paddock) {
    if (!editName.trim()) return;
    savingName = paddock.id;
    await handleUpdate(paddock.id, { name: editName.trim() });
    editingPaddock = null;
    editName = '';
    savingName = null;
  }

  onMount(loadPaddocks);
</script>

<div class="paddock-list">
  <h1>Paddocks</h1>

  <div class="map-wrapper">
    <PaddockMap
      paddocks={paddocks}
      oncreate={handleCreate}
      onupdate={handleUpdate}
      ondelete={handleDelete}
      {farmBoundary}
    />
  </div>
  <p class="hint">Draw a new polygon on the map to create a paddock. Edit or delete existing paddocks using the controls.</p>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if loading}
    <Spinner message="Loading paddocks..." />
  {:else if paddocks.length === 0}
    <p class="empty">No paddocks yet. Draw one on the map above.</p>
  {:else}
    <div class="paddock-items">
      {#each paddocks as paddock (paddock.id)}
        <div class="paddock-item">
          {#if editingPaddock === paddock.id}
            <input
              type="text"
              bind:value={editName}
              disabled={savingName === paddock.id}
              onkeydown={(e) => { if (e.key === 'Enter') saveEdit(paddock); if (e.key === 'Escape') cancelEdit(); }}
            />
            <button onclick={() => saveEdit(paddock)} disabled={savingName === paddock.id}>
              {savingName === paddock.id ? 'Saving...' : 'Save'}
            </button>
            <button class="secondary" onclick={cancelEdit} disabled={savingName === paddock.id}>Cancel</button>
          {:else}
            <span class="paddock-name">{paddock.name}</span>
            <div class="paddock-actions">
              <button onclick={() => startEdit(paddock)} disabled={editingPaddock !== null}>Rename</button>
              <button class="danger" onclick={() => confirmDelete = paddock.id} disabled={deleting === paddock.id}>
                {deleting === paddock.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <button class="back" onclick={onback}>Back to settings</button>
</div>

<ConfirmDialog
  open={confirmDelete !== null}
  title="Delete paddock?"
  message="Are you sure you want to delete this paddock? This action cannot be undone."
  confirmText="Delete"
  danger={true}
  onconfirm={() => handleDelete(confirmDelete)}
  oncancel={() => confirmDelete = null}
/>

<style>
  .paddock-list {
    max-width: 600px;
    margin: 0 auto;
  }

  h1 {
    margin: 0 0 16px;
    font-size: 1.5rem;
  }

  .map-wrapper {
    margin-bottom: 12px;
  }

  .hint {
    font-size: 0.8rem;
    color: #777;
    margin: -8px 0 16px;
  }

  .error {
    color: #d32f2f;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }

  .empty {
    color: #777;
    font-size: 0.9rem;
    text-align: center;
    padding: 24px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .paddock-items {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
  }

  .paddock-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    gap: 8px;
  }

  .paddock-item:last-child {
    border-bottom: none;
  }

  .paddock-name {
    font-weight: 500;
    flex: 1;
  }

  .paddock-actions {
    display: flex;
    gap: 4px;
  }

  input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  button {
    padding: 6px 12px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
  }

  button.secondary {
    background: #95a5a6;
  }

  button.danger {
    background: #e74c3c;
  }

  .back {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 10px;
    font-size: 0.9rem;
  }
</style>
