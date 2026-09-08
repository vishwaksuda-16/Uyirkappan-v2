/**
 * Pushes an assignment to a driver's socket room(s) and to the emergency room.
 */
module.exports.sendAssignmentToDriver = async (ctx, assignment) => {
  const store = ctx.store;
  const ambulance = await store.getAmbulanceById(assignment.ambulanceId);
  const request = await store.getEmergencyByRequestId(assignment.requestId);
  if (!ambulance || !request) return;

  const payload = {
    assignmentId: assignment.id,
    requestId: request.requestId,
    ambulanceId: ambulance.id,
    emergencyType: request.emergencyType,
    victimCount: request.victimCount,
    pickupLocation: request.pickupLocation,
    estimatedETA: assignment.estimatedETA,
  };
  ctx.notificationService.emitToRoom(`driver:${ambulance.id}`, 'AMBULANCE_ASSIGNED', payload);
  ctx.notificationService.emitToRoom(`user:${ambulance.driverId}`, 'AMBULANCE_ASSIGNED', payload);
  ctx.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_ASSIGNED', payload);
};