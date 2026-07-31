<script>
  let { onlogin, onswitch } = $props();

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        error = data.error || 'Login failed';
        return;
      }

      onlogin(data.token);
    } catch (e) {
      error = 'Network error. Is the server running?';
    } finally {
      loading = false;
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <h1>Log in</h1>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <label>
    Email
    <input type="email" bind:value={email} required />
  </label>

  <label>
    Password
    <input type="password" bind:value={password} required />
  </label>

  <button type="submit" disabled={loading}>
    {loading ? 'Logging in...' : 'Log in'}
  </button>

  <p class="switch">
    Don't have an account?
    <button type="button" class="link" onclick={onswitch}>Register</button>
  </p>
</form>

<style>
  form {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  h1 {
    margin: 0 0 16px;
    font-size: 1.5rem;
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

  .switch {
    text-align: center;
    margin-top: 16px;
    font-size: 0.875rem;
  }

  .link {
    background: none;
    border: none;
    color: #4a90d9;
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
    padding: 0;
  }
</style>
