const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');

const PORT = 4320;
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

test('MongoDB Socket Reconnect Persistence Suite', async (t) => {
  const serverProcess = spawn(process.execPath, ['server.js'], {
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

  const up = await waitForServer();
  assert.ok(up, 'Server must start on test port ' + PORT);

  let bystanderToken, adminToken, requestId, assignmentId;

  await t.test('1. Setup emergency and connect socket', async () => {
    const login = async (email) => {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });
      return (await res.json()).token;
    };

    bystanderToken = await login('bystander@uyirkappan.demo');
    adminToken = await login('admin@uyirkappan.demo');

    const emRes = await fetch(`${BASE}/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bystanderToken}` },
      body: JSON.stringify({
        emergencyType: 'CARDIAC',
        victimCount: 1,
        pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
      }),
    });
    const em = await emRes.json();
    requestId = em.requestId;
    assignmentId = em.assignmentId;
    assert.ok(requestId);
    assert.ok(assignmentId);
  });

  await t.test('2. Disconnect socket, update state in MongoDB, reconnect and reconcile', async () => {
    let socket = io(`http://localhost:${PORT}`, {
      auth: { token: bystanderToken },
      transports: ['websocket'],
    });

    await new Promise((r) => socket.once('connect', r));
    socket.emit('join_emergency', requestId);

    // Simulate network drop
    socket.disconnect();

    // Driver accepts while bystander was offline
    const acceptRes = await fetch(`${BASE}/assignments/${assignmentId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    const acceptData = await acceptRes.json();
    assert.equal(acceptData.success, true);

    // Reconnect socket
    socket = io(`http://localhost:${PORT}`, {
      auth: { token: bystanderToken },
      transports: ['websocket'],
    });
    await new Promise((r) => socket.once('connect', r));

    // Request authoritative snapshot from MongoDB
    const snapshotRes = await fetch(`${BASE}/emergency/${requestId}`, {
      headers: { Authorization: `Bearer ${bystanderToken}` },
    });
    const snapshot = await snapshotRes.json();
    assert.equal(snapshot.request.status, 'DRIVER_ACCEPTED');

    socket.disconnect();
  });

  await new Promise((resolve) => {
    serverProcess.on('exit', () => resolve());
    serverProcess.kill();
  });
});
