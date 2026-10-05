/**
 * Phase 17 — Centralized Structured Logger & Observability Engine
 *
 * Implements:
 * 1. Consistent structured JSON / text log format
 * 2. Mandatory request correlation and emergency requestId preservation
 * 3. Centralized sensitive-data redaction (JWTs, passwords, auth headers, Mongo URIs)
 * 4. Configurable log levels (DEBUG, INFO, WARN, ERROR)
 * 5. Memory ring buffer and observer sinks for automated verification and test inspection
 * 6. Standardized error taxonomy integration
 */

const { ErrorCode } = require('./errors');

const LOG_LEVELS = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
});

// Ring buffer for diagnostic queries and unit-test inspection
const MAX_LOG_BUFFER = 500;
const logBuffer = [];
const sinks = new Set();

let currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
let isSilent = process.env.LOG_SILENT === 'true';
let logFormat = (process.env.LOG_FORMAT || 'text').toLowerCase();

/**
 * Recursively redacts sensitive values such as passwords, JWTs, API keys, and authorization headers.
 */
function redactSensitive(data, depth = 0) {
  if (data === null || data === undefined || depth > 6) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Check for raw JWT pattern
      if (/^ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(data.trim())) {
        return '[REDACTED_JWT]';
      }
      // Check for Bearer token string
      if (/^Bearer\s+ey[A-Za-z0-9_-]+/i.test(data.trim())) {
        return 'Bearer [REDACTED_TOKEN]';
      }
      // Check for MongoDB URI containing password
      if (/mongodb(\+srv)?:\/\/[^:]+:([^@]+)@/i.test(data)) {
        return data.replace(/:([^@]+)@/, ':*****@');
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitive(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    if (/password|secret|token|jwt|authorization|apiKey|authHeader|passwd/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = redactSensitive(val, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Constructs a canonical structured log entry.
 */
function formatRecord(level, messageOrObject, data = undefined) {
  const ts = new Date().toISOString();
  let base = {};

  if (typeof messageOrObject === 'object' && messageOrObject !== null) {
    base = { ...messageOrObject };
  } else {
    base.message = String(messageOrObject || '');
    if (data && typeof data === 'object') {
      Object.assign(base, data);
    } else if (data !== undefined) {
      base.extra = data;
    }
  }

  const sanitized = redactSensitive(base);

  const record = {
    timestamp: ts,
    level: level.toUpperCase(),
    service: sanitized.service || 'backend',
    environment: process.env.NODE_ENV || 'development',
    event: sanitized.event || (level === 'error' ? 'SYSTEM_ERROR' : 'APPLICATION_LOG'),
    message: sanitized.message || '',
  };

  // Correlate canonical identifiers if provided
  if (sanitized.requestId) record.requestId = sanitized.requestId;
  if (sanitized.emergencyId) record.emergencyId = sanitized.emergencyId;
  if (!record.emergencyId && record.requestId) record.emergencyId = record.requestId;
  if (sanitized.correlationId) record.correlationId = sanitized.correlationId;
  if (sanitized.assignmentId) record.assignmentId = sanitized.assignmentId;
  if (sanitized.ambulanceId) record.ambulanceId = sanitized.ambulanceId;
  if (sanitized.driverId) record.driverId = sanitized.driverId;
  if (sanitized.hospitalId) record.hospitalId = sanitized.hospitalId;
  if (sanitized.userId) record.userId = sanitized.userId;
  if (sanitized.eventId) record.eventId = sanitized.eventId;
  if (sanitized.seqNum !== undefined) record.seqNum = sanitized.seqNum;
  if (sanitized.durationMs !== undefined) record.durationMs = sanitized.durationMs;
  if (sanitized.status) record.status = sanitized.status;
  if (sanitized.errorCode) record.errorCode = sanitized.errorCode;

  // Preserve any other custom metadata fields cleanly
  for (const [k, v] of Object.entries(sanitized)) {
    if (!(k in record) && k !== 'extra') {
      record[k] = v;
    }
  }
  if (sanitized.extra !== undefined) {
    record.extra = sanitized.extra;
  }

  return record;
}

/**
 * Central logger module.
 */
const logger = {
  ErrorCode,

  setLevel(level) {
    if (level && level.toLowerCase() in LOG_LEVELS) {
      currentLevel = level.toLowerCase();
    }
  },

  getLevel() {
    return currentLevel;
  },

  setSilent(silent) {
    isSilent = Boolean(silent);
  },

  setFormat(format) {
    if (format === 'json' || format === 'text') {
      logFormat = format;
    }
  },

  addSink(fn) {
    if (typeof fn === 'function') sinks.add(fn);
  },

  removeSink(fn) {
    sinks.delete(fn);
  },

  getRecentLogs(limit = 100) {
    return logBuffer.slice(-Math.max(1, limit));
  },

  clearLogs() {
    logBuffer.length = 0;
  },

  redact(data) {
    return redactSensitive(data);
  },

  log(level, messageOrObject, data = undefined) {
    const normLevel = (level || 'info').toLowerCase();
    const entryLevelPriority = LOG_LEVELS[normLevel] ?? LOG_LEVELS.info;
    const currentPriority = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;

    const record = formatRecord(normLevel, messageOrObject, data);

    // Maintain in-memory ring buffer for tests & system diagnostics
    logBuffer.push(record);
    if (logBuffer.length > MAX_LOG_BUFFER) {
      logBuffer.shift();
    }

    // Notify registered sinks (e.g. automated test listeners)
    for (const sink of sinks) {
      try {
        sink(record);
      } catch (_) {}
    }

    // Skip stdout if below current configured log level or if explicitly silenced
    if (entryLevelPriority < currentPriority || isSilent) {
      return record;
    }

    if (logFormat === 'json') {
      console.log(JSON.stringify(record));
    } else {
      const timeSlice = record.timestamp.slice(11, 19);
      const corrPart = record.requestId ? ` [req:${record.requestId}]` : (record.correlationId ? ` [corr:${record.correlationId}]` : '');
      const eventPart = record.event && record.event !== 'APPLICATION_LOG' ? ` [${record.event}]` : '';
      console.log(`[${timeSlice}] [${record.level}]${corrPart}${eventPart} ${record.message}`);
    }

    return record;
  },

  debug(m, d) {
    return this.log('debug', m, d);
  },

  info(m, d) {
    return this.log('info', m, d);
  },

  warn(m, d) {
    return this.log('warn', m, d);
  },

  error(m, d) {
    return this.log('error', m, d);
  },
};

module.exports = logger;