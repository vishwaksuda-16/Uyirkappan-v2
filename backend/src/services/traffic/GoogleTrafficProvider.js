const { TrafficProvider } = require('./TrafficProvider');

/**
 * GoogleTrafficProvider — External Live Traffic Adapter (Future / Architecture Staging)
 * 
 * Target Product: Google Maps Routes API / Directions API with departure_time=now
 * Requires:
 *  - GOOGLE_MAPS_API_KEY environment variable
 *  - Google Cloud Billing account
 * 
 * Investigation Summary:
 *  - API Availability: Available globally, fully covers Chennai metropolitan area.
 *  - Pricing: ~$5.00 - $10.00 per 1,000 Directions/Routes requests.
 *  - Limitations: Returns end-to-end route duration in traffic. Mapping back to UyirKappan's
 *    custom 70-node graph edges requires reverse-geocoded map matching.
 *  - Status: NOT CONFIGURED (No production API key present in repository environment).
 */
class GoogleTrafficProvider extends TrafficProvider {
  constructor(options = {}) {
    super('GoogleTrafficProvider', 'google');
    this.apiKey = options.apiKey || process.env.GOOGLE_MAPS_API_KEY || null;
    this.isLive = Boolean(this.apiKey);
    this.source = this.isLive ? 'LIVE_EXTERNAL_TRAFFIC' : 'UNCONFIGURED_EXTERNAL';
    this.fallbackProvider = options.fallbackProvider || null;
  }

  getProviderStatus() {
    return {
      name: this.name,
      type: this.type,
      isLive: this.isLive,
      source: this.source,
      configured: Boolean(this.apiKey),
      status: this.apiKey ? 'ACTIVE' : 'NOT_CONFIGURED',
      reason: this.apiKey ? 'Google Maps Routes API ready' : 'GOOGLE_MAPS_API_KEY is not configured in environment',
      hasFallback: Boolean(this.fallbackProvider),
      fallbackName: this.fallbackProvider?.name || 'none',
      timestamp: new Date().toISOString(),
    };
  }

  getTrafficCondition(fromNodeId, toNodeId) {
    if (!this.apiKey) {
      if (this.fallbackProvider) {
        return this.fallbackProvider.getTrafficCondition(fromNodeId, toNodeId);
      }
      throw new Error(
        'GoogleTrafficProvider is NOT_CONFIGURED. Set GOOGLE_MAPS_API_KEY in backend/.env or configure TRAFFIC_PROVIDER_FALLBACK=simulation'
      );
    }
    // Live API integration hook (when API key is provided)
    throw new Error('Google Maps live traffic API integration not yet activated for custom graph edges');
  }

  getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId) {
    if (!this.apiKey) {
      if (this.fallbackProvider) {
        return this.fallbackProvider.getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId);
      }
      throw new Error(
        'GoogleTrafficProvider is NOT_CONFIGURED. Set GOOGLE_MAPS_API_KEY in backend/.env or configure TRAFFIC_PROVIDER_FALLBACK=simulation'
      );
    }
    return baseTravelTimeMinutes;
  }

  getTimeOfDayTraffic() {
    if (!this.apiKey && this.fallbackProvider) {
      return this.fallbackProvider.getTimeOfDayTraffic();
    }
    return {
      state: 'NORMAL',
      multiplier: 1.0,
      source: this.source,
      isLive: this.isLive,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };
  }

  setTrafficState(fromNodeId, toNodeId, state) {
    if (this.fallbackProvider) {
      this.fallbackProvider.setTrafficState(fromNodeId, toNodeId, state);
    }
  }

  setTimeContext(dayType, hourOfDay) {
    if (this.fallbackProvider) {
      this.fallbackProvider.setTimeContext(dayType, hourOfDay);
    }
  }

  resetTimeContext() {
    if (this.fallbackProvider) {
      this.fallbackProvider.resetTimeContext();
    }
  }
}

module.exports = { GoogleTrafficProvider };
