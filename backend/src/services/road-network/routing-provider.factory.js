const { ExistingGraphRoutingProvider } = require('./existing-graph-routing.provider');
const { KmlAugmentedRoutingProvider } = require('./kml-augmented-routing.provider');
const { RoadNetworkService } = require('./road-network.service');

let cachedProvider = null;
let currentSource = null;

class RoutingProviderFactory {
  /**
   * Instantiates the configured routing provider.
   * @param {Object} options
   * @param {string} [options.source] - 'existing' (default) or 'kml_augmented'
   * @param {Object} options.dijkstraService
   * @param {Object} options.graphService
   * @param {Object} options.nearestSegmentService
   * @returns {RoutingProvider}
   */
  static getProvider({ source, dijkstraService, graphService, nearestSegmentService }) {
    const requestedSource = String(
      source ||
      process.env.ROUTING_GRAPH_SOURCE ||
      'existing'
    ).toLowerCase();

    if (cachedProvider && currentSource === requestedSource) {
      return cachedProvider;
    }

    if (requestedSource === 'kml_augmented' || requestedSource === 'kml') {
      const roadNetworkService = RoadNetworkService.getInstance();
      cachedProvider = new KmlAugmentedRoutingProvider(
        dijkstraService,
        graphService,
        nearestSegmentService,
        roadNetworkService
      );
      currentSource = 'kml_augmented';
    } else {
      cachedProvider = new ExistingGraphRoutingProvider(
        dijkstraService,
        graphService,
        nearestSegmentService
      );
      currentSource = 'existing';
    }

    return cachedProvider;
  }

  /**
   * Resets the cached provider (useful for testing mode switches).
   */
  static reset() {
    cachedProvider = null;
    currentSource = null;
  }
}

module.exports = { RoutingProviderFactory };
