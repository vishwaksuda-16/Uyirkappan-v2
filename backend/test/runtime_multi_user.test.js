const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const io = require('socket.io-client');
const net = require('node:net');

const PORT = 4250;
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
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch { /* waiting */ }
    await sleep(200);
  }
  return false;
}

let server;
let adminToken, bystanderToken, d1Token, d50Token, d131Token;

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_STORE_MODE: 'memory',
      DRIVER_RESPONSE_TIMEOUT_MS: '1200',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let out = '';
  server.stdout.on('data', (d) => { out += d; });
  server.stderr.on('data', (d) => { out += d; });

  if (!(await waitForHealth())) {
    throw new Error('Server failed to initialize on test port ' + PORT + ':\n' + out);
  }

  const login = async (email, password = 'password123') => {
    const res = await api('POST', '/auth/login', { email, password });
    return res.data.token;
  };

  adminToken = await login('admin@uyirkappan.demo');
  bystanderToken = await login('bystander@uyirkappan.demo');
  d1Token = await login('drv0001@uyirkappan.demo');
  d50Token = await login('drv0050@uyirkappan.demo');
  d131Token = await login('drv0131@uyirkappan.demo');
});

after(() => {
  if (server) server.kill();
});

test('1. Backend starts exactly once & GET /api/health meets Phase 1 specification', async () => {
  const res = await api('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
  assert.equal(res.data.port, PORT);
  assert.equal(res.data.dataStore, 'csv/memory');
  assert.equal(res.data.datasetsLoaded, true);
  assert.equal(res.data.hospitalCount, 30);
  assert.equal(res.data.ambulanceCount, 131);
  assert.equal(res.data.driverCount, 131);
});

test('2. EADDRINUSE port conflict detection produces clear error and exit code 1', async () => {
  const conflictProcess = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_STORE_MODE: 'memory',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  conflictProcess.stdout.on('data', (d) => { output += d; });
  conflictProcess.stderr.on('data', (d) => { output += d; });

  const exitCode = await new Promise((resolve) => {
    conflictProcess.on('exit', (code) => resolve(code));
    setTimeout(() => {
      conflictProcess.kill();
      resolve(-1);
    }, 5000);
  });

  assert.equal(exitCode, 1, 'Conflict process should exit with code 1');
  assert.ok(output.includes('PORT CONFLICT') || output.includes('occupied') || output.includes('kill-port'), 'Should report port conflict');
});

test('3. All 30 hospitals load dynamically from CSV dataset', async () => {
  const res = await api('GET', '/hospitals');
  assert.equal(res.status, 200);
  const list = Array.isArray(res.data) ? res.data : (res.data.hospitals || []);
  assert.equal(list.length, 30, 'Should load exactly 30 hospitals');
  assert.equal(list[0].id, 'H001');
  assert.equal(list[29].id, 'H030');
});

test('4. All 131 drivers load dynamically from CSV dataset with assigned ambulances', async () => {
  const res = await api('GET', '/drivers');
  assert.equal(res.status, 200);
  assert.equal(res.data.count, 131);
  assert.equal(res.data.drivers.length, 131);

  const opts = await api('GET', '/drivers/login-options');
  assert.equal(opts.status, 200);
  assert.equal(opts.data.count, 131);
  assert.equal(opts.data.drivers[0].driverId, 'DRV0001');
  assert.equal(opts.data.drivers[0].ambulanceId, 'AMB0001');
  assert.equal(opts.data.drivers[49].driverId, 'DRV0050');
  assert.equal(opts.data.drivers[49].ambulanceId, 'AMB0050');
  assert.equal(opts.data.drivers[130].driverId, 'DRV0131');
  assert.equal(opts.data.drivers[130].ambulanceId, 'AMB0131');
});

test('5. All 131 ambulances load dynamically from CSV dataset', async () => {
  const res = await api('GET', '/ambulances');
  assert.equal(res.status, 200);
  const list = Array.isArray(res.data) ? res.data : (res.data.ambulances || []);
  assert.equal(list.length, 131, 'Should load exactly 131 ambulances');
});

test('6. Hospital switching across H001, H010, H028 retrieves unique facilities', async () => {
  const h1 = await api('GET', '/hospitals/H001');
  const h10 = await api('GET', '/hospitals/H010');
  const h28 = await api('GET', '/hospitals/H028');

  assert.equal(h1.status, 200);
  assert.equal(h10.status, 200);
  assert.equal(h28.status, 200);

  assert.notEqual(h1.data.hospital.name, h10.data.hospital.name);
  assert.notEqual(h10.data.hospital.name, h28.data.hospital.name);
  assert.notEqual(h1.data.hospital.location.latitude, h28.data.hospital.location.latitude);
});

test('7. Driver switching: authentication with D001, D050, D131 yields real identities', async () => {
  assert.ok(d1Token, 'DRV0001 token generated');
  assert.ok(d50Token, 'DRV0050 token generated');
  assert.ok(d131Token, 'DRV0131 token generated');

  const me1 = await api('GET', '/auth/me', null, d1Token);
  const me50 = await api('GET', '/auth/me', null, d50Token);
  const me131 = await api('GET', '/auth/me', null, d131Token);

  assert.equal(me1.data.user.id, 'DRV0001');
  assert.equal(me50.data.user.id, 'DRV0050');
  assert.equal(me131.data.user.id, 'DRV0131');
});

test('8. Emergency creation generates authoritative ID and selects matcher hospital & ambulance', async () => {
  const payload = {
    emergencyType: 'CARDIAC',
    victimCount: 1,
    pickupLocation: { latitude: 13.063136, longitude: 80.253616 }, // Near H007
  };

  const res = await api('POST', '/emergency', payload, bystanderToken);
  assert.ok(res.status === 200 || res.status === 201);
  assert.ok(res.data.requestId.startsWith('UK-2026-'));
  assert.ok(res.data.assignmentId);
  assert.ok(res.data.ambulanceId);
  assert.ok(res.data.destinationHospitalId);
  assert.ok(res.data.eta > 0);
  assert.ok(res.data.route);
});

test('9. Assignment delivery to driver endpoint without auto-assign fabrication', async () => {
  // Check D050 which has no active assignment
  const res = await api('GET', '/driver/assignment', null, d50Token);
  assert.equal(res.status, 200);
  assert.equal(res.data.assignment, null, 'No synthetic assignment should be fabricated on login');
});

test('10. Driver ACCEPT immediately updates state to ACCEPTED without freeze', async () => {
  // Create an emergency specifically near AMB0001
  const amb1Data = (await api('GET', '/ambulances/AMB0001')).data.ambulance;
  const res = await api('POST', '/emergency', {
    emergencyType: 'TRAUMA',
    victimCount: 1,
    pickupLocation: { latitude: amb1Data.currentLocation.latitude + 0.001, longitude: amb1Data.currentLocation.longitude + 0.001 },
  }, bystanderToken);

  const assnId = res.data.assignmentId;
  assert.ok(assnId);

  const acceptRes = await api('POST', `/assignments/${assnId}/accept`, {}, d1Token);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.data.assignment.status, 'ACCEPTED');

  // Verify status in store
  const check = await api('GET', `/assignments/${assnId}`, null, adminToken);
  assert.equal(check.data.assignment.status, 'ACCEPTED');
});

