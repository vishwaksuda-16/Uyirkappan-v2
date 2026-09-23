const { log } = require('../utils/logger');
const { datasetLoader } = require('../data/datasetLoader');
const { sendAssignmentToDriver } = require('./driverNotification');

class EmergencyService {
  constructor(ctx) {
    this.store = ctx.store;
    this.notificationService = ctx.notificationService;
    this.dispatchService = ctx.dispatchService;
    this.fallbackService = ctx.fallbackService;
    this.hospitalService = ctx.hospitalService;
    this.ctx = ctx;
  }

  async createEmergency(user, body) {
    const { emergencyType, victimCount, pickupLocation } = body;
    if (!emergencyType) return { ok: false, message: 'emergencyType is required' };
    if (!victimCount || victimCount < 1) return { ok: false, message: 'victimCount must be at least 1' };
    if (!pickupLocation || typeof pickupLocation.latitude !== 'number' || typeof pickupLocation.longitude !== 'number') {
      return { ok: false, message: 'pickupLocation.latitude and longitude are required' };
    }

    let destinationHospitalId = body.destinationHospitalId || null;
    let hospitalMatch = null;
    if (!destinationHospitalId && this.hospitalService) {
      hospitalMatch = await this.hospitalService.selectBestHospital(body);
      destinationHospitalId = hospitalMatch?.selectedHospitalId || null;
    } else if (!destinationHospitalId) {
      destinationHospitalId = await this.store.getNearestHospitalId(pickupLocation);
    }

    // Map Geolocation -> Nearest Valid Road-Network Node
    const matcher = require('../matcher/index').getMatcherServices();
    const nearestNode = matcher.nearestNodeService.findNearestNode(pickupLocation);
    const { distanceKm } = require('../data/memoryStore');
    const distMeters = Math.round(distanceKm(pickupLocation, { latitude: nearestNode.latitude, longitude: nearestNode.longitude }) * 1000);

    const source = body.source || (body.isManualOverride ? 'DEMO_SCENARIO' : 'LIVE_LOCATION');
    const timestamp = new Date().toISOString();

    const mappedRoadNode = {
      nodeId: nearestNode.nodeId,
      name: nearestNode.name || nearestNode.nodeId,
      lat: nearestNode.latitude,
      latitude: nearestNode.latitude,
      lng: nearestNode.longitude,
      longitude: nearestNode.longitude,
      distanceFromIncidentMeters: distMeters,
    };

    const debugObject = {
      originalLocation: {
        lat: pickupLocation.latitude,
        latitude: pickupLocation.latitude,
        lng: pickupLocation.longitude,
        longitude: pickupLocation.longitude,
      },
      mappedRoadNode,
      source,
      sourceNodeId: nearestNode.nodeId,
    };

    const request = await this.store.createEmergencyRequest(user.id, {
      ...body,
      source,
      timestamp,
      incidentLatitude: pickupLocation.latitude,
      incidentLongitude: pickupLocation.longitude,
      latitude: pickupLocation.latitude,
      longitude: pickupLocation.longitude,
      sourceNodeId: nearestNode.nodeId,
      debug: debugObject,
      destinationHospitalId,
      hospitalMatch: hospitalMatch ? {
        hospitalId: hospitalMatch.selectedHospitalId,
        hospitalName: hospitalMatch.selectedHospital?.name,
        selectionReason: hospitalMatch.selectionReason,
        estimatedTravelTime: hospitalMatch.estimatedTravelTime,
        distance: hospitalMatch.distance,
        candidateHospitals: hospitalMatch.candidateHospitals?.slice(0, 5)
      } : null
    });

    this.notificationService.emitToRoom(`user:${user.id}`, 'EMERGENCY_CREATED', {
      requestId: request.requestId, status: request.status, debug: debugObject,
    });
    this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'EMERGENCY_CREATED', {
      requestId: request.requestId, status: request.status, emergencyType, debug: debugObject,
    });
    if (destinationHospitalId) {
      this.notificationService.emitToRoom(`hospital:${destinationHospitalId}`, 'EMERGENCY_CREATED', {
        requestId: request.requestId,
        status: request.status,
        emergencyType,
        victimCount: request.victimCount,
        hospitalId: destinationHospitalId,
        debug: debugObject,
      });
    }
    log('info', `Emergency ${request.requestId} created with source ${source} mapped to road node ${nearestNode.nodeId}`);

