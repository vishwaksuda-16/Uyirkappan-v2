/**
 * TrafficProvider — Base Abstract Class
 * Defines the contract for all traffic providers in UyirKappan.
 * Concrete providers (SimulationTrafficProvider, GoogleTrafficProvider, MapplsTrafficProvider)
 * must implement this interface.
 */
class TrafficProvider {
  constructor(name = 'TrafficProvider', type = 'abstract') {
    if (new.target === TrafficProvider) {
      throw new TypeError('Cannot construct TrafficProvider instances directly — use concrete implementation');
    }
    this.name = name;
    this.type = type;
    this.isLive = false;
    this.source = 'ABSTRACT';
  }

  /**
   * Get traffic condition for a directed road segment (edge)
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @returns {{ edgeKey: string, state: string, multiplier: number, source: string, isLive: boolean, timestamp: string }}
   */
  getTrafficCondition(fromNodeId, toNodeId) {
    throw new Error('Method getTrafficCondition() must be implemented');
  }

  /**
   * Calculate traffic-adjusted travel time for a directed road segment
   * @param {number} baseTravelTimeMinutes
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @returns {number} Adjusted minutes or Infinity if blocked
   */
  getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId) {
    throw new Error('Method getAdjustedTravelTime() must be implemented');
  }

  /**
   * Get current general traffic condition based on time-of-day
   * @returns {{ state: string, multiplier: number, source: string, isLive: boolean, timestamp: string }}
   */
  getTimeOfDayTraffic() {
    throw new Error('Method getTimeOfDayTraffic() must be implemented');
  }

  /**
   * Set specific traffic state for an edge (for simulation/real-time updates)
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @param {'NORMAL' | 'MODERATE' | 'HEAVY' | 'BLOCKED'} state
   */
  setTrafficState(fromNodeId, toNodeId, state) {
    throw new Error('Method setTrafficState() must be implemented');
  }

  /**
   * Set simulation time context (DayType: 'Weekday'|'Weekend', HourOfDay: 0-23)
   * @param {string} dayType
   * @param {number} hourOfDay
   */
  setTimeContext(dayType, hourOfDay) {
    throw new Error('Method setTimeContext() must be implemented');
  }

  /**
   * Reset time context to current system clock
   */
  resetTimeContext() {
    throw new Error('Method resetTimeContext() must be implemented');
  }

  /**
   * Return health, configuration, and capability status of the provider
   * @returns {object}
   */
  getProviderStatus() {
    return {
      name: this.name,
      type: this.type,
      isLive: this.isLive,
      source: this.source,
      configured: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Utility to construct canonical edge key
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @returns {string}
   */
  createEdgeKey(fromNodeId, toNodeId) {
    return `${fromNodeId}->${toNodeId}`;
  }
}

module.exports = { TrafficProvider };
