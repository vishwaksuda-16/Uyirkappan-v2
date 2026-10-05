const { TrafficProvider } = require('./TrafficProvider');
const { SimulationTrafficProvider } = require('./SimulationTrafficProvider');
const { GoogleTrafficProvider } = require('./GoogleTrafficProvider');
const { MapplsTrafficProvider } = require('./MapplsTrafficProvider');

let instance = null;

/**
 * Factory function to instantiate a traffic provider
 * @param {string} [type] - 'simulation' | 'google' | 'mappls'
 * @param {object} [options]
 * @returns {TrafficProvider}
 */
function createTrafficProvider(type, options = {}) {
  const providerType = (type || process.env.TRAFFIC_PROVIDER || 'simulation').toLowerCase().trim();
  const fallbackType = (options.fallback || process.env.TRAFFIC_PROVIDER_FALLBACK || 'none').toLowerCase().trim();

  let fallbackProvider = null;
  if (fallbackType === 'simulation' && providerType !== 'simulation') {
    fallbackProvider = new SimulationTrafficProvider(options);
  }

  switch (providerType) {
    case 'simulation':
    case 'simulated':
      return new SimulationTrafficProvider(options);

    case 'google':
      return new GoogleTrafficProvider({ ...options, fallbackProvider });

    case 'mappls':
      return new MapplsTrafficProvider({ ...options, fallbackProvider });

    default:
      throw new Error(
        `Invalid TRAFFIC_PROVIDER '${providerType}'. Supported providers: 'simulation', 'google', 'mappls'`
      );
  }
}

/**
 * Singleton accessor for the application-wide traffic provider
 * @param {object} [options]
 * @returns {TrafficProvider}
 */
function getTrafficProvider(options = {}) {
  if (!instance) {
    instance = createTrafficProvider(undefined, options);
  }
  return instance;
}

/**
 * Reset singleton (primarily for testing and reconfiguration)
 */
function resetTrafficProvider() {
  instance = null;
}

module.exports = {
  TrafficProvider,
  SimulationTrafficProvider,
  GoogleTrafficProvider,
  MapplsTrafficProvider,
  createTrafficProvider,
  getTrafficProvider,
  resetTrafficProvider,
};
