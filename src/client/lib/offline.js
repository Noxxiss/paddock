let swRegistration = null;
let queueSize = 0;
let isOnline = navigator.onLine;
let listeners = [];
let retryInProgress = false;

export function getQueueSize() {
  return queueSize;
}

export function getIsOnline() {
  return isOnline;
}

export function onChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

function notifyListeners() {
  const state = { queueSize, isOnline };
  for (const fn of listeners) {
    fn(state);
  }
}

export async function retryQueue() {
  if (!swRegistration || retryInProgress) return;
  retryInProgress = true;
  try {
    swRegistration.active.postMessage({ type: 'RETRY_QUEUE' });
  } catch {
    retryInProgress = false;
  }
}

export async function initOfflineQueue() {
  if (!('serviceWorker' in navigator)) return;

  try {
    swRegistration = await navigator.serviceWorker.ready;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'QUEUE_UPDATED') {
        queueSize = data.retried !== undefined ? 0 : queueSize;
        if (data.retried !== undefined) {
          retryInProgress = false;
        }
        updateQueueSize();
      }

      if (data.type === 'QUEUE_SIZE') {
        queueSize = data.size;
        notifyListeners();
      }

      if (data.type === 'RETRY_RESULT') {
        retryInProgress = false;
        updateQueueSize();
      }
    });

    window.addEventListener('online', () => {
      isOnline = true;
      notifyListeners();
      retryQueue();
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      notifyListeners();
    });

    updateQueueSize();
  } catch {
    // SW unavailable
  }
}

async function updateQueueSize() {
  if (!swRegistration || !swRegistration.active) return;
  try {
    swRegistration.active.postMessage({ type: 'GET_QUEUE_SIZE' });
  } catch {}
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    swRegistration = registration;
    return true;
  } catch {
    return false;
  }
}
