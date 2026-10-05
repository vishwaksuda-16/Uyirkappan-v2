/**
 * Base abstract class defining the contract for Routing Providers.
 */
class RoutingProvider {
  /**
   * Calculates the primary route between origin and destination coordinates.
   * @param {{ latitude: number, longitude: number }} origin
   * @param {{ latitude: number, longitude: number }} destination
   * @param {Object} [options]
   * @returns {Object} Route result matching standardized contract
   */
  calculateRoute(origin, destination, options = {}) {
    throw new Error('RoutingProvider.calculateRoute() must be implemented by subclass');
  }

  /**
   * Calculates multi-corridor routes (primary and alternative).
   * @param {{ latitude: number, longitude: number }} origin
   * @param {{ latitude: number, longitude: number }} destination
   * @param {Object} [options]
   * @returns {Object} Multi-route result
   */
  findMultiRoutes(origin, destination, options = {}) {
    throw new Error('RoutingProvider.findMultiRoutes() must be implemented by subclass');
  }

  /**
   * Snaps a GPS coordinate to the road network.
   * @param {{ latitude: number, longitude: number }} point
   * @param {number} [maxDistanceMeters]
   * @returns {Object} Snapping result
   */
  snapCoordinate(point, maxDistanceMeters = 500) {
    throw new Error('RoutingProvider.snapCoordinate() must be implemented by subclass');
  }

  /**
   * Returns metadata and topology summary of the active graph.
   * @returns {Object}
   */
  getGraphSummary() {
    throw new Error('RoutingProvider.getGraphSummary() must be implemented by subclass');
  }

  /**
   * Identifier of this routing provider.
   * @returns {string}
   */
  getProviderName() {
    throw new Error('RoutingProvider.getProviderName() must be implemented by subclass');
  }
}

module.exports = { RoutingProvider };
