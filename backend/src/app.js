const buildAuthRoutes = require('./routes/auth.routes');
const buildEmergencyRoutes = require('./routes/emergency.routes');
const buildAmbulanceRoutes = require('./routes/ambulance.routes');
const buildAssignmentRoutes = require('./routes/assignment.routes');
const buildHospitalRoutes = require('./routes/hospital.routes');
const buildDriverRoutes = require('./routes/driver.routes');
const buildDriversRoutes = require('./routes/drivers.routes');
const buildSystemRoutes = require('./routes/system.routes');
const buildExperimentRoutes = require('./routes/experiment.routes');
const buildScenarioRoutes = require('./routes/scenario.routes');
const buildEvidenceRoutes = require('./routes/evidence.routes');
const buildEvaluationRoutes = require('./routes/evaluation.routes');
const { datasetLoader } = require('./data/datasetLoader');
const { PORT } = require('./config/environment');
const correlationMiddleware = require('./middleware/correlation.middleware');

module.exports = function buildApiRoutes(ctx) {
  const router = require('express').Router();

  // Phase 17: Request correlation & latency tracking middleware
  router.use(correlationMiddleware());

  // Root route
  router.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'UyirKappan Backend API',
      documentation: '/api-docs',
      health: '/api/health',
      readiness: '/api/readiness',
      dataStatus: '/api/data-status',
      version: '1.1.0',
      dataStoreMode: ctx.store.mode,
      matcher: ctx.matcher ? 'ready' : undefined,
    });
  });

  // Readiness check (Phase 17 Observability)
  router.get('/readiness', async (req, res) => {
    try {
      const { getTrafficProvider } = require('./services/traffic');
      const trafficProvider = getTrafficProvider();
      const hospitals = await ctx.store.getHospitals();
      const ambulances = await ctx.store.getAmbulances();
      const isDbReady = ctx.store.mode === 'mongodb' ? (ctx.dbState ? ctx.dbState().connected : true) : true;

      const isReady = isDbReady && hospitals.length > 0 && ambulances.length > 0;

      res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'degraded',
        ready: isReady,
        database: {
          mode: ctx.store.mode,
          connected: isDbReady,
          status: isDbReady ? 'ready' : 'unavailable',
        },
        matcher: ctx.matcher ? 'ready' : 'uninitialized',
        traffic: {
          provider: trafficProvider.name,
          source: trafficProvider.source,
          isLive: trafficProvider.isLive,
        },
        entities: {
          hospitals: hospitals.length,
          ambulances: ambulances.length,
        },
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'not_ready',
        ready: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Health check (Phase 1 exact specification + backwards-compatible fields)
  router.get('/health', async (req, res) => {
    const hospitals = await ctx.store.getHospitals();
    const ambulances = await ctx.store.getAmbulances();
    const drivers = datasetLoader.drivers || [];
    const { getTrafficProvider } = require('./services/traffic');
    const trafficProvider = getTrafficProvider();

    res.status(200).json({
      status: 'ok',
      port: PORT || 5000,
      dataStore: ctx.store.mode === 'mongodb' ? 'mongodb' : 'csv/memory',
      dataStoreMode: ctx.store.mode,
      datasetsLoaded: true,
      hospitalCount: hospitals.length,
      ambulanceCount: ambulances.length,
      driverCount: drivers.length,
      trafficProvider: trafficProvider.name,
      trafficSource: trafficProvider.source,
      trafficIsLive: trafficProvider.isLive,
      success: true,
      matcher: ctx.matcher ? 'ready' : undefined,
      message: 'UyirKappan Backend Running',
      time: new Date().toISOString(),
    });
  });

  // Dataset status reporting all 10 dataset entity counts (Phase 1 & 19)
  router.get('/data-status', async (req, res) => {
    const hospitals = await ctx.store.getHospitals();
    const ambulances = await ctx.store.getAmbulances();

    res.status(200).json({
      status: 'ok',
      datasetsLoaded: true,
      counts: {
        hospitals: hospitals.length || datasetLoader.hospitals.length,
        ambulanceBases: datasetLoader.ambulanceBases.length,
        ambulances: ambulances.length || datasetLoader.ambulances.length,
        drivers: datasetLoader.drivers.length,
        roadNodes: datasetLoader.roadNodes.length,
        roadSegments: datasetLoader.roadSegments.length,
        trafficConditions: datasetLoader.trafficConditions.length,
        emergencyRequests: datasetLoader.emergencyRequests.length,
        dispatchAssignments: datasetLoader.dispatchAssignments.length,
        gpsTrajectories: datasetLoader.gpsTrajectories.length,
      },
    });
  });

  router.use('/auth', buildAuthRoutes(ctx));
  router.use('/emergency', buildEmergencyRoutes(ctx));
  router.use('/emergencies', buildEmergencyRoutes(ctx));
  router.use('/requests', buildEmergencyRoutes(ctx));
  router.use('/ambulances', buildAmbulanceRoutes(ctx));
  router.use('/assignments', buildAssignmentRoutes(ctx));
  router.use('/hospitals', buildHospitalRoutes(ctx));
  router.use('/driver', buildDriverRoutes(ctx));
  router.use('/drivers', buildDriversRoutes(ctx));
  router.use('/system', buildSystemRoutes(ctx));
  router.use('/demo', buildSystemRoutes(ctx));
  router.use('/experiments', buildExperimentRoutes(ctx));
  router.use('/scenarios', buildScenarioRoutes(ctx));
  router.use('/evidence', buildEvidenceRoutes(ctx));
  router.use('/evaluation', buildEvaluationRoutes(ctx));

  return router;
};
