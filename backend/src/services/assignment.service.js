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
    if (!ambulance || (driver.role !== 'ADMIN' && ambulance.driverId !== driver.id && driver.ambulanceId !== ambulance.id)) {
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
    if (!ambulance || (driver.role !== 'ADMIN' && ambulance.driverId !== driver.id && driver.ambulanceId !== ambulance.id)) {
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
    if (!ambulance || (driver.role !== 'ADMIN' && ambulance.driverId !== driver.id && driver.ambulanceId !== ambulance.id)) {
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

      // Journey 2: Dynamically calculate patient -> hospital route
      if (nextStatus === 'EN_ROUTE_TO_HOSPITAL' || nextStatus === 'PATIENT_ONBOARD') {
        try {
          const { getMatcherServices } = require('../matcher/index');
          const matcher = getMatcherServices();
          const hospital = await this.store.getHospitalById(request.destinationHospitalId);
          if (matcher && hospital && ambulance.currentLocation) {
            let multiRoutes;
            if (typeof matcher.dijkstraService.findDynamicMultiRoutes === 'function') {
              multiRoutes = matcher.dijkstraService.findDynamicMultiRoutes(ambulance.currentLocation, hospital.location);
            } else {
              const startNode = matcher.nearestNodeService.findNearestNode(ambulance.currentLocation);
              const endNode = matcher.nearestNodeService.findNearestNode(hospital.location);
              multiRoutes = matcher.dijkstraService.findMultiRoutes(startNode.nodeId, endNode.nodeId);
            }
            const primary = multiRoutes.primaryRoute;
            const newEta = Math.max(1, Math.round(primary.travelTimeMinutes));
            
            await this.store.updateEmergencyETA(request.requestId, newEta);
            request.route = primary;
            request.alternativeRoutes = multiRoutes.alternativeRoutes || [];
            if (assignment) {
              assignment.route = primary;
              assignment.alternativeRoutes = multiRoutes.alternativeRoutes || [];
            }
            
            const routePayload = {
              requestId: request.requestId,
              phase: 'EN_ROUTE_TO_HOSPITAL',
              route: primary,
              alternativeRoutes: multiRoutes.alternativeRoutes || [],
              destinationHospital: hospital,
              etaMinutes: newEta,
              cost: primary.cost,
              score: primary.score,
              selectionReason: multiRoutes.selectionReason,
              alternativeReason: multiRoutes.alternativeReason,
            };

            this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'ROUTE_UPDATED', routePayload);
            this.notificationService.emitToRoom(`driver:${ambulance.id}`, 'ROUTE_UPDATED', routePayload);
            if (ambulance.driverId) {
              this.notificationService.emitToRoom(`user:${ambulance.driverId}`, 'ROUTE_UPDATED', routePayload);
            }
            if (hospital?.id) {
              this.notificationService.emitToRoom(`hospital:${hospital.id}`, 'ROUTE_UPDATED', routePayload);
            }
            this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'ETA_UPDATED', {
              requestId: request.requestId,
              etaMinutes: newEta,
            });
            log('info', `Journey 2: Recalculated patient -> hospital route for ${request.requestId} to ${hospital.name} (ETA: ${newEta}m)`);
          }
        } catch (err) {
          log('warn', `Failed to recalculate hospital route: ${err.message}`);
        }
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