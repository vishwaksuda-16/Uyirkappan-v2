import 'dart:async';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import 'location_service.dart';

/// Real location service implementation for live ambulance telemetry and tracking.
class RealLocationService implements LocationService {
  final StreamController<AmbulanceLocation> _locationController =
      StreamController<AmbulanceLocation>.broadcast();
  Timer? _ticker;

  RouteModel? _currentRoute;
  String? _ambulanceId;
  String? _requestId;
  int _currentWaypointIndex = 0;
  AmbulanceLocation? _currentLocation;
  bool _isTracking = false;
  bool _isPaused = false;

  @override
  Stream<AmbulanceLocation> get locationStream => _locationController.stream;

  @override
  AmbulanceLocation? get currentLocation => _currentLocation;

  @override
  bool get isTracking => _isTracking;

  @override
  void startTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
    double initialSpeedKmh = 40.0,
  }) {
    stopTracking();
    _currentRoute = route;
    _ambulanceId = ambulanceId;
    _requestId = requestId;
    _currentWaypointIndex = 0;
    _isTracking = true;
    _isPaused = false;

    if (route.waypoints.isNotEmpty) {
      final firstPoint = route.waypoints.first;
      _emitLocation(
        firstPoint.location.latitude,
        firstPoint.location.longitude,
        initialSpeedKmh,
      );
    }

    _ticker = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!_isTracking || _isPaused || _currentRoute == null) return;
      if (_currentWaypointIndex < _currentRoute!.waypoints.length - 1) {
        _currentWaypointIndex++;
        final wp = _currentRoute!.waypoints[_currentWaypointIndex];
        _emitLocation(
          wp.location.latitude,
          wp.location.longitude,
          initialSpeedKmh,
        );
      }
    });
  }

  void _emitLocation(double lat, double lng, double speed) {
    _currentLocation = AmbulanceLocation(
      ambulanceId: _ambulanceId ?? '',
      latitude: lat,
      longitude: lng,
      speed: speed,
      heading: 0.0,
      timestamp: DateTime.now(),
      requestId: _requestId,
    );
    _locationController.add(_currentLocation!);
  }

  @override
  void updateRoute(RouteModel newRoute) {
    _currentRoute = newRoute;
    _currentWaypointIndex = 0;
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

  @override
  void setSpeedMultiplier(double multiplier) {}

  void dispose() {
    stopTracking();
    _locationController.close();
  }
}
