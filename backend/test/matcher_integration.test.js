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
    // Virtual road network nodes: N1 (Central), N2, N3, N4, N5
    const route = matcher.dijkstraService.findShortestRoute('N1', 'N3');
    assert.ok(route, 'Route must exist');
    assert.ok(route.distanceKm > 0, 'Distance should be greater than 0');
    assert.ok(route.travelTimeMinutes > 0, 'Travel time should be greater than 0');
    assert.deepEqual(route.nodeIds, ['N1', 'N2', 'N3'], 'Shortest path N1 -> N3 goes via N2');
  });

  test('3. Nearest Node Finding & Dijkstra ETA Calculation', () => {
    // Near N1
    const currentLocation = { latitude: 13.0827, longitude: 80.2707 };
    // Near N3
    const destination = { latitude: 13.0880, longitude: 80.2800 };

    const etaResult = matcher.etaService.calculateETA(
      'REQ-TEST-01',
      'AMB-01',
      currentLocation,
      destination
    );

    assert.equal(etaResult.requestId, 'REQ-TEST-01');
    assert.equal(etaResult.ambulanceId, 'AMB-01');
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
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 }, // at N1
      createdAt: new Date(),
      priority: 'CRITICAL',
    };

    const ambulances = [
      {
        ambulanceId: 'AMB-N4',
        currentLocation: { latitude: 13.0780, longitude: 80.2680 }, // N4 (0.4 km, 3 min to N1)
        availabilityStatus: 'AVAILABLE',
        driverId: 'D1',
        capabilities: ['ICU'],
      },
      {
        ambulanceId: 'AMB-N3',
        currentLocation: { latitude: 13.0880, longitude: 80.2800 }, // N3 (1.1 km, 9 min to N1)
        availabilityStatus: 'AVAILABLE',
        driverId: 'D2',
        capabilities: ['ICU', 'ALS'],
      },
      {
        ambulanceId: 'AMB-BUSY',
        currentLocation: { latitude: 13.0827, longitude: 80.2707 }, // right at N1 but BUSY
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
    // AMB-N4 is selected: AMB-BUSY is filtered out and AMB-N3 has higher travel time/distance
    assert.equal(decision.selectedAmbulanceId, 'AMB-N4');
    assert.ok(decision.estimatedTravelTime > 0);
    assert.ok(decision.score >= 0);
  });

  test('5. Fallback Orchestration — Excludes Failed Ambulance and Selects Next Best', () => {
    const request = {
      requestId: 'REQ-FALLBACK-01',
      emergencyType: 'TRAUMA',
      victimCount: 1,
      pickupLocation: { latitude: 13.0827, longitude: 80.2707 }, // at N1
      createdAt: new Date(),
      priority: 'HIGH',
    };

    const ambulances = [
      {
        ambulanceId: 'AMB-N4',
        currentLocation: { latitude: 13.0780, longitude: 80.2680 }, // N4 (closest/fastest to N1)
        availabilityStatus: 'AVAILABLE',
        driverId: 'D1',
        capabilities: ['ICU'],
      },
      {
        ambulanceId: 'AMB-N2',
        currentLocation: { latitude: 13.0850, longitude: 80.2750 }, // N2 (second closest to N1)
        availabilityStatus: 'AVAILABLE',
        driverId: 'D2',
        capabilities: ['ICU'],
      },
    ];

    // Initial dispatch picks AMB-N4
    const firstDecision = matcher.dispatchEngineService.dispatch(
      request,
      ambulances,
      50,
      new Set()
    );
    assert.equal(firstDecision.selectedAmbulanceId, 'AMB-N4');

    // Driver rejects -> exclude AMB-N4 -> re-dispatch
    const excluded = new Set(['AMB-N4']);
    const fallbackDecision = matcher.dispatchEngineService.dispatch(
      request,
      ambulances,
      50,
      excluded
    );

    assert.equal(fallbackDecision.selectedAmbulanceId, 'AMB-N2', 'Should select AMB-N2 upon fallback');
  });

  test('6. Tracking Service and Position Updates', () => {
    const update = {
      requestId: 'REQ-TRACK-01',
      ambulanceId: 'AMB-01',
      currentLocation: { latitude: 13.0827, longitude: 80.2707 },
      speed: 45,
      heading: 180,
      timestamp: new Date(),
    };

    matcher.trackingService.updateLocation(update);

    const latest = matcher.trackingService.getLatestLocation('REQ-TRACK-01');
    assert.ok(latest);
    assert.equal(latest.ambulanceId, 'AMB-01');
    assert.equal(latest.currentLocation.latitude, 13.0827);
    assert.equal(latest.currentLocation.longitude, 80.2707);
    assert.equal(latest.speed, 45);

    const state = matcher.trackingService.getTrackingState('REQ-TRACK-01');
    assert.ok(state);
    assert.equal(state.status, 'ASSIGNED');
  });
});
