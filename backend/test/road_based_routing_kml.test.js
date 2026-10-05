const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { KmlParser } = require('../src/services/road-network/kml-parser');
const { SpatialIndex } = require('../src/services/road-network/spatial-index');
const { RoadNetworkService } = require('../src/services/road-network/road-network.service');
const { ExistingGraphRoutingProvider } = require('../src/services/road-network/existing-graph-routing.provider');
const { KmlAugmentedRoutingProvider } = require('../src/services/road-network/kml-augmented-routing.provider');
const { RoutingProviderFactory } = require('../src/services/road-network/routing-provider.factory');
const { initializeMatcher, getMatcherServices } = require('../src/matcher');
const { datasetLoader } = require('../src/data/datasetLoader');

describe('Phase 4 — Road-Based Routing & KML Subsystem Test Suite', () => {
  let matcher;

  before(() => {
    datasetLoader.loadAll();
    initializeMatcher(null);
    matcher = getMatcherServices();
  });

  describe('1. KmlParser Unit Tests', () => {
    test('Correctly parses and normalizes mock KML string', () => {
      const mockKml = `<?xml version="1.0" encoding="utf-8" ?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Placemark>
    <ExtendedData>
      <SimpleData name="road_id">ROAD-001</SimpleData>
      <SimpleData name="road_name">Poonamallee High Road</SimpleData>
      <SimpleData name="objectid">101</SimpleData>
    </ExtendedData>
    <LineString>
      <coordinates>80.2707,13.0827 80.2715,13.0835</coordinates>
    </LineString>
  </Placemark>
  <Placemark>
    <ExtendedData>
      <SimpleData name="road_id">ROAD-002</SimpleData>
    </ExtendedData>
    <LineString>
      <coordinates>80.2600,13.0645 80.2610,13.0655 80.2620,13.0665</coordinates>
    </LineString>
  </Placemark>
</Document>
</kml>`;

      const tempFile = path.resolve(__dirname, 'temp_mock_roads.kml');
      fs.writeFileSync(tempFile, mockKml, 'utf8');

      try {
        const { roads, metadata } = KmlParser.parseFile(tempFile);
        assert.equal(roads.length, 2, 'Must parse exactly 2 valid roads');
        assert.equal(roads[0].roadId, 'ROAD-001');
        assert.equal(roads[0].roadName, 'Poonamallee High Road');
        assert.equal(roads[0].objectId, 101);
        assert.equal(roads[0].coordinates.length, 2);
        // Verify OGC order: [lng, lat]
        assert.equal(roads[0].coordinates[0][0], 80.2707);
        assert.equal(roads[0].coordinates[0][1], 13.0827);

        assert.equal(roads[1].roadId, 'ROAD-002');
        assert.equal(roads[1].roadName, 'Unnamed road');
        assert.equal(roads[1].coordinates.length, 3);

        assert.equal(metadata.totalCoordinates, 5);
        assert.ok(metadata.boundingBox.minLat <= 13.0645);
        assert.ok(metadata.boundingBox.maxLat >= 13.0835);
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    test('Safely ignores malformed or single-point LineStrings', () => {
      const mockMalformedKml = `<?xml version="1.0" encoding="utf-8" ?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Placemark>
    <ExtendedData><SimpleData name="road_id">SINGLE-POINT</SimpleData></ExtendedData>
    <LineString><coordinates>80.2707,13.0827</coordinates></LineString>
  </Placemark>
  <Placemark>
    <ExtendedData><SimpleData name="road_id">EMPTY</SimpleData></ExtendedData>
    <LineString><coordinates></coordinates></LineString>
  </Placemark>
</Document>
</kml>`;

      const tempFile = path.resolve(__dirname, 'temp_mock_malformed.kml');
      fs.writeFileSync(tempFile, mockMalformedKml, 'utf8');

      try {
        const { roads } = KmlParser.parseFile(tempFile);
        assert.equal(roads.length, 0, 'Malformed LineStrings must not produce road records');
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });
  });

  describe('2. SpatialIndex Unit Tests', () => {
    let spatialIndex;
    const sampleRoads = [
      {
        roadId: 'ROAD-A',
        roadName: 'Central Avenue',
        coordinates: [
          [80.2700, 13.0820],
          [80.2710, 13.0830],
          [80.2720, 13.0840],
        ],
        boundingBox: { minLng: 80.2700, minLat: 13.0820, maxLng: 80.2720, maxLat: 13.0840 },
      },
      {
        roadId: 'ROAD-B',
        roadName: 'Beach Road',
        coordinates: [
          [80.2800, 13.0500],
          [80.2810, 13.0520],
        ],
        boundingBox: { minLng: 80.2800, minLat: 13.0500, maxLng: 80.2810, maxLat: 13.0520 },
      },
    ];

    beforeEach(() => {
      spatialIndex = new SpatialIndex(sampleRoads, 0.01);
    });

    test('Correctly indexes roads into spatial grid cells', () => {
      const stats = spatialIndex.getIndexStats();
      assert.equal(stats.totalRoads, 2);
      assert.ok(stats.totalCells > 0, 'Must create grid cells for indexed roads');
    });

    test('Snaps coordinate within nominal tolerance (< 500m)', () => {
      // Point very close to Central Avenue midpoint
      const queryPoint = { latitude: 13.0825, longitude: 80.2705 };
      const snap = spatialIndex.snapToRoad(queryPoint, 500);

      assert.equal(snap.isSnapped, true);
      assert.equal(snap.roadId, 'ROAD-A');
      assert.equal(snap.roadName, 'Central Avenue');
      assert.ok(snap.distanceFromRoadMeters < 50, 'Distance must be < 50 meters');
      assert.ok(snap.snappedCoordinate.latitude > 0);
      assert.ok(snap.snappedCoordinate.longitude > 0);
    });

    test('Rejects coordinate when distance exceeds maximum snapping distance', () => {
      // Point far away from both roads (e.g. 10 km away)
      const queryPoint = { latitude: 13.1500, longitude: 80.2705 };
      const snap = spatialIndex.snapToRoad(queryPoint, 500);

      assert.equal(snap.isSnapped, false);
      assert.equal(snap.snappedCoordinate, null);
      assert.ok(snap.reason.includes('exceeds max tolerance') || snap.reason.includes('not found'));
    });

    test('Rejects invalid or out-of-bounds coordinates', () => {
      const invalidPoint = { latitude: 95.0, longitude: 80.0 };
      const snap = spatialIndex.snapToRoad(invalidPoint, 500);
      assert.equal(snap.isSnapped, false);
      assert.equal(snap.reason, 'Coordinates out of bounds');
    });

    test('queryBounds retrieves only roads intersecting bounding box', () => {
      const boundsNearA = { minLat: 13.0800, maxLat: 13.0850, minLng: 80.2650, maxLng: 80.2750 };
      const roads = spatialIndex.queryBounds(boundsNearA);
      assert.equal(roads.length, 1);
      assert.equal(roads[0].roadId, 'ROAD-A');
    });
  });

  describe('3. RoutingProvider & Factory Unit Tests', () => {
    test('ExistingGraphRoutingProvider returns verified baseline summary', () => {
      const provider = new ExistingGraphRoutingProvider(
        matcher.dijkstraService,
        matcher.graphService,
        matcher.nearestSegmentService
      );

      assert.equal(provider.getProviderName(), 'existing');
      const summary = provider.getGraphSummary();
      assert.equal(summary.provider, 'existing');
      assert.equal(summary.nodeCount, 70);
      assert.equal(summary.roadSegmentCount, 182);
      assert.equal(summary.edgeCount, 351);
    });

    test('ExistingGraphRoutingProvider calculates dynamic route between arbitrary GPS points', () => {
      const provider = new ExistingGraphRoutingProvider(
        matcher.dijkstraService,
        matcher.graphService,
        matcher.nearestSegmentService
      );

      const origin = { latitude: 13.0827, longitude: 80.2707 };
      const destination = { latitude: 13.0645, longitude: 80.2600 };

      const route = provider.calculateRoute(origin, destination);
      assert.ok(route);
      assert.equal(route.routingProvider, 'existing');
      assert.ok(route.distanceKm > 0);
      assert.ok(route.travelTimeMinutes > 0);
      assert.ok(route.waypoints.length >= 2);
    });

    test('KmlAugmentedRoutingProvider attaches snapping metadata', () => {
      const provider = new KmlAugmentedRoutingProvider(
        matcher.dijkstraService,
        matcher.graphService,
        matcher.nearestSegmentService
      );

      assert.equal(provider.getProviderName(), 'kml_augmented');
      const summary = provider.getGraphSummary();
      assert.equal(summary.provider, 'kml_augmented');
      assert.ok(summary.kmlRoadLines > 0);

      const origin = { latitude: 13.0827, longitude: 80.2707 }; // Chennai Central
      const destination = { latitude: 13.0645, longitude: 80.2600 }; // Mount Road

      const multi = provider.findMultiRoutes(origin, destination);
      assert.ok(multi);
      assert.equal(multi.routingProvider, 'kml_augmented');
      assert.ok(multi.snappingMetadata);
      assert.ok(multi.snappingMetadata.origin.isSnapped);
      assert.ok(multi.snappingMetadata.destination.isSnapped);
      assert.ok(multi.snappingMetadata.origin.roadName);
      assert.ok(multi.primaryRoute.distanceKm > 0);
    });

    test('RoutingProviderFactory defaults to existing and switches on request', () => {
      RoutingProviderFactory.reset();

      const defaultProvider = RoutingProviderFactory.getProvider({
        source: 'existing',
        dijkstraService: matcher.dijkstraService,
        graphService: matcher.graphService,
        nearestSegmentService: matcher.nearestSegmentService,
      });
      assert.equal(defaultProvider.getProviderName(), 'existing');

      RoutingProviderFactory.reset();
      const kmlProvider = RoutingProviderFactory.getProvider({
        source: 'kml_augmented',
        dijkstraService: matcher.dijkstraService,
        graphService: matcher.graphService,
        nearestSegmentService: matcher.nearestSegmentService,
      });
      assert.equal(kmlProvider.getProviderName(), 'kml_augmented');
    });
  });

  describe('4. Deterministic Routing Validation (Chennai Benchmarks)', () => {
    test('Dijkstra finds traffic-adjusted route between H001 and H007', () => {
      const route = matcher.dijkstraService.findShortestRoute('H001', 'H007');
      assert.ok(route);
      assert.ok(route.nodeIds.length >= 2);
      assert.equal(route.nodeIds[0], 'H001');
      assert.equal(route.nodeIds[route.nodeIds.length - 1], 'H007');
      assert.ok(route.distanceKm > 0);
      assert.ok(route.travelTimeMinutes > 0);
    });

    test('Dynamic route preserves continuity and endpoint alignment within 2 km tolerance', () => {
      const origin = { latitude: 13.0827, longitude: 80.2707 };
      const destination = { latitude: 13.0369, longitude: 80.2031 };

      const route = matcher.dijkstraService.findDynamicRoute(origin, destination);
      assert.ok(route.validation.valid, `Route must be valid: ${route.validation.reason}`);
      assert.equal(route.validation.reason, 'OK');
      assert.ok(route.distanceKm > 0);
      assert.ok(route.estimatedTimeMin > 0);
    });
  });
});
