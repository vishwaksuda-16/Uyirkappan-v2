const buildAuthRoutes = require('./routes/auth.routes');
const buildEmergencyRoutes = require('./routes/emergency.routes');
const buildAmbulanceRoutes = require('./routes/ambulance.routes');
const buildAssignmentRoutes = require('./routes/assignment.routes');
const buildHospitalRoutes = require('./routes/hospital.routes');
const buildDriverRoutes = require('./routes/driver.routes');

module.exports = function buildApiRoutes(ctx) {
  const router = require('express').Router();

  // Root route
  router.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'UyirKappan Backend API',
      documentation: '/api-docs',
      health: '/api/health',
      version: '1.1.0',
      dataStoreMode: ctx.store.mode,
      matcher: ctx.matcher ? 'ready' : undefined,
    });
  });

  // Health check
  router.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'UP',
      matcher: ctx.matcher ? 'ready' : undefined,
      message: 'UyirKappan Backend Running',
      dataStoreMode: ctx.store.mode,
      mongoDb: typeof ctx.dbState === 'function' ? ctx.dbState() : { connected: false, state: 'not-required' },
      time: new Date().toISOString(),
    });
  });

  router.use('/auth', buildAuthRoutes(ctx));
  router.use('/emergency', buildEmergencyRoutes(ctx));
  router.use('/ambulances', buildAmbulanceRoutes(ctx));
  router.use('/assignments', buildAssignmentRoutes(ctx));
  router.use('/hospitals', buildHospitalRoutes(ctx));
  router.use('/driver', buildDriverRoutes(ctx));

  return router;
};