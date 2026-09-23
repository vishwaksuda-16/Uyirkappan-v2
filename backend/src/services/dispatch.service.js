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
   * Hard backend check: An ambulance/driver is eligible ONLY if status is AVAILABLE,
   * with no active emergency, no current request, no active assignment, and driver has no active trip.
   */
  async isEligibleForAssignment(amb) {
    if (!amb) return false;
    if (amb.status !== 'AVAILABLE') return false;
    if (amb.currentRequestId != null || amb.activeEmergencyId != null || amb.currentAssignmentId != null) {
      return false;
    }
    if (amb.driverId && typeof this.store.getActiveAssignmentForDriver === 'function') {
      const activeAssn = await this.store.getActiveAssignmentForDriver(amb.driverId);
      if (activeAssn) return false;
    }
    return true;
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
    const eligibilityResults = await Promise.all(
      allAmbulances.map(async (amb) => ({ amb, isEligible: await this.isEligibleForAssignment(amb) }))
    );

    const matcherAmbulances = eligibilityResults.map(({ amb, isEligible }) => ({
      ambulanceId: amb.id,
      currentLocation: amb.currentLocation,
      availabilityStatus: isEligible ? 'AVAILABLE' : (amb.status === 'OFFLINE' ? 'OFFLINE' : 'BUSY'),
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
      for (const { amb, isEligible } of eligibilityResults) {
        if (!isEligible) {
          excludedSet.add(amb.id);
        }
      }

      // Use the dispatch engine service
      const decision = matcher.dispatchEngineService.dispatch(
        matcherRequest,
        matcherAmbulances,
        50, // search radius in km
        excludedSet
      );

      // Keep the comparison available even when an older matcher build omits it.
      if (!decision.baselineRoute) {
        const available = matcherAmbulances.filter((amb) =>
          amb.availabilityStatus === 'AVAILABLE' && amb.currentLocation
        );
        available.sort((a, b) => {
          const distance = (amb) => {
            const lat = (amb.currentLocation.latitude - emergencyRequest.pickupLocation.latitude) * 111;
            const lng = (amb.currentLocation.longitude - emergencyRequest.pickupLocation.longitude) * 108;
            return Math.hypot(lat, lng);
          };
          return distance(a) - distance(b);
        });
        const baselineAmbulance = available[0];
        if (baselineAmbulance) {
          decision.baselineRoute = matcher.dijkstraService.findDynamicBaselineRoute(
            baselineAmbulance.currentLocation,
            emergencyRequest.pickupLocation
          );
          decision.baselineEta = Math.max(1, Math.round(decision.baselineRoute.travelTimeMinutes));
          decision.baselineDistance = decision.baselineRoute.distanceKm;
          decision.baselineAmbulanceId = baselineAmbulance.ambulanceId;
          decision.etaImprovementPct = Math.round(
            ((decision.baselineEta - decision.estimatedTravelTime) / Math.max(1, decision.baselineEta)) * 1000
          ) / 10;
        }
      }

      // ✅ Find the original ambulance in your store
      const selectedAmbulance = allAmbulances.find(
        (a) => a.id === decision.selectedAmbulanceId
      );

      if (!selectedAmbulance) {
        return null;
      }

      // ✅ Return in your backend's expected format with full decision intelligence
      return {
        ambulance: selectedAmbulance,
        estimatedTravelTime: decision.estimatedTravelTime,
        distance: decision.distance || decision.route?.distanceKm || 0,
        score: decision.score || 1.0,
        scoreBreakdown: decision.scoreBreakdown,
        route: decision.route,
        alternativeRoutes: decision.alternativeRoutes || [],
        candidateRoutes: decision.candidateRoutes || [],
        baselineRoute: decision.baselineRoute || null,
        baselineEta: decision.baselineEta ?? null,
        baselineDistance: decision.baselineDistance ?? null,
        baselineAmbulanceId: decision.baselineAmbulanceId || null,
        etaImprovementPct: decision.etaImprovementPct ?? null,
        decisionReason: decision.decisionReason,
        candidates: decision.candidates || [],
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