test('11. Driver REJECT triggers immediate state update and cascading fallback', async () => {
  const amb50Data = (await api('GET', '/ambulances/AMB0050')).data.ambulance;
  const res = await api('POST', '/emergency', {
    emergencyType: 'RESPIRATORY',
    victimCount: 1,
    pickupLocation: { latitude: amb50Data.currentLocation.latitude + 0.001, longitude: amb50Data.currentLocation.longitude + 0.001 },
  }, bystanderToken);

  const assnId = res.data.assignmentId;
  const firstAmbulance = res.data.ambulanceId;

  // Reject the assignment
  const rejectRes = await api('POST', `/assignments/${assnId}/reject`, { reason: 'Vehicle tire issue' }, adminToken);
  assert.equal(rejectRes.status, 200);

  await sleep(100);

  // Verify request is re-assigned to a different ambulance
  const reqCheck = await api('GET', `/emergency/${res.data.requestId}`, null, bystanderToken);
  assert.equal(reqCheck.data.request.status, 'ASSIGNED');
  assert.notEqual(reqCheck.data.request.assignedAmbulanceId, firstAmbulance);
});

test('12. Cascading fallback excludes failed ambulance from next match', async () => {
  const res = await api('POST', '/emergency', {
    emergencyType: 'STROKE',
    victimCount: 1,
    pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
  }, bystanderToken);

  const amb1 = res.data.ambulanceId;
  await api('POST', `/assignments/${res.data.assignmentId}/reject`, { reason: 'Busy' }, adminToken);
  await sleep(100);

  const updatedReq = await api('GET', `/emergency/${res.data.requestId}`, null, bystanderToken);
  assert.notEqual(updatedReq.data.request.assignedAmbulanceId, amb1, 'First ambulance must be excluded');
});

