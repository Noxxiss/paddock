<script>
  let { inviteToken = null, onregister, onswitch } = $props();

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const url = inviteToken ? `/api/accept-invite/${inviteToken}` : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        error = data.error || 'Registration failed';
        return;
      }

      onregister(data.token);
    } catch (e) {
      error = 'Network error. Is the server running?';
    } finally {
      loading = false;
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <h1>{inviteToken ? 'Accept Invite' : 'Register'}</h1>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if inviteToken}
    <p class="hint">You've been invited to join a farm. Create your worker account below.</p>
  {/if}

  <label>
    Name
    <input type="text" bind:value={name} required />
  </label>

  <label>
    Email
    <input type="email" bind:value={email} required />
  </label>

  <label>
    Password
    <input type="password" bind:value={password} required />
  </label>

  <button type="submit" disabled={loading}>
    {loading ? 'Registering...' : 'Register'}
  </button>

  <p class="switch">
    Already have an account?
    <button type="button" class="link" onclick={onswitch}>Log in</button>
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
    transition: color 0.15s ease;
  }

  .link:hover {
    color: #357abd;
  }

  .link:active {
    color: #2a5f94;
  }

  .hint {
    color: #555;
    font-size: 0.875rem;
    margin-bottom: 16px;
  }
</style>
