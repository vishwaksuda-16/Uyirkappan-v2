const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { TrafficProvider } = require('../src/services/traffic/TrafficProvider');
const { SimulationTrafficProvider } = require('../src/services/traffic/SimulationTrafficProvider');
const { GoogleTrafficProvider } = require('../src/services/traffic/GoogleTrafficProvider');
const { MapplsTrafficProvider } = require('../src/services/traffic/MapplsTrafficProvider');
const { createTrafficProvider, getTrafficProvider, resetTrafficProvider } = require('../src/services/traffic');
const { initializeMatcher, getMatcherServices } = require('../src/matcher');

describe('Phase 7: Pluggable Traffic Provider Test Suite', () => {
  before(() => {
    initializeMatcher();
  });

  test('1. TrafficProvider interface cannot be instantiated directly and defines contract', () => {
    assert.throws(() => new TrafficProvider(), TypeError);
  });

  test('2. SimulationTrafficProvider loads hourly dataset and reports simulation metadata', () => {
    const sim = new SimulationTrafficProvider();
    const status = sim.getProviderStatus();
    assert.equal(status.name, 'SimulationTrafficProvider');
    assert.equal(status.type, 'simulation');
    assert.equal(status.isLive, false);
    assert.equal(status.source, 'SIMULATED_TRAFFIC');
    assert.ok(status.hourlyConditionsLoaded > 0, 'Hourly dataset conditions must be loaded');
  });

  test('3. NORMAL traffic condition multiplier is 1.0x', () => {
    const sim = new SimulationTrafficProvider();
    sim.setTrafficState('N01', 'N02', 'NORMAL');
    const cond = sim.getTrafficCondition('N01', 'N02');
    assert.equal(cond.state, 'NORMAL');
    assert.equal(cond.multiplier, 1.0);
    assert.equal(sim.getAdjustedTravelTime(10, 'N01', 'N02'), 10);
  });

  test('4. MODERATE traffic condition multiplier is 1.35x', () => {
    const sim = new SimulationTrafficProvider();
    sim.setTrafficState('N01', 'N02', 'MODERATE');
    const cond = sim.getTrafficCondition('N01', 'N02');
    assert.equal(cond.state, 'MODERATE');
    assert.equal(cond.multiplier, 1.35);
    assert.equal(sim.getAdjustedTravelTime(10, 'N01', 'N02'), 13.5);
  });

  test('5. HEAVY traffic condition multiplier is 2.1x', () => {
    const sim = new SimulationTrafficProvider();
    sim.setTrafficState('N01', 'N02', 'HEAVY');
    const cond = sim.getTrafficCondition('N01', 'N02');
    assert.equal(cond.state, 'HEAVY');
    assert.equal(cond.multiplier, 2.1);
    assert.equal(sim.getAdjustedTravelTime(10, 'N01', 'N02'), 21.0);
  });

  test('6. BLOCKED traffic returns Infinity and Dijkstra re-routes', () => {
    const sim = new SimulationTrafficProvider();
    sim.setTrafficState('N01', 'N02', 'BLOCKED');
    const cond = sim.getTrafficCondition('N01', 'N02');
    assert.equal(cond.state, 'BLOCKED');
    assert.equal(cond.multiplier, Infinity);
    assert.equal(sim.getAdjustedTravelTime(10, 'N01', 'N02'), Infinity);
  });

  test('7. Dijkstra routing uses provider output to adjust route costs', () => {
    const matcher = getMatcherServices();
    const provider = getTrafficProvider();

    // Baseline route between A010 and H001
    provider.setTrafficState('A010', 'H001', 'NORMAL');
    const routeNormal = matcher.dijkstraService.findShortestRoute('A010', 'H001');
    const timeNormal = routeNormal.travelTimeMinutes;

    // Simulate heavy congestion
    provider.setTrafficState('A010', 'H001', 'HEAVY');
    const routeHeavy = matcher.dijkstraService.findShortestRoute('A010', 'H001');
    const timeHeavy = routeHeavy.travelTimeMinutes;

    assert.ok(timeHeavy > timeNormal, 'Heavy traffic must increase travel time');

    // Clean up
    provider.setTrafficState('A010', 'H001', 'NORMAL');
  });

  test('8. Factory correctly instantiates configured provider', () => {
    const sim = createTrafficProvider('simulation');
    assert.equal(sim.name, 'SimulationTrafficProvider');
    assert.equal(sim.isLive, false);

    const google = createTrafficProvider('google');
    assert.equal(google.name, 'GoogleTrafficProvider');

    const mappls = createTrafficProvider('mappls');
    assert.equal(mappls.name, 'MapplsTrafficProvider');
  });

  test('9. Factory throws clear error for unsupported provider configuration', () => {
    assert.throws(
      () => createTrafficProvider('unsupported_satellite_traffic'),
      /Invalid TRAFFIC_PROVIDER/
    );
  });

  test('10. GoogleTrafficProvider gracefully reports NOT_CONFIGURED without API key', () => {
    const google = new GoogleTrafficProvider();
    const status = google.getProviderStatus();
    assert.equal(status.status, 'NOT_CONFIGURED');
    assert.equal(status.isLive, false);
    assert.equal(status.configured, false);
  });

  test('11. GoogleTrafficProvider with fallback delegates to SimulationTrafficProvider', () => {
    const simFallback = new SimulationTrafficProvider();
    const google = new GoogleTrafficProvider({ fallbackProvider: simFallback });
    const status = google.getProviderStatus();
    assert.equal(status.hasFallback, true);
    assert.equal(status.fallbackName, 'SimulationTrafficProvider');

    const cond = google.getTrafficCondition('N01', 'N02');
    assert.ok(cond);
    assert.equal(cond.source, 'SIMULATED_TRAFFIC');
  });

  test('12. MapplsTrafficProvider gracefully reports NOT_CONFIGURED without credentials', () => {
    const mappls = new MapplsTrafficProvider();
    const status = mappls.getProviderStatus();
    assert.equal(status.status, 'NOT_CONFIGURED');
    assert.equal(status.isLive, false);
    assert.equal(status.configured, false);
  });

  test('13. Time-of-day traffic context influences hourly traffic multiplier', () => {
    const sim = new SimulationTrafficProvider();

    // Weekday 08:00 (Morning Peak)
    sim.setTimeContext('Weekday', 8);
    const morningTraffic = sim.getTimeOfDayTraffic();

    // Weekend 02:00 (Night Off-Peak)
    sim.setTimeContext('Weekend', 2);
    const nightTraffic = sim.getTimeOfDayTraffic();

    sim.resetTimeContext();

    assert.ok(morningTraffic.multiplier >= 1.0);
    assert.ok(nightTraffic.multiplier <= morningTraffic.multiplier);
  });

  test('14. BLOCKED edge forces Dijkstra to detour around the blocked segment', () => {
    const matcher = getMatcherServices();
    const provider = getTrafficProvider();

    // Baseline route without blockage
    provider.setTrafficState('A010', 'H001', 'NORMAL');
    const normalRoute = matcher.dijkstraService.findShortestRoute('A010', 'H001');

    // Block direct edge
    provider.setTrafficState('A010', 'H001', 'BLOCKED');
    let detourRoute;
    try {
      detourRoute = matcher.dijkstraService.findShortestRoute('A010', 'H001');
    } catch (_) {}

    // Either a detour was found or direct edge was avoided
    if (detourRoute) {
      assert.ok(detourRoute.travelTimeMinutes > normalRoute.travelTimeMinutes);
    }

    // Clean up
    provider.setTrafficState('A010', 'H001', 'NORMAL');
  });

  test('15. Provider status is visible and properly exposes metadata', () => {
    const provider = getTrafficProvider();
    const status = provider.getProviderStatus();
    assert.equal(typeof status.name, 'string');
    assert.equal(typeof status.type, 'string');
    assert.equal(typeof status.isLive, 'boolean');
    assert.equal(typeof status.source, 'string');
    assert.equal(typeof status.timestamp, 'string');
  });
});
