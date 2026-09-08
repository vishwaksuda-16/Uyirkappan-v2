const { request } = require('./client');

const count = Number(process.argv[2]) || Number(process.env.N) || 5;
const types = ['CARDIAC', 'ACCIDENT', 'RESPIRATORY', 'TRAUMA', 'STROKE'];

async function main() {
  const session = (await request('POST', '/auth/login',
    { email: 'bystander@uyirkappan.com', password: 'password123' })).data;
  console.log(`\nCreating ${count} emergency requests...\n`);
  for (let i = 0; i < count; i++) {
    const r = await request('POST', '/emergency', {
      emergencyType: types[i % types.length],
      victimCount: 1,
      pickupLocation: { latitude: 13.0027 + i * 0.01, longitude: 80.1707 + i * 0.01 },
    }, session.token);
    console.log(`[${i + 1}/${count}] ${r.data.requestId} -> status=${r.data.status} ambulance=${r.data.ambulanceId}`);
  }
  console.log(`\nDone. Watch the server logs for dispatch/fallback activity.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });