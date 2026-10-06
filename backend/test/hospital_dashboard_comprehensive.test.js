const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

const { MemoryStore } = require('../src/data/memoryStore');
const buildApiRoutes = require('../src/app');
const initSocketServer = require('../src/sockets/socket.server');
const EtaService = require('../src/services/eta.service');
const DispatchService = require('../src/services/dispatch.service');
const NotificationService = require('../src/services/notification.service');
const FallbackService = require('../src/services/fallback.service');
const AssignmentService = require('../src/services/assignment.service');
const EmergencyService = require('../src/services/emergency.service');
const AmbulanceService = require('../src/services/ambulance.service');
const HospitalService = require('../src/services/hospital.service');

async function createTestServer() {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  const store = new MemoryStore();
  await store.seed();

  const ctx = {
    store,
    io,
    notificationService: new NotificationService(io, store),
    dbState: () => ({ connected: false, state: 'memory' }),
  };

  ctx.etaService = new EtaService(store);
  ctx.dispatchService = new DispatchService(store, ctx.etaService);
  ctx.fallbackService = new FallbackService(ctx);
  ctx.assignmentService = new AssignmentService(ctx);
  ctx.hospitalService = new HospitalService(ctx);
  ctx.emergencyService = new EmergencyService(ctx);
  ctx.ambulanceService = new AmbulanceService(ctx);

  initSocketServer(io, ctx);
  app.use('/api', buildApiRoutes(ctx));

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  const socketUrl = `http://localhost:${port}`;

  return { server, baseUrl, socketUrl, store, ctx, port };
}

