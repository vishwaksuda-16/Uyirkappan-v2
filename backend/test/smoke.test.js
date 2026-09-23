const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 4100;
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
let bystanderToken, driver1Token, driver2Token, staffToken, adminToken;

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_STORE_MODE: 'memory',
      DRIVER_RESPONSE_TIMEOUT_MS: '1500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (d) => { output += d; });
  server.stderr.on('data', (d) => { output += d; });

  if (!(await waitForHealth())) throw new Error('Server failed to start:\n' + output);

  const login = async (email) => (await api('POST', '/auth/login', { email, password: 'password123' })).data.token;
  bystanderToken = await login('bystander@uyirkappan.demo');
  driver1Token = await login('driver1@uyirkappan.demo');
  driver2Token = await login('driver2@uyirkappan.demo');
  staffToken = await login('staff@uyirkappan.demo');
  adminToken = await login('admin@uyirkappan.demo');
});

after(() => { if (server) server.kill(); });

test('GET /api/health', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.data.success, true);
  assert.ok(r.data.status === 'ok' || r.data.status === 'UP');
  assert.equal(r.data.matcher, 'ready');
  assert.equal(r.data.message, 'UyirKappan Backend Running');
  assert.equal(r.data.dataStoreMode, 'memory');
});

test('register + /auth/me', async () => {
  const email = `smoke${Date.now()}@uyirkappan.demo`;
  const r = await api('POST', '/auth/register', {
    name: 'Smoke Tester', email, phone: '9111111111', password: 'password123', role: 'BYSTANDER',
  });
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  const me = await api('GET', '/auth/me', null, r.data.token);
  assert.equal(me.data.success, true);
  assert.equal(me.data.user.email, email);
});

test('end-to-end: create -> reject -> fallback -> accept -> track -> complete', async () => {
  const created = await api('POST', '/emergency', {
    emergencyType: 'CARDIAC', victimCount: 1,
    pickupLocation: { latitude: 13.2128, longitude: 80.3180 },
  }, bystanderToken);
  assert.equal(created.data.success, true);
  assert.ok(created.data.requestId);
  assert.ok(['SEARCHING', 'ASSIGNED'].includes(created.data.status));
  const requestId = created.data.requestId;

  // driver1 holds attempt 1
  console.log('ASSIGNED AMBULANCE:', created.data.ambulanceId);
  const d1 = await api('GET', '/driver/assignment', null, driver1Token);
  console.log('DEBUG D1:', d1.data);
  assert.ok(d1.data.assignment);
  assert.equal(d1.data.assignment.status, 'PENDING');
  const a1 = d1.data.assignment.id;

  // reject -> fallback
  const rej = await api('POST', `/assignments/${a1}/reject`, {}, driver1Token);
  assert.equal(rej.data.success, true);

  // driver2 receives attempt 2
  let a2 = null;
  let ambId2 = null;
  for (let i = 0; i < 20 && !a2; i++) {
    const d2 = await api('GET', '/driver/assignment', null, driver2Token);
    if (d2.data.assignment && d2.data.assignment.attemptNumber === 2) {
      a2 = d2.data.assignment.id;
      ambId2 = d2.data.assignment.ambulanceId;
    } else await sleep(300);
  }
  assert.ok(a2, 'fallback assignment not received by driver2');

  // accept + double-accept protection
  const acc = await api('POST', `/assignments/${a2}/accept`, {}, driver2Token);
  assert.equal(acc.data.success, true);
  const acc2 = await api('POST', `/assignments/${a2}/accept`, {}, driver2Token);
  assert.equal(acc2.status, 409);

  // status lifecycle + invalid jump
  let u = await api('PATCH', `/assignments/${a2}/status`, { status: 'EN_ROUTE_TO_PATIENT' }, driver2Token);
  assert.equal(u.data.success, true);
  const bad = await api('PATCH', `/assignments/${a2}/status`, { status: 'PATIENT_ONBOARD' }, driver2Token);
  assert.equal(bad.status, 409);
  u = await api('PATCH', `/assignments/${a2}/status`, { status: 'ARRIVED_AT_PATIENT' }, driver2Token);
  assert.equal(u.data.success, true);

  // location -> ETA + tracking
  const loc = await api('POST', `/ambulances/${ambId2}/location`, {
    latitude: 13.06, longitude: 80.25, speed: 30, heading: 90,
  }, driver2Token);
  assert.equal(loc.data.success, true);
  assert.equal(typeof loc.data.eta, 'number');
  const tr = await api('GET', `/emergency/${requestId}/tracking`, null, bystanderToken);
  assert.equal(tr.data.success, true);
  assert.equal(tr.data.tracking.ambulanceId, ambId2);

  // hospital incoming + resource update
  const reqInfo = await api('GET', `/emergency/${requestId}`, null, bystanderToken);
  const hId = reqInfo.data.request.destinationHospitalId;
  const inc = await api('GET', `/hospitals/${hId}/incoming`, null, adminToken);
  assert.ok(inc.data.incoming.some((i) => i.requestId === requestId));
  const upd = await api('PATCH', `/hospitals/${hId}/resources`, { icuBeds: 4 }, adminToken);
  assert.equal(upd.data.success, true);
  assert.equal(upd.data.hospital.resources.icuBeds, 4);

  // completion
  u = await api('PATCH', `/assignments/${a2}/status`, { status: 'PATIENT_ONBOARD' }, driver2Token);
  assert.equal(u.data.success, true);
  u = await api('PATCH', `/assignments/${a2}/status`, { status: 'EN_ROUTE_TO_HOSPITAL' }, driver2Token);
  assert.equal(u.data.success, true);
  u = await api('PATCH', `/assignments/${a2}/status`, { status: 'ARRIVED_AT_HOSPITAL' }, driver2Token);
  assert.equal(u.data.success, true);

  const fin = await api('GET', `/emergency/${requestId}`, null, bystanderToken);
  assert.equal(fin.data.request.status, 'COMPLETED');
  const amb = await api('GET', `/ambulances/${ambId2}`, null, driver2Token);
  assert.equal(amb.data.ambulance.status, 'AVAILABLE');
  assert.deepEqual(fin.data.request.attempts.map((a) => a.response), ['REJECTED', 'ACCEPTED']);
});

test('timeout triggers fallback on the same requestId', async () => {
  const created = await api('POST', '/emergency', {
    emergencyType: 'ACCIDENT', victimCount: 1,
    pickupLocation: { latitude: 13.2128, longitude: 80.3180 },
  }, bystanderToken);
  const requestId = created.data.requestId;

  const d1 = await api('GET', '/driver/assignment', null, driver1Token);
  assert.ok(d1.data.assignment && d1.data.assignment.requestId === requestId,
    'driver1 should hold the first assignment for this request');
  assert.ok(d1.data.assignment.ambulanceId, 'Assignment must have an ambulance ID');

  await sleep(2600); // > DRIVER_RESPONSE_TIMEOUT_MS=1500

  const req = await api('GET', `/emergency/${requestId}`, null, bystanderToken);
  assert.ok(req.data.request.attempts.length >= 2, 'fallback should create a second attempt');
  assert.equal(req.data.request.attempts[0].response, 'TIMEOUT');
});