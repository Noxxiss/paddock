const webpush = require('web-push');
const { getDb } = require('./db');

let generatedKeys = null;

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@paddock.app';

  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  }

  if (!generatedKeys) {
    generatedKeys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails(subject, generatedKeys.publicKey, generatedKeys.privateKey);
  }

  return true;
}

function getVapidPublicKey() {
  if (process.env.VAPID_PUBLIC_KEY) return process.env.VAPID_PUBLIC_KEY;

  if (!generatedKeys) {
    generatedKeys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@paddock.app',
      generatedKeys.publicKey,
      generatedKeys.privateKey
    );
  }

  return generatedKeys.publicKey;
}

function parseSubscription(row) {
  return {
    endpoint: row.endpoint,
    keys: JSON.parse(row.keys),
  };
}

function removeStaleSubscription(endpoint) {
  try {
    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  } catch {
    // Best-effort cleanup
  }
}

function sendNotification(subscription, payload) {
  if (!configureVapid()) return Promise.resolve();

  return webpush
    .sendNotification(subscription, JSON.stringify(payload))
    .catch(err => {
      if (err && err.statusCode === 410) {
        removeStaleSubscription(subscription.endpoint);
      }
    });
}

function sendToUser(userId, payload) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?'
  ).all(userId);

  return Promise.allSettled(
    rows.map(row => sendNotification(parseSubscription(row), payload))
  );
}

function sendToFarm(farmId, payload, excludeUserId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ps.endpoint, ps.keys, ps.user_id
    FROM push_subscriptions ps
    JOIN users u ON u.id = ps.user_id
    WHERE u.farm_id = ?
  `).all(farmId);

  return Promise.allSettled(
    rows
      .filter(row => row.user_id !== excludeUserId)
      .map(row => sendNotification(parseSubscription(row), payload))
  );
}

function resetPushState() {
  generatedKeys = null;
}

module.exports = { configureVapid, getVapidPublicKey, sendToUser, sendToFarm, resetPushState };
