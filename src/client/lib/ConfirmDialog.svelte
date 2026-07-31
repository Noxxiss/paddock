<script>
  let { open = false, title = 'Confirm', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onconfirm, oncancel } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="overlay" onclick={oncancel} role="presentation">
    <div class="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h3>{title}</h3>
      <p>{message}</p>
      <div class="actions">
        <button class="cancel-btn" onclick={oncancel}>{cancelText}</button>
        <button class="confirm-btn" class:danger onclick={onconfirm}>{confirmText}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .dialog {
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 1.1rem;
    color: #2c3e50;
  }

  p {
    margin: 0 0 20px;
    font-size: 0.9rem;
    color: #555;
    line-height: 1.4;
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .cancel-btn {
    padding: 8px 16px;
    background: #95a5a6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .confirm-btn {
    padding: 8px 16px;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .confirm-btn.danger {
    background: #e74c3c;
  }

  .cancel-btn:hover {
    background: #7f8c8d;
  }

  .confirm-btn:hover {
    background: #357abd;
  }

  .confirm-btn.danger:hover {
    background: #c0392b;
  }
</style>
