const { getMatcherServices } = require('../matcher/index');
const { distanceKm } = require('../data/memoryStore');

/**
 * ETA Service — Now uses Intelligent Matcher
 */
class EtaService {
  constructor(store) {
    this.store = store;
  }

  distanceKm(from, to) {
    return distanceKm(from, to);
  }

  /**
   * Calculate ETA using Intelligent Matcher
   * Replaces the mock ETA implementation
   */
  async simulateEta(emergencyRequest, ambulance) {
    // Determine destination
    const onwardToHospital = [
      'PATIENT_ONBOARD',
      'EN_ROUTE_TO_HOSPITAL',
      'ARRIVED_AT_HOSPITAL',
    ].includes(emergencyRequest.status);

    const hospital = onwardToHospital
      ? await this.store.getHospitalById(emergencyRequest.destinationHospitalId)
      : null;

    const target =
      onwardToHospital && hospital
        ? hospital.location
        : emergencyRequest.pickupLocation;

    // ✅ Use Matcher's ETA service
    const startEta = Date.now();
    try {
      const matcher = getMatcherServices();
      const etaResult = matcher.etaService.calculateETA(
        emergencyRequest.requestId,
        ambulance.id,
        ambulance.currentLocation,
        target
      );

      const logger = require('../utils/logger');
      logger.debug({
        event: 'ETA_COMPUTED',
        requestId: emergencyRequest.requestId,
        ambulanceId: ambulance.id,
        etaMinutes: etaResult.estimatedMinutes,
        durationMs: Date.now() - startEta,
        message: `ETA computed for ${emergencyRequest.requestId}: ${etaResult.estimatedMinutes}m`,
      });

      return etaResult.estimatedMinutes;
    } catch (error) {
      const logger = require('../utils/logger');
      logger.warn({
        event: 'ETA_FALLBACK_COMPUTED',
        requestId: emergencyRequest?.requestId,
        ambulanceId: ambulance?.id,
        error: error.message,
        durationMs: Date.now() - startEta,
        message: `Matcher ETA error, falling back to heuristic: ${error.message}`,
      });
      // Fallback to distance-based ETA
      const distKm = this.distanceKm(ambulance.currentLocation, target);
      const avgSpeedKmh = 30;
      const trafficMultiplier = 1.0 + Math.random() * 0.8;
      return Math.max(1, Math.round((distKm / avgSpeedKmh) * 60 * trafficMultiplier));
    }
  }

  /**
   * Get full ETA result with route
   */
  async getFullETA(emergencyRequest, ambulance, destination) {
    try {
      const matcher = getMatcherServices();
      return matcher.etaService.calculateETA(
        emergencyRequest.requestId,
        ambulance.id,
        ambulance.currentLocation,
        destination || emergencyRequest.pickupLocation
      );
    } catch (error) {
      console.error('[Matcher] Full ETA error:', error);
      return null;
    }
  }
}

module.exports = EtaService;