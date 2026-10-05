const express = require('express');
const router = express.Router();
const { getMatcherServices } = require('../matcher/index');
const { datasetLoader } = require('../data/datasetLoader');
const { roadsForBounds, loadRoadGeometry } = require('../services/road-geometry.service');

// The KML layer is visual evidence. Routing continues to use the validated
// CSV graph until direction, turn, and speed attributes are available.
router.get('/road-geometry', (req, res) => {
  try {
    const values = ['minLat', 'maxLat', 'minLng', 'maxLng'].map((key) => Number(req.query[key]));
    const hasBounds = values.every(Number.isFinite);
    const bounds = hasBounds ? { minLat: values[0], maxLat: values[1], minLng: values[2], maxLng: values[3] } : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 4000, 1), 8000);
    const roads = roadsForBounds(bounds, limit);
    return res.json({
      source: 'Chennai road centerline KML',
      totalRoadLines: loadRoadGeometry().length,
      returnedRoadLines: roads.length,
      roads,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/graph
 * Returns all nodes, edges, and traffic states for visualization
 */
router.get('/graph', (req, res) => {
  try {
    const matcher = getMatcherServices();
    const graph = matcher.graphService.getGraph();

    const nodes = [];
    for (const [nodeId, node] of graph.nodes.entries()) {
      nodes.push({
        nodeId: node.nodeId,
        name: node.name,
        latitude: node.latitude,
        longitude: node.longitude,
        type: nodeId.startsWith('H') ? 'Hospital' : 'Ambulance Base',
      });
    }

    const edges = [];
    for (const [fromNodeId, edgeList] of graph.edges.entries()) {
      for (const edge of edgeList) {
        const seg = datasetLoader.roadSegments.find(
          s => s.startNodeId === edge.fromNodeId && s.endNodeId === edge.toNodeId
        );
        const trafficCondition = matcher.trafficService.getTrafficCondition(edge.fromNodeId, edge.toNodeId);
        edges.push({
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          distanceKm: edge.distanceKm,
          travelTimeMinutes: edge.travelTimeMinutes,
          adjustedTravelTime: matcher.trafficService.getAdjustedTravelTime(edge.travelTimeMinutes, edge.fromNodeId, edge.toNodeId),
          speedLimitKmph: seg ? seg.speedLimitKmph : 30,
          roadType: seg ? seg.roadType : 'local',
          oneWay: seg ? seg.oneWay : false,
          trafficState: trafficCondition.state,
          trafficMultiplier: trafficCondition.multiplier,
        });
      }
    }

    res.json({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      currentTraffic: matcher.trafficService.getTimeOfDayTraffic(),
      routingProvider: matcher.routingProvider ? matcher.routingProvider.getProviderName() : 'existing',
      graphSummary: matcher.routingProvider ? matcher.routingProvider.getGraphSummary() : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/snap?lat=13.0827&lng=80.2707&maxDistance=500
 * Snaps arbitrary GPS coordinates to nearest KML road centerline
 */
router.get('/snap', (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const maxDistance = req.query.maxDistance ? Number(req.query.maxDistance) : 500;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters must be finite numbers' });
    }

    const { RoadNetworkService } = require('../services/road-network');
    const service = RoadNetworkService.getInstance();
    const result = service.snapGps({ latitude: lat, longitude: lng }, maxDistance);

    return res.json({
      status: result.isSnapped ? 'SNAPPED' : 'OUT_OF_RANGE',
      maxDistanceMeters: maxDistance,
      result,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/route?from=A010&to=H017
 * Returns Dijkstra shortest path between two graph nodes
 */
router.get('/route', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query parameters required' });
    }

    const matcher = getMatcherServices();
    const multiRoutes = matcher.dijkstraService.findMultiRoutes(from, to);

    let baselineRoute = null;
    try {
      baselineRoute = matcher.dijkstraService.findBaselineRoute(from, to);
    } catch (_) {}

    const primary = multiRoutes.primaryRoute;
    const improvement = baselineRoute
      ? Math.round(((baselineRoute.travelTimeMinutes - primary.travelTimeMinutes) / baselineRoute.travelTimeMinutes) * 100 * 10) / 10
      : null;

    res.json({
      from,
      to,
      primaryRoute: primary,
      alternativeRoutes: multiRoutes.alternativeRoutes,
      candidateRoutes: multiRoutes.candidateRoutes,
      selectionReason: multiRoutes.selectionReason,
      baselineRoute,
      etaImprovementPct: improvement,
      routingProvider: matcher.routingProvider ? matcher.routingProvider.getProviderName() : 'existing',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/dynamic-route?fromLat=13.08&fromLng=80.27&toLat=13.04&toLng=80.25
 * Returns Dijkstra route between arbitrary GPS coordinates
 */
router.get('/dynamic-route', (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng query parameters required' });
    }

    const origin = { latitude: parseFloat(fromLat), longitude: parseFloat(fromLng) };
    const destination = { latitude: parseFloat(toLat), longitude: parseFloat(toLng) };

    const matcher = getMatcherServices();
    const provider = matcher.routingProvider || matcher.dijkstraService;
    const multiRoutes = provider.findMultiRoutes
      ? provider.findMultiRoutes(origin, destination)
      : matcher.dijkstraService.findDynamicMultiRoutes(origin, destination);

    let baselineRoute = null;
    try {
      baselineRoute = matcher.dijkstraService.findDynamicBaselineRoute(origin, destination);
    } catch (_) {}

    const primary = multiRoutes.primaryRoute;
    const improvement = baselineRoute
      ? Math.round(((baselineRoute.travelTimeMinutes - primary.travelTimeMinutes) / baselineRoute.travelTimeMinutes) * 100 * 10) / 10
      : null;

    res.json({
      origin,
      destination,
      primaryRoute: primary,
      alternativeRoutes: multiRoutes.alternativeRoutes,
      baselineRoute,
      etaImprovementPct: improvement,
      selectionReason: multiRoutes.selectionReason,
      routingProvider: multiRoutes.routingProvider || 'existing',
      graphSource: multiRoutes.graphSource || 'existing_70_node_network',
      snappingMetadata: multiRoutes.snappingMetadata || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
