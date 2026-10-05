/**
 * End-to-End Perfect Scenario Integration Test
 * Simulates all 4 modules working together:
 * 1. Bystander (Module 1)
 * 2. Driver (Module 2) — dynamically determined by matcher
 * 3. Hospital Dashboard (Module 3)
 * 4. Backend & Intelligent Matcher (Module 4)
 *
 * FIX: Driver login and ambulance IDs are now dynamically derived from the
 * dispatch response instead of being hardcoded, so the test works regardless
 * of which ambulance the Intelligent Matcher selects.
 */

import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5000';
const API_URL = `${BACKEND_URL}/api`;

async function postJson(url, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${url} failed with ${res.status}: ${txt}`);
  }
  return res.json();
}

async function patchJson(url, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH ${url} failed with ${res.status}: ${txt}`);
  }
  return res.json();
}

async function getJson(url, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GET ${url} failed with ${res.status}: ${txt}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPerfectScenario() {
  console.log('============================================================');
  console.log('STARTING PERFECT SCENARIO END-TO-END INTEGRATION TEST');
  console.log('============================================================\n');

  // STEP 1: Log in Bystander and Hospital Staff first
  console.log('1. Authenticating Bystander and Hospital Staff...');
  const bystanderAuth = await postJson(`${API_URL}/auth/login`, {
    email: 'bystander@uyirkappan.demo',
    password: 'password123',
  });
  assert.ok(bystanderAuth.token, 'Bystander must receive token');
  console.log('   ✓ Bystander authenticated');

  const hospitalAuth = await postJson(`${API_URL}/auth/login`, {
    email: 'staff@uyirkappan.demo',
    password: 'password123',
  });
  assert.ok(hospitalAuth.token, 'Hospital staff must receive token');
  console.log('   ✓ Hospital staff authenticated (H001)');

  // STEP 2: Create Emergency FIRST to discover which ambulance/driver is assigned
  console.log('\n2. Bystander submits emergency incident (POST /api/emergency)...');
  const emergencyPayload = {
    emergencyType: 'CARDIAC',
    victimCount: 1,
    pickupLocation: { latitude: 13.0330, longitude: 80.2210 },
  };
  const createdEmergency = await postJson(`${API_URL}/emergency`, emergencyPayload, bystanderAuth.token);
  const requestId = createdEmergency.requestId;
  const assignedAmbulanceId = createdEmergency.ambulanceId;
  const assignedDriverId = createdEmergency.driverId;
  const assignmentId = createdEmergency.assignmentId;
  const destinationHospitalId = createdEmergency.destinationHospitalId;

  assert.ok(requestId, 'Emergency creation must return requestId');
  assert.ok(assignedAmbulanceId, 'Emergency must have ambulanceId');
  assert.ok(assignedDriverId, 'Emergency must have driverId');
  assert.ok(assignmentId, 'Emergency must have assignmentId');
  console.log(`   ✓ Emergency created: ${requestId}`);
  console.log(`   ✓ Intelligent Matcher selected: ${assignedAmbulanceId} (Driver: ${assignedDriverId}, ETA: ${createdEmergency.eta} min)`);
  console.log(`   ✓ Destination hospital: ${destinationHospitalId}`);

  // STEP 3: Now log in as the ACTUAL assigned driver (not hardcoded driver1)
  console.log('\n3. Authenticating the assigned driver...');
  const driverEmail = `${assignedDriverId.toLowerCase()}@uyirkappan.demo`;
  const driverAuth = await postJson(`${API_URL}/auth/login`, {
    email: driverEmail,
    password: 'password123',
  });
  assert.ok(driverAuth.token, `Driver ${assignedDriverId} must receive token`);
  console.log(`   ✓ Driver ${assignedDriverId} authenticated (${driverEmail})`);

  // STEP 4: Connect Socket.IO clients
  console.log('\n4. Connecting real-time Socket.IO channels...');
  const bystanderSocket = io(BACKEND_URL, {
    auth: { token: bystanderAuth.token },
    transports: ['websocket', 'polling'],
  });

  const driverSocket = io(BACKEND_URL, {
    auth: { token: driverAuth.token },
    transports: ['websocket', 'polling'],
  });

  const hospitalSocket = io(BACKEND_URL, {
    auth: { token: hospitalAuth.token },
    transports: ['websocket', 'polling'],
  });

  await Promise.all([
    new Promise((resolve) => bystanderSocket.once('connect', resolve)),
    new Promise((resolve) => driverSocket.once('connect', resolve)),
    new Promise((resolve) => hospitalSocket.once('connect', resolve)),
  ]);
  console.log('   ✓ All 3 Socket.IO clients connected');

  // Join relevant rooms
  bystanderSocket.emit('join_emergency', requestId);
  driverSocket.emit('join_emergency', requestId);
  hospitalSocket.emit('join_emergency', requestId);
  if (destinationHospitalId) {
    hospitalSocket.emit('join:hospital', { hospitalId: destinationHospitalId });
  }
  console.log(`   ✓ All clients joined emergency:${requestId}`);

  // Track received socket events across clients
  const bystanderEvents = [];
  const driverEvents = [];
  const hospitalEvents = [];

  bystanderSocket.onAny((event, data) => bystanderEvents.push({ event, data }));
  driverSocket.onAny((event, data) => driverEvents.push({ event, data }));
  hospitalSocket.onAny((event, data) => hospitalEvents.push({ event, data }));

  // STEP 5: Driver accepts assignment
  console.log('\n5. Driver accepts assignment (POST /api/assignments/:id/accept)...');
  const acceptResult = await postJson(`${API_URL}/assignments/${assignmentId}/accept`, {}, driverAuth.token);
  assert.ok(acceptResult.success, 'Driver acceptance must succeed');
  console.log(`   ✓ Driver accepted! ETA: ${acceptResult.eta} min`);

  await sleep(400);

  // STEP 6: Driver transitions to EN_ROUTE_TO_PATIENT and streams GPS location
  console.log('\n6. Driver transitions to EN_ROUTE_TO_PATIENT and streams GPS telemetry...');
  await patchJson(`${API_URL}/assignments/${assignmentId}/status`, { status: 'EN_ROUTE_TO_PATIENT' }, driverAuth.token);
  console.log('   ✓ Status updated to EN_ROUTE_TO_PATIENT');

  // Set up listeners for telemetry and ETA updates on Bystander & Hospital
  let bystanderGotTelemetry = false;
  let hospitalGotTelemetry = false;

  bystanderSocket.on('AMBULANCE_LOCATION_UPDATED', () => { bystanderGotTelemetry = true; });
  hospitalSocket.on('AMBULANCE_LOCATION_UPDATED', () => { hospitalGotTelemetry = true; });

  // Use the ACTUAL assigned ambulance ID for GPS posting
  const locationRes = await postJson(
    `${API_URL}/ambulances/${assignedAmbulanceId}/location`,
    { latitude: 13.0750, longitude: 80.2650, speed: 45, heading: 120 },
    driverAuth.token
  );
  console.log(`   ✓ GPS telemetry posted for ${assignedAmbulanceId}: ${locationRes.ambulance?.currentLocation?.latitude}, ${locationRes.ambulance?.currentLocation?.longitude} (ETA: ${locationRes.eta} min)`);

  await sleep(500);
  assert.ok(bystanderGotTelemetry, 'Bystander must receive AMBULANCE_LOCATION_UPDATED via Socket.IO');
  assert.ok(hospitalGotTelemetry, 'Hospital must receive AMBULANCE_LOCATION_UPDATED via Socket.IO');
  console.log('   ✓ Both Bystander and Hospital received live location & dynamic ETA via Socket.IO');

  // STEP 7: Lifecycle progression (ARRIVED_AT_PATIENT -> PATIENT_ONBOARD -> EN_ROUTE_TO_HOSPITAL)
  console.log('\n7. Driver advances through patient stabilization lifecycle...');
  await patchJson(`${API_URL}/assignments/${assignmentId}/status`, { status: 'ARRIVED_AT_PATIENT' }, driverAuth.token);
  console.log('   ✓ Status updated: ARRIVED_AT_PATIENT');
  await sleep(300);

  await patchJson(`${API_URL}/assignments/${assignmentId}/status`, { status: 'PATIENT_ONBOARD' }, driverAuth.token);
  console.log('   ✓ Status updated: PATIENT_ONBOARD');
  await sleep(300);

  await patchJson(`${API_URL}/assignments/${assignmentId}/status`, { status: 'EN_ROUTE_TO_HOSPITAL' }, driverAuth.token);
  console.log('   ✓ Status updated: EN_ROUTE_TO_HOSPITAL');
  await sleep(300);

  // STEP 8: Driver arrives at Hospital -> Triggers EMERGENCY_COMPLETED
  console.log('\n8. Driver arrives at Hospital (ARRIVED_AT_HOSPITAL)...');
  let bystanderCompleted = false;
  let hospitalCompleted = false;

  bystanderSocket.on('EMERGENCY_COMPLETED', () => { bystanderCompleted = true; });
  hospitalSocket.on('EMERGENCY_COMPLETED', () => { hospitalCompleted = true; });

  await patchJson(`${API_URL}/assignments/${assignmentId}/status`, { status: 'ARRIVED_AT_HOSPITAL' }, driverAuth.token);
  console.log('   ✓ Status updated: ARRIVED_AT_HOSPITAL');

  await sleep(600);
  assert.ok(bystanderCompleted, 'Bystander app must receive EMERGENCY_COMPLETED event');
  assert.ok(hospitalCompleted, 'Hospital dashboard must receive EMERGENCY_COMPLETED event');
  console.log('   ✓ Both Bystander and Hospital received EMERGENCY_COMPLETED');

  // STEP 9: Verify Hospital History contains the completed case
  console.log('\n9. Verifying Hospital Emergency History and Ambulance Status...');

  // Use the actual destination hospital ID for history query
  if (destinationHospitalId) {
    const historyRes = await getJson(`${API_URL}/hospitals/${destinationHospitalId}/emergency-history`, hospitalAuth.token);
    const historyList = historyRes.history || historyRes;
    const foundInHistory = historyList.some((item) => item.requestId === requestId);
    assert.ok(foundInHistory, `Emergency ${requestId} must appear in Hospital Emergency History`);
    console.log(`   ✓ Emergency ${requestId} confirmed in hospital ${destinationHospitalId} completed history`);
  }

  // Use the actual assigned ambulance ID for status check
  const ambData = await getJson(`${API_URL}/ambulances/${assignedAmbulanceId}`, driverAuth.token);
  assert.equal(ambData.ambulance.status, 'AVAILABLE', `${assignedAmbulanceId} status must return to AVAILABLE`);
  console.log(`   ✓ Ambulance ${assignedAmbulanceId} status successfully restored to ${ambData.ambulance.status}`);

  // Cleanup
  bystanderSocket.disconnect();
  driverSocket.disconnect();
  hospitalSocket.disconnect();

  console.log('\n============================================================');
  console.log('PERFECT SCENARIO INTEGRATION TEST PASSED SUCCESSFULLY!');
  console.log('============================================================\n');
}

runPerfectScenario().catch((err) => {
  console.error('\n❌ PERFECT SCENARIO TEST FAILED:', err);
  process.exit(1);
});
