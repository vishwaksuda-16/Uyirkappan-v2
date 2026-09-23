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
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
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

  cancelAllTimeouts() {
    for (const [id, timer] of this.timeouts.entries()) {
      clearTimeout(timer);
    }
    this.timeouts.clear();
    log('info', 'All fallback timeouts cancelled');
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

    if (excludedIds.length >= 10 || !selection) {
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
    const { datasetLoader } = require('../data/datasetLoader');
    const driverObj = datasetLoader.drivers?.find(
      (d) => d.id === nextAmbulance.driverId || d.assignedAmbulanceId === nextAmbulance.id
    );

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
      route: selection.route,
      alternativeRoutes: selection.alternativeRoutes,
      candidateRoutes: selection.candidates,
      routeReason: selection.decisionReason,
    });

    await this.store.updateEmergencyStatus(request.requestId, 'ASSIGNED');
    await this.store.updateEmergencyETA(
      request.requestId,
      selection.estimatedTravelTime
    );

    const reassignedPayload = {
      requestId: request.requestId,
      ambulanceId: nextAmbulance.id,
      driverId: nextAmbulance.driverId,
      driverName: driverObj?.name || nextAmbulance.driverId || 'Assigned Driver',
      driverPhone: driverObj?.phone || null,
      assignedDriverName: driverObj?.name || nextAmbulance.driverId || 'Assigned Driver',
      assignmentId: newAssignment.id,
      attemptNumber: newAssignment.attemptNumber,
      estimatedETA: selection.estimatedTravelTime,
      route: selection.route,
      alternativeRoutes: selection.alternativeRoutes,
      decisionReason: selection.decisionReason,
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

    // Broadcast for Demo Mode Driver Switcher on Fallback Reassignment
    const driverId = driverObj?.id || nextAmbulance.driverId || nextAmbulance.id;
    const driverName = driverObj?.name || driverId || 'Assigned Driver';

    const demoPayload = {
      requestId: request.requestId,
      ambulanceId: nextAmbulance.id,
      driverId,
      driverName,
      driverPhone: driverObj?.phone || null,
      eta: selection.estimatedTravelTime,
      score: typeof selection.score === 'number' ? (Math.round(selection.score * 1000) / 1000) : 0.22,
      decisionReason: selection.decisionReason,
      baselineEta: selection.estimatedTravelTime,
      etaImprovementPct: 0,
      attemptNumber: newAssignment.attemptNumber,
    };
    if (typeof this.notificationService?.broadcast === 'function') {
      this.notificationService.broadcast('DEMO_ASSIGNMENT_CREATED', demoPayload);
      this.notificationService.broadcast('ASSIGNMENT_CREATED', demoPayload);
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