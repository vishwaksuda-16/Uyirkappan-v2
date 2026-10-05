const path = require('path');

// Ensure .env is loaded safely relative to the backend root directory
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { DataClassification } = require('./provenance');

/**
 * Validates port numbers between 1 and 65535.
 */
function parsePort(val, defaultPort = 5000) {
  const p = Number(val);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    return defaultPort;
  }
  return p;
}

/**
 * Parses and sanitizes CORS origins from environment.
 * Supports comma-separated strings or defaults to permissive development policy.
 */
function parseCorsOrigins(val) {
  if (!val || val === '*') return '*';
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Sanitizes MongoDB connection URI to mask credentials in diagnostic displays.
 */
function maskMongoUri(uri) {
  if (!uri) return '';
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '*****';
    }
    return parsed.toString();
  } catch {
    // If not a standard URL string, return host and database segment if detectable
    return uri.replace(/:([^@]+)@/, ':*****@');
  }
}

/**
 * Factory that constructs and strictly validates the centralized configuration object.
 */
function createConfig(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const isDevelopment = !isProduction && !isTest;

  // Server
  const port = parsePort(env.PORT, 5000);
  const host = env.HOST || '0.0.0.0';
  const baseUrl = env.BASE_URL || `http://localhost:${port}`;
  const autoKillOnConflict = env.AUTO_KILL_ON_CONFLICT === 'true';

  // Database
  const dataStoreMode = String(env.DATA_STORE_MODE || env.DB_DRIVER || 'memory').toLowerCase();
  if (!['memory', 'mongodb'].includes(dataStoreMode)) {
    throw new Error(`Invalid DATA_STORE_MODE "${dataStoreMode}" — allowed values: "memory", "mongodb"`);
  }

  const mongoUri = env.MONGODB_URI || env.DB_URL || '';
  if (dataStoreMode === 'mongodb' && !mongoUri) {
    throw new Error('DATA_STORE_MODE=mongodb requires MONGODB_URI (add it to backend/.env or environment)');
  }

  // Traffic
  const trafficProvider = String(env.TRAFFIC_PROVIDER || 'simulation').toLowerCase();
  if (!['simulation', 'simulated', 'google', 'mappls'].includes(trafficProvider)) {
    throw new Error(`Invalid TRAFFIC_PROVIDER "${trafficProvider}" — allowed values: "simulation", "google", "mappls"`);
  }

  const trafficFallback = String(env.TRAFFIC_PROVIDER_FALLBACK || 'none').toLowerCase();
  const googleApiKey = env.GOOGLE_MAPS_API_KEY || '';
  const mapplsClientId = env.MAPPLS_CLIENT_ID || '';
  const mapplsClientSecret = env.MAPPLS_CLIENT_SECRET || '';

  // Routing Graph Source
  const routingGraphSource = String(env.ROUTING_GRAPH_SOURCE || 'existing').toLowerCase();
  if (!['existing', 'kml_augmented', 'kml'].includes(routingGraphSource)) {
    throw new Error(`Invalid ROUTING_GRAPH_SOURCE "${routingGraphSource}" — allowed values: "existing", "kml_augmented"`);
  }
  const maxSnappingDistanceMeters = Number(env.MAX_SNAPPING_DISTANCE_METERS) || 500;

  // Authentication
  const defaultDevSecret = 'uyirkappan-dev-secret-change-me';
  const jwtSecret = env.JWT_SECRET || defaultDevSecret;
  if (isProduction && (!env.JWT_SECRET || env.JWT_SECRET === defaultDevSecret)) {
    throw new Error('CRITICAL SECURITY ERROR: Production environment requires a strong custom JWT_SECRET');
  }

  const jwtExpiresIn = env.JWT_EXPIRES_IN || '7d';
  const driverTimeoutMs = Number(env.DRIVER_RESPONSE_TIMEOUT_MS) || 60000;

  // Datasets & Infrastructure Paths (Stably resolved)
  const defaultDatasetDir = path.resolve(__dirname, '../../../Datasets/Datasets');
  const datasetDir = env.DATASET_DIR && require('fs').existsSync(env.DATASET_DIR)
    ? path.resolve(env.DATASET_DIR)
    : defaultDatasetDir;

  const defaultKmlPath = path.resolve(__dirname, '../../../Datasets/Spatial/chennai_road_centerline.kml');
  const roadKmlPath = env.CHENNAI_ROAD_KML_PATH && require('fs').existsSync(env.CHENNAI_ROAD_KML_PATH)
    ? path.resolve(env.CHENNAI_ROAD_KML_PATH)
    : defaultKmlPath;

  const defaultBaselinePath = path.resolve(__dirname, '../../../../dummy_ambulance_data.xlsx');
  const baselineDatasetPath = env.BASELINE_DATASET_PATH && require('fs').existsSync(env.BASELINE_DATASET_PATH)
    ? path.resolve(env.BASELINE_DATASET_PATH)
    : defaultBaselinePath;

  const config = Object.freeze({
    environment: Object.freeze({
      nodeEnv,
      isDevelopment,
      isTest,
      isProduction,
    }),

    server: Object.freeze({
      host,
      port,
      baseUrl,
      corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
      autoKillOnConflict,
    }),

    database: Object.freeze({
      mode: dataStoreMode,
      mongoUri,
      timeoutMs: Number(env.MONGODB_TIMEOUT_MS) || 10000,
      isMemory: dataStoreMode === 'memory',
      isMongo: dataStoreMode === 'mongodb',
    }),

    traffic: Object.freeze({
      provider: trafficProvider,
      fallbackProvider: trafficFallback,
      googleMapsApiKey: googleApiKey,
      mapplsClientId,
      mapplsClientSecret,
      googleConfigured: Boolean(googleApiKey && googleApiKey.trim().length > 0),
      mapplsConfigured: Boolean(mapplsClientId && mapplsClientSecret),
    }),

    auth: Object.freeze({
      jwtSecret,
      jwtExpiresIn,
      driverResponseTimeoutMs: driverTimeoutMs,
      bcryptSaltRounds: 10,
    }),

    routing: Object.freeze({
      graphSource: routingGraphSource === 'kml' ? 'kml_augmented' : routingGraphSource,
      maxSnappingDistanceMeters,
      approachSpeedKmph: 25.0,
      freeFlowSpeedKmph: 50.0,
      toleranceKm: 2.0,
      bounds: Object.freeze({
        minLat: 12.5,
        maxLat: 13.5,
        minLon: 79.5,
        maxLon: 80.5,
      }),
    }),

    socket: Object.freeze({
      corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
      pingTimeout: 20000,
      pingInterval: 25000,
    }),

    datasets: Object.freeze({
      datasetDir,
      roadKmlPath,
      baselineDatasetPath,
      fleetSourceClassification: DataClassification.SIMULATION,
      baselineClassification: DataClassification.REFERENCE_BASELINE,
    }),

    logging: Object.freeze({
      level: env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      format: (env.LOG_FORMAT || (isProduction ? 'json' : 'text')).toLowerCase(),
      silent: env.LOG_SILENT === 'true' || (isTest && env.LOG_TEST !== 'true'),
      redaction: true,
      requestCorrelation: true,
      socketEvents: true,
      staleTelemetryThresholdSeconds: 45,
    }),

    /**
     * Produces a sanitized copy of configuration safe for diagnostic endpoints and public logs.
     * All secrets and credentials are completely redacted.
     */
    getSanitized() {
      return {
        environment: this.environment.nodeEnv,
        server: {
          host: this.server.host,
          port: this.server.port,
          baseUrl: this.server.baseUrl,
        },
        database: {
          mode: this.database.mode,
          configured: this.database.isMongo ? Boolean(this.database.mongoUri) : true,
          maskedUri: this.database.isMongo ? maskMongoUri(this.database.mongoUri) : 'in-memory',
        },
        traffic: {
          provider: this.traffic.provider,
          fallbackProvider: this.traffic.fallbackProvider,
          googleConfigured: this.traffic.googleConfigured,
          mapplsConfigured: this.traffic.mapplsConfigured,
        },
        auth: {
          jwtExpiresIn: this.auth.jwtExpiresIn,
          driverResponseTimeoutMs: this.auth.driverResponseTimeoutMs,
          secretConfigured: Boolean(this.auth.jwtSecret),
        },
        routing: this.routing,
        logging: this.logging,
        datasets: {
          fleetClassification: this.datasets.fleetSourceClassification,
          fleetSourceClassification: this.datasets.fleetSourceClassification,
          baselineClassification: this.datasets.baselineClassification,
        },
      };
    },
  });

  return config;
}

// Global Authoritative Singleton Instance
const config = createConfig();

module.exports = {
  config,
  createConfig,
  maskMongoUri,
  parsePort,
};
