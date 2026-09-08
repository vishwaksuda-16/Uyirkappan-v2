const { hashPassword } = require('../utils/security');
const idGen = require('../utils/idGen');
const { DRIVER_RESPONSE_TIMEOUT_MS } = require('../config/environment');
const { distanceKm } = require('./memoryStore');

const User = require('../models/User');
const Ambulance = require('../models/Ambulance');
const Hospital = require('../models/Hospital');
const EmergencyRequest = require('../models/EmergencyRequest');
const Assignment = require('../models/Assignment');
const RequestAttempt = require('../models/RequestAttempt');
const LocationHistory = require('../models/LocationHistory');

const clean = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { _id, __v, ...rest } = obj;
  return rest;
};

class MongoStore {
  constructor() {
    this.mode = 'mongodb';
    this.config = { driverResponseTimeoutMs: DRIVER_RESPONSE_TIMEOUT_MS };
    this.models = { User, Ambulance, Hospital, EmergencyRequest, Assignment, RequestAttempt, LocationHistory };
  }

  async init() {
    await this.seed();
    await this.synchronizeCounters();
  }

  // Keep custom IDs (UK-…, ASSIGN-…) unique across server restarts.
  async synchronizeCounters() {
    const last = async (Model, regex) => {
      const doc = await Model.findOne({ id: regex }).sort({ id: -1 }).select('id').lean();
      return doc ? doc.id : null;
    };
    const num = (id, regex) => { const m = id.match(regex); return m ? parseInt(m[1], 10) : 0; };

    let id;
    if ((id = await last(User, /^USER-\d+$/))) idGen.setUserIdCounter(num(id, /^USER-(\d+)$/));
    if ((id = await last(EmergencyRequest, /^UK-\d{4}-\d{6}$/))) idGen.setEmergencyCounter(num(id, /^UK-\d{4}-(\d{6})$/));
    if ((id = await last(Assignment, /^ASSIGN-\d+$/))) idGen.setAssignmentCounter(num(id, /^ASSIGN-(\d+)$/));
    if ((id = await last(Ambulance, /^AMB-\d+$/))) idGen.setAmbulanceCounter(num(id, /^AMB-(\d+)$/));
    if ((id = await last(Hospital, /^HOSP-\d+$/))) idGen.setHospitalCounter(num(id, /^HOSP-(\d+)$/));
    if ((id = await last(RequestAttempt, /^ATTEMPT-\d+$/))) idGen.setAttemptCounter(num(id, /^ATTEMPT-(\d+)$/));
    if ((id = await last(LocationHistory, /^LOC-\d+$/))) idGen.setLocationCounter(num(id, /^LOC-(\d+)$/));
  }

  // ------------------------------------------------------------------- users
  async createUser(user) { return clean(await User.create(user)); }
  async findUserByEmail(email) { if (!email) return null; return clean(await User.findOne({ email })); }
  async findUserByPhone(phone) { if (!phone) return null; return clean(await User.findOne({ phone })); }
  async findUserById(id) { return clean(await User.findOne({ id })); }
  async findUserByEmailOrPhone(email, phone) {
    if (email) { const u = await this.findUserByEmail(email); if (u) return u; }
    if (phone) return this.findUserByPhone(phone);
    return null;
  }

