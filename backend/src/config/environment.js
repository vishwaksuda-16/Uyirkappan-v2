/**
 * Legacy environment export adapter.
 * Delegates to the authoritative centralized configuration in ./index.js.
 * Preserves backwards compatibility for all existing callers across the backend.
 */
const { config } = require('./index');

module.exports = {
  PORT: config.server.port,
  BASE_URL: config.server.baseUrl,
  JWT_SECRET: config.auth.jwtSecret,
  JWT_EXPIRES_IN: config.auth.jwtExpiresIn,
  DATA_STORE_MODE: config.database.mode,
  MONGODB_URI: config.database.mongoUri,
  DRIVER_RESPONSE_TIMEOUT_MS: config.auth.driverResponseTimeoutMs,
  TRAFFIC_PROVIDER: config.traffic.provider,
  TRAFFIC_PROVIDER_FALLBACK: config.traffic.fallbackProvider,
  GOOGLE_MAPS_API_KEY: config.traffic.googleMapsApiKey,
  MAPPLS_CLIENT_ID: config.traffic.mapplsClientId,
  MAPPLS_CLIENT_SECRET: config.traffic.mapplsClientSecret,
  ROUTING_GRAPH_SOURCE: config.routing.graphSource,
};