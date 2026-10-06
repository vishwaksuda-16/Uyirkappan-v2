import 'dart:async';
import '../../core/utils/geo_utils.dart';
import '../../models/route_model.dart';
import 'location_provider.dart';

/// Simulated GPS provider for offline testing, demos, headless CI, and simulation mode.
class SimulationLocationProvider implements LocationProvider {
  final StreamController<RawLocationData> _locationController =
      StreamController<RawLocationData>.broadcast();
  final StreamController<LocationProviderStatus> _statusController =
      StreamController<LocationProviderStatus>.broadcast();

  Timer? _ticker;
  RouteModel? _currentRoute;
  int _currentSegmentIndex = 0;
  double _segmentProgress = 0.0;
  double get _speedKmh => _currentRoute?.estimatedAverageSpeedKmh ?? 40.0;
  double _speedMultiplier = 1.0;
  bool _isTracking = false;
  bool _isPaused = false;
  RawLocationData? _lastLocation;

  SimulationLocationProvider({RouteModel? initialRoute})
      : _currentRoute = initialRoute {
    if (initialRoute != null && initialRoute.waypoints.isNotEmpty) {
      final start = initialRoute.waypoints.first;
      _lastLocation = RawLocationData(
        latitude: start.location.latitude,
        longitude: start.location.longitude,
        timestamp: DateTime.now(),
        speed: 0.0,
        heading: 0.0,
        accuracy: 3.0,
        altitude: 10.0,
        isMock: true,
        provider: 'simulation',
      );
    }
  }

  @override
  Stream<RawLocationData> get locationStream => _locationController.stream;

  @override
  LocationProviderStatus get status => LocationProviderStatus.simulation;

  @override
  Stream<LocationProviderStatus> get statusStream => _statusController.stream;

  @override
  Future<bool> isAvailable() async => true;

  void setRoute(RouteModel route) {
    _currentRoute = route;
    _currentSegmentIndex = 0;
    _segmentProgress = 0.0;
    if (route.waypoints.isNotEmpty) {
      final start = route.waypoints.first;
      _lastLocation = RawLocationData(
        latitude: start.location.latitude,
        longitude: start.location.longitude,
        timestamp: DateTime.now(),
        speed: 0.0,
        heading: 0.0,
        accuracy: 3.0,
        altitude: 10.0,
        isMock: true,
        provider: 'simulation',
      );
    }
  }

  void setSpeedMultiplier(double multiplier) {
    _speedMultiplier = multiplier.clamp(0.5, 10.0);
  }

  @override
  Future<RawLocationData?> getCurrentLocation() async {
    return _lastLocation ??
        RawLocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
          speed: 0.0,
          heading: 0.0,
          accuracy: 3.0,
          altitude: 10.0,
          isMock: true,
          provider: 'simulation',
        );
  }

  @override
  Future<void> start() async {
    stop();
    _isTracking = true;
    _isPaused = false;
    _statusController.add(LocationProviderStatus.simulation);

    if (_currentRoute == null || _currentRoute!.waypoints.isEmpty) {
      // Emit default initial coordinate if no route specified
      final defaultLoc = await getCurrentLocation();
      if (defaultLoc != null) {
        _lastLocation = defaultLoc;
        _locationController.add(defaultLoc);
      }
      return;
    }

    // Initial emission
    final waypoints = _currentRoute!.waypoints;
    final startWp = waypoints.first;
    final nextWp = waypoints.length > 1 ? waypoints[1] : startWp;
    final initialBearing = GeoUtils.calculateBearing(startWp.location, nextWp.location);

    _emitLocation(
      startWp.location.latitude,
      startWp.location.longitude,
      _speedKmh,
      initialBearing,
    );

    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_isTracking || _isPaused || _currentRoute == null) return;
      _tickMovement();
    });
  }

  void _tickMovement() {
    final route = _currentRoute!;
    final waypoints = route.waypoints;

    if (waypoints.length < 2 || _currentSegmentIndex >= waypoints.length - 1) {
      final destWp = waypoints.last;
      _emitLocation(
        destWp.location.latitude,
        destWp.location.longitude,
        0.0,
        _lastLocation?.heading ?? 0.0,
      );
      stop();
      return;
    }

    final segmentDistanceKm = route.routeDistanceForSegmentKm(_currentSegmentIndex);

    final distanceCoveredThisTick = (_speedKmh / 3600.0) * _speedMultiplier;
    final progressIncrement = segmentDistanceKm > 0
        ? distanceCoveredThisTick / segmentDistanceKm
        : 1.0;

    _segmentProgress += progressIncrement;

    if (_segmentProgress >= 1.0) {
      _currentSegmentIndex++;
      _segmentProgress = 0.0;

      if (_currentSegmentIndex >= waypoints.length - 1) {
        final destWp = waypoints.last;
        _emitLocation(
          destWp.location.latitude,
          destWp.location.longitude,
          0.0,
          _lastLocation?.heading ?? 0.0,
        );
        stop();
        return;
      }
    }

    final currentP1 = waypoints[_currentSegmentIndex].location;
    final currentP2 = waypoints[_currentSegmentIndex + 1].location;
    final interpolatedPos = GeoUtils.interpolate(currentP1, currentP2, _segmentProgress);
    final heading = GeoUtils.calculateBearing(currentP1, currentP2);

    _emitLocation(
      interpolatedPos.latitude,
      interpolatedPos.longitude,
      _speedKmh * _speedMultiplier,
      heading,
    );
  }

  void _emitLocation(double lat, double lng, double speed, double heading) {
    _lastLocation = RawLocationData(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.now(),
      speed: speed,
      heading: heading,
      accuracy: 2.5,
      altitude: 12.0,
      isMock: true,
      provider: 'simulation',
    );
    _locationController.add(_lastLocation!);
  }

  void pause() => _isPaused = true;
  void resume() => _isPaused = false;

  @override
  Future<void> stop() async {
    _ticker?.cancel();
    _ticker = null;
    _isTracking = false;
    _isPaused = false;
  }

  @override
  void dispose() {
    stop();
    _locationController.close();
    _statusController.close();
  }
}
