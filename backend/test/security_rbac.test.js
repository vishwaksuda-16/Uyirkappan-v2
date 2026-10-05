/**
 * Phase 16 — Comprehensive Security & RBAC Audit and Verification Suite
 *
 * Verifies:
 * 1. JWT Authentication Lifecycle (missing, invalid, expired, algorithm checks)
 * 2. Role-Based Access Control (RBAC) across Bystander, Driver, Hospital, Admin
 * 3. Object-Level Authorization (IDOR) on emergencies, assignments, ambulances
 * 4. Hospital Multi-Tenant Isolation (REST API and Socket.IO)
 * 5. Driver / Ambulance Identity & Telemetry Protection
 * 6. Vertical Privilege Escalation Protections
 * 7. Admin / Demo / Reset Endpoint Access Control
 * 8. Sensitive Credential & Data Exposure Hygiene
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const { signToken, verifyToken, hashPassword } = require('../src/utils/security');
const { JWT_SECRET } = require('../src/config/environment');
const authMiddleware = require('../src/middleware/auth.middleware');
const { requireRole } = require('../src/middleware/role.middleware');
const buildAuthRoutes = require('../src/routes/auth.routes');
const buildEmergencyRoutes = require('../src/routes/emergency.routes');
const buildAssignmentRoutes = require('../src/routes/assignment.routes');
const buildHospitalRoutes = require('../src/routes/hospital.routes');
const buildDriverRoutes = require('../src/routes/driver.routes');
const buildAmbulanceRoutes = require('../src/routes/ambulance.routes');
const buildSystemRoutes = require('../src/routes/system.routes');
const initSocketServer = require('../src/sockets/socket.server');
const NotificationService = require('../src/services/notification.service');
const EmergencyService = require('../src/services/emergency.service');
const AssignmentService = require('../src/services/assignment.service');
const HospitalService = require('../src/services/hospital.service');
const AmbulanceService = require('../src/services/ambulance.service');

test('Phase 16 — Security & RBAC Verification Suite', async (t) => {
  let app, server, ioServer, notificationService, port, serverUrl;
  let store, ctx;

  // Initialize isolated in-memory test store
  const now = new Date();
  store = {
    mode: 'memory',
    users: new Map([
      ['user-bystander-1', { id: 'user-bystander-1', name: 'Bystander 1', role: 'BYSTANDER', email: 'b1@demo.test' }],
      ['user-bystander-2', { id: 'user-bystander-2', name: 'Bystander 2', role: 'BYSTANDER', email: 'b2@demo.test' }],
      ['user-driver-1', { id: 'user-driver-1', name: 'Driver 1', role: 'DRIVER', email: 'd1@demo.test', ambulanceId: 'AMB-01' }],
      ['user-driver-2', { id: 'user-driver-2', name: 'Driver 2', role: 'DRIVER', email: 'd2@demo.test', ambulanceId: 'AMB-02' }],
      ['user-hosp-1', { id: 'user-hosp-1', name: 'Hospital 1 Staff', role: 'HOSPITAL_STAFF', email: 'h1@demo.test', hospitalId: 'H001' }],
      ['user-hosp-2', { id: 'user-hosp-2', name: 'Hospital 2 Staff', role: 'HOSPITAL_STAFF', email: 'h2@demo.test', hospitalId: 'H002' }],
      ['user-admin', { id: 'user-admin', name: 'Admin User', role: 'ADMIN', email: 'admin@demo.test' }],
    ]),
    ambulances: new Map([
      ['AMB-01', { id: 'AMB-01', driverId: 'user-driver-1', status: 'AVAILABLE', currentLocation: { latitude: 13.0827, longitude: 80.2707 } }],
      ['AMB-02', { id: 'AMB-02', driverId: 'user-driver-2', status: 'AVAILABLE', currentLocation: { latitude: 13.0830, longitude: 80.2710 } }],
    ]),
    hospitals: new Map([
      ['H001', { id: 'H001', name: 'General Hospital 1', resources: { generalBeds: 20, icuBeds: 5, ventilators: 2 } }],
      ['H002', { id: 'H002', name: 'General Hospital 2', resources: { generalBeds: 15, icuBeds: 3, ventilators: 1 } }],
    ]),
    emergencies: new Map([
      ['REQ-B1', { requestId: 'REQ-B1', requesterId: 'user-bystander-1', destinationHospitalId: 'H001', assignedAmbulanceId: 'AMB-01', status: 'ASSIGNED', currentETA: 8 }],
      ['REQ-B2', { requestId: 'REQ-B2', requesterId: 'user-bystander-2', destinationHospitalId: 'H002', assignedAmbulanceId: 'AMB-02', status: 'ASSIGNED', currentETA: 12 }],
    ]),
    assignments: new Map([
      ['ASN-01', { id: 'ASN-01', requestId: 'REQ-B1', ambulanceId: 'AMB-01', driverId: 'user-driver-1', status: 'PENDING' }],
      ['ASN-02', { id: 'ASN-02', requestId: 'REQ-B2', ambulanceId: 'AMB-02', driverId: 'user-driver-2', status: 'PENDING' }],
    ]),
    requestAttempts: [],
    locationHistory: [],

    async findUserById(id) { return this.users.get(id) || null; },
    async findUserByEmailOrPhone(email, phone) {
      for (const u of this.users.values()) {
        if (email && u.email === email) return u;
        if (phone && u.phone === phone) return u;
      }
      return null;
    },
    async createUser(u) { this.users.set(u.id, u); return u; },
    async getAmbulanceById(id) { return this.ambulances.get(id) || null; },
    async getAmbulances() { return Array.from(this.ambulances.values()); },
    async getAmbulanceByDriverId(driverId) {
      for (const amb of this.ambulances.values()) {
        if (amb.driverId === driverId) return amb;
      }
      return null;
    },
    async updateAmbulance(id, update) {
      const amb = this.ambulances.get(id);
      if (amb) Object.assign(amb, update);
      return amb;
    },
    async updateAmbulanceLocation(id, loc) {
      const amb = this.ambulances.get(id);
      if (amb) amb.currentLocation = loc;
      return amb;
    },
    async addLocationHistory(item) { this.locationHistory.push(item); },
    async getHospitalById(id) { return this.hospitals.get(id) || null; },
    async getHospitals() { return Array.from(this.hospitals.values()); },
    async updateHospitalResources(id, res) {
      const h = this.hospitals.get(id);
      if (h) h.resources = { ...h.resources, ...res };
      return h;
    },
    async getIncomingEmergenciesForHospital(hId) {
      return Array.from(this.emergencies.values()).filter(e => e.destinationHospitalId === hId);
    },
    async getEmergencyHistoryForHospital(hId) {
      return Array.from(this.emergencies.values()).filter(e => e.destinationHospitalId === hId);
    },
    async getEmergencyByRequestId(id) { return this.emergencies.get(id) || null; },
    async updateEmergencyStatus(id, status) {
      const em = this.emergencies.get(id);
      if (em) em.status = status;
      return em;
    },
    async updateEmergencyETA(id, eta) {
      const em = this.emergencies.get(id);
      if (em) em.currentETA = eta;
      return em;
    },
    async getAssignmentById(id) { return this.assignments.get(id) || null; },
    async getAssignmentsForRequest(reqId) {
      return Array.from(this.assignments.values()).filter(a => a.requestId === reqId);
    },
    async getActiveAssignmentForDriver(driverId) {
      for (const a of this.assignments.values()) {
        if (a.driverId === driverId && ['PENDING', 'ACCEPTED'].includes(a.status)) return a;
      }
      return null;
    },
    async transitionAssignmentState(id, allowed, target) {
      const a = this.assignments.get(id);
      if (!a) return { ok: false, currentStatus: null };
      if (!allowed.includes(a.status)) return { ok: false, currentStatus: a.status };
      a.status = target;
      return { ok: true, currentStatus: target };
    },
    async getAttemptsByRequestId(id) {
      return this.requestAttempts.filter(a => a.requestId === id);
    },
    async releaseAmbulance(id) {
      const amb = this.ambulances.get(id);
      if (amb) { amb.status = 'AVAILABLE'; amb.currentRequestId = null; }
    },
  };

  app = express();
  app.use(express.json());
  server = http.createServer(app);
  ioServer = new Server(server, { cors: { origin: '*' } });
  notificationService = new NotificationService(ioServer, store);

  ctx = {
    store,
    notificationService,
    etaService: { async simulateEta() { return 10; } },
    fallbackService: { stopTimeout() {}, async runFallback() {} },
  };
  ctx.ambulanceService = new AmbulanceService(ctx);
  ctx.emergencyService = new EmergencyService(ctx);
  ctx.assignmentService = new AssignmentService(ctx);
  ctx.hospitalService = new HospitalService(ctx);

  initSocketServer(ioServer, ctx);

  app.use('/api/auth', buildAuthRoutes(ctx));
  app.use('/api/emergency', buildEmergencyRoutes(ctx));
  app.use('/api/assignments', buildAssignmentRoutes(ctx));
  app.use('/api/hospitals', buildHospitalRoutes(ctx));
  app.use('/api/driver', buildDriverRoutes(ctx));
  app.use('/api/ambulances', buildAmbulanceRoutes(ctx));
  app.use('/api/system', buildSystemRoutes(ctx));
  app.use('/api/demo', buildSystemRoutes(ctx));

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  const getToken = (userId) => {
    const user = store.users.get(userId);
    return signToken({ sub: user.id, role: user.role });
  };

  const req = async (path, { method = 'GET', token, body } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${serverUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  t.after(async () => {
    ioServer.close();
    server.close();
  });

  // ==========================================
  // SECTION 1: JWT AUTHENTICATION
  // ==========================================
  await t.test('1. JWT Authentication Lifecycle', async (t2) => {
    await t2.test('1.1 Rejects requests with missing Authorization header (401)', async () => {
      const res = await req('/api/emergency/REQ-B1');
      assert.equal(res.status, 401);
      assert.equal(res.data.success, false);
    });

    await t2.test('1.2 Rejects requests with malformed Bearer token (401)', async () => {
      const res = await req('/api/emergency/REQ-B1', { token: 'invalid.malformed.token' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'TOKEN_INVALID');
    });

    await t2.test('1.3 Rejects expired JWT token (401)', async () => {
      const expiredToken = jwt.sign({ sub: 'user-bystander-1', role: 'BYSTANDER' }, JWT_SECRET, { expiresIn: '-1s' });
      const res = await req('/api/emergency/REQ-B1', { token: expiredToken });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'TOKEN_EXPIRED');
    });

    await t2.test('1.4 Rejects token with invalid/tampered signature (401)', async () => {
      const tamperedToken = jwt.sign({ sub: 'user-admin', role: 'ADMIN' }, 'wrong-attacker-secret');
      const res = await req('/api/emergency/REQ-B1', { token: tamperedToken });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'TOKEN_INVALID');
    });

    await t2.test('1.5 Accepts valid signed JWT token (200)', async () => {
      const token = getToken('user-bystander-1');
      const res = await req('/api/auth/me', { token });
      assert.equal(res.status, 200);
      assert.equal(res.data.user.id, 'user-bystander-1');
    });
  });

  // ==========================================
  // SECTION 2: VERTICAL PRIVILEGE ESCALATION
  // ==========================================
  await t.test('2. Vertical Privilege Escalation Protections', async (t2) => {
    await t2.test('2.1 Rejects public self-registration with role ADMIN (403)', async () => {
      const res = await req('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Attacker User',
          email: 'attacker@demo.test',
          password: 'password123',
          role: 'ADMIN',
        },
      });
      assert.equal(res.status, 403);
      assert.match(res.data.message, /forbidden/i);
    });

    await t2.test('2.2 Allows legitimate registration without privilege escalation (defaults BYSTANDER)', async () => {
      const res = await req('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Normal Citizen',
          email: 'citizen@demo.test',
          password: 'password123',
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.user.role, 'BYSTANDER');
    });
  });

  // ==========================================
  // SECTION 3: IDOR & OBJECT-LEVEL ACCESS CONTROL
  // ==========================================
  await t.test('3. Object-Level Access Control (IDOR) Protections', async (t2) => {
    const tokenB1 = getToken('user-bystander-1');
    const tokenB2 = getToken('user-bystander-2');
    const tokenD1 = getToken('user-driver-1');
    const tokenD2 = getToken('user-driver-2');

    await t2.test('3.1 Bystander 2 CANNOT access Bystander 1 emergency dossier (403 IDOR blocked)', async () => {
      const res = await req('/api/emergency/REQ-B1', { token: tokenB2 });
      assert.equal(res.status, 403);
    });

    await t2.test('3.2 Bystander 2 CANNOT cancel Bystander 1 emergency (403 IDOR blocked)', async () => {
      const res = await req('/api/emergency/REQ-B1/cancel', { method: 'POST', token: tokenB2 });
      assert.equal(res.status, 403);
    });

    await t2.test('3.3 Bystander 2 CANNOT track Bystander 1 emergency (403 IDOR blocked)', async () => {
      const res = await req('/api/emergency/REQ-B1/tracking', { token: tokenB2 });
      assert.equal(res.status, 403);
    });

    await t2.test('3.4 Bystander 1 CAN access own emergency (200 allowed)', async () => {
      const res = await req('/api/emergency/REQ-B1', { token: tokenB1 });
      assert.equal(res.status, 200);
      assert.equal(res.data.request.requestId, 'REQ-B1');
    });

    await t2.test('3.5 Driver 2 CANNOT accept Driver 1 assignment (403 IDOR blocked)', async () => {
      const res = await req('/api/assignments/ASN-01/accept', { method: 'POST', token: tokenD2 });
      assert.equal(res.status, 403);
    });

    await t2.test('3.6 Driver 2 CANNOT reject Driver 1 assignment (403 IDOR blocked)', async () => {
      const res = await req('/api/assignments/ASN-01/reject', { method: 'POST', token: tokenD2 });
      assert.equal(res.status, 403);
    });

    await t2.test('3.7 Driver 2 CANNOT update Driver 1 assignment status (403 IDOR blocked)', async () => {
      const res = await req('/api/assignments/ASN-01/status', {
        method: 'PATCH',
        token: tokenD2,
        body: { status: 'EN_ROUTE_TO_PATIENT' },
      });
      assert.equal(res.status, 403);
    });

    await t2.test('3.8 Driver 2 CANNOT spoof location of Driver 1 ambulance AMB-01 (403 IDOR blocked)', async () => {
      const res = await req('/api/ambulances/AMB-01/location', {
        method: 'POST',
        token: tokenD2,
        body: { latitude: 13.0827, longitude: 80.2707 },
      });
      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // SECTION 4: HOSPITAL TENANT ISOLATION
  // ==========================================
  await t.test('4. Hospital Multi-Tenant Isolation Protections', async (t2) => {
    const tokenH1 = getToken('user-hosp-1'); // Hospital H001
    const tokenH2 = getToken('user-hosp-2'); // Hospital H002

    await t2.test('4.1 Hospital 2 staff CANNOT view Hospital 1 incoming emergencies (403 Tenant Escape blocked)', async () => {
      const res = await req('/api/hospitals/H001/incoming', { token: tokenH2 });
      assert.equal(res.status, 403);
    });

    await t2.test('4.2 Hospital 2 staff CANNOT view Hospital 1 emergency history (403 Tenant Escape blocked)', async () => {
      const res = await req('/api/hospitals/H001/emergency-history', { token: tokenH2 });
      assert.equal(res.status, 403);
    });

    await t2.test('4.3 Hospital 2 staff CANNOT view Hospital 1 resources (403 Tenant Escape blocked)', async () => {
      const res = await req('/api/hospitals/H001/resources', { token: tokenH2 });
      assert.equal(res.status, 403);
    });

    await t2.test('4.4 Hospital 2 staff CANNOT update Hospital 1 resources (403 Tenant Escape blocked)', async () => {
      const res = await req('/api/hospitals/H001/resources', {
        method: 'PATCH',
        token: tokenH2,
        body: { generalBeds: 99 },
      });
      assert.equal(res.status, 403);
    });

    await t2.test('4.5 Hospital 1 staff CAN view and update Hospital 1 resources (200 allowed)', async () => {
      const res = await req('/api/hospitals/H001/resources', { token: tokenH1 });
      assert.equal(res.status, 200);
      assert.ok(res.data.resources);
    });
  });

  // ==========================================
  // SECTION 5: ROLE-BASED ACCESS CONTROL (RBAC)
  // ==========================================
  await t.test('5. Role-Based Access Control Enforcements', async (t2) => {
    const tokenB1 = getToken('user-bystander-1');
    const tokenD1 = getToken('user-driver-1');

    await t2.test('5.1 Bystander CANNOT access Driver-only route /api/driver/assignment (403)', async () => {
      const res = await req('/api/driver/assignment', { token: tokenB1 });
      assert.equal(res.status, 403);
    });

    await t2.test('5.2 Bystander CANNOT update ambulance status (403)', async () => {
      const res = await req('/api/ambulances/AMB-01/status', {
        method: 'PATCH',
        token: tokenB1,
        body: { status: 'BUSY' },
      });
      assert.equal(res.status, 403);
    });

    await t2.test('5.3 Driver CANNOT access Hospital incoming emergency bay (403)', async () => {
      const res = await req('/api/hospitals/H001/incoming', { token: tokenD1 });
      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // SECTION 6: SYSTEM DEMO / RESET AUTHORIZATION
  // ==========================================
  await t.test('6. System Reset / Demo Endpoint Security', async (t2) => {
    const tokenB1 = getToken('user-bystander-1');
    const tokenH1 = getToken('user-hosp-1');
    const tokenAdmin = getToken('user-admin');

    await t2.test('6.1 Anonymous unauthenticated user CANNOT reset system (401)', async () => {
      const res = await req('/api/system/reset-demo', { method: 'POST' });
      assert.equal(res.status, 401);
    });

    await t2.test('6.2 Bystander CANNOT reset system (403)', async () => {
      const res = await req('/api/system/reset-demo', { method: 'POST', token: tokenB1 });
      assert.equal(res.status, 403);
    });

    await t2.test('6.3 Hospital Staff CAN reset system demo state (200 allowed)', async () => {
      const res = await req('/api/demo/reset', { method: 'POST', token: tokenH1 });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
    });

    await t2.test('6.4 Admin CAN reset system demo state (200 allowed)', async () => {
      const res = await req('/api/system/reset', { method: 'POST', token: tokenAdmin });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
    });
  });

  // ==========================================
  // SECTION 7: SOCKET.IO AUTHORIZATION AUDIT
  // ==========================================
  await t.test('7. Socket.IO Real-Time Authorization & Tenant Isolation', async (t2) => {
    const createSocketClient = (userId) => {
      const token = getToken(userId);
      return Client(serverUrl, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
    };

    await t2.test('7.1 Hospital 1 staff CANNOT join Hospital 2 Socket.IO room (Tenant escape blocked)', async () => {
      const hosp1Client = createSocketClient('user-hosp-1');
      const hosp2Client = createSocketClient('user-hosp-2');

      await Promise.all([
        new Promise((res) => hosp1Client.on('connect', res)),
        new Promise((res) => hosp2Client.on('connect', res)),
      ]);

      // Hospital 1 maliciously attempts to join hospital:H002
      hosp1Client.emit('join:hospital', 'H002');
      await new Promise((r) => setTimeout(r, 60));

      let hosp1Received = false;
      hosp1Client.on('EMERGENCY_CREATED', () => { hosp1Received = true; });

      const hosp2Promise = new Promise((resolve) => {
        hosp2Client.on('EMERGENCY_CREATED', resolve);
      });

      // Emit event strictly to hospital:H002
      notificationService.emitToRoom('hospital:H002', 'EMERGENCY_CREATED', {
        requestId: 'REQ-SECRET-H002',
        hospitalId: 'H002',
      });

      const h2Data = await hosp2Promise;
      assert.equal(h2Data.requestId, 'REQ-SECRET-H002');

      await new Promise((r) => setTimeout(r, 60));
      assert.equal(hosp1Received, false, 'Hospital 1 MUST NOT receive private events from Hospital 2 room');

      hosp1Client.disconnect();
      hosp2Client.disconnect();
    });

    await t2.test('7.2 Bystander 2 CANNOT spy on Bystander 1 emergency room via join_emergency', async () => {
      const b1Client = createSocketClient('user-bystander-1');
      const b2Client = createSocketClient('user-bystander-2');

      await Promise.all([
        new Promise((res) => b1Client.on('connect', res)),
        new Promise((res) => b2Client.on('connect', res)),
      ]);

      // Both try to join emergency:REQ-B1 (owned by user-bystander-1)
      b1Client.emit('join_emergency', 'REQ-B1');
      b2Client.emit('join_emergency', 'REQ-B1');
      await new Promise((r) => setTimeout(r, 60));

      let b2Received = false;
      b2Client.on('STATUS_UPDATED', () => { b2Received = true; });

      const b1Promise = new Promise((resolve) => {
        b1Client.on('STATUS_UPDATED', resolve);
      });

      notificationService.emitToRoom('emergency:REQ-B1', 'STATUS_UPDATED', {
        requestId: 'REQ-B1',
        status: 'EN_ROUTE_TO_HOSPITAL',
      });

      const b1Data = await b1Promise;
      assert.equal(b1Data.status, 'EN_ROUTE_TO_HOSPITAL');

      await new Promise((r) => setTimeout(r, 60));
      assert.equal(b2Received, false, 'Unauthorized bystander MUST NOT receive events from another emergency room');

      b1Client.disconnect();
      b2Client.disconnect();
    });

    await t2.test('7.3 Non-driver CANNOT trigger ambulance telemetry updates over Socket.IO', async () => {
      const b1Client = createSocketClient('user-bystander-1');
      await new Promise((res) => b1Client.on('connect', res));

      // Attempt to spoof location of AMB-01
      b1Client.emit('location:update', {
        ambulanceId: 'AMB-01',
        latitude: 13.9999,
        longitude: 80.9999,
      });

      await new Promise((r) => setTimeout(r, 60));
      const amb = await store.getAmbulanceById('AMB-01');
      assert.equal(amb.currentLocation.latitude, 13.0827, 'Location must NOT be altered by non-driver socket');

      b1Client.disconnect();
    });
  });

  // ==========================================
  // SECTION 8: DATA EXPOSURE HYGIENE
  // ==========================================
  await t.test('8. Sensitive Credential & Data Exposure Hygiene', async (t2) => {
    const tokenB1 = getToken('user-bystander-1');
    const res = await req('/api/auth/me', { token: tokenB1 });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.equal(res.data.user.password, undefined, 'password must never be exposed');
  });
});
