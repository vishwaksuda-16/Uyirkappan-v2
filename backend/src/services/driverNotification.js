/**
 * Pushes an assignment to a driver's socket room(s) and to the emergency room.
 */
module.exports.sendAssignmentToDriver = async (ctx, assignment) => {
  const store = ctx.store;
  const ambulance = await store.getAmbulanceById(assignment.ambulanceId);
  const request = await store.getEmergencyByRequestId(assignment.requestId);
  if (!ambulance || !request) return;

  const timeoutSec = assignment.expiresAt
    ? Math.max(1, Math.round((new Date(assignment.expiresAt).getTime() - Date.now()) / 1000))
    : (store.config?.driverResponseTimeoutMs ? Math.round(store.config.driverResponseTimeoutMs / 1000) : 60);

  const destinationHospital = assignment.destinationHospital || (request.destinationHospitalId ? await store.getHospitalById(request.destinationHospitalId) : null);
  let hospitalRoute = assignment.hospitalRoute || null;
  if (!hospitalRoute && destinationHospital && request.pickupLocation) {
    try {
      const matcher = require('../matcher/index').getMatcherServices();
      if (matcher?.dijkstraService?.findDynamicRoute) {
        hospitalRoute = matcher.dijkstraService.findDynamicRoute(request.pickupLocation, destinationHospital.location);
      }
    } catch (_) {}
  }

  const driver = (require('../data/datasetLoader').datasetLoader.drivers || []).find(
    (d) => d.id === ambulance.driverId || d.assignedAmbulanceId === ambulance.id
  );

  const payload = {
    assignmentId: assignment.id,
    id: assignment.id,
    requestId: request.requestId,
    ambulanceId: ambulance.id,
    driverId: ambulance.driverId || assignment.driverId,
    driverName: driver?.name || ambulance.driverId || 'Assigned Driver',
    driverPhone: driver?.phone || null,
    emergencyType: request.emergencyType,
    victimCount: request.victimCount,
    pickupLocation: request.pickupLocation,
    destinationHospitalId: request.destinationHospitalId,
    destinationHospital: destinationHospital ? {
      hospitalId: destinationHospital.id,
      id: destinationHospital.id,
      name: destinationHospital.name,
      location: destinationHospital.location,
      address: destinationHospital.area ? `${destinationHospital.name}, ${destinationHospital.area}` : destinationHospital.name,
      availableBeds: destinationHospital.resources?.generalBeds || destinationHospital.resources?.emergencyBedsAvailable || 10,
      icuBeds: destinationHospital.resources?.icuBeds || 4,
    } : null,
    hospitalRoute,
    baselineEta: assignment.baselineEta,
    baselineDistance: assignment.baselineDistance,
    etaImprovementPct: assignment.etaImprovementPct,
    estimatedETA: assignment.estimatedETA,
    assignedAt: assignment.assignedAt,
    expiresAt: assignment.expiresAt,
    timeoutSeconds: timeoutSec,
    attemptNumber: assignment.attemptNumber,
    status: assignment.status || 'PENDING',
    route: assignment.route,
    alternativeRoutes: assignment.alternativeRoutes,
    decisionReason: assignment.decisionReason,
    scoreBreakdown: assignment.scoreBreakdown,
  };
  ctx.notificationService.emitToRoom(`driver:${ambulance.id}`, 'AMBULANCE_ASSIGNED', payload);
  ctx.notificationService.emitToRoom(`driver:${ambulance.driverId}`, 'AMBULANCE_ASSIGNED', payload);
  ctx.notificationService.emitToRoom(`driver:${ambulance.id}`, 'NEW_ASSIGNMENT', payload);
  ctx.notificationService.emitToRoom(`driver:${ambulance.driverId}`, 'NEW_ASSIGNMENT', payload);
  ctx.notificationService.emitToRoom(`ambulance:${ambulance.id}`, 'AMBULANCE_ASSIGNED', payload);
  ctx.notificationService.emitToRoom(`user:${ambulance.driverId}`, 'AMBULANCE_ASSIGNED', payload);
  ctx.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_ASSIGNED', payload);
  if (request.destinationHospitalId) {
    ctx.notificationService.emitToRoom(`hospital:${request.destinationHospitalId}`, 'AMBULANCE_ASSIGNED', payload);
  }
};