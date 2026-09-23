const express = require('express');
const router = express.Router();
const { getMatcherServices } = require('../matcher/index');
const { datasetLoader } = require('../data/datasetLoader');

/**
 * GET /api/visualization/traffic?dayType=Weekday&hour=8
 * Returns traffic state for all edges at a specific time
 */
router.get('/traffic', (req, res) => {
  try {
    const dayType = req.query.dayType || 'Weekday';
    const hour = parseInt(req.query.hour, 10) || new Date().getHours();

    const matcher = getMatcherServices();

    // Temporarily set traffic time context
    matcher.trafficService.setTimeContext(dayType, hour);
    const traffic = matcher.trafficService.getTimeOfDayTraffic();

    const graph = matcher.graphService.getGraph();
    const edgeTraffic = [];

    for (const [fromNodeId, edgeList] of graph.edges.entries()) {
      for (const edge of edgeList) {
        const condition = matcher.trafficService.getTrafficCondition(edge.fromNodeId, edge.toNodeId);
        edgeTraffic.push({
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          distanceKm: edge.distanceKm,
          baseTravelTime: edge.travelTimeMinutes,
          adjustedTravelTime: edge.travelTimeMinutes * condition.multiplier,
          trafficState: condition.state,
          trafficMultiplier: condition.multiplier,
        });
      }
    }

    // Reset traffic context
    matcher.trafficService.resetTimeContext();

    res.json({
      dayType,
      hour,
      overallState: traffic.state,
      overallMultiplier: traffic.multiplier,
      edgeCount: edgeTraffic.length,
      edges: edgeTraffic,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualization/trajectories?ambulanceId=AMB-A010-01
 * Returns GPS trajectory data for a specific ambulance
 */
router.get('/trajectories', (req, res) => {
  try {
    datasetLoader.loadAll();
    const { ambulanceId, requestId } = req.query;

    let trajectories = datasetLoader.gpsTrajectories;

    if (ambulanceId) {
      trajectories = trajectories.filter(t => t.ambulanceId === ambulanceId);
    }
    if (requestId) {
      trajectories = trajectories.filter(t => t.requestId === requestId);
    }

    // Get unique ambulance IDs for dropdown
    const uniqueAmbulances = [...new Set(datasetLoader.gpsTrajectories.map(t => t.ambulanceId))].sort();
    const uniqueRequests = [...new Set(datasetLoader.gpsTrajectories.map(t => t.requestId))].sort();

    res.json({
      totalRecords: trajectories.length,
      availableAmbulances: uniqueAmbulances,
      availableRequests: uniqueRequests,
      trajectories: trajectories.slice(0, 2000), // Limit for performance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualization/hospitals
 * Returns hospital capacity data for visualization
 */
router.get('/hospitals', (req, res) => {
  try {
    datasetLoader.loadAll();

    const hospitals = datasetLoader.hospitals.map(h => {
      const cap = datasetLoader.hospitalCapacity.find(c => c.hospitalId === h.id);
      return {
        id: h.id,
        name: h.name,
        location: h.location,
        area: h.area,
        sector: h.sector,
        traumaCapable: h.traumaCapable,
        cardiacCapable: h.cardiacCapable,
        operationalStatus: h.operationalStatus || 'OPERATIONAL',
        resources: h.resources,
        capacity: cap ? {
          icuBedsTotal: cap.icuBedsTotal,
          icuBedsAvailable: cap.icuBedsAvailable,
          emergencyBedsTotal: cap.emergencyBedsTotal,
          emergencyBedsAvailable: cap.emergencyBedsAvailable,
          ventilatorsTotal: cap.ventilatorsTotal,
          ventilatorsAvailable: cap.ventilatorsAvailable,
        } : null,
      };
    });

    res.json({ count: hospitals.length, hospitals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualization/batch-comparison?count=50
 * Runs baseline vs optimized dispatch on historical emergency requests
 */
router.get('/batch-comparison', (req, res) => {
  try {
    datasetLoader.loadAll();
    const matcher = getMatcherServices();
    const count = Math.min(parseInt(req.query.count, 10) || 50, 200);

    const requests = datasetLoader.emergencyRequests.slice(0, count);
    const results = [];

    for (const req of requests) {
      const origin = { latitude: req.latitude, longitude: req.longitude };

      // Find nearest hospital as destination
      let nearestHospital = null;
      let minDist = Infinity;
      for (const h of datasetLoader.hospitals) {
        const d = Math.sqrt(
          Math.pow(h.location.latitude - origin.latitude, 2) +
          Math.pow(h.location.longitude - origin.longitude, 2)
        );
        if (d < minDist) {
          minDist = d;
          nearestHospital = h;
        }
      }

      if (!nearestHospital) continue;

      const destination = nearestHospital.location;

      try {
        // Optimized route (traffic-aware Dijkstra)
        const optimized = matcher.dijkstraService.findDynamicRoute(origin, destination);

        // Baseline route (shortest distance)
        const baseline = matcher.dijkstraService.findDynamicBaselineRoute(origin, destination);

        const improvementPct = baseline.travelTimeMinutes > 0
          ? Math.round(((baseline.travelTimeMinutes - optimized.travelTimeMinutes) / baseline.travelTimeMinutes) * 100 * 10) / 10
          : 0;

        results.push({
          requestId: req.requestId,
          area: req.area,
          emergencyType: req.emergencyType,
          severity: req.severity,
          origin,
          destination,
          hospitalName: nearestHospital.name,
          optimizedEtaMin: Math.round(optimized.travelTimeMinutes * 10) / 10,
          baselineEtaMin: Math.round(baseline.travelTimeMinutes * 10) / 10,
          optimizedDistanceKm: optimized.distanceKm,
          baselineDistanceKm: baseline.distanceKm,
          etaImprovementPct: improvementPct,
          timeSavedMin: Math.round((baseline.travelTimeMinutes - optimized.travelTimeMinutes) * 10) / 10,
          optimizedRoute: optimized.routeCoordinates,
          baselineRoute: baseline.routeCoordinates,
        });
      } catch (_) {
        // Skip requests that can't be routed
      }
    }

    // Aggregate stats
    const avgImprovement = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.etaImprovementPct, 0) / results.length * 10) / 10
      : 0;
    const avgTimeSaved = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.timeSavedMin, 0) / results.length * 10) / 10
      : 0;
    const maxImprovement = results.length > 0
      ? Math.max(...results.map(r => r.etaImprovementPct))
      : 0;

    res.json({
      totalCompared: results.length,
      avgImprovementPct: avgImprovement,
      avgTimeSavedMin: avgTimeSaved,
      maxImprovementPct: maxImprovement,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/visualization/emergency-requests
 * Returns historical emergency requests data
 */
router.get('/emergency-requests', (req, res) => {
  try {
    datasetLoader.loadAll();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    
    res.json({
      total: datasetLoader.emergencyRequests.length,
      requests: datasetLoader.emergencyRequests.slice(0, limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
