<script>
  import { onMount } from 'svelte';
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import FarmSetup from './pages/FarmSetup.svelte';
  import FarmSettings from './pages/FarmSettings.svelte';
  import PaddockList from './pages/PaddockList.svelte';
  import WorkerManagement from './pages/WorkerManagement.svelte';
  import TaskCreate from './pages/TaskCreate.svelte';
  import MapView from './pages/MapView.svelte';
  import ListView from './pages/ListView.svelte';
  import TaskDetail from './pages/TaskDetail.svelte';
  import { subscribeToPush, unsubscribeFromPush } from './lib/push.js';

  let { page = 'login' } = $props();
  let token = $state(localStorage.getItem('token'));
  let farm = $state(null);
  let user = $state(null);
  let loading = $state(true);
  let selectedTaskId = $state(null);
  let inviteToken = $state(null);

  async function loadFarm() {
    loading = true;
    try {
      const res = await fetch('/api/farms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        farm = data.farm;
        user = data.user;
        if (!data.farm.boundary_geojson) {
          page = 'farm-setup';
        }
      } else {
        farm = null;
        user = null;
      }
    } catch {
      farm = null;
      user = null;
    } finally {
      loading = false;
    }
  }

  function handleAuth(t) {
    token = t;
    localStorage.setItem('token', t);
    loadFarm();
    subscribeToPush(t);
  }

  function handleCreate(f) {
    farm = f;
    page = 'farm-settings';
  }

  function handleUpdate(f) {
    farm = f;
  }

  function handleTaskCreated() {
    page = 'map';
  }

  function logout() {
    unsubscribeFromPush(token);
    token = null;
    farm = null;
    user = null;
    localStorage.removeItem('token');
  }

  $effect(() => {
    if (token) {
      loadFarm();
    } else {
      loading = false;
    }
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const taskParam = params.get('task');
    if (taskParam) {
      selectedTaskId = parseInt(taskParam);
      page = 'task-detail';
      window.history.replaceState({}, '', '/');
      return;
    }

    const match = window.location.pathname.match(/^\/accept-invite\/([a-f0-9]+)$/);
    if (match) {
      inviteToken = match[1];
      page = 'register';
    }
  });
</script>

<main>
  {#if token}
    {#if loading}
      <div class="authenticated">
        <h1>Paddock</h1>
        <p>Loading...</p>
      </div>
    {:else if !farm}
      <div class="authenticated">
        <h1>Paddock</h1>
        <p>Farm not found. Please contact support.</p>
        <button onclick={logout}>Log out</button>
      </div>
    {:else if page === 'farm-setup'}
      <FarmSetup oncreate={handleCreate} />
    {:else if page === 'farm-settings'}
      <FarmSettings farm={farm} onupdate={handleUpdate} onmanagepaddocks={() => page = 'paddocks'} onmanageworkers={() => page = 'workers'} />
    {:else if page === 'workers'}
      <WorkerManagement {farm} onback={() => page = 'farm-settings'} />
    {:else if page === 'paddocks'}
      <PaddockList onback={() => page = 'farm-settings'} />
    {:else if page === 'create-task'}
      <TaskCreate {farm} onback={() => page = 'map'} oncreated={handleTaskCreated} />
    {:else if page === 'list'}
      <ListView {farm} {user} onlogout={logout} ongotocreatetask={() => page = 'create-task'} ongotosettings={() => page = 'farm-settings'} ongotomap={() => page = 'map'} ongototaskdetail={(id) => { selectedTaskId = id; page = 'task-detail'; }} />
    {:else if page === 'task-detail'}
      <TaskDetail taskId={selectedTaskId} onback={() => page = 'list'} />
    {:else}
      <MapView {farm} {user} onlogout={logout} ongotocreatetask={() => page = 'create-task'} ongotolist={() => page = 'list'} ongotosettings={() => page = 'farm-settings'} />
    {/if}
  {:else if page === 'login'}
    <Login onlogin={handleAuth} onswitch={() => page = 'register'} />
  {:else}
    <Register {inviteToken} onregister={handleAuth} onswitch={() => page = 'login'} />
  {/if}
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
    background: #f5f5f5;
  }

  main {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  button {
    margin: 8px 4px;
    padding: 8px 16px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }
</style>
