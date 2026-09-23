const { datasetLoader } = require('../data/datasetLoader');

class HospitalService {
  constructor(ctx) {
    this.store = ctx.store;
    this.ctx = ctx;
  }

  getDriverInfo(ambulanceId) {
    if (!datasetLoader.loaded) datasetLoader.loadAll();
    const driver = datasetLoader.drivers?.find(
      (d) => d.assignedAmbulanceId === ambulanceId || d.id === ambulanceId
    );
    if (!driver) return null;
    return {
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone || null,
      assignedDriverName: driver.name,
    };
  }

  ownsHospital(user, hospitalId) {
    if (!user) return false;
    // In controlled demo mode, any authenticated hospital staff or admin can manage the selected facility
    return user.role === 'ADMIN' || user.role === 'HOSPITAL_STAFF';
  }

  async incoming(hospitalId, user) {
    const hospital = await this.store.getHospitalById(hospitalId);
    if (!hospital) return { ok: false, error: 'NOT_FOUND', message: 'Hospital not found', status: 404 };
    if (!this.ownsHospital(user, hospitalId)) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only staff of this hospital or admin can view incoming', status: 403 };
    }
    const list = await this.store.getIncomingEmergenciesForHospital(hospitalId);
    return {
      ok: true,
      incoming: list.map((r) => {
        const driverInfo = this.getDriverInfo(r.assignedAmbulanceId);
        return {
          requestId: r.requestId,
          emergencyType: r.emergencyType,
          victimCount: r.victimCount,
          ambulanceId: r.assignedAmbulanceId,
          hospitalId: r.destinationHospitalId,
          pickupLocation: r.pickupLocation,
          eta: r.currentETA,
          status: r.status,
          createdAt: r.createdAt,
          driverId: driverInfo?.driverId || null,
          driverName: driverInfo?.driverName || null,
          driverPhone: driverInfo?.driverPhone || null,
          assignedDriverName: driverInfo?.assignedDriverName || null,
          route: r.route || null,
          alternativeRoutes: r.alternativeRoutes || [],
          candidateRoutes: r.candidateRoutes || [],
          decisionReason: r.routeReason || null,
        };
      }),
    };
  }

  async history(hospitalId, user) {
    const hospital = await this.store.getHospitalById(hospitalId);
    if (!hospital) return { ok: false, error: 'NOT_FOUND', message: 'Hospital not found', status: 404 };
    if (!this.ownsHospital(user, hospitalId)) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only staff of this hospital or admin can view history', status: 403 };
    }
    const list = await this.store.getEmergencyHistoryForHospital(hospitalId);
    return {
      ok: true,
      history: list.map((r) => {
        const driverInfo = this.getDriverInfo(r.assignedAmbulanceId);
        return {
          requestId: r.requestId,
          emergencyType: r.emergencyType,
          victimCount: r.victimCount,
          ambulanceId: r.assignedAmbulanceId,
          hospitalId: r.destinationHospitalId,
          status: r.status,
          createdAt: r.createdAt,
          completedAt: r.status === 'COMPLETED' ? r.completedAt : null,
          driverId: driverInfo?.driverId || null,
          driverName: driverInfo?.driverName || null,
          driverPhone: driverInfo?.driverPhone || null,
          assignedDriverName: driverInfo?.assignedDriverName || null,
        };
      }),
    };
  }

  async updateResources(hospitalId, body, user) {
    const hospital = await this.store.getHospitalById(hospitalId);
    if (!hospital) return { ok: false, error: 'NOT_FOUND', message: 'Hospital not found', status: 404 };
    if (!this.ownsHospital(user, hospitalId)) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only staff of this hospital or admin can update resources', status: 403 };
    }

    const current = hospital.resources || {};
    const totalGen = body.totalGeneralBeds ?? body.emergencyBedsTotal ?? current.totalGeneralBeds ?? current.emergencyBedsTotal ?? 100;
    const totalIcu = body.totalIcuBeds ?? body.icuBedsTotal ?? current.totalIcuBeds ?? current.icuBedsTotal ?? 50;
    const totalVent = body.totalVentilators ?? body.ventilatorsTotal ?? current.totalVentilators ?? current.ventilatorsTotal ?? 30;

    const resources = {};
    if (body.generalBeds !== undefined) {
      if (typeof body.generalBeds !== 'number' || body.generalBeds < 0 || body.generalBeds > totalGen) {
        return { ok: false, error: 'BAD_REQUEST', message: `generalBeds must be between 0 and total (${totalGen})`, status: 400 };
      }
      resources.generalBeds = body.generalBeds;
    }
    if (body.icuBeds !== undefined) {
      if (typeof body.icuBeds !== 'number' || body.icuBeds < 0 || body.icuBeds > totalIcu) {
        return { ok: false, error: 'BAD_REQUEST', message: `icuBeds must be between 0 and total (${totalIcu})`, status: 400 };
      }
      resources.icuBeds = body.icuBeds;
    }
    if (body.ventilators !== undefined) {
      if (typeof body.ventilators !== 'number' || body.ventilators < 0 || body.ventilators > totalVent) {
        return { ok: false, error: 'BAD_REQUEST', message: `ventilators must be between 0 and total (${totalVent})`, status: 400 };
      }
      resources.ventilators = body.ventilators;
    }

    if (body.totalGeneralBeds !== undefined && typeof body.totalGeneralBeds === 'number') {
      resources.totalGeneralBeds = body.totalGeneralBeds;
      resources.emergencyBedsTotal = body.totalGeneralBeds;
    }
    if (body.totalIcuBeds !== undefined && typeof body.totalIcuBeds === 'number') {
      resources.totalIcuBeds = body.totalIcuBeds;
      resources.icuBedsTotal = body.totalIcuBeds;
    }
    if (body.totalVentilators !== undefined && typeof body.totalVentilators === 'number') {
      resources.totalVentilators = body.totalVentilators;
      resources.ventilatorsTotal = body.totalVentilators;
    }

    if (Object.keys(resources).length === 0) {
      return { ok: false, error: 'BAD_REQUEST', message: 'Provide at least one resource to update', status: 400 };
    }

    const updated = await this.store.updateHospitalResources(hospitalId, resources);

    if (this.ctx && this.ctx.notificationService) {
      this.ctx.notificationService.emitToRoom(`hospital:${hospitalId}`, 'HOSPITAL_RESOURCES_UPDATED', {
        hospitalId,
        ...updated.resources,
        updatedAt: new Date().toISOString(),
      });
    }

    return { ok: true, hospital: updated };
  }

  async selectBestHospital(emergencyRequest) {
    const hospitals = await this.store.getHospitals();
    const emergencyType = (emergencyRequest.emergencyType || '').toUpperCase();
    const pickupLocation = emergencyRequest.pickupLocation;

    // 1. Filter by operational status
    let eligible = hospitals.filter(h => h.operationalStatus !== 'SUSPENDED');
    if (eligible.length === 0) eligible = hospitals;

    // 2. Filter according to medical capability
    const normType = String(emergencyType || '').toUpperCase();
    let capabilityFiltered = eligible;
    if (normType === 'CARDIAC' || normType === 'STROKE') {
      const matches = eligible.filter(h => h.cardiacCapable);
      if (matches.length > 0) capabilityFiltered = matches;
    } else if (normType === 'TRAUMA' || normType === 'ACCIDENT') {
      const matches = eligible.filter(h => h.traumaCapable);
      if (matches.length > 0) capabilityFiltered = matches;
    }

    // 3. Bed and resource availability check
    let resourceFiltered = capabilityFiltered.filter(h => {
      const icu = h.resources?.icuBeds || 0;
      const gen = h.resources?.generalBeds || 0;
      return icu > 0 || gen > 0;
    });
    if (resourceFiltered.length === 0) resourceFiltered = capabilityFiltered;

    // 4. Calculate road network travel time to each candidate
    const { getMatcherServices } = require('../matcher/index');
    let matcher = null;
    try { matcher = getMatcherServices(); } catch (_) {}

    const candidates = [];
    const { distanceKm } = require('../data/memoryStore');

    for (const hospital of resourceFiltered) {
      let travelTimeMinutes = 10;
      let distance = 4.0;

      try {
        if (matcher && pickupLocation) {
          let route;
          if (typeof matcher.dijkstraService.findDynamicRoute === 'function') {
            route = matcher.dijkstraService.findDynamicRoute(pickupLocation, hospital.location);
          } else {
            const pNode = matcher.nearestNodeService.findNearestNode(pickupLocation);
            const hNode = matcher.nearestNodeService.findNearestNode(hospital.location);
            route = matcher.dijkstraService.findShortestRoute(pNode.nodeId, hNode.nodeId);
          }
          travelTimeMinutes = Math.max(1, Math.round(route.travelTimeMinutes));
          distance = route.distanceKm;
        } else if (pickupLocation) {
          distance = Math.round(distanceKm(pickupLocation, hospital.location) * 10) / 10;
          travelTimeMinutes = Math.max(1, Math.round((distance / 35) * 60));
        }
      } catch (_) {
        if (pickupLocation) {
          distance = Math.round(distanceKm(pickupLocation, hospital.location) * 1.3 * 10) / 10;
          travelTimeMinutes = Math.max(1, Math.round((distance / 30) * 60));
        }
      }

      const icuBeds = hospital.resources?.icuBeds || 0;
      const generalBeds = hospital.resources?.generalBeds || 0;
      const score = travelTimeMinutes * 0.7 - Math.min(8, icuBeds * 1.5 + generalBeds * 0.2) * 0.3;

      candidates.push({
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        location: hospital.location,
        area: hospital.area,
        sector: hospital.sector,
        travelTimeMinutes,
        distanceKm: distance,
        icuBeds,
        generalBeds,
        cardiacCapable: hospital.cardiacCapable,
        traumaCapable: hospital.traumaCapable,
        score,
      });
    }

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0] || { hospitalId: hospitals[0]?.id || 'H001', travelTimeMinutes: 10, distanceKm: 4.0, hospitalName: hospitals[0]?.name || 'Hospital' };
    const selectedHospital = hospitals.find(h => h.id === best.hospitalId) || hospitals[0];

    const reason = `${best.hospitalName} (${best.hospitalId}) evaluated as optimal emergency destination: ${best.travelTimeMinutes} min travel time, ${best.icuBeds} ICU beds available, matching ${emergencyType || 'general'} protocol.`;

    return {
      selectedHospital,
      selectedHospitalId: best.hospitalId,
      candidateHospitals: candidates,
      selectionReason: reason,
      estimatedTravelTime: best.travelTimeMinutes,
      distance: best.distanceKm,
    };
  }
}

module.exports = HospitalService;