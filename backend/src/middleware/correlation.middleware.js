/**
 * Phase 17 — HTTP Request Correlation & Performance Middleware
 *
 * Attaches a correlation ID to every incoming HTTP request and response header,
 * tracks request duration, and logs structured lifecycle completion events.
 */

const logger = require('../utils/logger');

function generateCorrelationId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `corr-${ts}-${rand}`;
}

module.exports = function correlationMiddleware() {
  return (req, res, next) => {
    const headerCorrId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    const correlationId = (typeof headerCorrId === 'string' && headerCorrId.trim().length > 0)
      ? headerCorrId.trim()
      : generateCorrelationId();

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const path = req.originalUrl || req.url || '';

      // Determine appropriate log level
      let level = 'info';
      if (statusCode >= 500) {
        level = 'error';
      } else if (statusCode >= 400) {
        level = 'warn';
      } else if (path === '/api/health' || path === '/health' || path === '/api/system/health' || path.startsWith('/static')) {
        // High frequency health probes logged at debug to avoid production noise
        level = 'debug';
      }

      logger.log(level, {
        event: 'HTTP_REQUEST_COMPLETED',
        message: `${req.method} ${path} ${statusCode} (${durationMs}ms)`,
        correlationId,
        method: req.method,
        path,
        statusCode,
        durationMs,
        userId: req.user?.id,
        userRole: req.user?.role,
      });
    });

    next();
  };
};
