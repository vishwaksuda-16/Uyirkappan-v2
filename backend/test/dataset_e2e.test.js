const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const { datasetLoader } = require('../src/data/datasetLoader');
const { MemoryStore } = require('../src/data/memoryStore');
const { initializeMatcher, getMatcherServices } = require('../src/matcher/index');
const { roadGraph } = require('../src/matcher/modules/routing/virtual-road-network');
const { generateRoadPathCoordinates } = require('../src/simulation/roadRouteSimulator');
const HospitalService = require('../src/services/hospital.service');
const DispatchService = require('../src/services/dispatch.service');
const FallbackService = require('../src/services/fallback.service');
const AssignmentService = require('../src/services/assignment.service');
const EmergencyService = require('../src/services/emergency.service');
const AmbulanceService = require('../src/services/ambulance.service');
const EtaService = require('../src/services/eta.service');
const buildScenarioRoutes = require('../src/routes/scenario.routes');

describe('UYIRKAPPAN — 20 Critical Dataset-Driven & Road Routing Tests', () => {
  let store;
  let matcher;
  let ctx;

  test('setup test environment', async () => {
    datasetLoader.loadAll();
    store = new MemoryStore();
    await store.seed();
    matcher = initializeMatcher(null);

    ctx = {
      store,
      io: { to: () => ({ emit: () => {} }) },
      notificationService: {
        emitToRoom: (room, event, data) => {
          ctx.emittedEvents = ctx.emittedEvents || [];
          ctx.emittedEvents.push({ room, event, data });
        },
        broadcast: (event, data) => {
          ctx.emittedEvents = ctx.emittedEvents || [];
          ctx.emittedEvents.push({ room: 'broadcast', event, data });
        },
      },
      matcher,
      emittedEvents: [],
    };

    ctx.etaService = new EtaService(store);
    ctx.dispatchService = new DispatchService(store, ctx.etaService);
    ctx.fallbackService = new FallbackService(ctx);
    ctx.assignmentService = new AssignmentService(ctx);
    ctx.ambulanceService = new AmbulanceService(ctx);
    ctx.hospitalService = new HospitalService(ctx);
    ctx.emergencyService = new EmergencyService(ctx);
  });

  afterEach(() => {
    if (ctx?.fallbackService?.timeouts) {
      for (const timer of ctx.fallbackService.timeouts.values()) {
        clearTimeout(timer);
      }
      ctx.fallbackService.timeouts.clear();
    }
  });

  // TEST 1: Dataset loader loads actual CSV files
  test('TEST 1: Dataset loader loads actual CSV files', () => {
    assert.ok(datasetLoader.hospitals.length > 0, 'hospitals must not be empty');
    assert.ok(datasetLoader.ambulances.length > 0, 'ambulances must not be empty');
    assert.ok(datasetLoader.roadNodes.length > 0, 'roadNodes must not be empty');
    assert.ok(datasetLoader.roadSegments.length > 0, 'roadSegments must not be empty');
    assert.ok(datasetLoader.trafficConditions.length > 0, 'trafficConditions must not be empty');
    assert.ok(datasetLoader.drivers.length > 0, 'drivers must not be empty');
  });

  // TEST 2: 30 hospitals are available
  test('TEST 2: 30 hospitals are available', () => {
    assert.equal(datasetLoader.hospitals.length, 30, 'Exactly 30 hospitals from CSV must be loaded');
    const storeHospitals = store.getHospitals();
    assert.equal(storeHospitals.length, 30, 'Store must have all 30 hospitals');
    assert.ok(storeHospitals.every(h => /^H\d{3}$/.test(h.id)), 'All hospital IDs must follow H001-H030');
  });

  // TEST 3: 131 ambulances are available
  test('TEST 3: 131 ambulances are available', () => {
    assert.equal(datasetLoader.ambulances.length, 131, 'Exactly 131 ambulances from CSV must be loaded');
    const storeAmbulances = store.getAmbulances();
    assert.equal(storeAmbulances.length, 131, 'Store must have all 131 ambulances');
    assert.ok(storeAmbulances.every(a => /^AMB\d{4}$/.test(a.id)), 'All ambulance IDs must follow AMB0001-AMB0131');
  });

  // TEST 4: Hospital selection does not always select Apollo
  test('TEST 4: Hospital selection does not always select Apollo', async () => {
    // Incident in Ennore (North Chennai: 13.2128, 80.3180)
    const selectionNorth = await ctx.hospitalService.selectBestHospital({
      emergencyType: 'TRAUMA',
      victimCount: 1,
      pickupLocation: { latitude: 13.2128, longitude: 80.3180 },
    });
    // Apollo Greams Road is H007 (in Thousand Lights, ~18 km away)
    assert.notEqual(selectionNorth.selectedHospitalId, 'H007', 'North Chennai emergency must NOT default to Apollo H007');
    assert.ok(selectionNorth.selectedHospitalId, 'A valid hospital must be selected');
  });

  // TEST 5: Hospital selection changes when patient location changes
  test('TEST 5: Hospital selection changes when patient location changes', async () => {
    // Location 1: North Chennai (Stanley / Royapuram area)
    const hNorth = await ctx.hospitalService.selectBestHospital({
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.11, longitude: 80.29 },
    });

    // Location 2: South Chennai (Chromepet / Tambaram area)
    const hSouth = await ctx.hospitalService.selectBestHospital({
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 12.95, longitude: 80.14 },
    });

    assert.notEqual(hNorth.selectedHospitalId, hSouth.selectedHospitalId,
      `Hospital must differ: North=${hNorth.selectedHospitalId}, South=${hSouth.selectedHospitalId}`);
  });

  // TEST 6: Hospital capability affects eligibility
  test('TEST 6: Hospital capability affects eligibility', async () => {
    const loc = { latitude: 13.0827, longitude: 80.2707 };
    const cardiacChoice = await ctx.hospitalService.selectBestHospital({
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: loc,
    });
    assert.equal(cardiacChoice.selectedHospital.cardiacCapable, true,
      'Cardiac emergency must choose cardiac-capable hospital');

    const traumaChoice = await ctx.hospitalService.selectBestHospital({
      emergencyType: 'TRAUMA',
      victimCount: 1,
      pickupLocation: loc,
    });
    assert.equal(traumaChoice.selectedHospital.traumaCapable, true,
      'Trauma emergency must choose trauma-capable hospital');
  });

  // TEST 7: Ambulance selection changes when ambulance positions change
  test('TEST 7: Ambulance selection changes when incident location changes', async () => {
    // Incident in Ennore
    const ambNorth = await ctx.dispatchService.findBestAmbulance({
      requestId: 'REQ-N',
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.2128, longitude: 80.3180 },
    }, []);

    // Incident in Guindy / South
    const ambSouth = await ctx.dispatchService.findBestAmbulance({
      requestId: 'REQ-S',
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.0067, longitude: 80.2024 },
    }, []);

    assert.notEqual(ambNorth.ambulance.id, ambSouth.ambulance.id,
      `Selected ambulance must differ based on proximity: North=${ambNorth.ambulance.id}, South=${ambSouth.ambulance.id}`);
  });

  test('TEST 7A: Dispatch routes to the exact pinned location and does not use a default outside coverage', async () => {
    const pinnedLocation = { latitude: 13.0418, longitude: 80.2341 };
    const invalidRequest = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 91, longitude: 80.2341 },
    });
    assert.equal(invalidRequest.ok, false, 'Invalid pins must be rejected instead of being normalized to a default');

    const selection = await ctx.dispatchService.findBestAmbulance({
      requestId: 'REQ-PINNED-TNAGAR',
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: pinnedLocation,
    }, []);

    assert.ok(selection);
    assert.deepEqual(
      selection.route.waypoints[selection.route.waypoints.length - 1],
      {
        nodeId: 'DEST_GPS',
        name: 'Patient Pickup Location',
        ...pinnedLocation,
      },
      'Road routing must terminate at the exact chosen pin',
    );

    const outsideCoverage = await ctx.dispatchService.findBestAmbulance({
      requestId: 'REQ-OUTSIDE-DATASET',
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 40.7128, longitude: -74.0060 },
    }, []);
    assert.equal(outsideCoverage, null, 'Do not substitute the default/dataset location when no units cover the pin');
    const previousRequestCount = store.emergencyRequests.length;
    const rejectedOutsidePin = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 40.7128, longitude: -74.0060 },
    });
    assert.equal(rejectedOutsidePin.ok, false, 'A pin outside road coverage must be rejected explicitly');
    assert.equal(store.emergencyRequests.length, previousRequestCount, 'Rejected pins must not create an emergency at another location');
  });

  // TEST 8: Routing does not use N1-N5
  test('TEST 8: Routing does not use N1-N5', () => {
    const allNodeIds = Array.from(matcher.graphService.getGraph().nodes.keys());
    assert.ok(!allNodeIds.includes('N1'), 'Graph must not contain N1');
    assert.ok(!allNodeIds.includes('N2'), 'Graph must not contain N2');
    assert.ok(!allNodeIds.includes('N3'), 'Graph must not contain N3');
    assert.ok(!allNodeIds.includes('N4'), 'Graph must not contain N4');
    assert.ok(!allNodeIds.includes('N5'), 'Graph must not contain N5');
    assert.equal(allNodeIds.length, 70, 'Graph must contain exactly 70 authentic nodes');
  });

  // TEST 9: Routing does not use Node 10/12/15/19/24
  test('TEST 9: Routing does not use Node 10/12/15/19/24', () => {
    const synthetic = ['Node 10', 'Node 12', 'Node 15', 'Node 17', 'Node 18', 'Node 19', 'Node 21', 'Node 24', 'Hospital H1'];
    const allNodeIds = Array.from(matcher.graphService.getGraph().nodes.keys());
    for (const syn of synthetic) {
      assert.ok(!allNodeIds.includes(syn), `Road network must not contain synthetic node '${syn}'`);
    }
  });

  // TEST 10: Route changes when origin changes
  test('TEST 10: Route changes when origin changes', () => {
    const route1 = matcher.dijkstraService.findShortestRoute('A001', 'H001');
    const route2 = matcher.dijkstraService.findShortestRoute('A005', 'H001');
    assert.notDeepEqual(route1.nodeIds, route2.nodeIds, 'Route node sequences must differ');
    assert.notEqual(route1.distanceKm, route2.distanceKm, 'Route distances must differ');
  });

  // TEST 11: Route changes when destination changes
  test('TEST 11: Route changes when destination changes', () => {
    const route1 = matcher.dijkstraService.findShortestRoute('A001', 'H001');
    const route2 = matcher.dijkstraService.findShortestRoute('A001', 'H004');
    assert.notDeepEqual(route1.nodeIds, route2.nodeIds, 'Route node sequences must differ');
    assert.notEqual(route1.distanceKm, route2.distanceKm, 'Route distances must differ');
  });

  // TEST 12: Traffic changes ETA
  test('TEST 12: Traffic changes ETA', () => {
    const general = matcher.trafficService.getTimeOfDayTraffic();
    assert.ok(general.state, 'Must have traffic state from traffic_conditions.csv');
    assert.ok(typeof general.multiplier === 'number', 'Multiplier must be a number');

    const baseMinutes = 10;
    const clearTime = matcher.trafficService.getAdjustedTravelTime(baseMinutes, 'A001', 'H001');
    matcher.trafficService.setTrafficState('A001', 'H001', 'HEAVY');
    const heavyTime = matcher.trafficService.getAdjustedTravelTime(baseMinutes, 'A001', 'H001');
    assert.ok(heavyTime > clearTime, `Heavy congestion travel time (${heavyTime}m) must be > clear time (${clearTime}m)`);
  });

  // TEST 13: Multiple candidate routes are returned
  test('TEST 13: Multiple candidate routes are returned', () => {
    const multi = matcher.dijkstraService.findMultiRoutes('A001', 'H001');
    assert.ok(multi.primaryRoute, 'Must have primaryRoute');
    assert.ok(Array.isArray(multi.alternativeRoutes), 'alternativeRoutes must be an array');
    assert.ok(Array.isArray(multi.candidateRoutes), 'candidateRoutes must be an array');
    assert.ok(multi.candidateRoutes.length >= 2, 'Must produce at least 2 candidate routes');
  });

  // TEST 14: Weighted score determines selected route
  test('TEST 14: Weighted score determines selected route', () => {
    const multi = matcher.dijkstraService.findMultiRoutes('A001', 'H001');
    const primary = multi.primaryRoute;
    assert.ok(primary.score !== undefined, 'Selected route must have score');
    // In multi.candidateRoutes, candidate 0 must have the lowest or equal score
    for (const alt of multi.alternativeRoutes) {
      assert.ok(primary.score <= alt.score, 'Primary route must have best (lowest) score');
    }
  });

  // TEST 15: Rejected ambulance triggers fallback
  test('TEST 15: Rejected ambulance triggers fallback', async () => {
    const pinnedLocation = { latitude: 13.0418, longitude: 80.2341 };
    const req = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: pinnedLocation,
      isManualOverride: true,
    });
    assert.equal(req.status, 'ASSIGNED');
    assert.deepEqual(req.pickupLocation, pinnedLocation, 'The API result must preserve the exact incident pin');
    assert.equal(req.isManualOverride, true, 'The API result must retain manual-pin provenance');
    const firstAmb = req.ambulanceId;
    const firstAssignment = await store.getAssignmentById(req.assignmentId);
    assert.deepEqual(
      firstAssignment.route.waypoints[firstAssignment.route.waypoints.length - 1],
      {
        nodeId: 'DEST_GPS',
        name: 'Patient Pickup Location',
        ...pinnedLocation,
      },
    );

    // Simulate driver rejection
    const assignment = await store.getAssignmentById(req.assignmentId);
    const driver = { id: (await store.getAmbulanceById(firstAmb)).driverId };
    const rej = await ctx.assignmentService.rejectAssignment(req.assignmentId, driver);
    assert.equal(rej.ok, true);

    // Verify fallback attempt 2 was created with a different ambulance
    const attempts = await store.getAttemptsByRequestId(req.requestId);
    assert.ok(attempts.length >= 2, 'Must have at least 2 attempts recorded');
    assert.equal(attempts[0].response, 'REJECTED');
    assert.notEqual(attempts[1].ambulanceId, firstAmb, 'Fallback must select a different ambulance');
    assert.deepEqual((await store.getEmergencyByRequestId(req.requestId)).pickupLocation, pinnedLocation);

    const secondAssignment = store.getAssignmentsForRequest(req.requestId)
      .find((candidate) => candidate.attemptNumber === 2);
    const secondDriver = { id: (await store.getAmbulanceById(secondAssignment.ambulanceId)).driverId };
    const secondRejection = await ctx.assignmentService.rejectAssignment(secondAssignment.id, secondDriver);
    assert.equal(secondRejection.ok, true);
    assert.deepEqual(
      secondAssignment.route.waypoints[secondAssignment.route.waypoints.length - 1],
      {
        nodeId: 'DEST_GPS',
        name: 'Patient Pickup Location',
        ...pinnedLocation,
      },
      'Cascading fallback must route to the original exact pin',
    );

    const allAttempts = await store.getAttemptsByRequestId(req.requestId);
    assert.equal(allAttempts.length, 3, 'A second rejection must produce a third dispatch attempt');
    assert.equal(new Set(allAttempts.map((attempt) => attempt.ambulanceId)).size, allAttempts.length,
      'Every fallback attempt must exclude all previously attempted ambulances');
    assert.deepEqual((await store.getEmergencyByRequestId(req.requestId)).pickupLocation, pinnedLocation);
  });

  // TEST 16: Timed-out ambulance triggers fallback
  test('TEST 16: Timed-out ambulance triggers fallback', async () => {
    const req = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'ACCIDENT',
      victimCount: 1,
      pickupLocation: { latitude: 13.2128, longitude: 80.3180 },
    });
    const firstAmb = req.ambulanceId;
    const assignment = await store.getAssignmentById(req.assignmentId);

    // Trigger timeout directly
    await ctx.fallbackService.handleTimeout(assignment.id);

    const attempts = await store.getAttemptsByRequestId(req.requestId);
    assert.ok(attempts.length >= 2, 'Fallback should record second attempt after timeout');
    assert.equal(attempts[0].response, 'TIMEOUT');
    assert.notEqual(attempts[1].ambulanceId, firstAmb, 'Fallback must select next best candidate');
  });

  // TEST 17: Live GPS follows route segments
  test('TEST 17: Live GPS follows route segments', () => {
    const startLoc = { latitude: 13.2128, longitude: 80.3180 }; // A001
    const destLoc = { latitude: 13.0827, longitude: 80.2707 };  // Central
    const coords = generateRoadPathCoordinates(startLoc, destLoc, 200);

    assert.ok(coords.length > 5, 'Should generate fine-grained road coordinates');
    // First coordinate is start
    assert.equal(coords[0].latitude, startLoc.latitude);
    assert.equal(coords[0].longitude, startLoc.longitude);
    // Last coordinate is destination
    assert.equal(coords[coords.length - 1].latitude, destLoc.latitude);
    assert.equal(coords[coords.length - 1].longitude, destLoc.longitude);

    // Every intermediate coordinate has valid heading and speed
    assert.ok(coords.every(c => typeof c.heading === 'number' && typeof c.speed === 'number'),
      'Coordinates must contain heading and speed');
  });

  // TEST 18: ETA decreases as ambulance moves
  test('TEST 18: ETA decreases as ambulance moves', async () => {
    const req = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
    });
    const ambId = req.ambulanceId;
    const amb = await store.getAmbulanceById(ambId);
    const driver = { id: amb.driverId, role: 'DRIVER' };

    // Far location update
    const loc1 = await ctx.ambulanceService.updateLocation(ambId, {
      latitude: 13.20, longitude: 80.30, speed: 40, heading: 180,
    }, driver);

    // Closer location update
    const loc2 = await ctx.ambulanceService.updateLocation(ambId, {
      latitude: 13.09, longitude: 80.275, speed: 40, heading: 180,
    }, driver);

    assert.ok(loc2.eta <= loc1.eta, `Closer ETA (${loc2.eta}m) must be <= farther ETA (${loc1.eta}m)`);
  });

  // TEST 19: Bystander and hospital receive identical GPS positions
  test('TEST 19: Bystander and hospital receive identical GPS positions', async () => {
    ctx.emittedEvents = [];
    const req = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
    });
    const ambId = req.ambulanceId;
    const amb = await store.getAmbulanceById(ambId);
    const destinationHospitalId = req.destinationHospitalId || 'H001';

    const driver = { id: amb.driverId, role: 'DRIVER' };
    await ctx.ambulanceService.updateLocation(ambId, {
      latitude: 13.1500, longitude: 80.2800, speed: 45, heading: 120,
    }, driver);

    const locEvents = ctx.emittedEvents.filter(e => e.event === 'AMBULANCE_LOCATION_UPDATED');
    const emergencyEvent = locEvents.find(e => e.room === `emergency:${req.requestId}`);
    const hospitalEvent = locEvents.find(e => e.room === `hospital:${destinationHospitalId}`);

    assert.ok(emergencyEvent, 'Emergency room must receive AMBULANCE_LOCATION_UPDATED');
    assert.ok(hospitalEvent, 'Hospital room must receive AMBULANCE_LOCATION_UPDATED');
    assert.deepEqual(emergencyEvent.data, hospitalEvent.data, 'Both clients must receive identical payload');
    assert.equal(emergencyEvent.data.latitude, 13.1500);
    assert.equal(emergencyEvent.data.longitude, 80.2800);
    assert.equal(emergencyEvent.data.speed, 45);
    assert.equal(emergencyEvent.data.heading, 120);
  });

  // TEST 20: After hospital arrival, ambulance becomes AVAILABLE
  test('TEST 20: After hospital arrival, ambulance becomes AVAILABLE', async () => {
    const req = await ctx.emergencyService.createEmergency({ id: 'USER-001' }, {
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.2128, longitude: 80.3180 },
    });
    const ambId = req.ambulanceId;
    const amb = await store.getAmbulanceById(ambId);
    const driver = { id: amb.driverId, role: 'DRIVER' };

    // 1. Accept
    await ctx.assignmentService.acceptAssignment(req.assignmentId, driver);
    // 2. EN_ROUTE_TO_PATIENT
    await ctx.assignmentService.updateAssignmentStatus(req.assignmentId, 'EN_ROUTE_TO_PATIENT', driver);
    // 3. ARRIVED_AT_PATIENT
    await ctx.assignmentService.updateAssignmentStatus(req.assignmentId, 'ARRIVED_AT_PATIENT', driver);
    // 4. PATIENT_ONBOARD
    await ctx.assignmentService.updateAssignmentStatus(req.assignmentId, 'PATIENT_ONBOARD', driver);
    // 5. EN_ROUTE_TO_HOSPITAL
    await ctx.assignmentService.updateAssignmentStatus(req.assignmentId, 'EN_ROUTE_TO_HOSPITAL', driver);
    // 6. ARRIVED_AT_HOSPITAL
    const fin = await ctx.assignmentService.updateAssignmentStatus(req.assignmentId, 'ARRIVED_AT_HOSPITAL', driver);
    assert.equal(fin.ok, true);

    const finishedAmb = await store.getAmbulanceById(ambId);
    assert.equal(finishedAmb.status, 'AVAILABLE', 'Ambulance status must return to AVAILABLE');
    assert.equal(finishedAmb.currentRequestId, null, 'currentRequestId must be cleared');

    const completedReq = await store.getEmergencyByRequestId(req.requestId);
    assert.equal(completedReq.status, 'COMPLETED', 'Emergency request status must be COMPLETED');
  });

  test('TEST 21: Cancellation stops the assigned driver and updates every participant', async () => {
    ctx.emittedEvents = [];
    const requester = { id: 'USER-CANCEL-001', role: 'BYSTANDER' };
    const req = await ctx.emergencyService.createEmergency(requester, {
      emergencyType: 'ACCIDENT',
      victimCount: 1,
      pickupLocation: { latitude: 13.0418, longitude: 80.2341 },
    });
    const ambulance = await store.getAmbulanceById(req.ambulanceId);
    assert.equal(ambulance.status, 'ASSIGNED', 'Ambulance must be assigned before cancellation');
    ctx.emittedEvents = [];

    const result = await ctx.emergencyService.cancelEmergency(req.requestId, requester);

    assert.equal(result.ok, true);
    assert.equal((await store.getEmergencyByRequestId(req.requestId)).status, 'CANCELLED');
    assert.equal((await store.getAssignmentById(req.assignmentId)).status, 'CANCELLED');
    assert.equal((await store.getAmbulanceById(req.ambulanceId)).status, 'AVAILABLE');
    assert.ok(ctx.emittedEvents.some(e =>
      e.room === `driver:${req.ambulanceId}` &&
      e.event === 'ASSIGNMENT_CANCELLED' &&
      e.data.requestId === req.requestId
    ), 'Assigned driver must receive an assignment cancellation');
    assert.ok(ctx.emittedEvents.some(e =>
      e.room === `user:${requester.id}` && e.event === 'STATUS_UPDATED' && e.data.status === 'CANCELLED'
    ), 'Requester must receive cancellation status');
    assert.ok(ctx.emittedEvents.some(e =>
      e.room === `hospital:${req.destinationHospitalId}` && e.event === 'STATUS_UPDATED' && e.data.status === 'CANCELLED'
    ), 'Destination hospital must receive cancellation status');
  });

  test('TEST 22: Fallback demo requires and routes to its supplied pin', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/scenarios', buildScenarioRoutes(ctx));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/scenarios/fallback-demo`;

    try {
      const missingPinResponse = await fetch(baseUrl, { method: 'POST' });
      assert.equal(missingPinResponse.status, 400, 'Fallback demo must not substitute a default pin');

      const pinnedLocation = { latitude: 13.0418, longitude: 80.2341 };
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pickupLocation: pinnedLocation }),
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.ok(result.sequence.length > 0);
      assert.deepEqual(
        result.sequence[0].route.waypoints[result.sequence[0].route.waypoints.length - 1],
        {
          nodeId: 'DEST_GPS',
          name: 'Patient Pickup Location',
          ...pinnedLocation,
        },
        'Fallback candidate route must terminate at the supplied pin',
      );
    } finally {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  });
});
