const { hashPassword } = require('../utils/security');
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
    if (email) { const u = this.findUserByEmail(email); if (u) return u; }
    if (phone) return this.findUserByPhone(phone);
    return null;
  }

  // ------------------------------------------------------------ ambulances
  getAmbulances() { return this.ambulances; }
  getAmbulanceById(id) { return this.ambulances.find((a) => a.id === id); }
  getAmbulanceByDriverId(driverId) { return this.ambulances.find((a) => a.driverId === driverId); }
  updateAmbulance(id, patch) {
    const a = this.getAmbulanceById(id);
    if (!a) return null;
    Object.assign(a, patch, { updatedAt: new Date() });
    return a;
  }
  updateAmbulanceStatus(id, status) { return this.updateAmbulance(id, { status }); }
  releaseAmbulance(id) { return this.updateAmbulance(id, { status: 'AVAILABLE', currentRequestId: null }); }
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
      estimatedETA: selection.estimatedTravelTime,
      assignedAt: now,
      expiresAt: new Date(now.getTime() + this.config.driverResponseTimeoutMs),
      responseAt: null,
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
    return this.assignments
      .filter((a) => a.ambulanceId === ambulance.id && ['PENDING', 'ACCEPTED'].includes(a.status))
      .sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime())[0];
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

    const pw = await hashPassword('password123');
    const makeUser = (id, name, email, phone, role, hospitalId) => ({
      id, name, email, phone, role, hospitalId,
      passwordHash: pw,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.push(
      makeUser('USER-001', 'Bystander', 'bystander@uyirkappan.demo', '9000000001', 'BYSTANDER', null),
      makeUser('USER-002', 'Driver 1', 'driver1@uyirkappan.demo', '9000000002', 'DRIVER', null),
      makeUser('USER-003', 'Driver 2', 'driver2@uyirkappan.demo', '9000000003', 'DRIVER', null),
      makeUser('USER-004', 'Driver 3', 'driver3@uyirkappan.demo', '9000000004', 'DRIVER', null),
      makeUser('USER-005', 'Driver 4', 'driver4@uyirkappan.demo', '9000000005', 'DRIVER', null),
      makeUser('USER-006', 'Driver 5', 'driver5@uyirkappan.demo', '9000000006', 'DRIVER', null),
      makeUser('USER-007', 'Hospital Staff', 'staff@uyirkappan.demo', '9000000007', 'HOSPITAL_STAFF', 'HOSP-01'),
      makeUser('USER-008', 'Admin', 'admin@uyirkappan.demo', '9000000008', 'ADMIN', null)
    );

    const makeHospital = (id, name, lat, lng, generalBeds, icuBeds, ventilators) => ({
      id, name,
      location: { latitude: lat, longitude: lng },
      resources: { generalBeds, icuBeds, ventilators },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.hospitals.push(
      makeHospital('HOSP-01', 'Apollo Hospital', 13.0327, 80.2207, 20, 6, 3),
      makeHospital('HOSP-02', 'Metro Hospital', 13.0727, 80.2407, 25, 8, 4),
      makeHospital('HOSP-03', 'Fortis Hospital', 13.0827, 80.2707, 30, 10, 5)
    );

    const makeAmbulance = (id, number, driverId, lat, lng) => ({
      id, ambulanceNumber: number, driverId,
      currentLocation: { latitude: lat, longitude: lng },
      currentSpeed: 0, currentHeading: 0,
      status: 'AVAILABLE', capabilities: ['ICU', 'OXYGEN'],
      currentRequestId: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    this.ambulances.push(
      makeAmbulance('AMB-01', 'TN-01-A-4444', 'USER-002', 13.0027, 80.1707),
      makeAmbulance('AMB-02', 'TN-01-B-5555', 'USER-003', 13.0527, 80.2207),
      makeAmbulance('AMB-03', 'TN-01-C-6666', 'USER-004', 13.1027, 80.3007),
      makeAmbulance('AMB-04', 'TN-01-D-7777', 'USER-005', 13.1127, 80.3107),
      makeAmbulance('AMB-05', 'TN-01-E-8888', 'USER-006', 13.1227, 80.3207)
    );

    setUserIdCounter(this.users.length);
    setHospitalCounter(this.hospitals.length);
    setAmbulanceCounter(this.ambulances.length);
  }
}

module.exports = { MemoryStore, distanceKm };