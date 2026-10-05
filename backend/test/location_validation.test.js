const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 4107;
const BASE = `http://localhost:${PORT}/api`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, body, token) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  return false;
}

let server;
let driver1Token, driver2Token, adminToken, bystanderToken;

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_STORE_MODE: process.env.DATA_STORE_MODE || 'memory',
      DRIVER_RESPONSE_TIMEOUT_MS: '15000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (d) => { output += d; });
  server.stderr.on('data', (d) => { output += d; });

  if (!(await waitForHealth())) throw new Error('Server failed to start:\n' + output);

  const login = async (email) => (await api('POST', '/auth/login', { email, password: 'password123' })).data.token;
  driver1Token = await login('driver1@uyirkappan.demo');
  driver2Token = await login('driver2@uyirkappan.demo');
  adminToken = await login('admin@uyirkappan.demo');
  bystanderToken = await login('bystander@uyirkappan.demo');
});

after(() => {
  if (server) server.kill();
});

test('Location Validation Suite', async (t) => {
  // Obtain ambulances to find assigned ambulance for driver1 (DRV0001 -> AMB0001)
  const ambListRes = await api('GET', '/ambulances');
  assert.equal(ambListRes.status, 200);
  const ambulances = ambListRes.data.ambulances || [];
  const amb1 = ambulances.find((a) => a.id === 'AMB0001' || a.ambulanceId === 'AMB0001') || ambulances[0];
  const targetAmbId = amb1.id || amb1.ambulanceId;

  await t.test('1. Valid coordinates and telemetry update succeeds (200 OK)', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 13.0827,
        longitude: 80.2707,
        speed: 42.5,
        heading: 180.0,
        accuracy: 8.5,
      },
      driver1Token
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.ambulance.currentLocation.latitude, 13.0827);
    assert.equal(res.data.ambulance.currentLocation.longitude, 80.2707);
  });

  await t.test('2. Latitude > 90 is rejected with 400 Bad Request', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 91.5,
        longitude: 80.2707,
      },
      driver1Token
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /latitude.*longitude/i);
  });

  await t.test('3. Latitude < -90 is rejected with 400 Bad Request', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: -90.001,
        longitude: 80.2707,
      },
      driver1Token
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  await t.test('4. Longitude > 180 is rejected with 400 Bad Request', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 13.0827,
        longitude: 180.1,
      },
      driver1Token
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  await t.test('5. Longitude < -180 is rejected with 400 Bad Request', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 13.0827,
        longitude: -180.5,
      },
      driver1Token
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  await t.test('6. Non-numeric or NaN coordinates are rejected with 400 Bad Request', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 'invalid',
        longitude: 80.2707,
      },
      driver1Token
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  await t.test('7. Far-future timestamp (> 5 min) is rejected with 400 Bad Request', async () => {
    const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: futureTime,
      },
      driver1Token
    );
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /future/i);
  });

  await t.test('8. Valid recent timestamp is accepted', async () => {
    const recentTime = new Date(Date.now() - 5000).toISOString();
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      {
        latitude: 13.0830,
        longitude: 80.2710,
        timestamp: recentTime,
        accuracy: 5.0,
      },
      driver1Token
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('9. Unauthenticated request is rejected with 401 Unauthorized', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      { latitude: 13.0827, longitude: 80.2707 }
    );
    assert.equal(res.status, 401);
  });

  await t.test('10. Non-driver role (BYSTANDER) is rejected with 403 Forbidden', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      { latitude: 13.0827, longitude: 80.2707 },
      bystanderToken
    );
    assert.equal(res.status, 403);
  });

  await t.test('11. Driver attempting to update another driver\'s ambulance is rejected with 403 Forbidden', async () => {
    // driver2 does not own AMB0001 (assigned to driver1)
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      { latitude: 13.0827, longitude: 80.2707 },
      driver2Token
    );
    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /assigned driver.*admin/i);
  });

  await t.test('12. Admin can update any ambulance location (200 OK)', async () => {
    const res = await api(
      'POST',
      `/ambulances/${targetAmbId}/location`,
      { latitude: 13.0850, longitude: 80.2750, accuracy: 12.0 },
      adminToken
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });
});
