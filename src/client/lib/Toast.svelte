<script>
  import { onMount, onDestroy } from 'svelte';
  import { subscribe, dismissToast } from './toast.js';

  let items = $state([]);

  let unsub;
  onMount(() => {
    unsub = subscribe((toasts) => {
      items = toasts;
    });
  });
  onDestroy(() => {
    if (unsub) unsub();
  });
</script>

{#if items.length > 0}
  <div class="toast-container">
    {#each items as item (item.id)}
      <div class="toast toast-{item.type}">
        <span class="toast-msg">{item.message}</span>
        <button class="toast-close" onclick={() => dismissToast(item.id)}>&times;</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 360px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 0.875rem;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    pointer-events: auto;
    animation: slideIn 0.25s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success {
    background: #27ae60;
    color: white;
  }

  .toast-error {
    background: #e74c3c;
    color: white;
  }

  .toast-info {
    background: #2980b9;
    color: white;
  }

  .toast-msg {
    flex: 1;
  }

  .toast-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    opacity: 0.7;
    padding: 0;
    line-height: 1;
    transition: opacity 0.15s ease, transform 0.12s ease;
  }

  .toast-close:hover {
    opacity: 1;
  }

  .toast-close:active {
    opacity: 1;
    transform: scale(0.9);
  }
</style>
