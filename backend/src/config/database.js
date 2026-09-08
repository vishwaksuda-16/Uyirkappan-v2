const mongoose = require('mongoose');
const { MONGODB_URI } = require('./environment');
const { log } = require('../utils/logger');

const STATE_LABELS = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

// Sanitized — never print credentials.
const safeSummary = () => {
  try {
    const url = new URL(MONGODB_URI);
    return `${url.host}${url.pathname}`;
  } catch {
    return '[mongodb-uri]';
  }
};

function dbState() {
  return {
    connected: mongoose.connection.readyState === 1,
    state: STATE_LABELS[mongoose.connection.readyState] || String(mongoose.connection.readyState),
  };
}

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('DATA_STORE_MODE=mongodb requires MONGODB_URI (add it to backend/.env)');
  }
  mongoose.connection.on('connected', () => {
    log('info', `MongoDB connected (${safeSummary()})`);
  });
  mongoose.connection.on('error', (err) => {
    log('error', `MongoDB connection error: ${err.message}`);
  });
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  return dbState();
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    log('info', 'MongoDB disconnected');
  }
}

module.exports = { connectDB, disconnectDB, dbState };