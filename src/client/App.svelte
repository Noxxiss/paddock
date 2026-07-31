<script>
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';

  let { page = 'login' } = $props();
  let token = $state(localStorage.getItem('token'));

  function handleAuth(t) {
    token = t;
    localStorage.setItem('token', t);
  }

  function logout() {
    token = null;
    localStorage.removeItem('token');
  }
</script>

<main>
  {#if token}
    <div class="authenticated">
      <h1>Paddock</h1>
      <p>You are logged in.</p>
      <p><em>App content coming soon.</em></p>
      <button onclick={logout}>Log out</button>
    </div>
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
</style>
