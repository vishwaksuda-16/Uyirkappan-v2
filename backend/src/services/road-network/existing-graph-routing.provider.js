const { RoutingProvider } = require('./routing-provider.interface');

/**
 * Validated baseline routing provider operating over the 70-node / 182-edge graph.
 * Preserves 100% backward compatibility with all existing Phase 7, 13, 20, and 25 test suites.
 */
class ExistingGraphRoutingProvider extends RoutingProvider {
  /**
   * @param {Object} dijkstraService
   * @param {Object} graphService
   * @param {Object} nearestSegmentService
   */
  constructor(dijkstraService, graphService, nearestSegmentService) {
    super();
    this.dijkstraService = dijkstraService;
    this.graphService = graphService;
    this.nearestSegmentService = nearestSegmentService;
  }

  getProviderName() {
    return 'existing';
  }

  getGraphSummary() {
    const graph = this.graphService.getGraph();
    let edgeCount = 0;
    for (const edges of graph.edges.values()) {
      edgeCount += edges.length;
    }
    return {
      provider: 'existing',
      status: 'VERIFIED_BASELINE',
      nodeCount: graph.nodes.size,
      edgeCount,
      roadSegmentCount: 182,
      directedEdgeCount: edgeCount,
      routingMethod: 'Dijkstra Shortest Path with Multi-Factor Cost Scoring',
      description: 'Authoritative 70-node / 182-segment (351 directed edges) Chennai road network graph',
    };
  }

  snapCoordinate(point, maxDistanceMeters = 2000) {
    try {
      const segMatch = this.nearestSegmentService.findNearestRoadSegment(point);
      const distMeters = segMatch.distanceToSegmentKm * 1000.0;
      const isWithinTolerance = distMeters <= maxDistanceMeters;

      return {
        isSnapped: isWithinTolerance,
        originalCoordinate: { latitude: point.latitude, longitude: point.longitude },
        snappedCoordinate: isWithinTolerance ? segMatch.projectedPoint : null,
        distanceFromRoadMeters: Math.round(distMeters * 10) / 10,
        roadId: segMatch.segmentId,
        roadName: segMatch.segment?.roadName || segMatch.roadType,
        source: 'existing_road_network_csv',
        reason: isWithinTolerance ? 'OK' : `Distance ${distMeters.toFixed(1)}m exceeds max tolerance ${maxDistanceMeters}m`,
      };
    } catch (e) {
      return {
        isSnapped: false,
        originalCoordinate: point,
        snappedCoordinate: null,
        distanceFromRoadMeters: null,
        reason: e.message,
      };
    }
  }

  calculateRoute(origin, destination, options = {}) {
    const routeResult = this.dijkstraService.findDynamicRoute(origin, destination, options);
    return {
      ...routeResult,
      routingProvider: this.getProviderName(),
      graphSource: 'existing_70_node_network',
    };
  }

  findMultiRoutes(origin, destination, options = {}) {
    const multiResult = this.dijkstraService.findDynamicMultiRoutes(origin, destination, options);
    return {
      ...multiResult,
      routingProvider: this.getProviderName(),
      graphSource: 'existing_70_node_network',
    };
  }
}

module.exports = { ExistingGraphRoutingProvider };
