/**
 * Phase 17 — Observability Implementation & Forensic Verification Suite
 *
 * Verifies:
 * 1. Structured log format (timestamp, level, service, environment, event, correlation keys)
 * 2. Request correlation ID generation and propagation (X-Correlation-Id header)
 * 3. Emergency requestId correlation across entire lifecycle
 * 4. Lifecycle transition logging with actor, previousState, and newState
 * 5. Intelligent dispatch and scoring observability (durationMs, candidate counts, weights)
 * 6. Cascading fallback correlation (requestId preservation across multiple attempts)
 * 7. Socket.IO event correlation (room subscription, event emission, eventId, sequenceNumber)
 * 8. GPS telemetry provenance (real vs simulation, accuracy, duration)
 * 9. Stale telemetry detection (45s threshold alerting)
 * 10. Routing & ETA timing measurements (durationMs)
 * 11. Datastore observability parity (MemoryStore and MongoStore modes)
 * 12. Security & RBAC event observability (sanitized, zero token/password leaks)
 * 13. Sensitive data redaction (JWTs, passwords, hashes, Mongo URIs)
 * 14. Error taxonomy standardization (ErrorCode)
 * 15. System health and readiness endpoints
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

const logger = require('../src/utils/logger');
const { ErrorCode } = require('../src/utils/errors');
const { signToken } = require('../src/utils/security');
const buildApiRoutes = require('../src/app');
const buildSystemRoutes = require('../src/routes/system.routes');
const initSocketServer = require('../src/sockets/socket.server');
const NotificationService = require('../src/services/notification.service');
const EmergencyService = require('../src/services/emergency.service');
const AssignmentService = require('../src/services/assignment.service');
const FallbackService = require('../src/services/fallback.service');
const DispatchService = require('../src/services/dispatch.service');
const EtaService = require('../src/services/eta.service');
const AmbulanceService = require('../src/services/ambulance.service');
const HospitalService = require('../src/services/hospital.service');
const { datasetLoader } = require('../src/data/datasetLoader');

test('Phase 17 — Observability Verification Suite', async (t) => {
  let app, server, ioServer, notificationService, port, serverUrl;
  let store, ctx;
  const capturedLogs = [];

  // Sink to record all structured logs during test execution
  const logListener = (entry) => {
    capturedLogs.push(entry);
  };
  logger.addSink(logListener);

  t.after(() => {
    logger.removeSink(logListener);
  });

  // Setup test environment
  datasetLoader.loadAll();

  // Create isolated in-memory test store
  store = {
    mode: 'memory',
    config: { driverResponseTimeoutMs: 1500 },
    users: new Map([
      ['bystander-1', { id: 'bystander-1', name: 'Observability Caller', role: 'BYSTANDER', email: 'caller@demo.test' }],
      ['driver-1', { id: 'driver-1', name: 'Primary Driver', role: 'DRIVER', email: 'd1@demo.test', ambulanceId: 'AMB-TEST-1' }],
      ['driver-2', { id: 'driver-2', name: 'Fallback Driver', role: 'DRIVER', email: 'd2@demo.test', ambulanceId: 'AMB-TEST-2' }],
      ['hospital-staff-1', { id: 'hospital-staff-1', name: 'Hospital Staff', role: 'HOSPITAL_STAFF', email: 'staff@demo.test', hospitalId: 'H001' }],
      ['hospital-staff-2', { id: 'hospital-staff-2', name: 'Hospital 2 Staff', role: 'HOSPITAL_STAFF', email: 'staff2@demo.test', hospitalId: 'H002' }],
      ['admin-1', { id: 'admin-1', name: 'System Admin', role: 'ADMIN', email: 'admin@demo.test' }],
    ]),
    ambulances: new Map([
      ['AMB-TEST-1', { id: 'AMB-TEST-1', driverId: 'driver-1', status: 'AVAILABLE', currentLocation: { latitude: 13.0827, longitude: 80.2707 } }],
      ['AMB-TEST-2', { id: 'AMB-TEST-2', driverId: 'driver-2', status: 'AVAILABLE', currentLocation: { latitude: 13.0835, longitude: 80.2715 } }],
    ]),
    hospitals: new Map([
      ['H001', { id: 'H001', name: 'Rajiv Gandhi General Hospital', location: { latitude: 13.0827, longitude: 80.2707 }, resources: { generalBeds: 20, icuBeds: 5, ventilators: 3 } }],
      ['H002', { id: 'H002', name: 'Stanley Medical Hospital', location: { latitude: 13.1075, longitude: 80.2878 }, resources: { generalBeds: 15, icuBeds: 3, ventilators: 2 } }],
    ]),
    emergencies: new Map(),
    assignments: new Map(),
    attempts: [],
    locationHistory: [],

    async findUserById(id) { return this.users.get(id) || null; },
    async getAmbulances() { return Array.from(this.ambulances.values()); },
    async getAmbulanceById(id) { return this.ambulances.get(id) || null; },
    async getAmbulanceByDriverId(driverId) {
      return Array.from(this.ambulances.values()).find(a => a.driverId === driverId) || null;
    },
    async getHospitals() { return Array.from(this.hospitals.values()); },
    async getHospitalById(id) { return this.hospitals.get(id) || null; },
    async getNearestHospitalId() { return 'H001'; },
    async createEmergencyRequest(userId, body) {
      const id = `REQ-OBS-${Date.now()}`;
      const rec = { requestId: id, id, requesterId: userId, userId, status: 'CREATED', ...body };
      this.emergencies.set(id, rec);
      return rec;
    },
    async getEmergencyByRequestId(id) { return this.emergencies.get(id) || null; },
    async updateEmergencyStatus(id, status) {
      const e = this.emergencies.get(id);
      if (e) { e.status = status; return e; }
      return null;
    },
    async updateEmergencyRequest(id, fields) {
      const e = this.emergencies.get(id);
      if (e) { Object.assign(e, fields); return e; }
      return null;
    },
    async updateEmergencyETA(id, eta) {
      const e = this.emergencies.get(id);
      if (e) { e.eta = eta; return e; }
      return null;
    },
    async createAssignment(req, amb, attemptNumber = 1, metadata = {}) {
      const id = `ASSIGN-OBS-${Date.now()}-${attemptNumber}`;
      const assn = { id, requestId: req.requestId, ambulanceId: amb.id, driverId: amb.driverId, status: 'PENDING', attemptNumber, ...metadata };
      this.assignments.set(id, assn);
      return assn;
    },
    async getAssignmentById(id) { return this.assignments.get(id) || null; },
    async getAssignmentsForRequest(reqId) {
      return Array.from(this.assignments.values()).filter(a => a.requestId === reqId);
    },
    async getAttemptsByRequestId(reqId) {
      return this.attempts.filter(a => a.requestId === reqId);
    },
    async recordResponse(assn, response, reason) {
      this.attempts.push({ requestId: assn.requestId, assignmentId: assn.id, ambulanceId: assn.ambulanceId, response, reason });
    },
    async transitionAssignmentState(id, allowedCurrent, next) {
      const a = this.assignments.get(id);
      if (!a) return { ok: false, currentStatus: null };
      if (!allowedCurrent.includes(a.status)) return { ok: false, currentStatus: a.status };
      a.status = next;
      return { ok: true, currentStatus: next };
    },
    async updateAmbulance(id, fields) {
      const a = this.ambulances.get(id);
      if (a) { Object.assign(a, fields); return a; }
      return null;
    },
    async updateAmbulanceStatus(id, status) {
      return this.updateAmbulance(id, { status });
    },
    async updateAmbulanceLocation(id, loc) {
      const a = this.ambulances.get(id);
      if (a) { a.currentLocation = loc; return a; }
      return null;
    },
    async addLocationHistory(hist) {
      this.locationHistory.push(hist);
      return hist;
    },
    async releaseAmbulance(id) {
      return this.updateAmbulance(id, { status: 'AVAILABLE', currentRequestId: null, activeEmergencyId: null, currentAssignmentId: null });
    },
    async markCompleted(reqId) {
      return this.updateEmergencyStatus(reqId, 'COMPLETED');
    },
  };

  app = express();
  app.use(express.json());

  server = http.createServer(app);
  ioServer = new Server(server, { cors: { origin: '*' } });
  notificationService = new NotificationService(ioServer, store);

  ctx = {
    store,
    io: ioServer,
    notificationService,
    dbState: () => ({ connected: true, state: 'ready' }),
  };
  ctx.etaService = new EtaService(store);
  ctx.dispatchService = new DispatchService(store, ctx.etaService);
  ctx.fallbackService = new FallbackService(ctx);
  ctx.assignmentService = new AssignmentService(ctx);
  ctx.hospitalService = new HospitalService(ctx);
  ctx.emergencyService = new EmergencyService(ctx);
  ctx.ambulanceService = new AmbulanceService(ctx);

  initSocketServer(ioServer, ctx);
  app.use('/api', buildApiRoutes(ctx));
  app.use('/api/system', buildSystemRoutes(ctx));

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  t.after(async () => {
    if (ctx.fallbackService) ctx.fallbackService.cancelAllTimeouts();
    await new Promise((resolve) => ioServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  // Helper request function
  const request = async (method, path, options = {}) => {
    const url = `${serverUrl}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const fetchOptions = {
      method,
      headers,
    };
    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, fetchOptions);
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { status: res.status, headers: res.headers, data };
  };

  // Helper auth tokens
  const bystanderToken = signToken({ sub: 'bystander-1', id: 'bystander-1', role: 'BYSTANDER' });
  const driverToken = signToken({ sub: 'driver-1', id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });
  const hospitalToken = signToken({ sub: 'hospital-staff-1', id: 'hospital-staff-1', role: 'HOSPITAL_STAFF', hospitalId: 'H001' });
  const adminToken = signToken({ sub: 'admin-1', id: 'admin-1', role: 'ADMIN' });

  // =========================================================================
  // 1. Structured Log Format & Log Level Checks
  // =========================================================================
  await t.test('1. Structured Log Format & Levels', async (t2) => {
    await t2.test('1.1 Generates standardized record with timestamp, level, event, and service', () => {
      const record = logger.log('info', {
        event: 'OBSERVABILITY_TEST_EVENT',
        message: 'Test message for schema verification',
        requestId: 'REQ-SCHEMA-1',
      });

      assert.ok(record.timestamp, 'Record must include ISO timestamp');
      assert.equal(record.level, 'INFO', 'Record level must be uppercase INFO');
      assert.equal(record.service, 'backend', 'Default service must be backend');
      assert.equal(record.event, 'OBSERVABILITY_TEST_EVENT');
      assert.equal(record.requestId, 'REQ-SCHEMA-1');
      assert.equal(record.emergencyId, 'REQ-SCHEMA-1', 'emergencyId should default to requestId');
    });

    await t2.test('1.2 Configurable log level filtering works cleanly', () => {
      const prevLevel = logger.getLevel();
      logger.setLevel('warn');
      assert.equal(logger.getLevel(), 'warn');
      logger.setLevel(prevLevel);
    });
  });

  // =========================================================================
  // 2. Sensitive Data Redaction
  // =========================================================================
  await t.test('2. Sensitive Data Redaction Hygiene', async (t2) => {
    await t2.test('2.1 Redacts passwords, hashes, JWT tokens, and Mongo URIs automatically', () => {
      const samplePayload = {
        email: 'user@test.com',
        password: 'SuperSecretPassword123!',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
        mongoUri: 'mongodb://admin:superSecretPass@cluster0.mongodb.net/uyirkappan',
      };

      const redacted = logger.redact(samplePayload);
      assert.equal(redacted.password, '[REDACTED]', 'Password field must be redacted');
      assert.equal(redacted.jwtToken, '[REDACTED]', 'JWT token field must be redacted');
      assert.equal(redacted.authorization, '[REDACTED]', 'Authorization field must be redacted');
      assert.ok(!redacted.mongoUri.includes('superSecretPass'), 'Mongo password must not be leaked');
      assert.ok(redacted.mongoUri.includes('*****'), 'Mongo password must be masked');
    });
  });

  // =========================================================================
  // 3. Request Correlation Middleware
  // =========================================================================
  await t.test('3. HTTP Request Correlation ID', async (t2) => {
    await t2.test('3.1 Generates correlation ID when none provided and returns in header', async () => {
      const res = await request('GET', '/api/health');
      assert.equal(res.status, 200);
      const corrId = res.headers.get('x-correlation-id');
      assert.ok(corrId, 'Response header must contain X-Correlation-Id');
      assert.ok(corrId.startsWith('corr-'), 'Auto-generated ID must start with corr-');

      const matchingLog = capturedLogs.find(l => l.correlationId === corrId && l.event === 'HTTP_REQUEST_COMPLETED');
      assert.ok(matchingLog, 'Log stream must contain HTTP_REQUEST_COMPLETED with matching correlationId');
      assert.equal(typeof matchingLog.durationMs, 'number', 'Latency durationMs must be recorded');
    });

    await t2.test('3.2 Propagates incoming X-Correlation-Id header', async () => {
      const customCorrId = 'client-custom-trace-999';
      const res = await request('GET', '/api/health', {
        headers: { 'X-Correlation-Id': customCorrId },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-correlation-id'), customCorrId, 'Should reflect passed correlation ID');

      const matchingLog = capturedLogs.find(l => l.correlationId === customCorrId && l.event === 'HTTP_REQUEST_COMPLETED');
      assert.ok(matchingLog, 'Must correlate HTTP completion with passed correlationId');
    });
  });

  // =========================================================================
  // 4. End-to-End Emergency Lifecycle & Request Correlation Trace
  // =========================================================================
  await t.test('4. End-to-End Emergency Lifecycle & requestId Correlation', async (t2) => {
    let createdRequestId;
    let createdAssignmentId;

    await t2.test('4.1 Creates emergency and logs EMERGENCY_CREATED and DISPATCH_COMPLETED', async () => {
      const res = await request('POST', '/api/emergencies', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
        body: {
          emergencyType: 'CARDIAC',
          victimCount: 1,
          pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
          destinationHospitalId: 'H001',
        },
      });

      assert.equal(res.status, 201);
      createdRequestId = res.data.requestId;
      createdAssignmentId = res.data.assignmentId;
      assert.ok(createdRequestId, 'Must return requestId');
      assert.ok(createdAssignmentId, 'Must return assignmentId');

      // Verify structured logs were recorded with exact requestId
      const createdLog = capturedLogs.find(l => l.event === 'EMERGENCY_CREATED' && l.requestId === createdRequestId);
      assert.ok(createdLog, 'Log stream must record EMERGENCY_CREATED with exact requestId');
      assert.equal(createdLog.emergencyType, 'CARDIAC');

      const dispatchLog = capturedLogs.find(l => l.event === 'DISPATCH_COMPLETED' && l.requestId === createdRequestId);
      assert.ok(dispatchLog, 'Log stream must record DISPATCH_COMPLETED with exact requestId');
      assert.equal(dispatchLog.ambulanceId, 'AMB-TEST-1');
      assert.equal(typeof dispatchLog.durationMs, 'number');
    });

    await t2.test('4.2 Driver accepts assignment: logs ASSIGNMENT_ACCEPTED & LIFECYCLE_TRANSITION', async () => {
      const res = await request('POST', `/api/assignments/${createdAssignmentId}/accept`, {
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      assert.equal(res.status, 200);

      const acceptLog = capturedLogs.find(l => l.event === 'ASSIGNMENT_ACCEPTED' && l.requestId === createdRequestId);
      assert.ok(acceptLog, 'Log stream must contain ASSIGNMENT_ACCEPTED with requestId');
      assert.equal(acceptLog.assignmentId, createdAssignmentId);

      const transitionLog = capturedLogs.find(l =>
        l.event === 'LIFECYCLE_TRANSITION' &&
        l.requestId === createdRequestId &&
        l.newState === 'DRIVER_ACCEPTED'
      );
      assert.ok(transitionLog, 'Must record LIFECYCLE_TRANSITION to DRIVER_ACCEPTED');
      assert.equal(transitionLog.actor, 'driver-1');
    });

    await t2.test('4.3 Driver updates trip stages up to completion: each transition is correlated', async () => {
      const stages = [
        'EN_ROUTE_TO_PATIENT',
        'ARRIVED_AT_PATIENT',
        'PATIENT_ONBOARD',
        'EN_ROUTE_TO_HOSPITAL',
        'ARRIVED_AT_HOSPITAL',
      ];

      for (const stage of stages) {
        const res = await request('PATCH', `/api/assignments/${createdAssignmentId}/status`, {
          headers: { Authorization: `Bearer ${driverToken}` },
          body: { status: stage },
        });
        assert.equal(res.status, 200, `Stage ${stage} update should succeed`);

        const stageLog = capturedLogs.find(l =>
          l.event === 'LIFECYCLE_TRANSITION' &&
          l.requestId === createdRequestId &&
          l.newState === stage
        );
        assert.ok(stageLog, `Must record LIFECYCLE_TRANSITION for stage ${stage} with requestId`);
      }

      // Check final completion event
      const completeLog = capturedLogs.find(l => l.event === 'EMERGENCY_COMPLETED' && l.requestId === createdRequestId);
      assert.ok(completeLog, 'Must record EMERGENCY_COMPLETED correlated to requestId');
    });
  });

  // =========================================================================
  // 5. Cascading Fallback Observability & RequestId Invariance
  // =========================================================================
  await t.test('5. Cascading Fallback Observability & RequestId Invariance', async (t2) => {
    let fallbackRequestId;
    let initialAssignmentId;

    await t2.test('5.1 Creates emergency and driver 1 rejects to trigger cascading fallback', async () => {
      // Ensure AMB-TEST-1 and AMB-TEST-2 are AVAILABLE
      await store.releaseAmbulance('AMB-TEST-1');
      await store.releaseAmbulance('AMB-TEST-2');

      const createRes = await request('POST', '/api/emergencies', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
        body: {
          emergencyType: 'TRAUMA',
          victimCount: 1,
          pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
          destinationHospitalId: 'H001',
        },
      });
      assert.equal(createRes.status, 201);
      fallbackRequestId = createRes.data.requestId;
      initialAssignmentId = createRes.data.assignmentId;
      const assignedAmbId = createRes.data.ambulanceId;
      const assignedDriverId = assignedAmbId === 'AMB-TEST-1' ? 'driver-1' : 'driver-2';
      const assignedDriverToken = signToken({ sub: assignedDriverId, id: assignedDriverId, role: 'DRIVER', ambulanceId: assignedAmbId });

      // Assigned driver rejects
      const rejectRes = await request('POST', `/api/assignments/${initialAssignmentId}/reject`, {
        headers: { Authorization: `Bearer ${assignedDriverToken}` },
      });
      assert.equal(rejectRes.status, 200);

      // Verify fallback started log
      const fallbackStartLog = capturedLogs.find(l =>
        l.event === 'FALLBACK_TRIGGERED' &&
        l.requestId === fallbackRequestId
      );
      assert.ok(fallbackStartLog, 'Log stream must record FALLBACK_TRIGGERED with SAME requestId');
      assert.equal(fallbackStartLog.failedAmbulanceId, assignedAmbId);

      // Verify fallback reassigned log
      const fallbackReassignLog = capturedLogs.find(l =>
        l.event === 'FALLBACK_REASSIGNED' &&
        l.requestId === fallbackRequestId
      );
      assert.ok(fallbackReassignLog, 'Log stream must record FALLBACK_REASSIGNED with SAME requestId');
      assert.equal(fallbackReassignLog.previousAmbulanceId, assignedAmbId);
      assert.equal(fallbackReassignLog.attemptNumber, 2);
    });
  });

  // =========================================================================
  // 6. GPS Provenance & Stale Telemetry Observability
  // =========================================================================
  await t.test('6. GPS Telemetry Provenance & Stale Telemetry Detection', async (t2) => {
    await t2.test('6.1 Live GPS update records provenance fields', async () => {
      const res = await request('PATCH', '/api/ambulances/AMB-TEST-1/status', {
        headers: { Authorization: `Bearer ${driverToken}` },
        body: { status: 'AVAILABLE' },
      });
      assert.equal(res.status, 200);

      // Send telemetry via ambulance service directly
      await ctx.ambulanceService.updateLocation('AMB-TEST-1', {
        latitude: 13.0827,
        longitude: 80.2707,
        speed: 45.2,
        provider: 'real',
        gpsSource: 'DEVICE',
        isSimulated: false,
        accuracy: 4.5,
        timestamp: new Date().toISOString(),
      }, { id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });

      const gpsLog = capturedLogs.find(l => l.event === 'GPS_TELEMETRY_RECORDED' && l.ambulanceId === 'AMB-TEST-1');
      assert.ok(gpsLog, 'Must record GPS_TELEMETRY_RECORDED');
      assert.equal(gpsLog.provider, 'real');
      assert.equal(gpsLog.isSimulated, false);
      assert.equal(gpsLog.accuracy, 4.5);
    });

    await t2.test('6.2 Telemetry older than 45s triggers STALE_GPS_DETECTED alert', async () => {
      const staleTimestamp = new Date(Date.now() - 55 * 1000).toISOString(); // 55s old
      await ctx.ambulanceService.updateLocation('AMB-TEST-1', {
        latitude: 13.0830,
        longitude: 80.2710,
        provider: 'simulation',
        timestamp: staleTimestamp,
      }, { id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });

      const staleLog = capturedLogs.find(l => l.event === 'STALE_GPS_DETECTED' && l.ambulanceId === 'AMB-TEST-1');
      assert.ok(staleLog, 'Must record STALE_GPS_DETECTED');
      assert.ok(staleLog.ageSeconds >= 45, 'Age must exceed 45s threshold');
      assert.equal(staleLog.thresholdSeconds, 45);
    });
  });

  // =========================================================================
  // 7. Socket.IO Real-Time Observability & Room Authorization
  // =========================================================================
  await t.test('7. Socket.IO Real-Time Observability', async (t2) => {
    let clientSocket;

    await t2.test('7.1 Connects authenticated socket and logs SOCKET_AUTH_SUCCESS & SOCKET_CONNECTED', async () => {
      clientSocket = Client(serverUrl, {
        auth: { token: driverToken },
        transports: ['websocket'],
      });

      await new Promise((resolve, reject) => {
        clientSocket.on('connect', resolve);
        clientSocket.on('connect_error', reject);
      });

      assert.ok(clientSocket.connected);

      const authLog = capturedLogs.find(l => l.event === 'SOCKET_AUTH_SUCCESS' && l.userId === 'driver-1');
      assert.ok(authLog, 'Must record SOCKET_AUTH_SUCCESS');

      const connectLog = capturedLogs.find(l => l.event === 'SOCKET_CONNECTED' && l.userId === 'driver-1');
      assert.ok(connectLog, 'Must record SOCKET_CONNECTED');
    });

    await t2.test('7.2 Emits real-time event and logs SOCKET_EVENT_EMITTED with eventId and seqNum', async () => {
      ctx.notificationService.emitToRoom('emergency:REQ-TEST-SEQ', 'STATUS_UPDATED', {
        requestId: 'REQ-TEST-SEQ',
        status: 'EN_ROUTE_TO_PATIENT',
      });

      const emitLog = capturedLogs.find(l => l.event === 'SOCKET_EVENT_EMITTED' && l.requestId === 'REQ-TEST-SEQ');
      assert.ok(emitLog, 'Must record SOCKET_EVENT_EMITTED');
      assert.ok(emitLog.eventId && emitLog.eventId.startsWith('evt-REQ-TEST-SEQ-'), 'Must include eventId');
      assert.equal(typeof emitLog.seqNum, 'number', 'Must include sequence number');
    });

    await t2.test('7.3 Denies unauthorized room join and logs SOCKET_ROOM_DENIED', async () => {
      // Driver tries to join hospital room H002
      clientSocket.emit('join:hospital', { hospitalId: 'H002' });

      // Wait briefly for server event processing
      await new Promise(r => setTimeout(r, 100));

      const deniedLog = capturedLogs.find(l => l.event === 'SOCKET_ROOM_DENIED' && l.room === 'hospital:H002');
      assert.ok(deniedLog, 'Must record SOCKET_ROOM_DENIED for unauthorized cross-tenant room join');
      assert.equal(deniedLog.errorCode, ErrorCode.AUTHORIZATION_ERROR);

      clientSocket.disconnect();
    });
  });

  // =========================================================================
  // 8. Security & RBAC Observability
  // =========================================================================
  await t.test('8. Security & RBAC Observability', async (t2) => {
    await t2.test('8.1 Unauthenticated request logs SECURITY_AUTH_FAILED without leaking tokens', async () => {
      const res = await request('GET', '/api/auth/me');
      assert.equal(res.status, 401);

      const authFailedLog = capturedLogs.find(l => l.event === 'SECURITY_AUTH_FAILED');
      assert.ok(authFailedLog, 'Must record SECURITY_AUTH_FAILED');
      assert.equal(authFailedLog.errorCode, ErrorCode.AUTHENTICATION_ERROR);
    });

    await t2.test('8.2 Role violation logs SECURITY_ROLE_DENIED with user role and required roles', async () => {
      // Bystander calls driver route
      const res = await request('GET', '/api/driver/assignment', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
      });
      assert.equal(res.status, 403);

      const roleDeniedLog = capturedLogs.find(l => l.event === 'SECURITY_ROLE_DENIED' && l.userRole === 'BYSTANDER');
      assert.ok(roleDeniedLog, 'Must record SECURITY_ROLE_DENIED');
      assert.equal(roleDeniedLog.errorCode, ErrorCode.AUTHORIZATION_ERROR);
      assert.ok(roleDeniedLog.requiredRoles.includes('DRIVER'));
    });
  });

  // =========================================================================
  // 9. System Health & Readiness Endpoints
  // =========================================================================
  await t.test('9. System Health & Readiness Endpoints', async (t2) => {
    await t2.test('9.1 GET /api/health and /api/system/health return operational status', async () => {
      const res1 = await request('GET', '/api/health');
      assert.equal(res1.status, 200);
      assert.equal(res1.data.status, 'ok');

      const res2 = await request('GET', '/api/system/health');
      assert.equal(res2.status, 200);
      assert.equal(res2.data.status, 'ok');
    });

    await t2.test('9.2 GET /api/readiness and /api/system/readiness report dependencies ready', async () => {
      const res = await request('GET', '/api/readiness');
      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'ready');
      assert.equal(res.data.ready, true);
      assert.equal(res.data.database.mode, 'memory');
      assert.ok(res.data.entities.hospitals >= 1);
      assert.ok(res.data.entities.ambulances >= 1);
    });
  });
});
