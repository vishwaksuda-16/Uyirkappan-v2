import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:driver_app/core/utils/geo_utils.dart';
import 'package:driver_app/models/route_model.dart';
import 'package:driver_app/services/location/geolocator_wrapper.dart';
import 'package:driver_app/services/location/gps_quality_filter.dart';
import 'package:driver_app/services/location/location_provider.dart';
import 'package:driver_app/services/location/real_gps_location_provider.dart';
import 'package:driver_app/services/location/simulation_location_provider.dart';
import 'package:driver_app/services/location/real_location_service.dart';

/// Test double implementing GeolocatorWrapper with controllable returns and streams.
class FakeGeolocatorWrapper implements GeolocatorWrapper {
  bool serviceEnabled = true;
  LocationPermission checkPermissionReturn = LocationPermission.whileInUse;
  LocationPermission requestPermissionReturn = LocationPermission.whileInUse;
  Position? currentPositionReturn;
  final StreamController<Position> positionStreamController =
      StreamController<Position>.broadcast();

  @override
  Future<bool> isLocationServiceEnabled() async => serviceEnabled;

  @override
  Future<LocationPermission> checkPermission() async => checkPermissionReturn;

  @override
  Future<LocationPermission> requestPermission() async => requestPermissionReturn;

  @override
  Future<Position?> getCurrentPosition({LocationSettings? locationSettings}) async =>
      currentPositionReturn;

  @override
  Stream<Position> getPositionStream({LocationSettings? locationSettings}) =>
      positionStreamController.stream;

  void dispose() {
    positionStreamController.close();
  }
}

Position _createPosition({
  required double latitude,
  required double longitude,
  required DateTime timestamp,
  double accuracy = 10.0,
  double altitude = 15.0,
  double heading = 90.0,
  double speed = 10.0, // 10 m/s = 36 km/h
  double speedAccuracy = 0.5,
  bool isMocked = false,
}) {
  return Position(
    latitude: latitude,
    longitude: longitude,
    timestamp: timestamp,
    accuracy: accuracy,
    altitude: altitude,
    altitudeAccuracy: 1.0,
    heading: heading,
    headingAccuracy: 1.0,
    speed: speed,
    speedAccuracy: speedAccuracy,
    isMocked: isMocked,
  );
}

RouteModel _createTestRoute() {
  return const RouteModel(
    routeId: 'TEST-ROUTE-01',
    waypoints: [
      RouteWaypoint(
        nodeId: 'WP1',
        nodeName: 'Chennai Central',
        location: GeoPoint(13.0827, 80.2707),
      ),
      RouteWaypoint(
        nodeId: 'WP2',
        nodeName: 'Park Town',
        location: GeoPoint(13.0830, 80.2710),
      ),
      RouteWaypoint(
        nodeId: 'WP3',
        nodeName: 'GH Roundabout',
        location: GeoPoint(13.0835, 80.2715),
      ),
    ],
    totalDistanceKm: 1.5,
    estimatedMinutes: 4,
  );
}