    let selection = await this.dispatchService.findBestAmbulance(request, []);
    if (!selection) {
      await this.store.updateEmergencyStatus(request.requestId, 'NO_AMBULANCE_AVAILABLE');
      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'STATUS_UPDATED', {
        requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE',
      });
      return { ok: true, requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE', debug: debugObject };
    }

    // Atomic availability check: verify the chosen unit hasn't been engaged concurrently
    const latestAmb = await this.store.getAmbulanceById(selection.ambulance.id);
    if (!latestAmb || latestAmb.status !== 'AVAILABLE' || latestAmb.currentRequestId != null || latestAmb.activeEmergencyId != null) {
      selection = await this.dispatchService.findBestAmbulance(request, [selection.ambulance.id]);
      if (!selection) {
        await this.store.updateEmergencyStatus(request.requestId, 'NO_AMBULANCE_AVAILABLE');
        this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'STATUS_UPDATED', {
          requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE',
        });
        return { ok: true, requestId: request.requestId, status: 'NO_AMBULANCE_AVAILABLE', debug: debugObject };
      }
    }

    // Calculate Baseline Dispatch & Routing for comparison
    let baselineRoute = selection.baselineRoute || null;
    let baselineEta = selection.baselineEta ?? null;
    let baselineDistance = selection.baselineDistance ?? null;
    let baselineAmbulanceId = selection.baselineAmbulanceId || null;
    let etaImprovementPct = selection.etaImprovementPct ?? 0;

    try {
      const matcher = require('../matcher/index').getMatcherServices();
      if (!baselineRoute && matcher && selection.ambulance?.currentLocation && request.pickupLocation) {
        baselineRoute = matcher.dijkstraService.findDynamicBaselineRoute(
          selection.ambulance.currentLocation,
          request.pickupLocation
        );
        baselineEta = Math.round(baselineRoute.travelTimeMinutes);
        baselineDistance = baselineRoute.distanceKm;
        baselineAmbulanceId = selection.ambulance.id;
        if (baselineEta > selection.estimatedTravelTime) {
          etaImprovementPct = Math.round(((baselineEta - selection.estimatedTravelTime) / baselineEta) * 1000) / 10;
        }
      }
    } catch (_) {}

    let destinationHospital = null;
    let hospitalRoute = null;
    if (request.destinationHospitalId) {
      destinationHospital = await this.store.getHospitalById(request.destinationHospitalId);
      if (destinationHospital && request.pickupLocation) {
        try {
          const matcher = require('../matcher/index').getMatcherServices();
          if (matcher?.dijkstraService?.findDynamicRoute) {
            hospitalRoute = matcher.dijkstraService.findDynamicRoute(request.pickupLocation, destinationHospital.location);
          }
        } catch (_) {}
      }
    }

    const assignment = await this.store.createAssignment(request, selection.ambulance, 1, {
      ...selection,
      destinationHospital,
      hospitalRoute,
      baselineRoute,
      baselineEta,
      baselineDistance,
      baselineAmbulanceId,
      etaImprovementPct,
    });
    await this.store.updateAmbulance(selection.ambulance.id, {
      status: 'ASSIGNED',
      currentRequestId: request.requestId,
      activeEmergencyId: request.requestId,
    });
    await this.store.updateEmergencyRequest(request.requestId, {
      assignedAmbulanceId: selection.ambulance.id,
      route: selection.route,
      alternativeRoutes: selection.alternativeRoutes,
      candidateRoutes: selection.candidates,
      hospitalRoute,
      routeReason: selection.decisionReason,
      baselineRoute,
      baselineEta,
      baselineDistance,
      baselineAmbulanceId,
      etaImprovementPct,
      debug: debugObject,
    });
    await this.store.updateEmergencyStatus(request.requestId, 'ASSIGNED');
    await this.store.updateEmergencyETA(request.requestId, selection.estimatedTravelTime);

    const driverObj = datasetLoader.drivers?.find(d => d.id === selection.ambulance.driverId || d.assignedAmbulanceId === selection.ambulance.id);
    const driverName = driverObj?.name || selection.ambulance.driverId || 'Assigned Driver';
    const driverPhone = driverObj?.phone || null;

    const payloadAssigned = {
      requestId: request.requestId,
      ambulanceId: selection.ambulance.id,
      driverId: selection.ambulance.driverId,
      driverName,
      driverPhone,
      assignedDriverName: driverName,
      assignmentId: assignment.id,
      estimatedETA: selection.estimatedTravelTime,
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
      decisionReason: selection.decisionReason,
      route: selection.route,
      alternativeRoutes: selection.alternativeRoutes,
      scoreBreakdown: selection.scoreBreakdown,
      candidates: selection.candidates,
      baselineRoute,
      baselineEta,
      baselineDistance,
      baselineAmbulanceId,
      etaImprovementPct,
      debug: debugObject,
      source,
      sourceNodeId: nearestNode.nodeId,
      mappedRoadNode,
    };

    this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_ASSIGNED', payloadAssigned);
    if (destinationHospitalId) {
      this.notificationService.emitToRoom(`hospital:${destinationHospitalId}`, 'AMBULANCE_ASSIGNED', payloadAssigned);
    }
    
    // Broadcast ONLY for Demo Mode Driver Switcher UI (without emitting assignment popup to other drivers)
    const demoPayload = {
      requestId: request.requestId,
      ambulanceId: selection.ambulance.id,
      driverId: selection.ambulance.driverId,
      driverName,
      eta: selection.estimatedTravelTime,
      score: typeof selection.score === 'number' ? (Math.round(selection.score * 1000) / 1000) : 0.22,
      decisionReason: selection.decisionReason,
      baselineEta,
      etaImprovementPct,
      debug: debugObject,
    };
    if (typeof this.notificationService?.broadcast === 'function') {
      this.notificationService.broadcast('DEMO_ASSIGNMENT_CREATED', demoPayload);
      // Removed broadcast('ASSIGNMENT_CREATED') to isolate assignments strictly to assigned driver room
    }

    // ✅ Use this.ctx instead of ctx
    await sendAssignmentToDriver(this.ctx, assignment);
    this.fallbackService.startTimeout(assignment);

    console.log(`\n============================================================`);
    console.log(`[EMERGENCY] ${request.requestId} CREATED`);
    console.log(`[LOCATION] Patient: ${pickupLocation.latitude}, ${pickupLocation.longitude}`);
    if (hospitalMatch) {
      console.log(`[HOSPITAL MATCH] Selected ${destinationHospitalId} (${hospitalMatch.selectedHospital?.name || 'Hospital'})`);
      console.log(`   Reason: ${hospitalMatch.selectionReason || 'Optimal weighted score'}`);
    }
    console.log(`[AMBULANCE MATCH] Selected ${selection.ambulance.id} (Driver: ${selection.ambulance.driverId || 'Assigned'}, ETA: ${selection.estimatedTravelTime} min)`);
    console.log(`[ROUTE] Route ${selection.route?.routeId || 'ROUTE-PRIMARY'} selected (Distance: ${selection.route?.distanceKm || selection.distance} km, ETA: ${selection.estimatedTravelTime} min, Cost: ${selection.cost || selection.score})`);
    console.log(`[DRIVER] Driver for ${selection.ambulance.id} notified`);
    if (destinationHospitalId) {
      console.log(`[HOSPITAL] ${destinationHospitalId} received inbound emergency`);
    }
    console.log(`============================================================\n`);

    log('info', `Dispatch selected ${selection.ambulance.id} for ${request.requestId}`);

    return {
      ok: true,
      requestId: request.requestId,
      status: 'ASSIGNED',
      assignmentId: assignment.id,
      ambulanceId: selection.ambulance.id,
      driverId: selection.ambulance.driverId,
      driverName,
      driverPhone,
      assignedDriverName: driverName,
      eta: selection.estimatedTravelTime,
      destinationHospitalId: request.destinationHospitalId,
      decisionReason: selection.decisionReason,
      route: selection.route,
      alternativeRoutes: selection.alternativeRoutes,
      baselineRoute,
      baselineEta,
      baselineDistance,
      baselineAmbulanceId,
      etaImprovementPct,
      cost: selection.cost,
      score: selection.score,
      costBreakdown: selection.costBreakdown || selection.scoreBreakdown,
      scoreBreakdown: selection.scoreBreakdown,
      candidates: selection.candidates,
      source,
      sourceNodeId: nearestNode.nodeId,
      mappedRoadNode,
      debug: debugObject,
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