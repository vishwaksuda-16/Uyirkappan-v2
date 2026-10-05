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
    const { latitude, longitude, speed, heading, accuracy, timestamp } = body;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return {
        ok: false,
        error: 'BAD_REQUEST',
        message: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required',
        status: 400,
      };
    }

    if (timestamp !== undefined && timestamp !== null) {
      const parsedTime = new Date(timestamp).getTime();
      if (Number.isNaN(parsedTime)) {
        return { ok: false, error: 'BAD_REQUEST', message: 'Invalid timestamp format', status: 400 };
      }
      // Reject timestamps more than 5 minutes in future
      if (parsedTime > Date.now() + 5 * 60 * 1000) {
        return { ok: false, error: 'BAD_REQUEST', message: 'Timestamp cannot be in the future', status: 400 };
      }
    }

    const validAccuracy = typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null;
    const provider = body.provider || (body.gpsSource === 'DEVICE' ? 'real' : 'simulation');
    const gpsSource = body.gpsSource || (body.provider === 'real' ? 'DEVICE' : 'SIMULATION');
    const isSimulated = body.isSimulated !== undefined ? Boolean(body.isSimulated) : (provider === 'real' || gpsSource === 'DEVICE' ? false : true);

    // Stale telemetry observability (Step 13: 45 second threshold)
    const now = Date.now();
    const telemetryAgeSec = timestamp ? Math.max(0, Math.round((now - new Date(timestamp).getTime()) / 1000)) : 0;
    if (telemetryAgeSec >= 45) {
      log('warn', {
        event: 'STALE_GPS_DETECTED',
        ambulanceId,
        requestId: ambulance.currentRequestId,
        ageSeconds: telemetryAgeSec,
        thresholdSeconds: 45,
        provider,
        gpsSource,
        message: `Stale telemetry detected for ${ambulanceId} (${telemetryAgeSec}s age exceeds 45s threshold)`,
      });
    }

    await this.store.updateAmbulanceLocation(ambulanceId, {
      latitude,
      longitude,
      speed,
      heading,
      provider,
      gpsSource,
      isSimulated,
      accuracy: validAccuracy,
    });
    await this.store.addLocationHistory({
      ambulanceId,
      requestId: ambulance.currentRequestId,
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      accuracy: validAccuracy,
      provider,
      gpsSource,
      isSimulated,
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
        accuracy: validAccuracy,
        provider,
        gpsSource,
        isSimulated,
        status: ambulance.status,
        timestamp: timestamp || new Date().toISOString(),
      };

      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'AMBULANCE_LOCATION_UPDATED', locPayload);
      if (request.destinationHospitalId) {
        this.notificationService.emitToRoom(`hospital:${request.destinationHospitalId}`, 'AMBULANCE_LOCATION_UPDATED', locPayload);
      }
      this.notificationService.emitToRoom(`emergency:${request.requestId}`, 'ETA_UPDATED', {
        requestId: request.requestId, etaMinutes: eta,
      });
    }

    // High frequency telemetry logged at debug level (Step 12 & 24)
    log('debug', {
      event: 'GPS_TELEMETRY_RECORDED',
      ambulanceId,
      requestId: ambulance.currentRequestId,
      latitude,
      longitude,
      speed: speed || 0,
      provider,
      gpsSource,
      isSimulated,
      accuracy: validAccuracy,
      eta,
      message: `Location updated for ${ambulanceId} (${provider})`,
    });

    return { ok: true, ambulance: await this.store.getAmbulanceById(ambulanceId), eta };
  }
}

module.exports = AmbulanceService;