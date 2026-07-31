const assert = require('node:assert');
const { test, before, after, describe } = require('node:test');
const supertest = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { initialize, close, getDb } = require('../src/db');

const TEST_DB_PATH = path.join(__dirname, '..', 'paddock-test-auth.db');

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

describe('POST /api/auth/register', () => {
  test('creates a user and returns a token', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'manager@test.com', password: 'secret123', name: 'Test Manager' });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, 'manager@test.com');
    assert.strictEqual(res.body.user.name, 'Test Manager');
    assert.strictEqual(res.body.user.role, 'manager');
    assert.ok(res.body.user.id);
  });

  test('returns 409 for duplicate email', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'manager@test.com', password: 'secret123', name: 'Duplicate' });

    assert.strictEqual(res.status, 409);
  });

  test('returns 400 for missing fields', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'bad@test.com' });

    assert.strictEqual(res.status, 400);
  });
});

describe('POST /api/auth/login', () => {
  test('with valid credentials returns a token', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'secret123' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, 'manager@test.com');
  });

  test('with invalid password returns 401', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'wrongpassword' });

    assert.strictEqual(res.status, 401);
  });

  test('with unknown email returns 401', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'unknown@test.com', password: 'secret123' });

    assert.strictEqual(res.status, 401);
  });
});

describe('Protected routes', () => {
  test('return 401 without a token', async () => {
    const res = await request.get('/api/farms');
    assert.strictEqual(res.status, 401);
  });

  test('return 401 with invalid token', async () => {
    const res = await request
      .get('/api/farms')
      .set('Authorization', 'Bearer invalid-token');

    assert.strictEqual(res.status, 401);
  });

  test('return 200 with valid token', async () => {
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'secret123' });

    const token = loginRes.body.token;

    const res = await request
      .get('/api/farms')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.farm);
    assert.strictEqual(res.body.farm.name, 'My Farm');
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.email, 'manager@test.com');
  });
});
