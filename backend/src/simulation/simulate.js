const { io } = require('socket.io-client');
const { request, BASE } = require('./client');
const { generateRoadPathCoordinates } = require('./roadRouteSimulator');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, password) {
  const r = await request('POST', '/auth/login', { email, password });
  if (!r.data.success) throw new Error(`Login failed: ${email}`);
  return r.data;
}

async function connectSocket(token) {
  const socket = io(BASE, { auth: { token } });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Socket connect timeout')), 5000);
    socket.on('connect', () => { clearTimeout(t); res(); });
    socket.on('connect_error', (e) => { clearTimeout(t); rej(e); });
  });
  return socket;
}

function waitForEvent(socket, event, predicate, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    const h = (data) => {
      if (predicate && !predicate(data)) return;
      clearTimeout(t);
      socket.off(event, h);
      resolve(data);
    };
    socket.on(event, h);
  });
}

async function moveTo(token, ambulanceId, dest, requestId) {
  const amb = (await request('GET', `/ambulances/${ambulanceId}`, null, token)).data.ambulance;
  const from = amb.currentLocation;

  let path = [];
  try {
    const res = generateRoadPathCoordinates(from, dest);
    path = res.pathCoordinates;
  } catch (_) {
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      path.push({
        latitude: from.latitude + (dest.latitude - from.latitude) * t,
        longitude: from.longitude + (dest.longitude - from.longitude) * t,
        speed: 35,
        heading: 90,
      });
    }
  }

  for (const pt of path) {
    await request('POST', `/ambulances/${ambulanceId}/location`, {
      latitude: pt.latitude,
      longitude: pt.longitude,
      speed: pt.speed || 35,
      heading: pt.heading || 0,
      requestId,
    }, token);
    await sleep(400);
  }
}

async function main() {
  console.log('\n=== UyirKappan End-to-End Simulation ===\n');

  const bystander = await login('bystander@uyirkappan.demo', 'password123');
  const driver1 = await login('driver1@uyirkappan.demo', 'password123');
  const driver2 = await login('driver2@uyirkappan.demo', 'password123');

  const bs = await connectSocket(bystander.token);
  const d1 = await connectSocket(driver1.token);
  const d2 = await connectSocket(driver2.token);

  const events = ['EMERGENCY_CREATED', 'AMBULANCE_ASSIGNED', 'ASSIGNMENT_ACCEPTED',
    'ASSIGNMENT_REJECTED', 'AMBULANCE_LOCATION_UPDATED', 'ETA_UPDATED', 'STATUS_UPDATED',
    'FALLBACK_STARTED', 'AMBULANCE_REASSIGNED', 'AMBULANCE_ARRIVED', 'EMERGENCY_COMPLETED'];
  events.forEach((ev) => {
    bs.on(ev, (d) => console.log(`[bystander] ${ev}: ${JSON.stringify(d)}`));
    d1.on(ev, (d) => console.log(`[driver-1] ${ev}: ${JSON.stringify(d)}`));
    d2.on(ev, (d) => console.log(`[driver-2] ${ev}: ${JSON.stringify(d)}`));
  });

  // Step 1: bystander creates an emergency.
  const created = await request('POST', '/emergency', {
    emergencyType: 'CARDIAC',
    victimCount: 1,
    pickupLocation: { latitude: 13.0827, longitude: 80.2707 },
  }, bystander.token);
  if (!created.data.success) throw new Error(`Create emergency failed: ${created.data.message}`);
  const requestId = created.data.requestId;
  console.log(`\n[1] Emergency created: ${requestId} -> ${created.data.status}, ambulance=${created.data.ambulanceId}`);
  bs.emit('join_emergency', requestId);

  // Step 2: driver-1 receives assignment and rejects to trigger fallback.
  const d1Assigned = await waitForEvent(d1, 'AMBULANCE_ASSIGNED', (d) => d.requestId === requestId);
  console.log(`\n[2] Driver-1 got ${d1Assigned.assignmentId} — rejecting to trigger fallback`);
  await request('POST', `/assignments/${d1Assigned.assignmentId}/reject`, {}, driver1.token);

  // Step 3: driver-2 receives the re-assignment and accepts.
  const d2Assigned = await waitForEvent(d2, 'AMBULANCE_ASSIGNED', (d) => d.requestId === requestId);
  console.log(`\n[3] Driver-2 got ${d2Assigned.assignmentId} (attempt ${d2Assigned.attemptNumber || '?'}) — accepting`);
  await request('POST', `/assignments/${d2Assigned.assignmentId}/accept`, {}, driver2.token);

  // Step 4-5: driver-2 runs the trip (to patient, then to hospital).
  const reqInfo = (await request('GET', `/emergency/${requestId}`, null, driver2.token)).data.request;
  const hospital = (await request('GET', `/hospitals/${reqInfo.destinationHospitalId}`, null, driver2.token)).data.hospital;
  console.log(`\n[4] En route to patient at ${JSON.stringify(reqInfo.pickupLocation)}, destination ${hospital.name}`);
  await request('PATCH', `/assignments/${d2Assigned.assignmentId}/status`, { status: 'EN_ROUTE_TO_PATIENT' }, driver2.token);
  await moveTo(driver2.token, reqInfo.ambulanceId, reqInfo.pickupLocation);
  await request('PATCH', `/assignments/${d2Assigned.assignmentId}/status`, { status: 'ARRIVED_AT_PATIENT' }, driver2.token);
  await request('PATCH', `/assignments/${d2Assigned.assignmentId}/status`, { status: 'PATIENT_ONBOARD' }, driver2.token);
  console.log('\n[5] Patient onboard — en route to hospital');
  await moveTo(driver2.token, reqInfo.ambulanceId, hospital.location);
  await request('PATCH', `/assignments/${d2Assigned.assignmentId}/status`, { status: 'EN_ROUTE_TO_HOSPITAL' }, driver2.token);
  await request('PATCH', `/assignments/${d2Assigned.assignmentId}/status`, { status: 'ARRIVED_AT_HOSPITAL' }, driver2.token);

  // Step 6: verify final state and fallback attempts.
  const finalReq = (await request('GET', `/emergency/${requestId}`, null, bystander.token)).data.request;
  console.log(`\n[6] Final status = ${finalReq.status}`);
  console.log('    Assignment attempts:');
  finalReq.attempts.forEach((a) =>
    console.log(`      Attempt ${a.attemptNumber}: ${a.ambulanceId} -> ${a.response}`));
  console.log('\n=== Simulation complete ===\n');

  bs.disconnect(); d1.disconnect(); d2.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });