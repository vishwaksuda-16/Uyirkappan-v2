const { Router } = require('express');
const { datasetLoader } = require('../data/datasetLoader');

module.exports = function buildSystemRoutes(ctx) {
  const router = Router();

  router.get('/data-status', async (req, res) => {
    datasetLoader.loadAll();

    const hospitals = await ctx.store.getHospitals();
    const ambulances = await ctx.store.getAmbulances();

    return res.json({
      success: true,
      dataStoreMode: ctx.store.mode,
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

  router.get('/routing-debug', handleRoutingDebug);
  router.post('/routing-debug', handleRoutingDebug);

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

  router.post('/reset-demo', handleResetDemo);
  router.post('/reset', handleResetDemo);

  return router;
};
