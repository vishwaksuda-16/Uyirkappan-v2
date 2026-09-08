class HospitalService {
  constructor(ctx) { this.store = ctx.store; }

  ownsHospital(user, hospitalId) {
    return user.role === 'ADMIN' || (user.role === 'HOSPITAL_STAFF' && user.hospitalId === hospitalId);
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
      incoming: list.map((r) => ({
        requestId: r.requestId, emergencyType: r.emergencyType, victimCount: r.victimCount,
        ambulanceId: r.assignedAmbulanceId, eta: r.currentETA, status: r.status,
      })),
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
      history: list.map((r) => ({
        requestId: r.requestId, emergencyType: r.emergencyType, victimCount: r.victimCount,
        ambulanceId: r.assignedAmbulanceId, status: r.status, createdAt: r.createdAt, completedAt: r.completedAt,
      })),
    };
  }

  async updateResources(hospitalId, body, user) {
    const hospital = await this.store.getHospitalById(hospitalId);
    if (!hospital) return { ok: false, error: 'NOT_FOUND', message: 'Hospital not found', status: 404 };
    if (!this.ownsHospital(user, hospitalId)) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only staff of this hospital or admin can update resources', status: 403 };
    }
    const resources = {};
    for (const key of ['generalBeds', 'icuBeds', 'ventilators']) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'number' || body[key] < 0) {
          return { ok: false, error: 'BAD_REQUEST', message: `${key} must be a non-negative number`, status: 400 };
        }
        resources[key] = body[key];
      }
    }
    if (Object.keys(resources).length === 0) {
      return { ok: false, error: 'BAD_REQUEST', message: 'Provide at least one resource to update', status: 400 };
    }
    const updated = await this.store.updateHospitalResources(hospitalId, resources);
    return { ok: true, hospital: updated };
  }
}

module.exports = HospitalService;