  // ---------------------------------------------------------------- ambulances
  async getAmbulances() { return (await Ambulance.find({}).lean()).map(clean); }
  async getAmbulanceById(id) { return clean(await Ambulance.findOne({ id })); }
  async getAmbulanceByDriverId(driverId) { return clean(await Ambulance.findOne({ driverId })); }
  async updateAmbulance(id, patch) {
    return clean(await Ambulance.findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true }
    ));
  }
  async updateAmbulanceStatus(id, status) { return this.updateAmbulance(id, { status }); }
  async releaseAmbulance(id) { return this.updateAmbulance(id, { status: 'AVAILABLE', currentRequestId: null }); }
  async updateAmbulanceLocation(id, { latitude, longitude, speed, heading }) {
    return this.updateAmbulance(id, {
      currentLocation: { latitude, longitude },
      currentSpeed: speed ?? 0,
      currentHeading: heading ?? 0,
    });
  }
  async addLocationHistory(entry) {
    await LocationHistory.create({
      ...entry,
      id: idGen.genLocationId(),
      timestamp: new Date(),
    });
  }
  async getLocationHistory(ambulanceId) {
    return (await LocationHistory.find({ ambulanceId }).sort({ timestamp: 1 }).lean()).map(clean);
  }

  // ----------------------------------------------------------------- hospitals
  async getHospitals() { return (await Hospital.find({}).lean()).map(clean); }
  async getHospitalById(id) { return clean(await Hospital.findOne({ id })); }
  async updateHospitalResources(id, resources) {
    return clean(await Hospital.findOneAndUpdate(
      { id },
      { $set: { resources, updatedAt: new Date() } },
      { new: true }
    ));
  }
  async getNearestHospitalId(location) {
    const hospitals = await this.getHospitals();
    let nearest = null;
    let best = Infinity;
    for (const h of hospitals) {
      const d = distanceKm(location, h.location);
      if (d < best) { best = d; nearest = h.id; }
    }
    return nearest;
  }

  // ---------------------------------------------------------- emergency requests
  async createEmergencyRequest(requesterId, body) {
    return clean(await EmergencyRequest.create({
      requestId: idGen.genEmergencyRequestId(),
      requesterId,
      emergencyType: body.emergencyType,
      victimCount: body.victimCount,
      pickupLocation: body.pickupLocation,
      destinationHospitalId: body.destinationHospitalId || null,
      assignedAmbulanceId: null,
      status: 'SEARCHING',
      currentETA: null,
      completedAt: null,
    }));
  }
  async getEmergencyByRequestId(requestId) { return clean(await EmergencyRequest.findOne({ requestId })); }
  async updateEmergencyRequest(requestId, patch) {
    return clean(await EmergencyRequest.findOneAndUpdate(
      { requestId },
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true }
    ));
  }
  async updateEmergencyStatus(requestId, status) { return this.updateEmergencyRequest(requestId, { status }); }
  async updateEmergencyETA(requestId, eta) { return this.updateEmergencyRequest(requestId, { currentETA: eta }); }
  async markCompleted(requestId) {
    return this.updateEmergencyRequest(requestId, { status: 'COMPLETED', completedAt: new Date() });
  }
  async getIncomingEmergenciesForHospital(hospitalId) {
    return (await EmergencyRequest.find({
      destinationHospitalId: hospitalId,
      status: { $nin: ['COMPLETED', 'CANCELLED', 'NO_AMBULANCE_AVAILABLE'] },
    }).sort({ createdAt: -1 }).lean()).map(clean);
  }
  async getEmergencyHistoryForHospital(hospitalId) {
    return (await EmergencyRequest.find({ destinationHospitalId: hospitalId })
      .sort({ createdAt: -1 }).lean()).map(clean);
  }

  // ---------------------------------------------------------------- assignments
  async createAssignment(request, ambulance, attemptNumber, selection) {
    const now = new Date();
    const id = idGen.genAssignmentId();
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
    };
    await Assignment.create(assignment);
    await RequestAttempt.create({
      id: idGen.genAttemptId(),
      requestId: request.requestId,
      assignmentId: id,
      attemptNumber,
      ambulanceId: ambulance.id,
      assignedAt: now,
      responseAt: null,
      response: 'PENDING',
      failureReason: null,
    });
    return { ...assignment };
  }
  async getAssignmentById(id) { return clean(await Assignment.findOne({ id })); }
  async getActiveAssignmentForDriver(driverId) {
    const ambulance = await this.getAmbulanceByDriverId(driverId);
    if (!ambulance) return null;
    return clean(await Assignment.findOne({
      ambulanceId: ambulance.id,
      status: { $in: ['PENDING', 'ACCEPTED'] },
    }).sort({ assignedAt: -1 }));
  }
  async getAssignmentsForRequest(requestId) {
    return (await Assignment.find({ requestId }).sort({ assignedAt: 1 }).lean()).map(clean);
  }
  /**
   * Race-safe transition via atomic conditional update:
   * only a PENDING assignment can become ACCEPTED / REJECTED / TIMEOUT.
   * Driver accept and timeout worker can never both win.
   */
  async transitionAssignmentState(id, fromStates, toState) {
    const res = await Assignment.updateOne(
      { id, status: { $in: fromStates } },
      { $set: { status: toState, updatedAt: new Date() } }
    );
    if (res.modifiedCount === 1) {
      return { ok: true, assignment: await this.getAssignmentById(id) };
    }
    const existing = await Assignment.findOne({ id });
    if (!existing) return { ok: false, error: 'NOT_FOUND', currentStatus: null };
    return { ok: false, error: 'CONFLICT', currentStatus: existing.status };
  }
  async recordResponse(assignment, response, failureReason) {
    await Assignment.updateOne({ id: assignment.id }, {
      $set: { responseAt: new Date(), updatedAt: new Date() },
    });
    await RequestAttempt.updateOne({ assignmentId: assignment.id }, {
      $set: { response, responseAt: new Date(), failureReason },
    });
  }

  // ----------------------------------------------------------- request attempts
  async getAttemptsByRequestId(requestId) {
    return (await RequestAttempt.find({ requestId }).sort({ attemptNumber: 1 }).lean()).map(clean);
  }

  // ----------------------------------------------------------------------- seed
  async seed() {
    const pwHash = await hashPassword('password123');

    const users = [
      { id: 'USER-001', name: 'Bystander', email: 'bystander@uyirkappan.demo', phone: '9000000001', role: 'BYSTANDER' },
      { id: 'USER-002', name: 'Driver 1', email: 'driver1@uyirkappan.demo', phone: '9000000002', role: 'DRIVER' },
      { id: 'USER-003', name: 'Driver 2', email: 'driver2@uyirkappan.demo', phone: '9000000003', role: 'DRIVER' },
      { id: 'USER-004', name: 'Driver 3', email: 'driver3@uyirkappan.demo', phone: '9000000004', role: 'DRIVER' },
      { id: 'USER-005', name: 'Driver 4', email: 'driver4@uyirkappan.demo', phone: '9000000005', role: 'DRIVER' },
      { id: 'USER-006', name: 'Driver 5', email: 'driver5@uyirkappan.demo', phone: '9000000006', role: 'DRIVER' },
      { id: 'USER-007', name: 'Hospital Staff', email: 'staff@uyirkappan.demo', phone: '9000000007', role: 'HOSPITAL_STAFF', hospitalId: 'HOSP-01' },
      { id: 'USER-008', name: 'Admin', email: 'admin@uyirkappan.demo', phone: '9000000008', role: 'ADMIN' },
    ];
    for (const u of users) {
      await User.updateOne(
        { id: u.id },
        {
          $set: { name: u.name, email: u.email, phone: u.phone, role: u.role, hospitalId: u.hospitalId },
          $setOnInsert: { passwordHash: pwHash }, // never overwrite existing password hashes
        },
        { upsert: true }
      );
    }

    const hospitals = [
      { id: 'HOSP-01', name: 'Apollo Hospital', lat: 13.0327, lng: 80.2207, g: 20, i: 6, v: 3 },
      { id: 'HOSP-02', name: 'Metro Hospital', lat: 13.0727, lng: 80.2407, g: 25, i: 8, v: 4 },
      { id: 'HOSP-03', name: 'Fortis Hospital', lat: 13.0827, lng: 80.2707, g: 30, i: 10, v: 5 },
    ];
    for (const h of hospitals) {
      await Hospital.updateOne(
        { id: h.id },
        { $set: { name: h.name, location: { latitude: h.lat, longitude: h.lng },
                  resources: { generalBeds: h.g, icuBeds: h.i, ventilators: h.v } } },
        { upsert: true }
      );
    }

    const ambulances = [
      { id: 'AMB-01', number: 'TN-01-A-4444', driver: 'USER-002', lat: 13.0027, lng: 80.1707 },
      { id: 'AMB-02', number: 'TN-01-B-5555', driver: 'USER-003', lat: 13.0527, lng: 80.2207 },
      { id: 'AMB-03', number: 'TN-01-C-6666', driver: 'USER-004', lat: 13.1027, lng: 80.3007 },
      { id: 'AMB-04', number: 'TN-01-D-7777', driver: 'USER-005', lat: 13.1127, lng: 80.3107 },
      { id: 'AMB-05', number: 'TN-01-E-8888', driver: 'USER-006', lat: 13.1227, lng: 80.3207 },
    ];
    for (const a of ambulances) {
      await Ambulance.updateOne(
        { id: a.id },
        {
          $set: {
            ambulanceNumber: a.number,
            driverId: a.driver,
            currentLocation: { latitude: a.lat, longitude: a.lng },
            status: 'AVAILABLE',
            currentRequestId: null,
            capabilities: ['ICU', 'OXYGEN'],
          },
        },
        { upsert: true }
      );
    }
    await this.synchronizeCounters();
  }
}

module.exports = { MongoStore };