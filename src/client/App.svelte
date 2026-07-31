<script>
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import FarmSetup from './pages/FarmSetup.svelte';
  import FarmSettings from './pages/FarmSettings.svelte';
  import PaddockList from './pages/PaddockList.svelte';
  import WorkerManagement from './pages/WorkerManagement.svelte';

  let { page = 'login' } = $props();
  let token = $state(localStorage.getItem('token'));
  let farm = $state(null);
  let loading = $state(true);

  async function loadFarm() {
    loading = true;
    try {
      const res = await fetch('/api/farms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        farm = data.farm;
        if (!data.farm.boundary_geojson) {
          page = 'farm-setup';
        }
      } else {
        farm = null;
      }
    } catch {
      farm = null;
    } finally {
      loading = false;
    }
  }

  function handleAuth(t) {
    token = t;
    localStorage.setItem('token', t);
    loadFarm();
  }

  function handleCreate(f) {
    farm = f;
    page = 'farm-settings';
  }

  function handleUpdate(f) {
    farm = f;
  }

  function logout() {
    token = null;
    farm = null;
    localStorage.removeItem('token');
  }

  $effect(() => {
    if (token) {
      loadFarm();
    } else {
      loading = false;
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
    {:else}
      <div class="authenticated">
        <h1>{farm.name}</h1>
        <p>You are logged in.</p>
        <p><em>App content coming soon.</em></p>
        <button onclick={() => page = 'farm-settings'}>Farm settings</button>
        <button onclick={logout}>Log out</button>
      </div>
    {/if}
  {:else if page === 'login'}
    <Login onlogin={handleAuth} onswitch={() => page = 'register'} />
  {:else}
    <Register onregister={handleAuth} onswitch={() => page = 'login'} />
  {/if}
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 16px;
    background: #f5f5f5;
  }

  main {
    max-width: 400px;
    margin: 40px auto;
  }

  .authenticated {
    text-align: center;
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
