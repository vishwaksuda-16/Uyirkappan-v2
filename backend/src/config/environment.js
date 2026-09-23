const path = require('path');

// Resolve backend/.env from this file so startup works from any working directory.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const DATA_STORE_MODE = String(
  process.env.DATA_STORE_MODE || process.env.DB_DRIVER || 'memory'
).toLowerCase();

if (!['memory', 'mongodb'].includes(DATA_STORE_MODE)) {
  throw new Error(`Invalid DATA_STORE_MODE "${DATA_STORE_MODE}" — use "memory" or "mongodb"`);
}

module.exports = {
  PORT: Number(process.env.PORT) || 5000,
  BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
  JWT_SECRET: process.env.JWT_SECRET || 'uyirkappan-dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATA_STORE_MODE,
  MONGODB_URI: process.env.MONGODB_URI || process.env.DB_URL || '',
  DRIVER_RESPONSE_TIMEOUT_MS: Number(process.env.DRIVER_RESPONSE_TIMEOUT_MS) || 60000,
};