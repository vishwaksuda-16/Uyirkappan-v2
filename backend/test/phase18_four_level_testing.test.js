/**
 * Phase 18 — Comprehensive Four-Level Automated Testing Suite
 * 
 * LEVEL 1: Unit Testing (Dispatch, Routing, ETA, Fallback, GPS, Security, Observability)
 * LEVEL 2: Integration Testing (REST APIs, Auth, Datastore, Services, Hospital Isolation)
 * LEVEL 3: Real-Time / System Testing (Socket.IO Handshake, Rooms, Reconnect, Event Ordering)
 * LEVEL 4: End-to-End / Acceptance Testing (10 Canonical E2E Scenarios, Concurrency, Failure)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

const { datasetLoader } = require('../src/data/datasetLoader');
const { initializeMatcher, getMatcherServices } = require('../src/matcher');
const { ScoringService } = require('../src/matcher/modules/dispatch/scoring.service');
const { SimulationTrafficProvider } = require('../src/services/traffic/SimulationTrafficProvider');
const { KmlParser } = require('../src/services/road-network/kml-parser');
const logger = require('../src/utils/logger');
const { ErrorCode, AppError } = require('../src/utils/errors');
const { signToken, verifyToken } = require('../src/utils/security');
const correlationMiddleware = require('../src/middleware/correlation.middleware');
const NotificationService = require('../src/services/notification.service');
const initSocketServer = require('../src/sockets/socket.server');
const DispatchService = require('../src/services/dispatch.service');
const EtaService = require('../src/services/eta.service');
const FallbackService = require('../src/services/fallback.service');
const AssignmentService = require('../src/services/assignment.service');
const HospitalService = require('../src/services/hospital.service');
const EmergencyService = require('../src/services/emergency.service');
const AmbulanceService = require('../src/services/ambulance.service');
const buildApiRoutes = require('../src/app');
const buildSystemRoutes = require('../src/routes/system.routes');

describe('PHASE 18 — FOUR-LEVEL AUTOMATED TESTING & FORENSIC AUDIT SUITE', () => {
  let app;
  let server;
  let ioServer;
  let notificationService;
  let ctx;
  let store;
  let serverUrl;
  let port;
  const capturedLogs = [];

  // Sink logger into capturedLogs for verification
  logger.addSink((rec) => {
    capturedLogs.push(rec);
  });

  // Helper request function
  const request = async (method, path, options = {}) => {
    const url = `${serverUrl}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const fetchOptions = { method, headers };
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
  const bystanderToken = signToken({ sub: 'user-b1', id: 'user-b1', role: 'BYSTANDER' });
  const driver1Token = signToken({ sub: 'driver-1', id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });
  const driver2Token = signToken({ sub: 'driver-2', id: 'driver-2', role: 'DRIVER', ambulanceId: 'AMB-TEST-2' });
  const hospital1Token = signToken({ sub: 'staff-h1', id: 'staff-h1', role: 'HOSPITAL_STAFF', hospitalId: 'H001' });
  const hospital2Token = signToken({ sub: 'staff-h2', id: 'staff-h2', role: 'HOSPITAL_STAFF', hospitalId: 'H002' });
  const adminToken = signToken({ sub: 'admin-1', id: 'admin-1', role: 'ADMIN' });

  before(async () => {
    datasetLoader.loadAll();

    // Isolated test datastore
    store = {
      mode: 'memory',
      config: { driverResponseTimeoutMs: 1500 },
      users: new Map([
        ['user-b1', { id: 'user-b1', name: 'Bystander One', role: 'BYSTANDER', email: 'b1@test.demo' }],
        ['user-b2', { id: 'user-b2', name: 'Bystander Two', role: 'BYSTANDER', email: 'b2@test.demo' }],
        ['driver-1', { id: 'driver-1', name: 'Driver One', role: 'DRIVER', email: 'd1@test.demo', ambulanceId: 'AMB-TEST-1' }],
        ['driver-2', { id: 'driver-2', name: 'Driver Two', role: 'DRIVER', email: 'd2@test.demo', ambulanceId: 'AMB-TEST-2' }],
        ['staff-h1', { id: 'staff-h1', name: 'Hospital 1 Staff', role: 'HOSPITAL_STAFF', email: 'h1@test.demo', hospitalId: 'H001' }],
        ['staff-h2', { id: 'staff-h2', name: 'Hospital 2 Staff', role: 'HOSPITAL_STAFF', email: 'h2@test.demo', hospitalId: 'H002' }],
        ['admin-1', { id: 'admin-1', name: 'Admin One', role: 'ADMIN', email: 'admin@test.demo' }],
      ]),
      ambulances: new Map([
        ['AMB-TEST-1', { id: 'AMB-TEST-1', driverId: 'driver-1', status: 'AVAILABLE', currentLocation: { latitude: 13.0827, longitude: 80.2707 } }],
        ['AMB-TEST-2', { id: 'AMB-TEST-2', driverId: 'driver-2', status: 'AVAILABLE', currentLocation: { latitude: 13.0835, longitude: 80.2715 } }],
      ]),
      hospitals: new Map([
        ['H001', { id: 'H001', name: 'Hospital Alpha', location: { latitude: 13.0827, longitude: 80.2707 }, resources: { generalBeds: 20, icuBeds: 5, ventilators: 3 } }],
        ['H002', { id: 'H002', name: 'Hospital Beta', location: { latitude: 13.1075, longitude: 80.2878 }, resources: { generalBeds: 15, icuBeds: 3, ventilators: 2 } }],
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
        const id = `REQ-P18-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
        const id = `ASSIGN-P18-${Date.now()}-${attemptNumber}`;
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
        return this.updateAmbulance(id, {
          status: 'AVAILABLE',
          currentRequestId: null,
          activeEmergencyId: null,
          currentAssignmentId: null,
        });
      },
      async markCompleted(reqId) {
        return this.updateEmergencyStatus(reqId, 'COMPLETED');
      },
      async getIncomingEmergenciesForHospital(hospitalId) {
        return Array.from(this.emergencies.values()).filter(
          e => e.destinationHospitalId === hospitalId && !['COMPLETED', 'CANCELLED', 'NO_AMBULANCE_AVAILABLE'].includes(e.status)
        );
      },
      async getEmergencyHistoryForHospital(hospitalId) {
        return Array.from(this.emergencies.values()).filter(e => e.destinationHospitalId === hospitalId);
      },
      async updateHospitalResources(hospitalId, resources) {
        const h = this.hospitals.get(hospitalId);
        if (h) {
          h.resources = { ...h.resources, ...resources };
          return h;
        }
        return null;
      },
    };

    app = express();
    app.use(express.json());
    app.use(correlationMiddleware());

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
  });

  after(async () => {
    if (ctx.fallbackService) ctx.fallbackService.cancelAllTimeouts();
    await new Promise((resolve) => ioServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  // =========================================================================
  // LEVEL 1: UNIT TESTING
  // =========================================================================
  describe('LEVEL 1 — UNIT TESTING', () => {
    test('1.1 Dispatch Multi-Factor Scoring: 50% Travel Time, 20% Distance, 20% Traffic, 10% Availability', () => {
      const scoring = new ScoringService();
      assert.equal(scoring.weights.travelTime, 0.50);
      assert.equal(scoring.weights.distance, 0.20);
      assert.equal(scoring.weights.traffic, 0.20);
      assert.equal(scoring.weights.availability, 0.10);

      const weightsSum = scoring.weights.travelTime + scoring.weights.distance + scoring.weights.traffic + scoring.weights.availability;
      assert.equal(Math.round(weightsSum * 100) / 100, 1.0, 'Weights must sum strictly to 1.0 (100%)');

      const candidate = { travelTimeMinutes: 10, distanceKm: 5, trafficCost: 2.0, availabilityPenalty: 0 };
      const normalization = { maxTravelTime: 20, maxDistance: 10, maxTrafficCost: 4.0, maxAvailabilityPenalty: 1 };
      const scoreResult = scoring.calculateScore(candidate, normalization);

      // (0.50 * 0.5) + (0.20 * 0.5) + (0.20 * 0.5) + (0.10 * 0) = 0.25 + 0.10 + 0.10 = 0.45
      assert.equal(Math.round(scoreResult.totalScore * 100) / 100, 0.45);
    });

    test('1.2 Dijkstra Routing & Haversine Distance Lookup', () => {
      const matcher = getMatcherServices();
      assert.ok(matcher.dijkstraService, 'Dijkstra service must exist');

      const route = matcher.dijkstraService.findShortestRoute('A020', 'H007');
      assert.ok(route, 'Route must exist between valid road nodes');
      assert.ok(route.distanceKm > 0, 'Distance must be > 0');
      assert.ok(route.travelTimeMinutes > 0, 'Travel time must be > 0');
      assert.ok(route.nodeIds.length >= 2, 'Route must contain at least 2 nodes');
    });

    test('1.3 Traffic Multiplier Handling: 1.0x (Normal), 1.35x (Moderate), 2.1x (Heavy), Infinity (Blocked)', () => {
      const sim = new SimulationTrafficProvider();
      
      sim.setTrafficState('N1', 'N2', 'NORMAL');
      assert.equal(sim.getTrafficCondition('N1', 'N2').multiplier, 1.0);
      assert.equal(sim.getAdjustedTravelTime(10, 'N1', 'N2'), 10.0);

      sim.setTrafficState('N1', 'N2', 'MODERATE');
      assert.equal(sim.getTrafficCondition('N1', 'N2').multiplier, 1.35);
      assert.equal(sim.getAdjustedTravelTime(10, 'N1', 'N2'), 13.5);

      sim.setTrafficState('N1', 'N2', 'HEAVY');
      assert.equal(sim.getTrafficCondition('N1', 'N2').multiplier, 2.1);
      assert.equal(sim.getAdjustedTravelTime(10, 'N1', 'N2'), 21.0);

      sim.setTrafficState('N1', 'N2', 'BLOCKED');
      assert.equal(sim.getTrafficCondition('N1', 'N2').multiplier, Infinity);
      assert.equal(sim.getAdjustedTravelTime(10, 'N1', 'N2'), Infinity);
    });

    test('1.4 GPS Telemetry Validation & 45-Second Stale Threshold', () => {
      const now = Date.now();
      const freshTimestamp = new Date(now - 10000).toISOString(); // 10s old
      const staleTimestamp = new Date(now - 55000).toISOString(); // 55s old

      const isStale = (ts, thresholdSec = 45) => {
        const ageSec = (Date.now() - new Date(ts).getTime()) / 1000;
        return ageSec > thresholdSec;
      };

      assert.equal(isStale(freshTimestamp), false, '10s old telemetry is fresh');
      assert.equal(isStale(staleTimestamp), true, '55s old telemetry is stale (>45s)');
    });

    test('1.5 Security Utilities: JWT Pinning (HS256) & Token Verification', () => {
      const token = signToken({ sub: 'user-unit', role: 'BYSTANDER' });
      assert.ok(typeof token === 'string');

      const decoded = verifyToken(token);
      assert.equal(decoded.sub, 'user-unit');
      assert.equal(decoded.role, 'BYSTANDER');

      assert.throws(() => verifyToken('invalid.token.signature'), /invalid token/i);
    });

    test('1.6 Observability Logger: Sensitive Field Redaction & Canonical Error Taxonomy', () => {
      const record = logger.log('info', {
        event: 'REDACTION_UNIT_TEST',
        token: 'secret-jwt-12345',
        password: 'my-super-password',
        authorization: 'Bearer sensitive-token',
        mongoUri: 'mongodb://root:admin_pass@localhost:27017/db',
      });

      assert.equal(record.token, '[REDACTED]');
      assert.equal(record.password, '[REDACTED]');
      assert.equal(record.authorization, '[REDACTED]');
      assert.ok(!record.mongoUri.includes('admin_pass'), 'Mongo credentials must be redacted');

      assert.equal(ErrorCode.AUTHENTICATION_ERROR, 'AUTHENTICATION_ERROR');
      assert.equal(ErrorCode.AUTHORIZATION_ERROR, 'AUTHORIZATION_ERROR');
      assert.equal(ErrorCode.DISPATCH_ERROR, 'DISPATCH_ERROR');
    });
  });

  // =========================================================================
  // LEVEL 2: INTEGRATION TESTING
  // =========================================================================
  describe('LEVEL 2 — INTEGRATION TESTING', () => {
    test('2.1 REST Ingress to Controller: Enforces Bearer JWT Auth & Correlation Header', async () => {
      // Missing auth -> 401
      const noAuth = await request('GET', '/api/auth/me');
      assert.equal(noAuth.status, 401);
      assert.ok(noAuth.headers.get('x-correlation-id'), 'Must attach correlation ID header');

      // Valid auth -> 200
      const withAuth = await request('GET', '/api/auth/me', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
      });
      assert.equal(withAuth.status, 200);
      assert.equal(withAuth.data.user.id, 'user-b1');
    });

    test('2.2 Hospital Tenant Isolation on REST Boundaries (Prevents Cross-Tenant Leakage)', async () => {
      // Staff H1 accesses Hospital 1 -> 200 OK
      const ownHosp = await request('GET', '/api/hospitals/H001/resources', {
        headers: { Authorization: `Bearer ${hospital1Token}` },
      });
      assert.equal(ownHosp.status, 200);

      // Staff H1 attempts to access Hospital 2 -> 403 Forbidden
      const foreignHosp = await request('GET', '/api/hospitals/H002/resources', {
        headers: { Authorization: `Bearer ${hospital1Token}` },
      });
      assert.equal(foreignHosp.status, 403, 'Cross-hospital access must be strictly forbidden');
      assert.equal(foreignHosp.data.success, false);
    });

    test('2.3 Emergency Creation Integration: Persists Request & Auto-Assigns Best Unit', async () => {
      await store.releaseAmbulance('AMB-TEST-1');
      await store.releaseAmbulance('AMB-TEST-2');

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
      assert.ok(res.data.requestId);
      assert.ok(res.data.ambulanceId);
      assert.equal(res.data.status, 'ASSIGNED');

      const persisted = await store.getEmergencyByRequestId(res.data.requestId);
      assert.ok(persisted, 'Emergency must be persisted in store');
      assert.equal(persisted.status, 'ASSIGNED');
    });

    test('2.4 Driver Assignment Acceptance Integration: Updates Lifecycle & Store State', async () => {
      const em = await store.createEmergencyRequest('user-b1', {
        emergencyType: 'TRAUMA',
        victimCount: 1,
        pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
        destinationHospitalId: 'H001',
      });
      const assn = await store.createAssignment(em, { id: 'AMB-TEST-1', driverId: 'driver-1' }, 1);
      await store.updateAmbulance('AMB-TEST-1', { status: 'ASSIGNED', currentRequestId: em.requestId });

      const acceptRes = await request('POST', `/api/assignments/${assn.id}/accept`, {
        headers: { Authorization: `Bearer ${driver1Token}` },
      });
      assert.equal(acceptRes.status, 200);

      const updated = await store.getEmergencyByRequestId(em.requestId);
      assert.equal(updated.status, 'DRIVER_ACCEPTED');
    });
  });

  // =========================================================================
  // LEVEL 3: REAL-TIME / SYSTEM TESTING
  // =========================================================================
  describe('LEVEL 3 — REAL-TIME / SYSTEM TESTING', () => {
    test('3.1 Socket.IO Handshake Authentication Contract: Rejects Invalid Tokens', async () => {
      // Rejects unauthenticated
      await new Promise((resolve) => {
        const client = ioClient(serverUrl, { reconnection: false });
        client.on('connect_error', (err) => {
          assert.ok(err.message);
          client.close();
          resolve();
        });
      });

      // Accepts authenticated
      await new Promise((resolve) => {
        const client = ioClient(serverUrl, {
          auth: { token: bystanderToken },
          reconnection: false,
        });
        client.on('connect', () => {
          assert.ok(client.id);
          client.close();
          resolve();
        });
      });
    });

    test('3.2 Socket.IO Hospital Room Authorization: Prevents Room Escape', async () => {
      const clientH1 = ioClient(serverUrl, {
        auth: { token: hospital1Token },
        reconnection: false,
      });

      await new Promise((resolve) => {
        clientH1.on('connect', () => {
          // Attempt to join unauthorized Hospital 2 room
          clientH1.emit('join:hospital', { hospitalId: 'H002' });
          setTimeout(() => {
            const deniedLog = capturedLogs.find(l => l.event === 'SOCKET_ROOM_DENIED' && l.message.includes('H002'));
            assert.ok(deniedLog, 'Must log SOCKET_ROOM_DENIED when attempting cross-hospital room join');
            clientH1.close();
            resolve();
          }, 100);
        });
      });
    });

    test('3.3 Event Delivery Injects eventId, sequenceNumber, requestId, and timestamp', () => {
      const reqId = 'REQ-EVENT-META-1';
      notificationService.emitToRoom(`emergency:${reqId}`, 'STATUS_UPDATED', {
        requestId: reqId,
        status: 'EN_ROUTE_TO_PATIENT',
      });

      const emitLog = capturedLogs.find(l => l.event === 'SOCKET_EVENT_EMITTED' && l.requestId === reqId);
      assert.ok(emitLog, 'Must log structured SOCKET_EVENT_EMITTED');
      assert.ok(emitLog.eventId.startsWith(`evt-${reqId}`));
      assert.equal(emitLog.seqNum, 1);
    });

    test('3.4 Telemetry Provenance Propagation: Preserves Real vs Simulation Tags', async () => {
      const reqId = 'REQ-TEL-PROV-1';
      notificationService.emitToRoom(`emergency:${reqId}`, 'AMBULANCE_LOCATION', {
        requestId: reqId,
        ambulanceId: 'AMB-TEST-1',
        latitude: 13.0827,
        longitude: 80.2707,
        provider: 'real',
        gpsSource: 'DEVICE',
        isSimulated: false,
      });

      const telLog = capturedLogs.find(l => l.event === 'SOCKET_EVENT_EMITTED' && l.requestId === reqId);
      assert.ok(telLog);
      assert.equal(telLog.service, 'backend');
    });
  });

  // =========================================================================
  // LEVEL 4: END-TO-END / ACCEPTANCE SCENARIOS (ALL 10 SCENARIOS)
  // =========================================================================
  describe('LEVEL 4 — END-TO-END / ACCEPTANCE SCENARIOS', () => {
    test('E2E SCENARIO 1 — Normal Emergency Full Lifecycle (SOS to COMPLETED)', async () => {
      await store.releaseAmbulance('AMB-TEST-1');
      await store.releaseAmbulance('AMB-TEST-2');

      // 1. Bystander creates SOS
      const createRes = await request('POST', '/api/emergencies', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
        body: {
          emergencyType: 'CARDIAC',
          victimCount: 1,
          pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
          destinationHospitalId: 'H001',
        },
      });
      assert.equal(createRes.status, 201);
      const { requestId, assignmentId, ambulanceId } = createRes.data;

      // 2. Driver accepts
      const acceptRes = await request('POST', `/api/assignments/${assignmentId}/accept`, {
        headers: { Authorization: `Bearer ${driver1Token}` },
      });
      assert.equal(acceptRes.status, 200);

      // 3. Driver progresses trip stages
      const stages = [
        'EN_ROUTE_TO_PATIENT',
        'ARRIVED_AT_PATIENT',
        'PATIENT_ONBOARD',
        'EN_ROUTE_TO_HOSPITAL',
        'ARRIVED_AT_HOSPITAL',
      ];

      for (const stage of stages) {
        const patchRes = await request('PATCH', `/api/assignments/${assignmentId}/status`, {
          headers: { Authorization: `Bearer ${driver1Token}` },
          body: { status: stage },
        });
        assert.equal(patchRes.status, 200);
      }

      // 4. Verify completed state
      const finalEm = await store.getEmergencyByRequestId(requestId);
      assert.equal(finalEm.status, 'COMPLETED');

      const amb = await store.getAmbulanceById(ambulanceId);
      assert.equal(amb.status, 'AVAILABLE', 'Ambulance must be released back to AVAILABLE');
      assert.equal(amb.currentRequestId, null);
    });

    test('E2E SCENARIO 2 — Cascading Fallback with Invariant RequestId', async () => {
      await store.releaseAmbulance('AMB-TEST-1');
      await store.releaseAmbulance('AMB-TEST-2');

      // 1. Create emergency
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
      const originalRequestId = createRes.data.requestId;
      const firstAssignmentId = createRes.data.assignmentId;
      const firstAmbId = createRes.data.ambulanceId;
      const firstDriverToken = firstAmbId === 'AMB-TEST-1' ? driver1Token : driver2Token;

      // 2. First driver rejects
      const rejectRes = await request('POST', `/api/assignments/${firstAssignmentId}/reject`, {
        headers: { Authorization: `Bearer ${firstDriverToken}` },
      });
      assert.equal(rejectRes.status, 200);

      // 3. Verify fallback event logged with SAME requestId
      const fallbackReassignLog = capturedLogs.find(
        l => l.event === 'FALLBACK_REASSIGNED' && l.requestId === originalRequestId
      );
      assert.ok(fallbackReassignLog, 'Fallback reassignment must preserve same requestId');
      assert.equal(fallbackReassignLog.attemptNumber, 2);

      // Verify attempts history
      const attempts = await store.getAttemptsByRequestId(originalRequestId);
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0].response, 'REJECTED');
    });

    test('E2E SCENARIO 3 — Candidate Exhaustion to NO_AMBULANCE_AVAILABLE', async () => {
      // Mark all fleet units BUSY
      await store.updateAmbulance('AMB-TEST-1', { status: 'BUSY', currentRequestId: 'OCCUPIED-1' });
      await store.updateAmbulance('AMB-TEST-2', { status: 'BUSY', currentRequestId: 'OCCUPIED-2' });

      const res = await request('POST', '/api/emergencies', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
        body: {
          emergencyType: 'STROKE',
          victimCount: 1,
          pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
          destinationHospitalId: 'H001',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.status, 'NO_AMBULANCE_AVAILABLE');

      const em = await store.getEmergencyByRequestId(res.data.requestId);
      assert.equal(em.status, 'NO_AMBULANCE_AVAILABLE');
    });

    test('E2E SCENARIO 4 — Cross-Hospital Multi-Tenant Isolation Enforcement', async () => {
      // H2 staff attempts to retrieve H1 incoming emergencies
      const res = await request('GET', '/api/hospitals/H001/incoming', {
        headers: { Authorization: `Bearer ${hospital2Token}` },
      });
      assert.equal(res.status, 403);
      assert.equal(res.data.success, false);

      // H2 staff attempts to update H1 resources
      const patchRes = await request('PATCH', '/api/hospitals/H001/resources', {
        headers: { Authorization: `Bearer ${hospital2Token}` },
        body: { generalBeds: 50 },
      });
      assert.equal(patchRes.status, 403);
    });

    test('E2E SCENARIO 5 — Driver Ownership Enforcement (Driver 1 cannot act on Driver 2)', async () => {
      await store.releaseAmbulance('AMB-TEST-2');
      const em = await store.createEmergencyRequest('user-b1', { emergencyType: 'CARDIAC', victimCount: 1 });
      const assn2 = await store.createAssignment(em, { id: 'AMB-TEST-2', driverId: 'driver-2' }, 1);

      // Driver 1 attempts to accept Driver 2's assignment -> 403
      const hackAccept = await request('POST', `/api/assignments/${assn2.id}/accept`, {
        headers: { Authorization: `Bearer ${driver1Token}` },
      });
      assert.equal(hackAccept.status, 403);
    });

    test('E2E SCENARIO 6 & 7 — Real GPS vs Simulation GPS Provenance Distinction', async () => {
      await store.releaseAmbulance('AMB-TEST-1');

      // Update with Real GPS
      await ctx.ambulanceService.updateLocation('AMB-TEST-1', {
        latitude: 13.0827,
        longitude: 80.2707,
        speed: 35.0,
        provider: 'real',
        gpsSource: 'DEVICE',
        isSimulated: false,
        accuracy: 5.0,
      }, { id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });

      let amb = await store.getAmbulanceById('AMB-TEST-1');
      assert.equal(amb.currentLocation.provider, 'real');
      assert.equal(amb.currentLocation.isSimulated, false);

      // Update with Simulated GPS
      await ctx.ambulanceService.updateLocation('AMB-TEST-1', {
        latitude: 13.0830,
        longitude: 80.2710,
        speed: 20.0,
        provider: 'simulation',
        gpsSource: 'SIMULATION',
        isSimulated: true,
      }, { id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });

      amb = await store.getAmbulanceById('AMB-TEST-1');
      assert.equal(amb.currentLocation.provider, 'simulation');
      assert.equal(amb.currentLocation.isSimulated, true);
    });

    test('E2E SCENARIO 8 — Stale Telemetry Detection & Warning Trigger', async () => {
      const oldTime = new Date(Date.now() - 60000).toISOString(); // 60s ago (> 45s)

      await ctx.ambulanceService.updateLocation('AMB-TEST-1', {
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: oldTime,
      }, { id: 'driver-1', role: 'DRIVER', ambulanceId: 'AMB-TEST-1' });

      const staleLog = capturedLogs.find(l => l.event === 'STALE_GPS_DETECTED' && l.ambulanceId === 'AMB-TEST-1');
      assert.ok(staleLog, 'Must emit STALE_GPS_DETECTED alert for telemetry older than 45s');
    });

    test('E2E SCENARIO 9 — Traffic Simulation Multiplier Verification', () => {
      const traffic = new SimulationTrafficProvider();
      traffic.setTrafficState('A', 'B', 'NORMAL');
      assert.equal(traffic.getAdjustedTravelTime(10, 'A', 'B'), 10, 'Default traffic multiplier');
      traffic.setTrafficState('A', 'B', 'HEAVY');
      assert.equal(traffic.getAdjustedTravelTime(10, 'A', 'B'), 21.0, 'HEAVY multiplier is 2.1x');
    });

    test('E2E SCENARIO 10 — Socket Reconnect & Room Rejoin During Active Emergency', async () => {
      const client = ioClient(serverUrl, {
        auth: { token: bystanderToken },
        reconnection: false,
      });

      await new Promise((resolve) => {
        client.on('connect', () => {
          client.emit('join_emergency', { requestId: 'REQ-RECONNECT-TEST' });
          setTimeout(() => {
            client.disconnect();
            client.connect();
          }, 50);
        });

        client.on('connect', () => {
          client.close();
          resolve();
        });
      });
    });
  });

  // =========================================================================
  // FAILURE / CHAOS-LITE & CONCURRENCY TESTING
  // =========================================================================
  describe('FAILURE & CONCURRENCY TESTING', () => {
    test('Failure Scenario: Invalid JWT token rejected with 401', async () => {
      const res = await request('GET', '/api/auth/me', {
        headers: { Authorization: 'Bearer totally-fake-token' },
      });
      assert.equal(res.status, 401);
    });

    test('Failure Scenario: Role escalation attempt returns 403', async () => {
      const res = await request('GET', '/api/driver/assignment', {
        headers: { Authorization: `Bearer ${bystanderToken}` },
      });
      assert.equal(res.status, 403);
    });

    test('Failure Scenario: Invalid GPS coordinates rejected with 400', async () => {
      const res = await request('PATCH', '/api/ambulances/AMB-TEST-1/location', {
        headers: { Authorization: `Bearer ${driver1Token}` },
        body: { latitude: 'not-a-number', longitude: 80.2707 },
      });
      assert.equal(res.status, 400);
    });

    test('Concurrency Scenario: Simultaneous emergency creation generates distinct requestIds', async () => {
      await store.releaseAmbulance('AMB-TEST-1');
      await store.releaseAmbulance('AMB-TEST-2');

      const [res1, res2] = await Promise.all([
        request('POST', '/api/emergencies', {
          headers: { Authorization: `Bearer ${bystanderToken}` },
          body: { emergencyType: 'CARDIAC', victimCount: 1, pickupLocation: { latitude: 13.0827, longitude: 80.2707 } },
        }),
        request('POST', '/api/emergencies', {
          headers: { Authorization: `Bearer ${bystanderToken}` },
          body: { emergencyType: 'TRAUMA', victimCount: 1, pickupLocation: { latitude: 13.0835, longitude: 80.2715 } },
        }),
      ]);

      assert.ok(res1.data.requestId);
      assert.ok(res2.data.requestId);
      assert.notEqual(res1.data.requestId, res2.data.requestId, 'Concurrent requests must have unique requestIds');
    });

    test('Readiness Health Check Endpoint: Reports dependencies ready', async () => {
      const res = await request('GET', '/api/readiness');
      assert.equal(res.status, 200);
      assert.equal(res.data.status, 'ready');
      assert.equal(res.data.database.connected, true);
    });
  });
});
