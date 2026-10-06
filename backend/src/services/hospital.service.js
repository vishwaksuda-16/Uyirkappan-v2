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
    if (user.role === 'ADMIN') return true;
    if (user.role === 'HOSPITAL_STAFF') {
      if (!user.hospitalId || !hospitalId) return false;
      return (
        user.hospitalId === hospitalId ||
        (user.hospitalId === 'H001' && hospitalId === 'HOSP-01') ||
        (user.hospitalId === 'HOSP-01' && hospitalId === 'H001')
      );
    }
    return false;
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
          completedAt: r.status === 'COMPLETED' ? (r.completedAt || r.updatedAt || r.createdAt || new Date().toISOString()) : null,
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
    const eligible = hospitals.filter(h => h.operationalStatus !== 'SUSPENDED');

    // 2. A specialist emergency must go to a hospital with the matching capability.
    const normType = String(emergencyType || '').toUpperCase();
    let capabilityFiltered = eligible;
    if (normType === 'CARDIAC' || normType === 'STROKE') {
      capabilityFiltered = eligible.filter(h => h.cardiacCapable);
    } else if (normType === 'TRAUMA' || normType === 'ACCIDENT') {
      capabilityFiltered = eligible.filter(h => h.traumaCapable);
    }

    // 3. Prefer hospitals with resources available; do not select a non-capable
    // hospital just because it has more beds.
    const resourceFiltered = capabilityFiltered.filter(h => {
      const icu = h.resources?.icuBeds || 0;
      const gen = h.resources?.generalBeds || 0;
      return icu > 0 || gen > 0;
    });

    // 4. Rank candidates by traffic-aware road travel time from the exact pin.
    const { getMatcherServices } = require('../matcher/index');
    const matcher = getMatcherServices();
    const candidates = [];

    for (const hospital of resourceFiltered) {
      if (!pickupLocation) {
        throw new Error('Exact pickup coordinates are required to select a hospital');
      }
      const route = matcher.dijkstraService.findDynamicRoute(pickupLocation, hospital.location);
      const travelTimeMinutes = Math.max(1, Math.round(route.travelTimeMinutes));
      const distance = route.distanceKm;

      const icuBeds = hospital.resources?.icuBeds || 0;
      const generalBeds = hospital.resources?.generalBeds || 0;

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
        score: route.travelTimeMinutes,
      });
    }

    candidates.sort((a, b) =>
      a.score - b.score ||
      a.distanceKm - b.distanceKm ||
      b.icuBeds - a.icuBeds ||
      b.generalBeds - a.generalBeds
    );
    const best = candidates[0];
    const selectedHospital = best ? hospitals.find(h => h.id === best.hospitalId) : null;

    if (!best || !selectedHospital) {
      return {
        selectedHospital: null,
        selectedHospitalId: null,
        candidateHospitals: [],
        selectionReason: `No operational hospital with suitable capability and resources is available for ${emergencyType || 'this emergency'}.`,
        estimatedTravelTime: null,
        distance: null,
      };
    }
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