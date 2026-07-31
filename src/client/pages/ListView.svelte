<script>
  import { onMount, onDestroy } from 'svelte';

  let { farm, user, onlogout, ongotocreatetask, ongotosettings, ongotomap } = $props();

  let tasks = $state([]);
  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);
  let completing = $state(null);
  let completeError = $state('');
  let pollInterval;
  let dragIndex = $state(null);
  let dragOverIndex = $state(null);

  function getToken() {
    return localStorage.getItem('token');
  }

  async function markComplete(taskId) {
    completing = taskId;
    completeError = '';
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data = await res.json();
        completeError = data.error || 'Failed to complete task';
      }
      await loadTasks();
    } catch {
      completeError = 'Network error';
      await loadTasks();
    } finally {
      completing = null;
    }
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

  async function handleReorder() {
    const newOrder = tasks.map((t, i) => ({ id: t.id, order: i }));
    saving = true;
    error = '';
    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!res.ok) {
        const data = await res.json();
        error = data.error || 'Failed to reorder tasks';
        await loadTasks();
      }
    } catch {
      error = 'Network error. Is the server running?';
      await loadTasks();
    } finally {
      saving = false;
      dragIndex = null;
      dragOverIndex = null;
    }
  }

  function handleDragStart(e, index) {
    dragIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      dragIndex = null;
      dragOverIndex = null;
      return;
    }

    const item = tasks.splice(dragIndex, 1)[0];
    tasks.splice(dropIndex, 0, item);
    dragIndex = null;
    dragOverIndex = null;

    handleReorder();
  }

  function handleDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }

  const priorityLabel = {
    high: 'High',
    medium: 'Med',
    low: 'Low',
  };

  onMount(() => {
    loadTasks();
    pollInterval = setInterval(loadTasks, 30000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="list-view">
  <div class="header">
    <div class="header-left">
      <h1>{farm?.name || 'Paddock'}</h1>
      {#if user}
        <span class="user-badge">{user.role}: {user.name}</span>
      {/if}
    </div>
    <div class="header-right">
      {#if saving}
        <span class="saving-badge">Saving...</span>
      {/if}
      <button class="header-btn" onclick={ongotocreatetask}>+ Task</button>
      <button class="header-btn secondary" onclick={ongotomap}>Map view</button>
      <button class="header-btn secondary" onclick={ongotosettings}>Settings</button>
      <button class="header-btn secondary" onclick={onlogout}>Log out</button>
    </div>
  </div>

  {#if loading}
    <div class="loading-overlay">
      <p>Loading tasks...</p>
    </div>
  {/if}

  {#if error}
    <div class="error-bar">{error}</div>
  {/if}
  {#if completeError}
    <div class="error-bar">{completeError}</div>
  {/if}

  {#if !loading}
    {#if tasks.length === 0}
      <div class="empty-state">
        <p>No active tasks.</p>
        <button class="header-btn" onclick={ongotocreatetask}>Create the first task</button>
      </div>
    {:else}
      <div class="list-container">
      {#each tasks as task, i (task.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="task-row"
          class:dragging={dragIndex === i}
          class:drag-over={dragOverIndex === i}
          draggable={!saving}
          role="listitem"
          ondragstart={(e) => handleDragStart(e, i)}
          ondragover={(e) => handleDragOver(e, i)}
          ondragleave={handleDragLeave}
          ondrop={(e) => handleDrop(e, i)}
          ondragend={handleDragEnd}
        >
          <div class="drag-handle" tabindex="-1">{@html '&#x2630;'}</div>
          <div class="task-info">
            <div class="task-title">{task.title}</div>
            <div class="task-meta">
              <span class="priority-badge priority-{task.priority}">{priorityLabel[task.priority] || task.priority}</span>
              <span class="status-badge">{task.status}</span>
              {#if task.assigned_to_name}
                <span class="assignee">&rarr; {task.assigned_to_name}</span>
              {/if}
              {#if task.location_type === 'paddock' && task.paddock_name}
                <span class="paddock-tag">{task.paddock_name}</span>
              {/if}
            </div>
          </div>
          <button
            class="complete-btn"
            disabled={completing === task.id}
            onclick={() => markComplete(task.id)}
          >
            {completing === task.id ? '...' : 'Done'}
          </button>
        </div>
      {/each}
    </div>
  {/if}
  {/if}
</div>

<style>
  .list-view {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
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

  .saving-badge {
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

  .error-bar {
    background: #e74c3c;
    color: white;
    padding: 8px 12px;
    text-align: center;
    font-size: 0.85rem;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #7f8c8d;
    font-size: 1rem;
  }

  .list-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .task-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    margin-bottom: 6px;
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    cursor: default;
    transition: box-shadow 0.15s, transform 0.15s;
    user-select: none;
  }

  .task-row.dragging {
    opacity: 0.5;
    box-shadow: 0 3px 8px rgba(0,0,0,0.15);
  }

  .task-row.drag-over {
    box-shadow: 0 2px 8px rgba(74, 144, 217, 0.4);
    transform: translateY(2px);
  }

  .drag-handle {
    cursor: grab;
    color: #bdc3c7;
    font-size: 1.1rem;
    flex-shrink: 0;
    padding: 2px;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .task-info {
    flex: 1;
    min-width: 0;
  }

  .task-title {
    font-size: 0.95rem;
    font-weight: 500;
    color: #2c3e50;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .task-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .priority-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .priority-high {
    background: #fde8e8;
    color: #e74c3c;
  }

  .priority-medium {
    background: #fef5e7;
    color: #f39c12;
  }

  .priority-low {
    background: #f2f3f4;
    color: #95a5a6;
  }

  .status-badge {
    font-size: 0.7rem;
    background: #eafaf1;
    color: #27ae60;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .assignee {
    font-size: 0.75rem;
    color: #7f8c8d;
  }

  .paddock-tag {
    font-size: 0.7rem;
    background: #e8f4fd;
    color: #2980b9;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .complete-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    font-size: 0.75rem;
    background: #27ae60;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 8px;
  }

  .complete-btn:hover {
    background: #219a52;
  }

  .complete-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
