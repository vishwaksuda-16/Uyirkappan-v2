const { io } = require('socket.io-client');
const { request, BASE } = require('./client');

const args = {};
process.argv.slice(2).forEach((arg) => {
  const [k, v] = arg.split('=');
  if (k && v) args[k.replace(/^--/, '')] = v;
});

const ambulanceId = args.ambulance || 'AMB-01';
const email = args.email || 'driver1@uyirkappan.com';
const password = args.password || 'password123';
const mode = args.mode || 'accept'; // accept | reject | timeout

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n[${ambulanceId}] Virtual ambulance started (mode=${mode})\n`);
  const session = (await request('POST', '/auth/login', { email, password })).data;
  const token = session.token;
  const amb = (await request('GET', `/ambulances/${ambulanceId}`, null, token)).data.ambulance;

  const socket = io(BASE, { auth: { token } });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Socket connect timeout')), 5000);
    socket.on('connect', () => { clearTimeout(t); res(); });
    socket.on('connect_error', (e) => { clearTimeout(t); rej(e); });
  });

  socket.on('AMBULANCE_ASSIGNED', async (data) => {
    console.log(`[${ambulanceId}] AMBULANCE_ASSIGNED for ${data.requestId}`, data);
    if (mode === 'reject') {
      await request('POST', `/assignments/${data.assignmentId}/reject`, {}, token);
      console.log(`[${ambulanceId}] Rejected ${data.assignmentId}`);
    } else if (mode === 'timeout') {
      console.log(`[${ambulanceId}] Ignoring assignment to simulate timeout...`);
    } else {
      await request('POST', `/assignments/${data.assignmentId}/accept`, {}, token);
      console.log(`[${ambulanceId}] Accepted ${data.assignmentId}`);
      const reqInfo = (await request('GET', `/emergency/${data.requestId}`, null, token)).data.request;
      await runTrip(token, ambulanceId, reqInfo);
    }
  });

  console.log(`Listening for assignments on driver room driver:${ambulanceId}. Press Ctrl+C to exit.\n`);
}

async function runTrip(token, ambulanceId, request) {
  const active = (await request('GET', '/driver/assignment', null, token)).data.assignment;
  const hospital = (await request('GET', `/hospitals/${request.destinationHospitalId}`, null, token)).data.hospital;

  await request('PATCH', `/assignments/${active.id}/status`, { status: 'EN_ROUTE_TO_PATIENT' }, token);
  await moveTo(token, ambulanceId, request.pickupLocation);
  await request('PATCH', `/assignments/${active.id}/status`, { status: 'ARRIVED_AT_PATIENT' }, token);
  await request('PATCH', `/assignments/${active.id}/status`, { status: 'PATIENT_ONBOARD' }, token);
  console.log(`[${ambulanceId}] Patient onboard, heading to ${hospital.name}`);
  await moveTo(token, ambulanceId, hospital.location);
  await request('PATCH', `/assignments/${active.id}/status`, { status: 'EN_ROUTE_TO_HOSPITAL' }, token);
  await request('PATCH', `/assignments/${active.id}/status`, { status: 'ARRIVED_AT_HOSPITAL' }, token);
  console.log(`[${ambulanceId}] Trip complete — emergency completed\n`);
}

async function moveTo(token, ambulanceId, dest) {
  const amb = (await request('GET', `/ambulances/${ambulanceId}`, null, token)).data.ambulance;
  const from = amb.currentLocation;
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const lat = from.latitude + (dest.latitude - from.latitude) * t;
    const lng = from.longitude + (dest.longitude - from.longitude) * t;
    await request('POST', `/ambulances/${ambulanceId}/location`,
      { latitude: lat, longitude: lng, speed: 30, heading: 90 }, token);
    await sleep(1200);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });