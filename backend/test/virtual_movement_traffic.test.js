const assert = require('node:assert/strict');
const test = require('node:test');
const { GraphService } = require('../src/matcher/modules/routing/graph.service.js');
const { EmergencyTrackingService } = require('../src/matcher/modules/tracking/emergency-tracking.service.js');
const { TrackingService } = require('../src/matcher/modules/tracking/tracking.service.js');
const { VirtualMovementService } = require('../src/matcher/modules/simulation/virtual-movement.service.js');

test('virtual movement follows route ETA with intermediate telemetry points', async () => {
  const graph = new GraphService();
  graph.addNode({ nodeId: 'N1', latitude: 13.08, longitude: 80.27 });
  graph.addNode({ nodeId: 'N2', latitude: 13.081, longitude: 80.27 });
  const tracking = new TrackingService();
  const movement = new VirtualMovementService(graph, tracking, {
    updateIntervalMs: 20,
    acceleratedTime: false,
    speedMultiplier: 1,
  });
  const route = {
    nodeIds: ['N1', 'N2'],
    distanceKm: 0.1112,
    travelTimeMinutes: 0.003,
  };
  const startedAt = Date.now();
  const updates = await movement.moveAlongRoute('AMB-1', 'REQ-1', route);
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs >= 140, `Expected ETA-paced movement, got ${elapsedMs}ms`);
  assert.ok(updates.length >= 5, `Expected interpolated points, got ${updates.length}`);
  assert.equal(updates[0].latitude, 13.08);
  assert.equal(updates.at(-1).latitude, 13.081);
  assert.ok(updates.slice(1, -1).some((point) => point.latitude > 13.08 && point.latitude < 13.081));
  assert.equal(tracking.getLatestLocation('REQ-1').latitude, 13.081);
});

test('arrival during the hospital leg is not reported as patient arrival', () => {
  const tracking = new TrackingService();
  tracking.updateLocation({
    ambulanceId: 'AMB-1',
    requestId: 'REQ-2',
    latitude: 13.08,
    longitude: 80.27,
    speed: 0,
    heading: 0,
    timestamp: new Date(),
  });
  tracking.updateStatus('REQ-2', 'EN_ROUTE_TO_HOSPITAL');

  const trackingFlow = new EmergencyTrackingService(tracking, {
    calculateETA: () => ({
      estimatedMinutes: 0,
      route: { nodeIds: ['N1'], distanceKm: 0, travelTimeMinutes: 0 },
    }),
  });
  const update = trackingFlow.processLocationUpdate({
    ambulanceId: 'AMB-1',
    requestId: 'REQ-2',
    latitude: 13.081,
    longitude: 80.271,
    speed: 0,
    heading: 0,
    timestamp: new Date(),
  }, { latitude: 13.081, longitude: 80.271 });

  assert.equal(update.status, 'ARRIVED_AT_HOSPITAL');
  assert.equal(update.trackingState.status, 'ARRIVED_AT_HOSPITAL');
});
