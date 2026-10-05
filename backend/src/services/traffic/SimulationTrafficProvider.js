const { TrafficProvider } = require('./TrafficProvider');
const { datasetLoader } = require('../../data/datasetLoader');

/**
 * SimulationTrafficProvider
 * 
 * Default authoritative provider for research, simulation, and benchmark testing.
 * - Ingests Chennai hourly traffic distribution from traffic_conditions.csv
 * - Employs documented multipliers:
 *     NORMAL:   1.0x
 *     MODERATE: 1.35x
 *     HEAVY:    2.1x
 *     BLOCKED:  Infinity
 * - Supports dynamic edge-level traffic injection (for scenarios and live tests)
 * - Explicitly labeled as isLive: false, source: 'SIMULATED_TRAFFIC'
 */
class SimulationTrafficProvider extends TrafficProvider {
  constructor(options = {}) {
    super('SimulationTrafficProvider', 'simulation');
    this.isLive = false;
    this.source = 'SIMULATED_TRAFFIC';

    this.multipliers = {
      NORMAL: 1.0,
      MODERATE: 1.35,
      HEAVY: 2.1,
      BLOCKED: Infinity,
      ...(options.multipliers || {}),
    };

    this.conditions = new Map();
    this.hourlyConditions = new Map();
    this.timeContext = null;

    this.initHourlyTraffic();
  }

  initHourlyTraffic() {
    try {
      if (!datasetLoader.loaded) {
        datasetLoader.loadAll();
      }
      for (const row of (datasetLoader.trafficConditions || [])) {
        const key = `${row.dayType}_${row.hourOfDay}`;
        this.hourlyConditions.set(key, row);
      }
    } catch (e) {
      // Graceful fallback if dataset is unavailable
      console.warn('[SimulationTrafficProvider] Could not load hourly dataset:', e.message);
    }
  }

  setTimeContext(dayType, hourOfDay) {
    this.timeContext = { dayType, hourOfDay: Number(hourOfDay) };
  }

  resetTimeContext() {
    this.timeContext = null;
  }

  getTimeOfDayTraffic() {
    let dayType, hour;
    if (this.timeContext) {
      dayType = this.timeContext.dayType;
      hour = this.timeContext.hourOfDay;
    } else {
      const now = new Date();
      const day = now.getDay();
      const isWeekend = (day === 0 || day === 6);
      dayType = isWeekend ? 'Weekend' : 'Weekday';
      hour = now.getHours();
    }

    const key = `${dayType}_${hour}`;
    const record = this.hourlyConditions.get(key);
    if (record) {
      const timeMultiplier = record.speedMultiplier > 0 ? record.speedMultiplier : 1.0;
      return {
        state: record.trafficState || 'NORMAL',
        multiplier: timeMultiplier,
        source: this.source,
        isLive: this.isLive,
        provider: this.name,
        timestamp: new Date().toISOString(),
      };
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
    const validStates = ['NORMAL', 'MODERATE', 'HEAVY', 'BLOCKED'];
    const normState = String(state || 'NORMAL').toUpperCase();
    if (!validStates.includes(normState)) {
      throw new Error(`Invalid traffic state '${state}'. Valid states: ${validStates.join(', ')}`);
    }

    const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
    this.conditions.set(edgeKey, {
      edgeKey,
      state: normState,
      multiplier: this.multipliers[normState] !== undefined ? this.multipliers[normState] : 1.0,
      source: this.source,
      isLive: this.isLive,
      provider: this.name,
      timestamp: new Date().toISOString(),
    });
  }

  clearTrafficState(fromNodeId, toNodeId) {
    const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
    return this.conditions.delete(edgeKey);
  }

  clearAllOverrides() {
    this.conditions.clear();
  }

  getTrafficCondition(fromNodeId, toNodeId) {
    const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
    const specific = this.conditions.get(edgeKey);
    if (specific) {
      return specific;
    }

    const general = this.getTimeOfDayTraffic();
    return {
      edgeKey,
      state: general.state,
      multiplier: general.multiplier,
      source: this.source,
      isLive: this.isLive,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };
  }

  getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId) {
    const condition = this.getTrafficCondition(fromNodeId, toNodeId);
    if (condition.state === 'BLOCKED' || condition.multiplier === Infinity) {
      return Infinity;
    }
    return baseTravelTimeMinutes * condition.multiplier;
  }

  getProviderStatus() {
    return {
      ...super.getProviderStatus(),
      hourlyConditionsLoaded: this.hourlyConditions.size,
      activeEdgeOverrides: this.conditions.size,
      timeContextActive: this.timeContext !== null,
      multipliers: { ...this.multipliers },
    };
  }
}

module.exports = { SimulationTrafficProvider };
