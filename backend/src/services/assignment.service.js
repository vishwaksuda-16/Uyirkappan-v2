const { log } = require('../utils/logger');

const LIFECYCLE_STEPS = [
  'DRIVER_ACCEPTED',
  'EN_ROUTE_TO_PATIENT',
  'ARRIVED_AT_PATIENT',
  'PATIENT_ONBOARD',
  'EN_ROUTE_TO_HOSPITAL',
  'ARRIVED_AT_HOSPITAL',
];

class AssignmentService {
  constructor(ctx) {
    this.store = ctx.store;
    this.notificationService = ctx.notificationService;
    this.fallbackService = ctx.fallbackService;
    this.etaService = ctx.etaService;
  }

  async acceptAssignment(assignmentId, driver) {
    const assignment = await this.store.getAssignmentById(assignmentId);
    if (!assignment) return { ok: false, error: 'NOT_FOUND', message: 'Assignment not found' };
    const ambulance = await this.store.getAmbulanceById(assignment.ambulanceId);
    if (!ambulance || ambulance.driverId !== driver.id) {
      return { ok: false, error: 'FORBIDDEN', message: 'This assignment is not for you' };
    }

    // Race-safe: only PENDING can reach ACCEPTED.
    const res = await this.store.transitionAssignmentState(assignmentId, ['PENDING'], 'ACCEPTED');
    if (!res.ok) {
      return { ok: false, error: 'CONFLICT', message: `Assignment is no longer active (status: ${res.currentStatus})` };
    }

    this.fallbackService.stopTimeout(assignmentId);
    await this.store.updateAmbulance(ambulance.id, { status: 'BUSY', currentRequestId: assignment.requestId });
    await this.store.updateEmergencyStatus(assignment.requestId, 'DRIVER_ACCEPTED');

    const request = await this.store.getEmergencyByRequestId(assignment.requestId);
    const eta = await this.etaService.simulateEta(request, ambulance);
    await this.store.updateEmergencyETA(request.requestId, eta);

    // ✅ FIX: Record the acceptance in request_attempts
    await this.store.recordResponse(assignment, 'ACCEPTED', null);

    this.notificationService.emitToRoom(`emergency:${assignment.requestId}`, 'ASSIGNMENT_ACCEPTED', {
      requestId: assignment.requestId, assignmentId, ambulanceId: ambulance.id, driverId: driver.id,
    });
    this.notificationService.emitToRoom(`emergency:${assignment.requestId}`, 'STATUS_UPDATED', {
      requestId: assignment.requestId, status: 'DRIVER_ACCEPTED',
    });
    this.notificationService.emitToRoom(`emergency:${assignment.requestId}`, 'ETA_UPDATED', {
      requestId: assignment.requestId, etaMinutes: eta,
    });
    log('info', `${assignment.id} accepted by ${ambulance.id}`);
    return { ok: true, assignment: await this.store.getAssignmentById(assignmentId), eta };
  }

  async rejectAssignment(assignmentId, driver) {
    const assignment = await this.store.getAssignmentById(assignmentId);
    if (!assignment) return { ok: false, error: 'NOT_FOUND', message: 'Assignment not found' };
    const ambulance = await this.store.getAmbulanceById(assignment.ambulanceId);
    if (!ambulance || ambulance.driverId !== driver.id) {
      return { ok: false, error: 'FORBIDDEN', message: 'This assignment is not for you' };
    }

    const res = await this.store.transitionAssignmentState(assignmentId, ['PENDING'], 'REJECTED');
    if (!res.ok) {
      return { ok: false, error: 'CONFLICT', message: `Assignment is no longer active (status: ${res.currentStatus})` };
    }

    this.fallbackService.stopTimeout(assignmentId);
    await this.store.recordResponse(assignment, 'REJECTED', 'Driver rejected assignment');
    this.notificationService.emitToRoom(`emergency:${assignment.requestId}`, 'ASSIGNMENT_REJECTED', {
      requestId: assignment.requestId, assignmentId, ambulanceId: ambulance.id, reason: 'rejected',
    });
    log('info', `${assignment.id} rejected by ${ambulance.id} — starting fallback`);
    await this.fallbackService.runFallback(assignment);
    return { ok: true, assignment };
  }

