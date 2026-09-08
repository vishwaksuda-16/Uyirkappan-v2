const { getMatcherServices } = require('../matcher/index');

/**
 * Dispatch Service — Now uses Intelligent Matcher
 */
class DispatchService {
  constructor(store, etaService) {
    this.store = store;
    this.etaService = etaService;
  }

  /**
   * Find the best ambulance using Intelligent Matcher
   * Replaces the mock "first available" implementation
   */
  async findBestAmbulance(emergencyRequest, excludedAmbulanceIds = []) {
    // ✅ Get matcher services
    const matcher = getMatcherServices();

    // ✅ Convert store ambulance data to matcher format
    const allAmbulances = await this.store.getAmbulances();

    const matcherAmbulances = allAmbulances.map((amb) => ({
      ambulanceId: amb.id,
      currentLocation: amb.currentLocation,
      availabilityStatus:
        amb.status === 'AVAILABLE'
          ? 'AVAILABLE'
          : amb.status === 'BUSY'
            ? 'BUSY'
            : 'OFFLINE',
      driverId: amb.driverId,
      capabilities: amb.capabilities || [],
    }));

    // ✅ Convert emergency request to matcher format
    const matcherRequest = {
      requestId: emergencyRequest.requestId,
      emergencyType: emergencyRequest.emergencyType,
      victimCount: emergencyRequest.victimCount,
      pickupLocation: emergencyRequest.pickupLocation,
      createdAt: new Date(),
      priority: this.mapPriority(emergencyRequest.emergencyType),
    };

    // ✅ Call Matcher's dispatch engine
    try {
      const excludedSet = new Set(excludedAmbulanceIds);

      // Use the dispatch engine service
      const decision = matcher.dispatchEngineService.dispatch(
        matcherRequest,
        matcherAmbulances,
        50, // search radius in km
        excludedSet
      );

      // ✅ Find the original ambulance in your store
      const selectedAmbulance = allAmbulances.find(
        (a) => a.id === decision.selectedAmbulanceId
      );

      if (!selectedAmbulance) {
        return null;
      }

      // ✅ Return in your backend's expected format
      return {
        ambulance: selectedAmbulance,
        estimatedTravelTime: decision.estimatedTravelTime,
        distance: decision.distance || decision.route?.distanceKm || 0,
        score: decision.score || 1.0,
        route: decision.route,
      };
    } catch (error) {
      if (error.message === 'NO_AMBULANCE_AVAILABLE') {
        return null;
      }
      console.error('[Matcher] Dispatch error:', error);
      return null;
    }
  }

  mapPriority(emergencyType) {
    const priorities = {
      CARDIAC: 'CRITICAL',
      ACCIDENT: 'HIGH',
      TRAUMA: 'HIGH',
      STROKE: 'CRITICAL',
      RESPIRATORY: 'HIGH',
      FALL: 'MEDIUM',
      OTHER: 'MEDIUM',
    };
    return priorities[emergencyType] || 'MEDIUM';
  }

  async getAvailableAmbulances() {
    const all = await this.store.getAmbulances();
    return all.filter((a) => a.status === 'AVAILABLE');
  }
}

module.exports = DispatchService;