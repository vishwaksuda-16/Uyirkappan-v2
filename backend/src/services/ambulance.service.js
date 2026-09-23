const { log } = require('../utils/logger');

const VALID_AMBULANCE_STATUS = ['AVAILABLE', 'ASSIGNED', 'BUSY', 'OFFLINE'];

class AmbulanceService {
  constructor(ctx) {
    this.store = ctx.store;
    this.notificationService = ctx.notificationService;
    this.etaService = ctx.etaService;
  }

  ownsAmbulance(user, ambulance) {
    return user.role === 'ADMIN' || ambulance.driverId === user.id || user.ambulanceId === ambulance.id;
  }

  async updateStatus(ambulanceId, body, user) {
    const ambulance = await this.store.getAmbulanceById(ambulanceId);
    if (!ambulance) return { ok: false, error: 'NOT_FOUND', message: 'Ambulance not found', status: 404 };
    if (!this.ownsAmbulance(user, ambulance)) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only the assigned driver or admin can update status', status: 403 };
    }
    const status = body.status;
    if (!VALID_AMBULANCE_STATUS.includes(status)) {
      return { ok: false, error: 'BAD_REQUEST', message: `status must be one of ${VALID_AMBULANCE_STATUS.join(', ')}`, status: 400 };
    }
    await this.store.updateAmbulanceStatus(ambulance.id, status);
    return { ok: true, ambulance: await this.store.getAmbulanceById(ambulanceId) };
  }

  async updateLocation(ambulanceId, body, user) {
    const ambulance = await this.store.getAmbulanceById(ambulanceId);
    if (!ambulance) return { ok: false, error: 'NOT_FOUND', message: 'Ambulance not found', status: 404 };
    if (!this.ownsAmbulance(user, ambulance)) {
      return { ok: false, error: 'FORBIDDEN', message: 'Only the assigned driver or admin can update location', status: 403 };
    }
    const { latitude, longitude, speed, heading } = body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { ok: false, error: 'BAD_REQUEST', message: 'latitude and longitude are required', status: 400 };
    }

    await this.store.updateAmbulanceLocation(ambulanceId, { latitude, longitude, speed, heading });
    await this.store.addLocationHistory({
      ambulanceId, requestId: ambulance.currentRequestId,
      latitude, longitude, speed: speed || 0, heading: heading || 0,
    });

    let eta = null;
    if (ambulance.currentRequestId) {
      const request = await this.store.getEmergencyByRequestId(ambulance.currentRequestId);
      eta = await this.etaService.simulateEta(request, ambulance);
      await this.store.updateEmergencyETA(request.requestId, eta);

      const locPayload = {
        ambulanceId,
        requestId: request.requestId,
        latitude,
        longitude,
        speed: speed ?? 0,
        heading: heading ?? 0,
        status: ambulance.status,
        timestamp: new Date().toISOString(),
      };

      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_LOCATION_UPDATED', locPayload);
      if (request.destinationHospitalId) {
        this.notificationService.emitToRoom(`hospital:${request.destinationHospitalId}`, 'AMBULANCE_LOCATION_UPDATED', locPayload);
      }
      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'ETA_UPDATED', {
        requestId: request.requestId, etaMinutes: eta,
      });
    }
    log('info', `Location updated ${ambulanceId} (${latitude}, ${longitude})`);
    return { ok: true, ambulance: await this.store.getAmbulanceById(ambulanceId), eta };
  }
}

module.exports = AmbulanceService;