async function request(baseUrl, method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

test('Phase 8 — Hospital Dashboard Comprehensive Test Suite', async (t) => {
  const env = await createTestServer();
  const { server, baseUrl, socketUrl, store } = env;

  let staffH001Token;
  let staffH002Token;
  let adminToken;
  let bystanderToken;
  let driverToken;

  t.after(() => {
    server.close();
  });

  await t.test('1. Authentication & RBAC setup for Hospital Staff', async () => {
    // Login Staff for H001
    const staffH001Res = await request(baseUrl, 'POST', '/auth/login', {
      email: 'staff.h001@uyirkappan.demo',
      password: 'password123',
    });
    assert.equal(staffH001Res.status, 200);
    assert.ok(staffH001Res.data.token);
    assert.equal(staffH001Res.data.user.role, 'HOSPITAL_STAFF');
    assert.equal(staffH001Res.data.user.hospitalId, 'H001');
    staffH001Token = staffH001Res.data.token;

    // Login Staff for H002
    const staffH002Res = await request(baseUrl, 'POST', '/auth/login', {
      email: 'staff.h002@uyirkappan.demo',
      password: 'password123',
    });
    assert.equal(staffH002Res.status, 200);
    assert.equal(staffH002Res.data.user.role, 'HOSPITAL_STAFF');
    assert.equal(staffH002Res.data.user.hospitalId, 'H002');
    staffH002Token = staffH002Res.data.token;

    // Login Admin
    const adminRes = await request(baseUrl, 'POST', '/auth/login', {
      email: 'admin@uyirkappan.demo',
      password: 'password123',
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.user.role, 'ADMIN');
    adminToken = adminRes.data.token;

    // Login Bystander
    const bystanderRes = await request(baseUrl, 'POST', '/auth/login', {
      email: 'bystander@uyirkappan.demo',
      password: 'password123',
    });
    assert.equal(bystanderRes.status, 200);
    bystanderToken = bystanderRes.data.token;

    // Login Driver
    const driverRes = await request(baseUrl, 'POST', '/auth/login', {
      email: 'drv0001@uyirkappan.demo',
      password: 'password123',
    });
    assert.equal(driverRes.status, 200);
    driverToken = driverRes.data.token;
  });

  await t.test('2. Unauthenticated and Unauthorized Role Rejection', async () => {
    // Missing token produces 401
    const noAuth = await request(baseUrl, 'GET', '/hospitals/H001/incoming');
    assert.equal(noAuth.status, 401, 'Missing token must produce 401');

    // Bystander role accessing hospital incoming produces 403
    const bystanderAccess = await request(baseUrl, 'GET', '/hospitals/H001/incoming', null, bystanderToken);
    assert.equal(bystanderAccess.status, 403, 'Bystander role must produce 403');

    // Driver role accessing hospital resources produces 403
    const driverAccess = await request(baseUrl, 'GET', '/hospitals/H001/resources', null, driverToken);
    assert.equal(driverAccess.status, 403, 'Driver role must produce 403');
  });

  await t.test('3. Hospital Data Isolation Enforcement', async () => {
    // Staff H001 can access H001 incoming emergencies
    const h1Access = await request(baseUrl, 'GET', '/hospitals/H001/incoming', null, staffH001Token);
    assert.equal(h1Access.status, 200, 'Staff H001 must access H001 incoming');

    // Staff H001 accessing H002 incoming emergencies is FORBIDDEN
    const h2CrossAccess = await request(baseUrl, 'GET', '/hospitals/H002/incoming', null, staffH001Token);
    assert.equal(h2CrossAccess.status, 403, 'Staff H001 must NOT access H002 incoming');

    // Staff H001 accessing H002 resources is FORBIDDEN
    const h2ResourceCross = await request(baseUrl, 'GET', '/hospitals/H002/resources', null, staffH001Token);
    assert.equal(h2ResourceCross.status, 403, 'Staff H001 must NOT access H002 resources');

    // Staff H001 attempting to update H002 resources is FORBIDDEN
    const h2UpdateCross = await request(baseUrl, 'PATCH', '/hospitals/H002/resources', { icuBeds: 5 }, staffH001Token);
    assert.equal(h2UpdateCross.status, 403, 'Staff H001 must NOT update H002 resources');

    // Admin can access H001 and H002 without restriction
    const adminH1 = await request(baseUrl, 'GET', '/hospitals/H001/incoming', null, adminToken);
    assert.equal(adminH1.status, 200);
    const adminH2 = await request(baseUrl, 'GET', '/hospitals/H002/incoming', null, adminToken);
    assert.equal(adminH2.status, 200);
  });

  await t.test('4. Hospital Resource Management & Boundary Validation', async () => {
    // Get H001 resources
    const getRes = await request(baseUrl, 'GET', '/hospitals/H001/resources', null, staffH001Token);
    assert.equal(getRes.status, 200);
    assert.ok(getRes.data.resources);
    assert.ok(typeof getRes.data.resources.generalBeds === 'number');
    assert.ok(typeof getRes.data.resources.icuBeds === 'number');
    assert.ok(typeof getRes.data.resources.ventilators === 'number');

    // Valid update
    const updateRes = await request(baseUrl, 'PATCH', '/hospitals/H001/resources', {
      generalBeds: 15,
      icuBeds: 5,
      ventilators: 3,
    }, staffH001Token);
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.hospital.resources.generalBeds, 15);
    assert.equal(updateRes.data.hospital.resources.icuBeds, 5);
    assert.equal(updateRes.data.hospital.resources.ventilators, 3);

    // Negative bed validation returns 400
    const negRes = await request(baseUrl, 'PATCH', '/hospitals/H001/resources', {
      icuBeds: -1,
    }, staffH001Token);
    assert.equal(negRes.status, 400, 'Negative beds must return 400');

    // Exceeding total capacity returns 400
    const exceedRes = await request(baseUrl, 'PATCH', '/hospitals/H001/resources', {
      generalBeds: 9999,
    }, staffH001Token);
    assert.equal(exceedRes.status, 400, 'Exceeding total capacity must return 400');
  });

  await t.test('5. Inbound Emergency Feed & Destination Hospital Isolation', async () => {
    // Create emergency destined for H001
    const emRes = await request(baseUrl, 'POST', '/emergency', {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
    }, bystanderToken);
    assert.equal(emRes.status, 201);
    const reqId = emRes.data.requestId;
    const destHospitalId = emRes.data.destinationHospitalId;
    assert.ok(reqId);
    assert.ok(destHospitalId);

    // Query destination hospital inbound feed
    const destToken = destHospitalId === 'H001' ? staffH001Token : staffH002Token;
    const inRes = await request(baseUrl, 'GET', `/hospitals/${destHospitalId}/incoming`, null, destToken);
    assert.equal(inRes.status, 200);
    const found = inRes.data.incoming.some((item) => item.requestId === reqId);
    assert.equal(found, true, `Emergency ${reqId} must appear in destination hospital incoming feed`);

    // Non-destination hospital must NOT have it
    const otherHId = destHospitalId === 'H001' ? 'H002' : 'H001';
    const otherToken = otherHId === 'H001' ? staffH001Token : staffH002Token;
    const otherInRes = await request(baseUrl, 'GET', `/hospitals/${otherHId}/incoming`, null, otherToken);
    assert.equal(otherInRes.status, 200);
    const notFound = otherInRes.data.incoming.some((item) => item.requestId === reqId);
    assert.equal(notFound, false, `Emergency ${reqId} must NOT appear in non-destination hospital feed`);
  });

  await t.test('6. Attempts Endpoint & Emergency Tracking Integration', async () => {
    // Query emergency details
    const activeCase = store.emergencyRequests[0];
    assert.ok(activeCase);

    const detailsRes = await request(baseUrl, 'GET', `/emergency/${activeCase.requestId}`, null, adminToken);
    assert.equal(detailsRes.status, 200);
    assert.ok(detailsRes.data.request.requestId);
    assert.ok(Array.isArray(detailsRes.data.request.attempts));
    assert.ok(detailsRes.data.request.destinationHospital.location.latitude);
    assert.ok(detailsRes.data.request.destinationHospital.location.longitude);

    // Query /emergency/:requestId/attempts endpoint
    const attemptsRes = await request(baseUrl, 'GET', `/emergency/${activeCase.requestId}/attempts`, null, adminToken);
    assert.equal(attemptsRes.status, 200);
    assert.ok(Array.isArray(attemptsRes.data.attempts));

    // Query /requests/:requestId/attempts alias endpoint
    const aliasAttemptsRes = await request(baseUrl, 'GET', `/requests/${activeCase.requestId}/attempts`, null, adminToken);
    assert.equal(aliasAttemptsRes.status, 200);
    assert.ok(Array.isArray(aliasAttemptsRes.data.attempts));

    // Query /emergency/:requestId/tracking endpoint
    const trackRes = await request(baseUrl, 'GET', `/emergency/${activeCase.requestId}/tracking`, null, adminToken);
    assert.equal(trackRes.status, 200);
    assert.ok(trackRes.data.tracking);
    assert.ok(trackRes.data.tracking.requestId);
    assert.ok(trackRes.data.tracking.destinationHospital.location.latitude);
    assert.ok(trackRes.data.tracking.destinationHospital.location.longitude);
  });

  await t.test('7. Telemetry Provenance in Location Updates', async () => {
    // Get ambulance
    const ambulances = await store.getAmbulances();
    const amb = ambulances[0];

    // Real device GPS update
    const locRes = await request(baseUrl, 'POST', `/ambulances/${amb.id}/location`, {
      latitude: 13.0800,
      longitude: 80.2700,
      speed: 50,
      heading: 180,
      accuracy: 5.2,
      provider: 'real',
      gpsSource: 'DEVICE',
      isSimulated: false,
    }, adminToken);
    assert.equal(locRes.status, 200);

    const updatedAmb = await store.getAmbulanceById(amb.id);
    assert.equal(updatedAmb.currentLocation.provider, 'real');
    assert.equal(updatedAmb.currentLocation.gpsSource, 'DEVICE');
    assert.equal(updatedAmb.currentLocation.isSimulated, false);
  });

  await t.test('8. Real-Time Socket.IO Synchronization & Room Delivery', async () => {
    const hospitalClient = Client(socketUrl, {
      auth: { token: staffH001Token },
      transports: ['websocket'],
    });

    await new Promise((resolve) => hospitalClient.once('connect', resolve));

    let resourceEventReceived = null;
    hospitalClient.on('HOSPITAL_RESOURCES_UPDATED', (data) => {
      resourceEventReceived = data;
    });

    // Update H001 resources via REST
    await request(baseUrl, 'PATCH', '/hospitals/H001/resources', {
      generalBeds: 20,
      icuBeds: 6,
      ventilators: 4,
    }, staffH001Token);

    // Wait for event
    for (let i = 0; i < 20; i++) {
      if (resourceEventReceived) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    assert.ok(resourceEventReceived, 'Hospital staff must receive HOSPITAL_RESOURCES_UPDATED via Socket.IO');
    assert.equal(resourceEventReceived.hospitalId, 'H001');
    assert.equal(resourceEventReceived.icuBeds, 6);

    hospitalClient.disconnect();
  });
});
