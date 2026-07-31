const assert = require('node:assert');
const { test, before, after } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close } = require('../src/db');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-pwa.db');

let request;

before(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  process.env.DB_PATH = TEST_DB_PATH;
  initialize(TEST_DB_PATH);
  request = supertest(app);
});

after(() => {
  close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

test('GET / returns index.html with manifest link and SW registration', async () => {
  const res = await request.get('/');
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['content-type'].includes('text/html'));
  assert.ok(res.text.includes('Paddock'));
  assert.ok(res.text.includes('rel="manifest"'), 'Should reference manifest');
  assert.ok(res.text.includes('serviceWorker.register'), 'Should register SW');
  assert.ok(res.text.includes('theme-color'), 'Should have theme-color meta');
});

test('manifest endpoint from HTML is valid', async () => {
  const htmlRes = await request.get('/');
  const match = htmlRes.text.match(/rel="manifest"\s+href="([^"]+)"/);
  assert.ok(match, 'Should find manifest link in HTML');
  const manifestUrl = match[1];

  const res = await request.get(manifestUrl);
  assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('application/json'));
  assert.ok(res.body.name);
  assert.strictEqual(res.body.name, 'Paddock');
  assert.strictEqual(res.body.short_name, 'Paddock');
  assert.strictEqual(res.body.display, 'standalone');
  assert.ok(res.body.start_url);
  assert.ok(Array.isArray(res.body.icons));
  assert.ok(res.body.icons.length >= 2);

  const icon192 = res.body.icons.find(i => i.sizes === '192x192');
  const icon512 = res.body.icons.find(i => i.sizes === '512x512');
  assert.ok(icon192, 'Should have 192x192 icon');
  assert.ok(icon512, 'Should have 512x512 icon');
  assert.ok(icon192.src);
  assert.ok(icon512.src);
});

test('GET /sw.js returns service worker', async () => {
  const res = await request.get('/sw.js');
  assert.strictEqual(res.status, 200);
  assert.ok(res.text.includes('self.addEventListener'));
  assert.ok(res.text.includes('install'));
  assert.ok(res.text.includes('fetch'));
  assert.ok(res.text.includes('push'));
});

test('GET /icon-192.png returns icon', async () => {
  const res = await request.get('/icon-192.png');
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['content-type'].includes('image/png'));
});

test('GET /icon-512.png returns icon', async () => {
  const res = await request.get('/icon-512.png');
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['content-type'].includes('image/png'));
});

test('GET /badge-72.png returns badge icon', async () => {
  const res = await request.get('/badge-72.png');
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['content-type'].includes('image/png'));
});

test('service worker contains app shell caching logic', () => {
  return request.get('/sw.js').then((res) => {
    assert.ok(res.text.includes('SHELL_CACHE'));
    assert.ok(res.text.includes('TILE_CACHE'));
    assert.ok(res.text.includes('cacheFirst'));
    assert.ok(res.text.includes('networkFirst'));
  });
});

test('service worker contains offline write queue', () => {
  return request.get('/sw.js').then((res) => {
    assert.ok(res.text.includes('addToQueue'));
    assert.ok(res.text.includes('retryQueue'));
    assert.ok(res.text.includes('RETRY_QUEUE'));
  });
});

test('service worker contains push notification handling', () => {
  return request.get('/sw.js').then((res) => {
    assert.ok(res.text.includes('notificationclick'));
    assert.ok(res.text.includes('showNotification'));
  });
});
