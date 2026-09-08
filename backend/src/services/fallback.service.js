const { log } = require('../utils/logger');
const { sendAssignmentToDriver } = require('./driverNotification');

/**
 * Fallback Service — Uses Intelligent Matcher for re-dispatch
 */
class FallbackService {
  constructor(ctx) {
    this.store = ctx.store;
    this.dispatchService = ctx.dispatchService;
    this.etaService = ctx.etaService;
    this.notificationService = ctx.notificationService;
    this.timeouts = new Map();
  }

  startTimeout(assignment) {
    const ms = this.store.config.driverResponseTimeoutMs;
    const timer = setTimeout(() => {
      this.handleTimeout(assignment.id).catch((e) =>
        log('error', `Timeout handler failed: ${e.message}`)
      );
    }, ms);
    this.timeouts.set(assignment.id, timer);
    log('info', `Timeout started for ${assignment.id} (${ms}ms)`);
  }

  stopTimeout(assignmentId) {
    const t = this.timeouts.get(assignmentId);
    if (t) {
      clearTimeout(t);
      this.timeouts.delete(assignmentId);
    }
  }

  async handleTimeout(assignmentId) {
    const assignment = await this.store.getAssignmentById(assignmentId);
    if (!assignment) return;

    // Race-safe: only a still-PENDING assignment may time out.
    const res = await this.store.transitionAssignmentState(
      assignmentId,
      ['PENDING'],
      'TIMEOUT'
    );
    if (!res.ok) {
      log('info', `Timeout for ${assignmentId} ignored (status=${res.currentStatus})`);
      return;
    }

    this.stopTimeout(assignmentId);
    await this.store.recordResponse(
      assignment,
      'TIMEOUT',
      'Driver did not respond in time'
    );
    this.notificationService.emitToRoom(
      `emergency:${assignment.requestId}`,
      'ASSIGNMENT_REJECTED',
      {
        requestId: assignment.requestId,
        assignmentId,
        ambulanceId: assignment.ambulanceId,
        reason: 'timeout',
      }
    );

    await this.runFallback(assignment);
  }

  async runFallback(failedAssignment) {
    const request = await this.store.getEmergencyByRequestId(
      failedAssignment.requestId
    );
    if (!request) return;

    // ✅ Release the failed ambulance
    await this.store.releaseAmbulance(failedAssignment.ambulanceId);
    await this.store.updateEmergencyStatus(request.requestId, 'FALLBACK');

    const fallbackStartedPayload = {
      requestId: request.requestId,
      failedAmbulanceId: failedAssignment.ambulanceId,
    };
    this.notificationService.emitToRoom(
      `emergency:${request.requestId}`,
      'FALLBACK_STARTED',
      fallbackStartedPayload
    );
    if (request.destinationHospitalId) {
      this.notificationService.emitToRoom(
        `hospital:${request.destinationHospitalId}`,
        'FALLBACK_STARTED',
        fallbackStartedPayload
      );
    }

    // ✅ Get excluded ambulance IDs from past attempts
    const attempts = await this.store.getAttemptsByRequestId(request.requestId);
    const excludedIds = attempts.map((a) => a.ambulanceId);

    // ✅ Find next best ambulance with Intelligent Matcher
    const selection = await this.dispatchService.findBestAmbulance(
      request,
      excludedIds
    );

    if (!selection) {
      await this.store.updateEmergencyStatus(
        request.requestId,
        'NO_AMBULANCE_AVAILABLE'
      );
      this.notificationService.emitToRoom(
        `emergency:${request.requestId}`,
        'STATUS_UPDATED',
        { requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE' }
      );
      if (request.destinationHospitalId) {
        this.notificationService.emitToRoom(
          `hospital:${request.destinationHospitalId}`,
          'STATUS_UPDATED',
          { requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE' }
        );
      }
      log('info', `No ambulance available for ${request.requestId}`);
      return;
    }

    const nextAmbulance = selection.ambulance;

    // ✅ Create assignment in store
    const newAssignment = await this.store.createAssignment(
      request,
      nextAmbulance,
      excludedIds.length + 1,
      selection
    );

    await this.store.updateAmbulance(nextAmbulance.id, {
      status: 'ASSIGNED',
      currentRequestId: request.requestId,
    });

    await this.store.updateEmergencyRequest(request.requestId, {
      assignedAmbulanceId: nextAmbulance.id,
    });

    await this.store.updateEmergencyStatus(request.requestId, 'ASSIGNED');
    await this.store.updateEmergencyETA(
      request.requestId,
      selection.estimatedTravelTime
    );

    const reassignedPayload = {
      requestId: request.requestId,
      ambulanceId: nextAmbulance.id,
      assignmentId: newAssignment.id,
      attemptNumber: newAssignment.attemptNumber,
    };

    this.notificationService.emitToRoom(
      `emergency:${request.requestId}`,
      'AMBULANCE_REASSIGNED',
      reassignedPayload
    );
    if (request.destinationHospitalId) {
      this.notificationService.emitToRoom(
        `hospital:${request.destinationHospitalId}`,
        'AMBULANCE_REASSIGNED',
        reassignedPayload
      );
    }

    await sendAssignmentToDriver(this, newAssignment);
    this.startTimeout(newAssignment);

    log(
      'info',
      `Fallback assigned ${nextAmbulance.id} (attempt ${newAssignment.attemptNumber})`
    );
  }
}

module.exports = FallbackService;