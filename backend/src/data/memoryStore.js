const { hashPassword } = require('../utils/security');
const { datasetLoader } = require('./datasetLoader');
const {
  genUserId, genEmergencyRequestId, genAssignmentId, genAmbulanceId,
  genHospitalId, genAttemptId, genLocationId,
  setUserIdCounter, setAmbulanceCounter, setHospitalCounter,
} = require('../utils/idGen');
const { DRIVER_RESPONSE_TIMEOUT_MS } = require('../config/environment');

const toRad = (deg) => (deg * Math.PI) / 180;

const distanceKm = (from, to) => {
  const R = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

class MemoryStore {
  constructor() {
    this.mode = 'memory';
    this.config = { driverResponseTimeoutMs: DRIVER_RESPONSE_TIMEOUT_MS };
    this.users = [];
    this.ambulances = [];
    this.hospitals = [];
    this.emergencyRequests = [];
    this.assignments = [];
    this.requestAttempts = [];
    this.locationHistory = [];
    this.seeded = false;
  }

  // --------------------------------------------------------------- users
  createUser(user) { this.users.push(user); return user; }
  findUserByEmail(email) { return this.users.find((u) => u.email === email); }
  findUserByPhone(phone) { return this.users.find((u) => u.phone === phone); }
  findUserById(id) { return this.users.find((u) => u.id === id); }
  findUserByEmailOrPhone(email, phone) {
    if (email) {
      const lower = String(email).trim().toLowerCase();
      const norm = lower.replace(/-/g, '').replace('@uyirkappan.demo', '');
      const u = this.users.find((x) => {
        if (!x) return false;
        if (x.email && x.email.toLowerCase() === lower) return true;
        if (x.id && (x.id.toLowerCase() === lower || x.id.toLowerCase().replace(/-/g, '') === norm)) return true;
        if (x.ambulanceId && (x.ambulanceId.toLowerCase() === lower || x.ambulanceId.toLowerCase().replace(/-/g, '') === norm)) return true;
        return false;
      });
      if (u) return u;
    }
    if (phone) return this.findUserByPhone(phone);
    return null;
  }

  // ------------------------------------------------------------ ambulances
  getAmbulances() { return this.ambulances; }
  getAmbulanceById(id) { return this.ambulances.find((a) => a.id === id); }
  getAmbulanceByDriverId(driverId) {
    let amb = this.ambulances.find((a) => a.driverId === driverId);
    if (!amb) {
      const user = this.users.find((u) => u.id === driverId);
      if (user?.ambulanceId) {
        amb = this.ambulances.find((a) => a.id === user.ambulanceId);
      }
    }
    return amb;
  }
  updateAmbulance(id, patch) {
    const a = this.getAmbulanceById(id);
    if (!a) return null;
    Object.assign(a, patch, { updatedAt: new Date() });
    return a;
  }
  releaseAmbulance(id) {
    return this.updateAmbulance(id, {
      status: 'AVAILABLE',
      currentRequestId: null,
      activeEmergencyId: null,
      currentAssignmentId: null,
    });
  }
  updateAmbulanceLocation(id, { latitude, longitude, speed, heading }) {
    return this.updateAmbulance(id, {
      currentLocation: { latitude, longitude },
      currentSpeed: speed ?? 0,
      currentHeading: heading ?? 0,
    });
  }
  addLocationHistory(entry) {
    this.locationHistory.push({ ...entry, id: genLocationId(), timestamp: new Date() });
  }
  getLocationHistory(ambulanceId) {
    return this.locationHistory.filter((l) => l.ambulanceId === ambulanceId);
  }

  // ---------------------------------------------------------------- hospitals
  getHospitals() { return this.hospitals; }
  getHospitalById(id) { return this.hospitals.find((h) => h.id === id); }
  updateHospitalResources(id, resources) {
    const h = this.getHospitalById(id);
    if (!h) return null;
    h.resources = { ...h.resources, ...resources };
    h.updatedAt = new Date();
    return h;
  }
  getNearestHospitalId(location) {
    let nearest = null;
    let best = Infinity;
    for (const h of this.hospitals) {
      const d = distanceKm(location, h.location);
      if (d < best) { best = d; nearest = h.id; }
    }
    return nearest;
  }

  // ------------------------------------------------------ emergency requests
  createEmergencyRequest(requesterId, body) {
    const request = {
      requestId: genEmergencyRequestId(),
      requesterId,
      emergencyType: body.emergencyType,
      victimCount: body.victimCount,
      pickupLocation: { latitude: body.pickupLocation.latitude, longitude: body.pickupLocation.longitude },
      destinationHospitalId: body.destinationHospitalId || null,
      assignedAmbulanceId: null,
      status: 'SEARCHING',
      currentETA: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    this.emergencyRequests.push(request);
    return request;
  }
  getEmergencyByRequestId(requestId) { return this.emergencyRequests.find((r) => r.requestId === requestId); }
  updateEmergencyRequest(requestId, patch) {
    const r = this.getEmergencyByRequestId(requestId);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: new Date() });
    return r;
  }
  updateEmergencyStatus(requestId, status) { return this.updateEmergencyRequest(requestId, { status }); }
  updateEmergencyETA(requestId, eta) { return this.updateEmergencyRequest(requestId, { currentETA: eta }); }
  markCompleted(requestId) {
    return this.updateEmergencyRequest(requestId, { status: 'COMPLETED', completedAt: new Date() });
  }
  getIncomingEmergenciesForHospital(hospitalId) {
    return this.emergencyRequests.filter(
      (r) => r.destinationHospitalId === hospitalId &&
        !['COMPLETED', 'CANCELLED', 'NO_AMBULANCE_AVAILABLE'].includes(r.status)
    );
  }
  getEmergencyHistoryForHospital(hospitalId) {
    return this.emergencyRequests.filter((r) => r.destinationHospitalId === hospitalId);
  }

  // ---------------------------------------------------------------- assignments
  createAssignment(request, ambulance, attemptNumber, selection) {
    const now = new Date();
    const id = genAssignmentId();
    const assignment = {
      id,
      requestId: request.requestId,
      ambulanceId: ambulance.id,
      attemptNumber,
      status: 'PENDING',
      estimatedETA: selection ? selection.estimatedTravelTime : 10,
      assignedAt: now,
      expiresAt: new Date(now.getTime() + this.config.driverResponseTimeoutMs),
      responseAt: null,
      route: selection?.route || null,
      alternativeRoutes: selection?.alternativeRoutes || [],
      candidateRoutes: selection?.candidateRoutes || [],
      destinationHospital: selection?.destinationHospital || null,
      hospitalRoute: selection?.hospitalRoute || null,
      baselineRoute: selection?.baselineRoute || null,
      baselineEta: selection?.baselineEta || null,
      baselineDistance: selection?.baselineDistance || null,
      etaImprovementPct: selection?.etaImprovementPct || null,
      distanceKm: selection?.distance || selection?.route?.distanceKm || 0,
      decisionReason: selection?.decisionReason || null,
      scoreBreakdown: selection?.scoreBreakdown || null,
      costBreakdown: selection?.costBreakdown || null,
      cost: selection?.cost,
      score: selection?.score,
      createdAt: now,
      updatedAt: now,
    };
    this.assignments.push(assignment);
    this.requestAttempts.push({
      id: genAttemptId(),
      requestId: request.requestId,
      assignmentId: id,
      attemptNumber,
      ambulanceId: ambulance.id,
      assignedAt: now,
      responseAt: null,
      response: 'PENDING',
      failureReason: null,
    });
    return assignment;
  }
  getAssignmentById(id) { return this.assignments.find((a) => a.id === id); }
  getActiveAssignmentForDriver(driverId) {
    const ambulance = this.getAmbulanceByDriverId(driverId);
    if (!ambulance) return null;
    const now = new Date();
    const activeStatuses = [
      'ACCEPTED',
      'EN_ROUTE_TO_PATIENT',
      'ARRIVED_AT_PATIENT',
      'PATIENT_ONBOARD',
      'EN_ROUTE_TO_HOSPITAL',
      'ARRIVED_AT_HOSPITAL',
    ];
    return this.assignments
      .filter((a) => {
        if (a.ambulanceId !== ambulance.id && a.driverId !== driverId) return false;
        const req = this.getEmergencyByRequestId(a.requestId);
        if (!req || ['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'].includes(req.status)) {
          return false;
        }
        if (activeStatuses.includes(a.status)) return true;
        if (a.status === 'PENDING') {
          return !a.expiresAt || a.expiresAt > now;
        }
        return false;
      })
      .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())[0] || null;
  }
  getAssignmentsForRequest(requestId) {
    return this.assignments.filter((a) => a.requestId === requestId);
  }
  /**
   * Race-safe transition. In-memory check-and-set. With MongoDB this becomes an
   * atomic conditional update (status in fromStates) — see MongoStore.
   */
  transitionAssignmentState(id, fromStates, toState) {
    const a = this.getAssignmentById(id);
    if (!a) return { ok: false, error: 'NOT_FOUND', currentStatus: null };
    if (!fromStates.includes(a.status)) {
      return { ok: false, error: 'CONFLICT', currentStatus: a.status };
    }
    a.status = toState;
    a.updatedAt = new Date();
    return { ok: true, assignment: a };
  }
  recordResponse(assignment, response, failureReason) {
    const attempt = this.requestAttempts.find((a) => a.assignmentId === assignment.id);
    if (attempt) {
      attempt.response = response;
      attempt.responseAt = new Date();
      attempt.failureReason = failureReason;
    }
    assignment.responseAt = new Date();
    assignment.updatedAt = new Date();
  }

  // ----------------------------------------------------------- request attempts
  getAttemptsByRequestId(requestId) {
    return this.requestAttempts.filter((a) => a.requestId === requestId);
  }

  // ------------------------------------------------------------------------ seed
  async seed() {
    if (this.seeded) return;
    this.seeded = true;

    datasetLoader.loadAll();

    const pw = await hashPassword('password123');
    const makeUser = (id, name, email, phone, role, hospitalId) => ({
      id, name, email, phone, role, hospitalId,
      passwordHash: pw,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 1. Standard administrative and demo bystander accounts
    this.users.push(
      makeUser('USER-001', 'Bystander', 'bystander@uyirkappan.demo', '9000000001', 'BYSTANDER', null),
      makeUser('USER-008', 'Admin', 'admin@uyirkappan.demo', '9000000008', 'ADMIN', null),
      makeUser('USER-007', 'Hospital Staff', 'staff@uyirkappan.demo', '9000000007', 'HOSPITAL_STAFF', 'H001')
    );

    // 2. Staff accounts for each of the 30 hospitals
    for (const h of datasetLoader.hospitals) {
      this.users.push(
        makeUser(`STAFF-${h.id}`, `${h.name} Staff`, `staff.${h.id.toLowerCase()}@uyirkappan.demo`, '9000000007', 'HOSPITAL_STAFF', h.id)
      );
    }

    // 3. Driver accounts for all 131 fleet drivers
    for (const d of datasetLoader.drivers) {
      const u = makeUser(d.id, d.name, `${d.id.toLowerCase()}@uyirkappan.demo`, d.phone, 'DRIVER', null);
      u.ambulanceId = d.assignedAmbulanceId;
      this.users.push(u);
    }

    // Legacy driver1@… aliases are resolved by AuthController to the
    // canonical dataset accounts.  Do not insert duplicate user IDs here:
    // duplicate IDs make token-to-user lookup ambiguous.

    // 4. Ingest the 30 canonical hospitals
    this.hospitals = datasetLoader.hospitals.map(h => ({
      ...h,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // 5. Ingest the 131 fleet ambulances
    this.ambulances = datasetLoader.ambulances.map(a => ({
      ...a,
      ambulanceNumber: a.ambulanceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    setUserIdCounter(this.users.length);
    setHospitalCounter(this.hospitals.length);
    setAmbulanceCounter(this.ambulances.length);
  }
}

module.exports = { MemoryStore, distanceKm };