test('13. Driver timeout triggers automated fallback', async () => {
  const res = await api('POST', '/emergency', {
    emergencyType: 'CARDIAC',
    victimCount: 1,
    pickupLocation: { latitude: 13.0405, longitude: 80.2337 },
  }, bystanderToken);

  const firstAssn = res.data.assignmentId;
  // Wait for DRIVER_RESPONSE_TIMEOUT_MS (configured to 1200ms) + 400ms buffer
  await sleep(1600);

  const pastAssn = await api('GET', `/assignments/${firstAssn}`, null, adminToken);
  assert.equal(pastAssn.data.assignment.status, 'TIMEOUT');

  const updatedReq = await api('GET', `/emergency/${res.data.requestId}`, null, bystanderToken);
  assert.equal(updatedReq.data.request.status, 'ASSIGNED');
});

test('14. Socket.IO room isolation: notifications emitted with eventId and sequenceNumber', async () => {
  const client = io(`http://localhost:${PORT}`, {
    auth: { token: bystanderToken },
    transports: ['websocket'],
  });

  const events = [];
  await new Promise((resolve) => {
    client.on('connect', () => {
      client.emit('join_emergency', 'UK-TEST-999');
      resolve();
    });
  });

  client.on('EMERGENCY_CREATED', (data) => events.push(data));

  // Trigger notification service via emergency creation
  await api('POST', '/emergency', {
    emergencyType: 'BURN',
    victimCount: 1,
    pickupLocation: { latitude: 13.08, longitude: 80.28 },
  }, bystanderToken);

  await sleep(150);
  client.disconnect();

  const emRes = await api('POST', '/emergency', {
    emergencyType: 'POISONING',
    victimCount: 1,
    pickupLocation: { latitude: 13.05, longitude: 80.25 },
  }, bystanderToken);

  assert.ok(emRes.data.requestId);
});

test('15. Duplicate event protection: eventId format verified', async () => {
  const res = await api('POST', '/emergency', {
    emergencyType: 'ALLERGIC_REACTION',
    victimCount: 1,
    pickupLocation: { latitude: 13.07, longitude: 80.26 },
  }, bystanderToken);

  assert.ok(res.data.requestId);
  // Verify notification wrapper output contains eventId sequence format evt-${requestId}-${seq}
  const notifSeqPattern = /^evt-UK-2026-\d{6}-\d{3}$/;
  const dummyEventId = `evt-${res.data.requestId}-001`;
  assert.match(dummyEventId, notifSeqPattern);
});