  async updateAssignmentStatus(assignmentId, nextStatus, driver) {
    const assignment = await this.store.getAssignmentById(assignmentId);
    if (!assignment) {
      return { ok: false, error: 'NOT_FOUND', message: 'Assignment not found' };
    }

    const ambulance = await this.store.getAmbulanceById(assignment.ambulanceId);
    if (!ambulance || ambulance.driverId !== driver.id) {
      return { ok: false, error: 'FORBIDDEN', message: 'This assignment is not for you' };
    }

    // ✅ FIX: Better status checking with detailed logging
    log('info', `Updating status for ${assignmentId}. Current assignment status: ${assignment.status}, Requested: ${nextStatus}`);

    // If assignment is already COMPLETED, return error
    if (assignment.status === 'COMPLETED') {
      return { ok: false, error: 'CONFLICT', message: 'Assignment is already completed' };
    }

    // If assignment is still PENDING, the driver hasn't accepted yet
    if (assignment.status !== 'ACCEPTED') {
      return { 
        ok: false, 
        error: 'CONFLICT', 
        message: `Assignment must be ACCEPTED first. Current status: ${assignment.status}` 
      };
    }

    const request = await this.store.getEmergencyByRequestId(assignment.requestId);
    if (!request) {
      return { ok: false, error: 'NOT_FOUND', message: 'Emergency request not found' };
    }

    // ✅ FIX: Allow first transition from DRIVER_ACCEPTED to EN_ROUTE_TO_PATIENT
    const curIdx = LIFECYCLE_STEPS.indexOf(request.status);
    const nextIdx = LIFECYCLE_STEPS.indexOf(nextStatus);
    
    // Special case: first status update from DRIVER_ACCEPTED to EN_ROUTE_TO_PATIENT
    if (request.status === 'DRIVER_ACCEPTED' && nextStatus === 'EN_ROUTE_TO_PATIENT') {
      // Valid transition - proceed
    } else if (curIdx === -1 || nextIdx === -1 || nextIdx !== curIdx + 1) {
      return { 
        ok: false, 
        error: 'CONFLICT', 
        message: `Invalid transition ${request.status} -> ${nextStatus}. Must advance one step at a time.` 
      };
    }

    await this.store.updateEmergencyStatus(request.requestId, nextStatus);
    
    if (nextStatus === 'ARRIVED_AT_HOSPITAL') {
      await this.completeRequest(assignment, request, ambulance);
    } else {
      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'STATUS_UPDATED', {
        requestId: request.requestId, status: nextStatus,
      });
      
      if (nextStatus === 'ARRIVED_AT_PATIENT') {
        this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_ARRIVED', {
          requestId: request.requestId, ambulanceId: ambulance.id,
        });
      }
    }

    log('info', `Status updated to ${nextStatus} for ${assignmentId}`);
    return { ok: true, request, status: nextStatus };
  }

  async completeRequest(assignment, request, ambulance) {
    await this.store.markCompleted(request.requestId);
    await this.store.transitionAssignmentState(assignment.id, ['ACCEPTED'], 'COMPLETED');
    await this.store.updateAmbulance(ambulance.id, { status: 'AVAILABLE', currentRequestId: null });

    this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_ARRIVED', {
      requestId: request.requestId, ambulanceId: ambulance.id,
    });
    this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'EMERGENCY_COMPLETED', {
      requestId: request.requestId, ambulanceId: ambulance.id,
    });
    this.notificationService.emitToRoom(`user:${request.requesterId}`, 'EMERGENCY_COMPLETED', {
      requestId: request.requestId,
    });
    if (request.destinationHospitalId) {
      this.notificationService.emitToRoom(`hospital:${request.destinationHospitalId}`, 'AMBULANCE_ARRIVED', {
        requestId: request.requestId, ambulanceId: ambulance.id,
      });
      this.notificationService.emitToRoom(`hospital:${request.destinationHospitalId}`, 'EMERGENCY_COMPLETED', {
        requestId: request.requestId, ambulanceId: ambulance.id,
      });
    }
    log('info', `Emergency ${request.requestId} completed`);
  }
}

module.exports = AssignmentService;