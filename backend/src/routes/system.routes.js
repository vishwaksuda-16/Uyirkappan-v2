const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { datasetLoader } = require('../data/datasetLoader');
const {
  DataClassification,
  DATA_SOURCE_INVENTORY,
  auditOperationalStatePurity,
} = require('../config/provenance');

module.exports = function buildSystemRoutes(ctx) {
  const router = Router();

  /**
   * GET /api/system/health
   */
  router.get('/health', async (req, res) => {
    return res.json({
      status: 'ok',
      success: true,
      dataStoreMode: ctx.store.mode,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/system/readiness
   */
  router.get('/readiness', async (req, res) => {
    try {
      const isDbReady = ctx.store.mode === 'mongodb' ? (ctx.dbState ? ctx.dbState().connected : true) : true;
      const hospitals = await ctx.store.getHospitals();
      const ambulances = await ctx.store.getAmbulances();
      const isReady = isDbReady && hospitals.length > 0 && ambulances.length > 0;

      return res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'degraded',
        ready: isReady,
        dataStoreMode: ctx.store.mode,
        databaseConnected: isDbReady,
        hospitalCount: hospitals.length,
        ambulanceCount: ambulances.length,
        matcherReady: Boolean(ctx.matcher),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(503).json({ status: 'not_ready', ready: false, error: err.message });
    }
  });

  /**
   * GET /api/system/provenance
   * Exposes complete data-source inventory, formal classification taxonomy,
   * and operational trust boundary verification.
   */
  router.get('/provenance', async (req, res) => {
    try {
      const purityAudit = await auditOperationalStatePurity(ctx.store);
      return res.json({
        success: true,
        classifications: Object.values(DataClassification),
        trustBoundary: {
          operationalPipeline: ['Active emergencies', 'Driver telemetry', 'Hospital bed allocations', 'Real-time assignments'],
          simulationSources: ['Ambulance fleet (131 Chennai units)', 'TrafficConditions (48 diurnal multipliers)', 'Scenario emergencies'],
          referenceBaseline: ['dummy_ambulance_data.xlsx (50 Madurai cases)', 'tamil_nadu_108_evaluation.csv'],
          staticInfrastructure: ['Road network nodes (70)', 'Road network segments (182)', 'Hospital/base facilities (70)', 'GIS KML centerline'],
        },
        purityAudit,
        inventory: DATA_SOURCE_INVENTORY,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/system/config
   * Returns sanitized system configuration safe for diagnostics.
   * All credentials, tokens, and database passwords are redacted.
   */
  router.get('/config', (req, res) => {
    try {
      const { config } = require('../config');
      return res.json({
        success: true,
        config: config.getSanitized(),
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/data-status', async (req, res) => {
    datasetLoader.loadAll();

    const hospitals = await ctx.store.getHospitals();
    const ambulances = await ctx.store.getAmbulances();
    const purity = await auditOperationalStatePurity(ctx.store);

    return res.json({
      success: true,
      dataStoreMode: ctx.store.mode,
      provenance: {
        operationalFleetPurity: purity.pure,
        fleetClassification: DataClassification.SIMULATION,
        referenceDataIsolated: true,
      },
      counts: {
        hospitals: datasetLoader.hospitals.length,
        hospitalCapacity: datasetLoader.hospitalCapacity.length,
        ambulanceBases: datasetLoader.ambulanceBases.length,
        ambulances: datasetLoader.ambulances.length,
        drivers: datasetLoader.drivers.length,
        roadNodes: datasetLoader.roadNodes.length,
        roadSegments: datasetLoader.roadSegments.length,
        trafficConditions: datasetLoader.trafficConditions.length,
        emergencyRequests: datasetLoader.emergencyRequests.length,
        dispatchAssignments: datasetLoader.dispatchAssignments.length,
        gpsTrajectories: datasetLoader.gpsTrajectories.length,
      },
      runtimeCounts: {
        activeHospitalsInStore: hospitals.length,
        activeAmbulancesInStore: ambulances.length,
      },
      sampleHospitals: hospitals.slice(0, 5).map(h => ({
        id: h.id,
        name: h.name,
        area: h.area,
        cardiacCapable: h.cardiacCapable,
        traumaCapable: h.traumaCapable,
        resources: h.resources,
      })),
      sampleAmbulances: ambulances.slice(0, 5).map(a => ({
        id: a.id,
        driverId: a.driverId,
        status: a.status,
        currentLocation: a.currentLocation,
      })),
    });
  });

  const handleRoutingDebug = async (req, res) => {
    const { getMatcherServices } = require('../matcher/index');
    const matcher = getMatcherServices();

    const originLat = parseFloat(req.query.originLat || req.body?.origin?.latitude || 13.030903);
    const originLon = parseFloat(req.query.originLon || req.body?.origin?.longitude || 80.272724);
    const destLat = parseFloat(req.query.destLat || req.body?.destination?.latitude || 13.0585);
    const destLon = parseFloat(req.query.destLon || req.body?.destination?.longitude || 80.2505);

    const dayType = req.query.dayType || req.body?.dayType;
    const hourOfDay = req.query.hourOfDay !== undefined ? parseInt(req.query.hourOfDay, 10) : req.body?.hourOfDay;

    if (dayType && hourOfDay !== undefined && matcher.trafficService) {
      matcher.trafficService.setTimeContext(dayType, hourOfDay);
    }

    try {
      const origin = { latitude: originLat, longitude: originLon, name: 'Debug Origin' };
      const destination = { latitude: destLat, longitude: destLon, name: 'Debug Destination' };

      const multiRoutes = matcher.dijkstraService.findDynamicMultiRoutes(origin, destination);
      const trafficInfo = matcher.trafficService.getTimeOfDayTraffic();
      const primary = multiRoutes.primaryRoute;

      return res.json({
        success: true,
        currentGps: { latitude: originLat, longitude: originLon },
        destinationGps: { latitude: destLat, longitude: destLon },
        originSegment: {
          segmentId: multiRoutes.originSegment.segmentId,
          startNodeId: multiRoutes.originSegment.startNodeId,
          endNodeId: multiRoutes.originSegment.endNodeId,
          distanceToSegmentKm: multiRoutes.originSegment.distanceToSegmentKm,
          oneWay: multiRoutes.originSegment.oneWay,
        },
        destinationSegment: {
          segmentId: multiRoutes.destinationSegment.segmentId,
          startNodeId: multiRoutes.destinationSegment.startNodeId,
          endNodeId: multiRoutes.destinationSegment.endNodeId,
          distanceToSegmentKm: multiRoutes.destinationSegment.distanceToSegmentKm,
          oneWay: multiRoutes.destinationSegment.oneWay,
        },
        selectedRouteId: primary.routeId,
        alternativeRouteIds: multiRoutes.alternativeRoutes.map(r => r.routeId),
        distanceKm: primary.distanceKm,
        etaMinutes: Math.max(1, Math.round(primary.travelTimeMinutes)),
        trafficMultiplier: trafficInfo.multiplier,
        trafficState: trafficInfo.state,
        cost: primary.cost,
        score: primary.score,
        selectionReason: multiRoutes.selectionReason,
        alternativeReason: multiRoutes.alternativeReason,
        primaryRoute: primary,
        alternativeRoutes: multiRoutes.alternativeRoutes,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      if (dayType && hourOfDay !== undefined && matcher.trafficService) {
        matcher.trafficService.resetTimeContext();
      }
    }
  };

  router.post('/routing-debug', handleRoutingDebug);

  router.get('/traffic/status', (req, res) => {
    const { getTrafficProvider } = require('../services/traffic');
    const provider = getTrafficProvider();
    return res.json({
      success: true,
      provider: provider.getProviderStatus(),
    });
  });

  router.post('/traffic', async (req, res) => {
    try {
      const { fromNodeId, toNodeId, state, dayType, hourOfDay } = req.body || {};
      const { getTrafficProvider } = require('../services/traffic');
      const provider = getTrafficProvider();

      if (fromNodeId && toNodeId && state) {
        provider.setTrafficState(fromNodeId, toNodeId, state);
      }
      if (dayType && hourOfDay !== undefined) {
        provider.setTimeContext(dayType, hourOfDay);
      }

      // If active emergencies exist, recalculate ETA and emit ETA_UPDATED
      const updatedEmergencies = [];
      if (ctx.store && ctx.notificationService && ctx.etaService) {
        let activeReqs = [];
        if (ctx.store.mode === 'mongodb') {
          const EmergencyRequest = require('../models/EmergencyRequest');
          activeReqs = await EmergencyRequest.find({
            status: { $nin: ['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'] },
            assignedAmbulanceId: { $ne: null },
          }).lean();
        } else if (Array.isArray(ctx.store.emergencyRequests)) {
          activeReqs = ctx.store.emergencyRequests.filter(
            r => !['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'].includes(r.status) && r.assignedAmbulanceId
          );
        }

        for (const reqItem of activeReqs) {
          const amb = await ctx.store.getAmbulanceById(reqItem.assignedAmbulanceId);
          if (amb) {
            const newEta = await ctx.etaService.simulateEta(reqItem, amb);
            await ctx.store.updateEmergencyETA(reqItem.requestId, newEta);

            const etaPayload = {
              requestId: reqItem.requestId,
              ambulanceId: amb.id,
              estimatedMinutes: newEta,
              currentETA: newEta,
              trafficState: provider.getTimeOfDayTraffic().state,
              trafficSource: provider.source,
              timestamp: new Date().toISOString(),
            };
            ctx.notificationService.emitToRoom(`emergency:${reqItem.requestId}`, 'ETA_UPDATED', etaPayload);
            if (reqItem.destinationHospitalId) {
              ctx.notificationService.emitToRoom(`hospital:${reqItem.destinationHospitalId}`, 'ETA_UPDATED', etaPayload);
            }
            updatedEmergencies.push({ requestId: reqItem.requestId, newEta });
          }
        }
      }

      return res.json({
        success: true,
        message: 'Traffic state updated successfully',
        trafficStatus: provider.getProviderStatus(),
        recalculatedEmergencies: updatedEmergencies,
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  const handleResetDemo = async (req, res) => {
    try {
      if (ctx.fallbackService && typeof ctx.fallbackService.cancelAllTimeouts === 'function') {
        ctx.fallbackService.cancelAllTimeouts();
      }

      datasetLoader.loadAll();

      if (ctx.store) {
        if (Array.isArray(ctx.store.assignments)) {
          ctx.store.assignments = [];
        }
        if (Array.isArray(ctx.store.requestAttempts)) {
          ctx.store.requestAttempts = [];
        }
        if (Array.isArray(ctx.store.emergencies)) {
          ctx.store.emergencies = [];
        }

        if (Array.isArray(ctx.store.ambulances)) {
          for (const amb of ctx.store.ambulances) {
            amb.status = 'AVAILABLE';
            amb.availability = 'AVAILABLE';
            amb.currentRequestId = null;
            const orig = datasetLoader.ambulances.find(a => a.id === amb.id || a.ambulanceId === amb.id);
            if (orig) {
              amb.currentLocation = { latitude: orig.currentLocation.latitude, longitude: orig.currentLocation.longitude };
            }
          }
        }

        if (Array.isArray(ctx.store.hospitals)) {
          for (const h of ctx.store.hospitals) {
            const cap = datasetLoader.hospitalCapacity.find(c => c.hospitalId === h.id);
            if (cap) {
              h.resources = {
                generalBeds: cap.emergencyBedsAvailable,
                icuBeds: cap.icuBedsAvailable,
                ventilators: cap.ventilatorsAvailable,
                totalGeneralBeds: cap.emergencyBedsTotal,
                totalIcuBeds: cap.icuBedsTotal,
                totalVentilators: cap.ventilatorsTotal,
                emergencyBedsTotal: cap.emergencyBedsTotal,
                icuBedsTotal: cap.icuBedsTotal,
                ventilatorsTotal: cap.ventilatorsTotal,
              };
            }
          }
        }
      }

      const resetPayload = {
        timestamp: new Date().toISOString(),
        message: 'System demo state cleanly reset',
      };
      if (ctx.notificationService) {
        if (typeof ctx.notificationService.broadcast === 'function') {
          ctx.notificationService.broadcast('DEMO_RESET', resetPayload);
          ctx.notificationService.broadcast('SYSTEM_RESET', resetPayload);
        } else if (ctx.notificationService.io) {
          ctx.notificationService.io.emit('DEMO_RESET', resetPayload);
          ctx.notificationService.io.emit('SYSTEM_RESET', resetPayload);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'System demo state cleanly reset. Active assignments cleared, ambulances released, and baseline resources restored.',
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  };

  router.post('/reset-demo', authMiddleware(ctx.store), requireRole('ADMIN', 'HOSPITAL_STAFF'), handleResetDemo);
  router.post('/reset', authMiddleware(ctx.store), requireRole('ADMIN', 'HOSPITAL_STAFF'), handleResetDemo);

  return router;
};
