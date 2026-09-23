const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

module.exports = function buildDriverRoutes(ctx) {
  const router = Router();
  const store = ctx.store;

  router.use(authMiddleware(store));

  router.get('/assignment', requireRole('DRIVER'), async (req, res) => {
    const assignment = await store.getActiveAssignmentForDriver(req.user.id);
    if (!assignment) {
      return res.json({ success: true, assignment: null, message: 'No active assignment' });
    }
    const request = await store.getEmergencyByRequestId(assignment.requestId);
    if (!request || ['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'].includes(request.status)) {
      return res.json({ success: true, assignment: null, message: 'No active assignment' });
    }
    const ambulance = await store.getAmbulanceById(assignment.ambulanceId);
    if (ambulance && ambulance.driverId !== req.user.id && req.user.id !== assignment.driverId) {
      return res.json({ success: true, assignment: null, message: 'No active assignment' });
    }
    if (assignment.status === 'PENDING' && assignment.expiresAt && new Date(assignment.expiresAt) <= new Date()) {
      return res.json({ success: true, assignment: null, message: 'No active assignment' });
    }

    const timeoutSec = assignment.expiresAt
      ? Math.max(1, Math.round((new Date(assignment.expiresAt).getTime() - Date.now()) / 1000))
      : (store.config?.driverResponseTimeoutMs ? Math.round(store.config.driverResponseTimeoutMs / 1000) : 60);

    const destHospital = assignment.destinationHospital || (request?.destinationHospitalId ? await store.getHospitalById(request.destinationHospitalId) : null);
    let hospitalRoute = assignment.hospitalRoute || null;
    if (!hospitalRoute && destHospital && request?.pickupLocation) {
      try {
        const matcher = require('../matcher/index').getMatcherServices();
        if (matcher?.dijkstraService?.findDynamicRoute) {
          hospitalRoute = matcher.dijkstraService.findDynamicRoute(request.pickupLocation, destHospital.location);
        }
      } catch (_) {}
    }

    return res.json({
      success: true,
      assignment: {
        id: assignment.id,
        assignmentId: assignment.id,
        requestId: assignment.requestId,
        ambulanceId: assignment.ambulanceId,
        driverId: req.user.id || assignment.driverId,
        attemptNumber: assignment.attemptNumber,
        status: assignment.status,
        estimatedETA: assignment.estimatedETA,
        assignedAt: assignment.assignedAt,
        expiresAt: assignment.expiresAt,
        timeoutSeconds: timeoutSec,
        route: assignment.route,
        alternativeRoutes: assignment.alternativeRoutes,
        hospitalRoute,
        destinationHospital: destHospital ? {
          hospitalId: destHospital.id,
          id: destHospital.id,
          name: destHospital.name,
          location: destHospital.location,
          address: destHospital.area ? `${destHospital.name}, ${destHospital.area}` : destHospital.name,
          availableBeds: destHospital.resources?.generalBeds || destHospital.resources?.emergencyBedsAvailable || 10,
          icuBeds: destHospital.resources?.icuBeds || 4,
        } : null,
        baselineEta: assignment.baselineEta,
        baselineDistance: assignment.baselineDistance,
        etaImprovementPct: assignment.etaImprovementPct,
        decisionReason: assignment.decisionReason,
        scoreBreakdown: assignment.scoreBreakdown,
        request: request ? {
          emergencyType: request.emergencyType,
          victimCount: request.victimCount,
          pickupLocation: request.pickupLocation,
          destinationHospitalId: request.destinationHospitalId,
          destinationHospital: destHospital ? {
            hospitalId: destHospital.id,
            id: destHospital.id,
            name: destHospital.name,
            location: destHospital.location,
            address: destHospital.area ? `${destHospital.name}, ${destHospital.area}` : destHospital.name,
            availableBeds: destHospital.resources?.generalBeds || destHospital.resources?.emergencyBedsAvailable || 10,
            icuBeds: destHospital.resources?.icuBeds || 4,
          } : null,
        } : null,
      },
    });
  });

  return router;
};