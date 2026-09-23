class AssignmentController {
  constructor(ctx) {
    this.store = ctx.store;
    this.assignmentService = ctx.assignmentService;
  }

  async canAccess(user, assignment) {
    if (user.role === 'ADMIN') return true;
    const ambulance = await this.store.getAmbulanceById(assignment.ambulanceId);
    if (user.role === 'DRIVER' && ambulance && ambulance.driverId === user.id) return true;
    const request = await this.store.getEmergencyByRequestId(assignment.requestId);
    return !!(request && request.requesterId === user.id);
  }

  async get(req, res) {
    const assignment = await this.store.getAssignmentById(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (!(await this.canAccess(req.user, assignment))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this assignment' });
    }
    return res.json({ success: true, assignment: await this.serialize(assignment) });
  }

  async accept(req, res) {
    const result = await this.assignmentService.acceptAssignment(req.params.assignmentId, req.user);
    if (!result.ok) {
      const status = result.error === 'CONFLICT' ? 409 : result.error === 'FORBIDDEN' ? 403 : 404;
      return res.status(status).json({ success: false, message: result.message });
    }
    console.log(`[DRIVER] Driver (${req.user?.id || 'Driver'}) ACCEPTED assignment ${req.params.assignmentId}`);
    return res.json({ 
      success: true, 
      ok: true,
      assignmentId: result.assignment.id, 
      requestId: result.assignment.requestId, 
      status: result.assignment.status,
      assignment: result.assignment,
      eta: result.eta 
    });
  }

  async reject(req, res) {
    const result = await this.assignmentService.rejectAssignment(req.params.assignmentId, req.user);
    if (!result.ok) {
      const status = result.error === 'CONFLICT' ? 409 : result.error === 'FORBIDDEN' ? 403 : 404;
      return res.status(status).json({ success: false, message: result.message });
    }
    console.log(`[DRIVER] Driver (${req.user?.id || 'Driver'}) REJECTED assignment ${req.params.assignmentId}`);
    return res.json({ 
      success: true, 
      assignmentId: result.assignment.id, 
      message: 'Assignment rejected; fallback started' 
    });
  }

  async updateStatus(req, res) {
    // ✅ FIX: Properly extract status from request body
    const { status } = req.body || {};
    
    // ✅ FIX: Validate that status is provided
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status is required in request body' 
      });
    }

    const result = await this.assignmentService.updateAssignmentStatus(
      req.params.assignmentId,
      status,  // ✅ Pass the extracted status
      req.user
    );
    
    if (!result.ok) {
      const statusCode = result.error === 'CONFLICT' ? 409 : result.error === 'FORBIDDEN' ? 403 : 404;
      return res.status(statusCode).json({ success: false, message: result.message });
    }
    return res.json({ 
      success: true, 
      requestId: result.request.requestId, 
      status: result.status 
    });
  }

  async serialize(assignment) {
    const request = await this.store.getEmergencyByRequestId(assignment.requestId);
    return {
      id: assignment.id,
      requestId: assignment.requestId,
      ambulanceId: assignment.ambulanceId,
      attemptNumber: assignment.attemptNumber,
      status: assignment.status,
      estimatedETA: assignment.estimatedETA,
      assignedAt: assignment.assignedAt,
      expiresAt: assignment.expiresAt,
      responseAt: assignment.responseAt,
      request: request ? {
        emergencyType: request.emergencyType,
        victimCount: request.victimCount,
        pickupLocation: request.pickupLocation,
        destinationHospitalId: request.destinationHospitalId,
        status: request.status,
      } : null,
    };
  }
}

module.exports = AssignmentController;