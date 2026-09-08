import 'dart:async';
import 'dart:math' as math;
import '../../core/utils/geo_utils.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import 'location_service.dart';

/// Simulated Location Service for offline unit test suites and telemetry verification.
/// Disconnected from production runtime.
class SimulatedLocationService implements LocationService {
  final _locationController = StreamController<AmbulanceLocation>.broadcast();
  Timer? _ticker;

  RouteModel? _currentRoute;
  String? _ambulanceId;
  String? _requestId;

  int _currentSegmentIndex = 0;
  double _segmentProgress = 0.0; // 0.0 to 1.0 within current segment
  double _speedKmh = 42.0;
  double _speedMultiplier = 1.0;
  bool _isTracking = false;
  bool _isPaused = false;

  AmbulanceLocation? _lastEmittedLocation;

  @override
  Stream<AmbulanceLocation> get locationStream => _locationController.stream;

  @override
  AmbulanceLocation? get currentLocation => _lastEmittedLocation;

  @override
  bool get isTracking => _isTracking;

  bool get isPaused => _isPaused;
  double get currentSpeedKmh => _speedKmh;
  double get speedMultiplier => _speedMultiplier;

  @override
  void setSpeedMultiplier(double multiplier) {
    _speedMultiplier = multiplier.clamp(0.5, 10.0);
  }

  @override
  void startTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
    double initialSpeedKmh = 42.0,
  }) {
    stopTracking();

    _currentRoute = route;
    _ambulanceId = ambulanceId;
    _requestId = requestId;
    _currentSegmentIndex = 0;
    _segmentProgress = 0.0;
    _speedKmh = initialSpeedKmh;
    _isTracking = true;
    _isPaused = false;

    if (route.waypoints.isEmpty) return;

    // Initial location emission at start node
    final startWp = route.waypoints.first;
    final nextWp = route.waypoints.length > 1 ? route.waypoints[1] : startWp;
    final initialBearing = GeoUtils.calculateBearing(startWp.location, nextWp.location);

    _emitLocation(
      latitude: startWp.location.latitude,
      longitude: startWp.location.longitude,
      speed: _speedKmh,
      heading: initialBearing,
      nodeName: startWp.nodeName,
    );

    // Periodic simulation ticker (every 1 second)
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_isPaused || !_isTracking || _currentRoute == null) return;
      _tickMovement();
    });
  }

  void _tickMovement() {
    final route = _currentRoute!;
    final waypoints = route.waypoints;
    if (waypoints.length < 2 || _currentSegmentIndex >= waypoints.length - 1) {
      // Arrived at destination waypoint
      final destWp = waypoints.last;
      _emitLocation(
        latitude: destWp.location.latitude,
        longitude: destWp.location.longitude,
        speed: 0.0,
        heading: _lastEmittedLocation?.heading ?? 0.0,
        nodeName: destWp.nodeName,
      );
      stopTracking();
      return;
    }

    final p1 = waypoints[_currentSegmentIndex].location;
    final p2 = waypoints[_currentSegmentIndex + 1].location;
    final segmentDistanceKm = GeoUtils.distanceKm(p1, p2);

    // Fluctuate speed realistically (+- 3 km/h)
    final randomJitter = (math.Random().nextDouble() - 0.5) * 6.0;
    _speedKmh = (42.0 + randomJitter).clamp(25.0, 65.0);

    // Distance covered in 1 second at current speed (accounting for multiplier)
    // distance = speed (km/h) / 3600 * multiplier
    final distanceCoveredThisTick = (_speedKmh / 3600.0) * _speedMultiplier;

    final progressIncrement = segmentDistanceKm > 0
        ? distanceCoveredThisTick / segmentDistanceKm
        : 1.0;

    _segmentProgress += progressIncrement;

    if (_segmentProgress >= 1.0) {
      // Advance to next segment
      _currentSegmentIndex++;
      _segmentProgress = 0.0;

      if (_currentSegmentIndex >= waypoints.length - 1) {
        final destWp = waypoints.last;
        _emitLocation(
          latitude: destWp.location.latitude,
          longitude: destWp.location.longitude,
          speed: 0.0,
          heading: _lastEmittedLocation?.heading ?? 0.0,
          nodeName: destWp.nodeName,
        );
        stopTracking();
        return;
      }
    }

    // Interpolate current coordinate between p1 and p2
    final currentP1 = waypoints[_currentSegmentIndex].location;
    final currentP2 = waypoints[_currentSegmentIndex + 1].location;
    final interpolatedPos = GeoUtils.interpolate(currentP1, currentP2, _segmentProgress);
    final heading = GeoUtils.calculateBearing(currentP1, currentP2);
    final currentNodeName = waypoints[_currentSegmentIndex].nodeName;

    _emitLocation(
      latitude: interpolatedPos.latitude,
      longitude: interpolatedPos.longitude,
      speed: _speedKmh,
      heading: heading,
      nodeName: currentNodeName,
    );
  }

  void _emitLocation({
    required double latitude,
    required double longitude,
    required double speed,
    required double heading,
    String? nodeName,
  }) {
    final location = AmbulanceLocation(
      latitude: latitude,
      longitude: longitude,
      timestamp: DateTime.now(),
      speed: speed,
      heading: heading,
      ambulanceId: _ambulanceId ?? 'AMB-003',
      requestId: _requestId,
      nodeName: nodeName,
    );
    _lastEmittedLocation = location;
    _locationController.add(location);
  }

  @override
  void updateRoute(RouteModel newRoute) {
    _currentRoute = newRoute;
    _currentSegmentIndex = 0;
    _segmentProgress = 0.0;
  }

  @override
  void pauseTracking() {
    _isPaused = true;
  }

  @override
  void resumeTracking() {
    _isPaused = false;
  }

  @override
  void stopTracking() {
    _ticker?.cancel();
    _ticker = null;
    _isTracking = false;
    _isPaused = false;
  }

  void dispose() {
    stopTracking();
    _locationController.close();
  }
}
