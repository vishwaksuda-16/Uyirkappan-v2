const { RoutingProvider } = require('./routing-provider.interface');
const { RoadNetworkService } = require('./road-network.service');

/**
 * KML-Augmented routing provider.
 * Combines high-resolution KML road geometry snapping with Dijkstra shortest-path evaluation
 * across the validated road network graph.
 */
class KmlAugmentedRoutingProvider extends RoutingProvider {
  /**
   * @param {Object} dijkstraService
   * @param {Object} graphService
   * @param {Object} nearestSegmentService
   * @param {RoadNetworkService} [roadNetworkService]
   */
  constructor(dijkstraService, graphService, nearestSegmentService, roadNetworkService) {
    super();
    this.dijkstraService = dijkstraService;
    this.graphService = graphService;
    this.nearestSegmentService = nearestSegmentService;
    this.roadNetworkService = roadNetworkService || RoadNetworkService.getInstance();
  }

  getProviderName() {
    return 'kml_augmented';
  }

  getGraphSummary() {
    const graph = this.graphService.getGraph();
    let edgeCount = 0;
    for (const edges of graph.edges.values()) {
      edgeCount += edges.length;
    }
    const kmlStats = this.roadNetworkService.getStats();

    return {
      provider: 'kml_augmented',
      status: 'AUGMENTED_ROAD_GEOMETRY',
      nodeCount: graph.nodes.size,
      edgeCount,
      kmlRoadLines: kmlStats.totalRoads,
      kmlCoordinates: kmlStats.totalCoordinates,
      spatialIndexCells: kmlStats.spatialIndexStats?.totalCells,
      routingMethod: 'KML-Snapped Dynamic Dijkstra Shortest Path with Multi-Factor Cost Scoring',
      description: 'Dijkstra routing over 70-node graph augmented with high-resolution KML road centerline snapping',
    };
  }

  snapCoordinate(point, maxDistanceMeters = 500) {
    return this.roadNetworkService.snapGps(point, maxDistanceMeters);
  }

  calculateRoute(origin, destination, options = {}) {
    const maxSnapDist = options.maxSnappingDistanceMeters || 500;
    const originSnap = this.snapCoordinate(origin, maxSnapDist);
    const destSnap = this.snapCoordinate(destination, maxSnapDist);

    // If snapped onto KML road, use snapped coordinates for more accurate road centerline start
    const effOrigin = originSnap.isSnapped ? originSnap.snappedCoordinate : origin;
    const effDest = destSnap.isSnapped ? destSnap.snappedCoordinate : destination;

    const routeResult = this.dijkstraService.findDynamicRoute(effOrigin, effDest, options);

    return {
      ...routeResult,
      routingProvider: this.getProviderName(),
      graphSource: 'kml_augmented_road_network',
      snappingMetadata: {
        origin: originSnap,
        destination: destSnap,
        usedKmlSnapping: Boolean(originSnap.isSnapped || destSnap.isSnapped),
      },
    };
  }

  findMultiRoutes(origin, destination, options = {}) {
    const maxSnapDist = options.maxSnappingDistanceMeters || 500;
    const originSnap = this.snapCoordinate(origin, maxSnapDist);
    const destSnap = this.snapCoordinate(destination, maxSnapDist);

    const effOrigin = originSnap.isSnapped ? originSnap.snappedCoordinate : origin;
    const effDest = destSnap.isSnapped ? destSnap.snappedCoordinate : destination;

    const multiResult = this.dijkstraService.findDynamicMultiRoutes(effOrigin, effDest, options);

    return {
      ...multiResult,
      routingProvider: this.getProviderName(),
      graphSource: 'kml_augmented_road_network',
      snappingMetadata: {
        origin: originSnap,
        destination: destSnap,
        usedKmlSnapping: Boolean(originSnap.isSnapped || destSnap.isSnapped),
      },
    };
  }
}

module.exports = { KmlAugmentedRoutingProvider };
