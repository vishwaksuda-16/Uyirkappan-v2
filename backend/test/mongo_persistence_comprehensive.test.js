const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoStore } = require('../src/data/mongoStore');

test('MongoDB Comprehensive Persistence & Concurrency Suite', async (t) => {
  let store;

  before(async () => {
    await mongoose.connect('mongodb://localhost:27017/uyirkappan', { serverSelectionTimeoutMS: 5000 });
    store = new MongoStore();
    await store.init();
  });

  after(async () => {
    await mongoose.disconnect();
  });

  await t.test('A. MongoDB connection is active and healthy', async () => {
    assert.equal(mongoose.connection.readyState, 1);
  });

  await t.test('B & C. Emergency and Assignment persistence with full routing metadata', async () => {
    const testReq = await store.createEmergencyRequest('USER-001', {
      emergencyType: 'CARDIAC',
      victimCount: 2,
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
      destinationHospitalId: 'H001',
      source: 'TEST_SUITE',
    });

    assert.ok(testReq.requestId.startsWith('UK-'));
    assert.equal(testReq.emergencyType, 'CARDIAC');

    const amb = await store.getAmbulanceById('AMB0001');
    assert.ok(amb);

    const assn = await store.createAssignment(testReq, amb, 1, {
      estimatedTravelTime: 4,
      cost: 0.123,
      decisionReason: 'Optimal nearest unit',
      route: { distanceKm: 2.1, waypoints: [] },
    });

    assert.ok(assn.id.startsWith('ASSIGN-'));
    assert.equal(assn.status, 'PENDING');
    assert.equal(assn.estimatedETA, 4);
    assert.equal(assn.decisionReason, 'Optimal nearest unit');
    assert.equal(assn.route.distanceKm, 2.1);

    // Verify persisted directly in MongoDB collection
    const persistedAssn = await mongoose.connection.db.collection('assignments').findOne({ id: assn.id });
    assert.ok(persistedAssn);
    assert.equal(persistedAssn.decisionReason, 'Optimal nearest unit');
    assert.equal(persistedAssn.estimatedETA, 4);
  });

  await t.test('D. RequestAttempt persistence and attempt ledger tracking', async () => {
    const attempts = await store.getAttemptsByRequestId('UK-2026-000003');
    assert.ok(attempts.length >= 3);
    assert.equal(attempts[0].response, 'REJECTED');
    assert.equal(attempts[1].response, 'REJECTED');
    assert.equal(attempts[2].response, 'ACCEPTED');
  });

  await t.test('E & M. Ambulance state persistence: assignment -> release -> AVAILABLE', async () => {
    const ambId = 'AMB0010';
    await store.updateAmbulance(ambId, { status: 'ASSIGNED', currentRequestId: 'UK-TEST-001' });
    let amb = await store.getAmbulanceById(ambId);
    assert.equal(amb.status, 'ASSIGNED');
    assert.equal(amb.currentRequestId, 'UK-TEST-001');

    await store.releaseAmbulance(ambId);
    amb = await store.getAmbulanceById(ambId);
    assert.equal(amb.status, 'AVAILABLE');
    assert.equal(amb.currentRequestId, null);
  });

  await t.test('F. Hospital resource persistence with non-destructive merge', async () => {
    const hosp = await store.getHospitalById('H001');
    const initialIcu = hosp.resources.icuBeds;
    const initialTotal = hosp.resources.totalGeneralBeds;

    // Update only generalBeds
    await store.updateHospitalResources('H001', { generalBeds: 42 });

    const updated = await store.getHospitalById('H001');
    assert.equal(updated.resources.generalBeds, 42);
    assert.equal(updated.resources.icuBeds, initialIcu, 'ICU beds must not be erased');
    assert.equal(updated.resources.totalGeneralBeds, initialTotal, 'Total general beds must not be erased');
  });

  await t.test('J. Race condition protection: concurrent accept cannot double-accept', async () => {
    const testReq = await store.createEmergencyRequest('USER-001', {
      emergencyType: 'TRAUMA',
      victimCount: 1,
      pickupLocation: { latitude: 13.08, longitude: 80.27 },
    });
    const amb = await store.getAmbulanceById('AMB0011');
    const assn = await store.createAssignment(testReq, amb, 1, { estimatedTravelTime: 5 });

    // Simulate two concurrent accept calls racing to accept the same assignment
    const [res1, res2] = await Promise.all([
      store.transitionAssignmentState(assn.id, ['PENDING'], 'ACCEPTED'),
      store.transitionAssignmentState(assn.id, ['PENDING'], 'ACCEPTED'),
    ]);

    const successes = [res1, res2].filter((r) => r.ok).length;
    const conflicts = [res1, res2].filter((r) => !r.ok && r.error === 'CONFLICT').length;

    assert.equal(successes, 1, 'Exactly one concurrent transition must succeed');
    assert.equal(conflicts, 1, 'The competing transition must be rejected with CONFLICT');
  });

  await t.test('K. Timeout vs Accept race protection', async () => {
    const testReq = await store.createEmergencyRequest('USER-001', {
      emergencyType: 'FALL',
      victimCount: 1,
      pickupLocation: { latitude: 13.08, longitude: 80.27 },
    });
    const amb = await store.getAmbulanceById('AMB0012');
    const assn = await store.createAssignment(testReq, amb, 1, { estimatedTravelTime: 5 });

    // Step 1: Timeout fires first
    const timeoutRes = await store.transitionAssignmentState(assn.id, ['PENDING'], 'TIMEOUT');
    assert.equal(timeoutRes.ok, true);

    // Step 2: Driver attempts to accept a timed-out assignment
    const acceptRes = await store.transitionAssignmentState(assn.id, ['PENDING'], 'ACCEPTED');
    assert.equal(acceptRes.ok, false);
    assert.equal(acceptRes.error, 'CONFLICT');
    assert.equal(acceptRes.currentStatus, 'TIMEOUT');
  });

  await t.test('L. Unique index prevents duplicate attempts per request and attemptNumber', async () => {
    const dupAttempt = {
      id: 'ATTEMPT-DUP-TEST',
      requestId: 'UK-2026-000001',
      attemptNumber: 1, // Already exists in database
      ambulanceId: 'AMB0001',
    };

    await assert.rejects(
      async () => {
        await mongoose.connection.db.collection('request_attempts').insertOne(dupAttempt);
      },
      /E11000 duplicate key error/
    );
  });
});
