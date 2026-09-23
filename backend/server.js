require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { PORT, DATA_STORE_MODE } = require('./src/config/environment');
const { MemoryStore } = require('./src/data/memoryStore');
const { MongoStore } = require('./src/data/mongoStore');
const { connectDB, disconnectDB, dbState } = require('./src/config/database');
const { setupSwagger } = require('./src/docs/swagger');

// ✅ Import Matcher initialization
const { initializeMatcher } = require('./src/matcher/index');

const EtaService = require('./src/services/eta.service');
const DispatchService = require('./src/services/dispatch.service');
const NotificationService = require('./src/services/notification.service');
const FallbackService = require('./src/services/fallback.service');
const AssignmentService = require('./src/services/assignment.service');
const EmergencyService = require('./src/services/emergency.service');
const AmbulanceService = require('./src/services/ambulance.service');
const HospitalService = require('./src/services/hospital.service');
const buildApiRoutes = require('./src/app');
const initSocketServer = require('./src/sockets/socket.server');
const { log } = require('./src/utils/logger');

(async () => {
  const app = express();

  // ✅ ENHANCED CORS CONFIGURATION
  const corsOptions = {
    origin: '*', // Allow all origins (for development)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  setupSwagger(app); // http://localhost:5000/api-docs

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  });

  // ---- data store (memory | mongodb) — switching requires no code changes ----
  let store;
  if (DATA_STORE_MODE === 'mongodb') {
    await connectDB();
    store = new MongoStore();
    await store.init();
    log('info', 'Data store mode: mongodb');
  } else {
    store = new MemoryStore();
    await store.seed();
    log('info', 'Data store mode: memory');
  }

  // ✅ Initialize Matcher with Socket.IO
  const matcherServices = initializeMatcher(io);
  log('info', 'Intelligent Matcher initialized');

  const ctx = {
    store,
    io,
    notificationService: new NotificationService(io, store),
    dbState: DATA_STORE_MODE === 'mongodb' ? dbState : () => ({ connected: false, state: 'not-required' }),
    matcher: matcherServices, // ✅ Add matcher to context
  };
  ctx.etaService = new EtaService(store);
  ctx.dispatchService = new DispatchService(store, ctx.etaService);
  ctx.fallbackService = new FallbackService(ctx);
  ctx.assignmentService = new AssignmentService(ctx);
  ctx.hospitalService = new HospitalService(ctx);
  ctx.emergencyService = new EmergencyService(ctx);
  ctx.ambulanceService = new AmbulanceService(ctx);

  initSocketServer(io, ctx);
  app.use('/api', buildApiRoutes(ctx));

  // ✅ Visualization API routes
  const networkRoutes = require('./src/routes/network.routes');
  const visualizationRoutes = require('./src/routes/visualization.routes');
  app.use('/api/network', networkRoutes);
  app.use('/api/visualization', visualizationRoutes);

  // ✅ Serve static visualization pages from public/
  app.use(express.static(path.join(__dirname, 'public')));

  // ✅ Port conflict auto-recovery (safety net — primary guard is predev/prestart hook)
  let portRetried = false;
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !portRetried) {
      portRetried = true;
      console.log(`⚠️  Port ${PORT} occupied — auto-killing and retrying...`);
      try {
        const { killPort } = require('./scripts/kill-port');
        killPort(PORT);
      } catch (_) {}
      setTimeout(() => server.listen(PORT), 1500);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [PORT CONFLICT] Port ${PORT} is still occupied after auto-kill.`);
      console.error(`   Run: npm run kill-port\n`);
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(PORT, () => {
    log('info', `UyirKappan backend running on http://localhost:${PORT}`);
    log('info', `Health check: http://localhost:${PORT}/api/health`);
    log('info', `Data status: http://localhost:${PORT}/api/data-status`);
    log('info', `Swagger: http://localhost:${PORT}/api-docs`);
    log('info', 'Sample users seeded (password: password123)');
    log('info', 'Intelligent Matcher ready');
  });

  const shutdown = async (signal) => {
    log('info', `Received ${signal} — shutting down`);
    server.close(async () => {
      if (DATA_STORE_MODE === 'mongodb') await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})().catch((err) => {
  console.error('Fatal startup error:', err.message);
  process.exit(1);
});