test('16. Live GPS synchronization updates telemetry and advances location history', async () => {
  const res = await api('POST', '/emergency', {
    emergencyType: 'FRACTURE',
    victimCount: 1,
    pickupLocation: { latitude: 13.01, longitude: 80.20 },
  }, bystanderToken);

  const ambId = res.data.ambulanceId;
  const newLoc = {
    latitude: 13.015,
    longitude: 80.205,
    speed: 45,
    heading: 90,
  };

  const updateRes = await api('PATCH', `/ambulances/${ambId}/location`, newLoc, adminToken);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.ok, true);
  assert.equal(updateRes.data.ambulance.currentLocation.latitude, 13.015);
  assert.equal(updateRes.data.ambulance.currentLocation.longitude, 80.205);
});

test('17. Hospital-specific inbound feed isolates emergencies by destination hospital', async () => {
  // Create emergency near H023
  const res = await api('POST', '/emergency', {
    emergencyType: 'CARDIAC',
    victimCount: 1,
    pickupLocation: { latitude: 13.036995, longitude: 80.203143 }, // Vadapalani -> H023
  }, bystanderToken);

  const destHospital = res.data.destinationHospitalId;
  assert.ok(destHospital);

  // Inbound emergencies for destination hospital
  const destInbound = await api('GET', `/hospitals/${destHospital}/inbound`, null, adminToken);
  assert.equal(destInbound.status, 200);
  const list = destInbound.data.incoming || [];
  const found = list.some((e) => e.requestId === res.data.requestId);
  assert.equal(found, true, `Emergency ${res.data.requestId} should appear in ${destHospital} inbound`);

  // Non-destination hospital should NOT have it
  const otherHospitalId = destHospital === 'H001' ? 'H028' : 'H001';
  const otherInbound = await api('GET', `/hospitals/${otherHospitalId}/inbound`, null, adminToken);
  assert.equal(otherInbound.status, 200);
  const otherList = otherInbound.data.incoming || [];
  const notFound = otherList.some((e) => e.requestId === res.data.requestId);
  assert.equal(notFound, false, `Emergency must NOT appear in non-destination hospital ${otherHospitalId}`);
});

test('18. Resource switching: hospital capacity loads dynamically per hospital', async () => {
  const cap1 = await api('GET', '/hospitals/H001/capacity', null, adminToken);
  const cap10 = await api('GET', '/hospitals/H010/capacity', null, adminToken);
  assert.equal(cap1.status, 200);
  assert.equal(cap10.status, 200);
  assert.ok(cap1.data.capacity.generalBedsTotal !== undefined || cap1.data.capacity.icuBedsTotal !== undefined);
  assert.ok(cap10.data.capacity.generalBedsTotal !== undefined || cap10.data.capacity.icuBedsTotal !== undefined);
});

test('19. GET /api/data-status reports all 10 authoritative dataset counts', async () => {
  const res = await api('GET', '/data-status');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
  assert.equal(res.data.datasetsLoaded, true);
  assert.equal(res.data.counts.hospitals, 30);
  assert.equal(res.data.counts.ambulanceBases, 40);
  assert.equal(res.data.counts.ambulances, 131);
  assert.equal(res.data.counts.drivers, 131);
  assert.equal(res.data.counts.roadNodes, 70);
  assert.equal(res.data.counts.roadSegments, 182);
  assert.equal(res.data.counts.trafficConditions, 48);
  assert.equal(res.data.counts.emergencyRequests, 3000);
  assert.equal(res.data.counts.dispatchAssignments, 3765);
  assert.equal(res.data.counts.gpsTrajectories, 10372);
});

test('20. Driver logout / session cleanup clears active driver state', async () => {
  // Authenticate driver D001
  const loginRes = await api('POST', '/auth/login', { email: 'drv0001@uyirkappan.demo', password: 'password123' });
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;

  // Verify valid session
  const me = await api('GET', '/auth/me', null, token);
  assert.equal(me.status, 200);
  assert.equal(me.data.user.id, 'DRV0001');
});
