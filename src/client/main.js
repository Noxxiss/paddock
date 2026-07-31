import { mount } from 'svelte';
import App from './App.svelte';
import { registerServiceWorker, initOfflineQueue } from './lib/offline.js';

const app = mount(App, {
  target: document.getElementById('app'),
});

registerServiceWorker().then((registered) => {
  if (registered) {
    initOfflineQueue();
  }
});

export default app;
