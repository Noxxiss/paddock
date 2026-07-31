const SHELL_CACHE = 'paddock-shell-v2';
const TILE_CACHE = 'paddock-tiles-v1';
const API_CACHE = 'paddock-api-v1';
const DYNAMIC_CACHE = 'paddock-dynamic-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-72.png',
];

const TILE_URL_PATTERN = /tile\.openstreetmap\.org\//;
const API_URL_PATTERN = /\/api\//;
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        return Promise.all(
          SHELL_ASSETS.map((url) =>
            cache.add(url).catch(() => {})
          )
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![SHELL_CACHE, TILE_CACHE, API_CACHE, DYNAMIC_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isWriteMethod(method) {
  return WRITE_METHODS.includes(method);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function handleApiRequest(event) {
  const { request } = event;
  const url = new URL(request.url);

  if (isWriteMethod(request.method)) {
    try {
      const response = await fetch(request.clone());
      return response;
    } catch {
      const body = await request.clone().text();
      let parsedBody;
      try { parsedBody = JSON.parse(body); } catch { parsedBody = body; }

      const headers = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const queuedItem = {
        url: request.url,
        method: request.method,
        headers,
        body: parsedBody,
        timestamp: Date.now(),
        retryCount: 0,
      };

      await addToQueue(queuedItem);

      const responseBody = JSON.stringify({
        queued: true,
        message: 'Request queued for retry when online',
      });
      return new Response(responseBody, {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return networkFirst(request, API_CACHE);
}

const DB_NAME = 'paddock-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'requests';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addToQueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(item);
    tx.oncomplete = () => {
      db.close();
      self.clients.matchAll().then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'QUEUE_UPDATED' });
        }
      });
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = store.getAll();
    tx.oncomplete = () => {
      db.close();
      resolve(all.result || []);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function clearQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function retryQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return { retried: 0, failed: 0 };

  let retried = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const headers = new Headers(item.headers);
      const fetchOptions = {
        method: item.method,
        headers,
      };

      if (item.body && typeof item.body === 'object') {
        fetchOptions.body = JSON.stringify(item.body);
      } else if (item.body) {
        fetchOptions.body = item.body;
      }

      const response = await fetch(item.url, fetchOptions);

      if (response.ok) {
        await removeFromQueue(item.id);
        retried++;
      } else {
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount >= 5) {
          await removeFromQueue(item.id);
          failed++;
        } else {
          const db = await openDB();
          await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(item);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
          });
          failed++;
        }
      }
    } catch {
      failed++;
    }
  }

  return { retried, failed };
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (API_URL_PATTERN.test(url.href)) {
    event.respondWith(handleApiRequest(event));
    return;
  }

  if (TILE_URL_PATTERN.test(url.href)) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$/.test(url.pathname);

  if (isAsset) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RETRY_QUEUE') {
    event.waitUntil(
      retryQueue().then((result) => {
        if (event.source) {
          event.source.postMessage({
            type: 'RETRY_RESULT',
            ...result,
          });
        }
        self.clients.matchAll().then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'QUEUE_UPDATED', ...result });
          }
        });
      })
    );
  }

  if (event.data && event.data.type === 'GET_QUEUE_SIZE') {
    event.waitUntil(
      getQueue().then((queue) => {
        if (event.source) {
          event.source.postMessage({
            type: 'QUEUE_SIZE',
            size: queue.length,
          });
        }
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'retry-queue') {
    event.waitUntil(retryQueue());
  }
});

self.addEventListener('online', () => {
  retryQueue().then((result) => {
    self.clients.matchAll().then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: 'QUEUE_UPDATED',
          ...result,
        });
      }
    });
  });
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  const { type, task } = data;
  if (!task) return;

  let title = 'Paddock';
  let body = '';

  if (type === 'task.assigned') {
    body = `Assigned: ${task.title}`;
  } else if (type === 'task.created') {
    body = `New task: ${task.title}`;
  } else {
    body = task.title;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { taskId: task.id },
      tag: `task-${task.id}`,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const taskId = event.notification.data?.taskId;
  if (!taskId) return;

  const urlToOpen = new URL(`/?task=${taskId}`, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
