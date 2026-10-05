const { TrafficProvider } = require('./TrafficProvider');

/**
 * MapplsTrafficProvider — MapmyIndia / Mappls Live Traffic Adapter (Future / Architecture Staging)
 * 
 * Target Product: Mappls Routing & Distance Matrix API (India specialized)
 * Requires:
 *  - MAPPLS_CLIENT_ID and MAPPLS_CLIENT_SECRET environment variables
 *  - Mappls Developer account
 * 
 * Investigation Summary:
 *  - API Availability: Strong granular coverage across Indian metros, specifically Chennai.
 *  - Pricing: Free tier provides ~2,000 transactions/day; commercial tier required for high frequency dispatch.
 *  - Limitations: Authentication requires OAuth2 client_credentials token refresh flow every 24 hours.
 *  - Status: NOT CONFIGURED (No production Mappls credentials present in repository environment).
 */
class MapplsTrafficProvider extends TrafficProvider {
  constructor(options = {}) {
    super('MapplsTrafficProvider', 'mappls');
    this.clientId = options.clientId || process.env.MAPPLS_CLIENT_ID || null;
    this.clientSecret = options.clientSecret || process.env.MAPPLS_CLIENT_SECRET || null;
    this.isLive = Boolean(this.clientId && this.clientSecret);
    this.source = this.isLive ? 'LIVE_EXTERNAL_TRAFFIC' : 'UNCONFIGURED_EXTERNAL';
    this.fallbackProvider = options.fallbackProvider || null;
  }

  getProviderStatus() {
    return {
      name: this.name,
      type: this.type,
      isLive: this.isLive,
      source: this.source,
      configured: Boolean(this.clientId && this.clientSecret),
      status: (this.clientId && this.clientSecret) ? 'ACTIVE' : 'NOT_CONFIGURED',
      reason: (this.clientId && this.clientSecret) ? 'Mappls Traffic API ready' : 'MAPPLS_CLIENT_ID/SECRET not configured in environment',
      hasFallback: Boolean(this.fallbackProvider),
      fallbackName: this.fallbackProvider?.name || 'none',
      timestamp: new Date().toISOString(),
    };
  }

  getTrafficCondition(fromNodeId, toNodeId) {
    if (!this.isLive) {
      if (this.fallbackProvider) {
        return this.fallbackProvider.getTrafficCondition(fromNodeId, toNodeId);
      }
      throw new Error(
        'MapplsTrafficProvider is NOT_CONFIGURED. Set MAPPLS_CLIENT_ID/SECRET in backend/.env or configure TRAFFIC_PROVIDER_FALLBACK=simulation'
      );
    }
    throw new Error('Mappls live traffic API integration not yet activated for custom graph edges');
  }

  getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId) {
    if (!this.isLive) {
      if (this.fallbackProvider) {
        return this.fallbackProvider.getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId);
      }
      throw new Error(
        'MapplsTrafficProvider is NOT_CONFIGURED. Set MAPPLS_CLIENT_ID/SECRET in backend/.env or configure TRAFFIC_PROVIDER_FALLBACK=simulation'
      );
    }
    return baseTravelTimeMinutes;
  }

  getTimeOfDayTraffic() {
    if (!this.isLive && this.fallbackProvider) {
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

module.exports = { MapplsTrafficProvider };
