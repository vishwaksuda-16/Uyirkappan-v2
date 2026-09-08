const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/environment');
const { log } = require('../utils/logger');

async function main() {
  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set. Add it to backend/.env (see .env.example).');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const { MongoStore } = require('../data/mongoStore');
  const store = new MongoStore();
  await store.seed();
  const counts = {};
  for (const key of ['users', 'ambulances', 'hospitals', 'emergency_requests', 'assignments', 'request_attempts', 'location_history']) {
    counts[key] = await mongoose.connection.db.collection(key).countDocuments();
  }
  log('info', 'MongoDB seed complete', counts);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});