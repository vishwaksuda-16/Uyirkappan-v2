const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const { signToken } = require('../src/utils/security');
const NotificationService = require('../src/services/notification.service');
const initSocketServer = require('../src/sockets/socket.server');

test('Phase 14 — Socket.IO Real-Time Contract Comprehensive Verification Suite', async (t) => {
  let app, server, ioServer, notificationService, port, serverUrl;
  let mockStore;

  // Setup isolated memory datastore and HTTP server
  mockStore = {
    users: new Map([
      ['user-bystander', { id: 'user-bystander', email: 'bystander@demo.test', role: 'BYSTANDER' }],
      ['user-driver-1', { id: 'user-driver-1', email: 'driver1@demo.test', role: 'DRIVER', ambulanceId: 'AMB-01' }],
      ['user-driver-2', { id: 'user-driver-2', email: 'driver2@demo.test', role: 'DRIVER', ambulanceId: 'AMB-02' }],
      ['user-staff-h01', { id: 'user-staff-h01', email: 'staff1@demo.test', role: 'HOSPITAL_STAFF', hospitalId: 'HOSP-01' }],
      ['user-staff-h02', { id: 'user-staff-h02', email: 'staff2@demo.test', role: 'HOSPITAL_STAFF', hospitalId: 'HOSP-02' }],
    ]),
    ambulances: new Map([
      ['AMB-01', { id: 'AMB-01', driverId: 'user-driver-1', status: 'AVAILABLE' }],
      ['AMB-02', { id: 'AMB-02', driverId: 'user-driver-2', status: 'AVAILABLE' }],
    ]),
    async findUserById(id) {
      return this.users.get(id) || null;
    },
    async getAmbulanceByDriverId(driverId) {
      for (const amb of this.ambulances.values()) {
        if (amb.driverId === driverId) return amb;
      }
      return null;
    },
  };

  app = express();
  server = http.createServer(app);
  ioServer = new Server(server, { cors: { origin: '*' } });
  notificationService = new NotificationService(ioServer, mockStore);

  initSocketServer(ioServer, {
    store: mockStore,
    ambulanceService: {
      async updateLocation(ambulanceId, payload, user) {
        notificationService.emitToRoom(
          `ambulance:${ambulanceId}`,
          'AMBULANCE_LOCATION_UPDATED',
          { ambulanceId, ...payload }
        );
      },
    },
  });

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  const createClient = (userId) => {
    const token = signToken({ sub: userId, role: mockStore.users.get(userId)?.role });
    return Client(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
  };

  t.after(async () => {
    ioServer.close();
    server.close();
  });

  await t.test('1. Authentication Handshake Contract: Validates token and rejects invalid auth', async () => {
    // 1.1 Valid connection succeeds
    const validClient = createClient('user-bystander');
    await new Promise((resolve, reject) => {
      validClient.on('connect', resolve);
      validClient.on('connect_error', reject);
    });
    assert.ok(validClient.connected, 'Authenticated client must connect');
    validClient.disconnect();

    // 1.2 Invalid token is rejected
    const invalidClient = Client(serverUrl, {
      auth: { token: 'invalid-garbage-token' },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    const err = await new Promise((resolve) => {
      invalidClient.on('connect_error', resolve);
    });
    assert.ok(err, 'Unauthenticated handshake must produce connect_error');
    assert.match(err.message, /Authentication failed/, 'Error message must specify auth failure');
    invalidClient.disconnect();
  });

  await t.test('2. Automatic Role-Scoped Room Assignment Contract', async () => {
    const driverClient = createClient('user-driver-1');
    const hospitalClient = createClient('user-staff-h01');

    await Promise.all([
      new Promise((res) => driverClient.on('connect', res)),
      new Promise((res) => hospitalClient.on('connect', res)),
    ]);

    // Send driver alert to driver:AMB-01
    const driverPromise = new Promise((resolve) => {
      driverClient.on('NEW_ASSIGNMENT', (data) => resolve(data));
    });

    notificationService.emitToRoom('driver:AMB-01', 'NEW_ASSIGNMENT', {
      assignmentId: 'ASN-101',
      requestId: 'REQ-101',
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
    });

    const receivedAssignment = await driverPromise;
    assert.equal(receivedAssignment.assignmentId, 'ASN-101');
    assert.equal(receivedAssignment.requestId, 'REQ-101');

    driverClient.disconnect();
    hospitalClient.disconnect();
  });

  await t.test('3. Hospital Scoped Isolation: Facility A does NOT receive Facility B events', async () => {
    const hospAClient = createClient('user-staff-h01'); // HOSP-01
    const hospBClient = createClient('user-staff-h02'); // HOSP-02

    await Promise.all([
      new Promise((res) => hospAClient.on('connect', res)),
      new Promise((res) => hospBClient.on('connect', res)),
    ]);

    let hospBReceived = false;
    hospBClient.on('EMERGENCY_CREATED', () => {
      hospBReceived = true;
    });

    const hospAPromise = new Promise((resolve) => {
      hospAClient.on('EMERGENCY_CREATED', (data) => resolve(data));
    });

    // Emit exclusively to hospital:HOSP-01
    notificationService.emitToRoom('hospital:HOSP-01', 'EMERGENCY_CREATED', {
      requestId: 'REQ-PRIVATE-A',
      destinationHospitalId: 'HOSP-01',
      status: 'SEARCHING',
    });

    const hospAData = await hospAPromise;
    assert.equal(hospAData.requestId, 'REQ-PRIVATE-A');

    // Give a short window to verify Hosp B did not get it
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(hospBReceived, false, 'Hospital B must NOT receive private events for Hospital A');

    hospAClient.disconnect();
    hospBClient.disconnect();
  });

  await t.test('4. Emergency Room Subscription and Broadcast Contract', async () => {
    const bystanderClient = createClient('user-bystander');
    const driverClient = createClient('user-driver-1');

    await Promise.all([
      new Promise((res) => bystanderClient.on('connect', res)),
      new Promise((res) => driverClient.on('connect', res)),
    ]);

    // Both join emergency:REQ-999
    bystanderClient.emit('join_emergency', 'REQ-999');
    driverClient.emit('join_emergency', { requestId: 'REQ-999' });

    // Wait for room join processing
    await new Promise((r) => setTimeout(r, 50));

    const bystanderStatusPromise = new Promise((resolve) => {
      bystanderClient.on('STATUS_UPDATED', resolve);
    });
    const driverStatusPromise = new Promise((resolve) => {
      driverClient.on('STATUS_UPDATED', resolve);
    });

    notificationService.emitToRoom('emergency:REQ-999', 'STATUS_UPDATED', {
      requestId: 'REQ-999',
      status: 'EN_ROUTE_TO_PATIENT',
    });

    const [bystanderRes, driverRes] = await Promise.all([bystanderStatusPromise, driverStatusPromise]);
    assert.equal(bystanderRes.status, 'EN_ROUTE_TO_PATIENT');
    assert.equal(driverRes.status, 'EN_ROUTE_TO_PATIENT');

    // Leave emergency room
    bystanderClient.emit('leave_emergency', 'REQ-999');
    await new Promise((r) => setTimeout(r, 50));

    let bystanderGotSecond = false;
    bystanderClient.on('STATUS_UPDATED', () => {
      bystanderGotSecond = true;
    });

    notificationService.emitToRoom('emergency:REQ-999', 'STATUS_UPDATED', {
      requestId: 'REQ-999',
      status: 'ARRIVED_AT_PATIENT',
    });

    await new Promise((r) => setTimeout(r, 80));
    assert.equal(bystanderGotSecond, false, 'Bystander must not receive events after leaving emergency room');

    bystanderClient.disconnect();
    driverClient.disconnect();
  });

  await t.test('5. Telemetry Provenance and Sequence Injection Contract', async () => {
    const bystanderClient = createClient('user-bystander');
    await new Promise((res) => bystanderClient.on('connect', res));
    bystanderClient.emit('join_emergency', 'REQ-TEL-1');
    await new Promise((r) => setTimeout(r, 50));

    const locPromise = new Promise((resolve) => {
      bystanderClient.on('AMBULANCE_LOCATION_UPDATED', resolve);
    });

    notificationService.emitToRoom('emergency:REQ-TEL-1', 'AMBULANCE_LOCATION_UPDATED', {
      requestId: 'REQ-TEL-1',
      ambulanceId: 'AMB-01',
      latitude: 13.0827,
      longitude: 80.2707,
      provider: 'real',
      isSimulated: false,
    });

    const locData = await locPromise;
    assert.equal(locData.ambulanceId, 'AMB-01');
    assert.equal(locData.provider, 'real');
    assert.equal(locData.isSimulated, false);
    assert.ok(locData.eventId, 'NotificationService must inject eventId');
    assert.ok(locData.sequenceNumber >= 1, 'NotificationService must inject sequential number');

    bystanderClient.disconnect();
  });

  await t.test('6. Cascading Fallback Real-Time Contract: RequestId preservation', async () => {
    const bystanderClient = createClient('user-bystander');
    const driver2Client = createClient('user-driver-2');

    await Promise.all([
      new Promise((res) => bystanderClient.on('connect', res)),
      new Promise((res) => driver2Client.on('connect', res)),
    ]);

    bystanderClient.emit('join_emergency', 'REQ-FALLBACK-1');
    await new Promise((r) => setTimeout(r, 50));

    const fallbackStartedPromise = new Promise((resolve) => {
      bystanderClient.on('FALLBACK_STARTED', resolve);
    });

    const driver2AssignmentPromise = new Promise((resolve) => {
      driver2Client.on('NEW_ASSIGNMENT', resolve);
    });

    // Simulate rejection of Amb-01 triggering fallback
    notificationService.emitToRoom('emergency:REQ-FALLBACK-1', 'FALLBACK_STARTED', {
      requestId: 'REQ-FALLBACK-1',
      failedAmbulanceId: 'AMB-01',
    });

    notificationService.emitToRoom('driver:AMB-02', 'NEW_ASSIGNMENT', {
      requestId: 'REQ-FALLBACK-1',
      assignmentId: 'ASN-FALLBACK-2',
      ambulanceId: 'AMB-02',
      attemptNumber: 2,
    });

    const fallbackStartedData = await fallbackStartedPromise;
    const driver2Data = await driver2AssignmentPromise;

    assert.equal(fallbackStartedData.requestId, 'REQ-FALLBACK-1');
    assert.equal(fallbackStartedData.failedAmbulanceId, 'AMB-01');

    assert.equal(driver2Data.requestId, 'REQ-FALLBACK-1', 'RequestId MUST be preserved during fallback');
    assert.equal(driver2Data.ambulanceId, 'AMB-02');
    assert.equal(driver2Data.attemptNumber, 2);

    bystanderClient.disconnect();
    driver2Client.disconnect();
  });
});
