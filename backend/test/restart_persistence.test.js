const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 4310;
const BASE = `http://localhost:${PORT}/api`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {}
    await sleep(200);
  }
  return false;
}

function startServer() {
  return spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_STORE_MODE: 'mongodb',
      MONGODB_URI: 'mongodb://localhost:27017/uyirkappan',
      DRIVER_RESPONSE_TIMEOUT_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('MongoDB Restart Persistence Suite', async (t) => {
  let serverProcess = startServer();
  const up = await waitForServer();
  assert.ok(up, 'Server must start on test port ' + PORT);

  let createdRequestId, createdAssignmentId;

  await t.test('1. Create emergency and assignment in MongoDB mode', async () => {
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bystander@uyirkappan.demo', password: 'password123' }),
    });
    const { token } = await loginRes.json();
    assert.ok(token);

    const emRes = await fetch(`${BASE}/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        emergencyType: 'CARDIAC',
        victimCount: 1,
        pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
      }),
    });
    const em = await emRes.json();
    assert.equal(em.success, true);
    createdRequestId = em.requestId;
    createdAssignmentId = em.assignmentId;
    assert.ok(createdRequestId);
    assert.ok(createdAssignmentId);
  });

  await t.test('2. Shutdown server process', async () => {
    await new Promise((resolve) => {
      serverProcess.on('exit', () => resolve());
      serverProcess.kill();
    });
    assert.equal(serverProcess.killed, true);
  });

  await t.test('3. Restart server and verify pre-existing records survive', async () => {
    serverProcess = startServer();
    const restarted = await waitForServer();
    assert.ok(restarted, 'Server must restart successfully on test port ' + PORT);

    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@uyirkappan.demo', password: 'password123' }),
    });
    const { token } = await loginRes.json();
    assert.ok(token);

    // Verify the emergency persisted across the shutdown/restart
    const queryRes = await fetch(`${BASE}/emergency/${createdRequestId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const queried = await queryRes.json();
    assert.equal(queried.success, true);
    assert.equal(queried.request.requestId, createdRequestId);
    assert.equal(queried.request.status, 'ASSIGNED');
    assert.ok(queried.request.route, 'Route must persist across server restarts');

    // Verify counter synchronization: next emergency must have unique incremented ID
    const nextEmRes = await fetch(`${BASE}/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        emergencyType: 'TRAUMA',
        victimCount: 1,
        pickupLocation: { latitude: 13.04, longitude: 80.24 },
      }),
    });
    const nextEm = await nextEmRes.json();
    assert.equal(nextEm.success, true);
    assert.notEqual(nextEm.requestId, createdRequestId, 'New emergency must not reuse existing ID');

    // Clean shutdown
    await new Promise((resolve) => {
      serverProcess.on('exit', () => resolve());
      serverProcess.kill();
    });
  });
});
