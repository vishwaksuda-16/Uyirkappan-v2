const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStore } = require('../src/data/memoryStore');
const { initializeMatcher, getMatcherServices } = require('../src/matcher/index');
const HospitalService = require('../src/services/hospital.service');
const DispatchService = require('../src/services/dispatch.service');
const { datasetLoader } = require('../src/data/datasetLoader');

describe('UYIRKAPPAN — Dynamic Routing, Road-Segment Projection & Traffic Sensitivity Validation', () => {
  let store;
  let matcher;
  let hospitalService;
  let dispatchService;

  test('Setup Environment and Datasets', async () => {
    datasetLoader.loadAll();
    assert.equal(datasetLoader.roadNodes.length, 70, 'Must load exactly 70 real nodes');
    assert.equal(datasetLoader.roadSegments.length, 182, 'Must load exactly 182 real segments');

    store = new MemoryStore();
    await store.seed();

    initializeMatcher(null);
    matcher = getMatcherServices();
    hospitalService = new HospitalService({ store });
    dispatchService = new DispatchService(store, matcher.etaService);

    assert.ok(matcher.dijkstraService);
    assert.ok(matcher.nearestSegmentService);
    assert.ok(matcher.trafficService);
  });

  test('Requirement 16: Dynamic-location integration test using 5 emergency_requests.csv coordinates', async () => {
    // Select 5 geographically distinct emergency requests across Chennai
    const targetRequestIds = ['REQ00001', 'REQ00002', 'REQ00003', 'REQ00004', 'REQ00005'];
    const requests = targetRequestIds.map(id => datasetLoader.emergencyRequests.find(r => r.requestId === id));

    const results = [];
    const hospitalsSeen = new Set();
    const ambulancesSeen = new Set();
    const distancesSeen = new Set();
    const etasSeen = new Set();

    console.log('\n================================================================================');
    console.log('5-REQUEST DYNAMIC-LOCATION VALIDATION (emergency_requests.csv)');
    console.log('================================================================================');

    for (const req of requests) {
      assert.ok(req, `Request ${req.requestId} must exist in dataset`);
      const patientCoord = { latitude: req.latitude, longitude: req.longitude };

      // 1. Select Hospital dynamically using patient GPS and capability
      const hospitalDecision = await hospitalService.selectBestHospital({
        pickupLocation: patientCoord,
        emergencyType: req.emergencyType
      });
      const selectedHospital = hospitalDecision.selectedHospital;
      assert.ok(selectedHospital, `Hospital must be selected for ${req.requestId}`);

      // 2. Select Ambulance dynamically using Dijkstra over road network
      const dispatchDecision = await dispatchService.findBestAmbulance({
        requestId: req.requestId,
        emergencyType: req.emergencyType,
        victimCount: 1,
        pickupLocation: patientCoord
      });
      assert.ok(dispatchDecision, `Ambulance must be dispatched for ${req.requestId}`);

      const route = dispatchDecision.route;
      const waypoints = route.waypoints || [];
      const originCoord = waypoints[0] ? [waypoints[0].latitude, waypoints[0].longitude] : null;
      const destCoord = waypoints[waypoints.length - 1] ? [waypoints[waypoints.length - 1].latitude, waypoints[waypoints.length - 1].longitude] : null;
      const trafficMultiplier = matcher.trafficService.getTimeOfDayTraffic().multiplier;
      const altCount = dispatchDecision.alternativeRoutes ? dispatchDecision.alternativeRoutes.length : 0;
      const routeCost = dispatchDecision.score; // standardized cost

      // Print required output
      console.log(`\n------------------------------------------------------------`);
      console.log(`requestId:            ${req.requestId} (${req.area})`);
      console.log(`patient coordinates:  [${req.latitude}, ${req.longitude}]`);
      console.log(`selected hospital:    ${selectedHospital.id} — ${selectedHospital.name}`);
      console.log(`selected ambulance:   ${dispatchDecision.ambulance.id} (${dispatchDecision.ambulance.driverId})`);
      console.log(`route origin:         [${originCoord ? originCoord.join(', ') : 'N/A'}]`);
      console.log(`route destination:    [${destCoord ? destCoord.join(', ') : 'N/A'}]`);
      console.log(`distance:             ${dispatchDecision.distance} km`);
      console.log(`ETA:                  ${dispatchDecision.estimatedTravelTime} min`);
      console.log(`traffic:              ${trafficMultiplier}x`);
      console.log(`route cost (score):   ${typeof routeCost === 'number' ? routeCost.toFixed(3) : routeCost}`);
      console.log(`alternative route count: ${altCount}`);

      // Collect for diversity verification
      hospitalsSeen.add(selectedHospital.id);
      ambulancesSeen.add(dispatchDecision.ambulance.id);
      distancesSeen.add(dispatchDecision.distance);
      etasSeen.add(dispatchDecision.estimatedTravelTime);

      // Verify route endpoints match actual GPS
      assert.ok(Math.abs(destCoord[0] - req.latitude) < 0.0001, 'Route destination latitude must match patient GPS');
      assert.ok(Math.abs(destCoord[1] - req.longitude) < 0.0001, 'Route destination longitude must match patient GPS');
      assert.ok(Math.abs(originCoord[0] - dispatchDecision.ambulance.currentLocation.latitude) < 0.0001, 'Route origin latitude must match ambulance GPS');
      assert.ok(Math.abs(originCoord[1] - dispatchDecision.ambulance.currentLocation.longitude) < 0.0001, 'Route origin longitude must match ambulance GPS');

      results.push({
        requestId: req.requestId,
        hospital: selectedHospital.id,
        ambulance: dispatchDecision.ambulance.id,
        distance: dispatchDecision.distance,
        eta: dispatchDecision.estimatedTravelTime,
        cost: routeCost,
        altCount
      });
    }

    console.log('\n================================================================================');
    console.log(`Distinct hospitals selected:  ${hospitalsSeen.size} / 5 (${Array.from(hospitalsSeen).join(', ')})`);
    console.log(`Distinct ambulances selected: ${ambulancesSeen.size} / 5 (${Array.from(ambulancesSeen).join(', ')})`);
    console.log(`Distinct ETAs observed:       ${etasSeen.size} / 5 (${Array.from(etasSeen).join(', ')})`);
    console.log('================================================================================\n');

    // Verify diversity across different locations
    assert.ok(hospitalsSeen.size >= 3, `Expected at least 3 distinct hospitals across 5 locations, got ${hospitalsSeen.size}`);
    assert.ok(ambulancesSeen.size >= 4, `Expected at least 4 distinct ambulances across 5 locations, got ${ambulancesSeen.size}`);
    assert.ok(etasSeen.size >= 3, `Expected at least 3 distinct ETAs across 5 locations, got ${etasSeen.size}`);
  });

  test('Requirement 17: Traffic sensitivity testing (OFF-PEAK vs PEAK)', async () => {
    const origin = { latitude: 13.063136, longitude: 80.253616 }; // Thousand Lights
    const dest = { latitude: 13.081, longitude: 80.2774 };       // Park Town / RGGGH

    // 1. Evaluate OFF-PEAK (Weekday 03:00 AM)
    matcher.trafficService.setTimeContext('Weekday', 3);
    const offPeakTraffic = matcher.trafficService.getTimeOfDayTraffic();
    const offPeakRoute = matcher.dijkstraService.findDynamicRoute(origin, dest);

    // 2. Evaluate PEAK (Weekday 08:00 AM)
    matcher.trafficService.setTimeContext('Weekday', 8);
    const peakTraffic = matcher.trafficService.getTimeOfDayTraffic();
    const peakRoute = matcher.dijkstraService.findDynamicRoute(origin, dest);

    // Reset traffic context
    matcher.trafficService.resetTimeContext();

    console.log('\n================================================================================');
    console.log('TRAFFIC SENSITIVITY TESTING (Weekday Off-Peak vs Peak)');
    console.log('================================================================================');
    console.log(`OFF-PEAK (Hour 3): state=${offPeakTraffic.state}, multiplier=${offPeakTraffic.multiplier}x, distance=${offPeakRoute.distanceKm} km, ETA=${Math.round(offPeakRoute.travelTimeMinutes)} min (raw: ${offPeakRoute.travelTimeMinutes.toFixed(2)}m)`);
    console.log(`PEAK     (Hour 8): state=${peakTraffic.state}, multiplier=${peakTraffic.multiplier}x, distance=${peakRoute.distanceKm} km, ETA=${Math.round(peakRoute.travelTimeMinutes)} min (raw: ${peakRoute.travelTimeMinutes.toFixed(2)}m)`);
    const ratio = peakRoute.travelTimeMinutes / offPeakRoute.travelTimeMinutes;
    console.log(`Sensitivity Ratio: ${ratio.toFixed(2)}x (Expected ~1.99x)`);
    console.log('================================================================================\n');

    assert.equal(offPeakTraffic.state, 'NORMAL');
    assert.equal(offPeakTraffic.multiplier, 1.0);
    assert.equal(peakTraffic.state, 'HEAVY');
    assert.equal(peakTraffic.multiplier, 1.99);

    assert.ok(peakRoute.travelTimeMinutes > offPeakRoute.travelTimeMinutes, 'Peak travel time must be greater than off-peak travel time');
    assert.ok(Math.abs(ratio - 1.99) < 0.05, `Ratio ${ratio} must closely match traffic_conditions.csv speed_multiplier of 1.99`);
    assert.equal(offPeakRoute.distanceKm, peakRoute.distanceKm, 'Distance must remain identical for identical geographic points');
  });

  test('Requirement 1 & 2: Road segment projection and temporary graph nodes', async () => {
    const originGps = { latitude: 13.063136, longitude: 80.253616 };
    const destGps = { latitude: 13.081, longitude: 80.2774 };

    const { dynamicGraph, origProj, destProj } = matcher.dijkstraService.buildDynamicGraph(originGps, destGps);

    // Verify temporary node injection
    assert.ok(dynamicGraph.getNode('ORIGIN_GPS'), 'Must inject ORIGIN_GPS temporary node');
    assert.ok(dynamicGraph.getNode('DEST_GPS'), 'Must inject DEST_GPS temporary node');
    assert.equal(dynamicGraph.getNode('ORIGIN_GPS').latitude, originGps.latitude);
    assert.equal(dynamicGraph.getNode('ORIGIN_GPS').longitude, originGps.longitude);
    assert.equal(dynamicGraph.getNode('DEST_GPS').latitude, destGps.latitude);
    assert.equal(dynamicGraph.getNode('DEST_GPS').longitude, destGps.longitude);

    // Verify projection properties
    assert.ok(origProj.segmentId, 'Origin must project onto a valid road segment');
    assert.ok(origProj.t >= 0 && origProj.t <= 1, 'Origin projection scalar t must be between 0 and 1');
    assert.ok(destProj.segmentId, 'Destination must project onto a valid road segment');
    assert.ok(destProj.t >= 0 && destProj.t <= 1, 'Destination projection scalar t must be between 0 and 1');

    // Verify neighbors connectivity
    const originNeighbors = dynamicGraph.getNeighbors('ORIGIN_GPS');
    assert.ok(originNeighbors.length > 0, 'ORIGIN_GPS must connect to road network nodes');
  });

  test('Requirement 9, 10, 11: Alternative routes handling & no fake routes', async () => {
    // 1. Case where genuine alternative corridor exists (e.g. Thousand Lights to RGGGH)
    const corridorMulti = matcher.dijkstraService.findDynamicMultiRoutes(
      { latitude: 13.063136, longitude: 80.253616 },
      { latitude: 13.081, longitude: 80.2774 }
    );
    assert.ok(corridorMulti.primaryRoute);
    assert.ok(corridorMulti.candidateRoutes.length >= 1);
    if (corridorMulti.alternativeRoutes.length > 0) {
      assert.notEqual(corridorMulti.alternativeRoutes[0].nodeIds.join(','), corridorMulti.primaryRoute.nodeIds.join(','), 'Alternative route must differ in corridor from primary');
    }

    // 2. Case where single corridor or local dead-end has no secondary corridor
    const localMulti = matcher.dijkstraService.findDynamicMultiRoutes(
      { latitude: 13.2128, longitude: 80.318086 }, // Ennore Base
      { latitude: 13.2128, longitude: 80.3180 }     // 20m away on Ennore road
    );
    assert.equal(localMulti.alternativeRoutes.length, 0, 'No alternative route must be fabricated for local segment');
    assert.equal(localMulti.alternativeReason, 'Alternative route unavailable in supplied road-network dataset.');
  });

  test('Requirement 12 & 13: Never display fake nodes (Node 10, 12, 15, 17, 19, 24)', async () => {
    const forbiddenNodes = ['Node 10', 'Node 12', 'Node 15', 'Node 17', 'Node 19', 'Node 24', 'N1', 'N2', 'N3', 'N4', 'N5'];
    const res = matcher.dijkstraService.findDynamicRoute(
      { latitude: 13.030903, longitude: 80.272724 },
      { latitude: 13.081, longitude: 80.2774 }
    );
    for (const wp of res.waypoints) {
      assert.ok(!forbiddenNodes.includes(wp.nodeId), `Forbidden synthetic node ${wp.nodeId} must never appear in waypoints`);
      assert.ok(!forbiddenNodes.includes(wp.name), `Forbidden synthetic node name ${wp.name} must never appear in waypoints`);
    }
  });

  test('Requirement 18: Score terminology standardized to cost (with backward-compatible score alias)', async () => {
    const multi = matcher.dijkstraService.findDynamicMultiRoutes(
      { latitude: 13.063136, longitude: 80.253616 },
      { latitude: 13.081, longitude: 80.2774 }
    );
    assert.ok('cost' in multi.primaryRoute, 'Primary route must provide cost property');
    assert.ok('score' in multi.primaryRoute, 'Primary route must provide score alias');
    assert.equal(multi.primaryRoute.cost, multi.primaryRoute.score, 'cost and score must be identical');

    const dispatch = await dispatchService.findBestAmbulance({
      requestId: 'REQ_TERM_TEST',
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.063136, longitude: 80.253616 }
    });
    assert.ok('score' in dispatch, 'Dispatch must expose score');
    assert.ok(dispatch.candidates.every(c => 'cost' in c && 'score' in c), 'Every candidate must have cost and score');
    assert.ok(dispatch.decisionReason.includes('cost') || dispatch.decisionReason.includes('optimal'), 'Decision reason must reference cost or optimal responder');
  });

  test('Requirement 19: Debug API structure verification', async () => {
    const origin = { latitude: 13.063136, longitude: 80.253616 };
    const dest = { latitude: 13.081, longitude: 80.2774 };

    const multi = matcher.dijkstraService.findDynamicMultiRoutes(origin, dest);
    const traffic = matcher.trafficService.getTimeOfDayTraffic();

    // Emulate system.routes.js payload structure
    const debugPayload = {
      currentGps: origin,
      destinationGps: dest,
      originSegment: {
        segmentId: multi.originSegment.segmentId,
        startNodeId: multi.originSegment.startNodeId,
        endNodeId: multi.originSegment.endNodeId,
        distanceToSegmentKm: multi.originSegment.distanceToSegmentKm,
        oneWay: multi.originSegment.oneWay,
      },
      destinationSegment: {
        segmentId: multi.destinationSegment.segmentId,
        startNodeId: multi.destinationSegment.startNodeId,
        endNodeId: multi.destinationSegment.endNodeId,
        distanceToSegmentKm: multi.destinationSegment.distanceToSegmentKm,
        oneWay: multi.destinationSegment.oneWay,
      },
      selectedRouteId: multi.primaryRoute.routeId,
      alternativeRouteIds: multi.alternativeRoutes.map(r => r.routeId),
      distanceKm: multi.primaryRoute.distanceKm,
      etaMinutes: Math.max(1, Math.round(multi.primaryRoute.travelTimeMinutes)),
      trafficMultiplier: traffic.multiplier,
      cost: multi.primaryRoute.cost,
      score: multi.primaryRoute.score,
      selectionReason: multi.selectionReason,
      alternativeReason: multi.alternativeReason,
    };

    assert.equal(debugPayload.selectedRouteId, 'ROUTE-PRIMARY');
    assert.ok(debugPayload.originSegment.segmentId);
    assert.ok(debugPayload.destinationSegment.segmentId);
    assert.ok(typeof debugPayload.distanceKm === 'number');
    assert.ok(typeof debugPayload.etaMinutes === 'number');
    assert.ok(typeof debugPayload.trafficMultiplier === 'number');
    assert.ok(typeof debugPayload.cost === 'number');
    assert.ok(debugPayload.selectionReason);
    assert.ok(debugPayload.alternativeReason);
  });
});
