const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { initializeMatcher, getMatcherServices } = require('../src/matcher/index');
const { Server } = require('socket.io');
const http = require('http');

describe('Intelligent Matcher Unit & Integration Tests', () => {
  let io;
  let server;
  let matcher;

  test('1. Initialize Matcher with Socket.IO Server', () => {
    server = http.createServer();
    io = new Server(server);
    matcher = initializeMatcher(io);
    assert.ok(matcher, 'Matcher services should be returned');
    assert.ok(matcher.dispatchEngineService, 'Dispatch engine should exist');
    assert.ok(matcher.etaService, 'ETA service should exist');
    assert.ok(matcher.dijkstraService, 'Dijkstra service should exist');
    assert.ok(matcher.trafficService, 'Traffic service should exist');
    assert.ok(matcher.fallbackOrchestratorService, 'Fallback orchestrator should exist');
    assert.ok(matcher.trackingService, 'Tracking service should exist');
    assert.ok(matcher.socketEventsService, 'Socket events service should exist');

    const retrieved = getMatcherServices();
    assert.equal(retrieved, matcher, 'getMatcherServices should return initialized services');
  });

  test('2. Dijkstra Shortest Route & Road Network Routing', () => {
    // Chennai real road network nodes: A020 (Anna Salai/Teynampet Base) -> H007 (Apollo Greams Road)
    const route = matcher.dijkstraService.findShortestRoute('A020', 'H007');
    assert.ok(route, 'Route must exist');
    assert.ok(route.distanceKm > 0, 'Distance should be greater than 0');
    assert.ok(route.travelTimeMinutes > 0, 'Travel time should be greater than 0');
    assert.ok(route.nodeIds.includes('A020'));
    assert.ok(route.nodeIds.includes('H007'));
  });

  test('3. Nearest Node Finding & Dijkstra ETA Calculation', () => {
    // Near A020 (13.0418, 80.2505)
    const currentLocation = { latitude: 13.042, longitude: 80.251 };
    // Near H007 (13.0444, 80.2496)
    const destination = { latitude: 13.044, longitude: 80.249 };

    const etaResult = matcher.etaService.calculateETA(
      'REQ-TEST-01',
      'AMB0001',
      currentLocation,
      destination
    );

    assert.equal(etaResult.requestId, 'REQ-TEST-01');
    assert.equal(etaResult.ambulanceId, 'AMB0001');
    assert.ok(typeof etaResult.estimatedMinutes === 'number');
    assert.ok(etaResult.estimatedMinutes > 0);
    assert.ok(etaResult.route);
    assert.ok(Array.isArray(etaResult.route.nodeIds));
  });

  test('4. Intelligent Dispatch Engine — Candidate Filtering & Multi-Factor Scoring', () => {
    const request = {
      requestId: 'REQ-SCORE-01',
      emergencyType: 'CARDIAC',
      victimCount: 1,
      pickupLocation: { latitude: 13.0444, longitude: 80.2496 }, // at H007 (Apollo Greams Road)
      createdAt: new Date(),
      priority: 'CRITICAL',
    };

    const ambulances = [
      {
        ambulanceId: 'AMB-NEAR',
        currentLocation: { latitude: 13.0418, longitude: 80.2505 }, // A020 (0.31 km to H007)
        availabilityStatus: 'AVAILABLE',
        driverId: 'D1',
        capabilities: ['ICU'],
      },
      {
        ambulanceId: 'AMB-FAR',
        currentLocation: { latitude: 13.2146, longitude: 80.3203 }, // A001 Ennore (>16 km away)
        availabilityStatus: 'AVAILABLE',
        driverId: 'D2',
        capabilities: ['ICU', 'ALS'],
      },
      {
        ambulanceId: 'AMB-BUSY',
        currentLocation: { latitude: 13.0444, longitude: 80.2496 }, // right at H007 but BUSY
        availabilityStatus: 'BUSY',
        driverId: 'D3',
        capabilities: ['ICU'],
      },
    ];

    const decision = matcher.dispatchEngineService.dispatch(
      request,
      ambulances,
      50,
      new Set()
    );

    assert.ok(decision, 'Decision must be generated');
    // AMB-NEAR is selected: AMB-BUSY is filtered out and AMB-FAR has much higher travel time/distance
    assert.equal(decision.selectedAmbulanceId, 'AMB-NEAR');
    assert.ok(decision.estimatedTravelTime > 0);
    assert.ok(decision.score >= 0);
  });

  test('5. Fallback Orchestration — Excludes Failed Ambulance and Selects Next Best', () => {
    const request = {
      requestId: 'REQ-FALLBACK-01',
      emergencyType: 'TRAUMA',
      victimCount: 1,
      pickupLocation: { latitude: 13.0444, longitude: 80.2496 }, // at H007
      createdAt: new Date(),
      priority: 'HIGH',
    };

    const ambulances = [
      {
        ambulanceId: 'AMB-CAND-1',
        currentLocation: { latitude: 13.0418, longitude: 80.2505 }, // A020
        availabilityStatus: 'AVAILABLE',
        driverId: 'D1',
        capabilities: ['ICU'],
      },
      {
        ambulanceId: 'AMB-CAND-2',
        currentLocation: { latitude: 13.0604, longitude: 80.2420 }, // A019 Nungambakkam
        availabilityStatus: 'AVAILABLE',
        driverId: 'D2',
        capabilities: ['ICU'],
      },
    ];

    // Initial dispatch picks AMB-CAND-1
    const firstDecision = matcher.dispatchEngineService.dispatch(
      request,
      ambulances,
      50,
      new Set()
    );
    assert.equal(firstDecision.selectedAmbulanceId, 'AMB-CAND-1');

    // Driver rejects -> exclude AMB-CAND-1 -> re-dispatch
    const excluded = new Set(['AMB-CAND-1']);
    const fallbackDecision = matcher.dispatchEngineService.dispatch(
      request,
      ambulances,
      50,
      excluded
    );

    assert.equal(fallbackDecision.selectedAmbulanceId, 'AMB-CAND-2', 'Should select AMB-CAND-2 upon fallback');
  });

  test('6. Tracking Service and Position Updates', () => {
    const update = {
      requestId: 'REQ-TRACK-01',
      ambulanceId: 'AMB0001',
      currentLocation: { latitude: 13.0827, longitude: 80.2707 },
      speed: 45,
      heading: 180,
      timestamp: new Date(),
    };

    matcher.trackingService.updateLocation(update);

    const latest = matcher.trackingService.getLatestLocation('REQ-TRACK-01');
    assert.ok(latest);
    assert.equal(latest.ambulanceId, 'AMB0001');
    assert.equal(latest.currentLocation.latitude, 13.0827);
    assert.equal(latest.currentLocation.longitude, 80.2707);
    assert.equal(latest.speed, 45);

    const state = matcher.trackingService.getTrackingState('REQ-TRACK-01');
    assert.ok(state);
    assert.equal(state.status, 'ASSIGNED');
  });
});
