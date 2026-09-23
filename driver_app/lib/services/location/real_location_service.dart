import 'dart:async';
import '../../core/utils/geo_utils.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import 'location_service.dart';

/// Real location service implementation with smooth geometric interpolation
/// along road-network route waypoints, dynamic speed control, and progressive telemetry.
class RealLocationService implements LocationService {
  final StreamController<AmbulanceLocation> _locationController =
      StreamController<AmbulanceLocation>.broadcast();
  Timer? _ticker;

  RouteModel? _currentRoute;
  String? _ambulanceId;
  String? _requestId;

  int _currentSegmentIndex = 0;
  double _segmentProgress = 0.0; // 0.0 to 1.0 within current road segment
  double _speedKmh = 38.0;
  double _speedMultiplier = 1.0;
  bool _isTracking = false;
  bool _isPaused = false;

  AmbulanceLocation? _currentLocation;

  @override
  Stream<AmbulanceLocation> get locationStream => _locationController.stream;

  @override
  AmbulanceLocation? get currentLocation => _currentLocation;

  @override
  bool get isTracking => _isTracking;

  bool get isPaused => _isPaused;
  double get speedMultiplier => _speedMultiplier;

  @override
  void setSpeedMultiplier(double multiplier) {
    _speedMultiplier = multiplier.clamp(0.5, 5.0);
  }

  @override
  void startTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
    double initialSpeedKmh = 38.0,
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

    // Initial position emission at start of route
    final startWp = route.waypoints.first;
    final nextWp = route.waypoints.length > 1 ? route.waypoints[1] : startWp;
    final initialBearing = GeoUtils.calculateBearing(startWp.location, nextWp.location);

    _emitLocation(
      startWp.location.latitude,
      startWp.location.longitude,
      _speedKmh,
      initialBearing,
      nodeName: startWp.nodeName,
    );

    // 1-second simulation clock for realistic, smooth visual progress
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_isTracking || _isPaused || _currentRoute == null) return;
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
        destWp.location.latitude,
        destWp.location.longitude,
        0.0,
        _currentLocation?.heading ?? 0.0,
        nodeName: destWp.nodeName,
      );
      stopTracking();
      return;
    }

    final p1 = waypoints[_currentSegmentIndex].location;
    final p2 = waypoints[_currentSegmentIndex + 1].location;
    final segmentDistanceKm = GeoUtils.distanceKm(p1, p2);

    // Distance covered in 1 second at current speed (km/h) multiplied by simulation speed
    // distanceKm = (speedKmh / 3600) * multiplier
    final distanceCoveredThisSec = (_speedKmh / 3600.0) * _speedMultiplier;

    final progressIncrement = segmentDistanceKm > 0.001
        ? distanceCoveredThisSec / segmentDistanceKm
        : 1.0;

    _segmentProgress += progressIncrement;

    if (_segmentProgress >= 1.0) {
      // Advance to next segment
      _currentSegmentIndex++;
      _segmentProgress = 0.0;

      if (_currentSegmentIndex >= waypoints.length - 1) {
        final destWp = waypoints.last;
        _emitLocation(
          destWp.location.latitude,
          destWp.location.longitude,
          0.0,
          _currentLocation?.heading ?? 0.0,
          nodeName: destWp.nodeName,
        );
        stopTracking();
        return;
      }
    }

    // Smoothly interpolate coordinate along the road geometry
    final currentP1 = waypoints[_currentSegmentIndex].location;
    final currentP2 = waypoints[_currentSegmentIndex + 1].location;
    final interpolatedPos = GeoUtils.interpolate(currentP1, currentP2, _segmentProgress);
    final heading = GeoUtils.calculateBearing(currentP1, currentP2);
    final currentNodeName = waypoints[_currentSegmentIndex].nodeName;

    _emitLocation(
      interpolatedPos.latitude,
      interpolatedPos.longitude,
      _speedKmh * _speedMultiplier,
      heading,
      nodeName: currentNodeName,
    );
  }

  void _emitLocation(
    double lat,
    double lng,
    double speed,
    double heading, {
    String? nodeName,
  }) {
    _currentLocation = AmbulanceLocation(
      ambulanceId: _ambulanceId ?? 'AMB0001',
      latitude: lat,
      longitude: lng,
      speed: speed,
      heading: heading,
      timestamp: DateTime.now(),
      requestId: _requestId,
      nodeName: nodeName,
    );
    _locationController.add(_currentLocation!);
  }

  @override
  void updateRoute(RouteModel newRoute) {
    _currentRoute = newRoute;
    _currentSegmentIndex = 0;
    _segmentProgress = 0.0;
  }

  @override
  void pauseTracking() => _isPaused = true;

  @override
  void resumeTracking() => _isPaused = false;

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
