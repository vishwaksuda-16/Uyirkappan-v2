const { getMatcherServices } = require('../matcher/index');

/**
 * Calculates initial bearing in degrees from point 1 to point 2.
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (toDeg(θ) + 360) % 360;
}

/**
 * Generates a smooth, realistic coordinate sequence along actual road network segments.
 */
function generateRoadPathCoordinates(startLocation, destinationLocation, stepIntervalMeters = 250) {
  const matcher = getMatcherServices();
  const startNode = matcher.nearestNodeService.findNearestNode(startLocation);
  const endNode = matcher.nearestNodeService.findNearestNode(destinationLocation);

  const route = matcher.dijkstraService.findShortestRoute(startNode.nodeId, endNode.nodeId);
  const waypoints = route.waypoints;

  const fullPath = [];

  // Start with actual vehicle coordinate
  fullPath.push({
    latitude: startLocation.latitude,
    longitude: startLocation.longitude,
    speed: 35,
    heading: 0,
  });

  // Traverse through each road node in the Dijkstra path
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const prev = fullPath[fullPath.length - 1];
    const heading = calculateBearing(prev.latitude, prev.longitude, wp.latitude, wp.longitude);

    // Number of interpolated sub-steps along this segment
    const steps = 3;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      fullPath.push({
        latitude: prev.latitude + (wp.latitude - prev.latitude) * t,
        longitude: prev.longitude + (wp.longitude - prev.longitude) * t,
        speed: 40 + Math.floor(Math.random() * 8),
        heading: Math.round(heading),
        nodeId: s === steps ? wp.nodeId : null,
      });
    }
  }

  // End at exact destination coordinate
  const lastWp = fullPath[fullPath.length - 1];
  const finalHeading = calculateBearing(lastWp.latitude, lastWp.longitude, destinationLocation.latitude, destinationLocation.longitude);
  fullPath.push({
    latitude: destinationLocation.latitude,
    longitude: destinationLocation.longitude,
    speed: 15,
    heading: Math.round(finalHeading),
  });

  fullPath.route = route;
  fullPath.pathCoordinates = fullPath;
  return fullPath;
}

module.exports = {
  calculateBearing,
  generateRoadPathCoordinates,
};
