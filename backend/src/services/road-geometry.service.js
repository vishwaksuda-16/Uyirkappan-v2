const path = require('path');
const { RoadNetworkService } = require('./road-network');
const { config } = require('../config');

function getService() {
  const kmlPath = config?.datasets?.roadKmlPath || process.env.CHENNAI_ROAD_KML_PATH;
  return RoadNetworkService.getInstance(kmlPath);
}

function loadRoadGeometry() {
  const service = getService();
  service.ensureInitialized();
  return service.roads.map((r) => ({
    roadId: r.roadId,
    roadName: r.roadName,
    coordinates: r.coordinates,
  }));
}

function roadsForBounds(bounds, limit = 4000) {
  const service = getService();
  const matched = service.getRoadGeometry(bounds, limit);
  return matched.map((r) => ({
    roadId: r.roadId,
    roadName: r.roadName,
    coordinates: r.coordinates,
  }));
}

module.exports = { roadsForBounds, loadRoadGeometry, getService };
