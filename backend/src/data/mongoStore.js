const { hashPassword } = require('../utils/security');
const idGen = require('../utils/idGen');
const { DRIVER_RESPONSE_TIMEOUT_MS } = require('../config/environment');
const { distanceKm } = require('./memoryStore');
const { datasetLoader } = require('./datasetLoader');

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
    const last = async (Model, field, regex) => {
      const doc = await Model.findOne({ [field]: regex }).sort({ [field]: -1 }).select(field).lean();
      return doc ? doc[field] : null;
    };
    const num = (id, regex) => { const m = id.match(regex); return m ? parseInt(m[1], 10) : 0; };

    let id;
    if ((id = await last(User, 'id', /^USER-\d+$/))) idGen.setUserIdCounter(num(id, /^USER-(\d+)$/));
    if ((id = await last(EmergencyRequest, 'requestId', /^UK-\d{4}-\d{6}$/))) idGen.setEmergencyCounter(num(id, /^UK-\d{4}-(\d{6})$/));
    if ((id = await last(Assignment, 'id', /^ASSIGN-\d+$/))) idGen.setAssignmentCounter(num(id, /^ASSIGN-(\d+)$/));
    if ((id = await last(Ambulance, 'id', /^AMB-\d+$/))) idGen.setAmbulanceCounter(num(id, /^AMB-(\d+)$/));
    if ((id = await last(Hospital, 'id', /^HOSP-\d+$/))) idGen.setHospitalCounter(num(id, /^HOSP-(\d+)$/));
    if ((id = await last(RequestAttempt, 'id', /^ATTEMPT-\d+$/))) idGen.setAttemptCounter(num(id, /^ATTEMPT-(\d+)$/));
    if ((id = await last(LocationHistory, 'id', /^LOC-\d+$/))) idGen.setLocationCounter(num(id, /^LOC-(\d+)$/));
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
  async getAmbulanceByDriverId(driverId) {
    let amb = clean(await Ambulance.findOne({ driverId }));
    if (!amb) {
      const user = await this.findUserById(driverId);
      if (user?.ambulanceId) {
        amb = clean(await Ambulance.findOne({ id: user.ambulanceId }));
      }
    }
    return amb;
  }
  async updateAmbulance(id, patch) {
    return clean(await Ambulance.findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true }
    ));
  }
  async updateAmbulanceStatus(id, status) { return this.updateAmbulance(id, { status }); }
  async releaseAmbulance(id) {
    return this.updateAmbulance(id, {
      status: 'AVAILABLE',
      currentRequestId: null,
      activeEmergencyId: null,
      currentAssignmentId: null,
    });
  }
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

    const now = new Date();
    const assns = (await Assignment.find({
      ambulanceId: ambulance.id,
      $or: [
        { status: { $in: ['ACCEPTED', 'EN_ROUTE_TO_PATIENT', 'ARRIVED_AT_PATIENT', 'PATIENT_ONBOARD', 'EN_ROUTE_TO_HOSPITAL', 'ARRIVED_AT_HOSPITAL'] } },
        { status: 'PENDING', expiresAt: { $gt: now } },
      ],
    }).sort({ assignedAt: -1 }).lean()).map(clean);

    for (const a of assns) {
      const req = await this.getEmergencyByRequestId(a.requestId);
      if (req && !['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'].includes(req.status)) {
        return a;
      }
    }
    return null;
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
    datasetLoader.loadAll();
    const pwHash = await hashPassword('password123');

    // 1. Users
    const users = [
      { id: 'USER-001', name: 'Bystander', email: 'bystander@uyirkappan.demo', phone: '9000000001', role: 'BYSTANDER' },
      { id: 'USER-008', name: 'Admin', email: 'admin@uyirkappan.demo', phone: '9000000008', role: 'ADMIN' },
      { id: 'USER-007', name: 'Hospital Staff', email: 'staff@uyirkappan.demo', phone: '9000000007', role: 'HOSPITAL_STAFF', hospitalId: 'H001' },
    ];

    // Staff accounts for all 30 hospitals
    for (const h of datasetLoader.hospitals) {
      users.push({
        id: `STAFF-${h.id}`,
        name: `${h.name} Staff`,
        email: `staff.${h.id.toLowerCase()}@uyirkappan.demo`,
        phone: '9000000007',
        role: 'HOSPITAL_STAFF',
        hospitalId: h.id,
      });
    }

    // Drivers
    for (const d of datasetLoader.drivers) {
      users.push({
        id: d.id,
        name: d.name,
        email: `${d.id.toLowerCase()}@uyirkappan.demo`,
        phone: d.phone,
        role: 'DRIVER',
        ambulanceId: d.assignedAmbulanceId,
      });
    }

    // Demo driver aliases — use UNIQUE ids so they don't overwrite real drivers
    // This lets users login with either 'drv0001@uyirkappan.demo' OR 'driver1@uyirkappan.demo'
    const d1 = datasetLoader.drivers[0];
    if (d1) {
      users.push({ id: 'DEMO-DRV1', name: d1.name, email: 'driver1@uyirkappan.demo', phone: d1.phone, role: 'DRIVER', ambulanceId: d1.assignedAmbulanceId });
    }
    const d2 = datasetLoader.drivers[1];
    if (d2) {
      users.push({ id: 'DEMO-DRV2', name: d2.name, email: 'driver2@uyirkappan.demo', phone: d2.phone, role: 'DRIVER', ambulanceId: d2.assignedAmbulanceId });
    }
    for (const u of users) {
      await User.updateOne(
        { id: u.id },
        {
          $set: {
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            hospitalId: u.hospitalId,
            ambulanceId: u.ambulanceId,
            passwordHash: pwHash,
          },
        },
        { upsert: true }
      );
    }

    // 2. 30 Canonical Hospitals
    for (const h of datasetLoader.hospitals) {
      await Hospital.updateOne(
        { id: h.id },
        {
          $set: {
            name: h.name,
            location: { latitude: h.location.latitude, longitude: h.location.longitude },
            resources: h.resources,
            area: h.area,
            sector: h.sector,
            traumaCapable: h.traumaCapable,
            cardiacCapable: h.cardiacCapable,
            operationalStatus: h.operationalStatus,
          },
        },
        { upsert: true }
      );
    }

    // 3. 131 Fleet Ambulances
    for (const a of datasetLoader.ambulances) {
      await Ambulance.updateOne(
        { id: a.id },
        {
          $set: {
            ambulanceNumber: a.ambulanceId,
            driverId: a.driverId,
            currentLocation: { latitude: a.currentLocation.latitude, longitude: a.currentLocation.longitude },
            status: a.status || 'AVAILABLE',
            currentRequestId: null,
            capabilities: a.capabilities,
            vehicleType: a.vehicleType,
            baseId: a.baseId,
          },
        },
        { upsert: true }
      );
    }
    await this.synchronizeCounters();
  }
}

module.exports = { MongoStore };