void main() {
  group('GpsQualityFilter Unit Tests', () {
    late GpsQualityFilter filter;

    setUp(() {
      filter = const GpsQualityFilter(
        maxStaleDuration: Duration(seconds: 30),
        maxAccuracyMeters: 100.0,
        maxSpeedKmh: 180.0,
        maxJumpMetersPerSecond: 50.0,
      );
    });

    test('Validates nominal coordinates within Chennai bounds', () {
      expect(filter.isValidCoordinates(13.0827, 80.2707), isTrue);
      expect(filter.isValidCoordinates(0.0, 0.0), isTrue);
      expect(filter.isValidCoordinates(-90.0, -180.0), isTrue);
      expect(filter.isValidCoordinates(90.0, 180.0), isTrue);
    });

    test('Rejects out-of-bound or NaN/infinite coordinates', () {
      expect(filter.isValidCoordinates(90.1, 80.0), isFalse);
      expect(filter.isValidCoordinates(-90.1, 80.0), isFalse);
      expect(filter.isValidCoordinates(13.0, 180.5), isFalse);
      expect(filter.isValidCoordinates(13.0, -180.5), isFalse);
      expect(filter.isValidCoordinates(double.nan, 80.0), isFalse);
      expect(filter.isValidCoordinates(13.0, double.infinity), isFalse);
    });

    test('Identifies stale timestamps (> 30s past or > 5m future)', () {
      final now = DateTime(2026, 10, 3, 12, 0, 0);

      // Fresh: 5 seconds ago
      expect(filter.isStale(now.subtract(const Duration(seconds: 5)), now: now), isFalse);

      // Stale: 45 seconds ago
      expect(filter.isStale(now.subtract(const Duration(seconds: 45)), now: now), isTrue);

      // Invalid future: 10 minutes in the future
      expect(filter.isStale(now.add(const Duration(minutes: 10)), now: now), isTrue);

      // Valid near future: 10 seconds ahead (minor clock drift)
      expect(filter.isStale(now.add(const Duration(seconds: 10)), now: now), isFalse);
    });

    test('Identifies degraded horizontal accuracy (> 100m)', () {
      expect(filter.isAccuracyDegraded(15.0), isFalse);
      expect(filter.isAccuracyDegraded(99.0), isFalse);
      expect(filter.isAccuracyDegraded(105.0), isTrue);
      expect(filter.isAccuracyDegraded(350.0), isTrue);
      expect(filter.isAccuracyDegraded(null), isFalse);
    });

    test('Identifies impossible kinematic jump / teleportation', () {
      final t0 = DateTime(2026, 10, 3, 12, 0, 0);
      final p1 = RawLocationData(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: t0,
        provider: 'real_gps',
      );

      // 1 second later, 10 km away (~36,000 km/h)
      final p2 = RawLocationData(
        latitude: 13.1827,
        longitude: 80.2707,
        timestamp: t0.add(const Duration(seconds: 1)),
        provider: 'real_gps',
      );

      expect(filter.isImpossibleJump(p1, p2), isTrue);

      // 10 seconds later, 100 meters away (~36 km/h)
      final p3 = RawLocationData(
        latitude: 13.0835,
        longitude: 80.2707,
        timestamp: t0.add(const Duration(seconds: 10)),
        provider: 'real_gps',
      );

      expect(filter.isImpossibleJump(p1, p3), isFalse);
    });

    test('Comprehensive evaluation categorizes outcomes correctly', () {
      final now = DateTime(2026, 10, 3, 12, 0, 0);

      // Valid update
      final validLoc = RawLocationData(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: now,
        accuracy: 12.0,
        provider: 'real_gps',
      );
      final evalValid = filter.evaluate(null, validLoc, now: now);
      expect(evalValid.outcome, GpsQualityOutcome.valid);
      expect(evalValid.isUsable, isTrue);

      // Degraded accuracy update
      final degradedLoc = RawLocationData(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: now,
        accuracy: 120.0,
        provider: 'real_gps',
      );
      final evalDegraded = filter.evaluate(null, degradedLoc, now: now);
      expect(evalDegraded.outcome, GpsQualityOutcome.degradedAccuracy);
      expect(evalDegraded.isUsable, isTrue);

      // Out of bounds update
      final outOfBoundsLoc = RawLocationData(
        latitude: 95.0,
        longitude: 80.2707,
        timestamp: now,
        accuracy: 10.0,
        provider: 'real_gps',
      );
      final evalOob = filter.evaluate(null, outOfBoundsLoc, now: now);
      expect(evalOob.outcome, GpsQualityOutcome.rejectedInvalidCoordinates);
      expect(evalOob.isUsable, isFalse);

      // Stale update
      final staleLoc = RawLocationData(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: now.subtract(const Duration(seconds: 60)),
        accuracy: 10.0,
        provider: 'real_gps',
      );
      final evalStale = filter.evaluate(null, staleLoc, now: now);
      expect(evalStale.outcome, GpsQualityOutcome.rejectedStale);
      expect(evalStale.isUsable, isFalse);
    });
  });

  group('RealGpsLocationProvider Unit Tests', () {
    late FakeGeolocatorWrapper fakeWrapper;
    late RealGpsLocationProvider provider;

    setUp(() {
      fakeWrapper = FakeGeolocatorWrapper();
      provider = RealGpsLocationProvider(wrapper: fakeWrapper);
    });

    tearDown(() {
      provider.dispose();
      fakeWrapper.dispose();
    });

    test('Reports unavailable and serviceDisabled when location service is disabled', () async {
      fakeWrapper.serviceEnabled = false;

      final isAvail = await provider.isAvailable();
      expect(isAvail, isFalse);

      await provider.start();
      expect(provider.status, LocationProviderStatus.serviceDisabled);
    });

    test('Requests permission when initially denied and updates status on permanent denial', () async {
      fakeWrapper.serviceEnabled = true;
      fakeWrapper.checkPermissionReturn = LocationPermission.denied;
      fakeWrapper.requestPermissionReturn = LocationPermission.deniedForever;

      await provider.start();
      expect(provider.status, LocationProviderStatus.permissionDeniedForever);
    });

    test('Requests permission and succeeds when granted while in use', () async {
      fakeWrapper.serviceEnabled = true;
      fakeWrapper.checkPermissionReturn = LocationPermission.denied;
      fakeWrapper.requestPermissionReturn = LocationPermission.whileInUse;

      final now = DateTime.now();
      fakeWrapper.currentPositionReturn = _createPosition(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: now,
        speed: 15.0, // 15 m/s = 54 km/h
      );

      final received = <RawLocationData>[];
      final sub = provider.locationStream.listen(received.add);

      await provider.start();
      expect(provider.status, LocationProviderStatus.live);

      // Verify immediate current position delivery
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(received.length, 1);
      expect(received.first.latitude, 13.0827);
      expect(received.first.longitude, 80.2707);
      expect(received.first.speed, closeTo(54.0, 0.1));
      expect(received.first.provider, 'real_gps');

      // Emit subsequent position via stream
      fakeWrapper.positionStreamController.add(
        _createPosition(
          latitude: 13.0835,
          longitude: 80.2715,
          timestamp: now.add(const Duration(seconds: 1)),
          speed: 10.0,
        ),
      );

      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(received.length, 2);
      expect(received.last.latitude, 13.0835);

      await sub.cancel();
      await provider.stop();
    });

    test('getCurrentLocation checks permissions and returns position', () async {
      fakeWrapper.serviceEnabled = true;
      fakeWrapper.checkPermissionReturn = LocationPermission.always;
      fakeWrapper.currentPositionReturn = _createPosition(
        latitude: 13.0645,
        longitude: 80.2600,
        timestamp: DateTime.now(),
      );

      final loc = await provider.getCurrentLocation();
      expect(loc, isNotNull);
      expect(loc!.latitude, 13.0645);
      expect(loc.longitude, 80.2600);
      expect(loc.provider, 'real_gps');
    });
  });

  group('SimulationLocationProvider Unit Tests', () {
    late SimulationLocationProvider simProvider;

    setUp(() {
      simProvider = SimulationLocationProvider();
    });

    tearDown(() {
      simProvider.dispose();
    });

    test('Status is simulation and is always available', () async {
      expect(simProvider.status, LocationProviderStatus.simulation);
      expect(await simProvider.isAvailable(), isTrue);
    });

    test('Emits simulated positions along configured route', () async {
      final route = _createTestRoute();
      simProvider.setRoute(route);
      simProvider.setSpeedMultiplier(10.0);

      final emitted = <RawLocationData>[];
      final sub = simProvider.locationStream.listen(emitted.add);

      await simProvider.start();
      await Future<void>.delayed(const Duration(milliseconds: 150));

      expect(emitted.isNotEmpty, isTrue);
      expect(emitted.first.latitude, 13.0827);
      expect(emitted.first.provider, 'simulation');
      expect(emitted.first.speed, 22.5);

      await sub.cancel();
      await simProvider.stop();
    });
  });

  group('RealLocationService Orchestration Tests', () {
    late FakeGeolocatorWrapper fakeWrapper;
    late RealGpsLocationProvider realProvider;
    late SimulationLocationProvider fallbackProvider;
    late RealLocationService service;

    setUp(() {
      fakeWrapper = FakeGeolocatorWrapper();
      realProvider = RealGpsLocationProvider(wrapper: fakeWrapper);
      fallbackProvider = SimulationLocationProvider();
      service = RealLocationService(
        primaryProvider: realProvider,
        fallbackProvider: fallbackProvider,
      );
    });

    tearDown(() {
      service.dispose();
      realProvider.dispose();
      fallbackProvider.dispose();
      fakeWrapper.dispose();
    });

    test('Falls back to simulation provider when hardware GPS service is disabled', () async {
      fakeWrapper.serviceEnabled = false;

      final statuses = <LocationProviderStatus>[];
      final sub = service.statusStream.listen(statuses.add);

      final testRoute = _createTestRoute();
      service.startTracking(testRoute, 'AMB-001');

      // Allow async permission check to run
      await Future<void>.delayed(const Duration(milliseconds: 100));

      // Status should transition through fallback to simulation
      expect(service.status, LocationProviderStatus.simulation);
      expect(service.isTracking, isTrue);

      await sub.cancel();
      service.stopTracking();
    });

    test('Streams valid real GPS locations and updates current location', () async {
      fakeWrapper.serviceEnabled = true;
      fakeWrapper.checkPermissionReturn = LocationPermission.whileInUse;

      final now = DateTime.now();
      fakeWrapper.currentPositionReturn = _createPosition(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: now,
        speed: 12.0,
      );

      final locations = [];
      final sub = service.locationStream.listen(locations.add);

      final testRoute = _createTestRoute();
      service.startTracking(testRoute, 'AMB-001');
      await Future<void>.delayed(const Duration(milliseconds: 100));

      expect(service.status, LocationProviderStatus.live);
      expect(service.currentLocation, isNotNull);
      expect(service.currentLocation!.latitude, 13.0827);
      expect(service.currentLocation!.provider, 'real_gps');

      await sub.cancel();
      service.stopTracking();
    });
  });
}
