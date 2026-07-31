<script>
  let { farm, onback } = $props();

  let workers = $state([]);
  let loading = $state(true);
  let error = $state('');
  let inviteEmail = $state('');
  let inviting = $state(false);
  let lastInvite = $state(null);
  let removing = $state(null);
  let farmId = $derived(farm.id);

  async function loadWorkers() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/farms/${farmId}/workers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to load workers');
      const data = await res.json();
      workers = data.workers;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    inviting = true;
    error = '';
    lastInvite = null;

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Failed to create invite';
        return;
      }

      lastInvite = data.invite;
      inviteEmail = '';
    } catch (e) {
      error = 'Network error. Is the server running?';
    } finally {
      inviting = false;
    }
  }

  async function handleRemove(workerId) {
    if (!confirm('Remove this worker from the farm?')) return;

    removing = workerId;
    error = '';

    try {
      const res = await fetch(`/api/farms/${farmId}/workers/${workerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!res.ok) {
        const data = await res.json();
        error = data.error || 'Failed to remove worker';
        return;
      }

      workers = workers.filter(w => w.id !== workerId);
    } catch (e) {
      error = 'Network error. Is the server running?';
    } finally {
      removing = null;
    }
  }

  function getInviteLink(token) {
    return `${window.location.origin}/accept-invite/${token}`;
  }

  async function copyLink(token) {
    try {
      await navigator.clipboard.writeText(getInviteLink(token));
    } catch {
      // Fallback: select the text manually
    }
  }

  $effect(() => {
    loadWorkers();
  });
</script>

<div class="worker-management">
  <h1>Workers</h1>

  <button class="back" onclick={onback}>&larr; Back</button>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="section">
    <h2>Invite a worker</h2>
    <p class="section-desc">Generate an invite link to send to a new worker.</p>

    <form onsubmit={handleInvite}>
      <label>
        Email address
        <input type="email" bind:value={inviteEmail} placeholder="worker@example.com" required />
      </label>

      <button type="submit" disabled={inviting || !inviteEmail.trim()}>
        {inviting ? 'Generating...' : 'Generate invite link'}
      </button>
    </form>

    {#if lastInvite}
      <div class="invite-result">
        <p class="invite-label">Invite link for {lastInvite.email}:</p>
        <div class="invite-link-row">
          <code class="invite-link">{getInviteLink(lastInvite.token)}</code>
          <button class="copy-btn" onclick={() => copyLink(lastInvite.token)} title="Copy to clipboard">
            Copy
          </button>
        </div>
        <p class="invite-hint">Share this link with the worker. It expires in 7 days.</p>
      </div>
    {/if}
  </div>

  <div class="section">
    <h2>Worker list</h2>
    <p class="section-desc">Current workers on the farm.</p>

    {#if loading}
      <p>Loading...</p>
    {:else if workers.length === 0}
      <p class="empty">No workers yet.</p>
    {:else}
      <ul class="worker-list">
        {#each workers as worker}
          <li class="worker-item">
            <div class="worker-info">
              <strong>{worker.name}</strong>
              <span class="worker-email">{worker.email}</span>
              <span class="worker-joined">Joined {new Date(worker.created_at).toLocaleDateString()}</span>
            </div>
            <button
              class="remove-btn"
              onclick={() => handleRemove(worker.id)}
              disabled={removing === worker.id}
            >
              {removing === worker.id ? 'Removing...' : 'Remove'}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .worker-management {
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

  .section {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 16px;
  }

  .section h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
  }

  .section-desc {
    margin: 0 0 16px;
    font-size: 0.85rem;
    color: #777;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  label {
    display: block;
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

  button[type="submit"] {
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

  .invite-result {
    margin-top: 16px;
    padding: 12px;
    background: #f0f8ff;
    border-radius: 4px;
  }

  .invite-label {
    margin: 0 0 8px;
    font-size: 0.875rem;
    color: #555;
  }

  .invite-link-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .invite-link {
    flex: 1;
    padding: 8px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.75rem;
    word-break: break-all;
    overflow-wrap: break-word;
  }

  .copy-btn {
    padding: 6px 12px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .invite-hint {
    margin: 8px 0 0;
    font-size: 0.78rem;
    color: #888;
  }

  .empty {
    color: #999;
    font-style: italic;
  }

  .worker-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .worker-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #eee;
  }

  .worker-item:last-child {
    border-bottom: none;
  }

  .worker-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .worker-email {
    font-size: 0.85rem;
    color: #777;
  }

  .worker-joined {
    font-size: 0.78rem;
    color: #aaa;
  }

  .remove-btn {
    padding: 6px 12px;
    background: #d32f2f;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .remove-btn:disabled {
    opacity: 0.6;
  }

  .error {
    color: #d32f2f;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }
</style>
