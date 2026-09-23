class EmergencyController {
  constructor(ctx) {
    this.store = ctx.store;
    this.emergencyService = ctx.emergencyService;
  }

  async create(req, res) {
    const result = await this.emergencyService.createEmergency(req.user, req.body || {});
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    return res.status(201).json({
      success: true,
      requestId: result.requestId,
      status: result.status,
      assignmentId: result.assignmentId,
      ambulanceId: result.ambulanceId,
      driverId: result.driverId,
      driverName: result.driverName,
      driverPhone: result.driverPhone,
      assignedDriverName: result.assignedDriverName,
      destinationHospitalId: result.destinationHospitalId,
      eta: result.eta,
      decisionReason: result.decisionReason,
      route: result.route,
      alternativeRoutes: result.alternativeRoutes,
      baselineRoute: result.baselineRoute,
      baselineEta: result.baselineEta,
      baselineDistance: result.baselineDistance,
      baselineAmbulanceId: result.baselineAmbulanceId,
      etaImprovementPct: result.etaImprovementPct,
      cost: result.cost,
      score: result.score,
      costBreakdown: result.costBreakdown,
      scoreBreakdown: result.scoreBreakdown,
      candidates: result.candidates,
    });
  }

  async canAccess(user, request) {
    if (user.role === 'ADMIN' || request.requesterId === user.id) return true;
    if (user.role === 'DRIVER') {
      const amb = await this.store.getAmbulanceByDriverId(user.id);
      return !!amb && amb.currentRequestId === request.requestId;
    }
    if (user.role === 'HOSPITAL_STAFF') return true;
    return false;
  }

  async get(req, res) {
    const request = await this.store.getEmergencyByRequestId(req.params.requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Emergency request not found' });
    if (!(await this.canAccess(req.user, request))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this request' });
    }
    return res.json({ success: true, request: await this.serialize(request) });
  }

  async cancel(req, res) {
    const result = await this.emergencyService.cancelEmergency(req.params.requestId, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, requestId: result.requestId, status: result.status });
  }

  async tracking(req, res) {
    const request = await this.store.getEmergencyByRequestId(req.params.requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Emergency request not found' });
    if (!(await this.canAccess(req.user, request))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this request' });
    }
    const ambulance = request.assignedAmbulanceId
      ? await this.store.getAmbulanceById(request.assignedAmbulanceId)
      : null;
    return res.json({
      success: true,
      tracking: {
        requestId: request.requestId,
        ambulanceId: ambulance ? ambulance.id : null,
        location: ambulance ? ambulance.currentLocation : null,
        eta: request.currentETA,
        status: request.status,
        route: request.route || null,
        alternativeRoutes: request.alternativeRoutes || [],
        candidateRoutes: request.candidateRoutes || [],
        decisionReason: request.routeReason || null,
      },
    });
  }

  async serialize(request) {
    const attempts = await this.store.getAttemptsByRequestId(request.requestId);
    const ambulance = request.assignedAmbulanceId ? await this.store.getAmbulanceById(request.assignedAmbulanceId) : null;
    const { datasetLoader } = require('../data/datasetLoader');
    if (!datasetLoader.loaded) datasetLoader.loadAll();
    const driver = ambulance?.driverId
      ? datasetLoader.drivers?.find((d) => d.id === ambulance.driverId || d.assignedAmbulanceId === ambulance.id)
      : null;

    return {
      requestId: request.requestId,
      emergencyType: request.emergencyType,
      victimCount: request.victimCount,
      pickupLocation: request.pickupLocation,
      destinationHospitalId: request.destinationHospitalId,
      assignedAmbulanceId: request.assignedAmbulanceId,
      ambulanceId: request.assignedAmbulanceId,
      driverId: ambulance?.driverId || null,
      driverName: driver?.name || null,
      driverPhone: driver?.phone || null,
      assignedDriverName: driver?.name || null,
      status: request.status,
      eta: request.currentETA,
      route: request.route || null,
      alternativeRoutes: request.alternativeRoutes || [],
      candidateRoutes: request.candidateRoutes || [],
      decisionReason: request.routeReason || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      completedAt: request.completedAt,
      attempts: attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        ambulanceId: a.ambulanceId,
        response: a.response,
        failureReason: a.failureReason,
        assignedAt: a.assignedAt,
        responseAt: a.responseAt,
      })),
    };
  }
}

module.exports = EmergencyController;