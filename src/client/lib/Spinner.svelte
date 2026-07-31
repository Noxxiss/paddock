<script>
  let { message = 'Loading...' } = $props();
</script>

<div class="spinner-overlay">
  <div class="spinner"></div>
  <p>{message}</p>
</div>

<style>
  .spinner-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.3);
    z-index: 999;
    color: white;
    font-size: 1rem;
    gap: 12px;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
