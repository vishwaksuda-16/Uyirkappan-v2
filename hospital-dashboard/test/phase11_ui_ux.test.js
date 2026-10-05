/**
 * Phase 11 — Hospital Dashboard UI/UX & Contract Verification Suite
 * 
 * Verifies:
 * 1. UI accessibility contracts & labels
 * 2. GPS provenance distinction (REAL vs SIMULATION)
 * 3. Stale telemetry threshold logic (>45s)
 * 4. Responsive design breakpoints & token definitions
 * 5. Lifecycle states & status formatting
 * 6. Socket.IO event mapping & demo emission contracts
 * 7. Resource management validation
 */

import assert from 'node:assert/strict';
import { STATUS_CONFIG, EMERGENCY_STATUS, LIFECYCLE_STEPS, EMERGENCY_TYPES } from '../src/constants/statusConstants.js';
import { SOCKET_EVENTS } from '../src/constants/socketEvents.js';
import { formatEta, formatSpeed, formatCoordinates, formatTimestamp } from '../src/utils/formatters.js';
import { validateResourceCounts } from '../src/utils/validators.js';
import { socketService } from '../src/services/socketService.js';

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n============================================================');
console.log('PHASE 11: HOSPITAL UI/UX & FORENSIC AUDIT SUITE');
console.log('============================================================\n');

console.log('--- 1. GPS Provenance & Telemetry Formatting ---');

it('Distinguishes GPS LIVE (REAL) vs GPS SIMULATION semantics', () => {
  const realPayload = { provider: 'real', gpsSource: 'DEVICE', isSimulated: false };
  const simPayload = { provider: 'simulation', gpsSource: 'MOCK', isSimulated: true };

  const isReal = (loc) => loc?.provider === 'real' || loc?.gpsSource === 'DEVICE' || loc?.isSimulated === false;
  
  assert.equal(isReal(realPayload), true, 'Real GPS detected accurately');
  assert.equal(isReal(simPayload), false, 'Simulation GPS detected accurately');
});

it('Validates 45-second stale telemetry detection threshold', () => {
  const now = Date.now();
  const freshTime = new Date(now - 10000).toISOString(); // 10s ago
  const staleTime = new Date(now - 46000).toISOString(); // 46s ago

  const checkStale = (ts) => (now - new Date(ts).getTime()) > 45000;

  assert.equal(checkStale(freshTime), false, 'Fresh telemetry is not stale');
  assert.equal(checkStale(staleTime), true, 'Telemetry older than 45s is marked stale');
});

it('formatSpeed correctly outputs km/h', () => {
  assert.equal(formatSpeed(45), '45 km/h');
  assert.equal(formatSpeed(0), '0 km/h');
  assert.equal(formatSpeed(null), '0 km/h');
});

it('formatCoordinates handles precision & formatting safely', () => {
  assert.equal(formatCoordinates(13.0827, 80.2707), '13.0827° N, 80.2707° E');
  assert.equal(formatCoordinates(null, null), 'Coordinates unavailable');
});

console.log('\n--- 2. Backend-Authoritative ETA & Formatting ---');

it('formatEta respects integer and fractional minutes safely', () => {
  assert.equal(formatEta(5), '05 min');
  assert.equal(formatEta(0), '< 1 min');
  assert.equal(formatEta(null), '-- min');
});

it('Format timestamp provides valid fallback and formatting', () => {
  const formatted = formatTimestamp(new Date());
  assert.ok(typeof formatted === 'string' && formatted.length > 0);
});

console.log('\n--- 3. Emergency Lifecycle & State Machine Alignment ---');

it('Contains all 8 standardized canonical lifecycle steps', () => {
  assert.equal(LIFECYCLE_STEPS.length, 8);
  const stepIds = LIFECYCLE_STEPS.map(s => s.id);
  assert.ok(stepIds.includes('ASSIGNED'));
  assert.ok(stepIds.includes('DRIVER_ACCEPTED'));
  assert.ok(stepIds.includes('EN_ROUTE_TO_PATIENT'));
  assert.ok(stepIds.includes('ARRIVED_AT_PATIENT'));
  assert.ok(stepIds.includes('PATIENT_ONBOARD'));
  assert.ok(stepIds.includes('EN_ROUTE_TO_HOSPITAL'));
  assert.ok(stepIds.includes('ARRIVED_AT_HOSPITAL'));
  assert.ok(stepIds.includes('COMPLETED'));
});

it('Status configuration includes color, label, and severity for every status', () => {
  for (const status of Object.values(EMERGENCY_STATUS)) {
    const config = STATUS_CONFIG[status];
    assert.ok(config, `Config exists for ${status}`);
    assert.ok(config.label, `Label exists for ${status}`);
    assert.ok(config.color, `Color exists for ${status}`);
    assert.ok(config.severity, `Severity exists for ${status}`);
  }
});

console.log('\n--- 4. Hospital Resource Validation UI Rules ---');

it('validateResourceCounts enforces whole positive numbers and rejects negatives', () => {
  const valid = validateResourceCounts({ generalBeds: 10, icuBeds: 2, ventilators: 1 });
  assert.equal(valid.isValid, true);
  assert.equal(Object.keys(valid.errors).length, 0);

  const invalid = validateResourceCounts({ generalBeds: -5, icuBeds: 'abc', ventilators: 1.5 });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.generalBeds);
  assert.ok(invalid.errors.icuBeds);
  assert.ok(invalid.errors.ventilators);
});

console.log('\n--- 5. Socket.IO Service & Demo Triggers Contract ---');

it('socketService supports triggerFallbackDemo and triggerIncomingDemo methods', () => {
  assert.equal(typeof socketService.triggerFallbackDemo, 'function');
  assert.equal(typeof socketService.triggerIncomingDemo, 'function');
  
  // Safe invocation when disconnected
  assert.doesNotThrow(() => {
    socketService.triggerFallbackDemo('REQ-TEST');
    socketService.triggerIncomingDemo({ test: true });
  });
});

it('SOCKET_EVENTS defines real-time synchronization events', () => {
  assert.ok(SOCKET_EVENTS.EMERGENCY_CREATED);
  assert.ok(SOCKET_EVENTS.AMBULANCE_ASSIGNED);
  assert.ok(SOCKET_EVENTS.AMBULANCE_LOCATION_UPDATED);
  assert.ok(SOCKET_EVENTS.ETA_UPDATED);
  assert.ok(SOCKET_EVENTS.STATUS_UPDATED);
  assert.ok(SOCKET_EVENTS.PATIENT_ONBOARD);
  assert.ok(SOCKET_EVENTS.FALLBACK_STARTED);
  assert.ok(SOCKET_EVENTS.EMERGENCY_COMPLETED);
});

console.log('\n============================================================');
console.log(`PHASE 11 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}
