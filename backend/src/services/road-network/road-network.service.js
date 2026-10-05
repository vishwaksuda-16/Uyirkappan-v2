const path = require('path');
const fs = require('fs');
const { KmlParser } = require('./kml-parser');
const { SpatialIndex } = require('./spatial-index');

let instance = null;

class RoadNetworkService {
  constructor(kmlPath) {
    this.kmlPath = kmlPath || this._resolveDefaultKmlPath();
    this.roads = [];
    this.metadata = null;
    this.spatialIndex = null;
    this.isInitialized = false;
  }

  _resolveDefaultKmlPath() {
    const rootKml = path.resolve(__dirname, '../../../../1ef735dc-2397-4dc3-88e8-d98ea0b8339b.kml');
    if (fs.existsSync(rootKml)) return rootKml;
    const datasetsKml = path.resolve(__dirname, '../../../../Datasets/Spatial/chennai_road_centerline.kml');
    if (fs.existsSync(datasetsKml)) return datasetsKml;
    return rootKml;
  }

  initialize() {
    if (this.isInitialized) return this;

    const startTime = Date.now();
    const { roads, metadata } = KmlParser.parseFile(this.kmlPath);
    this.roads = roads;
    this.metadata = metadata;

    this.spatialIndex = new SpatialIndex(this.roads, 0.01);
    this.totalInitializationTimeMs = Date.now() - startTime;
    this.isInitialized = true;

    return this;
  }

  getRoadGeometry(bounds, limit = 4000) {
    this.ensureInitialized();
    return this.spatialIndex.queryBounds(bounds, limit);
  }

  snapGps(point, maxDistanceMeters = 500) {
    this.ensureInitialized();
    return this.spatialIndex.snapToRoad(point, maxDistanceMeters);
  }

  ensureInitialized() {
    if (!this.isInitialized) {
      this.initialize();
    }
  }

  getStats() {
    this.ensureInitialized();
    return {
      sourceFile: this.metadata?.filePath,
      fileSizeBytes: this.metadata?.fileSizeBytes,
      totalRoads: this.roads.length,
      totalCoordinates: this.metadata?.totalCoordinates,
      boundingBox: this.metadata?.boundingBox,
      initializationTimeMs: this.totalInitializationTimeMs,
      spatialIndexStats: this.spatialIndex.getIndexStats(),
    };
  }

  static getInstance(kmlPath) {
    if (!instance) {
      instance = new RoadNetworkService(kmlPath);
    }
    return instance;
  }
}

module.exports = { RoadNetworkService };
