const { log } = require('../utils/logger');
const { sendAssignmentToDriver } = require('./driverNotification');

class EmergencyService {
  constructor(ctx) {
    this.store = ctx.store;
    this.notificationService = ctx.notificationService;
    this.dispatchService = ctx.dispatchService;
    this.fallbackService = ctx.fallbackService;
    this.ctx = ctx;  // ✅ Store the context
  }

  async createEmergency(user, body) {
    const { emergencyType, victimCount, pickupLocation } = body;
    if (!emergencyType) return { ok: false, message: 'emergencyType is required' };
    if (!victimCount || victimCount < 1) return { ok: false, message: 'victimCount must be at least 1' };
    if (!pickupLocation || typeof pickupLocation.latitude !== 'number' || typeof pickupLocation.longitude !== 'number') {
      return { ok: false, message: 'pickupLocation.latitude and longitude are required' };
    }

    const destinationHospitalId = await this.store.getNearestHospitalId(pickupLocation);
    const request = await this.store.createEmergencyRequest(user.id, { ...body, destinationHospitalId });

    this.notificationService.emitToRoom(`user:${user.id}`, 'EMERGENCY_CREATED', {
      requestId: request.requestId, status: request.status,
    });
    this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'EMERGENCY_CREATED', {
      requestId: request.requestId, status: request.status, emergencyType,
    });
    if (destinationHospitalId) {
      this.notificationService.emitToRoom(`hospital:${destinationHospitalId}`, 'EMERGENCY_CREATED', {
        requestId: request.requestId,
        status: request.status,
        emergencyType,
        victimCount: request.victimCount,
        hospitalId: destinationHospitalId,
      });
    }
    log('info', `Emergency ${request.requestId} created`);

    const selection = await this.dispatchService.findBestAmbulance(request, []);
    if (!selection) {
      await this.store.updateEmergencyStatus(request.requestId, 'NO_AMBULANCE_AVAILABLE');
      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'STATUS_UPDATED', {
        requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE',
      });
      return { ok: true, requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE' };
    }

    const assignment = await this.store.createAssignment(request, selection.ambulance, 1, selection);
    await this.store.updateAmbulance(selection.ambulance.id, {
      status: 'ASSIGNED', currentRequestId: request.requestId,
    });
    await this.store.updateEmergencyRequest(request.requestId, { assignedAmbulanceId: selection.ambulance.id });
    await this.store.updateEmergencyStatus(request.requestId, 'ASSIGNED');
    await this.store.updateEmergencyETA(request.requestId, selection.estimatedTravelTime);

    this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_ASSIGNED', {
      requestId: request.requestId,
      ambulanceId: selection.ambulance.id,
      assignmentId: assignment.id,
      estimatedETA: selection.estimatedTravelTime,
    });
    if (destinationHospitalId) {
      this.notificationService.emitToRoom(`hospital:${destinationHospitalId}`, 'AMBULANCE_ASSIGNED', {
        requestId: request.requestId,
        ambulanceId: selection.ambulance.id,
        assignmentId: assignment.id,
        estimatedETA: selection.estimatedTravelTime,
        hospitalId: destinationHospitalId,
      });
    }
    
    // ✅ Use this.ctx instead of ctx
    await sendAssignmentToDriver(this.ctx, assignment);
    this.fallbackService.startTimeout(assignment);
    log('info', `Dispatch selected ${selection.ambulance.id} for ${request.requestId}`);

    return {
      ok: true,
      requestId: request.requestId,
      status: 'ASSIGNED',
      assignmentId: assignment.id,
      ambulanceId: selection.ambulance.id,
      eta: selection.estimatedTravelTime,
    };
  }

  async cancelEmergency(requestId, user) {
    const request = await this.store.getEmergencyByRequestId(requestId);
    if (!request) return { ok: false, error: 'NOT_FOUND', message: 'Emergency request not found', status: 404 };
    if (user.role !== 'ADMIN' && request.requesterId !== user.id) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only the requester or admin can cancel', status: 403 };
    }
    if (!['SEARCHING', 'ASSIGNED', 'DRIVER_ACCEPTED', 'EN_ROUTE_TO_PATIENT'].includes(request.status)) {
      return { ok: false, error: 'CONFLICT', message: `Cannot cancel an emergency in status ${request.status}`, status: 409 };
    }

    await this.store.updateEmergencyStatus(requestId, 'CANCELLED');
    const active = (await this.store.getAssignmentsForRequest(requestId))
      .filter((a) => ['PENDING', 'ACCEPTED'].includes(a.status));
    for (const assn of active) {
      this.fallbackService.stopTimeout(assn.id);
      await this.store.transitionAssignmentState(assn.id, ['PENDING', 'ACCEPTED'], 'CANCELLED');
      await this.store.releaseAmbulance(assn.ambulanceId);
    }
    this.notificationService.emitToRoom(`emergency:${requestId}`, 'STATUS_UPDATED', { requestId, status: 'CANCELLED' });
    this.notificationService.emitToRoom(`user:${request.requesterId}`, 'STATUS_UPDATED', { requestId, status: 'CANCELLED' });
    return { ok: true, requestId, status: 'CANCELLED' };
  }
}

module.exports = EmergencyService;